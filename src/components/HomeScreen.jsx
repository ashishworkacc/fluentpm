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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const DIFFICULTY_COLORS = {
  easy: "#10b981",
  medium: "#f59e0b",
  hard: "#f43f5e",
};

const DEFAULT_PROFILE = {
  xp: 0,
  rank: "rookie",
  streak: 0,
  lastPlayedDate: null,
  sessionsCount: 0,
  createdAt: new Date().toISOString(),
};

// ── Glass card shared style ──────────────────────────────────────────────────

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 20,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function XPBar({ xp, progress, nextRank, xpNeeded }) {
  return (
    <div style={styles.xpBarContainer}>
      <div style={styles.xpBarTrack}>
        <div style={{
          ...styles.xpBarFill,
          width: `${Math.round(progress * 100)}%`,
        }} />
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
        <div style={styles.rankXP}>{xp} <span style={styles.rankXPLabel}>XP</span></div>
        <div style={styles.rankProgressTrack}>
          <div style={{ ...styles.rankProgressFill, width: `${Math.round(progress * 100)}%` }} />
        </div>
        {nextRank && (
          <div style={styles.rankNextLabel}>{xpNeeded} to {nextRank}</div>
        )}
      </div>
    </div>
  );
}

function DecayWarningBanner({ daysSince, penalty }) {
  const critical = daysSince >= 2;
  return (
    <div style={{
      ...glassCard,
      borderColor: critical ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.4)",
      background: critical ? "rgba(244,63,94,0.08)" : "rgba(245,158,11,0.08)",
      padding: "14px 18px",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 18 }}>{critical ? "⚠️" : "🕐"}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>
          {critical ? "XP Decay Active!" : "Play today to keep your streak"}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
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
    <div style={{
      ...glassCard,
      padding: 28,
      textAlign: "center",
      marginBottom: 16,
      boxShadow: "0 0 0 1px rgba(16,185,129,0.3), 0 20px 60px rgba(16,185,129,0.08)",
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
        Daily Challenge Complete!
      </div>
      <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, lineHeight: 1.5 }}>
        Great work today. Come back tomorrow for a new challenge.
      </div>
      <button onClick={onRematch} style={styles.rematchBtn}>Practice Again</button>
    </div>
  );
}

