"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSound } from "@/components/SoundProvider";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { DEMO_MATCH_ID, QUICK_MATCH_IDS } from "@/lib/demo";
import { GUIDE_CARDS, GUIDE_DETAILS, GUIDE_NOTE } from "@/lib/guide";

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
  const [quickOpen, setQuickOpen] = useState(false);
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
    <div className="relative space-y-2 overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-[-45%] z-0 w-1/2 animate-[scanner_8s_linear_infinite] bg-linear-to-r from-transparent via-[rgba(0,255,65,0.035)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-[rgba(0,255,65,0.06)]" />
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
              {GUIDE_CARDS.map((card) => (
                <div key={card.eyebrow} className="border border-[#0e2a0e] bg-[#021202] p-4">
                  <div
                    className={`text-[9px] uppercase tracking-[0.24em] ${
                      card.tone === "amber"
                        ? "text-[#ffb000]"
                        : card.tone === "cyan"
                          ? "text-[#00e5cc]"
                          : "text-[#00ff41]"
                    }`}
                  >
                    {card.eyebrow}
                  </div>
                  <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#b8ffc8]">
                    {card.title}
                  </div>
                  <ol className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                    {card.items.map((item, index) => (
                      <li key={item}>
                        {index + 1}. {item}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {GUIDE_DETAILS.map((list) => (
                <div key={list.title} className="border border-[#0e2a0e] bg-[#021202] p-4">
                  <div
                    className={`text-[9px] uppercase tracking-[0.24em] ${
                      list.tone === "amber" ? "text-[#ffb000]" : "text-[#00ff41]"
                    }`}
                  >
                    {list.title}
                  </div>
                  <ul className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                    {list.items.map((item) => {
                      if (list.title !== "Color Guide") {
                        return <li key={item}>- {item}</li>;
                      }

                      const [label, ...rest] = item.split(":");
                      const description = rest.join(":").trim();
                      const colorClass =
                        label === "Green"
                          ? "text-[#00ff41]"
                          : label === "Amber"
                            ? "text-[#ffb000]"
                            : label === "Cyan"
                              ? "text-[#00e5cc]"
                              : label === "Red"
                                ? "text-[#ff3333]"
                                : "text-[#0c6d1f]";

                      return (
                        <li key={item}>
                          - <span className={colorClass}>{label}</span>: {description}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] p-4 text-xs leading-6 text-[#00e5cc]">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#00e5cc]">
                  Important Note
                </div>
                <div className="mt-3 space-y-3">
                  {GUIDE_NOTE.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="relative z-10 border border-[#0e2a0e] bg-[#030d03] px-3 py-5 sm:px-5 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_260px] lg:items-center">
          <div className="space-y-5">
            <h1 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.16em] text-[#ffb000] sm:text-6xl">
              GALACTIC CONQUEST
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#00cc33]">
              Hidden information is what makes strategy feel real. Fog of War:
              Galactic Conquest uses Arcium-powered private computation to keep
              moves concealed, reveal only what the rules allow, and still
              settle the fight on Solana.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Link
                href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
                onClick={() => playSound("uplink")}
                className="inline-flex items-center justify-center border border-[#996800] bg-[rgba(255,176,0,0.05)] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.11)]"
              >
                Launch Demo
              </Link>
              <div className="relative">
                <button
                  data-sound-manual="true"
                  onClick={() => {
                    playSound("uiTap");
                    setQuickOpen((o) => !o);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-5 py-3 text-[10px] uppercase tracking-[0.24em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)]"
                >
                  Quick Match vs AI
                  <span
                    className="text-[8px] transition-transform duration-200"
                    style={{ transform: quickOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    ▶
                  </span>
                </button>
                <div
                  className="mt-1 flex gap-1 overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: quickOpen ? "60px" : "0",
                    opacity: quickOpen ? 1 : 0,
                  }}
                >
                  <Link
                    href={`/match/${QUICK_MATCH_IDS.easy.toString()}?quick=easy`}
                    onClick={() => playSound("uplink")}
                    className="flex-1 border border-[#0c6d1f] bg-[rgba(0,255,65,0.05)] py-2.5 text-center font-[family-name:var(--font-vt323)] text-sm tracking-[0.14em] text-[#00ff41] transition-[background,transform] duration-150 hover:bg-[rgba(0,255,65,0.12)] hover:-translate-y-0.5"
                  >
                    EASY
                  </Link>
                  <Link
                    href={`/match/${QUICK_MATCH_IDS.medium.toString()}?quick=medium`}
                    onClick={() => playSound("uplink")}
                    className="flex-1 border border-[#996800] bg-[rgba(255,176,0,0.05)] py-2.5 text-center font-[family-name:var(--font-vt323)] text-sm tracking-[0.14em] text-[#ffb000] transition-[background,transform] duration-150 hover:bg-[rgba(255,176,0,0.12)] hover:-translate-y-0.5"
                  >
                    MEDIUM
                  </Link>
                  <Link
                    href={`/match/${QUICK_MATCH_IDS.hard.toString()}?quick=hard`}
                    onClick={() => playSound("uplink")}
                    className="flex-1 border border-[#881111] bg-[rgba(255,51,51,0.05)] py-2.5 text-center font-[family-name:var(--font-vt323)] text-sm tracking-[0.14em] text-[#ff3333] transition-[background,transform] duration-150 hover:bg-[rgba(255,51,51,0.12)] hover:-translate-y-0.5"
                  >
                    HARD
                  </Link>
                </div>
              </div>
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
        <div className="relative z-10 space-y-2">
          <MXEStatusBanner />
          <Lobby />
        </div>
      ) : (
        <section className="relative z-10 border border-[#0e2a0e] bg-[#030d03] px-5 py-8 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-[#00cc33]">
            Connect a wallet for live devnet matches
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#0c6d1f]">
            only compatible Solana wallets supported
          </p>
        </section>
      )}
    </div>
  );
}
