import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";

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

const SKILL_OPTIONS = [
  "Leadership", "Execution", "Analytical", "Communication",
  "Product Sense", "Conflict", "Failure", "Other",
];

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange && onChange(s)}
          style={{
            background: "none",
            border: "none",
            cursor: onChange ? "pointer" : "default",
            fontSize: 20,
            color: s <= value ? "#f59e0b" : "rgba(255,255,255,0.15)",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

async function enrichStory(situation, action, result) {
  const prompt = `You are a PM interview coach. A candidate has a STAR story.
Situation: "${situation}"
Action: "${action}"
Result: "${result}"

Evaluate and return ONLY valid JSON (no markdown):
{
  "improvedResult": "a stronger version of the result — add specifics or a metric if missing, keep it concise",
  "substanceScore": 1,
  "hasMetric": false
}

Rules:
- substanceScore is 1-5 (1=very weak, 3=average, 5=exceptional)
- hasMetric: true if result contains a number/percentage/time
- improvedResult: if result already has a good metric, return it unchanged. Otherwise add one plausible metric.`;

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
        max_tokens: 300,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function StoryCard({ story, onExpand, expanded }) {
  return (
    <div
      onClick={() => onExpand(story.id)}
      style={{
        ...glassCard,
        padding: "16px 18px",
        marginBottom: 10,
        cursor: "pointer",
        border: expanded ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded ? 12 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{story.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {story.skill && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: "rgba(99,102,241,0.12)", color: "#818cf8",
              }}>{story.skill}</span>
            )}
            <StarRating value={story.strength || 0} />
            {story.lastUsed && (
              <span style={{ fontSize: 11, color: "#475569" }}>Used {story.lastUsed}</span>
            )}
          </div>
        </div>
        <span style={{ color: "#334155", fontSize: 18, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>›</span>
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          {story.situation && (
            <div style={styles.starSection}>
              <div style={styles.starLabel}>S — Situation</div>
              <div style={styles.starText}>{story.situation}</div>
            </div>
          )}
          {story.task && (
            <div style={styles.starSection}>
              <div style={styles.starLabel}>T — Task</div>
              <div style={styles.starText}>{story.task}</div>
            </div>
          )}
          {story.action && (
            <div style={styles.starSection}>
              <div style={styles.starLabel}>A — Action</div>
              <div style={styles.starText}>{story.action}</div>
            </div>
          )}
          {story.result && (
            <div style={styles.starSection}>
              <div style={styles.starLabel}>R — Result</div>
              <div style={styles.starText}>{story.result}</div>
              {story.improvedResult && story.improvedResult !== story.result && (
                <div style={{
                  marginTop: 8,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>AI suggestion</div>
                  <div style={{ fontSize: 13, color: "#fbbf24", lineHeight: 1.5 }}>{story.improvedResult}</div>
                </div>
              )}
            </div>
          )}
          {story.substanceScore && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Substance:</span>
              <StarRating value={story.substanceScore} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddStoryModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState(null);
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [strength, setStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSave = title.trim() && situation.trim() && action.trim() && result.trim();

  async function handleSave() {
    if (!canSave) return;
    setLoading(true);
    setError(null);
    try {
      const enrichment = await enrichStory(situation, action, result);
      await onSave({
        title: title.trim(),
        skill: skill || "Other",
        situation: situation.trim(),
        task: task.trim(),
        action: action.trim(),
        result: result.trim(),
        strength,
        improvedResult: enrichment?.improvedResult || result.trim(),
        substanceScore: enrichment?.substanceScore || 3,
        hasMetric: enrichment?.hasMetric || false,
      });
      onClose();
    } catch (err) {
      setError("Failed to save story. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const textarea = (value, onChange, placeholder, rows = 3) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={styles.textarea}
    />
  );

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Add Story</div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.fieldLabel}>Story name</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 'Led cross-functional launch'"
          style={styles.input}
          autoFocus
        />

        <div style={styles.fieldLabel}>Skill tag</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {SKILL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSkill(skill === s ? null : s)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: skill === s ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                border: skill === s ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                color: skill === s ? "#818cf8" : "#64748b",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={styles.fieldLabel}>S — Situation</div>
        {textarea(situation, setSituation, "Set the context. What was happening?")}

        <div style={styles.fieldLabel}>T — Task</div>
        {textarea(task, setTask, "What were you responsible for?", 2)}

        <div style={styles.fieldLabel}>A — Action (focus on I, not we)</div>
        {textarea(action, setAction, "What specifically did YOU do? Be concrete.")}

        <div style={styles.fieldLabel}>R — Result</div>
        {textarea(result, setResult, "What was the outcome? Include a number if possible.")}

        <div style={styles.fieldLabel}>Personal rating</div>
        <StarRating value={strength} onChange={setStrength} />

        {error && (
          <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, padding: "10px 12px", color: "#f43f5e", fontSize: 13, marginTop: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave || loading}
          style={{
            width: "100%",
            padding: "14px",
            background: canSave && !loading ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
            color: canSave && !loading ? "#fff" : "#64748b",
            border: "none",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            cursor: canSave && !loading ? "pointer" : "default",
            marginTop: 16,
            boxSizing: "border-box",
          }}
        >
          {loading ? "Saving & enriching..." : "Save Story"}
        </button>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export default function StoryBankScreen({ user, setCurrentScreen }) {
  const [stories, setStories] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStories();
  }, [user.uid]);

  async function fetchStories() {
    try {
      const ref = collection(db, "users", user.uid, "storybank");
      const q = query(ref, orderBy("savedAt", "desc"));
      const snap = await getDocs(q);
      setStories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn("Failed to fetch stories:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(storyData) {
    await addDoc(collection(db, "users", user.uid, "storybank"), {
      ...storyData,
      savedAt: serverTimestamp(),
      lastUsed: null,
    });
    await fetchStories();
  }

  function handleExpand(id) {
    setExpandedId(expandedId === id ? null : id);
  }

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <button
          onClick={() => setCurrentScreen("interviewHome")}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0 }}
        >
          ← Back
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", marginBottom: 6, letterSpacing: "-0.5px" }}>
          Your Story Bank
        </div>
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
          Pre-build your best STAR stories. They'll be available in every interview.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading...</div>
      ) : stories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
          <div style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>No stories yet</div>
          <div style={{ fontSize: 13, color: "#475569" }}>Tap + to add your first STAR story.</div>
        </div>
      ) : (
        stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            expanded={expandedId === story.id}
            onExpand={handleExpand}
          />
        ))
      )}

      {showModal && (
        <AddStoryModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      <button
        onClick={() => setShowModal(true)}
        style={styles.fab}
      >
        +
      </button>

      <div style={{ height: 80 }} />
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
  starSection: {
    marginBottom: 12,
  },
  starLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 4,
  },
  starText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.55,
  },
  fab: {
    position: "fixed",
    bottom: 88,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: 28,
    fontWeight: 300,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
    zIndex: 50,
    lineHeight: 1,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,8,24,0.85)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 200,
    overflowY: "auto",
  },
  modalCard: {
    width: "100%",
    maxWidth: 680,
    background: "rgba(15,16,40,0.98)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px 24px 0 0",
    padding: "24px 20px",
    maxHeight: "92dvh",
    overflowY: "auto",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 16,
    cursor: "pointer",
    padding: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#f1f5f9",
    fontSize: 14,
    lineHeight: 1.5,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 4,
  },
  textarea: {
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
    marginBottom: 4,
  },
};
