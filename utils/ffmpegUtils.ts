import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { VideoSettings } from "../types";

export class FFmpegService {
  private static instance: FFmpegService;
  private ffmpeg: FFmpeg;
  private fontLoaded: boolean = false;

  private constructor() {
    this.ffmpeg = new FFmpeg();
  }

  public static getInstance(): FFmpegService {
    if (!FFmpegService.instance) {
      FFmpegService.instance = new FFmpegService();
    }
    return FFmpegService.instance;
  }

  public async load() {
    if (this.ffmpeg.loaded) return;

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpegBaseURL = "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm";

    // Create a Blob URL for the worker to bypass cross-origin restrictions.
    // We import the worker from the CDN inside this blob.
    // The relative imports inside the remote worker.js will resolve correctly against the CDN.
    const workerBlob = new Blob([`import "${ffmpegBaseURL}/worker.js";`], {
      type: "text/javascript",
    });
    const workerLoadURL = URL.createObjectURL(workerBlob);

    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
      workerURL: workerLoadURL,
    });
  }

  public getFFmpeg(): FFmpeg {
    return this.ffmpeg;
  }

  public async loadFont() {
    if (this.fontLoaded) return;
    try {
      // Load a default font for drawtext
      const fontUrl =
        "https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf";
      await this.ffmpeg.writeFile("/tmp/arial.ttf", await fetchFile(fontUrl));
      this.fontLoaded = true;
    } catch (e) {
      console.warn("Could not load font, watermark text might fail", e);
    }
  }
}

export const generateFFmpegCommand = (
  inputName: string,
  outputName: string,
  settings: VideoSettings,
): string[] => {
  const filters: string[] = [];

  // Color Grading: eq=brightness=...:contrast=...:saturation=...
  // FFmpeg eq: brightness [-1,1], contrast [0,2], saturation [0,3]
  // Our settings map directly as we set UI sliders to these ranges
  const eqFilter = `eq=brightness=${settings.brightness}:contrast=${settings.contrast}:saturation=${settings.saturation}`;
  filters.push(eqFilter);

  // Framing
  if (settings.flipH) {
    filters.push("hflip");
  }

  // Rotation (transpose)
  if (settings.rotation === 90) filters.push("transpose=1");
  if (settings.rotation === 180) filters.push("transpose=1,transpose=1");
  if (settings.rotation === 270) filters.push("transpose=2");

  // Watermark
  if (settings.watermarkText) {
    const safeText = settings.watermarkText
      .replace(/:/g, "\\:")
      .replace(/'/g, "");
    const x = `w*${settings.watermarkX / 100}`;
    const y = `h*${settings.watermarkY / 100}`;
    filters.push(
      `drawtext=fontfile=/tmp/arial.ttf:text='${safeText}':x=${x}:y=${y}:fontsize=${settings.watermarkSize}:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`,
    );
  }

  // Speed
  if (settings.playbackRate !== 1) {
    const rate = settings.playbackRate;
    filters.push(`setpts=PTS/${rate}`);
  }

  // Audio Speed
  const audioFilters: string[] = [];
  if (settings.playbackRate !== 1) {
    let rate = settings.playbackRate;
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

  const args = ["-i", inputName];

  if (filters.length > 0) {
    args.push("-vf", filters.join(","));
  }

  if (audioFilters.length > 0) {
    args.push("-af", audioFilters.join(","));
  }

  args.push("-preset", "ultrafast");
  args.push(outputName);

  return args;
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
