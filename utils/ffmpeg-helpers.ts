import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { VideoSettings } from "../types";

const DRAWTEXT_FONT_PATH = "/wm_font.ttf";
let lastLoadedFontKey: string | null = null;

function escapeDrawtextText(text: string): string {
  // drawtext parsing is picky; keep this conservative.
  // - escape ':' which is a key/value separator
  // - drop single quotes to avoid breaking text='...'
  return text.replace(/:/g, "\\:").replace(/'/g, "");
}

export async function ensureDrawtextFont(
  ffmpeg: FFmpeg,
  fontFile?: File | null,
): Promise<void> {
  const key = fontFile
    ? `${fontFile.name}:${fontFile.size}:${fontFile.lastModified}`
    : "__default__";

  if (lastLoadedFontKey === key) return;

  try {
    if (fontFile) {
      await ffmpeg.writeFile(DRAWTEXT_FONT_PATH, await fetchFile(fontFile));
      lastLoadedFontKey = key;
      return;
    }

    // Fallback font (best-effort). Note: this won't match system fonts.
    const fontUrl =
      "https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf";
    await ffmpeg.writeFile(DRAWTEXT_FONT_PATH, await fetchFile(fontUrl));
    lastLoadedFontKey = key;
  } catch (e) {
    // Not fatal: only watermark-text would fail.
    console.warn("Could not load font; watermark text may fail", e);
  }
}

export function buildVideoFilterChain(settings: VideoSettings): string[] {
  const filters: string[] = [];

  // Color grading
  filters.push(
    `eq=brightness=${settings.brightness}:contrast=${settings.contrast}:saturation=${settings.saturation}`,
  );

  // Framing
  if (settings.flipH) filters.push("hflip");

  // Rotation
  if (settings.rotation === 90) filters.push("transpose=1");
  if (settings.rotation === 180) filters.push("transpose=1,transpose=1");
  if (settings.rotation === 270) filters.push("transpose=2");

  // Smart crop: remove % from all edges and scale back.
  if (settings.smartCrop > 0) {
    const p = Math.max(0, Math.min(0.2, settings.smartCrop));
    const keep = 1 - 2 * p;

    filters.push(`crop=iw*${keep}:ih*${keep}:iw*${p}:ih*${p}`);
    // After crop: iw/ih are the cropped dims, so scale by 1/keep to restore original.
    filters.push(`scale=iw/${keep}:ih/${keep}`);
  }

  // Film grain
  if (settings.filmGrain > 0) {
    const strength = Math.max(0, Math.min(100, settings.filmGrain));
    filters.push(`noise=alls=${strength}:allf=t+u`);
  }

  // Watermark (text only, for now)
  if (settings.watermarkText) {
    const safeText = escapeDrawtextText(settings.watermarkText);
    // Match preview semantics: X/Y represent the center point.
    const x = `(w*${settings.watermarkX / 100}-text_w/2)`;
    const y = `(h*${settings.watermarkY / 100}-text_h/2)`;

    const hex = (settings.watermarkColor || "#ffffff").replace("#", "");
    const alpha =
      Math.max(0, Math.min(100, settings.watermarkOpacity ?? 100)) / 100;
    const fontColor = `0x${hex}@${alpha}`;

    filters.push(
      `drawtext=fontfile=${DRAWTEXT_FONT_PATH}:text='${safeText}':x=${x}:y=${y}:fontsize=${settings.watermarkSize}:fontcolor=${fontColor}:shadowcolor=black@${Math.min(1, alpha + 0.2)}:shadowx=2:shadowy=2`,
    );
  }

  // Speed (video)
  if (settings.playbackRate !== 1) {
    const rate = settings.playbackRate;
    filters.push(`setpts=PTS/${rate}`);
  }

  // H.264 (yuv420p) requires even dimensions. Some operations (crop/scale)
  // can produce odd sizes (e.g. 720x959) which makes libx264 fail.
  filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");

  return filters;
}

export function buildAudioFilterChain(settings: VideoSettings): string[] {
  const audioFilters: string[] = [];

  if (settings.playbackRate !== 1) {
    let rate = settings.playbackRate;

    // atempo supports 0.5..2.0; chain if needed.
    while (rate > 2.0) {
      audioFilters.push("atempo=2.0");
      rate /= 2.0;
    }

    while (rate < 0.5) {
      audioFilters.push("atempo=0.5");
      rate /= 0.5;
    }

    audioFilters.push(`atempo=${rate}`);
  }

  return audioFilters;
}

export function generateFFmpegArgs(
  inputName: string,
  outputName: string,
  settings: VideoSettings,
  opts?: {
    inputDurationSec?: number;
    nowIso?: string;
    watermarkImageInputName?: string;
  },
): string[] {
  const videoFilters = buildVideoFilterChain(settings);
  const audioFilters = buildAudioFilterChain(settings);

  const args: string[] = ["-i", inputName];

  // Fades (applied after speed changes, so timestamps are in output time)
  if (settings.fadeEnabled && settings.fadeDuration > 0) {
    const d = Math.max(0.1, Math.min(2.0, settings.fadeDuration));
    videoFilters.push(`fade=t=in:st=0:d=${d}`);

    const inputDurationSec = opts?.inputDurationSec ?? 0;
    if (inputDurationSec > 0) {
      const outDuration = inputDurationSec / (settings.playbackRate || 1);
      const st = Math.max(0, outDuration - d);
      videoFilters.push(`fade=t=out:st=${st}:d=${d}`);
    }
  }

  const watermarkImageInputName =
    settings.watermarkImageEnabled && opts?.watermarkImageInputName
      ? opts.watermarkImageInputName
      : undefined;

  if (watermarkImageInputName) {
    // Second input is an image watermark.
    // Apply base filters to the main video, then overlay the image (centered at X/Y%).
    args.push("-i", watermarkImageInputName);

    const base = videoFilters.length > 0 ? videoFilters.join(",") : "null";
    const alpha =
      Math.max(0, Math.min(100, settings.watermarkImageOpacity ?? 100)) / 100;
    const scale = Math.max(
      0.05,
      Math.min(2.0, settings.watermarkImageScale ?? 0.25),
    );
    const x = `W*${settings.watermarkImageX / 100}-w/2`;
    const y = `H*${settings.watermarkImageY / 100}-h/2`;

    const filterComplex =
      `[0:v]${base}[v0];` +
      `[1:v]format=rgba,colorchannelmixer=aa=${alpha},scale=iw*${scale}:ih*${scale}[wm];` +
      `[v0][wm]overlay=x=${x}:y=${y}:format=auto[v]`;

    args.push("-filter_complex", filterComplex);
    args.push("-map", "[v]");
    args.push("-map", "0:a?");
  } else {
    if (videoFilters.length > 0) args.push("-vf", videoFilters.join(","));
  }

  if (audioFilters.length > 0) args.push("-af", audioFilters.join(","));

  // Metadata regeneration
  if (settings.regenerateMetadata) {
    const nowIso = opts?.nowIso ?? new Date().toISOString();
    args.push("-map_metadata", "-1");
    args.push("-metadata", `creation_time=${nowIso}`);
    args.push("-metadata", "comment=transformed");
  }

  // Keep it fast for in-browser rendering.
  args.push("-preset", "ultrafast");

  // Prefer browser-friendly H.264 output.
  args.push("-pix_fmt", "yuv420p");
  args.push(outputName);

  return args;
}
