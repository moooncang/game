# 작은 도트 회사 — 홈페이지 시안

`office/samples/feed.sample.json`을 `site/feed.json`으로 복사한 정적 시안입니다. 실제 Issue 연동과 GitHub Pages 배포는 다음 단계입니다. 화면의 업무·보고서·GitHub 링크는 예시이며, 실제 업무 상태를 나타내지 않습니다.

## 실행

저장소 루트에서 실행합니다. 빌드나 패키지 설치는 필요하지 않습니다.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

브라우저에서 서버의 8000 포트로 접속합니다. `file://`로 열면 모듈 및 피드 요청이 제한될 수 있습니다. 회사 이름은 `site/config.js`의 `companyName` 한 곳에서 바꿉니다.

## 확인할 것

- Claude와 GPT가 각자의 책상에서 작업합니다. 말풍선의 전체 내용은 아래 사원 카드에서 읽을 수 있습니다.
- **서류 배달 체험**을 누르면 새 서류가 생기고 사원이 통로를 따라 서류함으로 이동한 뒤 돌아옵니다. 체험용 서류는 새로고침하면 사라집니다.
- 결재 상태와 작성자 필터, 서류 상세의 마크다운·도장·반려 사유, 관련 GitHub 링크를 확인합니다.
- 서류를 읽으면 새 서류 배지가 줄고 읽음 상태는 로컬 저장소에 남습니다. 로컬 저장소를 사용할 수 없어도 현재 탭에서 동작합니다.
- 피드는 60초마다 캐시 없이 다시 읽습니다. 첫 로딩의 기존 서류는 배달하지 않습니다. 이후 새 ID의 서류만 배달하며, 실패하면 기존 화면을 유지하고 다음 주기에 재시도합니다.
- 사원 상태는 `office/README.md`의 8종을 지원합니다. 알 수 없는 값은 `idle`로 표시합니다. 상태 변경 시 목적지로 걸어가며 `offline`이면 출구에서 사라집니다.
- 320px 이상 모바일 화면에서 가로 스크롤 없이 사무실 전체를 봅니다. 캔버스는 288×192 논리 해상도를 정수 배율로 표시합니다.

## 브라우저 회귀 검사

실행 중인 위 서버와 Node.js, Chromium이 필요합니다. 테스트 의존성은 저장소 밖에 설치할 수 있습니다.

```sh
npm install --prefix /tmp/game-browser --cache /tmp/npm-cache playwright@1.63.0
NODE_PATH=/tmp/game-browser/node_modules node site/tests/smoke.cjs
```

Chromium 기본 경로는 `/usr/bin/chromium`입니다. 다른 경우 `CHROMIUM_PATH`를 지정합니다. 검사는 목록·필터·서류 열기·결재 도장·읽음 유지·배달·모바일 폭·저장소 차단·악성 HTML/URL·주기적 갱신·네트워크 실패 표시를 확인합니다. 스크린샷은 `/tmp/game-desktop.png`, `/tmp/game-mobile.png`에 저장합니다.

## 구성과 외부 코드

- `office.js`: Canvas로 직접 그린 픽셀 사무실과 이동·배달 큐
- `assets/claude.svg`, `assets/gpt.svg`: 직접 작성한 픽셀 캐릭터
- `app.js`: 피드 조회, 화면 표시, 서류함, 데모
- `vendor/marked.esm.js`: marked 18.1.0, MIT (`marked.LICENSE`)
- `vendor/purify.es.mjs`: DOMPurify 3.4.16, Apache-2.0 또는 MPL-2.0 (`DOMPurify.LICENSE`)

라이브러리는 npm 배포 파일을 그대로 포함하여 CDN 연결 없이 동작합니다. 마크다운 결과는 DOMPurify로 정화하고, 외부 이미지·스크립트·폼 등을 제거합니다. 업무·결재 링크는 해당 GitHub 저장소의 HTTPS URL만 허용합니다. 라이브러리 갱신 시 라이선스를 함께 갱신하고 회귀 검사를 실행하세요.
