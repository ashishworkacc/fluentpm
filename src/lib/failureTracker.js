import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Severity levels for failure tracking.
 * - critical: blocks the user's core workflow (data not saved, screen crash)
 * - high: degrades the experience significantly (AI call failed, wrong data shown)
 * - medium: minor friction (slow load, UI glitch, non-critical feature broken)
 * - low: cosmetic / edge-case issue
 */
export const SEVERITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/**
 * Log a failure event to Firestore under users/{uid}/failures/{auto-id}.
 *
 * @param {object} user         - Firebase Auth user object (needs .uid)
 * @param {string} module       - Which screen / feature failed  (e.g. "LightningRound", "BattleScreen", "Lexicon")
 * @param {string} severity     - One of SEVERITY.*
 * @param {string} userIntent   - What the user was trying to do  (e.g. "Submit Lightning response", "Save expression")
 * @param {any}    errorLog     - The raw error (Error object, string, or any serialisable value)
 * @param {object} [extra]      - Optional extra context fields (e.g. { expressionId, roundIndex })
 */
export async function logFailure(user, module, severity, userIntent, errorLog, extra = {}) {
  if (!user?.uid) return; // never throw, always silent

  const errorText =
    errorLog instanceof Error
      ? `${errorLog.message} | code: ${errorLog.code || "n/a"}`
      : String(errorLog ?? "unknown error");

  try {
    await addDoc(collection(db, "users", user.uid, "failures"), {
      timestamp: serverTimestamp(),
      module,
      severity,
      userIntent,
      errorLog: errorText,
      url: typeof window !== "undefined" ? window.location.href : "",
      ...extra,
    });
  } catch {
    // Log to console only — never let the tracker itself cause more failures
    console.warn(`[failureTracker] Could not write failure log — ${module}: ${errorText}`);
  }
}
