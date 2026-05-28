export function computeServerOffset(serverTime: string, clientNow = Date.now()): number {
  return new Date(serverTime).getTime() - clientNow;
}

export function remainingMs(endedAt: string | undefined, offsetMs: number, clientNow = Date.now()): number {
  if (!endedAt) return 0;
  return Math.max(0, new Date(endedAt).getTime() - clientNow - offsetMs);
}
