"use client";

import { useCallback, useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  advanceDemoTurn,
  getAiProfile,
  markDemoOpponentSubmitted,
  markDemoOrdersSubmitted,
  type AiDifficulty,
} from "@/lib/demo";
import type { GalaxyMatch, OrderParams } from "@sdk";

export function useDemoTurnFlow(args: {
  enabled: boolean;
  aiDifficulty?: AiDifficulty | null;
  updateMatch: (updater: (current: GalaxyMatch) => GalaxyMatch) => void;
  appendActivity: (message: string, tone?: "info" | "success" | "error") => void;
  showStatus: (
    message: string,
    tone?: "info" | "success" | "error",
    log?: boolean,
  ) => void;
  playSound: (
    tone:
      | "uiTap"
      | "uplink"
      | "success"
      | "error"
      | "resolve"
      | "reveal"
      | "victory",
  ) => void;
}) {
  const {
    enabled,
    aiDifficulty = null,
    updateMatch,
    appendActivity,
    showStatus,
    playSound,
  } = args;
  const demoOpponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingLock = useCallback(() => {
    if (demoOpponentTimeoutRef.current) {
      clearTimeout(demoOpponentTimeoutRef.current);
      demoOpponentTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPendingLock, [clearPendingLock]);

  const submitDemoOrder = useCallback(
    (order: OrderParams, onQueued?: () => void) => {
      if (!enabled) return;

      clearPendingLock();
      playSound("uplink");
      showStatus(
        `Simulating ${order.action === 2 ? "attack" : "maneuver"} from unit ${order.unitSlot + 1}...`,
        "info",
        true,
      );
      updateMatch((current) =>
        markDemoOrdersSubmitted(current, {
          targetX: order.targetX,
          targetY: order.targetY,
          action: order.action,
        }, aiDifficulty),
      );
      onQueued?.();
      appendActivity(
        `Your order is staged for sector (${order.targetX}, ${order.targetY}).`,
        "info",
      );
      trackEvent("ordersSubmitted");
      playSound("success");
      showStatus(
        "Order queued. Demo AI is locking in. You can still replace this order before resolve.",
        "success",
      );

      const lockDelay = aiDifficulty ? getAiProfile(aiDifficulty).lockDelayMs : 900;
      const difficultyLabel = aiDifficulty
        ? getAiProfile(aiDifficulty).label
        : "Demo";

      demoOpponentTimeoutRef.current = setTimeout(() => {
        updateMatch((current) => markDemoOpponentSubmitted(current));
        appendActivity(
          `${difficultyLabel} enemy commander has locked in a response.`,
          "success",
        );
        playSound("success");
        showStatus("Both orders are locked. Resolve the turn when ready.", "success");
        demoOpponentTimeoutRef.current = null;
      }, lockDelay);
    },
    [aiDifficulty, appendActivity, clearPendingLock, enabled, playSound, showStatus, updateMatch],
  );

  const resolveDemoTurn = useCallback(() => {
    if (!enabled) return;

    clearPendingLock();
    playSound("resolve");
    showStatus("Resolving simulated turn...", "info", true);
    updateMatch((current) => advanceDemoTurn(current, aiDifficulty));
    trackEvent("turnsPlayed");
    appendActivity("Recon updates and battle results refreshed locally.", "success");
    showStatus("Demo turn resolved.", "success");
  }, [aiDifficulty, appendActivity, clearPendingLock, enabled, playSound, showStatus, updateMatch]);

  return {
    clearPendingLock,
    submitDemoOrder,
    resolveDemoTurn,
  };
}
