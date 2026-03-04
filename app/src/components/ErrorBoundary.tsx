"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="border border-[#881111] bg-[rgba(35,0,0,0.9)] p-6 text-center">
          <div className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#ff3333]">
            SYSTEM FAULT
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#ff3333]">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 border border-[#881111] bg-[rgba(255,51,51,0.04)] px-5 py-2 text-[10px] uppercase tracking-[0.24em] text-[#ff3333] hover:bg-[rgba(255,51,51,0.08)]"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
