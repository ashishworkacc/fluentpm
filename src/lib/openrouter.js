import { LANGUAGE_REGISTER_RULES } from "../data/languageRules.js";
import { getXPForScore } from "../hooks/useProgress.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-chat";
const FAST_MODEL = "deepseek/deepseek-chat";

function getApiKey() {
  return import.meta.env.VITE_OPENROUTER_API_KEY;
}

// ── System Prompt Builder ──────────────────────────────────────────────────

export function buildBattleSystemPrompt(opponent, profile, scenario, options = {}) {
  const { targetInstruction = "", frameworkInstruction = "", midCoachInstruction = "", coachingProfile = null } = options;

  const aggressionMap = {
    low: "You are firm but approachable. You push back gently and give the user space to think.",
    medium:
      "You are direct and demanding. You challenge vague answers and push for specifics. You do not accept waffle.",
    high:
      "You are impatient, blunt, and results-driven. You challenge every vague or generic answer immediately. You interrupt if the answer wanders. You do NOT soften feedback. Ask 'So what?' or 'What does that actually mean?' when answers are unclear. Push for numbers and specific examples.",
  };

  const aggressionStyle = aggressionMap[opponent.aggression] || aggressionMap.medium;

  return `You are ${opponent.name}, ${opponent.role} in a professional setting.
Your catchphrase: "${opponent.catchphrase}"
Your personality: ${opponent.description}
Your communication style: ${aggressionStyle}

SCENARIO CONTEXT:
The user is a Product Manager being challenged with: "${scenario.text}"
Situation type: ${scenario.situationType}
${coachingProfile ? `
USER COACHING PROFILE:
- Top weak phrases: ${coachingProfile.topWeakPhrases?.join(", ") || "none yet"}
- Lowest scoring situation: ${coachingProfile.lowestSituationType || "n/a"} (avg ${coachingProfile.lowestSituationAvg || "n/a"})
- Recent scores: ${coachingProfile.recentScores?.join(", ") || "first session"}
- Structure weakness: ${coachingProfile.structureAvg ? (coachingProfile.structureAvg < 6 ? "needs work" : "solid") : "n/a"}
- Last session tip: ${coachingProfile.lastSession?.tip || "none"}
` : ""}
YOUR ROLE IN THIS CONVERSATION:
- You are playing the opponent in a realistic workplace simulation.
- You started the conversation with the scenario line above.
- The user will respond to you. You will reply as your character — challenging, probing, realistic.
- After EXACTLY 3 user turns, you MUST output your final response AND then a ###FEEDBACK### block.
- You must count user turns carefully. Turn 1, Turn 2, Turn 3 — then feedback on Turn 3.
- Before Turn 3 ends, keep the pressure on. Ask follow-up questions. Do not be easy.

TURN COUNTING INSTRUCTIONS:
- After the user's FIRST response: Reply in character. Push back or ask a follow-up.
- After the user's SECOND response: Reply in character. Probe further. Increase pressure if needed.
- After the user's THIRD response: Reply in character (wrap up the conversation naturally), then IMMEDIATELY output the ###FEEDBACK### block below.

${targetInstruction ? `TARGET EXPRESSION: ${targetInstruction}` : ""}
${frameworkInstruction ? `FRAMEWORK GUIDANCE: ${frameworkInstruction}` : ""}
${midCoachInstruction ? `MID-SESSION COACHING CONTEXT: ${midCoachInstruction}` : ""}

${LANGUAGE_REGISTER_RULES}

IMPORTANT: Do not inflate scores. An average professional speaking under pressure scores 5-6. Reserve 8+ for responses that would genuinely impress a senior executive.

SCORING ANCHORS — apply strictly:
- 4: Rambling, no structure, basic vocabulary, multiple filler phrases, no evidence
- 5: Some structure but vague, safe phrases only, no concrete examples or numbers
- 6: Decent structure, one concrete point, some professional vocabulary
- 7: Clear structure, specific examples, professional vocabulary, direct communication
- 8: Strong structure, quantified points, confident delivery, natural professional English
- 9: Exceptional — would genuinely impress a senior exec, crisp and memorable
- 10: Flawless — rare, reserve for truly exceptional responses

Default assumption: most real answers from someone learning English professionally land at 5-6.
Never give 7+ unless you can quote a specific strong phrase from what the user said.
Never give 8+ to a response that contains vague phrases like "we need to look into this" or "it's complicated".

STRICT SCORING RUBRIC — apply this exactly:
SCORE is an integer from 4 to 10. Most responses should score 4–6. 7 requires genuine quality. 8+ is rare.

Score 4 — Generic, vague, no specifics. Filler-heavy. Incomplete sentences. Could have been said by anyone.
Score 5 — Somewhat relevant. Gets the point across but lacks structure, evidence, or professional vocabulary.
Score 6 — Clear and relevant. Decent structure. Minor filler words. Missing precision or examples.
Score 7 — Well-structured, specific, professional vocabulary. Minor weaknesses only. Clearly above average.
Score 8 — Excellent structure, precise language, confident framing, specific examples or data. Very few issues.
Score 9 — Near-perfect. Would hold up in a real board meeting. Articulate, decisive, data-aware.
Score 10 — Reserved for truly exceptional responses. Do not give 10 unless the response is genuinely outstanding.

Deduct points for: filler words (basically, actually, you know, I mean), vague statements without specifics,
weak openers ("I think maybe...", "So yeah..."), incomplete sentences, Indian English phrases from the blacklist,
failing to directly address the question asked, going off-topic.

STRUCTURE_SCORE is 1–5 (NOT 1–10):
1 = No structure — rambling, no clear point
2 = Weak — some attempt at structure but confusing
3 = Adequate — clear enough but missing intro or conclusion
4 = Good — clear structure with opening and closing
5 = Excellent — textbook structure, framework applied correctly

FEEDBACK BLOCK FORMAT — output this EXACTLY after your Turn 3 reply:

###FEEDBACK###
SCORE: [4-10, integer]
XP: [integer, 15-50 based on score]
WEAK_PHRASES: [phrase1 || phrase2 || phrase3 — exact quotes from user's speech, or "none"]
POWER_PHRASES: ["phrase1" || "phrase2" — strong phrases the user actually used, or "none"]
HIGHLIGHT: [one sentence on the single best thing the user did]
TIP: [one specific, actionable improvement for next time]
STRUCTURE_SCORE: [1-5 integer]
STRUCTURE_TIP: [one sentence on how to improve structure]
STRUCTURE_REPLAY_SHOW: [true or false]
STRUCTURE_REPLAY_TURN: [if true: quote the exact sentence from the user's response that lacked structure; if false: "none"]
STRUCTURE_REPLAY_FIX: [if true: rewrite that sentence with better structure; if false: "none"]
EXPRESSION_USED: [true or false — did the user use the target expression?]
EXPRESSION_VARIANT_USED: [true or false — did the user use a natural variant of it?]
FRAMEWORK_FIT: [1-5 if a framework was suggested, null if not]
FRAMEWORK_TIP: [one sentence on how the framework was or wasn't used; "none" if no framework]
NATURALNESS_FLAG: [phrase from user's transcript] | [Indian English | Bookish | Corporate Jargon] | [natural alternative — or "none" if no flags]
(repeat NATURALNESS_FLAG line for each flag, or write NATURALNESS_FLAG: none if there are none)
###END###`;
}

