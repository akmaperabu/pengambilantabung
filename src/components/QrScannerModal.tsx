"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Image as ImageIcon,
  PlusCircle,
  Volume2,
  VolumeX,
  ShieldAlert,
} from "lucide-react";

export interface ScannedCylinderItem {
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
  input_method: "SCAN" | "SEARCH";
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSerials: Set<string>;
  onAddCylinder: (item: ScannedCylinderItem) => void;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  existingSerials,
  onAddCylinder,
}: QrScannerModalProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isHttpInsecure, setIsHttpInsecure] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>(
    []
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);

  interface CornerToast {
    id: number;
    type: "success" | "duplicate" | "unregistered" | "error";
    title: string;
    subtitle: string;
  }

  const [cornerToast, setCornerToast] = useState<CornerToast | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [flashEffect, setFlashEffect] = useState<"success" | "duplicate" | "unregistered" | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [unregisteredData, setUnregisteredData] = useState<{
    serial: string;
  } | null>(null);

  const scannedSerialsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    scannedSerialsRef.current = new Set(existingSerials);
  }, [existingSerials]);

  const showCornerToast = useCallback(
    (type: CornerToast["type"], title: string, subtitle: string) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);

      setCornerToast({
        id: Date.now(),
        type,
        title,
        subtitle,
      });

      if (type === "success" || type === "duplicate" || type === "unregistered") {
        setFlashEffect(type);
        flashTimeoutRef.current = setTimeout(() => {
          setFlashEffect(null);
        }, 700);
      }

      toastTimeoutRef.current = setTimeout(() => {
        setCornerToast(null);
      }, 2500);
    },
    []
  );

  const [manualGasForUnregistered, setManualGasForUnregistered] =
    useState("Oxygen (O2)");
  const [manualCylNoForUnregistered, setManualCylNoForUnregistered] =
    useState("");

  const playBeep = useCallback(
    (isSuccess: boolean) => {
      if (!soundEnabled) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isSuccess ? "sine" : "triangle";
        osc.frequency.setValueAtTime(isSuccess ? 880 : 320, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.25));
      } catch {
        // Ignore audio context restriction
      }
    },
    [soundEnabled]
  );

  const handleDecodedCode = useCallback(
    async (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;

      const now = Date.now();
      if (
        lastScanRef.current.code === cleaned &&
        now - lastScanRef.current.time < 2500
      ) {
        return;
      }
      lastScanRef.current = { code: cleaned, time: now };

      try {
        const res = await fetch(
          `/api/cylinders/lookup?code=${encodeURIComponent(cleaned)}`
        );
        const data = await res.json();

        const serial = (
          data.cylinder?.serial_number ||
          data.scannedCode ||
          cleaned
        ).toUpperCase();

        const isDuplicate =
          existingSerials.has(serial) || scannedSerialsRef.current.has(serial);

        if (isDuplicate) {
          playBeep(false);
          showCornerToast(
            "duplicate",
            "Sudah Masuk ke Tiket",
            `${serial} sudah ada di daftar`
          );
          return;
        }

        if (data.found && data.cylinder) {
          scannedSerialsRef.current.add(serial);
          playBeep(true);
          onAddCylinder({
            serial_number: data.cylinder.serial_number,
            cylinder_number: data.cylinder.cylinder_number || "-",
            gas_type: data.cylinder.gas_type,
            input_method: "SCAN",
          });
          showCornerToast(
            "success",
            "Berhasil Ditambahkan",
            `${data.cylinder.serial_number} • ${data.cylinder.gas_type}`
          );
          setUnregisteredData(null);

          if (!continuousMode) {
            setTimeout(() => {
              onClose();
            }, 600);
          }
        } else {
          playBeep(false);
          showCornerToast(
            "unregistered",
            "Tidak Ditemukan",
            `${serial} belum terdaftar di database`
          );
          setUnregisteredData({
            serial,
          });
        }
      } catch {
        playBeep(false);
        showCornerToast(
          "error",
          "Gagal Memindai",
          "Koneksi server terganggu"
        );
      }
    },
    [
      existingSerials,
      onAddCylinder,
      continuousMode,
      onClose,
      playBeep,
      showCornerToast,
    ]
  );

  const handleDecodedCodeRef = useRef(handleDecodedCode);
  handleDecodedCodeRef.current = handleDecodedCode;

  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
          scanner.clear();
        } catch (e) {
          console.warn("Scanner stop error:", e);
        }
      }
    } finally {
      isStoppingRef.current = false;
      setIsStarting(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsStarting(true);
    setCameraError(null);
    setIsHttpInsecure(false);

    try {
      await stopScanner();

      // Cek apakah browser mendukung kamera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsHttpInsecure(true);
        setCameraError(
          "Browser memblokir kamera langsung (biasanya karena diakses lewat HTTP biasa, bukan HTTPS). Gunakan tombol 'Ambil Foto Barcode' di bawah."
        );
        return;
      }

      const { Html5Qrcode } = await import("html5-qrcode");

      const container = document.getElementById("qr-reader-container");
      if (!container) {
        console.warn("Container #qr-reader-container not found in DOM");
        return;
      }

      const html5QrCode = new Html5Qrcode("qr-reader-container", {
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      // Cari kamera yang tersedia
      let selectedCam: string | { facingMode: string } = { facingMode: "environment" };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          // Cari kamera belakang jika ada (untuk HP), jika tidak ada gunakan kamera yang tersedia (laptop/webcam)
          const backCam = devices.find((d) =>
            /back|rear|environment|belakang/i.test(d.label)
          );
          selectedCam = backCam ? backCam.id : devices[0].id;
        }
      } catch (devErr) {
        console.warn("Could not list cameras, using default facingMode:", devErr);
      }

      const qrCodeSuccessCallback = (decodedText: string) => {
        handleDecodedCodeRef.current(decodedText);
      };

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(160, Math.floor(minEdge * 0.72));
          return { width: size, height: size };
        },
      };

      try {
        await html5QrCode.start(
          selectedCam,
          config,
          qrCodeSuccessCallback,
          () => { }
        );
      } catch (firstErr) {
        console.warn("First camera start attempt failed, trying fallback:", firstErr);
        // Fallback untuk laptop / webcam PC yang tidak support constraint environment
        await html5QrCode.start(
          { facingMode: "user" },
          config,
          qrCodeSuccessCallback,
          () => { }
        );
      }
    } catch (err: unknown) {
      console.error("Camera start final error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes("NotAllowedError") ||
        errMsg.includes("Permission denied")
      ) {
        setCameraError(
          "Izin kamera ditolak. Silakan izinkan akses kamera di ikon gembok / pengaturan browser Anda."
        );
      } else if (
        errMsg.includes("NotFoundError") ||
        errMsg.includes("DevicesNotFoundError")
      ) {
        setCameraError("Kamera tidak ditemukan pada perangkat ini.");
      } else {
        setCameraError(
          "Tidak dapat menyalakan kamera langsung. Anda bisa menggunakan tombol 'Ambil Foto Barcode' di bawah."
        );
      }
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [stopScanner]);

  useEffect(() => {
    if (isOpen) {
      setCornerToast(null);
      setFlashEffect(null);
      setUnregisteredData(null);
      scannedSerialsRef.current = new Set(existingSerials);

      // Delay sejenak agar DOM modal sudah ter-mount sepenuhnya
      const timer = setTimeout(() => {
        startScanner();
      }, 100);

      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tempScanner = new Html5Qrcode("qr-file-reader-temp");
      const decodedText = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      await handleDecodedCode(decodedText);
    } catch {
      playBeep(false);
      showCornerToast(
        "error",
        "Tidak Terbaca",
        "Foto QR tidak jelas / buram"
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleForceAddUnregistered = () => {
    if (!unregisteredData || !unregisteredData.serial) return;
    const serial = unregisteredData.serial;
    scannedSerialsRef.current.add(serial);
    playBeep(true);
    onAddCylinder({
      serial_number: serial,
      cylinder_number: manualCylNoForUnregistered.trim().toUpperCase() || "-",
      gas_type: manualGasForUnregistered,
      input_method: "SCAN",
    });
    showCornerToast(
      "success",
      "Berhasil Ditambahkan",
      `${serial} • ${manualGasForUnregistered}`
    );
    setUnregisteredData(null);
    setManualCylNoForUnregistered("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-toast-pop">
        {/* Header Modal - Clean & Minimalist */}
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-[#334155]">
            Scan Barcode Cylinder
          </h2>
          <div className="flex items-center gap-1.5">
            <label
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#334155] hover:bg-gray-100 transition-colors cursor-pointer"
              title="Ambil Foto / Upload Barcode"
            >
              <ImageIcon className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileScan}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#94A3B8] hover:text-[#334155] transition-colors"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport with 4 White Corner Brackets */}
        <div className="px-5 sm:px-6">
          <div className="relative bg-black rounded-lg overflow-hidden w-full aspect-[4/3] sm:aspect-square flex items-center justify-center">
            <div id="qr-reader-container" className="w-full h-full" />
            <div id="qr-file-reader-temp" className="hidden" />

            {/* 4 White Corner Brackets matching the reference image */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-48 h-48 sm:w-56 sm:h-56 relative">
                {/* Top Left Bracket */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3.5px] border-l-[3.5px] border-white" />
                {/* Top Right Bracket */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3.5px] border-r-[3.5px] border-white" />
                {/* Bottom Left Bracket */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3.5px] border-l-[3.5px] border-white" />
                {/* Bottom Right Bracket */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3.5px] border-r-[3.5px] border-white" />
              </div>
            </div>

            {/* Flash border visual feedback */}
            {flashEffect && (
              <div
                className={`absolute inset-0 pointer-events-none z-20 border-4 transition-all duration-300 ${flashEffect === "success"
                  ? "border-emerald-500 shadow-[inset_0_0_24px_rgba(16,185,129,0.55)]"
                  : flashEffect === "duplicate"
                    ? "border-amber-500 shadow-[inset_0_0_24px_rgba(245,158,11,0.55)]"
                    : "border-rose-500 shadow-[inset_0_0_24px_rgba(244,63,94,0.55)]"
                  }`}
              />
            )}

            {/* NOTIFIKASI DI UJUNG (Kecil, Tidak Mengganggu di Sudut Atas) */}
            {cornerToast && (
              <div
                key={cornerToast.id}
                className={`absolute top-2.5 right-2.5 z-30 max-w-[210px] sm:max-w-[240px] pointer-events-none animate-toast-pop shadow-xl backdrop-blur-md rounded-2xl p-2.5 flex items-start gap-2 border text-white transition-all ${cornerToast.type === "success"
                  ? "bg-emerald-950/90 border-emerald-400/60 shadow-emerald-950/50"
                  : cornerToast.type === "duplicate"
                    ? "bg-amber-950/90 border-amber-400/60 shadow-amber-950/50"
                    : cornerToast.type === "unregistered"
                      ? "bg-rose-950/90 border-rose-400/60 shadow-rose-950/50"
                      : "bg-slate-900/90 border-slate-500/60 shadow-slate-950/50"
                  }`}
              >
                <div className="mt-0.5 shrink-0">
                  {cornerToast.type === "success" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {cornerToast.type === "duplicate" && (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  {cornerToast.type === "unregistered" && (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  {cornerToast.type === "error" && (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="font-bold text-xs truncate">
                    {cornerToast.title}
                  </p>
                  <p className="text-[10px] text-gray-200 truncate mt-0.5 font-medium">
                    {cornerToast.subtitle}
                  </p>
                </div>
              </div>
            )}

            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-white" />
                <span className="text-xs font-medium text-gray-300">
                  Mengaktifkan kamera...
                </span>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-black/90 space-y-3 z-20">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs text-gray-200 leading-relaxed font-medium max-w-xs">
                  {cameraError}
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => startScanner()}
                    className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                    Coba Lagi
                  </button>
                  <label className="px-4 py-2 rounded-lg bg-[#5F6B7D] text-white text-xs font-bold hover:bg-[#4E5A6C] transition-colors cursor-pointer inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Ambil Foto Barcode</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileScan}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Tambah Tabung jika Belum Terdaftar (Hanya muncul jika kode tidak ditemukan) */}
        {unregisteredData && (
          <div className="mx-5 sm:mx-6 mt-3 p-3.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-950 text-xs space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                Kode &ldquo;{unregisteredData.serial}&rdquo; Belum Terdaftar
              </span>
              <button
                type="button"
                onClick={() => setUnregisteredData(null)}
                className="text-gray-400 hover:text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={manualCylNoForUnregistered}
                onChange={(e) =>
                  setManualCylNoForUnregistered(e.target.value)
                }
                placeholder="No. Tabung (opsional)"
                className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-[#18181B]"
              />
              <select
                value={manualGasForUnregistered}
                onChange={(e) => setManualGasForUnregistered(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#18181B]"
              >
                <option value="Oxygen (O2)">Oxygen (O2)</option>
                <option value="Argon (Ar)">Argon (Ar)</option>
                <option value="Nitrogen (N2)">Nitrogen (N2)</option>
                <option value="CO2">CO2</option>
                <option value="Acetylene (C2H2)">Acetylene (C2H2)</option>
                <option value="LPG">LPG</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleForceAddUnregistered}
              className="w-full py-2 rounded-lg bg-[#5F6B7D] hover:bg-[#4E5A6C] text-white text-xs font-semibold transition-colors"
            >
              Tetap Masukkan ke Tiket
            </button>
          </div>
        )}

        {/* Footer Modal - Sederhana dengan tombol Tutup di Kanan Bawah */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-end bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-[#5F6B7D] hover:bg-[#4E5A6C] active:scale-[0.98] text-white font-medium text-sm transition-all shadow-sm cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
