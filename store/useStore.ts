import { create } from "zustand";
import { QueueItem, VideoSettings } from "../types";

interface AppState {
  // System
  isFFmpegLoaded: boolean;
  setFFmpegLoaded: (loaded: boolean) => void;
  activeTab: "editor" | "queue" | "presets";
  setActiveTab: (tab: "editor" | "queue" | "presets") => void;

  // Editor State
  currentFile: File | null;
  setFile: (file: File | null) => void;

  // Watermark image (not part of presets)
  watermarkImageFile: File | null;
  watermarkImageUrl: string | null;
  setWatermarkImageFile: (file: File | null) => void;

  // Watermark font file for export (TTF/OTF; not part of presets)
  watermarkFontFile: File | null;
  setWatermarkFontFile: (file: File | null) => void;

  settings: VideoSettings;
  updateSettings: (settings: Partial<VideoSettings>) => void;
  setSettings: (settings: VideoSettings) => void;
  resetSettings: () => void;

  // Player UI (scrubber)
  playerCurrentTime: number;
  playerDuration: number;
  playerIsPlaying: boolean;
  setPlayerState: (
    s: Partial<
      Pick<AppState, "playerCurrentTime" | "playerDuration" | "playerIsPlaying">
    >,
  ) => void;
  seekRequest: number | null;
  requestSeek: (time: number) => void;
  clearSeekRequest: () => void;

  // Queue State
  queue: QueueItem[];
  addToQueue: (files: File[]) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  // Processing State
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  processingProgress: number; // 0 to 1
  setProcessingProgress: (progress: number) => void;
}

const DEFAULT_SETTINGS: VideoSettings = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  smartCrop: 0,
  flipH: false,
  rotation: 0,
  filmGrain: 0,
  fadeEnabled: false,
  fadeDuration: 0.5,
  watermarkText: "",
  watermarkX: 5,
  watermarkY: 5,
  watermarkSize: 24,
  watermarkFontFamily: "Arial",
  watermarkFontWeight: 700,
  watermarkFontStyle: "normal",
  watermarkColor: "#ffffff",
  watermarkOpacity: 100,

  watermarkImageEnabled: false,
  watermarkImageX: 5,
  watermarkImageY: 5,
  watermarkImageScale: 0.25,
  watermarkImageOpacity: 90,

  playbackRate: 1,
  regenerateMetadata: true,
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function asFiniteNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function sanitizeSettings(
  s: VideoSettings,
  hasWatermarkImage: boolean,
): VideoSettings {
  const rotation = [0, 90, 180, 270].includes(s.rotation) ? s.rotation : 0;

  const playbackRate = clamp(
    asFiniteNumber(s.playbackRate, DEFAULT_SETTINGS.playbackRate),
    0.95,
    1.05,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...s,
    brightness: clamp(asFiniteNumber(s.brightness, 0), -1, 1),
    contrast: clamp(asFiniteNumber(s.contrast, 1), 0, 2),
    saturation: clamp(asFiniteNumber(s.saturation, 1), 0, 3),

    smartCrop: clamp(asFiniteNumber(s.smartCrop, 0), 0, 0.2),
    flipH: Boolean(s.flipH),
    rotation,

    filmGrain: clamp(asFiniteNumber(s.filmGrain, 0), 0, 100),
    fadeEnabled: Boolean(s.fadeEnabled),
    fadeDuration: clamp(asFiniteNumber(s.fadeDuration, 0.5), 0.1, 2.0),

    watermarkText: String(s.watermarkText ?? ""),
    watermarkX: clamp(asFiniteNumber(s.watermarkX, 5), 0, 100),
    watermarkY: clamp(asFiniteNumber(s.watermarkY, 5), 0, 100),
    watermarkSize: clamp(asFiniteNumber(s.watermarkSize, 24), 8, 200),
    watermarkFontFamily: String(s.watermarkFontFamily ?? "Arial"),
    watermarkFontWeight: clamp(
      asFiniteNumber(s.watermarkFontWeight, 700),
      100,
      900,
    ),
    watermarkFontStyle: s.watermarkFontStyle === "italic" ? "italic" : "normal",
    watermarkColor: String(s.watermarkColor ?? "#ffffff"),
    watermarkOpacity: clamp(asFiniteNumber(s.watermarkOpacity, 100), 0, 100),

    watermarkImageEnabled: hasWatermarkImage
      ? Boolean(s.watermarkImageEnabled)
      : false,
    watermarkImageX: clamp(asFiniteNumber(s.watermarkImageX, 5), 0, 100),
    watermarkImageY: clamp(asFiniteNumber(s.watermarkImageY, 5), 0, 100),
    watermarkImageScale: clamp(
      asFiniteNumber(s.watermarkImageScale, 0.25),
      0.05,
      2.0,
    ),
    watermarkImageOpacity: clamp(
      asFiniteNumber(s.watermarkImageOpacity, 90),
      0,
      100,
    ),

    playbackRate,
    regenerateMetadata: Boolean(s.regenerateMetadata),
  };
}

export const useStore = create<AppState>((set) => ({
  isFFmpegLoaded: false,
  setFFmpegLoaded: (loaded) => set({ isFFmpegLoaded: loaded }),

  activeTab: "editor",
  setActiveTab: (tab) => set({ activeTab: tab }),

  currentFile: null,
  setFile: (file) =>
    set({ currentFile: file, settings: { ...DEFAULT_SETTINGS } }),

  watermarkImageFile: null,
  watermarkImageUrl: null,
  setWatermarkImageFile: (file) =>
    set((state) => {
      if (state.watermarkImageUrl) {
        try {
          URL.revokeObjectURL(state.watermarkImageUrl);
        } catch {
          // ignore
        }
      }

      if (!file) {
        return {
          watermarkImageFile: null,
          watermarkImageUrl: null,
          settings: { ...state.settings, watermarkImageEnabled: false },
        };
      }

      const url = URL.createObjectURL(file);
      return {
        watermarkImageFile: file,
        watermarkImageUrl: url,
        settings: { ...state.settings, watermarkImageEnabled: true },
      };
    }),

  watermarkFontFile: null,
  setWatermarkFontFile: (file) => set({ watermarkFontFile: file }),

  settings: { ...DEFAULT_SETTINGS },
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: sanitizeSettings(
        { ...state.settings, ...(newSettings as any) },
        Boolean(state.watermarkImageFile),
      ),
    })),
  setSettings: (settings) =>
    set((state) => ({
      settings: sanitizeSettings(
        { ...DEFAULT_SETTINGS, ...(settings as any) },
        Boolean(state.watermarkImageFile),
      ),
    })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),

  playerCurrentTime: 0,
  playerDuration: 0,
  playerIsPlaying: false,
  setPlayerState: (s) => set(s as any),
  seekRequest: null,
  requestSeek: (time) => set({ seekRequest: time }),
  clearSeekRequest: () => set({ seekRequest: null }),

  queue: [],
  addToQueue: (files) =>
    set((state) => {
      const newItems: QueueItem[] = files.map((f) => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        status: "pending",
        progress: 0,
      }));
      return { queue: [...state.queue, ...newItems] };
    }),
  updateQueueItem: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    })),
  removeFromQueue: (id) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),
  clearQueue: () => set({ queue: [] }),

  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  processingProgress: 0,
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
}));
