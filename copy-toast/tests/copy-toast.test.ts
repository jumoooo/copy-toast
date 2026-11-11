import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

type Node = { props?: Record<string, unknown>; children?: unknown[] } | string
const flat = (n: Node): string => (typeof n === 'string' ? n : (typeof n.props?.label === 'string' ? (n.props.label as string) : '') + (n.children ?? []).map(c => flat(c as Node)).join(''))
/** 그려진 트리를 줄 글로 — 열 상자(column Box)의 자식마다 한 줄 */
const lines = (root: Node): string[] => {
  if (typeof root === 'string') return [root]
  const col = (n: Node): boolean => typeof n !== 'string' && n.props?.flexDirection === 'column'
  const walk = (n: Node): string[] => (col(n) ? (n as { children?: unknown[] }).children!.flatMap(c => walk(c as Node)) : [flat(n)])
  return walk(root)
}
const textOf = (root: Node): string => lines(root).join('\n')
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length

const band = (bodyColumns: number, maxRows = 40) => ({
  component: 'AbovePrompt' as const,
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows, bodyColumns, scroll: { top: 0, bodyRows: maxRows - 1 } as never, view: {} as never },
})
const message = (text: string) => ({
  component: 'AssistantMessage' as const,
  requestId: 'msg-1',
  props: { text, isFirstOfReply: true } as never,
})
// 보여 주는 글(말 없는 블록)은 복사할 것이 아니다. 셸 블록은 문장마다 하나(끝이 \ 인 줄은 앞에 붙는다). json 은 블록 하나가 하나
const ANSWER = '고쳤습니다.\n\n```\n╭─ 화면 본 ─╮\n│ 이건 복사 아님 │\n╰───────────╯\n```\n\n```bash\nexport NODE_OPTIONS="--require x.js"\n# 검사\nnode --test \\\n  a.test.js\n```\n\n그리고 설정은\n\n```json\n{ "a": 1 }\n```\n\n끝.'
const ORIGIN = { kind: 'composer' } as never

function world(on: On) {
  const w = { copied: [] as string[], toasts: [] as string[], surfaces: [] as string[], clock: mock.clock(on) }
  on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: 'dark' }] as never }))
  on('ui.copy', ($, e) => { w.copied.push(e.text); return { value: { isCopied: true as const } } })
  on('ui.toast', ($, e) => { w.toasts.push(e.text); return { value: undefined } })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: w.surfaces as never }))
  // 엔진 자리의 그리기 — 우리 훅이 next(e) 로 넘기면 여기가 답한다. 답변 토막은 그 글 그대로, 띠는 빈 줄
  on('ui.render', ($, e) => { const t = $.ui.resolve(e) as unknown as { Text: (p: Record<string, unknown>) => unknown }; return t.Text({ children: [e.component === 'AssistantMessage' ? String((e.props as { text?: string }).text ?? '') : ''] }) as never })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  // 엔진 자리의 시스템 프롬프트 — 공유 절 하나와 세션 절 하나. 우리 훅은 그 뒤에 덧붙인다
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' as const }, { id: 'env', text: 'engine env', scope: 'session' as const }] }))
  return w
}
/** 앞의 여덟 시험은 한국어 글·팔레트 색 옵션으로 돈다 — 두 옵션의 화면을 잠근다 */
const KO = { options: { language: 'ko', colors: 'palette' } }
/** WSL 세션 시나리오(cwd /home/t · 디스크 흉내 /mnt/c/…) — Windows 시험 틀은 그 경로를 C:\… 로 바꿔 넘겨 시나리오 자체가 달라진다(2026-11-02 실측 6 fail).
 *  Windows 에서는 등록하지 않는다 — 통과한 척이 아니라 돌지 않은 것으로 수에서 빠지고, 끝에 건너뛴 수를 한 줄 찍는다. Windows 세션 시나리오(cwd C:\ 꼴)는 그대로 돈다 */
