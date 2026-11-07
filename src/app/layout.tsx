import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Bantuan Catat No Tabung Anjay",
  description:
    "Aplikasi Mobile-First Pendukung Pengambilan Aset Tabung Gas via Scan QR & Live Search Autocomplete",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body
        className={`${jakarta.className} min-h-screen flex flex-col bg-[#F6F7F9] text-[#18181B] antialiased selection:bg-[#18181B] selection:text-white`}
      >
        <Navbar />
        <main className="flex-1 max-w-md w-full mx-auto px-4 pt-3 pb-32">
          {children}
        </main>
      </body>
    </html>
  );
}
