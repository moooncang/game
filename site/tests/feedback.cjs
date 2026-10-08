const assert = require("node:assert/strict");
const fs = require("node:fs");

module.exports = async function testFeedback(browser, watch, sample) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(page);
  // 결재 반응 검사는 실제 시계와 짧은 피드 주기를 사용한다.
  // 60초 갱신 자체는 smoke.cjs에서 별도로 검증한다.
  const configText = fs
    .readFileSync("site/config.js", "utf8")
    .replace("pollInterval: 60_000", "pollInterval: 500");
  await page.route("**/config.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: configText }),
  );
  const feed = structuredClone(sample);
  await page.route("**/feed.json?*", (route) => route.fulfill({ json: feed }));
  await page.goto("http://127.0.0.1:8000");
  await page.waitForFunction(
    () => document.querySelectorAll(".report").length === 3,
  );
  await page.evaluate(() => {
    window.feedbackEvents = { deliveries: [], approvals: [] };
    const canvas = document.querySelector("#office");
    canvas.addEventListener("delivered", (event) =>
      window.feedbackEvents.deliveries.push(event.detail.id),
    );
    canvas.addEventListener("approval-reaction", (event) =>
      window.feedbackEvents.approvals.push(event.detail),
    );
  });
  assert.equal(await page.locator("#task-count").textContent(), "2");
  assert.equal(await page.locator("#working-count").textContent(), "2");
  assert.match(await page.locator("#scene-inbox").textContent(), /안 읽음/);
  assert.equal(
    await page.locator("#actor-gpt").getAttribute("data-focused"),
    "false",
  );
  assert(
    (await page.locator("#actor-gpt .actor-message").textContent()).length <=
      10,
  );
  await page.waitForFunction(
    () => document.querySelector("#actor-gpt").dataset.focused === "true",
    {},
    { timeout: 20_000 },
  );
  assert.equal(
    await page.locator("#actor-gpt").getAttribute("data-focused"),
    "true",
  );
  assert.equal(
    await page.locator("#actor-claude").getAttribute("data-focused"),
    "true",
  );
  assert.equal(
    await page.locator("#actor-gpt .actor-message").textContent(),
    "집중 중!",
  );
  await page.screenshot({ path: "/tmp/game-focus.png" });

  const poll = async () => {
    const received = page.waitForResponse((response) =>
      response.url().includes("/feed.json?"),
    );
    await (await received).finished();
    // HTTP 응답 수신과 fetch JSON 처리·DOM 반영은 별도 작업이다.
    await page.waitForFunction(
      ({ status, state }) =>
        document.querySelector(".report .status")?.classList.contains(status) &&
        document.querySelector("#actor-gpt").dataset.state === state,
      {
        status: feed.reports[0].approval.status,
        state: feed.employees.gpt.state,
      },
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  };
  // 첫 로딩의 승인/반려에는 반응하지 않으며, 실제 상태 변경 때만 한 번 반응한다.
  assert.deepEqual(
    await page.evaluate(() => window.feedbackEvents.approvals),
    [],
  );
  feed.reports[0].approval.status = "approved";
  await poll();
  assert.equal(
    await page.locator("#actor-claude .actor-message").textContent(),
    "승인!",
  );
  assert.equal(await page.locator("#pending-count").textContent(), "0");
  await poll();
  assert.equal(
    (await page.evaluate(() => window.feedbackEvents.approvals)).length,
    1,
  );
  feed.reports[0].approval.status = "rejected";
  feed.employees.gpt.state = "idle";
  await poll();
  assert.equal(
    await page.locator("#actor-claude .actor-message").textContent(),
    "반려…",
  );
  assert.equal(
    await page.locator("#actor-gpt").getAttribute("data-focused"),
    "false",
  );
  assert.equal(
    (await page.evaluate(() => window.feedbackEvents.approvals)).length,
    2,
  );

  // 실제 경로 이동을 진행하고 delivered 이벤트와 숫자를 함께 확인한다.
  await page.locator("#demo").click();
  await page.waitForFunction(
    () => document.querySelector("#actor-gpt").dataset.pose === "carry",
  );
  assert.equal(
    await page.locator("#actor-gpt").getAttribute("data-pose"),
    "carry",
  );
  await page.waitForFunction(
    () => window.feedbackEvents.deliveries.length === 1,
    {},
    { timeout: 20_000 },
  );
  assert.equal(
    (await page.evaluate(() => window.feedbackEvents.deliveries)).length,
    1,
  );
  assert.equal(await page.locator(".delivery-number").textContent(), "▤ +1");
  await page.screenshot({ path: "/tmp/game-delivery.png" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page
    .locator(".delivery-number")
    .waitFor({ state: "detached", timeout: 5000 });
  await page.waitForFunction(
    () => document.querySelector("#actor-gpt").dataset.moving === "false",
  );
  assert.equal(
    (await page.evaluate(() => window.feedbackEvents.deliveries)).length,
    1,
    "복귀 중 화면 회전으로 재배달하면 안 됩니다.",
  );
  assert.equal(await page.locator(".delivery-number").count(), 0);

  // 느린 프레임에서도 같은 경과 시간이면 같은 거리를 이동해야 한다.
  const timing = await page.evaluate(async () => {
    const { Office } = await import("/office.js");
    const create = () => ({
      x: 0,
      y: 0,
      path: Array.from({ length: 30 }, (_, i) => [(i + 1) * 4, 0]),
    });
    const slow = create(),
      fast = create();
    Office.prototype.move(slow, 1);
    for (let frame = 0; frame < 60; frame++)
      Office.prototype.move(fast, 1 / 60);
    return { slow: slow.x, fast: fast.x };
  });
  assert.equal(timing.slow, 44);
  assert(Math.abs(timing.fast - timing.slow) < 0.001);
  // 방향·발걸음·서류 들기·타이핑 프레임이 동일 이미지로 대체되지 않도록 확인한다.
  const art = await page.evaluate(async () => {
    const { employeeSprite } = await import("/office-art.js");
    const result = {};
    for (const id of ["claude", "gpt"]) {
      result[id] = {};
      for (const pose of ["walk", "carry"])
        result[id][pose] = new Set(
          ["north", "south", "east", "west"].flatMap((direction) =>
            [0, 1].map((frame) =>
              employeeSprite(id, pose, direction, frame).toDataURL(),
            ),
          ),
        ).size;
      result[id].typing =
        employeeSprite(id, "typing", "north", 0).toDataURL() !==
        employeeSprite(id, "typing", "north", 1).toDataURL();
    }
    result.distinct =
      employeeSprite("claude").toDataURL() !==
      employeeSprite("gpt").toDataURL();
    return result;
  });
  for (const id of ["claude", "gpt"]) {
    assert.equal(art[id].walk, 8);
    assert.equal(art[id].carry, 8);
    assert(art[id].typing);
  }
  assert(art.distinct);
  await page.close();

  const reduced = await browser.newPage({ reducedMotion: "reduce" });
  watch(reduced);

  await reduced.goto("http://127.0.0.1:8000");
  await reduced.waitForFunction(
    () => document.querySelectorAll(".report").length === 3,
  );
  await reduced.locator("#demo").click();
  await reduced
    .locator(".delivery-number")
    .waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await reduced.locator(".delivery-number").count(), 1);
  assert.equal(
    await reduced
      .locator(".delivery-number")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await reduced.close();
};
