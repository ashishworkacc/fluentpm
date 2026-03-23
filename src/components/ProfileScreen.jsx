import { useState, useEffect } from "react";
import { collection, query, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { BADGES } from "../lib/achievementChecker.js";

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
};

// ── Profile-level session cache (5-min TTL) ───────────────────────────────────
const PROF_CACHE_TTL = 5 * 60 * 1000;
function readProfCache(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(`fluentpm_prof_${uid}`) || "null");
    if (raw && Date.now() - raw.ts < PROF_CACHE_TTL) return raw;
  } catch {}
  return null;
}
function writeProfCache(uid, data) {
  try { localStorage.setItem(`fluentpm_prof_${uid}`, JSON.stringify({ ...data, ts: Date.now() })); } catch {}
}

export default function ProfileScreen({ user, setCurrentScreen }) {
  const profCache = readProfCache(user.uid);
  const [sessions, setSessions] = useState(profCache?.sessions || []);
  const [interviews, setInterviews] = useState(profCache?.interviews || []);
  const [loading, setLoading] = useState(!profCache);
  const [syncing, setSyncing] = useState(true); // always syncing until Firestore responds
  const [fetchError, setFetchError] = useState(null);
  const [firestoreXP, setFirestoreXP] = useState(profCache?.xp ?? null);
  const [firestoreSessionsCount, setFirestoreSessionsCount] = useState(profCache?.sessionsCount ?? null);
  const [lexStats, setLexStats] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);

  useEffect(() => {
    // 5-second safety timeout — always stop loading
    const safety = setTimeout(() => { setLoading(false); setSyncing(false); }, 5000);

    async function fetchData() {
      setFetchError(null);
      try {
        // Fetch profile/main for accurate XP and session count
        try {
          const pSnap = await getDoc(doc(db, "users", user.uid, "profile", "main"));
          if (pSnap.exists()) {
            const p = pSnap.data();
            if (p.xp != null) setFirestoreXP(p.xp);
            if (p.sessionsCount != null) setFirestoreSessionsCount(p.sessionsCount);
          }
        } catch {}

        const [sSnap, iSnap] = await Promise.all([
          getDocs(query(collection(db, "users", user.uid, "sessions"), limit(50))),
          getDocs(query(collection(db, "users", user.uid, "interviewSessions"), limit(20))),
        ]);
        const fetchedSessions = sSnap.docs.map(d => d.data()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
        const fetchedInterviews = iSnap.docs.map(d => d.data()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
        setSessions(fetchedSessions);
        setInterviews(fetchedInterviews);

        // Fetch expression stats
        try {
          const lexRef = collection(db, "users", user.uid, "lexicon");
          const lexSnap = await getDocs(lexRef);
          const lexItems = lexSnap.docs.map(d => d.data()).filter(d => d.status !== "pending_enrichment");
          const lexStatsData = {
            totalSaved:     lexItems.length,
            totalPracticed: lexItems.filter(i => (i.practiceCount || 0) > 0).length,
            totalMastered:  lexItems.filter(i => i.status === "mastered").length,
            troubleCount:   lexItems.filter(i => (i.practiceCount || 0) >= 1 && (i.avgScore || 5) < 3).length,
          };
          setLexStats(lexStatsData);
        } catch {}

        // Fetch badges
        try {
          const badgesSnap = await getDocs(collection(db, "users", user.uid, "badges"));
          const badgeMap = {};
          badgesSnap.docs.forEach(d => { badgeMap[d.id] = d.data(); });
          const earned = BADGES.map(b => ({ ...b, earned: !!badgeMap[b.id], earnedAt: badgeMap[b.id]?.earnedAt }));
          setEarnedBadges(earned);
        } catch {}

        writeProfCache(user.uid, {
          sessions: fetchedSessions,
          interviews: fetchedInterviews,
          xp: firestoreXP,
          sessionsCount: firestoreSessionsCount,
        });
      } catch (err) {
        console.warn("ProfileScreen fetch error:", err.message);
        if (!profCache) {
          setFetchError("Couldn't reach the server. Check your connection and tap Retry.");
        }
      } finally {
        clearTimeout(safety);
        setLoading(false);
        setSyncing(false);
      }
    }
    fetchData();
    return () => clearTimeout(safety);
  }, [user.uid]);

  // Compute metrics — use Firestore profile data when available
  const allScores = sessions.map(s => s.aiScore || s.score).filter(Boolean);
  const avgScore = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const readinessScore = Math.min(Math.round((avgScore / 10) * 100), 100);
  // Use Firestore session count if available (more accurate than array length)
  const totalSessions = firestoreSessionsCount ?? (sessions.length + interviews.length);

  // Frequent mistakes: count weak phrase occurrences
  const phraseCounts = {};
  sessions.forEach(s => {
    (s.weakPhrases || []).forEach(p => {
      phraseCounts[p] = (phraseCounts[p] || 0) + 1;
    });
  });
  const topMistakes = Object.entries(phraseCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Interview verdicts
  const recentVerdicts = interviews.slice(0, 5).filter(i => i.verdict);

  // Improvements from latest sessions
  const improvements = [];
  sessions.slice(0, 5).forEach(s => {
    if (s.tip && !improvements.includes(s.tip)) improvements.push(s.tip);
    if (s.improve1 && !improvements.includes(s.improve1)) improvements.push(s.improve1);
  });
  interviews.slice(0, 3).forEach(i => {
    if (i.improve1 && !improvements.includes(i.improve1)) improvements.push(i.improve1);
  });

  const totalAttempted = totalSessions;

  const readinessColor = readinessScore >= 70 ? "#10b981" : readinessScore >= 40 ? "#f59e0b" : "#f43f5e";
  const readinessLabel = readinessScore >= 70 ? "Interview Ready" : readinessScore >= 40 ? "Getting There" : "Keep Practising";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 100px", color: "#f1f5f9", fontFamily: "'Inter', sans-serif", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {user.displayName?.[0] || user.email?.[0] || "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{user.displayName || "PM Candidate"}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{user.email}</div>
        </div>
        {syncing && (
          <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s ease-in-out infinite" }} />
            Syncing…
          </div>
        )}
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div style={{
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{fetchError}</span>
          <button
            onClick={() => { setFetchError(null); setSyncing(true); setLoading(true); }}
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

      {loading && sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Loading your profile...</div>
      ) : (
        <>
          {/* Interview Readiness */}
          <div style={{ ...glassCard, padding: "22px 20px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Interview Readiness</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: readinessColor, lineHeight: 1, letterSpacing: "-2px", marginBottom: 8 }}>
              {readinessScore}%
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: readinessColor, marginBottom: 16 }}>{readinessLabel}</div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${readinessScore}%`, background: `linear-gradient(90deg, ${readinessColor}, ${readinessColor}88)`, borderRadius: 4, transition: "width 0.8s ease" }} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Based on {totalAttempted} session{totalAttempted !== 1 ? "s" : ""} · {sessions.length} arena · {interviews.length} interviews
            </div>
          </div>

          {/* Stats Row */}
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

          {/* Expression Vault Stats */}
          {lexStats && lexStats.totalSaved > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "16px 18px",
              marginBottom: 12,
            }}>
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
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "16px 18px",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Achievements
                </div>
                <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>
                  {earnedBadges.filter(b => b.earned).length} / {earnedBadges.length}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                {earnedBadges.map(badge => (
                  <div
                    key={badge.id}
                    title={badge.desc}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      opacity: badge.earned ? 1 : 0.22,
                      filter: badge.earned ? "none" : "grayscale(1)",
                      transition: "opacity 0.2s",
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{badge.icon}</div>
                    <div style={{ fontSize: 8, color: badge.earned ? "#94a3b8" : "#475569", textAlign: "center", lineHeight: 1.3, fontWeight: 600 }}>
                      {badge.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequent Mistakes */}
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

          {/* What Interviewers Thought */}
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

          {/* What To Improve */}
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

          {/* Next Steps */}
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

          {/* Data safety note */}
          <div style={{
            marginTop: 24,
            padding: "12px 16px",
            background: "rgba(16,185,129,0.04)",
            border: "1px solid rgba(16,185,129,0.12)",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Your data is stored securely in Firebase — updating the app or deploying new code never affects your history, scores, or question bank.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