const onWindows = /^file:\/\/\/[A-Za-z]:\//.test(import.meta.url)   // 시험 틀엔 process 가 없다 — 이 파일의 주소가 C:/ 로 시작하면 Windows
let skippedOnWindows = 0
const testWsl = ((...args: Parameters<typeof test>) => { if (onWindows) { skippedOnWindows++; return } return test(...args) }) as typeof test
const turn = (answer: string) => ({ answer, durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' as const })

test('답변에 코드 블록이 있으면 — 항목마다 토스트 한 장이 오른쪽에서 밀려 들어와 쌓인다: 번호·미리보기·복사하기', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  expect(textOf((await ui.drawn()) as Node)).not.toMatch(/복사/)                 // 답 전엔 없다
  await $.turn.complete(turn(ANSWER)); await w.clock.advance(40); await w.clock.settle()
  const mid = JSON.stringify(await ui.drawn())
  expect(mid).toMatch(/"overflow":"hidden"/)                                    // 들어오는 중 — 보이는 칸만큼의 창으로 자른다
  expect(await ui.find({ key: 'copy:1' })).toBeUndefined()                      // 움직이는 중엔 누를 수 없다
  await w.clock.advance(600); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  const tree = JSON.stringify(await ui.drawn())
  expect(count(tree, /"borderStyle":"round"/g)).toBe(3)                         // 장마다 둥근 테두리 — 화면 본 블록은 빠지고, 셸 두 문장 + json 하나
  expect(tree).not.toMatch(/"overflow":"hidden"/)
  expect(full).toMatch(/1 {2}export NODE_OPTIONS="--require x\.js" {2}복사하기/)   // 셸 첫 문장
  expect(full).toMatch(/2 {2}node --test \\ {2}복사하기/)                             // 둘째 문장 — 미리보기는 첫 줄
  expect(full).toMatch(/3 {2}\{ "a": 1 \} {2}복사하기/)
  expect(full).not.toMatch(/화면 본|복사 아님/)
  expect(await ui.find({ key: 'copy:1' })).toBeDefined()
  expect(await ui.find({ key: 'copy:2' })).toBeDefined()
  // 1번을 누르면 — 블록 전체가 클립보드로, 그 장만 「복사 완료」 뒤 밀려 나간다. 2번은 남는다
  await ui.press({ key: 'copy:1' }); await w.clock.settle()
  expect(w.copied).toEqual(['export NODE_OPTIONS="--require x.js"'])             // 문장 하나만
  await ui.press({ key: 'copy:2' }); await w.clock.settle()
  expect(w.copied[1]).toBe('node --test \\\n  a.test.js')                               // 이어진 줄은 함께
  const done = textOf((await ui.drawn()) as Node)
  expect(done).toMatch(/1 {2}export NODE_OPTIONS="--require x\.js" {2}복사 완료/)
  expect(done).toMatch(/3 {2}\{ "a": 1 \} {2}복사하기/)
  expect(await ui.find({ key: 'copy:1' })).toBeUndefined()
  await w.clock.advance(950); await w.clock.settle()
  expect(JSON.stringify(await ui.drawn())).toMatch(/"overflow":"hidden"/)        // 1번이 나가는 중
  await w.clock.advance(300); await w.clock.settle()
  const after = textOf((await ui.drawn()) as Node)
  expect(after).not.toMatch(/export NODE_OPTIONS/)                              // 1번은 갔다
  expect(after).toMatch(/3 {2}\{ "a": 1 \} {2}복사하기/)                          // 3번은 그대로
  expect(await ui.find({ key: 'copy:3' })).toBeDefined()
  expect(w.toasts).toEqual([])
  await ui.unmount()
})

test('답변의 코드 블록 위에 「▸ 복사 N」 — 그려지는 글만, 번호는 토스트와 같다', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  await $.turn.complete(turn(ANSWER)); await w.clock.settle()
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(ANSWER) })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toMatch(/▸ 복사 1~2\\n```bash\\n\(1\) export NODE_OPTIONS/)     // 나뉜 셸 블록 — 위에 범위, 문장 줄 앞에 (N)
  expect(drawn).toMatch(/# 검사\\n\(2\) node --test \\\\\\n  a\.test\.js/)          // 주석 줄엔 번호 없음, 이어진 줄은 그대로
  expect(drawn).toMatch(/▸ 복사 3\\n```json/)
  expect(drawn).not.toMatch(/▸ 복사 [0-9]+\\n```\\n╭/)                               // 화면 본 블록엔 번호 없음
  await ui.unmount()
  // 답변의 뒤 토막만 그려질 때도 번호가 이어진다
  const tailPart = ANSWER.slice(ANSWER.indexOf('그리고 설정은'))
  const ui2 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(tailPart) })
  const drawn2 = JSON.stringify(await ui2.drawn())
  expect(drawn2).toMatch(/▸ 복사 3\\n```json/)
  expect(drawn2).not.toMatch(/▸ 복사 1/)
  await ui2.unmount()
  // 블록 없는 다른 글은 손대지 않는다
  const ui3 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message('그냥 글') })
  expect(JSON.stringify(await ui3.drawn())).not.toMatch(/복사/)
  await ui3.unmount()
})

test('다음 입력을 하면 남은 장이 다 밀려 나간다 — 배경 알림은 아니다. 블록 없는 답이면 장이 없다', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete(turn(ANSWER)); await w.clock.advance(600); await w.clock.settle()
  expect(count(textOf((await ui.drawn()) as Node), /복사하기/g)).toBe(3)
  await $.prompt.submit({ text: '알림', origin: { kind: 'task-notification' } as never } as never); await w.clock.advance(400); await w.clock.settle()
  expect(count(textOf((await ui.drawn()) as Node), /복사하기/g)).toBe(3)           // 배경 작업 알림은 사용자의 입력이 아니다
  await $.prompt.submit({ text: '다음', origin: ORIGIN } as never); await w.clock.advance(40); await w.clock.settle()
  expect(JSON.stringify(await ui.drawn())).toMatch(/"overflow":"hidden"/)        // 나가는 중
  await w.clock.advance(400); await w.clock.settle()
  expect(textOf((await ui.drawn()) as Node)).not.toMatch(/복사/)
  // 블록 없는 답 — 장 없음
  await $.turn.complete(turn('코드 없는 답')); await w.clock.advance(400); await w.clock.settle()
  expect(textOf((await ui.drawn()) as Node)).not.toMatch(/복사/)
  await ui.unmount()
})

test('사람 없는 세션(claude -p)·서브에이전트의 턴 — 아무것도 그리지 않는다', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: false })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete(turn(ANSWER)); await w.clock.advance(600); await w.clock.settle()
  expect(textOf((await ui.drawn()) as Node)).not.toMatch(/복사/)
  await ui.unmount()
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui2 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete({ ...turn(ANSWER), agentId: 'agent-7' }); await w.clock.advance(600); await w.clock.settle()
  expect(textOf((await ui2.drawn()) as Node)).not.toMatch(/복사/)
  await ui2.unmount()
})

