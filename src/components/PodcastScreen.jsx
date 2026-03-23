import { useState, useEffect, useRef, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { parsePodcastTranscript, scorePodcastTurn } from "../lib/openrouter.js";
import { speakPodcastLine, cancelSpeech } from "../lib/speechSynthesis.js";
import { startRecognition } from "../lib/speechRecognition.js";
import MicWaveform from "./MicWaveform.jsx";

// ── Styles ─────────────────────────────────────────────────────────────────

const glass = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const BG = "linear-gradient(135deg,#05061480 0%,#0d0e2680 100%)";

// ── Helpers ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, max = 5 }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#94a3b8" }}>
        <span>{label}</span>
        <span style={{ color: "#e2e8f0" }}>{value != null ? `${value}/${max}` : "—"}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

function Chip({ label, color = "#6366f1", onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 12,
      background: `${color}22`, border: `1px solid ${color}55`, color,
    }}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ background: "none", border: "none", color, cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
        >×</button>
      )}
    </span>
  );
}

function Spinner({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 20px" }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid rgba(99,102,241,0.2)",
        borderTopColor: "#6366f1",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{label}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function PodcastScreen({ user, setCurrentScreen }) {
  // ── Phase & session state ──
  const [phase, setPhase] = useState("upload");
  const [sessionState, setSessionState] = useState("ai_speaking");

  // ── Upload phase ──
  const [uploadMode, setUploadMode] = useState("file");
  const [pasteText, setPasteText] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [rawText, setRawText] = useState("");

  // ── Setup phase ──
  const [speakers, setSpeakers] = useState([]);
  const [turns, setTurns] = useState([]);
  const [userSpeaker, setUserSpeaker] = useState(null);
  const [taggedPhrases, setTaggedPhrases] = useState([]);
  const [ttsAvailable, setTtsAvailable] = useState(true);

  // ── Session phase ──
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const [turnScores, setTurnScores] = useState([]);
  const [currentTurnScore, setCurrentTurnScore] = useState(null);
  const [isSpeakingFace, setIsSpeakingFace] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [fallbackText, setFallbackText] = useState("");

  // ── Result phase ──
  const [sessionSaved, setSessionSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── Refs ──
  const recognitionRef = useRef(null);
  const speechHandleRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const hasInitRef = useRef(false);

  // ── Check TTS on mount ──
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTtsAvailable(false);
    }
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      cancelSpeech();
      recognitionRef.current?.stop?.();
    };
  }, []);

  // ── Session driver ──────────────────────────────────────────────────────────

  const endSession = useCallback((partial = false) => {
    cancelSpeech();
    recognitionRef.current?.stop?.();
    if (partial && turnScores.length === 0) {
      setCurrentScreen("home");
      return;
    }
    setPhase("result");
  }, [turnScores, setCurrentScreen]);

  const advanceTurn = useCallback((nextIndex, scores) => {
    // Find next turn; skip consecutive AI turns via chain
    if (nextIndex >= turns.length) {
      setPhase("result");
      return;
    }
    setCurrentTurnIndex(nextIndex);
    setCurrentTurnScore(null);
    setLiveTranscript("");
    setConfirmedTranscript("");
    liveTranscriptRef.current = "";
    setFallbackText("");
    setSessionState("ai_speaking");
  }, [turns]);

  // Fired when user clicks "Done" recording
  const handleDoneRecording = useCallback(async () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    const transcript = liveTranscriptRef.current.trim();
    setConfirmedTranscript(transcript || fallbackText);
    setSessionState("scoring");

    const turn = turns[currentTurnIndex];
    const phrasesForTurn = taggedPhrases.filter(p =>
      turn?.text?.toLowerCase().includes(p.toLowerCase()) || true
    );

    const score = await scorePodcastTurn(
      turn?.text ?? "",
      phrasesForTurn,
      transcript || fallbackText
    );
    setCurrentTurnScore(score);
    setTurnScores(prev => [
      ...prev,
      {
        turnIndex: currentTurnIndex,
        originalText: turn?.text ?? "",
        userTranscript: transcript || fallbackText,
        ...score,
      },
    ]);
    setSessionState("feedback");
  }, [currentTurnIndex, turns, taggedPhrases, fallbackText]);

  // Main session effect — drives ai_speaking and user_recording transitions
  useEffect(() => {
    if (phase !== "session") return;
    if (sessionState !== "ai_speaking") return;

    const turn = turns[currentTurnIndex];
    if (!turn) {
      setPhase("result");
      return;
    }

    // If this is a user turn, jump straight to recording
    if (turn.speaker === userSpeaker) {
      setSessionState("user_recording");
      return;
    }

    // AI co-host turn — speak it, then advance
    if (!ttsAvailable) {
      // TTS unavailable: show text, let user click "Continue"
      setIsSpeakingFace(false);
      return;
    }

    setIsSpeakingFace(true);
    speechHandleRef.current = speakPodcastLine(turn.text, () => {
      setIsSpeakingFace(false);
      // Find the next turn
      const nextIdx = currentTurnIndex + 1;
      if (nextIdx >= turns.length) {
        setPhase("result");
      } else {
        setCurrentTurnIndex(nextIdx);
        setCurrentTurnScore(null);
        setSessionState("ai_speaking");
      }
    });

    return () => {
      speechHandleRef.current?.stop?.();
    };
  }, [phase, sessionState, currentTurnIndex, turns, userSpeaker, ttsAvailable]);

  // Start STT when entering user_recording
  useEffect(() => {
    if (phase !== "session" || sessionState !== "user_recording") return;

    liveTranscriptRef.current = "";
    setLiveTranscript("");

    const supported = typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!supported) {
      setMicSupported(false);
      return;
    }

    setMicSupported(true);
    recognitionRef.current = startRecognition(
      (text) => {
        liveTranscriptRef.current = text;
        setLiveTranscript(text);
      },
      () => { /* onEnd — user clicks Done explicitly */ }
    );

    return () => {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
    };
  }, [phase, sessionState]);

  // Auto-save result when entering result phase
  useEffect(() => {
    if (phase !== "result") return;
    if (sessionSaved || turnScores.length === 0) return;

    const save = async () => {
      try {
        const phrasesUsedAll = turnScores.flatMap(s => s.phrasesUsed ?? []);
        const uniqueUsed = [...new Set(phrasesUsedAll)];
        const avgScore = turnScores.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / turnScores.length;
        const userTurns = turns.filter(t => t.speaker === userSpeaker);

        await addDoc(collection(db, "users", user.uid, "podcastSessions"), {
          savedAt: serverTimestamp(),
          speakers,
          userSpeaker,
          totalTurns: turns.length,
          targetPhrases: taggedPhrases,
          phrasesUsedCount: uniqueUsed.length,
          phrasesTaggedCount: taggedPhrases.length,
          averageOverallScore: Math.round(avgScore * 10) / 10,
          userTurnsCompleted: turnScores.length,
          userTurnsTotal: userTurns.length,
          turnScores: turnScores.map(s => ({
            turnIndex: s.turnIndex,
            originalText: s.originalText,
            userTranscript: s.userTranscript,
            meaningScore: s.meaningScore,
            phrasesUsed: s.phrasesUsed,
            missedPhrases: s.missedPhrases,
            overallScore: s.overallScore,
            feedback: s.feedback,
          })),
          transcriptSnippet: rawText.slice(0, 300),
        });
        setSessionSaved(true);
      } catch (err) {
        setSaveError("Couldn't save session.");
      }
    };

    save();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parse handler ──────────────────────────────────────────────────────────

  const handleParse = async () => {
    const text = uploadMode === "paste" ? pasteText : rawText;
    if (!text || text.length < 50) return;
    setUploadError(null);
    setParseError(null);
    setPhase("parsing");

    try {
      const result = await parsePodcastTranscript(text);
      setSpeakers(result.speakers);
      setTurns(result.turns);
      setRawText(text);
      setPhase("setup");
    } catch (err) {
      let msg = "Couldn't parse this transcript. Check formatting and try again.";
      if (err.message === "SINGLE_SPEAKER") msg = "Could not find two distinct speakers. Make sure each line starts with the speaker name (e.g. Alex: ...).";
      if (err.message === "EMPTY_TURNS") msg = "Transcript parsed but no dialogue found. Check that lines have speaker labels.";
      setParseError(msg);
      setPhase("upload");
    }
  };

  // ── Phrase tagging via text selection ─────────────────────────────────────

  const handleTurnMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const phrase = sel.toString().trim();
    if (phrase.length < 2 || phrase.length > 80) return;
    if (!taggedPhrases.includes(phrase)) {
      setTaggedPhrases(prev => [...prev, phrase]);
    }
    sel.removeAllRanges();
  };

  // ── Computed values ────────────────────────────────────────────────────────

  const currentTurn = turns[currentTurnIndex] ?? null;
  const isAiTurn = currentTurn && currentTurn.speaker !== userSpeaker;
  const userTurns = turns.filter(t => t.speaker === userSpeaker);
  const allPhrasesUsed = turnScores.flatMap(s => s.phrasesUsed ?? []);
  const uniquePhrasesUsed = [...new Set(allPhrasesUsed)];
  const avgScore = turnScores.length > 0
    ? (turnScores.reduce((s, t) => s + (t.overallScore ?? 0), 0) / turnScores.length).toFixed(1)
    : null;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderHeader = (title) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <button
        onClick={() => {
          cancelSpeech();
          recognitionRef.current?.stop?.();
          setCurrentScreen("home");
        }}
        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}
      >←</button>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{title}</h1>
    </div>
  );

  // ── Phase: upload ──────────────────────────────────────────────────────────

  if (phase === "upload") {
    const activeText = uploadMode === "paste" ? pasteText : rawText;
    const canParse = activeText.length >= 50;

    return (
      <div style={{ minHeight: "100vh", background: BG, padding: "24px 16px", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {renderHeader("Podcast Sim")}

          <div style={{ ...glass, padding: 24 }}>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 20px" }}>
              Upload or paste a conversation transcript. We'll parse speakers and guide you through performing your role.
            </p>

            {/* Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["file", "paste"].map(mode => (
                <button
                  key={mode}
                  onClick={() => { setUploadMode(mode); setUploadError(null); }}
                  style={{
                    padding: "8px 18px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                    fontWeight: uploadMode === mode ? 700 : 400,
                    background: uploadMode === mode ? "#6366f1" : "rgba(255,255,255,0.06)",
                    border: uploadMode === mode ? "none" : "1px solid rgba(255,255,255,0.1)",
                    color: uploadMode === mode ? "#fff" : "#94a3b8",
                  }}
                >
                  {mode === "file" ? "Upload .txt" : "Paste text"}
                </button>
              ))}
            </div>

            {uploadMode === "file" ? (
              <label style={{
                display: "block", border: "2px dashed rgba(99,102,241,0.35)", borderRadius: 12,
                padding: "32px 20px", textAlign: "center", cursor: "pointer",
                color: rawText ? "#a5b4fc" : "#64748b", fontSize: 14,
              }}>
                <input
                  type="file"
                  accept=".txt"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      setUploadError("File is too large (max 1 MB).");
                      return;
                    }
                    setUploadError(null);
                    const reader = new FileReader();
                    reader.onload = (ev) => setRawText(ev.target.result ?? "");
                    reader.readAsText(file);
                  }}
                />
                {rawText
                  ? `✓ File loaded (${rawText.length.toLocaleString()} chars)`
                  : "Click to choose a .txt file"}
              </label>
            ) : (
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Alex: Hey, welcome back to the show...\nJordan: Thanks for having me! Let's dive in..."}
                style={{
                  width: "100%", minHeight: 160, borderRadius: 12, padding: 14, fontSize: 13,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
            )}

            {rawText.length > 6000 && (
              <p style={{ color: "#f59e0b", fontSize: 12, margin: "8px 0 0" }}>
                Transcript is long — only the first 6,000 characters will be parsed.
              </p>
            )}

            {(uploadError || parseError) && (
              <p style={{ color: "#f43f5e", fontSize: 13, margin: "12px 0 0", lineHeight: 1.5 }}>
                {uploadError || parseError}
              </p>
            )}

            <button
              onClick={handleParse}
              disabled={!canParse}
              style={{
                marginTop: 20, width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15,
                fontWeight: 700, cursor: canParse ? "pointer" : "not-allowed",
                background: canParse ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.06)",
                color: canParse ? "#fff" : "#4b5563", border: "none",
              }}
            >
              Parse Transcript
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: parsing ─────────────────────────────────────────────────────────

  if (phase === "parsing") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
        <Spinner label="Reading transcript…" />
      </div>
    );
  }

  // ── Phase: setup ───────────────────────────────────────────────────────────

  if (phase === "setup") {
    const speakerTurnCount = userSpeaker
      ? turns.filter(t => t.speaker === userSpeaker).length
      : 0;

    return (
      <div style={{ minHeight: "100vh", background: BG, padding: "24px 16px", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {renderHeader("Set Up Session")}

          {/* Section A: Who are you? */}
          <div style={{ ...glass, padding: 20, marginBottom: 16 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Who are you?</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {speakers.map(sp => (
                <button
                  key={sp}
                  onClick={() => setUserSpeaker(sp)}
                  style={{
                    padding: "10px 20px", borderRadius: 20, fontSize: 14, cursor: "pointer", fontWeight: 600,
                    background: userSpeaker === sp ? "#6366f1" : "rgba(255,255,255,0.06)",
                    border: userSpeaker === sp ? "none" : "1px solid rgba(255,255,255,0.12)",
                    color: userSpeaker === sp ? "#fff" : "#cbd5e1",
                  }}
                >
                  {sp}
                </button>
              ))}
            </div>
            {userSpeaker && speakerTurnCount === 0 && (
              <p style={{ color: "#f59e0b", fontSize: 13, margin: "10px 0 0" }}>
                This speaker has no lines in the transcript. Choose another.
              </p>
            )}
          </div>

          {/* Section B: Tag phrases */}
          {userSpeaker && speakerTurnCount > 0 && (
            <div style={{ ...glass, padding: 20, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Tag phrases to practice</h2>
              <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 14px" }}>Select text in your lines to tag a phrase.</p>

              {taggedPhrases.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {taggedPhrases.map(p => (
                    <Chip key={p} label={p} color="#6366f1" onRemove={() => setTaggedPhrases(prev => prev.filter(x => x !== p))} />
                  ))}
                </div>
              )}

              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {turns.map((turn, i) => {
                  const isUser = turn.speaker === userSpeaker;
                  return (
                    <div
                      key={i}
                      onMouseUp={isUser ? handleTurnMouseUp : undefined}
                      onTouchEnd={isUser ? handleTurnMouseUp : undefined}
                      style={{
                        padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.55,
                        background: isUser ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                        border: isUser ? "1px solid rgba(99,102,241,0.25)" : "1px solid transparent",
                        opacity: isUser ? 1 : 0.45,
                        cursor: isUser ? "text" : "default",
                        userSelect: isUser ? "text" : "none",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: isUser ? "#818cf8" : "#4b5563", display: "block", marginBottom: 3 }}>
                        {turn.speaker}
                      </span>
                      {(() => {
                        // Highlight tagged phrases
                        let text = turn.text;
                        if (!isUser || taggedPhrases.length === 0) return text;
                        const parts = [];
                        let remaining = text;
                        let key = 0;
                        for (const phrase of taggedPhrases) {
                          const idx = remaining.toLowerCase().indexOf(phrase.toLowerCase());
                          if (idx === -1) continue;
                          parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
                          parts.push(<mark key={key++} style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 3, padding: "0 2px" }}>{remaining.slice(idx, idx + phrase.length)}</mark>);
                          remaining = remaining.slice(idx + phrase.length);
                        }
                        parts.push(<span key={key++}>{remaining}</span>);
                        return parts.length > 1 ? parts : text;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              hasInitRef.current = false;
              setCurrentTurnIndex(0);
              setTurnScores([]);
              setCurrentTurnScore(null);
              setLiveTranscript("");
              setConfirmedTranscript("");
              liveTranscriptRef.current = "";
              setSessionState("ai_speaking");
              setPhase("session");
            }}
            disabled={!userSpeaker || speakerTurnCount === 0}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: userSpeaker && speakerTurnCount > 0 ? "pointer" : "not-allowed",
              background: userSpeaker && speakerTurnCount > 0
                ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                : "rgba(255,255,255,0.06)",
              color: userSpeaker && speakerTurnCount > 0 ? "#fff" : "#4b5563",
              border: "none",
            }}
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: session ─────────────────────────────────────────────────────────

  if (phase === "session") {
    const phrasesForThisTurn = currentTurn
      ? taggedPhrases.filter(p => currentTurn.text.toLowerCase().includes(p.toLowerCase()))
      : [];

    return (
      <div style={{ minHeight: "100vh", background: BG, padding: "24px 16px", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>Podcast Sim</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Turn {currentTurnIndex + 1}/{turns.length}</span>
              <button
                onClick={() => {
                  cancelSpeech();
                  recognitionRef.current?.stop?.();
                  endSession(true);
                }}
                style={{
                  padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                  color: "#f43f5e", cursor: "pointer",
                }}
              >
                End Session
              </button>
            </div>
          </div>

          {/* ai_speaking */}
          {sessionState === "ai_speaking" && currentTurn && !isAiTurn && null /* handled by effect */}
          {sessionState === "ai_speaking" && currentTurn && isAiTurn && (
            <div style={{ ...glass, padding: 24, textAlign: "center" }}>
              {/* Animated face indicator */}
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: isSpeakingFace ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, transition: "background .3s ease",
                boxShadow: isSpeakingFace ? "0 0 24px rgba(99,102,241,0.5)" : "none",
              }}>
                🎙
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: isSpeakingFace ? "#22c55e" : "#64748b",
                  boxShadow: isSpeakingFace ? "0 0 8px #22c55e" : "none",
                  animation: isSpeakingFace ? "pulse 1.2s ease-in-out infinite" : "none",
                }} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>
                  {isSpeakingFace ? `${currentTurn.speaker} is speaking…` : "Preparing…"}
                </span>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 18px",
                fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, textAlign: "left",
              }}>
                {currentTurn.text}
              </div>
              {!ttsAvailable && (
                <button
                  onClick={() => {
                    const nextIdx = currentTurnIndex + 1;
                    if (nextIdx >= turns.length) { setPhase("result"); return; }
                    setCurrentTurnIndex(nextIdx);
                    setCurrentTurnScore(null);
                    setSessionState("ai_speaking");
                  }}
                  style={{
                    marginTop: 16, padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)",
                    color: "#a5b4fc", cursor: "pointer",
                  }}
                >
                  Continue →
                </button>
              )}
              <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
            </div>
          )}

          {/* user_recording */}
          {sessionState === "user_recording" && currentTurn && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Original line reference */}
              <div style={{ ...glass, padding: 18 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.8 }}>Your line</p>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>{currentTurn.text}</p>
              </div>

              {/* Target phrases */}
              {phrasesForThisTurn.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {phrasesForThisTurn.map(p => <Chip key={p} label={p} color="#8b5cf6" />)}
                </div>
              )}

              {/* Mic / fallback */}
              <div style={{ ...glass, padding: 24, textAlign: "center" }}>
                {micSupported ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                      <MicWaveform isRecording={true} width={240} height={44} />
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 13, color: "#94a3b8" }}>
                      {liveTranscript ? `"${liveTranscript}"` : "Listening…"}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "#f59e0b" }}>Microphone unavailable — type your response</p>
                    <textarea
                      value={fallbackText}
                      onChange={e => setFallbackText(e.target.value)}
                      placeholder="Type what you'd say…"
                      style={{
                        width: "100%", minHeight: 80, borderRadius: 10, padding: 12, fontSize: 13,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e2e8f0", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
                        boxSizing: "border-box", marginBottom: 10,
                      }}
                    />
                  </>
                )}
                <button
                  onClick={handleDoneRecording}
                  disabled={micSupported ? false : fallbackText.trim().length === 0}
                  style={{
                    padding: "12px 32px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* scoring */}
          {sessionState === "scoring" && (
            <div style={{ ...glass, padding: 40, textAlign: "center" }}>
              <Spinner label="Scoring…" />
            </div>
          )}

          {/* feedback */}
          {sessionState === "feedback" && currentTurnScore && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...glass, padding: 22 }}>
                {/* Overall score badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 800, color: "#fff",
                  }}>
                    {currentTurnScore.overallScore ?? "—"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Overall Score</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>
                      {currentTurnScore.feedback}
                    </p>
                  </div>
                </div>

                <ScoreBar label="Meaning preservation" value={currentTurnScore.meaningScore} max={5} />

                {taggedPhrases.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#94a3b8" }}>Phrases</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(currentTurnScore.phrasesUsed ?? []).map(p => <Chip key={p} label={`✓ ${p}`} color="#22c55e" />)}
                      {(currentTurnScore.missedPhrases ?? []).map(p => <Chip key={p} label={`✗ ${p}`} color="#f43f5e" />)}
                    </div>
                  </div>
                )}

                {/* What user said */}
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.7 }}>You said</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                    {confirmedTranscript || fallbackText || "(nothing recorded)"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  const nextIdx = currentTurnIndex + 1;
                  if (nextIdx >= turns.length) {
                    setPhase("result");
                  } else {
                    advanceTurn(nextIdx, turnScores);
                  }
                }}
                style={{
                  padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff",
                  cursor: "pointer",
                }}
              >
                {currentTurnIndex + 1 >= turns.length ? "See Results" : "Next Turn →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: result ──────────────────────────────────────────────────────────

  if (phase === "result") {
    return (
      <div style={{ minHeight: "100vh", background: BG, padding: "24px 16px", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {renderHeader("Session Results")}

          {/* Summary card */}
          <div style={{ ...glass, padding: 22, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ flex: 1, minWidth: 100, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#a5b4fc" }}>{avgScore ?? "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Avg score /10</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#34d399" }}>{uniquePhrasesUsed.length}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>of {taggedPhrases.length} phrases used</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9" }}>{turnScores.length}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>turns completed</div>
              </div>
            </div>

            {saveError && <p style={{ color: "#f43f5e", fontSize: 12, margin: "0 0 8px" }}>{saveError}</p>}
            {sessionSaved && <p style={{ color: "#22c55e", fontSize: 12, margin: "0 0 8px" }}>Session saved.</p>}
          </div>

          {/* Interleaved transcript */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {turns.map((turn, i) => {
              const isUser = turn.speaker === userSpeaker;
              const score = turnScores.find(s => s.turnIndex === i);
              return (
                <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "12px 16px", borderRadius: 14,
                    background: isUser ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                    border: isUser ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: isUser ? "#818cf8" : "#4b5563" }}>
                      {turn.speaker}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{turn.text}</p>
                    {isUser && score && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
                        <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>
                          {score.userTranscript || "(nothing recorded)"}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, background: "rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "2px 8px", borderRadius: 10 }}>
                            {score.overallScore ?? "—"}/10
                          </span>
                          {(score.missedPhrases ?? []).map(p => (
                            <span key={p} style={{ fontSize: 11, color: "#f87171" }}>✗ {p}</span>
                          ))}
                          {(score.phrasesUsed ?? []).map(p => (
                            <span key={p} style={{ fontSize: 11, color: "#4ade80" }}>✓ {p}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentScreen("home")}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0", cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
