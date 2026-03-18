import { INTERVIEW_TYPES } from "../data/interviewers.js";

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

export default function InterviewFeedbackScreen({
  user,
  interviewData,
  interviewFeedback,
  selfScores,
  setCurrentScreen,
}) {
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
          <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 16px" }}>
            {verdictReason}
          </div>
        )}
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 8 }}>
            What a strong answer looks like
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
