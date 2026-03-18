import { useState, useEffect, useRef } from "react";
import { sendBattleMessage } from "../lib/openrouter.js";
import { startRecognition } from "../lib/speechRecognition.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";

const MAX_TURNS = 3;

const glassCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
};

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message, opponent }) {
  const isOpponent = message.role === "opponent";
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      justifyContent: isOpponent ? "flex-start" : "flex-end",
      animation: "slideUp 0.2s ease",
    }}>
      {isOpponent && (
        <div style={styles.opponentAvatarSmall}>{opponent.avatar}</div>
      )}
      <div style={{
        padding: "11px 16px",
        borderRadius: isOpponent ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        maxWidth: isOpponent ? "80%" : "75%",
        background: isOpponent
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))",
        border: isOpponent
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(99,102,241,0.3)",
      }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: "#f1f5f9",
        }}>{message.text}</p>
      </div>
    </div>
  );
}

function TypingIndicator({ opponent }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      <div style={styles.opponentAvatarSmall}>{opponent.avatar}</div>
      <div style={{
        ...glassCard,
        padding: "12px 16px",
        borderRadius: "4px 16px 16px 16px",
      }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ ...styles.dot, animationDelay: "0s" }}>•</span>
          <span style={{ ...styles.dot, animationDelay: "0.2s" }}>•</span>
          <span style={{ ...styles.dot, animationDelay: "0.4s" }}>•</span>
        </div>
      </div>
    </div>
  );
}

// ── Turn dots ─────────────────────────────────────────────────────────────

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

// ── Animated Opponent Avatar ──────────────────────────────────────────────

