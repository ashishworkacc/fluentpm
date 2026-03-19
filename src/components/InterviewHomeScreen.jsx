import { useState } from "react";
import { INTERVIEWERS, INTERVIEW_TYPES } from "../data/interviewers.js";
import { INTERVIEW_QUESTIONS } from "../data/interviewQuestions.js";
import { filterUnseenQuestions } from "../lib/questionHistory.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Glass card ────────────────────────────────────────────────────────────────

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

// ── Aggression badge colors ───────────────────────────────────────────────────

function aggressionBadgeStyle(aggression) {
  const map = {
    high: { bg: "rgba(244,63,94,0.12)", color: "#f43f5e" },
    medium: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
    low: { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
  };
  const s = map[aggression] || map.medium;
  return {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 20,
    background: s.bg,
    color: s.color,
    textTransform: "capitalize",
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

const DRILL_CARDS = [
  {
    id: "storyBank",
    title: "Story Bank",
    desc: "Pre-build your STAR stories",
    icon: "📖",
    color: "#8b5cf6",
  },
  {
    id: "pushbackDrill",
    title: "Pushback Drill",
    desc: "Answer + defend under 3 challenges",
    icon: "🥊",
    color: "#f43f5e",
  },
  {
    id: "quickDrill",
    title: "Quick Drill",
    desc: "One question, 90 seconds",
    icon: "⚡",
    color: "#f59e0b",
  },
  {
    id: "customQuestions",
    title: "My Question Bank",
    desc: "Practice your own interview questions",
    icon: "📝",
    color: "#06b6d4",
  },
];

export default function InterviewHomeScreen({ user, setCurrentScreen, setInterviewData, setCustomQuestion }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedInterviewer, setSelectedInterviewer] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState("All");

  const companies = ["All", "Google", "Meta", "Amazon", "Startup"];

  function handleStart() {
    if (!selectedType || !selectedInterviewer) return;

    const questions = INTERVIEW_QUESTIONS[selectedType] || [];
    let filtered = questions;
    if (selectedCompany !== "All") {
      filtered = questions.filter(q => q.company === selectedCompany || q.company === "General");
    }
    if (filtered.length === 0) filtered = questions;

    // Use filterUnseenQuestions to prioritise unseen questions
    const prioritised = filterUnseenQuestions(user.uid, filtered);
    const question = prioritised[0] || filtered[0];

    setInterviewData({
      interviewer: selectedInterviewer,
      questionType: selectedType,
      question,
      company: selectedCompany,
    });
    setCurrentScreen("interview");
  }

  const canStart = selectedType && selectedInterviewer;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>PM Interview Prep</div>
        <div style={styles.subtitle}>Practice real PM interviews. Get a hire / no-hire verdict.</div>
      </div>

      {/* Interview Type Section */}
      <div style={styles.sectionLabel}>Choose interview type</div>
      <div style={styles.typeGrid}>
        {INTERVIEW_TYPES.map((type) => {
          const active = selectedType === type.id;
          return (
            <div
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              style={{
                ...glassCard,
                padding: "14px 16px",
                cursor: "pointer",
                border: active
                  ? "1px solid rgba(99,102,241,0.7)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(99,102,241,0.1)" : "rgba(15,16,40,0.82)",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{type.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>
                    {type.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                    {type.description}
                  </div>
                </div>
              </div>
              {/* Framework badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {type.frameworks.map((fw) => (
                  <span key={fw} style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#818cf8",
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 10,
                    padding: "2px 8px",
                  }}>{fw}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Company Filter */}
      <div style={styles.sectionLabel}>Filter by company</div>
      <div style={styles.chipRow}>
        {companies.map((c) => {
          const active = selectedCompany === c;
          return (
            <button
              key={c}
              onClick={() => setSelectedCompany(c)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: active ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.1)",
                background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                color: active ? "#a5b4fc" : "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Interviewer Section */}
      <div style={styles.sectionLabel}>Choose your interviewer</div>
      <div style={styles.interviewerList}>
        {INTERVIEWERS.map((iv) => {
          const active = selectedInterviewer?.id === iv.id;
          return (
            <div
              key={iv.id}
              onClick={() => setSelectedInterviewer(iv)}
              style={{
                ...glassCard,
                padding: "14px 16px",
                cursor: "pointer",
                border: active
                  ? "2px solid rgba(99,102,241,0.7)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(99,102,241,0.08)" : "rgba(15,16,40,0.82)",
                transition: "all 0.15s",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{iv.avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{iv.name}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                      background: "rgba(255,255,255,0.06)",
                      padding: "2px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}>{iv.company}</span>
                    <span style={aggressionBadgeStyle(iv.aggression)}>{iv.aggression}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{iv.role}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{iv.style}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill Tools */}
      <div style={styles.sectionLabel}>Drill tools</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {DRILL_CARDS.map((card) => (
          <div
            key={card.id}
            onClick={() => setCurrentScreen(card.id)}
            style={{
              ...glassCard,
              padding: "14px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              border: `1px solid ${card.color}33`,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 26 }}>{card.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{card.desc}</div>
            </div>
            <span style={{ color: card.color, fontSize: 16, fontWeight: 700 }}>→</span>
          </div>
        ))}
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={!canStart}
        style={{
          width: "100%",
          padding: "16px",
          background: canStart
            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
            : "rgba(255,255,255,0.06)",
          color: canStart ? "#ffffff" : "#64748b",
          border: canStart ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: canStart ? "pointer" : "default",
          transition: "all 0.2s",
          marginBottom: 32,
          letterSpacing: "0.2px",
        }}
      >
        {canStart ? "Start Interview →" : "Select type and interviewer to begin"}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "24px 20px 24px",
    paddingBottom: 100,
    minHeight: "100%",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    marginBottom: 28,
    paddingTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#f1f5f9",
    marginBottom: 6,
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 12,
    marginTop: 4,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 24,
  },
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  interviewerList: {
    marginBottom: 24,
  },
};
