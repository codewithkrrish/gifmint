/* GIFMint — DOM wiring. Pure logic lives in time.js, trim.js,
   format.js and gifbuild.js; this module only touches the page. */
import { formatTime, formatDuration } from './time.js';
import { clampTrim, trimDuration, snapToPosition, MIN_CLIP_SECONDS } from './trim.js';
import { formatBytes, compareSizes } from './format.js';
import {
  FPS_PRESETS, WIDTH_PRESETS, clampFps, frameCountFor, frameDelayMs,
  frameTimes, outputDimensions, gifOptions, clipWarning, GIFJS_WORKER_URL,
} from './gifbuild.js';

const $ = (id) => document.getElementById(id);

const els = {
  dropZone: $('dropZone'),
  fileInput: $('fileInput'),
  videoPlayer: $('videoPlayer'),
  videoEmptyNote: $('videoEmptyNote'),
  videoNameText: $('videoNameText'),
  videoMetaText: $('videoMetaText'),
  startRange: $('startRange'),
  endRange: $('endRange'),
  startInput: $('startInput'),
  endInput: $('endInput'),
  trimReadout: $('trimReadout'),
  clipDurationText: $('clipDurationText'),
  setStartBtn: $('setStartBtn'),
  setEndBtn: $('setEndBtn'),
  playTrimBtn: $('playTrimBtn'),
  fpsSelect: $('fpsSelect'),
  fpsCustomInput: $('fpsCustomInput'),
  widthSelect: $('widthSelect'),
  qualitySelect: $('qualitySelect'),
  loopToggle: $('loopToggle'),
  outputEstimateText: $('outputEstimateText'),
  trimWarningText: $('trimWarningText'),
  convertBtn: $('convertBtn'),
  cancelBtn: $('cancelBtn'),
  progressWrap: $('progressWrap'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),
  statusText: $('statusText'),
  resultWrap: $('resultWrap'),
  resultGif: $('resultGif'),
  resultMetaText: $('resultMetaText'),
  downloadBtn: $('downloadBtn'),
  convertAnotherBtn: $('convertAnotherBtn'),
  compareText: $('compareText'),
  originalSizeText: $('originalSizeText'),
};

const state = {
  duration: 0,
  start: 0,
  end: 0,
  originalBytes: 0,
  originalName: '',
  converting: false,
  cancelled: false,
  gif: null,
  resultUrl: null,
  trimPlaying: false,
  encodeWatchdog: null,
};

function clearEncodeWatchdog() {
  if (state.encodeWatchdog !== null) {
    window.clearInterval(state.encodeWatchdog);
    state.encodeWatchdog = null;
  }
}

function failEncode(message) {
  clearEncodeWatchdog();
  try { if (state.gif && typeof state.gif.abort === 'function') state.gif.abort(); } catch { /* ignore */ }
  state.gif = null;
  state.converting = false;
  els.convertBtn.disabled = false;
  els.cancelBtn.hidden = true;
  setStatus(message);
}

