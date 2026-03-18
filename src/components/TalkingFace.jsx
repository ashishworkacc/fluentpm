import { useState, useEffect, useRef } from "react";
import { speakOpponentLine, cancelSpeech, VOICE_PROFILES } from "../lib/speechSynthesis.js";

// ── Per-opponent visual definitions ──────────────────────────────────────────

const FACE_CONFIGS = {
  priya_sharma: {
    skinColor: "#F4C994",
    noseShadow: "#D4956A",
    irisColor: "#3D1A0A",
    // Hair: dark brown, shoulder-length side curves
    hairBack: (
      <>
        {/* Shoulder-length hair behind face */}
        <path d="M 24,60 Q 18,90 22,120 Q 30,130 40,135 L 40,120 Q 30,110 28,90 Z" fill="#2D1A0F" />
        <path d="M 96,60 Q 102,90 98,120 Q 90,130 80,135 L 80,120 Q 90,110 92,90 Z" fill="#2D1A0F" />
      </>
    ),
    hairFront: (
      <>
        {/* Top hair — dark brown sweep */}
        <path d="M 24,45 Q 30,20 60,18 Q 90,20 96,45 Q 80,30 60,28 Q 40,30 24,45 Z" fill="#2D1A0F" />
        {/* Side hair wisps */}
        <path d="M 26,50 Q 20,55 22,65" stroke="#2D1A0F" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M 94,50 Q 100,55 98,65" stroke="#2D1A0F" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
    // Brows: slight frown (angled inward)
    brows: (
      <>
        <path d="M 36,46 Q 43,43 50,45" stroke="#2D1A0F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 70,45 Q 77,43 84,46" stroke="#2D1A0F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    // Collar hint
    collar: (
      <path d="M 48,118 Q 55,112 60,114 Q 65,112 72,118" stroke="#9B7FB5" strokeWidth="2" fill="none" />
    ),
  },

  rahul_nair: {
    skinColor: "#C68642",
    noseShadow: "#A0652A",
    irisColor: "#1A0A00",
    // Hair: black, short filled arc
    hairBack: null,
    hairFront: (
      <>
        <path d="M 24,50 Q 28,22 60,20 Q 92,22 96,50 Q 84,35 60,33 Q 36,35 24,50 Z" fill="#111" />
      </>
    ),
    // Glasses: thin rectangle frames over eyes
    glasses: (
      <>
        <rect x="34" y="49" width="22" height="13" rx="3" fill="none" stroke="#444" strokeWidth="1.5" />
        <rect x="64" y="49" width="22" height="13" rx="3" fill="none" stroke="#444" strokeWidth="1.5" />
        {/* Bridge */}
        <line x1="56" y1="55" x2="64" y2="55" stroke="#444" strokeWidth="1.5" />
        {/* Side arms */}
        <line x1="34" y1="55" x2="26" y2="58" stroke="#444" strokeWidth="1.5" />
        <line x1="86" y1="55" x2="94" y2="58" stroke="#444" strokeWidth="1.5" />
      </>
    ),
    brows: (
      <>
        <path d="M 36,47 Q 43,44 50,46" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 70,46 Q 77,44 84,47" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    collar: null,
  },

  sarah_chen: {
    skinColor: "#F8D5B0",
    noseShadow: "#D4A87A",
    irisColor: "#1C1C1C",
    // Hair: black, straight with side part (asymmetric)
    hairBack: (
      <>
        {/* Right side longer */}
        <path d="M 88,55 Q 98,75 95,110 Q 92,125 85,130 L 85,115 Q 90,100 92,80 Z" fill="#111" />
        {/* Left side shorter */}
        <path d="M 30,55 Q 22,70 25,95 L 28,95 Q 25,72 32,60 Z" fill="#111" />
      </>
    ),
    hairFront: (
      <>
        {/* Side-parted top — asymmetric, more to the right */}
        <path d="M 32,50 Q 38,22 62,20 Q 88,20 93,50 Q 80,32 62,30 Q 46,30 32,50 Z" fill="#111" />
        {/* Side part line */}
        <path d="M 48,20 Q 46,30 44,42" stroke="#111" strokeWidth="2" fill="none" />
      </>
    ),
    // One brow slightly higher (raised eyebrow)
    brows: (
      <>
        {/* Left brow — slightly raised */}
        <path d="M 36,44 Q 43,40 50,43" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Right brow — normal */}
        <path d="M 70,46 Q 77,44 84,47" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    collar: null,
  },

  amit_bose: {
    skinColor: "#C68642",
    noseShadow: "#A0652A",
    irisColor: "#1A0A00",
    // Hair: black, short, slightly messy
    hairBack: null,
    hairFront: (
      <>
        <path d="M 26,52 Q 28,24 60,21 Q 92,24 94,52 Q 86,36 60,34 Q 34,36 26,52 Z" fill="#111" />
        {/* Messy bits */}
        <path d="M 52,21 Q 54,16 58,21" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 62,20 Q 66,14 70,20" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    // Beard shadow: subtle grey chin area
    beard: (
      <ellipse cx="60" cy="98" rx="20" ry="10" fill="rgba(80,60,40,0.25)" />
    ),
    // One brow lowered (skeptical)
    brows: (
      <>
        {/* Left brow — slightly lowered/angled skeptically */}
        <path d="M 36,48 Q 43,46 50,44" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Right brow — normal */}
        <path d="M 70,46 Q 77,44 84,47" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    collar: null,
  },

  leela_krishnan: {
    skinColor: "#D4956A",
    noseShadow: "#B0723A",
    irisColor: "#2D1000",
    // Hair: dark, bun shape at top-back
    hairBack: (
      <>
        {/* Bun at top back */}
        <ellipse cx="60" cy="16" rx="14" ry="10" fill="#1A0A00" />
        {/* Hair pulled tight sides */}
        <path d="M 28,52 Q 30,35 46,25 Q 52,20 60,18" stroke="#1A0A00" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 92,52 Q 90,35 74,25 Q 68,20 60,18" stroke="#1A0A00" strokeWidth="6" fill="none" strokeLinecap="round" />
      </>
    ),
    hairFront: (
      <>
        {/* Very minimal front hair — pulled back style */}
        <path d="M 30,48 Q 36,30 60,26 Q 84,30 90,48 Q 78,38 60,36 Q 42,38 30,48 Z" fill="#1A0A00" />
      </>
    ),
    // Warm slight smile brows (slightly arched up)
    brows: (
      <>
        <path d="M 36,46 Q 43,42 50,44" stroke="#1A0A00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 70,44 Q 77,42 84,46" stroke="#1A0A00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    collar: null,
  },

  james_morton: {
    skinColor: "#F0D5B5",
    noseShadow: "#C8A882",
    irisColor: "#3A3A3A",
    // Hair: greying at temples, dark top
    hairBack: null,
    hairFront: (
      <>
        {/* Dark top */}
        <path d="M 30,50 Q 34,26 60,23 Q 86,26 90,50 Q 80,36 60,33 Q 40,36 30,50 Z" fill="#2A2A2A" />
        {/* Grey temples */}
        <path d="M 30,50 Q 26,52 24,58 Q 26,56 30,54 Z" fill="#9A9A9A" />
        <path d="M 90,50 Q 94,52 96,58 Q 94,56 90,54 Z" fill="#9A9A9A" />
        {/* Grey side patches */}
        <path d="M 26,56 Q 24,62 25,68 Q 28,64 28,58 Z" fill="#9A9A9A" />
        <path d="M 94,56 Q 96,62 95,68 Q 92,64 92,58 Z" fill="#9A9A9A" />
      </>
    ),
    // Age lines: subtle crow's feet
    ageLines: (
      <>
        <path d="M 53,60 Q 56,58 58,62" stroke="rgba(140,100,60,0.4)" strokeWidth="1" fill="none" />
        <path d="M 53,63 Q 56,62 57,65" stroke="rgba(140,100,60,0.4)" strokeWidth="1" fill="none" />
        <path d="M 67,60 Q 64,58 62,62" stroke="rgba(140,100,60,0.4)" strokeWidth="1" fill="none" />
        <path d="M 67,63 Q 64,62 63,65" stroke="rgba(140,100,60,0.4)" strokeWidth="1" fill="none" />
      </>
    ),
    // Stern compressed brows
    brows: (
      <>
        <path d="M 36,46 Q 43,44 50,46" stroke="#2A2A2A" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 70,46 Q 77,44 84,46" stroke="#2A2A2A" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    collar: (
      <>
        {/* Shirt collar — stern exec look */}
        <path d="M 48,115 L 52,108 L 60,112 L 68,108 L 72,115" stroke="#E8E8E8" strokeWidth="1.5" fill="rgba(220,220,220,0.3)" />
      </>
    ),
  },
};

// ── Helper: get mouth path and fill ──────────────────────────────────────────

function getMouthPath(mouthOpenAmount, isResting) {
  // mouthOpenAmount: 0 = closed, 1 = fully open
  if (mouthOpenAmount < 0.15) {
    // Closed / resting
    if (isResting) {
      // Slight upward curve for warm characters
      return "M 46,86 Q 60,92 74,86";
    }
    return "M 46,86 Q 60,89 74,86";
  }
  // Open mouth — upper lip lifts, lower lip drops
  return `M 46,84 Q 48,82 60,82 Q 72,82 74,84`;
}

// ── TalkingFace component ─────────────────────────────────────────────────────

export default function TalkingFace({ opponentId, opponent, isSpeaking, text, onSpeechEnd, muted }) {
  const [mouthOpenAmount, setMouthOpenAmount] = useState(0);
  const [blinkScale, setBlinkScale] = useState(0); // 0 = open, 1 = closed
  const speechRef = useRef(null);
  const mouthTimerRef = useRef(null);
  const blinkTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const timersRef = useRef([]); // timing-based mouth animation timers
  const closeTimerRef = useRef(null); // onboundary close timer

  // Map interviewer IDs to existing face configs
  const FACE_ID_MAP = {
    alex_park: "rahul_nair",
    maya_rodriguez: "sarah_chen",
    vikram_singh: "amit_bose",
    emma_walsh: "leela_krishnan",
    david_chen: "james_morton",
  };
  const resolvedId = FACE_ID_MAP[opponentId] || opponentId;
  const config = FACE_CONFIGS[resolvedId] || FACE_CONFIGS.priya_sharma;
  const { skinColor, noseShadow, irisColor } = config;

  // ── Blinking ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function scheduleBlink() {
      const delay = 2500 + Math.random() * 2500; // 2.5–5s
      blinkTimerRef.current = setTimeout(() => {
        setBlinkScale(1); // close lids
        setTimeout(() => {
          setBlinkScale(0); // open lids
          scheduleBlink(); // schedule next blink
        }, 80);
      }, delay);
    }
    scheduleBlink();
    return () => clearTimeout(blinkTimerRef.current);
  }, []);

  // ── Helper: clear all timing-based animation timers ─────────────────────────
  function clearAllTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    clearTimeout(closeTimerRef.current);
    clearTimeout(mouthTimerRef.current);
  }

  // ── Speech synthesis ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSpeaking && text) {
      isSpeakingRef.current = true;

      // Stop any previous speech
      if (speechRef.current) {
        cancelSpeech();
      }
      clearAllTimers();

      // rAF-based mouth animation — runs continuously while speaking
      function animateMouth() {
        if (!isSpeakingRef.current) {
          setMouthOpenAmount(0);
          return;
        }
        const t = Date.now();
        const cycle = 300; // ms per open-close cycle
        const phase = (t % cycle) / cycle;
        if (phase < 0.6) {
          setMouthOpenAmount(0.5 + Math.sin((phase * Math.PI) / 0.6) * 0.5);
        } else {
          setMouthOpenAmount(0);
        }
        timersRef.current.push(setTimeout(animateMouth, 40)); // ~25fps
      }

      if (muted) {
        // No audio — fire onSpeechEnd after estimated duration based on word count
        const words = text.split(/\s+/).filter(Boolean);
        const elapsed = (words.length / 130) * 60 * 1000; // 130 wpm
        animateMouth();
        timersRef.current.push(
          setTimeout(() => {
            if (isSpeakingRef.current) {
              clearAllTimers();
              isSpeakingRef.current = false;
              setMouthOpenAmount(0);
              onSpeechEnd?.();
            }
          }, elapsed + 200)
        );
        speechRef.current = {
          stop: () => {
            isSpeakingRef.current = false;
            clearAllTimers();
            setMouthOpenAmount(0);
          }
        };
      } else {
        // Real speech synthesis
        animateMouth();
        speechRef.current = speakOpponentLine(
          text,
          opponentId,
          ({ word }) => {
            // onboundary — reset phase for snappier sync
            setMouthOpenAmount(0.8 + Math.random() * 0.2);
          },
          () => {
            // Speech ended
            clearAllTimers();
            isSpeakingRef.current = false;
            setMouthOpenAmount(0);
            onSpeechEnd?.();
          }
        );
      }
    } else if (!isSpeaking) {
      // isSpeaking turned false — cancel
      isSpeakingRef.current = false;
      clearAllTimers();
      setMouthOpenAmount(0);
      if (speechRef.current) {
        cancelSpeech();
        speechRef.current = null;
      }
    }

    return () => {
      clearAllTimers();
    };
  }, [isSpeaking, text, opponentId, muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isSpeakingRef.current = false;
      clearTimeout(mouthTimerRef.current);
      clearTimeout(blinkTimerRef.current);
      clearTimeout(closeTimerRef.current);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      cancelSpeech();
    };
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const mouthOpenY = mouthOpenAmount * 8; // 0–8
  const mouthOpen = mouthOpenAmount > 0.15;
  const eyelidRy = blinkScale * 7; // 0–7 (0 = open, 7 = closed)
  const isWarm = resolvedId === "leela_krishnan";
  const mouthPath = getMouthPath(mouthOpenAmount, isWarm);

  // Glow ring when speaking
  const ringStroke = isSpeaking ? "#6366f1" : "rgba(99,102,241,0.15)";
  const ringStrokeWidth = isSpeaking ? 2.5 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{ position: "relative", width: 120, height: 140 }}>
        <svg viewBox="0 0 120 140" width="120" height="140" style={{ display: "block" }}>
          {/* Glow ring — pulses when speaking */}
          <circle
            cx="60"
            cy="64"
            r="52"
            fill="none"
            stroke={ringStroke}
            strokeWidth={ringStrokeWidth}
            style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
          />

          {/* Hair back layer */}
          {config.hairBack}

          {/* Face oval */}
          <ellipse cx="60" cy="64" rx="36" ry="44" fill={skinColor} />

          {/* Ears */}
          <ellipse cx="24" cy="64" rx="7" ry="9" fill={skinColor} />
          <ellipse cx="96" cy="64" rx="7" ry="9" fill={skinColor} />
          {/* Ear detail */}
          <ellipse cx="24" cy="64" rx="4" ry="5" fill={noseShadow} opacity="0.4" />
          <ellipse cx="96" cy="64" rx="4" ry="5" fill={noseShadow} opacity="0.4" />

          {/* Hair front layer */}
          {config.hairFront}

          {/* Beard shadow (Amit only) */}
          {config.beard}

          {/* Eye whites */}
          <ellipse cx="45" cy="55" rx="9" ry="7" fill="white" />
          <ellipse cx="75" cy="55" rx="9" ry="7" fill="white" />

          {/* Irises */}
          <circle cx="45" cy="55" r="5" fill={irisColor} />
          <circle cx="75" cy="55" r="5" fill={irisColor} />

          {/* Pupils */}
          <circle cx="45" cy="55" r="2.5" fill="#111" />
          <circle cx="75" cy="55" r="2.5" fill="#111" />

          {/* Eye shine */}
          <circle cx="47" cy="53" r="1.2" fill="white" />
          <circle cx="77" cy="53" r="1.2" fill="white" />

          {/* Eyelids (blink animation) */}
          <ellipse cx="45" cy="55" rx="9" ry={eyelidRy} fill={skinColor} />
          <ellipse cx="75" cy="55" rx="9" ry={eyelidRy} fill={skinColor} />

          {/* Glasses (Rahul only) */}
          {config.glasses}

          {/* Eyebrows */}
          {config.brows}

          {/* Nose — subtle dots */}
          <ellipse cx="55" cy="70" rx="2" ry="1.5" fill={noseShadow} opacity="0.6" />
          <ellipse cx="65" cy="70" rx="2" ry="1.5" fill={noseShadow} opacity="0.6" />

          {/* Age lines (James only) */}
          {config.ageLines}

          {/* MOUTH */}
          {/* Base lip curve */}
          <path
            d={mouthPath}
            fill="none"
            stroke={mouthOpen ? "#8B4513" : noseShadow}
            strokeWidth={mouthOpen ? 1.5 : 1.5}
            strokeLinecap="round"
          />

          {/* Inner mouth when open */}
          {mouthOpen && (
            <>
              {/* Mouth cavity */}
              <ellipse cx="60" cy="88" rx="10" ry={Math.max(mouthOpenY, 1)} fill="#B03030" />
              {/* Upper lip */}
              <path d="M 46,84 Q 52,82 60,83 Q 68,82 74,84" fill="#C06060" stroke="none" />
              {/* Lower lip */}
              <path
                d={`M 46,84 Q 50,${84 + mouthOpenY * 1.2} 60,${85 + mouthOpenY * 1.4} Q 70,${84 + mouthOpenY * 1.2} 74,84`}
                fill="#C06060"
                stroke="none"
              />
              {/* Teeth (when open enough) */}
              {mouthOpenAmount > 0.5 && (
                <rect
                  x="52"
                  y="84"
                  width="16"
                  height={Math.min(mouthOpenY * 0.6, 4)}
                  rx="1"
                  fill="#f0f0e0"
                />
              )}
            </>
          )}

          {/* Warm resting smile for Leela */}
          {isWarm && !mouthOpen && (
            <path d="M 46,86 Q 60,92 74,86" fill="none" stroke={noseShadow} strokeWidth="1.5" strokeLinecap="round" />
          )}

          {/* Neck */}
          <rect x="48" y="104" width="24" height="20" rx="4" fill={skinColor} />

          {/* Collar / clothing hint */}
          {config.collar}
        </svg>
      </div>

      {/* Voice wave bars — shown when speaking */}
      <div style={{
        height: 24,
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        opacity: isSpeaking ? 1 : 0,
        transition: "opacity 0.3s",
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              background: `hsl(${240 + i * 15}, 70%, 65%)`,
              animation: isSpeaking ? `voiceWave${i} ${0.6 + i * 0.1}s ease-in-out ${i * 0.12}s infinite` : "none",
              height: 4,
            }}
          />
        ))}
        <style>{`
          @keyframes voiceWave0 { 0%,100%{height:4px} 50%{height:18px} }
          @keyframes voiceWave1 { 0%,100%{height:6px} 50%{height:22px} }
          @keyframes voiceWave2 { 0%,100%{height:4px} 50%{height:20px} }
          @keyframes voiceWave3 { 0%,100%{height:7px} 50%{height:16px} }
          @keyframes voiceWave4 { 0%,100%{height:3px} 50%{height:14px} }
        `}</style>
      </div>
    </div>
  );
}
