import assert from "node:assert/strict";
import test from "node:test";

import { bonusPointsForPlace, rankLeaderboard } from "../../app/lib/case-lab-3/live/leaderboard";

test("uses the fixed speaker award points", () => {
  assert.equal(bonusPointsForPlace(1), 50);
  assert.equal(bonusPointsForPlace(2), 35);
  assert.equal(bonusPointsForPlace(3), 25);
  assert.throws(() => bonusPointsForPlace(4 as 1), /place/i);
});

test("ranks by points, first places, and podiums", () => {
  const ranked = rankLeaderboard([
    { participantId: "c", displayName: "Вера К.", points: 60, firstPlaces: 0, podiums: 2 },
    { participantId: "a", displayName: "Аян К.", points: 60, firstPlaces: 1, podiums: 1 },
    { participantId: "b", displayName: "Борис С.", points: 45, firstPlaces: 0, podiums: 1 },
  ]);

  assert.deepEqual(ranked.map(({ participantId, rank }) => ({ participantId, rank })), [
    { participantId: "a", rank: 1 },
    { participantId: "c", rank: 2 },
    { participantId: "b", rank: 3 },
  ]);
});

test("does not use response speed or display name to break score ties", () => {
  const ranked = rankLeaderboard([
    { participantId: "a", displayName: "Яна К.", points: 60, firstPlaces: 1, podiums: 1 },
    { participantId: "b", displayName: "Алия Н.", points: 60, firstPlaces: 1, podiums: 1 },
  ]);

  assert.deepEqual(ranked.map((entry) => entry.rank), [1, 1]);
});
