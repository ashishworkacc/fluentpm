import { useState, useRef, useEffect } from "react";
import { startRecognition } from "../lib/speechRecognition.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-chat";

function getApiKey() {
  return import.meta.env.VITE_OPENROUTER_API_KEY;
}

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

const QUESTION_TYPES = [
  { id: "behavioral", label: "Behavioral", icon: "🧠" },
  { id: "product_design", label: "Product Design", icon: "🎨" },
  { id: "metrics", label: "Metrics", icon: "📊" },
  { id: "estimation", label: "Estimation", icon: "🔢" },
];

const STARTER_QUESTIONS = {
  behavioral: [
    "Tell me about a time you had to influence a team without direct authority.",
    "Describe a situation where you had to make a decision with incomplete data.",
    "Tell me about a time you failed at a product decision.",
  ],
  product_design: [
    "Design a feature for Spotify to help new users discover music.",
    "How would you improve the onboarding experience for Slack?",
    "Design a product to help remote teams stay aligned.",
  ],
  metrics: [
    "Our DAU/MAU ratio dropped 5% last month. How do you investigate?",
    "Pick one metric to measure success for Gmail. Defend your choice.",
    "Our retention is declining. Walk me through your diagnostic process.",
  ],
  estimation: [
    "Estimate the number of Uber rides taken in NYC on a Friday night.",
    "How many piano tuners are there in Chicago?",
    "Estimate the revenue from Google Maps in a year.",
  ],
};

