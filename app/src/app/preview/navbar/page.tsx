"use client";

import { useState } from "react";
import Link from "next/link";

/* ─── Shared pieces (mock wallet + audio badge) ─── */

function MockWallet() {
  return (
    <div className="inline-flex items-center gap-2 border border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.04)] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#00ff41]">
      <span className="h-2 w-2 rounded-full bg-[#00ff41]" />
      CE0T..AWFQ
    </div>
  );
}

function AudioBadge({ label, compact }: { label?: string; compact?: boolean }) {
  return (
    <button className={`inline-flex items-center gap-2 border border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.04)] ${compact ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[9px]"} uppercase tracking-[0.22em] text-[#00ff41]`}>
      <span className={`${compact ? "h-1 w-1" : "h-1.5 w-1.5"} animate-pulse rounded-full bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.7)]`} />
      {label ?? "Audio On"}
    </button>
  );
}

function DevnetBadge({ compact }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 border border-[rgba(255,176,0,0.28)] bg-[rgba(255,176,0,0.04)] ${compact ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[9px]"} uppercase tracking-[0.22em] text-[#ffb000]`}>
      <span className={`${compact ? "h-1 w-1" : "h-1.5 w-1.5"} animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]`} />
      {compact ? "Devnet" : "Solana Devnet"}
    </span>
  );
}

function MpcBadge({ compact }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 border border-[rgba(0,229,204,0.3)] bg-[rgba(0,229,204,0.04)] ${compact ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[9px]"} uppercase tracking-[0.22em] text-[#00e5cc]`}>
      <span className={`${compact ? "h-1 w-1" : "h-1.5 w-1.5"} animate-pulse rounded-full bg-[#00e5cc] shadow-[0_0_8px_rgba(0,229,204,0.8)]`} />
      {compact ? "MPC" : "Arcium MPC"}
    </span>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[rgba(255,176,0,0.2)] px-2 py-0.5 text-[8px] uppercase tracking-[0.18em] text-[#ffb000]">
      LIVE
    </span>
  );
}

function Logo({ size, center }: { size?: "sm" | "md"; center?: boolean }) {
  const textClass = size === "sm"
    ? "text-xl tracking-[0.28em]"
    : "text-2xl tracking-[0.28em] sm:text-3xl";
  return (
    <div className={`flex flex-col leading-none ${center ? "items-center" : ""}`}>
      <Link href="/" className={`font-[family-name:var(--font-vt323)] ${textClass} text-[#00ff41] drop-shadow-[0_0_10px_rgba(0,255,65,0.28)]`}>
        FOG OF WAR
      </Link>
      <span className="mt-0.5 text-[8px] uppercase tracking-[0.38em] text-[#0c6d1f] sm:mt-1 sm:text-[9px]">
        Galactic Conquest
      </span>
    </div>
  );
}

function ScannerBar() {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-[-40%] w-1/3 animate-[scanner_6s_linear_infinite] bg-linear-to-r from-transparent via-[rgba(0,255,65,0.05)] to-transparent" />
  );
}

