import { useState, useEffect, useRef } from "react";
import { sendBattleMessage } from "../lib/openrouter.js";
import { startRecognition } from "../lib/speechRecognition.js";
import { analyseTranscript } from "../hooks/useRealTimeAnalysis.js";

const MAX_TURNS = 3;

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, opponent }) {
  const isOpponent = message.role === "opponent";
  return (
    <div style={{
      ...styles.bubbleRow,
      justifyContent: isOpponent ? "flex-start" : "flex-end",
    }}>
      {isOpponent && (
        <div style={styles.opponentAvatarSmall}>{opponent.avatar}</div>
      )}
      <div style={{
        ...styles.bubble,
        backgroundColor: isOpponent ? "#1a1a1a" : "#7c3aed",
        borderRadius: isOpponent ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        maxWidth: isOpponent ? "80%" : "75%",
      }}>
        <p style={styles.bubbleText}>{message.text}</p>
      </div>
    </div>
  );
}

function TypingIndicator({ opponent }) {
  return (
    <div style={styles.bubbleRow}>
      <div style={styles.opponentAvatarSmall}>{opponent.avatar}</div>
      <div style={{ ...styles.bubble, backgroundColor: "#1a1a1a", borderRadius: "4px 16px 16px 16px" }}>
        <div style={styles.typingDots}>
          <span style={{ ...styles.dot, animationDelay: "0s" }}>•</span>
          <span style={{ ...styles.dot, animationDelay: "0.2s" }}>•</span>
          <span style={{ ...styles.dot, animationDelay: "0.4s" }}>•</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BattleScreen({
  user,
  opponent,
  scenario,
  outline,
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

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialised = useRef(false);

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
        // Send an empty messages array — the AI will use the scenario context to open
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
          systemHint
        );
        // Use just the first paragraph before any ###FEEDBACK### marker
        const cleanReply = reply.split("###FEEDBACK###")[0].trim();
        setMessages([{ role: "opponent", text: cleanReply }]);
      } catch (err) {
        console.error("Opener error:", err);
        // Fallback: use the scenario text directly as the opener
        setMessages([{ role: "opponent", text: scenario.text }]);
      } finally {
        setIsOpponentTyping(false);
      }
    }

    getOpenerLine();
  }, [opponent, scenario, outline]);

  // ── Mic handling ─────────────────────────────────────────────────────────

  function handleMicClick() {
    if (micState !== "idle") return;

    setLiveTranscript("");
    setMicState("recording");

    recognitionRef.current = startRecognition(
      (transcript, isFinal) => {
        setLiveTranscript(transcript);
        // Real-time filler analysis
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
          setMicState("confirming");
          setConfirmedTranscript(transcript);
        }
      },
      () => {
        // onEnd — if not already in confirming state, move there
        setMicState(prev => (prev === "recording" ? "confirming" : prev));
      }
    );

    if (!recognitionRef.current.supported) {
      setMicSupported(false);
      setMicState("nomic");
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

  // ── Core turn logic ───────────────────────────────────────────────────────

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

    // Convert to OpenRouter format
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
        }
      );

      const cleanReply = reply.split("###FEEDBACK###")[0].trim();

      if (cleanReply) {
        setMessages(prev => [...prev, { role: "opponent", text: cleanReply }]);
      }

      if (feedbackBlock) {
        // Session complete — build session data and navigate
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

        // Short delay so user can see the final opponent message
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (!opponent || !scenario) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>No battle data found.</p>
        <button onClick={() => setCurrentScreen("home")} style={styles.backBtn}>
          ← Home
        </button>
      </div>
    );
  }

  const turnLabel = `Turn ${Math.min(currentTurn + 1, MAX_TURNS)} of ${MAX_TURNS}`;
  const turnsLeft = MAX_TURNS - currentTurn;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => setCurrentScreen("home")} style={styles.exitBtn}>
          ✕
        </button>
        <div style={styles.headerCenter}>
          <span style={styles.opponentAvatarHeader}>{opponent.avatar}</span>
          <div>
            <div style={styles.headerName}>{opponent.name}</div>
            <div style={styles.headerRole}>{opponent.role}</div>
          </div>
        </div>
        <div style={styles.turnBadge}>{sessionComplete ? "Done" : turnLabel}</div>
      </div>

      {/* Filler counter */}
      {micState === "recording" && topFiller && topFillerCount > 0 && (
        <div style={styles.fillerBanner}>
          ⚠️ Top filler: "<strong>{topFiller}</strong>" × {topFillerCount}
        </div>
      )}

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} opponent={opponent} />
        ))}
        {isOpponentTyping && <TypingIndicator opponent={opponent} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!sessionComplete && (
        <div style={styles.inputArea}>
          {error && (
            <div style={styles.errorBanner}>
              {error}
              <button onClick={() => setError(null)} style={styles.errorDismiss}>✕</button>
            </div>
          )}

          {/* Live transcript */}
          {micState === "recording" && liveTranscript && (
            <div style={styles.liveTranscriptBox}>
              <div style={styles.liveLabel}>🎙 Listening...</div>
              <p style={styles.liveText}>{liveTranscript}</p>
            </div>
          )}

          {/* Confirm state */}
          {micState === "confirming" && !isEditing && (
            <div style={styles.confirmBox}>
              <div style={styles.confirmLabel}>Is this what you said?</div>
              <p style={styles.confirmText}>{confirmedTranscript}</p>
              <div style={styles.confirmBtns}>
                <button onClick={handleEdit} style={styles.editBtn}>Edit</button>
                <button onClick={handleConfirm} style={styles.confirmBtn}>Yes, send it ✓</button>
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
              <div style={styles.sendingText}>Thinking...</div>
            </div>
          )}

          {/* Idle state — mic or text input */}
          {(micState === "idle" || micState === "nomic") && !isOpponentTyping && messages.length > 0 && (
            <div style={styles.idleControls}>
              {micSupported ? (
                <div style={styles.micArea}>
                  <div style={styles.turnsLeftText}>
                    {turnsLeft > 0 ? `${turnsLeft} turn${turnsLeft !== 1 ? "s" : ""} left` : "Last turn"}
                  </div>
                  <button onClick={handleMicClick} style={styles.micBtn}>
                    🎙 Tap to Speak
                  </button>
                  <div style={styles.textToggleArea}>
                    <button
                      onClick={() => setMicState("nomic")}
                      style={styles.typeInsteadBtn}
                    >
                      Type instead
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.textInputArea}>
                  <div style={styles.turnsLeftText}>
                    {turnsLeft > 0 ? `${turnsLeft} turn${turnsLeft !== 1 ? "s" : ""} left` : "Last turn"}
                  </div>
                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder="Type your response..."
                    rows={3}
                    style={styles.textInputBox}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        handleTextSubmit();
                      }
                    }}
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    style={{
                      ...styles.sendTextBtn,
                      opacity: textInput.trim() ? 1 : 0.4,
                    }}
                  >
                    Send →
                  </button>
                  {micSupported && (
                    <button onClick={() => setMicState("idle")} style={styles.typeInsteadBtn}>
                      Use mic instead
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recording active */}
          {micState === "recording" && (
            <div style={styles.recordingArea}>
              <div style={styles.recordingPulse}>🔴 Recording</div>
              <button onClick={handleStopRecording} style={styles.stopBtn}>
                Stop ■
              </button>
            </div>
          )}
        </div>
      )}

      {/* Session complete overlay */}
      {sessionComplete && (
        <div style={styles.completeOverlay}>
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
    height: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
  },
  errorContainer: {
    padding: 32,
    textAlign: "center",
    backgroundColor: "#0f0f0f",
    minHeight: "100vh",
    color: "#ffffff",
  },
  errorText: { color: "#9ca3af", marginBottom: 16 },
  backBtn: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    fontSize: 14,
    cursor: "pointer",
    padding: "8px 0",
  },
  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: "#0f0f0f",
    borderBottom: "1px solid #1a1a1a",
    flexShrink: 0,
  },
  exitBtn: {
    background: "none",
    border: "none",
    color: "#6b7280",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  opponentAvatarHeader: {
    fontSize: 28,
  },
  headerName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
  },
  headerRole: {
    fontSize: 11,
    color: "#6b7280",
  },
  turnBadge: {
    fontSize: 12,
    color: "#7c3aed",
    backgroundColor: "rgba(124,58,237,0.12)",
    padding: "4px 10px",
    borderRadius: 20,
    fontWeight: 600,
  },
  // Filler banner
  fillerBanner: {
    backgroundColor: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.3)",
    color: "#f59e0b",
    fontSize: 12,
    padding: "8px 16px",
    textAlign: "center",
    flexShrink: 0,
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
  bubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  opponentAvatarSmall: {
    fontSize: 24,
    flexShrink: 0,
    alignSelf: "flex-end",
  },
  bubble: {
    padding: "10px 14px",
    border: "1px solid #2a2a2a",
  },
  bubbleText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#ffffff",
  },
  typingDots: {
    display: "flex",
    gap: 4,
    padding: "2px 0",
  },
  dot: {
    fontSize: 18,
    color: "#6b7280",
    animationName: "blink",
    animationDuration: "1s",
    animationIterationCount: "infinite",
  },
  // Input area
  inputArea: {
    flexShrink: 0,
    backgroundColor: "#0f0f0f",
    borderTop: "1px solid #1a1a1a",
    padding: "12px 16px 20px",
  },
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#ef4444",
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  errorDismiss: {
    background: "none",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
  },
  // Live transcript
  liveTranscriptBox: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 10,
  },
  liveLabel: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: 700,
    marginBottom: 4,
  },
  liveText: {
    margin: 0,
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 1.5,
    fontStyle: "italic",
  },
  // Confirm
  confirmBox: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 8,
  },
  confirmLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 6,
    fontWeight: 600,
  },
  confirmText: {
    margin: "0 0 12px",
    fontSize: 14,
    color: "#ffffff",
    lineHeight: 1.5,
  },
  confirmBtns: {
    display: "flex",
    gap: 8,
  },
  editBtn: {
    flex: 1,
    padding: "10px",
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
    border: "1px solid #3a3a3a",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmBtn: {
    flex: 2,
    padding: "10px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Edit
  editBox: {
    marginBottom: 8,
  },
  editLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 6,
    fontWeight: 600,
  },
  editTextarea: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 8,
  },
  // Sending
  sendingBox: {
    textAlign: "center",
    padding: 16,
  },
  sendingText: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
  // Idle / mic
  idleControls: {},
  micArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  turnsLeftText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  micBtn: {
    width: "100%",
    padding: "16px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  typeInsteadArea: {},
  typeInsteadBtn: {
    background: "none",
    border: "none",
    color: "#6b7280",
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "underline",
    padding: "4px 0",
  },
  // Text input
  textInputArea: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  textInputBox: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  sendTextBtn: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Recording
  recordingArea: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
  },
  recordingPulse: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: 700,
  },
  stopBtn: {
    padding: "10px 20px",
    backgroundColor: "#1a1a1a",
    color: "#ef4444",
    border: "1px solid #ef4444",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  // Complete overlay
  completeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,15,15,0.9)",
    padding: 20,
    textAlign: "center",
    borderTop: "1px solid #2a2a2a",
  },
  completeText: {
    fontSize: 15,
    color: "#7c3aed",
    fontWeight: 600,
  },
};
