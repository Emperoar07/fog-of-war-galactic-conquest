"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletButton = dynamic(
  () => import("@/components/WalletButtonClient"),
  { ssr: false },
);

export default function NavBar() {
  return (
    <nav className="px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-sm font-semibold text-slate-800 hover:text-slate-600 tracking-wide">
        FOG OF WAR
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 border border-slate-200 rounded-full px-2.5 py-0.5">
          devnet
        </span>
        <WalletButton />
      </div>
    </nav>
  );
}
