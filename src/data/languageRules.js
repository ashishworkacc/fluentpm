export const INDIAN_ENGLISH_PHRASES = [
  { phrase: "please revert", alternative: "let me know / get back to me" },
  { phrase: "do the needful", alternative: "please handle this / can you take care of this" },
  { phrase: "prepone", alternative: "move earlier / reschedule to an earlier time" },
  { phrase: "out of station", alternative: "out of office / I'm travelling" },
  { phrase: "kindly do", alternative: "could you / please" },
  { phrase: "discuss about", alternative: "discuss" },
  { phrase: "today only", alternative: "just today / earlier today" },
  { phrase: "revert back", alternative: "I'll follow up / I'll get back to you" },
  { phrase: "intimate the team", alternative: "let the team know" },
  { phrase: "as and when required", alternative: "as needed / when needed" },
  { phrase: "good name", alternative: "what's your name" },
  { phrase: "passed out from", alternative: "graduated from" },
  { phrase: "updation", alternative: "update" },
];

export const BOOKISH_PHRASES = [
  { phrase: "i would like to bring to your attention", alternative: "I want to flag something" },
  { phrase: "with reference to our earlier discussion", alternative: "following up on what we talked about" },
  { phrase: "i am of the opinion that", alternative: "I think / my take is" },
  { phrase: "it has come to my notice", alternative: "I noticed" },
  { phrase: "please find attached herewith", alternative: "I've attached it" },
  { phrase: "as per my understanding", alternative: "the way I understand it" },
  { phrase: "in the event that", alternative: "if" },
  { phrase: "at the present moment in time", alternative: "right now" },
];

export const CORPORATE_JARGON = [
  { phrase: "synergise", alternative: "work together" },
  { phrase: "circle back", alternative: "follow up" },
  { phrase: "touch base", alternative: "check in" },
  { phrase: "move the needle", alternative: "make progress" },
  { phrase: "low-hanging fruit", alternative: "quick wins" },
  { phrase: "boil the ocean", alternative: "do everything at once" },
  { phrase: "bandwidth", alternative: "time / capacity" },
];

export const LANGUAGE_REGISTER_RULES = `
LANGUAGE REGISTER RULES — APPLY TO ALL SUGGESTIONS:
- All phrases must sound natural when spoken aloud, not just correct in writing
- Never suggest Indian English phrases: [do the needful, revert back, revert, prepone, out of station, kindly do, discuss about, intimate the team, as and when, updation, passed out from college, good name]
- Never suggest hollow corporate jargon: [synergise, leverage as a verb, circle back, touch base, move the needle, low-hanging fruit, boil the ocean, deep dive as a noun, bandwidth when meaning time]
- Prefer simple words over complex ones when both are accurate: "show" over "demonstrate", "use" over "utilise", "find out" over "ascertain", "help" over "facilitate"
- All power phrases must pass this test: Would a confident, native English-speaking PM in their 30s say this in a normal conversation? If not, suggest something simpler.
`;
