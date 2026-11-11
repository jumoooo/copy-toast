# open_focus.ps1 — copy-toast 열기 버튼(open_dir.js)의 Windows 쪽. 열린 탐색기 창을 COM(Shell.Application)으로 본다. 사용자 요청 2026-10-29.
#   list                          열린 탐색기 창을 탭마다 하나씩 JSON 배열 [{"hwnd":…,"path":"…"}] 로 찍는다. 폴더를 보는 탭만 — 경로가 없는 화면(내 PC 등)은 뺀다.
#   front <hwnd> <path> [<파일>]  hwnd 와 path 가 둘 다 같은 탭을 찾아 그 창을 앞으로 띄우고 front 를 찍는다. Windows 가 앞으로 못 띄우게 막으면 found.
#                                 파일을 주면 그 탭에서 그 파일을 선택·포커스하고(SelectItem 29 = 선택 + 나머지 해제 + 보이게 + 포커스) selected 를 찍는다.
#                                 그 탭이 사이에 닫혔으면 아무것도 찍지 않는다 — open_dir.js 가 새 창으로 넘어간다.
# 인자는 명령 줄로만 받는다(스크립트 글에 끼워 넣지 않는다). 출력은 UTF-8 — 한글 경로가 깨지지 않게. 이 파일은 BOM 이 있는 UTF-8 이다(Windows PowerShell 5.1 이 한글 주석을 바로 읽게).
param([string]$Mode = '', [string]$Hwnd = '', [string]$Path = '', [string]$File = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$shell = New-Object -ComObject Shell.Application

# 탐색기 탭 목록 — 창 하나에 탭이 여럿이면 같은 hwnd 로 여러 줄이 나온다
function Get-Tabs {
  foreach ($w in @($shell.Windows())) {
    try { $p = [string]$w.Document.Folder.Self.Path; $h = [int64]$w.HWND } catch { continue }
    if ($p) { [pscustomobject]@{ hwnd = $h; path = $p; win = $w } }
  }
}

if ($Mode -eq 'list') {
  $rows = @(Get-Tabs | ForEach-Object { [pscustomobject]@{ hwnd = $_.hwnd; path = $_.path } })
  ConvertTo-Json -InputObject $rows -Compress
  exit 0
}

if ($Mode -eq 'front') {
  $tab = Get-Tabs | Where-Object { $_.hwnd -eq [int64]$Hwnd -and $_.path -eq $Path } | Select-Object -First 1
  if (-not $tab) { exit 0 }
  Add-Type -Namespace OpenFocus -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
'@
  $h = [IntPtr]$tab.hwnd
  if ([OpenFocus.Win]::IsIconic($h)) { [void][OpenFocus.Win]::ShowWindow($h, 9) }   # 9 = SW_RESTORE(최소화돼 있으면 되살린다)
  [void][OpenFocus.Win]::SetForegroundWindow($h)
  if ([OpenFocus.Win]::GetForegroundWindow() -ne $h) {
    # Windows 는 앞에 있지 않은 프로세스가 창을 앞으로 올리는 것을 막는다 — Alt 를 한 번 눌렀다 떼면 그 막음이 풀린다
    [OpenFocus.Win]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [OpenFocus.Win]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    [void][OpenFocus.Win]::SetForegroundWindow($h)
  }
  if ([OpenFocus.Win]::GetForegroundWindow() -eq $h) { 'front' } else { 'found' }
  if ($File) {
    $doc = $tab.win.Document
    $item = $doc.Folder.ParseName([IO.Path]::GetFileName($File))
    if ($item) { $doc.SelectItem($item, 29); 'selected' }
  }
  exit 0
}

[Console]::Error.WriteLine("open_focus.ps1: 모르는 동작: $Mode")
exit 1
