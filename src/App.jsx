import { useState, useEffect } from "react";
import { useGlobalHighlight } from "./hooks/useGlobalHighlight.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase.js";

import HomeScreen from "./components/HomeScreen.jsx";
import PreBattleScreen from "./components/PreBattleScreen.jsx";
import BattleScreen from "./components/BattleScreen.jsx";
import FeedbackScreen from "./components/FeedbackScreen.jsx";
import ProgressScreen from "./components/ProgressScreen.jsx";
import LexiconScreen from "./components/LexiconScreen.jsx";
import LightningRoundScreen from "./components/LightningRoundScreen.jsx";
import PhrasesScreen from "./components/PhrasesScreen.jsx";
import InterviewHomeScreen from "./components/InterviewHomeScreen.jsx";
import InterviewScreen from "./components/InterviewScreen.jsx";
import InterviewFeedbackScreen from "./components/InterviewFeedbackScreen.jsx";
import InterviewSelfAssessScreen from "./components/InterviewSelfAssessScreen.jsx";
import StoryBankScreen from "./components/StoryBankScreen.jsx";
import PushbackDrillScreen from "./components/PushbackDrillScreen.jsx";
import QuickDrillScreen from "./components/QuickDrillScreen.jsx";
import CustomQuestionsScreen from "./components/CustomQuestionsScreen.jsx";
import ProfileScreen from "./components/ProfileScreen.jsx";

// ── Window width hook ─────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ── Sign-In Screen ────────────────────────────────────────────────────────────

