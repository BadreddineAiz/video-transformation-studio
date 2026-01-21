import { useCallback } from "react";
import { fetchFile } from "@ffmpeg/util";
import { useFFmpeg } from "./useFFmpeg";
import { useStore } from "../store/useStore";
import {
  ensureDrawtextFont,
  generateFFmpegArgs,
} from "../utils/ffmpeg-helpers";
import { getVideoDurationSeconds } from "../utils/media";

export function useVideoExport() {
  const { ffmpeg, load, isLoaded } = useFFmpeg(false);
  const {
    currentFile,
    settings,
    watermarkImageFile,
    watermarkFontFile,
    setIsProcessing,
    setProcessingProgress,
  } = useStore();

  const exportCurrent = useCallback(async () => {
    if (!currentFile) return;

    const withTimeout = async <T>(
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

    if (currentFile.size > 2 * 1024 * 1024 * 1024) {
      alert(
        "This file is larger than 2GB. Processing may fail due to browser memory limits.",
      );
    }

    setIsProcessing(true);
    setProcessingProgress(0);

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
      // Most builds emit 0..1. Some emit 0..100. Some may (incorrectly) emit time.
      if (raw <= 1.000001) return Math.max(0, Math.min(1, raw));
      if (raw <= 100) return Math.max(0, Math.min(1, raw / 100));
      return 0; // treat unknown huge values as 0
    };

    const onProgress = (evt: any) => {
      const p = normalizeProgress(evt);
      lastProgress = Math.max(lastProgress, p);
      setProcessingProgress(lastProgress);
    };

    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => {
      logs.push(message);
      if (logs.length > 200) logs.shift();
      // Keep console noisy for debugging stuck runs
      console.log("[ffmpeg]", message);
    };

    let inputName: string | null = null;
    let outputName: string | null = null;
    let watermarkImageName: string | null = null;

    const safeDelete = async (name: string | null) => {
      if (!name) return;
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        // ignore
      }
    };

    try {
      ffmpeg.on("log", onLog);
      await withTimeout(load(), 60_000, "FFmpeg load");

      const inputDurationSec = settings.fadeEnabled
        ? await getVideoDurationSeconds(currentFile)
        : 0;

      if (settings.watermarkText) {
        await ensureDrawtextFont(ffmpeg, watermarkFontFile);
      }

      inputName = "input_video";
      outputName = `output_${Date.now()}.mp4`;

      const watermarkExt = (() => {
        const t = watermarkImageFile?.type || "";
        if (t.includes("png")) return "png";
        if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
        if (t.includes("webp")) return "webp";
        if (t.includes("gif")) return "gif";
        return "png";
      })();

      watermarkImageName =
        settings.watermarkImageEnabled && watermarkImageFile
          ? `wm_${Date.now()}.${watermarkExt}`
          : null;

      // Best-effort cleanup if files exist from a prior crashed run.
      await safeDelete(inputName);
      await safeDelete(outputName);
      await safeDelete(watermarkImageName);

      await ffmpeg.writeFile(inputName, await fetchFile(currentFile));

      if (watermarkImageName && watermarkImageFile) {
        await ffmpeg.writeFile(
          watermarkImageName,
          await fetchFile(watermarkImageFile),
        );
      }

      const args = generateFFmpegArgs(inputName, outputName, settings, {
        inputDurationSec,
        nowIso: new Date().toISOString(),
        watermarkImageInputName: watermarkImageName ?? undefined,
      });

      ffmpeg.on("progress", onProgress);
      await withTimeout(ffmpeg.exec(args), 20 * 60_000, "FFmpeg render");

      const data = await ffmpeg.readFile(outputName);
      const out = Uint8Array.from(data as unknown as Uint8Array);

      if (!out || out.byteLength < 256) {
        throw new Error(
          `Export produced an empty output (${out?.byteLength ?? 0} bytes).`,
        );
      }
      const blob = new Blob([out], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `processed_${currentFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await safeDelete(inputName);
      await safeDelete(outputName);
      await safeDelete(watermarkImageName);
    } catch (e) {
      console.error("Export failed", e);
      if (logs.length) {
        console.error("FFmpeg logs (tail)", logs.slice(-50).join("\n"));
      }
      alert(
        "Export failed or hung. Open DevTools Console for FFmpeg logs. If this keeps happening, refresh the page (FFmpeg worker may have crashed).",
      );
    } finally {
      ffmpeg.off("progress", onProgress);
      ffmpeg.off("log", onLog);
      // Cleanup even on error
      await safeDelete(inputName);
      await safeDelete(outputName);
      await safeDelete(watermarkImageName);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [
    currentFile,
    ffmpeg,
    load,
    settings,
    watermarkImageFile,
    watermarkFontFile,
    setIsProcessing,
    setProcessingProgress,
  ]);

  return { exportCurrent, isFFmpegReady: isLoaded };
}
