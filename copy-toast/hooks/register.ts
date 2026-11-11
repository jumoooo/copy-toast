// copy-toast — Claude 의 답변에 복사할 코드 블록이 있으면 (1) 답변의 블록 위에 「▸ 복사 N」 번호를 그리고
// (2) 프롬프트 위 오른쪽에 항목마다 토스트 한 장을 쌓는다(오른쪽에서 밀려 들어온다). [ 복사하기 ] 를 누르면
// $.ui.copy 로 클립보드에 가고 그 장만 「복사 완료」 뒤 밀려 나간다. 다음 입력(prompt.submit)엔 남은 장이 다 나간다(사용자 요청).
// 항목이 디스크에 있는 경로면 복사 버튼 왼쪽에 [📂] — 누르면 그 폴더(파일이면 든 폴더를 그 파일을 선택한 채)를 탐색기로 띄운다. 같은 폴더 창이 이미 열려 있으면 그 창을 앞으로(locate.ts · open_dir.js, 사용자 요청 2026-10-27·10-29).
// 무엇이 복사할 것인지는 답을 쓰는 모델이 정한다 — 시스템 프롬프트 끝에 규칙 절(RULE)을 붙여, 붙여 넣을 것은 표기 있는 블록에 넣게 한다.
import type { EngineInterface, Register, Timer } from 'claude-code'
import { DONE_HOLD_MS, FRAME_MS, IN_FRAMES, OUT_FRAMES, STAGGER, countFences, drawToasts, extractItems, numberFences, strings, type CopyItem, type Strings, type TB } from './toast'
import { colorsOf, modeOf, type Mode } from './ui'
import { isWindowsCwd, locateItems } from './locate'

/** 사람이 있는 세션인가 — session.start 가 말해 주면 그 값, 아니면(/reload-plugins 로 도중에 붙은 경우) 그리는 화면이 하나라도 있는지로 본다. claude -p 는 화면이 없다 */
let interactive: boolean | null = null
let mode: Mode | null = null
/** Windows 에서 도는 세션인가 — session.start 의 cwd 로, 없으면(도중에 붙음) $.session.cwd() 로 한 번 잰다 */
let onWindows: boolean | null = null
/** 장마다 몇 번째 그림인지(음수면 아직 차례 전) — 그림 수는 상태가 아니라 모듈 변수. 리로드에 잃어도 다음 그림부터 이어진다 */
let frames: Record<number, number> = {}
let ticker: Timer | null = null
const holds: Record<number, Timer> = {}

async function live($: EngineInterface): Promise<boolean> {
  if (interactive !== null) return interactive
  try { return (await $.session.surfaces()).length > 0 } catch { return false }
}
async function windows($: EngineInterface): Promise<boolean> {
  if (onWindows !== null) return onWindows
  try { onWindows = isWindowsCwd(await $.session.cwd()) } catch { onWindows = false }
  return onWindows
}
async function theme($: EngineInterface): Promise<Mode> {
  if (mode !== null) return mode
  try { const row = (await $.config.list()).find(r => r.key === 'theme'); mode = modeOf(typeof row?.value === 'string' ? row.value : undefined) } catch { mode = 'dark' }
  return mode
}
function stopAll(): void {
  if (ticker !== null) { ticker.cancel(); ticker = null }
  for (const k of Object.keys(holds)) { holds[Number(k)]?.cancel(); delete holds[Number(k)] }
}
async function getItems($: EngineInterface): Promise<CopyItem[]> { return (await $.state.get({ plugin: 'copy-toast', key: 'items' } as const)).value ?? [] }
async function setItems($: EngineInterface, items: CopyItem[]): Promise<void> { await $.state.set({ plugin: 'copy-toast', key: 'items' } as const, items); $.ui.invalidate('ui.render') }