function AnimatedOpponent({ emoji, name, role, isTyping }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <style>{`
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
        @keyframes voiceBar1 {
          0%, 100% { height: 4px; } 50% { height: 16px; }
        }
        @keyframes voiceBar2 {
          0%, 100% { height: 8px; } 50% { height: 20px; }
        }
        @keyframes voiceBar3 {
          0%, 100% { height: 4px; } 50% { height: 12px; }
        }
      `}</style>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
        animation: isTyping ? "avatarPulse 1.2s ease-in-out infinite" : "none",
        transition: "box-shadow 0.3s",
      }}>{emoji}</div>
      {isTyping && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24 }}>
          {[
            { anim: "voiceBar1 0.8s ease-in-out infinite" },
            { anim: "voiceBar2 0.8s ease-in-out 0.15s infinite" },
            { anim: "voiceBar3 0.8s ease-in-out 0.3s infinite" },
          ].map((b, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 2,
              background: "#6366f1",
              animation: b.anim,
            }} />
          ))}
        </div>
      )}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{role}</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function BattleScreen({
  user,
  opponent,
  scenario,
  outline,
  coachingProfile,
  setCurrentScreen,
  setSessionData,
}) {
  const [messages, setMessages] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [micState, setMicState] = useState("idle"); // idle | recording | confirming | sending | nomic
  const [liveTranscript, setLiveTranscript] = useState("");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const [editTranscript, setEditTranscript] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState(null);

  // Real-time filler analysis on live transcript
  const [fillerCounts, setFillerCounts] = useState({});
  const [topFiller, setTopFiller] = useState(null);
  const [topFillerCount, setTopFillerCount] = useState(0);

  const [micSupported, setMicSupported] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [showFrameworkExpanded, setShowFrameworkExpanded] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialised = useRef(false);
  const liveTranscriptRef = useRef(""); // tracks transcript in callbacks (avoids stale closure)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpponentTyping]);

  // Detect mic support on mount
  useEffect(() => {
    const supported =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    if (!supported) {
      setMicSupported(false);
      setMicState("nomic");
    }
  }, []);

  // Kick off the session: get the opponent's first line
  useEffect(() => {
    if (hasInitialised.current) return;
    if (!opponent || !scenario) return;
    hasInitialised.current = true;

    async function getOpenerLine() {
      setIsOpponentTyping(true);
      try {
        const systemHint = {
          targetInstruction: "",
          frameworkInstruction: scenario.suggestedFramework
            ? `The suggested framework for this scenario is ${scenario.suggestedFramework}. You may mention it gently after the user's first response if they don't use it.`
            : "",
          midCoachInstruction: outline
            ? `The user has prepared this outline: "${outline}". You don't know this — it's their private prep.`
            : "",
        };
        const { reply } = await sendBattleMessage(
          [],
          opponent,
          scenario,
          systemHint,
          coachingProfile
        );
        const cleanReply = reply.split("###FEEDBACK###")[0].trim();
        setMessages([{ role: "opponent", text: cleanReply }]);
      } catch (err) {
        console.error("Opener error:", err);
        setMessages([{ role: "opponent", text: scenario.text }]);
      } finally {
        setIsOpponentTyping(false);
      }
    }

    getOpenerLine();
  }, [opponent, scenario, outline]);

  // ── Mic handling ────────────────────────────────────────────────────────

  function handleMicClick() {
    if (micState !== "idle") return;

    liveTranscriptRef.current = "";
    setLiveTranscript("");
    setMicState("recording");

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
        // onEnd fires when user taps stop (or a real error occurs)
        const captured = finalText || liveTranscriptRef.current;
        if (captured.trim()) {
          setConfirmedTranscript(captured.trim());
          setMicState("confirming");
        } else {
          // Nothing captured — browser likely doesn't support mic or permission was denied
          // Auto-switch to text input with a clear message
          setMicSupported(false);
          setMicState("nomic");
          setError("Voice not captured. Type your response below — this browser may not support the microphone.");
        }
      }
    );

    if (recognitionRef.current && !recognitionRef.current.supported) {
      setMicSupported(false);
      setMicState("nomic");
      setError("Microphone not supported in this browser. Type your response below.");
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
    submitUserTurn(text);
  }

  function handleEdit() {
    setEditTranscript(confirmedTranscript);
    setIsEditing(true);
  }

  function handleEditConfirm() {
    const text = editTranscript.trim();
    if (!text) return;
    setIsEditing(false);
    submitUserTurn(text);
  }

  function handleTextSubmit() {
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    submitUserTurn(text);
  }

  // ── Core turn logic ──────────────────────────────────────────────────────

  async function submitUserTurn(userText) {
    if (sessionComplete) return;

    setMicState("sending");
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

    setIsOpponentTyping(true);
    try {
      const { reply, feedbackBlock } = await sendBattleMessage(
        apiMessages,
        opponent,
        scenario,
        {
          frameworkInstruction: scenario.suggestedFramework
            ? `Suggested framework: ${scenario.suggestedFramework}`
            : "",
        },
        coachingProfile
      );

      const cleanReply = reply.split("###FEEDBACK###")[0].trim();

      if (cleanReply) {
        setMessages(prev => [...prev, { role: "opponent", text: cleanReply }]);
      }

      if (feedbackBlock) {
        setSessionComplete(true);

        const sessionDataObj = {
          ...feedbackBlock,
          opponentId: opponent.id,
          opponentName: opponent.name,
          scenarioId: scenario.id,
          scenarioText: scenario.text,
          situationType: scenario.situationType,
          fillerCounts,
          transcript: updatedMessages
            .filter(m => m.role === "user")
            .map(m => m.text)
            .join(" "),
          date: new Date().toISOString().slice(0, 10),
          timestamp: new Date().toISOString(),
          uid: user.uid,
        };

        setSessionData(sessionDataObj);

        setTimeout(() => {
          setCurrentScreen("feedback");
        }, 1800);
      } else {
        setMicState("idle");
      }
    } catch (err) {
      console.error("Battle message error:", err);
      setError("Something went wrong. Please try again.");
      setMicState("idle");
    } finally {
      setIsOpponentTyping(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!opponent || !scenario) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>No battle data found.</p>
        <button onClick={() => setCurrentScreen("home")} style={styles.linkBtn}>
          ← Home
        </button>
      </div>
    );
  }

  const turnsLeft = MAX_TURNS - currentTurn;
  const showMicSection = !sessionComplete;

  return (
    <div style={styles.container}>
      {/* Glass header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <AnimatedOpponent
            emoji={opponent.avatar}
            name={opponent.name}
            role={opponent.role}
            isTyping={isOpponentTyping}
          />
        </div>
        <TurnDots currentTurn={currentTurn} maxTurns={MAX_TURNS} />
        <div style={styles.turnBadge}>
          {sessionComplete ? "Done" : `${Math.min(currentTurn + 1, MAX_TURNS)}/${MAX_TURNS}`}
        </div>
      </div>

      {/* Framework hint pill */}
      {scenario.suggestedFramework && (
        <div style={{ padding: "6px 20px 0", flexShrink: 0 }}>
          <button
            onClick={() => {
              setShowFrameworkExpanded(v => {
                if (!v) {
                  setTimeout(() => setShowFrameworkExpanded(false), 3000);
                }
                return !v;
              });
            }}
            style={{
              background: showFrameworkExpanded ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 20,
              color: "#818cf8",
              fontSize: 12,
              fontWeight: 700,
              padding: "5px 14px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <span>💡 {scenario.suggestedFramework}</span>
            {showFrameworkExpanded && (() => {
              const frameworkDescriptions = {
                PREP: "Point → Reason → Example → Point",
                STAR: "Situation → Task → Action → Result",
                PSB: "Problem → Solution → Benefit",
                CAR: "Context → Action → Result",
              };
              const desc = frameworkDescriptions[scenario.suggestedFramework];
              return desc ? <span style={{ fontWeight: 400, color: "#94a3b8" }}>· {desc}</span> : null;
            })()}
          </button>
        </div>
      )}

      {/* Messages — scrollable */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} opponent={opponent} />
        ))}
        {isOpponentTyping && <TypingIndicator opponent={opponent} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / mic section — fixed bottom */}
      {showMicSection && (
        <div style={styles.micPanel}>
          {error && (
            <div style={styles.errorBanner}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={styles.errorDismiss}>✕</button>
            </div>
          )}

          {/* Filler pill */}
          {micState === "recording" && topFiller && topFillerCount > 0 && (
            <div style={styles.fillerPill}>
              {topFiller} ×{topFillerCount}
            </div>
          )}

          {/* Live transcript */}
          {micState === "recording" && liveTranscript && (
            <div style={styles.liveTranscriptBox}>
              <div style={styles.liveLabel}>Listening...</div>
              <p style={styles.liveText}>{liveTranscript}</p>
            </div>
          )}

          {/* Confirm state */}
          {micState === "confirming" && !isEditing && (
            <div style={styles.confirmBox}>
              <div style={styles.confirmLabel}>What you said:</div>
              <p style={styles.confirmText}>{confirmedTranscript}</p>
              <div style={styles.confirmBtns}>
                <button onClick={handleEdit} style={styles.editBtn}>Edit</button>
                <button onClick={handleConfirm} style={styles.confirmBtn}>Looks good →</button>
              </div>
            </div>
          )}

          {/* Edit state */}
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
              <button onClick={handleEditConfirm} style={styles.confirmBtn}>
                Send this →
              </button>
            </div>
          )}

          {/* Sending indicator */}
          {micState === "sending" && (
            <div style={styles.sendingBox}>
              <div style={styles.sendingSpinner} />
              <span style={styles.sendingText}>Processing...</span>
            </div>
          )}

          {/* Idle — mic button + text toggle */}
          {micState === "idle" && !isOpponentTyping && messages.length > 0 && (
            <div style={styles.idleMicArea}>
              <div style={styles.idleRow}>
                <div style={styles.micButtonWrapper}>
                  <button onClick={handleMicClick} style={styles.micButton}>
                    🎤
                  </button>
                </div>
                <div style={styles.idleDivider}>or</div>
                <button onClick={() => setMicState("nomic")} style={styles.typeToggleBtn}>
                  <span style={{ fontSize: 22 }}>⌨️</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Type</span>
                </button>
              </div>
              <div style={styles.tapToSpeakLabel}>
                {turnsLeft} turn{turnsLeft !== 1 ? "s" : ""} left
              </div>
            </div>
          )}

          {/* Recording active */}
          {micState === "recording" && (
            <div style={styles.recordingArea}>
              <div style={styles.recordingRingWrapper}>
                <div style={styles.recordingRingOuter} />
                <div style={styles.recordingRingInnerOuter} />
                <button onClick={handleStopRecording} style={styles.recordingButton}>
                  🎤
                </button>
              </div>
              <div style={styles.recordingLabel}>Recording... tap to stop</div>
            </div>
          )}

          {/* No mic / text input */}
          {micState === "nomic" && !isOpponentTyping && messages.length > 0 && (
            <div style={styles.textInputArea}>
              <div style={styles.textInputHeader}>
                <span style={styles.turnsLeftText}>
                  {turnsLeft} turn{turnsLeft !== 1 ? "s" : ""} left
                </span>
                {micSupported && (
                  <button onClick={() => { setError(null); setMicState("idle"); }} style={styles.useMicBtn}>
                    🎤 Use mic
                  </button>
                )}
              </div>
              <div style={styles.textInputRow}>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Type your response here... (Ctrl+Enter to send)"
                  rows={3}
                  style={styles.textInputBox}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      handleTextSubmit();
                    }
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

      {/* Session complete overlay */}
      {sessionComplete && (
        <div style={styles.completeOverlay}>
          <div style={styles.completeSpinner} />
          <div style={styles.completeText}>Analysing your performance...</div>
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
  errorText: { color: "#94a3b8", fontSize: 15 },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "underline",
  },
  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "rgba(6,8,24,0.8)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    fontSize: 28,
  },
  headerName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  headerRole: {
    fontSize: 11,
    color: "#64748b",
  },
  turnBadge: {
    fontSize: 12,
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    padding: "4px 12px",
    borderRadius: 20,
    fontWeight: 700,
  },
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  opponentAvatarSmall: {
    fontSize: 22,
    flexShrink: 0,
    alignSelf: "flex-end",
    lineHeight: 1,
  },
  dot: {
    fontSize: 20,
    color: "#64748b",
    animationName: "blink",
    animationDuration: "1s",
    animationIterationCount: "infinite",
  },
  // Mic panel
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
    background: "none",
    border: "none",
    color: "#f43f5e",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
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
    fontSize: 11,
    color: "#f43f5e",
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  liveText: {
    margin: 0,
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  // Confirm
  confirmBox: {
    ...glassCard,
    padding: "14px 16px",
    marginBottom: 10,
  },
  confirmLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 6,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  confirmText: {
    margin: "0 0 14px",
    fontSize: 14,
    color: "#f1f5f9",
    lineHeight: 1.5,
  },
  confirmBtns: {
    display: "flex",
    gap: 10,
  },
  editBtn: {
    flex: 1,
    padding: "11px",
    background: "rgba(255,255,255,0.06)",
    color: "#f1f5f9",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmBtn: {
    flex: 2,
    padding: "11px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Edit
  editBox: {
    marginBottom: 10,
  },
  editLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 6,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  editTextarea: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
    color: "#f1f5f9",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 10,
  },
  // Sending
  sendingBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "14px 0",
  },
  sendingSpinner: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "2px solid rgba(99,102,241,0.2)",
    borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  sendingText: {
    fontSize: 14,
    color: "#64748b",
    fontStyle: "italic",
  },
  // Idle mic area
  idleMicArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  idleRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  idleDivider: {
    fontSize: 12,
    color: "#475569",
    fontWeight: 500,
  },
  typeToggleBtn: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    color: "#94a3b8",
  },
  micButtonWrapper: {
    position: "relative",
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    animation: "breathe 3s ease-in-out infinite",
    boxShadow: "0 0 32px rgba(99,102,241,0.35)",
    position: "relative",
    zIndex: 1,
  },
  tapToSpeakLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 500,
    textAlign: "center",
  },
  // Recording area
  recordingArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  recordingRingWrapper: {
    position: "relative",
    width: 80,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingRingOuter: {
    position: "absolute",
    inset: -12,
    borderRadius: "50%",
    border: "2px solid rgba(244,63,94,0.5)",
    animation: "pulse-ring 1.2s ease-out infinite",
  },
  recordingRingInnerOuter: {
    position: "absolute",
    inset: -6,
    borderRadius: "50%",
    border: "2px solid rgba(244,63,94,0.35)",
    animation: "pulse-ring 1.2s ease-out infinite",
    animationDelay: "0.5s",
  },
  recordingButton: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #f43f5e, #e11d48)",
    border: "none",
    fontSize: 28,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 32px rgba(244,63,94,0.4)",
    position: "relative",
    zIndex: 1,
  },
  recordingLabel: {
    fontSize: 13,
    color: "#f43f5e",
    fontWeight: 600,
    textAlign: "center",
  },
  // Text input fallback
  textInputArea: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  textInputHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  turnsLeftText: {
    fontSize: 12,
    color: "#64748b",
  },
  useMicBtn: {
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 20,
    color: "#818cf8",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 12px",
    cursor: "pointer",
  },
  textInputRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  },
  textInputBox: {
    flex: 1,
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
    width: "100%",
  },
  sendTextFullBtn: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    boxSizing: "border-box",
  },
  // Complete overlay
  completeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(6,8,24,0.92)",
    padding: 24,
    textAlign: "center",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  completeSpinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid rgba(99,102,241,0.2)",
    borderTopColor: "#6366f1",
    animation: "spin 0.8s linear infinite",
  },
  completeText: {
    fontSize: 15,
    color: "#6366f1",
    fontWeight: 600,
  },
};
