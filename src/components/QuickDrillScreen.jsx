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
  { id: "behavioral", label: "Behavioral", icon: "🧠", color: "#6366f1" },
  { id: "product_design", label: "Product Design", icon: "🎨", color: "#8b5cf6" },
  { id: "metrics", label: "Metrics", icon: "📊", color: "#06b6d4" },
  { id: "estimation", label: "Estimation", icon: "🔢", color: "#10b981" },
  { id: "strategy", label: "Strategy", icon: "♟", color: "#f59e0b" },
  { id: "execution", label: "Execution", icon: "⚡", color: "#f43f5e" },
];

const STARTER_QUESTIONS = {
  behavioral: [
    "Tell me about a time you had to influence without authority.",
    "Describe a failure and what you learned from it.",
    "Tell me about a time you had to make a tough call with incomplete data.",
  ],
  product_design: [
    "How would you improve notifications for Instagram?",
    "Design a feature to help new Airbnb hosts.",
    "How would you redesign Google Maps for elderly users?",
  ],
  metrics: [
    "How would you measure the success of a new onboarding flow?",
    "DAU dropped 10% on Monday. Walk me through your response.",
    "Pick one metric for YouTube Shorts and defend it.",
  ],
  estimation: [
    "Estimate how many cups of coffee are drunk in London each day.",
    "Estimate the daily active users of WhatsApp.",
    "How many weddings happen in India every year?",
  ],
  strategy: [
    "Should Uber enter the logistics market? Build your case.",
    "How would you think about Netflix expanding into gaming?",
    "Is it a good idea for Amazon to build its own phone again?",
  ],
  execution: [
    "You're the PM for a feature that keeps getting delayed. What do you do?",
    "How do you prioritise 10 features with a team of 3 engineers?",
    "A key dependency team just said they can't ship your requirement. What's your next move?",
  ],
};

const ROOT_CAUSE_LABELS = {
  WE_FRAMING: "We-framing",
  CONFLICT_AVOIDANCE: "Conflict avoidance",
  STATUS_ANXIETY: "Overclaiming",
  NARRATIVE_OVERLOAD: "Too much detail",
  GENERIC_SAFETY: "Safe and generic",
  DIRECTNESS_GAP: "Indirect communication",
  STRUCTURE_COLLAPSE: "No structure",
  METRIC_AVOIDANCE: "No numbers",
  none: null,
};

