import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { OPPONENTS } from "../data/opponents.js";
import { SCENARIOS } from "../data/scenarios.js";
import { useProgress, getRankFromXP } from "../hooks/useProgress.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic seeded random using today's date string */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyChallenge() {
  const today = getTodayDateString();
  const seed = seededRandom(today);
  const opponent = OPPONENTS[seed % OPPONENTS.length];
  const scenario = SCENARIOS[(seed * 7) % SCENARIOS.length];
  return { opponent, scenario };
}

function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(dateStr);
  last.setHours(0, 0, 0, 0);
  return Math.floor((today - last) / (1000 * 60 * 60 * 24));
}

const DIFFICULTY_COLORS = {
  easy: "#10b981",
  medium: "#f59e0b",
  hard: "#ef4444",
};

const DEFAULT_PROFILE = {
  xp: 0,
  rank: "rookie",
  streak: 0,
  lastPlayedDate: null,
  sessionsCount: 0,
  createdAt: new Date().toISOString(),
};

// ── Sub-components ────────────────────────────────────────────────────────────

function XPBar({ xp, progress, nextRank, xpNeeded }) {
  return (
    <div style={styles.xpBarContainer}>
      <div style={styles.xpBarTrack}>
        <div style={{ ...styles.xpBarFill, width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div style={styles.xpBarLabels}>
        <span style={styles.xpText}>{xp} XP</span>
        {nextRank && (
          <span style={styles.xpNextText}>{xpNeeded} to {nextRank}</span>
        )}
      </div>
    </div>
  );
}

function RankHeroCard({ rankEmoji, rankLabel, xp, progress, nextRank, xpNeeded, sessionsCount }) {
  return (
    <div style={styles.rankCard}>
      <div style={styles.rankCardLeft}>
        <div style={styles.rankEmoji}>{rankEmoji}</div>
        <div>
          <div style={styles.rankName}>{rankLabel}</div>
          <div style={styles.sessionsText}>{sessionsCount} session{sessionsCount !== 1 ? "s" : ""} completed</div>
        </div>
      </div>
      <div style={styles.rankCardRight}>
        <div style={styles.rankXP}>{xp} XP</div>
        <div style={styles.rankProgressTrack}>
          <div style={{ ...styles.rankProgressFill, width: `${Math.round(progress * 100)}%` }} />
        </div>
        {nextRank && (
          <div style={styles.rankNextLabel}>{xpNeeded} XP to {nextRank}</div>
        )}
      </div>
    </div>
  );
}

function DecayWarningBanner({ daysSince, penalty }) {
  const critical = daysSince >= 2;
  return (
    <div style={{
      ...styles.decayBanner,
      borderColor: critical ? "#ef4444" : "#f59e0b",
      backgroundColor: critical ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
    }}>
      <span style={{ fontSize: 18 }}>{critical ? "⚠️" : "🕐"}</span>
      <div style={styles.decayBannerText}>
        <div style={styles.decayBannerTitle}>
          {critical ? "XP Decay Active!" : "Play today to keep your streak"}
        </div>
        <div style={styles.decayBannerSub}>
          {critical
            ? `You haven't played in ${daysSince} days. −${penalty} XP decay applied.`
            : `Last played ${daysSince} day${daysSince !== 1 ? "s" : ""} ago. Don't lose your progress.`}
        </div>
      </div>
    </div>
  );
}

function DailyChallengeDoneCard({ onRematch }) {
  return (
    <div style={styles.doneChallengeCard}>
      <div style={styles.doneChallengeIcon}>✅</div>
      <div style={styles.doneChallengeTitle}>Daily Challenge Complete!</div>
      <div style={styles.doneChallengeText}>Great work today. Come back tomorrow for a new challenge.</div>
      <button onClick={onRematch} style={styles.rematchBtn}>Practice Again</button>
    </div>
  );
}

function DailyChallengeCard({ opponent, scenario, onEnterArena }) {
  const diffColor = DIFFICULTY_COLORS[scenario.difficulty] || "#6b7280";
  const xpRange = scenario.difficulty === "easy"
    ? "15–25 XP"
    : scenario.difficulty === "medium"
      ? "25–40 XP"
      : "35–50 XP";

  return (
    <div style={styles.challengeCard}>
      <div style={styles.challengeHeader}>
        <div style={styles.challengeLabel}>Today's Challenge</div>
        <div style={{ ...styles.difficultyBadge, backgroundColor: `${diffColor}22`, color: diffColor }}>
          {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
        </div>
      </div>

      <div style={styles.opponentRow}>
        <div style={styles.opponentAvatar}>{opponent.avatar}</div>
        <div>
          <div style={styles.opponentName}>{opponent.name}</div>
          <div style={styles.opponentRole}>{opponent.role}</div>
        </div>
        <div style={{ ...styles.aggressionBadge, color: opponent.aggression === "high" ? "#ef4444" : opponent.aggression === "medium" ? "#f59e0b" : "#10b981" }}>
          {opponent.aggression === "high" ? "🔥 High" : opponent.aggression === "medium" ? "⚡ Medium" : "💬 Low"}
        </div>
      </div>

      <div style={styles.scenarioBox}>
        <p style={styles.scenarioText}>"{scenario.text}"</p>
      </div>

      <div style={styles.challengeFooter}>
        <span style={styles.xpRange}>⚡ {xpRange}</span>
        <button onClick={onEnterArena} style={styles.enterArenaBtn}>
          Enter Arena →
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomeScreen({ user, setCurrentScreen, setPreBattleData }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [todayDone, setTodayDone] = useState(false);

  const { opponent: dailyOpponent, scenario: dailyScenario } = getDailyChallenge();
  const today = getTodayDateString();

  // Load profile from Firestore
  useEffect(() => {
    async function loadProfile() {
      try {
        const ref = doc(db, "users", user.uid, "profile", "main");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          // Check if today's session is already done
          if (data.lastPlayedDate === today) {
            setTodayDone(true);
          }
        } else {
          // Create default profile
          await setDoc(ref, DEFAULT_PROFILE);
          setProfile(DEFAULT_PROFILE);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setProfile(DEFAULT_PROFILE);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [user.uid, today]);

  const progress = useProgress(profile || DEFAULT_PROFILE);

  function handleEnterArena() {
    setPreBattleData({ opponent: dailyOpponent, scenario: dailyScenario });
    setCurrentScreen("preBattle");
  }

  function handleLightningRound() {
    setCurrentScreen("lightning");
  }

  // Decay check
  const daysSince = getDaysSince(profile?.lastPlayedDate);
  const showDecay =
    profile &&
    profile.rank !== "rookie" &&
    daysSince !== null &&
    daysSince >= 1;

  if (loadingProfile) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading your profile...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* XP Bar */}
      <XPBar
        xp={progress.xp}
        progress={progress.nextRankInfo.progress}
        nextRank={progress.nextRankInfo.nextRank}
        xpNeeded={progress.nextRankInfo.xpNeeded}
      />

      {/* Header row: streak */}
      <div style={styles.headerRow}>
        <div style={styles.streakBadge}>
          🔥 {progress.streak} day streak
        </div>
        <div style={styles.rankBadgePill}>
          {progress.rankEmoji} {progress.rankLabel}
        </div>
      </div>

      {/* Rank Hero Card */}
      <RankHeroCard
        rankEmoji={progress.rankEmoji}
        rankLabel={progress.rankLabel}
        xp={progress.xp}
        progress={progress.nextRankInfo.progress}
        nextRank={progress.nextRankInfo.nextRank}
        xpNeeded={progress.nextRankInfo.xpNeeded}
        sessionsCount={progress.sessionsCount}
      />

      {/* Decay Warning */}
      {showDecay && (
        <DecayWarningBanner
          daysSince={daysSince}
          penalty={progress.rankDef.decayPenalty}
        />
      )}

      {/* Daily Challenge */}
      {todayDone ? (
        <DailyChallengeDoneCard onRematch={handleEnterArena} />
      ) : (
        <DailyChallengeCard
          opponent={dailyOpponent}
          scenario={dailyScenario}
          onEnterArena={handleEnterArena}
        />
      )}

      {/* Lightning Round */}
      <button onClick={handleLightningRound} style={styles.lightningBtn}>
        ⚡ Lightning Round
        <span style={styles.lightningSubtxt}>Quick 60-second drill</span>
      </button>

      <div style={styles.bottomSpacer} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: "16px 16px 0",
    minHeight: "100%",
  },
  loadingText: {
    textAlign: "center",
    color: "#6b7280",
    paddingTop: 80,
    fontSize: 15,
  },
  // XP bar
  xpBarContainer: {
    marginBottom: 12,
  },
  xpBarTrack: {
    height: 4,
    backgroundColor: "#2a2a2a",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 2,
    transition: "width 0.4s ease",
  },
  xpBarLabels: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpText: {
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: 600,
  },
  xpNextText: {
    fontSize: 11,
    color: "#6b7280",
  },
  // Header row
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  streakBadge: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: 600,
  },
  rankBadgePill: {
    fontSize: 12,
    color: "#7c3aed",
    backgroundColor: "rgba(124,58,237,0.12)",
    padding: "4px 10px",
    borderRadius: 20,
    fontWeight: 600,
  },
  // Rank hero card
  rankCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rankCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  rankEmoji: {
    fontSize: 36,
  },
  rankName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 2,
  },
  sessionsText: {
    fontSize: 12,
    color: "#6b7280",
  },
  rankCardRight: {
    textAlign: "right",
  },
  rankXP: {
    fontSize: 20,
    fontWeight: 800,
    color: "#7c3aed",
    marginBottom: 6,
  },
  rankProgressTrack: {
    width: 80,
    height: 4,
    backgroundColor: "#2a2a2a",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
    marginLeft: "auto",
  },
  rankProgressFill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 2,
  },
  rankNextLabel: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
  },
  // Decay banner
  decayBanner: {
    border: "1px solid",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  decayBannerText: {
    flex: 1,
  },
  decayBannerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 2,
  },
  decayBannerSub: {
    fontSize: 12,
    color: "#9ca3af",
  },
  // Daily challenge card
  challengeCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  challengeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  challengeLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  difficultyBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  opponentRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  opponentAvatar: {
    fontSize: 32,
    lineHeight: 1,
  },
  opponentName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 2,
  },
  opponentRole: {
    fontSize: 12,
    color: "#9ca3af",
  },
  aggressionBadge: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 600,
  },
  scenarioBox: {
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 16,
  },
  scenarioText: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 1.6,
    margin: 0,
    fontStyle: "italic",
  },
  challengeFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpRange: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: 600,
  },
  enterArenaBtn: {
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Done card
  doneChallengeCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: 24,
    textAlign: "center",
    marginBottom: 16,
  },
  doneChallengeIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  doneChallengeTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#10b981",
    marginBottom: 8,
  },
  doneChallengeText: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
  },
  rematchBtn: {
    backgroundColor: "#1f2937",
    color: "#ffffff",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  // Lightning button
  lightningBtn: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: "16px 20px",
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  lightningSubtxt: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 400,
  },
  bottomSpacer: {
    height: 24,
  },
};
