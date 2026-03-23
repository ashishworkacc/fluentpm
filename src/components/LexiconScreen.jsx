import { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { enrichExpression } from "../lib/openrouter.js";
import { logFailure, SEVERITY } from "../lib/failureTracker.js";
import { PHRASE_CATEGORIES } from "../data/phrases.js";
import { isDueForReview, getMasteryPercent, getNextReviewLabel, computeNextReview } from "../lib/expressionScheduler.js";

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
  // naturalness.rating: 1=Natural (easy) → 5=Corporate Jargon (hard)
  if (!rating) return "medium";
  if (rating >= 4) return "hard";
  if (rating >= 3) return "medium";
  return "easy";
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

function CaptureModal({ onClose, onSave, onBulkSave }) {
  const [mode, setMode] = useState("single"); // "single" | "bulk"
  const [text, setText] = useState("");
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bulk mode state
  const [bulkText, setBulkText] = useState("");
  const [bulkProgress, setBulkProgress] = useState(null); // null | { current, total }
  const [aiCleaning, setAiCleaning] = useState(false);

  async function handleAIClean() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAiCleaning(true);
    try {
      const { cleanBulkInputWithAI } = await import("../lib/openrouter.js");
      const cleaned = await cleanBulkInputWithAI(lines, "expression");
      setBulkText(cleaned.join("\n"));
    } catch {}
    finally { setAiCleaning(false); }
  }

  async function handleEnrich() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const enriched = await enrichExpression(text.trim());
      if (!enriched) throw new Error("Enrichment returned empty. Try again.");
      await onSave(text.trim(), enriched, source);
      setText("");
      setSource("");
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);   // ALWAYS runs, even on error
    }
  }

  async function handleBulkImport() {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await onBulkSave(lines, source); // saves instantly to Firestore, enrichment runs in background
      onClose();
    } catch (err) {
      setError("Failed to save. Try again.");
      setLoading(false);
    }
  }

  const bulkLines = bulkText.split("\n").filter(l => l.trim()).length;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Add Expression</div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Mode toggle — Single | Bulk */}
        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 20,
          padding: 3,
          marginBottom: 16,
          gap: 2,
        }}>
          {["single", "bulk"].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "7px 12px",
                borderRadius: 18,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: mode === m ? "rgba(99,102,241,0.3)" : "transparent",
                color: mode === m ? "#818cf8" : "#64748b",
                transition: "all 0.15s",
              }}
            >
              {m === "single" ? "Single" : "Bulk"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <>
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

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              onClick={handleEnrich}
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
          </>
        ) : (
          <>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Paste one expression per line..."
              style={{ ...styles.captureTextarea, height: 160, resize: "vertical" }}
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

            {error && <div style={styles.errorBox}>{error}</div>}

            {bulkLines > 2 && (
              <button
                onClick={handleAIClean}
                disabled={aiCleaning}
                style={{ width: "100%", padding: "10px 16px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}
              >
                {aiCleaning ? "Cleaning…" : "✨ AI Clean"}
              </button>
            )}

            <button
              onClick={handleBulkImport}
              disabled={bulkLines === 0 || loading}
              style={{
                ...styles.saveBtn,
                opacity: bulkLines === 0 || loading ? 0.5 : 1,
                cursor: bulkLines === 0 || loading ? "default" : "pointer",
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <Spinner /> Saving...
                </span>
              ) : `Import ${bulkLines > 0 ? bulkLines : ""} expression${bulkLines !== 1 ? "s" : ""}`}
            </button>
          </>
        )}
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

// ── Contextual Practice Modal ─────────────────────────────────────────────────

const PM_PROMPTS = [
  "You're presenting to a skeptical VP of Product. Use this expression to make your point land.",
  "A cross-functional partner just pushed back on your roadmap. Respond using this expression.",
  "You're in a sprint review and need to explain a decision. Work this expression into your response.",
  "A new stakeholder asks why a feature was cut. Use this expression in your answer.",
];

function ContextualPracticeModal({ item, onClose, onScored }) {
  const [userSentence, setUserSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const promptRef = useRef(PM_PROMPTS[Math.floor(Math.random() * PM_PROMPTS.length)]);

  const wordCount = userSentence.trim().split(/\s+/).filter(Boolean).length;
  const isReady = wordCount >= 6;

  async function handleSubmit() {
    if (!isReady) return;
    setLoading(true);
    setError(null);
    try {
      const { scoreContextualUsage } = await import("../lib/openrouter.js");
      const res = await scoreContextualUsage(item.expression, userSentence.trim());
      setResult(res);
      if (onScored) onScored(res.score);
    } catch {
      setError("Couldn't score your response. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const scoreColors = { 5: "#10b981", 4: "#10b981", 3: "#f59e0b", 2: "#f43f5e", 1: "#f43f5e" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: "100%", maxWidth: 680, background: "rgba(10,11,30,0.99)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Contextual Practice</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>{item.expression}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>

        {!result ? (
          <>
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Scenario</div>
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>{promptRef.current}</div>
            </div>

            <textarea
              value={userSentence}
              onChange={e => setUserSentence(e.target.value)}
              placeholder={`Write a sentence using "${item.expression}"...`}
              rows={4}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 14, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: wordCount >= 6 ? "#10b981" : "#64748b" }}>
                {wordCount} word{wordCount !== 1 ? "s" : ""} {wordCount < 6 ? "(min 6)" : "✓"}
              </span>
            </div>

            {error && <div style={{ fontSize: 12, color: "#f43f5e", marginBottom: 12 }}>{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={!isReady || loading}
              style={{ width: "100%", padding: "14px", background: isReady && !loading ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", color: isReady && !loading ? "#fff" : "#64748b", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: isReady && !loading ? "pointer" : "default" }}
            >
              {loading ? "Scoring…" : "Get Feedback →"}
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", padding: "20px 0", marginBottom: 16 }}>
              <div style={{ fontSize: 64, fontWeight: 900, color: scoreColors[result.score] || "#f59e0b", letterSpacing: "-2px", lineHeight: 1 }}>{result.score}/5</div>
              <div style={{ fontSize: 14, color: result.isNatural ? "#10b981" : "#f59e0b", marginTop: 8, fontWeight: 600 }}>
                {result.isNatural ? "✓ Natural usage" : "⚠ Forced — practice more"}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Coach's Feedback</div>
              <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.7 }}>{result.feedback}</div>
            </div>

            {result.example && (
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Example</div>
                <div style={{ fontSize: 14, color: "#a5b4fc", lineHeight: 1.6, fontStyle: "italic" }}>"{result.example}"</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setResult(null); setUserSentence(""); }} style={{ flex: 1, padding: "12px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, color: "#a5b4fc", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Try Again
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#94a3b8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExpressionCard({ item, onMarkMastered, onDelete, onPractice }) {
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
          {/* Mastery progress */}
          {(() => {
            const pct = getMasteryPercent(item);
            const barColor = item.status === "mastered" ? "#f59e0b" : pct >= 50 ? "#10b981" : "#6366f1";
            return (
              <div style={{ marginTop: 8, marginBottom: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                    {item.status === "mastered" ? "Mastered ✓" : `${pct}% to mastery`}
                  </span>
                  {(item.practiceCount || 0) > 0 && (
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      avg {item.avgScore || "—"}/5 · {item.practiceCount} practice{item.practiceCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, minWidth: pct > 0 ? 3 : 0 }} />
                </div>
                {item.nextReviewDate && (
                  <div style={{ fontSize: 10, color: isDueForReview(item) ? "#f43f5e" : "#475569", marginTop: 3, fontWeight: isDueForReview(item) ? 700 : 400 }}>
                    {getNextReviewLabel(item)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <span style={{ fontSize: 18, color: "#334155", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>
          ›
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div onClick={e => e.stopPropagation()}>
          {item.enriched?.definition && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Definition</div>
              <div style={styles.detailText}>{item.enriched.definition}</div>
            </div>
          )}

          {item.enriched?.hindi_meaning && (
            <div style={styles.detailRow}>
              <div style={styles.detailLabel}>Hindi</div>
              <div style={{ ...styles.detailText, color: "#f59e0b", fontWeight: 600 }}>{item.enriched.hindi_meaning}</div>
            </div>
          )}

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

          {item.enriched?.synonyms && item.enriched.synonyms.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={styles.detailLabel}>Synonyms</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {item.enriched.synonyms.slice(0, 4).map((s, i) => (
                  <span key={i} style={{
                    fontSize: 12, color: "#a5f3fc", background: "rgba(6,182,212,0.08)",
                    border: "1px solid rgba(6,182,212,0.2)", borderRadius: 20,
                    padding: "3px 10px",
                  }}>
                    {s}
                  </span>
                ))}
              </div>
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
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onPractice(item); }}
              style={{ padding: "10px 14px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1 }}
            >
              Practice →
            </button>
            {item.status !== "mastered" && (
              <button
                onClick={() => onMarkMastered(item.id)}
                style={{ ...styles.masterBtn, marginTop: 0, flex: 1 }}
              >
                Mark as Mastered ✓
              </button>
            )}
            <button
              onClick={() => onDelete(item.id)}
              style={{
                padding: "10px 14px",
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.2)",
                borderRadius: 10,
                color: "#f43f5e",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LexiconScreen({ user, setCurrentScreen }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [sectionTab, setSectionTab] = useState("my_lexicon");
  const [showCapture, setShowCapture] = useState(false);
  const [bgEnrichProgress, setBgEnrichProgress] = useState(null);
  const bgEnrichRef = useRef(false);
  const [practiceItem, setPracticeItem] = useState(null);

  useEffect(() => {
    fetchLexicon();
  }, [user.uid]);

  async function fetchLexicon() {
    try {
      const ref = collection(db, "users", user.uid, "lexicon");
      const q = query(ref, limit(500));
      const snap = await getDocs(q);
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.savedAt ? new Date(a.savedAt).getTime() : 0;
          const tb = b.savedAt ? new Date(b.savedAt).getTime() : 0;
          return tb - ta;
        });
      setItems(data);
    } catch (err) {
      console.warn("Failed to fetch lexicon:", err.message);
    }
  }

  async function handleSave(expression, enriched, source) {
    const newItem = {
      expression,
      enriched: enriched || null,
      source: source || null,
      status: "new",
      usedInBattles: 0,
      savedAt: new Date().toISOString(),
      lastUsedDate: null,
    };
    const docRef = await addDoc(collection(db, "users", user.uid, "lexicon"), newItem);
    await fetchLexicon();
    return docRef.id;
  }

  async function onBulkSave(expressions, source) {
    // Step 1: Write all docs to Firestore in parallel — Firestore handles concurrent writes fine.
    // Sequential writes (for...of await) caused ~200ms × N blocking; parallel is instant.
    const savedAt = new Date().toISOString();
    const refs = await Promise.all(
      expressions.map(expr =>
        addDoc(collection(db, "users", user.uid, "lexicon"), {
          expression: expr,
          enriched: null,
          source: source || null,
          status: "pending_enrichment",
          usedInBattles: 0,
          savedAt,
          lastUsedDate: null,
        })
      )
    );
    const docIds = expressions.map((expr, i) => ({ expr, id: refs[i].id }));

    // Show pending items immediately in UI (optimistic — no Firestore re-read needed)
    setItems(prev => [
      ...docIds.map(({ expr, id }) => ({
        id, expression: expr, enriched: null, source: source || null,
        status: "pending_enrichment", usedInBattles: 0, savedAt, lastUsedDate: null,
      })),
      ...prev,
    ]);

    // Step 2: Enrich sequentially in background (1 at a time avoids LLM rate limits)
    runBackgroundEnrichment(docIds);
  }

  async function runBackgroundEnrichment(docIds) {
    if (bgEnrichRef.current) return; // prevent duplicate runs
    bgEnrichRef.current = true;
    setBgEnrichProgress({ current: 0, total: docIds.length });

    for (let i = 0; i < docIds.length; i++) {
      const { expr, id } = docIds[i];
      try {
        const enriched = await enrichExpression(expr);
        if (enriched) {
          await updateDoc(doc(db, "users", user.uid, "lexicon", id), { enriched, status: "new" });
          // Update local state directly — no fetchLexicon() round-trip needed
          setItems(prev => prev.map(it =>
            it.id === id ? { ...it, enriched, status: "new" } : it
          ));
        }
      } catch (enrichErr) {
        logFailure(user, "Lexicon", SEVERITY.MEDIUM, "Background enrichment", enrichErr, { expression: expr });
      }
      setBgEnrichProgress({ current: i + 1, total: docIds.length });
    }

    setBgEnrichProgress(null);
    bgEnrichRef.current = false;
    // Single refresh at the very end to sync anything missed
    fetchLexicon();
  }

  async function handleMarkMastered(itemId) {
    const ref = doc(db, "users", user.uid, "lexicon", itemId);
    await updateDoc(ref, { status: "mastered" });
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: "mastered" } : it));
  }

  async function handleDelete(itemId) {
    try {
      await deleteDoc(doc(db, "users", user.uid, "lexicon", itemId));
      setItems(prev => prev.filter(it => it.id !== itemId));
    } catch (err) {
      console.error("Delete lexicon item error:", err);
    }
  }

  async function handleContextualScore(item, score) {
    const updates = computeNextReview(item, score);
    const ref = doc(db, "users", user.uid, "lexicon", item.id);
    await updateDoc(ref, updates);
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...updates } : it));
    setPracticeItem(null);
  }

  async function addPhraseToLexicon(phraseText) {
    if (items.some(l => l.expression === phraseText)) return;
    try {
      const ref = await addDoc(collection(db, "users", user.uid, "lexicon"), {
        expression: phraseText,
        enriched: null,
        source: "phrase_library",
        status: "pending_enrichment",
        usedInBattles: 0,
        savedAt: new Date().toISOString(),
        lastUsedDate: null,
      });
      await fetchLexicon();
      // Enrich in background
      enrichExpression(phraseText).then(enriched => {
        if (enriched) {
          updateDoc(doc(db, "users", user.uid, "lexicon", ref.id), { enriched, status: "new" })
            .catch(() => {});
        }
      }).catch(() => {});
    } catch (err) {
      console.error("Add phrase error:", err);
    }
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

      {/* Section tab switcher */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3, marginBottom: 20 }}>
        {["my_lexicon", "phrase_library"].map(tab => (
          <button
            key={tab}
            onClick={() => setSectionTab(tab)}
            style={{
              flex: 1, padding: "9px 12px",
              background: sectionTab === tab ? "rgba(99,102,241,0.3)" : "transparent",
              border: sectionTab === tab ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
              borderRadius: 10, color: sectionTab === tab ? "#a5b4fc" : "#64748b",
              fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {tab === "my_lexicon" ? "My Lexicon" : "Phrase Library"}
          </button>
        ))}
      </div>

      {/* Background enrichment progress bar (My Lexicon only) */}
      {sectionTab === "my_lexicon" && bgEnrichProgress && (
        <div style={{
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
          borderRadius: 12, padding: "10px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 4 }}>
              Enriching {bgEnrichProgress.current}/{bgEnrichProgress.total} expressions...
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${bgEnrichProgress.total > 0 ? (bgEnrichProgress.current / bgEnrichProgress.total) * 100 : 0}%`,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs (My Lexicon only) */}
      {sectionTab === "my_lexicon" && (
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
                const dueCount = items.filter(it => it.status !== "mastered" && isDueForReview(it)).length;
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
      )}

      {/* My Lexicon content */}
      {sectionTab === "my_lexicon" && (
        <>
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
              <ExpressionCard key={item.id} item={item} onMarkMastered={handleMarkMastered} onDelete={handleDelete} onPractice={(it) => setPracticeItem(it)} />
            ))
          )}

          {/* Trouble Expressions — shown only in All Saved tab */}
          {activeTab === 0 && (() => {
            const trouble = items
              .filter(i => i.status !== "mastered" && (i.practiceCount || 0) >= 1 && (i.avgScore || 5) < 3)
              .sort((a, b) => (a.avgScore || 0) - (b.avgScore || 0))
              .slice(0, 5);
            if (trouble.length === 0) return null;
            return (
              <div style={{ ...glassCard, padding: "16px 18px", marginBottom: 16, marginTop: 8, border: "1px solid rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
                  🎯 Trouble Expressions
                </div>
                {trouble.map((it, i) => (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 8, borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize: 13, color: "#cbd5e1", fontStyle: "italic" }}>"{it.expression}"</span>
                    <span style={{ fontSize: 11, color: "#f43f5e", fontWeight: 700, background: "rgba(244,63,94,0.12)", padding: "2px 8px", borderRadius: 10, flexShrink: 0, marginLeft: 8 }}>
                      avg {it.avgScore}/5
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* Phrase Library content */}
      {sectionTab === "phrase_library" && (
        <div>
          {Object.entries(PHRASE_CATEGORIES).map(([key, cat]) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {cat.label}
              </div>
              {cat.phrases.map((phrase, i) => {
                const alreadySaved = items.some(l => l.expression === phrase.text);
                return (
                  <div key={i} style={{
                    ...glassCard, padding: "12px 14px", marginBottom: 8,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>
                        "{phrase.text}"
                      </div>
                      {phrase.situationNote && (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{phrase.situationNote}</div>
                      )}
                    </div>
                    <button
                      onClick={() => addPhraseToLexicon(phrase.text)}
                      disabled={alreadySaved}
                      style={{
                        background: alreadySaved ? "rgba(16,185,129,0.1)" : "rgba(99,102,241,0.15)",
                        border: alreadySaved ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(99,102,241,0.3)",
                        borderRadius: 8, padding: "5px 12px", fontSize: 12,
                        color: alreadySaved ? "#10b981" : "#a5b4fc",
                        cursor: alreadySaved ? "default" : "pointer", flexShrink: 0, fontWeight: 600,
                      }}
                    >
                      {alreadySaved ? "Saved" : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Contextual Practice Modal */}
      {practiceItem && (
        <ContextualPracticeModal
          item={practiceItem}
          onClose={() => setPracticeItem(null)}
          onScored={(score) => handleContextualScore(practiceItem, score)}
        />
      )}

      {/* Capture modal */}
      {showCapture && (
        <CaptureModal
          onClose={() => setShowCapture(false)}
          onSave={handleSave}
          onBulkSave={onBulkSave}
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
    maxWidth: 900,
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