function safePlay() {
  try {
    const result = els.videoPlayer.play();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch { /* jsdom and autoplay policies: preview is best-effort */ }
}

function safePause() {
  try { els.videoPlayer.pause(); } catch { /* ignore */ }
}

function safeSeek(time) {
  try { els.videoPlayer.currentTime = time; } catch { /* ignore */ }
}

function currentFps() {
  if (els.fpsSelect.value === 'custom') return clampFps(Number(els.fpsCustomInput.value));
  return clampFps(Number(els.fpsSelect.value));
}

function currentWidth() {
  return Number(els.widthSelect.value);
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function syncTrimUI() {
  const t = clampTrim(state.start, state.end, state.duration);
  state.start = t.start;
  state.end = t.end;
  els.startRange.value = String(t.start);
  els.endRange.value = String(t.end);
  els.startInput.value = t.start.toFixed(1);
  els.endInput.value = t.end.toFixed(1);
  const clip = trimDuration(t.start, t.end, state.duration);
  els.trimReadout.textContent = `${formatTime(t.start)} to ${formatTime(t.end)}`;
  els.clipDurationText.textContent = `${formatDuration(clip)} selected`;
  updateEstimate();
}

function updateEstimate() {
  if (state.duration <= 0) {
    els.outputEstimateText.textContent = 'Load a video to see the frame estimate.';
    els.trimWarningText.textContent = '';
    els.trimWarningText.hidden = true;
    return;
  }
  const fps = currentFps();
  const clip = trimDuration(state.start, state.end, state.duration);
  const frames = frameCountFor(clip, fps);
  const dims = outputDimensions(
    els.videoPlayer.videoWidth || 0, els.videoPlayer.videoHeight || 0, currentWidth(),
  );
  els.outputEstimateText.textContent =
    `${frames} frames at ${fps} fps · ${dims.width} x ${dims.height} · ${formatDuration(clip)} clip`;
  const warning = clipWarning(clip, fps);
  els.trimWarningText.textContent = warning;
  els.trimWarningText.hidden = warning === '';
}

function setTrimFromInputs() {
  const t = clampTrim(Number(els.startInput.value), Number(els.endInput.value), state.duration);
  state.start = t.start;
  state.end = t.end;
  syncTrimUI();
}

function loadFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('video/')) {
    setStatus('That file does not look like a video. Please choose a video file (MP4 or WebM work best).');
    return;
  }
  try {
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  } catch { /* ignore */ }
  state.resultUrl = null;
  els.resultWrap.hidden = true;
  state.originalBytes = file.size || 0;
  state.originalName = file.name || 'video';
  state.converting = false;
  state.cancelled = false;
  els.cancelBtn.hidden = true;
  els.progressWrap.hidden = true;
  let url = '';
  try { url = URL.createObjectURL(file); } catch { url = ''; }
  if (url) els.videoPlayer.src = url;
  els.videoEmptyNote.hidden = true;
  els.videoNameText.textContent = state.originalName;
  els.originalSizeText.textContent = state.originalBytes
    ? `Original file: ${formatBytes(state.originalBytes)}`
    : 'Original file size unknown.';
  els.compareText.textContent = '';
  setStatus('Video loaded. Set the trim range, then press Convert to GIF.');
}

function onMetadata() {
  const duration = els.videoPlayer.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    setStatus('This video did not report a duration, so trimming is unavailable. Try another file.');
    return;
  }
  state.duration = duration;
  state.start = 0;
  state.end = duration;
  for (const slider of [els.startRange, els.endRange]) {
    slider.max = String(duration);
    slider.step = '0.1';
    slider.disabled = false;
  }
  els.startInput.disabled = false;
  els.endInput.disabled = false;
  els.setStartBtn.disabled = false;
  els.setEndBtn.disabled = false;
  els.playTrimBtn.disabled = false;
  els.convertBtn.disabled = false;
  const vw = els.videoPlayer.videoWidth || 0;
  const vh = els.videoPlayer.videoHeight || 0;
  els.videoMetaText.textContent = vw && vh
    ? `${formatDuration(duration)} · ${vw} x ${vh} source`
    : `${formatDuration(duration)} source`;
  syncTrimUI();
  setStatus('Video ready. Drag the trim sliders or use the quick-set buttons, then convert.');
}

function playTrimPreview() {
  if (state.duration <= 0) return;
  safeSeek(state.start);
  safePlay();
  state.trimPlaying = true;
  els.playTrimBtn.textContent = 'Pause preview';
}

function pauseTrimPreview() {
  safePause();
  state.trimPlaying = false;
  els.playTrimBtn.textContent = 'Play trimmed segment';
}

function waitForSeek() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      els.videoPlayer.removeEventListener('seeked', finish);
      resolve();
    };
    els.videoPlayer.addEventListener('seeked', finish);
    window.setTimeout(finish, 2000);
  });
}

