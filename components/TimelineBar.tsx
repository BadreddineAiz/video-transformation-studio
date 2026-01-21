import React, { useMemo } from "react";
import { useStore } from "../store/useStore";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const TimelineBar: React.FC = () => {
  const { playerCurrentTime, playerDuration, requestSeek, currentFile } =
    useStore();

  const disabled = !currentFile || playerDuration <= 0;

  const progress = useMemo(() => {
    if (!playerDuration) return 0;
    return Math.max(0, Math.min(playerDuration, playerCurrentTime));
  }, [playerCurrentTime, playerDuration]);

  return (
    <div className="h-14 border-t border-slate-800 bg-slate-900/40 backdrop-blur-sm flex items-center gap-4 px-4">
      <div className="text-xs font-mono text-slate-400 w-20 text-right">
        {formatTime(progress)}
      </div>
      <input
        type="range"
        min={0}
        max={playerDuration || 0}
        step={0.01}
        value={progress}
        disabled={disabled}
        onChange={(e) => requestSeek(parseFloat(e.target.value))}
        className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
      />
      <div className="text-xs font-mono text-slate-400 w-20">
        {formatTime(playerDuration)}
      </div>
    </div>
  );
};
