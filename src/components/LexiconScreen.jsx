import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { enrichExpression } from "../lib/openrouter.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const STATUS_COLORS = {
  new: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  practising: { bg: "rgba(6,182,212,0.12)", color: "#06b6d4" },
  active: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  mastered: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
};

const DIFF_COLORS = {
  easy: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  medium: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  hard: { bg: "rgba(244,63,94,0.12)", color: "#f43f5e" },
};

const SOURCE_TAGS = ["Article", "Podcast", "Book", "Conversation"];

const TAB_LABELS = ["All Saved", "Due for Practice", "Mastered"];

function getDifficultyFromNaturalness(rating) {
  if (!rating) return "medium";
  if (rating <= 2) return "hard";
  if (rating <= 3) return "medium";
  return "easy";
}

function isOverdue(item) {
  if (item.status === "mastered") return false;
  if (!item.lastUsedDate) return true;
  const last = new Date(item.lastUsedDate);
  const now = new Date();
  const diffDays = (now - last) / (1000 * 60 * 60 * 24);
  return diffDays > 3;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: "50%",
      border: "2px solid rgba(99,102,241,0.2)",
      borderTopColor: "#6366f1",
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  );
}

function CaptureModal({ onClose, onSave }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const enriched = await enrichExpression(text.trim());
      if (!enriched) throw new Error("Enrichment failed. Try again.");
      await onSave(text.trim(), enriched, source);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Add Expression</div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste an expression you want to learn..."
          rows={4}
          style={styles.captureTextarea}
          autoFocus
        />

        <div style={{ marginBottom: 16 }}>
          <div style={styles.sourceLabelText}>Source</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SOURCE_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setSource(source === tag ? null : tag)}
                style={{
                  ...styles.sourceTagBtn,
                  background: source === tag ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                  border: source === tag
                    ? "1px solid rgba(99,102,241,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: source === tag ? "#818cf8" : "#64748b",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={!text.trim() || loading}
          style={{
            ...styles.saveBtn,
            opacity: !text.trim() || loading ? 0.5 : 1,
            cursor: !text.trim() || loading ? "default" : "pointer",
          }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Spinner /> Enriching...
            </span>
          ) : "Save Expression"}
        </button>
      </div>
    </div>
  );
}

function ToneTab({ variants }) {
  const [activeTone, setActiveTone] = useState(0);
  if (!variants || variants.length === 0) return null;

  const toneLabels = ["Softened", "Original", "Firm"];
  const displayVariants = variants.slice(0, 3);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {displayVariants.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveTone(i)}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: activeTone === i ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
              color: activeTone === i ? "#818cf8" : "#64748b",
            }}
          >
            {toneLabels[i] || `Variant ${i + 1}`}
          </button>
        ))}
      </div>
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "12px 14px",
      }}>
        <div style={{ fontSize: 14, color: "#f1f5f9", lineHeight: 1.5 }}>
          "{displayVariants[activeTone]}"
        </div>
      </div>
    </div>
  );
}

