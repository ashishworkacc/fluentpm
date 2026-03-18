import { useState, useEffect } from "react";

export const FILLERS = [
  "um", "uh", "er", "ah", "like", "you know", "so", "basically",
  "actually", "literally", "right", "okay", "sort of", "kind of",
  "i mean", "you see", "well", "just", "yeah", "no", "hmm",
  "honestly", "obviously", "clearly", "simply", "totally"
];

/**
 * Tokenise a transcript into words, normalising punctuation.
 */
function tokenise(transcript) {
  return transcript
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Count occurrences of each filler word / phrase in the transcript.
 * Multi-word fillers (e.g. "you know") are matched before single-word ones.
 */
export function countFillers(transcript) {
  const lower = transcript.toLowerCase();
  const counts = {};

  // Sort fillers so multi-word ones are checked first
  const sorted = [...FILLERS].sort((a, b) => b.split(" ").length - a.split(" ").length);

  for (const filler of sorted) {
    const regex = new RegExp(`\\b${filler}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      counts[filler] = matches.length;
    }
  }

  return counts;
}

/**
 * Count sentences that trail off — defined as:
 *   - shorter than 5 words AND ends without terminal punctuation, OR
 *   - ends with "..." OR
 *   - ends with a filler word
 */
export function countDropOffs(transcript) {
  if (!transcript.trim()) return 0;

  // Split on sentence-ending punctuation, keeping delimiters
  const rawSentences = transcript
    .split(/(?<=[.!?])\s+|(?<=\.\.\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  let dropOffs = 0;

  for (const sentence of rawSentences) {
    const words = tokenise(sentence);
    const wordCount = words.length;

    if (wordCount === 0) continue;

    const hasTerminalPunct = /[.!?]$/.test(sentence.trim());
    const endsWithEllipsis = sentence.trim().endsWith("...");
    const lastWord = words[words.length - 1];
    const endsWithFiller = FILLERS.some(f => {
      const fillerWords = f.split(" ");
      if (fillerWords.length === 1) return lastWord === f;
      // multi-word filler at end
      const tail = words.slice(-fillerWords.length).join(" ");
      return tail === f;
    });

    if (endsWithEllipsis) {
      dropOffs++;
    } else if (!hasTerminalPunct && wordCount < 5) {
      dropOffs++;
    } else if (endsWithFiller) {
      dropOffs++;
    }
  }

  return dropOffs;
}

/**
 * Full analysis of a transcript string.
 * Returns { fillerCounts, fillerTotal, dropOffCount, cleanSpeechPct, totalWords, meaningfulWords }
 */
export function analyseTranscript(transcript) {
  if (!transcript || !transcript.trim()) {
    return {
      fillerCounts: {},
      fillerTotal: 0,
      dropOffCount: 0,
      cleanSpeechPct: 100,
      totalWords: 0,
      meaningfulWords: 0
    };
  }

  const fillerCounts = countFillers(transcript);
  const fillerTotal = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const dropOffCount = countDropOffs(transcript);

  const totalWords = tokenise(transcript).length;
  const meaningfulWords = Math.max(0, totalWords - fillerTotal);
  const cleanSpeechPct =
    totalWords === 0 ? 100 : Math.round((meaningfulWords / totalWords) * 100);

  return {
    fillerCounts,
    fillerTotal,
    dropOffCount,
    cleanSpeechPct,
    totalWords,
    meaningfulWords
  };
}

/**
 * React hook: analyses transcript in real-time whenever transcript changes.
 * Returns the full analysis result plus derived helpers.
 */
export function useRealTimeAnalysis(transcript) {
  const [analysis, setAnalysis] = useState({
    fillerCounts: {},
    fillerTotal: 0,
    dropOffCount: 0,
    cleanSpeechPct: 100,
    totalWords: 0,
    meaningfulWords: 0
  });

  useEffect(() => {
    const result = analyseTranscript(transcript);
    setAnalysis(result);
  }, [transcript]);

  // Derive top filler
  const fillerEntries = Object.entries(analysis.fillerCounts).sort(
    ([, a], [, b]) => b - a
  );
  const topFiller = fillerEntries.length > 0 ? fillerEntries[0][0] : null;
  const topFillerCount = fillerEntries.length > 0 ? fillerEntries[0][1] : 0;

  return {
    ...analysis,
    topFiller,
    topFillerCount
  };
}