/** 움직이는 장이 있는 동안 FRAME_MS 마다 한 그림 — in 이 다 들어오면 show, out 이 다 나가면 그 장을 뺀다 */
function ensureTicker($: EngineInterface): void {
  if (ticker !== null) return
  ticker = $.clock.every(FRAME_MS, () => { void tick($) })
}
async function tick($: EngineInterface): Promise<void> {
  const items = await getItems($)
  let changed = false
  const next: CopyItem[] = []
  for (const it of items) {
    if (it.phase !== 'in' && it.phase !== 'out') { next.push(it); continue }
    frames[it.n] = (frames[it.n] ?? 0) + 1
    if (it.phase === 'in' && frames[it.n]! >= IN_FRAMES - 1) { next.push({ ...it, phase: 'show' }); changed = true }
    else if (it.phase === 'out' && frames[it.n]! >= OUT_FRAMES) { changed = true; delete frames[it.n] }   // 다 나갔다 — 뺀다
    else next.push(it)
  }
  if (!next.some(it => it.phase === 'in' || it.phase === 'out') && ticker !== null) { ticker.cancel(); ticker = null }
  if (changed) await setItems($, next); else $.ui.invalidate('ui.render')
}
/** 장들을 밀어낸다 — n 을 주면 그 장만, 없으면 남은 장 전부 */
async function slideOut($: EngineInterface, n?: number): Promise<void> {
  const items = await getItems($)
  const next = items.map(it => ((n === undefined || it.n === n) && it.phase !== 'out' ? { ...it, phase: 'out' as const } : it))
  for (const it of next) if (it.phase === 'out' && (n === undefined || it.n === n)) frames[it.n] = 0
  if (next.some(it => it.phase === 'out')) { await setItems($, next); ensureTicker($) }
}
async function copyItem($: EngineInterface, n: number, surface: unknown, s: Strings): Promise<void> {
  const items = await getItems($)
  const it = items.find(x => x.n === n)
  if (!it || it.phase !== 'show') return
  const r = await $.ui.copy(surface ? { text: it.text, surface: surface as 'terminal' } : { text: it.text })
  if (!r.isCopied) { $.ui.toast(s.fail(r.reason)); return }
  await setItems($, items.map(x => (x.n === n ? { ...x, phase: 'done' as const } : x)))
  holds[n]?.cancel()
  holds[n] = $.clock.after(DONE_HOLD_MS, () => { delete holds[n]; void slideOut($, n) })
}
/** 열기 — 그 항목의 폴더(파일이면 그 파일)를 이 mod 의 open_dir.js 로 탐색기에 띄운다(WSL 은 \\wsl.localhost 로, Windows 는 그대로). 장은 그대로 둔다 — 복사도 이어서 할 수 있다.
 * 열었으면 open_dir.js 가 찍은 결과 한 줄(앞으로 · 이미 열림 · 새 창 · 파일 선택)을, 못 열면 이유를 toast 로 */
async function openItem($: EngineInterface, n: number, s: Strings): Promise<void> {
  const it = (await getItems($)).find(x => x.n === n)
  if (!it || it.phase !== 'show' || it.dir === undefined) return
  try {
    const r = await $.process.run(['node', `${$.plugin.root}/hooks/open_dir.js`, it.file ?? it.dir], { timeoutMs: 20000 })
    if (r.exitCode !== 0) $.ui.toast(s.openFail((r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 80) ?? `exit ${r.exitCode}`))
    else { const said = r.stdout.trim().split('\n').pop(); if (said) $.ui.toast(said) }
  } catch (e) { $.ui.toast(s.openFail(e instanceof Error ? e.message.slice(0, 80) : String(e))) }
}

