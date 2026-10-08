// 홈페이지 결재 버튼: 사장님 열쇠 보관·확인과 결재 댓글 작성 (office/README.md §3-3)
const KEY = "dot-office:ceo-token:v1";
const DOC = /^[1-9]\d*-[1-9]\d*$/;
const API = "https://api.github.com";

// 저장소를 쓸 수 없는 환경에서도 화면이 깨지지 않게 모든 접근을 감싼다.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch {
      return "";
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token);
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
  },
};

// 세분화된 토큰만 받는다. 클래식 토큰(ghp_)은 권한 범위를 저장소 하나로 좁힐 수 없다.
export function checkTokenShape(token) {
  const t = String(token || "").trim();
  if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(t))
    throw new Error(
      "github_pat_로 시작하는 세분화된 토큰만 등록할 수 있습니다.",
    );
  return t;
}

async function gh(
  path,
  token,
  { method = "GET", body, fetchImpl = fetch } = {},
) {
  const response = await fetchImpl(API + path, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    cache: "no-store",
  });
  if (response.status === 401)
    throw new Error("열쇠가 만료됐거나 지워졌습니다. 다시 등록해 주세요.");
  if (response.status === 403 || response.status === 404)
    throw new Error(
      "열쇠 권한이 부족합니다. 저장소와 Issues 쓰기 권한을 확인해 주세요.",
    );
  if (!response.ok) throw new Error(`GitHub 오류: HTTP ${response.status}`);
  return response.json();
}

// 열쇠 주인이 저장소 주인인지 확인한 뒤에만 저장한다.
export async function registerToken(raw, owner, { fetchImpl } = {}) {
  const token = checkTokenShape(raw);
  const me = await gh("/user", token, { fetchImpl });
  if (me?.login !== owner) throw new Error(`${owner} 계정의 열쇠가 아닙니다.`);
  if (!tokenStore.set(token))
    throw new Error("이 브라우저에는 열쇠를 저장할 수 없습니다.");
  return me.login;
}

// 서류 하나에 대한 결재 댓글 본문을 만든다. 첫 줄이 반드시 명령으로 시작한다.
// report.doc이 없으면(v1 서류) 그 Issue의 가장 최근 서류일 때만 번호 없는 명령을 쓴다.
export function decisionComment(
  kind,
  report,
  text = "",
  { latestInIssue = false } = {},
) {
  const note = String(text).replace(/\r\n?/g, "\n").trim();
  const target = report.doc ?? null;
  if (target !== null && !DOC.test(target))
    throw new Error("서류 번호 형식 오류");
  if (target === null && !latestInIssue)
    throw new Error(
      "번호 없는 옛 서류는 그 업무의 가장 최근 서류일 때만 결재할 수 있습니다.",
    );
  const head = (cmd) => (target ? `${cmd} ${target}` : cmd);
  if (kind === "approve") return head("/승인");
  if (kind === "reject")
    return note ? `${head("/반려")} ${note}` : head("/반려");
  if (kind === "feedback") {
    if (!target)
      throw new Error("피드백은 번호가 있는 서류에만 남길 수 있습니다.");
    if (!note) throw new Error("피드백 내용을 입력해 주세요.");
    return `${head("/피드백")} ${note}`;
  }
  throw new Error("알 수 없는 결재 종류");
}

// 결재 댓글을 서류가 있는 Issue에 쓴다.
export async function postDecision({
  repo,
  report,
  kind,
  text,
  latestInIssue,
  fetchImpl,
}) {
  const token = tokenStore.get();
  if (!token) throw new Error("먼저 사장님 열쇠를 등록해 주세요.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isSafeInteger(report.task))
    throw new Error("저장소 또는 업무 번호 오류");
  const body = decisionComment(kind, report, text, { latestInIssue });
  const created = await gh(
    `/repos/${repo}/issues/${report.task}/comments`,
    token,
    {
      method: "POST",
      body: { body },
      fetchImpl,
    },
  );
  return { body, url: created.html_url };
}
