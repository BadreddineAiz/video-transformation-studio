import React from "react";
import { useStore } from "../store/useStore";
import { useVideoExport } from "../hooks/useVideoExport";
import {
  Sun,
  Contrast,
  Droplets,
  FlipHorizontal,
  RotateCw,
  Type,
  ImagePlus,
  X,
  Gauge,
  Download,
  Save,
  RotateCcw,
} from "lucide-react";

export const Controls: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetSettings,
    currentFile,
    watermarkImageFile,
    watermarkImageUrl,
    setWatermarkImageFile,
    watermarkFontFile,
    setWatermarkFontFile,
  } = useStore();

  const { exportCurrent, isFFmpegReady } = useVideoExport();

  const savePreset = () => {
    const blob = new Blob([JSON.stringify(settings)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preset.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const loadPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        updateSettings(json);
      } catch (err) {
        alert("Invalid preset file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Header / Actions */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <h2 className="font-semibold text-slate-200">Adjustments</h2>
        <div className="flex gap-2">
          <button
            onClick={resetSettings}
            title="Reset All"
            className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <label
            title="Load Preset"
            className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
          >
            <input
              type="file"
              className="hidden"
              accept="application/json,.json"
              onChange={loadPreset}
            />
            <UploadIcon className="w-4 h-4" />
          </label>

          <button
            onClick={savePreset}
            title="Save Preset"
            className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <Save className="w-4 h-4" />
          </button>

          <button
            onClick={() => void exportCurrent()}
            disabled={!currentFile || !isFFmpegReady}
            title={!isFFmpegReady ? "FFmpeg is loading..." : ""}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Color Grading */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Color Grading
        </h3>

        <ControlGroup
          label="Brightness"
          icon={<Sun className="w-4 h-4" />}
          value={settings.brightness}
          min={-1}
          max={1}
          step={0.1}
          onChange={(v) => updateSettings({ brightness: v })}
        />
        <ControlGroup
          label="Contrast"
          icon={<Contrast className="w-4 h-4" />}
          value={settings.contrast}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => updateSettings({ contrast: v })}
        />
        <ControlGroup
          label="Saturation"
          icon={<Droplets className="w-4 h-4" />}
          value={settings.saturation}
          min={0}
          max={3}
          step={0.1}
          onChange={(v) => updateSettings({ saturation: v })}
        />
      </div>

      {/* Framing & Transform */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Framing
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ flipH: !settings.flipH })}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded border ${settings.flipH ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}
          >
            <FlipHorizontal className="w-4 h-4" />
            <span className="text-sm">Flip H</span>
          </button>
          <button
            onClick={() =>
              updateSettings({ rotation: (settings.rotation + 90) % 360 })
            }
            className="flex-1 flex items-center justify-center gap-2 p-3 rounded border bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-sm">Rotate</span>
          </button>
        </div>

        <ControlGroup
          label="Smart Crop"
          icon={<span className="text-xs text-slate-400">%</span>}
          value={settings.smartCrop}
          min={0}
          max={0.2}
          step={0.01}
          displayValue={`${Math.round(settings.smartCrop * 100)}%`}
          onChange={(v) => updateSettings({ smartCrop: v })}
        />
      </div>

      {/* Visual Effects */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Effects
        </h3>

        <ControlGroup
          label="Film Grain"
          icon={<span className="text-xs text-slate-400">fx</span>}
          value={settings.filmGrain}
          min={0}
          max={100}
          step={1}
          onChange={(v) => updateSettings({ filmGrain: v })}
        />

        <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-sm text-slate-300">Fade In/Out</div>
          <input
            type="checkbox"
            checked={settings.fadeEnabled}
            onChange={(e) => updateSettings({ fadeEnabled: e.target.checked })}
          />
        </div>

        {settings.fadeEnabled && (
          <ControlGroup
            label="Fade Duration"
            icon={<span className="text-xs text-slate-400">s</span>}
            value={settings.fadeDuration}
            min={0.1}
            max={2.0}
            step={0.1}
            onChange={(v) => updateSettings({ fadeDuration: v })}
          />
        )}
      </div>

      {/* Watermark */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Watermark
        </h3>

        {/* Image Watermark */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Image
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!watermarkImageUrl}
                checked={Boolean(
                  settings.watermarkImageEnabled && watermarkImageUrl,
                )}
                onChange={(e) =>
                  updateSettings({ watermarkImageEnabled: e.target.checked })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm">
              <ImagePlus className="w-4 h-4" />
              {watermarkImageFile ? "Replace Image" : "Upload Image"}
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f) setWatermarkImageFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              type="button"
              disabled={!watermarkImageUrl}
              onClick={() => setWatermarkImageFile(null)}
              title="Remove"
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {watermarkImageUrl && (
            <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-800 rounded-lg p-3">
              <img
                src={watermarkImageUrl}
                alt="Watermark preview"
                className="w-14 h-14 object-contain bg-black/30 rounded"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200 truncate">
                  {watermarkImageFile?.name}
                </div>
                <div className="text-xs text-slate-500">
                  Drag it on the video to position
                </div>
              </div>
            </div>
          )}

          {watermarkImageUrl && settings.watermarkImageEnabled && (
            <>
              <ControlGroup
                label="Image Scale"
                icon={<span className="text-xs text-slate-400">x</span>}
                value={settings.watermarkImageScale}
                min={0.05}
                max={2.0}
                step={0.01}
                displayValue={`${Math.round((settings.watermarkImageScale || 0) * 100)}%`}
                onChange={(v) => updateSettings({ watermarkImageScale: v })}
              />
              <ControlGroup
                label="Image Opacity"
                icon={<span className="text-xs text-slate-400">%</span>}
                value={settings.watermarkImageOpacity}
                min={0}
                max={100}
                step={1}
                displayValue={`${Math.round(settings.watermarkImageOpacity || 0)}%`}
                onChange={(v) => updateSettings({ watermarkImageOpacity: v })}
              />
            </>
          )}
        </div>

        <div className="h-px bg-slate-800" />

        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Text
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-2 rounded border border-slate-700">
            <Type className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Enter watermark text..."
              className="bg-transparent border-none focus:outline-none text-sm w-full text-white placeholder-slate-500"
              value={settings.watermarkText}
              onChange={(e) =>
                updateSettings({ watermarkText: e.target.value })
              }
            />
          </div>
          <ControlGroup
            label="Size"
            icon={<Type className="w-4 h-4" />}
            value={settings.watermarkSize}
            min={12}
            max={72}
            step={1}
            onChange={(v) => updateSettings({ watermarkSize: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Font</div>
              <select
                value={settings.watermarkFontFamily}
                onChange={(e) =>
                  updateSettings({ watermarkFontFamily: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
              >
                {[
                  "Arial",
                  "Impact",
                  "Trebuchet MS",
                  "Georgia",
                  "Courier New",
                ].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">Color</div>
              <input
                type="color"
                value={settings.watermarkColor}
                onChange={(e) =>
                  updateSettings({ watermarkColor: e.target.value })
                }
                className="w-full h-9 bg-slate-800 border border-slate-700 rounded"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Export Font (TTF/OTF)
              </div>
              <button
                type="button"
                disabled={!watermarkFontFile}
                onClick={() => setWatermarkFontFile(null)}
                className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>

            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm">
              <Type className="w-4 h-4" />
              {watermarkFontFile ? "Replace Font" : "Upload Font"}
              <input
                type="file"
                className="hidden"
                accept=".ttf,.otf,font/ttf,font/otf,application/x-font-ttf,application/font-sfnt"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f) setWatermarkFontFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <div className="text-xs text-slate-500">
              FFmpeg cannot use your system fonts. To match export, upload the
              exact font file you want (e.g. the Italic/Bold variant).
            </div>

            {watermarkFontFile && (
              <div className="text-xs text-slate-300 truncate">
                Using:{" "}
                <span className="text-slate-200">{watermarkFontFile.name}</span>
              </div>
            )}
          </div>

          <ControlGroup
            label="Opacity"
            icon={<span className="text-xs text-slate-400">α</span>}
            value={settings.watermarkOpacity}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateSettings({ watermarkOpacity: v })}
          />

          <ControlGroup
            label="Weight"
            icon={<span className="text-xs text-slate-400">W</span>}
            value={settings.watermarkFontWeight}
            min={100}
            max={900}
            step={100}
            onChange={(v) => updateSettings({ watermarkFontWeight: v })}
          />

          <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
            <div className="text-sm text-slate-300">Italic</div>
            <input
              type="checkbox"
              checked={settings.watermarkFontStyle === "italic"}
              onChange={(e) =>
                updateSettings({
                  watermarkFontStyle: e.target.checked ? "italic" : "normal",
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Speed
        </h3>
        <ControlGroup
          label="Playback Speed"
          icon={<Gauge className="w-4 h-4" />}
          value={settings.playbackRate}
          min={0.95}
          max={1.05}
          step={0.01}
          onChange={(v) => updateSettings({ playbackRate: v })}
        />
      </div>

      {/* Metadata */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Metadata
        </h3>
        <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          <div>
            <div className="text-sm text-slate-300">Regenerate</div>
            <div className="text-xs text-slate-500">
              Remove original metadata and tag transformed
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.regenerateMetadata}
            onChange={(e) =>
              updateSettings({ regenerateMetadata: e.target.checked })
            }
          />
        </div>
      </div>

      {/* Export Button */}
      <div className="pt-6">
        <button
          onClick={() => void exportCurrent()}
          disabled={!currentFile || !isFFmpegReady}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all"
        >
          <Download className="w-5 h-5" />
          {isFFmpegReady ? "Export Video" : "Engine Loading..."}
        </button>
      </div>
    </div>
  );
};

const ControlGroup = ({
  label,
  icon,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
}: any) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-sm text-slate-400">
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-mono text-xs">
        {displayValue !== undefined ? displayValue : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
  </div>
);

// Helper for icon
const UploadIcon = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);
