import { cp, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// 공개 파일만 복사한다. 테스트·스크린샷·샘플 피드는 배포하지 않는다.
export async function buildSite(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const name of ["index.html", "styles.css", "assets", "vendor"]) {
    await cp(resolve(source, name), resolve(destination, name), {
      recursive: true,
    });
  }
  for (const name of await readdir(source)) {
    if (name.endsWith(".js"))
      await cp(resolve(source, name), resolve(destination, name));
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2] || !process.argv[3])
    throw new Error("사용법: node tools/build-site.mjs site <새 출력 폴더>");
  await buildSite(process.argv[2], process.argv[3]);
}
