"use client";

interface ToastProps {
  message: string | null;
  tone?: "info" | "error";
}

export default function Toast({ message, tone = "info" }: ToastProps) {
  if (!message) return null;

  const styles =
    tone === "error"
      ? "border-[#881111] bg-[rgba(35,0,0,0.96)] text-[#ff3333]"
      : "border-[#005f52] bg-[rgba(0,15,12,0.96)] text-[#00e5cc]";

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-50 max-w-sm">
      <div className={`border px-4 py-3 text-[10px] uppercase tracking-[0.16em] shadow-[0_0_24px_rgba(0,0,0,0.35)] ${styles}`}>
        {message}
      </div>
    </div>
  );
}
