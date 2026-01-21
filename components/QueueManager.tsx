import React from "react";
import { useStore } from "../store/useStore";
import { useFFmpeg } from "../hooks/useFFmpeg";
import {
  ensureDrawtextFont,
  generateFFmpegArgs,
} from "../utils/ffmpeg-helpers";
import { formatBytes } from "../utils/ffmpegUtils";
import { getVideoDurationSeconds } from "../utils/media";
import { fetchFile } from "@ffmpeg/util";
import {
  FileVideo,
  Trash2,
  Play,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const QueueManager: React.FC = () => {
  const {
    queue,
    addToQueue,
    removeFromQueue,
    updateQueueItem,
    isProcessing,
    setIsProcessing,
    settings,
    watermarkImageFile,
    watermarkFontFile,
  } = useStore();
  const { ffmpeg, load, isLoaded } = useFFmpeg(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const videos = Array.from(e.dataTransfer.files)
        .filter((f) => (f as File).type.startsWith("video/"))
        .filter((f) => {
          if ((f as File).size > 2 * 1024 * 1024 * 1024) {
            alert(`Skipping ${(f as File).name}: larger than 2GB.`);
            return false;
          }
          return true;
        }) as File[];
      addToQueue(videos);
    }
  };

  const processQueue = async () => {
    if (!isLoaded || isProcessing) return;
    setIsProcessing(true);

    const withTimeout = async <T,>(
      p: Promise<T>,
      ms: number,
      label: string,
    ): Promise<T> => {
      let t: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        t = window.setTimeout(() => {
          reject(
            new Error(`${label} timed out after ${Math.round(ms / 1000)}s`),
          );
        }, ms);
      });
      try {
        return (await Promise.race([p, timeout])) as T;
      } finally {
        if (t !== undefined) window.clearTimeout(t);
      }
    };

    try {
      await withTimeout(load(), 60_000, "FFmpeg load");

      // Ensure font is loaded for watermark
      if (settings.watermarkText)
        await ensureDrawtextFont(ffmpeg, watermarkFontFile);

      for (const item of queue) {
        if (item.status === "done") continue;

        updateQueueItem(item.id, { status: "processing", progress: 0 });

        let lastProgress = 0;
        const normalizeProgress = (evt: any): number => {
          const raw =
            typeof evt?.progress === "number"
              ? evt.progress
              : typeof evt?.ratio === "number"
                ? evt.ratio
                : typeof evt?.time === "number"
                  ? evt.time
                  : 0;
          if (!Number.isFinite(raw)) return 0;
          if (raw <= 1.000001) return Math.max(0, Math.min(1, raw));
          if (raw <= 100) return Math.max(0, Math.min(1, raw / 100));
          return 0;
        };

        const onProgress = (evt: any) => {
          const p = normalizeProgress(evt);
          lastProgress = Math.max(lastProgress, p);
          updateQueueItem(item.id, { progress: lastProgress });
        };

        const logs: string[] = [];
        const onLog = ({ message }: { message: string }) => {
          logs.push(message);
          if (logs.length > 200) logs.shift();
          console.log(`[ffmpeg][${item.id}]`, message);
        };

        try {
          const inputName = `input_${item.id}`;
          const outputName = `output_${item.id}.mp4`;
          const watermarkExt = (() => {
            const t = watermarkImageFile?.type || "";
            if (t.includes("png")) return "png";
            if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
            if (t.includes("webp")) return "webp";
            if (t.includes("gif")) return "gif";
            return "png";
          })();

          const watermarkImageName =
            settings.watermarkImageEnabled && watermarkImageFile
              ? `wm_${item.id}.${watermarkExt}`
              : null;

          const inputDurationSec = settings.fadeEnabled
            ? await getVideoDurationSeconds(item.file)
            : 0;

          // 1. Write Input
          await ffmpeg.writeFile(inputName, await fetchFile(item.file));

          if (watermarkImageName && watermarkImageFile) {
            await ffmpeg.writeFile(
              watermarkImageName,
              await fetchFile(watermarkImageFile),
            );
          }

          // 2. Generate Command using current global settings (Batch applies current settings to all)
          const args = generateFFmpegArgs(inputName, outputName, settings, {
            inputDurationSec,
            nowIso: new Date().toISOString(),
            watermarkImageInputName: watermarkImageName ?? undefined,
          });

          // 3. Process
          ffmpeg.on("progress", onProgress);
          ffmpeg.on("log", onLog);

          await withTimeout(ffmpeg.exec(args), 20 * 60_000, "FFmpeg render");

          // 4. Read Output
          const data = await ffmpeg.readFile(outputName);
          const out = Uint8Array.from(data as unknown as Uint8Array);
          const blob = new Blob([out], { type: "video/mp4" });
          const url = URL.createObjectURL(blob);

          // 5. Update Status
          updateQueueItem(item.id, {
            status: "done",
            outputUrl: url,
            progress: 1,
          });

          // 6. Cleanup
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);

          if (watermarkImageName) {
            try {
              await ffmpeg.deleteFile(watermarkImageName);
            } catch {
              // ignore
            }
          }
        } catch (e: any) {
          console.error(e);
          if (logs.length) {
            console.error(
              `FFmpeg logs (tail) [${item.id}]`,
              logs.slice(-50).join("\n"),
            );
          }
          updateQueueItem(item.id, {
            status: "error",
            errorMsg: e.message || "Processing failed",
          });
        } finally {
          ffmpeg.off("progress", onProgress);
          ffmpeg.off("log", onLog);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="h-full flex flex-col gap-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Batch Queue</h2>
          <p className="text-slate-500 text-sm">
            Drag and drop multiple videos to process sequentially with current
            settings.
          </p>
        </div>
        <button
          onClick={processQueue}
          disabled={!isLoaded || isProcessing || queue.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          Start Batch
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {queue.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
            <FileVideo className="w-12 h-12 mb-2 opacity-50" />
            <p>Queue is empty</p>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center gap-4 group"
            >
              {/* Icon / Status */}
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 shrink-0">
                {item.status === "pending" && (
                  <FileVideo className="w-5 h-5 text-slate-400" />
                )}
                {item.status === "processing" && (
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                )}
                {item.status === "done" && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
                {item.status === "error" && (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <h4 className="font-medium truncate">{item.file.name}</h4>
                  <span className="text-xs text-slate-500">
                    {formatBytes(item.file.size)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${item.status === "error" ? "bg-red-500" : "bg-indigo-500"}`}
                    style={{
                      width: `${item.status === "done" ? 100 : item.progress * 100}%`,
                    }}
                  />
                </div>
                {item.status === "error" && (
                  <p className="text-xs text-red-400 mt-1">{item.errorMsg}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {item.status === "done" && item.outputUrl && (
                  <a
                    href={item.outputUrl}
                    download={`processed_${item.file.name}`}
                    className="p-2 hover:bg-slate-800 text-indigo-400 rounded transition-colors"
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="p-2 hover:bg-slate-800 text-slate-500 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
