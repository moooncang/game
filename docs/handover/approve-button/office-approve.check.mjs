import assert from "node:assert/strict";
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
const m = await import("./office-approve.js");
const r = { doc: "6-2", task: 6 };
assert.equal(m.decisionComment("approve", r), "/승인 6-2");
assert.equal(m.decisionComment("reject", r), "/반려 6-2");
assert.equal(
  m.decisionComment("reject", r, " 다시\r\n해 주세요 "),
  "/반려 6-2 다시\n해 주세요",
);
assert.equal(
  m.decisionComment("feedback", r, "바닥 밝게\n한 단계"),
  "/피드백 6-2 바닥 밝게\n한 단계",
);
assert.throws(() => m.decisionComment("feedback", r, "  "));
assert.throws(() => m.decisionComment("approve", { doc: "6-2번", task: 6 }));
assert.throws(() => m.decisionComment("approve", { doc: null, task: 5 }));
assert.equal(
  m.decisionComment("approve", { doc: null, task: 2 }, "", {
    latestInIssue: true,
  }),
  "/승인",
);
assert.equal(
  m.decisionComment("reject", { doc: null, task: 2 }, "느려요", {
    latestInIssue: true,
  }),
  "/반려 느려요",
);
assert.throws(() =>
  m.decisionComment("feedback", { doc: null, task: 2 }, "x", {
    latestInIssue: true,
  }),
);
assert.throws(() => m.checkTokenShape("ghp_abcdefghijklmnopqrstuvwxyz"));
const good = "github_pat_" + "A".repeat(30);
assert.equal(m.checkTokenShape("  " + good + " "), good);
// 가짜 GitHub
const calls = [];
const fake =
  (login, status = 200) =>
  async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/user"))
      return new Response(JSON.stringify({ login }), { status });
    return new Response(
      JSON.stringify({
        html_url: "https://github.com/moooncang/game/issues/6#issuecomment-1",
      }),
      { status: 201 },
    );
  };
await assert.rejects(
  m.registerToken(good, "moooncang", { fetchImpl: fake("stranger") }),
  /계정의 열쇠가 아닙니다/,
);
assert.equal(m.tokenStore.get(), "");
await assert.rejects(
  m.registerToken(good, "moooncang", { fetchImpl: fake("x", 401) }),
  /만료/,
);
assert.equal(
  await m.registerToken(good, "moooncang", { fetchImpl: fake("moooncang") }),
  "moooncang",
);
assert.equal(m.tokenStore.get(), good);
calls.length = 0;
const res = await m.postDecision({
  repo: "moooncang/game",
  report: r,
  kind: "approve",
  fetchImpl: fake("moooncang"),
});
assert.equal(res.body, "/승인 6-2");
assert.equal(
  calls[0].url,
  "https://api.github.com/repos/moooncang/game/issues/6/comments",
);
assert.equal(calls[0].init.method, "POST");
assert.equal(JSON.parse(calls[0].init.body).body, "/승인 6-2");
assert.equal(calls[0].init.headers.Authorization, `Bearer ${good}`);
assert.equal(calls[0].init.redirect, "error");
m.tokenStore.clear();
await assert.rejects(
  m.postDecision({
    repo: "moooncang/game",
    report: r,
    kind: "approve",
    fetchImpl: fake("moooncang"),
  }),
  /열쇠를 등록/,
);
console.log("office-approve.js: 모든 검사 통과");
