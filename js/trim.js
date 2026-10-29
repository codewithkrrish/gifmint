/* Trim validation and clamping — pure, no DOM.
   A trim is { start, end } in seconds against a video of `duration`
   seconds. Invariants after clamping: 0 <= start < end <= duration,
   and the clip is at least 0.1s long (the smallest slice gif.js can
   meaningfully capture a frame from). */

export const MIN_CLIP_SECONDS = 0.1;

export function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampTrim(start, end, duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { start: 0, end: 0 };
  }
  let s = clampNumber(start, 0, duration);
  let e = clampNumber(end, 0, duration);
  if (e - s < MIN_CLIP_SECONDS) {
    // Prefer pushing the end forward; if there is no room, pull the
    // start back instead so the clip stays inside the video.
    if (s + MIN_CLIP_SECONDS <= duration) {
      e = s + MIN_CLIP_SECONDS;
    } else {
      s = duration - MIN_CLIP_SECONDS;
      e = duration;
    }
  }
  return { start: s, end: e };
}

export function trimDuration(start, end, duration) {
  const t = clampTrim(start, end, duration);
  return t.end - t.start;
}

export function isValidTrim(start, end, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return start >= 0 && end <= duration && end - start >= MIN_CLIP_SECONDS;
}

/* Snap a playback position to a trim edge: "set start/end to now". */
export function snapToPosition(position, duration) {
  return clampNumber(position, 0, duration);
}
