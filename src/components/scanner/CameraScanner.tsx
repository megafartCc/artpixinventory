"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, ScanLine } from "lucide-react";

type DetectorCtor = {
  new (options?: { formats?: string[] }): {
    detect: (
      source: CanvasImageSource
    ) => Promise<Array<{ rawValue?: string; boundingBox?: DOMRectReadOnly }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

const fallbackFormats = ["qr_code", "code_128", "ean_13", "upc_a", "upc_e"];

function getBarcodeDetector(): DetectorCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const barcodeDetector = (
    globalThis as typeof globalThis & { BarcodeDetector?: DetectorCtor }
  ).BarcodeDetector;

  return barcodeDetector ?? null;
}

export function CameraScanner({
  title,
  subtitle,
  placeholder,
  onDetected,
  onManualSubmit,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  onDetected: (value: string) => void;
  onManualSubmit?: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<DetectorCtor> | null>(null);
  const lastDetectedRef = useRef("");
  const [manualValue, setManualValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState("Camera scanner ready.");
  const [error, setError] = useState("");

  const canSubmitManual = manualValue.trim().length > 0;

  const stopScanner = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    const BarcodeDetectorCtor = getBarcodeDetector();
    setSupported(Boolean(BarcodeDetectorCtor));

    let mounted = true;

    async function boot() {
      if (!BarcodeDetectorCtor) {
        setStatus("Browser camera detection is unavailable. Manual scan entry is still available.");
        return;
      }

      try {
        const supportedFormats =
          typeof BarcodeDetectorCtor.getSupportedFormats === "function"
            ? await BarcodeDetectorCtor.getSupportedFormats()
            : fallbackFormats;

        const formats = fallbackFormats.filter((format) =>
          supportedFormats.includes(format)
        );

        detectorRef.current = new BarcodeDetectorCtor({
          formats: formats.length > 0 ? formats : fallbackFormats,
        });
      } catch {
        detectorRef.current = new BarcodeDetectorCtor({ formats: fallbackFormats });
      }

      if (!mounted) {
        return;
      }

      setStatus("Tap Start Camera to scan a QR code or barcode.");
    }

    void boot();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  const detectionLoop = useMemo(
    () =>
      async function detect() {
        if (
          !videoRef.current ||
          !canvasRef.current ||
          !detectorRef.current ||
          videoRef.current.readyState < 2
        ) {
          frameRef.current = window.requestAnimationFrame(() => {
            void detect();
          });
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          frameRef.current = window.requestAnimationFrame(() => {
            void detect();
          });
          return;
        }

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const detections = await detectorRef.current.detect(canvas);
          const value = detections[0]?.rawValue?.trim();
          if (value && value !== lastDetectedRef.current) {
            lastDetectedRef.current = value;
            setStatus(`Detected ${value}`);
            onDetected(value);
          }
        } catch {
          // Ignore transient detector errors while the stream is warming up.
        }

        frameRef.current = window.requestAnimationFrame(() => {
          void detect();
        });
    },
    [onDetected]
  );

  useEffect(() => {
    if (!scanning || !streamRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const startDetection = async () => {
      try {
        await video.play();
      } catch {
        // Some browsers need a second paint before playback can start.
      }

      if (!detectorRef.current) {
        setStatus("Camera preview is active. Manual scan entry is still available.");
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        void detectionLoop();
      });
    };

    void startDetection();
  }, [detectionLoop, scanning]);

  const startScanner = async () => {
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      setScanning(true);
      setStatus("Point the camera at a QR code or barcode.");
    } catch (scanError) {
      setError(
        scanError instanceof Error ? scanError.message : "Unable to access the device camera."
      );
      stopScanner();
    }
  };

  const submitManual = () => {
    const value = manualValue.trim();
    if (!value) {
      return;
    }

    setStatus(`Submitted ${value}`);
    onDetected(value);
    onManualSubmit?.(value);
  };

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-full bg-slate-100 p-2 text-slate-500">
          <ScanLine className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950">
        <div className="relative aspect-[4/3] min-h-[260px] w-full">
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              scanning ? "opacity-100" : "opacity-0"
            }`}
            autoPlay
            muted
            playsInline
          />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-slate-300">
              {supported
                ? "Live camera preview appears here."
                : "Live scanning is not supported in this browser. Use manual scan entry below."}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 border-[3px] border-white/10" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-[28px] border-2 border-dashed border-white/50 shadow-[0_0_0_9999px_rgba(15,23,42,0.32)]" />
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void (scanning ? stopScanner() : startScanner())}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {scanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          <span>{scanning ? "Stop Camera" : "Start Camera"}</span>
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitManual();
              }
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={!canSubmitManual}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <span>{error || status}</span>
      </div>
    </div>
  );
}
