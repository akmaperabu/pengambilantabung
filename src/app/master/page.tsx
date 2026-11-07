"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  X,
  Database,
  ArrowUpRight,
} from "lucide-react";

interface MasterCylinder {
  id: number;
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
  updated_at: string;
}

export default function MasterDatabasePage() {
  const [cylinders, setCylinders] = useState<MasterCylinder[]>([]);
  const [totalMaster, setTotalMaster] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Single add form state (Only Serial Number, Nomor Tabung, Jenis Gas)
  const [newSerial, setNewSerial] = useState("");
  const [newCylNumber, setNewCylNumber] = useState("");
  const [newGas, setNewGas] = useState("");
  const [addingSingle, setAddingSingle] = useState(false);

  // Excel / CSV Import state
  const [rawSheetRows, setRawSheetRows] = useState<Record<string, unknown>[]>(
    []
  );
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [colSerial, setColSerial] = useState("");
  const [colCylNumber, setColCylNumber] = useState("");
  const [colGas, setColGas] = useState("");
  const [importMode, setImportMode] = useState<"upsert" | "replace">("replace");
  const [isImporting, setIsImporting] = useState(false);

  // Notification banner
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchMasterData = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cylinders?q=${encodeURIComponent(q)}&limit=100`
      );
      const data = await res.json();
      setCylinders(data.items || []);
      setTotalMaster(data.totalMaster || 0);
      setMatchedCount(data.matchedCount || 0);
    } catch {
      setCylinders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData(debouncedQuery);
  }, [debouncedQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBanner(null);
    setFileName(file.name);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        { defval: "" }
      );

      if (jsonRows.length === 0) {
        setBanner({
          type: "error",
          message: "File Excel/CSV kosong atau tidak memiliki baris data.",
        });
        return;
      }

      const headers = Object.keys(jsonRows[0]);
      setSheetHeaders(headers);
      setRawSheetRows(jsonRows);

      const findHeader = (keywords: string[]) =>
        headers.find((h) =>
          keywords.some((kw) => h.toLowerCase().includes(kw))
        ) || "";

      setColSerial(
        findHeader(["serial", "sn", "barcode", "kode_unik", "id"]) ||
        headers[0] ||
        ""
      );
      setColCylNumber(
        findHeader([
          "nomor tabung",
          "no tabung",
          "no_tabung",
          "nomor_tabung",
          "no. tabung",
          "cylinder",
          "nomor",
          "tabung",
        ]) ||
        headers[1] ||
        ""
      );
      setColGas(
        findHeader(["gas", "jenis", "isi", "produk", "item", "tipe"]) ||
        headers[2] ||
        ""
      );
    } catch (err: unknown) {
      console.error("Error parsing file:", err);
      setBanner({
        type: "error",
        message:
          "Gagal membaca file. Pastikan format .xlsx, .xls, atau .csv valid.",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleExecuteImport = async () => {
    if (!colSerial) {
      setBanner({
        type: "error",
        message: "Pilih kolom untuk Serial Number terlebih dahulu.",
      });
      return;
    }

    setIsImporting(true);
    setBanner(null);

    try {
      const mappedItems = rawSheetRows.map((row) => ({
        serial_number: String(row[colSerial] ?? "").trim(),
        cylinder_number: colCylNumber
          ? String(row[colCylNumber] ?? "").trim()
          : "",
        gas_type: colGas ? String(row[colGas] ?? "").trim() : "-",
      }));

      const res = await fetch("/api/cylinders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMode,
          items: mappedItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengimpor data");
      }

      setBanner({
        type: "success",
        message: `Berhasil mengimpor ${data.importedCount.toLocaleString(
          "id-ID"
        )} data tabung ke Master Database! (Total Master: ${data.totalMaster.toLocaleString(
          "id-ID"
        )} tabung)`,
      });

      setRawSheetRows([]);
      setSheetHeaders([]);
      setFileName("");
      await fetchMasterData(debouncedQuery);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan saat import";
      setBanner({ type: "error", message: msg });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sample = [
      {
        serial_number: "SN-0001",
        nomor_tabung: "TBG-001",
        jenis_gas: "Oxygen",
      },
      {
        serial_number: "SN-0002",
        nomor_tabung: "TBG-002",
        jenis_gas: "Argon",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Tabung");
    XLSX.writeFile(wb, "Template_Master_Tabung.csv", { bookType: "csv" });
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim()) return;
    setAddingSingle(true);
    try {
      const res = await fetch("/api/cylinders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial_number: newSerial.trim(),
          cylinder_number: newCylNumber.trim(),
          gas_type: newGas.trim() || "-",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewSerial("");
        setNewCylNumber("");
        setNewGas("");
        setBanner({
          type: "success",
          message: `Tabung ${data.cylinder.serial_number} berhasil disimpan ke Master Database.`,
        });
        await fetchMasterData(debouncedQuery);
      }
    } catch {
      setBanner({
        type: "error",
        message: "Gagal menambahkan tabung.",
      });
    } finally {
      setAddingSingle(false);
    }
  };

  const handleDeleteCylinder = async (id: number, serial: string) => {
    if (!window.confirm(`Hapus tabung ${serial} dari Master Database?`)) return;
    try {
      await fetch(`/api/cylinders?id=${id}`, { method: "DELETE" });
      await fetchMasterData(debouncedQuery);
    } catch {
      alert("Gagal menghapus tabung");
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Status Banner */}
      {banner && (
        <div
          className={`p-4 rounded-3xl shadow-xl flex items-start justify-between gap-2 animate-toast-pop ${banner.type === "success"
              ? "bg-[#18181B] text-white"
              : "bg-[#F43F5E] text-white"
            }`}
        >
          <div className="flex items-start gap-2.5 text-xs font-semibold">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HERO MASTER DB COUNTER CARD */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] text-center space-y-3">
        <div className="space-y-1">
          <div className="inline-flex items-center justify-center gap-1.5">
            <span className="text-4xl font-extrabold tracking-tight text-[#18181B]">
              {totalMaster.toLocaleString("id-ID")}
            </span>
            <span className="w-5 h-5 rounded-full border border-[#E4E7EC] inline-flex items-center justify-center text-[#18181B]">
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-xs font-medium text-[#71717A]">
            Data Master Tabung Terdaftar
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-[#E4E7EC] text-xs font-bold text-[#18181B] hover:bg-[#F4F5F7] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#18181B]" />
            <span>Download Contoh CSV</span>
          </button>
        </div>
      </section>

      {/* 1. MODUL IMPORT DATABASE MASTER (CSV / EXCEL) */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#18181B] text-white flex items-center justify-center">
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#18181B] leading-tight">
              Import CSV / Excel Master Tabung
            </h2>
            <p className="text-[11px] text-[#71717A] font-medium">
              Serial Number, Nomor Tabung, dan Jenis Gas
            </p>
          </div>
        </div>

        {/* File Dropzone */}
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E4E7EC] hover:border-[#18181B] bg-[#F4F5F7]/60 hover:bg-white rounded-3xl p-5 text-center cursor-pointer transition-all">
          <div className="w-10 h-10 rounded-2xl bg-black/5 text-[#18181B] flex items-center justify-center mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-[#18181B]">
            Pilih File CSV (.csv) atau Excel (.xlsx)
          </span>
          <span className="text-[11px] text-[#71717A] mt-0.5">
            Siap mengimpor 6.500+ data tabung sekaligus
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Column Mapping & Preview */}
        {rawSheetRows.length > 0 && (
          <div className="bg-[#F4F5F7] rounded-3xl p-4 space-y-3.5 border border-[#E4E7EC]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#18181B]">
                  File: {fileName}
                </h3>
                <p className="text-[11px] text-[#71717A] font-semibold">
                  {rawSheetRows.length.toLocaleString("id-ID")} baris siap
                  diimpor
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRawSheetRows([]);
                  setSheetHeaders([]);
                  setFileName("");
                }}
                className="px-3 py-1 rounded-full bg-white text-[11px] text-[#18181B] font-bold border border-[#E4E7EC] hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                  1. Kolom Serial Number <span className="text-[#E11D48]">*</span>
                </label>
                <select
                  value={colSerial}
                  onChange={(e) => setColSerial(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EC] rounded-2xl px-3.5 py-2.5 font-semibold text-[#18181B] focus:border-[#18181B] focus:outline-none"
                >
                  <option value="">-- Pilih Kolom Serial Number --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                  2. Kolom Nomor Tabung
                </label>
                <select
                  value={colCylNumber}
                  onChange={(e) => setColCylNumber(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EC] rounded-2xl px-3.5 py-2.5 font-semibold text-[#18181B] focus:border-[#18181B] focus:outline-none"
                >
                  <option value="">-- Pilih Kolom Nomor Tabung --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                  3. Kolom Jenis Gas
                </label>
                <select
                  value={colGas}
                  onChange={(e) => setColGas(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EC] rounded-2xl px-3.5 py-2.5 font-semibold text-[#18181B] focus:border-[#18181B] focus:outline-none"
                >
                  <option value="">-- Pilih Kolom Jenis Gas --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode Segmented Pills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#71717A]">
                Mode Import:
              </span>
              <div className="bg-[#E4E7EC] p-1 rounded-full grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setImportMode("replace")}
                  className={`py-1.5 px-3 rounded-full text-[11px] font-bold transition-all ${importMode === "replace"
                      ? "bg-[#18181B] text-white shadow-xs"
                      : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                >
                  Ganti Semua Data
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("upsert")}
                  className={`py-1.5 px-3 rounded-full text-[11px] font-bold transition-all ${importMode === "upsert"
                      ? "bg-[#18181B] text-white shadow-xs"
                      : "text-[#71717A] hover:text-[#18181B]"
                    }`}
                >
                  Tambah / Update
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="w-full py-3 px-5 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.1)] cursor-pointer transition-all"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Mengimpor...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>
                    Proses Import ({rawSheetRows.length.toLocaleString("id-ID")}{" "}
                    Tabung)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* 2. TAMBAH TABUNG SATUAN */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
        <h3 className="text-xs font-bold text-[#18181B]">
          Tambah Tabung Satuan
        </h3>
        <form onSubmit={handleAddSingle} className="space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newSerial}
              onChange={(e) => setNewSerial(e.target.value)}
              placeholder="Serial Number *"
              required
              className="px-3.5 py-2.5 bg-[#F4F5F7] rounded-2xl font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#18181B] transition-all"
            />
            <input
              type="text"
              value={newCylNumber}
              onChange={(e) => setNewCylNumber(e.target.value)}
              placeholder="Nomor Tabung"
              className="px-3.5 py-2.5 bg-[#F4F5F7] rounded-2xl font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#18181B] transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newGas}
              onChange={(e) => setNewGas(e.target.value)}
              placeholder="Jenis Gas"
              className="px-3.5 py-2.5 bg-[#F4F5F7] rounded-2xl font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#18181B] transition-all"
            />
            <button
              type="submit"
              disabled={addingSingle}
              className="py-2.5 px-4 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Simpan Tabung</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. TABEL MASTER TABUNG */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#18181B]">
              Daftar Master Tabung
            </h3>
            <p className="text-[11px] font-medium text-[#71717A]">
              Menampilkan {cylinders.length} dari{" "}
              {matchedCount.toLocaleString("id-ID")} data
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Serial Number, Nomor Tabung, atau Gas..."
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal bg-[#F4F5F7] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-[#18181B] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#A1A1AA] hover:text-[#18181B]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#18181B]" />
            <span className="text-xs text-[#71717A]">
              Memuat data master...
            </span>
          </div>
        ) : cylinders.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-[#F4F5F7]/70 space-y-1">
            <p className="text-xs font-bold text-[#18181B]">
              Database Master Kosong (0 Tabung)
            </p>
            <p className="text-[11px] text-[#71717A]">
              Silakan kirim atau upload file CSV Anda untuk diimpor ke database.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#F0F1F3] text-[11px] font-medium text-[#71717A]">
                  <th className="py-2 pr-2 font-medium">Serial Number</th>
                  <th className="py-2 px-2 font-medium">No. Tabung</th>
                  <th className="py-2 px-2 font-medium text-right">
                    Jenis Gas
                  </th>
                  <th className="py-2 pl-2 font-medium text-right w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3] text-xs">
                {cylinders.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 pr-2 font-bold text-[#18181B]">
                      {c.serial_number}
                    </td>
                    <td className="py-3 px-2 font-semibold text-[#18181B]">
                      {c.cylinder_number || "-"}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-[#71717A]">
                      {c.gas_type}
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteCylinder(c.id, c.serial_number)
                        }
                        className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#F43F5E] hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
