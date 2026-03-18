import { useState, useEffect, useRef } from "react";
import { doc, addDoc, collection, updateDoc, getDoc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { getRankFromXP } from "../hooks/useProgress.js";
import { buildAndSaveCoachingProfile } from "../lib/coachingProfile.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";

// Keep localStorage cache in sync so HomeScreen loads instantly next time
function updateProfileCache(uid, updates) {
  try {
    const key = `fluentpm_profile_${uid}`;
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...existing, ...updates }));
  } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreLabel(score) {
  if (score >= 8) return "Crushing It";
  if (score >= 5) return "Solid";
  return "Keep Fighting";
}

function getScoreColor(score) {
  if (score >= 8) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#f43f5e";
}

function getConfidenceGapInterpretation(selfRating, aiScore) {
  if (!selfRating) return null;
  // aiScore is 1-10, selfRating is 1-5
  if (aiScore >= 8 && selfRating <= 3) {
    return "You're being too hard on yourself. That was objectively strong.";
  }
  if (aiScore <= 6 && selfRating >= 4) {
    return "You felt good, but the phrases were still basic. Let's look at what to change.";
  }
  if (aiScore <= 5 && selfRating <= 2) {
    return "Tough one. Every expert started here. Keep going.";
  }
  if (aiScore >= 8 && selfRating >= 4) {
    return "Strong all round. Next session will be harder.";
  }
  return "Your self-read is calibrated — trust that instinct.";
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// ── Glass card base ──────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreHero({ score, xp, structureScore }) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  return (
    <div style={{ textAlign: "center", padding: "32px 20px 24px", animation: "slideUp 0.3s ease" }}>
      <div style={{ fontSize: 96, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-4px", marginBottom: 4 }}>
        {score}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{label}</div>
        {structureScore !== undefined && (
          <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
            — Structure <span style={{ color: structureScore >= 4 ? "#10b981" : structureScore >= 3 ? "#f59e0b" : "#f43f5e", fontWeight: 700 }}>{structureScore}/5</span>
          </div>
        )}
      </div>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 20,
        padding: "6px 16px",
        fontSize: 15,
        fontWeight: 800,
        color: "#f59e0b",
        letterSpacing: "-0.3px",
      }}>
        ⚡ +{xp} XP
      </div>
    </div>
  );
}

