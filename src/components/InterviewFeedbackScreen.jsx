import { INTERVIEW_TYPES } from "../data/interviewers.js";

// ── Glass card ────────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
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
  } = interviewFeedback;

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
        <ScoreBar label="Product Sense" score={productSense} color="#6366f1" />
        <ScoreBar label="Analytical Thinking" score={analytical} color="#06b6d4" />
        <ScoreBar label="Execution" score={execution} color="#8b5cf6" />
        <ScoreBar label="Communication" score={communication} color="#10b981" />
        <ScoreBar label="Leadership" score={leadership} color="#f59e0b" />
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
