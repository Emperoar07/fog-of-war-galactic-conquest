import test from "node:test";
import assert from "node:assert/strict";
import { MatchStatus, OrderAction } from "@sdk";
import { createDemoMatch } from "./demo";
import { buildCompanionSuggestion } from "./companion";

test("companion stays silent when disabled", () => {
  const suggestion = buildCompanionSuggestion({
    enabled: false,
    match: createDemoMatch(),
    playerSlot: 0,
    selectedCell: null,
    visibilityReport: null,
    history: [],
  });

  assert.equal(suggestion, null);
});

test("companion prefers a fighter attack on visible hostile contact", () => {
  const match = createDemoMatch();
  const suggestion = buildCompanionSuggestion({
    enabled: true,
    match: {
      ...match,
      status: MatchStatus.Active,
    },
    playerSlot: 0,
    selectedCell: null,
    visibilityReport: {
      visibleSlots: [4],
      units: [{ slot: 4, x: 5, y: 5 }],
    },
    history: [],
  });

  assert.ok(suggestion);
  assert.equal(suggestion.order.action, OrderAction.Attack);
  assert.equal(suggestion.order.unitSlot, 2);
  assert.match(suggestion.title, /Use Fighter Wing 1: Attack/);
});
