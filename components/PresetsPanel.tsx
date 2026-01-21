import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  createPreset,
  loadPresets,
  savePresets,
  type SavedPreset,
} from "../utils/presets";
import { Download, Trash2, Upload } from "lucide-react";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}

export const PresetsPanel: React.FC = () => {
  const { settings, setSettings } = useStore();
  const [name, setName] = useState("");
  const [presets, setPresets] = useState<SavedPreset[]>([]);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const sorted = useMemo(
    () => [...presets].sort((a, b) => b.createdAt - a.createdAt),
    [presets],
  );

  const persist = (next: SavedPreset[]) => {
    setPresets(next);
    savePresets(next);
  };

  const onSave = () => {
    const p = createPreset(name || "Preset", settings);
    persist([p, ...presets]);
    setName("");
  };

  const onDelete = (id: string) => {
    persist(presets.filter((p) => p.id !== id));
  };

  const onApply = (p: SavedPreset) => {
    setSettings(p.settings);
  };

  const onExport = (p: SavedPreset) => {
    const blob = new Blob([JSON.stringify(p, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name.replace(/\s+/g, "_")}.preset.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<SavedPreset>;
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid");

      const importedSettings = (parsed as any).settings ?? parsed;
      const p = createPreset(parsed.name ?? file.name, importedSettings);
      persist([p, ...presets]);
    } catch {
      alert("Invalid preset JSON");
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Presets</h2>
          <p className="text-slate-500 text-sm">
            Save and reuse transformation settings locally.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer">
          <Upload className="w-4 h-4" />
          Import
          <input
            type="file"
            className="hidden"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
        />
        <button
          onClick={onSave}
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {sorted.length === 0 ? (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
            No presets yet
          </div>
        ) : (
          sorted.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500">
                  Saved {formatDate(p.createdAt)}
                </div>
              </div>
              <button
                onClick={() => onApply(p)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Apply
              </button>
              <button
                onClick={() => onExport(p)}
                className="p-2 rounded hover:bg-slate-800 text-indigo-400"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
