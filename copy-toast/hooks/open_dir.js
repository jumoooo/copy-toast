#!/usr/bin/env node
// open_dir.js — 폴더 또는 파일 하나를 그 기계의 파일 탐색기로 띄운다. copy-toast 의 열기 버튼(📂)이 부른다.
//   WSL·Windows: 먼저 열린 탐색기 창 목록을 open_focus.ps1 list 로 받아(탭마다 한 줄), 그 폴더를 보고 있는 창이 있으면 새로 띄우지 않고
//     open_focus.ps1 front 로 그 창을 앞으로 띄운다(파일이면 그 파일을 선택·포커스). 없으면 explorer.exe <폴더> 또는 explorer.exe /select, <파일>.
//     WSL 은 경로를 `wslpath -w` 로 Windows 꼴(\\wsl.localhost\… 또는 C:\…)로 바꾸고 /mnt/c 에서 돌린다(UNC 경고 회피). 사용자 요청 2026-10-29.
//   그 밖의 Linux: xdg-open <폴더>. macOS: open <폴더>. 파일이면 든 폴더를 연다.
//   explorer.exe 는 창이 떴어도 1 을 돌려주는 일이 있어 종료 코드를 성공 판정에 쓰지 않는다 — 못 띄운 것은 spawn 오류(ENOENT 등)로만 안다.
//   창 목록을 못 읽으면(PowerShell 실패·JSON 아님) 「열린 창 없음」으로 보고 새 창을 띄운다 — 결과 줄에 (새 창) 이 찍혀 무엇을 했는지는 드러난다.
//
// 사용: open_dir.js [--dry-run] <폴더 또는 파일 절대 경로> | --self-test
//   --dry-run 은 `would run: <명령…>` 한 줄만 찍고 끝낸다(PowerShell 도 부르지 않는다). 시험은 환경 변수 OPEN_DIR_FAKE_PLATFORM(win32·linux·wsl·darwin)으로 길을,
//   OPEN_DIR_FAKE_WINDOWS(JSON 배열 [{hwnd, path}])로 열린 창 목록을 흉내 낸다.
// 출력: 성공이면 stdout 에 한 줄 `opened: <경로> (<결과>)` — 결과는 앞으로 · 이미 열림(창은 있으나 올린 뒤에도 앞 창이 그 창이 아님) · 새 창,
//   파일이면 뒤에 「, 파일 선택」(선택했을 때만). xdg-open·open 길은 `opened: <연 폴더>`. 종료: 0 넘겼다 · 1 인자·경로 오류 · 2 명령 실패
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

/** 결과 낱말 — stdout 한 줄에 그대로 들어가고 copy-toast 가 toast 로 그대로 보인다(SKILL.md 「열기」 행과 같은 말) */
const SAID = { front: '앞으로', found: '이미 열림', fresh: '새 창', selected: '파일 선택' };
const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'];

function platform() {
  const fake = process.env.OPEN_DIR_FAKE_PLATFORM;
  if (fake) return fake;
  if (process.platform === 'win32') return 'win32';
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'linux' && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop') || fs.existsSync('/mnt/c/Windows')) return 'wsl';
  return process.platform;
}
/** 돌릴 명령 — 플랫폼마다 하나(새 창 길). wsl 은 wslpath 로 바꾼 경로(dry-run 에서는 그대로). 파일이면 Windows 는 /select, 로 그 파일을 선택한 채 연다.
 *  `/select,` 와 파일은 인자 둘로 준다 — 하나로 붙이면 빈칸 든 경로에서 인자 전체가 따옴표에 싸여 explorer 가 못 읽고 「문서」 폴더를 연다(2026-10-29 실물) */
