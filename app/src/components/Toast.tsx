"use client";

interface ToastProps {
  message: string | null;
  tone?: "info" | "error";
}

export default function Toast({ message, tone = "info" }: ToastProps) {
  if (!message) return null;

  const styles =
    tone === "error"
      ? "border-red-800 bg-red-950/95 text-red-200"
      : "border-cyan-800 bg-cyan-950/95 text-cyan-200";

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl ${styles}`}>
        {message}
      </div>
    </div>
  );
}
