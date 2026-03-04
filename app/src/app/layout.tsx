import type { Metadata } from "next";
import { Share_Tech_Mono, VT323 } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import NavBar from "@/components/NavBar";

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  weight: "400",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
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
    <html lang="en">
      <body
        className={`${shareTechMono.variable} ${vt323.variable} min-h-screen antialiased`}
      >
        <WalletProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-2 px-2 py-2 sm:px-3">
            <NavBar />
            <main className="flex-1">{children}</main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
