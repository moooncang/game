import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const readJSON = async (url) => JSON.parse(await readFile(url, "utf8"));
export const defaultIdentity = await readJSON(
  new URL("./office-identity.json", import.meta.url),
);
const schema = await readJSON(
  new URL("../office/feed.schema.json", import.meta.url),
);
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const employees = ["claude", "gpt"];
const docPattern = /^[1-9]\d*-[1-9]\d*$/;
const chronological = (a, b) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;

export function validateFeed(feed) {
  if (!validate(feed))
    throw new Error(`피드 규격 오류: ${ajv.errorsText(validate.errors)}`);
  return feed;
}

export function identify(comment, config = defaultIdentity) {
  if (comment.login === config.owner) {
    if (comment.app === null) return "ceo";
    if (Object.hasOwn(config.apps, comment.app))
      return config.apps[comment.app];
  }
  if (
    Object.hasOwn(config.bots, comment.login) &&
    config.bots[comment.login] === comment.app
  )
    return "bot";
  return "ignore";
}

function header(body) {
  const lines = body.split("\n");
  const fields = Object.create(null);
  let i = 1;
  for (; i < lines.length && lines[i].trim(); i++) {
    const match = /^([^:]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!match || Object.hasOwn(fields, match[1].trim())) return null;
    fields[match[1].trim()] = match[2].trim();
  }
  return {
    fields,
    body: lines
      .slice(i + 1)
      .join("\n")
      .trim(),
  };
}

