import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { INTERVIEWERS } from "../data/interviewers.js";

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

// ── Question cache (5-min TTL) ────────────────────────────────────────────────

const Q_CACHE_TTL = 5 * 60 * 1000;
function readQCache(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(`fluentpm_questions_${uid}`) || "null");
    if (raw && Date.now() - raw.ts < Q_CACHE_TTL && Array.isArray(raw.data)) return raw.data;
  } catch {}
  return null;
}
function writeQCache(uid, data) {
  try { localStorage.setItem(`fluentpm_questions_${uid}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}
// Force-write cache immediately (for after imports)
function bustQCache(uid) {
  try { localStorage.removeItem(`fluentpm_questions_${uid}`); } catch {}
}

// ── Interviewer picker modal ──────────────────────────────────────────────────

function InterviewerPicker({ question, onSelect, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 1000, padding: "0 0 0 0",
    }}>
      <div style={{
        width: "100%", maxWidth: 680,
        background: "rgba(12,13,36,0.99)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px 20px 0 0",
        padding: "24px 20px 40px",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>
          Choose your interviewer
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          "{question.text.slice(0, 80)}{question.text.length > 80 ? "…" : ""}"
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {INTERVIEWERS.slice(0, 4).map(iv => (
            <button
              key={iv.id}
              onClick={() => onSelect(iv)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, cursor: "pointer", textAlign: "left",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{iv.avatar}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{iv.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{iv.role}</div>
              </div>
              <div style={{
                marginLeft: "auto", flexShrink: 0,
                fontSize: 11, fontWeight: 700, padding: "3px 10px",
                borderRadius: 20,
                background: iv.aggression === "high" ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.12)",
                color: iv.aggression === "high" ? "#f43f5e" : "#f59e0b",
              }}>
                {iv.aggression === "high" ? "TOUGH" : "MED"}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          style={{
            marginTop: 16, width: "100%", padding: "12px",
            background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, color: "#64748b", fontSize: 13, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomQuestionsScreen({ user, setCurrentScreen, setCustomQuestion, setInterviewData }) {
  const [questions, setQuestions] = useState(() => readQCache(user.uid) || []);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importProgress, setImportProgress] = useState(null);
  const [pickerQuestion, setPickerQuestion] = useState(null);
  const [aiCleaning, setAiCleaning] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [user.uid]);

  function sortQuestions(docs) {
    return docs.sort((a, b) => {
      const ta = a.addedAt?.seconds ? a.addedAt.seconds * 1000 : (typeof a.addedAt === "string" ? new Date(a.addedAt).getTime() : 0);
      const tb = b.addedAt?.seconds ? b.addedAt.seconds * 1000 : (typeof b.addedAt === "string" ? new Date(b.addedAt).getTime() : 0);
      return tb - ta;
    });
  }

  async function fetchQuestions() {
    // Show cache instantly if available
    const cached = readQCache(user.uid);
    if (cached && cached.length > 0) {
      setQuestions(cached);
      setLoading(false);
    }
    setFetchError(null);
    try {
      const ref = collection(db, "users", user.uid, "customQuestions");
      const snap = await getDocs(query(ref, limit(200)));
      const data = sortQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setQuestions(data);
      writeQCache(user.uid, data);
    } catch (err) {
      console.warn("Failed to fetch custom questions:", err.message);
      if (!cached || cached.length === 0) {
        setFetchError("Couldn't connect to your question bank. Check your internet and tap Retry.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkImport() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 100);
    if (lines.length === 0) return;
    setImporting(true);
    setImportMsg("");
    setImportProgress({ current: 0, total: lines.length });

    const ref = collection(db, "users", user.uid, "customQuestions");
    const addedAt = new Date().toISOString();
    let imported = 0;
    let firstError = null;

    // Write every question independently — one failure never blocks the rest
    for (let i = 0; i < lines.length; i++) {
      try {
        await addDoc(ref, {
          text: lines[i],
          source: "custom",
          addedAt,
          attempts: 0,
          bestScore: null,
          lastAttempted: null,
        });
        imported++;
      } catch (err) {
        if (!firstError) firstError = err;
        console.error(`Failed to save question ${i + 1}:`, err.code, err.message);
      }
      setImportProgress({ current: i + 1, total: lines.length });
    }

    setImporting(false);
    setImportProgress(null);

    if (imported === 0) {
      // Nothing saved — show the actual Firebase error code so it's diagnosable
      const code = firstError?.code || "unknown";
      setImportMsg(`Import failed (${code}) — check your connection and try again`);
      return;
    }

    // Partial or full success
    setBulkText("");
    const skipped = lines.length - imported;
    setImportMsg(
      skipped > 0
        ? `✓ Imported ${imported} questions (${skipped} skipped)`
        : `✓ Imported ${imported} question${imported !== 1 ? "s" : ""}`
    );
    setTimeout(() => setImportMsg(""), 5000);
    bustQCache(user.uid);
    await fetchQuestions();
  }

  async function handleDelete(questionId) {
    try {
      await deleteDoc(doc(db, "users", user.uid, "customQuestions", questionId));
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleAIClean() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAiCleaning(true);
    try {
      const { cleanBulkInputWithAI } = await import("../lib/openrouter.js");
      const cleaned = await cleanBulkInputWithAI(lines, "question");
      setBulkText(cleaned.join("\n"));
    } catch {}
    finally { setAiCleaning(false); }
  }

  // Step 1: show interviewer picker
  function handlePracticeClick(question) {
    setPickerQuestion(question);
  }

  // Step 2: interviewer chosen → launch interview directly
  function handleInterviewerSelected(interviewer) {
    const q = pickerQuestion;
    setPickerQuestion(null);

    const customQ = {
      id: q.id,
      text: q.text,
      company: interviewer.company || "Custom",
      type: "behavioral",
      isCustom: true,
      firestoreId: q.id,
    };

    if (setCustomQuestion) setCustomQuestion(customQ);
    if (setInterviewData) {
      setInterviewData({
        interviewer,
        questionType: "behavioral",
        question: customQ,
        company: interviewer.company || "Custom",
        isCustom: true,
      });
    }

    // Go directly to interview, not interviewHome
    setCurrentScreen("interview");
  }

  const bulkLineCount = bulkText.split("\n").filter(l => l.trim()).length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <button
          onClick={() => setCurrentScreen("interviewHome")}
          style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}
        >
          ← Back
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 6, letterSpacing: "-0.5px" }}>
          My Question Bank
        </div>
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          Add questions you've been asked in real interviews or want to practice
        </div>
      </div>

      {/* Bulk import */}
      <div style={{ ...glassCard, padding: "20px", marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Bulk Import
        </div>
        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={"Paste questions — one per line\n\nExample:\nTell me about a time you influenced without authority.\nHow do you prioritize features on a roadmap?\nDescribe a product you improved significantly."}
          rows={6}
          style={{
            width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 14,
            lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit",
            boxSizing: "border-box", marginBottom: 12,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {bulkLineCount > 0 ? `${Math.min(bulkLineCount, 100)} question${bulkLineCount !== 1 ? "s" : ""} to import` : "One question per line"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {importMsg && (
              <span style={{ fontSize: 12, color: importMsg.includes("failed") ? "#f43f5e" : "#10b981", fontWeight: 600 }}>{importMsg}</span>
            )}
            {bulkLineCount > 2 && (
              <button
                onClick={handleAIClean}
                disabled={aiCleaning}
                style={{ padding: "10px 16px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {aiCleaning ? "Cleaning…" : "✨ AI Clean"}
              </button>
            )}
            <button
              onClick={handleBulkImport}
              disabled={importing || bulkLineCount === 0}
              style={{
                padding: "10px 20px",
                background: importing ? "rgba(255,255,255,0.08)" : bulkLineCount > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
                color: bulkLineCount > 0 && !importing ? "#fff" : "#64748b",
                border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                cursor: bulkLineCount > 0 && !importing ? "pointer" : "default",
                minWidth: 120,
              }}
            >
              {importing ? (importProgress ? `Importing ${importProgress.current}/${importProgress.total}…` : "Importing…") : `Import${bulkLineCount > 0 ? ` ${Math.min(bulkLineCount, 100)}` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
        Your Questions ({questions.length})
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div style={{
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.5 }}>{fetchError}</span>
          <button
            onClick={() => fetchQuestions()}
            style={{
              flexShrink: 0, padding: "6px 14px", background: "rgba(244,63,94,0.15)",
              border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8,
              color: "#f43f5e", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && questions.length === 0 ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>Loading your questions...</div>
      ) : !fetchError && questions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>No custom questions yet</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Paste questions above to get started</div>
        </div>
      ) : (
        questions.map(q => (
          <div key={q.id} style={{ ...glassCard, padding: "16px 18px", marginBottom: 10 }}>
            <div style={{ fontSize: 14, color: "#f1f5f9", lineHeight: 1.5, marginBottom: 10 }}>
              {q.text}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b" }}>
                {q.attempts > 0 && <span>Attempted {q.attempts}×</span>}
                {q.bestScore && (
                  <span style={{ color: q.bestScore >= 4 ? "#10b981" : q.bestScore >= 3 ? "#f59e0b" : "#f43f5e" }}>
                    Best: {q.bestScore}/5
                  </span>
                )}
                {q.lastAttempted && (
                  <span>Last: {new Date(q.lastAttempted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleDelete(q.id)}
                  style={{
                    background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
                    borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#f43f5e", cursor: "pointer",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => handlePracticeClick(q)}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", borderRadius: 8, padding: "5px 14px",
                    fontSize: 12, color: "#fff", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Practice Now →
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      <div style={{ height: 40 }} />

      {/* Interviewer Picker Modal */}
      {pickerQuestion && (
        <InterviewerPicker
          question={pickerQuestion}
          onSelect={handleInterviewerSelected}
          onCancel={() => setPickerQuestion(null)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "24px 20px",
    paddingBottom: 100,
    minHeight: "100%",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};
