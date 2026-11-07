import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-white rounded-3xl border border-[#F0F1F3] p-8 text-center space-y-3 shadow-xs my-6">
      <h2 className="text-base font-bold text-[#18181B] tracking-tight">
        Halaman Tidak Ditemukan
      </h2>
      <p className="text-xs text-[#71717A]">
        Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#18181B] text-white text-xs font-semibold hover:bg-[#27272A] transition-colors"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
