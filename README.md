# GIFMint

I kept running into the same annoyance: I had a short video moment I
wanted to share as a GIF, and every converter I found either wanted an
upload, slapped a watermark on it, or capped the length behind a
paywall. So I built the version I wanted — open the page, drop in a
video, trim the exact seconds, and get a GIF back. The video never
leaves your device.

## What it does

- Video upload three ways: drag and drop, the file picker, or pasting
  a copied video file into the page. MP4 and WebM work best.
- A video preview player, plus trim controls that actually work
  together: start and end sliders, numeric second inputs, and
  quick-set buttons that mark the start or end at the current playback
  position. The selected clip length is shown live.
- A trimmed-segment preview that plays only your selected range,
  looped, so you can check the loop before encoding anything.
- Frame rate presets (5, 10, 15, 20 fps) plus a custom 1–30 fps input,
  output widths of 240, 320, 480 or 640 px with the height following
  the video's aspect ratio, a quality setting, and a loop toggle.
- Conversion in the browser with gif.js 0.2.0 (pinned, from jsDelivr):
  frames are captured from the video element onto a canvas at your
  chosen frame rate, then encoded by the gif.js worker. A progress bar
  covers capture and encoding, and Cancel stops a run.
- After conversion: a playback preview of the finished GIF, a
  download button, and the honest numbers — output size, frame count,
  dimensions, and a before/after comparison against the original file.
- Keyboard shortcuts: Space plays or pauses the trimmed segment, S
  sets the start, E sets the end, C converts. They stay quiet while
  you are typing in a field.
- A "How it works" strip and plain-language notes on the page about
  clip length, file size, and codec support, so nobody has to guess.

## Honest limitations

- gif.js is the bottleneck, and it shows. Encoding is single-threaded
  worker work in the browser: long clips, high frame rates and wide
  outputs get slow, and the tab holds frames in memory while it
  works. That is why the page recommends clips under about 15 seconds
  and warns past 30 seconds or 450 frames. A 60-second 4K clip will
  not be fun here — trim it down first.
- If the gif.js script or its worker cannot load (no connection, or a
  blocker in the way), conversion is unavailable and the page says
  so. There is no fallback encoder and no server to fall back to,
  because the whole point is that nothing uploads.
- Whether a video decodes at all depends on your browser's codecs,
  not on this page. MP4 and WebM cover nearly everything, but an
  unusual codec may load without playing; in that case another browser
  or a re-export as MP4 usually fixes it.
- GIFs have no audio track, so the result is always silent, and GIF
  compression is old enough that the output can be larger than the
  video it came from. The before/after line under each finished GIF
  shows that plainly instead of hiding it.
- Frame capture seeks through the video one frame at a time, so
  conversion needs the tab to stay open. Closing it mid-run loses the
  unfinished GIF; finished GIFs are only kept as a download, not
  stored anywhere.

## Run it locally

No build step, no dependencies to install — it is plain HTML, CSS and
JavaScript modules. Serve the folder over HTTP (ES modules do not run
from `file://` in most browsers) and open it:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000. The gif.js script and worker still
load from jsDelivr, so you need a connection for conversion itself.

## License

MIT — see LICENSE.