function SectionLabel({ n, title, desc, recommended }: { n: number; title: string; desc: string; recommended?: boolean }) {
  return (
    <div className="mb-3 border-b border-[#0e2a0e] pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-[family-name:var(--font-vt323)] text-3xl text-[#ffb000]">{n}</span>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00ff41]">{title}</h2>
            {recommended && (
              <span className="border border-[#996800] bg-[rgba(255,176,0,0.06)] px-2 py-0.5 text-[8px] uppercase tracking-[0.22em] text-[#ffb000]">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#0c6d1f]">{desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Variant 1: Single-Row Flat ─── */
function Variant1() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      <div className="relative hidden items-center justify-between lg:flex">
        <Logo />
        <div className="flex items-center gap-2">
          <DevnetBadge />
          <MpcBadge />
          <AudioBadge />
          <MockWallet />
        </div>
      </div>
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <MockWallet />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DevnetBadge compact />
          <MpcBadge compact />
          <AudioBadge label="SFX" compact />
          <LiveBadge />
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 2: Two-Tier Command Strip ─── */
function Variant2() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03]">
      <ScannerBar />
      <div className="relative flex items-center justify-between border-b border-[#0e2a0e] px-3 py-2 sm:px-4 sm:py-3">
        <Logo />
        <div className="flex items-center gap-2">
          <AudioBadge label="SFX" compact />
          <MockWallet />
        </div>
      </div>
      <div className="relative flex items-center justify-center gap-3 px-3 py-1.5 sm:gap-4 sm:px-4 sm:py-2">
        <DevnetBadge compact />
        <MpcBadge compact />
        <span className="hidden items-center gap-2 text-[8px] uppercase tracking-[0.24em] text-[#ffb000] sm:inline-flex">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[#ffb000]" />
          Tactical Uplink Live
        </span>
        <LiveBadge />
      </div>
    </nav>
  );
}

/* ─── Variant 3: Centered Logo with Wings ─── */
function Variant3() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      <div className="relative hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        <div className="flex items-center gap-2">
          <DevnetBadge />
          <MpcBadge />
        </div>
        <Logo center />
        <div className="flex items-center justify-end gap-2">
          <AudioBadge />
          <MockWallet />
        </div>
      </div>
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <AudioBadge label="SFX" compact />
            <MockWallet />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <DevnetBadge compact />
          <MpcBadge compact />
          <LiveBadge />
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 4: Compact Grid with Inline Uplink ─── */
function Variant4() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      <div className="relative hidden lg:grid lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-3">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="flex items-center gap-2 border border-[#0e2a0e] bg-[#021202] px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]" />
            <span className="font-[family-name:var(--font-vt323)] text-lg tracking-[0.16em] text-[#ffb000]">LIVE</span>
            <span className="ml-1 text-[8px] uppercase tracking-[0.18em] text-[#0c6d1f]">Uplink</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <DevnetBadge />
          <MpcBadge />
        </div>
        <div className="flex flex-col gap-1">
          <MockWallet />
          <AudioBadge />
        </div>
      </div>
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <MockWallet />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <DevnetBadge compact />
            <MpcBadge compact />
            <LiveBadge />
          </div>
          <AudioBadge label="SFX" compact />
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 5: Minimal Toolbar + Expandable ─── */
function Variant5() {
  const [expanded, setExpanded] = useState(false);
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03]">
      <ScannerBar />
      <div className="relative flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <Logo />
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <DevnetBadge />
            <MpcBadge />
            <AudioBadge />
          </div>
          <MockWallet />
          <button
            onClick={() => setExpanded(!expanded)}
            className="border border-[#0e2a0e] bg-[#021202] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#0c6d1f] hover:border-[#0c6d1f] hover:text-[#00aa2a] lg:hidden"
          >
            {expanded ? "Close" : "Status"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="relative flex flex-wrap items-center gap-2 border-t border-[#0e2a0e] px-3 py-2 sm:px-4 lg:hidden">
          <DevnetBadge compact />
          <MpcBadge compact />
          <AudioBadge label="SFX" compact />
          <LiveBadge />
        </div>
      )}
    </nav>
  );
}

