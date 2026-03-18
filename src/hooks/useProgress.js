import { useMemo } from "react";

// ── Rank definitions ────────────────────────────────────────────────────────

export const RANKS = {
  rookie:    { label: "Rookie",    min: 0,    max: 299,  emoji: "🌱", decayDays: null, decayPenalty: 0  },
  rising:    { label: "Rising",    min: 300,  max: 599,  emoji: "🌿", decayDays: 2,    decayPenalty: 30 },
  confident: { label: "Confident", min: 600,  max: 799,  emoji: "⭐", decayDays: 1,    decayPenalty: 50 },
  fluent:    { label: "Fluent",    min: 800,  max: 1299, emoji: "🔥", decayDays: 1,    decayPenalty: 50 },
  elite:     { label: "Elite",     min: 1300, max: Infinity, emoji: "💎", decayDays: 1, decayPenalty: 80 },
};

const RANK_ORDER = ["rookie", "rising", "confident", "fluent", "elite"];

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the rank string for a given XP value.
 */
export function getRankFromXP(xp) {
  if (xp >= 1300) return "elite";
  if (xp >= 800)  return "fluent";
  if (xp >= 600)  return "confident";
  if (xp >= 300)  return "rising";
  return "rookie";
}

/**
 * Linear XP mapping: score 4 → 15 XP, score 10 → 50 XP.
 * Scores below 4 get 0 XP. Scores above 10 are clamped to 10.
 */
export function getXPForScore(aiScore) {
  const score = Math.min(10, Math.max(0, aiScore));
  if (score < 4) return 0;
  // Linear interpolation: at 4 → 15, at 10 → 50
  return Math.round(15 + ((score - 4) / 6) * (50 - 15));
}

/**
 * Check whether XP decay should be applied.
 *
 * @param {string|null} lastPlayedDate  ISO date string "YYYY-MM-DD" or null
 * @param {string}      rank            current rank string
 * @param {number}      currentXP       current XP value
 * @returns {{ shouldDecay: boolean, penalty: number, newXP: number, newRank: string }}
 */
export function checkDecay(lastPlayedDate, rank, currentXP) {
  const rankDef = RANKS[rank];
  if (!rankDef || rankDef.decayDays === null) {
    return { shouldDecay: false, penalty: 0, newXP: currentXP, newRank: rank };
  }

  if (!lastPlayedDate) {
    return { shouldDecay: false, penalty: 0, newXP: currentXP, newRank: rank };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(lastPlayedDate);
  last.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));

  if (diffDays < rankDef.decayDays) {
    return { shouldDecay: false, penalty: 0, newXP: currentXP, newRank: rank };
  }

  const penalty = rankDef.decayPenalty;
  const newXP = Math.max(0, currentXP - penalty);
  const newRank = getRankFromXP(newXP);

  return { shouldDecay: true, penalty, newXP, newRank };
}

/**
 * Returns info about the next rank threshold.
 *
 * @param {string} rank   current rank string
 * @param {number} xp     current XP
 * @returns {{ nextRank: string|null, xpNeeded: number, progress: number }}
 */
export function getNextRankInfo(rank, xp) {
  const currentIndex = RANK_ORDER.indexOf(rank);

  if (currentIndex === -1 || currentIndex === RANK_ORDER.length - 1) {
    // Already at elite
    return { nextRank: null, xpNeeded: 0, progress: 1 };
  }

  const nextRank = RANK_ORDER[currentIndex + 1];
  const currentMin = RANKS[rank].min;
  const nextMin = RANKS[nextRank].min;

  const xpIntoCurrentRank = xp - currentMin;
  const xpNeededForNextRank = nextMin - currentMin;
  const xpNeeded = Math.max(0, nextMin - xp);
  const progress = Math.min(1, xpIntoCurrentRank / xpNeededForNextRank);

  return { nextRank, xpNeeded, progress };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useProgress(profile)
 *
 * profile shape:
 *   { xp: number, rank: string, lastPlayedDate: string|null, sessionsCount: number, streak: number }
 *
 * Returns all helpers plus computed values from the profile.
 */
export function useProgress(profile) {
  const xp = profile?.xp ?? 0;
  const rank = profile?.rank ?? getRankFromXP(xp);
  const lastPlayedDate = profile?.lastPlayedDate ?? null;
  const sessionsCount = profile?.sessionsCount ?? 0;
  const streak = profile?.streak ?? 0;

  const computed = useMemo(() => {
    const decayInfo = checkDecay(lastPlayedDate, rank, xp);
    const nextRankInfo = getNextRankInfo(rank, xp);
    const rankDef = RANKS[rank] || RANKS.rookie;

    return {
      xp,
      rank,
      rankDef,
      rankEmoji: rankDef.emoji,
      rankLabel: rankDef.label,
      sessionsCount,
      streak,
      lastPlayedDate,
      decayInfo,
      nextRankInfo,
      getRankFromXP,
      getXPForScore,
      checkDecay,
      getNextRankInfo,
    };
  }, [xp, rank, lastPlayedDate, sessionsCount, streak]);

  return computed;
}
