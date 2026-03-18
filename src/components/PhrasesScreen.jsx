import { useState } from "react";
import { PHRASE_CATEGORIES, ALL_PHRASES } from "../data/phrases.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getPhraseOfTheDay() {
  const today = getTodayDateString();
  const seed = seededRandom(today);
  return ALL_PHRASES[seed % ALL_PHRASES.length];
}

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const CATEGORY_KEYS = Object.keys(PHRASE_CATEGORIES);
const CATEGORY_LABELS = CATEGORY_KEYS.map(k => PHRASE_CATEGORIES[k].label);

// ── Sub-components ────────────────────────────────────────────────────────────

function PhraseOfDayCard({ phrase }) {
  return (
    <div style={{
      ...glassCard,
      padding: "20px 18px",
      marginBottom: 16,
      background: "rgba(99,102,241,0.08)",
      border: "1px solid rgba(99,102,241,0.2)",
      boxShadow: "0 0 0 1px rgba(99,102,241,0.12), 0 16px 40px rgba(99,102,241,0.08)",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6366f1",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        marginBottom: 12,
      }}>
        PHRASE OF THE DAY
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: "#f1f5f9",
        lineHeight: 1.5,
        marginBottom: 10,
      }}>
        "{phrase.text}"
      </div>
      <div style={{
        fontSize: 13,
        color: "#94a3b8",
        lineHeight: 1.55,
        marginBottom: 12,
        fontStyle: "italic",
      }}>
        {phrase.situationNote}
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#06b6d4",
        background: "rgba(6,182,212,0.1)",
        border: "1px solid rgba(6,182,212,0.2)",
        padding: "3px 10px",
        borderRadius: 20,
      }}>
        {phrase.whenToUse}
      </span>
    </div>
  );
}

function PhraseCard({ phrase }) {
  return (
    <div style={{
      ...glassCard,
      padding: "16px 16px",
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: "#f1f5f9",
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
        "{phrase.text}"
      </div>
      {phrase.situationNote && (
        <div style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 8,
          lineHeight: 1.4,
        }}>
          {phrase.situationNote}
        </div>
      )}
      {phrase.whenToUse && (
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#06b6d4",
          background: "rgba(6,182,212,0.08)",
          border: "1px solid rgba(6,182,212,0.15)",
          padding: "3px 10px",
          borderRadius: 20,
        }}>
          {phrase.whenToUse.length > 60 ? phrase.whenToUse.slice(0, 60) + "…" : phrase.whenToUse}
        </span>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PhrasesScreen({ setCurrentScreen }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const phraseOfDay = getPhraseOfTheDay();
  const activePhrases = PHRASE_CATEGORIES[CATEGORY_KEYS[activeCategory]]?.phrases || [];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>Phrase Bank</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          {ALL_PHRASES.length} phrases
        </div>
      </div>

      {/* Phrase of the Day */}
      <PhraseOfDayCard phrase={phraseOfDay} />

      {/* Category tabs */}
      <div style={styles.tabScrollContainer}>
        <div style={styles.tabRow}>
          {CATEGORY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              style={{
                ...styles.tabBtn,
                background: activeCategory === i
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.04)",
                border: activeCategory === i
                  ? "1px solid rgba(99,102,241,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
                color: activeCategory === i ? "#818cf8" : "#64748b",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category description */}
      <div style={styles.categoryDesc}>
        {PHRASE_CATEGORIES[CATEGORY_KEYS[activeCategory]]?.description}
      </div>

      {/* Phrases list */}
      {activePhrases.map((phrase, i) => (
        <PhraseCard key={i} phrase={phrase} />
      ))}

      <div style={{ height: 24 }} />
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
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
  },
  tabScrollContainer: {
    overflowX: "auto",
    marginBottom: 16,
    paddingBottom: 4,
  },
  tabRow: {
    display: "flex",
    gap: 8,
    minWidth: "max-content",
  },
  tabBtn: {
    padding: "7px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
    letterSpacing: "0.2px",
  },
  categoryDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.55,
    marginBottom: 16,
    fontStyle: "italic",
  },
};