async function convert() {
  if (state.converting || state.duration <= 0) return;
  if (typeof window.GIF === 'undefined') {
    setStatus('The GIF encoder library (gif.js) did not load — check your connection and reload the page. Nothing was uploaded; the encoder runs from a CDN script.');
    return;
  }
  const t = clampTrim(state.start, state.end, state.duration);
  state.start = t.start;
  state.end = t.end;
  const fps = currentFps();
  const dims = outputDimensions(
    els.videoPlayer.videoWidth || 0, els.videoPlayer.videoHeight || 0, currentWidth(),
  );
  const { fps: _ignored, ...options } = gifOptions({
    fps, quality: Number(els.qualitySelect.value), width: dims.width,
    height: dims.height, loop: els.loopToggle.checked,
  });
  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    setStatus('Canvas is unavailable in this browser, so frames cannot be captured.');
    return;
  }
  state.converting = true;
  state.cancelled = false;
  els.convertBtn.disabled = true;
  els.cancelBtn.hidden = false;
  els.progressWrap.hidden = false;
  els.progressBar.style.width = '0%';
  els.progressText.textContent = 'Capturing frames…';
  setStatus('Converting — capturing frames, then encoding. Keep this tab open.');
  safePause();
  state.trimPlaying = false;
  els.playTrimBtn.textContent = 'Play trimmed segment';

  /* gif.js runs its encoder in a Web Worker, and browsers refuse
     cross-origin worker scripts — so the CDN worker URL stalls
     encoding forever with no error. Fetch the worker source
     (jsDelivr serves it with open CORS) and run it from a
     same-origin blob URL instead. If the fetch fails, keep the CDN
     URL and let the watchdog below surface a clear error rather
     than hanging. */
  let workerScript = options.workerScript;
  try {
    const res = await fetch(GIFJS_WORKER_URL);
    if (res.ok) {
      const text = await res.text();
      workerScript = URL.createObjectURL(
        new Blob([text], { type: 'application/javascript' }),
      );
    }
  } catch { /* fall through to the CDN URL + watchdog */ }
  let gif;
  try {
    gif = new window.GIF({ ...options, workerScript });
  } catch (err) {
    state.converting = false;
    els.convertBtn.disabled = false;
    els.cancelBtn.hidden = true;
    setStatus(`The GIF encoder could not start: ${err && err.message ? err.message : 'worker failed to load'}. Reload the page and try a shorter clip.`);
    return;
  }
  state.gif = gif;
  const times = frameTimes(t.start, t.end, fps);
  const delay = frameDelayMs(fps);
  try {
    for (let i = 0; i < times.length; i += 1) {
      if (state.cancelled) break;
      safeSeek(times[i]);
      // eslint-disable-next-line no-await-in-loop
      await waitForSeek();
      if (state.cancelled) break;
      ctx.drawImage(els.videoPlayer, 0, 0, dims.width, dims.height);
      gif.addFrame(ctx, { copy: true, delay });
      els.progressText.textContent = `Capturing frames… ${i + 1} of ${times.length}`;
      els.progressBar.style.width = `${Math.round(((i + 1) / times.length) * 50)}%`;
    }
  } catch (err) {
    state.converting = false;
    els.convertBtn.disabled = false;
    els.cancelBtn.hidden = true;
    setStatus(`Conversion failed while capturing frames: ${err && err.message ? err.message : 'unknown error'}. Try a shorter clip or a smaller width.`);
    return;
  }
  if (state.cancelled) {
    finishCancelled();
    return;
  }
  els.progressText.textContent = 'Encoding GIF…';
  let lastEncodeProgress = Date.now();
  gif.on('progress', (p) => {
    lastEncodeProgress = Date.now();
    els.progressBar.style.width = `${Math.round(50 + p * 50)}%`;
    els.progressText.textContent = `Encoding GIF… ${Math.round(p * 100)}%`;
  });
  /* Never hang silently: if the encoder reports nothing for 60
     seconds, it is stalled (e.g. its worker never started) — abort
     and say so instead of leaving the bar frozen at half. */
  clearEncodeWatchdog();
  state.encodeWatchdog = window.setInterval(() => {
    if (!state.converting || state.cancelled) { clearEncodeWatchdog(); return; }
    if (Date.now() - lastEncodeProgress > 60000) {
      failEncode('Encoding stalled — the encoder worker did not report progress for 60 seconds. Reload the page and try again with a shorter clip or a smaller width.');
    }
  }, 10000);
  gif.on('finished', (blob) => {
    clearEncodeWatchdog();
    if (state.cancelled) { finishCancelled(); return; }
    state.converting = false;
    els.convertBtn.disabled = false;
    els.cancelBtn.hidden = true;
    els.progressBar.style.width = '100%';
    els.progressText.textContent = 'Done.';
    let url = '';
    try { url = URL.createObjectURL(blob); } catch { url = ''; }
    state.resultUrl = url;
    if (url) els.resultGif.src = url;
    const base = state.originalName.replace(/\.[^.]*$/, '') || 'gifmint';
    els.downloadBtn.href = url;
    els.downloadBtn.setAttribute('download', `${base}.gif`);
    els.resultMetaText.textContent =
      `${dims.width} x ${dims.height} · ${times.length} frames at ${fps} fps · ${formatBytes(blob.size)}`;
    els.compareText.textContent = compareSizes(state.originalBytes, blob.size);
    els.resultWrap.hidden = false;
    setStatus('GIF ready below. Play it back, then download it.');
  });
  gif.render();
}

function finishCancelled() {
  clearEncodeWatchdog();
  state.converting = false;
  state.gif = null;
  els.convertBtn.disabled = false;
  els.cancelBtn.hidden = true;
  els.progressWrap.hidden = true;
  setStatus('Conversion cancelled. Your trim settings are unchanged — convert again any time.');
}