test('/reload-plugins 로 도중에 붙은 세션 — session.start 없이도 화면이 있으면 뜬다, 화면이 없으면(-p) 안 뜬다', KO, async ($, on) => {
  const w = world(on)
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete(turn(ANSWER)); await w.clock.advance(600); await w.clock.settle()
  expect(textOf((await ui.drawn()) as Node)).not.toMatch(/복사/)                 // 화면 0 — claude -p
  w.surfaces = ['terminal']
  await $.turn.complete(turn(ANSWER)); await w.clock.advance(600); await w.clock.settle()
  expect(count(textOf((await ui.drawn()) as Node), /복사하기/g)).toBe(3)
  await ui.unmount()
})

test('항목 수에 상한이 없다 — 셸 열두 문장이면 1~12 가 전부 장으로 뜨고 번호도 이어진다', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const many = '```bash\n' + Array.from({ length: 12 }, (_, i) => `echo line${i + 1}`).join('\n') + '\n```'
  await $.turn.complete(turn(many)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  for (let i = 1; i <= 12; i++) { expect(full).toMatch(new RegExp(`${i} {2}echo line${i} {2}복사하기`)); expect(await ui.find({ key: `copy:${i}` })).toBeDefined() }
  expect(count(JSON.stringify(await ui.drawn()), /"borderStyle":"round"/g)).toBe(12)
  await ui.press({ key: 'copy:12' }); await w.clock.settle()
  expect(w.copied).toEqual(['echo line12'])
  await ui.unmount()
  const msg = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(many) })
  const drawn = JSON.stringify(await msg.drawn())
  expect(drawn).toMatch(/▸ 복사 1~12/)
  expect(drawn).toMatch(/\(12\) echo line12/)
  await msg.unmount()
})

test('울타리 밖의 홀로 선 명령 줄은 항목이 아니다 — 복사할 것은 답을 쓰는 모델이 표기 있는 블록에 넣는다', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    '서버의 브랜치를 지우는 명령입니다. 이 저장소에서 치면 됩니다.', '',
    'git push origin --delete fix/web-repair-v2', '',
    '혹시 남아 있으면 아래 한 줄이 낡은 참조를 정리합니다.', '',
    '`git fetch --prune origin`', '',
    '지워졌는지는 이렇게 확인합니다.', '',
    '```bash', 'git ls-remote origin refs/heads/fix/web-repair-v2', '```', '',
    '- cd 로 옮겨 가서 git status 를 보면 됩니다.',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /복사하기/g)).toBe(1)                                       // 표기 있는 블록 하나만
  expect(full).toMatch(/1 {2}git ls-remote origin refs\/heads\/fix\/web-repair-v2 {2}복사하기/)
  expect(full).not.toMatch(/git push origin --delete|git fetch --prune/)           // 홀로 선 줄·백틱 줄은 글이다
  await ui.unmount()
  const msg = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(text) })
  const drawn = JSON.stringify(await msg.drawn())
  expect(drawn).toMatch(/▸ 복사 1\\n```bash/)
  expect(drawn).not.toMatch(/▸ 복사 [0-9]+\\ngit push|▸ 복사 [0-9]+\\n`git fetch/)
  expect(count(drawn, /▸ 복사/g)).toBe(1)
  await msg.unmount()
})

test('「! 명령」 — 홀로 선 줄이면 항목이 아니고, copy 블록에 넣으면 ! 까지 그대로 한 장', KO, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    '훅이 이 세션의 git push 를 막았습니다. 우회하지 않았습니다.', '',
    '! git push origin --delete fix/old-branch', '',
    '이 대화에서 치려면 아래 줄을 붙여 넣습니다.', '',
    '```copy', '! git push origin --delete fix/web-repair-v2', '```',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /복사하기/g)).toBe(1)
  expect(full).toMatch(/1 {2}! git push origin --delete fix\/web-repair-v2 {2}복사하기/)
  expect(full).not.toMatch(/fix\/old-branch/)                                       // 홀로 선 ! 줄은 글이다
  await ui.press({ key: 'copy:1' }); await w.clock.settle()
  expect(w.copied).toEqual(['! git push origin --delete fix/web-repair-v2'])    // ! 까지 — 프롬프트에 그대로 붙여 넣는다
  await ui.unmount()
})

const EN_ANSWER = 'Fixed.\n\n```bash\nnpm test\n```\n\nThen the settings\n\n```json\n{ "a": 1 }\n```\n\nDone.'
const HEX = /"#[0-9a-fA-F]{6}"/

test('옵션 없음 — 영어 글(Copy · Copied · ▸ copy N)이고, 색은 테마 키만 써서 트리에 hex 가 없다', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete(turn(EN_ANSWER)); await w.clock.advance(600); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  const tree = JSON.stringify(await ui.drawn())
  expect(full).toMatch(/1 {2}npm test {2}Copy/)
  expect(full).toMatch(/2 {2}\{ "a": 1 \} {2}Copy/)
  expect(full).not.toMatch(/복사/)
  expect(tree).not.toMatch(HEX)                                                  // 기본은 테마 키 — 사용자의 테마를 따른다
  expect(tree).toMatch(/"borderColor":"[a-zA-Z]+"/)
  await ui.press({ key: 'copy:1' }); await w.clock.settle()
  expect(w.copied).toEqual(['npm test'])
  const done = textOf((await ui.drawn()) as Node)
  expect(done).toMatch(/1 {2}npm test {2}Copied/)
  expect(done).not.toMatch(/복사/)
  expect(JSON.stringify(await ui.drawn())).not.toMatch(HEX)
  await ui.unmount()
  const msg = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(EN_ANSWER) })
  const drawn = JSON.stringify(await msg.drawn())
  expect(drawn).toMatch(/▸ copy 1\\n```bash/)
  expect(drawn).toMatch(/▸ copy 2\\n```json/)
  expect(drawn).not.toMatch(/복사/)
  await msg.unmount()
})

