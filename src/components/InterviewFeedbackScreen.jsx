import { useState, useEffect } from "react";
import { INTERVIEW_TYPES } from "../data/interviewers.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ── Glass card ────────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

// ── Root cause map ────────────────────────────────────────────────────────────

const ROOT_CAUSES = {
  WE_FRAMING: { label: "We-framing", desc: "Hiding behind 'we' — the interviewer can't see your individual contribution", color: "#f59e0b" },
  CONFLICT_AVOIDANCE: { label: "Conflict avoidance", desc: "Removing all tension from your story — no stakes, no drama, nothing memorable", color: "#f43f5e" },
  STATUS_ANXIETY: { label: "Overclaiming", desc: "Making the story too perfect — experienced interviewers recognise this and discount it", color: "#f43f5e" },
  NARRATIVE_OVERLOAD: { label: "Too much detail", desc: "Collapsing under the weight of your own story — the point gets buried", color: "#f59e0b" },
  GENERIC_SAFETY: { label: "Safe and generic", desc: "Giving the answer anyone could give — nothing that marks this as unmistakably you", color: "#f59e0b" },
  DIRECTNESS_GAP: { label: "Indirect communication", desc: "Burying the headline — the answer is there, but it takes too long to find it", color: "#f59e0b" },
  STRUCTURE_COLLAPSE: { label: "No structure", desc: "Stream of consciousness — the interviewer is doing the work to find your point", color: "#f43f5e" },
  METRIC_AVOIDANCE: { label: "No numbers", desc: "Claims without evidence — impact without scale is easy to ignore", color: "#f59e0b" },
};

// ── Verdict config ────────────────────────────────────────────────────────────

