// copy-toast 의 작은 그리기 도구 — 칸 수·자르기·색. mod 는 제 폴더 안만 import 하므로 필요한 만큼만 여기에 둔다.

/** 한 코드포인트가 차지하는 터미널 칸 수 — 한글·한자·전각은 2, 결합 문자·폭 0 문자는 0, 그 밖은 1 */
export function cellsOfCodePoint(cp: number): number {
  if (cp === 0) return 0
  if ((cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0
  if (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x303e) || (cp >= 0x3041 && cp <= 0x33ff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xa000 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) || (cp >= 0x20000 && cp <= 0x3fffd)
  ) return 2
  return 1
}
export function cells(s: string): number { let n = 0; for (const ch of s) n += cellsOfCodePoint(ch.codePointAt(0) ?? 0); return n }
/** 앞에서 `max` 칸 — 넘치면 자르고 … */
export function fit(s: string, max: number): string {
  if (max <= 0) return ''
  if (cells(s) <= max) return s
  if (max === 1) return '…'
  const out: string[] = []; let used = 0
  for (const ch of s) { const w = cellsOfCodePoint(ch.codePointAt(0) ?? 0); if (used + w > max - 1) break; out.push(ch); used += w }
  return out.join('') + '…'
}
/** 뒤에서 `n` 칸 — 띠가 오른쪽 끝에서 스르륵 나올 때 보이는 부분. 한글이 반 칸 걸치면 한 글자 덜 */
export function tail(s: string, n: number): string {
  if (n <= 0) return ''
  const chars = Array.from(s).reverse(); const out: string[] = []; let used = 0
  for (const ch of chars) { const w = cellsOfCodePoint(ch.codePointAt(0) ?? 0); if (used + w > n) break; out.push(ch); used += w }
  return out.reverse().join('')
}
export function pad(s: string, w: number): string { return s + ' '.repeat(Math.max(0, w - cells(s))) }

export type Mode = 'dark' | 'light'
export function modeOf(themeName: string | undefined): Mode { return themeName !== undefined && /light/i.test(themeName) ? 'light' : 'dark' }
/** 색 — 금→장미 팔레트. 청록은 코랄의 보색(바탕 있는 버튼) */
export const palette = { coral: '#f08a5d', rose: '#e05a8c', cream: '#f2e9df', warmGray: '#9a938c', teal: '#2b7a78', tealSoft: '#c4e4e2', ink: '#2a2420' } as const
/** 색 고르기 — theme 이면 엔진 테마 키만 써서 사용자의 테마를 따르고, palette 면 위의 금→장미 hex. 옵션 `colors` 의 기본은 theme */
export type Colors = 'theme' | 'palette'
export function colorsOf(v: unknown): Colors { return v === 'palette' ? 'palette' : 'theme' }
/** 테마 키(d.ts 의 ThemeKey) 만으로 고른 색 — 밝은 테마·어두운 테마의 구분은 테마가 맡는다 */
const themeTone = { border: 'suggestion', title: 'text', num: 'claude', text: 'text', muted: 'inactive', buttonBg: 'subtle', hover: 'claude' } as const
export const tone = (mode: Mode, colors: Colors = 'theme') => colors === 'theme' ? themeTone : ({
  border: palette.teal,
  title: mode === 'dark' ? palette.cream : palette.ink,
  num: palette.coral,
  text: mode === 'dark' ? palette.cream : palette.ink,
  muted: palette.warmGray,
  buttonBg: mode === 'dark' ? palette.teal : palette.tealSoft,
  hover: palette.rose,
})
/** open: 열기 버튼의 아이콘 — 폴더 그림 이모지(U+1F4C2, 두 칸). 사용자가 네 후보(⊞·⧉·⇱·▸) 가운데 골랐다(2026-10-27). 폭은 cells() 가 2 로 센다 */
export const glyph = { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', mark: '▸', open: '📂' } as const
