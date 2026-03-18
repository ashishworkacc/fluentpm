import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

export default function CustomQuestionsScreen({ user, setCurrentScreen, setCustomQuestion, setInterviewData }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    fetchQuestions();
  }, [user.uid]);

  async function fetchQuestions() {
    try {
      const ref = collection(db, "users", user.uid, "customQuestions");
      const q = query(ref, orderBy("addedAt", "desc"));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn("Failed to fetch custom questions:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkImport() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 50);
    if (lines.length === 0) return;
    setImporting(true);
    try {
      const ref = collection(db, "users", user.uid, "customQuestions");
      for (const text of lines) {
        await addDoc(ref, {
          text,
          source: "custom",
          addedAt: serverTimestamp(),
          attempts: 0,
          bestScore: null,
          lastAttempted: null,
        });
      }
      setBulkText("");
      setImportMsg(`Imported ${lines.length} question${lines.length !== 1 ? "s" : ""}`);
      setTimeout(() => setImportMsg(""), 3000);
      await fetchQuestions();
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(questionId) {
    try {
      await deleteDoc(doc(db, "users", user.uid, "customQuestions", questionId));
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  function handlePractice(question) {
    // Build a minimal interviewData using the custom question
    const customQ = {
      id: question.id,
      text: question.text,
      company: "Custom",
      type: "behavioral",
      isCustom: true,
      firestoreId: question.id,
    };
    if (setCustomQuestion) setCustomQuestion(customQ);
    if (setInterviewData) {
      setInterviewData({
        interviewer: null, // Will be handled in InterviewScreen
        questionType: "behavioral",
        question: customQ,
        company: "Custom",
        isCustom: true,
      });
    }
    setCurrentScreen("interviewHome");
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {bulkLineCount > 0 ? `${Math.min(bulkLineCount, 50)} question${bulkLineCount !== 1 ? "s" : ""} to import` : ""}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {importMsg && (
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ {importMsg}</span>
            )}
            <button
              onClick={handleBulkImport}
              disabled={importing || bulkLineCount === 0}
              style={{
                padding: "10px 20px", background: bulkLineCount > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
                color: bulkLineCount > 0 ? "#fff" : "#64748b", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: bulkLineCount > 0 ? "pointer" : "default",
              }}
            >
              {importing ? "Importing..." : `Import ${bulkLineCount > 0 ? bulkLineCount : ""} question${bulkLineCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
        Your Questions ({questions.length})
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>Loading...</div>
      ) : questions.length === 0 ? (
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b" }}>
                {q.attempts > 0 && (
                  <span>Attempted {q.attempts}×</span>
                )}
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
                  style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#f43f5e", cursor: "pointer" }}
                >
                  Delete
                </button>
                <button
                  onClick={() => handlePractice(q)}
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Practice Now →
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 20px",
    paddingBottom: 100,
    minHeight: "100%",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};