// ── Feedback Parser ──────────────────────────────────────────────────────────

export function parseFeedbackBlock(text) {
  const blockMatch = text.match(/###FEEDBACK###([\s\S]*?)###END###/);
  if (!blockMatch) return null;

  const block = blockMatch[1];

  function extract(key) {
    const regex = new RegExp(`^${key}:\\s*(.+)$`, "im");
    const match = block.match(regex);
    return match ? match[1].trim() : "";
  }

  function extractAll(key) {
    const regex = new RegExp(`^${key}:\\s*(.+)$`, "gim");
    const results = [];
    let match;
    while ((match = regex.exec(block)) !== null) {
      results.push(match[1].trim());
    }
    return results;
  }

  const scoreRaw = extract("SCORE");
  const score = parseInt(scoreRaw, 10) || 6;

  const xpRaw = extract("XP");
  const xp = parseInt(xpRaw, 10) || getXPForScore(score);

  const weakPhrasesRaw = extract("WEAK_PHRASES");
  const weakPhrases =
    weakPhrasesRaw === "none" || !weakPhrasesRaw
      ? []
      : weakPhrasesRaw.split("||").map(p => p.trim()).filter(Boolean);

  const powerPhrasesRaw = extract("POWER_PHRASES");
  const powerPhrases =
    powerPhrasesRaw === "none" || !powerPhrasesRaw
      ? []
      : powerPhrasesRaw
          .split("||")
          .map(p => p.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);

  const highlight = extract("HIGHLIGHT");
  const tip = extract("TIP");

  const structureScoreRaw = extract("STRUCTURE_SCORE");
  const structureScore = parseInt(structureScoreRaw, 10) || 3;
  const structureTip = extract("STRUCTURE_TIP");

  const structureReplayShowRaw = extract("STRUCTURE_REPLAY_SHOW");
  const structureReplayShow = structureReplayShowRaw.toLowerCase() === "true";

  const structureReplayTurn = extract("STRUCTURE_REPLAY_TURN");
  const structureReplayFix = extract("STRUCTURE_REPLAY_FIX");

  const expressionUsedRaw = extract("EXPRESSION_USED");
  const expressionUsed = expressionUsedRaw.toLowerCase() === "true";

  const expressionVariantUsedRaw = extract("EXPRESSION_VARIANT_USED");
  const expressionVariantUsed = expressionVariantUsedRaw.toLowerCase() === "true";

  const frameworkFitRaw = extract("FRAMEWORK_FIT");
  const frameworkFit =
    frameworkFitRaw === "null" || !frameworkFitRaw
      ? null
      : parseInt(frameworkFitRaw, 10) || null;

  const frameworkTip = extract("FRAMEWORK_TIP");

  // Parse naturalness flags (multiple lines possible)
  const naturalnessFlagLines = extractAll("NATURALNESS_FLAG");
  const naturalnessFlagsDetails = [];

  for (const line of naturalnessFlagLines) {
    if (line.toLowerCase() === "none") continue;
    const parts = line.split("|").map(p => p.trim());
    if (parts.length >= 3) {
      naturalnessFlagsDetails.push({
        phrase: parts[0],
        category: parts[1],
        alternative: parts[2],
      });
    }
  }

  const naturalnessFlagsCount = naturalnessFlagsDetails.length;

  return {
    score,
    xp,
    weakPhrases,
    powerPhrases,
    highlight,
    tip,
    structureScore,
    structureTip,
    structureReplayShow,
    structureReplayTurn: structureReplayShow ? structureReplayTurn : "",
    structureReplayFix: structureReplayShow ? structureReplayFix : "",
    expressionUsed,
    expressionVariantUsed,
    frameworkFit,
    frameworkTip: frameworkTip === "none" ? "" : frameworkTip,
    naturalnessFlagsDetails,
    naturalnessFlagsCount,
  };
}

// ── Battle API Call ──────────────────────────────────────────────────────────

export async function sendBattleMessage(messages, opponent, profile, scenario, options = {}, coachingProfile = null) {
  const systemPrompt = buildBattleSystemPrompt(opponent, profile, scenario, { ...options, coachingProfile });

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "FluentPM",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "";

  let feedbackBlock = null;
  if (reply.includes("###FEEDBACK###")) {
    feedbackBlock = parseFeedbackBlock(reply);
  }

  return { reply, feedbackBlock };
}

// ── Enrich Expression ────────────────────────────────────────────────────────

export function buildEnrichPrompt(expression) {
  return `You are a language coach specialising in professional communication for Product Managers.

Analyse the following expression and return a JSON object ONLY (no markdown, no extra text).

Expression: "${expression}"

${LANGUAGE_REGISTER_RULES}

Return EXACTLY this JSON schema:
{
  "meaning": "plain English explanation of what this expression means",
  "whenToUse": "one sentence on the ideal situation to use this",
  "example": "one realistic example sentence using this expression in a PM context",
  "variants": ["variant1", "variant2", "variant3"],
  "avoid": "what NOT to do when using this — one sentence",
  "naturalness": {
    "rating": 1,
    "label": "Natural | Slightly Formal | Bookish | Indian English | Corporate Jargon",
    "alternative": "how a fluent PM would say this — empty string if rating >= 3"
  }
}

Rules:
- naturalness.rating: 1=Natural, 2=Slightly Formal, 3=Bookish, 4=Indian English, 5=Corporate Jargon
- variants must be natural alternatives that pass the language register rules above
- Return valid JSON only`;
}

export async function enrichExpression(expression) {
  const prompt = buildEnrichPrompt(expression);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    try {
      // Strip any markdown code fences if present
      const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse enrich response:", raw);
      return null;
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ── Lightning Round ──────────────────────────────────────────────────────────

export function buildLightningPrompt(targetExpression, variantToUse, variantText, scenario) {
  return `You are a language coach running a lightning round speaking drill for a Product Manager.

TARGET EXPRESSION: "${targetExpression}"
VARIANT TO USE: ${variantToUse} — "${variantText}"
SCENARIO: "${scenario}"

The user will try to use the target expression or its variant naturally in a short spoken response to the scenario above.

${LANGUAGE_REGISTER_RULES}

Score the user's response and return EXACTLY this JSON (no markdown, no extra text):
{
  "score": 1-5,
  "usedExpression": true or false,
  "usedNaturally": true or false,
  "feedback": "one sentence of specific, actionable feedback",
  "betterVersion": "a model sentence showing how to use the expression ideally in this scenario — empty string if score >= 4",
  "naturalnessFlagsCount": 0,
  "naturalnessFlagsDetails": [
    {
      "phrase": "phrase from user's transcript",
      "category": "Indian English | Bookish | Corporate Jargon",
      "alternative": "natural alternative"
    }
  ]
}

Score guide:
1 = Did not attempt the expression at all
2 = Attempted but awkward or forced
3 = Used it but context or delivery was weak
4 = Used it naturally and it fit the scenario well
5 = Perfect — natural, relevant, confident`;
}

/**
 * Corrects speech recognition errors using conversation context.
 * Fast call — max 150 tokens, temperature 0.1.
 */
export async function correctTranscript(rawTranscript, conversationContext, scenarioText) {
  if (!rawTranscript || rawTranscript.trim().length < 4) return rawTranscript;

  const prompt = `You are correcting a speech-to-text transcript for a Product Manager speaking in a professional conversation.

Scenario they are discussing: "${scenarioText}"
Recent conversation context: "${conversationContext}"
Raw speech-to-text transcript: "${rawTranscript}"

Fix ONLY clear speech recognition errors (wrong words that don't make sense in context, mispronounced proper nouns, garbled short words).
DO NOT: add new sentences, change the meaning, improve the language, or fix grammar.
DO: fix words that are clearly wrong given the context (e.g. "we need to address the retension" → "retention", "i think the sprent was fine" → "sprint").

Return ONLY the corrected transcript text. Nothing else. No explanation. No quotes.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s max — fast call
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return rawTranscript; // fallback to raw on error
    const data = await response.json();
    const corrected = data.choices?.[0]?.message?.content?.trim();
    return corrected && corrected.length > 0 ? corrected : rawTranscript;
  } catch {
    return rawTranscript; // always fall back to raw transcript, never block
  }
}

// ── PM Interview System Prompt ───────────────────────────────────────────────

export function buildInterviewSystemPrompt(interviewer, question, questionType) {
  const evalDimensions = {
    product_design: "Product Sense (40%), Communication (30%), Execution Thinking (30%)",
    metrics: "Analytical Thinking (50%), Communication (25%), Product Sense (25%)",
    strategy: "Strategic Thinking (40%), Product Sense (30%), Communication (30%)",
    behavioral: "Leadership (40%), Communication (35%), Self-Awareness (25%)",
    estimation: "Analytical Thinking (60%), Communication (25%), Structured Thinking (15%)",
    execution: "Execution (45%), Analytical (30%), Communication (25%)",
  };

  return `You are ${interviewer.name}, ${interviewer.role}.
Your interview style: ${interviewer.style}
Your catchphrase: "${interviewer.catchphrase}"

You are conducting a real PM interview. The candidate is answering this question:
"${question.text}"
Question type: ${questionType}
Evaluation dimensions: ${evalDimensions[questionType] || "Product Sense, Communication, Execution"}

INTERVIEW CONDUCT RULES:
- You are a real interviewer, not a coach. Stay in character throughout.
- Ask ONE focused follow-up question per turn. Do not give multiple questions at once.
- Probe on vague claims: "What specifically do you mean by that?"
- Push for numbers: "Can you put a number on that?"
- Challenge assumptions: "What if your assumption about the user is wrong?"
- After EXACTLY 5 user turns, output the ###INTERVIEW_FEEDBACK### block.
- Do NOT give hints. Do NOT soften the interview unrealistically.
- A real PM interview is uncomfortable — replicate that.

TURN STRUCTURE:
- Turn 1: Your opener (already set to the question). Just be the interviewer.
- Turn 2-4: Follow-up questions. Dig into what they said.
- Turn 5: Final question, then the ###INTERVIEW_FEEDBACK### block immediately after your Turn 5 reply.

${LANGUAGE_REGISTER_RULES}

DIMENSION SCORING ANCHORS (1-5 scale — apply strictly):
- 1: Very weak — clear gap, would not pass screening
- 2: Below average — some effort but major gaps
- 3: Average — meets baseline but nothing memorable
- 4: Strong — above expectations, clear competency
- 5: Exceptional — rare, reserve for truly standout moments

Default assumption: most candidates score 2-3 per dimension.
Never give 4+ unless you can cite a specific phrase or moment from the candidate.
Never give 5 unless the response would genuinely impress a senior executive at that company.

###INTERVIEW_FEEDBACK### FORMAT — output EXACTLY after Turn 5 reply:

###INTERVIEW_FEEDBACK###
PRODUCT_SENSE: [1-5]
ANALYTICAL: [1-5]
EXECUTION: [1-5]
COMMUNICATION: [1-5]
LEADERSHIP: [1-5]
VERDICT: [Strong Hire | Hire | No Hire | Strong No Hire]
VERDICT_REASON: [2-3 sentences explaining the verdict — be specific about what tipped it]
STRONGEST_MOMENT: [quote or describe the single best thing the candidate said]
LOST_INTERVIEWER_AT: [the specific moment or answer where you became less convinced — be honest]
SAMPLE_STRONG_ANSWER: [How a top candidate would have answered the core question — 3-4 sentences]
IMPROVE_1: [most important skill/area to develop — one sentence]
IMPROVE_2: [second area — one sentence]
IMPROVE_3: [third area — one sentence]
INNER_MONOLOGUE_T1: [1-2 sentences of what the interviewer was thinking after the user's FIRST response — quote a specific phrase they used and react to it as an internal thought]
INNER_MONOLOGUE_T2: [same for SECOND response]
INNER_MONOLOGUE_T3: [same for THIRD response]
INNER_MONOLOGUE_T4: [same for FOURTH response]
INNER_MONOLOGUE_T5: [same for FIFTH response — this is the lasting impression]
ROOT_CAUSE: [pick ONE from this list: WE_FRAMING | CONFLICT_AVOIDANCE | STATUS_ANXIETY | NARRATIVE_OVERLOAD | GENERIC_SAFETY | DIRECTNESS_GAP | STRUCTURE_COLLAPSE | METRIC_AVOIDANCE | none]
ROOT_CAUSE_EXPLANATION: [one sentence explaining how this pattern appeared in the user's specific response]
ROOT_CAUSE_FIX: [one specific action they can take to fix this pattern — not generic advice]
###END_INTERVIEW###

INNER_MONOLOGUE RULES:
- Write in first person as the interviewer ("When they said X, I thought...")
- Quote or paraphrase a real phrase the user said
- Be honest — if it was weak, say "I was losing confidence here"
- If it was strong, say "This is exactly what I wanted to hear"
- Keep each to 1-2 sentences. Specific beats generic.`;
}

// ── Interview Feedback Parser ────────────────────────────────────────────────

export function parseInterviewFeedback(text) {
  const block = text.split("###INTERVIEW_FEEDBACK###")[1]?.split("###END_INTERVIEW###")[0] || "";
  const extract = (key) => {
    const match = block.match(new RegExp(`${key}:\\s*(.+)`));
    return match ? match[1].trim() : "";
  };
  const score = (key) => parseInt(extract(key), 10) || 0;
  return {
    productSense: score("PRODUCT_SENSE"),
    analytical: score("ANALYTICAL"),
    execution: score("EXECUTION"),
    communication: score("COMMUNICATION"),
    leadership: score("LEADERSHIP"),
    verdict: extract("VERDICT"),
    verdictReason: extract("VERDICT_REASON"),
    strongestMoment: extract("STRONGEST_MOMENT"),
    lostInterviewerAt: extract("LOST_INTERVIEWER_AT"),
    sampleStrongAnswer: extract("SAMPLE_STRONG_ANSWER"),
    improve1: extract("IMPROVE_1"),
    improve2: extract("IMPROVE_2"),
    improve3: extract("IMPROVE_3"),
    innerMonologue: [
      extract("INNER_MONOLOGUE_T1"),
      extract("INNER_MONOLOGUE_T2"),
      extract("INNER_MONOLOGUE_T3"),
      extract("INNER_MONOLOGUE_T4"),
      extract("INNER_MONOLOGUE_T5"),
    ],
    rootCause: extract("ROOT_CAUSE"),
    rootCauseExplanation: extract("ROOT_CAUSE_EXPLANATION"),
    rootCauseFix: extract("ROOT_CAUSE_FIX"),
  };
}

// ── Interview API Call ───────────────────────────────────────────────────────

export async function sendInterviewMessage(messages, interviewer, question, questionType) {
  const systemPrompt = buildInterviewSystemPrompt(interviewer, question, questionType);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "FluentPM",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1400,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "";

  let interviewFeedback = null;
  if (reply.includes("###INTERVIEW_FEEDBACK###")) {
    interviewFeedback = parseInterviewFeedback(reply);
  }

  return { reply, interviewFeedback };
}

// ── Quick Drill Scoring ───────────────────────────────────────────────────────

export function buildQuickDrillPrompt(questionType, question, transcript) {
  return `${LANGUAGE_REGISTER_RULES}

You are a senior PM interviewer evaluating a practice answer. Be direct, specific, and honest.

Question type: ${questionType}
Question: "${question}"
Candidate's answer: "${transcript}"

SCORING ANCHORS:
1 = Very weak — no structure, no substance, very vague
2 = Below average — some attempt but missing key elements
3 = Average — decent but generic, lacks specifics
4 = Strong — clear structure, specific examples, confident language
5 = Exceptional — would impress a senior interviewer

Return ONLY valid JSON:
{
  "score": 1-5,
  "scoreLabel": "Very Weak | Below Average | Average | Strong | Exceptional",
  "strength": "one specific sentence quoting what they said that worked",
  "improvement": "one specific sentence on the single biggest thing to change",
  "rootCause": "WE_FRAMING | CONFLICT_AVOIDANCE | STATUS_ANXIETY | NARRATIVE_OVERLOAD | GENERIC_SAFETY | DIRECTNESS_GAP | STRUCTURE_COLLAPSE | METRIC_AVOIDANCE | none",
  "betterOpener": "rewrite just the first sentence of their answer to be stronger",
  "naturalnessFlagged": "the most unnatural phrase they used, or empty string",
  "naturalAlternative": "how a fluent speaker would say that, or empty string"
}`;
}

export async function scoreLightningRound(
  targetExpression,
  variantToUse,
  variantText,
  scenario,
  transcript
) {
  const systemPrompt = buildLightningPrompt(targetExpression, variantToUse, variantText, scenario);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "FluentPM",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse lightning response:", raw);
    return null;
  }
}