/* ─── Variant 6: HUD Dashboard Strip ─── */
function Variant6() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03]">
      <ScannerBar />
      <div className="relative flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <Logo />
        <MockWallet />
      </div>
      {/* HUD strip */}
      <div className="relative grid grid-cols-2 gap-px border-t border-[#0e2a0e] bg-[#0e2a0e] sm:grid-cols-4">
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#ffb000] sm:text-[9px]">Solana Devnet</span>
        </div>
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5cc]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#00e5cc] sm:text-[9px]">Arcium MPC</span>
        </div>
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#ffb000] sm:text-[9px]">Uplink Live</span>
        </div>
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#00ff41] sm:text-[9px]">Audio On</span>
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 7: Framed Logo + Side Rack ─── */
function Variant7() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      {/* Desktop */}
      <div className="relative hidden lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
        {/* Framed logo */}
        <div className="border border-[#0e2a0e] bg-[#021202] px-4 py-2">
          <Logo />
        </div>
        {/* Center: horizontal badge rail */}
        <div className="flex items-center gap-2">
          <DevnetBadge />
          <MpcBadge />
          <div className="mx-2 h-4 w-px bg-[#0e2a0e]" />
          <span className="font-[family-name:var(--font-vt323)] text-lg tracking-[0.16em] text-[#ffb000]">LIVE</span>
          <div className="mx-2 h-4 w-px bg-[#0e2a0e]" />
          <AudioBadge />
        </div>
        <MockWallet />
      </div>
      {/* Mobile */}
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <AudioBadge label="SFX" compact />
            <MockWallet />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DevnetBadge compact />
          <MpcBadge compact />
          <LiveBadge />
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 8: Pill Badges Row ─── */
function Variant8() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      {/* Desktop */}
      <div className="relative hidden lg:flex lg:items-center lg:justify-between">
        <Logo />
        {/* Pill group */}
        <div className="flex items-center rounded-sm border border-[#0e2a0e] bg-[#021202]">
          <span className="flex items-center gap-1.5 border-r border-[#0e2a0e] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#ffb000]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000]" />
            Devnet
          </span>
          <span className="flex items-center gap-1.5 border-r border-[#0e2a0e] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#00e5cc]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5cc]" />
            MPC
          </span>
          <span className="flex items-center gap-1.5 border-r border-[#0e2a0e] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#ffb000]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000]" />
            Live
          </span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#00ff41]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
            Audio
          </button>
        </div>
        <MockWallet />
      </div>
      {/* Mobile */}
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <MockWallet />
        </div>
        <div className="flex items-center rounded-sm border border-[#0e2a0e] bg-[#021202]">
          <span className="flex items-center gap-1 border-r border-[#0e2a0e] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#ffb000]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#ffb000]" />
            Devnet
          </span>
          <span className="flex items-center gap-1 border-r border-[#0e2a0e] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#00e5cc]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#00e5cc]" />
            MPC
          </span>
          <span className="flex items-center gap-1 border-r border-[#0e2a0e] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#ffb000]">
            Live
          </span>
          <button className="flex items-center gap-1 px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#00ff41]">
            SFX
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 9: Vertical Side Panel (Wide Screens) ─── */
function Variant9() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      {/* Desktop */}
      <div className="relative hidden lg:grid lg:grid-cols-[1fr_auto] lg:items-stretch lg:gap-3">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="flex items-center gap-2">
            <DevnetBadge />
            <MpcBadge />
            <AudioBadge />
          </div>
        </div>
        {/* Right panel */}
        <div className="flex items-center gap-3 border-l border-[#0e2a0e] pl-3">
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.24em] text-[#0c6d1f]">Tactical Uplink</div>
            <div className="font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#ffb000]">LIVE</div>
          </div>
          <MockWallet />
        </div>
      </div>
      {/* Mobile */}
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <MockWallet />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DevnetBadge compact />
          <MpcBadge compact />
          <AudioBadge label="SFX" compact />
          <LiveBadge />
        </div>
      </div>
    </nav>
  );
}

