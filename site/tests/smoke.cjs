const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(
      () => document.querySelectorAll(".report").length === 3,
    );
    assert.equal(await page.locator(".employee").count(), 2);
    assert.equal(await page.locator(".task").count(), 4);
    assert.equal(await page.locator("#unread").textContent(), "3");
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
    assert.equal(await page.locator("#unread").textContent(), "2");
    await page.locator('[data-filter="rejected"]').click();
    await page.locator(".report").click();
    assert.match(await page.locator(".reason").textContent(), /PPU/);
    await page.locator("#close-dialog").click();
    await page.locator('[data-filter="all"]').click();
    await page.locator("#author").selectOption("gpt");
    assert.equal(await page.locator(".report").count(), 1);
    await page.locator("#author").selectOption("all");
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
    await page.screenshot({ path: "/tmp/game-desktop.png", fullPage: true });
    await page.reload();
    await page.waitForFunction(
      () => document.querySelectorAll(".report").length === 3,
    );
    assert.equal(await page.locator("#unread").textContent(), "1");
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}`,
      );
      const size = await page.locator("canvas").evaluate((c) => c.clientWidth);
      assert.equal(size % 288, 0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/tmp/game-mobile.png", fullPage: true });
    // Feed updates are detected after initial load, and unsafe HTML/URLs cannot execute.
    const sample = JSON.parse(fs.readFileSync("site/feed.json", "utf8"));
    sample.reports[0].body_md =
      '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>[bad](javascript:alert(1))';
    sample.reports[0].url = "javascript:alert(1)";
    sample.employees.gpt.state = "unknown";
    const isolated = await browser.newContext();
    await isolated.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    const safe = await isolated.newPage();
    safe.on("pageerror", (e) => errors.push(e.message));
    await safe.route("**/feed.json?*", (route) =>
      route.fulfill({ json: sample }),
    );
    await safe.clock.install();
    await safe.goto("http://127.0.0.1:8000");
    await safe.waitForFunction(
      () => document.querySelectorAll(".report").length === 3,
    );
    assert.match(await safe.locator(".employee").last().textContent(), /대기/);
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
    sample.reports.unshift({
      ...sample.reports[0],
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
    assert.match(await safe.locator("#notice").textContent(), /새 서류가 도착/);
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
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 목록·필터·결재·읽음 유지·배달·모바일·저장소 차단·XSS·60초 갱신·오류 복구 표시",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
