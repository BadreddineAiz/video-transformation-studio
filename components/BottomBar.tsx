import React from "react";
import { Download } from "lucide-react";
import { TimelineBar } from "./TimelineBar";
import { useVideoExport } from "../hooks/useVideoExport";
import { useStore } from "../store/useStore";

export const BottomBar: React.FC = () => {
  const { exportCurrent, isFFmpegReady } = useVideoExport();
  const { currentFile } = useStore();

  return (
    <div className="border-t border-slate-800 bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="text-sm text-slate-400 truncate">
          {currentFile ? currentFile.name : "No file loaded"}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => void exportCurrent()}
            disabled={!currentFile || !isFFmpegReady}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
      <TimelineBar />
    </div>
  );
};
