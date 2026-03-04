"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletButtonClient() {
  return (
    <div className="wallet-console-shell relative z-50">
      <WalletMultiButton />
    </div>
  );
}
