export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
