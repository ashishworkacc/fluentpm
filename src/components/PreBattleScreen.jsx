import { useState } from "react";

const AGGRESSION_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

const AGGRESSION_LABELS = {
  low: "Low pressure",
  medium: "Medium pressure",
  high: "High pressure",
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
    setBattleData({
      opponent,
      scenario,
      outline,
    });
    setCurrentScreen("battle");
  }

  const aggrColor = AGGRESSION_COLORS[opponent.aggression] || "#6b7280";

  return (
    <div style={styles.container}>
      {/* Back button */}
      <button onClick={() => setCurrentScreen("home")} style={styles.backBtn}>
        ← Back
      </button>

      <h1 style={styles.pageTitle}>Ready to Battle?</h1>

      {/* Opponent Card */}
      <div style={styles.opponentCard}>
        <div style={styles.opponentHeader}>
          <div style={styles.avatarBlock}>
            <div style={styles.avatar}>{opponent.avatar}</div>
          </div>
          <div style={styles.opponentInfo}>
            <div style={styles.opponentName}>{opponent.name}</div>
            <div style={styles.opponentRole}>{opponent.role}</div>
            <div style={{
              ...styles.aggressionBadge,
              backgroundColor: `${aggrColor}22`,
              color: aggrColor,
            }}>
              {AGGRESSION_LABELS[opponent.aggression]}
            </div>
          </div>
        </div>
        <div style={styles.catchphraseBox}>
          <p style={styles.catchphrase}>"{opponent.catchphrase}"</p>
        </div>
        <p style={styles.opponentDescription}>{opponent.description}</p>
      </div>

      {/* Scenario Card */}
      <div style={styles.scenarioCard}>
        <div style={styles.scenarioLabel}>Your Challenge</div>
        <p style={styles.scenarioText}>"{scenario.text}"</p>
        <div style={styles.scenariaMeta}>
          <span style={styles.situationType}>
            {scenario.situationType.charAt(0).toUpperCase() + scenario.situationType.slice(1)}
          </span>
          {scenario.suggestedFramework && (
            <span style={styles.frameworkHint}>
              💡 Try: {scenario.suggestedFramework}
            </span>
          )}
        </div>
      </div>

      {/* Outline Mode */}
      <div style={styles.outlineSection}>
        <button
          onClick={() => setOutlineOpen(v => !v)}
          style={styles.outlineToggle}
        >
          <span>📝 Plan your response</span>
          <span style={styles.toggleArrow}>{outlineOpen ? "▲" : "▼"}</span>
        </button>

        {outlineOpen && (
          <div style={styles.outlineBody}>
            <p style={styles.outlineHint}>
              Jot down 2–3 key points before you speak. This helps you structure your answer.
            </p>
            <textarea
              value={outline}
              onChange={e => setOutline(e.target.value)}
              placeholder="e.g.&#10;1. Acknowledge the concern&#10;2. Share what we know&#10;3. Next steps and timeline"
              rows={6}
              style={styles.outlineTextarea}
            />
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={styles.tipsCard}>
        <div style={styles.tipsTitle}>Battle Rules</div>
        <ul style={styles.tipsList}>
          <li style={styles.tipItem}>You get <strong>3 turns</strong> to make your case.</li>
          <li style={styles.tipItem}>Speak clearly — the AI listens and scores you.</li>
          <li style={styles.tipItem}>No jargon. No waffle. Be specific.</li>
        </ul>
      </div>

      {/* Enter Arena CTA */}
      <button onClick={handleEnterArena} style={styles.enterBtn}>
        Enter Arena →
      </button>

      <div style={styles.bottomSpacer} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: "16px 16px 0",
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  errorContainer: {
    padding: 32,
    textAlign: "center",
  },
  errorText: {
    color: "#9ca3af",
    marginBottom: 16,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    fontSize: 14,
    cursor: "pointer",
    padding: "8px 0",
    marginBottom: 16,
    display: "block",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 20,
    letterSpacing: "-0.5px",
  },
  // Opponent card
  opponentCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  opponentHeader: {
    display: "flex",
    gap: 16,
    marginBottom: 14,
  },
  avatarBlock: {},
  avatar: {
    fontSize: 48,
    lineHeight: 1,
  },
  opponentInfo: {
    flex: 1,
  },
  opponentName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 2,
  },
  opponentRole: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 8,
  },
  aggressionBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  catchphraseBox: {
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 12,
  },
  catchphrase: {
    fontSize: 14,
    color: "#d1d5db",
    fontStyle: "italic",
    margin: 0,
    lineHeight: 1.5,
  },
  opponentDescription: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 1.6,
    margin: 0,
  },
  // Scenario card
  scenarioCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  scenarioLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 10,
  },
  scenarioText: {
    fontSize: 15,
    color: "#ffffff",
    lineHeight: 1.6,
    margin: "0 0 14px",
    fontStyle: "italic",
  },
  scenariaMeta: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  situationType: {
    fontSize: 11,
    color: "#7c3aed",
    backgroundColor: "rgba(124,58,237,0.12)",
    padding: "3px 10px",
    borderRadius: 20,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  frameworkHint: {
    fontSize: 12,
    color: "#f59e0b",
  },
  // Outline
  outlineSection: {
    marginBottom: 16,
  },
  outlineToggle: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "left",
  },
  toggleArrow: {
    fontSize: 12,
    color: "#6b7280",
  },
  outlineBody: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    padding: 16,
  },
  outlineHint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
    lineHeight: 1.5,
  },
  outlineTextarea: {
    width: "100%",
    backgroundColor: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  // Tips
  tipsCard: {
    backgroundColor: "rgba(124,58,237,0.08)",
    border: "1px solid rgba(124,58,237,0.2)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#7c3aed",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 10,
  },
  tipsList: {
    margin: 0,
    paddingLeft: 16,
  },
  tipItem: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 1.6,
    marginBottom: 4,
  },
  // CTA
  enterBtn: {
    width: "100%",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    padding: "16px 24px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 16,
  },
  bottomSpacer: {
    height: 24,
  },
};
