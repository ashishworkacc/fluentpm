import { useState, useEffect } from "react";
import { collection, query, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { BADGES } from "../lib/achievementChecker.js";
// RANKS imported for future rank-display helpers if needed
// import { RANKS } from "../hooks/useProgress.js";

// ── Shared style ──────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getScoreColor(score) {
  if (!score) return "#475569";
  if (score >= 8) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#f43f5e";
}

function getDayLabel(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

const RANK_MILESTONES = [
  { key: "rookie",    emoji: "🌱", label: "Rookie",    xp: 0 },
  { key: "rising",    emoji: "🌿", label: "Rising",    xp: 300 },
  { key: "confident", emoji: "⭐", label: "Confident", xp: 600 },
  { key: "fluent",    emoji: "🔥", label: "Fluent",    xp: 800 },
  { key: "elite",     emoji: "💎", label: "Elite",     xp: 1300 },
];

// ── Sub-components (History tab) ──────────────────────────────────────────────

function SkeletonCard({ height = 80 }) {
  return (
    <div style={{ ...glassCard, height, marginBottom: 12, overflow: "hidden", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
        animation: "shimmer 1.5s linear infinite",
      }} />
    </div>
  );
}

function StatPill({ label, value, icon }) {
  return (
    <div style={{ ...glassCard, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.5px" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function ScoreChart({ sessions }) {
  const days = getLast7Days();
  const scoreByDate = {};
  sessions.forEach(s => {
    if (s.date) scoreByDate[s.date] = s.aiScore || s.score;
  });
  return (
    <div style={{ ...glassCard, padding: "18px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.8px" }}>
        7-Day Score Trend
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
        {days.map((day, i) => {
          const dateStr = day.toISOString().slice(0, 10);
          const score = scoreByDate[dateStr];
          const barH = score ? Math.round((score / 10) * 80) : 0;
          const barColor = score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : score ? "#f43f5e" : "rgba(255,255,255,0.08)";
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {score ? (
                <div style={{ fontSize: 10, color: getScoreColor(score), fontWeight: 700 }}>{score}</div>
              ) : (
                <div style={{ fontSize: 10, color: "transparent" }}>0</div>
              )}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                <div style={{ width: "100%", height: barH || 4, background: barColor, borderRadius: "4px 4px 0 0", transition: "height 0.3s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{getDayLabel(day)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const scoreColor = getScoreColor(session.aiScore || session.score);
  const score = session.aiScore || session.score;
  const tip = session.tip || session.coachTip || "";
  const truncatedTip = tip.length > 80 ? tip.slice(0, 80) + "…" : tip;
  return (
    <div style={{ ...glassCard, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{session.opponentAvatar || "🎯"}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{session.opponentName || "Opponent"}</div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize" }}>{session.situationType || "session"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {score && (
            <div style={{ fontSize: 13, fontWeight: 800, color: scoreColor, background: `${scoreColor}18`, padding: "3px 10px", borderRadius: 20 }}>
              {score}/10
            </div>
          )}
          {session.structureScore && (
            <div style={{ fontSize: 11, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>
              S:{session.structureScore}/5
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: truncatedTip ? 8 : 0 }}>
        <div style={{ fontSize: 11, color: "#475569" }}>{formatDate(session.date || session.savedAt)}</div>
        {session.xp && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>+{session.xp} XP</div>}
      </div>
      {truncatedTip && (
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic" }}>"{truncatedTip}"</div>
      )}
    </div>
  );
}

function RankRoadmap({ currentRank, currentXP }) {
  return (
    <div style={{ ...glassCard, padding: "18px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.8px" }}>
        Rank Roadmap
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {RANK_MILESTONES.map((milestone, i) => {
          const isActive = currentRank === milestone.key;
          const isPassed = currentXP >= milestone.xp;
          return (
            <div key={milestone.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {i < RANK_MILESTONES.length - 1 && (
                <div style={{
                  position: "absolute", top: 18, left: "50%", right: "-50%", height: 2,
                  background: isPassed ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)", zIndex: 0,
                }} />
              )}
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: isActive ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : isPassed ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                border: isActive ? "2px solid #6366f1" : isPassed ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                position: "relative", zIndex: 1,
                boxShadow: isActive ? "0 0 16px rgba(99,102,241,0.5)" : "none",
              }}>
                {milestone.emoji}
              </div>
              <div style={{ fontSize: 10, color: isActive ? "#6366f1" : "#475569", fontWeight: isActive ? 700 : 400, marginTop: 6, textAlign: "center" }}>
                {milestone.label}
              </div>
              <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>{milestone.xp} XP</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DebriefCard({ debrief, onView, isSelected }) {
  const isInterview = debrief._type === "interview";
  const badgeColor = isInterview ? "#8b5cf6" : "#6366f1";
  const badgeBg = isInterview ? "rgba(139,92,246,0.15)" : "rgba(99,102,241,0.15)";
  const badgeLabel = isInterview ? "Interview" : "Arena";
  const scoreDisplay = isInterview
    ? (debrief.verdict || "—")
    : (debrief.aiScore != null ? `${debrief.aiScore}/10` : "—");
  const tip = debrief.verdictReason || debrief.strongestMoment || debrief.coachTip || debrief.tip || "";
  const truncatedTip = tip.length > 80 ? tip.slice(0, 80) + "…" : tip;
  const dateStr = debrief.date || (debrief.savedAt ? new Date(debrief.savedAt).toISOString().slice(0, 10) : "");
  const displayDate = dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <div style={{
      background: "rgba(15,16,40,0.82)",
      border: isSelected ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: badgeBg, color: badgeColor }}>
            {badgeLabel}
          </span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{displayDate}</span>
          {(debrief.opponentName || debrief.interviewerName) && (
            <span style={{ fontSize: 12, color: "#64748b" }}>· {debrief.opponentName || debrief.interviewerName}</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: badgeColor }}>{scoreDisplay}</div>
      </div>
      {truncatedTip && (
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic", marginBottom: 8 }}>
          "{truncatedTip}"
        </div>
      )}
      <button
        onClick={() => onView(debrief)}
        style={{
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#a5b4fc",
          cursor: "pointer", fontWeight: 600,
        }}
      >
        {isSelected ? "Close" : "View Full Debrief →"}
      </button>

      {isSelected && (
        <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
          {isInterview ? (
            <>
              {debrief.verdictReason && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Verdict Reason</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{debrief.verdictReason}</div>
                </div>
              )}
              {debrief.strongestMoment && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Strongest Moment</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{debrief.strongestMoment}</div>
                </div>
              )}
              {debrief.rootCause && debrief.rootCause !== "none" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Root Cause</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{debrief.rootCauseExplanation || debrief.rootCause}</div>
                </div>
              )}
              {debrief.sampleStrongAnswer && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Sample Strong Answer</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>"{debrief.sampleStrongAnswer}"</div>
                </div>
              )}
              {debrief.innerMonologue && debrief.innerMonologue.some(Boolean) && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Inner Monologue</div>
                  {debrief.innerMonologue.filter(Boolean).slice(0, 2).map((t, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 4, fontStyle: "italic" }}>T{i + 1}: "{t}"</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {debrief.tip && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Coach's Call</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{debrief.tip || debrief.coachTip}</div>
                </div>
              )}
              {debrief.weakPhrases && debrief.weakPhrases.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Phrases to Retire</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {debrief.weakPhrases.map((p, i) => (
                      <span key={i} style={{ fontSize: 12, color: "#f43f5e", textDecoration: "line-through", background: "rgba(244,63,94,0.06)", padding: "2px 8px", borderRadius: 6 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {debrief.powerPhrases && debrief.powerPhrases.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Power Phrases</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {debrief.powerPhrases.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#a5f3fc", fontStyle: "italic" }}>"{p}"</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StatsScreen({ user, setCurrentScreen }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Data
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [lexStats, setLexStats] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [savedDebriefs, setSavedDebriefs] = useState([]);
  const [selectedDebrief, setSelectedDebrief] = useState(null);

  useEffect(() => { fetchAll(); }, [user.uid]);

  async function fetchAll() {
    const safety = setTimeout(() => { setLoading(false); setSyncing(false); }, 8000);
    setFetchError(null);
    try {
      // 1. Profile
      const pSnap = await getDoc(doc(db, "users", user.uid, "profile", "main"));
      if (pSnap.exists()) setProfile(pSnap.data());

      // 2. Sessions + interviews + badges + lexicon in parallel
      const [sSnap, iSnap, badgeSnap, lexSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "sessions"), limit(50))),
        getDocs(query(collection(db, "users", user.uid, "interviewSessions"), limit(20))),
        getDocs(collection(db, "users", user.uid, "badges")),
        getDocs(collection(db, "users", user.uid, "lexicon")),
      ]);

      const fetchedSessions = sSnap.docs.map(d => d.data()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      const fetchedInterviews = iSnap.docs.map(d => d.data()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      setSessions(fetchedSessions);
      setInterviews(fetchedInterviews);

      // Merged debriefs
      const merged = [
        ...fetchedInterviews.map(d => ({ ...d, _type: "interview" })),
        ...fetchedSessions.map(d => ({ ...d, _type: "battle" })),
      ].sort((a, b) => (b.timestamp || b.savedAt || "").localeCompare(a.timestamp || a.savedAt || "")).slice(0, 30);
      setSavedDebriefs(merged);

      // Badges
      const badgeMap = {};
      badgeSnap.docs.forEach(d => { badgeMap[d.id] = d.data(); });
      const earned = BADGES.map(b => ({ ...b, earned: !!badgeMap[b.id], earnedAt: badgeMap[b.id]?.earnedAt }));
      setEarnedBadges(earned);

      // Lexicon stats
      const lexItems = lexSnap.docs.map(d => d.data()).filter(d => d.status !== "pending_enrichment");
      setLexStats({
        totalSaved: lexItems.length,
        totalPracticed: lexItems.filter(i => (i.practiceCount || 0) > 0).length,
        totalMastered: lexItems.filter(i => i.status === "mastered").length,
        troubleCount: lexItems.filter(i => (i.practiceCount || 0) >= 1 && (i.avgScore || 5) < 3).length,
      });

    } catch (err) {
      console.warn("StatsScreen fetch error:", err.message);
      setFetchError("Couldn't reach the server. Check your connection and tap Retry.");
    } finally {
      clearTimeout(safety);
      setLoading(false);
      setSyncing(false);
    }
  }

  // ── Computed metrics ────────────────────────────────────────────────────────

  const allScores = sessions.map(s => s.aiScore || s.score).filter(Boolean);
  const avgScore = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const bestScore = allScores.length ? Math.max(...allScores) : null;
  const readinessScore = Math.min(Math.round((avgScore / 10) * 100), 100);
  const readinessColor = readinessScore >= 70 ? "#10b981" : readinessScore >= 40 ? "#f59e0b" : "#f43f5e";
  const readinessLabel = readinessScore >= 70 ? "Interview Ready" : readinessScore >= 40 ? "Getting There" : "Keep Practising";

  const totalSessions = (profile?.sessionsCount) ?? (sessions.length + interviews.length);
  const streak = profile?.streak || 0;
  const currentRank = profile?.rank || "rookie";
  const currentXP = profile?.xp || 0;

  // Frequent weak phrases
  const phraseCounts = {};
  sessions.forEach(s => {
    (s.weakPhrases || []).forEach(p => {
      phraseCounts[p] = (phraseCounts[p] || 0) + 1;
    });
  });
  const topMistakes = Object.entries(phraseCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  // Interview verdicts
  const recentVerdicts = interviews.slice(0, 5).filter(i => i.verdict);

  // Coaching notes
  const improvements = [];
  sessions.slice(0, 5).forEach(s => {
    if (s.tip && !improvements.includes(s.tip)) improvements.push(s.tip);
    if (s.improve1 && !improvements.includes(s.improve1)) improvements.push(s.improve1);
  });
  interviews.slice(0, 3).forEach(i => {
    if (i.improve1 && !improvements.includes(i.improve1)) improvements.push(i.improve1);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: 900, margin: "0 auto", padding: "24px 20px 100px",
      color: "#f1f5f9", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      minHeight: "100%", animation: "slideUp 0.3s ease",
    }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.5px" }}>Stats</div>
        {syncing && (
          <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s ease-in-out infinite" }} />
            Syncing…
          </div>
        )}
      </div>

      {/* User header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {user.displayName?.[0] || user.email?.[0] || "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{user.displayName || "PM Candidate"}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{user.email}</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 20,
        background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 4,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[{ id: "overview", label: "Overview" }, { id: "history", label: "History" }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 14, transition: "all 0.18s",
              background: activeTab === tab.id ? "rgba(99,102,241,0.18)" : "transparent",
              color: activeTab === tab.id ? "#a5b4fc" : "#64748b",
              boxShadow: activeTab === tab.id ? "0 0 0 1px rgba(99,102,241,0.3)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {fetchError && (
        <div style={{
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{fetchError}</span>
          <button
            onClick={() => { setFetchError(null); setSyncing(true); setLoading(true); fetchAll(); }}
            style={{
              flexShrink: 0, padding: "6px 14px", background: "rgba(244,63,94,0.15)",
              border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8,
              color: "#f43f5e", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Overview Tab ───────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <>
          {loading ? (
            <>
              <SkeletonCard height={160} />
              <SkeletonCard height={90} />
              <SkeletonCard height={120} />
            </>
          ) : (
            <>
              {/* Interview Readiness */}
              <div style={{ ...glassCard, padding: "22px 20px", marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                  Interview Readiness
                </div>
                <div style={{ fontSize: 64, fontWeight: 900, color: readinessColor, lineHeight: 1, letterSpacing: "-2px", marginBottom: 8 }}>
                  {readinessScore}%
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: readinessColor, marginBottom: 16 }}>{readinessLabel}</div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ height: "100%", width: `${readinessScore}%`, background: `linear-gradient(90deg, ${readinessColor}, ${readinessColor}88)`, borderRadius: 4, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Based on {totalSessions} session{totalSessions !== 1 ? "s" : ""} · {sessions.length} arena · {interviews.length} interviews
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { icon: "🎯", value: sessions.length, label: "Arena Sessions" },
                  { icon: "🎤", value: interviews.length, label: "Interviews" },
                  { icon: "📊", value: avgScore > 0 ? avgScore.toFixed(1) : "—", label: "Avg Score" },
                ].map((stat, i) => (
                  <div key={i} style={{ ...glassCard, padding: "16px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.5px" }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3, fontWeight: 600 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Expression Vault */}
              {lexStats && lexStats.totalSaved > 0 && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>
                    Expression Vault
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: lexStats.troubleCount > 0 || lexStats.totalMastered > 0 ? 12 : 0 }}>
                    {[
                      { label: "Saved",     value: lexStats.totalSaved,     color: "#818cf8" },
                      { label: "Practiced", value: lexStats.totalPracticed, color: "#06b6d4" },
                      { label: "Mastered",  value: lexStats.totalMastered,  color: "#f59e0b" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: 600 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {lexStats.troubleCount > 0 && (
                    <div style={{ padding: "8px 12px", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 6 }}>
                      🎯 {lexStats.troubleCount} trouble expression{lexStats.troubleCount !== 1 ? "s" : ""} — practice in Lightning Round
                    </div>
                  )}
                  {lexStats.totalMastered > 0 && (
                    <div style={{ padding: "8px 12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, fontSize: 12, color: "#fcd34d" }}>
                      🏆 {lexStats.totalMastered} expression{lexStats.totalMastered !== 1 ? "s" : ""} mastered — in your active vocabulary
                    </div>
                  )}
                </div>
              )}

              {/* Achievement Badge Wall */}
              {earnedBadges.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Achievements</div>
                    <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>
                      {earnedBadges.filter(b => b.earned).length} / {earnedBadges.length}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                    {earnedBadges.map(badge => (
                      <div key={badge.id} title={badge.desc} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        opacity: badge.earned ? 1 : 0.22,
                        filter: badge.earned ? "none" : "grayscale(1)",
                        transition: "opacity 0.2s",
                      }}>
                        <div style={{ fontSize: 24 }}>{badge.icon}</div>
                        <div style={{ fontSize: 8, color: badge.earned ? "#94a3b8" : "#475569", textAlign: "center", lineHeight: 1.3, fontWeight: 600 }}>
                          {badge.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phrases to Drop */}
              {topMistakes.length > 0 && (
                <div style={{ ...glassCard, padding: "18px 18px", marginBottom: 14, borderLeft: "4px solid #f43f5e", borderRadius: "0 18px 18px 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                    Phrases to Drop
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {topMistakes.map(([phrase, count], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(244,63,94,0.06)", borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: "#f43f5e", textDecoration: "line-through" }}>{phrase}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>x{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interviewer Verdicts */}
              {recentVerdicts.length > 0 && (
                <div style={{ ...glassCard, padding: "18px 18px", marginBottom: 14, borderLeft: "4px solid #8b5cf6", borderRadius: "0 18px 18px 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                    Interviewer Verdicts
                  </div>
                  {recentVerdicts.map((iv, i) => {
                    const vColor = iv.verdict?.toLowerCase().includes("hire") && !iv.verdict?.toLowerCase().includes("no") ? "#10b981" : "#f43f5e";
                    return (
                      <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < recentVerdicts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: `${vColor}18`, color: vColor }}>
                            {iv.verdict}
                          </span>
                          {iv.interviewerName && <span style={{ fontSize: 12, color: "#64748b" }}>{iv.interviewerName}</span>}
                        </div>
                        {iv.verdictReason && (
                          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic" }}>"{iv.verdictReason}"</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top Coaching Notes */}
              {improvements.length > 0 && (
                <div style={{ ...glassCard, padding: "18px 18px", marginBottom: 14, borderLeft: "4px solid #06b6d4", borderRadius: "0 18px 18px 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                    Top Coaching Notes
                  </div>
                  {improvements.slice(0, 5).map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14, color: "#06b6d4", flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Step CTA */}
              <div style={{ ...glassCard, padding: "18px 18px", marginBottom: 14, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                  Next Step
                </div>
                <div style={{ fontSize: 14, color: "#a5b4fc", lineHeight: 1.6 }}>
                  {readinessScore >= 70
                    ? "You're interview ready. Focus on Quick Drills to sharpen edge-case questions and cement your structure."
                    : readinessScore >= 40
                      ? `Complete ${Math.max(5, 10 - sessions.length)} more arena sessions and review your weak phrases. Your readiness grows with volume.`
                      : "Start with Daily Arena challenges every day. Focus on one framework (PREP or STAR) and apply it consistently."}
                </div>
                <button
                  onClick={() => setCurrentScreen("home")}
                  style={{ marginTop: 14, width: "100%", padding: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Start Practising →
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── History Tab ────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <>
          {/* Stats pills 2x2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <StatPill label="Total Sessions" value={totalSessions} icon="🎯" />
            <StatPill label="Current Streak" value={streak > 0 ? `🔥 ${streak}d` : "0 days"} icon={null} />
            <StatPill label="Avg AI Score" value={avgScore > 0 ? avgScore.toFixed(1) : "—"} icon="📊" />
            <StatPill label="Best Score" value={bestScore ?? "—"} icon="⭐" />
          </div>

          {/* 7-Day Score Chart */}
          {loading ? <SkeletonCard height={150} /> : <ScoreChart sessions={sessions} />}

          {/* Rank Roadmap */}
          <RankRoadmap currentRank={currentRank} currentXP={currentXP} />

          {/* Session History */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12, marginTop: 4 }}>
            Session History
          </div>

          {loading ? (
            <>
              <SkeletonCard height={100} />
              <SkeletonCard height={100} />
              <SkeletonCard height={100} />
            </>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏟️</div>
              <div style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600 }}>No sessions yet</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>Complete your first battle to see your history.</div>
              <button
                onClick={() => setCurrentScreen("home")}
                style={{ marginTop: 16, padding: "12px 24px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Start a Battle →
              </button>
            </div>
          ) : (
            sessions.map((session, i) => <SessionCard key={i} session={session} />)
          )}

          {/* Saved Debriefs */}
          {savedDebriefs.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12, marginTop: 12 }}>
                Saved Debriefs
              </div>
              {savedDebriefs.map((debrief, i) => (
                <DebriefCard
                  key={i}
                  debrief={debrief}
                  isSelected={selectedDebrief === i}
                  onView={() => setSelectedDebrief(selectedDebrief === i ? null : i)}
                />
              ))}
            </>
          )}
        </>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
