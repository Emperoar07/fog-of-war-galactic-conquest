"use client";

interface ToastProps {
  message: string | null;
  tone?: "info" | "error";
}

export default function Toast({ message, tone = "info" }: ToastProps) {
  if (!message) return null;

  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white text-slate-700";

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${styles}`}>
        {message}
      </div>
    </div>
  );
}
