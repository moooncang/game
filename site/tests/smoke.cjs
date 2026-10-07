const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sample = JSON.parse(fs.readFileSync("site/feed.json", "utf8"));
const base = "http://127.0.0.1:8000";

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const watch = (page) =>
    page.on("pageerror", (error) => errors.push(error.message));
  const loaded = (page) =>
    page.waitForFunction(
      () => document.querySelectorAll(".report").length === 3,
    );
  const close = async (page, id) => {
    await page.locator(`#${id} [data-close]`).click();
  };
  const noOverflow = async (page) =>
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
      "게임 화면에 페이지 스크롤이 생기면 안 됩니다.",
    );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    watch(page);
    await page.goto(base);
    await loaded(page);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check("12px Galmuri")));
    assert.equal(await page.locator(".staff-button").count(), 2);
    assert.equal(await page.locator(".task").count(), 4);
    assert.equal(await page.locator("#unread").textContent(), "3");
    assert.equal(await page.locator("#pending-count").textContent(), "1");
    assert.match(await page.locator("#clock").textContent(), /KST/);
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /오늘도|아이디어가 자라는|작은 픽셀|큰 상상|하나의 세계|작은 진전/,
    );
    await noOverflow(page);
    await page.screenshot({ path: "/tmp/game-desktop.png" });

    // 맵 물건과 사원은 마우스/키보드로 게임 창을 연다.
    await page.locator("#scene-board").click();
    assert(await page.locator("#tasks-dialog").isVisible());
    assert.equal(
      await page
        .locator('[data-repo-link="/issues/new?template=task.yml"]')
        .getAttribute("href"),
      `https://github.com/${sample.repo}/issues/new?template=task.yml`,
    );
    await page.keyboard.press("Escape");
    assert(
      await page
        .locator("#scene-board")
        .evaluate((el) => el === document.activeElement),
    );
    await page.locator("#actor-gpt").focus();
    await page.keyboard.press("Enter");
    assert(await page.locator("#employee-dialog").isVisible());
    assert.match(
      await page.locator("#employee-detail").innerText(),
      /디자인 중/,
    );
    assert.match(
      await page.locator("#employee-detail").innerText(),
      /주인공 걷기/,
    );
    await close(page, "employee-dialog");
    await page.locator("#scene-inbox").click();
    assert(await page.locator("#inbox-dialog").isVisible());
    await page.locator('[data-filter="approved"]').click();
    assert.equal(await page.locator(".report").count(), 1);
    await page.locator(".report").click();
    assert.equal(await page.locator(".stamp").textContent(), "승인");
    assert.equal(await page.locator("#report-body h2").count(), 2);
    assert.match(
      await page.locator("#report-links a").first().getAttribute("href"),
      /issuecomment-/,
    );
    await page.keyboard.press("Escape");
    assert(await page.locator("#inbox-dialog").isVisible());
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains("report"),
    );
    assert.equal(await page.locator("#unread").textContent(), "2");
    await page.locator('[data-filter="rejected"]').click();
    await page.locator(".report").click();
    assert.match(await page.locator(".reason").textContent(), /PPU/);
    await close(page, "report-dialog");
    await page.locator('[data-filter="all"]').click();
    await page.locator("#author").selectOption("gpt");
    assert.equal(await page.locator(".report").count(), 1);
    await page.locator("#author").selectOption("claude");
    assert.equal(await page.locator(".report").count(), 2);
    await page.locator('[data-filter="approved"]').click();
    assert.equal(await page.locator(".report").count(), 0);
    assert.match(
      await page.locator("#reports").innerText(),
      /조건에 맞는 서류/,
    );
    await page.locator('[data-filter="all"]').click();
    await page.locator("#author").selectOption("all");
    await close(page, "inbox-dialog");

    await page.locator("#demo").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#notice")
          .textContent.includes("새 서류가 도착"),
      {},
      { timeout: 15000 },
    );
    assert.equal(await page.locator(".report").count(), 4);
    await page.waitForFunction(
      () => document.querySelector("#actor-gpt").dataset.moving === "false",
      {},
      { timeout: 15000 },
    );
    assert.equal(await page.locator("#pending-count").textContent(), "2");
    await page.reload();
    await loaded(page);
    assert.equal(await page.locator("#unread").textContent(), "1");

    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 900],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      await noOverflow(page);
      const geometry = await page.locator("canvas").evaluate((c) => ({
        ratio: c.clientWidth / c.width,
        rect: c.getBoundingClientRect().toJSON(),
      }));
      assert(Number.isInteger(geometry.ratio));
      assert(
        geometry.rect.x >= 0 &&
          geometry.rect.right <= width &&
          geometry.rect.y >= 0 &&
          geometry.rect.bottom <= height,
        `맵 잘림: ${width}×${height}`,
      );
      await page.locator("#scene-board").click();
      assert(await page.locator("#tasks-dialog").isVisible());
      await close(page, "tasks-dialog");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: "/tmp/game-mobile.png" });
    await page.locator("#scene-inbox").click();
    await page.screenshot({ path: "/tmp/game-inbox.png" });
    await close(page, "inbox-dialog");
    await page.locator("#demo").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#notice")
          .textContent.includes("새 서류가 도착"),
      {},
      { timeout: 15000 },
    );
    await page.waitForFunction(
      () => document.querySelector("#actor-gpt").dataset.moving === "false",
      {},
      { timeout: 15000 },
    );

    // 저장소 차단, 마크다운 정화, 외부 링크 제한, 60초 갱신 및 실패 후 복구.
    const context = await browser.newContext();
    await context.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      }),
    );
    const safe = await context.newPage();
    watch(safe);
    await safe.clock.install();
    const malicious = structuredClone(sample);
    malicious.reports[0].body_md =
      '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>[bad](javascript:alert(1))';
    malicious.reports[0].url = "https://github.com/other/repo/issues/1";
    malicious.tasks[0].url = "javascript:alert(1)";
    malicious.employees.gpt.state = "unknown";
    await safe.route("**/feed.json?*", (route) =>
      route.fulfill({ json: malicious }),
    );
    await safe.goto(base);
    await loaded(safe);
    assert.match(
      await safe.locator('[data-employee="gpt"]').innerText(),
      /대기/,
    );
    assert.equal(await safe.locator("a.task").count(), 3);
    await safe.locator("#scene-inbox").click();
    await safe.locator(".report").first().click();
    assert.equal(
      await safe
        .locator(
          '#report-body script, #report-body img, #report-body a[href^="javascript:"]',
        )
        .count(),
      0,
    );
    assert.equal(await safe.locator("#report-links a").count(), 0);
    assert.equal(await safe.evaluate(() => window.pwned), undefined);
    await safe.keyboard.press("Escape");
    await safe.keyboard.press("Escape");
    assert.equal(await safe.locator("#unread").textContent(), "2");
    malicious.reports.unshift({
      ...malicious.reports[0],
      id: 987654321,
      title: "새 피드 서류",
      body_md: "새 서류",
    });
    await safe.clock.fastForward(60_001);
    await safe.clock.resume();
    await safe.waitForFunction(
      () => document.querySelectorAll(".report").length === 4,
    );
    await safe.waitForFunction(
      () =>
        document
          .querySelector("#notice")
          .textContent.includes("새 서류가 도착"),
      {},
      { timeout: 15000 },
    );
    await safe.route("**/feed.json?*", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await safe.clock.fastForward(60_001);
    await safe.clock.resume();
    await safe.waitForFunction(() =>
      document
        .querySelector("#notice")
        .textContent.includes("불러오지 못했습니다"),
    );
    assert.equal(await safe.locator(".report").count(), 4);
    await safe.route("**/feed.json?*", (route) =>
      route.fulfill({ json: sample }),
    );
    await safe.clock.fastForward(60_001);
    await safe.clock.resume();
    await loaded(safe);
    assert.doesNotMatch(
      await safe.locator("#notice").textContent(),
      /불러오지 못했습니다/,
    );

    // 처음부터 퇴근인 사원은 출구에서도 표시되지 않으며, 출근 후에는 이동한다.
    const statePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    watch(statePage);
    await statePage.clock.install();
    const stateFeed = structuredClone(sample);
    stateFeed.employees.gpt.state = "offline";
    await statePage.route("**/feed.json?*", (route) =>
      route.fulfill({ json: stateFeed }),
    );
    await statePage.goto(base);
    await loaded(statePage);
    assert(await statePage.locator("#actor-gpt").isHidden());
    await statePage.waitForTimeout(250);
    assert(await statePage.locator("#actor-gpt").isHidden());
    await statePage.locator('[data-employee="gpt"]').click();
    assert.match(
      await statePage.locator("#employee-detail").innerText(),
      /퇴근/,
    );
    await close(statePage, "employee-dialog");
    stateFeed.employees.gpt.state = "meeting";
    await statePage.clock.fastForward(60_001);
    await statePage.clock.resume();
    await statePage.waitForFunction(
      () => document.querySelector("#actor-gpt").dataset.state === "meeting",
    );
    await statePage.locator("#actor-gpt").waitFor({ state: "visible" });
    await statePage.waitForFunction(
      () => document.querySelector("#actor-gpt").dataset.moving === "false",
      {},
      { timeout: 15000 },
    );
    // 다른 상태에서도 초기 배치와 상태창을 확인한다.
    for (const [state, label] of [
      ["coding", "코딩 중"],
      ["designing", "디자인 중"],
      ["writing", "작성 중"],
      ["reviewing", "리뷰 중"],
      ["blocked", "도움 필요"],
      ["idle", "대기"],
    ]) {
      stateFeed.employees.gpt.state = state;
      await statePage.reload();
      await loaded(statePage);
      await statePage.locator("#actor-gpt").click();
      assert.match(
        await statePage.locator("#employee-detail").innerText(),
        new RegExp(label),
      );
      await close(statePage, "employee-dialog");
      assert.equal(
        await statePage.locator("#actor-gpt").getAttribute("data-moving"),
        "false",
      );
    }

    // config.repository만 바꾸면 정적 탐색 링크도 함께 바뀐다.
    const configured = await browser.newPage();
    watch(configured);
    const configText = fs
      .readFileSync("site/config.js", "utf8")
      .replace("moooncang/game", "example/studio");
    await configured.route("**/config.js", (route) =>
      route.fulfill({ contentType: "text/javascript", body: configText }),
    );
    await configured.goto(base);
    await loaded(configured);
    assert.equal(
      await configured.locator(".repo-link").getAttribute("href"),
      "https://github.com/example/studio",
    );
    assert.equal(
      await configured
        .locator('[data-repo-link="/issues/new?template=task.yml"]')
        .getAttribute("href"),
      "https://github.com/example/studio/issues/new?template=task.yml",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 게임 HUD·맵 메뉴·키보드·결재함·필터·읽음·배달·모바일·상태 8종·초기 퇴근·설정 링크·XSS·저장소 차단·60초 갱신·오류 복구",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