function SignInScreen({ onSignIn, loading }) {
  return (
    <div style={styles.signInContainer}>
      <div style={styles.signInCard}>
        <div style={styles.signInLogoMark}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="rgba(99,102,241,0.15)" />
            <path d="M13 28L20 12L27 28" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15.5 23H24.5" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={styles.signInAppName}>FluentPM</h1>
        <p style={styles.signInTagline}>
          Train your voice.<br />Own the room.
        </p>
        <button
          onClick={onSignIn}
          disabled={loading}
          style={{ ...styles.googleBtn, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>
        <p style={styles.signInFooter}>
          Practice realistic PM conversations with AI opponents.
        </p>
      </div>
    </div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.loadingRingWrapper}>
        <div style={styles.loadingRing} />
        <div style={styles.loadingRingInner} />
      </div>
      <p style={styles.loadingText}>Loading FluentPM...</p>
    </div>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: "home",          label: "Practice",  icon: "🏠" },
  { id: "lexicon",       label: "Lexicon",   icon: "📖" },
  { id: "progress",      label: "Progress",  icon: "📊" },
  { id: "profile",       label: "Profile",   icon: "👤" },
  { id: "interviewHome", label: "Interview", icon: "🎤" },
];

const SCREENS_WITH_NO_NAV = [
  "preBattle", "battle", "feedback", "lightning",
  "interview", "interviewFeedback", "interviewSelfAssess",
  "storyBank", "pushbackDrill", "quickDrill", "customQuestions",
];

const SIDEBAR_WIDTH = 240;

// ── Desktop Sidebar ───────────────────────────────────────────────────────────

function Sidebar({ currentScreen, setCurrentScreen, user, onSignOut }) {
  return (
    <aside style={{
      position: "fixed",
      left: 0, top: 0, bottom: 0,
      width: SIDEBAR_WIDTH,
      background: "rgba(5,6,20,0.98)",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      flexDirection: "column",
      zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{ padding: "28px 22px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <path d="M13 28L20 12L27 28" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.5 23H24.5" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", lineHeight: 1 }}>
              FluentPM
            </div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 500, marginTop: 2 }}>
              Fluency Coach
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV_TABS.map(tab => {
          const active = currentScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentScreen(tab.id)}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 10,
                background: active ? "rgba(99,102,241,0.14)" : "transparent",
                border: active ? "1px solid rgba(99,102,241,0.22)" : "1px solid transparent",
                color: active ? "#a5b4fc" : "#64748b",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                display: "flex",
                alignItems: "center",
                gap: 11,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 10px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
        }}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, border: "2px solid rgba(99,102,241,0.3)" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {(user.displayName || user.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.displayName?.split(" ")[0] || "User"}
            </div>
            <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 14, padding: "4px 6px", borderRadius: 6, flexShrink: 0 }}
          >
            ↪
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────────

function BottomNav({ currentScreen, setCurrentScreen }) {
  if (SCREENS_WITH_NO_NAV.includes(currentScreen)) return null;
  return (
    <nav style={styles.bottomNav}>
      {NAV_TABS.map(tab => {
        const active = currentScreen === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentScreen(tab.id)}
            style={{ ...styles.navTab, color: active ? "#6366f1" : "#94a3b8" }}
          >
            <span style={styles.navLabel}>{tab.label}</span>
            {active && <span style={styles.navDot} />}
          </button>
        );
      })}
    </nav>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [signInLoading, setSignInLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("home");

  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 768;

  // Data passed between screens
  const [preBattleData, setPreBattleData] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [coachingProfile, setCoachingProfile] = useState(null);
  const [interviewData, setInterviewData] = useState(null);
  const [interviewFeedback, setInterviewFeedback] = useState(null);
  const [interviewSelfScores, setInterviewSelfScores] = useState(null);
  const [storyBank, setStoryBank] = useState([]);
  const [customQuestion, setCustomQuestion] = useState(null);

  // Global highlight-to-lexicon
  const { selection: globalSelection, saving: globalSaving, saved: globalSaved, handleSave: handleGlobalSave } =
    useGlobalHighlight(async (text) => {
      if (!user) return;
      const { enrichExpression } = await import("./lib/openrouter.js");
      const { collection: col, addDoc: add, serverTimestamp: sts } = await import("firebase/firestore");
      const { db: database } = await import("./lib/firebase.js");
      const enriched = await enrichExpression(text);
      await add(col(database, "users", user.uid, "lexicon"), {
        expression: text,
        enriched: enriched || null,
        source: "highlight",
        status: "new",
        usedInBattles: 0,
        savedAt: sts(),
        lastUsedDate: null,
      });
    }, currentScreen);

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  async function handleSignIn() {
    setSignInLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign in error:", err);
    } finally {
      setSignInLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setCurrentScreen("home");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  if (authLoading) return <LoadingScreen />;
  if (!user) return <SignInScreen onSignIn={handleSignIn} loading={signInLoading} />;

  function renderScreen() {
    switch (currentScreen) {
      case "home":
        return (
          <HomeScreen
            user={user}
            setCurrentScreen={setCurrentScreen}
            setPreBattleData={setPreBattleData}
            setCoachingProfile={setCoachingProfile}
          />
        );
      case "preBattle":
        return (
          <PreBattleScreen
            user={user}
            opponent={preBattleData?.opponent}
            scenario={preBattleData?.scenario}
            setCurrentScreen={setCurrentScreen}
            setBattleData={setBattleData}
          />
        );
      case "battle":
        return (
          <BattleScreen
            user={user}
            opponent={battleData?.opponent || preBattleData?.opponent}
            scenario={battleData?.scenario || preBattleData?.scenario}
            outline={battleData?.outline || ""}
            coachingProfile={coachingProfile}
            setCurrentScreen={setCurrentScreen}
            setSessionData={setSessionData}
          />
        );
      case "feedback":
        return (
          <FeedbackScreen
            user={user}
            sessionData={sessionData}
            opponent={preBattleData?.opponent}
            setCurrentScreen={setCurrentScreen}
          />
        );
      case "lexicon":
        return <LexiconScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "progress":
        return <ProgressScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "profile":
        return <ProfileScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "phrases":
        return <PhrasesScreen setCurrentScreen={setCurrentScreen} />;
      case "lightning":
        return <LightningRoundScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "interviewHome":
        return (
          <InterviewHomeScreen
            user={user}
            setCurrentScreen={setCurrentScreen}
            setInterviewData={setInterviewData}
            setCustomQuestion={setCustomQuestion}
          />
        );
      case "interview":
        return (
          <InterviewScreen
            user={user}
            interviewData={interviewData}
            setCurrentScreen={(screen) => {
              if (screen === "interviewFeedback") {
                setCurrentScreen("interviewSelfAssess");
              } else {
                setCurrentScreen(screen);
              }
            }}
            setInterviewFeedback={setInterviewFeedback}
          />
        );
      case "interviewSelfAssess":
        return (
          <InterviewSelfAssessScreen
            onSubmit={(selfScores) => {
              setInterviewSelfScores(selfScores);
              setCurrentScreen("interviewFeedback");
            }}
            setCurrentScreen={setCurrentScreen}
          />
        );
      case "interviewFeedback":
        return (
          <InterviewFeedbackScreen
            user={user}
            interviewData={interviewData}
            interviewFeedback={interviewFeedback}
            selfScores={interviewSelfScores}
            setCurrentScreen={setCurrentScreen}
          />
        );
      case "storyBank":
        return <StoryBankScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "pushbackDrill":
        return <PushbackDrillScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "quickDrill":
        return <QuickDrillScreen user={user} setCurrentScreen={setCurrentScreen} />;
      case "customQuestions":
        return (
          <CustomQuestionsScreen
            user={user}
            setCurrentScreen={setCurrentScreen}
            setCustomQuestion={setCustomQuestion}
            setInterviewData={setInterviewData}
          />
        );
      default:
        return (
          <HomeScreen
            user={user}
            setCurrentScreen={setCurrentScreen}
            setPreBattleData={setPreBattleData}
            setCoachingProfile={setCoachingProfile}
          />
        );
    }
  }

  const hasNav = !SCREENS_WITH_NO_NAV.includes(currentScreen);

  // ── Global floating UI (highlight-to-lexicon) ─────────────────────────────
  const floatingUI = (
    <>
      {globalSelection.text && globalSelection.pos && !globalSaving && !globalSaved && (
        <button
          data-lexicon-btn="true"
          onMouseDown={(e) => { e.preventDefault(); handleGlobalSave(); }}
          style={{
            position: "fixed",
            left: Math.min(globalSelection.pos.x - 70, window.innerWidth - 160),
            top: Math.max(globalSelection.pos.y - 48, 8),
            zIndex: 99999,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
            whiteSpace: "nowrap",
            pointerEvents: "all",
          }}
        >
          Save to Lexicon
        </button>
      )}
      {globalSaved && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#10b981", color: "#fff", borderRadius: 20,
          padding: "8px 18px", fontSize: 13, fontWeight: 700, zIndex: 99999,
          pointerEvents: "none",
        }}>
          Saved to Lexicon ✓
        </div>
      )}
      {globalSaving && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "rgba(15,16,40,0.95)", border: "1px solid rgba(99,102,241,0.3)",
          color: "#a5b4fc", borderRadius: 20, padding: "8px 18px",
          fontSize: 13, fontWeight: 700, zIndex: 99999, pointerEvents: "none",
        }}>
          Saving...
        </div>
      )}
    </>
  );

  // ── Desktop layout ────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #060818 0%, #0d1021 50%, #060818 100%)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#f1f5f9",
        display: "flex",
      }}>
        {/* Sidebar — only on nav screens */}
        {hasNav && (
          <Sidebar
            currentScreen={currentScreen}
            setCurrentScreen={setCurrentScreen}
            user={user}
            onSignOut={handleSignOut}
          />
        )}

        {/* Main content area */}
        <div style={{
          marginLeft: hasNav ? SIDEBAR_WIDTH : 0,
          flex: 1,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}>
          {/* Desktop top bar — only on non-nav (immersive) screens */}
          {!hasNav && (
            <div style={{
              height: 56,
              background: "rgba(6,8,24,0.9)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              padding: "0 24px",
              gap: 16,
              flexShrink: 0,
            }}>
              <button
                onClick={() => setCurrentScreen("home")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#64748b", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 0",
                }}
              >
                ← Back
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>FluentPM</span>
            </div>
          )}

          <main style={{ flex: 1, overflowY: "auto" }}>
            {renderScreen()}
          </main>
        </div>

        {floatingUI}
      </div>
    );
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(135deg, #060818 0%, #0d1021 50%, #060818 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#f1f5f9",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        {/* Mobile top bar */}
        {hasNav && (
          <div style={styles.topBar}>
            <span style={styles.topBarLogo}>FluentPM</span>
            <button onClick={handleSignOut} style={styles.signOutBtn}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  style={styles.avatarImg}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span style={styles.avatarFallback}>
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </span>
              )}
            </button>
          </div>
        )}

        <main style={{ flex: 1 }}>
          {renderScreen()}
        </main>

        <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
      </div>

      {floatingUI}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  topBar: {
    position: "sticky",
    top: 0,
    height: 60,
    background: "rgba(6,8,24,0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    zIndex: 100,
    boxSizing: "border-box",
    flexShrink: 0,
  },
  topBarLogo: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f1f5f9",
    letterSpacing: "-0.5px",
  },
  signOutBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "block",
    border: "2px solid rgba(99,102,241,0.5)",
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
  },
  bottomNav: {
    position: "sticky",
    bottom: 0,
    height: 68,
    background: "rgba(6,8,24,0.92)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    zIndex: 100,
    flexShrink: 0,
  },
  navTab: {
    flex: 1,
    height: "100%",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "8px 0",
    transition: "color 0.15s",
  },
  navLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.3px",
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: "50%",
    backgroundColor: "#6366f1",
    display: "block",
  },
  // Sign in
  signInContainer: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(135deg, #060818 0%, #0d1021 50%, #060818 100%)",
  },
  signInCard: {
    background: "rgba(20,22,55,0.95)",
    border: "1px solid rgba(99,102,241,0.25)",
    borderRadius: 24,
    padding: "52px 40px",
    textAlign: "center",
    maxWidth: 380,
    width: "100%",
    boxShadow: "0 0 0 1px rgba(99,102,241,0.1), 0 40px 80px rgba(0,0,0,0.6)",
  },
  signInLogoMark: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 16,
  },
  signInAppName: {
    fontSize: 36,
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 10px",
    letterSpacing: "-1.5px",
  },
  signInTagline: {
    fontSize: 18,
    fontWeight: 600,
    color: "#94a3b8",
    margin: "0 0 40px",
    lineHeight: 1.5,
  },
  googleBtn: {
    width: "100%",
    padding: "15px 24px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 24,
    transition: "opacity 0.15s",
    letterSpacing: "0.2px",
  },
  signInFooter: {
    fontSize: 13,
    color: "#64748b",
    margin: 0,
    lineHeight: 1.5,
  },
  // Loading
  loadingContainer: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    background: "linear-gradient(135deg, #060818 0%, #0d1021 50%, #060818 100%)",
  },
  loadingRingWrapper: {
    position: "relative",
    width: 56,
    height: 56,
  },
  loadingRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "3px solid rgba(99,102,241,0.2)",
    borderTopColor: "#6366f1",
    animation: "spin 0.9s linear infinite",
  },
  loadingRingInner: {
    position: "absolute",
    inset: 8,
    borderRadius: "50%",
    border: "2px solid rgba(139,92,246,0.2)",
    borderBottomColor: "#8b5cf6",
    animation: "spin 1.4s linear infinite reverse",
  },
  loadingText: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: 500,
  },
};