/** 순수 계산: 입력은 REST 응답을 normalizeComment로 정규화한 댓글이다. */
export function buildFeed(
  { issues, comments, repo = "moooncang/game", now = new Date().toISOString() },
  config = defaultIdentity,
) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isFinite(Date.parse(now)))
    throw new Error("저장소 또는 생성 시각 오류");
  const base = `https://github.com/${repo}`;
  const tasks = issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const labels = (i.labels || []).map((l) =>
        typeof l === "string" ? l : l.name,
      );
      const assigned = employees.filter((e) => labels.includes(`담당:${e}`));
      return {
        number: i.number,
        title: i.title,
        assignee: assigned.length === 1 ? assigned[0] : null,
        state: i.state,
        url: `${base}/issues/${i.number}`,
      };
    })
    .sort((a, b) => b.number - a.number);
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const staff = Object.fromEntries(
    employees.map((e) => [
      e,
      {
        name: e === "gpt" ? "GPT" : "Claude",
        state: "offline",
        message: "",
        task: null,
        updated_at: null,
        open_feedback: 0,
      },
    ]),
  );
  const reports = [],
    docs = new Map(),
    latest = new Map(),
    warnings = [],
    ignored = new Set();
  // 로그에 외부 댓글 본문을 포함하지 않는다.
  const warn = (c, reason, discard = false) => {
    warnings.push({ id: c.id, reason });
    if (discard) ignored.add(c.id);
  };
  for (const original of [...comments].sort(chronological)) {
    const c = {
      ...original,
      body: String(original.body ?? "").replace(/\r\n?/g, "\n"),
    };
    const first = c.body.split("\n")[0].trimEnd();
    const marker = /^<!-- office:(status|report) -->$/.exec(first);
    const command = /^\/(피드백|승인|반려)(?:[ \t\n]|$)/.exec(c.body);
    if (!marker && !command) {
      if (/^<!-- office:/.test(first)) warn(c, "알 수 없는 양식", true);
      continue;
    }
    if (!taskNumbers.has(c.issue)) continue; // PR 대화는 업무 댓글이 아니다.
    if (
      !Number.isSafeInteger(c.id) ||
      !Number.isFinite(Date.parse(c.created_at))
    ) {
      warn(c, "댓글 메타데이터 오류", true);
      continue;
    }
    const identity = identify(c, config);
    if (identity === "ignore") {
      warn(c, "인정되지 않은 신원", true);
      continue;
    }
    const url = `${base}/issues/${c.issue}#issuecomment-${c.id}`;
    if (marker) {
      const parsed = header(c.body);
      const f = parsed?.fields;
      if (
        !f ||
        !employees.includes(f["사원"]) ||
        ![f["사원"], "bot"].includes(identity)
      ) {
        warn(c, "사원 신원 또는 머리 항목 오류", true);
        continue;
      }
      const author = f["사원"];
      if (marker[1] === "status") {
        if (!f["상태"] || !f["메시지"]) {
          warn(c, "상태 필수 항목 누락", true);
          continue;
        }
        Object.assign(staff[author], {
          state: f["상태"],
          message: f["메시지"],
          task: c.issue,
          updated_at: c.created_at,
        });
        continue;
      }
      const doc = f["번호"] ?? null;
      const answers = f["답변"]
        ? [...new Set(f["답변"].split(",").map((s) => s.trim()))]
        : [];
      if (
        !["작업보고", "중간보고", "질문", "검수결과", "기획안"].includes(
          f["종류"],
        ) ||
        !f["제목"] ||
        !parsed.body ||
        (doc !== null &&
          (!docPattern.test(doc) ||
            Number(doc.split("-")[0]) !== c.issue ||
            !f["갈래"] ||
            docs.has(doc))) ||
        (Object.hasOwn(f, "PR") && !/^#[1-9]\d*$/.test(f.PR)) ||
        answers.some((d) => !docPattern.test(d)) ||
        (doc === null && answers.length)
      ) {
        warn(c, "서류 필수 항목·번호·중복 오류", true);
        continue;
      }
      const report = {
        id: c.id,
        doc,
        task: c.issue,
        author,
        branch: f["갈래"] || null,
        kind: f["종류"],
        title: f["제목"],
        pr: f.PR ? Number(f.PR.slice(1)) : null,
        answers,
        body_md: parsed.body,
        created_at: c.created_at,
        status: "pending",
        feedback: [],
        answered_by: null,
        url,
      };
      for (const answer of answers) {
        const target = docs.get(answer);
        const open = target?.feedback.filter((x) => !x.closed) || [];
        if (
          !target ||
          target.task !== c.issue ||
          target.author !== author ||
          !open.length
        ) {
          warn(c, "답변 대상 또는 미처리 피드백 없음");
          continue;
        }
        for (const feedback of open)
          Object.assign(feedback, { closed: true, resolved_by: doc });
        target.status = "answered";
        target.answered_by = doc;
      }
      reports.push(report);
      if (doc) docs.set(doc, report);
      latest.set(c.issue, report);
      continue;
    }
    if (identity !== "ceo") {
      warn(c, "사장님 직접 명령만 인정", true);
      continue;
    }
    const type = { 피드백: "feedback", 승인: "approve", 반려: "reject" }[
      command[1]
    ];
    const rest = c.body.slice(command[1].length + 1).trim();
    let targets,
      message = "";
    // 번호를 잘못 쓴 말(예: 5-1번)은 엉뚱한 서류에 결재되지 않도록 막는다.
    const typo = (word) => /^\d+-/.test(word) && !docPattern.test(word);
    if (type === "approve") {
      // 첫 줄의 번호 모양만 번호로 읽고 나머지 말·다음 줄은 무시한다.
      const words = c.body
        .split("\n")[0]
        .slice(command[1].length + 1)
        .split(/\s+/)
        .filter(Boolean);
      const numbers = words.filter((word) => docPattern.test(word));
      if (numbers.length) targets = numbers.map((d) => docs.get(d));
      else if (words.some(typo)) targets = [];
      else targets = [latest.get(c.issue)];
    } else {
      const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(rest);
      if (match && docPattern.test(match[1])) {
        targets = [docs.get(match[1])];
        message = match[2]?.trim() || "";
      } else if (type === "reject" && !(match && typo(match[1]))) {
        targets = [latest.get(c.issue)];
        message = rest;
      } else targets = [];
      // 반려는 사유를 생략할 수 있지만, 피드백은 고칠 내용이 있어야 한다.
      if (type === "feedback" && !message) targets = [];
    }
    let applied = false;
    for (const target of new Set(targets)) {
      if (!target || target.task !== c.issue) {
        warn(c, "명령 대상 서류 없음 또는 다른 업무");
        continue;
      }
      if (type === "approve") {
        for (const f of target.feedback.filter((x) => !x.closed))
          Object.assign(f, { closed: true, resolved_by: null });
      }
      target.feedback.push({
        type,
        body_md: message,
        at: c.created_at,
        closed: type === "approve",
        resolved_by: null,
        url,
      });
      target.status = type === "approve" ? "approved" : "feedback";
      applied = true;
    }
    if (!applied) warn(c, "명령을 반영하지 않음", true);
  }
  for (const report of reports)
    staff[report.author].open_feedback += report.feedback.filter(
      (f) => !f.closed,
    ).length;
  for (const person of Object.values(staff)) {
    if (
      person.updated_at &&
      Date.parse(now) - Date.parse(person.updated_at) >
        config.staleHours * 3600000
    )
      person.state = "offline";
  }
  const feed = validateFeed({
    version: 2,
    generated_at: now,
    repo,
    employees: staff,
    tasks,
    reports: reports.sort((a, b) => chronological(b, a)),
  });
  return {
    feed,
    warnings,
    ignored_comment_ids: [...ignored].sort((a, b) => a - b),
  };
}