function command(plat, dir, winPath, winFile) {
  const winArgs = winFile ? ['/select,', winFile] : [winPath];
  if (plat === 'win32') return { file: 'explorer.exe', args: winArgs, opts: { stdio: 'ignore' } };
  if (plat === 'wsl') return { file: 'explorer.exe', args: winArgs, opts: { stdio: 'ignore', cwd: winCwd() } };
  if (plat === 'darwin') return { file: 'open', args: [dir], opts: { stdio: 'ignore' } };
  return { file: 'xdg-open', args: [dir], opts: { stdio: 'ignore' } };
}
function winCwd() { return fs.existsSync('/mnt/c') ? '/mnt/c' : undefined; }
/** 탐색기 창의 경로를 견줄 꼴로 — 대소문자, 끝의 구분 문자, \\wsl$ 와 \\wsl.localhost 의 차이를 지운다 */
function norm(p) { return String(p).replace(/^\\\\wsl\$\\/i, '\\\\wsl.localhost\\').replace(/[\\/]+$/, '').toLowerCase(); }
/** 열린 창 목록 — 시험은 OPEN_DIR_FAKE_WINDOWS, dry-run 은 빈 목록, 실제는 open_focus.ps1 list. 못 읽으면 빈 목록 */
function openWindows(plat, ps1, dry) {
  let raw = process.env.OPEN_DIR_FAKE_WINDOWS;
  if (raw === undefined) {
    if (dry) return [];
    const r = spawnSync('powershell.exe', [...PS_ARGS, ps1, 'list'], { encoding: 'utf8', cwd: plat === 'wsl' ? winCwd() : undefined, timeout: 15000 });
    if (r.error || r.status !== 0) return [];
    raw = (r.stdout || '').trim() || '[]';
  }
  try { const v = JSON.parse(raw); return (Array.isArray(v) ? v : [v]).filter(w => w && typeof w.path === 'string' && w.hwnd !== undefined); } catch { return []; }
}
function main(args) {
  let dry = false, target = '';
  for (const a of args) {
    if (a === '--dry-run') dry = true;
    else if (a.startsWith('-') && !target) { process.stderr.write(`open_dir.js: 모르는 인자: ${a}\n`); process.exit(1); }
    else target = a;
  }
  if (!target) { process.stderr.write('open_dir.js: 폴더 경로가 없다\n'); process.exit(1); }
  if (!path.isAbsolute(target) && !/^[A-Za-z]:[\\/]/.test(target) && !/^\\\\/.test(target)) { process.stderr.write(`open_dir.js: 절대 경로여야 한다: ${target}\n`); process.exit(1); }
  const plat = platform();
  let isFile = false;
  try { isFile = fs.statSync(target).isFile(); } catch { isFile = false; }   // 못 물으면 폴더로 본다(종전 거동)
  const dir = isFile ? path.dirname(target) : target;
  if (plat !== 'win32' && plat !== 'wsl') {
    const c = command(plat, dir);
    if (dry) { process.stdout.write(`would run: ${c.file} ${c.args.join(' ')}\n`); process.exit(0); }
    const r = spawnSync(c.file, c.args, c.opts);
    if (r.error) { process.stderr.write(`open_dir.js: 명령 실패(${r.error.code}): ${c.file} ${c.args.join(' ')}\n`); process.exit(2); }
    if (r.status !== 0) { process.stderr.write(`open_dir.js: 명령 실패(종료 ${r.status}): ${c.file} ${c.args.join(' ')}\n`); process.exit(2); }
    process.stdout.write(`opened: ${dir}\n`);
    process.exit(0);
  }
  // Windows 탐색기 길 — 경로 셋(폴더 · 파일 · open_focus.ps1)을 Windows 꼴로
  let winDir = dir, winFile = isFile ? target : '', ps1 = path.join(__dirname, 'open_focus.ps1');
  if (plat === 'wsl' && !dry) {
    try {
      const w = p => execFileSync('wslpath', ['-w', p], { encoding: 'utf8' }).trim();
      winDir = w(dir); if (isFile) winFile = w(target); ps1 = w(ps1);
    } catch (e) { process.stderr.write(`open_dir.js: wslpath 실패: ${target}\n`); process.exit(1); }
  }
  const want = norm(winDir);
  const hit = openWindows(plat, ps1, dry).find(w => norm(w.path) === want);
  if (hit) {
    const args = [...PS_ARGS, ps1, 'front', String(hit.hwnd), hit.path, ...(isFile ? [winFile] : [])];
    if (dry) { process.stdout.write(`would run: powershell.exe ${args.join(' ')}\n`); process.exit(0); }
    const r = spawnSync('powershell.exe', args, { encoding: 'utf8', cwd: plat === 'wsl' ? winCwd() : undefined, timeout: 15000 });
    const out = r.error ? '' : (r.stdout || '');
    if (/^(front|found)$/m.test(out)) {
      const said = [/^front$/m.test(out) ? SAID.front : SAID.found];
      if (isFile && /^selected$/m.test(out)) said.push(SAID.selected);
      process.stdout.write(`opened: ${target} (${said.join(', ')})\n`);
      process.exit(0);
    }
    // 그 창이 사이에 닫혔다 — 새 창으로
  }
  const c = command(plat, dir, winDir, winFile);
  if (dry) { process.stdout.write(`would run: ${c.file} ${c.args.join(' ')}\n`); process.exit(0); }
  const r = spawnSync(c.file, c.args, c.opts);
  if (r.error) { process.stderr.write(`open_dir.js: 명령 실패(${r.error.code}): ${c.file} ${c.args.join(' ')}\n`); process.exit(2); }
  process.stdout.write(`opened: ${target} (${isFile ? `${SAID.fresh}, ${SAID.selected}` : SAID.fresh})\n`);
  process.exit(0);
}
function selfTest() {
  let pass = 0, fail = 0;
  const t = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else { fail++; console.log(`  ❌ ${name}\n     기대: ${w}\n     실제: ${g}`); } };
  const run = (args, plat, more = {}) => { const r = spawnSync(process.execPath, [__filename, ...args], { encoding: 'utf8', env: Object.assign({}, process.env, { OPEN_DIR_FAKE_PLATFORM: plat }, more) }); return [r.status, r.stdout, r.stderr]; };
  const WP = 'C:\\Users\\x\\a b&c';
  t('Windows — explorer.exe <경로>', run(['--dry-run', WP], 'win32'), [0, `would run: explorer.exe ${WP}\n`, '']);
  t('WSL — explorer.exe (dry-run 은 경로 그대로)', run(['--dry-run', '/home/x/y'], 'wsl'), [0, 'would run: explorer.exe /home/x/y\n', '']);
  t('Linux — xdg-open', run(['--dry-run', '/home/x/y'], 'linux'), [0, 'would run: xdg-open /home/x/y\n', '']);
  t('macOS — open', run(['--dry-run', '/Users/x'], 'darwin'), [0, 'would run: open /Users/x\n', '']);
  t('경로 없음 — 종료 1', run(['--dry-run'], 'linux'), [1, '', 'open_dir.js: 폴더 경로가 없다\n']);
  t('상대 경로 — 종료 1', run(['--dry-run', 'rel/x'], 'linux'), [1, '', 'open_dir.js: 절대 경로여야 한다: rel/x\n']);
  t('모르는 인자 — 종료 1', run(['--zz', '/x'], 'linux'), [1, '', 'open_dir.js: 모르는 인자: --zz\n']);
  // 실제 spawn 실패 — PATH 를 빈 폴더로 두고 Linux 길(xdg-open)을 돌리면 ENOENT 로 종료 2
  const os = require('os');
  const noBin = fs.mkdtempSync(path.join(os.tmpdir(), 'open_dir-nobin-'));
  try {
    const r = spawnSync(process.execPath, [__filename, '/tmp'], { encoding: 'utf8', env: Object.assign({}, process.env, { OPEN_DIR_FAKE_PLATFORM: 'linux', PATH: noBin }) });
    t('명령을 못 찾으면 종료 2', [r.status, r.stdout], [2, '']);
    t('  └ stderr 에 ENOENT 와 명령', /명령 실패\(ENOENT\): xdg-open \/tmp/.test(r.stderr), true);
  } finally { fs.rmSync(noBin, { recursive: true, force: true }); }

  // 파일이면 든 폴더를 열고 그 파일을 선택한다 · 그 폴더 창이 이미 열려 있으면 새로 띄우지 않고 앞으로(사용자 요청 2026-10-29)
  const box = fs.mkdtempSync(path.join(os.tmpdir(), 'open_dir-box-'));
  const file = path.join(box, 'a b.txt');
  fs.writeFileSync(file, 'x');
  const PS1 = path.join(__dirname, 'open_focus.ps1');
  const PSRUN = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${PS1}`;
  try {
    t('Windows 파일 — 창이 없으면 explorer.exe /select, <파일>(인자 둘)', run(['--dry-run', file], 'win32'), [0, `would run: explorer.exe /select, ${file}\n`, '']);
    t('WSL 파일 — 창이 없으면 explorer.exe /select, <파일>(인자 둘)', run(['--dry-run', file], 'wsl'), [0, `would run: explorer.exe /select, ${file}\n`, '']);
    t('WSL 폴더 — 같은 폴더 창이 있으면(대소문자·끝의 구분 문자 무시) 그 창을 앞으로', run(['--dry-run', box], 'wsl', { OPEN_DIR_FAKE_WINDOWS: JSON.stringify([{ hwnd: 3, path: 'C:\\other' }, { hwnd: 7, path: box.toUpperCase() + '/' }]) }), [0, `would run: ${PSRUN} front 7 ${box.toUpperCase()}/\n`, '']);
    t('WSL 파일 — 같은 폴더 창이 있으면 그 창을 앞으로 + 파일 선택', run(['--dry-run', file], 'wsl', { OPEN_DIR_FAKE_WINDOWS: JSON.stringify([{ hwnd: 7, path: box }]) }), [0, `would run: ${PSRUN} front 7 ${box} ${file}\n`, '']);
    t('Windows — \\\\wsl$ 와 \\\\wsl.localhost 는 같은 폴더', run(['--dry-run', '\\\\wsl.localhost\\U\\home\\x'], 'win32', { OPEN_DIR_FAKE_WINDOWS: JSON.stringify([{ hwnd: 9, path: '\\\\wsl$\\U\\home\\x\\' }]) }), [0, `would run: ${PSRUN} front 9 \\\\wsl$\\U\\home\\x\\\n`, '']);
    t('Windows 폴더 — 다른 폴더 창만 있으면 새 창', run(['--dry-run', WP], 'win32', { OPEN_DIR_FAKE_WINDOWS: JSON.stringify([{ hwnd: 7, path: 'C:\\Users\\x\\a b' }]) }), [0, `would run: explorer.exe ${WP}\n`, '']);
    t('Linux 파일 — xdg-open <든 폴더>', run(['--dry-run', file], 'linux'), [0, `would run: xdg-open ${box}\n`, '']);
    t('macOS 파일 — open <든 폴더>', run(['--dry-run', file], 'darwin'), [0, `would run: open ${box}\n`, '']);

    // 실제로 돌린다 — PATH 에 가짜 explorer.exe·powershell.exe 만 두고(진짜 창은 안 뜬다) 받은 인자와 stdout 의 결과 한 줄을 본다
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'open_dir-bin-'));
    const log = path.join(bin, 'log');
    fs.writeFileSync(path.join(bin, 'explorer.exe'), '#!/bin/sh\nprintf \'%s\\n\' explorer.exe "$@" >> "$OPEN_DIR_TEST_LOG"\nexit 1\n', { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'powershell.exe'), '#!/bin/sh\nprintf \'%s\\n\' powershell.exe "$@" >> "$OPEN_DIR_TEST_LOG"\nif [ "$7" = list ]; then printf \'%s\' "$FAKE_PS_LIST"; else printf \'%s\' "$FAKE_PS_FRONT"; fi\n', { mode: 0o755 });
    const live = (target, list, front) => {
      fs.rmSync(log, { force: true });
      const r = spawnSync(process.execPath, [__filename, target], { encoding: 'utf8', env: Object.assign({}, process.env, { OPEN_DIR_FAKE_PLATFORM: 'win32', PATH: bin, OPEN_DIR_TEST_LOG: log, FAKE_PS_LIST: list, FAKE_PS_FRONT: front }) });
      const got = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
      return [r.status, r.stdout, got.filter(l => /^(explorer|powershell)\.exe$|^\/select,|^(list|front)$/.test(l) || l === target)];
    };
    const LIST = JSON.stringify([{ hwnd: 42, path: box }]);
    t('창 없음 · 폴더 — explorer.exe <폴더> 를 돌리고 (새 창). explorer 종료 1 은 실패가 아니다', live(box, '[]', ''), [0, `opened: ${box} (새 창)\n`, ['powershell.exe', 'list', 'explorer.exe', box]]);
    t('창 없음 · 파일 — explorer.exe 에 /select, 와 <파일> 을 인자 둘로 주고 (새 창, 파일 선택)', live(file, '[]', ''), [0, `opened: ${file} (새 창, 파일 선택)\n`, ['powershell.exe', 'list', 'explorer.exe', '/select,', file]]);
    t('창 있음 · 폴더 — explorer 를 안 돌리고 (앞으로)', live(box, LIST, 'front\n'), [0, `opened: ${box} (앞으로)\n`, ['powershell.exe', 'list', 'powershell.exe', 'front', box]]);
    t('창 있음 · 파일 — 그 창에서 선택하고 (앞으로, 파일 선택)', live(file, LIST, 'front\nselected\n'), [0, `opened: ${file} (앞으로, 파일 선택)\n`, ['powershell.exe', 'list', 'powershell.exe', 'front', file]]);
    t('창 있음 · 파일인데 그 창에서 못 찾음 — 파일 선택이라 말하지 않는다', live(file, LIST, 'front\n'), [0, `opened: ${file} (앞으로)\n`, ['powershell.exe', 'list', 'powershell.exe', 'front', file]]);
    t('창 있음 · 앞으로 못 띄움 — (이미 열림)', live(box, LIST, 'found\n'), [0, `opened: ${box} (이미 열림)\n`, ['powershell.exe', 'list', 'powershell.exe', 'front', box]]);
    t('창이 사이에 닫힘(front 가 아무것도 못 찾음) — 새 창으로 넘어간다', live(file, LIST, ''), [0, `opened: ${file} (새 창, 파일 선택)\n`, ['powershell.exe', 'list', 'powershell.exe', 'front', file, 'explorer.exe', '/select,', file]]);
    t('창 목록을 못 읽음(JSON 아님) — 새 창', live(box, 'oops', ''), [0, `opened: ${box} (새 창)\n`, ['powershell.exe', 'list', 'explorer.exe', box]]);
    fs.rmSync(bin, { recursive: true, force: true });
  } finally { fs.rmSync(box, { recursive: true, force: true }); }
  console.log(`open_dir.js 검사: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
if (process.argv[2] === '--self-test') selfTest(); else main(process.argv.slice(2));
