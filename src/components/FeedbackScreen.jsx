import { useState, useEffect, useRef } from "react";
import { doc, addDoc, collection, updateDoc, getDoc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { getRankFromXP } from "../hooks/useProgress.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreLabel(score) {
  if (score >= 8) return "Crushing It";
  if (score >= 5) return "Solid";
  return "Keep Fighting";
}

function getScoreColor(score) {
  if (score >= 8) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#ef4444";
}

function getConfidenceGapInterpretation(selfRating, aiScore) {
  if (!selfRating) return null;
  const gap = selfRating - aiScore / 2; // selfRating is 1-5, aiScore 4-10 → normalise
  if (gap > 2) return "You felt more confident than the AI scored. Trust your instincts — but review the tips.";
  if (gap < -2) return "The AI saw strengths you didn't. You may be underselling yourself.";
  if (Math.abs(gap) <= 1) return "Your self-perception aligns well with your actual performance.";
  if (gap > 0) return "Slightly more confident than the score — a healthy mindset.";
  return "A small gap. Keep pushing your standards.";
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreHero({ score }) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  return (
    <div style={{ ...styles.scoreHero, borderColor: color }}>
      <div style={{ ...styles.scoreNumber, color }}>{score}</div>
      <div style={{ ...styles.scoreLabel, color }}>{label}</div>
      <div style={styles.scoreSubtitle}>out of 10</div>
    </div>
  );
}

