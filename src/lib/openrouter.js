import { LANGUAGE_REGISTER_RULES } from "../data/languageRules.js";
import { getXPForScore } from "../hooks/useProgress.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-r1";

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
      "You are impatient, blunt, and results-driven. You interrupt if the answer wanders. You do not soften feedback. You challenge everything.",
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
      temperature: 0.3,
      max_tokens: 600,
    }),
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
