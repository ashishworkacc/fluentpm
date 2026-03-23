import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { OPPONENTS } from "../data/opponents.js";
import { SCENARIOS } from "../data/scenarios.js";
import { useProgress, getRankFromXP, checkDecay } from "../hooks/useProgress.js";
import { getCoachingProfile } from "../lib/coachingProfile.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyChallenge(uid) {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `fluentpm_daily_${uid}_${today}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && cached.opponent && cached.scenario) return cached;
  } catch {}

  // Get recent history
  const recentScenarios = JSON.parse(localStorage.getItem(`fluentpm_recent_scenarios_${uid}`) || "[]");
  const recentOpponents = JSON.parse(localStorage.getItem(`fluentpm_recent_opponents_${uid}`) || "[]");

  // Filter out recently seen scenarios
  const freshScenarios = SCENARIOS.filter(s => !recentScenarios.includes(s.id));
  const pool = freshScenarios.length >= 5 ? freshScenarios : SCENARIOS;

  // Pick random scenario
  const scenario = pool[Math.floor(Math.random() * pool.length)];

  // Pick opponent not seen recently
  const freshOpponents = OPPONENTS.filter(o => !recentOpponents.includes(o.id));
  const opponentPool = freshOpponents.length >= 2 ? freshOpponents : OPPONENTS;
  const opponent = opponentPool[Math.floor(Math.random() * opponentPool.length)];

  // Save to history (keep last 15 scenarios, last 2 opponents)
  const newScenarios = [scenario.id, ...recentScenarios].slice(0, 15);
  const newOpponents = [opponent.id, ...recentOpponents].slice(0, 2);
  try {
    localStorage.setItem(`fluentpm_recent_scenarios_${uid}`, JSON.stringify(newScenarios));
    localStorage.setItem(`fluentpm_recent_opponents_${uid}`, JSON.stringify(newOpponents));
  } catch {}

  // Save to stable daily cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ opponent, scenario }));
  } catch {}

  return { opponent, scenario };
}

// Shuffle: bust today's cache then pick a fresh challenge
function shuffleDailyChallenge(uid) {
  const today = new Date().toISOString().slice(0, 10);
  try { localStorage.removeItem(`fluentpm_daily_${uid}_${today}`); } catch {}
  return getDailyChallenge(uid);
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

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_KEY = (uid) => `fluentpm_profile_${uid}`;

function readCache(uid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(uid, data) {
  try { localStorage.setItem(CACHE_KEY(uid), JSON.stringify(data)); } catch {}
}

// ── Glass card shared style ────────────────────────────────────────────────
// backdrop-filter removed — GPU-heavy and causes jank on most devices

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GoalRing({ todayXP, goalXP }) {
  const pct = Math.min(todayXP / (goalXP || 25), 1);
  const r = 46, cx = 54, cy = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const done = pct >= 1;

  return (
    <div style={{ position: "relative", width: 108, height: 108, flexShrink: 0 }}>
      <svg width={108} height={108} viewBox="0 0 108 108">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={done ? "#10b981" : "#6366f1"}
          strokeWidth={9} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
        {done ? (
          <div style={{ fontSize: 28 }}>🔥</div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>{todayXP}</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>/ {goalXP} XP</div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfettiBurst({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: 10 + (i / 36) * 80,
    delay: (i % 8) * 0.08,
    size: 7 + (i % 4) * 2,
  }));

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {pieces.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.id % 3 === 0 ? "50%" : 2,
            animation: `confettiFall 2.4s ${p.delay}s ease-in forwards`,
          }} />
        ))}
      </div>
    </>
  );
}

