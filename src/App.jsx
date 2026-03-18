import { useState, useEffect } from "react";
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

// ── Sign-In Screen ───────────────────────────────────────────────────────────

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

// ── Loading Screen ───────────────────────────────────────────────────────────

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

// ── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: "home",     label: "Practice" },
  { id: "lexicon",  label: "Lexicon"  },
  { id: "progress", label: "Progress" },
  { id: "phrases",  label: "Phrases"  },
];

const SCREENS_WITH_NO_NAV = ["preBattle", "battle", "feedback", "lightning"];

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
            style={{
              ...styles.navTab,
              color: active ? "#6366f1" : "#94a3b8",
            }}
          >
            <span style={styles.navLabel}>{tab.label}</span>
            {active && <span style={styles.navDot} />}
          </button>
        );
      })}
    </nav>
  );
}

// ── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [signInLoading, setSignInLoading] = useState(false);

  const [currentScreen, setCurrentScreen] = useState("home");

  // Data passed between screens
  const [preBattleData, setPreBattleData] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [coachingProfile, setCoachingProfile] = useState(null);

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
      case "phrases":
        return <PhrasesScreen setCurrentScreen={setCurrentScreen} />;
      case "lightning":
        return <LightningRoundScreen user={user} setCurrentScreen={setCurrentScreen} />;
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

  return (
    <div style={styles.appRoot}>
      {/* Top bar — only on nav screens */}
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

      <main style={{
        ...styles.mainContent,
        paddingTop: hasNav ? 60 : 0,
        paddingBottom: hasNav ? 80 : 0,
      }}>
        {renderScreen()}
      </main>

      <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  appRoot: {
    minHeight: "100dvh",
    color: "#f1f5f9",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: "relative",
  },
  mainContent: {
    minHeight: "100dvh",
  },
  topBar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "rgba(6,8,24,0.7)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    zIndex: 100,
    boxSizing: "border-box",
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
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    background: "rgba(6,8,24,0.85)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    zIndex: 100,
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
    animation: "fadeIn 0.4s ease",
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
