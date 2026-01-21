import type { VideoSettings } from "../types";

export type SavedPreset = {
  id: string;
  name: string;
  createdAt: number;
  settings: VideoSettings;
};

const STORAGE_KEY = "vts.presets.v1";

export function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function savePresets(presets: SavedPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function createPreset(
  name: string,
  settings: VideoSettings,
): SavedPreset {
  return {
    id: Math.random().toString(36).slice(2),
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
    settings,
  };
}
