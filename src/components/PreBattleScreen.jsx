import { useState } from "react";

const AGGRESSION_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f43f5e",
};

const AGGRESSION_LABELS = {
  low: "Low pressure",
  medium: "Medium pressure",
  high: "High pressure",
};

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 20,
};

export default function PreBattleScreen({
  user,
  opponent,
  scenario,
  setCurrentScreen,
  setBattleData,
}) {
  const [outline, setOutline] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);

  if (!opponent || !scenario) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>No opponent or scenario selected.</p>
        <button onClick={() => setCurrentScreen("home")} style={styles.backBtn}>
          ← Go Back
        </button>
      </div>
    );
  }

  function handleEnterArena() {
    setBattleData({ opponent, scenario, outline });
    setCurrentScreen("battle");
  }

  const aggrColor = AGGRESSION_COLORS[opponent.aggression] || "#94a3b8";

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <button onClick={() => setCurrentScreen("home")} style={styles.backBtn}>
          ←
        </button>
        <span style={styles.pageHeaderTitle}>{opponent.name}</span>
        <span style={styles.pageHeaderRight} />
      </div>

      <div style={styles.content}>
        {/* Opponent Card */}
        <div style={styles.opponentCard}>
          <div style={styles.avatarLarge}>{opponent.avatar}</div>
          <div style={styles.opponentName}>{opponent.name}</div>
          <div style={styles.opponentRole}>{opponent.role}</div>
          <div style={{
            ...styles.aggressionBadge,
            background: `${aggrColor}22`,
            color: aggrColor,
          }}>
            {AGGRESSION_LABELS[opponent.aggression]}
          </div>
          <div style={styles.catchphraseBox}>
            <p style={styles.catchphrase}>"{opponent.catchphrase}"</p>
          </div>
          {opponent.description && (
            <p style={styles.opponentDescription}>{opponent.description}</p>
          )}
        </div>

        {/* Scenario Card */}
        <div style={styles.scenarioCard}>
          <div style={styles.scenarioLabel}>THE SCENARIO</div>
          <p style={styles.scenarioText}>"{scenario.text}"</p>
          <div style={styles.scenarioMeta}>
            <span style={styles.situationType}>
              {scenario.situationType.charAt(0).toUpperCase() + scenario.situationType.slice(1)}
            </span>
          </div>
        </div>

        {/* Framework Hint Card — prominent */}
        {scenario.suggestedFramework && (() => {
          const frameworkDescriptions = {
            PREP: "Point → Reason → Example → Point",
            STAR: "Situation → Task → Action → Result",
            PSB: "Problem → Solution → Benefit",
            CAR: "Context → Action → Result",
          };
          const desc = frameworkDescriptions[scenario.suggestedFramework] || "";
          return (
            <div style={styles.frameworkCard}>
              <div style={styles.frameworkCardTitle}>💡 Suggested Framework</div>
              <div style={styles.frameworkCardName}>{scenario.suggestedFramework}</div>
              {desc && <div style={styles.frameworkCardDesc}>{desc}</div>}
              <div style={styles.frameworkCardNote}>Suggestion — not required</div>
            </div>
          );
        })()}

        {/* Outline — collapsible */}
        <div style={styles.outlineSection}>
          <button
            onClick={() => setOutlineOpen(v => !v)}
            style={styles.outlineToggle}
          >
            <span>Plan your response {outlineOpen ? "−" : "+"}</span>
            <span style={styles.toggleHint}>{outlineOpen ? "collapse" : "optional"}</span>
          </button>

          {outlineOpen && (
            <div style={styles.outlineBody}>
              <p style={styles.outlineHint}>
                Jot down 2–3 key points before you speak.
              </p>
              <textarea
                value={outline}
                onChange={e => setOutline(e.target.value)}
                placeholder={"e.g.\n1. Acknowledge the concern\n2. Share what we know\n3. Next steps and timeline"}
                rows={6}
                style={styles.outlineTextarea}
              />
            </div>
          )}
        </div>

        {/* Battle Rules */}
        <div style={styles.tipsCard}>
          <div style={styles.tipsTitle}>BATTLE RULES</div>
          <ul style={styles.tipsList}>
            <li style={styles.tipItem}>You get <strong>3 turns</strong> to make your case.</li>
            <li style={styles.tipItem}>Speak clearly — the AI listens and scores you.</li>
            <li style={styles.tipItem}>No jargon. No waffle. Be specific.</li>
          </ul>
        </div>

        {/* Spacer for fixed button on mobile */}
        <div style={{ height: 90 }} />
      </div>

      {/* Enter Arena — fixed bottom */}
      <div style={styles.enterArenaFixed}>
        <button onClick={handleEnterArena} style={styles.enterBtn}>
          Enter Arena →
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: "100dvh",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: "relative",
  },
  errorContainer: {
    padding: 32,
    textAlign: "center",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: "#94a3b8",
    fontSize: 15,
  },
  // Header
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 8px",
    position: "sticky",
    top: 0,
    background: "rgba(6,8,24,0.7)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    zIndex: 10,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 22,
    cursor: "pointer",
    padding: "4px 8px",
    lineHeight: 1,
    fontWeight: 300,
  },
  pageHeaderTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  pageHeaderRight: {
    width: 40,
  },
  content: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "20px 20px 0",
    animation: "slideUp 0.3s ease",
  },
  // Opponent card — centered
  opponentCard: {
    ...glassCard,
    padding: "28px 24px",
    textAlign: "center",
    marginBottom: 16,
  },
  avatarLarge: {
    fontSize: 80,
    lineHeight: 1,
    marginBottom: 14,
  },
  opponentName: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f1f5f9",
    marginBottom: 6,
    letterSpacing: "-0.5px",
  },
  opponentRole: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 12,
  },
  aggressionBadge: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 14px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 18,
  },
  catchphraseBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: 12,
  },
  catchphrase: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    fontStyle: "italic",
    margin: 0,
    lineHeight: 1.5,
  },
  opponentDescription: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.6,
    margin: 0,
  },
  // Scenario card — cyan left border
  scenarioCard: {
    ...glassCard,
    padding: 20,
    marginBottom: 16,
    borderLeft: "4px solid #06b6d4",
    borderRadius: "0 20px 20px 0",
  },
  scenarioLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#06b6d4",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    marginBottom: 10,
  },
  scenarioText: {
    fontSize: 17,
    color: "#f1f5f9",
    lineHeight: 1.6,
    margin: "0 0 14px",
    fontStyle: "italic",
  },
  scenarioMeta: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  situationType: {
    fontSize: 11,
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    padding: "3px 10px",
    borderRadius: 20,
    fontWeight: 700,
    textTransform: "capitalize",
  },
  frameworkCard: {
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderLeft: "4px solid #6366f1",
    borderRadius: "0 14px 14px 0",
    padding: "16px 18px",
    marginBottom: 16,
  },
  frameworkCardTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 8,
  },
  frameworkCardName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#818cf8",
    marginBottom: 6,
    letterSpacing: "-0.3px",
  },
  frameworkCardDesc: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
    lineHeight: 1.5,
  },
  frameworkCardNote: {
    fontSize: 11,
    color: "#475569",
    fontStyle: "italic",
  },
  // Outline
  outlineSection: {
    marginBottom: 16,
  },
  outlineToggle: {
    width: "100%",
    ...glassCard,
    padding: "14px 18px",
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "left",
    borderRadius: 14,
  },
  toggleHint: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 400,
  },
  outlineBody: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    padding: 16,
  },
  outlineHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
    lineHeight: 1.5,
  },
  outlineTextarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
    color: "#f1f5f9",
    fontSize: 13,
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  // Tips
  tipsCard: {
    background: "rgba(99,102,241,0.07)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 10,
  },
  tipsList: {
    margin: 0,
    paddingLeft: 18,
  },
  tipItem: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.6,
    marginBottom: 4,
  },
  // Fixed CTA
  enterArenaFixed: {
    position: "fixed",
    bottom: 24,
    left: 20,
    right: 20,
    maxWidth: 560,
    margin: "0 auto",
    zIndex: 20,
  },
  enterBtn: {
    width: "100%",
    height: 58,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 16,
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "0.3px",
    boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
  },
};
