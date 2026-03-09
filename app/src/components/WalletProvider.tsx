"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { RPC_URL } from "@/lib/config";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function WalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    // Note: Phantom is automatically registered via Standard Wallet protocol
    // Remove PhantomWalletAdapter to avoid double-registration
    () => [new SolflareWalletAdapter()],
    [],
  );

  const connectionConfig = useMemo(
    () => ({
      commitment: "processed" as const,
      wsEndpoint: RPC_URL.replace("https://", "wss://").replace("http://", "ws://"),
      confirmTransactionInitialTimeout: 30_000,
    }),
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_URL} config={connectionConfig}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
