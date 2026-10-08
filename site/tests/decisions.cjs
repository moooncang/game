const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/Content Security Policy|violates|Refused to/i.test(m.text()))
        errors.push(m.text());
    });
    const feed = JSON.parse(
      fs.readFileSync("office/samples/feed.sample.json", "utf8"),
    );
    const source = feed.reports[0];
    feed.employees.gpt.open_feedback = 2;
    feed.reports = [1, 2, 3].map((id) => ({
      ...source,
      id,
      task: 6,
      doc: `6-${id}`,
      branch: "화면 구성",
      title: `테스트 서류 ${id}`,
      status: "pending",
      feedback: [],
      answers: [],
      answered_by: null,
      created_at: `2026-10-08T10:0${id}:00Z`,
    }));
    let polls = 0,
      login = "stranger",
      status = 201,
      hold = null;
    const posts = [];
    const token = "github_pat_" + "A".repeat(30);
    await page.route("**/config.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: fs
          .readFileSync("site/config.js", "utf8")
          .replace("pollInterval: 60_000", "pollInterval: 500"),
      }),
    );
    await page.route("**/feed.json?*", (route) => {
      polls++;
      return route.fulfill({ json: feed });
    });
    await page.route("https://api.github.com/**", async (route) => {
      const request = route.request();
      assert.equal(request.headers().authorization, `Bearer ${token}`);
      if (request.url().endsWith("/user"))
        return route.fulfill({ json: { login } });
      assert.equal(
        request.url(),
        "https://api.github.com/repos/moooncang/game/issues/6/comments",
      );
      assert.equal(request.method(), "POST");
      posts.push(request.postDataJSON().body);
      if (hold) await hold;
      return route.fulfill({
        status,
        json: {
          html_url:
            "https://github.com/moooncang/game/issues/6#issuecomment-900",
        },
      });
    });
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(
      () => document.querySelectorAll(".report").length === 3,
    );
    assert.match(
      await page.locator('[data-employee="gpt"]').textContent(),
      /피드백 2/,
    );
    await page.locator('[data-employee="gpt"]').click();
    assert.match(
      await page.locator("#employee-detail").textContent(),
      /미처리 피드백 2건/,
    );
    await page.locator("#employee-dialog [data-close]").click();
    await page.locator("summary").click();
    for (const link of await page.locator(".attendance-links a").all())
      assert.equal(
        await link.getAttribute("href"),
        "https://github.com/moooncang/game/actions/workflows/office-start.yml",
      );
    assert.match(
      await page.locator(".attendance").textContent(),
      /미리 선택할 수 없습니다/,
    );
    await page.locator("summary").click();
    await page.locator('[aria-label="결재함 열기"]').click();
    const open = async (id) => {
      if (await page.locator("#report-dialog").isVisible())
        await page.locator("#close-dialog").click();
      await page.locator(`[data-report-id="${id}"]`).click();
    };
    await open(2);
    assert.match(await page.locator("#approval").textContent(), /결재 대기/);
    assert.match(
      await page.locator("#report-meta").textContent(),
      /6-2 · 화면 구성/,
    );
    await page.locator('[data-decision="approve"]').click();
    assert(await page.locator("#key-dialog").isVisible());
    await page.locator("#key-input").fill(token);
    await page.locator("#key-register").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#key-message")
        .textContent.includes("계정의 열쇠가 아닙니다"),
    );
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("dot-office:ceo-token:v1"),
      ),
      null,
    );
    login = "moooncang";
    await page.locator("#key-input").fill(token);
    await page.locator("#key-register").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#key-message")
        .textContent.includes("등록했습니다"),
    );
    assert.equal(await page.locator("#key-input").inputValue(), "");
    assert(!(await page.content()).includes(token));
    assert.match(
      await page.locator("#key-status").textContent(),
      /등록됨 · moooncang/,
    );
    await page.locator("#key-dialog [data-close]").click();
    let release;
    hold = new Promise((resolve) => {
      release = resolve;
    });
    await page.locator('[data-decision="approve"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector("#decision-pending")
        .textContent.includes("제출 중"),
    );
    assert(await page.locator('[data-decision="approve"]').isDisabled());
    release();
    hold = null;
    await page.waitForFunction(() =>
      document
        .querySelector("#decision-pending")
        .textContent.includes("반영 중"),
    );
    assert.deepEqual(posts, ["/승인 6-2"]);
    feed.reports[1].feedback.push({
      type: "approve",
      body_md: "",
      at: new Date().toISOString(),
      closed: true,
      resolved_by: null,
      url: "https://github.com/moooncang/game/issues/6#issuecomment-900",
    });
    feed.reports[1].status = "approved";
    await page.waitForFunction(
      () => document.querySelector("#decision-pending").textContent === "",
    );
    assert(await page.locator('[data-decision="approve"]').isHidden());
    assert(await page.locator('[data-decision="feedback"]').isVisible());
    // 입력 중 피드 갱신에도 작성 내용을 유지한다.
    await page.locator('[data-decision="feedback"]').click();
    await page.locator("#decision-submit").click();
    assert.equal(posts.length, 1);
    assert.match(
      await page.locator("#decision-message").textContent(),
      /내용을 입력/,
    );
    await page.locator("#decision-text").fill("색을 밝게\n한 단계");
    const before = polls;
    while (polls <= before) await page.waitForTimeout(100);
    assert.equal(
      await page.locator("#decision-text").inputValue(),
      "색을 밝게\n한 단계",
    );
    assert.equal(
      await page.locator("#decision-preview").textContent(),
      "/피드백 6-2 색을 밝게\n한 단계",
    );
    status = 401;
    await page.locator("#decision-submit").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#decision-message")
        .textContent.includes("다시 등록"),
    );
    assert(await page.locator("#decision-submit").isEnabled());
    assert.equal(posts.at(-1), "/피드백 6-2 색을 밝게\n한 단계");
    status = 201;
    await open(1);
    await page.locator('[data-decision="reject"]').click();
    await page.locator("#decision-submit").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#decision-pending")
        .textContent.includes("반영 중"),
    );
    assert.equal(posts.at(-1), "/반려 6-1");
    await page.evaluate(() => {
      window.reactions = [];
      document
        .querySelector("#office")
        .addEventListener("approval-reaction", (e) =>
          window.reactions.push(e.detail),
        );
    });
    feed.reports[0].status = "feedback";
    feed.reports[0].answered_by = "6-3";
    feed.reports[0].feedback.push({
      type: "reject",
      body_md:
        '**수정**\n<img src=x onerror=alert(1)><a href="javascript:alert(1)">악성</a>',
      at: new Date().toISOString(),
      closed: false,
      resolved_by: null,
      url: "https://evil.example/",
    });
    await page.waitForFunction(() =>
      window.reactions.some((r) => r.status === "rejected"),
    );
    assert.equal(
      await page
        .locator(
          '#report-history img, #report-history [href^="javascript:"], #report-history [href^="https://evil"]',
        )
        .count(),
      0,
    );
    assert.equal(await page.locator("#report-history strong").count(), 2);
    await page.locator("#report-relations button").click();
    assert.match(await page.locator("#report-meta").textContent(), /6-3/);
    feed.reports[2].answers = ["6-1", "6-99"];
    await page.waitForFunction(() =>
      document.querySelector("#report-relations").textContent.includes("6-99"),
    );
    assert.match(
      await page.locator("#report-relations").textContent(),
      /현재 피드에 없음/,
    );
    await page.locator("#report-relations button").click();
    assert.match(await page.locator("#report-meta").textContent(), /6-1/);
    // v1은 최신 서류만 번호 없는 결재를 허용한다.
    feed.reports[0].doc = null;
    feed.reports[2].doc = null;
    await open(3);
    await page.waitForFunction(() =>
      document.querySelector("#report-meta").textContent.includes("옛 서류"),
    );
    await page.locator('[data-decision="approve"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector("#decision-pending")
        .textContent.includes("반영 중"),
    );
    assert.equal(posts.at(-1), "/승인");
    await open(1);
    assert(await page.locator("#decision-controls").isHidden());
    assert.match(
      await page.locator("#decision-help").textContent(),
      /GitHub에서 결재/,
    );
    await page.locator("#close-dialog").click();
    await page.locator("#inbox-dialog [data-close]").click();
    await page.locator("#open-key").click();
    await page.locator("#key-clear").click();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("dot-office:ceo-token:v1"),
      ),
      null,
    );
    assert.equal(await page.locator("#key-status").textContent(), "미등록");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 열쇠·결재·오류 복구·갱신·v1·문서 연결·반려 반응·CSP·XSS·출근 안내",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
