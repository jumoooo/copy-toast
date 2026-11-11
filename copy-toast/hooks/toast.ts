// copy-toast — 답변에서 복사할 것(```코드 블록```)을 뽑고, 번호를 붙이고, 프롬프트 위에 항목마다 한 장씩 토스트를 그린다.
// 레이아웃은 엔진(Ink)에 맡긴다 — 테두리는 borderStyle, 미리보기는 wrap: truncate, 밀려 들어오는 것은 overflow: hidden 으로 자른다.
// 글자 폭을 우리가 세어 맞추던 판은 터미널이 「—」「…」 같은 애매한 폭 글자를 다르게 그려 줄이 어긋났다(사용자 요청).
import type { RenderElement } from 'claude-code'
import { cells, glyph, tone, type Colors, type Mode } from './ui'

/** 화면 글 — 옵션 `language`(ko/en, 기본 en). 번호 표시·버튼·완료 글·복사 실패 안내 */
export type Strings = { copy: string; button: string; done: string; fail: (reason: 'no-surface' | 'no-clipboard' | string | undefined) => string; openFail: (detail: string) => string }
const STRINGS: Record<'ko' | 'en', Strings> = {
  ko: { copy: '복사', button: '복사하기', done: '복사 완료', fail: r => `복사하지 못했습니다 — ${r === 'no-surface' ? '그리는 화면이 없음' : r === 'no-clipboard' ? '클립보드에 못 씀' : '거부됨'}`, openFail: d => `폴더를 못 열었습니다 — ${d}` },
  en: { copy: 'copy', button: 'Copy', done: 'Copied', fail: r => `Could not copy — ${r === 'no-surface' ? 'no surface to draw on' : r === 'no-clipboard' ? 'clipboard not writable' : 'refused'}`, openFail: d => `Could not open the folder — ${d}` },
}
export function strings(language: unknown): Strings { return language === 'ko' ? STRINGS.ko : STRINGS.en }

/** 토스트 한 장의 단계 — in: 오른쪽에서 밀려 들어오는 중 · show: 다 보임 · done: 「복사 완료」 · out: 밀려 나가는 중 */
export type Phase = 'in' | 'show' | 'done' | 'out'
/** dir: 열기 버튼이 띄울 폴더(이 기계의 경로) — 항목이 디스크에 있는 경로일 때만(locate.ts). 없으면 열기 버튼도 없다. file: 항목이 파일이면 그 파일(탐색기에서 선택한다) */
export type CopyItem = { n: number; text: string; head: string; phase: Phase; dir?: string; file?: string }

