import React, { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Layers,
  Bookmark,
  Settings2,
  Upload,
  Download,
  Play,
  Pause,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useStore } from "./store/useStore";
import { VideoPlayer } from "./components/VideoPlayer";
import { Controls } from "./components/Controls";
import { QueueManager } from "./components/QueueManager";
import { PresetsPanel } from "./components/PresetsPanel";
import { BottomBar } from "./components/BottomBar";
import { useFFmpeg } from "./hooks/useFFmpeg";

const App: React.FC = () => {
  const {
    isFFmpegLoaded,
    setFFmpegLoaded,
    activeTab,
    setActiveTab,
    currentFile,
    setFile,
    addToQueue,
    isProcessing,
    processingProgress,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isLoaded: hookLoaded, error: hookError } = useFFmpeg(true);

  useEffect(() => {
    if (hookError) {
      console.error("Failed to load FFmpeg:", hookError);
      setError(
        "Failed to initialize FFmpeg WASM. If you want multi-threading, ensure COOP/COEP headers are present (crossOriginIsolated=true). Check the console for details.",
      );
      setIsLoading(false);
      return;
    }

    if (hookLoaded) {
      setFFmpegLoaded(true);
      setIsLoading(false);
    }
  }, [hookLoaded, hookError, setFFmpegLoaded]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(
        e.dataTransfer.files as unknown as FileList,
      ) as File[];
      const files = dropped.filter((f) => f.type.startsWith("video/"));
      if (files.length === 0) return;

      if (files.length === 1) {
        setFile(files[0]);
        setActiveTab("editor");
      } else {
        addToQueue(files);
        setActiveTab("queue");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-200 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-lg font-medium">
          Initializing Transformation Engine...
        </p>
        <p className="text-sm text-slate-500">Loading FFmpeg WASM Core</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-red-400 gap-4 p-8 text-center">
        <AlertCircle className="w-16 h-16" />
        <h1 className="text-2xl font-bold">Initialization Failed</h1>
        <p>{error}</p>
        <p className="text-slate-400 text-sm mt-4">
          Note: This app requires{" "}
          <code>Cross-Origin-Opener-Policy: same-origin</code> and{" "}
          <code>Cross-Origin-Embedder-Policy: require-corp</code> headers to use
          SharedArrayBuffer.
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden"
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <header className="h-14 border-b border-slate-800 flex items-center px-6 bg-slate-900/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2 text-indigo-400">
          <Clapperboard className="w-6 h-6" />
          <span className="font-bold text-lg tracking-tight text-white">
            VideoStudio
          </span>
          <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
            Web WASM
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div
              className={`w-2 h-2 rounded-full ${isFFmpegLoaded ? "bg-green-500" : "bg-red-500"}`}
            ></div>
            Engine {isFFmpegLoaded ? "Ready" : "Offline"}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 border-r border-slate-800 bg-slate-900 flex flex-col items-center py-4 gap-4 shrink-0 z-10">
          <NavButton
            active={activeTab === "editor"}
            onClick={() => setActiveTab("editor")}
            icon={<Settings2 className="w-6 h-6" />}
            label="Editor"
          />
          <NavButton
            active={activeTab === "queue"}
            onClick={() => setActiveTab("queue")}
            icon={<Layers className="w-6 h-6" />}
            label="Batch"
          />
          <NavButton
            active={activeTab === "presets"}
            onClick={() => setActiveTab("presets")}
            icon={<Bookmark className="w-6 h-6" />}
            label="Presets"
          />
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex bg-slate-950 relative">
          {activeTab === "editor" ? (
            <>
              {/* Main Stage (Player) */}
              <div className="flex-1 flex flex-col min-w-0 p-6 gap-4 relative">
                <div className="flex-1 min-h-0 flex justify-center items-center">
                  {currentFile ? (
                    <VideoPlayer />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full border-2 border-dashed border-slate-800 rounded-xl text-slate-500 bg-slate-900/20">
                      <Upload className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        Drag & Drop Video Here
                      </p>
                      <p className="text-sm">
                        or drop multiple files for batch processing
                      </p>
                    </div>
                  )}
                </div>
                {currentFile && <BottomBar />}
              </div>

              {/* Right Panel (Controls) */}
              <div className="w-80 border-l border-slate-800 bg-slate-900 overflow-y-auto shrink-0">
                <Controls />
              </div>
            </>
          ) : activeTab === "queue" ? (
            <div className="flex-1 p-6 overflow-hidden">
              <QueueManager />
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-hidden">
              <PresetsPanel />
            </div>
          )}

          {/* Global Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
              <div className="w-64 space-y-4">
                <div className="flex justify-between text-sm text-indigo-300 font-medium">
                  <span>Rendering...</span>
                  <span>{Math.round(processingProgress * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${processingProgress * 100}%` }}
                  />
                </div>
                <p className="text-xs text-center text-slate-500">
                  Processing locally via WASM. Do not close this tab.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const NavButton = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-xl transition-all duration-200 group relative flex flex-col items-center gap-1 ${
      active
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
    }`}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default App;
