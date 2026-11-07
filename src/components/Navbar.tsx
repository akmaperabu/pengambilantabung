"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FileSpreadsheet,
  Database,
  History,
  ChevronsUpDown,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Buat Pengambilan",
      icon: LayoutGrid,
      active: pathname === "/",
    },
    {
      href: "/tickets",
      label: "Riwayat",
      icon: History,
      active: pathname.startsWith("/tickets"),
    },
    {
      href: "/master",
      label: "Master DB",
      icon: Database,
      active: pathname.startsWith("/master"),
    },
  ];

  return (
    <>
      {/* Top Pill Header (Modern Soft Minimalist Style) */}
      <header className="sticky top-0 z-30 pt-3 pb-1 px-4 max-w-md w-full mx-auto bg-[#F6F7F9]/85 backdrop-blur-md">
        <div className="bg-white rounded-3xl px-4 py-3 border border-[#F0F1F3] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-2xl bg-[#18181B] flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs shrink-0">
              =
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-[#18181B] tracking-tight truncate">
                Pengambilan Tabung
              </span>
              <span className="hidden xs:inline-flex items-center gap-0.5 text-[11px] font-medium text-[#71717A] bg-[#F4F5F7] px-2.5 py-0.5 rounded-full">
                Tabung Gas
                <ChevronsUpDown className="w-3 h-3 text-[#A1A1AA]" />
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/tickets"
              title="Riwayat Tiket"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${pathname.startsWith("/tickets")
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-[#F4F5F7] text-[#52525B] hover:bg-[#E4E7EC] hover:text-[#18181B]"
                }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Link>
            <Link
              href="/master"
              title="Database Master"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${pathname.startsWith("/master")
                ? "bg-[#18181B] text-white shadow-xs"
                : "bg-[#F4F5F7] text-[#52525B] hover:bg-[#E4E7EC] hover:text-[#18181B]"
                }`}
            >
              <Database className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Dock (Inspired by DailyLoop reference) */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-sm bg-white/95 backdrop-blur-xl rounded-full p-1.5 border border-black/[0.06] shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full transition-all text-xs ${item.active
                  ? "bg-[#18181B] text-white font-semibold shadow-xs"
                  : "text-[#18181B] font-normal hover:bg-[#F4F5F7]"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${item.active ? "text-white" : "text-[#18181B]"
                    }`}
                  strokeWidth={item.active ? 2.2 : 1.7}
                />
                <span
                  className={`inline whitespace-nowrap ${item.active
                    ? "text-white font-semibold"
                    : "text-[#18181B] font-normal"
                    }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