function StarRating({ value, onChange }) {
  return (
    <div style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star)}
          style={{
            ...styles.starBtn,
            color: star <= value ? "#f59e0b" : "#2a2a2a",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function SectionCard({ children, style }) {
  return (
    <div style={{ ...styles.sectionCard, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, color }) {
  return (
    <div style={{ ...styles.sectionLabel, color: color || "#6b7280" }}>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FeedbackScreen({ user, sessionData, opponent, setCurrentScreen }) {
  const [selfRating, setSelfRating] = useState(0);
  const hasSaved = useRef(false);

  const sd = sessionData;

  // Save session to Firestore on mount (once)
  useEffect(() => {
    if (!sd || !user || hasSaved.current) return;
    hasSaved.current = true;

    async function saveSession() {
      try {
        // 1. Save session doc
        await addDoc(collection(db, "users", user.uid, "sessions"), {
          ...sd,
          savedAt: new Date().toISOString(),
        });

        // 2. Update profile
        const profileRef = doc(db, "users", user.uid, "profile", "main");
        const profileSnap = await getDoc(profileRef);
        const today = getTodayDateString();

        if (profileSnap.exists()) {
          const current = profileSnap.data();
          const lastPlayed = current.lastPlayedDate;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);

          const newStreak = lastPlayed === yesterdayStr ? (current.streak || 0) + 1 : 1;
          const newXP = (current.xp || 0) + (sd.xp || 0);
          const newRank = getRankFromXP(newXP);

          await updateDoc(profileRef, {
            xp: newXP,
            rank: newRank,
            streak: newStreak,
            lastPlayedDate: today,
            sessionsCount: increment(1),
          });
        } else {
          // Create profile if missing
          await setDoc(profileRef, {
            xp: sd.xp || 0,
            rank: getRankFromXP(sd.xp || 0),
            streak: 1,
            lastPlayedDate: today,
            sessionsCount: 1,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Error saving session:", err);
      }
    }

    saveSession();
  }, [sd, user]);

  if (!sd) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>No session data found.</p>
        <button onClick={() => setCurrentScreen("home")} style={styles.navBtn}>
          ← Home
        </button>
      </div>
    );
  }

  const confidenceGap = getConfidenceGapInterpretation(selfRating, sd.score);
  const scoreColor = getScoreColor(sd.score);

  // Filler breakdown for display
  const fillerEntries = sd.fillerCounts
    ? Object.entries(sd.fillerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  return (
    <div style={styles.container}>
      {/* Score Hero */}
      <ScoreHero score={sd.score} />

      {/* XP Earned */}
      <div style={styles.xpEarned}>
        <span style={styles.xpIcon}>⚡</span>
        <span style={styles.xpValue}>+{sd.xp} XP</span>
        <span style={styles.xpLabel}>earned this session</span>
      </div>

      {/* Self-Confidence Rating */}
      <SectionCard>
        <SectionLabel color="#f59e0b">How confident did you feel?</SectionLabel>
        <StarRating value={selfRating} onChange={setSelfRating} />
        {selfRating > 0 && confidenceGap && (
          <p style={styles.confidenceGapText}>{confidenceGap}</p>
        )}
      </SectionCard>

      {/* Structure & Fluency */}
      <SectionCard>
        <div style={styles.metricsRow}>
          <div style={styles.metricBlock}>
            <SectionLabel>Structure Score</SectionLabel>
            <div style={{ ...styles.metricValue, color: sd.structureScore >= 4 ? "#10b981" : sd.structureScore >= 3 ? "#f59e0b" : "#ef4444" }}>
              {sd.structureScore}/5
            </div>
          </div>
          <div style={styles.metricDivider} />
          <div style={styles.metricBlock}>
            <SectionLabel>Clean Speech</SectionLabel>
            <div style={{ ...styles.metricValue, color: "#7c3aed" }}>
              {sd.cleanSpeechPct !== undefined ? `${sd.cleanSpeechPct}%` : "—"}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Filler Breakdown */}
      {fillerEntries.length > 0 && (
        <SectionCard>
          <SectionLabel>Filler Words</SectionLabel>
          <div style={styles.fillerList}>
            {fillerEntries.map(([word, count]) => (
              <div key={word} style={styles.fillerItem}>
                <span style={styles.fillerWord}>"{word}"</span>
                <span style={styles.fillerCount}>× {count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* What You Nailed */}
      {sd.highlight && (
        <SectionCard style={{ borderColor: "#10b981" }}>
          <SectionLabel color="#10b981">What You Nailed ✓</SectionLabel>
          <p style={styles.bodyText}>{sd.highlight}</p>
        </SectionCard>
      )}

      {/* Phrases to Retire */}
      {sd.weakPhrases && sd.weakPhrases.length > 0 && (
        <SectionCard style={{ borderColor: "#ef4444" }}>
          <SectionLabel color="#ef4444">Phrases to Retire</SectionLabel>
          <div style={styles.weakPhraseList}>
            {sd.weakPhrases.map((phrase, i) => (
              <div key={i} style={styles.weakPhraseItem}>
                <span style={styles.weakPhrase}>{phrase}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Naturalness Check */}
      {sd.naturalnessFlagsCount > 0 && sd.naturalnessFlagsDetails && (
        <SectionCard style={{ borderColor: "#f59e0b" }}>
          <SectionLabel color="#f59e0b">Naturalness Check ⚠️</SectionLabel>
          <div style={styles.naturalnessFlags}>
            {sd.naturalnessFlagsDetails.map((flag, i) => (
              <div key={i} style={styles.naturalnessFlag}>
                <div style={styles.naturalnessYouSaid}>
                  You said: <em>"{flag.phrase}"</em>
                </div>
                <div style={styles.naturalnessCategoryBadge}>
                  {flag.category}
                </div>
                {flag.alternative && flag.alternative !== "none" && (
                  <div style={styles.naturalnessSayInstead}>
                    Say instead: <strong>"{flag.alternative}"</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Use These Next Time */}
      {sd.powerPhrases && sd.powerPhrases.length > 0 && (
        <SectionCard>
          <SectionLabel color="#7c3aed">Use These Next Time</SectionLabel>
          <div style={styles.powerPhraseList}>
            {sd.powerPhrases.map((phrase, i) => (
              <div key={i} style={styles.powerPhraseItem}>
                <span style={styles.powerPhrase}>"{phrase}"</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Structure Tip */}
      {sd.structureTip && (
        <SectionCard>
          <SectionLabel>Structure Tip</SectionLabel>
          <p style={styles.bodyText}>{sd.structureTip}</p>
        </SectionCard>
      )}

      {/* Structure Replay */}
      {sd.structureReplayShow && sd.structureReplayTurn && (
        <SectionCard style={{ borderColor: "#7c3aed" }}>
          <SectionLabel color="#7c3aed">Structure Replay</SectionLabel>
          <div style={styles.replaySection}>
            <div style={styles.replayLabel}>What you said:</div>
            <div style={styles.replayOriginal}>{sd.structureReplayTurn}</div>
            <div style={styles.replayLabel}>Stronger version:</div>
            <div style={styles.replayFixed}>{sd.structureReplayFix}</div>
          </div>
        </SectionCard>
      )}

      {/* Coach's Call */}
      {sd.tip && (
        <SectionCard style={{ backgroundColor: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.25)" }}>
          <SectionLabel color="#7c3aed">Coach's Call</SectionLabel>
          <p style={styles.bodyText}>{sd.tip}</p>
        </SectionCard>
      )}

      {/* Actions */}
      <div style={styles.actionRow}>
        <button
          onClick={() => {
            // Rematch: same opponent/scenario, go back to preBattle
            setCurrentScreen("preBattle");
          }}
          style={styles.rematchBtn}
        >
          Rematch
        </button>
        <button
          onClick={() => setCurrentScreen("home")}
          style={styles.homeBtn}
        >
          Choose Arena →
        </button>
      </div>

      <div style={styles.bottomSpacer} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: "16px 16px 0",
    backgroundColor: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minHeight: "100vh",
  },
  errorContainer: {
    padding: 32,
    textAlign: "center",
  },
  errorText: {
    color: "#9ca3af",
    marginBottom: 16,
  },
  navBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
  },
  // Score hero
  scoreHero: {
    backgroundColor: "#1a1a1a",
    border: "2px solid",
    borderRadius: 20,
    padding: "28px 24px",
    textAlign: "center",
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "-2px",
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  scoreSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  // XP
  xpEarned: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  xpIcon: {
    fontSize: 24,
  },
  xpValue: {
    fontSize: 28,
    fontWeight: 900,
    color: "#f59e0b",
    letterSpacing: "-0.5px",
  },
  xpLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  // Section card
  sectionCard: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 1.6,
    margin: 0,
  },
  // Stars
  starRow: {
    display: "flex",
    gap: 4,
    marginBottom: 8,
  },
  starBtn: {
    background: "none",
    border: "none",
    fontSize: 32,
    cursor: "pointer",
    padding: "2px 4px",
    transition: "color 0.1s",
    lineHeight: 1,
  },
  confidenceGapText: {
    fontSize: 13,
    color: "#9ca3af",
    margin: "4px 0 0",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  // Metrics row
  metricsRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
  },
  metricBlock: {
    flex: 1,
    textAlign: "center",
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#2a2a2a",
    margin: "0 16px",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  // Fillers
  fillerList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fillerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: 8,
    padding: "6px 10px",
  },
  fillerWord: {
    fontSize: 13,
    color: "#d1d5db",
  },
  fillerCount: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: 700,
  },
  // Weak phrases
  weakPhraseList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  weakPhraseItem: {
    padding: "6px 10px",
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: 8,
  },
  weakPhrase: {
    fontSize: 13,
    color: "#ef4444",
    textDecoration: "line-through",
  },
  // Naturalness
  naturalnessFlags: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  naturalnessFlag: {
    backgroundColor: "rgba(245,158,11,0.06)",
    borderRadius: 8,
    padding: "10px 12px",
  },
  naturalnessYouSaid: {
    fontSize: 13,
    color: "#d1d5db",
    marginBottom: 4,
  },
  naturalnessCategoryBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    color: "#f59e0b",
    backgroundColor: "rgba(245,158,11,0.12)",
    padding: "2px 8px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  },
  naturalnessSayInstead: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 1.5,
  },
  // Power phrases
  powerPhraseList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  powerPhraseItem: {
    padding: "8px 12px",
    backgroundColor: "rgba(124,58,237,0.08)",
    borderRadius: 8,
  },
  powerPhrase: {
    fontSize: 13,
    color: "#c4b5fd",
    fontStyle: "italic",
  },
  // Structure replay
  replaySection: {},
  replayLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 4,
  },
  replayOriginal: {
    fontSize: 13,
    color: "#9ca3af",
    backgroundColor: "#111111",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 10,
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  replayFixed: {
    fontSize: 13,
    color: "#c4b5fd",
    backgroundColor: "rgba(124,58,237,0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    lineHeight: 1.5,
  },
  // Actions
  actionRow: {
    display: "flex",
    gap: 10,
    marginTop: 8,
  },
  rematchBtn: {
    flex: 1,
    padding: "14px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  homeBtn: {
    flex: 2,
    padding: "14px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  bottomSpacer: {
    height: 32,
  },
};
