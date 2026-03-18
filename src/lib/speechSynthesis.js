// Opponent voice profiles — each character gets a distinct voice
const VOICE_PROFILES = {
  priya_sharma:   { pitch: 1.05, rate: 0.92, name: "priya"  }, // authoritative, measured
  rahul_nair:     { pitch: 0.95, rate: 0.9,  name: "rahul"  }, // deep, precise
  sarah_chen:     { pitch: 1.08, rate: 1.0,  name: "sarah"  }, // crisp, direct
  amit_bose:      { pitch: 0.92, rate: 0.88, name: "amit"   }, // deliberate, careful
  leela_krishnan: { pitch: 1.02, rate: 0.88, name: "leela"  }, // warm, measured
  james_morton:   { pitch: 0.88, rate: 0.95, name: "james"  }, // commanding, steady
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
  const all = window.speechSynthesis.getVoices();
  const english = all.filter(v => v.lang.startsWith("en"));
  if (english.length === 0) return null;

  const isFemalePart = ["priya", "sarah", "leela"].includes(profile.name);

  // Priority 1: Google Neural voices (Chrome desktop) — best quality
  // Female characters → prefer "Google UK English Female" or "Google US English"
  // Male characters → prefer "Google UK English Male" or "Google US English"
  const googleVoices = english.filter(v => v.name.toLowerCase().includes("google"));
  if (googleVoices.length > 0) {
    const gendered = googleVoices.filter(v =>
      isFemalePart
        ? v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("woman")
        : v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("man")
    );
    if (gendered.length > 0) return gendered[0];
    return googleVoices[0];
  }

  // Priority 2: macOS Enhanced/Premium voices — second best
  const enhanced = english.filter(v =>
    v.name.includes("Enhanced") || v.name.includes("Premium") || v.name.includes("Natural")
  );
  if (enhanced.length > 0) {
    // Good macOS voices by gender
    const macFemale = ["Samantha", "Karen", "Victoria", "Moira", "Tessa"];
    const macMale = ["Daniel", "Alex", "Tom", "Fred", "Oliver"];
    const preferred = isFemalePart ? macFemale : macMale;
    const match = enhanced.find(v => preferred.some(n => v.name.includes(n)));
    if (match) return match;
    return enhanced[0];
  }

  // Priority 3: Any named macOS/Windows voice (not the default robotic ones)
  const macFemale = ["Samantha", "Karen", "Victoria", "Moira", "Tessa"];
  const macMale = ["Daniel", "Alex", "Tom", "Fred", "Oliver"];
  const winFemale = ["Zira", "Hazel", "Susan"];
  const winMale = ["David", "Mark", "George", "Richard"];
  const preferred = isFemalePart ? [...macFemale, ...winFemale] : [...macMale, ...winMale];
  const named = english.find(v => preferred.some(n => v.name.includes(n)));
  if (named) return named;

  // Fallback: first English voice
  return english[0];
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
