export type PunchQrData = {
  v: 1;
  terminalId: string;
  token: string;
};

export function parsePunchQrPayload(raw: string): { terminalId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const o = JSON.parse(trimmed) as Partial<PunchQrData>;
    if (o.v === 1 && typeof o.terminalId === 'string' && typeof o.token === 'string') {
      return { terminalId: o.terminalId, token: o.token };
    }
  } catch {
    /* ignore */
  }
  return null;
}