export function normalizeComment(c) {
  return {
    id: c.id,
    issue: Number(c.issue_url?.split("/").pop()),
    login: c.user?.login,
    app: c.performed_via_github_app?.slug ?? null,
    created_at: c.created_at,
    body: c.body,
  };
}

export async function collectGitHub({ repo, token, fetchImpl = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("저장소 형식 오류");
  const prefix = `https://api.github.com/repos/${repo}/`;
  async function pages(path) {
    let url = prefix + path;
    const result = [],
      seen = new Set();
    while (url) {
      // Link 헤더가 토큰을 다른 호스트/저장소로 보내지 못하게 한다.
      if (!url.startsWith(prefix) || seen.has(url))
        throw new Error("페이지 링크 오류");
      seen.add(url);
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(`GitHub API 오류: HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("GitHub API 목록 형식 오류");
      result.push(...data);
      url =
        response.headers
          .get("link")
          ?.split(",")
          .map((s) => /<([^>]+)>;\s*rel="next"/.exec(s)?.[1])
          .find(Boolean) || null;
    }
    return result;
  }
  // issues API에는 PR도 포함된다. buildFeed가 업무와 PR 대화를 분리한다.
  const [issues, comments] = await Promise.all([
    pages("issues?state=all&per_page=100"),
    pages("issues/comments?per_page=100&sort=created&direction=asc"),
  ]);
  return { issues, comments: comments.map(normalizeComment) };
}

async function main() {
  const { values } = parseArgs({
    options: {
      repo: {
        type: "string",
        default: process.env.GITHUB_REPOSITORY || "moooncang/game",
      },
      output: { type: "string", default: "site/feed.json" },
      input: { type: "string" },
      identity: { type: "string" },
    },
  });
  const config = values.identity
    ? await readJSON(values.identity)
    : defaultIdentity;
  const input = values.input
    ? await readJSON(values.input)
    : await collectGitHub({
        repo: values.repo,
        token: process.env.GITHUB_TOKEN,
      });
  const { feed, warnings } = buildFeed({ ...input, repo: values.repo }, config);
  for (const warning of warnings)
    console.warn(`댓글 ${warning.id}: ${warning.reason}`);
  await writeFile(`${values.output}.tmp`, `${JSON.stringify(feed, null, 2)}\n`);
  await rename(`${values.output}.tmp`, values.output);
  console.log(
    `피드 생성 완료: 업무 ${feed.tasks.length}, 서류 ${feed.reports.length}`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
