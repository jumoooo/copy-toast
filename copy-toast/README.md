# copy-toast

A Claude Code mod. When Claude's answer contains something you would copy (a code block with a language tag; the mod tells Claude to put such things there), it numbers it in the answer and stacks one card per item above the prompt, each with a **Copy** button. Press the button and that item goes to your clipboard.

[English](#english) · [한국어](#한국어)

## English

### 1. Install

```bash
unzip copy-toast-v1.2.0.zip -d ~/.claude/skills
```

The zip holds one top-level folder, `copy-toast/`, so this creates `~/.claude/skills/copy-toast/`. Claude Code loads it automatically from the next session as `copy-toast@skills-dir`. To attach it to the session you already have open, type `/reload-plugins`.

### 2. Add this to your ~/.claude/CLAUDE.md

Paste the block below at the end of `~/.claude/CLAUDE.md` (create the file if it does not exist). It is the rule that has Claude, the model writing the answer, put what you would copy in tagged blocks; the mod numbers only what that rule marks.
On Team and Enterprise machines, Claude Code's built-in security default `cc-plugin-sec-default@builtin` runs first and skips the `prompt.compose` hook of a plugin you installed yourself, so the rule the mod adds may never reach Claude; that is why you add it once by hand. On a personal account the mod's hook alone is enough and this step is optional.

```markdown
## Copyable things go in tagged fences (copy-toast)
Anything the user is meant to paste or open as-is — a shell command, a slash command for this prompt, a file path, a URL, a config value or snippet — goes in a fenced code block with a language tag (bash, powershell, json, yaml, path, url, copy). bash, path, url and copy blocks hold one item per line.
Names you merely mention (a function, a file, a flag) stay in inline backticks. Blocks that only show something (output, a screen, an example) use an untagged fence or text.
```

### 3. Requirements

- Claude Code 2.1.287 or later runs the mod.
- Claude Code 2.1.292 or later is needed for the options below (the first build with their type definitions). Builds below 2.1.292 are untested; there the options may not be read and the defaults apply.
- Tested on Claude Code 2.1.319.

### 4. Options

| Option | Values | Default | What it does |
|---|---|---|---|
| `language` | `en` · `ko` | `en` | On-screen text. `en` draws `▸ copy N`, `Copy`, `Copied`; `ko` draws `▸ 복사 N`, `복사하기`, `복사 완료`. |
| `colors` | `theme` · `palette` | `theme` | `theme` uses only your Claude Code theme's color keys, so the cards follow your theme. `palette` uses a fixed gold-to-rose hex palette. |

Set them by piping a JSON object to `claude plugin configure`. Options you leave out keep their current values.

```bash
echo '{"language":"ko","colors":"palette"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

It answers `Configuration saved. Restart Claude Code to apply it.` To see the current values and which options are unset:

```bash
claude plugin configure copy-toast@skills-dir
```

### 5. What gets copied

- **Code blocks with a language tag.** A block with no tag, or a display tag such as `text`, `md`, `output`, `log`, `tree`, `mermaid` or `diff`, is treated as something to look at, not to copy.
- **Shell blocks one statement at a time.** In a `bash`, `sh`, `zsh`, `console`, `powershell` or `cmd` block, each line is one item. A line ending in `\`, a heredoc and indented lines join the statement above; blank lines and comment lines are skipped.
- **`path`, `url` and `copy` blocks one line at a time.** Each non-blank line is one item. Lines starting with `#` are skipped, and lines are never joined.
- **Other tagged blocks as a whole.** A `json`, `yaml`, `js` or `python` block is one item.
- **Nothing outside code blocks.** A command line standing alone in the text is not offered. Instead, in sessions with a screen, the mod adds a short rule at the end of the system prompt (a `session` section `copy-toast`, through the `prompt.compose` hook). It tells Claude to put anything you are meant to paste or open as-is (a shell command, a slash command, a file path, a URL, a config value or snippet) in a block tagged `bash`, `powershell`, `json`, `yaml`, `path`, `url` or `copy`, one item per line in `bash`, `path`, `url` and `copy` blocks; to keep names it only mentions in inline backticks; and to leave blocks that only show something untagged or `text`. `claude -p` runs get no rule.

- **Open the folder.** When an item is a path that exists on disk (`/…`, `~/…`, `C:\…`, `\\wsl.localhost\…`), a one-cell **📂** button sits left of **Copy**. Press it and the folder (for a file, the folder holding it) opens in your file manager — Explorer on Windows and WSL, `xdg-open` or `open` elsewhere. The card stays, so you can still copy. URLs, slash commands and paths that do not exist get no button. If an Explorer window for that folder is already open it is brought to the front instead of opening a second one; for a file, the folder opens with that file selected and focused.
- **One row per file.** A `file://` URL is decoded and treated as the path it names, so it gets 📂 too; items that name the same file or folder (`C:\…`, its `file:///C:/…` URL, `/mnt/c/…`, `\\wsl.localhost\…`) collapse into one row that shows the Windows path, and the numbers in the answer follow the rows.

Numbers appear only in what is drawn on screen; the stored message is unchanged. The cards leave when you copy one (that card only), when you send your next prompt (all of them), or when a new answer arrives (replaced by its cards).

### 6. Checks

```bash
cd ~/.claude/skills/copy-toast
claude plugin validate .
claude plugin test .
```

Expected: `Validation passed`, then `23 pass` and `0 fail`.

### 7. Type-checking with tsc

The type definitions `tsc` reads (`.claude-plugin/types/`) are specific to each Claude Code build, so they are not shipped. Regenerate them in this folder with Claude Code's built-in `plugin-authoring` skill, then run:

```bash
npx -y -p typescript tsc -p tsconfig.json
```

`claude plugin validate` and `claude plugin test` do not need these files.

### 8. Limits

- Inline code, tables, lists, untagged blocks and command lines outside blocks are never offered. If Claude does not follow the rule and writes a command outside a block, it gets no card.
- Statements are split by line. Commands joined with `;` or `&&` on one line are one item; a multi-line `if` or `for` without indentation splits line by line.
- The cards are drawn in the band above the prompt, stacked at the right edge. They look like toasts but do not float at the top right.
- OSC 52 clipboard writes report no result, so if your terminal drops the signal the card still says `Copied`.
- Nothing is drawn in `claude -p` runs or in subagent turns.

## 한국어

Claude Code 의 mod 다. Claude 의 답에 복사할 것(언어 표기가 있는 코드 블록 — mod 가 Claude 에게 그런 것은 거기에 넣으라고 알린다)이 있으면 답 안에 번호를 붙이고, 프롬프트 위에 항목마다 카드 한 장씩을 쌓는다. 카드마다 복사 버튼이 있어 누르면 그 항목이 클립보드로 간다.

### 1. 설치

```bash
unzip copy-toast-v1.2.0.zip -d ~/.claude/skills
```

압축본 안에는 최상위 폴더 `copy-toast/` 하나가 있어, 이 명령으로 `~/.claude/skills/copy-toast/` 가 생긴다. 다음 세션부터 Claude Code 가 `copy-toast@skills-dir` 로 저절로 읽어 들인다. 이미 열려 있는 세션에 붙이려면 `/reload-plugins` 를 친다.

### 2. ~/.claude/CLAUDE.md 에 규칙 넣기

아래 블록을 `~/.claude/CLAUDE.md` 끝에 붙여 넣는다(파일이 없으면 만든다). 답을 쓰는 모델(Claude)이 복사할 것을 표기 있는 블록에 넣게 하는 규칙이고, mod 는 이 규칙이 표시한 것에만 번호를 붙인다.
Team·Enterprise 조직의 기계에서는 Claude Code 에 내장된 보안 기본값 `cc-plugin-sec-default@builtin` 이 먼저 돌면서 사용자가 설치한 플러그인의 `prompt.compose` 훅을 건너뛰어, mod 가 붙이는 규칙이 모델에 닿지 않을 수 있다. 그래서 사람이 한 번 넣는다. 개인 계정에서는 mod 의 훅만으로 되므로 이 단계는 하지 않아도 된다.

```markdown
## 복사할 것은 표기 있는 펜스에 (copy-toast)
사용자가 그대로 붙여 넣거나 열 것 — 셸 명령 · 프롬프트에 칠 슬래시 명령 · 파일 경로 · URL · 설정 값이나 조각 — 은 언어 표기가 있는 펜스에 넣는다(bash · powershell · json · yaml · path · url · copy). bash · path · url · copy 블록은 한 줄이 한 항목이다.
이름만 가리키는 것(함수 · 파일 · 플래그)은 인라인 백틱 그대로 둔다. 보여 주기만 하는 것(출력 · 화면 · 예시)은 표기 없는 펜스나 text 에 넣는다.
```

### 3. 요구 버전

- mod 는 Claude Code 2.1.287 부터 돈다.
- 아래 옵션은 그 타입 정의가 처음 들어간 2.1.292 부터 쓸 수 있다. 2.1.292 아래 빌드는 시험하지 않았고, 거기서는 옵션을 못 읽어 기본값만 쓸 수 있다.
- 시험한 버전은 Claude Code 2.1.319 이다.

### 4. 옵션

| 옵션 | 값 | 기본 | 하는 일 |
|---|---|---|---|
| `language` | `en` · `ko` | `en` | 화면 글. `en` 은 `▸ copy N`·`Copy`·`Copied`, `ko` 는 `▸ 복사 N`·`복사하기`·`복사 완료` 를 그린다. |
| `colors` | `theme` · `palette` | `theme` | `theme` 은 Claude Code 테마의 색 키만 써서 카드가 사용자의 테마를 따른다. `palette` 는 금색에서 장미색으로 가는 고정 hex 색을 쓴다. |

`claude plugin configure` 에 JSON 객체 하나를 표준 입력으로 넣어 바꾼다. 넣지 않은 옵션은 지금 값을 지킨다.

```bash
echo '{"language":"ko","colors":"palette"}' | claude plugin configure copy-toast@skills-dir --values-stdin
```

명령은 `Configuration saved. Restart Claude Code to apply it.` 라고 답한다. 지금 값과 비어 있는 옵션은 다음 명령으로 본다.

```bash
claude plugin configure copy-toast@skills-dir
```

### 5. 복사할 것으로 세는 것

- **언어 표기가 있는 코드 블록.** 표기가 없거나 `text`·`md`·`output`·`log`·`tree`·`mermaid`·`diff` 처럼 보여 주기 위한 표기면 복사할 것이 아니라 볼 것으로 친다.
- **셸 블록은 문장마다 하나.** `bash`·`sh`·`zsh`·`console`·`powershell`·`cmd` 블록은 줄 하나가 한 항목이다. 끝이 `\` 인 줄, heredoc, 들여쓴 줄은 앞 문장에 붙고, 빈 줄과 주석 줄은 항목이 아니다.
- **`path`·`url`·`copy` 블록은 줄마다 하나.** 빈 줄이 아닌 줄 하나가 한 항목이다. `#` 으로 시작하는 줄은 건너뛰고, 줄을 잇지 않는다.
- **그 밖의 블록은 통째로 하나.** `json`·`yaml`·`js`·`python` 블록은 블록 하나가 한 항목이다.
- **코드 블록 밖은 세지 않는다.** 글 사이에 홀로 선 명령 줄도 복사할 것으로 치지 않는다. 그 대신 그리는 화면이 있는 세션에서는 mod 가 시스템 프롬프트 끝에 짧은 규칙 절을 붙인다(`prompt.compose` 훅으로 붙이는 `session` 범위 절 `copy-toast`). 사용자가 그대로 붙여 넣거나 열 것(셸 명령·슬래시 명령·파일 경로·URL·설정 값이나 조각)은 `bash`·`powershell`·`json`·`yaml`·`path`·`url`·`copy` 표기 블록에 넣고, `bash`·`path`·`url`·`copy` 블록은 한 줄에 한 항목으로 쓰고, 이름만 가리키는 것은 인라인 백틱에 두고, 보여 주기만 하는 블록은 표기 없이 또는 `text` 로 쓰라는 내용이다. `claude -p` 실행에는 붙이지 않는다.

- **폴더 열기.** 항목이 디스크에 있는 경로(`/…`·`~/…`·`C:\…`·`\\wsl.localhost\…`)면 **복사하기** 왼쪽에 한 칸짜리 **📂** 버튼이 붙는다. 누르면 그 폴더(파일이면 그 파일이 든 폴더)가 파일 탐색기로 열린다 — Windows·WSL 은 탐색기, 그 밖은 `xdg-open`·`open`. 카드는 남아 있어 복사도 이어서 된다. URL·슬래시 명령·없는 경로에는 버튼이 없다. 그 폴더의 탐색기 창이 이미 열려 있으면 새 창 대신 그 창을 앞으로 띄우고, 파일이면 폴더를 열어 그 파일을 선택·포커스한다.
- **파일 하나에 한 줄.** `file://` 주소도 퍼센트 꼴을 풀어 그 경로로 보므로 📂 가 붙고, 같은 파일·폴더를 가리키는 항목(`C:\…`·그 `file:///C:/…` 주소·`/mnt/c/…`·`\\wsl.localhost\…`)은 Windows 경로를 보이는 한 줄로 합쳐지며 답변 쪽 번호도 그 줄을 따른다.

번호는 화면에 그려지는 글에만 붙고 저장된 메시지는 그대로다. 카드는 그 카드를 복사했을 때(그 장만), 다음 프롬프트를 보냈을 때(남은 장 전부), 새 답이 왔을 때(새 카드로 바뀐다) 사라진다.

### 6. 검사

```bash
cd ~/.claude/skills/copy-toast
claude plugin validate .
claude plugin test .
```

`Validation passed` 가 나오고, 이어서 `23 pass` 와 `0 fail` 이 나오면 정상이다.

### 7. tsc 로 타입 검사하기

`tsc` 가 읽는 타입 정의(`.claude-plugin/types/`)는 Claude Code 빌드마다 달라 압축본에 넣지 않았다. Claude Code 에 내장된 `plugin-authoring` 스킬로 이 폴더에 다시 만든 뒤 다음을 돌린다.

```bash
npx -y -p typescript tsc -p tsconfig.json
```

`claude plugin validate` 와 `claude plugin test` 는 이 파일 없이 돈다.

### 8. 한계

- 인라인 코드·표·목록·표기 없는 블록·블록 밖의 명령 줄은 세지 않는다. Claude 가 규칙을 따르지 않고 명령을 블록 밖에 쓰면 그 명령에는 카드가 생기지 않는다.
- 문장은 줄 단위로 나눈다. 한 줄에 `;` 나 `&&` 로 이은 명령은 한 항목이고, 들여쓰기 없이 여러 줄로 쓴 `if`·`for` 는 줄마다 갈린다.
- 카드는 프롬프트 위 띠의 오른쪽 끝에 쌓아 그린다. 토스트처럼 보이지만 화면 오른쪽 위에 떠 있지는 않다.
- OSC 52 로 클립보드에 쓰면 결과가 돌아오지 않아, 터미널이 그 신호를 버려도 카드에는 완료 글이 뜬다.
- `claude -p` 실행과 서브에이전트의 턴에는 아무것도 그리지 않는다.
