export const PHRASE_CATEGORIES = {
  buyingTime: {
    label: "Buying Time",
    description: "Use these to pause and think without sounding unprepared.",
    phrases: [
      {
        text: "That's a fair challenge — let me think through this for a second.",
        situationNote: "Stakeholder or escalation pressure",
        whenToUse: "When you need 5–10 seconds to structure your answer without filling the silence with 'ums'."
      },
      {
        text: "Good question — can I just confirm what you're asking? Are you focused on X or Y?",
        situationNote: "Ambiguous question",
        whenToUse: "When the question has multiple interpretations and clarifying it buys you time AND shows precision."
      },
      {
        text: "Let me make sure I'm answering the right thing — is the core issue the timeline or the resourcing?",
        situationNote: "Meeting or review",
        whenToUse: "Redirects the conversation while you think. Especially useful in heated stakeholder discussions."
      },
      {
        text: "I want to give you a real answer, not a quick one — can I take 30 seconds?",
        situationNote: "High-stakes meeting",
        whenToUse: "When the stakes are high enough that accuracy matters more than speed."
      },
      {
        text: "Before I answer — what's driving this question for you right now?",
        situationNote: "One-on-one or escalation",
        whenToUse: "Flips the dynamic. Works especially well when you suspect there's a hidden concern behind the question."
      },
      {
        text: "I've got a view on this, but let me frame it properly.",
        situationNote: "Any situation",
        whenToUse: "Signals confidence while buying 3–5 seconds. Better than 'uh, so basically...'"
      },
      {
        text: "There are a few angles here — let me start with the most important one.",
        situationNote: "Complex or multi-part question",
        whenToUse: "Use when a question has multiple dimensions and you want to prioritise rather than ramble."
      },
      {
        text: "I don't have the exact number in front of me, but I can give you the directional picture — and I'll follow up with specifics.",
        situationNote: "Data question you're unprepared for",
        whenToUse: "Honest, composed, and action-oriented. Never make up numbers."
      }
    ]
  },

  disagreeing: {
    label: "Disagreeing",
    description: "Push back without sounding defensive or aggressive.",
    phrases: [
      {
        text: "I see it slightly differently — can I share my take?",
        situationNote: "Any disagreement",
        whenToUse: "Soft, non-confrontational opener. Works in any room, any seniority level."
      },
      {
        text: "I hear you, and I want to make sure we're working from the same data.",
        situationNote: "Data or facts in dispute",
        whenToUse: "Neutral bridge that reframes disagreement as an information alignment problem."
      },
      {
        text: "I think we might be optimising for different things here — can we align on what we're trying to solve?",
        situationNote: "Priority or approach disagreement",
        whenToUse: "Surfaces the underlying conflict without making it personal."
      },
      {
        text: "I'd push back on that a little — here's my concern.",
        situationNote: "Direct pushback needed",
        whenToUse: "More direct than 'I see it differently'. Use when soft openers won't land."
      },
      {
        text: "I want to flag something — I think that approach has a risk we haven't talked about.",
        situationNote: "Risk flagging",
        whenToUse: "When you need to raise an objection without blocking momentum. Positions you as thoughtful, not obstructive."
      },
      {
        text: "That's one way to look at it. The reason I'd do it differently is...",
        situationNote: "Alternative approach",
        whenToUse: "Validates their view first, then pivots. Reduces defensiveness from the other side."
      },
      {
        text: "I respect where this is coming from, but I'm not sure this is the right call. Here's why.",
        situationNote: "Senior stakeholder decision you disagree with",
        whenToUse: "When you need to be on record as objecting — but you've thought about it, not just reacting."
      },
      {
        text: "Can we pressure-test this before we commit? I have a few questions.",
        situationNote: "Decision being rushed",
        whenToUse: "Slows down a bad decision without saying 'you're wrong'. Sounds collaborative, not obstructive."
      }
    ]
  },

  standup: {
    label: "Standup",
    description: "Crisp, structured updates for daily standups and check-ins.",
    phrases: [
      {
        text: "Yesterday I focused on X. Today the plan is Y. I have one blocker — I need Z from the backend team by noon.",
        situationNote: "Standard standup",
        whenToUse: "The classic yesterday/today/blockers structure. Fast, complete, no padding."
      },
      {
        text: "I'm on track for the sprint goal. The main risk I'm watching is the third-party API response time.",
        situationNote: "Risk flagging in standup",
        whenToUse: "When things look fine but you want to flag a risk early — before it becomes a blocker."
      },
      {
        text: "I hit a dependency I didn't anticipate — I've flagged it to Ravi and we're aligned on a workaround by end of day.",
        situationNote: "Blocker with a plan",
        whenToUse: "Never just state the blocker — state the action you've already taken. This is the difference."
      },
      {
        text: "My confidence on shipping this by Friday is about 70%. The remaining risk is QA sign-off, which is out of my hands.",
        situationNote: "Confidence rating",
        whenToUse: "When your manager or lead asks for a status. Giving a number with context is more credible than 'should be fine'."
      },
      {
        text: "This is taking longer than I estimated. The scope turned out to be bigger than the ticket described — here's what I found.",
        situationNote: "Explaining a delay",
        whenToUse: "Own the delay, but give the reason. Don't just say 'it's delayed'. Show that you understand why."
      },
      {
        text: "Nothing blocking me right now. I'm heads-down on the analytics integration and I'll have a draft ready for review by 3pm.",
        situationNote: "Clean, no blockers",
        whenToUse: "When things are going well. Still give a time-bound commitment — it shows accountability."
      },
      {
        text: "I need 5 minutes after standup with you — there's something I want to flag before it becomes a problem.",
        situationNote: "Sensitive issue flagging",
        whenToUse: "Don't air problems publicly if they're sensitive. This signals that you've spotted something without creating noise."
      },
      {
        text: "I've de-scoped the edge cases we discussed and I'm focusing on the happy path first. I'll raise a follow-up ticket.",
        situationNote: "Scope decision",
        whenToUse: "Shows you're making active decisions rather than getting stuck. Good for signalling PM instincts."
      }
    ]
  },

  stakeholder: {
    label: "Stakeholder",
    description: "Handle pressure, questions, and hard conversations with senior stakeholders.",
    phrases: [
      {
        text: "Here's where we are, here's the impact, and here's what I'd recommend we do next.",
        situationNote: "Status update or escalation",
        whenToUse: "The three-part structure that every senior stakeholder wants. Situation → Impact → Recommendation."
      },
      {
        text: "I want to give you a complete picture — the short answer is X, and here's the context you need.",
        situationNote: "Complex question",
        whenToUse: "Lead with the answer, then provide context. Never bury the conclusion in your explanation."
      },
      {
        text: "I understand this is frustrating. Here's what I know, what I don't know, and what I'm doing to close that gap.",
        situationNote: "Escalation or complaint",
        whenToUse: "Three-part honesty structure. Especially effective when a stakeholder is venting and wants clarity."
      },
      {
        text: "The decision we need to make is: do we X or Y? I'd recommend X, and here's my reasoning.",
        situationNote: "Decision meeting",
        whenToUse: "Bring the decision, not just the options. Senior stakeholders want PMs who can make calls."
      },
      {
        text: "That's a risk I've been tracking. Here's how I've been managing it.",
        situationNote: "Risk question",
        whenToUse: "Shows you're ahead of the problem, not reacting to it. Builds trust with senior leaders."
      },
      {
        text: "I don't have that data right now, but I'll have it by end of day — and I'll flag if the answer changes anything.",
        situationNote: "Data gap",
        whenToUse: "Never guess in front of a senior stakeholder. This phrase is honest AND action-oriented."
      },
      {
        text: "I want to flag something before it becomes a bigger issue.",
        situationNote: "Proactive escalation",
        whenToUse: "Use to open a difficult conversation. Shows proactiveness without drama."
      },
      {
        text: "The trade-off we made was X over Y, because at the time, Z was the priority. In hindsight, I'd do it differently.",
        situationNote: "Post-mortem or accountability",
        whenToUse: "When you need to own a decision that didn't land well. Self-aware and honest without grovelling."
      }
    ]
  },

  interview: {
    label: "Interview",
    description: "Structured, confident answers for product management interviews.",
    phrases: [
      {
        text: "Let me give you a specific example from my time at [company] that I think directly answers this.",
        situationNote: "Behavioural question",
        whenToUse: "Signals you have real examples, not theoretical answers. Use before any STAR story."
      },
      {
        text: "The way I think about this problem is: first, who's the user, second, what's the job to be done, and third, what does success look like?",
        situationNote: "Product design or strategy question",
        whenToUse: "Shows structured PM thinking without sounding like you memorised a framework."
      },
      {
        text: "I'd start with the assumption that X, and then validate by doing Y — here's why.",
        situationNote: "Estimation or strategy",
        whenToUse: "Shows your reasoning process, not just your conclusion. Interviewers want to see how you think."
      },
      {
        text: "The metric I'd focus on is X, because it directly reflects whether users are getting value — not just whether they're engaging.",
        situationNote: "Metrics question",
        whenToUse: "Shows you understand the difference between vanity metrics and outcome metrics."
      },
      {
        text: "I got this wrong initially. Here's what happened, what I learned, and how I'd approach it now.",
        situationNote: "Failure or mistake question",
        whenToUse: "The best failure answer structure. Own it, learn from it, show growth."
      },
      {
        text: "My instinct is X, but I'd want to pressure-test that with some quick user conversations before committing.",
        situationNote: "Strategy or opinion question",
        whenToUse: "Shows conviction but also epistemic humility. Strong PM signal."
      },
      {
        text: "To build on what I just said — the reason this worked was because of the constraint, not despite it.",
        situationNote: "After a STAR story",
        whenToUse: "Use to add insight after a story. Turns a narrative into a lesson. Memorable."
      },
      {
        text: "I'd prioritise that because it sits at the intersection of high user impact and low engineering effort — which is usually the best first move.",
        situationNote: "Prioritisation question",
        whenToUse: "Shows you're thinking in two dimensions simultaneously. Concrete and defensible."
      }
    ]
  },

  bridge: {
    label: "Bridge Phrases",
    description: "Transitions and pivots that keep your answer flowing and structured.",
    phrases: [
      {
        text: "And that leads me to the more important point...",
        situationNote: "Transitioning to a key insight",
        whenToUse: "When you've set up context and you're about to land the actual point. Signals importance."
      },
      {
        text: "The reason that matters is...",
        situationNote: "After stating a fact or finding",
        whenToUse: "Never let a data point or finding hang in the air. Always follow it with 'the reason that matters is'."
      },
      {
        text: "So what I'd do differently next time is...",
        situationNote: "After a STAR story or reflection",
        whenToUse: "Closes a story with a lesson. Required for any answer about mistakes or failures."
      },
      {
        text: "To be direct about it...",
        situationNote: "When you need to say something uncomfortable",
        whenToUse: "Signals honesty and confidence. Use before a difficult truth that needs to be said clearly."
      },
      {
        text: "The short version is X. If you want the full picture, I can walk you through it.",
        situationNote: "When you have a long answer",
        whenToUse: "Gives the listener control. Shows you're aware of their time. CEO-level communication."
      },
      {
        text: "Coming back to the original question...",
        situationNote: "After a tangent",
        whenToUse: "When you've gone into detail and need to tie it back. Shows structure and self-awareness."
      },
      {
        text: "The way I'd frame this is...",
        situationNote: "Reframing a question or problem",
        whenToUse: "When the question as asked isn't quite right and you want to reframe it constructively."
      },
      {
        text: "Here's the one thing I'd want you to take away from this...",
        situationNote: "Closing an answer or presentation",
        whenToUse: "Forces you to distill your answer. Makes you memorable. Use at the end of a complex explanation."
      }
    ]
  }
};

export const ALL_PHRASES = Object.values(PHRASE_CATEGORIES).flatMap(cat =>
  cat.phrases.map(p => ({ ...p, category: cat.label }))
);
