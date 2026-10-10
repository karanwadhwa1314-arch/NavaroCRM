import { PROJECT_HEALTH_LEVELS, type CardStatus, type ProjectHealthLevel } from '@/lib/constants';

/** % of health lost for each missed 24h period on an unfinished card. */
export const HEALTH_PENALTY_PER_DAY = 5;
/** Health never drops below this; at this floor new cards can no longer be added. */
export const MIN_HEALTH = 20;
const MS_PER_DAY = 86_400_000;

interface HealthCard {
  deadline?: Date | string | null;
  status: CardStatus;
}

/**
 * A project starts at 100%. Every unfinished card past its deadline costs 5% for missing the deadline,
 * plus another 5% for each further full 24h it stays overdue. Done cards and cards without a deadline
 * never count. Result is clamped to MIN_HEALTH..100.
 */
export function calculateDeadlineHealth(cards: HealthCard[], now: Date = new Date()): number {
  const nowMs = now.getTime();
  let penalty = 0;

  for (const card of cards) {
    if (!card.deadline || card.status === 'done') continue;
    const msLate = nowMs - new Date(card.deadline).getTime();
    if (msLate <= 0) continue;
    penalty += (Math.floor(msLate / MS_PER_DAY) + 1) * HEALTH_PENALTY_PER_DAY;
  }

  return Math.max(MIN_HEALTH, 100 - penalty);
}

export function getHealthLevel(percentage: number): ProjectHealthLevel {
  if (percentage >= 100) return 'perfect';
  if (percentage >= 80) return 'good';
  if (percentage >= 40) return 'average';
  return 'critical';
}

export function emptyHealthSummary(): Record<ProjectHealthLevel, number> {
  return Object.fromEntries(PROJECT_HEALTH_LEVELS.map((l) => [l, 0])) as Record<ProjectHealthLevel, number>;
}
