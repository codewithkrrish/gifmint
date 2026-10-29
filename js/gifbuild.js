/* gif.js option building and frame math — pure, no DOM.
   The only external dependency is gif.js, pinned below. Everything
   here can be unit-tested without a video element or a worker. */

export const GIFJS_VERSION = '0.2.0';
export const GIFJS_CDN = `https://cdn.jsdelivr.net/npm/gif.js@${GIFJS_VERSION}/dist/gif.js`;
export const GIFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/gif.js@${GIFJS_VERSION}/dist/gif.worker.js`;

export const FPS_PRESETS = [5, 10, 15, 20];
export const WIDTH_PRESETS = [240, 320, 480, 640];
export const MIN_FPS = 1;
export const MAX_FPS = 30;
export const RECOMMENDED_MAX_SECONDS = 15;
export const WARN_MAX_SECONDS = 30;
/* Above this many frames the browser tab starts to struggle: every
   frame is held as a canvas image while the worker encodes. */
export const WARN_MAX_FRAMES = 450;

export function clampFps(fps) {
  if (!Number.isFinite(fps)) return 10;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
}

export function clampWidth(width) {
  if (!Number.isFinite(width)) return 480;
  return Math.min(1280, Math.max(120, Math.round(width)));
}

/* Frame count for a clip: one frame per 1/fps seconds, at least one. */
export function frameCountFor(clipSeconds, fps) {
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) return 0;
  return Math.max(1, Math.round(clipSeconds * clampFps(fps)));
}

export function frameDelayMs(fps) {
  return Math.round(1000 / clampFps(fps));
}

/* Evenly spaced capture times inside [start, end). The last frame is
   never exactly `end`, so a looped preview and the GIF agree on the
   segment that was captured. */
export function frameTimes(start, end, fps) {
  const count = frameCountFor(end - start, fps);
  if (count === 0) return [];
  const step = (end - start) / count;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/* Preserve aspect ratio for a target output width. Heights are kept
   even: some encoders and players handle odd heights badly, and an
   even height costs nothing here. */
export function outputDimensions(srcWidth, srcHeight, targetWidth) {
  const width = clampWidth(targetWidth);
  if (!Number.isFinite(srcWidth) || !Number.isFinite(srcHeight)
    || srcWidth <= 0 || srcHeight <= 0) {
    return { width, height: width };
  }
  const height = Math.round((srcHeight / srcWidth) * width);
  return { width, height: height % 2 === 0 ? height : height + 1 };
}

export function gifOptions({ fps, quality, width, height, loop }) {
  return {
    workers: 2,
    quality: Number.isFinite(quality) ? Math.min(30, Math.max(1, Math.round(quality))) : 10,
    workerScript: GIFJS_WORKER_URL,
    width,
    height,
    repeat: loop ? 0 : -1,
    // Kept for callers that display settings: not a gif.js option.
    fps: clampFps(fps),
  };
}

export function clipWarning(clipSeconds, fps) {
  const frames = frameCountFor(clipSeconds, fps);
  if (clipSeconds > WARN_MAX_SECONDS || frames > WARN_MAX_FRAMES) {
    return 'This clip is long for browser GIF encoding: it may take a while and use a lot of memory. Trim it under 15 seconds for a fast, small result.';
  }
  if (clipSeconds > RECOMMENDED_MAX_SECONDS) {
    return 'Over the recommended 15 seconds — still fine, but the GIF will be larger and slower to encode.';
  }
  return '';
}
