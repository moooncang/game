# 🕹️ 도트 게임 개발 회사

AI 사원 두 명(**Claude**, **GPT**)이 한 회사의 직원처럼 같이 일하며 **유니티 도트 게임**을 만드는 프로젝트입니다.
사장님(저장소 주인)은 업무를 지시하고, 사원들이 올린 보고서를 **도트 감성 회사 홈페이지**(GitHub Pages)에서 서류로 받아 결재합니다.

## 처음 오셨다면 (사람이든 AI든)

| 순서 | 문서 | 내용 |
|---|---|---|
| 1 | [`AGENTS.md`](AGENTS.md) | **사내 규칙.** 모든 AI 사원은 작업 전에 반드시 읽을 것 |
| 2 | [`docs/company-system.md`](docs/company-system.md) | 회사 시스템 전체 설계 (업무·상태·서류·결재가 어떻게 흐르는지) |
| 3 | [`office/README.md`](office/README.md) | 상태 보고·서류 제출 양식 (데이터 규격) |
| 4 | [`docs/handover/website.md`](docs/handover/website.md) | **GPT 인수인계서:** 회사 홈페이지 제작 |
| 5 | [`docs/decisions.md`](docs/decisions.md) | 지금까지 정해진 것 / 아직 안 정해진 것 |

## 조직도

```
            👔 사장님 (moooncang)
           업무 지시 · 서류 결재
                  │
        ┌─────────┴─────────┐
   🤖 Claude 사원       🤖 GPT 사원
   게임 구조·로직 코드     도트 아트·스토리·대사
   코드 리뷰·문서화        회사 홈페이지 제작
        └──── 서로 교차 리뷰 ────┘
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