async function generateQuestion(questionType) {
  const prompt = `Generate ONE concise PM interview question of type: ${questionType}.
Return ONLY the question text. No explanation. No formatting.`;
  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 80,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function getPushbackChallenge(question, userAnswer, challengeNumber) {
  const prompt = `You are a demanding interviewer stress-testing a candidate's answer.
The candidate just answered: "${userAnswer}"
Question asked: "${question}"

Fire challenge ${challengeNumber} of 3. One challenge at a time. Be direct and brief.
${challengeNumber === 1 ? 'Challenge 1: Focus on individual contribution vs team ("What did YOU specifically do?")' : ""}
${challengeNumber === 2 ? "Challenge 2: Probe the weakest/vaguest claim in their answer" : ""}
${challengeNumber === 3 ? 'Challenge 3: Demand proof of impact ("What number can you give me?")' : ""}

Return ONLY the challenge question. No preamble. No formatting. Just the question.`;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 120,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function scorePushback(question, allAnswers) {
  const transcript = allAnswers.join(" | ");
  const prompt = `You evaluated a PM candidate's ability to handle pushback.
Question: "${question}"
Candidate responses: "${transcript}"

Return ONLY valid JSON (no markdown):
{
  "resilience": 3,
  "specificity": 2,
  "tip": "one sentence on handling pushback better"
}

Rules:
- resilience 1-5: did they hold their ground without collapsing or over-explaining?
- specificity 1-5: did they add detail under pressure?
- Be strict: most candidates score 2-3`;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default function PushbackDrillScreen({ user, setCurrentScreen }) {
  const [phase, setPhase] = useState("pick_type"); // pick_type | loading_q | question | response_0 | challenge_1 | response_1 | challenge_2 | response_2 | challenge_3 | response_3 | scoring | results
  const [selectedType, setSelectedType] = useState(null);
  const [question, setQuestion] = useState("");
  const [userAnswers, setUserAnswers] = useState([]); // [initial, c1_response, c2_response, c3_response]
  const [challenges, setChallenges] = useState([]); // challenge texts
  const [currentInput, setCurrentInput] = useState("");
  const [micState, setMicState] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const liveRef = useRef("");

  async function handleTypeSelect(type) {
    setSelectedType(type);
    setPhase("loading_q");
    const starters = STARTER_QUESTIONS[type] || [];
    const fallback = starters[Math.floor(Math.random() * starters.length)];
    const q = await generateQuestion(type) || fallback;
    setQuestion(q);
    setPhase("question");
  }

  function startMic() {
    if (micState !== "idle") return;
    liveRef.current = "";
    setLiveTranscript("");
    setMicState("recording");
    recognitionRef.current = startRecognition(
      (t) => { liveRef.current = t; setLiveTranscript(t); },
      (final) => {
        const captured = (final || liveRef.current).trim();
        if (!captured) { setMicState("idle"); return; }
        setCurrentInput(captured);
        setMicState("confirming");
      }
    );
  }

  function stopMic() {
    recognitionRef.current?.stop?.();
    if (liveTranscript) {
      setCurrentInput(liveTranscript);
      setMicState("confirming");
    } else {
      setMicState("idle");
    }
  }

  async function submitAnswer() {
    if (!currentInput.trim()) return;
    const answer = currentInput.trim();
    const newAnswers = [...userAnswers, answer];
    setUserAnswers(newAnswers);
    setCurrentInput("");
    setLiveTranscript("");
    setMicState("idle");

    const responseIndex = newAnswers.length; // 1 after first answer

    if (responseIndex <= 3) {
      // Get next challenge
      setPhase("loading_challenge");
      const challenge = await getPushbackChallenge(question, answer, responseIndex);
      if (challenge) {
        setChallenges((prev) => [...prev, challenge]);
        setPhase(`challenge_${responseIndex}`);
      } else {
        setError("Failed to generate challenge.");
      }
    }
  }

  async function submitChallengeResponse() {
    if (!currentInput.trim()) return;
    const answer = currentInput.trim();
    const newAnswers = [...userAnswers, answer];
    setUserAnswers(newAnswers);
    setCurrentInput("");
    setLiveTranscript("");
    setMicState("idle");

    if (newAnswers.length >= 4) {
      // 1 initial + 3 challenge responses
      setPhase("scoring");
      const result = await scorePushback(question, newAnswers);
      setScores(result);
      setPhase("results");
    } else {
      // Get next challenge
      const challengeNum = newAnswers.length;
      setPhase("loading_challenge");
      const challenge = await getPushbackChallenge(question, answer, challengeNum);
      if (challenge) {
        setChallenges((prev) => [...prev, challenge]);
        setPhase(`challenge_${challengeNum}`);
      } else {
        setError("Failed to generate challenge.");
      }
    }
  }

  const isInitialAnswer = phase === "question";
  const isChallenge = /^challenge_/.test(phase);
  const challengeNum = isChallenge ? parseInt(phase.split("_")[1], 10) : 0;
  const currentChallenge = challenges[challengeNum - 1];

  if (phase === "pick_type") {
    return (
      <div style={styles.container}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setCurrentScreen("interviewHome")} style={styles.backBtn}>← Back</button>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={styles.title}>Pushback Drill</div>
          <div style={styles.subtitle}>Give an answer — then defend it under 3 rapid challenges.</div>
        </div>
        <div style={styles.sectionLabel}>Pick question type</div>
        <div style={styles.typeGrid}>
          {QUESTION_TYPES.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTypeSelect(t.id)}
              style={{ ...glassCard, padding: "16px", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "loading_q") {
    return (
      <div style={styles.centeredContainer}>
        <div style={styles.spinner} />
        <div style={{ fontSize: 14, color: "#64748b" }}>Generating question...</div>
      </div>
    );
  }

  if (phase === "scoring" || phase === "loading_challenge") {
    return (
      <div style={styles.centeredContainer}>
        <div style={styles.spinner} />
        <div style={{ fontSize: 14, color: "#64748b" }}>
          {phase === "scoring" ? "Scoring your resilience..." : "Preparing next challenge..."}
        </div>
      </div>
    );
  }

  if (phase === "results" && scores) {
    return (
      <div style={styles.container}>
        <div style={{ marginBottom: 24 }}>
          <div style={styles.title}>Pushback Results</div>
        </div>

        <div style={{ ...glassCard, padding: "24px 22px", marginBottom: 16 }}>
          <div style={styles.sectionLabel}>Your Performance</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#6366f1" }}>{scores.resilience}/5</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Resilience</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#06b6d4" }}>{scores.specificity}/5</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Specificity</div>
            </div>
          </div>
          {scores.tip && (
            <div style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 10,
              padding: "12px 14px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", marginBottom: 4, textTransform: "uppercase" }}>Tip</div>
              <div style={{ fontSize: 13, color: "#a5b4fc", lineHeight: 1.6 }}>{scores.tip}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { setPhase("pick_type"); setUserAnswers([]); setChallenges([]); setScores(null); setQuestion(""); }}
            style={styles.primaryBtn}
          >
            Try Again →
          </button>
          <button onClick={() => setCurrentScreen("interviewHome")} style={styles.secondaryBtn}>
            Back to Interview Home
          </button>
        </div>
      </div>
    );
  }

  // Question or challenge response UI
  return (
    <div style={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setCurrentScreen("interviewHome")} style={styles.backBtn}>← Back</button>
        {isChallenge && (
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#f59e0b",
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 20,
            padding: "3px 10px",
          }}>
            Challenge {challengeNum}/3
          </div>
        )}
      </div>

      {/* Question bubble */}
      <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 16 }}>
        {isInitialAnswer && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Question
          </div>
        )}
        {isChallenge && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Pushback
          </div>
        )}
        <div style={{ fontSize: 15, color: "#f1f5f9", lineHeight: 1.6, fontWeight: isInitialAnswer ? 600 : 400 }}>
          {isInitialAnswer ? question : currentChallenge}
        </div>
        {isChallenge && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
            Original: {question}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "10px 12px", color: "#f43f5e", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Input area */}
      <div style={{ ...glassCard, padding: "16px 18px" }}>
        {micState === "recording" && liveTranscript && (
          <div style={{ marginBottom: 10, fontSize: 14, color: "#cbd5e1", fontStyle: "italic", lineHeight: 1.5 }}>
            {liveTranscript}
          </div>
        )}

        {micState === "confirming" && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase" }}>What you said:</div>
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              rows={3}
              style={styles.inputBox}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setMicState("idle")} style={styles.secondaryBtn}>Re-record</button>
              <button
                onClick={isInitialAnswer ? submitAnswer : submitChallengeResponse}
                style={styles.primaryBtn}
              >
                Send →
              </button>
            </div>
          </div>
        )}

        {micState === "idle" && (
          <div>
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Type your response or use mic..."
              rows={4}
              style={styles.inputBox}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                onClick={startMic}
                style={{
                  ...glassCard,
                  padding: "12px 20px",
                  fontSize: 20,
                  cursor: "pointer",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#f1f5f9",
                }}
              >
                🎤
              </button>
              <button
                onClick={isInitialAnswer ? submitAnswer : submitChallengeResponse}
                disabled={!currentInput.trim()}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: currentInput.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
                  color: currentInput.trim() ? "#fff" : "#64748b",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: currentInput.trim() ? "pointer" : "default",
                }}
              >
                Send →
              </button>
            </div>
          </div>
        )}

        {micState === "recording" && (
          <div style={{ textAlign: "center" }}>
            <button onClick={stopMic} style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f43f5e, #e11d48)",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "#fff",
            }}>
              🎤
            </button>
            <div style={{ fontSize: 12, color: "#f43f5e", marginTop: 6 }}>Tap to stop</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 20px",
    paddingTop: 80,
    paddingBottom: 100,
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  centeredContainer: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    color: "#f1f5f9",
    fontFamily: "'Inter', sans-serif",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid rgba(99,102,241,0.2)",
    borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#f1f5f9",
    marginBottom: 6,
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 12,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 24,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
  },
  inputBox: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#f1f5f9",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  primaryBtn: {
    flex: 1,
    padding: "13px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
  secondaryBtn: {
    flex: 1,
    padding: "13px",
    background: "rgba(255,255,255,0.06)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
};
