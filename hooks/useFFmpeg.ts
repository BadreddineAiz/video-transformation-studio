import { useCallback, useEffect, useMemo, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

// Bundle core assets with the app (avoids CDN stalls during load).
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

export type UseFFmpegState = {
  ffmpeg: FFmpeg;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
};

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;
let loaded = false;

function getFFmpegSingleton(): FFmpeg {
  if (!ffmpegSingleton) {
    ffmpegSingleton = new FFmpeg();
  }
  return ffmpegSingleton;
}

async function loadFFmpegOnce(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;

  const ffmpeg = getFFmpegSingleton();

  // Use single-threaded core for maximum compatibility.
  // Multi-threaded core requires a dedicated worker URL which is not exported
  // by @ffmpeg/core-mt and can cause load/exec hangs if not resolved correctly.

  loadPromise = (async () => {
    await ffmpeg.load({ coreURL, wasmURL });
    loaded = true;
  })();

  return loadPromise;
}

export function useFFmpeg(autoLoad = true): UseFFmpegState {
  const ffmpeg = useMemo(() => getFFmpegSingleton(), []);
  const [isLoaded, setIsLoaded] = useState<boolean>(loaded);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loaded) {
      setIsLoaded(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await loadFFmpegOnce();
      setIsLoaded(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    void load();
  }, [autoLoad, load]);

  return { ffmpeg, isLoaded, isLoading, error, load };
}
