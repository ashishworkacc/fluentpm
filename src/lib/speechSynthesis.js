// Opponent voice profiles — each character gets a distinct voice
const VOICE_PROFILES = {
  priya_sharma:    { pitch: 1.2, rate: 1.0, name: "priya"    }, // confident woman, measured
  rahul_nair:      { pitch: 0.85, rate: 0.95, name: "rahul"  }, // deep, precise
  sarah_chen:      { pitch: 1.15, rate: 1.1, name: "sarah"   }, // fast, clipped
  amit_bose:       { pitch: 0.9, rate: 0.9, name: "amit"     }, // slow, deliberate
  leela_krishnan:  { pitch: 1.1, rate: 0.85, name: "leela"   }, // warm, careful
  james_morton:    { pitch: 0.8, rate: 1.05, name: "james"   }, // commanding, fast
};

let voices = [];
let voicesLoaded = false;

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  voicesLoaded = voices.length > 0;
}

// Load voices (they load async in some browsers)
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(profile) {
  if (!voicesLoaded) loadVoices();
  // Prefer English voices — try en-GB, then en-US, then any English
  const english = voices.filter(v => v.lang.startsWith("en"));
  if (english.length === 0) return null;
  // Pick different voices for different characters by index
  const idx = ["priya","rahul","sarah","amit","leela","james"].indexOf(profile.name);
  return english[Math.min(idx, english.length - 1)] || english[0];
}

/**
 * Speak text for a given opponent.
 * @param {string} text - text to speak
 * @param {string} opponentId - key in VOICE_PROFILES
 * @param {function} onWordBoundary - called on each word with { charIndex, charLength, word }
 * @param {function} onEnd - called when speech finishes
 * @returns {{ stop: function }} - call stop() to cancel speech
 */
export function speakOpponentLine(text, opponentId, onWordBoundary, onEnd) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return { stop: () => {} };
  }

  // Cancel any ongoing speech first
  window.speechSynthesis.cancel();

  const profile = VOICE_PROFILES[opponentId] || { pitch: 1.0, rate: 1.0, name: "default" };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = 1.0;

  const voice = pickVoice(profile);
  if (voice) utterance.voice = voice;

  utterance.onboundary = (event) => {
    if (event.name === "word") {
      const word = text.slice(event.charIndex, event.charIndex + event.charLength);
      onWordBoundary?.({ charIndex: event.charIndex, charLength: event.charLength, word });
    }
  };

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);

  return {
    stop: () => {
      window.speechSynthesis.cancel();
      onEnd?.();
    },
  };
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
