import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { scoreLightningRound } from "../lib/openrouter.js";
import { startRecognition } from "../lib/speechRecognition.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";
import { SCENARIOS } from "../data/scenarios.js";
import { PHRASE_CATEGORIES } from "../data/phrases.js";
import { computeNextReview, isDueForReview, getMasteryPercent, getNextReviewLabel } from "../lib/expressionScheduler.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_ROUNDS = 3;
const RESPOND_SECONDS = 60;
const INTRO_SECONDS = 3;
const SCENARIO_SECONDS = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

// Pick 3 fresh scenarios per session, avoiding the last 6 seen
function pickSessionScenarios(uid) {
  const key = `fluentpm_lr_recent_${uid}`;
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
  const fresh = SCENARIOS.filter(s => !recent.includes(s.id));
  const pool = fresh.length >= 6 ? fresh : SCENARIOS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, TOTAL_ROUNDS);
  const newRecent = [...picked.map(s => s.id), ...recent].slice(0, 9);
  try { localStorage.setItem(key, JSON.stringify(newRecent)); } catch {}
  return picked;
}

function getFallbackPhrase(roundIndex) {
  const allPhrases = PHRASE_CATEGORIES.buyingTime.phrases;
  return allPhrases[Math.floor(Math.random() * allPhrases.length)].text;
}

function getScoreColor(score) {
  if (!score) return "#64748b";
  if (score >= 4) return "#10b981";
  if (score >= 3) return "#f59e0b";
  return "#f43f5e";
}

