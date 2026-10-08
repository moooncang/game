import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  buildFeed,
  collectGitHub,
  identify,
  normalizeComment,
  validateFeed,
} from "./office-feed.mjs";
const fixtures = new URL("../office/fixtures/", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, fixtures), "utf8"));
function subset(actual, expected) {
  if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length);
    expected.forEach((v, i) => subset(actual[i], v));
  } else if (expected && typeof expected === "object") {
    for (const [key, value] of Object.entries(expected))
      subset(actual[key], value);
  } else assert.deepEqual(actual, expected);
}
for (const name of (await readdir(fixtures)).filter((f) =>
  f.endsWith(".json"),
)) {
  test(name, async () => {
    const fixture = await read(name);
    const { feed, ignored_comment_ids } = buildFeed(fixture);
    assert.equal(feed.reports.length, fixture.expected.reports.length);
    for (const expected of fixture.expected.reports) {
      const actual = feed.reports.find((r) =>
        expected.doc === null ? r.id === expected.id : r.doc === expected.doc,
      );
      assert.ok(actual);
      subset(actual, expected);
    }
    subset(feed.employees, fixture.expected.employees || {});
    assert.deepEqual(ignored_comment_ids, fixture.expected.ignored_comment_ids);
    validateFeed(feed);
  });
}
test("동일 시각은 댓글 ID 순서, CRLF와 본문 머리 항목 분리", async () => {
  const f = await read("02-feedback-answered.json");
  f.comments.forEach((c) => {
    c.created_at = f.now;
    c.body = c.body.replaceAll("\n", "\r\n");
  });
  f.comments[0].body += "\r\n번호: 99-99";
  f.comments.reverse();
  const { feed } = buildFeed(f);
  assert.equal(feed.reports.find((r) => r.doc === "5-1").status, "answered");
  assert.match(
    feed.reports.find((r) => r.doc === "5-1").body_md,
    /번호: 99-99/,
  );
});
test("답변 후 새 피드백은 다시 열리고 중복 답변은 상태를 바꾸지 않는다", async () => {
  const f = await read("02-feedback-answered.json");
  f.comments.push({
    ...f.comments[1],
    id: 4,
    created_at: "2026-10-08T11:30:00Z",
  });
  const { feed } = buildFeed(f);
  const r = feed.reports.find((r) => r.doc === "5-1");
  assert.equal(r.status, "feedback");
  assert.equal(r.feedback[0].closed, true);
  assert.equal(r.feedback[1].closed, false);
  assert.equal(feed.employees.gpt.open_feedback, 1);
});
test("봇 계정과 앱 쌍, 사장님 앱 부재만 신뢰한다", () => {
  assert.equal(identify({ login: "github-actions[bot]", app: null }), "ignore");
  assert.equal(
    identify({ login: "github-actions[bot]", app: "unknown" }),
    "ignore",
  );
  assert.equal(identify({ login: "moooncang", app: "unknown" }), "ignore");
  assert.equal(identify({ login: "moooncang" }), "ignore");
  assert.equal(identify({ login: "moooncang", app: "toString" }), "ignore");
  assert.equal(identify({ login: "moooncang", app: null }), "ceo");
});
test("설정 가능한 신원표와 12시간 경계", async () => {
  const f = await read("01-basic-reports.json");
  f.comments = [f.comments[0]];
  f.comments[0].login = "other-owner";
  f.comments[0].app = "other-app";
  const config = {
    owner: "other-owner",
    apps: { "other-app": "gpt" },
    bots: {},
    staleHours: 12,
  };
  f.now = "2026-10-08T21:00:00Z";
  assert.equal(buildFeed(f, config).feed.employees.gpt.state, "designing");
  f.now = "2026-10-08T21:00:01Z";
  assert.equal(buildFeed(f, config).feed.employees.gpt.state, "offline");
});
test("잘못된 번호와 필수 본문·머리 항목은 버린다", async () => {
  const f = await read("01-basic-reports.json");
  for (const replacement of [
    "번호: 5-0",
    "번호: 05-1",
    "번호: ",
    "번호: 5-1\n번호: 5-2",
  ]) {
    const c = {
      ...f.comments[1],
      body: f.comments[1].body.replace("번호: 5-1", replacement),
    };
    assert.deepEqual(
      buildFeed({ ...f, comments: [c] }).ignored_comment_ids,
      [2],
    );
  }
});
test("v1 번호 없는 승인은 최신 서류에만 적용한다", async () => {
  const f = await read("11-v1-compat.json");
  f.comments[2].body = "/승인";
  const { feed } = buildFeed(f);
  assert.equal(feed.reports.find((r) => r.id === 2).status, "approved");
  assert.equal(feed.reports.find((r) => r.id === 1).status, "pending");
});
test("PR 및 PR 댓글은 업무 피드에서 제외한다", async () => {
  const f = await read("01-basic-reports.json");
  f.issues[0].pull_request = {
    url: "https://api.github.com/repos/moooncang/game/pulls/5",
  };
  const { feed } = buildFeed(f);
  assert.equal(feed.reports.length, 0);
  assert.deepEqual(
    feed.tasks.map((t) => t.number),
    [6],
  );
});
test("스키마 검증은 추가 필드와 잘못된 시각을 거부한다", async () => {
  const { feed } = buildFeed(await read("01-basic-reports.json"));
  assert.throws(() => validateFeed({ ...feed, secret: "no" }), /피드 규격/);
  assert.throws(
    () => validateFeed({ ...feed, generated_at: "not-a-date" }),
    /피드 규격/,
  );
});
test("API 페이지 수집과 서버 신원 정규화", async () => {
  const calls = [];
  const prefix = "https://api.github.com/repos/moooncang/game/";
  const fetchImpl = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "error");
    if (url.includes("comments"))
      return new Response(
        JSON.stringify([
          {
            id: 1,
            issue_url: prefix + "issues/5",
            user: { login: "moooncang" },
            performed_via_github_app: { slug: "claude" },
            body: "사원: gpt",
          },
        ]),
      );
    return new Response(
      JSON.stringify([{ number: url.includes("page=2") ? 6 : 5 }]),
      {
        headers: url.includes("page=2")
          ? {}
          : { link: `<${prefix}issues?page=2>; rel="next"` },
      },
    );
  };
  const data = await collectGitHub({
    repo: "moooncang/game",
    token: "test",
    fetchImpl,
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    data.issues.map((i) => i.number),
    [5, 6],
  );
  assert.equal(data.comments[0].app, "claude");
  assert.equal(normalizeComment({ user: { login: "x" } }).app, null);
});
test("API 실패와 외부 Link는 배포용 피드를 만들지 않는다", async () => {
  await assert.rejects(
    collectGitHub({
      repo: "moooncang/game",
      fetchImpl: async () => new Response("", { status: 403 }),
    }),
    /HTTP 403/,
  );
  let calls = 0;
  await assert.rejects(
    collectGitHub({
      repo: "moooncang/game",
      fetchImpl: async () => {
        calls++;
        return new Response("[]", {
          headers: { link: '<https://evil.example/>; rel="next"' },
        });
      },
    }),
    /페이지 링크/,
  );
  assert.equal(calls, 2);
});

test("다른 업무 답변은 피드백을 닫지 않고 여러 피드백은 한 답변으로 닫는다", async () => {
  const f = await read("02-feedback-answered.json");
  f.comments.splice(2, 0, {
    ...f.comments[1],
    id: 4,
    created_at: "2026-10-08T10:30:00Z",
  });
  let result = buildFeed(f).feed;
  assert.equal(
    result.reports.find((r) => r.doc === "5-1").feedback.filter((x) => x.closed)
      .length,
    2,
  );
  f.comments[3].issue = 6;
  f.comments[3].body = f.comments[3].body.replace("번호: 5-2", "번호: 6-1");
  result = buildFeed(f).feed;
  assert.equal(result.reports.find((r) => r.doc === "5-1").status, "feedback");
  assert.equal(result.employees.gpt.open_feedback, 2);
});
test("미래 서류 명령은 나중 서류에 소급 적용하지 않는다", async () => {
  const f = await read("02-feedback-answered.json");
  f.comments[1].created_at = "2026-10-08T08:00:00Z";
  const { feed, ignored_comment_ids } = buildFeed(f);
  assert.equal(feed.reports.find((r) => r.doc === "5-1").status, "pending");
  assert.deepEqual(ignored_comment_ids, [2]);
});