/* ─── Variant 10: Split Columns with Uplink Center ─── */
function Variant10() {
  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <ScannerBar />
      {/* Desktop */}
      <div className="relative hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-3">
        {/* Left: logo + badges */}
        <div className="flex items-center gap-3">
          <Logo />
          <div className="flex flex-col gap-1">
            <DevnetBadge />
            <MpcBadge />
          </div>
        </div>
        {/* Center: uplink panel */}
        <div className="border border-[#0e2a0e] bg-[#021202] px-5 py-2 text-center shadow-[0_0_18px_rgba(0,255,65,0.05)]">
          <div className="border border-[rgba(12,109,31,0.22)] px-4 py-1.5">
            <span className="block text-[8px] uppercase tracking-[0.34em] text-[#0c6d1f]">
              Tactical Uplink
            </span>
            <span className="mt-0.5 block font-[family-name:var(--font-vt323)] text-2xl tracking-[0.16em] text-[#ffb000]">
              LIVE
            </span>
          </div>
        </div>
        {/* Right: audio + wallet */}
        <div className="flex items-center justify-end gap-2">
          <AudioBadge />
          <MockWallet />
        </div>
      </div>
      {/* Mobile */}
      <div className="relative flex flex-col gap-2 lg:hidden">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <AudioBadge label="SFX" compact />
            <MockWallet />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <DevnetBadge compact />
          <MpcBadge compact />
          <LiveBadge />
        </div>
      </div>
    </nav>
  );
}

/* ─── Preview Page ─── */
export default function NavBarPreview() {
  return (
    <div className="min-h-screen bg-[#010801] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="border-b border-[#0e2a0e] pb-4">
          <h1 className="font-[family-name:var(--font-vt323)] text-4xl tracking-[0.14em] text-[#00ff41]">
            NAVBAR LAYOUT PREVIEW
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#0c6d1f]">
            10 layout options — resize your browser to see mobile vs desktop. Pick your favorite.
          </p>
        </div>

        <div className="space-y-10">
          <div>
            <SectionLabel n={1} title="SINGLE-ROW FLAT" desc="Everything on one line. Badges flow inline with wallet. Cleanest horizontal look." />
            <Variant1 />
          </div>

          <div>
            <SectionLabel n={2} title="TWO-TIER COMMAND STRIP" desc="Logo + wallet top. Thin centered status strip below with network badges." recommended />
            <Variant2 />
          </div>

          <div>
            <SectionLabel n={3} title="CENTERED LOGO WITH WINGS" desc="Logo centered. Badges fan left, wallet fans right. Symmetric military feel." />
            <Variant3 />
          </div>

          <div>
            <SectionLabel n={4} title="COMPACT GRID + INLINE UPLINK" desc="Logo with LIVE indicator inline left. Badges and wallet stacked in columns right." />
            <Variant4 />
          </div>

          <div>
            <SectionLabel n={5} title="MINIMAL + EXPANDABLE" desc="Just logo + wallet visible. Mobile badges collapse into toggleable Status panel." />
            <Variant5 />
          </div>

          <div>
            <SectionLabel n={6} title="HUD DASHBOARD STRIP" desc="Logo bar on top. Full-width 4-cell grid strip below like a systems monitor." recommended />
            <Variant6 />
          </div>

          <div>
            <SectionLabel n={7} title="FRAMED LOGO + BADGE RAIL" desc="Logo in a bordered frame. Badges, separators, and LIVE flow in a horizontal rail." />
            <Variant7 />
          </div>

          <div>
            <SectionLabel n={8} title="PILL BADGES ROW" desc="All status indicators joined into a single segmented pill. Compact and unified." />
            <Variant8 />
          </div>

          <div>
            <SectionLabel n={9} title="BADGES LEFT + UPLINK PANEL RIGHT" desc="Badges inline with logo. Uplink status and wallet separated in a right panel." />
            <Variant9 />
          </div>

          <div>
            <SectionLabel n={10} title="SPLIT COLUMNS + UPLINK CENTER" desc="Logo+badges left, uplink panel center, wallet right. Classic 3-column command layout." />
            <Variant10 />
          </div>
        </div>

        <div className="border-t border-[#0e2a0e] pt-4 text-center">
          <Link href="/" className="text-[10px] uppercase tracking-[0.22em] text-[#0c6d1f] hover:text-[#00ff41]">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
