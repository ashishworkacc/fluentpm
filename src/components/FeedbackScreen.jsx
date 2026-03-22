import { useState, useEffect, useRef } from "react";
import { doc, addDoc, collection, updateDoc, getDoc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { getRankFromXP } from "../hooks/useProgress.js";
import { buildAndSaveCoachingProfile } from "../lib/coachingProfile.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";
import { cancelSpeech, speakOpponentLine } from "../lib/speechSynthesis.js";
import { enrichExpression, generateEliteVersion } from "../lib/openrouter.js";
import { startRecognition } from "../lib/speechRecognition.js";
import { serverTimestamp } from "firebase/firestore";

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

function MetricPill({ label, value, color, note }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 16px", borderRadius: 14,
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${color}44`,
      minWidth: 90, flex: 1,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.8px" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
        {value}
      </div>
      {note && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, textAlign: "center" }}>
          {note}
        </div>
      )}
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
  const [savedPhrases, setSavedPhrases] = useState({});

  // Highlight-to-lexicon
  const [selectedFeedbackText, setSelectedFeedbackText] = useState("");
  const [feedbackSelectionPos, setFeedbackSelectionPos] = useState(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [highlightSaved, setHighlightSaved] = useState(false);

  // Shadowing / echo mode
  const [eliteResponse, setEliteResponse] = useState("");
  const [generatingElite, setGeneratingElite] = useState(false);
  const [isPlayingElite, setIsPlayingElite] = useState(false);
  const [echoRecording, setEchoRecording] = useState(false);
  const [echoTranscript, setEchoTranscript] = useState("");
  const [echoScore, setEchoScore] = useState(null);
  const [scoringEcho, setScoringEcho] = useState(false);
  const echoRecognitionRef = useRef(null);

  async function saveToLexicon(phrase) {
    if (!phrase || savedPhrases[phrase]) return;
    setSavedPhrases(prev => ({ ...prev, [phrase]: "saving" }));
    try {
      const enriched = await enrichExpression(phrase);
      await addDoc(collection(db, "users", user.uid, "lexicon"), {
        text: phrase,
        source: "battle_feedback",
        savedAt: serverTimestamp(),
        enriched: enriched || {},
        status: "new",
        usedInBattles: 0,
      });
      setSavedPhrases(prev => ({ ...prev, [phrase]: "saved" }));
    } catch (err) {
      console.error("Save to lexicon error:", err);
      setSavedPhrases(prev => ({ ...prev, [phrase]: null }));
    }
  }

  // Highlight-to-lexicon handler
  function handleFeedbackSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2 && text.length < 200) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedFeedbackText(text);
      setFeedbackSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    } else {
      setSelectedFeedbackText("");
      setFeedbackSelectionPos(null);
    }
  }

  // Shadowing functions
  async function generateEliteResponse() {
    if (!sd?.transcript) return;
    setGeneratingElite(true);
    try {
      const elite = await generateEliteVersion(sd.transcript, sd.scenarioText, opponent?.name || "PM");
      const eliteText = elite || "Unable to generate elite response. Try again.";
      setEliteResponse(eliteText);
      // Save to Firestore for future reference
      try {
        await addDoc(collection(db, "users", user.uid, "eliteResponses"), {
          transcript: sd.transcript,
          scenarioText: sd.scenarioText || "",
          opponentName: opponent?.name || "",
          eliteVersion: eliteText,
          savedAt: serverTimestamp(),
          date: new Date().toISOString().slice(0, 10),
        });
      } catch {}
    } catch {
      setEliteResponse("Unable to generate elite response. Try again.");
    } finally {
      setGeneratingElite(false);
    }
  }

  async function playEliteResponse() {
    if (isPlayingElite) {
      cancelSpeech();
      setIsPlayingElite(false);
      return;
    }
    try {
      speakOpponentLine(eliteResponse, opponent?.id || "priya", {}, () => {
        setIsPlayingElite(false);
      });
      setIsPlayingElite(true);
    } catch {
      setIsPlayingElite(false);
    }
  }

  async function startEchoRecording() {
    try {
      setEchoTranscript("");
      setEchoScore(null);
      setEchoRecording(true);
      echoRecognitionRef.current = startRecognition(
        (transcript) => setEchoTranscript(transcript),
        (final) => {
          const captured = (final || "").trim();
          if (captured) {
            setEchoTranscript(captured);
            scoreEcho(captured);
          }
          setEchoRecording(false);
        }
      );
    } catch {
      setEchoRecording(false);
    }
  }

  async function scoreEcho(userEcho) {
    if (!eliteResponse || !userEcho) return;
    setScoringEcho(true);
    try {
      const eliteWords = new Set(eliteResponse.toLowerCase().split(/\W+/).filter(w => w.length > 4));
      const echoWords = new Set(userEcho.toLowerCase().split(/\W+/).filter(w => w.length > 4));
      const overlap = [...eliteWords].filter(w => echoWords.has(w)).length;
      const pct = eliteWords.size > 0 ? Math.round((overlap / eliteWords.size) * 100) : 0;
      const echoScoreVal = pct >= 70 ? 5 : pct >= 50 ? 4 : pct >= 30 ? 3 : pct >= 15 ? 2 : 1;
      const echoLabel = echoScoreVal >= 5 ? "Excellent match!" : echoScoreVal >= 4 ? "Good echo" : echoScoreVal >= 3 ? "Getting there" : "Keep practising";
      setEchoScore({ score: echoScoreVal, label: echoLabel, pct });
    } catch {}
    finally { setScoringEcho(false); }
  }

  function stopEchoRecording() {
    echoRecognitionRef.current?.stop?.();
    setEchoRecording(false);
  }

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
          const xpToAdd = sd.xp || (sd.score ? Math.round(15 + ((Math.min(10, sd.score || 5) - 4) / 6) * 35) : 20);
          const newXP = (current.xp || 0) + xpToAdd;
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
          const xpToAdd = sd.xp || (sd.score ? Math.round(15 + ((Math.min(10, sd.score || 5) - 4) / 6) * 35) : 20);
          await setDoc(profileRef, {
            xp: xpToAdd,
            rank: getRankFromXP(sd.xp || 0),
            streak: 1,
            lastPlayedDate: today,
            sessionsCount: 1,
            createdAt: new Date().toISOString(),
          });
        }
        // Update stakeholder trust cache
        try {
          const trustKey = `fluentpm_trust_${user.uid}`;
          const trust = JSON.parse(localStorage.getItem(trustKey) || "{}");
          const oppId = sd.opponentId;
          if (oppId && sd.score) {
            trust[oppId] = [...(trust[oppId] || []), sd.score].slice(-10); // keep last 10
            localStorage.setItem(trustKey, JSON.stringify(trust));
          }
        } catch {}

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

      {/* ── Objective Metrics Strip ── */}
      {(() => {
        const { fillerCounts = {}, cleanSpeechPct, pacingWpm, pacingNote } = sd;
        const fillerTotal = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
        if (!pacingWpm && fillerTotal === 0 && !cleanSpeechPct) return null;
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, paddingInline: 4 }}>
            {pacingWpm != null && (
              <MetricPill
                label="Pacing"
                value={`${pacingWpm} WPM`}
                color={pacingNote === "good pace" ? "#10b981" : "#f59e0b"}
                note={pacingNote === "too fast" ? "Slow down slightly" : pacingNote === "too slow" ? "Pick up the pace" : "Ideal range"}
              />
            )}
            {fillerTotal != null && (
              <MetricPill
                label="Fillers"
                value={fillerTotal}
                color={fillerTotal === 0 ? "#10b981" : fillerTotal <= 3 ? "#f59e0b" : "#f43f5e"}
                note={fillerTotal === 0 ? "Clean!" : fillerTotal <= 3 ? "Minor" : "Work on this"}
              />
            )}
            {cleanSpeechPct != null && (
              <MetricPill
                label="Clean Speech"
                value={`${cleanSpeechPct}%`}
                color={cleanSpeechPct >= 85 ? "#10b981" : cleanSpeechPct >= 70 ? "#f59e0b" : "#f43f5e"}
                note={cleanSpeechPct >= 85 ? "Excellent" : "Keep going"}
              />
            )}
          </div>
        );
      })()}

      {/* Self-Confidence Rating */}
      <div style={styles.content} onMouseUp={handleFeedbackSelection} onTouchEnd={handleFeedbackSelection}>
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
                <div key={i} style={{ ...styles.powerPhraseItem, justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flex: 1 }}>
                    <span style={styles.powerPhraseNum}>{i + 1}.</span>
                    <span style={styles.powerPhrase}>"{phrase}"</span>
                  </div>
                  {savedPhrases[phrase] === "saved" ? (
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700, marginLeft: 8 }}>✓</span>
                  ) : (
                    <button
                      onClick={() => saveToLexicon(phrase)}
                      disabled={savedPhrases[phrase] === "saving"}
                      style={{
                        background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                        borderRadius: 8, padding: "3px 10px", fontSize: 12, color: "#a5b4fc",
                        cursor: "pointer", marginLeft: 8, flexShrink: 0,
                      }}
                    >
                      {savedPhrases[phrase] === "saving" ? "..." : "+ Save"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Structure Score + STAR Checklist */}
        <SectionCard accentColor="#6366f1">
          <SectionLabel color="#6366f1">Structure</SectionLabel>

          {/* STAR checklist if we have the data */}
          {(sd.structureStarS || sd.structureStarT || sd.structureStarA || sd.structureStarR) ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { key: "S", label: "Situation", val: sd.structureStarS },
                  { key: "T", label: "Task",      val: sd.structureStarT },
                  { key: "A", label: "Action",    val: sd.structureStarA },
                  { key: "R", label: "Result",    val: sd.structureStarR },
                ].map(({ key, label, val }) => {
                  const color = val === "hit" ? "#10b981" : val === "partial" ? "#f59e0b" : "#f43f5e";
                  const icon  = val === "hit" ? "✓" : val === "partial" ? "~" : "✗";
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, color, fontWeight: 800, width: 18 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>
                        <strong style={{ color }}>{key}</strong> — {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: sd.structureScore >= 4 ? "#10b981" : sd.structureScore >= 3 ? "#f59e0b" : "#f43f5e", lineHeight: 1 }}>
                {sd.structureScore}
                <span style={{ fontSize: 14, color: "#64748b" }}>/5</span>
              </div>
            </div>
          )}

          {sd.structureTip && (
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{sd.structureTip}</p>
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

        {/* THINKING PATTERN DETECTED — cognitive load */}
        {sd.cognitiveLoadPattern && sd.cognitiveLoadPattern !== "none" && sd.cognitiveLoadDetail && sd.cognitiveLoadDetail !== "none" && (
          <SectionCard accentColor="#06b6d4">
            <SectionLabel color="#06b6d4">THINKING PATTERN DETECTED</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: "rgba(6,182,212,0.12)", color: "#06b6d4", textTransform: "uppercase",
              }}>
                {sd.cognitiveLoadPattern.replace(/_/g, " ")}
              </span>
            </div>
            <p style={styles.bodyText}>{sd.cognitiveLoadDetail}</p>
          </SectionCard>
        )}

        {/* SHADOW THIS RESPONSE — shadowing / echo mode */}
        <SectionCard accentColor="#8b5cf6" style={{ background: "rgba(139,92,246,0.06)" }}>
          <SectionLabel color="#8b5cf6">SHADOW THIS RESPONSE</SectionLabel>
          <p style={{ ...styles.bodyText, marginBottom: 14 }}>
            Hear an elite version of your answer. Then echo it back to lock in the intonation.
          </p>
          {!eliteResponse ? (
            <button
              onClick={generateEliteResponse}
              disabled={generatingElite}
              style={{
                background: generatingElite ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.2)",
                border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10,
                color: "#c4b5fd", fontSize: 14, fontWeight: 600, padding: "10px 16px",
                cursor: generatingElite ? "default" : "pointer", width: "100%",
              }}
            >
              {generatingElite ? "Generating Elite Version..." : "🎧 Play Elite Response"}
            </button>
          ) : (
            <div>
              <div style={{
                background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 12,
                fontSize: 14, color: "#c4b5fd", lineHeight: 1.65, fontStyle: "italic",
              }}>
                "{eliteResponse}"
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={playEliteResponse}
                  style={{
                    flex: 1, padding: "10px", background: "rgba(139,92,246,0.2)",
                    border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10,
                    color: "#c4b5fd", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {isPlayingElite ? "▐▐ Stop" : "▶ Play Again"}
                </button>
                <button
                  onClick={echoRecording ? stopEchoRecording : startEchoRecording}
                  style={{
                    flex: 1, padding: "10px",
                    background: echoRecording ? "rgba(244,63,94,0.2)" : "rgba(6,182,212,0.12)",
                    border: echoRecording ? "1px solid rgba(244,63,94,0.4)" : "1px solid rgba(6,182,212,0.25)",
                    borderRadius: 10, color: echoRecording ? "#f43f5e" : "#06b6d4",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {echoRecording ? "⏹ Stop Echo" : "🎤 Echo It"}
                </button>
              </div>
              {echoTranscript && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Your echo</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, fontStyle: "italic" }}>{echoTranscript}</div>
                </div>
              )}
              {scoringEcho && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", textAlign: "center" }}>Scoring your echo...</div>
              )}
              {echoScore && !scoringEcho && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#8b5cf6" }}>{echoScore.score}/5</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd" }}>{echoScore.label}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{echoScore.pct}% phrase match with elite version</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

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

      {/* Highlight-to-lexicon floating button */}
      {selectedFeedbackText && feedbackSelectionPos && !savingHighlight && !highlightSaved && (
        <button
          onMouseDown={async (e) => {
            e.preventDefault();
            setSavingHighlight(true);
            try {
              const enriched = await enrichExpression(selectedFeedbackText);
              await addDoc(collection(db, "users", user.uid, "lexicon"), {
                text: selectedFeedbackText,
                source: "battle_feedback",
                savedAt: serverTimestamp(),
                enriched: enriched || {},
                status: "new",
                usedInBattles: 0,
              });
              setHighlightSaved(true);
              setSelectedFeedbackText("");
              setFeedbackSelectionPos(null);
              setTimeout(() => setHighlightSaved(false), 2500);
            } catch (err) {
              console.error("Lexicon save error:", err);
            } finally {
              setSavingHighlight(false);
            }
          }}
          style={{
            position: "fixed",
            left: Math.min(feedbackSelectionPos.x - 80, window.innerWidth - 180),
            top: Math.max(feedbackSelectionPos.y - 44, 8),
            zIndex: 9999,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          📖 Save to Lexicon
        </button>
      )}

      {/* Highlight save success toast */}
      {highlightSaved && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#10b981", color: "#fff", borderRadius: 20,
          padding: "10px 20px", fontSize: 14, fontWeight: 600, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
        }}>
          ✓ Saved to Lexicon
        </div>
      )}
      {savingHighlight && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(15,16,40,0.95)", border: "1px solid rgba(99,102,241,0.3)",
          color: "#a5b4fc", borderRadius: 20,
          padding: "10px 20px", fontSize: 14, fontWeight: 600, zIndex: 9999,
        }}>
          ✦ Enriching & saving...
        </div>
      )}
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
