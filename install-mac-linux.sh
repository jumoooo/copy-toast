#!/bin/sh
# 이 파일은 Mac · Linux · WSL 용입니다.
# Windows 라면 install-windows.cmd 를 두 번 누르세요.
#
# 쓰는 법 (터미널에서, 이 폴더로 간 뒤):   sh install-mac-linux.sh
# 하는 일: 이 기계에 있는 것을 확인하고, copy-toast 폴더를 ~/.claude/skills/ 아래로 복사합니다. 아무것도 묻지 않습니다.
#          내 설정 글(~/.claude/CLAUDE.md)은 건드리지 않습니다.
# 지우려면: ~/.claude/skills/copy-toast 폴더를 지웁니다.

MIN_VERSION="2.1.292"
say() { printf '%s\n' "$*"; }

HERE=$(cd "$(dirname "$0")" && pwd)
SRC="$HERE/copy-toast"
VERSION=$(sed -n 's/.*"version"[^"]*"\([^"]*\)".*/\1/p' "$SRC/.claude-plugin/plugin.json" 2>/dev/null | sed -n 1p)
[ -n "$VERSION" ] || VERSION="?"

say ""
say "copy-toast $VERSION — 설치"
say ""

# ── 어느 기계인가: Mac 을 먼저 가른다(/proc 은 Mac 에 없다) ──
KERNEL=$(uname -s 2>/dev/null || echo unknown)
case "$KERNEL" in
  Darwin) OS="mac"; OS_NAME="Mac 으로" ;;
  Linux)
    if [ -r /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then OS="wsl"; OS_NAME="WSL 로"; else OS="linux"; OS_NAME="Linux 로"; fi ;;
  MINGW*|MSYS*|CYGWIN*)
    say "  이 기계는 Windows 입니다."
    say "  install-windows.cmd 를 두 번 눌러 주세요."
    say "  (아무것도 바꾸지 않았습니다)"
    exit 3 ;;
  *) OS="linux"; OS_NAME="$KERNEL (Linux 로 보고)" ;;
esac

if [ ! -f "$SRC/SKILL.md" ]; then
  say "  ✗ 이 파일 옆에 copy-toast 폴더가 없습니다: $SRC"
  say "    압축을 푼 폴더 안에서 돌려 주세요."
  exit 1
fi

say "이 기계에 있는 것을 먼저 봅니다.  ($OS_NAME 알아봤습니다)"
say ""

# ── Claude Code ──
CLAUDE=$(command -v claude 2>/dev/null || true)
if [ -z "$CLAUDE" ] && [ -x "$HOME/.local/bin/claude" ]; then CLAUDE="$HOME/.local/bin/claude"; fi
if [ -z "$CLAUDE" ]; then
  say "  ✗ Claude Code   못 찾음"
  say "    Claude Code 를 먼저 깔아 주세요:  https://code.claude.com/docs/ko/setup"
  if [ "$OS" = "mac" ]; then
    say "    이미 깔았는데 못 찾는다면, 새 터미널을 열거나 ~/.zshrc 에 이 줄을 넣습니다:"
  else
    say "    이미 깔았는데 못 찾는다면, 새 터미널을 열거나 ~/.bashrc 에 이 줄을 넣습니다:"
  fi
  say '      export PATH="$HOME/.local/bin:$PATH"'
  say "    깐 뒤 이 설치를 다시 돌리면 됩니다.  (아무것도 바꾸지 않았습니다)"
  exit 1
fi

CV=$("$CLAUDE" --version 2>/dev/null | sed -n '1s/^[^0-9]*\([0-9][0-9.]*\).*/\1/p')
[ -n "$CV" ] || CV="0"

# 판 번호를 자리마다 수로 견준다: $1 >= $2 이면 0
at_least() {
  a=$1; b=$2
  while [ -n "$a" ] || [ -n "$b" ]; do
    x=${a%%.*}; y=${b%%.*}
    case "$a" in *.*) a=${a#*.} ;; *) a="" ;; esac
    case "$b" in *.*) b=${b#*.} ;; *) b="" ;; esac
    x=${x:-0}; y=${y:-0}
    if [ "$x" -gt "$y" ] 2>/dev/null; then return 0; fi
    if [ "$x" -lt "$y" ] 2>/dev/null; then return 1; fi
  done
  return 0
}

