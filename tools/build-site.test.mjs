import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "./build-site.mjs";
test("배포 폴더는 실행 파일·에셋만 포함하고 테스트·샘플 피드는 제외한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "office-site-"));
  try {
    await buildSite(new URL("../site/", import.meta.url).pathname, dir);
    const names = await readdir(dir);
    for (const name of [
      "index.html",
      "app.js",
      "styles.css",
      "assets",
      "vendor",
    ])
      assert.ok(names.includes(name));
    for (const name of ["tests", "screenshots", "feed.json", "README.md"])
      assert.ok(!names.includes(name));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
