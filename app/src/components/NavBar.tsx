"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletButton = dynamic(
  () => import("@/components/WalletButtonClient"),
  { ssr: false },
);

export default function NavBar() {
  return (
    <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
        Fog of War: Galactic Conquest
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500">devnet</span>
        <WalletButton />
      </div>
    </nav>
  );
}