function StarRating({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, fontWeight: 600 }}>
        Rate your confidence
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => onChange(star)}
            style={{
              background: "none",
              border: "none",
              fontSize: 32,
              cursor: "pointer",
              color: star <= value ? "#f59e0b" : "rgba(255,255,255,0.12)",
              padding: "2px 4px",
              transition: "color 0.1s, transform 0.1s",
              lineHeight: 1,
              transform: star <= value ? "scale(1.1)" : "scale(1)",
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ children, accentColor, style }) {
  return (
    <div style={{
      ...glassCard,
      padding: 18,
      marginBottom: 12,
      borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
      borderRadius: accentColor ? "0 18px 18px 0" : 18,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, color }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: color || "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "1.2px",
      marginBottom: 10,
    }}>
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
        // Compute cleanSpeechPct from fillerCounts if available
        let cleanSpeechPct = sd.cleanSpeechPct;
        if (!cleanSpeechPct && sd.transcript) {
          const analysis = analyseTranscript(sd.transcript);
          cleanSpeechPct = analysis.cleanSpeechPct;
        }

        await addDoc(collection(db, "users", user.uid, "sessions"), {
          ...sd,
          cleanSpeechPct,
          aiScore: sd.score, // store as aiScore for coachingProfile queries
          coachTip: sd.tip,   // store as coachTip for coachingProfile queries
          savedAt: new Date().toISOString(),
        });

        // Build coaching profile in background — non-blocking
        buildAndSaveCoachingProfile(user.uid).catch(err => {
          console.warn("Coaching profile build failed:", err.message);
        });

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

          const profileUpdate = {
            xp: newXP,
            rank: newRank,
            streak: newStreak,
            lastPlayedDate: today,
            sessionsCount: (current.sessionsCount || 0) + 1,
          };
          await updateDoc(profileRef, { ...profileUpdate, sessionsCount: increment(1) });
          updateProfileCache(user.uid, profileUpdate); // keep local cache fresh
        } else {
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
        <button onClick={() => setCurrentScreen("home")} style={styles.linkBtn}>
          ← Home
        </button>
      </div>
    );
  }

  const confidenceGap = getConfidenceGapInterpretation(selfRating, sd.score);

  const fillerEntries = sd.fillerCounts
    ? Object.entries(sd.fillerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  // Compute clean speech % from transcript if not pre-computed
  let cleanSpeechPct = sd.cleanSpeechPct;
  if (!cleanSpeechPct && sd.transcript) {
    const analysis = analyseTranscript(sd.transcript);
    cleanSpeechPct = analysis.cleanSpeechPct;
  }
  const cleanSpeechColor = cleanSpeechPct > 80 ? "#10b981" : cleanSpeechPct > 60 ? "#f59e0b" : "#f43f5e";

  return (
    <div style={styles.container}>
      {/* Score Hero */}
      <ScoreHero score={sd.score} xp={sd.xp} structureScore={sd.structureScore} />

      {/* Self-Confidence Rating */}
      <div style={styles.content}>
        <SectionCard accentColor="#f59e0b">
          <SectionLabel color="#f59e0b">How confident did you feel?</SectionLabel>
          <StarRating value={selfRating} onChange={setSelfRating} />
          {selfRating > 0 && confidenceGap && (
            <p style={styles.confidenceGapText}>{confidenceGap}</p>
          )}
        </SectionCard>

        {/* CONFIDENCE READ — indigo left border */}
        {selfRating > 0 && confidenceGap && (
          <SectionCard accentColor="#6366f1">
            <SectionLabel color="#6366f1">CONFIDENCE READ</SectionLabel>
            <p style={styles.bodyText}>{confidenceGap}</p>
          </SectionCard>
        )}

        {/* WHAT YOU NAILED — green left border */}
        {sd.highlight && (
          <SectionCard accentColor="#10b981">
            <SectionLabel color="#10b981">WHAT YOU NAILED</SectionLabel>
            <p style={styles.bodyText}>{sd.highlight}</p>
          </SectionCard>
        )}

        {/* PHRASES TO RETIRE — red left border */}
        {sd.weakPhrases && sd.weakPhrases.length > 0 && (
          <SectionCard accentColor="#f43f5e">
            <SectionLabel color="#f43f5e">PHRASES TO RETIRE</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sd.weakPhrases.map((phrase, i) => (
                <div key={i} style={styles.weakPhraseItem}>
                  <span style={styles.weakPhrase}>{phrase}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* NATURALNESS CHECK — amber left border */}
        {sd.naturalnessFlagsCount > 0 && sd.naturalnessFlagsDetails && (
          <SectionCard accentColor="#f59e0b">
            <SectionLabel color="#f59e0b">NATURALNESS CHECK</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sd.naturalnessFlagsDetails.map((flag, i) => (
                <div key={i} style={styles.naturalnessRow}>
                  <div style={styles.naturalnessYouSaid}>
                    You said: <em>"{flag.phrase}"</em>
                  </div>
                  <span style={styles.naturalnessBadge}>{flag.category}</span>
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

        {/* Filler Breakdown + Clean Speech */}
        {fillerEntries.length > 0 && (
          <SectionCard accentColor="#f43f5e">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabel color="#f43f5e">FILLER WORDS</SectionLabel>
              {cleanSpeechPct !== undefined && (
                <div style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: cleanSpeechColor,
                  background: `${cleanSpeechColor}18`,
                  padding: "3px 10px",
                  borderRadius: 20,
                }}>
                  {cleanSpeechPct}% clean
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {fillerEntries.map(([word, count]) => (
                <div key={word} style={styles.fillerItem}>
                  <span style={styles.fillerWord}>"{word}"</span>
                  <span style={styles.fillerCount}>× {count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* USE THESE NEXT TIME — cyan left border */}
        {sd.powerPhrases && sd.powerPhrases.length > 0 && (
          <SectionCard accentColor="#06b6d4">
            <SectionLabel color="#06b6d4">USE THESE NEXT TIME</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sd.powerPhrases.map((phrase, i) => (
                <div key={i} style={styles.powerPhraseItem}>
                  <span style={styles.powerPhraseNum}>{i + 1}.</span>
                  <span style={styles.powerPhrase}>"{phrase}"</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* STRUCTURE — purple left border */}
        {(sd.structureTip || sd.structureReplayShow) && (
          <SectionCard accentColor="#8b5cf6">
            <SectionLabel color="#8b5cf6">STRUCTURE</SectionLabel>
            {sd.structureScore !== undefined && (
              <div style={styles.structureBarRow}>
                <span style={styles.structureBarLabel}>{sd.structureScore}/5</span>
                <div style={styles.structureBarTrack}>
                  <div style={{
                    ...styles.structureBarFill,
                    width: `${(sd.structureScore / 5) * 100}%`,
                    background: sd.structureScore >= 4
                      ? "linear-gradient(90deg, #10b981, #06b6d4)"
                      : sd.structureScore >= 3
                        ? "linear-gradient(90deg, #f59e0b, #f43f5e)"
                        : "linear-gradient(90deg, #f43f5e, #e11d48)",
                  }} />
                </div>
              </div>
            )}
            {sd.structureTip && (
              <p style={{ ...styles.bodyText, marginBottom: sd.structureReplayShow ? 14 : 0 }}>
                {sd.structureTip}
              </p>
            )}
            {sd.structureReplayShow && sd.structureReplayTurn && (
              <div style={styles.replayBlock}>
                <div style={styles.replayLabel}>What you said:</div>
                <div style={styles.replayOriginal}>{sd.structureReplayTurn}</div>
                <div style={styles.replayLabel}>Stronger version:</div>
                <div style={styles.replayFixed}>{sd.structureReplayFix}</div>
              </div>
            )}
          </SectionCard>
        )}

        {/* COACH'S CALL — white left border, prominent */}
        {sd.tip && (
          <SectionCard accentColor="rgba(255,255,255,0.4)" style={{
            background: "rgba(255,255,255,0.08)",
          }}>
            <SectionLabel color="#f1f5f9">COACH'S CALL</SectionLabel>
            <p style={{ ...styles.bodyText, fontSize: 16, lineHeight: 1.7, color: "#f1f5f9" }}>
              {sd.tip}
            </p>
          </SectionCard>
        )}

        {/* Actions */}
        <div style={styles.actionRow}>
          <button
            onClick={() => setCurrentScreen("preBattle")}
            style={styles.rematchBtn}
          >
            Rematch
          </button>
          <button
            onClick={() => setCurrentScreen("home")}
            style={styles.homeBtn}
          >
            New Arena →
          </button>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minHeight: "100dvh",
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
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "underline",
  },
  content: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "0 20px",
    animation: "slideUp 0.3s ease",
  },
  confidenceGapText: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "10px 0 0",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  bodyText: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 1.65,
    margin: 0,
  },
  // Weak phrases
  weakPhraseItem: {
    padding: "6px 10px",
    background: "rgba(244,63,94,0.06)",
    borderRadius: 8,
  },
  weakPhrase: {
    fontSize: 13,
    color: "#f43f5e",
    textDecoration: "line-through",
  },
  // Naturalness
  naturalnessRow: {
    background: "rgba(245,158,11,0.06)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  naturalnessYouSaid: {
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  naturalnessBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    color: "#f59e0b",
    background: "rgba(245,158,11,0.12)",
    padding: "2px 8px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  },
  naturalnessSayInstead: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  // Fillers
  fillerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(244,63,94,0.06)",
    borderRadius: 8,
    padding: "6px 10px",
  },
  fillerWord: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  fillerCount: {
    fontSize: 13,
    color: "#f43f5e",
    fontWeight: 700,
  },
  // Power phrases
  powerPhraseItem: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    padding: "6px 10px",
    background: "rgba(6,182,212,0.06)",
    borderRadius: 8,
  },
  powerPhraseNum: {
    fontSize: 12,
    color: "#06b6d4",
    fontWeight: 700,
    flexShrink: 0,
  },
  powerPhrase: {
    fontSize: 13,
    color: "#a5f3fc",
    fontStyle: "italic",
  },
  // Structure
  structureBarRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  structureBarLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#8b5cf6",
    flexShrink: 0,
  },
  structureBarTrack: {
    flex: 1,
    height: 8,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  structureBarFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.5s ease",
  },
  replayBlock: {
    marginTop: 12,
  },
  replayLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  },
  replayOriginal: {
    fontSize: 13,
    color: "#94a3b8",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 10,
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  replayFixed: {
    fontSize: 13,
    color: "#c4b5fd",
    background: "rgba(139,92,246,0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    lineHeight: 1.5,
  },
  // Actions
  actionRow: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  rematchBtn: {
    flex: 1,
    padding: "15px",
    background: "rgba(255,255,255,0.06)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  homeBtn: {
    flex: 2,
    padding: "15px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
  },
};
