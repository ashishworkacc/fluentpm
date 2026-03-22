/**
 * FluentPM Expression SRS Scheduler
 * Inspired by Anki SM-2 + Vocabulary.com mastery model
 * Adapted for PM speaking practice (score 1–5 per Lightning Round)
 */

// Days to wait before next review per status (after a GOOD score ≥ 3)
const INTERVAL_MAP = {
  new:        1,
  practising: 2,
  active:     5,
  mastered:   21,
};

// Total GOOD practices (score ≥ 3) needed to advance
const ADVANCE_THRESHOLDS = {
  new:        1,
  practising: 3,
  active:     6,
};

const GOOD_SCORE = 3;

/**
 * Compute updated Firestore fields after a Lightning Round score.
 * @param {object} item  - current lexicon document data (from Firestore)
 * @param {number} score - Lightning score 1–5
 * @returns {object}     - Firestore update payload
 */
export function computeNextReview(item, score) {
  const isGood = score >= GOOD_SCORE;
  const prevCount    = item.practiceCount     || 0;
  const prevGood     = item.goodPracticeCount || 0;
  const prevAvg      = item.avgScore          || 0;

  const practiceCount     = prevCount + 1;
  const goodPracticeCount = prevGood + (isGood ? 1 : 0);

  // Running average (1 decimal)
  const avgScore = prevCount === 0
    ? score
    : Math.round(((prevAvg * prevCount + score) / practiceCount) * 10) / 10;

  // Status advancement — only on good scores
  let newStatus = item.status || "new";
  if (isGood) {
    const threshold = ADVANCE_THRESHOLDS[newStatus];
    if (threshold !== undefined && goodPracticeCount >= threshold) {
      if      (newStatus === "new")        newStatus = "practising";
      else if (newStatus === "practising") newStatus = "active";
      else if (newStatus === "active")     newStatus = "mastered";
    }
  }

  // Interval: bad score → 1 day; good score → use new status interval
  const intervalDays = isGood ? (INTERVAL_MAP[newStatus] ?? 1) : 1;

  const next = new Date();
  next.setDate(next.getDate() + intervalDays);
  const nextReviewDate = next.toISOString().slice(0, 10);

  return {
    practiceCount,
    goodPracticeCount,
    avgScore,
    status: newStatus,
    intervalDays,
    nextReviewDate,
    lastUsedDate: new Date().toISOString(),
  };
}

/**
 * Is this expression due for review today?
 * Replaces the old binary 3-day check.
 */
export function isDueForReview(item) {
  if (item.status === "mastered") {
    if (!item.nextReviewDate) return false;
    return item.nextReviewDate <= new Date().toISOString().slice(0, 10);
  }
  if (!item.nextReviewDate) return true; // never practiced → always due
  return item.nextReviewDate <= new Date().toISOString().slice(0, 10);
}

/**
 * Mastery % (0–100, non-decreasing like Vocabulary.com).
 * 6 good practices = 100 %. Capped at 95 % until status reaches mastered.
 */
export function getMasteryPercent(item) {
  if (item.status === "mastered") return 100;
  const good = item.goodPracticeCount || 0;
  return Math.min(Math.round((good / 6) * 95), 95);
}

/**
 * Human-friendly label for next review date.
 */
export function getNextReviewLabel(item) {
  if (!item.nextReviewDate) return "Due now";
  const today = new Date().toISOString().slice(0, 10);
  if (item.nextReviewDate <= today) return "Due today";
  const next = new Date(item.nextReviewDate + "T00:00:00");
  const now  = new Date();
  const diffDays = Math.round((next - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}