function DailyChallengeCard({ opponent, scenario, onEnterArena }) {
  const diffColor = DIFFICULTY_COLORS[scenario.difficulty] || "#94a3b8";
  const xpRange = scenario.difficulty === "easy"
    ? "15–25 XP"
    : scenario.difficulty === "medium"
      ? "25–40 XP"
      : "35–50 XP";

  const aggrColor = opponent.aggression === "high"
    ? "#f43f5e"
    : opponent.aggression === "medium"
      ? "#f59e0b"
      : "#10b981";

  return (
    <div style={styles.challengeCard}>
      {/* Label row */}
      <div style={styles.challengeHeader}>
        <span style={styles.challengeLabel}>TODAY'S CHALLENGE</span>
        <span style={{ ...styles.diffBadge, background: `${diffColor}22`, color: diffColor }}>
          {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
        </span>
      </div>

      {/* Opponent */}
      <div style={styles.opponentBlock}>
        <div style={styles.opponentAvatarLarge}>{opponent.avatar}</div>
        <div style={styles.opponentName}>{opponent.name}</div>
        <div style={styles.opponentRoleRow}>
          <span style={styles.opponentRole}>{opponent.role}</span>
          <span style={{ ...styles.aggrBadge, background: `${aggrColor}22`, color: aggrColor }}>
            {opponent.aggression === "high" ? "High pressure" : opponent.aggression === "medium" ? "Med pressure" : "Low pressure"}
          </span>
        </div>
      </div>

      {/* Scenario */}
      <div style={styles.scenarioBox}>
        <p style={styles.scenarioText}>"{scenario.text}"</p>
      </div>

      {/* Footer */}
      <div style={styles.challengeFooter}>
        <span style={styles.xpRange}>⚡ {xpRange}</span>
      </div>
      <button onClick={onEnterArena} style={styles.enterArenaBtn}>
        Enter Arena →
      </button>
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
          if (data.lastPlayedDate === today) {
            setTodayDone(true);
          }
        } else {
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

  const firstName = user.displayName ? user.displayName.split(" ")[0] : "";

  if (loadingProfile) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading your profile...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Hero greeting section */}
      <div style={styles.heroSection}>
        <div style={styles.greetingLine}>
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </div>
        <div style={styles.heroRankRow}>
          <span style={styles.heroRankName}>{progress.rankEmoji} {progress.rankLabel}</span>
          {progress.streak > 0 && (
            <span style={styles.streakPill}>🔥 {progress.streak} day streak</span>
          )}
        </div>

        {/* XP Bar */}
        <XPBar
          xp={progress.xp}
          progress={progress.nextRankInfo.progress}
          nextRank={progress.nextRankInfo.nextRank}
          xpNeeded={progress.nextRankInfo.xpNeeded}
        />
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
      <button onClick={handleLightningRound} style={styles.lightningCard}>
        <div style={styles.lightningLeft}>
          <span style={styles.lightningBolt}>⚡</span>
          <div>
            <div style={styles.lightningTitle}>Lightning Round</div>
            <div style={styles.lightningSubtxt}>Quick 90-second drill</div>
          </div>
        </div>
        <span style={styles.lightningChevron}>›</span>
      </button>

      <div style={styles.bottomSpacer} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "24px 20px 24px",
    minHeight: "100%",
    animation: "slideUp 0.3s ease",
  },
  loadingText: {
    textAlign: "center",
    color: "#94a3b8",
    paddingTop: 80,
    fontSize: 15,
  },
  // Hero section
  heroSection: {
    marginBottom: 20,
  },
  greetingLine: {
    fontSize: 15,
    color: "#94a3b8",
    marginBottom: 6,
    fontWeight: 500,
  },
  heroRankRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroRankName: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
  },
  streakPill: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f59e0b",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.2)",
    padding: "5px 12px",
    borderRadius: 20,
  },
  // XP bar
  xpBarContainer: {
    marginBottom: 4,
  },
  xpBarTrack: {
    height: 6,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  xpBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2.5s linear infinite",
    borderRadius: 3,
    transition: "width 0.4s ease",
  },
  xpBarLabels: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpText: {
    fontSize: 12,
    color: "#6366f1",
    fontWeight: 700,
  },
  xpNextText: {
    fontSize: 11,
    color: "#64748b",
  },
  // Rank hero card
  rankCard: {
    ...glassCard,
    padding: "18px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rankCardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  rankEmoji: {
    fontSize: 40,
    lineHeight: 1,
  },
  rankName: {
    fontSize: 19,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 3,
  },
  sessionsText: {
    fontSize: 12,
    color: "#64748b",
  },
  rankCardRight: {
    textAlign: "right",
  },
  rankXP: {
    fontSize: 26,
    fontWeight: 800,
    color: "#6366f1",
    marginBottom: 6,
    letterSpacing: "-0.5px",
  },
  rankXPLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#8b5cf6",
  },
  rankProgressTrack: {
    width: 80,
    height: 4,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
    marginLeft: "auto",
  },
  rankProgressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
    borderRadius: 2,
  },
  rankNextLabel: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "right",
  },
  // Daily challenge card
  challengeCard: {
    ...glassCard,
    padding: 22,
    marginBottom: 16,
    boxShadow: "0 0 0 1px rgba(99,102,241,0.3), 0 20px 60px rgba(99,102,241,0.1)",
  },
  challengeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  challengeLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#06b6d4",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
  },
  diffBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  opponentBlock: {
    textAlign: "center",
    marginBottom: 18,
  },
  opponentAvatarLarge: {
    fontSize: 64,
    lineHeight: 1,
    marginBottom: 10,
  },
  opponentName: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 6,
  },
  opponentRoleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  opponentRole: {
    fontSize: 14,
    color: "#94a3b8",
  },
  aggrBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 10px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  scenarioBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 16,
  },
  scenarioText: {
    fontSize: 17,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 1.65,
    margin: 0,
    fontStyle: "italic",
  },
  challengeFooter: {
    marginBottom: 14,
  },
  xpRange: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: 700,
  },
  enterArenaBtn: {
    width: "100%",
    height: 52,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.2px",
  },
  rematchBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#f1f5f9",
    borderRadius: 12,
    padding: "11px 28px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  // Lightning card
  lightningCard: {
    width: "100%",
    ...glassCard,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9",
  },
  lightningLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  lightningBolt: {
    fontSize: 24,
    color: "#f59e0b",
  },
  lightningTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 2,
  },
  lightningSubtxt: {
    fontSize: 12,
    color: "#94a3b8",
  },
  lightningChevron: {
    fontSize: 22,
    color: "#64748b",
    fontWeight: 300,
    lineHeight: 1,
  },
  bottomSpacer: {
    height: 24,
  },
};
