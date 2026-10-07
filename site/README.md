# 작은 도트 회사 — 회사 운영 게임 화면

`office/samples/feed.sample.json`을 `site/feed.json`으로 복사한 정적 시안입니다. 실제 Issue 연동과 GitHub Pages 배포는 다음 단계입니다. 화면의 업무·보고서·GitHub 링크는 예시이며, 실제 업무 상태를 나타내지 않습니다.

## 실행

저장소 루트에서 실행합니다. 빌드나 패키지 설치는 필요하지 않습니다.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

브라우저에서 서버의 8000 포트로 접속합니다. `file://`로 열면 모듈 및 피드 요청이 제한될 수 있습니다. 회사 이름은 `site/config.js`의 `companyName` 한 곳에서 바꿉니다.

## 화면 조작

- 화면 전체를 사무실 맵, 상단 HUD, 하단 명령창으로 구성합니다. 상단에 회사 이름, 한국 시각(KST), 마지막 피드 갱신 시각, 결재 대기 서류 수가 표시됩니다.
- 맵의 **서류함**을 선택하면 결재함, 벽의 **업무 게시판**을 선택하면 업무 목록, **Claude/GPT 캐릭터**를 선택하면 사원 상태 창이 열립니다. 하단 버튼으로도 같은 창을 열 수 있으며, 퇴근한 사원은 하단 사원 버튼에서 확인합니다.
- 키보드 `Tab`으로 물건·사원을 선택하고 `Enter`로 창을 엽니다. `Esc` 또는 닫기 버튼으로 돌아갑니다. 서류 상세를 닫으면 결재함의 해당 서류에 포커스가 돌아옵니다.
- **배달 테스트**를 누르면 새 서류가 생기고 사원이 가구를 피해 서류함으로 걸어간 뒤 돌아옵니다. 테스트 서류는 새로고침하면 사라집니다.
- 결재 상태·작성자 필터, 마크다운 서류, 승인/반려 도장과 사유, 관련 GitHub 링크를 확인합니다. 읽음 배지와 결재 대기 수는 별개입니다.
- 읽음 상태는 로컬 저장소에 유지하며, 저장소 차단 시에도 현재 탭에서 동작합니다.
- 피드는 60초마다 캐시 없이 다시 읽습니다. 첫 로딩의 기존 서류는 배달하지 않고, 이후 새 ID의 서류만 배달합니다. 실패하면 기존 화면을 유지하고 다음 주기에 재시도합니다.
- `office/README.md`의 사원 상태 8종을 지원하며 알 수 없는 값은 `idle`입니다. 첫 로딩에는 각 상태의 목적지에 바로 배치하고, 이후 상태 변경은 걸어서 이동합니다. 처음부터 `offline`인 사원은 나타나지 않습니다.
- 데스크톱 맵은 320×208, 좁은 화면의 세로 맵은 160×224 논리 해상도를 정수 배율로 표시합니다. 모바일에서는 가구 배치도 바뀝니다. 이름표·말풍선은 HTML과 한글 픽셀 폰트로 그립니다. 전체 상태 메시지는 사원 창에서도 읽을 수 있습니다.
- 회사 이름과 저장소 주소는 `site/config.js` 한 곳에서 변경합니다. GitHub·새 업무 지시·사원 담당 업무·관련 PR 링크가 같은 설정을 사용합니다.

## 브라우저 회귀 검사

실행 중인 위 서버와 Node.js, Chromium이 필요합니다. 테스트 의존성은 저장소 밖에 설치할 수 있습니다.

```sh
npm install --prefix /tmp/game-browser --cache /tmp/npm-cache playwright@1.63.0
NODE_PATH=/tmp/game-browser/node_modules node site/tests/smoke.cjs
```

Chromium 기본 경로는 `/usr/bin/chromium`입니다. 다른 경우 `CHROMIUM_PATH`를 지정합니다. 검사는 HUD·맵 메뉴·키보드·필터·결재 도장·읽음 유지·두 레이아웃의 배달·모바일 가로/세로 화면·상태 8종·초기 퇴근·설정 링크·저장소 차단·악성 HTML/URL·60초 갱신·네트워크 실패 및 복구를 확인합니다. 스크린샷은 `/tmp/game-desktop.png`, `/tmp/game-mobile.png`, `/tmp/game-inbox.png`에 저장합니다.

## 구성과 외부 코드

- `office.js`: 가로·세로 픽셀 사무실, HTML 이름표·말풍선·물건 버튼, 가구를 피하는 격자 경로 탐색과 배달 큐
- `assets/claude.svg`, `assets/gpt.svg`: 직접 작성한 픽셀 캐릭터
- `app.js`: 피드 조회, HUD, 게임 창, 서류함, 사원 상태, 배달 테스트
- `assets/fonts/Galmuri11.woff2`: Galmuri 2.40.3, SIL Open Font License 1.1 (`assets/fonts/OFL.md`), https://github.com/quiple/galmuri
- `vendor/marked.esm.js`: marked 18.1.0, MIT (`marked.LICENSE`)
- `vendor/purify.es.mjs`: DOMPurify 3.4.16, Apache-2.0 또는 MPL-2.0 (`DOMPurify.LICENSE`)

라이브러리와 폰트는 npm 배포 파일을 그대로 포함하여 CDN 연결 없이 동작합니다. 마크다운 결과는 DOMPurify로 정화하고, 외부 이미지·스크립트·폼 등을 제거합니다. 업무·결재 링크는 해당 GitHub 저장소의 HTTPS URL만 허용합니다. 라이브러리 갱신 시 라이선스를 함께 갱신하고 회귀 검사를 실행하세요.