function getVerdictConfig(verdict) {
  if (!verdict) return { label: "No Verdict", color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: "?" };
  const v = verdict.toLowerCase();
  if (v.includes("strong hire")) return { label: "Strong Hire", color: "#10b981", bg: "rgba(16,185,129,0.08)", icon: "🌟" };
  if (v.includes("strong no hire")) return { label: "Strong No Hire", color: "#dc2626", bg: "rgba(220,38,38,0.08)", icon: "✗✗" };
  if (v === "hire") return { label: "Hire", color: "#22c55e", bg: "rgba(34,197,94,0.08)", icon: "✓" };
  if (v.includes("no hire")) return { label: "No Hire", color: "#f43f5e", bg: "rgba(244,63,94,0.08)", icon: "✗" };
  return { label: verdict, color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: "·" };
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, color }) {
  const pct = Math.round((score / 5) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}/5</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const verdictXP = { "Strong Hire": 50, "Hire": 35, "No Hire": 15, "Strong No Hire": 10 };

export default function InterviewFeedbackScreen({
  user,
  interviewData,
  interviewFeedback,
  selfScores,
  setCurrentScreen,
}) {
  useEffect(() => {
    if (!user || !interviewFeedback) return;
    const feedback = interviewFeedback;
    const xpEarned = verdictXP[feedback.verdict] || 20;

    async function updateXP() {
      try {
        const { doc, getDoc, setDoc, increment } = await import("firebase/firestore");
        const { db } = await import("../lib/firebase.js");
        const { getRankFromXP } = await import("../hooks/useProgress.js");
        const profileRef = doc(db, "users", user.uid, "profile", "main");
        const today = new Date().toISOString().slice(0, 10);

        // Read current XP to compute new rank (rank is derived from total XP)
        let currentXP = 0;
        let currentStreak = 1;
        try {
          const snap = await getDoc(profileRef);
          if (snap.exists()) {
            currentXP = snap.data().xp || 0;
            currentStreak = snap.data().streak || 1;
          }
        } catch {}

        const newXP = currentXP + xpEarned;
        const newRank = getRankFromXP(newXP);

        // setDoc with merge:true creates the document if missing, merges if exists
        await setDoc(profileRef, {
          xp: newXP,
          rank: newRank,
          lastPlayedDate: today,
          sessionsCount: increment(1),
          interviewsCount: increment(1),
          streak: Math.max(1, currentStreak),
        }, { merge: true });

        // Update localStorage cache
        try {
          const cacheKey = `fluentpm_profile_${user.uid}`;
          const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
          localStorage.setItem(cacheKey, JSON.stringify({
            ...existing, xp: newXP, rank: newRank, lastPlayedDate: today,
          }));
        } catch {}

      } catch (e) {
        console.error("XP update error:", e.code, e.message);
        // Surface failure visibly in dev
        if (import.meta.env.DEV) alert(`XP save failed: ${e.code} ${e.message}`);
      }
    }
    updateXP();
  }, [user?.uid, interviewFeedback?.verdict]);

  if (!interviewFeedback || !interviewData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        <p>No feedback data available.</p>
        <button onClick={() => setCurrentScreen("interviewHome")} style={{
          background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 14,
        }}>
          ← Back to Interview Home
        </button>
      </div>
    );
  }

  const { interviewer, questionType } = interviewData;
  const questionTypeInfo = INTERVIEW_TYPES.find(t => t.id === questionType);

  const {
    productSense = 0,
    analytical = 0,
    execution = 0,
    communication = 0,
    leadership = 0,
    verdict = "",
    verdictReason = "",
    strongestMoment = "",
    lostInterviewerAt = "",
    sampleStrongAnswer = "",
    improve1 = "",
    improve2 = "",
    improve3 = "",
    innerMonologue = [],
    rootCause = "",
    rootCauseExplanation = "",
    rootCauseFix = "",
  } = interviewFeedback;

  const rootCauseInfo = ROOT_CAUSES[rootCause] || null;

  const [phrasesSaving, setPhrasesSaving] = useState(false);
  const [phrasesSaved, setPhrasesSaved] = useState(false);
  const [optimizedData, setOptimizedData] = useState(null);
  const [loadingOptimized, setLoadingOptimized] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);

  async function savePhrasesToLexicon() {
    if (!sampleStrongAnswer || phrasesSaving || phrasesSaved) return;
    setPhrasesSaving(true);
    try {
      const sentences = sampleStrongAnswer.split(". ").filter(Boolean).slice(0, 2);
      const { enrichExpression } = await import("../lib/openrouter.js");
      const { db } = await import("../lib/firebase.js");
      for (const phrase of sentences) {
        const clean = phrase.trim().replace(/\.$/, "");
        if (clean.length < 10) continue;
        const enriched = await enrichExpression(clean);
        await addDoc(collection(db, "users", user.uid, "lexicon"), {
          text: clean,
          source: "interview_feedback",
          savedAt: serverTimestamp(),
          enriched: enriched || {},
          status: "new",
          usedInBattles: 0,
        });
      }
      setPhrasesSaved(true);
    } catch (e) {
      console.error("Save phrases error:", e);
    } finally {
      setPhrasesSaving(false);
    }
  }

  async function loadOptimized() {
    if (optimizedData || loadingOptimized) return;
    setLoadingOptimized(true);
    try {
      const { generateOptimizedAnswer } = await import("../lib/openrouter.js");
      const result = await generateOptimizedAnswer(
        interviewFeedback.transcript || "",
        interviewFeedback.questionText || interviewData?.question?.text || "",
        interviewFeedback.questionType || "behavioral"
      );
      setOptimizedData(result);
    } catch {}
    setLoadingOptimized(false);
  }

  // Dimension comparison data
  const dimensions = [
    { label: "Product Sense", aiScore: productSense, selfScore: selfScores?.productSense, color: "#6366f1" },
    { label: "Analytical", aiScore: analytical, selfScore: selfScores?.analytical, color: "#06b6d4" },
    { label: "Execution", aiScore: execution, selfScore: selfScores?.execution, color: "#8b5cf6" },
    { label: "Communication", aiScore: communication, selfScore: selfScores?.communication, color: "#10b981" },
    { label: "Leadership", aiScore: leadership, selfScore: selfScores?.leadership, color: "#f59e0b" },
  ];

  const verdictConfig = getVerdictConfig(verdict);

  return (
    <div style={styles.container}>
      {/* Home button */}
      <button onClick={() => setCurrentScreen("home")} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        ← Home
      </button>
      {/* Verdict Hero */}
      <div style={{
        ...glassCard,
        padding: "28px 24px",
        marginBottom: 20,
        background: verdictConfig.bg,
        border: `1px solid ${verdictConfig.color}33`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "1px" }}>
          Interview Verdict
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: verdictConfig.color, marginBottom: 10, letterSpacing: "-0.5px" }}>
          {verdictConfig.icon} {verdictConfig.label}
        </div>
        {verdictReason && (
          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 12px" }}>
            {verdictReason}
          </div>
        )}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 20, padding: "6px 16px", fontSize: 14, fontWeight: 800,
          color: "#f59e0b", letterSpacing: "-0.3px", marginBottom: 12,
        }}>
          ⚡ +{verdictXP[verdict] || 20} XP earned
        </div>
        {interviewer && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{interviewer.avatar}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{interviewer.name}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "2px 8px",
              borderRadius: 10,
            }}>{interviewer.company}</span>
          </div>
        )}
      </div>

      {/* 5-Dimension Scores */}
      <div style={{ ...glassCard, padding: "20px 22px", marginBottom: 16 }}>
        <div style={styles.sectionTitle}>Performance Breakdown</div>
        {selfScores ? (
          // Side-by-side comparison when self scores are available
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>You</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px" }}>AI</span>
            </div>
            {dimensions.map(({ label, aiScore, selfScore, color }) => {
              const gap = selfScore - aiScore;
              const gapColor = gap >= 2 ? "#f43f5e" : gap === 1 ? "#f59e0b" : gap <= -1 ? "#10b981" : "#64748b";
              const gapLabel = gap > 0 ? `+${gap}` : gap < 0 ? `${gap}` : "=";
              return (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{selfScore}/5</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: gapColor, minWidth: 22, textAlign: "center" }}>{gapLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{aiScore}/5</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", width: `${Math.round((aiScore / 5) * 100)}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Simple bars when no self scores
          <>
            <ScoreBar label="Product Sense" score={productSense} color="#6366f1" />
            <ScoreBar label="Analytical Thinking" score={analytical} color="#06b6d4" />
            <ScoreBar label="Execution" score={execution} color="#8b5cf6" />
            <ScoreBar label="Communication" score={communication} color="#10b981" />
            <ScoreBar label="Leadership" score={leadership} color="#f59e0b" />
          </>
        )}
      </div>

      {/* Where you lost the interviewer */}
      {lostInterviewerAt && (
        <div style={{
          ...glassCard,
          padding: "16px 20px",
          marginBottom: 16,
          background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>⚠</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>
                Where you lost the interviewer
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{lostInterviewerAt}</div>
            </div>
          </div>
        </div>
      )}

      {/* Strongest moment */}
      {strongestMoment && (
        <div style={{
          ...glassCard,
          padding: "16px 20px",
          marginBottom: 16,
          background: "rgba(16,185,129,0.05)",
          border: "1px solid rgba(16,185,129,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                Your strongest moment
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{strongestMoment}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sample strong answer */}
      {sampleStrongAnswer && (
        <div style={{
          ...glassCard,
          padding: "16px 20px",
          marginBottom: 16,
          background: "rgba(99,102,241,0.05)",
          border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>
              What a strong answer looks like
            </div>
            {phrasesSaved ? (
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>✓ Saved 2 phrases</span>
            ) : (
              <button
                onClick={savePhrasesToLexicon}
                disabled={phrasesSaving}
                style={{
                  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#a5b4fc",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                {phrasesSaving ? "Saving..." : "Save key phrases to Lexicon"}
              </button>
            )}
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>
            "{sampleStrongAnswer}"
          </div>
        </div>
      )}

      {/* 3 areas to improve */}
      {(improve1 || improve2 || improve3) && (
        <div style={{ ...glassCard, padding: "20px 22px", marginBottom: 24 }}>
          <div style={styles.sectionTitle}>3 Areas to Work On</div>
          {[improve1, improve2, improve3].filter(Boolean).map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 2 ? 14 : 0 }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818cf8",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, paddingTop: 3 }}>{item}</div>
            </div>
          ))}
        </div>
      )}

      {/* Inner Monologue */}
      {innerMonologue && innerMonologue.some(Boolean) && (
        <div style={{ ...glassCard, padding: "20px 22px", marginBottom: 16 }}>
          <div style={styles.sectionTitle}>What I Was Thinking</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>— {interviewer?.name || "The interviewer"}'s inner monologue</div>
          {innerMonologue.map((thought, i) => {
            if (!thought) return null;
            const isPositive = /exactly|strong|impressed|great|excellent|good/.test(thought.toLowerCase());
            const isNegative = /losing|weak|vague|not specific|unclear|confused|worried|concerned/.test(thought.toLowerCase());
            const bg = isPositive ? "rgba(16,185,129,0.06)" : isNegative ? "rgba(244,63,94,0.06)" : "rgba(255,255,255,0.03)";
            const borderColor = isPositive ? "rgba(16,185,129,0.2)" : isNegative ? "rgba(244,63,94,0.15)" : "rgba(255,255,255,0.06)";
            const labelColor = isPositive ? "#10b981" : isNegative ? "#f43f5e" : "#64748b";
            return (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 4 ? 12 : 0 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: bg,
                  border: `1px solid ${borderColor}`,
                  color: labelColor,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  T{i + 1}
                </div>
                <div style={{
                  flex: 1,
                  background: bg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>{thought}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Root Cause */}
      {rootCauseInfo && (
        <div style={{
          ...glassCard,
          padding: "20px 22px",
          marginBottom: 24,
          background: "rgba(245,158,11,0.04)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}>
          <div style={styles.sectionTitle}>Why This Happened</div>
          <div style={{ marginBottom: 12 }}>
            <span style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(245,158,11,0.15)",
              color: "#f59e0b",
              marginBottom: 8,
            }}>
              {rootCauseInfo.label}
            </span>
            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>
              {rootCauseInfo.desc}
            </div>
            {rootCauseExplanation && (
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>
                "{rootCauseExplanation}"
              </div>
            )}
            {rootCauseFix && (
              <div style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 10,
                padding: "10px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Fix it
                </div>
                <div style={{ fontSize: 13, color: "#a5b4fc", lineHeight: 1.6 }}>{rootCauseFix}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Presence Dashboard */}
      {(() => {
        const totalWords = interviewFeedback.transcript
          ? interviewFeedback.transcript.split(/\s+/).filter(Boolean).length
          : 0;
        const totalFillers = Object.values(interviewFeedback.fillerCounts || {}).reduce((a, b) => a + b, 0);
        const fillerDensity = totalWords > 0 ? Math.round((totalFillers / totalWords) * 100) : 0;
        const wpm = interviewFeedback.wpm;

        const fillerScore = Math.max(0, 100 - fillerDensity * 5);
        const pacingScore = !wpm ? null : wpm < 100 ? 60 : wpm > 200 ? 65 : wpm > 170 ? 85 : 100;
        const presenceScore = pacingScore
          ? Math.round((fillerScore * 0.6 + pacingScore * 0.4))
          : fillerScore;

        const presenceColor = presenceScore >= 75 ? "#10b981" : presenceScore >= 50 ? "#f59e0b" : "#f43f5e";
        const presenceLabel = presenceScore >= 75 ? "Strong Presence" : presenceScore >= 50 ? "Developing" : "Needs Work";

        const topFillers = Object.entries(interviewFeedback.fillerCounts || {})
          .sort(([,a],[,b]) => b-a).slice(0, 4);

        return (
          <div style={{ background: "rgba(15,16,40,0.82)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
              🎙 Executive Presence
            </div>

            {/* Presence score */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: presenceColor, lineHeight: 1 }}>{presenceScore}</div>
                <div style={{ fontSize: 10, color: presenceColor, fontWeight: 700, marginTop: 2 }}>{presenceLabel}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ height: "100%", width: `${presenceScore}%`, background: `linear-gradient(90deg, ${presenceColor}, ${presenceColor}aa)`, borderRadius: 4, transition: "width 1s ease" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Filler Density", value: `${fillerDensity}%`, subtext: `${totalFillers} fillers / ${totalWords} words`, good: fillerDensity < 5 },
                    { label: "Pacing (WPM)", value: wpm ? `${wpm}` : "n/a", subtext: !wpm ? "Voice data unavailable" : wpm < 100 ? "Too slow" : wpm > 180 ? "Too fast" : "Good pace", good: wpm && wpm >= 100 && wpm <= 180 },
                  ].map(m => (
                    <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: m.good ? "#10b981" : "#f59e0b", lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{m.subtext}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filler breakdown */}
            {topFillers.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Filler Words</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {topFillers.map(([word, count]) => (
                    <div key={word} style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 20, padding: "4px 12px", display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>"{word}"</span>
                      <span style={{ fontSize: 11, color: "#f43f5e", fontWeight: 700 }}>×{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Pivot Timeline */}
      {interviewFeedback.conversationLog && interviewFeedback.conversationLog.length > 0 && (() => {
        const turns = interviewFeedback.conversationLog;
        const HAS_METRIC = /\d+%|\d+x|\$[\d,]+|\d+\s*(users|customers|revenue|points|percent|days|weeks|months|million|billion|k\b)/i;

        // Build pivot analysis — for each interviewer turn after the opener, check if next user turn has metrics
        const pivots = [];
        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];
          if (turn.role === "opponent" && i > 0) {
            const isProbe = /\?|how did you|can you|what was|tell me more|why did|give me|specifically|measure|metric|number|result/i.test(turn.text);
            const nextUserTurn = turns.slice(i + 1).find(t => t.role === "user");
            const hasMetric = nextUserTurn ? HAS_METRIC.test(nextUserTurn.text) : false;

            pivots.push({
              interviewerText: turn.text.slice(0, 120) + (turn.text.length > 120 ? "…" : ""),
              isProbe,
              hasMetric,
              userResponse: nextUserTurn?.text?.slice(0, 100) + (nextUserTurn?.text?.length > 100 ? "…" : "") || null,
            });
          }
        }

        const missedMetrics = pivots.filter(p => p.isProbe && !p.hasMetric).length;

        return (
          <div style={{ background: "rgba(15,16,40,0.82)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
                📍 Interview Timeline
              </div>
              {missedMetrics > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 20, padding: "3px 10px" }}>
                  {missedMetrics} missed metric trigger{missedMetrics !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pivots.map((pivot, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Timeline dot */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: pivot.isProbe
                        ? (pivot.hasMetric ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)")
                        : "rgba(255,255,255,0.05)",
                      border: `2px solid ${pivot.isProbe ? (pivot.hasMetric ? "#10b981" : "#f43f5e") : "rgba(255,255,255,0.1)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12,
                    }}>
                      {pivot.isProbe ? (pivot.hasMetric ? "✓" : "!") : "→"}
                    </div>
                    {i < pivots.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 12, background: "rgba(255,255,255,0.06)", marginTop: 2 }} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>Interviewer</span>
                      {pivot.isProbe && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>PROBE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: pivot.isProbe ? 6 : 0 }}>"{pivot.interviewerText}"</div>
                    {pivot.isProbe && pivot.userResponse && (
                      <div style={{ fontSize: 11, color: pivot.hasMetric ? "#10b981" : "#f43f5e", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, fontWeight: 700 }}>{pivot.hasMetric ? "✓ Metric included" : "✗ No metric"}</span>
                        {!pivot.hasMetric && <span style={{ color: "#64748b" }}>— add a specific number here</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {missedMetrics === 0 && pivots.filter(p => p.isProbe).length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: 8, fontSize: 12, color: "#10b981" }}>
                ✓ You included metrics in all probe responses
              </div>
            )}
          </div>
        );
      })()}

      {/* Transcript Analysis */}
      {interviewFeedback.transcript && (
        <div style={{ background: "rgba(15,16,40,0.82)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
          <button
            onClick={() => { setShowOptimized(v => !v); if (!optimizedData) loadOptimized(); }}
            style={{ width: "100%", padding: "18px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
              📝 Transcript Analysis
            </div>
            <span style={{ fontSize: 18, color: "#64748b" }}>{showOptimized ? "−" : "+"}</span>
          </button>

          {showOptimized && (
            <div style={{ padding: "0 20px 20px" }}>
              {/* Side by side: Your Answer vs Gold Standard */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {/* User's transcript */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Your Answer</div>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
                    {/* Highlight "we/our/us" in amber */}
                    {interviewFeedback.transcript.split(/\b(we|our|us|they|the team)\b/gi).map((part, i) =>
                      /^(we|our|us|they|the team)$/i.test(part)
                        ? <mark key={i} style={{ background: "rgba(245,158,11,0.25)", color: "#fcd34d", borderRadius: 2, padding: "0 1px" }}>{part}</mark>
                        : <span key={i}>{part}</span>
                    )}
                  </div>
                </div>

                {/* AI optimized */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Gold Standard</div>
                  <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#a7f3d0", lineHeight: 1.7 }}>
                    {loadingOptimized && <div style={{ color: "#64748b", fontStyle: "italic" }}>Generating optimized answer…</div>}
                    {optimizedData?.optimizedAnswer || (!loadingOptimized && "—")}
                  </div>
                </div>
              </div>

              {/* Ownership issues */}
              {optimizedData?.ownershipIssues?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>⚠ Ownership Signals to Fix</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {optimizedData.ownershipIssues.map((issue, i) => (
                      <span key={i} style={{ fontSize: 11, color: "#fcd34d", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, padding: "3px 10px" }}>"{issue}"</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metric gaps */}
              {optimizedData?.metricGaps?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>📊 Add Metrics Here</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {optimizedData.metricGaps.map((gap, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#a5b4fc", display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span style={{ color: "#6366f1", flexShrink: 0 }}>→</span>{gap}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        <button
          onClick={() => {
            // Go back to interview with same type and interviewer
            setCurrentScreen("interview");
          }}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#ffffff",
            border: "none",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Practice Again (Same Type)
        </button>
        <button
          onClick={() => setCurrentScreen("interviewHome")}
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(255,255,255,0.06)",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Different Type
        </button>
        <button
          onClick={() => setCurrentScreen("home")}
          style={{
            width: "100%",
            padding: "14px",
            background: "none",
            color: "#64748b",
            border: "none",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 20px",
    paddingBottom: 100,
    minHeight: "100%",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 16,
  },
};
