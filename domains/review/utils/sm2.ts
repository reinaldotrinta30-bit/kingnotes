export type ReviewConfidence = 'hard' | 'good' | 'easy';

export interface Sm2Input {
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
  confidence: ReviewConfidence;
  now?: number;
}

export interface Sm2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Implementação calibrada do algoritmo SM-2 (SuperMemo 2)
 * adaptada para botões de 3 níveis: Difícil, Bom e Fácil.
 */
export function calculateSm2({
  easeFactor = 2.5,
  intervalDays = 0,
  repetitions = 0,
  confidence,
  now = Date.now(),
}: Sm2Input): Sm2Result {
  // Mapeia confiança para escala de qualidade SM-2 (0–5)
  const quality = confidence === 'easy' ? 5 : confidence === 'good' ? 4 : 2;

  let nextEase = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEase < 1.3) nextEase = 1.3;
  nextEase = Math.round(nextEase * 100) / 100;

  let nextReps = repetitions;
  let nextInterval = intervalDays;

  if (confidence === 'hard') {
    // Reinicia sequência curta para reforço imediato no dia seguinte
    nextReps = 0;
    nextInterval = 1;
  } else if (confidence === 'good') {
    nextReps = repetitions + 1;
    if (nextReps === 1) nextInterval = 1;
    else if (nextReps === 2) nextInterval = 4;
    else nextInterval = Math.max(2, Math.round(intervalDays * nextEase));
  } else {
    // Fácil dá um bônus de aceleração (1.3x)
    nextReps = repetitions + 1;
    if (nextReps === 1) nextInterval = 4;
    else if (nextReps === 2) nextInterval = 8;
    else nextInterval = Math.max(4, Math.round(intervalDays * nextEase * 1.3));
  }

  return {
    easeFactor: nextEase,
    intervalDays: nextInterval,
    repetitions: nextReps,
    nextReviewAt: now + nextInterval * DAY_MS,
  };
}

export function formatIntervalLabel(days: number): string {
  if (days < 30) return `+${days}d`;
  const months = Math.round((days / 30) * 10) / 10;
  return `+${months}m`;
}