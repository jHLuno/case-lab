import type { LeaderboardScore, PublicLeaderboardEntry } from "./contracts";

export type AwardPlace = 1 | 2 | 3;

const AWARD_POINTS: Readonly<Record<AwardPlace, number>> = {
  1: 50,
  2: 35,
  3: 25,
};

export function bonusPointsForPlace(place: AwardPlace): number {
  const points = AWARD_POINTS[place];
  if (points === undefined) {
    throw new RangeError("Award place must be 1, 2, or 3");
  }
  return points;
}

function compareScores(left: LeaderboardScore, right: LeaderboardScore): number {
  return right.points - left.points
    || right.firstPlaces - left.firstPlaces
    || right.podiums - left.podiums;
}

export function rankLeaderboard(scores: readonly LeaderboardScore[]): PublicLeaderboardEntry[] {
  const ordered = scores
    .map((score, sourceIndex) => ({ score, sourceIndex }))
    .sort((left, right) => compareScores(left.score, right.score) || left.sourceIndex - right.sourceIndex);

  let rank = 0;
  let previous: LeaderboardScore | null = null;
  return ordered.map(({ score }) => {
    if (previous === null || compareScores(previous, score) !== 0) {
      rank += 1;
    }
    previous = score;
    return { ...score, rank };
  });
}
