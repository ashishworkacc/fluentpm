import { collection, query, orderBy, limit, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export async function buildAndSaveCoachingProfile(uid) {
  // Fetch last 10 sessions
  const sessionsRef = collection(db, "users", uid, "sessions");
  const q = query(sessionsRef, orderBy("savedAt", "desc"), limit(10));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => d.data());

  if (sessions.length === 0) return null;

  // topWeakPhrases: flatten all weakPhrases arrays, count frequency, top 3
  const phraseCount = {};
  sessions.forEach(s => {
    (s.weakPhrases || []).forEach(p => {
      phraseCount[p] = (phraseCount[p] || 0) + 1;
    });
  });
  const topWeakPhrases = Object.entries(phraseCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);

  // situationScores: avg aiScore by situationType
  const sitMap = {};
  sessions.forEach(s => {
    if (!s.situationType || !s.aiScore) return;
    if (!sitMap[s.situationType]) sitMap[s.situationType] = { total: 0, count: 0 };
    sitMap[s.situationType].total += s.aiScore;
    sitMap[s.situationType].count += 1;
  });
  const situationScores = {};
  Object.entries(sitMap).forEach(([k, v]) => {
    situationScores[k] = Math.round((v.total / v.count) * 10) / 10;
  });
  const lowestSituation = Object.entries(situationScores).sort((a, b) => a[1] - b[1])[0];

  // recentScores: last 5 aiScores
  const recentScores = sessions.slice(0, 5).map(s => s.aiScore).filter(Boolean);

  // structureAvg and structureWeakness
  const structureScores = sessions.map(s => s.structureScore).filter(Boolean);
  const structureAvg = structureScores.length
    ? Math.round((structureScores.reduce((a, b) => a + b, 0) / structureScores.length) * 10) / 10
    : null;

  // fillerTrend: compare this week vs last week top fillers
  const fillerTotals = {};
  sessions.forEach(s => {
    Object.entries(s.fillerCounts || {}).forEach(([f, c]) => {
      fillerTotals[f] = (fillerTotals[f] || 0) + c;
    });
  });
  const topFiller = Object.entries(fillerTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // lastSession summary
  const last = sessions[0] || {};
  const lastSession = {
    score: last.aiScore || null,
    tip: last.coachTip || null,
    date: last.date || null,
    opponentName: last.opponentName || null,
  };

  const profile = {
    topWeakPhrases,
    situationScores,
    lowestSituationType: lowestSituation?.[0] || null,
    lowestSituationAvg: lowestSituation?.[1] || null,
    recentScores,
    structureAvg,
    structureWeakness: structureAvg && structureAvg < 6 ? "structure" : null,
    topFiller,
    lastSession,
    weeklyContext: "",
    targetExpressions: [], // populated later by lexicon logic
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, "users", uid, "coachingProfile", "main"), profile, { merge: true });
  return profile;
}

export async function getCoachingProfile(uid) {
  const ref = doc(db, "users", uid, "coachingProfile", "main");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