function ExpressionCard({ item, onMarkMastered }) {
  const [expanded, setExpanded] = useState(false);
  const naturalness = item.enriched?.naturalness;
  const difficulty = getDifficultyFromNaturalness(naturalness?.rating);
  const diffStyle = DIFF_COLORS[difficulty] || DIFF_COLORS.medium;
  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.new;

  const example = item.enriched?.example || "";
  // Bold stressed word — look for a word wrapped in asterisks or just show as-is
  const formattedExample = example;

  return (
    <div
      style={{
        ...glassCard,
        padding: "14px 16px",
        marginBottom: 10,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded ? 12 : 0 }}>
        <div style={{ flex: 1, paddingRight: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4, marginBottom: 6 }}>
            {item.expression}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: diffStyle.bg, color: diffStyle.color,
            }}>
              {difficulty}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: statusStyle.bg, color: statusStyle.color,
              textTransform: "capitalize",
            }}>
              {item.status || "new"}
            </span>
            {item.source && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                background: "rgba(6,182,212,0.08)", color: "#06b6d4",
              }}>
                {item.source}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 18, color: "#334155", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>
          ›
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div onClick={e => e.stopPropagation()}>
          {item.enriched?.whenToUse && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>When to use</div>
              <div style={styles.detailText}>{item.enriched.whenToUse}</div>
            </div>
          )}

          {item.enriched?.meaning && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Meaning</div>
              <div style={styles.detailText}>{item.enriched.meaning}</div>
            </div>
          )}

          {formattedExample && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Example</div>
              <div style={{ ...styles.detailText, fontStyle: "italic", color: "#a5f3fc" }}>
                "{formattedExample}"
              </div>
            </div>
          )}

          {/* Similar expressions chips */}
          {item.enriched?.variants && item.enriched.variants.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={styles.detailLabel}>Similar expressions</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {item.enriched.variants.slice(0, 3).map((v, i) => (
                  <span key={i} style={{
                    fontSize: 12, color: "#94a3b8", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
                    padding: "3px 10px",
                  }}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tone tabs */}
          {item.enriched?.variants && (
            <ToneTab variants={item.enriched.variants} />
          )}

          {/* Naturalness badge */}
          {naturalness && naturalness.rating <= 3 && (
            <div style={{ marginTop: 12 }}>
              {naturalness.rating === 3 ? (
                <span style={{
                  fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
                  padding: "3px 10px", fontWeight: 600,
                }}>
                  Slightly Formal
                </span>
              ) : (
                <div style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>
                    ⚠ {naturalness.label}
                  </div>
                  {naturalness.alternative && (
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                      Say instead: <strong>"{naturalness.alternative}"</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {item.status !== "mastered" && (
            <button
              onClick={() => onMarkMastered(item.id)}
              style={styles.masterBtn}
            >
              Mark as Mastered ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LexiconScreen({ user, setCurrentScreen }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [showCapture, setShowCapture] = useState(false);

  useEffect(() => {
    fetchLexicon();
  }, [user.uid]);

  async function fetchLexicon() {
    try {
      const ref = collection(db, "users", user.uid, "lexicon");
      const q = query(ref, orderBy("savedAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
    } catch (err) {
      console.warn("Failed to fetch lexicon:", err.message);
    }
  }

  async function handleSave(expression, enriched, source) {
    const newItem = {
      expression,
      enriched,
      source: source || null,
      status: "new",
      usedInBattles: 0,
      savedAt: new Date().toISOString(),
      lastUsedDate: null,
    };
    await addDoc(collection(db, "users", user.uid, "lexicon"), newItem);
    await fetchLexicon();
  }

  async function handleMarkMastered(itemId) {
    const ref = doc(db, "users", user.uid, "lexicon", itemId);
    await updateDoc(ref, { status: "mastered" });
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: "mastered" } : it));
  }

  // Tab filtering
  let filteredItems = [];
  if (activeTab === 0) {
    filteredItems = [...items];
  } else if (activeTab === 1) {
    filteredItems = items
      .filter(it => it.status !== "mastered")
      .sort((a, b) => {
        if (!a.lastUsedDate && !b.lastUsedDate) return new Date(a.savedAt) - new Date(b.savedAt);
        if (!a.lastUsedDate) return -1;
        if (!b.lastUsedDate) return 1;
        return new Date(a.lastUsedDate) - new Date(b.lastUsedDate);
      });
  } else if (activeTab === 2) {
    filteredItems = items.filter(it => it.status === "mastered");
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>Lexicon</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          {items.length} saved
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabRow}>
        {TAB_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              ...styles.tabBtn,
              background: activeTab === i ? "rgba(99,102,241,0.15)" : "transparent",
              color: activeTab === i ? "#818cf8" : "#64748b",
              borderBottom: activeTab === i ? "2px solid #6366f1" : "2px solid transparent",
            }}
          >
            {label}
            {i === 1 && (() => {
              const dueCount = items.filter(it => it.status !== "mastered" && isOverdue(it)).length;
              return dueCount > 0 ? (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                  background: "rgba(244,63,94,0.15)", color: "#f43f5e",
                  padding: "1px 6px", borderRadius: 20,
                }}>
                  {dueCount}
                </span>
              ) : null;
            })()}
          </button>
        ))}
      </div>

      {/* Expression list */}
      {filteredItems.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, color: "#94a3b8", fontWeight: 600 }}>
            {activeTab === 0
              ? "No expressions saved yet"
              : activeTab === 1
                ? "Nothing due for practice"
                : "No mastered expressions yet"}
          </div>
          {activeTab === 0 && (
            <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
              Tap + to add your first expression.
            </div>
          )}
        </div>
      ) : (
        filteredItems.map(item => (
          <ExpressionCard key={item.id} item={item} onMarkMastered={handleMarkMastered} />
        ))
      )}

      {/* Capture modal */}
      {showCapture && (
        <CaptureModal
          onClose={() => setShowCapture(false)}
          onSave={handleSave}
        />
      )}

      {/* + FAB */}
      <button
        onClick={() => setShowCapture(true)}
        style={styles.fab}
      >
        +
      </button>

      <div style={{ height: 80 }} />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 20px",
    paddingTop: 80,
    paddingBottom: 100,
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: "slideUp 0.3s ease",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
  },
  tabRow: {
    display: "flex",
    gap: 0,
    marginBottom: 16,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tabBtn: {
    flex: 1,
    padding: "10px 8px",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.15s",
    letterSpacing: "0.2px",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.55,
  },
  masterBtn: {
    marginTop: 14,
    width: "100%",
    padding: "10px",
    background: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: 10,
    color: "#10b981",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
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
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,8,24,0.85)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 200,
    padding: "0 0 0 0",
  },
  modalCard: {
    width: "100%",
    maxWidth: 680,
    background: "rgba(15,16,40,0.98)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px 24px 0 0",
    padding: "24px 20px 40px",
    animation: "slideUp 0.25s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 16,
    cursor: "pointer",
    padding: 4,
  },
  captureTextarea: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    color: "#f1f5f9",
    fontSize: 15,
    lineHeight: 1.6,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 14,
  },
  sourceLabelText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 8,
  },
  sourceTagBtn: {
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    background: "rgba(244,63,94,0.08)",
    border: "1px solid rgba(244,63,94,0.2)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#f43f5e",
    fontSize: 13,
    marginBottom: 12,
  },
  saveBtn: {
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
};
