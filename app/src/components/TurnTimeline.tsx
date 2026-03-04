"use client";

type TurnSnapshot = {
  turn: number;
  dominant: "friendly" | "enemy" | "contested";
  controlled: number;
  contested: number;
};

interface TurnTimelineProps {
  snapshots: TurnSnapshot[];
  currentTurn: number;
}

const DOMINANT_STYLES: Record<TurnSnapshot["dominant"], string> = {
  friendly: "border-[#0c6d1f] text-[#00ff41]",
  enemy: "border-[#996800] text-[#ffb000]",
  contested: "border-[#005f52] text-[#00e5cc]",
};

export default function TurnTimeline({
  snapshots,
  currentTurn,
}: TurnTimelineProps) {
  if (snapshots.length === 0) return null;

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[8px] uppercase tracking-[0.3em] text-[#0c6d1f] sm:text-[9px]">
            Campaign Replay
          </div>
          <div className="mt-1 font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00e5cc] sm:text-3xl">
            TURN TIMELINE
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#0c6d1f]">
          Session only
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {snapshots.map((snapshot) => (
          <div
            key={snapshot.turn}
            className={`min-w-[116px] border bg-[#021202] px-3 py-2 ${DOMINANT_STYLES[snapshot.dominant]}`}
          >
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em]">
              <span>Turn {snapshot.turn}</span>
              {snapshot.turn === currentTurn && (
                <span className="text-[#b8ffc8]">Now</span>
              )}
            </div>
            <div className="mt-2 text-[9px] uppercase tracking-[0.14em] text-[#0c6d1f]">
              Controlled {snapshot.controlled}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#0c6d1f]">
              Contested {snapshot.contested}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
