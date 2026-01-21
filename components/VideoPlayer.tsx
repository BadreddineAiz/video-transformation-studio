import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { Play, Pause, RotateCcw } from "lucide-react";

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    currentFile,
    settings,
    updateSettings,
    watermarkImageUrl,
    playerCurrentTime,
    playerDuration,
    playerIsPlaying,
    setPlayerState,
    seekRequest,
    clearSeekRequest,
  } = useStore();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [grainUrl, setGrainUrl] = useState<string | null>(null);
  const dragRef = useRef<null | {
    kind: "text" | "image";
    pointerId: number;
  }>(null);

  // Create Object URL for the file
  useEffect(() => {
    if (currentFile) {
      const url = URL.createObjectURL(currentFile);
      setObjectUrl(url);
      setPlayerState({
        playerCurrentTime: 0,
        playerDuration: 0,
        playerIsPlaying: false,
      });
      return () => URL.revokeObjectURL(url);
    }
  }, [currentFile]);

  // Apply seek requests from the global TimelineBar.
  useEffect(() => {
    if (seekRequest == null) return;
    const el = videoRef.current;
    if (!el) return;

    const d = Number.isFinite(el.duration) ? el.duration : playerDuration;
    const clamped = Number.isFinite(d)
      ? Math.max(0, Math.min(d, seekRequest))
      : Math.max(0, seekRequest);

    try {
      el.currentTime = clamped;
    } catch {
      // ignore
    }

    setPlayerState({ playerCurrentTime: clamped });
    clearSeekRequest();
  }, [clearSeekRequest, playerDuration, seekRequest, setPlayerState]);

  // Sync Video Properties with Settings (Speed)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = settings.playbackRate;
    }
  }, [settings.playbackRate]);

  // Build a tiny noise texture for film grain preview
  useEffect(() => {
    if (settings.filmGrain <= 0) {
      setGrainUrl(null);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setGrainUrl(canvas.toDataURL("image/png"));
  }, [settings.filmGrain]);

  const setWatermarkPosFromClientXY = (
    clientX: number,
    clientY: number,
    kind: "text" | "image",
  ) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (kind === "text") {
      updateSettings({
        watermarkX: Math.max(0, Math.min(100, x)),
        watermarkY: Math.max(0, Math.min(100, y)),
      });
    } else {
      updateSettings({
        watermarkImageX: Math.max(0, Math.min(100, x)),
        watermarkImageY: Math.max(0, Math.min(100, y)),
      });
    }
  };

  const beginDrag = (e: React.PointerEvent, kind: "text" | "image") => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setWatermarkPosFromClientXY(e.clientX, e.clientY, kind);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.pointerId !== e.pointerId) return;
    setWatermarkPosFromClientXY(e.clientX, e.clientY, d.kind);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playerIsPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  // Construct CSS Filters
  // Brightness: CSS default 1 (100%). FFmpeg 0 (-1 to 1). Mapping: 1 + val.
  // Contrast: CSS default 1 (100%). FFmpeg 1 (0 to 2). Mapping: val.
  // Saturation: CSS default 1 (100%). FFmpeg 1 (0 to 3). Mapping: val.
  const filterString = `
    brightness(${1 + settings.brightness}) 
    contrast(${settings.contrast}) 
    saturate(${settings.saturation})
  `;

  // Construct CSS Transforms
  const cropScale =
    settings.smartCrop > 0
      ? 1 / (1 - 2 * Math.max(0, Math.min(0.2, settings.smartCrop)))
      : 1;

  const transformString = `
    scale(${cropScale})
    rotate(${settings.rotation}deg)
    scaleX(${settings.flipH ? -1 : 1})
  `;

  const fadeOpacity = (() => {
    if (!settings.fadeEnabled || settings.fadeDuration <= 0) return 0;
    if (!playerDuration || playerDuration <= 0) return 0;

    const d = Math.max(0.1, Math.min(2.0, settings.fadeDuration));
    const t = playerCurrentTime;
    const fadeIn = 1 - Math.max(0, Math.min(1, t / d));
    const fadeOut = Math.max(0, Math.min(1, (t - (playerDuration - d)) / d));
    return Math.max(fadeIn, fadeOut);
  })();

  const watermarkColor = (() => {
    const hex = (settings.watermarkColor || "#ffffff").replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 255;
    const g = parseInt(hex.slice(2, 4), 16) || 255;
    const b = parseInt(hex.slice(4, 6), 16) || 255;
    const a =
      Math.max(0, Math.min(100, settings.watermarkOpacity ?? 100)) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  })();

  if (!objectUrl) return null;

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl animate-in fade-in duration-500">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-800 aspect-video group"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <video
          ref={videoRef}
          src={objectUrl}
          className="w-full h-full object-contain transition-all duration-200"
          style={{
            filter: filterString,
            transform: transformString,
          }}
          onLoadedMetadata={() => {
            if (!videoRef.current) return;
            setPlayerState({
              playerDuration: videoRef.current.duration || 0,
              playerCurrentTime: videoRef.current.currentTime || 0,
            });
          }}
          onTimeUpdate={() => {
            if (!videoRef.current) return;
            setPlayerState({ playerCurrentTime: videoRef.current.currentTime });
          }}
          onPlay={() => setPlayerState({ playerIsPlaying: true })}
          onPause={() => setPlayerState({ playerIsPlaying: false })}
          loop
        />

        {/* Fade overlay (preview-only) */}
        {fadeOpacity > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "black", opacity: fadeOpacity }}
          />
        )}

        {/* Film grain overlay (preview-only) */}
        {grainUrl && settings.filmGrain > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${grainUrl})`,
              backgroundRepeat: "repeat",
              opacity: Math.min(0.5, (settings.filmGrain / 100) * 0.35),
              mixBlendMode: "overlay" as any,
            }}
          />
        )}

        {/* Watermark Overlay */}
        {settings.watermarkText && (
          <div
            className="absolute cursor-move select-none drop-shadow-md border border-dashed border-white/30 hover:border-white/80 p-1 rounded touch-none"
            style={{
              left: `${settings.watermarkX}%`,
              top: `${settings.watermarkY}%`,
              fontSize: `${Math.max(10, settings.watermarkSize)}px`,
              fontFamily: settings.watermarkFontFamily,
              fontWeight: settings.watermarkFontWeight,
              fontStyle: settings.watermarkFontStyle,
              color: watermarkColor,
              transform: "translate(-50%, -50%)", // Center on cursor point
              textShadow: "2px 2px 2px rgba(0,0,0,0.8)",
            }}
            onPointerDown={(e) => beginDrag(e, "text")}
          >
            {settings.watermarkText}
          </div>
        )}

        {/* Image Watermark Overlay */}
        {settings.watermarkImageEnabled && watermarkImageUrl && (
          <div
            className="absolute cursor-move select-none touch-none"
            style={{
              left: `${settings.watermarkImageX}%`,
              top: `${settings.watermarkImageY}%`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(e) => beginDrag(e, "image")}
          >
            <img
              src={watermarkImageUrl}
              alt="Watermark"
              draggable={false}
              className="block drop-shadow-md border border-dashed border-white/20 hover:border-white/70 rounded"
              style={{
                opacity:
                  Math.max(
                    0,
                    Math.min(100, settings.watermarkImageOpacity ?? 100),
                  ) / 100,
                transform: `scale(${Math.max(0.05, Math.min(2, settings.watermarkImageScale ?? 0.25))})`,
                transformOrigin: "center",
              }}
            />
          </div>
        )}

        {/* Floating Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={togglePlay}
            className="p-2 hover:text-indigo-400 text-white transition-colors"
          >
            {playerIsPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          <div className="w-px h-4 bg-slate-600 mx-2"></div>
          <span className="text-xs font-mono text-slate-300">
            {settings.playbackRate}x
          </span>
        </div>
      </div>

      {/* Helper Text */}
      <div className="text-center text-xs text-slate-500">
        <p>
          Changes are previewed using CSS. Render to burn effects into file.
        </p>
        {(settings.watermarkText ||
          (settings.watermarkImageEnabled && watermarkImageUrl)) && (
          <p>Drag the watermark to reposition.</p>
        )}
      </div>
    </div>
  );
};
