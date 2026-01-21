# Video Transformation Studio (Web Edition)

A browser-based video editor that previews changes instantly (CSS/HTML overlays)
and **burns them into the exported file** using FFmpeg.wasm.

## Features

- **Dual-engine workflow**
  - Preview: HTML5 video + CSS transforms/overlays (fast, interactive)
  - Export: FFmpeg.wasm render (effects are baked into the output MP4)
- **Adjustments & effects**
  - Brightness / contrast / saturation
  - Flip + rotate
  - Smart crop (crop edges then scale back)
  - Film grain
  - Fade in/out
  - Speed (video + audio)
- **Watermarks**
  - Text watermark (drag to position)
  - Image watermark (upload + drag + scale + opacity)
  - **Export font upload (TTF/OTF)** so the exported watermark matches your
    chosen font
- **Batch queue**
  - Add multiple videos and process them sequentially
- **Presets**
  - Save/load settings as JSON

## Requirements

- Node.js 18+ recommended
- A modern Chromium-based browser (Chrome/Edge) for best FFmpeg.wasm performance

### COOP/COEP (SharedArrayBuffer)

The dev server is configured with COOP/COEP headers in
[vite.config.ts](vite.config.ts) to enable cross-origin isolation when needed.

If you deploy this app, your hosting must also send:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Getting started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## How export works

- The preview uses CSS and overlays so the UI stays responsive.
- On **Export**, the app runs FFmpeg.wasm in a Worker and writes inputs (video +
  optional watermark image + optional watermark font) into FFmpeg’s in-memory
  filesystem.
- A filter chain is generated from your settings, and FFmpeg renders an output MP4.

### Matching watermark fonts (important)

Browsers can render system fonts and web fonts, but FFmpeg.wasm **cannot access
your system fonts**.

To make the exported watermark match the preview:

1. Go to **Watermark → Text → Export Font (TTF/OTF)**
2. Upload the exact font file you want (ideally the specific variant, e.g.
   `MyFont-BoldItalic.ttf`)
3. Export again

If you only change the “Font” dropdown without uploading a font file, the export
will fall back to a default font.

## Troubleshooting

- **Export fails / output is 0 bytes**
  - Open DevTools Console and look for `[ffmpeg]` logs.
  - Very large videos can exceed browser memory limits.
- **Export is slow or appears stuck**
  - First run can be slower (FFmpeg core + wasm must be loaded).
  - Refresh the page if the Worker crashes.
- **Deployed site exports fail**
  - Ensure your host sends COOP/COEP headers (see above).

## Tech stack

- React + Vite + TypeScript
- Zustand for state management
- Tailwind CSS
- FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/core`)

## Notes & limitations

- This is a client-only app: videos are processed locally in your browser.
- Performance depends on your machine, input size, and browser.
- Some typography properties (like “fake” bold/italic) depend on the uploaded
  font variant; use real bold/italic font files for best results.
