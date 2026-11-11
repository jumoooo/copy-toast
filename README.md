# copy-toast 1.2.0 — 답변의 명령을 버튼 하나로 복사하고, 경로는 폴더까지 여는 Claude Code mod
<img width="535" height="275" alt="스크린샷 2026-11-06 140106" src="https://github.com/user-attachments/assets/a39b1855-86bd-4415-b437-5cf8e2506cf1" />
## 1. 내 기계에서 할 것

가장 쉬운 길은 **Claude 에게 맡기는 것**입니다. 이 파일이 있는 폴더에서 Claude Code 를 열고 이렇게 칩니다.

```copy
설명.md 읽고 그대로 셋업해줘
```

(압축을 이미 풀어 그 안의 `README.md` 를 보고 있다면 「README.md 읽고 그대로 셋업해줘」.)
Claude 가 기계를 확인하고, 설치하고, 고를 것 셋을 물음 칸으로 물어봅니다. 고르기만 하면 됩니다.

직접 하려면 압축(`copy-toast-v1.2.0.zip`)을 풀고 기계에 맞는 것 하나를 합니다. 폴더는 하나이고, 어느 기계에서나 같은 것을 씁니다.

| 내 기계 | 할 것 |
|---|---|
| Windows | 푼 폴더의 `install-windows.cmd` 를 두 번 누릅니다 |
| Mac · Linux · WSL | 터미널에서 푼 폴더로 가서 `sh install-mac-linux.sh` |

그 다음 Claude Code 를 새로 열고 「copy-toast 처음 설정 해 줘」라고 합니다(4절).

앞 버전(1.0.0 · 1.1.0 · 1.2.0)을 쓰고 있었다면 같은 방법으로 덮어 깔면 됩니다. mod 의 동작은 1.2.0 과 같고, 이번 묶음은 설치 파일과 처음 설정이 더해진 것입니다.

## 2. 무엇인가

Claude 의 답변에 복사할 코드 블록이 있으면

- 답변 안의 그 블록 위에 번호(「▸ copy 1」)를 붙이고
- 프롬프트 위에 번호가 붙은 작은 상자를 쌓습니다. 상자의 [ Copy ] 를 누르면 그 블록이 클립보드로 갑니다.
- 항목이 디스크에 있는 경로면 [ Copy ] 왼쪽에 📂 버튼이 하나 더 붙습니다. 누르면 그 폴더가 파일 탐색기로 열립니다.

마우스로 긁어 복사하는 손, 경로를 탐색기 주소 칸에 붙여 넣는 손이 없어집니다.

## 3. 필요한 것

| 것 | 꼭 필요한가 | 없으면 |
|---|---|---|
| Claude Code 2.1.292 이상 (`claude --version`) | 예 | 설치가 멈추고 올리는 법을 알려 줍니다 |
| Node.js | 아니요 | 📂 폴더 열기 버튼만 안 붙습니다. 번호와 [ Copy ] 버튼은 그대로 됩니다 |

**Claude Code 만 깔린 기계에서도 됩니다.** 시험한 환경은 맨 아래 11절에 적었습니다. Mac 은 문서를 보고 준비했고 실제 Mac 에서 돌려 보지는 못했습니다.

## 4. 설치와 처음 설정

### 4-1. 설치 — 아무것도 묻지 않습니다

Windows 는 `install-windows.cmd` 를 두 번 누르면 창이 뜹니다. Mac · Linux · WSL 은 터미널에서:

```bash
cd copy-toast-v1.2.0
sh install-mac-linux.sh
```

이런 화면이 나옵니다. 아래는 Claude 만 깔린 **Windows** 기계의 예입니다. Mac · Linux · WSL 에서는 셋째 줄이 「(Mac 으로 알아봤습니다)」처럼 그 기계 이름으로 나오고, 복사한 자리가 `/Users/<이름>/.claude/skills/copy-toast`(Mac) · `/home/<이름>/.claude/skills/copy-toast`(Linux · WSL) 로 나옵니다. 나머지 줄은 같습니다.

```text
copy-toast 1.2.0 — 설치

이 기계에 있는 것을 먼저 봅니다.  (Windows 로 알아봤습니다)

  ✓ Claude Code   2.1.322     2.1.292 이상이면 됩니다
  ✓ mod 기능      켜져 있음
  – Node.js       없음        없어도 됩니다

  이 기계에서는 이렇게 갑니다
    · 번호 붙이기 · [ Copy ] 버튼     됩니다
    · 📂 폴더 열기 버튼              안 붙습니다
      (Node.js 가 있어야 합니다. 나중에 깔면 저절로 됩니다)

  ✓ 복사했습니다
    C:\Users\<이름>\.claude\skills\copy-toast

다음  Claude Code 를 새로 열면 켜집니다.
      규칙 넣기와 옵션은 Claude 에게:  copy-toast 처음 설정 해 줘
```

