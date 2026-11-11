# 이 파일은 Windows 용입니다. 보통은 압축 맨 위의 install-windows.cmd 를 두 번 눌러 돌립니다.
# Mac · Linux · WSL 이라면 터미널에서:  sh install-mac-linux.sh
#
# 하는 일: 이 기계에 있는 것을 확인하고, copy-toast 폴더를 %USERPROFILE%\.claude\skills\ 아래로 복사합니다. 아무것도 묻지 않습니다.
#          내 설정 글(%USERPROFILE%\.claude\CLAUDE.md)은 건드리지 않습니다.
# 지우려면: %USERPROFILE%\.claude\skills\copy-toast 폴더를 지웁니다.

$ErrorActionPreference = 'Continue'
$MinVersion = '2.1.292'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Say([string]$text = '') { Write-Host $text }

$Src = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Version = '?'
$manifest = Join-Path $Src '.claude-plugin\plugin.json'
if (Test-Path $manifest) { if ([System.IO.File]::ReadAllText($manifest) -match '"version"\s*:\s*"([^"]+)"') { $Version = $Matches[1] } }

Say
Say "copy-toast $Version — 설치"
Say

# PowerShell 7 은 Mac · Linux 에서도 돈다. 그 경우 알려 주고 멈춘다.
if ($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows) {
  Say '  이 기계는 Windows 가 아닙니다.'
  Say '  터미널에서:  sh install-mac-linux.sh'
  Say '  (아무것도 바꾸지 않았습니다)'
  exit 3
}

if (-not (Test-Path (Join-Path $Src 'SKILL.md'))) {
  Say "  ✗ copy-toast 폴더를 찾지 못했습니다: $Src"
  Say '    압축을 푼 폴더 안에서 돌려 주세요.'
  exit 1
}

Say '이 기계에 있는 것을 먼저 봅니다.  (Windows 로 알아봤습니다)'
Say

# ── Claude Code ──
$claude = $null
$cmd = Get-Command claude -ErrorAction SilentlyContinue
if ($cmd) { $claude = $cmd.Source }
if (-not $claude) {
  $guess = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
  if (Test-Path $guess) { $claude = $guess }
}
if (-not $claude) {
  Say '  ✗ Claude Code   못 찾음'
  Say '    Claude Code 를 먼저 깔아 주세요:  https://code.claude.com/docs/ko/setup'
  Say '    이미 깔았는데 못 찾는다면 새 창(PowerShell)을 열어 다시 돌려 보세요.'
  Say '    깐 뒤 이 설치를 다시 돌리면 됩니다.  (아무것도 바꾸지 않았습니다)'
  exit 1
}

# 다른 프로그램의 출력은 cmd 를 거쳐 받는다(PowerShell 5.1 은 오류 출력을 예외로 바꾼다)
function Run-Text([string]$commandLine) {
  $out = & cmd.exe /d /c "$commandLine 2>&1"
  return @{ Text = ($out -join "`n"); Code = $LASTEXITCODE }
}

$cv = '0'
$r = Run-Text "`"$claude`" --version"
if ($r.Text -match '(\d+(\.\d+)+)') { $cv = $Matches[1] }

function At-Least([string]$a, [string]$b) {
  $x = $a.Split('.'); $y = $b.Split('.')
  $n = [Math]::Max($x.Length, $y.Length)
  for ($i = 0; $i -lt $n; $i++) {
    $p = 0; $q = 0
    if ($i -lt $x.Length) { [void][int]::TryParse($x[$i], [ref]$p) }
    if ($i -lt $y.Length) { [void][int]::TryParse($y[$i], [ref]$q) }
    if ($p -gt $q) { return $true }
    if ($p -lt $q) { return $false }
  }
  return $true
}

if (-not (At-Least $cv $MinVersion)) {
  Say "  ✗ Claude Code   $cv"
  Say "    mod 는 $MinVersion 부터 됩니다. 먼저 올려 주세요."
  Say '      claude update'
  Say '    올린 뒤 이 설치를 다시 돌리면 됩니다.  (아무것도 바꾸지 않았습니다)'
  exit 1
}
Say "  ✓ Claude Code   $cv     $MinVersion 이상이면 됩니다"

# ── mod 기능이 켜져 있나: 빈 폴더에서 시험 명령의 말을 읽는다 ──
$mods = 'unknown'; $modsWhy = ''
$probe = Join-Path $env:TEMP ('copy-toast-' + [guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path $probe -ErrorAction Stop | Out-Null
  Push-Location $probe
  $t = (Run-Text "`"$claude`" plugin test").Text
  Pop-Location
  Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
  if ($t -match 'no hooks module to load') { $mods = 'on' }
  elseif ($t -match 'turned off here') { $mods = 'off'; $modsWhy = '내 설정이나 조직 설정' }
  elseif ($t -match 'saved off') { $mods = 'off'; $modsWhy = '꺼진 스위치가 저장돼 있음' }
  elseif ($t -match 'turned off in this process') { $mods = 'off'; $modsWhy = '원격 설정' }
} catch { $mods = 'unknown' }
switch ($mods) {
  'on' { Say '  ✓ mod 기능      켜져 있음' }
  'off' { Say "  ! mod 기능      꺼져 있음 ($modsWhy)" }
  default { Say '  ? mod 기능      확인하지 못함' }
}

# ── Node.js: 없어도 된다(폴더 열기 버튼만 안 붙는다) ──
$nodeV = ''
if (Get-Command node -ErrorAction SilentlyContinue) { $nodeV = (Run-Text 'node --version').Text.Trim() }
if ($nodeV) { Say "  ✓ Node.js       $nodeV" } else { Say '  – Node.js       없음        없어도 됩니다' }

Say
Say '  이 기계에서는 이렇게 갑니다'
Say '    · 번호 붙이기 · [ Copy ] 버튼     됩니다'
if ($nodeV) {
  Say '    · 📂 폴더 열기 버튼              붙습니다'
} else {
  Say '    · 📂 폴더 열기 버튼              안 붙습니다'
  Say '      (Node.js 가 있어야 합니다. 나중에 깔면 저절로 됩니다)'
}

# ── 복사: 앞 버전이 있으면 그 위에 덮어쓴다(옵션은 Claude Code 가 따로 간직한다) ──
$dest = Join-Path $env:USERPROFILE '.claude\skills\copy-toast'
$kept = ''
if (Test-Path $dest) { $kept = ' (앞서 깔린 것 위에 덮어썼습니다. 옵션은 그대로입니다)' }
try {
  New-Item -ItemType Directory -Path $dest -Force -ErrorAction Stop | Out-Null
  Copy-Item -Path (Join-Path $Src '*') -Destination $dest -Recurse -Force -ErrorAction Stop
} catch {
  Say
  Say "  ✗ 복사하지 못했습니다: $dest"
  Say "    $($_.Exception.Message)"
  exit 1
}

Say
Say "  ✓ 복사했습니다$kept"
Say "    $dest"
if ($mods -eq 'off') {
  Say
  Say "  ! 지금은 mod 가 뜨지 않습니다 (mod 기능이 꺼져 있습니다: $modsWhy)."
  Say '    조직 설정이면 관리자에게 「Claude Code 의 mod(hooks modules)」를 켜 달라고 요청하세요.'
  Say '    꺼진 스위치가 저장된 경우는 네트워크가 되는 창에서 claude 를 한 번 띄운 뒤 다시 확인합니다.'
}
Say
Say '다음  Claude Code 를 새로 열면 켜집니다.'
Say '      규칙 넣기와 옵션은 Claude 에게:  copy-toast 처음 설정 해 줘'
Say
exit 0