const FENCE = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n?^\1[ \t]*$/gm
/** 복사할 것으로 치는 블록의 말(info string 첫 낱말). 셸이면 문장마다 한 항목, 그 밖은 블록 하나가 한 항목 */
const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'console', 'powershell', 'ps', 'ps1', 'cmd', 'bat'])
/** 줄마다 한 항목인 말 — 파일 경로·URL·그대로 붙여 넣을 줄(슬래시 명령 등). 셸과 달리 줄을 잇지 않는다 */
const PER_LINE = new Set(['path', 'url', 'copy'])
/** 말이 없거나 이 말이면 복사할 것이 아니다 — 보여 주는 글(화면 본, 예시 문구, 그림)이다(사용자 요청 「사용자가 복사해야 하는 것만」) */
const SHOW_ONLY = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'md', 'markdown', 'output', 'log', 'tree', 'mermaid', 'ascii', 'art', 'none', 'diff'])
/** 미리보기 한 줄 — 애매한 폭 글자(—·…·따옴표)를 ASCII 로 바꿔 어느 터미널에서도 한 칸으로 그려지게 */
function previewOf(body: string): string {
  const first = body.split('\n').map(l => l.trim()).find(l => l) ?? ''
  return first.replace(/[—–]/g, '-').replace(/…/g, '...').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\t/g, ' ')
}
/** 셸 블록을 문장 단위로 — 줄 하나가 한 문장. 끝이 `\` 인 줄·heredoc(<<EOF … EOF)·들여쓴 줄은 앞 문장에 붙고, 빈 줄·주석만 있는 줄은 문장이 아니다 */
function shellStatements(lines: string[]): { text: string; lines: number[] }[] {
  const out: { text: string; lines: number[] }[] = []
  let cur: { text: string; lines: number[] } | null = null
  let heredoc: string | null = null
  const flush = (): void => { if (cur) out.push(cur); cur = null }
  lines.forEach((raw, i) => {
    const line = raw.replace(/^\$ /, '')   // console 식 프롬프트 표시는 뗀다
    if (heredoc !== null) { cur!.text += '\n' + raw; cur!.lines.push(i); if (raw.trim() === heredoc) heredoc = null; return }
    const joined = cur !== null && (/\\$/.test(cur.text) || /^\s/.test(raw))
    if (!line.trim() || (/^\s*#/.test(line) && !joined)) { if (!joined) flush(); return }
    if (joined) { cur!.text += '\n' + raw; cur!.lines.push(i) } else { flush(); cur = { text: line, lines: [i] } }
    const hd = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line)
    if (hd) heredoc = hd[1]!
  })
  flush()
  return out
}
/** path·url·copy 블록을 줄마다 — 빈 줄과 `#` 로 시작하는 주석 줄은 항목이 아니다. 끝의 `\`·들여쓰기로 잇지 않는다 */
function lineItems(lines: string[]): { text: string; lines: number[] }[] {
  const out: { text: string; lines: number[] }[] = []
  lines.forEach((raw, i) => { const l = raw.trim(); if (l && !l.startsWith('#')) out.push({ text: l, lines: [i] }) })
  return out
}
export type FencePlan = { lang: string; copy: boolean; split: boolean; items: { text: string; lines: number[] }[] }
/** 블록 하나를 어떻게 다룰지 — 말로 복사 여부를 가르고, 셸은 문장마다, path·url·copy 는 줄마다 나눈다 */
function planFence(info: string, body: string): FencePlan {
  const lang = (info.trim().split(/\s+/)[0] ?? '').toLowerCase()
  const trimmed = body.replace(/\s+$/, '')
  if (SHOW_ONLY.has(lang) || !trimmed.trim()) return { lang, copy: false, split: false, items: [] }
  if (SHELL.has(lang) || PER_LINE.has(lang)) {
    const items = SHELL.has(lang) ? shellStatements(trimmed.split('\n')) : lineItems(trimmed.split('\n'))
    return { lang, copy: items.length > 0, split: items.length > 1, items }
  }
  return { lang, copy: true, split: false, items: [{ text: trimmed, lines: [] }] }
}
/** 경로 꼴인가 — /… · ~ · ~/… · C:\… · \\… · file://… 로 시작하는 한 줄. 그 밖의 URL(스킴:)·셸 문장(명령 이름으로 시작)은 아니다. 빈칸이 든 경로도 경로다 — 있는지는 디스크가 답한다 */
const SHAPE = /^(?:~(?=$|[\\/])|\/|[A-Za-z]:[\\/]|\\\\|file:\/\/)/i
export function isPathShaped(text: string): boolean { return SHAPE.test(text) }

/** file:// 주소를 경로 꼴로 — 퍼센트 꼴(%20·한글)을 풀고, 드라이브 글자면 C:\…, 호스트가 있으면 \\호스트\…(wsl.localhost 도), 그 밖은 /…. 주소가 아니면 글 그대로, 못 풀면 null */
export function fromFileUrl(text: string): string | null {
  const m = /^file:\/\/([^/]*)(\/[^?#]*)?(?:[?#].*)?$/i.exec(text.trim())
  if (!m) return text
  let path: string
  try { path = decodeURIComponent(m[2] ?? '/') } catch { return null }
  const host = m[1]!
  if (host && host.toLowerCase() !== 'localhost') return `\\\\${host}${path.replace(/\//g, '\\')}`
  const d = /^\/([A-Za-z]:)(\/.*)?$/.exec(path)
  if (d) return `${d[1]}${(d[2] ?? '/').replace(/\//g, '\\')}`
  return path
}

/** 디스크에 묻지 않고 같은 자리인지 견줄 글 — file:// 주소는 퍼센트 꼴을 풀고, C:\… 는 /mnt/c/…, \\wsl.localhost\<배포판>\… 는 /…, 구분 문자는 / 하나로, 끝의 / 는 뗀다.
 * 드라이브 쪽(/mnt/<글자>/…)은 Windows 처럼 대소문자를 가리지 않는다. 경로 꼴이 아니거나 못 풀면 undefined — 그런 항목은 합치지 않는다.
 * ~ 는 펼치지 않는다(홈을 모른다) — ~/… 와 /home/… 이 같은 자리인지는 디스크에 물은 뒤(locate.ts)에야 안다 */
export function pathKey(text: string): string | undefined {
  const t = text.trim()
  if (!isPathShaped(t)) return undefined
  const u = fromFileUrl(t)
  if (u === null) return undefined
  let p = u.replace(/\\/g, '/')
  const wsl = /^\/\/wsl(?:\.localhost|\$)\/[^/]+(\/.*)?$/i.exec(p)
  if (wsl) p = wsl[1] ?? '/'
  const d = /^([A-Za-z]):(?:\/(.*))?$/.exec(p)
  if (d) p = `/mnt/${d[1]}/${d[2] ?? ''}`
  p = p.replace(/(?<!^)\/{2,}/g, '/').replace(/(.)\/+$/, '$1')
  return /^\/mnt\/[A-Za-z](?:\/|$)/.test(p) ? p.toLowerCase() : p
}
/** Windows 쪽 경로 꼴 — 드라이브 글자(C:\…) 또는 \\…(\\wsl.localhost\… 등). 합친 줄은 이 꼴의 글을 보인다 */
const WIN_PATH = /^(?:[A-Za-z]:[\\/]|\\\\)/
/** 같은 열쇠의 항목을 첫 항목 자리에 한 줄로 — 보이는 글과 복사할 글은 Windows 쪽 경로 꼴이 있으면 그것, 없으면 첫 항목의 글. 열쇠가 없는 항목은 합치지 않는다. rowOf[i] = i 번째 항목이 든 줄 번호(1 부터) */
function collapse<T extends { text: string; head: string }>(items: T[], keyOf: (it: T) => string | undefined): { rows: T[]; rowOf: number[] } {
  const rows: T[] = []
  const at = new Map<string, number>()
  const rowOf: number[] = []
  for (const it of items) {
    const key = keyOf(it)
    const k = key === undefined ? undefined : at.get(key)
    if (k === undefined) { if (key !== undefined) at.set(key, rows.length); rows.push(it); rowOf.push(rows.length); continue }
    if (!WIN_PATH.test(rows[k]!.text) && WIN_PATH.test(it.text)) rows[k] = { ...rows[k]!, text: it.text, head: previewOf(it.text) }
    rowOf.push(k + 1)
  }
  return { rows, rowOf }
}
/** 답변 글의 항목 글을 순서대로 — 말(language)이 있는 블록만(셸은 문장마다, path·url·copy 는 줄마다) */
function itemTexts(answer: string): string[] {
  const out: string[] = []
  for (const m of answer.matchAll(FENCE)) for (const it of planFence(m[2] ?? '', m[3] ?? '').items) out.push(it.text)
  return out
}
/** 글들을 줄로 — 디스크에 묻지 않고 같은 자리(pathKey)로 풀리는 항목은 한 줄(첫째 합치기). 토스트 장 번호와 답변 쪽 번호가 함께 이 결과를 쓴다 */
function rowsOf(texts: string[]): { rows: CopyItem[]; rowOf: number[] } {
  return collapse(texts.map(text => ({ n: 0, text, head: previewOf(text), phase: 'in' as const })), it => pathKey(it.text))
}
/** 답변 글에서 복사할 것을 순서대로 — 말(language)이 있는 블록만(셸은 문장마다, path·url·copy 는 줄마다). 울타리 밖의 글은 세지 않는다 — 복사할 것은 답을 쓰는 모델이 표기 있는 블록에 넣는다(시스템 프롬프트의 규칙 절).
 * 같은 파일·폴더를 가리키는 항목(경로 꼴·file:// 주소·/mnt/c/…·\\wsl.localhost\…)은 한 줄로 합친다(사용자 요청 2026-10-30) */
export function extractItems(answer: string): CopyItem[] {
  return rowsOf(itemTexts(answer)).rows.map((it, i) => ({ ...it, n: i + 1 }))
}
/** 디스크가 답한 같은 자리(key, locate.ts 가 단다)로 한 번 더 합친다(둘째 합치기 — 링크처럼 글로는 다른 꼴). key 가 없는 항목(디스크에 없는 것)은 합치지 않는다. 번호는 1 부터 다시 */
export function mergeSameFile(items: (CopyItem & { key?: string })[]): CopyItem[] {
  return collapse(items, it => it.key).rows.map(({ key: _key, ...it }, i) => ({ ...it, n: i + 1 }))
}
/** `text` 까지의 항목 수 — 답변이 여러 토막으로 그려질 때 번호를 이어 붙이려고 */
export function countFences(text: string): number { return extractItems(text).length }
/** 번호를 붙인 글 — 블록 위에 「▸ 복사 N」(나뉜 블록은 「▸ 복사 N~M」, 번호가 띄엄띄엄이면 「▸ 복사 1, 3」), 나뉜 블록은 항목 줄 앞에 「(N) 」. 저장된 메시지는 그대로, 그려지는 것만 바뀐다.
 * 번호는 토스트 장 번호와 같다 — 같은 파일·폴더를 가리키는 항목은 같은 번호(pathKey). prior 는 이 토막 앞의 답변 글 — 앞 토막의 항목과 같은 자리면 앞 번호를 받게 */
export function numberFences(text: string, start: number, s: Strings = STRINGS.en, prior = ''): string {
  const before = itemTexts(prior)
  const shift = start - 1 - rowsOf(before).rows.length
  const nums = rowsOf(before.concat(itemTexts(text))).rowOf.slice(before.length).map(r => r + shift)
  let q = 0
  let out = ''
  let at = 0
  for (const m of text.matchAll(FENCE)) {
    const [whole, fence, info, body] = [m[0], m[1] ?? '', m[2] ?? '', m[3] ?? '']
    out += text.slice(at, m.index!)
    at = m.index! + whole.length
    const plan = planFence(info, body)
    if (!plan.copy) { out += whole; continue }
    const mine = plan.items.map(() => nums[q++]!)
    const ds = [...new Set(mine)].sort((a, b) => a - b)
    const first = ds[0]!, last = ds[ds.length - 1]!
    const mark = `${glyph.mark} ${s.copy} ${ds.length === 1 ? first : last - first === ds.length - 1 ? `${first}~${last}` : ds.join(', ')}`
    if (!plan.split) { out += `${mark}\n${whole}`; continue }
    const tag = new Map<number, number>()
    plan.items.forEach((it, k) => { if (it.lines[0] !== undefined) tag.set(it.lines[0], mine[k]!) })
    const lines = body.split('\n').map((l, i) => (tag.has(i) ? `(${tag.get(i)}) ${l}` : l))
    out += `${mark}\n${fence}${info}\n${lines.join('\n')}\n${fence}`
  }
  return out + text.slice(at)
}

export type TB = { Box: (p: Record<string, unknown>) => RenderElement; Text: (p: Record<string, unknown>) => RenderElement; Button: (p: Record<string, unknown>) => RenderElement }
export const IN_FRAMES = 6
export const OUT_FRAMES = 5
export const STAGGER = 2            // 다음 장은 두 그림 늦게 들어온다
export const FRAME_MS = 40
export const DONE_HOLD_MS = 900

export function toastWidth(bodyColumns: number): number { return Math.max(28, Math.min(64, bodyColumns)) }
/** 이 장이 지금 몇 칸 보이는가(0~W). in 은 자라고 out 은 준다. 그림 수가 음수면 아직 차례가 아니다 */
export function visibleCells(phase: Phase, frame: number, W: number): number {
  if (phase === 'in') return Math.round(W * Math.max(0, Math.min(frame + 1, IN_FRAMES)) / IN_FRAMES)
  if (phase === 'out') return Math.round(W * Math.max(0, OUT_FRAMES - frame) / OUT_FRAMES)
  return W
}

/** 토스트 한 장 — 둥근 테두리 상자 한 줄: 번호 · 미리보기(넘치면 엔진이 자른다) · [📂](열 폴더가 있을 때) · [ 복사하기 ] 또는 복사 완료 */
function card(t: TB, it: CopyItem, o: { W: number; mode: Mode; colors: Colors; s: Strings; onCopy: (n: number, surface: unknown) => void; onOpen: (n: number) => void; dim: boolean }): RenderElement {
  const c = tone(o.mode, o.colors)
  const txt = (s: string, p: Record<string, unknown> = {}): RenderElement => t.Text({ ...p, children: [s] })
  const done = it.phase === 'done'
  const right = done
    ? txt(o.s.done, { color: 'success', bold: true })
    : it.phase === 'show'
      ? t.Box({ key: `hover:copy:${it.n}`, backgroundColor: c.buttonBg, hover: { backgroundColor: c.hover }, children: [t.Button({ key: `copy:${it.n}`, label: o.s.button, onPress: (p: { surface?: unknown } | undefined) => o.onCopy(it.n, p?.surface) })] })
      : txt(`[ ${o.s.button} ]`, { color: c.muted, dimColor: true })          // 움직이는 중엔 글자만 — 누를 수 없다
  // 열기 — 복사 버튼 왼쪽에 아이콘 한 칸. 폴더면 그 폴더, 파일이면 든 폴더를 그 파일을 선택한 채 탐색기로(사용자 요청 2026-10-27·10-29). 완료 뒤·움직이는 중엔 없다
  const open = it.dir !== undefined && !done
    ? [it.phase === 'show'
        ? t.Box({ key: `hover:open:${it.n}`, backgroundColor: c.buttonBg, hover: { backgroundColor: c.hover }, children: [t.Button({ key: `open:${it.n}`, label: glyph.open, onPress: () => o.onOpen(it.n) })] })
        : txt(`[${glyph.open}]`, { color: c.muted, dimColor: true }),
      txt(' ')]
    : []
  const openCells = open.length ? cells(glyph.open) + 4 + 1 : 0   // 아이콘 폭 · 엔진 테두리 2+2 · 간격 1
  const headMax = o.W - 2 - 2 - 1 - 2 - 2 - (done ? cells(o.s.done) : cells(o.s.button) + 4) - openCells - 2   // 테두리 2 · 안쪽 여백 2 · 번호 1 · 간격 2 · 간격 2 · 오른쪽 글(버튼은 엔진이 그리는 테두리 2+2 를 더한다) · 열기 · 여유
  return t.Box({
    key: `toast:${it.n}`, borderStyle: 'round', borderColor: c.border, borderDimColor: o.dim, width: o.W, flexDirection: 'row', paddingX: 1, flexShrink: 0,
    children: [
      txt(String(it.n), { color: c.num, bold: true, dimColor: o.dim }), txt('  '),
      t.Box({ flexGrow: 1, flexShrink: 1, width: Math.max(4, headMax), children: [txt(it.head, { color: c.text, wrap: 'truncate', dimColor: o.dim })] }),
      txt('  '), ...open, right,
    ],
  })
}

/** 토스트 더미 — 항목마다 한 장, 오른쪽 끝에 붙여 위에서 아래로 쌓는다. in/out 은 보이는 칸만큼의 창(overflow hidden)으로 잘라 밀려 들어오고 나간다 */
export function drawToasts(t: TB, items: CopyItem[], o: { bodyColumns: number; mode: Mode; colors: Colors; s: Strings; frames: Record<number, number>; onCopy: (n: number, surface: unknown) => void; onOpen: (n: number) => void }): RenderElement {
  const W = toastWidth(o.bodyColumns)
  const rows = items.map(it => {
    const frame = o.frames[it.n] ?? 0
    const vw = visibleCells(it.phase, frame, W)
    const moving = it.phase === 'in' || it.phase === 'out'
    const dim = moving && vw < W / 2
    const c = card(t, it, { W, mode: o.mode, colors: o.colors, s: o.s, onCopy: o.onCopy, onOpen: o.onOpen, dim })
    const inner = moving ? t.Box({ width: Math.max(0, vw), overflow: 'hidden', flexDirection: 'row', flexShrink: 0, children: vw > 0 ? [c] : [] }) : c
    return t.Box({ flexDirection: 'row', justifyContent: 'flex-end', width: o.bodyColumns, children: [inner] })
  })
  return t.Box({ flexDirection: 'column', width: o.bodyColumns, children: rows })
}