- 설치가 하는 일은 「있는 것 확인」과 `copy-toast` 폴더 복사 둘뿐입니다. **내 설정 글은 건드리지 않습니다.** 손으로 해도 됩니다 — 푼 폴더의 `copy-toast` 폴더를 `~/.claude/skills/` 아래로 복사합니다(Windows 는 `%USERPROFILE%\.claude\skills\`).
- 잘못된 쪽을 돌리면 아무것도 바꾸지 않고 맞는 파일 이름을 알려 줍니다.
- Mac 에서는 파일을 두 번 눌러 실행하지 말고 터미널에서 위 한 줄로 돌립니다. 내려받은 파일을 Mac 이 막는 일이 있습니다.

### 4-2. 처음 설정 — 고를 것 셋

Claude Code 를 새로 열고 이렇게 말합니다.

```copy
copy-toast 처음 설정 해 줘
```

셋 모두 **물음 칸**으로 나옵니다. 화살표로 고르고 Enter 를 누르면 됩니다.

| 묻는 것 | 고르는 것 |
|---|---|
| 규칙 넣기 — Claude 가 「복사할 것」을 표기 있는 코드 블록에 넣도록 하는 규칙을 내 설정 글(`~/.claude/CLAUDE.md`) 끝에 넣을까요? | `넣기 (권장)` · `넣을 글만 보여 주기` · `건너뛰기` |
| 화면 글 — 버튼의 글을 어느 말로 할까요? | `한국어` (복사하기 · 복사 완료) · `English` (Copy · Copied) |
| 색 — 버튼의 색을 무엇으로 할까요? | `내 Claude Code 테마 색` · `고정 색` (금색에서 장미색) |

- 규칙은 「넣기」를 고른 때에만 설정 글 끝에 덧붙입니다. 있던 내용은 바꾸지 않습니다. 이미 들어 있으면 넣지 않고 그렇다고 알려 줍니다.
- 이 규칙이 있어야 버튼이 제대로 붙습니다. 회사 조직 계정에서는 Claude Code 의 보안 기본값이 mod 가 넣어 주는 안내를 건너뛰기 때문입니다.

직접 넣으려면 아래를 `~/.claude/CLAUDE.md` 끝에 붙여 넣습니다.

```markdown
## 복사할 것은 표기 있는 펜스에 (copy-toast)
사용자가 그대로 붙여 넣거나 열 것 — 셸 명령 · 프롬프트에 칠 슬래시 명령 · 파일 경로 · URL · 설정 값이나 조각 — 은 언어 표기가 있는 펜스에 넣는다(bash · powershell · json · yaml · path · url · copy). bash · path · url · copy 블록은 한 줄이 한 항목이다.
이름만 가리키는 것(함수 · 파일 · 플래그)은 인라인 백틱 그대로 둔다. 보여 주기만 하는 것(출력 · 화면 · 예시)은 표기 없는 펜스나 text 에 넣는다.
```

## 5. 무엇이 복사 대상인가

- 언어 표기가 있는 코드 블록만입니다. `bash` 는 문장마다 하나, `path` · `url` · `copy` 는 줄마다 하나, `json` 같은 것은 블록 하나가 하나.
- 표기 없는 블록, 표, 목록, 문장 속 백틱은 세지 않습니다. 그래서 위 규칙이 필요합니다.
- 같은 파일을 가리키는 항목은 한 줄로 합칩니다. `C:\…` · `file:///C:/…` · `/mnt/c/…` · `\\wsl.localhost\…` 처럼 적은 꼴이 달라도 같은 파일이면 상자 하나, 답변 쪽 번호도 하나입니다.

## 6. 📂 버튼은 언제 붙나

- Node.js 가 있는 기계에서, 항목 한 줄이 경로 꼴(`/…` · `~/…` · `C:\…` · `\\wsl.localhost\…` · `file://…`)이고 **그 경로가 디스크에 있을 때**만 붙습니다. URL · 슬래시 명령 · 없는 경로에는 안 붙습니다.
- 폴더면 그 폴더가 열립니다. 파일이면 그 파일이 든 폴더가 열리고, 그 파일이 선택된 채로 보입니다.
- 기계마다 여는 방식: Windows 와 WSL 은 파일 탐색기(이미 열린 창이 있으면 그 창을 앞으로), Mac 은 `open`(Finder), Linux 데스크톱은 `xdg-open`.
- 못 열면 화면 아래에 이유 한 줄이 잠깐 뜹니다.

## 7. 옵션 바꾸기

Claude 에게 「copy-toast 처음 설정 해 줘」라고 다시 하거나, 직접 칩니다. 바꾼 뒤 Claude Code 를 새로 엽니다.

Mac · Linux · WSL:

```bash
printf '{"language":"ko","colors":"theme"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

Windows (PowerShell):

```powershell
'{"language":"ko","colors":"theme"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

| 옵션 | 값 | 기본 | 뜻 |
|---|---|---|---|
| language | `en` · `ko` | `en` | 화면 글 |
| colors | `theme` · `palette` | `theme` | `theme` 은 내 Claude Code 테마 색, `palette` 는 고정 색 |

## 8. 잘 들어갔는지 확인

Windows(PowerShell)와 Mac · Linux · WSL 에서 같은 명령입니다. Windows 는 `~` 대신 `$env:USERPROFILE` 을 씁니다.

```bash
claude plugin validate ~/.claude/skills/copy-toast
claude plugin test ~/.claude/skills/copy-toast
```

`Validation passed` 와 `0 fail` 이 나오면 됩니다. 통과 수는 WSL 에서 `23 pass`, Windows 에서 `18 pass` 로 쟀습니다(WSL 경로를 다루는 시험 다섯은 Windows 에서 돌지 않습니다). Mac 과 WSL 이 아닌 Linux 는 돌려 보지 못했고, WSL 과 같은 23 일 것으로 봅니다. 두 명령 모두 Claude Code 만으로 돕니다.

## 9. 지우기

`copy-toast` 폴더를 지우고, 규칙을 넣었다면 `~/.claude/CLAUDE.md` 에서 「복사할 것은 표기 있는 펜스에 (copy-toast)」 제목과 그 아래 두 줄을 지웁니다.

```bash
rm -rf ~/.claude/skills/copy-toast
```

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills\copy-toast"
```

## 10. 안 될 때

| 증상 | 할 것 |
|---|---|
| 설치가 「Claude Code 못 찾음」 | Claude Code 를 깔거나, 새 터미널을 엽니다. Mac 은 `~/.zshrc`, Linux 는 `~/.bashrc` 에 `export PATH="$HOME/.local/bin:$PATH"` |
| 설치가 「mod 기능 꺼져 있음」 | 조직 설정이면 관리자에게 Claude Code 의 mod(hooks modules)를 켜 달라고 요청합니다. 복사는 돼 있으니 켜지면 바로 됩니다 |
| 버튼이 안 뜸 | Claude Code 를 새로 열었는지 봅니다. 열려 있던 창이면 `/reload-plugins`. 규칙(4-2)이 들어 있는지도 봅니다 — 없으면 Claude 가 명령을 표기 없는 블록에 써서 버튼이 안 붙습니다 |
| 📂 가 안 붙음 | Node.js 가 있는지(`node --version`), 그 경로가 디스크에 실제로 있는지 봅니다 |
| Claude 에게 셋업을 맡겼는데 「막혔다」며 명령 한 줄을 보여 줌 | 자동 권한 검사가 압축에서 나온 설치 파일을 막은 것입니다. 보여 준 한 줄을 프롬프트에 `!` 를 앞에 붙여 그대로 치고, 끝나면 「계속」이라고 합니다 |
| Mac 에서 폴더 접근을 묻는 창 | 받은 폴더가 다운로드·문서·데스크탑 아래에 있으면 터미널이나 Claude Code 가 그 폴더를 읽을 때 뜹니다. 허용하면 됩니다. Claude 에게 셋업을 맡겼는데 「파일을 읽지 못했다」고 하면, 받은 폴더를 홈 바로 아래로 옮긴 뒤 거기서 Claude Code 를 다시 엽니다 |

## 11. 시험한 환경과 못 한 것

| 환경 | 상태 |
|---|---|
| Windows 11 (PowerShell 5.1) | 잼 — Node.js 를 가린 채 설치 · 검사 · 옵션 저장 |
| WSL2 Ubuntu | 잼 — 같은 항목 |
| Linux (WSL 이 아닌) | 재지 않음 — WSL 과 같은 설치 파일, 같은 길 |
| Mac | **재지 않음.** 문서를 보고 준비했습니다 — 설치 파일은 Mac 의 기본 셸(bash 3.2)에서 도는 문법만 쓰고, Mac 에 없는 도구를 쓰지 않습니다. mod 자체는 1.2.0 그대로입니다 |

Mac 에서 처음 써 보는 분은 설치 전에 아래를 터미널에 붙여 넣고(푼 폴더 안에서) 결과를 공유해 주시면 도움이 됩니다. 읽기만 하고 아무것도 바꾸지 않습니다.

```bash
echo "== system"; sw_vers; uname -sm
echo "== shell"; echo "SHELL=$SHELL"; /bin/bash --version | head -1; echo "TERM_PROGRAM=$TERM_PROGRAM COLORTERM=$COLORTERM"
echo "== tools"; for c in claude node unzip pbcopy open; do printf '%-8s ' "$c"; command -v "$c" || echo "(없음)"; done
echo "== versions"; claude --version 2>&1; node -v 2>&1
echo "== files"; ls -l; xattr install-mac-linux.sh 2>&1; grep -c "$(printf '\r')" install-mac-linux.sh
echo "== plugin check"; claude plugin validate ./copy-toast 2>&1 | tail -3
```

---

## Claude 에게 — 「이 파일 읽고 그대로 셋업해줘」를 받았을 때

사람이 이 파일을 읽고 셋업해 달라고 했다면 아래를 순서대로 한다. 설치 파일을 사람이 직접 돌린 것과 같은 결과가 되어야 한다.
**고르는 것은 전부 `AskUserQuestion` 도구(물음 칸)로 묻는다.** 사람 대신 고르지 않는다. 명령은 이 기계의 셸에 맞는 것만 쓴다 — Windows 를 전제하지 않는다.

1. **기계를 알아본다.** Windows 인지(PowerShell: `$env:OS` 가 `Windows_NT`), 그 밖인지(`uname -s` — `Darwin` 은 Mac, `Linux` 는 Linux 또는 WSL). 알아본 것을 한 줄로 말한다.
   Mac 이고 이 폴더가 다운로드·문서·데스크탑 아래에 있으면, 폴더 접근을 묻는 창이 뜰 수 있으니 허용해 달라고 먼저 한 줄로 알린다. 압축이나 이 파일을 읽지 못하면(권한 오류) 우회하지 말고, 받은 폴더를 홈 바로 아래로 옮긴 뒤 거기서 다시 열어 달라고 한다.
2. **묶음 폴더를 찾는다.** 이 파일 옆에 `install-mac-linux.sh` 가 있으면 여기가 묶음 폴더다. 없고 `copy-toast-v1.2.0.zip` 이 있으면 임시 폴더에 푼다 —
   Windows `Expand-Archive -LiteralPath <zip> -DestinationPath <임시 폴더> -Force`, 그 밖 `unzip -q -o <zip> -d <임시 폴더>`(`unzip` 이 없으면 `python3 -m zipfile -e <zip> <임시 폴더>`, 그것도 없으면 사람에게 풀어 달라고 한다).
   묶음 폴더는 `<임시 폴더>/copy-toast-v1.2.0` 이다.
3. **설치 파일을 돌린다.** 아무것도 묻지 않는 파일이다. 출력은 사람에게 그대로 보인다.
   - Windows: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<묶음 폴더>\copy-toast\scripts\install.ps1"`
   - Mac · Linux · WSL: `sh "<묶음 폴더>/install-mac-linux.sh"`
   - 종료 0 이 아니면 출력의 안내(Claude Code 를 올려라 등)를 사람에게 전하고 **멈춘다.** 우회하지 않는다.
   - 권한 검사가 이 실행을 막으면(자동 권한 모드가 압축에서 나온 파일을 「외부에서 온 코드」로 막는 일이 있다) 우회하지 않는다 — 손으로 복사해 같은 결과를 내지도 않는다.
     그 명령 한 줄을 사람에게 보이고, 프롬프트에 `! <그 명령>` 으로 직접 돌려 달라고 한다. 사람이 돌렸다고 하면 4단계부터 잇는다.
4. **들어갔는지 잰다.** `<스킬>` 은 Windows `$env:USERPROFILE\.claude\skills\copy-toast`, 그 밖 `~/.claude/skills/copy-toast`.
   `claude plugin validate "<스킬>"` 은 `Validation passed`, `claude plugin test "<스킬>"` 은 `0 fail` 이어야 한다(통과 수는 Windows 18, WSL 23 으로 쟀다. Mac 과 그 밖의 Linux 는 재지 못했고 23 일 것으로 본다 — 다르면 수를 그대로 알린다). 아니면 출력을 보이고 멈춘다.
5. **처음 설정을 한다.** `<스킬>/SETUP.md` 를 읽고 그 순서대로 한다 — 규칙 넣기 · 화면 글 · 색을 물음 칸으로 묻고, 고른 대로만 한다.
6. **마무리를 알린다.** 한 일을 짧게 — 설치한 자리, 규칙(넣음 · 보여 줌 · 건너뜀 · 이미 있음), 화면 글, 색, 검사 결과(돌린 명령과 통과 수), 📂 버튼이 붙는지(Node.js 유무).
   그리고 「Claude Code 를 새로 열면 켜집니다」.

하지 않는 것: 관리자 권한(`sudo`)·프로그램 설치·사람이 고르지 않은 값 저장·설정 글의 다른 부분 고치기.