test('colors=palette — 금→장미 팔레트의 hex 로 그린다', { options: { colors: 'palette' } }, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100) })
  await $.turn.complete(turn(EN_ANSWER)); await w.clock.advance(600); await w.clock.settle()
  const tree = JSON.stringify(await ui.drawn())
  expect(tree).toMatch(HEX)
  expect(tree).toMatch(/"borderColor":"#2b7a78"/)                                // 청록 테두리
  expect(textOf((await ui.drawn()) as Node)).toMatch(/1 {2}npm test {2}Copy/)   // 글은 그대로 기본 영어
  await ui.unmount()
})

test('path · url · copy 블록은 줄마다 한 항목 — 빈 줄과 # 주석 줄은 항목이 아니고, 줄은 이어 붙지 않는다', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    'Open these.', '',
    '```path', '~/.claude/skills/copy-toast/README.md', '', '/tmp/a b.txt \\', '/tmp/c.txt', '```', '',
    '```url', 'https://example.com/a', '# docs', 'https://example.com/b', '```', '',
    '```copy', '/reload-plugins', '```',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(6)
  expect(full).toMatch(/1 {2}~\/\.claude\/skills\/copy-toast\/README\.md {2}Copy/)
  expect(full).toMatch(/2 {2}\/tmp\/a b\.txt \\ {2}Copy/)
  expect(full).toMatch(/3 {2}\/tmp\/c\.txt {2}Copy/)
  expect(full).toMatch(/4 {2}https:\/\/example\.com\/a {2}Copy/)
  expect(full).toMatch(/5 {2}https:\/\/example\.com\/b {2}Copy/)                 // 주석 줄은 건너뛴다
  expect(full).toMatch(/6 {2}\/reload-plugins {2}Copy/)
  await ui.press({ key: 'copy:2' }); await w.clock.settle()
  expect(w.copied).toEqual(['/tmp/a b.txt \\'])                                  // 끝의 \ 로도 다음 줄과 잇지 않는다
  await ui.unmount()
  const msg = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(text) })
  const drawn = JSON.stringify(await msg.drawn())
  expect(drawn).toMatch(/▸ copy 1~3\\n```path\\n\(1\) ~\/\.claude/)
  expect(drawn).toMatch(/\(2\) \/tmp\/a b\.txt \\\\\\n\(3\) \/tmp\/c\.txt/)
  expect(drawn).toMatch(/▸ copy 4~5\\n```url\\n\(4\) https:\/\/example\.com\/a\\n# docs\\n\(5\) https/)
  expect(drawn).toMatch(/▸ copy 6\\n```copy\\n\/reload-plugins/)
  await msg.unmount()
})

test('홀로 선 영어 명령 줄도 항목이 아니다 — git push origin main · git add . · cd .. 는 글이고, bash 블록 안의 것만 항목', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = ['Push it.', '', 'git push origin main', '', 'git add .', '', 'cd ..', '', 'cd is a command.', '', '```bash', 'git status', '```'].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(1)
  expect(full).toMatch(/1 {2}git status {2}Copy/)
  expect(full).not.toMatch(/git push origin main|git add \.|cd \.\./)
  await ui.unmount()
  const msg = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(text) })
  const drawn = JSON.stringify(await msg.drawn())
  expect(drawn).toMatch(/▸ copy 1\\n```bash/)
  expect(count(drawn, /▸ copy/g)).toBe(1)
  await msg.unmount()
})

const RULE = 'copy-toast'
/** 시스템 프롬프트를 짜 본다 — 시험에서는 사건의 입력을 다 주어야 한다. surfaces 는 세션의 그리는 화면과 같게 */
const ruleOf = async ($: { prompt: { compose: (a: never) => Promise<{ sections: readonly { id: string; text: string; scope: string }[] }> } }, surfaces: string[]) =>
  (await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces, tools: [], outputStyle: null, traits: [] } as never)).sections

test('사람 있는 세션 — 시스템 프롬프트 끝에 펜스 규칙 절(session 범위)이 하나 붙고, 엔진의 절은 그대로다', async ($, on) => {
  const w = world(on)
  w.surfaces = ['terminal']
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const sections = await ruleOf($, w.surfaces)
  expect(sections.map(s => s.id)).toEqual(['intro', 'env', RULE])               // 엔진의 절 뒤에 덧붙인다
  const rule = sections[2]!
  expect(rule.scope).toBe('session')
  expect(rule.text.split('\n').length).toBeLessThanOrEqual(6)
  for (const tag of ['bash', 'powershell', 'json', 'yaml', 'path', 'url', 'copy']) expect(rule.text).toMatch(new RegExp(`\\b${tag}\\b`))
  expect(rule.text).toMatch(/one item per line/)
  expect(rule.text).toMatch(/inline backticks/)
  expect(rule.text).toMatch(/untagged fence|`text`/)
})

