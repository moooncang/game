# 판정 기준표 (피드 생성기 테스트 예시)

[`office/README.md`](../README.md)의 해석 규칙(§3 서류 상태, §5 해석 규칙, §6 신원 확인)을 **입력과 기대 결과 예시**로 옮겨 둔 것입니다.
피드 생성기는 이 폴더의 예시를 **모두 통과**해야 합니다. 규격과 예시가 다르면 규격이 우선이며, 발견하면 `claude`에게 알려 주세요.

## 예시 목록

| 파일 | 확인하는 규칙 |
|---|---|
| `01-basic-reports` | 갈래별 서류 여러 장, 반응 없으면 `pending`, 사원 상태와 현재 업무 |
| `02-feedback-answered` | 피드백 → 같은 사원의 답변 서류 → `answered`, 피드백 `closed`, 여러 줄 피드백 본문 |
| `03-feedback-open` | 답변 없는 피드백 → `feedback`, `open_feedback` |
| `04-answer-before-feedback` | 피드백보다 **먼저** 쓴 답변 서류는 처리로 보지 않음 |
| `05-answer-by-other-employee` | **다른 사원**의 답변 서류는 처리로 보지 않음, `/반려`도 피드백으로 취급 |
| `06-approve-closes-feedback` | 답변 전에 `/승인` → `approved`, 남은 피드백 닫힘(`resolved_by: null`) |
| `07-feedback-after-approve` | 승인 뒤 다시 피드백 → `feedback` |
| `08-multi-approve` | `/승인` 번호 여러 개, 없는 번호는 그 번호만 무시 |
| `09-identity` | 사원 앱이 쓴 명령, 외부인 댓글, `사원:` 값 불일치, 사장님이 쓴 서류 → 모두 무시 |
| `10-doc-number-rules` | 번호 중복은 먼저 쓴 것만, Issue 번호 불일치·`갈래` 누락은 버림, 다른 Issue에서 쓴 명령은 무시 |
| `11-v1-compat` | 번호 없는 v1 서류, 번호 없는 `/반려`는 그 Issue의 가장 최근 서류에 적용 |
| `12-status-rules` | 사원 상태 = 모든 Issue 중 가장 최근 상태 댓글, 12시간 넘으면 `offline` |
| `13-workflow-bots` | 출근 워크플로 봇 계정의 서류는 `사원:` 값으로 인정, 봇이 쓴 명령은 무시 |
| `14-natural-commands` | 사장님 평소 말투: `/승인 수고했어요`, 다음 줄 한마디, 사유 없는 `/반려`, 내용 없는 `/피드백`, 잘못 쓴 번호(`7-1번`) |

## 파일 형식

```jsonc
{
  "name": "02-feedback-answered",
  "description": "무엇을 확인하는지",
  "now": "2026-10-08T12:00:00Z",          // 피드 생성 시각으로 사용 (12시간 규칙 계산용)
  "issues": [                               // 업무 Issue (PR 제외)
    { "number": 5, "title": "...", "state": "open", "labels": ["담당:gpt"] }
  ],
  "comments": [                             // Issue 댓글 (간단한 형태)
    {
      "id": 1,                              // 댓글 ID
      "issue": 5,                           // 댓글이 달린 Issue 번호
      "login": "moooncang",                 // user.login
      "app": "chatgpt-codex-connector",     // performed_via_github_app?.slug ?? null
      "created_at": "2026-10-08T09:00:00Z",
      "body": "<!-- office:report -->\n사원: gpt\n..."
    }
  ],
  "expected": {                             // 기대 결과 (아래 비교 규칙 참고)
    "reports": [ { "doc": "5-1", "status": "answered", "...": "..." } ],
    "employees": { "gpt": { "open_feedback": 0 } },
    "ignored_comment_ids": [ ]
  }
}
```

### GitHub API 응답을 이 형태로 바꾸는 법
| 예시 필드 | GitHub REST API (`GET /repos/{owner}/{repo}/issues/comments`) |
|---|---|
| `id` | `id` |
| `issue` | `issue_url` 끝의 번호 |
| `login` | `user.login` |
| `app` | `performed_via_github_app?.slug ?? null` |
| `created_at` | `created_at` |
| `body` | `body` (줄바꿈 `\r\n`은 `\n`으로 바꿔서 해석) |

## 비교 규칙

- **`expected.reports`**: 결과에 남은 서류 목록과 **정확히 같은 서류들**이어야 합니다. 서류는 `doc`으로, v1 서류(`doc: null`)는 `id`로 맞춥니다.
  - 각 서류는 **적힌 필드만** 비교합니다. (적히지 않은 필드는 자유)
  - `feedback`이 적혀 있으면 **개수가 같아야** 하고, 각 항목은 적힌 필드만 비교합니다. 순서는 오래된 순입니다.
- **`expected.employees`**: 적힌 사원의 적힌 필드만 비교합니다.
- **`expected.ignored_comment_ids`**: 해석에서 **버린 댓글 ID 전체 목록**입니다. 버린 댓글이란 양식(`office:` 표식, `/피드백`·`/승인`·`/반려`)으로 시작했지만 신원 확인이나 규칙 때문에 반영하지 않은 댓글입니다. 일반 대화 댓글은 여기에 넣지 않습니다.
  - 피드 생성기는 버린 댓글마다 경고 로그를 남기면 됩니다. `feed.json`에 넣을 필요는 없습니다.

## 사용 예 (권장)
- 피드 생성기 테스트에서 이 폴더의 `*.json`을 모두 읽어, `comments`와 `issues`를 입력으로 넣고 `expected`와 비교합니다.
- 신원 판별 설정(저장소 주인, 앱 slug → 사원, 봇 계정 목록)은 [`office/README.md` §6](../README.md#6-신원-확인-누가-쓴-댓글인가)의 판별표 값을 씁니다.
- 예시 추가는 누구나 제안할 수 있지만, 파일 수정은 `claude`가 합니다. (파일 담당표)