/* Wiring */
els.videoPlayer.addEventListener('loadedmetadata', onMetadata);
els.videoPlayer.addEventListener('timeupdate', () => {
  if (!state.trimPlaying || state.duration <= 0) return;
  try {
    if (els.videoPlayer.currentTime >= state.end - 0.05) {
      safeSeek(state.start);
      safePlay();
    }
  } catch { /* ignore */ }
});
els.videoPlayer.addEventListener('pause', () => {
  if (state.trimPlaying) {
    state.trimPlaying = false;
    els.playTrimBtn.textContent = 'Play trimmed segment';
  }
});

els.fileInput.addEventListener('change', () => loadFile(els.fileInput.files && els.fileInput.files[0]));
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  els.dropZone.classList.add('dragging');
});
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('dragging'));
els.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  els.dropZone.classList.remove('dragging');
  loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const items = (e.clipboardData && e.clipboardData.files) || [];
  if (items.length > 0) loadFile(items[0]);
});

els.startRange.addEventListener('input', () => {
  state.start = Number(els.startRange.value);
  syncTrimUI();
});
els.endRange.addEventListener('input', () => {
  state.end = Number(els.endRange.value);
  syncTrimUI();
});
els.startInput.addEventListener('change', setTrimFromInputs);
els.endInput.addEventListener('change', setTrimFromInputs);
els.setStartBtn.addEventListener('click', () => {
  try { state.start = snapToPosition(els.videoPlayer.currentTime, state.duration); } catch { /* ignore */ }
  syncTrimUI();
});
els.setEndBtn.addEventListener('click', () => {
  try { state.end = snapToPosition(els.videoPlayer.currentTime, state.duration); } catch { /* ignore */ }
  syncTrimUI();
});
els.playTrimBtn.addEventListener('click', () => {
  if (state.trimPlaying) pauseTrimPreview();
  else playTrimPreview();
});
els.fpsSelect.addEventListener('change', () => {
  els.fpsCustomInput.disabled = els.fpsSelect.value !== 'custom';
  updateEstimate();
});
els.fpsCustomInput.addEventListener('input', updateEstimate);
els.widthSelect.addEventListener('change', updateEstimate);
els.qualitySelect.addEventListener('change', updateEstimate);
els.convertBtn.addEventListener('click', convert);
els.cancelBtn.addEventListener('click', () => {
  state.cancelled = true;
  try { if (state.gif && typeof state.gif.abort === 'function') state.gif.abort(); } catch { /* ignore */ }
  if (!state.converting) finishCancelled();
  else {
    setStatus('Cancelling…');
    /* gif.js abort can itself stall when its workers never
       started — never leave the user stuck on "Cancelling…". */
    window.setTimeout(() => {
      if (state.cancelled && state.converting) finishCancelled();
    }, 1500);
  }
});
els.convertAnotherBtn.addEventListener('click', () => {
  els.resultWrap.hidden = true;
  setStatus('Ready to convert again with the same video and trim.');
});
document.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target && target.closest && target.closest('input, select, textarea, button')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.duration > 0) {
      if (state.trimPlaying) pauseTrimPreview();
      else playTrimPreview();
    }
  } else if (e.key === 's' || e.key === 'S') {
    if (state.duration > 0) {
      try { state.start = snapToPosition(els.videoPlayer.currentTime, state.duration); } catch { /* ignore */ }
      syncTrimUI();
    }
  } else if (e.key === 'e' || e.key === 'E') {
    if (state.duration > 0) {
      try { state.end = snapToPosition(els.videoPlayer.currentTime, state.duration); } catch { /* ignore */ }
      syncTrimUI();
    }
  } else if (e.key === 'c' || e.key === 'C') {
    if (!els.convertBtn.disabled) convert();
  }
});

/* Populate selects from the same constants the logic module exports,
   so the page and the tests can never drift apart. */
for (const fps of FPS_PRESETS) {
  const option = document.createElement('option');
  option.value = String(fps);
  option.textContent = `${fps} fps`;
  if (fps === 10) option.selected = true;
  els.fpsSelect.appendChild(option);
}
{
  const option = document.createElement('option');
  option.value = 'custom';
  option.textContent = 'Custom…';
  els.fpsSelect.appendChild(option);
}
for (const width of WIDTH_PRESETS) {
  const option = document.createElement('option');
  option.value = String(width);
  option.textContent = `${width} px wide`;
  if (width === 480) option.selected = true;
  els.widthSelect.appendChild(option);
}
