export function sanitizeCode128(value: string) {
  return value.trim().replace(/[^\x20-\x7E]/g, "");
}

export function sanitizeQrValue(value: string) {
  return value.trim();
}

export function toReadableLabel(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" | ");
}
