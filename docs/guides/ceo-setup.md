# 사장님 설정 안내 (업무 방식 v2)

GPT가 업무 #6을 진행하면서 필요한 GitHub 설정을 순서대로 정리했습니다. **한 번만** 하면 됩니다.
모두 저장소 화면 위쪽의 **Settings** 탭에서 합니다.

## 1. 홈페이지 배포 켜기 (GitHub Pages)
1. Settings → 왼쪽 메뉴 **Pages**
2. **Build and deployment → Source**를 **GitHub Actions**로 선택
3. 저장할 버튼은 없습니다. 선택하면 바로 적용돼요.

홈페이지 주소는 GPT의 배포 작업이 처음 성공한 뒤 같은 화면 위쪽에 나타납니다. 보통 `https://moooncang.github.io/game/`이에요.

## 2. 자동화 권한 주기 (Actions)
1. Settings → **Actions → General**
2. 맨 아래 **Workflow permissions**에서
   - **Read and write permissions** 선택
   - **Allow GitHub Actions to create and approve pull requests** 체크
3. **Save**

출근한 사원이 브랜치를 올리고 PR을 만들고 서류 댓글을 다는 데 필요해요.

## 3. AI 열쇠 넣기 (Secrets)
Settings → **Secrets and variables → Actions** → **New repository secret**

| 이름 | 무엇 | 어디서 받나 | 요금 |
|---|---|---|---|
| `OPENAI_API_KEY` | GPT 출근용 | [platform.openai.com](https://platform.openai.com) → API keys | **ChatGPT 구독과 별도**로 사용한 만큼 청구 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude 출근용 (추천) | PC에서 Claude Code를 설치하고 터미널에 `claude setup-token` 입력 | Claude 구독 사용량 안에서 |
| `ANTHROPIC_API_KEY` | Claude 출근용 (위 대신) | [console.anthropic.com](https://console.anthropic.com) → API Keys | 사용한 만큼 청구 |

- Claude는 둘 중 **하나만** 넣으면 돼요.
- 열쇠는 이 화면에만 넣으세요. 파일, 댓글, 채팅에 붙여 넣으면 공개 저장소라 누구나 볼 수 있어요.

## 4. 사용료 안전장치 (권장)
- OpenAI: platform.openai.com → **Limits**에서 월 사용 한도 설정
- Anthropic(API 키를 쓸 경우): console.anthropic.com → **Limits**에서 월 사용 한도 설정
- 출근 한 번당 최대 실행 시간은 워크플로에 정해 둡니다. (GPT가 구현)

## 5. 출근시키는 법 (설정이 끝난 뒤)
1. 홈페이지의 **[GPT 출근] / [Claude 출근] / [전원 출근]** 버튼을 누르면 GitHub의 "출근" 화면이 열려요.
   (또는 저장소의 **Actions** 탭 → 왼쪽 **출근**)
2. 오른쪽 **Run workflow** → 사원(`gpt` / `claude` / `all`)과 방식(`sequential` 순서대로 / `parallel` 동시)을 고르고 **Run workflow**
3. 일이 끝나면 서류가 Issue에 올라오고, 1~2분 뒤 홈페이지 서류함에 도착해요.

- 버튼을 여러 번 눌러도 한 사원은 한 번에 하나씩만 일해요. 대기는 1개까지만 남고 나머지는 취소돼요.

## 6. 결재 버튼 열쇠 등록 (한 번만)
홈페이지 서류 창의 **[승인] [반려] [피드백]** 버튼을 쓰려면, 버튼이 사장님 대신 GitHub에 결재 댓글을 쓸 수 있도록 **열쇠**를 한 번 만들어 브라우저에 넣어야 해요.

### 6-1. 열쇠 만들기 (GitHub)
1. GitHub 오른쪽 위 프로필 사진 → **Settings**
2. 왼쪽 맨 아래 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
3. 이렇게 채워요.
   | 항목 | 값 |
   |---|---|
   | Token name | `회사 홈페이지 결재 버튼` |
   | Expiration | 90일 (만료되면 같은 방법으로 다시 만들어요) |
   | Repository access | **Only select repositories** → `moooncang/game` **하나만** |
   | Permissions → Repository permissions | **Issues: Read and write** **하나만** (Metadata는 자동으로 읽기가 붙어요) |
4. **Generate token** → `github_pat_`로 시작하는 열쇠가 **한 번만** 보여요. 바로 복사하세요.

### 6-2. 홈페이지에 등록
1. 홈페이지 위쪽 상태창의 **[사장님 열쇠]** 버튼
2. 복사한 열쇠를 붙여 넣고 **등록**
3. 홈페이지가 열쇠 주인이 `moooncang`인지 확인한 뒤 "등록됨"으로 바뀌어요.

### 6-3. 알아 두실 것
- 열쇠는 **그 브라우저에만** 저장돼요. 휴대폰·다른 PC에서도 결재하려면 그 기기에서도 등록해야 해요.
- 공용 PC에서는 쓰고 나서 **[사장님 열쇠] → 열쇠 지우기**를 눌러 주세요.
- 열쇠를 잃어버렸거나 의심되면 6-1 화면에서 그 열쇠를 **Delete**하면 바로 못 쓰게 돼요.
- 권한을 "Issues 쓰기"로만 줬기 때문에, 이 열쇠로는 코드 변경·머지·설정 변경을 할 수 없어요.

## ⚠️ 하지 말아야 할 것
- **개인 액세스 토큰(PAT)을 AI에게 주거나, 채팅에 붙여 넣거나, Secrets·파일에 넣지 마세요.** 사장님 결재와 AI 댓글을 구분하는 장치가 깨져요. PAT를 쓰는 곳은 **6번의 홈페이지 결재 버튼(사장님 브라우저)** 한 곳뿐이에요. ([`office/README.md` §6](../../office/README.md#6-신원-확인-누가-쓴-댓글인가))
- 결재·피드백은 **홈페이지 결재 버튼** 또는 **GitHub 웹**에서 해 주세요. GitHub 모바일 앱으로 하실 거면 먼저 한 번 시험해 봐야 해요.