function StakeholderTrust({ uid }) {
  const [trustData, setTrustData] = useState([]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(`fluentpm_trust_${uid}`) || "{}");
      if (Object.keys(cached).length > 0) {
        const entries = Object.entries(cached).map(([opId, scores]) => ({
          id: opId,
          avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
          count: scores.length,
        })).sort((a, b) => b.count - a.count).slice(0, 3);
        setTrustData(entries);
      }
    } catch {}
  }, [uid]);

  if (trustData.length === 0) return null;

  const OPPONENT_MAP = Object.fromEntries(OPPONENTS.map(o => [o.id, o]));

  return (
    <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
        Stakeholder Trust
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {trustData.map(({ id, avg, count }) => {
          const opp = OPPONENT_MAP[id];
          if (!opp) return null;
          const pct = Math.min(((avg - 4) / 6) * 100, 100);
          const color = avg >= 7 ? "#10b981" : avg >= 5.5 ? "#f59e0b" : "#f43f5e";
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{opp.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{opp.name}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 700 }}>{avg}/10</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{count}×</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function DailyChallengeCard({ opponent, scenario, onEnterArena, onShuffle, todayDone }) {
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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {todayDone && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
              ✓ Done today
            </span>
          )}
          <span style={{ ...styles.diffBadge, background: `${diffColor}22`, color: diffColor }}>
            {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
          </span>
        </div>
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
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEnterArena} style={{ ...styles.enterArenaBtn, flex: 3 }}>
          Enter Arena →
        </button>
        {onShuffle && (
          <button onClick={onShuffle} style={{
            flex: 1, height: 52, background: "rgba(255,255,255,0.06)", color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, fontSize: 18,
            fontWeight: 700, cursor: "pointer",
          }} title="Shuffle challenge">
            🔀
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quick-access feature cards ────────────────────────────────────────────────

const QUICK_FEATURES = [
  { id: "lightning",       icon: "⚡", label: "Lightning Round", desc: "Practice saved expressions" },
  { id: "quickDrill",      icon: "🎯", label: "Quick Drill",     desc: "30-sec answer challenges"  },
  { id: "pushbackDrill",   icon: "💪", label: "Pushback Drill",  desc: "Handle tough objections"   },
  { id: "storyBank",       icon: "📖", label: "Story Bank",      desc: "Manage your STAR stories"  },
  { id: "league",          icon: "🏆", label: "League",          desc: "Your weekly ranking"       },
  { id: "customQuestions", icon: "📝", label: "My Questions",    desc: "Your question bank"        },
  { id: "podcast",         icon: "🎙", label: "Podcast Sim",     desc: "Roleplay a real transcript" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomeScreen({ user, setCurrentScreen, setPreBattleData, setCoachingProfile }) {
  const today = getTodayDateString();

  // ── Step 1: load from localStorage instantly (sync, zero wait) ────────────
  const cached = readCache(user.uid);
  const [profile, setProfile] = useState(cached || DEFAULT_PROFILE);
  const [todayDone, setTodayDone] = useState(cached?.lastPlayedDate === today);
  const [expressionsDueCount, setExpressionsDueCount] = useState(0);
  const [decayApplied, setDecayApplied] = useState(false);

  const [dailyChallenge, setDailyChallenge] = useState(() => getDailyChallenge(user.uid));
  const { opponent: dailyOpponent, scenario: dailyScenario } = dailyChallenge;

  const [todayXP, setTodayXP] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(25);
  const [showConfetti, setShowConfetti] = useState(false);
  const [leagueData, setLeagueData] = useState({ league: "bronze", weeklyXP: 0 });
  const [streakFreezeActive, setStreakFreezeActive] = useState(false);

  // ── Step 2: fetch Firestore silently in the background ────────────────────
  useEffect(() => {
    async function syncFromFirestore() {
      try {
        const ref = doc(db, "users", user.uid, "profile", "main");
        const snap = await getDoc(ref);
        let profileData;

        if (snap.exists()) {
          profileData = snap.data();
          setProfile(profileData);
          setTodayDone(profileData.lastPlayedDate === today);
          writeCache(user.uid, profileData);        // keep cache fresh
        } else {
          await setDoc(ref, DEFAULT_PROFILE);
          writeCache(user.uid, DEFAULT_PROFILE);
          profileData = DEFAULT_PROFILE;
        }

        // Today's XP for goal ring
        const todayDateStr = today;
        const todayXPKey = `fluentpm_today_xp_${user.uid}_${todayDateStr}`;
        const storedTodayXP = parseInt(localStorage.getItem(todayXPKey) || "0");
        setTodayXP(storedTodayXP);
        setDailyGoal(profileData.dailyGoalXP || 25);
        setLeagueData({ league: profileData.league || "bronze", weeklyXP: profileData.weeklyXP || 0 });
        setStreakFreezeActive(profileData.streakFreeze || false);

        // Confetti if goal was just hit (fire confetti on next HomeScreen visit)
        const hitKey = `fluentpm_goal_hit_${user.uid}_${todayDateStr}`;
        if (localStorage.getItem(hitKey) === "1") {
          setShowConfetti(true);
          localStorage.removeItem(hitKey);
        }

        // Decay check — run after profile loads
        if (profileData) {
          const decayResult = checkDecay(profileData.lastPlayedDate, profileData.rank || "rookie", profileData.xp || 0);
          if (decayResult.shouldDecay && !decayApplied) {
            // Check streak freeze — consume it instead of applying decay
            if (profileData.streakFreeze) {
              await updateDoc(ref, { streakFreeze: false });
              console.log("Streak freeze consumed — streak preserved.");
            } else {
              setDecayApplied(true);
              const updatedProfile = {
                ...profileData,
                xp: decayResult.newXP,
                rank: decayResult.newRank,
              };
              await updateDoc(ref, { xp: decayResult.newXP, rank: decayResult.newRank });
              setProfile(updatedProfile);
              writeCache(user.uid, updatedProfile);
            }
          }
        }

        // Fetch coaching profile in background
        getCoachingProfile(user.uid).then(cp => {
          if (cp && setCoachingProfile) setCoachingProfile(cp);
        }).catch(() => {});

        // Count due expressions (status != mastered and lastUsedDate null or >3d)
        try {
          const lexRef = collection(db, "users", user.uid, "lexicon");
          const lexSnap = await getDocs(lexRef);
          let dueCount = 0;
          lexSnap.docs.forEach(d => {
            const data = d.data();
            if (data.status === "mastered") return;
            const today = new Date().toISOString().slice(0, 10);
            if (!data.nextReviewDate) { dueCount++; return; }
            if (data.nextReviewDate <= today) dueCount++;
          });
          setExpressionsDueCount(dueCount);
        } catch {}

      } catch (err) {
        // Network issue — cached data already shown, silently ignore
        console.warn("Firestore sync failed, using cached profile:", err.message);
      }
    }
    syncFromFirestore();
  }, [user.uid, today]);

  const progress = useProgress(profile || DEFAULT_PROFILE);

  function handleEnterArena() {
    setPreBattleData({ opponent: dailyOpponent, scenario: dailyScenario });
    setCurrentScreen("preBattle");
  }

  function handleLightningRound() {
    setCurrentScreen("lightning");
  }

  async function updateDailyGoal(xp) {
    setDailyGoal(xp);
    try {
      await updateDoc(doc(db, "users", user.uid, "profile", "main"), { dailyGoalXP: xp });
    } catch {}
  }

  async function buyStreakFreeze() {
    if (streakFreezeActive) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid, "profile", "main"));
      const currentXP = snap.data()?.xp || 0;
      if (currentXP < 10) return;
      await updateDoc(doc(db, "users", user.uid, "profile", "main"), {
        streakFreeze: true,
        xp: currentXP - 10,
      });
      setStreakFreezeActive(true);
    } catch {}
  }

  // Decay check
  const daysSince = getDaysSince(profile?.lastPlayedDate);
  const showDecay =
    profile &&
    profile.rank !== "rookie" &&
    daysSince !== null &&
    daysSince >= 1;

  const firstName = user.displayName ? user.displayName.split(" ")[0] : "";
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

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
        <XPBar
          xp={progress.xp}
          progress={progress.nextRankInfo.progress}
          nextRank={progress.nextRankInfo.nextRank}
          xpNeeded={progress.nextRankInfo.xpNeeded}
        />
      </div>

      {/* Stakeholder Trust */}
      <StakeholderTrust uid={user.uid} />

      {/* Desktop 2-col layout: left = rank + decay + expressions, right = interview + lightning */}
      {isDesktop ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RankHeroCard
              rankEmoji={progress.rankEmoji}
              rankLabel={progress.rankLabel}
              xp={progress.xp}
              progress={progress.nextRankInfo.progress}
              nextRank={progress.nextRankInfo.nextRank}
              xpNeeded={progress.nextRankInfo.xpNeeded}
              sessionsCount={progress.sessionsCount}
            />
            {showDecay && (
              <DecayWarningBanner
                daysSince={daysSince}
                penalty={progress.rankDef.decayPenalty}
              />
            )}
            {expressionsDueCount > 0 && (
              <div style={{
                ...glassCard, padding: "16px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📚</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                      {expressionsDueCount} expression{expressionsDueCount !== 1 ? "s" : ""} due
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Keep vocabulary sharp</div>
                  </div>
                </div>
                <button onClick={() => setCurrentScreen("lightning")} style={{
                  padding: "8px 14px", background: "rgba(6,182,212,0.12)",
                  border: "1px solid rgba(6,182,212,0.25)", borderRadius: 20,
                  color: "#06b6d4", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}>Practice →</button>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{ ...glassCard, padding: "20px", cursor: "pointer", borderColor: "rgba(6,182,212,0.3)", flex: 1 }}
              onClick={() => setCurrentScreen("interviewHome")}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>PM Interview Prep</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>
                Practice with real interviewers. Get a hire / no-hire verdict.
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4" }}>Start Interview →</div>
            </div>
            <button onClick={handleLightningRound} style={{ ...styles.lightningCard, margin: 0 }}>
              <div style={styles.lightningLeft}>
                <span style={styles.lightningBolt}>⚡</span>
                <div>
                  <div style={styles.lightningTitle}>Lightning Round</div>
                  <div style={styles.lightningSubtxt}>Quick 90-second drill</div>
                </div>
              </div>
              <span style={styles.lightningChevron}>›</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mobile single-column layout */
        <>
          <RankHeroCard
            rankEmoji={progress.rankEmoji}
            rankLabel={progress.rankLabel}
            xp={progress.xp}
            progress={progress.nextRankInfo.progress}
            nextRank={progress.nextRankInfo.nextRank}
            xpNeeded={progress.nextRankInfo.xpNeeded}
            sessionsCount={progress.sessionsCount}
          />
          {showDecay && (
            <DecayWarningBanner
              daysSince={daysSince}
              penalty={progress.rankDef.decayPenalty}
            />
          )}
          {expressionsDueCount > 0 && (
            <div style={{
              ...glassCard, padding: "16px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16, border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>📚</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                    {expressionsDueCount} expression{expressionsDueCount !== 1 ? "s" : ""} due for practice
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Keep your vocabulary sharp</div>
                </div>
              </div>
              <button onClick={() => setCurrentScreen("lightning")} style={{
                padding: "8px 14px", background: "rgba(6,182,212,0.12)",
                border: "1px solid rgba(6,182,212,0.25)", borderRadius: 20,
                color: "#06b6d4", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}>Practice Now →</button>
            </div>
          )}
          <div
            style={{ ...glassCard, padding: "16px 20px", cursor: "pointer", borderColor: "rgba(6,182,212,0.3)", marginBottom: 16 }}
            onClick={() => setCurrentScreen("interviewHome")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>🎯</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>PM Interview Prep</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Get a hire / no-hire verdict from real interviewers</div>
              </div>
              <span style={{ marginLeft: "auto", color: "#06b6d4", fontSize: 18 }}>→</span>
            </div>
          </div>
        </>
      )}

      {/* Daily Goal Ring Card */}
      {(() => {
        const LEAGUES_MAP = {
          bronze:   { icon: "🥉", name: "Bronze",   color: "#cd7f32" },
          silver:   { icon: "🥈", name: "Silver",   color: "#94a3b8" },
          gold:     { icon: "🥇", name: "Gold",     color: "#f59e0b" },
          sapphire: { icon: "💎", name: "Sapphire", color: "#3b82f6" },
          diamond:  { icon: "💠", name: "Diamond",  color: "#a855f7" },
        };
        const lc = LEAGUES_MAP[leagueData.league] || LEAGUES_MAP.bronze;
        return (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <GoalRing todayXP={todayXP} goalXP={dailyGoal} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
                  {todayXP >= dailyGoal ? "Goal smashed! 🎉" : "Today's Goal"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                  {todayXP >= dailyGoal
                    ? "You hit your target. Keep the streak alive."
                    : `${Math.max(0, dailyGoal - todayXP)} XP to go`}
                </div>
                {/* Goal picker */}
                <div style={{ display: "flex", gap: 5 }}>
                  {[{ v: 15, l: "Casual" }, { v: 25, l: "Regular" }, { v: 50, l: "Serious" }].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => updateDailyGoal(v)}
                      style={{
                        padding: "3px 10px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: dailyGoal === v ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                        color: dailyGoal === v ? "#818cf8" : "#64748b",
                        transition: "all 0.15s",
                      }}
                    >{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* League chip + streak freeze row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => setCurrentScreen("league")}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
              >
                <span style={{ fontSize: 14 }}>{lc.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: lc.color }}>{lc.name} League</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>· {leagueData.weeklyXP} XP this week →</span>
              </button>

              {/* Streak Freeze */}
              {streakFreezeActive ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#10b981", fontWeight: 700 }}>
                  <span>🛡️</span><span>Protected</span>
                </div>
              ) : (
                <button
                  onClick={buyStreakFreeze}
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#f59e0b", cursor: "pointer" }}
                >
                  🛡️ Freeze −10 XP
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Practice Modes — quick access row */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Practice Modes
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {QUICK_FEATURES.map(f => (
            <button key={f.id} onClick={() => setCurrentScreen(f.id)} style={{
              flexShrink: 0, minWidth: 120, padding: "14px 14px",
              background: "rgba(15,16,40,0.82)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Challenge — full width on both layouts (no daily cap — unlimited practice) */}
      <DailyChallengeCard
        opponent={dailyOpponent}
        scenario={dailyScenario}
        onEnterArena={handleEnterArena}
        onShuffle={() => setDailyChallenge(shuffleDailyChallenge(user.uid))}
        todayDone={todayDone}
      />

      {/* Lightning Round — mobile only (desktop shows in right col above) */}
      {!isDesktop && (
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
      )}

      <div style={styles.bottomSpacer} />
      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 900,
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
