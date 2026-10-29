/* Size and ratio formatting — pure, no DOM. */

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.floor(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatPercent(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 'n/a';
  return `${Math.round((part / whole) * 100)}%`;
}

/* "X of the original" comparison line for the before/after readout. */
export function compareSizes(originalBytes, gifBytes) {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0
    || !Number.isFinite(gifBytes) || gifBytes < 0) {
    return 'Size comparison unavailable.';
  }
  const pct = formatPercent(gifBytes, originalBytes);
  if (gifBytes < originalBytes) {
    return `GIF is ${pct} of the original video file.`;
  }
  if (gifBytes > originalBytes) {
    return `GIF is larger than the original (${pct}) — GIFs compress poorly, so short, narrow clips stay smallest.`;
  }
  return 'GIF is the same size as the original.';
}
