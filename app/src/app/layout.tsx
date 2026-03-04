import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fog of War: Galactic Conquest",
  description: "Encrypted on-chain strategy game powered by Solana and Arcium",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased bg-black text-white min-h-screen`}>
        <WalletProvider>
          <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
              Fog of War: Galactic Conquest
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">devnet</span>
              <WalletButton />
            </div>
          </nav>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}

function WalletButton() {
  // This is a server component wrapper — the actual wallet button is client-side
  // We need to use dynamic import for the wallet button
  return <ClientWalletButton />;
}

import dynamic from "next/dynamic";

const ClientWalletButton = dynamic(
  () => import("@/components/WalletButtonClient"),
  { ssr: false },
);
