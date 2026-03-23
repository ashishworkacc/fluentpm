import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";

const LEAGUES = [
  { id: "bronze",   name: "Bronze",   icon: "🥉", color: "#cd7f32", promoBg: "rgba(205,127,50,0.12)",  xpRange: [0,   250]  },
  { id: "silver",   name: "Silver",   icon: "🥈", color: "#94a3b8", promoBg: "rgba(148,163,184,0.12)", xpRange: [80,  500]  },
  { id: "gold",     name: "Gold",     icon: "🥇", color: "#f59e0b", promoBg: "rgba(245,158,11,0.12)",  xpRange: [200, 900]  },
  { id: "sapphire", name: "Sapphire", icon: "💎", color: "#3b82f6", promoBg: "rgba(59,130,246,0.12)",  xpRange: [450, 1500] },
  { id: "diamond",  name: "Diamond",  icon: "💠", color: "#a855f7", promoBg: "rgba(168,85,247,0.12)",  xpRange: [900, 2800] },
];

const PM_NAMES = [
  "Priya S.", "Marcus T.", "Ananya K.", "James L.", "Shruti M.",
  "Alex R.", "Vikram N.", "Sarah O.", "Rohan B.", "Chen W.",
  "Meera P.", "David K.", "Arjun S.", "Lisa H.", "Raj V.",
];

function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function getWeekId() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function getDaysLeftInWeek() {
  const day = new Date().getDay(); // 0=Sun
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return daysUntilSunday;
}

function generateCompetitors(weekId, leagueId) {
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [min, max] = league.xpRange;
  const seed = weekId.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const dayOfWeek = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
  const weekFraction = Math.min((dayOfWeek + 1) / 7, 1);

  return PM_NAMES.slice(0, 11).map((name, i) => {
    const r1 = seededRand(seed + i * 13 + 7);
    const r2 = seededRand(seed + i * 3 + 1);
    const fullWeekXP = Math.round(min + r1 * (max - min));
    const xp = Math.round(fullWeekXP * weekFraction * (0.6 + r2 * 0.8));
    return { name, xp, isAI: true };
  });
}

const glassCard = {
  background: "rgba(15,16,40,0.82)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

export default function LeagueScreen({ user, setCurrentScreen }) {
  const [weeklyXP, setWeeklyXP] = useState(0);
  const [league, setLeague] = useState("bronze");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "profile", "main"));
        const data = snap.data() || {};
        setWeeklyXP(data.weeklyXP || 0);
        setLeague(data.league || "bronze");
      } catch {}
      setLoading(false);
    }
    load();
  }, [user.uid]);

  const weekId = getWeekId();
  const currentLeague = LEAGUES.find(l => l.id === league) || LEAGUES[0];
  const competitors = generateCompetitors(weekId, league);

  // Build leaderboard: AI competitors + user
  const userEntry = { name: "You ▶", xp: weeklyXP, isAI: false, isUser: true };
  const allEntries = [...competitors, userEntry].sort((a, b) => b.xp - a.xp);

  const userRank = allEntries.findIndex(e => e.isUser) + 1;
  const totalEntries = allEntries.length;
  const promoZone = 3;
  const demoZone = totalEntries - 3;
  const daysLeft = getDaysLeftInWeek();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", color: "#64748b" }}>
        Loading league...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 100px", color: "#f1f5f9", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 20px", position: "sticky", top: 0, background: "rgba(6,8,24,0.92)", zIndex: 10 }}>
        <button onClick={() => setCurrentScreen("home")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 14, cursor: "pointer" }}>
          ← Back
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Weekly League</div>
        <div style={{ width: 40 }} />
      </div>

      {/* League hero */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{currentLeague.icon}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: currentLeague.color, letterSpacing: "-0.5px", marginBottom: 4 }}>
          {currentLeague.name} League
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left · `}
          Top 3 advance · Bottom 3 demoted
        </div>
      </div>

      {/* Your rank chip */}
      <div style={{ ...glassCard, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>Your rank this week</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: userRank <= promoZone ? "#10b981" : userRank > demoZone ? "#f43f5e" : "#f1f5f9" }}>
            #{userRank} of {totalEntries}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>Weekly XP</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{weeklyXP}</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={glassCard}>
        {/* Promotion zone header */}
        <div style={{ padding: "8px 16px", background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>↑ Promotion Zone</span>
        </div>

        {allEntries.map((entry, idx) => {
          const rank = idx + 1;
          const isPromo = rank <= promoZone;
          const isDemo = rank > demoZone;
          const isUser = entry.isUser;

          return (
            <div key={idx}>
              {/* Demotion zone separator */}
              {rank === demoZone + 1 && (
                <div style={{ padding: "6px 16px", background: "rgba(244,63,94,0.06)", borderTop: "1px solid rgba(244,63,94,0.15)", borderBottom: "1px solid rgba(244,63,94,0.1)" }}>
                  <span style={{ fontSize: 10, color: "#f43f5e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>↓ Demotion Zone</span>
                </div>
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                background: isUser ? "rgba(99,102,241,0.08)" : "transparent",
                borderBottom: idx < allEntries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                borderLeft: isUser ? "3px solid #6366f1" : "3px solid transparent",
              }}>
                <div style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700, color: isPromo ? "#10b981" : isDemo ? "#f43f5e" : "#64748b", flexShrink: 0 }}>
                  {rank}
                </div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: isUser ? 700 : 500, color: isUser ? "#f1f5f9" : "#cbd5e1" }}>
                  {entry.name}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isUser ? "#f59e0b" : "#94a3b8" }}>
                  {entry.xp} XP
                </div>
                {isPromo && <span style={{ fontSize: 10, color: "#10b981" }}>▲</span>}
                {isDemo  && <span style={{ fontSize: 10, color: "#f43f5e" }}>▼</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#475569", textAlign: "center", lineHeight: 1.6 }}>
        AI competitors reset every Monday. Your rank updates after every session.
      </div>
    </div>
  );
}
