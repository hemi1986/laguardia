/**
 * The injectable clock (ST-059): commands and time-based rules ask a clock for "now" instead of calling `new Date()`,
 * so tests can pin them to a fixed point in time. The time convention (Europe/Berlin, elapsed hours) is ST-003.
 */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(at: Date | string): Clock {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid time for fixedClock: ${String(at)}`);
  return { now: () => new Date(instant) };
}
