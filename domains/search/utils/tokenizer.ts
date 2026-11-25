export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function buildSearchTokens(parts: Array<string | undefined | null>): string[] {
  const tokenSet = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const words = normalizeText(part)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2);
    for (const w of words) {
      tokenSet.add(w);
    }
  }
  // Limite de segurança por card para manter o índice enxuto em 100k+ notas
  return Array.from(tokenSet).slice(0, 250);
}