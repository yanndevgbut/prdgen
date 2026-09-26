import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] py-8 px-4 md:px-8 text-xs text-dim bg-[#090a0f]">
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div>&copy; {new Date().getFullYear()} PRDGen.ai. Semua hak cipta dilindungi.</div>
        <ul className="flex items-center gap-5 list-none text-muted">
          <li>
            <Link href="/" className="hover:text-white transition-colors">
              Beranda
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Paket
            </Link>
          </li>
          <li>
            <Link href="/app" className="hover:text-white transition-colors">
              Workspace
            </Link>
          </li>
          <li>
            <Link href="/admin" className="hover:text-white transition-colors">
              Admin
            </Link>
          </li>
          <li>
            <Link href="/login" className="hover:text-white transition-colors">
              Masuk
            </Link>
          </li>
          <li>
            <Link href="/register" className="hover:text-white transition-colors">
              Daftar
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
