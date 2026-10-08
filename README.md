# 🕹️ 도트 게임 개발 회사

AI 사원 두 명(**GPT**, **Claude**)이 한 회사의 직원처럼 같이 일하며 **유니티 도트 게임**을 만드는 프로젝트입니다.
사장님(저장소 주인)은 업무를 지시하고, 사원들이 갈래별로 나눠 올린 서류를 **도트 감성 회사 홈페이지**(GitHub Pages)에서 받아 피드백·결재한 뒤, **출근 버튼**으로 사원을 불러 처리하게 합니다.

## 처음 오셨다면 (사람이든 AI든)

| 순서 | 문서 | 내용 |
|---|---|---|
| 1 | [`AGENTS.md`](AGENTS.md) | **사내 규칙.** 모든 AI 사원은 작업 전에 반드시 읽을 것 |
| 2 | [`docs/company-system.md`](docs/company-system.md) | 회사 시스템 전체 설계 (업무·상태·서류·결재가 어떻게 흐르는지) |
| 3 | [`office/README.md`](office/README.md) | 상태 보고·서류 제출 양식 (데이터 규격) |
| 4 | [`docs/handover/website.md`](docs/handover/website.md) | **GPT 인수인계서:** 회사 홈페이지 제작 |
| 5 | [`docs/decisions.md`](docs/decisions.md) | 지금까지 정해진 것 / 아직 안 정해진 것 |
| 6 | [`docs/guides/ceo-setup.md`](docs/guides/ceo-setup.md) | **사장님 설정 안내** (Pages, 권한, AI 열쇠, 출근시키는 법) |
| 7 | [`docs/handover/v2-implementation.md`](docs/handover/v2-implementation.md) | 업무 방식 v2 구현 안내서 (GPT용) |
| 8 | [`docs/handover/approve-button.md`](docs/handover/approve-button.md) | 홈페이지 결재 버튼 구현 안내서 (GPT용) |

## 조직도

```
            👔 사장님 (moooncang)
           업무 지시 · 서류 결재
                  │
        ┌─────────┴─────────┐
   🤖 GPT 사원 (실무)       🤖 Claude 사원
   유니티 게임 코딩·제작      검수 (PR 리뷰)
   도트 아트·홈페이지·자동화   기획 아이디어 · 시스템 정리
        └──── GPT 결과물을 Claude가 검수 ────┘
```

## 저장소 구조

```
.
├── AGENTS.md              # 사내 규칙 (모든 AI 공통)
├── CLAUDE.md              # Claude 전용 메모 (AGENTS.md를 불러옴)
├── docs/
│   ├── company-system.md  # 회사 시스템 설계
│   ├── decisions.md       # 결정 사항 기록
│   └── handover/          # 인수인계서
├── office/                # 회사 업무 데이터 규격과 예시
├── .github/ISSUE_TEMPLATE # 업무 지시서 양식
├── site/                  # (예정) 회사 홈페이지 — GPT 담당
└── unity/                 # (예정) 유니티 게임 프로젝트
```

> ⚠️ 이 저장소는 **공개 저장소**입니다. API 키, 비밀번호, 토큰 등은 절대 커밋하지 마세요.
