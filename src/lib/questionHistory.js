// Tracks recently asked question IDs in localStorage to ensure variety
const KEY = (uid) => `fluentpm_qhist_${uid}`;
const MAX_HISTORY = 25;

export function getQuestionHistory(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || "[]"); } catch { return []; }
}

export function addToQuestionHistory(uid, questionId) {
  const hist = getQuestionHistory(uid);
  const updated = [questionId, ...hist.filter(id => id !== questionId)].slice(0, MAX_HISTORY);
  try { localStorage.setItem(KEY(uid), JSON.stringify(updated)); } catch {}
}

export function filterUnseenQuestions(uid, questions) {
  const hist = getQuestionHistory(uid);
  const unseen = questions.filter(q => !hist.includes(q.id));
  // If all seen, return all (allow repeats) but shuffle
  const pool = unseen.length >= 3 ? unseen : questions;
  return pool.sort(() => Math.random() - 0.5);
}
