export interface VideoSettings {
  brightness: number; // -1 to 1, default 0
  contrast: number; // 0 to 2, default 1
  saturation: number; // 0 to 3, default 1

  // 0.00 to 0.20 (0%..20% from each edge), scales back to original resolution
  smartCrop: number;

  flipH: boolean;
  rotation: number; // 0, 90, 180, 270

  // Visual effects
  filmGrain: number; // 0..100
  fadeEnabled: boolean;
  fadeDuration: number; // 0.1..2.0 seconds

  watermarkText: string;
  watermarkX: number; // % 0-100
  watermarkY: number; // % 0-100
  watermarkSize: number; // font size

  // Watermark styling (preview uses CSS, render uses best-effort mapping)
  watermarkFontFamily: string;
  watermarkFontWeight: number; // 100..900
  watermarkFontStyle: "normal" | "italic";
  watermarkColor: string; // #RRGGBB
  watermarkOpacity: number; // 0..100

  // Image watermark (file is stored separately in app state)
  watermarkImageEnabled: boolean;
  watermarkImageX: number; // % 0-100 (point is centered)
  watermarkImageY: number; // % 0-100 (point is centered)
  watermarkImageScale: number; // 0.05..2.0 (relative to image size)
  watermarkImageOpacity: number; // 0..100

  playbackRate: number; // 0.95..1.05

  // Metadata & processing
  regenerateMetadata: boolean;
}

export type QueueStatus = "pending" | "processing" | "done" | "error";

export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  outputUrl?: string;
  errorMsg?: string;
}
