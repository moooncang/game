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
    page.on("pageerror", (error) => errors.push(error.message));
    const feed = JSON.parse(
      fs.readFileSync("office/samples/feed.sample.json", "utf8"),
    );
    const source = feed.reports[0];
    feed.reports = ["pending", "feedback", "answered", "approved"].map(
      (status, index) => ({
        ...source,
        id: index + 1,
        doc: `6-${index + 1}`,
        title: status,
        status,
        feedback:
          status === "feedback"
            ? [
                {
                  type: "feedback",
                  closed: false,
                  body_md: "<img src=x onerror=alert(1)>피드백",
                  at: feed.generated_at,
                  resolved_by: null,
                  url: source.url,
                },
              ]
            : [],
      }),
    );
    await page.route("**/feed.json?*", (route) =>
      route.fulfill({ json: feed }),
    );
    await page.goto("http://127.0.0.1:8000");
    await page.waitForFunction(
      () => document.querySelectorAll(".report").length === 4,
    );
    assert.equal(
      await page.locator(".version").textContent(),
      "OFFICE · 업무 현황",
    );
    assert.equal(await page.locator("#pending-count").textContent(), "1");
    await page.evaluate(() =>
      document.querySelector("#inbox-dialog").showModal(),
    );
    for (const [status, label] of [
      ["feedback", "피드백 있음"],
      ["answered", "반영 완료"],
      ["approved", "승인"],
    ]) {
      await page.locator(`[data-filter="${status}"]`).click();
      assert.equal(await page.locator(".report").count(), 1);
      assert.equal(await page.locator(".report .status").textContent(), label);
    }
    await page.locator('[data-filter="feedback"]').click();
    await page.locator(".report").click();
    assert.match(await page.locator("#approval").textContent(), /피드백 있음/);
    assert.equal(await page.locator("#approval img").count(), 0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log("v2 실제 피드 표시·4종 상태·모바일·피드백 안전 표시 통과");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
