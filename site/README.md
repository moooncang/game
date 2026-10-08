# 작은 도트 회사 — 회사 운영 게임 화면

정적 홈페이지가 `feed.json`을 읽어 사무실과 업무 서류를 표시합니다. 저장소의 `site/feed.json`은 v1 체험 데이터이며, Pages 배포에서는 실제 GitHub Issue·댓글로 만든 v2 피드로 교체됩니다.

## 실행

저장소 루트에서 실행합니다. 빌드나 패키지 설치는 필요하지 않습니다.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

브라우저에서 서버의 8000 포트로 접속합니다. `file://`로 열면 모듈 및 피드 요청이 제한될 수 있습니다. 회사 이름은 `site/config.js`의 `companyName` 한 곳에서 바꿉니다.

## 화면 조작

- 화면 전체를 사무실 맵, 상단 HUD, 하단 명령창으로 구성합니다. 상단에 회사 이름, 한국 시각(KST), 진행 업무 수, 근무 인원, 마지막 피드 갱신 시각, 결재 대기 서류 수가 표시됩니다. 숫자는 현재 피드에서 계산합니다.
- 맵의 **서류함**을 선택하면 결재함, 벽의 **업무 게시판**을 선택하면 업무 목록, **Claude/GPT 캐릭터**를 선택하면 사원 상태 창이 열립니다. 하단 버튼으로도 같은 창을 열 수 있으며, 퇴근한 사원은 하단 사원 버튼에서 확인합니다.
- 키보드 `Tab`으로 물건·사원을 선택하고 `Enter`로 창을 엽니다. `Esc` 또는 닫기 버튼으로 돌아갑니다. 서류 상세를 닫으면 결재함의 해당 서류에 포커스가 돌아옵니다.
- **배달 테스트**를 누르면 새 서류가 생기고 사원이 가구를 피해 서류함으로 걸어간 뒤 돌아옵니다. 제출 시 서류함 위로 `▤ +1`이 떠오릅니다. 테스트 서류는 새로고침하면 사라집니다.
- 결재 상태·작성자 필터, 마크다운 서류, 승인/반려 도장과 사유, 관련 GitHub 링크를 확인합니다. 서류함·하단 버튼의 **안 읽음**은 아직 읽지 않은 서류 수이고, 상단 **결재 대기**는 미결재 수입니다.
- 읽음 상태는 로컬 저장소에 유지하며, 저장소 차단 시에도 현재 탭에서 동작합니다.
- 피드는 60초마다 캐시 없이 다시 읽습니다. 첫 로딩의 기존 서류는 배달하지 않고, 이후 새 ID의 서류만 배달합니다. 실패하면 기존 화면을 유지하고 다음 주기에 재시도합니다.
- `office/README.md`의 사원 상태 8종을 지원하며 알 수 없는 값은 `idle`입니다. 첫 로딩에는 각 상태의 목적지에 바로 배치하고, 이후 상태 변경은 걸어서 이동합니다. 처음부터 `offline`인 사원은 나타나지 않습니다.
- 데스크톱 맵은 320×208, 좁은 화면의 세로 맵은 160×224 논리 해상도를 정수 배율로 표시합니다. 모바일에서는 가구 배치도 바뀝니다. 이름표·말풍선은 HTML과 한글 픽셀 폰트로 그립니다. 전체 상태 메시지는 사원 창에서도 읽을 수 있습니다.
- `coding`·`designing` 상태가 화면에서 12초 유지되면 사원 주위로 작은 픽셀 불꽃이 올라옵니다. 이동·배달 중에는 숨기고 작업 상태가 바뀌면 시간을 다시 셉니다. 기준은 `config.focusAfterMs`입니다.
- 다음 피드에서 기존 서류의 결재 상태가 승인/반려로 바뀌면 작성자에게 4초 동안 **승인! / 반려…** 반응이 뜹니다. 첫 로딩의 기존 결재나 동일 피드 반복에는 재생하지 않습니다. v2에서는 피드백 이력의 새 승인·반려를 감지하므로 상태가 계속 feedback인 경우에도 새 반려에 반응합니다.
- 기본 말풍선은 최대 10자로 줄입니다. 전체 메시지는 사원 상태 창에서 읽습니다. 모션 감소 설정에서는 숫자가 떠오르거나 불꽃·스프라이트 프레임이 깜박이지 않으며, 이동과 배달 자체는 유지합니다.
- 회사 이름과 저장소 주소는 `site/config.js` 한 곳에서 변경합니다. GitHub·새 업무 지시·사원 담당 업무·관련 PR 링크가 같은 설정을 사용합니다.

## 브라우저 회귀 검사

실행 중인 위 서버와 Node.js, Chromium이 필요합니다. 테스트 의존성은 저장소 밖에 설치할 수 있습니다.

```sh
npm install --prefix /tmp/game-browser --cache /tmp/npm-cache playwright@1.63.0
NODE_PATH=/tmp/game-browser/node_modules node site/tests/smoke.cjs
```

