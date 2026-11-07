"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  Calendar,
  Lock,
  Plus,
  Loader2,
  X,
} from "lucide-react";

interface TicketSummary {
  id: number;
  ticket_code: string;
  customer_name: string;
  sj_number: string;
  retrieval_date: string;
  notes: string;
  total_items: number;
  status: string;
  created_at: string;
}

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let active = true;
    async function loadTickets() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/tickets?q=${encodeURIComponent(debouncedQuery)}`
        );
        const data = await res.json();
        if (active) {
          setTickets(data.tickets || []);
        }
      } catch {
        if (active) setTickets([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTickets();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  return (
    <div className="space-y-3.5">
      {/* Top Header Row */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div>
          <h1 className="text-base font-bold text-[#18181B] tracking-tight">
            Riwayat Pengambilan
          </h1>
          <p className="text-xs text-[#71717A]">
            {tickets.length} pengambilan tersimpan
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18181B] text-white text-xs font-semibold hover:bg-[#27272A] transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Pengambilan</span>
        </Link>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white rounded-2xl p-2.5 border border-[#F0F1F3] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari apapun ketik disini mase..."
            className="w-full pl-9 pr-9 py-1 text-xs sm:text-sm font-semibold text-[#18181B] placeholder:text-[#A1A1AA] placeholder:font-normal bg-transparent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#A1A1AA] hover:text-[#18181B]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* TICKET CARDS LIST */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-[#F0F1F3] p-10 text-center flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#18181B]" />
          <span className="text-xs font-medium text-[#71717A]">
            Memuat riwayat tiket...
          </span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#F0F1F3] p-8 text-center space-y-3">
          <p className="text-sm font-bold text-[#18181B]">
            {debouncedQuery
              ? `Tidak ada tiket yang cocok dengan "${debouncedQuery}"`
              : "Belum ada tiket pengambilan yang disimpan"}
          </p>
          <p className="text-xs text-[#71717A]">
            Tiket yang sudah di-Simpan & Kunci akan tampil di sini.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#18181B] text-white text-xs font-bold hover:bg-[#27272A] transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Buat Tiket Pertama</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t, index) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="block bg-white rounded-3xl border border-[#F0F1F3] hover:border-black/15 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-4 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-1 h-11 rounded-full shrink-0 mt-0.5 ${index % 2 === 0 ? "bg-[#18181B]" : "bg-[#71717A]"
                      }`}
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        <Lock className="w-2.5 h-2.5" />
                        Beres
                      </span>
                      <span className="text-[11px] font-medium text-[#71717A]">
                        {t.ticket_code}
                      </span>
                    </div>

                    <h3 className="font-bold text-[#18181B] text-sm truncate">
                      {t.customer_name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717A] font-medium">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {t.sj_number}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t.retrieval_date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-[#18181B] leading-none">
                    {t.total_items}
                  </p>
                  <p className="text-[10px] font-medium text-[#71717A] mt-0.5">
                    tabung
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