/** 답을 쓰는 모델에게 주는 규칙 절 — 모델이 읽으므로 영문. 이 표기의 블록만 복사 항목이 된다(toast.ts 의 SHELL·PER_LINE·그 밖의 말) */
const RULE = { id: 'copy-toast', scope: 'session' as const, text: [
  'Anything the user is meant to paste or open as-is (a shell command, a slash command to type at this prompt, a file path, a URL, a config value or snippet) goes in a fenced block with a language tag: bash, powershell, json, yaml, path, url or copy.',
  'In bash, path, url and copy blocks, put one item per line.',
  'Names you merely mention (a function, a file, a flag) stay in inline backticks.',
  'A block that only shows something (output, a screen, an example) uses an untagged fence or `text`.',
].join('\n') }

/** 옵션(plugin.json 의 userConfig) — language: 화면 글 ko/en · colors: theme/palette. 바뀌면 엔진이 register 를 다시 부른다 */
export const register: Register = (on, options) => {
  const s = strings(options.language)
  const colors = colorsOf(options.colors)
  on('session.start', async ($, e, next) => {
    interactive = e.isInteractive
    mode = null
    onWindows = isWindowsCwd(e.cwd)
    if (interactive) await theme($)
    return next(e)
  })
  on('session.end', ($, e, next) => { stopAll(); return next(e) })

  // 시스템 프롬프트 끝에 규칙 절 하나 — 사람 있는 세션에서만(claude -p 에는 띠가 없으니 규칙도 필요 없다). 엔진의 절은 그대로 두고 session 범위로 덧붙인다
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!(await live($))) return r
    return { ...r, sections: [...r.sections, RULE] }
  })

  // 답변이 끝났다 — 주 루프의 답만(서브에이전트 제외). 블록이 있으면 장마다 조금씩 늦게 밀려 들어온다. 없으면 남은 장을 거둔다
  on('turn.complete', async ($, e, next) => {
    if (e.agentId || e.reason !== 'answer' || !(await live($))) return next(e)
    const items = await locateItems($, extractItems(e.answer), await windows($))   // 경로 항목엔 열 폴더를 단다(디스크에 있을 때만)
    stopAll()
    frames = {}
    for (const it of items) frames[it.n] = -(it.n - 1) * STAGGER - 1
    await $.state.set({ plugin: 'copy-toast', key: 'answer' } as const, items.length ? e.answer : '')
    await setItems($, items)
    if (items.length) ensureTicker($)
    return next(e)
  })
  // 사용자가 다음 입력을 했다 — 남은 장이 다 밀려 나간다(번호는 답변에 남는다)
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer') await slideOut($)   // 배경 작업 알림·다른 세션의 글은 사용자의 입력이 아니다
    return next(e)
  })

  // 답변의 코드 블록 위에 「▸ 복사 N」(en 은 「▸ copy N」) — 그려지는 글만 바꾸고 저장된 메시지는 그대로
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary || !(await live($))) return next(e)
    const answer = (await $.state.get({ plugin: 'copy-toast', key: 'answer' } as const)).value ?? ''
    const text = e.props.text
    if (!answer || !text || !answer.includes(text)) return next(e)
    const prior = answer.slice(0, answer.indexOf(text))
    const numbered = numberFences(text, countFences(prior) + 1, s, prior)   // 앞 토막과 같은 파일인 항목은 앞 번호(같은 파일은 한 장)
    if (numbered === text) return next(e)
    return next({ ...e, props: { ...e.props, text: numbered } })
  })

  // 프롬프트 위 토스트 더미 — 다른 플러그인의 띠 위에 얹는다(덮지 않는다)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await live($))) return next(e)
    const items = await getItems($)
    if (!items.length) return next(e)
    const t = $.ui.resolve(e) as unknown as TB
    const toasts = drawToasts(t, items, { bodyColumns: e.props.bodyColumns, mode: await theme($), colors, s, frames, onCopy: (n, surface) => { void copyItem($, n, surface, s) }, onOpen: n => { void openItem($, n, s) } })
    const rest = await next(e)
    return t.Box({ flexDirection: 'column', children: rest ? [toasts, rest] : [toasts] })
  })
}
