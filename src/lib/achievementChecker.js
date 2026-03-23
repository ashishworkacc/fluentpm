/**
 * FluentPM Achievement / Badge System
 * Inspired by Duolingo's badge mechanics
 */

export const BADGES = [
  // First steps
  { id: "first_battle",    icon: "⚔️",  name: "First Blood",     desc: "Complete your first Battle"           },
  { id: "first_interview", icon: "🎓",  name: "In the Hot Seat", desc: "Complete your first Interview"        },
  { id: "first_lightning", icon: "⚡",  name: "Sparked",         desc: "Complete first Lightning Round"       },
  // Streak
  { id: "streak_3",   icon: "🔥",  name: "On Fire",      desc: "3-day streak"                          },
  { id: "streak_7",   icon: "🔥",  name: "Unstoppable",  desc: "7-day streak"                          },
  { id: "streak_30",  icon: "🌟",  name: "Iron Will",    desc: "30-day streak"                         },
  // Sessions
  { id: "sessions_10", icon: "💪", name: "Grinder",      desc: "10 sessions completed"                 },
  { id: "sessions_50", icon: "🏆", name: "Veteran PM",   desc: "50 sessions completed"                 },
  // Score
  { id: "score_8",    icon: "💎",  name: "Diamond",      desc: "Score 8+ in a session"                 },
  { id: "score_9",    icon: "👑",  name: "Royal",        desc: "Score 9+ in a session"                 },
  // Expressions
  { id: "lexicon_10", icon: "📚",  name: "Word Hoarder", desc: "Save 10 expressions"                   },
  { id: "mastered_1", icon: "🎯",  name: "First Master", desc: "Master your first expression"          },
  { id: "mastered_5", icon: "🧠",  name: "Fluency Core", desc: "Master 5 expressions"                  },
  // XP
  { id: "xp_500",    icon: "⚡",   name: "Charged",      desc: "Earn 500 total XP"                     },
  { id: "xp_1000",   icon: "🚀",   name: "Launch",       desc: "Earn 1,000 total XP"                   },
];

/**
 * Check which new badges the user has earned.
 * @param {object} stats - { sessionsCount, interviewsCount, lightningCount, streak, bestScore, lexiconCount, masteredCount, totalXP }
 * @param {string[]} existingIds - badge IDs already earned
 * @returns {Array} - newly earned badge objects
 */
export function checkNewBadges(stats, existingIds = []) {
  const checks = {
    first_battle:    s => s.sessionsCount >= 1,
    first_interview: s => s.interviewsCount >= 1,
    first_lightning: s => s.lightningCount >= 1,
    streak_3:        s => s.streak >= 3,
    streak_7:        s => s.streak >= 7,
    streak_30:       s => s.streak >= 30,
    sessions_10:     s => s.sessionsCount >= 10,
    sessions_50:     s => s.sessionsCount >= 50,
    score_8:         s => s.bestScore >= 8,
    score_9:         s => s.bestScore >= 9,
    lexicon_10:      s => s.lexiconCount >= 10,
    mastered_1:      s => s.masteredCount >= 1,
    mastered_5:      s => s.masteredCount >= 5,
    xp_500:          s => s.totalXP >= 500,
    xp_1000:         s => s.totalXP >= 1000,
  };
  return BADGES.filter(b => !existingIds.includes(b.id) && checks[b.id]?.(stats));
}
