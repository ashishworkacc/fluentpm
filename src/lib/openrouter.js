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
Your catchphrase (personality flavour ONLY — do NOT open with it literally, and do NOT use it more than once per conversation): "${opponent.catchphrase}"
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
- After the user's FIRST response: Reply in character. Push back on a SPECIFIC claim or gap in what they just said — quote or reference their exact words. Do NOT ask a generic priority/tradeoff question.
- After the user's SECOND response: Reply in character. Probe a DIFFERENT angle than your first follow-up. Choose one: execution details ("how exactly did you do that?"), stakeholder friction ("who pushed back and why?"), measurement ("what metric told you it worked?"), timeline/sequencing, or what they'd do differently. NEVER repeat a priority or tradeoff question if you already asked one.
- After the user's THIRD response: Reply in character (wrap up the conversation naturally), then IMMEDIATELY output the ###FEEDBACK### block below.

FOLLOW-UP VARIETY RULE: Your two follow-up questions across Turn 1 and Turn 2 must cover different angles. Forbidden repeat combos: priority+tradeoff, priority+priority, tradeoff+tradeoff. Vary between: execution, people/stakeholders, evidence/data, failure/risk, timeline, or a specific claim the user made.

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

STRUCTURE SCORING — STAR FRAMEWORK:
Evaluate each STAR component individually:
- S (Situation): Did they set context for what was happening?
- T (Task): Did they name their specific goal or challenge?
- A (Action): Did they describe what THEY personally did?
- R (Result): Did they close with a specific outcome, metric, or impact?

For product design scenarios: map S→Context, T→Constraints, A→Solution, R→Impact

STRUCTURE_SCORE 1-5:
5 = All 4 STAR components hit clearly
4 = All 4 hit but one is weak
3 = Exactly 3 STAR components present
2 = Only 2 STAR components present
1 = 0-1 components — rambling, no structure

COGNITIVE LOAD ANALYSIS — observe the transcript for:
- TRANSLATION_MOMENT: Hesitation or filler before technical/English nouns (suggests translating from native language)
- PERFECT_WORD_SEARCH: Fillers before high-level verbs like "orchestrate", "leverage", "facilitate" (searching for the right word)
- HIERARCHY_FREEZE: Fluency drops after pushback or difficult follow-up questions (anxiety-triggered freeze)
- Report the dominant pattern, or "none" if response was fluent throughout.

FEEDBACK BLOCK FORMAT — output this EXACTLY after your Turn 3 reply:

