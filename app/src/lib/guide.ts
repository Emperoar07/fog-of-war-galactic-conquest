export type GuideCard = {
  eyebrow: string;
  title: string;
  tone: "amber" | "cyan" | "green";
  items: string[];
};

export type GuideList = {
  title: string;
  tone: "amber" | "green";
  items: string[];
};

export const GUIDE_CARDS: GuideCard[] = [
  {
    eyebrow: "What This Game Is",
    title: "A private-information strategy prototype.",
    tone: "amber",
    items: [
      "Pick a unit, choose a target, queue a turn, then read the result.",
      "Orders and visibility are designed to stay hidden until the rules allow a reveal.",
      "If you are new, start in demo mode first. It teaches the full loop without needing a wallet.",
    ],
  },
  {
    eyebrow: "Demo Mode Walkthrough",
    title: "The fastest way to learn the loop.",
    tone: "cyan",
    items: [
      "Click Launch Demo. The match opens instantly with no wallet required.",
      "Select a board sector, then use Fire Control to queue an order.",
      "Turn Companion Mode on if you want a suggested move before you commit.",
      "The demo AI locks in shortly after you queue. You can still replace your queued order before resolve.",
      "Resolve the turn after both orders lock, then request a visibility report when you want a scout update.",
      "Watch the board, battle logic, and activity log update in place.",
    ],
  },
  {
    eyebrow: "Live Devnet Walkthrough",
    title: "The real network flow.",
    tone: "green",
    items: [
      "Connect a Solana wallet, then create or join a match.",
      "When the match is active, select a sector and use Fire Control to choose an action.",
      "Submit one encrypted order for the turn, then wait for the other player.",
      "Resolve the turn after both players are ready.",
      "Request visibility from Fire Control when you need a scouting update.",
      "Companion Mode stays local and advisory only. Audio is optional and can be toggled any time.",
    ],
  },
];

export const GUIDE_DETAILS: GuideList[] = [
  {
    title: "What To Watch While Playing",
    tone: "amber",
    items: [
      "The board shows known, contested, and updated sectors.",
      "The status rail tells you if you are in demo, live devnet, or waiting.",
      "The activity log records submissions, visibility updates, and turn resolution.",
      "Companion Mode only suggests. You still choose whether to apply and submit.",
      "Battle Logic gives the fastest snapshot of who is ahead.",
      "Keyboard hint: use arrow keys to move the board selection and Enter to confirm the current cell.",
    ],
  },
  {
    title: "Color Guide",
    tone: "green",
    items: [
      "Green: your controlled sectors and friendly presence.",
      "Amber: enemy controlled sectors or enemy pressure.",
      "Cyan: contested sectors, visibility intel, and shared tactical updates.",
      "Red: danger, damage, failed actions, or destroyed battle zones.",
      "Dim green: idle, waiting, hidden, or inactive interface states.",
    ],
  },
  {
    title: "Unit And Action Guide",
    tone: "amber",
    items: [
      "Command Fleet: your anchor unit. Use it to hold safe sectors, stabilize your line, and only move it when your side is under pressure or the center is already secure.",
      "Scout Wing: your vision unit. Use it when you need information, when the center is contested, or when you are unsure whether an attack lane is safe.",
      "Fighter Wings: your pressure units. Use them to attack confirmed threats, push into neutral ground, and cover lanes after your scout reveals a target.",
      "Move: reposition into safer or more useful sectors. Best when you need spacing, board control, or command safety.",
      "Scout: spend the turn gathering information. Best when enemy positions are unclear or the center is contested.",
      "Attack: commit force to a hostile sector. Best when visibility already shows a target or enemy pressure is building.",
      "Switch units when the board changes: scout first when information is weak, shift to fighters when a target is confirmed, and fall back to the command fleet only when your side needs to stabilize.",
    ],
  },
];

export const GUIDE_NOTE = [
  "Demo mode is the easiest place to learn because it is fully simulated and always available.",
  "Live devnet mode uses the real program. Encrypted actions still depend on Arcium MXE readiness.",
];
