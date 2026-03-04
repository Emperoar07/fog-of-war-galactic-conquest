import test from "node:test";
import assert from "node:assert/strict";
import { MatchStatus, NO_WINNER, OrderAction } from "@sdk";
import {
  advanceDemoTurn,
  createDemoMatch,
  markDemoOpponentSubmitted,
  markDemoOrdersSubmitted,
} from "./demo";
import { areOrdersReady, buildWinnerOverlayKey } from "./match-state";

test("queue order marks only the player as submitted first", () => {
  const match = createDemoMatch();
  const updated = markDemoOrdersSubmitted(match, {
    targetX: 2,
    targetY: 3,
    action: OrderAction.Attack,
  });

  assert.deepEqual(updated.submittedOrders.slice(0, 2), [1, 0]);
});

test("delayed enemy lock marks both active players as submitted", () => {
  const match = markDemoOrdersSubmitted(createDemoMatch());
  const updated = markDemoOpponentSubmitted(match);

  assert.deepEqual(updated.submittedOrders.slice(0, 2), [1, 1]);
  assert.equal(areOrdersReady(updated.submittedOrders, updated.playerCount), true);
});

test("queued demo orders can be replaced before resolve", () => {
  const match = createDemoMatch();
  const first = markDemoOrdersSubmitted(match, {
    targetX: 1,
    targetY: 1,
    action: OrderAction.Move,
  });
  const second = markDemoOrdersSubmitted(first, {
    targetX: 4,
    targetY: 4,
    action: OrderAction.Attack,
  });

  assert.deepEqual(second.submittedOrders.slice(0, 2), [1, 0]);
  assert.notDeepEqual(second.revealedSectorOwner, first.revealedSectorOwner);
});

test("winner overlay key is emitted only once the match completes", () => {
  let match = createDemoMatch();
  for (let i = 0; i < 7; i++) {
    match = advanceDemoTurn(match);
  }

  assert.equal(match.status, MatchStatus.Completed);
  assert.notEqual(match.battleSummary[0], NO_WINNER);
  assert.equal(
    buildWinnerOverlayKey(BigInt("900000001"), match.battleSummary[0], match.turn, match.status),
    `900000001-${match.battleSummary[0]}-${match.turn}`,
  );
});