###FEEDBACK###
SCORE: [4-10, integer]
XP: [integer, 15-50 based on score]
WEAK_PHRASES: [phrase1 || phrase2 || phrase3 — exact quotes from user's speech, or "none"]
POWER_PHRASES: ["phrase1" || "phrase2" — strong phrases the user actually used, or "none"]
HIGHLIGHT: [one sentence on the single best thing the user did]
TIP: [one specific, actionable improvement for next time]
STRUCTURE_SCORE: [1-5 integer]
STRUCTURE_STAR_S: [hit | partial | miss — did they set Situation/Context?]
STRUCTURE_STAR_T: [hit | partial | miss — did they name their Task/Challenge?]
STRUCTURE_STAR_A: [hit | partial | miss — did they describe their Action personally?]
STRUCTURE_STAR_R: [hit | partial | miss — did they close with a Result/Impact/Metric?]
STRUCTURE_TIP: [one sentence focused on the weakest missing STAR component]
STRUCTURE_REPLAY_SHOW: [true or false]
STRUCTURE_REPLAY_TURN: [if true: quote the exact sentence from the user's response that lacked structure; if false: "none"]
STRUCTURE_REPLAY_FIX: [if true: rewrite that sentence with better structure; if false: "none"]
EXPRESSION_USED: [true or false — did the user use the target expression?]
EXPRESSION_VARIANT_USED: [true or false — did the user use a natural variant of it?]
FRAMEWORK_FIT: [1-5 if a framework was suggested, null if not]
FRAMEWORK_TIP: [one sentence on how the framework was or wasn't used; "none" if no framework]
NATURALNESS_FLAG: [phrase from user's transcript] | [Indian English | Bookish | Corporate Jargon] | [natural alternative — or "none" if no flags]
(repeat NATURALNESS_FLAG line for each flag, or write NATURALNESS_FLAG: none if there are none)
COGNITIVE_LOAD_PATTERN: [none | translation_moment | perfect_word_search | hierarchy_freeze | multiple]
COGNITIVE_LOAD_DETAIL: [one sentence describing what was observed — or "none" if no pattern]
PACING_WPM: [words per minute as integer, or null if not measured]
PACING_NOTE: [too fast | too slow | good pace | null — "too fast" if > 170 WPM, "too slow" if < 90 WPM, "good pace" if 90-170]
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
  const structureStarS = extract("STRUCTURE_STAR_S") || null;
  const structureStarT = extract("STRUCTURE_STAR_T") || null;
  const structureStarA = extract("STRUCTURE_STAR_A") || null;
  const structureStarR = extract("STRUCTURE_STAR_R") || null;

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

  const cognitiveLoadPattern = extract("COGNITIVE_LOAD_PATTERN");
  const cognitiveLoadDetail = extract("COGNITIVE_LOAD_DETAIL");
  const pacingWpmRaw = extract("PACING_WPM");
  const pacingWpm = pacingWpmRaw && pacingWpmRaw !== "null" ? parseInt(pacingWpmRaw, 10) || null : null;
  const pacingNoteRaw = extract("PACING_NOTE");
  const pacingNote = pacingNoteRaw && pacingNoteRaw !== "null" ? pacingNoteRaw : null;

  return {
    score,
    xp,
    weakPhrases,
    powerPhrases,
    highlight,
    tip,
    structureScore,
    structureTip,
    structureStarS,
    structureStarT,
    structureStarA,
    structureStarR,
    structureReplayShow,
    structureReplayTurn: structureReplayShow ? structureReplayTurn : "",
    structureReplayFix: structureReplayShow ? structureReplayFix : "",
    expressionUsed,
    expressionVariantUsed,
    frameworkFit,
    frameworkTip: frameworkTip === "none" ? "" : frameworkTip,
    naturalnessFlagsDetails,
    naturalnessFlagsCount,
    cognitiveLoadPattern: cognitiveLoadPattern || "none",
    cognitiveLoadDetail: cognitiveLoadDetail || "none",
    pacingWpm,
    pacingNote,
  };
}

// ── Battle API Call ──────────────────────────────────────────────────────────

/**
 * Send a message turn in an Arena battle session.
 * Streams a response from the AI opponent and returns the cleaned reply text.
 * After exactly 3 user turns the response includes a `###FEEDBACK###` block
 * with structured STAR scores, ownership analysis, and a coaching tip.
 *
 * @param {Array<{role: string, content: string}>} messages - Full conversation history
 * @param {Object} opponent - Opponent profile from `src/data/opponents.js`
 * @param {Object} profile - User coaching profile (weak phrases, recent scores)
 * @param {Object} scenario - Scenario object with `text` and `situationType`
 * @param {Object} [options={}] - Optional target phrase / framework instructions
 * @param {Object|null} [coachingProfile=null] - Aggregated weakness data for adaptive prompting
 * @param {Object|null} [sessionMetrics=null] - Live session metrics (filler rate, WPM)
 * @returns {Promise<string>} Cleaned AI reply, think-tags and leading whitespace stripped
 */
export async function sendBattleMessage(messages, opponent, profile, scenario, options = {}, coachingProfile = null, sessionMetrics = null) {
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
        { role: "system", content: systemPrompt + (sessionMetrics ? `\n\nUSER SPEECH METRICS (this session):\n- Pacing: ${sessionMetrics.wpm ? `${sessionMetrics.wpm} WPM` : "not measured"} (ideal: 120–150 WPM; > 170 = too fast, < 90 = too slow)\n- Total words spoken: ${sessionMetrics.totalWords || "unknown"}` : "") },
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
  // Strip DeepSeek <think>...</think> reasoning blocks before any further processing
  const reply = (data.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "");

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
  "definition": "dictionary-style one-sentence definition in plain English",
  "meaning": "plain English explanation of what this expression means in a PM context",
  "hindi_meaning": "short Hindi translation or equivalent (romanized or Devanagari, 1-4 words)",
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "whenToUse": "one sentence on the ideal situation to use this",
  "example": "one realistic example sentence using this expression in a PM context",
  "variants": ["variant1", "variant2", "variant3"],
  "avoid": "what NOT to do when using this — one sentence",
  "naturalness": {
    "rating": 1,
    "label": "Natural | Slightly Formal | Bookish | Indian English | Corporate Jargon",
    "alternative": "how a fluent PM would say this — empty string if rating <= 2"
  }
}

Rules:
- naturalness.rating: 1=Natural (easy/common), 2=Slightly Formal, 3=Bookish, 4=Indian English, 5=Corporate Jargon (hard/rare)
- Higher rating = harder expression that needs a warning
- synonyms: 2-4 natural English synonyms or near-equivalents
- hindi_meaning: use common Hindi words a non-native PM would recognise
- variants must be natural alternatives that pass the language register rules above
- Return valid JSON only`;
}

/**
 * AI-enrich a Lexicon expression with definition, pronunciation, register,
 * usage examples, and a PM-context sentence.
 * Saves the result directly to Firestore and updates the item's status
 * from `pending_enrichment` to `enriched`.
 *
 * @param {string} expression - The phrase or expression to enrich (e.g. "boil the ocean")
 * @returns {Promise<Object>} Enrichment data: `{ definition, pronunciation, register, examples, pmSentence }`
 * @throws {Error} On network failure or JSON parse error
 */
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
        max_tokens: 900,
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
  return `You are a communication coach evaluating a 60-second spoken response by a Product Manager.

SCENARIO: "${scenario}"
TARGET EXPRESSION (bonus if used naturally): "${targetExpression}"

${LANGUAGE_REGISTER_RULES}

Score the response on OVERALL COMMUNICATION QUALITY. The expression is a bonus — do not penalise for not using it.

Score 1–5:
1 = Very weak — no structure, heavy fillers, unclear
2 = Below average — some attempt but vague or disorganised
3 = Average — gets the point across but generic language
4 = Strong — clear, structured, professional vocabulary
5 = Exceptional — crisp, confident, natural fluency

Return ONLY valid JSON:
{
  "score": 1-5,
  "scoreLabel": "Very Weak | Below Average | Average | Strong | Exceptional",
  "usedExpression": true or false,
  "feedback": "one specific sentence of actionable coaching feedback",
  "betterVersion": "rewrite their 1-2 key sentences more powerfully — or empty string if score >= 4"
}`;
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

ROLE ISOLATION — CRITICAL:
- You are ONLY the interviewer. You speak ONLY as ${interviewer.name}.
- NEVER narrate what a good answer looks like. NEVER model the candidate's response.
- NEVER use phrases like "I'd start by...", "A good answer would...", "For example, I would..." — those are the candidate's words, not yours.
- Your ONLY job is to ask ONE sharp question per turn. Nothing else.
- If you feel the urge to explain or demonstrate, STOP. Ask a question instead.

INTERVIEW CONDUCT RULES:
- You are a real interviewer, not a coach. Stay in character throughout.
- Ask ONE focused follow-up question per turn. Do not give multiple questions at once.
- Probe on vague claims: "What specifically do you mean by that?"
- Push for numbers: "Can you put a number on that?"
- Challenge assumptions: "What if your assumption about the user is wrong?"
- CRITICAL: You MUST ask EXACTLY 5 follow-up questions before outputting the ###INTERVIEW_FEEDBACK### block. Count carefully — do NOT output the feedback block before the user has answered 5 times. If in doubt, ask one more question.
- Do NOT give hints. Do NOT soften the interview unrealistically.
- A real PM interview is uncomfortable — replicate that.

TOUGHNESS RULES — apply strictly:
- If the candidate says "we" more than twice, push back: "I want to understand YOUR specific contribution. What did you personally do?"
- If the answer lacks any metrics or numbers, ask: "Can you put a number on that impact?"
- If the answer is under 2 sentences, push: "That's quite brief. Can you walk me through more of the detail?"
- If the claim seems too perfect, probe: "What went wrong in that process?"
- Never accept the first answer without at least one follow-up probe.
- Challenge assumptions: "What if that assumption doesn't hold? What's your fallback?"
- Push for decisions: "If you had to choose one approach right now, what would it be?"

ADAPTIVE FOLLOW-UP RULES — apply turn by turn:
Turn 1 (Opener): Standard question. Let candidate frame their answer.
Turn 2 (Probe Depth):
- If answer used "we" without specifying role → ask: "What specifically did YOU decide here?"
- If no metric mentioned → ask: "How did you measure success?"
- If answer was strong and specific → acknowledge briefly, pivot to a harder adjacent dimension
Turn 3 (Pressure Point):
- Push on the weakest signal you've heard so far
- If no trade-off mentioned → "What did you deprioritize, and why?"
- If no stakeholder conflict mentioned → "How did you get alignment on that decision?"
Turn 4 (Challenge Assumption):
- Challenge one key assumption in their answer: "You assumed [X] — what if that's not true?"
- Or probe a stated action: "You chose [Y] — why that over [obvious alternative]?"
Turn 5 (Closing Probe):
- "Looking back, what would you do differently?"
- Or: "If this was a company 10x the scale, what changes in your approach?"

PRESSURE CALIBRATION:
- Strong answer (clear ownership, 1+ specific metric, explicit trade-off) → acknowledge briefly, pivot to a harder dimension
- Weak answer (vague, "we"-heavy, zero metrics) → probe HARDER on same topic, do NOT move to new topic
- Never say "great answer" or "that's excellent" — always follow with a probe

TURN STRUCTURE:
- Turn 1: Your opener (already set to the question). Just be the interviewer.
- Turn 2-4: Follow-up questions. Dig into what they said.
- Turns 2-4: Follow-up questions based on what they said. Challenge, probe, push back.
- Turn 5: Your final follow-up question, then immediately output the ###INTERVIEW_FEEDBACK### block after their Turn 5 answer.
- NEVER output ###INTERVIEW_FEEDBACK### before Turn 5. If you feel the candidate has performed poorly, still ask all 5 questions.

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
STRUCTURE_STAR_S: [hit | partial | miss]
STRUCTURE_STAR_T: [hit | partial | miss]
STRUCTURE_STAR_A: [hit | partial | miss]
STRUCTURE_STAR_R: [hit | partial | miss]
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
    structureStarS: extract("STRUCTURE_STAR_S") || null,
    structureStarT: extract("STRUCTURE_STAR_T") || null,
    structureStarA: extract("STRUCTURE_STAR_A") || null,
    structureStarR: extract("STRUCTURE_STAR_R") || null,
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

/**
 * Send a message turn in an Interview simulation session.
 * The AI acts strictly as the interviewer — it asks questions only and never
 * models sample candidate answers (role isolation enforced in system prompt).
 *
 * @param {Array<{role: string, content: string}>} messages - Full conversation history
 * @param {Object} interviewer - Interviewer profile from `src/data/interviewers.js`
 * @param {Object} question - Interview question object with `text` and `type`
 * @param {string} questionType - One of "behavioral", "product", "estimation", "strategy"
 * @param {Object|null} [sessionMetrics=null] - Live session metrics for adaptive prompting
 * @returns {Promise<string>} Interviewer's next question or follow-up, think-tags stripped
 */
export async function sendInterviewMessage(messages, interviewer, question, questionType, sessionMetrics = null) {
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
        { role: "system", content: systemPrompt + (sessionMetrics ? `\n\nUSER SPEECH METRICS (this session):\n- Pacing: ${sessionMetrics.wpm ? `${sessionMetrics.wpm} WPM` : "not measured"} (ideal: 120–150 WPM)\n- Total words spoken: ${sessionMetrics.totalWords || "unknown"}` : "") },
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
  // Strip DeepSeek internal reasoning before any processing
  const reply = (data.choices?.[0]?.message?.content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "");

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

// ── Elite Version Generator ───────────────────────────────────────────────────

export async function generateEliteVersion(userTranscript, scenarioText, opponentName) {
  const prompt = `You are a communication coach. Rewrite the following PM's answer to be elite-level: crisp, structured, confident, natural.

Scenario: "${scenarioText}"
Original answer: "${userTranscript}"

Rules:
- Keep the same core content and intent
- Use the PREP or CAR framework naturally
- Remove fillers, vague phrases, Indian English patterns
- Make it sound natural and conversational, not robotic
- Max 4 sentences. First sentence must be a strong opener.

Return ONLY the rewritten response. No explanation. No quotes around it.`;

  try {
    const res = await fetch(OPENROUTER_API_URL, {
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
        temperature: 0.5,
        max_tokens: 200,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

// ── Interview Readiness Assessment ───────────────────────────────────────────

/**
 * AI-driven interview readiness score.
 * Sends a compact session summary (~200 tokens) and gets back:
 * { score: 0-100, label, summary, gaps[], strengths[], nextAction }
 * Returns null on failure — caller should use formula fallback.
 */
/**
 * Assess a user's overall PM interview readiness based on their session history.
 * Returns a structured report with a readiness score, top strengths, critical
 * gaps, and a prioritised 7-day action plan.
 * Results are cached in sessionStorage for 30 minutes to avoid redundant API calls.
 *
 * @param {Array<Object>} sessions - Arena battle sessions from Firestore
 * @param {Array<Object>} interviews - Interview simulation sessions from Firestore
 * @returns {Promise<Object>} `{ readinessScore, strengths, gaps, actionPlan, summary }`
 */
export async function assessInterviewReadiness(sessions, interviews) {
  const recentSessions = sessions.slice(0, 15);
  const avgScore = recentSessions.length
    ? (recentSessions.reduce((s, x) => s + (x.aiScore || x.score || 0), 0) / recentSessions.length).toFixed(1)
    : 0;
  const allWeak = sessions.flatMap(s => s.weakPhrases || []);
  const weakCounts = {};
  allWeak.forEach(p => { weakCounts[p] = (weakCounts[p] || 0) + 1; });
  const topWeak = Object.entries(weakCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([p]) => p).join(", ") || "none";
  const allTips = sessions.slice(0, 8).map(s => s.coachTip || s.tip).filter(Boolean).join("; ").slice(0, 300);
  const interviewVerdicts = interviews.slice(0, 5).map(i => i.verdict || "").filter(Boolean).join(", ") || "none";
  const situationTypes = [...new Set(sessions.slice(0, 15).map(s => s.situationType).filter(Boolean))].join(", ") || "mixed";
  const scoreSpread = recentSessions.map(s => s.aiScore || s.score || 0).filter(Boolean).join(",") || "none";

  const prompt = `You are a strict PM interview coach assessing a candidate's readiness.

Practice data:
- Arena sessions: ${sessions.length}, Interviews: ${interviews.length}
- Avg score (last ${recentSessions.length}): ${avgScore}/10
- Score spread: ${scoreSpread}
- Recurring weak phrases: ${topWeak}
- Recent coach tips: ${allTips || "none"}
- Interview verdicts: ${interviewVerdicts}
- Scenario types covered: ${situationTypes}

Rules for scoring:
- 0-15: No data / just started
- 16-35: Early stage — needs more volume regardless of score
- 36-55: Building — consistent practice but gaps remain
- 56-74: Getting there — strong scores but needs polish under pressure
- 75-89: Almost ready — solid but one or two clear gaps to fix
- 90-100: Interview ready — consistently excellent across formats

IMPORTANT: Score < 50 if fewer than 5 sessions. Score 70+ ONLY if avg >= 7.0 AND 8+ sessions.

Return ONLY valid JSON, no markdown:
{"score":0,"label":"Early Stage","summary":"one honest sentence","gaps":["gap1","gap2"],"strengths":["strength1"],"nextAction":"one specific action"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(OPENROUTER_API_URL, {
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
        temperature: 0.2,
        max_tokens: 350,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? "{}").replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed.score !== "number") return null;
    parsed.score = Math.min(100, Math.max(0, Math.round(parsed.score)));
    return parsed;
  } catch {
    return null;
  }
}

// ── Lightning Round ──────────────────────────────────────────────────────────

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

// ── Polish Lightning Response ─────────────────────────────────────────────────

/**
 * Lightly polish a spoken Lightning Round response — fix grammar, filler word removal,
 * and natural phrasing — without changing the meaning or adding new ideas.
 * Returns { polished: string, changes: string[] }
 */
export async function polishLightningResponse(userText, expression, scenario) {
  if (!userText || userText.trim().length < 10) return { polished: userText, changes: [] };

  const prompt = `You are a professional communication editor helping a Product Manager polish their spoken response.

SCENARIO: "${scenario}"
TARGET EXPRESSION (they may or may not have used it): "${expression}"
ORIGINAL RESPONSE: "${userText}"

Your task: lightly polish the response to improve natural fluency. Rules:
1. Fix clear grammar errors and filler words (um, uh, like, you know, basically)
2. Improve sentence flow without changing the meaning
3. Do NOT add new ideas, facts, or arguments — only rephrase existing ones
4. Keep the same structure and approximate length
5. If the expression was used awkwardly, fix only the phrasing around it

Return ONLY valid JSON:
{
  "polished": "the improved version of their response",
  "changes": ["short description of change 1", "short description of change 2"]
}

If the response is already clean, return it unchanged with an empty changes array.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
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
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return { polished: userText, changes: [] };
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      polished: parsed.polished || userText,
      changes: parsed.changes || [],
    };
  } catch {
    return { polished: userText, changes: [] };
  }
}

// ── Score Contextual Usage ────────────────────────────────────────────────────

/**
 * Score a user's attempt at using an expression in context.
 * Returns { score: 1-5, feedback: string, isNatural: boolean }
 */
export async function scoreContextualUsage(expression, userSentence) {
  const prompt = `You are a communication coach for product managers.

The user is practicing the expression: "${expression}"

Their attempt: "${userSentence}"

Evaluate their usage. Consider:
1. Did they use the expression naturally (not forced)?
2. Does it fit a professional PM context?
3. Is the sentence clear and complete?

Respond with EXACTLY this format:
SCORE: [1-5]
IS_NATURAL: [yes|no]
FEEDBACK: [2-3 sentence coaching feedback. Be specific and constructive. Start with what they did well if score >= 3.]
EXAMPLE: [A better example sentence using the expression in a PM context]`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://fluentpm.app",
      "X-Title": "FluentPM",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  const scoreMatch = text.match(/SCORE:\s*(\d)/);
  const naturalMatch = text.match(/IS_NATURAL:\s*(yes|no)/i);
  const feedbackMatch = text.match(/FEEDBACK:\s*(.+?)(?=EXAMPLE:|$)/s);
  const exampleMatch = text.match(/EXAMPLE:\s*(.+?)$/s);

  return {
    score: scoreMatch ? parseInt(scoreMatch[1]) : 3,
    isNatural: naturalMatch ? naturalMatch[1].toLowerCase() === "yes" : true,
    feedback: feedbackMatch ? feedbackMatch[1].trim() : "Good attempt. Keep practicing!",
    example: exampleMatch ? exampleMatch[1].trim() : null,
  };
}

// ── Clean Bulk Input with AI ──────────────────────────────────────────────────

/**
 * Use AI to clean and normalize a list of expressions/questions before saving.
 * Removes duplicates, fixes formatting, strips numbering.
 * Returns cleaned array of strings.
 */
export async function cleanBulkInputWithAI(lines, type = "expression") {
  if (lines.length === 0) return lines;

  const isExpression = type === "expression";
  const prompt = isExpression
    ? `You are helping clean a list of ${lines.length} professional expressions/phrases for a vocabulary app.

Raw input (one per line):
${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Clean this list:
1. Remove any numbering or bullet points from the start of each line
2. Fix obvious typos in the expressions
3. Remove exact duplicates (keep first occurrence only)
4. Remove lines that are clearly not expressions (e.g. URLs, single random characters, blank placeholders)
5. Trim leading/trailing whitespace
6. Keep ALL valid expressions — do not impose any item limit

Return ONLY the cleaned expressions, one per line, no numbering, no commentary, no extra text.`
    : `You are helping clean a list of ${lines.length} interview questions for a PM interview prep app.

Raw input (one per line):
${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Clean this list:
1. Remove numbering or bullet points from the start of each line
2. Fix obvious typos and grammar errors
3. Remove exact duplicates (keep first occurrence only)
4. Remove lines that are clearly not questions (e.g. URLs, gibberish, single words)
5. Trim leading/trailing whitespace
6. Keep ALL valid questions — do not impose any item limit

Return ONLY the cleaned questions, one per line, no numbering, no commentary, no extra text.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://fluentpm.app",
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.split("\n").map(l => l.trim()).filter(Boolean);
    // Safety: if AI returned significantly fewer items than input (>30% loss), fall back to lightly cleaned originals
    if (cleaned.length > 0 && cleaned.length >= lines.length * 0.7) {
      return cleaned;
    } else if (cleaned.length > 0) {
      return cleaned; // still use AI result even if smaller — duplicates were removed
    }
    return lines;
  } catch {
    return lines;
  }
}

/**
 * Generate an optimized "gold standard" version of the user's interview answer.
 * Returns { optimizedAnswer: string, ownershipIssues: string[], metricGaps: string[] }
 */
export async function generateOptimizedAnswer(userTranscript, questionText, questionType) {
  const prompt = `You are an expert PM interview coach. A candidate answered the following interview question:

QUESTION: "${questionText}"
QUESTION TYPE: ${questionType}

CANDIDATE'S ANSWER:
"${userTranscript}"

Analyze and rewrite their answer. Return EXACTLY this format:

OPTIMIZED_ANSWER: [A 4-6 sentence STAR-aligned answer using "I" (not "we"), specific metrics, and active voice. Use the same general context/story the candidate mentioned but elevate the language and structure.]

OWNERSHIP_ISSUES: [Comma-separated list of exact phrases where candidate used "we/us/our" instead of "I/my", or used passive voice. Max 4 items. If none, write "none"]

METRIC_GAPS: [Comma-separated list of points where a specific number/% would strengthen the answer. Max 3 items. If none, write "none"]`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://fluentpm.app",
        "X-Title": "FluentPM",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    const optimizedMatch = text.match(/OPTIMIZED_ANSWER:\s*(.+?)(?=OWNERSHIP_ISSUES:|$)/s);
    const ownershipMatch = text.match(/OWNERSHIP_ISSUES:\s*(.+?)(?=METRIC_GAPS:|$)/s);
    const metricMatch = text.match(/METRIC_GAPS:\s*(.+?)$/s);

    const ownershipRaw = ownershipMatch?.[1]?.trim() || "none";
    const metricRaw = metricMatch?.[1]?.trim() || "none";

    return {
      optimizedAnswer: optimizedMatch?.[1]?.trim().replace(/^["']|["']$/g, "") || "",
      ownershipIssues: ownershipRaw === "none" ? [] : ownershipRaw.split(",").map(s => s.trim()).filter(Boolean),
      metricGaps: metricRaw === "none" ? [] : metricRaw.split(",").map(s => s.trim()).filter(Boolean),
    };
  } catch {
    return { optimizedAnswer: "", ownershipIssues: [], metricGaps: [] };
  }
}

// ── Podcast Simulation ─────────────────────────────────────────────────────

/**
 * Parse a raw podcast/conversation transcript into structured turns.
 * @param {string} rawText - raw transcript text
 * @returns {{ speakers: string[], turns: { speaker: string, text: string }[] }}
 * @throws {Error} "SINGLE_SPEAKER" | "EMPTY_TURNS" | "network"
 */
export async function parsePodcastTranscript(rawText) {
  const sliced = rawText.slice(0, 6000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `Parse this conversation transcript into structured JSON.

Rules:
- Identify all speakers (e.g. "Alex:", "[Alex]:", "ALEX:", timestamps before names).
- Merge consecutive lines from the same speaker into one turn.
- Output ONLY valid JSON, no markdown fences, no explanation.
- Format: { "speakers": ["SpeakerA", "SpeakerB"], "turns": [{ "speaker": "SpeakerA", "text": "..." }, ...] }

Transcript:
${sliced}`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error("network");

    const data = await res.json();
    let raw = (data.choices?.[0]?.message?.content ?? "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```[\w]*\n?/m, "")
      .replace(/```$/m, "")
      .trim();

    const parsed = JSON.parse(raw);
    const speakers = parsed.speakers ?? [];
    const turns = parsed.turns ?? [];

    if (speakers.length < 2) throw new Error("SINGLE_SPEAKER");
    if (turns.length < 2) throw new Error("EMPTY_TURNS");

    return { speakers, turns };
  } catch (err) {
    clearTimeout(timeout);
    if (err.message === "SINGLE_SPEAKER" || err.message === "EMPTY_TURNS") throw err;
    throw new Error("network");
  }
}

/**
 * Score a single user podcast turn.
 * @param {string} originalLine - the original script line the user was performing
 * @param {string[]} targetPhrases - phrases tagged for practice
 * @param {string} userTranscript - what the user actually said (from STT)
 * @returns {{ meaningScore: number|null, phrasesUsed: string[], missedPhrases: string[], overallScore: number|null, feedback: string }}
 */
export async function scorePodcastTurn(originalLine, targetPhrases, userTranscript) {
  const nullFallback = {
    meaningScore: null,
    phrasesUsed: [],
    missedPhrases: targetPhrases,
    overallScore: null,
    feedback: "Scoring unavailable.",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `Evaluate this spoken response and return ONLY valid JSON — no markdown, no explanation.

Original line: "${originalLine}"
Target phrases to use: ${JSON.stringify(targetPhrases)}
User said: "${userTranscript}"

Score on:
1. meaningScore (1-5): How well the user preserved the meaning of the original line.
2. phrasesUsed: Array of target phrases the user actually used (allow inflections/paraphrases).
3. missedPhrases: Target phrases the user did NOT use.
4. overallScore (1-10): 50% meaning preservation + 30% phrase usage rate + 20% fluency/naturalness.
5. feedback: One sentence of constructive coaching.

Return JSON: { "meaningScore": <1-5>, "phrasesUsed": [...], "missedPhrases": [...], "overallScore": <1-10>, "feedback": "..." }`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!res.ok) return nullFallback;

    const data = await res.json();
    let raw = (data.choices?.[0]?.message?.content ?? "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^```[\w]*\n?/m, "")
      .replace(/```$/m, "")
      .trim();

    const result = JSON.parse(raw);
    return {
      meaningScore: result.meaningScore ?? null,
      phrasesUsed: result.phrasesUsed ?? [],
      missedPhrases: result.missedPhrases ?? targetPhrases,
      overallScore: result.overallScore ?? null,
      feedback: result.feedback ?? "Scoring unavailable.",
    };
  } catch {
    return nullFallback;
  }
}
