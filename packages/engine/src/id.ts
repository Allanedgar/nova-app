/**
 * ID generation for opportunities and trades.
 * Uses crypto.randomUUID when available, fallback to Math.random.
 */

let counter = 0;

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}-${counter}`;
}