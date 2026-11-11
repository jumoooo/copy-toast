// copy-toast 의 $.state 계약 — claude plugin validate 가 훅 모듈이 읽고 쓰는 키를 이것과 대조한다.
export type Phase = 'in' | 'show' | 'done' | 'out'
export type CopyItem = { n: number; text: string; head: string; phase: Phase }

declare module 'claude-code' {
  interface PluginState {
    'copy-toast': {
      /** 지금 떠 있는 토스트 장들(각자 단계를 쥔다) — 번호 매기기와 그리기가 같이 읽는다. 다 나가면 빈다 */
      items: CopyItem[]
      /** 번호를 붙일 답변 글 원문 — AssistantMessage 그리기가 자기 토막이 이 글의 어디인지 찾는다. 다음 답이 오면 바뀐다 */
      answer: string
    }
  }
}