function Countdown({ seconds }) {
  return (
    <div style={{
      fontSize: 72,
      fontWeight: 900,
      color: "#6366f1",
      letterSpacing: "-4px",
      lineHeight: 1,
      textAlign: "center",
    }}>
      {seconds}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: "50%",
      border: "2px solid rgba(99,102,241,0.2)",
      borderTopColor: "#6366f1",
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LightningRoundScreen({ user, setCurrentScreen }) {
  // Pick 3 fresh scenarios once per session mount
  const [sessionScenarios] = useState(() => pickSessionScenarios(user.uid));

  // Round state
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState("intro"); // intro | scenario | responding | scoring | summary
  const [countdown, setCountdown] = useState(INTRO_SECONDS);
  const [respondTimer, setRespondTimer] = useState(RESPOND_SECONDS);

  // Expressions from lexicon
  const [expressions, setExpressions] = useState([]);
  const [currentExpression, setCurrentExpression] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);

  // Mic/input state
  const [micState, setMicState] = useState("idle"); // idle | recording | nomic
  const [liveTranscript, setLiveTranscript] = useState("");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [micSupported, setMicSupported] = useState(true);

  // Filler tracking
  const [fillerCounts, setFillerCounts] = useState({});
  const [topFiller, setTopFiller] = useState(null);
  const [topFillerCount, setTopFillerCount] = useState(0);

  // Round results
  const [roundResults, setRoundResults] = useState([]);
  const roundResultsRef = useRef([]);
  const [currentRoundScore, setCurrentRoundScore] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [questionType, setQuestionType] = useState("standard");
  // "standard" | "context" | "variant"

  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const timerRef = useRef(null);

  // Fetch lexicon on mount
  useEffect(() => {
    fetchLexicon();
    // Check mic support
    const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    if (!supported) {
      setMicSupported(false);
      setMicState("nomic");
    }
  }, []);

  async function fetchLexicon() {
    try {
      const ref = collection(db, "users", user.uid, "lexicon");
      const q = query(ref, orderBy("savedAt", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by lastUsedDate asc (most overdue first), None = most overdue
      const sorted = data
        .filter(e => e.status !== "mastered")
        .sort((a, b) => {
          const aDue = isDueForReview(a);
          const bDue = isDueForReview(b);
          if (aDue && !bDue) return -1;
          if (!aDue && bDue) return 1;
          if (!a.nextReviewDate && !b.nextReviewDate) return 0;
          if (!a.nextReviewDate) return -1;
          if (!b.nextReviewDate) return 1;
          return new Date(a.nextReviewDate) - new Date(b.nextReviewDate);
        });
      setExpressions(sorted);
    } catch (err) {
      console.warn("Failed to fetch lexicon:", err.message);
    }
  }

  // Set expression and scenario for current round
  useEffect(() => {
    const expr = expressions[roundIndex] ? expressions[roundIndex].expression : getFallbackPhrase(roundIndex);
    setCurrentExpression(expr);
    setCurrentScenario(sessionScenarios[roundIndex] || sessionScenarios[0]);
    const ROUND_TYPES = ["standard", "context", "variant"];
    setQuestionType(ROUND_TYPES[roundIndex % 3]);
  }, [roundIndex, expressions]);

  // Countdown timer for intro/scenario phases
  useEffect(() => {
    if (phase === "intro") {
      setCountdown(INTRO_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setPhase("scenario");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
    if (phase === "scenario") {
      setCountdown(SCENARIO_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setPhase("responding");
            setRespondTimer(RESPOND_SECONDS);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [phase]);

  // Respond countdown
  useEffect(() => {
    if (phase !== "responding") return;
    timerRef.current = setInterval(() => {
      setRespondTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit whatever is captured
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  function handleAutoSubmit() {
    const text = liveTranscriptRef.current || confirmedTranscript || textInput;
    if (text.trim()) {
      submitResponse(text.trim());
    } else {
      submitResponse("[No response given]");
    }
  }

  // ── Mic handling (same pattern as BattleScreen) ─────────────────────────────

  function handleMicClick() {
    if (micState !== "idle") return;
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    setMicState("recording");

    recognitionRef.current = startRecognition(
      (transcript, isFinal) => {
        liveTranscriptRef.current = transcript;
        setLiveTranscript(transcript);
        const analysis = analyseTranscript(transcript);
        setFillerCounts(analysis.fillerCounts);
        const entries = Object.entries(analysis.fillerCounts).sort(([, a], [, b]) => b - a);
        if (entries.length > 0) {
          setTopFiller(entries[0][0]);
          setTopFillerCount(entries[0][1]);
        } else {
          setTopFiller(null);
          setTopFillerCount(0);
        }
        if (isFinal) {
          setConfirmedTranscript(transcript);
        }
      },
      () => {
        if (liveTranscriptRef.current.trim()) {
          setConfirmedTranscript(liveTranscriptRef.current);
        }
        setMicState("idle");
      }
    );

    if (recognitionRef.current && !recognitionRef.current.supported) {
      setMicSupported(false);
      setMicState("nomic");
    }
  }

  function handleStopMic() {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop?.();
    setMicState("idle");
  }

  async function submitResponse(text) {
    setIsScoring(true);
    clearInterval(timerRef.current);
    setPhase("scoring");

    const variants = expressions[roundIndex]?.enriched?.variants || [];
    const variantText = variants[0] || currentExpression;

    try {
      const result = await scoreLightningRound(
        currentExpression,
        "original",
        variantText,
        currentScenario?.text || "",
        text
      );

      const roundResult = {
        roundIndex,
        expression: currentExpression,
        scenario: currentScenario?.text || "",
        transcript: text,
        score: result?.score || 1,
        scoreLabel: result?.scoreLabel || "",
        feedback: result?.feedback || "",
        betterVersion: result?.betterVersion || "",
      };

      setCurrentRoundScore(roundResult);
      setRoundResults(prev => {
        const updated = [...prev, roundResult];
        roundResultsRef.current = updated;
        return updated;
      });

      // ── Update expression SRS in Firestore ──
      const expressionItem = expressions[roundIndex];
      if (expressionItem?.id && roundResult.score) {
        const updates = computeNextReview(expressionItem, roundResult.score);
        try {
          await updateDoc(doc(db, "users", user.uid, "lexicon", expressionItem.id), updates);
        } catch (e) {
          console.warn("SRS update failed:", e.message);
        }
      }
    } catch (err) {
      console.error("Lightning score error:", err);
      const fallback = {
        roundIndex,
        expression: currentExpression,
        scenario: currentScenario?.text || "",
        transcript: text,
        score: 1,
        scoreLabel: "",
        feedback: "Could not score this round. Please try again.",
        betterVersion: "",
      };
      setCurrentRoundScore(fallback);
      setRoundResults(prev => {
        const updated = [...prev, fallback];
        roundResultsRef.current = updated;
        return updated;
      });
    } finally {
      setIsScoring(false);
    }
  }

  function handleNextRound() {
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      finishSession();
    } else {
      setRoundIndex(prev => prev + 1);
      setPhase("intro");
      setMicState("idle");
      setLiveTranscript("");
      setConfirmedTranscript("");
      setTextInput("");
      setFillerCounts({});
      setTopFiller(null);
      setTopFillerCount(0);
      setCurrentRoundScore(null);
    }
  }

  async function finishSession() {
    const results = roundResultsRef.current;
    const allScores = results.map(r => r.score);
    const avgScore = allScores.length
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : 0;
    const xp = Math.round(10 + (avgScore / 5) * 10);

    try {
      await addDoc(collection(db, "users", user.uid, "lightningSessions"), {
        rounds: results,
        avgScore,
        xp,
        savedAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      console.warn("Failed to save lightning session:", err.message);
    }

    setPhase("summary");
  }

  // ── Rendering ─────────────────────────────────────────────────────────────────

  // Summary screen
  if (phase === "summary") {
    const results = roundResultsRef.current.length > 0 ? roundResultsRef.current : roundResults;
    const allScores = results.map(r => r.score);
    const avgScore = allScores.length
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : 0;
    const xp = Math.round(10 + (avgScore / 5) * 10);
    const worstRound = [...results].sort((a, b) => a.score - b.score)[0];

    return (
      <div style={styles.container}>
        <div style={styles.summaryHero}>
          <div style={{ fontSize: 72, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: getScoreColor(avgScore), letterSpacing: "-1px" }}>
            {avgScore}/5
          </div>
          <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 20 }}>Lightning Score</div>
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
            marginBottom: 32,
          }}>
            +{xp} XP
          </div>
        </div>

        {/* Expression progress bars */}
        {roundResultsRef.current.length > 0 && expressions.some((e, i) => roundResultsRef.current[i]) && (
          <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
              Expression Progress
            </div>
            {roundResultsRef.current.map((r, i) => {
              const expr = expressions[i];
              if (!expr) return null;
              const pct = getMasteryPercent({
                ...expr,
                goodPracticeCount: (expr.goodPracticeCount || 0) + (r.score >= 3 ? 1 : 0),
              });
              const scoreColor = getScoreColor(r.score);
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic", maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      "{expr.expression}"
                    </span>
                    <span style={{ fontSize: 12, color: scoreColor, fontWeight: 700, background: `${scoreColor}18`, padding: "2px 8px", borderRadius: 10, flexShrink: 0 }}>
                      {r.score}/5
                    </span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#f59e0b" : "#6366f1", borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
                    {pct === 100 ? "✓ Mastered!" : `${pct}% to mastery`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {worstRound?.feedback && (
          <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
              Key Tip
            </div>
            <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>
              {worstRound.feedback}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          {results.map((r, i) => (
            <div key={i} style={{ ...glassCard, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Round {i + 1}</div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: getScoreColor(r.score),
                background: `${getScoreColor(r.score)}18`,
                padding: "3px 10px",
                borderRadius: 20,
              }}>
                {r.score}/5
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCurrentScreen("home")}
          style={styles.doneBtn}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => setCurrentScreen("home")}
          style={styles.backBtn}
        >
          ← Exit
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
          Lightning Round
        </div>
        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
          {roundIndex + 1}/{TOTAL_ROUNDS}
        </div>
      </div>

      {/* Round progress dots */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div key={i} style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i < roundIndex
              ? "#6366f1"
              : i === roundIndex
                ? "rgba(99,102,241,0.5)"
                : "rgba(255,255,255,0.1)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* INTRO phase */}
      {phase === "intro" && (
        <div style={styles.phaseCard}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
            Target Expression
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 28, textAlign: "center" }}>
            "{currentExpression}"
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Starting in...</div>
          <Countdown seconds={countdown} />
        </div>
      )}

      {/* SCENARIO phase */}
      {phase === "scenario" && (
        <div style={styles.phaseCard}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
            Your Scenario
          </div>
          <div style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, fontStyle: "italic", textAlign: "center", marginBottom: 20 }}>
            "{currentScenario?.text}"
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Get ready...</div>
        </div>
      )}

      {/* RESPONDING phase */}
      {phase === "responding" && (
        <div style={styles.phaseContent}>
          {/* Scenario reminder — sticky */}
          <div style={{ ...glassCard, padding: "14px 16px", marginBottom: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", position: "sticky", top: 60, zIndex: 9 }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Scenario</div>
            <div style={{ fontSize: 14, color: "#f1f5f9", lineHeight: 1.5 }}>{currentScenario?.text}</div>
          </div>

          {/* Expression reminder + question type chip */}
          <div style={{ ...glassCard, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
            {(() => {
              const currentExprItem = expressions[roundIndex];
              const variantText = currentExprItem?.enriched?.variants?.[0] || currentExpression;
              const TYPE_CONFIG = {
                standard: { icon: "💬", text: "Use this expression naturally in your response" },
                context:  { icon: "🔥", text: "High pressure — hold your ground and use it" },
                variant:  { icon: "🎭", text: `Try the variant: "${variantText}"` },
              };
              const cfg = TYPE_CONFIG[questionType] || TYPE_CONFIG.standard;
              return (
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span>{cfg.icon}</span>
                  <span>{cfg.text}</span>
                </div>
              );
            })()}
            <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, marginBottom: 4 }}>Use this:</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>"{currentExpression}"</div>
          </div>

          {/* Timer ring */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{
              fontSize: 48,
              fontWeight: 900,
              color: respondTimer <= 10 ? "#f43f5e" : "#6366f1",
              letterSpacing: "-2px",
              transition: "color 0.5s",
            }}>
              {respondTimer}s
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>seconds left</div>
          </div>

          {/* Filler pill */}
          {topFiller && topFillerCount > 0 && (
            <div style={styles.fillerPill}>
              {topFiller} ×{topFillerCount}
            </div>
          )}

          {/* Live transcript */}
          {liveTranscript && (
            <div style={{ ...glassCard, padding: "10px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#f43f5e", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Listening...
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, fontStyle: "italic" }}>
                {liveTranscript}
              </p>
            </div>
          )}

          {/* Mic / text controls */}
          {micSupported && micState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <button onClick={handleMicClick} style={styles.micButton}>🎤</button>
              <div style={{ fontSize: 12, color: "#64748b" }}>Tap to speak</div>
            </div>
          )}

          {micState === "recording" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <button onClick={handleStopMic} style={{ ...styles.micButton, background: "linear-gradient(135deg, #f43f5e, #e11d48)" }}>
                🎤
              </button>
              <div style={{ fontSize: 12, color: "#f43f5e", fontWeight: 600 }}>Recording... tap to stop</div>
            </div>
          )}

          {/* Text fallback */}
          {(micState === "nomic" || !micSupported) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Type your response..."
                rows={3}
                style={styles.textInputBox}
                autoFocus
              />
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={() => {
              const text = confirmedTranscript || liveTranscriptRef.current || textInput;
              if (text.trim()) submitResponse(text.trim());
            }}
            disabled={!confirmedTranscript && !liveTranscriptRef.current && !textInput.trim()}
            style={{
              ...styles.submitBtn,
              opacity: !confirmedTranscript && !liveTranscriptRef.current && !textInput.trim() ? 0.4 : 1,
              cursor: !confirmedTranscript && !liveTranscriptRef.current && !textInput.trim() ? "default" : "pointer",
              marginTop: 16,
            }}
          >
            Submit Response →
          </button>
        </div>
      )}

      {/* SCORING phase */}
      {phase === "scoring" && (
        <div style={styles.phaseCard}>
          {isScoring ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Spinner />
              <div style={{ fontSize: 14, color: "#64748b" }}>Scoring your response...</div>
            </div>
          ) : currentRoundScore ? (
            <div>
              {/* Score */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  fontSize: 64, fontWeight: 900,
                  color: getScoreColor(currentRoundScore.score),
                  letterSpacing: "-3px", lineHeight: 1, marginBottom: 8,
                }}>
                  {currentRoundScore.score}/5
                </div>
                {currentRoundScore.scoreLabel && (
                  <div style={{ fontSize: 15, fontWeight: 700, color: getScoreColor(currentRoundScore.score) }}>
                    {currentRoundScore.scoreLabel}
                  </div>
                )}
              </div>

              {/* Feedback */}
              {currentRoundScore.feedback && (
                <div style={{ ...glassCard, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                    Tip
                  </div>
                  <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>
                    {currentRoundScore.feedback}
                  </div>
                </div>
              )}

              {/* Better version */}
              {currentRoundScore.betterVersion && (
                <div style={{ ...glassCard, padding: "14px 16px", marginBottom: 16, borderColor: "rgba(99,102,241,0.2)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                    Better Version
                  </div>
                  <div style={{ fontSize: 13, color: "#a5f3fc", fontStyle: "italic", lineHeight: 1.6 }}>
                    "{currentRoundScore.betterVersion}"
                  </div>
                </div>
              )}

              <button onClick={handleNextRound} style={styles.nextBtn}>
                {roundIndex + 1 >= TOTAL_ROUNDS ? "See Summary →" : "Next Round →"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "0 20px 100px",
    minHeight: "100dvh",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 0 20px",
    position: "sticky",
    top: 0,
    background: "rgba(6,8,24,0.9)",
    zIndex: 10,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
  },
  phaseCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
    textAlign: "center",
  },
  phaseContent: {
    padding: "0 0 24px",
  },
  fillerPill: {
    display: "inline-block",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.3)",
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 12px",
    borderRadius: 20,
    marginBottom: 12,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    fontSize: 28,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 32px rgba(99,102,241,0.35)",
    animation: "breathe 3s ease-in-out infinite",
  },
  textInputBox: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#f1f5f9",
    fontSize: 14,
    lineHeight: 1.6,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    boxSizing: "border-box",
  },
  nextBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  doneBtn: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  summaryHero: {
    textAlign: "center",
    padding: "40px 20px 20px",
  },
};