async function generateQuestion(questionType) {
  const prompt = `Generate ONE concise PM interview question of type: ${questionType}.
Return ONLY the question text. No explanation. No formatting. Max 30 words.`;
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
        max_tokens: 60,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function scoreAnswer(question, transcript) {
  const prompt = `You are evaluating a single PM interview answer. Be brief and direct.
Question: "${question}"
User's answer: "${transcript}"

Return ONLY valid JSON (no markdown):
{
  "score": 3,
  "strength": "one sentence on what worked",
  "improvement": "one specific thing to change next time",
  "rootCause": "GENERIC_SAFETY"
}

score must be 1-5. Default assumption: most answers score 2-3.
rootCause must be ONE of: WE_FRAMING | CONFLICT_AVOIDANCE | STATUS_ANXIETY | NARRATIVE_OVERLOAD | GENERIC_SAFETY | DIRECTNESS_GAP | STRUCTURE_COLLAPSE | METRIC_AVOIDANCE | none`;

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

const COUNTDOWN_SECS = 90;

export default function QuickDrillScreen({ user, setCurrentScreen }) {
  const [phase, setPhase] = useState("pick_type"); // pick_type | loading | countdown | recording | scoring | results
  const [selectedType, setSelectedType] = useState(null);
  const [question, setQuestion] = useState("");
  const [countdown, setCountdown] = useState(3); // initial 3-second display
  const [timer, setTimer] = useState(COUNTDOWN_SECS);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState(null);

  const recognitionRef = useRef(null);
  const liveRef = useRef("");
  const timerRef = useRef(null);

  // 3-second question display countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("recording");
      startMicRecording();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // 90-second response timer
  useEffect(() => {
    if (phase !== "recording") return;
    setTimer(COUNTDOWN_SECS);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          stopAndScore();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  async function handleTypeSelect(type) {
    setSelectedType(type);
    setPhase("loading");
    const starters = STARTER_QUESTIONS[type] || [];
    const fallback = starters[Math.floor(Math.random() * starters.length)];
    const q = await generateQuestion(type) || fallback;
    setQuestion(q);
    setCountdown(3);
    setPhase("countdown");
  }

  function startMicRecording() {
    liveRef.current = "";
    recognitionRef.current = startRecognition(
      (t) => { liveRef.current = t; setTranscript(t); },
      (final) => { liveRef.current = (final || liveRef.current).trim(); setTranscript(liveRef.current); }
    );
  }

  async function stopAndScore() {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop?.();
    const captured = liveRef.current.trim() || transcript.trim();
    if (!captured) {
      setResult({ score: 0, strength: "No response captured.", improvement: "Try speaking clearly into the microphone.", rootCause: "none" });
      setPhase("results");
      return;
    }
    setPhase("scoring");
    const scored = await scoreAnswer(question, captured);
    setResult(scored || { score: 1, strength: "Could not evaluate.", improvement: "Try again.", rootCause: "none" });
    setPhase("results");
  }

  function handleDone() {
    clearInterval(timerRef.current);
    recognitionRef.current?.stop?.();
    stopAndScore();
  }

  async function handleNextQuestion() {
    setTranscript("");
    liveRef.current = "";
    setResult(null);
    setPhase("loading");
    const starters = STARTER_QUESTIONS[selectedType] || [];
    const fallback = starters[Math.floor(Math.random() * starters.length)];
    const q = await generateQuestion(selectedType) || fallback;
    setQuestion(q);
    setCountdown(3);
    setPhase("countdown");
  }

  if (phase === "pick_type") {
    return (
      <div style={styles.container}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setCurrentScreen("interviewHome")} style={styles.backBtn}>← Back</button>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={styles.title}>Quick Drill</div>
          <div style={styles.subtitle}>One question, 90 seconds. Pure rapid-fire practice.</div>
        </div>
        <div style={styles.sectionLabel}>Pick question type</div>
        <div style={styles.typeGrid}>
          {QUESTION_TYPES.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTypeSelect(t.id)}
              style={{
                ...glassCard,
                padding: "16px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s",
                border: `1px solid ${t.color}33`,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "loading" || phase === "scoring") {
    return (
      <div style={styles.centeredContainer}>
        <div style={styles.spinner} />
        <div style={{ fontSize: 14, color: "#64748b" }}>
          {phase === "loading" ? "Generating question..." : "Scoring your answer..."}
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div style={styles.centeredContainer}>
        <div style={{ ...glassCard, padding: "24px 28px", textAlign: "center", maxWidth: 440, margin: "0 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
            Your question
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.6, marginBottom: 20 }}>
            {question}
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "#6366f1", lineHeight: 1 }}>{countdown}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Mic starts automatically</div>
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    const timerPct = Math.round((timer / COUNTDOWN_SECS) * 100);
    const timerColor = timer > 30 ? "#10b981" : timer > 10 ? "#f59e0b" : "#f43f5e";
    return (
      <div style={styles.container}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.6 }}>{question}</div>
          </div>

          {/* Timer bar */}
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 8 }}>
            <div style={{
              height: "100%",
              width: `${timerPct}%`,
              background: timerColor,
              borderRadius: 3,
              transition: "width 1s linear, background 0.3s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: timerColor }}>{timer}s</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Recording...</span>
          </div>
        </div>

        {transcript && (
          <div style={{ ...glassCard, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, fontStyle: "italic" }}>{transcript}</div>
          </div>
        )}

        <button onClick={handleDone} style={styles.primaryBtn}>
          Done — Score It →
        </button>
      </div>
    );
  }

  if (phase === "results" && result) {
    const rootCauseLabel = ROOT_CAUSE_LABELS[result.rootCause];
    const scoreColor = result.score >= 4 ? "#10b981" : result.score >= 3 ? "#f59e0b" : "#f43f5e";
    return (
      <div style={styles.container}>
        <div style={{ marginBottom: 20 }}>
          <div style={styles.title}>Quick Drill Results</div>
        </div>

        <div style={{ ...glassCard, padding: "24px 22px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: scoreColor, lineHeight: 1, marginBottom: 4 }}>
            {result.score}/5
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Overall score</div>
        </div>

        {result.strength && (
          <div style={{
            ...glassCard,
            padding: "16px 18px",
            marginBottom: 12,
            background: "rgba(16,185,129,0.05)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              What worked
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{result.strength}</div>
          </div>
        )}

        {result.improvement && (
          <div style={{
            ...glassCard,
            padding: "16px 18px",
            marginBottom: 12,
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Improve next time
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>{result.improvement}</div>
          </div>
        )}

        {rootCauseLabel && (
          <div style={{
            ...glassCard,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Pattern detected:</span>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              background: "rgba(245,158,11,0.12)",
              color: "#f59e0b",
            }}>
              {rootCauseLabel}
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handleNextQuestion} style={styles.primaryBtn}>
            Another question →
          </button>
          <button onClick={() => setCurrentScreen("interviewHome")} style={styles.secondaryBtn}>
            Back to Interview Home
          </button>
        </div>
      </div>
    );
  }

  return null;
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
    padding: "0 20px",
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
    gridTemplateColumns: "repeat(3, 1fr)",
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
  primaryBtn: {
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
  secondaryBtn: {
    width: "100%",
    padding: "14px",
    background: "rgba(255,255,255,0.06)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    boxSizing: "border-box",
  },
};
