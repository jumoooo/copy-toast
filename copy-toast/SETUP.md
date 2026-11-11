# copy-toast 처음 설정 — Claude 가 따르는 순서

사람이 「copy-toast 처음 설정 해 줘」라고 했거나, 묶음의 설명 글을 읽고 셋업해 달라고 했을 때 이 순서대로 한다.
**고르는 것은 전부 `AskUserQuestion` 도구(물음 칸)로 묻는다.** 한 번에 질문 하나, 한국어로. 사람 대신 고르지 않는다.
명령은 이 기계의 셸에 맞는 것만 쓴다 — Windows(PowerShell)와 Mac · Linux · WSL 꼴을 둘 다 적어 두었다.

## 1. 규칙 넣기

copy-toast 는 답 속의 「표기 있는 코드 블록」만 복사할 것으로 센다. 답을 쓰는 Claude 가 그렇게 쓰도록 하는 규칙을 사람의 설정 글에 넣는다.
설정 글은 Windows `$env:USERPROFILE\.claude\CLAUDE.md`, 그 밖 `~/.claude/CLAUDE.md`.

1. 그 파일에 `(copy-toast)` 가 든 제목 줄이 이미 있으면 넣지 않는다. 「규칙은 이미 들어 있습니다」 한 줄만 말하고 2절로 간다.
2. 없으면 물음 칸: 「Claude 가 복사할 것을 표기 있는 코드 블록에 넣도록 하는 규칙을 내 설정 글(~/.claude/CLAUDE.md) 끝에 넣을까요? 이 규칙이 있어야 버튼이 제대로 붙습니다.」
   - `넣기 (권장)` → 파일 끝에 빈 줄 하나를 두고 아래 블록을 그대로 덧붙인다. 파일이 없으면 만든다. 있던 내용은 한 글자도 바꾸지 않는다. 넣은 뒤 「~/.claude/CLAUDE.md 끝에 넣었습니다」.
   - `넣을 글만 보여 주기` → 아래 블록을 코드 블록으로 보여 주고, 직접 붙여 넣으라고 한다. 파일은 건드리지 않는다.
   - `건너뛰기` → 넣지 않는다. 「규칙이 없으면 Claude 가 명령을 표기 없는 블록에 쓸 때 버튼이 안 붙습니다. 나중에 『copy-toast 처음 설정 해 줘』로 넣을 수 있습니다」 한 줄.

넣는 블록(그대로):

```markdown
## 복사할 것은 표기 있는 펜스에 (copy-toast)
사용자가 그대로 붙여 넣거나 열 것 — 셸 명령 · 프롬프트에 칠 슬래시 명령 · 파일 경로 · URL · 설정 값이나 조각 — 은 언어 표기가 있는 펜스에 넣는다(bash · powershell · json · yaml · path · url · copy). bash · path · url · copy 블록은 한 줄이 한 항목이다.
이름만 가리키는 것(함수 · 파일 · 플래그)은 인라인 백틱 그대로 둔다. 보여 주기만 하는 것(출력 · 화면 · 예시)은 표기 없는 펜스나 text 에 넣는다.
```

## 2. 화면 글

물음 칸: 「버튼의 글을 어느 말로 할까요?」 — `한국어 (복사하기 · 복사 완료)` · `English (Copy · Copied)`. 값은 `ko` · `en`.

## 3. 색

물음 칸: 「버튼의 색을 무엇으로 할까요?」 — `내 Claude Code 테마 색 (밝은 · 어두운 테마를 따라감)` · `고정 색 (금색에서 장미색)`. 값은 `theme` · `palette`.

## 4. 저장

2 · 3 에서 고른 값을 한 번에 저장한다. 종료 0 과 `Configuration saved` 가 나와야 한다.

Mac · Linux · WSL:

```bash
printf '{"language":"ko","colors":"theme"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

Windows (PowerShell):

```powershell
'{"language":"ko","colors":"theme"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

## 5. 마무리

한 일을 짧게 알린다 — 규칙(넣음 · 보여 줌 · 건너뜀 · 이미 있음), 화면 글, 색. 그리고 「Claude Code 를 새로 열면 보입니다. 열려 있는 창에서는 /reload-plugins」.
📂 폴더 열기 버튼은 Node.js 가 있어야 붙는다 — `node --version` 이 안 되면 그 한 줄을 덧붙인다(깔아 주지 않는다).

하지 않는 것: 사람이 고르지 않은 값 저장 · 설정 글의 다른 부분 고치기 · 관리자 권한 · 프로그램 설치.
