import { useState, useEffect, useRef } from "react";
import { sendInterviewMessage, correctTranscript } from "../lib/openrouter.js";
import { startRecognition } from "../lib/speechRecognition.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";
import TalkingFace from "./TalkingFace.jsx";
import MicWaveform from "./MicWaveform.jsx";
import { cancelSpeech, unlockSpeech } from "../lib/speechSynthesis.js";
import { INTERVIEW_TYPES } from "../data/interviewers.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { addToQuestionHistory } from "../lib/questionHistory.js";

const MAX_TURNS = 5;

// ── Timeout helper ─────────────────────────────────────────────────────────────

function withTimeout(promise, ms, fallback) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  return Promise.race([promise, timeout]).catch(err => {
    if (err.message === "timeout" && fallback !== undefined) return fallback;
    throw err;
  });
}

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

// ── Clean interviewer text (strip meta-text) ──────────────────────────────────

function cleanInterviewerText(raw) {
  if (!raw) return "";
  return raw
    .split("###INTERVIEW_FEEDBACK###")[0]
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\*.*?\*/g, "")
    .replace(/^(waiting for|system:|note:|instruction:).*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, interviewer }) {
  const isInterviewer = message.role === "opponent";
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      justifyContent: isInterviewer ? "flex-start" : "flex-end",
      animation: "slideUp 0.2s ease",
    }}>
      {isInterviewer && (
        <div style={{ fontSize: 22, flexShrink: 0, alignSelf: "flex-end", lineHeight: 1 }}>
          {interviewer.avatar}
        </div>
      )}
      <div style={{
        padding: "11px 16px",
        borderRadius: isInterviewer ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        maxWidth: isInterviewer ? "80%" : "75%",
        background: isInterviewer
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))",
        border: isInterviewer
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(99,102,241,0.3)",
      }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#f1f5f9" }}>
          {message.text}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ interviewer }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      <div style={{ fontSize: 22, flexShrink: 0, alignSelf: "flex-end", lineHeight: 1 }}>
        {interviewer.avatar}
      </div>
      <div style={{ ...glassCard, padding: "12px 16px", borderRadius: "4px 16px 16px 16px" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              fontSize: 20,
              color: "#64748b",
              animation: "blink 1s infinite",
              animationDelay: `${i * 0.2}s`,
            }}>•</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TurnDots({ currentTurn, maxTurns }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: maxTurns }).map((_, i) => (
        <div key={i} style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: i < currentTurn
            ? "#6366f1"
            : i === currentTurn
              ? "rgba(99,102,241,0.5)"
              : "rgba(255,255,255,0.15)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InterviewScreen({
  user,
  interviewData,
  setCurrentScreen,
  setInterviewFeedback,
}) {
  const { interviewer, questionType, question } = interviewData || {};
  const questionTypeInfo = INTERVIEW_TYPES.find(t => t.id === questionType);

  const [messages, setMessages] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [micState, setMicState] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const [editTranscript, setEditTranscript] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [forceEnding, setForceEnding] = useState(false);
  const [error, setError] = useState(null);
  const [micSupported, setMicSupported] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [isCorrectingTranscript, setIsCorrectingTranscript] = useState(false);
  const [showSkipBtn, setShowSkipBtn] = useState(false);

  // Filler analysis
  const [fillerCounts, setFillerCounts] = useState({});
  const [topFiller, setTopFiller] = useState(null);
  const [topFillerCount, setTopFillerCount] = useState(0);

  // Highlight-to-lexicon
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState(null);
  const [savingToLexicon, setSavingToLexicon] = useState(false);
  const [lexiconSaveSuccess, setLexiconSaveSuccess] = useState(false);

  // TalkingFace state
  const [isSpeakingFace, setIsSpeakingFace] = useState(false);
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  const [voiceMuted, setVoiceMuted] = useState(false);

  const recordingStartRef = useRef(null);
  const sessionMetricsRef = useRef(null);
  const [processingPhase, setProcessingPhase] = useState("idle");
  // processingPhase: "idle" | "correcting" | "thinking" | "speaking"

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialised = useRef(false);
  const liveTranscriptRef = useRef("");
  const pendingFeedbackRef = useRef(false);
  const safetyTimerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    if (!supported) {
      setMicSupported(false);
      setMicState("nomic");
    }
  }, []);

  useEffect(() => () => cancelSpeech(), []);

  // Kick off: interviewer introduces themselves and asks the question
  useEffect(() => {
    if (hasInitialised.current) return;
    if (!interviewer || !question) return;
    hasInitialised.current = true;

    // Track this question in history for variety
    if (user?.uid && question) {
      addToQuestionHistory(user.uid, question.id || question.text?.slice(0, 30));
    }

    async function getOpener() {
      setIsTyping(true);
      try {
        const { reply } = await sendInterviewMessage(
          [],
          interviewer,
          question,
          questionType
        );
        const cleanReply = cleanInterviewerText(reply);
        setMessages([{ role: "opponent", text: cleanReply }]);
        setCurrentSpeechText(cleanReply);
        setIsSpeakingFace(true);

        // Save question to custom question bank for future reference
        if (user?.uid && question?.text) {
          addDoc(collection(db, "users", user.uid, "customQuestions"), {
            text: question.text,
            type: questionType || "behavioral",
            source: "interview_session",
            company: question.company || "",
            addedAt: new Date().toISOString(),
            attempts: 0,
            bestScore: null,
          }).catch(() => {}); // fire-and-forget
        }
      } catch (err) {
        console.error("Interview opener error:", err);
        const fallback = `Hi, I'm ${interviewer.name}. Let's get started. ${question.text}`;
        setMessages([{ role: "opponent", text: fallback }]);
        setCurrentSpeechText(fallback);
        setIsSpeakingFace(true);
      } finally {
        setIsTyping(false);
      }
    }

    getOpener();
  }, [interviewer, question, questionType]);

  // ── Mic handling ────────────────────────────────────────────────────────────

  function handleMicClick() {
    unlockSpeech(); // prime iOS audio session on user gesture (must be synchronous)
    if (micState !== "idle") return;
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    setMicState("recording");

    recordingStartRef.current = Date.now();
    recognitionRef.current = startRecognition(
      (transcript) => {
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
      },
      (finalText) => {
        const captured = (finalText || liveTranscriptRef.current).trim();
        if (!captured) {
          setMicSupported(false);
          setMicState("nomic");
          setError("Voice not captured. Type your response below.");
          return;
        }
        // Calculate WPM from this recording
        const durationMs = Date.now() - (recordingStartRef.current || Date.now());
        const wordCount = captured.trim().split(/\s+/).filter(Boolean).length;
        const wpm = durationMs > 2000 ? Math.round((wordCount / durationMs) * 60000) : null;
        sessionMetricsRef.current = { wpm, totalWords: wordCount };

        setConfirmedTranscript(captured);
        setMicState("confirming");
        setProcessingPhase("correcting");
        setIsCorrectingTranscript(true);

        const context = messages.slice(-2).map(m => `${m.role}: ${m.text}`).join(" | ");
        correctTranscript(captured, context, question?.text || "")
          .then(corrected => setConfirmedTranscript(corrected))
          .finally(() => { setIsCorrectingTranscript(false); setProcessingPhase("idle"); });
      }
    );

    if (recognitionRef.current && !recognitionRef.current.supported) {
      setMicSupported(false);
      setMicState("nomic");
      setError("Microphone not supported. Type your response below.");
    }
  }

  function handleStopRecording() {
    recognitionRef.current?.stop?.();
    if (liveTranscript) {
      setConfirmedTranscript(liveTranscript);
      setMicState("confirming");
    } else {
      setMicState("idle");
    }
  }

  function handleConfirm() {
    const text = confirmedTranscript.trim();
    if (!text) return;
    submitTurn(text);
  }

  function handleTextSubmit() {
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    submitTurn(text);
  }

  // ── Highlight-to-lexicon ────────────────────────────────────────────────────

  function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2 && text.length < 200) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    } else {
      setSelectedText("");
      setSelectionPos(null);
    }
  }

  // ── Core turn logic ─────────────────────────────────────────────────────────

  async function submitTurn(userText) {
    if (sessionComplete) return;

    setMicState("sending");
    setProcessingPhase("thinking");
    setLiveTranscript("");
    setConfirmedTranscript("");
    setIsEditing(false);

    const newTurn = currentTurn + 1;
    setCurrentTurn(newTurn);

    const userMessage = { role: "user", text: userText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    const apiMessages = updatedMessages.map(m => ({
      role: m.role === "opponent" ? "assistant" : "user",
      content: m.text,
    }));

    setIsTyping(true);
    try {
      const { reply, interviewFeedback } = await withTimeout(
        sendInterviewMessage(apiMessages, interviewer, question, questionType, sessionMetricsRef.current),
        28000,
        null
      );
      if (!reply && !interviewFeedback) {
        throw new Error("Request timed out — please try again.");
      }

      setProcessingPhase("speaking");
      const cleanReply = cleanInterviewerText(reply);

      if (cleanReply) {
        setMessages(prev => [...prev, { role: "opponent", text: cleanReply }]);
        setCurrentSpeechText(cleanReply);
        setIsSpeakingFace(true);
      }

      // Only process feedback if we have at least 3 turns (prevents AI from ending too early)
      if (interviewFeedback && newTurn >= 3) {
        setSessionComplete(true);

        const sessionDoc = {
          ...interviewFeedback,
          interviewerId: interviewer.id,
          interviewerName: interviewer.name,
          questionType,
          questionText: question.text,
          questionId: question.id,
          company: question.company,
          transcript: updatedMessages
            .filter(m => m.role === "user")
            .map(m => m.text)
            .join(" "),
          conversationLog: updatedMessages,
          wpm: sessionMetricsRef.current?.wpm || null,
          date: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString(),
          uid: user.uid,
        };
        setInterviewFeedback({ ...sessionDoc, fillerCounts }); // SET FIRST

        // Save to Firestore in background (non-blocking)
        addDoc(collection(db, "users", user.uid, "interviewSessions"), {
          ...sessionDoc,
          savedAt: serverTimestamp(),
        }).catch(err => console.error("Failed to save interview session:", err));

        // Navigate after speech ends
        pendingFeedbackRef.current = true;

        // Safety timeout — if speech never ends, force navigate after 5s
        safetyTimerRef.current = setTimeout(() => {
          if (pendingFeedbackRef.current) {
            pendingFeedbackRef.current = false;
            setCurrentScreen("interviewFeedback");
          }
        }, 5000);

        // Show skip button after 2s in case speech doesn't start
        setTimeout(() => setShowSkipBtn(true), 2000);

        if (!cleanReply || voiceMuted) {
          setTimeout(() => setCurrentScreen("interviewFeedback"), 1000);
        }
      } else if (!interviewFeedback || newTurn < 3) {
        setProcessingPhase("idle");
        setMicState("idle");
      }
    } catch (err) {
      console.error("Interview message error:", err);
      setError("Something went wrong. Please try again.");
      setMicState("idle");
      setProcessingPhase("idle");
    } finally {
      setIsTyping(false);
    }
  }

  // ── Force end ───────────────────────────────────────────────────────────────

  async function handleForceEnd() {
    if (forceEnding || sessionComplete) return;
    setForceEnding(true);

    const apiMessages = messages.map(m => ({
      role: m.role === "opponent" ? "assistant" : "user",
      content: m.text,
    }));
    apiMessages.push({
      role: "user",
      content: "[Candidate ended the interview early. Please give a brief closing remark and generate the ###INTERVIEW_FEEDBACK### block now.]"
    });

    setMicState("sending");
    setIsTyping(true);
    try {
      const result = await withTimeout(
        sendInterviewMessage(apiMessages, interviewer, question, questionType),
        28000,
        null
      );
      const { reply, interviewFeedback: fb } = result || {};
      const cleanReply = cleanInterviewerText(reply);
      if (cleanReply) {
        setMessages(prev => [...prev, { role: "opponent", text: cleanReply }]);
      }
      const feedbackData = fb || {
        productSense: 3, analytical: 3, execution: 3, communication: 3, leadership: 3,
        verdict: "No Hire", verdictReason: "Session ended early — not enough data to evaluate.",
        strongestMoment: "", lostInterviewerAt: "Session ended early.",
        sampleStrongAnswer: "", improve1: "Complete full sessions for better evaluation.",
        improve2: "", improve3: "", innerMonologue: ["","","","",""], rootCause: "none",
        rootCauseExplanation: "", rootCauseFix: "",
      };

      const sessionDoc = {
        ...feedbackData,
        interviewerId: interviewer.id,
        interviewerName: interviewer.name,
        questionType,
        questionText: question.text,
        questionId: question.id,
        transcript: messages.filter(m => m.role === "user").map(m => m.text).join(" "),
        conversationLog: messages,
        wpm: sessionMetricsRef.current?.wpm || null,
        date: new Date().toISOString().slice(0, 10),
        uid: user.uid,
      };
      setInterviewFeedback({ ...sessionDoc, fillerCounts });
      setSessionComplete(true);
      addDoc(collection(db, "users", user.uid, "interviewSessions"), { ...sessionDoc, savedAt: serverTimestamp() }).catch(() => {});

      pendingFeedbackRef.current = true;
      safetyTimerRef.current = setTimeout(() => {
        pendingFeedbackRef.current = false;
        setCurrentScreen("interviewFeedback");
      }, 5000);
      setTimeout(() => setShowSkipBtn(true), 1500);
      if (!cleanReply || voiceMuted) {
        setTimeout(() => setCurrentScreen("interviewFeedback"), 800);
      }
    } catch (err) {
      console.error("Force end error:", err);
      setForceEnding(false);
      setMicState("idle");
    } finally {
      setIsTyping(false);
    }
  }

  // ── Render guard ────────────────────────────────────────────────────────────

  if (!interviewData || !interviewer || !question) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        <p>No interview data found.</p>
        <button onClick={() => setCurrentScreen("interviewHome")} style={{
          background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 14,
        }}>
          ← Back
        </button>
      </div>
    );
  }

  const turnsLeft = MAX_TURNS - currentTurn;
  const showMicSection = !sessionComplete;

  return (
    <div style={styles.container} onClick={() => { setSelectedText(""); setSelectionPos(null); }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <TalkingFace
            opponentId={interviewer.id}
            opponent={interviewer}
            isSpeaking={isSpeakingFace}
            text={currentSpeechText}
            onSpeechEnd={() => {
              setIsSpeakingFace(false);
              setProcessingPhase("idle");
              if (pendingFeedbackRef.current) {
                pendingFeedbackRef.current = false;
                clearTimeout(safetyTimerRef.current);
                setTimeout(() => setCurrentScreen("interviewFeedback"), 800);
              }
            }}
            muted={voiceMuted}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{interviewer.name}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{interviewer.role}</div>
            <div style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: interviewer.aggression === "high"
                ? "rgba(244,63,94,0.12)"
                : "rgba(245,158,11,0.12)",
              color: interviewer.aggression === "high" ? "#f43f5e" : "#f59e0b",
              textTransform: "capitalize",
              alignSelf: "flex-start",
            }}>
              {interviewer.aggression}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => { setVoiceMuted(m => !m); cancelSpeech(); setIsSpeakingFace(false); }}
              style={styles.muteButton}
              title={voiceMuted ? "Unmute voice" : "Mute voice"}
            >
              {voiceMuted ? "🔇" : "🔊"}
            </button>
            <div style={styles.turnBadge}>
              {sessionComplete ? "Done" : `${Math.min(currentTurn + 1, MAX_TURNS)}/${MAX_TURNS}`}
            </div>
          </div>
          <TurnDots currentTurn={currentTurn} maxTurns={MAX_TURNS} />
        </div>
      </div>

      {/* Think aloud banner */}
      <div style={styles.thinkBanner}>
        💭 Think aloud — narrate your reasoning as you go
      </div>

      {/* Framework hint pills */}
      {questionTypeInfo && (
        <div style={styles.frameworkRow}>
          <span style={styles.frameworkLabel}>Frameworks:</span>
          {questionTypeInfo.frameworks.map((fw) => (
            <span key={fw} style={styles.frameworkPill}>{fw}</span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        style={styles.messagesContainer}
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} interviewer={interviewer} />
        ))}
        {processingPhase !== "idle" && !sessionComplete && (() => {
          const PHASE_CONFIG = {
            correcting: { icon: "✨", text: "Processing audio...", color: "#f59e0b" },
            thinking:   { icon: "💭", text: "AI thinking...",      color: "#8b5cf6" },
            speaking:   { icon: "🔊", text: "Responding...",       color: "#3b82f6" },
          };
          const cfg = PHASE_CONFIG[processingPhase];
          if (!cfg) return null;
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${cfg.color}33`,
              marginBottom: 8, alignSelf: "flex-start",
              fontSize: 12, color: cfg.color, fontWeight: 600,
            }}>
              <span>{cfg.icon}</span>
              <span>{cfg.text}</span>
              <span style={{ animation: "blink 1s infinite" }}>●</span>
            </div>
          );
        })()}
        {isTyping && <TypingIndicator interviewer={interviewer} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / mic section */}
      {showMicSection && (
        <div style={styles.micPanel}>
          {error && (
            <div style={styles.errorBanner}>
              <span>{error}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => {
                    setError(null);
                    setMicState("idle");
                    setProcessingPhase("idle");
                    setIsTyping(false);
                  }}
                  style={{
                    background: "rgba(99,102,241,0.2)",
                    border: "1px solid rgba(99,102,241,0.4)",
                    borderRadius: 8,
                    color: "#a5b4fc",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
                <button onClick={() => setError(null)} style={styles.errorDismiss}>✕</button>
              </div>
            </div>
          )}

          {micState === "recording" && topFiller && topFillerCount > 0 && (
            <div style={styles.fillerPill}>{topFiller} ×{topFillerCount}</div>
          )}

          {micState === "recording" && liveTranscript && (
            <div style={styles.liveTranscriptBox}>
              <div style={styles.liveLabel}>Listening...</div>
              <p style={styles.liveText}>{liveTranscript}</p>
            </div>
          )}

          {micState === "confirming" && !isEditing && (
            <div style={styles.confirmBox}>
              <p style={styles.confirmLabel}>
                {isCorrectingTranscript ? "✦ Cleaning up..." : "WHAT YOU SAID:"}
              </p>
              <p style={{ ...styles.confirmText, opacity: isCorrectingTranscript ? 0.6 : 1 }}>
                {confirmedTranscript}
              </p>
              {!isCorrectingTranscript && (
                <div style={styles.confirmBtns}>
                  <button onClick={() => { setIsEditing(true); setEditTranscript(confirmedTranscript); }} style={styles.editBtn}>Edit</button>
                  <button onClick={handleConfirm} style={styles.confirmBtn}>Looks good →</button>
                </div>
              )}
            </div>
          )}

          {micState === "confirming" && isEditing && (
            <div style={styles.editBox}>
              <div style={styles.editLabel}>Edit your response:</div>
              <textarea
                value={editTranscript}
                onChange={e => setEditTranscript(e.target.value)}
                rows={4}
                style={styles.editTextarea}
                autoFocus
              />
              <button onClick={() => { setIsEditing(false); submitTurn(editTranscript.trim()); }} style={styles.confirmBtn}>
                Send this →
              </button>
            </div>
          )}

          {micState === "sending" && (
            <div style={styles.sendingBox}>
              <div style={styles.sendingSpinner} />
              <span style={styles.sendingText}>Thinking...</span>
            </div>
          )}

          {micState === "idle" && !isTyping && messages.length > 0 && (
            <div style={styles.idleMicArea}>
              <div style={styles.idleRow}>
                <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button onClick={handleMicClick} style={{ ...styles.micButton, opacity: processingPhase !== "idle" ? 0.5 : 1 }} disabled={processingPhase !== "idle"}>🎤</button>
                </div>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>or</div>
                <button onClick={() => setMicState("nomic")} style={styles.typeToggleBtn}>
                  <span style={{ fontSize: 22 }}>⌨️</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Type</span>
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, textAlign: "center" }}>
                {turnsLeft} turn{turnsLeft !== 1 ? "s" : ""} left
              </div>
              {currentTurn >= 2 && !forceEnding && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button
                    onClick={handleForceEnd}
                    style={{
                      background: "none", border: "none", color: "#475569",
                      fontSize: 12, cursor: "pointer", textDecoration: "underline",
                      textDecorationStyle: "dashed", padding: "4px 0",
                    }}
                  >
                    End interview & get feedback →
                  </button>
                </div>
              )}
            </div>
          )}

          {micState === "recording" && (
            <div style={styles.recordingArea}>
              <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={styles.recordingRingOuter} />
                <div style={styles.recordingRingInnerOuter} />
                <button onClick={handleStopRecording} style={styles.recordingButton}>🎤</button>
              </div>
              <MicWaveform isRecording={true} />
              <div style={styles.recordingLabel}>Recording... tap to stop</div>
            </div>
          )}

          {micState === "nomic" && !isTyping && messages.length > 0 && (
            <div style={styles.textInputArea}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{turnsLeft} turn{turnsLeft !== 1 ? "s" : ""} left</span>
                {micSupported && (
                  <button onClick={() => { setError(null); setMicState("idle"); }} style={styles.useMicBtn}>
                    🎤 Use mic
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your response here... (Ctrl+Enter to send)"
                  rows={3}
                  style={styles.textInputBox}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleTextSubmit();
                  }}
                />
              </div>
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                style={{
                  ...styles.sendTextFullBtn,
                  opacity: textInput.trim() ? 1 : 0.4,
                  cursor: textInput.trim() ? "pointer" : "default",
                }}
              >
                Send →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Complete overlay */}
      {sessionComplete && (
        <div style={styles.completeOverlay}>
          <div style={styles.completeSpinner} />
          <div style={styles.completeText}>Preparing your debrief...</div>
          {showSkipBtn && (
            <button onClick={() => { pendingFeedbackRef.current = false; setCurrentScreen("interviewFeedback"); }}
              style={{ marginTop: 16, padding: "10px 24px", background: "#6366f1", color: "#fff",
                       border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
              Go to feedback →
            </button>
          )}
        </div>
      )}

      {/* Highlight-to-lexicon floating button */}
      {selectedText && selectionPos && !savingToLexicon && !lexiconSaveSuccess && (
        <button
          onMouseDown={async (e) => {
            e.preventDefault();
            setSavingToLexicon(true);
            try {
              const { enrichExpression } = await import("../lib/openrouter.js");
              const enriched = await enrichExpression(selectedText);
              await addDoc(collection(db, "users", user.uid, "lexicon"), {
                text: selectedText,
                source: "interview",
                savedAt: serverTimestamp(),
                enriched: enriched || {},
                status: "new",
                usedInBattles: 0,
              });
              setLexiconSaveSuccess(true);
              setSelectedText("");
              setSelectionPos(null);
              setTimeout(() => setLexiconSaveSuccess(false), 2500);
            } catch (err) {
              console.error("Lexicon save error:", err);
            } finally {
              setSavingToLexicon(false);
            }
          }}
          style={{
            position: "fixed",
            left: Math.min(selectionPos.x - 80, window.innerWidth - 180),
            top: Math.max(selectionPos.y - 44, 8),
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

      {lexiconSaveSuccess && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#10b981", color: "#fff", borderRadius: 20,
          padding: "10px 20px", fontSize: 14, fontWeight: 600, zIndex: 9999,
        }}>
          ✓ Saved to Lexicon
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "rgba(6,8,24,0.8)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
    zIndex: 10,
    minHeight: 170,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  turnBadge: {
    fontSize: 12,
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    padding: "4px 12px",
    borderRadius: 20,
    fontWeight: 700,
  },
  muteButton: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 16,
    cursor: "pointer",
    color: "#f1f5f9",
    lineHeight: 1,
  },
  thinkBanner: {
    background: "rgba(6,182,212,0.06)",
    border: "none",
    borderBottom: "1px solid rgba(6,182,212,0.15)",
    padding: "8px 16px",
    fontSize: 12,
    color: "#06b6d4",
    fontWeight: 600,
    flexShrink: 0,
  },
  frameworkRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  frameworkLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginRight: 2,
  },
  frameworkPill: {
    fontSize: 10,
    fontWeight: 600,
    color: "#818cf8",
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 10,
    padding: "2px 8px",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  micPanel: {
    flexShrink: 0,
    background: "rgba(6,8,24,0.85)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 20px 28px",
  },
  errorBanner: {
    background: "rgba(244,63,94,0.1)",
    border: "1px solid rgba(244,63,94,0.3)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "#f43f5e",
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  errorDismiss: {
    background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: 14, padding: 0,
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
    marginBottom: 10,
  },
  liveTranscriptBox: {
    ...glassCard,
    padding: "10px 14px",
    marginBottom: 10,
  },
  liveLabel: {
    fontSize: 11, color: "#f43f5e", fontWeight: 700, marginBottom: 4,
    textTransform: "uppercase", letterSpacing: "0.8px",
  },
  liveText: {
    margin: 0, fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, fontStyle: "italic",
  },
  confirmBox: {
    ...glassCard,
    padding: "14px 16px",
    marginBottom: 10,
  },
  confirmLabel: {
    fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.8px",
  },
  confirmText: {
    margin: "0 0 14px", fontSize: 14, color: "#f1f5f9", lineHeight: 1.5, transition: "opacity 0.3s",
  },
  confirmBtns: { display: "flex", gap: 10 },
  editBtn: {
    flex: 1, padding: "11px", background: "rgba(255,255,255,0.06)", color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  confirmBtn: {
    flex: 2, padding: "11px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  editBox: { marginBottom: 10 },
  editLabel: {
    fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.8px",
  },
  editTextarea: {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: 12, color: "#f1f5f9", fontSize: 14, lineHeight: 1.5,
    resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10,
  },
  sendingBox: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 0",
  },
  sendingSpinner: {
    width: 18, height: 18, borderRadius: "50%",
    border: "2px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  sendingText: { fontSize: 14, color: "#64748b", fontStyle: "italic" },
  idleMicArea: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 4,
  },
  idleRow: { display: "flex", alignItems: "center", gap: 16 },
  typeToggleBtn: {
    width: 64, height: 64, borderRadius: "50%",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 2, color: "#94a3b8",
  },
  micButton: {
    width: 80, height: 80, borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none",
    fontSize: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    animation: "breathe 3s ease-in-out infinite",
    boxShadow: "0 0 32px rgba(99,102,241,0.35)", position: "relative", zIndex: 1,
  },
  recordingArea: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 4,
  },
  recordingRingOuter: {
    position: "absolute", inset: -12, borderRadius: "50%",
    border: "2px solid rgba(244,63,94,0.5)", animation: "pulse-ring 1.2s ease-out infinite",
  },
  recordingRingInnerOuter: {
    position: "absolute", inset: -6, borderRadius: "50%",
    border: "2px solid rgba(244,63,94,0.35)",
    animation: "pulse-ring 1.2s ease-out infinite", animationDelay: "0.5s",
  },
  recordingButton: {
    width: 80, height: 80, borderRadius: "50%",
    background: "linear-gradient(135deg, #f43f5e, #e11d48)", border: "none",
    fontSize: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 0 32px rgba(244,63,94,0.4)", position: "relative", zIndex: 1,
  },
  recordingLabel: { fontSize: 13, color: "#f43f5e", fontWeight: 600, textAlign: "center" },
  textInputArea: { display: "flex", flexDirection: "column", gap: 10 },
  useMicBtn: {
    background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 20, color: "#818cf8", fontSize: 12, fontWeight: 600,
    padding: "4px 12px", cursor: "pointer",
  },
  textInputBox: {
    flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 14,
    lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit",
    boxSizing: "border-box", width: "100%",
  },
  sendTextFullBtn: {
    width: "100%", padding: "13px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    boxSizing: "border-box",
  },
  completeOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    background: "rgba(6,8,24,0.92)", padding: 24, textAlign: "center",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  completeSpinner: {
    width: 28, height: 28, borderRadius: "50%",
    border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  completeText: { fontSize: 15, color: "#6366f1", fontWeight: 600 },
};