Chromium 기본 경로는 `/usr/bin/chromium`입니다. 다른 경우 `CHROMIUM_PATH`를 지정합니다. 검사는 HUD·맵 메뉴·키보드·필터·결재 도장·읽음 유지·두 레이아웃의 배달·모바일 가로/세로 화면·상태 8종·초기 퇴근·설정 링크·저장소 차단·악성 HTML/URL·60초 갱신·네트워크 실패 및 복구를 확인합니다. `feedback.cjs`에서는 집중 시작/해제, 결재 반응 중복 방지, 배달 숫자, 모션 감소, 방향별 스프라이트 프레임, 프레임 속도에 무관한 이동 거리도 검사합니다. 피드 반응 검사는 실제 시계와 테스트용 500ms 주기를 사용합니다. 기본 60초 주기는 `smoke.cjs`에서 실제 HTTP 재요청을 기다려 별도로 검증하므로 전체 검사는 약 2분 걸립니다. 스크린샷은 `/tmp/game-desktop.png`, `/tmp/game-mobile.png`, `/tmp/game-inbox.png`, `/tmp/game-focus.png`, `/tmp/game-delivery.png`에 저장합니다. PR용 전후 스크린샷은 `docs/screenshots/issue-5/`에 보관하며 `site/` 배포 대상에 포함하지 않습니다.

## 구성과 외부 코드

- `office.js`: 가로·세로 픽셀 사무실, HTML 이름표·말풍선·물건 버튼, 가구를 피하는 격자 경로 탐색과 배달 큐
- `office-art.js`: 진한 나무 바닥·크림 벽 팔레트, 두께/외곽선/음영이 있는 가구와 소품, 직접 설계한 20×28px 사원 스프라이트. 사원별 머리/옷 색과 4방향 걷기·서류 들기(각 2프레임), 타이핑 2프레임을 Canvas로 그려 캐시합니다. HUD 초상도 같은 원본을 사용합니다.
- `app.js`: 피드 조회, HUD, 게임 창, 서류함, 사원 상태, 배달 테스트
- `assets/fonts/Galmuri11.woff2`: Galmuri 2.40.3, SIL Open Font License 1.1 (`assets/fonts/OFL.md`), https://github.com/quiple/galmuri
- `vendor/marked.esm.js`: marked 18.1.0, MIT (`marked.LICENSE`)
- `vendor/purify.es.mjs`: DOMPurify 3.4.16, Apache-2.0 또는 MPL-2.0 (`DOMPurify.LICENSE`)

라이브러리와 폰트는 npm 배포 파일을 그대로 포함하여 CDN 연결 없이 동작합니다. 마크다운 결과는 DOMPurify로 정화하고, 외부 이미지·스크립트·폼 등을 제거합니다. 업무·결재 링크는 해당 GitHub 저장소의 HTTPS URL만 허용합니다. 라이브러리 갱신 시 라이선스를 함께 갱신하고 회귀 검사를 실행하세요.

외부 게임의 화면·그림·캐릭터·UI를 복사하거나 포함하지 않았습니다. Issue #5의 색상 및 분위기 설명을 바탕으로 도형과 픽셀 배치를 직접 작성했습니다.

## v2 서류·결재와 출근

서류 목록·상세에서 문서 번호와 갈래, 결재 대기/피드백 있음/반영 완료/승인 상태를 표시합니다. 피드백·결재 기록의 처리 여부와 답변 서류를 따라갈 수 있고, 사원 창에는 미처리 피드백 수를 표시합니다. 기록의 원문 링크는 해당 저장소로 제한하며 본문과 동일하게 마크다운을 정화합니다.

HUD의 **사장님 열쇠**에서 사장님이 자기 브라우저에만 열쇠를 등록합니다. [설정 안내](../docs/guides/ceo-setup.md#6-결재-버튼-열쇠-등록-한-번만)를 따릅니다. 열쇠를 AI·저장소·Actions Secrets에 전달하지 않습니다. `office-approve.js`는 검증된 인수인계 모듈을 그대로 사용하며, `decision-ui.js`가 등록·삭제·제출 중복 방지와 피드 반영 대기를 담당합니다. 외부 API 요청은 `api.github.com`만 허용하는 CSP를 적용했습니다. 체험 데이터의 서류에서는 실제 결재를 막습니다.

**사원 출근**을 펼치면 GPT/Claude/전원 출근 링크가 나옵니다. 링크는 같은 GitHub 실행 화면으로 이동하며 입력값을 미리 선택하지 못하므로 employee와 mode를 직접 선택해야 합니다. 실제 출근 워크플로는 PR-C에서 연결합니다.

## 추가 테스트와 CI

위 로컬 서버를 실행한 뒤 저장소 루트에서 실행합니다. Playwright는 `tools/package-lock.json`에 버전을 고정했습니다.

```sh
npm ci --prefix tools --ignore-scripts
node site/tests/office-approve.check.mjs
export NODE_PATH="$PWD/tools/node_modules"
export CHROMIUM_PATH=/usr/bin/chromium
node site/tests/smoke.cjs
node site/tests/feed-v2.cjs
node site/tests/decisions.cjs
```

시스템 Chromium이 없다면 `tools/node_modules/.bin/playwright install chromium`으로 설치하고 `CHROMIUM_PATH`를 `node -p 'require("playwright").chromium.executablePath()'` 결과로 지정합니다. CI도 같은 세 브라우저 검사를 수행합니다. 결재 검사는 GitHub API를 가짜 응답으로 대체하며 실제 댓글이나 토큰을 사용하지 않습니다. 열쇠 주인 불일치, 401, 빈 피드백, 중복 제출 방지, 반영 대기 해제, 작성 중 갱신, v1 서류 제한, 답변 연결, 반려 연출, XSS와 CSP를 확인합니다.
