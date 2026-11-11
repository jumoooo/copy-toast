// copy-toast — 항목이 「가서 볼 수 있는 자리」인지 가린다. 경로 꼴의 글만 디스크에 묻고, 있으면 열 폴더(폴더 자신 또는 파일이 든 폴더)를 돌려준다.
// 세션이 WSL·Linux 면 Windows 꼴(C:\…·\\wsl.localhost\…)을 그 기계의 경로로, Windows 면 /mnt/c/… 를 C:\… 로 바꾼다 — 사용자가 어느 쪽 경로를 붙여 넣어도 같은 폴더가 열리게.
import type { EngineInterface } from 'claude-code'
import { fromFileUrl, isPathShaped, mergeSameFile, type CopyItem } from './toast'

// 경로 꼴 판정과 file:// 풀기는 toast.ts 에 있다 — 답변 쪽 번호(pathKey)도 디스크 없이 같은 규칙으로 견주려고
export { isPathShaped }

/** 세션이 Windows 에서 도는가 — cwd 가 드라이브 글자로 시작하면 */
export function isWindowsCwd(cwd: string): boolean { return /^[A-Za-z]:[\\/]/.test(cwd) }

/** 글을 이 기계의 경로로 — 못 바꾸면 null. home 은 ~ 를 펼칠 값(없으면 ~ 는 null). file:// 주소는 먼저 경로 꼴로 푼다 */
export function localPath(text: string, isWin: boolean, home: string | undefined): string | null {
  const u0 = fromFileUrl(text)
  if (u0 === null) return null
  let p = u0.trim().replace(/(.)[\\/]+$/, '$1')      // 끝의 구분 문자는 뗀다(루트 「/」 하나는 둔다)
  if (/^[A-Za-z]:$/.test(p)) p += '\\'                  // 「C:」 만 남으면 드라이브 루트
  if (/^~/.test(p)) { if (!home) return null; p = home.replace(/[\\/]+$/, '') + p.slice(1) }
  if (isWin) {
    const m = /^\/mnt\/([a-zA-Z])(\/.*)?$/.exec(p)
    if (m) return `${m[1]!.toUpperCase()}:${(m[2] ?? '/').replace(/\//g, '\\')}`
    if (/^\//.test(p)) return null                       // WSL 쪽 경로 — 어느 배포판인지 몰라 열지 않는다
    return p.replace(/\//g, '\\')
  }
  const d = /^([A-Za-z]):[\\/](.*)$/.exec(p)
  if (d) return `/mnt/${d[1]!.toLowerCase()}/${d[2]!.replace(/\\/g, '/')}`.replace(/\/$/, '')
  const u = /^\\\\wsl(?:\.localhost|\$)\\[^\\]+(\\.*)?$/i.exec(p)
  if (u) return (u[1] ?? '\\').replace(/\\/g, '/').replace(/(.)\/$/, '$1')
  if (/^\\\\/.test(p)) return null                       // 다른 UNC 는 이 기계의 경로가 아니다
  return p
}
/** 든 폴더 — 구분 문자는 경로의 것을 따른다. 루트면 그대로 */
export function parentOf(p: string): string {
  const cut = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (cut <= 0) return p.startsWith('/') ? '/' : p
  const head = p.slice(0, cut)
  return /^[A-Za-z]:$/.test(head) ? head + '\\' : head
}

/** 항목마다 열 폴더를 단다 — 경로 꼴이고 디스크에 있을 때만(폴더는 그 폴더, 파일은 든 폴더와 그 파일). 묻는 중 실패는 「없다」로 둔다.
 * 디스크의 같은 자리(실제로 닿는 곳, 못 얻으면 이 기계의 경로)로 풀리는 항목은 한 줄로 합치고 번호를 다시 매긴다(mergeSameFile, 사용자 요청 2026-10-30) */
export async function locateItems($: EngineInterface, items: CopyItem[], isWin: boolean): Promise<CopyItem[]> {
  let home: string | undefined
  const needHome = items.some(it => /^~/.test(it.text))
  if (needHome) { try { home = isWin ? await $.env.get('USERPROFILE') : await $.env.get('HOME') } catch { home = undefined } }
  const out: (CopyItem & { key?: string })[] = []
  for (const it of items) {
    if (!isPathShaped(it.text)) { out.push(it); continue }
    const p = localPath(it.text, isWin, home)
    if (!p) { out.push(it); continue }
    try {
      const st = await $.fs.stat(p, { resolve: true })
      const key = st.realPath ?? p
      if (st.kind === 'dir') out.push({ ...it, dir: p, key })
      else if (st.kind === 'file') out.push({ ...it, dir: parentOf(p), file: p, key })
      else out.push(it)
    } catch { out.push(it) }
  }
  return mergeSameFile(out)
}
