"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSound } from "@/components/SoundProvider";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { DEMO_MATCH_ID } from "@/lib/demo";

const Lobby = dynamic(() => import("@/components/Lobby"), {
  loading: () => (
    <div className="border border-[#0e2a0e] bg-[#030d03] px-4 py-10 text-center text-xs uppercase tracking-[0.24em] text-[#0c6d1f]">
      Syncing lobby feed...
    </div>
  ),
});

export default function Home() {
  const { connected } = useWallet();
  const { playSound } = useSound();
  const [showGuide, setShowGuide] = useState(false);
  const closeGuideButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeGuide = useCallback(() => {
    playSound("uiTap");
    setShowGuide(false);
  }, [playSound]);

  useEffect(() => {
    if (!showGuide) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeGuideButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowGuide(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showGuide]);

  return (
    <div className="space-y-2">
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={closeGuide}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-[#0c6d1f] bg-[#030d03] p-3 shadow-[0_0_40px_rgba(0,255,65,0.08)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.34em] text-[#0c6d1f]">
                  Mission Briefing
                </div>
                <h2
                  id="how-to-play-title"
                  className="mt-1 font-[family-name:var(--font-vt323)] text-4xl tracking-[0.14em] text-[#00ff41]"
                >
                  HOW TO PLAY
                </h2>
              </div>
              <button
                ref={closeGuideButtonRef}
                data-sound-manual="true"
                onClick={closeGuide}
                className="border border-[#0e2a0e] bg-[#021202] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00aa2a] hover:border-[#0c6d1f] hover:text-[#00ff41]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#ffb000]">
                  What This Game Is
                </div>
                <div className="mt-3 space-y-3 text-xs leading-6 text-[#00cc33]">
                  <p>
                    Fog of War is a turn-based strategy game. Pick a unit, pick
                    a target, submit a turn, then read the result.
                  </p>
                  <p>
                    Some information stays hidden. Orders and visibility are
                    meant to stay private until the rules allow a reveal.
                  </p>
                  <p>
                    If you are new, start in demo mode first. It teaches the
                    full loop without needing a wallet.
                  </p>
                </div>
              </div>

              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#00e5cc]">
                  Demo Mode Walkthrough
                </div>
                <ol className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                  <li>
                    1. Click <span className="text-[#ffb000]">Launch Demo</span>.
                  </li>
                  <li>
                    2. The demo opens instantly. No wallet is required.
                  </li>
                  <li>
                    3. Click a board sector to choose your target.
                  </li>
                  <li>
                    4. Use Fire Control to queue an order, resolve the turn,
                    and request visibility from one place.
                  </li>
                  <li>
                    5. Turn <span className="text-[#00e5cc]">Companion Mode</span> on if you
                    want a suggested move before you commit.
                  </li>
                  <li>
                    6. After you queue an order, the demo AI locks in shortly
                    after. You can still replace your queued order before the
                    turn is resolved.
                  </li>
                  <li>
                    7. Click <span className="text-[#ffb000]">Resolve Turn</span> when both
                    orders are locked to advance the battle.
                  </li>
                  <li>
                    8. Click{" "}
                    <span className="text-[#00e5cc]">
                      Request Visibility Report
                    </span>{" "}
                    to simulate a scout update.
                  </li>
                  <li>
                    9. Watch the board, battle logic, and activity log to see
                    what changed.
                  </li>
                  <li>
                    10. Use the audio toggle if you want ambient sound and
                    action cues.
                  </li>
                </ol>
              </div>

              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#00ff41]">
                  Live Devnet Walkthrough
                </div>
                <ol className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                  <li>
                    1. Connect a Solana wallet.
                  </li>
                  <li>
                    2. Create a match or join an open one.
                  </li>
                  <li>
                    3. When the match is active, select a sector and use Fire
                    Control to choose an action.
                  </li>
                  <li>
                    4. Submit one encrypted order for the turn.
                  </li>
                  <li>
                    5. Wait for the other player to submit.
                  </li>
                  <li>
                    6. Resolve the turn when both sides are ready.
                  </li>
                  <li>
                    7. Request visibility from Fire Control when you need a
                    scouting update.
                  </li>
                  <li>
                    8. Turn <span className="text-[#00e5cc]">Companion Mode</span> on if you
                    want a local tactical suggestion before you commit.
                  </li>
                  <li>
                    9. Keep audio on if you want ambient sound and result cues.
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#ffb000]">
                  What To Watch While Playing
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                  <li>
                    - The board shows known, contested, and updated sectors.
                  </li>
                  <li>
                    - The status rail tells you if you are in demo, live
                    devnet, or waiting.
                  </li>
                  <li>
                    - The activity log records submissions, visibility updates,
                    and turn resolution.
                  </li>
                  <li>
                    - Companion Mode only suggests; you still choose whether to
                    apply and submit.
                  </li>
                  <li>
                    - Battle Logic gives the fastest snapshot of who is ahead.
                  </li>
                </ul>
              </div>

              <div className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] p-4 text-xs leading-6 text-[#00e5cc]">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#00e5cc]">
                  Important Note
                </div>
                <div className="mt-3 space-y-3">
                  <p>
                    Demo mode is the easiest place to learn because it is fully
                    playable right now.
                  </p>
                  <p>
                    Live devnet uses the real network flow, but encrypted
                    actions still depend on Arcium MXE readiness.
                  </p>
                  <p>
                    If you are unsure where to start, learn the loop in demo
                    mode first, then try live devnet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="border border-[#0e2a0e] bg-[#030d03] px-3 py-5 sm:px-5 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_260px] lg:items-center">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.22em] text-[#00ff41] sm:text-5xl">
                FOG OF WAR
              </p>
              <h1 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.16em] text-[#ffb000] sm:text-6xl">
                GALACTIC CONQUEST
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-[#00cc33]">
              Hidden information is what makes strategy feel real. Fog of War:
              Galactic Conquest uses Arcium-powered private computation to keep
              moves concealed, reveal only what the rules allow, and still
              settle the fight on Solana.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
                onClick={() => playSound("uplink")}
                className="inline-flex items-center justify-center border border-[#996800] bg-[rgba(255,176,0,0.05)] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.11)]"
              >
                Launch Demo
              </Link>
              <button
                data-sound-manual="true"
                onClick={() => {
                  playSound("modal");
                  setShowGuide(true);
                }}
                className="inline-flex items-center justify-center border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-5 py-3 text-[10px] uppercase tracking-[0.24em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)]"
              >
                How To Play
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            {[
              ["Commit", "Queue encrypted match setup and hidden state."],
              ["Compute", "Resolve turns with private Arcium MPC."],
              ["Reveal", "Emit only the public outcome the rules allow."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="border border-[#0e2a0e] bg-[#021202] px-4 py-3"
              >
                <div className="mt-1 font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00ff41]">
                  {title}
                </div>
                <div className="mt-1 text-xs leading-5 text-[#00aa2a]">
                  {text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {connected ? (
        <div className="space-y-2">
          <MXEStatusBanner />
          <Lobby />
        </div>
      ) : (
        <section className="border border-[#0e2a0e] bg-[#030d03] px-5 py-8 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-[#00cc33]">
            Connect a wallet for live devnet matches
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#0c6d1f]">
            Phantom, Solflare, and compatible Solana wallets supported
          </p>
        </section>
      )}
    </div>
  );
}