test('사람 없는 세션(claude -p)·화면 없는 세션 — 규칙 절을 붙이지 않는다. 도중에 붙어 화면이 생기면 붙인다', async ($, on) => {
  const w = world(on)
  expect((await ruleOf($, w.surfaces)).map(s => s.id)).toEqual(['intro', 'env'])            // session.start 전, 화면 0 — claude -p
  w.surfaces = ['terminal']
  expect((await ruleOf($, w.surfaces)).map(s => s.id)).toEqual(['intro', 'env', RULE])      // /reload-plugins 로 붙은 사람 세션
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: false })
  expect((await ruleOf($, w.surfaces)).map(s => s.id)).toEqual(['intro', 'env'])            // isInteractive false 가 화면 유무보다 앞선다
})

// ── 열기 버튼 — 항목이 디스크에 있는 경로면 복사 버튼 왼쪽에 📂 한 칸. 폴더는 그 폴더, 파일은 그 파일이 든 폴더를 그 파일을 선택한 채 연다 ──
type Stat = { kind: 'file' | 'dir'; real?: string }
const RUN_OK = { exitCode: 0, stdout: 'opened: x\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
/** 디스크 흉내 — known 에 있는 경로만 stat 이 답하고, 나머지는 ENOENT 로 거절한다. real 을 주면 그 경로가 실제로 닿는 곳(realPath)도 답한다. 누른 열기는 runs 에 쌓인다 */
function disk(on: On, known: Record<string, Stat>, env: Record<string, string>) {
  const d = { stats: [] as string[], runs: [] as string[][], fail: false, out: '' }
  // 시험 틀은 절대가 아닌 경로를 cwd 아래로 붙여 넘긴다 — Linux 틀에서 `C:\…` 가 그렇다. 드라이브 글자부터만 본다
  on('fs.stat', ($, e) => { const p = String((e as { path: string }).path).replace(/^.*?(?=[A-Za-z]:\\)/, ''); d.stats.push(p); const k = known[p]; if (!k) throw new Error(`ENOENT: ${p}`); return { value: { kind: k.kind, size: 0, mtimeMs: 0, isLink: false, ...(k.real ? { realPath: k.real } : {}) } } })
  on('env.get', ($, e) => ({ value: env[(e as { name: string }).name] }))
  on('process.run', ($, e) => { const argv = [...(e as { argv: readonly string[] }).argv]; d.runs.push(argv); return { value: d.fail ? { ...RUN_OK, exitCode: 2, stdout: '', stderr: 'open_dir.js: Windows 명령 실패(종료 1): explorer.exe\n' } : d.out ? { ...RUN_OK, stdout: d.out } : RUN_OK } })
  return d
}

testWsl('열기 버튼 — 있는 경로에만 📂 가 붙고, 폴더는 그 폴더·파일은 그 파일 경로를 open_dir.js 에 넘긴다. C:\\ 꼴은 /mnt/ 로, 없는 경로·URL·슬래시 명령엔 없다', async ($, on) => {
  const w = world(on)
  const d = disk(on, { '/home/t/proj': { kind: 'dir' }, '/home/t/proj/a.txt': { kind: 'file' }, '/mnt/c/Users/t/Desktop': { kind: 'dir' }, '/home/t/.claude/skills': { kind: 'dir' } }, { HOME: '/home/t' })
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    'Look here.', '',
    '```path', '/home/t/proj', '/home/t/proj/a.txt', '/nope/zz', 'C:\\Users\\t\\Desktop', '~/.claude/skills', '```', '',
    '```url', 'https://example.com/a', '```', '',
    '```copy', '/reload-plugins', '```', '',
    '```bash', 'ls /home/t/proj', '```',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(8)
  expect(count(full, /📂/g)).toBe(4)                                              // 폴더 · 파일 · C:\ 폴더 · ~ 폴더
  expect(full).toMatch(/1 {2}\/home\/t\/proj {2}📂 {1,2}Copy/)                       // 아이콘이 복사 버튼 왼쪽
  expect(full).toMatch(/3 {2}\/nope\/zz {2}Copy/)                                   // 없는 경로 — 아이콘 없음
  for (const k of ['open:1', 'open:2', 'open:4', 'open:5']) expect(await ui.find({ key: k })).toBeDefined()
  for (const k of ['open:3', 'open:6', 'open:7', 'open:8']) expect(await ui.find({ key: k })).toBeUndefined()
  expect(d.stats).not.toContain('https://example.com/a')                         // URL·셸 문장은 디스크에 묻지도 않는다
  expect(d.stats).not.toContain('ls /home/t/proj')
  // 누르면 — 폴더는 그 폴더, 파일은 그 파일(open_dir.js 가 든 폴더를 열고 선택한다). 장은 남고 복사도 그대로 된다
  await ui.press({ key: 'open:2' }); await w.clock.settle()
  expect(d.runs.length).toBe(1)
  expect(d.runs[0]![0]).toBe('node')
  expect(d.runs[0]![1]).toMatch(/[\\/]hooks[\\/]open_dir\.js$/)
  expect(d.runs[0]![2]).toBe('/home/t/proj/a.txt')
  await ui.press({ key: 'open:4' }); await w.clock.settle()
  expect(d.runs[1]![2]).toBe('/mnt/c/Users/t/Desktop')
  await ui.press({ key: 'open:5' }); await w.clock.settle()
  expect(d.runs[2]![2]).toBe('/home/t/.claude/skills')
  expect(await ui.find({ key: 'open:2' })).toBeDefined()
  expect(await ui.find({ key: 'copy:2' })).toBeDefined()
  await ui.press({ key: 'copy:2' }); await w.clock.settle()
  expect(w.copied).toEqual(['/home/t/proj/a.txt'])
  expect(w.toasts).toEqual(['opened: x', 'opened: x', 'opened: x'])            // 연 결과 한 줄이 toast 로
  // 못 열면 toast 한 줄
  d.fail = true
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  expect(w.toasts.length).toBe(4)
  expect(w.toasts[3]).toMatch(/explorer/)
  await ui.unmount()
})

test('열기 버튼 — Windows 세션(cwd 가 C:\\ 꼴)이면 /mnt/c/ 는 C:\\ 로, ~ 는 USERPROFILE 로, WSL 홈 경로는 열 수 없다', { options: { language: 'ko' } }, async ($, on) => {
  const w = world(on)
  const d = disk(on, { 'C:\\Users\\t\\Desktop': { kind: 'dir' }, 'C:\\x\\y.txt': { kind: 'file' }, 'C:\\Users\\t\\a': { kind: 'dir' } }, { USERPROFILE: 'C:\\Users\\t' })
  await $.session.start({ cwd: 'C:\\v\\x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = ['```path', '/mnt/c/Users/t/Desktop', 'C:\\x\\y.txt', '~\\a', '/home/t/proj', '```'].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /복사하기/g)).toBe(4)
  expect(count(full, /📂/g)).toBe(3)
  expect(await ui.find({ key: 'open:4' })).toBeUndefined()                      // WSL 홈 경로 — Windows 에선 어느 배포판인지 몰라 열지 않는다
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  expect(d.runs[0]![2]).toBe('C:\\Users\\t\\Desktop')
  await ui.press({ key: 'open:2' }); await w.clock.settle()
  expect(d.runs[1]![2]).toBe('C:\\x\\y.txt')
  await ui.press({ key: 'open:3' }); await w.clock.settle()
  expect(d.runs[2]![2]).toBe('C:\\Users\\t\\a')
  await ui.unmount()
})

testWsl('열기 버튼 — 파일 항목은 파일 경로를, 폴더 항목은 폴더 경로를 open_dir.js 에 넘긴다(그 파일을 탐색기에서 선택하려고)', async ($, on) => {
  const w = world(on)
  const d = disk(on, { '/home/t/proj': { kind: 'dir' }, '/home/t/proj/b c.md': { kind: 'file' } }, {})
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  await $.turn.complete(turn(['```path', '/home/t/proj/b c.md', '/home/t/proj/', '```'].join('\n'))); await w.clock.advance(2_000); await w.clock.settle()
  expect(count(textOf((await ui.drawn()) as Node), /📂/g)).toBe(2)
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  await ui.press({ key: 'open:2' }); await w.clock.settle()
  expect(d.runs.map(r => r[2])).toEqual(['/home/t/proj/b c.md', '/home/t/proj'])   // 파일은 그대로, 폴더는 끝의 / 를 뗀 그 폴더
  expect(d.runs.every(r => r.length === 3)).toBe(true)                              // 인자는 경로 하나뿐
  await ui.unmount()
})

testWsl('열기 버튼 — open_dir.js 가 찍은 결과 한 줄(앞으로 · 새 창 · 파일 선택)을 그대로 toast 로 보인다', { options: { language: 'ko' } }, async ($, on) => {
  const w = world(on)
  const d = disk(on, { '/home/t/proj': { kind: 'dir' }, '/home/t/proj/a.txt': { kind: 'file' } }, {})
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  await $.turn.complete(turn(['```path', '/home/t/proj', '/home/t/proj/a.txt', '```'].join('\n'))); await w.clock.advance(2_000); await w.clock.settle()
  d.out = 'opened: /home/t/proj (앞으로)\n'
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  d.out = 'some note\nopened: /home/t/proj/a.txt (새 창, 파일 선택)\n'
  await ui.press({ key: 'open:2' }); await w.clock.settle()
  expect(w.toasts).toEqual(['opened: /home/t/proj (앞으로)', 'opened: /home/t/proj/a.txt (새 창, 파일 선택)'])   // 마지막 줄 그대로
  expect(await ui.find({ key: 'open:1' })).toBeDefined()                             // 장은 그대로
  await ui.unmount()
})

// ── 같은 파일은 한 줄 — 경로 꼴 · file:// 주소 · /mnt/c/… · \\wsl.localhost\… · ~ 가 디스크의 같은 자리로 풀리면 장 하나로 합치고 번호를 다시 매긴다(사용자 요청 2026-10-30) ──

testWsl('같은 파일은 한 줄 — Windows 경로와 그 file:// 주소가 번갈아 온 여섯 항목이 세 장이 되고, 보이는 글·복사는 Windows 경로, 📂 는 그 파일', { options: { language: 'ko' } }, async ($, on) => {
  const w = world(on)
  const D = '/mnt/c/Users/t/Documents/보고 서'
  const d = disk(on, { [`${D}/a.html`]: { kind: 'file' }, [`${D}/b.html`]: { kind: 'file' }, [`${D}/c.html`]: { kind: 'file' } }, {})
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const pair = (f: string, url: string) => ['```path', `C:\\Users\\t\\Documents\\보고 서\\${f}`, '```', '```url', url, '```', '']
  const text = ['보고서 셋입니다.', '',
    ...pair('a.html', 'file:///C:/Users/t/Documents/%EB%B3%B4%EA%B3%A0%20%EC%84%9C/a.html'),
    ...pair('b.html', 'file:///C:/Users/t/Documents/보고%20서/b.html'),
    ...pair('c.html', 'file:///c:/Users/t/Documents/%EB%B3%B4%EA%B3%A0%20%EC%84%9C/c.html'),
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /복사하기/g)).toBe(3)                                         // 여섯 항목 → 세 장
  expect(count(full, /📂/g)).toBe(3)
  expect(full).toMatch(/1 {2}C:\\Users\\t\\Documents\\보고 서\\a\.html {2}📂 {1,2}복사하기/)
  expect(full).toMatch(/2 {2}C:\\Users\\t\\Documents\\보고 서\\b\.html {2}📂 {1,2}복사하기/)   // 번호를 다시 매긴다
  expect(full).toMatch(/3 {2}C:\\Users\\t\\Documents\\보고 서\\c\.html {2}📂 {1,2}복사하기/)
  expect(full).not.toMatch(/file:/)
  for (const k of ['copy:4', 'open:4', 'copy:6']) expect(await ui.find({ key: k })).toBeUndefined()
  await ui.press({ key: 'copy:2' }); await w.clock.settle()
  expect(w.copied).toEqual(['C:\\Users\\t\\Documents\\보고 서\\b.html'])          // 복사는 보이는 글
  await ui.press({ key: 'open:3' }); await w.clock.settle()
  expect(d.runs.map(r => r[2])).toEqual([`${D}/c.html`])                           // 그 파일 — 든 폴더를 열고 선택한다
  await ui.unmount()
})

testWsl('file:// 주소만 있어도 📂 — %20·한글 퍼센트 꼴을 풀어 디스크에 묻고, 주소가 먼저 와도 합친 줄은 Windows 경로를 보인다. https 는 묻지 않는다', async ($, on) => {
  const w = world(on)
  const d = disk(on, { '/mnt/c/Users/t/보고서/x y.md': { kind: 'file' }, '/mnt/c/Users/t/z.txt': { kind: 'file' }, '/mnt/c/Users/t/w.md': { kind: 'file' } }, {})
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    '```url', 'file:///C:/Users/t/%EB%B3%B4%EA%B3%A0%EC%84%9C/x%20y.md', 'file:///mnt/c/Users/t/z.txt', 'https://example.com/a', '```', '',
    '```url', 'file:///C:/Users/t/w.md', '```', '```path', 'C:\\Users\\t\\w.md', '```',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(4)
  expect(count(full, /📂/g)).toBe(3)
  expect(full).toMatch(/1 {2}file:\/\/\/C:\/Users\/t\/%EB%B3%B4%EA%B3%A0%EC%84%9C\/x%20y\.md {2}📂 {1,2}Copy/)   // 홀로 선 주소 — 글은 그대로
  expect(full).toMatch(/3 {2}https:\/\/example\.com\/a {2}Copy/)
  expect(full).toMatch(/4 {2}C:\\Users\\t\\w\.md {2}📂 {1,2}Copy/)                  // 주소가 먼저 왔어도 Windows 경로
  expect(await ui.find({ key: 'open:3' })).toBeUndefined()
  expect(await ui.find({ key: 'copy:5' })).toBeUndefined()
  expect(d.stats).not.toContain('https://example.com/a')
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  await ui.press({ key: 'open:2' }); await w.clock.settle()
  expect(d.runs.map(r => r[2])).toEqual(['/mnt/c/Users/t/보고서/x y.md', '/mnt/c/Users/t/z.txt'])   // 푼 경로를 넘긴다
  await ui.press({ key: 'copy:1' }); await w.clock.settle()
  await ui.press({ key: 'copy:4' }); await w.clock.settle()
  expect(w.copied).toEqual(['file:///C:/Users/t/%EB%B3%B4%EA%B3%A0%EC%84%9C/x%20y.md', 'C:\\Users\\t\\w.md'])
  await ui.unmount()
})

testWsl('같은 폴더도 한 줄 — /home · ~ · \\\\wsl.localhost · file:// 꼴이 같은 폴더면 하나. 다른 파일 둘은 둘이고, 실제로 닿는 곳(realPath)이 같은 링크는 합친다', async ($, on) => {
  const w = world(on)
  const d = disk(on, { '/home/t/proj': { kind: 'dir' }, '/home/t/proj/a.txt': { kind: 'file', real: '/home/t/proj/a.txt' }, '/home/t/proj/b.txt': { kind: 'file' }, '/home/t/link.txt': { kind: 'file', real: '/home/t/proj/a.txt' } }, { HOME: '/home/t' })
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  const text = [
    '```path', '/home/t/proj', '~/proj/', '\\\\wsl.localhost\\Ubuntu\\home\\t\\proj', '```',
    '```url', 'file://wsl.localhost/Ubuntu/home/t/proj', 'file:///home/t/proj/', '```',
    '```path', '/home/t/proj/a.txt', '/home/t/proj/b.txt', '/home/t/link.txt', '```',
  ].join('\n')
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await ui.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(3)                                             // 폴더 다섯 꼴 → 하나 · a · b(링크는 a 로)
  expect(count(full, /📂/g)).toBe(3)
  expect(full).toMatch(/1 {2}\\\\wsl\.localhost\\Ubuntu\\home\\t\\proj {2}📂 {1,2}Copy/)   // Windows 쪽 꼴을 보인다
  expect(full).toMatch(/2 {2}\/home\/t\/proj\/a\.txt {2}📂 {1,2}Copy/)
  expect(full).toMatch(/3 {2}\/home\/t\/proj\/b\.txt {2}📂 {1,2}Copy/)               // 다른 파일은 따로
  expect(full).not.toMatch(/link\.txt/)
  expect(await ui.find({ key: 'copy:4' })).toBeUndefined()
  await ui.press({ key: 'open:1' }); await w.clock.settle()
  await ui.press({ key: 'open:3' }); await w.clock.settle()
  expect(d.runs.map(r => r[2])).toEqual(['/home/t/proj', '/home/t/proj/b.txt'])
  await ui.press({ key: 'copy:1' }); await w.clock.settle()
  expect(w.copied).toEqual(['\\\\wsl.localhost\\Ubuntu\\home\\t\\proj'])
  await ui.unmount()
})

// ── 답변 쪽 번호도 같은 파일은 한 번호 — 디스크에 묻지 않고 글로 같은 자리(file:// 풀기·C:\ ↔ /mnt/c ↔ \\wsl.localhost)인 항목은 토스트 장과 같은 번호를 받는다 ──
const SIX = ['보고서 셋입니다.', '',
  ...[['a.html', 'file:///C:/Users/t/Documents/%EB%B3%B4%EA%B3%A0%20%EC%84%9C/a.html'], ['b.html', 'file:///C:/Users/t/Documents/보고%20서/b.html'], ['c.html', 'file:///c:/Users/t/Documents/%EB%B3%B4%EA%B3%A0%20%EC%84%9C/c.html']]
    .flatMap(([f, url]) => ['```path', `C:\\Users\\t\\Documents\\보고 서\\${f}`, '```', '', '```url', url!, '```', '']),
].join('\n')

test('답변 쪽 번호 — 캡처의 여섯 항목은 「▸ 복사 1」~「▸ 복사 3」 만, 주소 블록은 짝인 경로와 같은 번호. 뒤 토막만 그려져도 앞 토막의 같은 파일 번호를 받는다', { options: { language: 'ko' } }, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const band1 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  await $.turn.complete(turn(SIX)); await w.clock.advance(2_000); await w.clock.settle()
  expect(count(textOf((await band1.drawn()) as Node), /복사하기/g)).toBe(3)       // 디스크 없이도 세 장
  await band1.unmount()
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(SIX) })
  const drawn = JSON.stringify(await ui.drawn())
  for (const n of [1, 2, 3]) expect(count(drawn, new RegExp(`▸ 복사 ${n}\\\\n\`\`\``, 'g'))).toBe(2)   // 경로 블록과 주소 블록이 같은 번호
  expect(drawn).not.toMatch(/▸ 복사 [4-9]/)
  expect(drawn).toMatch(/▸ 복사 2\\n```url\\nfile:\/\/\/C:\/Users\/t\/Documents\/보고%20서\/b\.html/)
  await ui.unmount()
  const tail = SIX.slice(SIX.indexOf('```url\nfile:///C:/Users/t/Documents/보고%20서/b.html'))   // b 의 주소 블록부터 그려지는 토막
  const ui2 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(tail) })
  const drawn2 = JSON.stringify(await ui2.drawn())
  expect(drawn2).toMatch(/^[^▸]*▸ 복사 2\\n```url/)                                // 첫 번호는 앞 토막의 b 경로 번호
  expect(drawn2).toMatch(/▸ 복사 3\\n```path/)
  expect(drawn2).not.toMatch(/▸ 복사 [4-9]/)
  await ui2.unmount()
})

