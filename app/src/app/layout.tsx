import type { Metadata } from "next";
import { Share_Tech_Mono, VT323 } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import NavBar from "@/components/NavBar";
import { SoundProvider } from "@/components/SoundProvider";

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
  description:
    "Turn-based encrypted strategy game on Solana. Hidden moves, private computation via Arcium MPC, and fog-of-war mechanics — all settled on-chain.",
  metadataBase: new URL("https://fog-of-war-mauve.vercel.app"),
  openGraph: {
    title: "Fog of War: Galactic Conquest",
    description:
      "Hidden information meets on-chain strategy. Command fleets, encrypt orders, and conquer the galaxy on Solana.",
    siteName: "Fog of War: Galactic Conquest",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fog of War: Galactic Conquest",
    description:
      "Hidden information meets on-chain strategy. Powered by Solana + Arcium MPC.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.svg",
  },
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
        <SoundProvider>
          <WalletProvider>
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-2 px-2 py-2 sm:px-3">
              <NavBar />
              <main className="flex-1">{children}</main>
            </div>
          </WalletProvider>
        </SoundProvider>
      </body>
    </html>
  );
}
