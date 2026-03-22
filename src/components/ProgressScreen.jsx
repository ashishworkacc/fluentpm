import { useState, useEffect } from "react";
import { collection, query, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { RANKS } from "../hooks/useProgress.js";

// ── Debrief card helpers ──────────────────────────────────────────────────────

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
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 10,
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

      {/* Inline expanded view */}
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
                    <div key={i} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 4, fontStyle: "italic" }}>T{i+1}: "{t}"</div>
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

function readCache(uid) {
  try {
    const raw = localStorage.getItem(`fluentpm_profile_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readSessionCache(uid) {
  try {
    const raw = localStorage.getItem(`fluentpm_sessions_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.ts || 0) > SESSION_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}

function writeSessionCache(uid, sessions, debriefs) {
  try {
    localStorage.setItem(`fluentpm_sessions_${uid}`, JSON.stringify({
      sessions,
      debriefs,
      ts: Date.now(),
    }));
  } catch {}
}

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const RANK_MILESTONES = [
  { key: "rookie", emoji: "🌱", label: "Rookie", xp: 0 },
  { key: "rising", emoji: "🌿", label: "Rising", xp: 300 },
  { key: "confident", emoji: "⭐", label: "Confident", xp: 600 },
  { key: "fluent", emoji: "🔥", label: "Fluent", xp: 800 },
  { key: "elite", emoji: "💎", label: "Elite", xp: 1300 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard({ height = 80 }) {
  return (
    <div style={{
      ...glassCard,
      height,
      marginBottom: 12,
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
        animation: "shimmer 1.5s linear infinite",
      }} />
    </div>
  );
}

function StatPill({ label, value, icon }) {
  return (
    <div style={{
      ...glassCard,
      padding: "16px 14px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      flex: 1,
    }}>
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

  // Map sessions to dates
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
                <div style={{ fontSize: 10, color: getScoreColor(score), fontWeight: 700 }}>
                  {score}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "transparent" }}>0</div>
              )}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                <div style={{
                  width: "100%",
                  height: barH || 4,
                  background: barColor,
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>
                {getDayLabel(day)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({ session, opponent }) {
  const scoreColor = getScoreColor(session.aiScore || session.score);
  const score = session.aiScore || session.score;
  const tip = session.tip || session.coachTip || "";
  const truncatedTip = tip.length > 80 ? tip.slice(0, 80) + "…" : tip;

  return (
    <div style={{
      ...glassCard,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{session.opponentAvatar || "🎯"}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
              {session.opponentName || "Opponent"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize" }}>
              {session.situationType || "session"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {score && (
            <div style={{
              fontSize: 13,
              fontWeight: 800,
              color: scoreColor,
              background: `${scoreColor}18`,
              padding: "3px 10px",
              borderRadius: 20,
            }}>
              {score}/10
            </div>
          )}
          {session.structureScore && (
            <div style={{
              fontSize: 11,
              color: "#8b5cf6",
              background: "rgba(139,92,246,0.1)",
              padding: "3px 8px",
              borderRadius: 20,
              fontWeight: 600,
            }}>
              S:{session.structureScore}/5
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: truncatedTip ? 8 : 0 }}>
        <div style={{ fontSize: 11, color: "#475569" }}>
          {formatDate(session.date || session.savedAt)}
        </div>
        {session.xp && (
          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>
            +{session.xp} XP
          </div>
        )}
      </div>

      {truncatedTip && (
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic" }}>
          "{truncatedTip}"
        </div>
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
              {/* Connector line */}
              {i < RANK_MILESTONES.length - 1 && (
                <div style={{
                  position: "absolute",
                  top: 18,
                  left: "50%",
                  right: "-50%",
                  height: 2,
                  background: isPassed ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)",
                  zIndex: 0,
                }} />
              )}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: isActive
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : isPassed
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.05)",
                border: isActive
                  ? "2px solid #6366f1"
                  : isPassed
                    ? "1px solid rgba(99,102,241,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                position: "relative",
                zIndex: 1,
                boxShadow: isActive ? "0 0 16px rgba(99,102,241,0.5)" : "none",
              }}>
                {milestone.emoji}
              </div>
              <div style={{ fontSize: 10, color: isActive ? "#6366f1" : "#475569", fontWeight: isActive ? 700 : 400, marginTop: 6, textAlign: "center" }}>
                {milestone.label}
              </div>
              <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>
                {milestone.xp} XP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ProgressScreen({ user, setCurrentScreen }) {
  // Load session cache immediately to show data before Firestore responds
  const sessionCache = readSessionCache(user.uid);
  const [sessions, setSessions] = useState(sessionCache?.sessions || []);
  const [loading, setLoading] = useState(!sessionCache);
  const [savedDebriefs, setSavedDebriefs] = useState(sessionCache?.debriefs || []);
  const [selectedDebrief, setSelectedDebrief] = useState(null);

  // Profile stats — start from cache, upgrade from Firestore
  const cached = readCache(user.uid) || {};
  const [currentRank, setCurrentRank] = useState(cached.rank || "rookie");
  const [currentXP, setCurrentXP] = useState(cached.xp || 0);
  const [streak, setStreak] = useState(cached.streak || 0);
  const [sessionsCount, setSessionsCount] = useState(cached.sessionsCount || 0);

  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    async function fetchAll() {
      try {
        // 1. Fetch Firestore profile/main for XP, rank, streak
        try {
          const profileSnap = await getDoc(doc(db, "users", user.uid, "profile", "main"));
          if (profileSnap.exists()) {
            const p = profileSnap.data();
            if (p.xp != null) setCurrentXP(p.xp);
            if (p.rank) setCurrentRank(p.rank);
            if (p.streak != null) setStreak(p.streak);
            if (p.sessionsCount != null) setSessionsCount(p.sessionsCount);
            // Refresh cache too
            try {
              const key = `fluentpm_profile_${user.uid}`;
              const existing = JSON.parse(localStorage.getItem(key) || "{}");
              localStorage.setItem(key, JSON.stringify({ ...existing, xp: p.xp, rank: p.rank, streak: p.streak, sessionsCount: p.sessionsCount }));
            } catch {}
          }
        } catch {}

        // 2. Fetch arena sessions
        const sessionsRef = collection(db, "users", user.uid, "sessions");
        const q = query(sessionsRef, limit(50));
        const snap = await getDocs(q);
        const data = snap.docs
          .map(d => d.data())
          .sort((a, b) => (b.savedAt || b.timestamp || "").localeCompare(a.savedAt || a.timestamp || ""))
          .slice(0, 20);
        setSessions(data);
        // Update sessionsCount from real Firestore data if profile had 0
        if (data.length > 0) setSessionsCount(prev => Math.max(prev, data.length));

        // 3. Fetch interview sessions for merged debrief list
        try {
          const interviewRef = collection(db, "users", user.uid, "interviewSessions");
          const iq = query(interviewRef, limit(20));
          const isnap = await getDocs(iq);
          const interviewData = isnap.docs.map(d => ({ ...d.data(), _type: "interview" }));
          const battleData = data.map(d => ({ ...d, _type: "battle" }));
          const merged = [...interviewData, ...battleData].sort((a, b) => {
            const ta = a.timestamp || a.savedAt || "";
            const tb = b.timestamp || b.savedAt || "";
            return tb.localeCompare(ta);
          }).slice(0, 30);
          setSavedDebriefs(merged);
          writeSessionCache(user.uid, data, merged);
        } catch {}

      } catch (err) {
        console.warn("Failed to fetch progress data:", err.message);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    }

    fetchAll();
    return () => clearTimeout(safetyTimer);
  }, [user.uid]);

  // Compute stats from fetched sessions
  const scores = sessions.map(s => s.aiScore || s.score).filter(Boolean);
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  const bestScore = scores.length ? Math.max(...scores) : null;

  // Improving badge: avg of last 5 > all-time avg
  const last5Scores = scores.slice(0, 5);
  const last5Avg = last5Scores.length
    ? last5Scores.reduce((a, b) => a + b, 0) / last5Scores.length
    : null;
  const allTimeAvg = avgScore;
  const isImproving = last5Avg && allTimeAvg && last5Avg > allTimeAvg && last5Scores.length >= 3;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>Progress</div>
        {isImproving && (
          <div style={styles.improvingBadge}>
            📈 Improving
          </div>
        )}
      </div>

      {/* Stats Row — 2x2 grid */}
      <div style={styles.statsGrid}>
        <StatPill label="Total Sessions" value={sessionsCount} icon="🎯" />
        <StatPill label="Current Streak" value={streak > 0 ? `🔥 ${streak}d` : "0 days"} icon={null} />
        <StatPill label="Avg AI Score" value={avgScore ?? "—"} icon="📊" />
        <StatPill label="Best Score" value={bestScore ?? "—"} icon="⭐" />
      </div>

      {/* 7-Day Score Chart */}
      {loading ? (
        <SkeletonCard height={150} />
      ) : (
        <ScoreChart sessions={sessions} />
      )}

      {/* Rank Roadmap */}
      <RankRoadmap currentRank={currentRank} currentXP={currentXP} />

      {/* Session History */}
      <div style={styles.sectionLabel}>Session History</div>

      {loading ? (
        <>
          <SkeletonCard height={100} />
          <SkeletonCard height={100} />
          <SkeletonCard height={100} />
        </>
      ) : sessions.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏟️</div>
          <div style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600 }}>No sessions yet</div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>Complete your first battle to see your history.</div>
          <button
            onClick={() => setCurrentScreen("home")}
            style={styles.startBtn}
          >
            Start a Battle →
          </button>
        </div>
      ) : (
        sessions.map((session, i) => (
          <SessionCard key={i} session={session} />
        ))
      )}

      {/* Saved Debriefs */}
      {savedDebriefs.length > 0 && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: 12 }}>Saved Debriefs</div>
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

      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "24px 20px 24px",
    paddingTop: 80,
    paddingBottom: 100,
    minHeight: "100%",
    animation: "slideUp 0.3s ease",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
  },
  improvingBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: "#10b981",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.25)",
    padding: "5px 12px",
    borderRadius: 20,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 12,
    marginTop: 4,
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
  },
  startBtn: {
    marginTop: 16,
    padding: "12px 24px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
