# 업무 피드와 Pages

Node.js 22 이상에서 저장소 루트를 기준으로 실행합니다.

```sh
npm ci --prefix tools --ignore-scripts
npm test --prefix tools
node tools/build-site.mjs site /tmp/office-pages
node tools/office-feed.mjs --output /tmp/office-pages/feed.json
```

API 호출에는 환경 변수 `GITHUB_TOKEN`을 사용합니다. Actions 기본 토큰만으로 충분하며, 공개 저장소의 로컬 읽기는 토큰 없이도 됩니다. 토큰을 명령행 인자나 파일에 넣지 않습니다. 저장소는 `GITHUB_REPOSITORY` 또는 `--repo owner/repo`로 지정합니다.

`office-identity.json`은 계정·앱 신원표입니다. 봇은 계정 이름 **및 앱 slug 쌍**이 일치해야 인정합니다. 출근 워크플로 시험 후 실제 앱 정보가 다르면 검수된 값으로 갱신합니다. 본문은 사원 신원을 덮어쓰거나 사장님 명령 권한을 부여할 수 없습니다.

`office-feed.mjs`의 `buildFeed`는 정규화된 Issue·댓글로 순수 계산하며, `collectGitHub`는 REST 페이지를 끝까지 읽습니다. Issues API에 포함된 PR과 그 댓글은 업무 목록·상태·서류에서 제외합니다. v2 스키마 검증이 실패하거나 API 조회가 실패하면 출력 파일을 교체하지 않습니다. Ajv와 ajv-formats는 `office/feed.schema.json`의 JSON Schema 2020-12와 날짜 형식을 검증하는 데 사용합니다.

오프라인 재현은 `--input <JSON 파일>`을 사용합니다. 파일 구조는 `office/fixtures/README.md`와 같습니다. `now`를 지정하면 동일한 시각으로 재현됩니다. `--identity <JSON 파일>`로 신원표를 교체할 수 있습니다. 경고에는 댓글 ID와 고정된 이유만 기록하며 댓글 본문은 로그에 출력하지 않습니다.

## 배포

`.github/workflows/pages.yml`이 이벤트·30분 주기·수동 실행으로 실제 피드를 생성하고 Pages에 배포합니다. `pull_request_target`은 **기본 브랜치의 워크플로로 main만 체크아웃**하기 위해 사용합니다. PR 브랜치, PR 산출물, 댓글의 코드는 실행하지 않습니다. PR 자체 검증은 쓰기 권한 없는 별도 `office-checks.yml`에서 수행합니다. 각 액션은 확인한 공식 릴리스 커밋에 고정했습니다.

`build-site.mjs`에는 새 빈 출력 폴더를 지정합니다. 테스트, 스크린샷, README, 샘플 feed.json은 복사하지 않습니다. 실제 피드 생성에 실패하면 배포도 실패하므로 샘플이 업무 데이터로 공개되지 않습니다. Pages 쓰기와 OIDC 권한은 배포 작업에만 부여합니다. 빌드에는 읽기 권한만 부여하고 Git 자격 증명을 남기지 않습니다.

기존 v1 화면이 v2 피드를 받을 때는 4종 상태·열린 피드백 내용을 표시하며 실제 피드에서는 샘플 모드 문구를 제거합니다. PR-B 화면은 문서 연결, 전체 피드백 이력, 직접 결재 버튼과 출근 링크를 제공합니다. 결재 모듈·브라우저 검사는 `site/README.md`를 참고합니다. 출근 워크플로의 실제 연결은 PR-C 범위입니다.

설정 절차는 [사장님 설정 안내](../docs/guides/ceo-setup.md)를 따릅니다. 새 배포 워크플로는 main 머지 후 실제 Pages 환경에서 실행·확인해야 합니다.
