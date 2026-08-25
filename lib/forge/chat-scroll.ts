export type ForgeChatViewport = Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight" | "scrollTo">;

export function isForgeChatNearBottom(viewport: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">, threshold = 100) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
}

export function scrollForgeChatToLatest(viewport: ForgeChatViewport | null, behavior: ScrollBehavior) {
  if (!viewport) return;
  viewport.scrollTo({ top: viewport.scrollHeight, behavior });
}