test('답변 쪽 번호 — 경로와 그 file:// 주소는 한 번호, 다른 파일 둘은 두 번호(디스크에 없어도 글로 가른다)', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: '/home/t/x', surface: 'terminal', isInteractive: true })
  const text = ['```path', 'C:\\Users\\t\\a.md', 'C:\\Users\\t\\b.md', '```', '', '```url', 'file:///c:/users/T/A.md', '```'].join('\n')
  const band1 = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...band(100, 80) })
  await $.turn.complete(turn(text)); await w.clock.advance(2_000); await w.clock.settle()
  const full = textOf((await band1.drawn()) as Node)
  expect(count(full, /Copy/g)).toBe(2)
  expect(full).toMatch(/1 {2}C:\\Users\\t\\a\.md {2}Copy/)
  expect(full).toMatch(/2 {2}C:\\Users\\t\\b\.md {2}Copy/)
  await band1.unmount()
  const ui = await $.ui.mount({ plugin: 'copy-toast', surface: 'terminal', ...message(text) })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toMatch(/▸ copy 1~2\\n```path\\n\(1\) C:\\\\Users\\\\t\\\\a\.md\\n\(2\) C:\\\\Users\\\\t\\\\b\.md/)   // 다른 파일 둘은 두 번호
  expect(drawn).toMatch(/▸ copy 1\\n```url\\nfile:/)                                 // 주소는 짝인 경로의 번호
  expect(drawn).not.toMatch(/▸ copy 3/)
  await ui.unmount()
})

// Windows 틀에서만 서는 시험 — 건너뛴 WSL 시나리오가 정확히 여섯인지. 모듈 밖 console.log 는 틀이 보여 주지 않아 시험으로 둔다
if (onWindows) test('WSL 세션 시나리오 6 건은 Windows 틀에서 돌지 않는다(등록 안 함) — 수를 센다', async () => { expect(skippedOnWindows).toBe(6) })
