import { useState } from "react";

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

const DIMENSIONS = [
  {
    key: "productSense",
    label: "Product Sense",
    icon: "💡",
    color: "#6366f1",
    descriptions: {
      1: "I struggled to identify the core product problem",
      2: "I had some ideas but they felt generic",
      3: "I gave a reasonable answer but nothing stood out",
      4: "I showed clear product thinking with specific insights",
      5: "I nailed the problem framing and solution space",
    },
  },
  {
    key: "analytical",
    label: "Analytical Thinking",
    icon: "📊",
    color: "#06b6d4",
    descriptions: {
      1: "I couldn't structure my thinking at all",
      2: "I tried to be logical but missed key factors",
      3: "I gave a decent breakdown but lacked depth",
      4: "I broke the problem down clearly with solid reasoning",
      5: "My analysis was crisp, quantified, and decisive",
    },
  },
  {
    key: "execution",
    label: "Execution",
    icon: "⚡",
    color: "#8b5cf6",
    descriptions: {
      1: "I had no real plan for how to execute",
      2: "I mentioned steps but they were vague",
      3: "I covered the basics of execution",
      4: "I showed a clear, prioritised execution plan",
      5: "I gave a detailed, realistic roadmap with trade-offs",
    },
  },
  {
    key: "communication",
    label: "Communication",
    icon: "🗣",
    color: "#10b981",
    descriptions: {
      1: "I rambled and lost track of my point",
      2: "My answer was understandable but hard to follow",
      3: "I communicated clearly enough",
      4: "I was structured, concise, and easy to follow",
      5: "I communicated with real confidence and precision",
    },
  },
  {
    key: "leadership",
    label: "Leadership",
    icon: "🎯",
    color: "#f59e0b",
    descriptions: {
      1: "I avoided taking a clear position",
      2: "I hinted at a view but didn't commit",
      3: "I showed some ownership of decisions",
      4: "I demonstrated clear ownership and conviction",
      5: "I showed the kind of leadership that drives real outcomes",
    },
  },
];

function StarRating({ value, onChange, color }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered ?? value);
        return (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(star)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              fontSize: 28,
              lineHeight: 1,
              color: filled ? color : "rgba(255,255,255,0.15)",
              transition: "color 0.1s, transform 0.1s",
              transform: filled ? "scale(1.1)" : "scale(1)",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function InterviewSelfAssessScreen({ onSubmit, dimensions: dimKeys }) {
  const [scores, setScores] = useState({
    productSense: 0,
    analytical: 0,
    execution: 0,
    communication: 0,
    leadership: 0,
  });

  const allRated = Object.values(scores).every((v) => v > 0);

  function handleSubmit() {
    if (!allRated) return;
    onSubmit(scores);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>How did that go?</div>
        <div style={styles.subtitle}>
          Rate yourself before seeing the AI's assessment. Be honest — the gap is the learning.
        </div>
      </div>

      <div style={styles.dimList}>
        {DIMENSIONS.map((dim) => {
          const currentScore = scores[dim.key];
          const desc = currentScore ? dim.descriptions[currentScore] : null;
          return (
            <div
              key={dim.key}
              style={{
                ...glassCard,
                padding: "18px 20px",
                marginBottom: 12,
                border: currentScore
                  ? `1px solid ${dim.color}44`
                  : "1px solid rgba(255,255,255,0.08)",
                transition: "border 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{dim.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{dim.label}</span>
                {currentScore > 0 && (
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 13,
                    fontWeight: 700,
                    color: dim.color,
                  }}>
                    {currentScore}/5
                  </span>
                )}
              </div>
              <StarRating
                value={currentScore}
                onChange={(val) => setScores((prev) => ({ ...prev, [dim.key]: val }))}
                color={dim.color}
              />
              {desc && (
                <div style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#94a3b8",
                  lineHeight: 1.5,
                  fontStyle: "italic",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: 10,
                }}>
                  {desc}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allRated}
        style={{
          width: "100%",
          padding: "16px",
          background: allRated
            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
            : "rgba(255,255,255,0.06)",
          color: allRated ? "#ffffff" : "#64748b",
          border: allRated ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: allRated ? "pointer" : "default",
          transition: "all 0.2s",
          marginTop: 8,
        }}
      >
        {allRated ? "See My Feedback →" : "Rate all 5 dimensions to continue"}
      </button>

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
  header: {
    marginBottom: 28,
    paddingTop: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#f1f5f9",
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
  },
  dimList: {
    marginBottom: 8,
  },
};
