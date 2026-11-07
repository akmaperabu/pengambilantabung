"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Lock,
  Building2,
  FileText,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  RotateCcw,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import QrScannerModal, {
  ScannedCylinderItem,
} from "@/components/QrScannerModal";

interface MasterCylinder {
  id: number;
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
}

const DRAFT_STORAGE_KEY = "asset_retrieval_active_ticket_draft_v2";

export default function CreateTicketPage() {
  const router = useRouter();

  // 1. Header Form State
  const [customerName, setCustomerName] = useState("");
  const [sjNumber, setSjNumber] = useState("");
  const [retrievalDate, setRetrievalDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  // 2. Active Ticket Items State
  const [ticketItems, setTicketItems] = useState<ScannedCylinderItem[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // 3. QR Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // 4. Live Search & Multi-select State (300ms Debounce Server-Side)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MasterCylinder[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMap, setSelectedMap] = useState<
    Record<string, MasterCylinder>
  >({});

  // 5. Notification / Saving State
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmLock, setShowConfirmLock] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ScannedCylinderItem | null>(
    null
  );

  // Load saved draft from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem("asset_retrieval_active_ticket_draft_v1");
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.customerName) setCustomerName(parsed.customerName);
        if (parsed.sjNumber) setSjNumber(parsed.sjNumber);
        if (parsed.retrievalDate) setRetrievalDate(parsed.retrievalDate);
        if (parsed.notes) setNotes(parsed.notes);
        if (Array.isArray(parsed.ticketItems)) {
          setTicketItems(parsed.ticketItems);
        }
      }
    } catch {
      // ignore storage error
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  // Save draft to localStorage whenever form or items change
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          customerName,
          sjNumber,
          retrievalDate,
          notes,
          ticketItems,
        })
      );
    } catch {
      // ignore storage error
    }
  }, [customerName, sjNumber, retrievalDate, notes, ticketItems, draftLoaded]);

  // Auto-hide toast after 3.5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounce search input (300ms as specified in PRD)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Server-Side Live Search results
  useEffect(() => {
    let active = true;
    async function fetchCylinders() {
      setIsSearching(true);
      try {
        const url = `/api/cylinders?q=${encodeURIComponent(
          debouncedQuery
        )}&limit=50`;
        const res = await fetch(url);
        const data = await res.json();
        if (!active) return;
        setSearchResults(data.items || []);
        setMatchedCount(data.matchedCount || 0);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }
    fetchCylinders();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // Set of serial numbers already in the active ticket
  const existingSerials = useMemo(
    () => new Set(ticketItems.map((i) => i.serial_number.toUpperCase())),
    [ticketItems]
  );

  // Summary breakdown by gas type
  const gasSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of ticketItems) {
      const g = item.gas_type || "-";
      counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts);
  }, [ticketItems]);

  // Handler to add single cylinder (from QR Scanner)
  const handleAddSingleCylinder = (item: ScannedCylinderItem) => {
    const serial = item.serial_number.trim().toUpperCase();
    setTicketItems((prev) => {
      if (prev.some((p) => p.serial_number.toUpperCase() === serial)) {
        return prev;
      }
      return [{ ...item, serial_number: serial }, ...prev];
    });
  };

  // Toggle checkbox in Live Search results
  const toggleSelectCylinder = (cyl: MasterCylinder) => {
    const serial = cyl.serial_number.toUpperCase();
    if (existingSerials.has(serial)) return;

    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[serial]) {
        delete next[serial];
      } else {
        next[serial] = cyl;
      }
      return next;
    });
  };

  // Select all visible search results not yet in ticket
  const handleSelectAllVisible = () => {
    const selectable = searchResults.filter(
      (c) => !existingSerials.has(c.serial_number.toUpperCase())
    );
    const allSelected =
      selectable.length > 0 &&
      selectable.every((c) =>
        Boolean(selectedMap[c.serial_number.toUpperCase()])
      );

    if (allSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const c of selectable) {
          delete next[c.serial_number.toUpperCase()];
        }
        return next;
      });
    } else {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const c of selectable) {
          next[c.serial_number.toUpperCase()] = c;
        }
        return next;
      });
    }
  };

  // Insert checked cylinders into active ticket
  const handleInsertCheckedToTicket = () => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) return;

    const newItems: ScannedCylinderItem[] = [];
    for (const cyl of selectedList) {
      const serial = cyl.serial_number.toUpperCase();
      if (!existingSerials.has(serial)) {
        newItems.push({
          serial_number: serial,
          cylinder_number: cyl.cylinder_number || "-",
          gas_type: cyl.gas_type || "-",
          input_method: "SEARCH",
        });
      }
    }

    if (newItems.length > 0) {
      setTicketItems((prev) => [...newItems, ...prev]);
      setSelectedMap({});
      setToast({
        type: "success",
        text: `${newItems.length} tabung dimasukkan ke tiket`,
      });
    }
  };

  // Confirm remove item from active ticket
  const handleConfirmDeleteItem = () => {
    if (!itemToDelete) return;
    const serial = itemToDelete.serial_number;
    setTicketItems((prev) =>
      prev.filter(
        (item) =>
          item.serial_number.toUpperCase() !== serial.toUpperCase()
      )
    );
    setItemToDelete(null);
    setToast({
      type: "success",
      text: `Tabung ${serial} telah dihapus dari tiket`,
    });
  };

  // Reset / Clear current draft
  const handleResetDraft = () => {
    if (
      ticketItems.length > 0 &&
      !window.confirm(
        "Kosongkan semua daftar tabung dan form pada tiket aktif ini?"
      )
    ) {
      return;
    }
    setCustomerName("");
    setSjNumber("");
    setNotes("");
    setTicketItems([]);
    setSelectedMap({});
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  // Validate before opening lock confirmation
  const handlePreSaveCheck = () => {
    if (!customerName.trim()) {
      setToast({
        type: "error",
        text: "Isi Nama PT nya dulu kocak!",
      });
      return;
    }
    if (!sjNumber.trim()) {
      setToast({
        type: "error",
        text: "Isi SJ nya dulu kocak!",
      });
      return;
    }
    if (ticketItems.length === 0) {
      setToast({
        type: "error",
        text: "Lah Tabung nya mana?",
      });
      return;
    }
    setShowConfirmLock(true);
  };

  // Finalize: Save & Lock Ticket to SQLite DB
  const handleSaveAndLockTicket = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          sj_number: sjNumber.trim(),
          retrieval_date: retrievalDate,
          notes: notes.trim(),
          items: ticketItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan tiket");
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setShowConfirmLock(false);
      router.push(`/tickets/${data.ticket.id}?created=1`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan tiket ke server";
      setToast({ type: "error", text: msg });
      setShowConfirmLock(false);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = Object.keys(selectedMap).length;
  const selectableInSearch = searchResults.filter(
    (c) => !existingSerials.has(c.serial_number.toUpperCase())
  );

  return (
    <div className="space-y-4">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 inset-x-0 mx-auto z-50 w-[92%] max-w-sm px-4 py-3 rounded-2xl shadow-xl border flex items-center justify-between gap-2 transition-all animate-toast-pop ${toast.type === "success"
            ? "bg-[#18181B] text-white border-white/10"
            : "bg-[#F43F5E] text-white border-rose-500"
            }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold min-w-0">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span className="break-words leading-snug">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* FORM HEADER TIKET CARD */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#18181B] flex items-center justify-center text-white">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#18181B] leading-tight">
                Dokumen Pengambilan
              </h2>
              <p className="text-[11px] text-[#71717A] font-medium">
                Identitas Customer & Surat Jalan
              </p>
            </div>
          </div>

          {(customerName || sjNumber || ticketItems.length > 0) && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[#E4E7EC] text-[11px] font-semibold text-[#18181B] hover:bg-[#F4F5F7] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
              Nama Perusahaan / Customer <span className="text-[#E11D48]">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: PT. Sumber Daya Energi"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal bg-[#F4F5F7] border border-transparent rounded-2xl focus:bg-white focus:border-[#18181B] focus:ring-2 focus:ring-black/5 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                No. Surat Jalan <span className="text-[#E11D48]">*</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sjNumber}
                  onChange={(e) => setSjNumber(e.target.value)}
                  placeholder="SJ/2026/001"
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal bg-[#F4F5F7] border border-transparent rounded-2xl focus:bg-white focus:border-[#18181B] focus:ring-2 focus:ring-black/5 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#71717A] mb-1">
                Tanggal <span className="text-[#E11D48]">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={retrievalDate}
                  onChange={(e) => setRetrievalDate(e.target.value)}
                  className="w-full pl-9 pr-2.5 py-2.5 text-xs sm:text-sm font-semibold text-[#18181B] bg-[#F4F5F7] border border-transparent rounded-2xl focus:bg-white focus:border-[#18181B] focus:ring-2 focus:ring-black/5 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCAN QR & LIVE SEARCH CARD */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        {/* Primary Action: Scan Barcode QR Button */}
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="w-full py-3.5 px-5 rounded-2xl bg-[#18181B] hover:bg-[#27272A] active:scale-[0.99] text-white font-bold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.1)] flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight">
                Kalo mau scan disini masee
              </p>
              <p className="text-[11px] text-gray-400 font-medium">
                Klik langsung scan tabungnya!
              </p>
            </div>
          </div>
        </button>

        {/* Live Search Autocomplete Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18181B]">

            </span>
            <span className="text-[11px] font-medium text-[#71717A]">
              {isSearching ? (
                <span className="inline-flex items-center gap-1 text-[#18181B]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mencari...
                </span>
              ) : (
                `${matchedCount.toLocaleString("id-ID")} cocok`
              )}
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik Serial Number, Nomor Tabung, atau Gas..."
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal bg-[#F4F5F7] border border-transparent rounded-2xl focus:bg-white focus:border-[#18181B] focus:ring-2 focus:ring-black/5 focus:outline-none transition-all"
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

          {/* Filter & Select All Pill Bar */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-[#71717A]">
              Centang tabung terus klik Masukkan
            </span>
            {selectableInSearch.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-3 py-1 rounded-full border border-[#E4E7EC] text-[11px] font-semibold text-[#18181B] hover:bg-[#F4F5F7] transition-colors cursor-pointer"
              >
                {selectableInSearch.every(
                  (c) => selectedMap[c.serial_number.toUpperCase()]
                )
                  ? "Batal Pilih"
                  : `Pilih Semua (${selectableInSearch.length})`}
              </button>
            )}
          </div>

          {/* Multi-select Floating Bar inside Card when items are checked */}
          {selectedCount > 0 && (
            <div className="bg-[#18181B] text-white p-3 rounded-2xl flex items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white text-[#18181B] text-xs font-extrabold flex items-center justify-center">
                  {selectedCount}
                </span>
                <span className="text-xs font-semibold">Nah ini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMap({})}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleInsertCheckedToTicket}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white text-[#18181B] hover:bg-gray-100 text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Bree
                </button>
              </div>
            </div>
          )}

          {/* Clean Minimalist Search Results List */}
          <div className="divide-y divide-[#F4F5F7] max-h-60 overflow-y-auto pr-0.5">
            {searchResults.length === 0 ? (
              <div className="py-6 text-center space-y-2.5">
                <p className="text-xs text-[#71717A]">
                  {debouncedQuery
                    ? `Tidak ada tabung dengan kata kunci "${debouncedQuery}"`
                    : "Database Master masih kosong. Silakan import CSV di menu Master DB."}
                </p>
                {debouncedQuery.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const code = debouncedQuery.toUpperCase();
                      if (existingSerials.has(code)) {
                        setToast({
                          type: "error",
                          text: `Tabung ${code} sudah ada di dalam daftar.`,
                        });
                        return;
                      }
                      handleAddSingleCylinder({
                        serial_number: code,
                        cylinder_number: "-",
                        gas_type: "-",
                        input_method: "SEARCH",
                      });
                      setSearchQuery("");
                      setToast({
                        type: "success",
                        text: `Tabung "${code}" ditambahkan ke daftar`,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#18181B] text-white text-xs font-bold hover:bg-[#27272A] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Manual &ldquo;{debouncedQuery.toUpperCase()}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              searchResults.map((cyl) => {
                const serial = cyl.serial_number.toUpperCase();
                const alreadyInTicket = existingSerials.has(serial);
                const isChecked = Boolean(selectedMap[serial]);

                return (
                  <div
                    key={cyl.id}
                    onClick={() => {
                      if (!alreadyInTicket) toggleSelectCylinder(cyl);
                    }}
                    className={`flex items-center justify-between py-2.5 px-2 rounded-xl transition-colors ${alreadyInTicket
                      ? "opacity-40 cursor-not-allowed"
                      : isChecked
                        ? "bg-[#F4F5F7] cursor-pointer"
                        : "hover:bg-[#F4F5F7]/70 cursor-pointer"
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {alreadyInTicket ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          Masuk
                        </span>
                      ) : isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#18181B] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[#D4D4D8] shrink-0" />
                      )}

                      <div className="truncate">
                        <p className="font-bold text-[#18181B] text-xs sm:text-sm leading-tight">
                          {cyl.serial_number}
                        </p>
                        <p className="text-[11px] text-[#71717A] font-medium">
                          No. Tabung:{" "}
                          <strong className="text-[#18181B]">
                            {cyl.cylinder_number || "-"}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-[#52525B] bg-[#F4F5F7] px-2.5 py-1 rounded-full shrink-0">
                      {cyl.gas_type}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* GAS TYPE MINI-CARDS WITH HATCHED PROGRESS BARS (When ticket has items) */}
      {gasSummary.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {gasSummary.slice(0, 3).map(([gas, count], idx) => {
            const pct =
              ticketItems.length > 0
                ? Math.round((count / ticketItems.length) * 100)
                : 0;
            const barColor =
              idx === 0
                ? "bg-[#18181B]"
                : idx === 1
                  ? "bg-[#52525B]"
                  : "bg-[#A1A1AA]";
            return (
              <div
                key={gas}
                className="bg-white rounded-2xl p-3 border border-[#F0F1F3] shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between text-center"
              >
                <p className="text-[11px] font-semibold text-[#71717A] truncate">
                  {gas}
                </p>
                <div className="my-1.5">
                  <p className="text-lg font-extrabold text-[#18181B] leading-none">
                    {count}
                  </p>
                  <p className="text-[10px] font-medium text-[#71717A] mt-0.5">
                    tabung ({pct}%)
                  </p>
                </div>
                <div className="w-full h-2 rounded-full bg-hatch-pattern overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.max(18, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABEL REKAP TIKET AKTIF */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#18181B] flex items-center justify-center text-white">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#18181B] leading-tight">
                Daftar Tabung
              </h2>
              <p className="text-[11px] text-[#71717A] font-medium">
                Real-time • {ticketItems.length} tabung siap ditarik
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-[#F4F5F7] text-[#18181B] font-extrabold text-xs">
            {ticketItems.length} Item
          </span>
        </div>

        {ticketItems.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl bg-[#F4F5F7]/70 space-y-1">
            <p className="text-xs font-bold text-[#18181B]">
              Belum ada tabung di pengambilan aktif
            </p>
            <p className="text-[11px] text-[#71717A]">
              Scan QR tabung atau centang dari pencarian di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0F1F3] text-[11px] font-medium text-[#71717A]">
                  <th className="py-2 pr-2 font-medium">Serial Number</th>
                  <th className="py-2 px-2 font-medium">No. Tabung</th>
                  <th className="py-2 px-2 font-medium text-center">
                    Jenis Gas
                  </th>
                  <th className="py-2 pl-2 font-medium text-right w-10">
                    Hapus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3] text-xs">
                {ticketItems.map((item, idx) => (
                  <tr
                    key={item.serial_number}
                    className="group hover:bg-[#F9FAFB] transition-colors"
                  >
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[#A1A1AA] w-4">
                          {idx + 1}.
                        </span>
                        <span className="font-bold text-[#18181B] tracking-tight">
                          {item.serial_number}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 font-semibold text-[#18181B]">
                      {item.cylinder_number || "-"}
                    </td>
                    <td className="py-3 px-2 text-center font-medium text-[#71717A]">
                      {item.gas_type}
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#F43F5E] hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Hapus tabung"
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

        {/* Full-Width Pill Button inside Card */}
        <button
          type="button"
          onClick={handlePreSaveCheck}
          disabled={isSaving}
          className="w-full py-3.5 px-6 rounded-full bg-[#18181B] hover:bg-[#27272A] active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.1)] transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4 text-white" />
          <span>Beres Men! (ada {ticketItems.length} Tabung)</span>
        </button>
      </section>

      {/* MODAL KONFIRMASI SIMPAN & KUNCI TIKET */}
      {showConfirmLock && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-[#F0F1F3] overflow-hidden p-5 space-y-4 animate-toast-pop">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#18181B] text-white flex items-center justify-center">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#18181B]">
                    Ini udah aman bre?
                  </h3>
                  <p className="text-[11px] text-[#71717A]">
                    Pastikan fisik tabung sudah sesuai
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmLock(false)}
                className="w-7 h-7 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#71717A] hover:text-[#18181B] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F4F5F7] p-3.5 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#71717A]">Customer</span>
                <strong className="text-[#18181B] text-right">
                  {customerName}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">No. Surat Jalan</span>
                <strong className="text-[#18181B] text-right">
                  {sjNumber}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Tanggal</span>
                <strong className="text-[#18181B]">{retrievalDate}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E4E7EC]">
                <span className="text-[#18181B] font-bold">Total Tabung</span>
                <strong className="text-[#18181B] text-sm font-extrabold">
                  {ticketItems.length} Tabung
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmLock(false)}
                disabled={isSaving}
                className="py-2.5 px-4 rounded-full border border-[#E4E7EC] text-[#18181B] text-xs font-bold hover:bg-[#F4F5F7] transition-colors"
              >
                Bentar dulu deh
              </button>
              <button
                type="button"
                onClick={handleSaveAndLockTicket}
                disabled={isSaving}
                className="py-2.5 px-4 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Gass!!</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL APPROVAL HAPUS TABUNG DARI TIKET */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-[#F0F1F3] overflow-hidden p-5 space-y-4 animate-toast-pop">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#18181B]">
                    Yakin mau di hapus?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="w-7 h-7 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F4F5F7] p-3.5 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#71717A]">Serial Number</span>
                <strong className="text-[#18181B] font-bold">
                  {itemToDelete.serial_number}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">No. Tabung</span>
                <span className="text-[#18181B] font-semibold">
                  {itemToDelete.cylinder_number || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717A]">Jenis Gas</span>
                <span className="text-[#18181B] font-semibold">
                  {itemToDelete.gas_type || "-"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="py-2.5 px-4 rounded-full border border-[#E4E7EC] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F5F7] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sikat men</span>
              </button>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-4 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer text-center"
              >
                gajadi deh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER KAMERA QR */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        existingSerials={existingSerials}
        onAddCylinder={handleAddSingleCylinder}
      />
    </div>
  );
}
