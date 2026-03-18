import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase.js";

import HomeScreen from "./components/HomeScreen.jsx";
import PreBattleScreen from "./components/PreBattleScreen.jsx";
import BattleScreen from "./components/BattleScreen.jsx";
import FeedbackScreen from "./components/FeedbackScreen.jsx";

// ── Placeholder screens for Week 1 ──────────────────────────────────────────

function LexiconScreen({ setCurrentScreen }) {
  return (
    <div style={styles.placeholderContainer}>
      <h2 style={styles.placeholderTitle}>Lexicon</h2>
      <p style={styles.placeholderText}>Coming in Week 2.</p>
    </div>
  );
}

function ProgressScreen({ setCurrentScreen }) {
  return (
    <div style={styles.placeholderContainer}>
      <h2 style={styles.placeholderTitle}>Progress</h2>
      <p style={styles.placeholderText}>Coming in Week 2.</p>
    </div>
  );
}

function PhrasesScreen({ setCurrentScreen }) {
  return (
    <div style={styles.placeholderContainer}>
      <h2 style={styles.placeholderTitle}>Phrases</h2>
      <p style={styles.placeholderText}>Coming in Week 2.</p>
    </div>
  );
}

function LightningScreen({ setCurrentScreen }) {
  return (
    <div style={styles.placeholderContainer}>
      <h2 style={styles.placeholderTitle}>Lightning Round</h2>
      <p style={styles.placeholderText}>Coming in Week 2.</p>
    </div>
  );
}

// ── Sign-In Screen ───────────────────────────────────────────────────────────

function SignInScreen({ onSignIn, loading }) {
  return (
    <div style={styles.signInContainer}>
      <div style={styles.signInCard}>
        <div style={styles.logoMark}>⚡</div>
        <h1 style={styles.appName}>FluentPM</h1>
        <p style={styles.signInTagline}>
          Train your voice. Own the room.
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
      <div style={styles.loadingSpinner}>⚡</div>
      <p style={styles.loadingText}>Loading FluentPM...</p>
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: "home",     label: "Practice", icon: "🏠" },
  { id: "lexicon",  label: "Lexicon",  icon: "📖" },
  { id: "progress", label: "Progress", icon: "📊" },
  { id: "phrases",  label: "Phrases",  icon: "📝" },
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
              color: active ? "#7c3aed" : "#6b7280",
              borderTop: active ? "2px solid #7c3aed" : "2px solid transparent",
            }}
          >
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel}>{tab.label}</span>
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
        return <LexiconScreen setCurrentScreen={setCurrentScreen} />;
      case "progress":
        return <ProgressScreen setCurrentScreen={setCurrentScreen} />;
      case "phrases":
        return <PhrasesScreen setCurrentScreen={setCurrentScreen} />;
      case "lightning":
        return <LightningScreen setCurrentScreen={setCurrentScreen} />;
      default:
        return (
          <HomeScreen
            user={user}
            setCurrentScreen={setCurrentScreen}
            setPreBattleData={setPreBattleData}
          />
        );
    }
  }

  return (
    <div style={styles.appRoot}>
      {/* Top bar with user info and sign out — only on nav screens */}
      {!SCREENS_WITH_NO_NAV.includes(currentScreen) && (
        <div style={styles.topBar}>
          <span style={styles.topBarLogo}>⚡ FluentPM</span>
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
        paddingTop: SCREENS_WITH_NO_NAV.includes(currentScreen) ? 0 : 56,
        paddingBottom: SCREENS_WITH_NO_NAV.includes(currentScreen) ? 0 : 64,
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
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#ffffff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: "relative",
    maxWidth: 480,
    margin: "0 auto",
  },
  mainContent: {
    overflowY: "auto",
    minHeight: "100vh",
  },
  topBar: {
    position: "fixed",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 480,
    height: 56,
    backgroundColor: "#0f0f0f",
    borderBottom: "1px solid #1a1a1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    zIndex: 100,
    boxSizing: "border-box",
  },
  topBarLogo: {
    fontSize: 18,
    fontWeight: 700,
    color: "#7c3aed",
    letterSpacing: "-0.5px",
  },
  signOutBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "block",
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#7c3aed",
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
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 480,
    height: 64,
    backgroundColor: "#0f0f0f",
    borderTop: "1px solid #1a1a1a",
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
    gap: 2,
    padding: "8px 0",
    transition: "color 0.15s",
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.3px",
  },
  // Sign in
  signInContainer: {
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  signInCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: "48px 32px",
    textAlign: "center",
    border: "1px solid #2a2a2a",
    maxWidth: 360,
    width: "100%",
  },
  logoMark: {
    fontSize: 48,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: 800,
    color: "#ffffff",
    margin: "0 0 8px",
    letterSpacing: "-1px",
  },
  signInTagline: {
    fontSize: 15,
    color: "#9ca3af",
    margin: "0 0 36px",
  },
  googleBtn: {
    width: "100%",
    padding: "14px 24px",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 24,
    transition: "opacity 0.15s",
  },
  signInFooter: {
    fontSize: 13,
    color: "#6b7280",
    margin: 0,
  },
  // Loading
  loadingContainer: {
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingSpinner: {
    fontSize: 48,
    animation: "pulse 1.5s ease-in-out infinite",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  // Placeholder screens
  placeholderContainer: {
    padding: 32,
    textAlign: "center",
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: "#6b7280",
  },
};
