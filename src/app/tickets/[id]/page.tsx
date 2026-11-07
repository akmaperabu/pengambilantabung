"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Check,
  Download,
  Trash2,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";

interface TicketDetail {
  id: number;
  ticket_code: string;
  customer_name: string;
  sj_number: string;
  retrieval_date: string;
  notes: string;
  total_items: number;
  created_at: string;
}

interface TicketItemRow {
  id: number;
  ticket_id: number;
  serial_number: string;
  cylinder_number: string;
  gas_type: string;
  input_method: string;
  created_at: string;
}

function TicketDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const justCreated = searchParams.get("created") === "1";

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [items, setItems] = useState<TicketItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedMode, setCopiedMode] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/tickets/${params.id}`);
        if (!res.ok) {
          setTicket(null);
          return;
        }
        const data = await res.json();
        setTicket(data.ticket);
        setItems(data.items || []);
      } catch {
        setTicket(null);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) {
      loadDetail();
    }
  }, [params.id]);

  const gasSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const g = item.gas_type || "-";
      counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts);
  }, [items]);

  const handleCopySerials = async (format: "newline" | "comma") => {
    const serials = items.map((i) => i.serial_number);
    const text = format === "newline" ? serials.join("\n") : serials.join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(format);
      setTimeout(() => setCopiedMode(null), 2500);
    } catch {
      alert("Gagal menyalin ke clipboard");
    }
  };

  const handleExportExcel = async () => {
    if (!ticket) return;
    const XLSX = await import("xlsx");
    const rows = items.map((item, index) => ({
      No: index + 1,
      "Kode Tiket": ticket.ticket_code,
      "Nama Customer": ticket.customer_name,
      "No. Surat Jalan": ticket.sj_number,
      "Tanggal Pengambilan": ticket.retrieval_date,
      "Serial Number": item.serial_number,
      "Nomor Tabung": item.cylinder_number || "-",
      "Jenis Gas": item.gas_type,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Tabung");
    const safeSj = ticket.sj_number.replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Tiket_${safeSj}_${ticket.retrieval_date}.xlsx`);
  };

  const handleDeleteTicket = async () => {
    if (
      !ticket ||
      !window.confirm(
        `Hapus tiket ${ticket.ticket_code} (${ticket.customer_name}) secara permanen?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/tickets");
      }
    } catch {
      alert("Gagal menghapus tiket");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-[#F0F1F3] p-10 text-center flex flex-col items-center gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <Loader2 className="w-7 h-7 animate-spin text-[#18181B]" />
        <p className="text-xs font-medium text-[#71717A]">
          Memuat detail tiket...
        </p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-white rounded-3xl border border-[#F0F1F3] p-8 text-center space-y-3 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <p className="text-sm font-bold text-[#18181B]">
          Tiket tidak ditemukan
        </p>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#18181B] text-white text-xs font-bold hover:bg-[#27272A] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Riwayat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Just Created Toast Card */}
      {justCreated && (
        <div className="bg-[#18181B] text-white p-4 rounded-3xl shadow-xl flex items-start gap-3 animate-toast-pop">
          <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <h3 className="font-bold text-sm">
              Okee Bree.. Mantap!!!!
            </h3>
            <p className="text-gray-300 text-[11px]">
              Langsung Kabari CMS, tarik di mitragas.
            </p>
          </div>
        </div>
      )}

      {/* TOP SUMMARY & BREAKDOWN CARD */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        {/* Top Row: Circular Back Button + Centered Title + Delete Button */}
        <div className="flex items-center justify-between">
          <Link
            href="/tickets"
            className="w-8 h-8 rounded-full bg-[#F4F5F7] hover:bg-[#E4E7EC] flex items-center justify-center text-[#18181B] transition-colors"
            title="Kembali"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="text-center min-w-0 px-2">
            <h2 className="text-sm font-bold text-[#18181B] truncate">
              {ticket.customer_name}
            </h2>
            <p className="text-[11px] font-medium text-[#71717A]">
              SJ: {ticket.sj_number} • {ticket.retrieval_date}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDeleteTicket}
            className="w-8 h-8 rounded-full bg-[#F4F5F7] hover:bg-rose-50 hover:text-[#F43F5E] flex items-center justify-center text-[#71717A] transition-colors"
            title="Hapus Tiket"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Big Metric Number */}
        <div className="pt-1 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-[#18181B]">
              {items.length}
            </span>
            <span className="text-xs font-medium text-[#71717A]">
              tabung ditarik
            </span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
            <Lock className="w-3 h-3" />
            {ticket.ticket_code}
          </span>
        </div>

        {/* Gas Type Mini Cards */}
        {gasSummary.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {gasSummary.map(([gas, count]) => {
              const pct =
                items.length > 0
                  ? ((count / items.length) * 100).toFixed(1)
                  : "0";
              return (
                <div
                  key={gas}
                  className="bg-[#F4F5F7] rounded-2xl p-2.5 text-center space-y-1"
                >
                  <p className="text-[11px] font-semibold text-[#18181B] truncate">
                    {gas}
                  </p>
                  <p className="text-base font-extrabold text-[#18181B] leading-none">
                    {count}
                  </p>
                  <p className="text-[10px] text-[#71717A]">tabung</p>
                  <p className="text-[10px] font-bold text-[#18181B] pt-0.5">
                    {pct}%
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Pill Buttons (Copy & Export) */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCopySerials("newline")}
              className="py-2.5 px-3 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {copiedMode === "newline" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Salin Serial (Baris)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopySerials("comma")}
              className="py-2.5 px-3 rounded-full bg-[#F4F5F7] hover:bg-[#E4E7EC] text-[#18181B] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedMode === "comma" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#71717A]" />
                  <span>Salin Serial (Koma)</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full py-2.5 px-4 rounded-full border border-[#E4E7EC] text-[#18181B] hover:bg-[#F4F5F7] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#18181B]" />
            <span>Download Rekap Excel (.xlsx)</span>
          </button>
        </div>
      </section>

      {/* MINIMALIST TABLE LIST */}
      <section className="bg-white rounded-3xl p-5 border border-[#F0F1F3] shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#18181B]">
            Daftar Tabung ({items.length})
          </h3>
          <span className="text-[11px] font-medium text-[#71717A]">
            {ticket.created_at}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F0F1F3] text-[11px] font-medium text-[#71717A]">
                <th className="py-2 pr-2 font-medium">Serial Number</th>
                <th className="py-2 px-2 font-medium">No. Tabung</th>
                <th className="py-2 pl-2 font-medium text-right">Jenis Gas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F3] text-xs">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-3 pr-2">
                    <span className="text-[#A1A1AA] font-medium mr-2">
                      {idx + 1}.
                    </span>
                    <span className="font-bold text-[#18181B]">
                      {item.serial_number}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-semibold text-[#18181B]">
                    {item.cylinder_number || "-"}
                  </td>
                  <td className="py-3 pl-2 text-right font-medium text-[#71717A]">
                    {item.gas_type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-3xl border border-[#F0F1F3] p-10 text-center flex flex-col items-center gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <Loader2 className="w-7 h-7 animate-spin text-[#18181B]" />
          <p className="text-xs font-medium text-[#71717A]">
            Memuat detail tiket...
          </p>
        </div>
      }
    >
      <TicketDetailContent />
    </Suspense>
  );
}
