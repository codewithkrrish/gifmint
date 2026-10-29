/* Time formatting — pure, no DOM. */

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const totalTenths = Math.floor(seconds * 10);
  const minutes = Math.floor(totalTenths / 600);
  const wholeSeconds = Math.floor(totalTenths / 10) % 60;
  const tenths = totalTenths % 10;
  return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0.0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}m ${rest.toFixed(1)}s`;
}