if ! at_least "$CV" "$MIN_VERSION"; then
  say "  ✗ Claude Code   $CV"
  say "    mod 는 $MIN_VERSION 부터 됩니다. 먼저 올려 주세요."
  say "      claude update"
  say "    올린 뒤 이 설치를 다시 돌리면 됩니다.  (아무것도 바꾸지 않았습니다)"
  exit 1
fi
say "  ✓ Claude Code   $CV     $MIN_VERSION 이상이면 됩니다"

# ── mod 기능이 켜져 있나: 빈 폴더에서 시험 명령의 말을 읽는다 ──
PROBE=$(mktemp -d "${TMPDIR:-/tmp}/copy-toast.XXXXXX" 2>/dev/null || echo "")
MODS="on"; MODS_WHY=""
if [ -n "$PROBE" ] && [ -d "$PROBE" ]; then
  OUT=$(cd "$PROBE" && "$CLAUDE" plugin test 2>&1 || true)
  rmdir "$PROBE" 2>/dev/null || true
  case "$OUT" in
    *"no hooks module to load"*) MODS="on" ;;
    *"turned off here"*) MODS="off"; MODS_WHY="내 설정이나 조직 설정" ;;
    *"saved off"*) MODS="off"; MODS_WHY="꺼진 스위치가 저장돼 있음" ;;
    *"turned off in this process"*) MODS="off"; MODS_WHY="원격 설정" ;;
    *) MODS="unknown" ;;
  esac
else
  MODS="unknown"
fi
case "$MODS" in
  on) say "  ✓ mod 기능      켜져 있음" ;;
  off) say "  ! mod 기능      꺼져 있음 ($MODS_WHY)" ;;
  *) say "  ? mod 기능      확인하지 못함" ;;
esac

# ── Node.js: 없어도 된다(폴더 열기 버튼만 안 붙는다) ──
NODE_V=$(node --version 2>/dev/null || true)
if [ -n "$NODE_V" ]; then say "  ✓ Node.js       $NODE_V"; else say "  – Node.js       없음        없어도 됩니다"; fi

say ""
say "  이 기계에서는 이렇게 갑니다"
say "    · 번호 붙이기 · [ Copy ] 버튼     됩니다"
if [ -n "$NODE_V" ]; then
  say "    · 📂 폴더 열기 버튼              붙습니다"
else
  say "    · 📂 폴더 열기 버튼              안 붙습니다"
  say "      (Node.js 가 있어야 합니다. 나중에 깔면 저절로 됩니다)"
fi

# ── 복사: 앞 버전이 있으면 그 위에 덮어쓴다(옵션은 Claude Code 가 따로 간직한다) ──
DEST="$HOME/.claude/skills/copy-toast"
KEPT=""
[ -d "$DEST" ] && KEPT=" (앞서 깔린 것 위에 덮어썼습니다. 옵션은 그대로입니다)"
mkdir -p "$DEST" || { say ""; say "  ✗ 폴더를 만들지 못했습니다: $DEST"; exit 1; }
if ! cp -R "$SRC/." "$DEST/"; then
  say ""; say "  ✗ 복사하지 못했습니다: $DEST"; exit 1
fi

say ""
say "  ✓ 복사했습니다$KEPT"
say "    $DEST"
if [ "$MODS" = "off" ]; then
  say ""
  say "  ! 지금은 mod 가 뜨지 않습니다 (mod 기능이 꺼져 있습니다: $MODS_WHY)."
  say "    조직 설정이면 관리자에게 「Claude Code 의 mod(hooks modules)」를 켜 달라고 요청하세요."
  say "    꺼진 스위치가 저장된 경우는 네트워크가 되는 터미널에서 claude 를 한 번 띄운 뒤 다시 확인합니다."
fi
if [ "$OS" = "mac" ]; then
  case "$HERE" in
    "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
      say ""
      say "  참고: 이 폴더는 Mac 이 접근을 묻는 자리(다운로드 · 데스크탑 · 문서)에 있습니다."
      say "        설치는 끝났으니 이 폴더는 지워도 됩니다." ;;
  esac
fi
say ""
say "다음  Claude Code 를 새로 열면 켜집니다."
say "      규칙 넣기와 옵션은 Claude 에게:  copy-toast 처음 설정 해 줘"
say ""
exit 0
