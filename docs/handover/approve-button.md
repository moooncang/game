# 구현 안내서: 홈페이지 결재 버튼 (업무 #6 PR-B에 포함)

| 항목 | 내용 |
|---|---|
| 작성 | `claude` (설계·밑작업, 검증 완료) |
| 구현 | **`gpt`** |
| 규격 | [`office/README.md` §3-3](../../office/README.md#3-3-홈페이지-결재-버튼) |
| 사장님 설정 | [`docs/guides/ceo-setup.md` §6](../guides/ceo-setup.md#6-결재-버튼-열쇠-등록-한-번만) |

사장님 요청: **"서류에 결재 버튼을 만들고, 내가 그 버튼을 누르면 결재되는 시스템."**
버튼은 사장님 계정으로 `/승인`·`/반려`·`/피드백` 댓글을 대신 써 줍니다. **피드 생성기는 고칠 필요가 없습니다.** (사장님 열쇠로 쓴 댓글은 앱 기록이 `null`이라 이미 사장님으로 판별됨)

## 0. 바로 쓸 수 있는 파일 (복사만 하면 됨)

| 파일 | 할 일 |
|---|---|
| [`approve-button/office-approve.js`](approve-button/office-approve.js) | `site/office-approve.js`로 **그대로 복사** |
| [`approve-button/office-approve.check.mjs`](approve-button/office-approve.check.mjs) | 모듈 단위 검사. `site/tests/`로 옮기거나 `node`로 실행 |

검증한 것:
- 단위 검사: 댓글 본문 생성(승인·반려·피드백·여러 줄·빈 내용·잘못된 번호·v1 서류), 토큰 모양(클래식 `ghp_` 거부), 열쇠 주인 확인(다른 계정·만료 거부), 댓글 API 경로·메서드·헤더·`redirect: "error"`, 열쇠 없을 때 거부
- **끝까지 연결 검사**: 이 모듈이 만든 댓글을 `main`의 `tools/office-feed.mjs`에 넣었을 때 승인·반려(여러 줄 사유)·피드백(여러 줄)·v1 서류 승인이 모두 기대한 상태로 계산되고 무시된 댓글 0개
- `prettier --check` 통과

### 모듈이 내보내는 것
| 이름 | 쓰임 |
|---|---|
| `tokenStore.get/set/clear()` | 열쇠 보관 (`localStorage`, 실패해도 예외 없음) |
| `registerToken(raw, owner)` | 토큰 모양 확인 → `GET /user`로 주인 확인 → 저장. 주인이 다르면 저장하지 않음 |
| `decisionComment(kind, report, text, { latestInIssue })` | 댓글 본문 생성 (`kind`: `approve` / `reject` / `feedback`) |
| `postDecision({ repo, report, kind, text, latestInIssue })` | 해당 서류의 Issue에 댓글 작성 → `{ body, url }` |

## 1. 화면 요구사항

### 1-1. 사장님 열쇠 창
- HUD에 **[사장님 열쇠]** 버튼. 상태 표시: `미등록` / `등록됨 · moooncang`
- 창 안: 토큰 입력칸(`type="password"`, `autocomplete="off"`), **[등록]**, **[열쇠 지우기]**, 설정 안내 링크(`docs/guides/ceo-setup.md` §6의 GitHub 주소)
- 등록 성공 후 입력칸을 비우고, **토큰 문자열을 화면·로그·DOM 어디에도 다시 표시하지 않음**

### 1-2. 서류 창 결재 버튼
| 서류 상태 | 보여 줄 버튼 |
|---|---|
| `pending`, `feedback`, `answered` | **[승인] [반려] [피드백]** |
| `approved` | **[피드백]**만 (승인 뒤 재피드백은 규격상 허용) |
| v1 서류(`doc: null`) | 그 Issue의 **가장 최근 서류일 때만** [승인] [반려]. 아니면 "옛 양식 서류는 GitHub에서 결재해 주세요" 안내 |

- 열쇠가 없으면 버튼을 누를 때 열쇠 창을 엽니다.
- **[반려]**: 사유 입력칸(선택). **[피드백]**: 내용 입력칸(필수, 여러 줄). 입력칸 아래에 실제로 올라갈 댓글 미리보기(`/피드백 6-2 …`)를 보여 주면 실수를 줄일 수 있습니다.
- 누르면 버튼을 잠그고 `postDecision` 호출 → 성공 시 서류에 **"결재 반영 중 (1~2분)"** 표시, 실패 시 오류 문구 표시 후 버튼 잠금 해제
- "반영 중" 표시는 다음 피드 갱신에서 그 서류의 `feedback` 기록이 늘어나면 지웁니다. (메모리에만 보관, 새로고침하면 사라져도 됨)
- 결재 뒤 캐릭터 반응(승인!/반려…)은 PR #9 검수 선택 의견 1번과 함께 처리하면 됩니다.
- "가장 최근 서류" 판별: `feed.reports` 중 같은 `task`에서 `created_at`이 가장 늦은 서류

## 2. 보안 요구사항 (반드시)
- [ ] **CSP 추가** (`site/index.html`의 `<head>` 맨 앞):
  ```html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
  ```
  - 사원 초상화가 `toDataURL()` 이미지라 `img-src data:`가 필요합니다.
  - 인라인 `<style>`·`style="..."` 속성이 있으면 `style-src`에 막힙니다. JS로 `el.style.x = ...` 하는 것은 괜찮습니다. CSP를 넣은 뒤 콘솔에 위반 경고가 없는지 테스트로 확인해 주세요.
- [ ] 열쇠는 `api.github.com`으로만 보냄 (모듈이 보장. 다른 `fetch`에 열쇠를 넘기지 말 것)
- [ ] 서류 본문 마크다운 정화(DOMPurify)를 지금처럼 유지. 열쇠가 브라우저에 있으므로 XSS 방어가 더 중요해졌습니다.
- [ ] 클래식 토큰(`ghp_`)은 받지 않음 (모듈이 보장)
- [ ] 결재 댓글은 **서류의 `task` Issue에만** 씀 (모듈이 보장)

## 3. 테스트 (Playwright, `api.github.com`은 가짜 응답으로)
`page.route("https://api.github.com/**", ...)`로 응답을 흉내 냅니다. 실제 GitHub에는 요청하지 않습니다.
1. 열쇠 없음 → [승인] 클릭 시 열쇠 창이 열림
2. 다른 계정 열쇠 → 등록 거부, `localStorage`에 저장 안 됨
3. 사장님 열쇠 등록 → 상태 `등록됨 · moooncang`, DOM에 토큰 문자열 없음
4. [승인] → `POST /repos/moooncang/game/issues/6/comments`의 본문이 정확히 `/승인 6-2`, "결재 반영 중" 표시
5. [반려] 사유 없이 → `/반려 6-2`. [피드백] 빈 내용 → 요청 안 함, 오류 문구
6. API 401 → "다시 등록" 문구, 버튼 잠금 해제
7. 다음 피드 갱신에서 `feedback`이 늘면 "반영 중" 표시 사라짐
8. v1 서류: 가장 최근이면 `/승인`, 아니면 버튼 대신 안내 문구
9. CSP 위반 콘솔 경고 없음, 기존 회귀 테스트 전부 통과

## 4. PR-B 범위 변경
업무 #6 본문의 PR-B 항목 중 **"[피드백 남기기]: 명령 문구 복사 + Issue 열기"는 이 결재 버튼으로 대체**합니다. 나머지(문서 번호·갈래·상태 표시, 피드백 기록, 미처리 피드백 수, 출근 버튼)는 그대로입니다.
