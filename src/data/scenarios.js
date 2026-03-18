export const SCENARIOS = [
  // ── STAKEHOLDER (12) ──────────────────────────────────────────────────────
  {
    id: "sh_01",
    situationType: "stakeholder",
    text: "Your roadmap hasn't delivered anything meaningful in two quarters. Why should we keep funding this team?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "sh_02",
    situationType: "stakeholder",
    text: "I don't understand why this feature took three sprints. My last company would have shipped it in two weeks.",
    difficulty: "medium",
    suggestedFramework: "PSB"
  },
  {
    id: "sh_03",
    situationType: "stakeholder",
    text: "The dashboard redesign went live and our support tickets jumped 40%. What exactly happened here?",
    difficulty: "hard",
    suggestedFramework: "CAR"
  },
  {
    id: "sh_04",
    situationType: "stakeholder",
    text: "We promised the client an integration with their ERP by end of month. Engineering is saying it's impossible. Someone is wrong — which is it?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "sh_05",
    situationType: "stakeholder",
    text: "I keep seeing features being added that no customer ever asked for. How do you decide what goes on the roadmap?",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },
  {
    id: "sh_06",
    situationType: "stakeholder",
    text: "Your OKR says you'll improve activation rate by 20%. We're two months in and I'm seeing 4%. Walk me through your plan.",
    difficulty: "hard",
    suggestedFramework: "PSB"
  },
  {
    id: "sh_07",
    situationType: "stakeholder",
    text: "The competitor just launched something very similar to what we've been building for six months. What's your response?",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },
  {
    id: "sh_08",
    situationType: "stakeholder",
    text: "I want to add a new requirement to the current sprint. I know it's late but this is coming directly from the MD.",
    difficulty: "medium",
    suggestedFramework: "PSB"
  },
  {
    id: "sh_09",
    situationType: "stakeholder",
    text: "You said the mobile app would be ready by Diwali. It's Diwali next week and I'm hearing it needs another month. Explain.",
    difficulty: "hard",
    suggestedFramework: "CAR"
  },
  {
    id: "sh_10",
    situationType: "stakeholder",
    text: "Why does your team need so many people? I'm seeing five engineers on a feature that seems quite straightforward.",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },
  {
    id: "sh_11",
    situationType: "stakeholder",
    text: "Our retention numbers dropped after last month's release. I need you to tell me right now — is this a product issue or a market issue?",
    difficulty: "hard",
    suggestedFramework: "PSB"
  },
  {
    id: "sh_12",
    situationType: "stakeholder",
    text: "I've been hearing from multiple business heads that the product team is hard to work with. What's going on?",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },

  // ── INTERVIEW (12) ────────────────────────────────────────────────────────
  {
    id: "iv_01",
    situationType: "interview",
    text: "Tell me about a time you had to ship a product under impossible constraints. What did you cut and why?",
    difficulty: "medium",
    suggestedFramework: "STAR"
  },
  {
    id: "iv_02",
    situationType: "interview",
    text: "You've never worked at a Series B company before. Why do you think you're ready for this kind of pace?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "iv_03",
    situationType: "interview",
    text: "Walk me through a product decision you got completely wrong. What would you do differently?",
    difficulty: "medium",
    suggestedFramework: "STAR"
  },
  {
    id: "iv_04",
    situationType: "interview",
    text: "Our biggest problem right now is that we build features nobody uses. How would you fix that in your first 90 days?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "iv_05",
    situationType: "interview",
    text: "Describe a time you disagreed with your engineering lead. How did you handle it and what was the outcome?",
    difficulty: "medium",
    suggestedFramework: "STAR"
  },
  {
    id: "iv_06",
    situationType: "interview",
    text: "What's the most creative solution you've come up with for a user problem that didn't require any engineering resources?",
    difficulty: "easy",
    suggestedFramework: "CAR"
  },
  {
    id: "iv_07",
    situationType: "interview",
    text: "How do you prioritise when everything is urgent and everyone is shouting for different things?",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },
  {
    id: "iv_08",
    situationType: "interview",
    text: "Tell me about a time you had to kill a feature that your team was emotionally invested in. How did you manage that?",
    difficulty: "hard",
    suggestedFramework: "STAR"
  },
  {
    id: "iv_09",
    situationType: "interview",
    text: "You're transitioning from engineering to product. What makes you think you'll be good at the people and strategy side?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "iv_10",
    situationType: "interview",
    text: "Give me an example of a metric you owned end to end — how you set it, tracked it, and moved it.",
    difficulty: "medium",
    suggestedFramework: "CAR"
  },
  {
    id: "iv_11",
    situationType: "interview",
    text: "We're a very data-driven culture. Walk me through how you'd size the market for a new B2B vertical we're considering.",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "iv_12",
    situationType: "interview",
    text: "Why are you leaving your current company? And please be honest — we'll check references.",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },

  // ── STANDUP (12) ─────────────────────────────────────────────────────────
  {
    id: "st_01",
    situationType: "standup",
    text: "You've been blocked on this for three days. What exactly is the blocker and what have you done to remove it?",
    difficulty: "medium",
    suggestedFramework: "PSB"
  },
  {
    id: "st_02",
    situationType: "standup",
    text: "You said yesterday it would be done today. It's not done. What's the new ETA and what changed?",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "st_03",
    situationType: "standup",
    text: "I'm not seeing any progress on the API integration task in Jira. Can you give me a quick status?",
    difficulty: "easy",
    suggestedFramework: null
  },
  {
    id: "st_04",
    situationType: "standup",
    text: "The sprint ends Friday and you still have 13 story points. How are we going to handle this?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "st_05",
    situationType: "standup",
    text: "You're the only one who hasn't updated your tasks in two days. What's going on?",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "st_06",
    situationType: "standup",
    text: "Your blocker is waiting on the design team, but I spoke to design and they said they sent assets on Monday. Who's right?",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "st_07",
    situationType: "standup",
    text: "Can you give me an update on the payment gateway work in 30 seconds? The CEO is joining in a minute.",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "st_08",
    situationType: "standup",
    text: "You said you'd raise the blocker with the vendor but I don't see any email thread. Can you show me?",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "st_09",
    situationType: "standup",
    text: "This is the third sprint in a row where your tasks are spilling over. I need you to explain what's happening.",
    difficulty: "hard",
    suggestedFramework: "PSB"
  },
  {
    id: "st_10",
    situationType: "standup",
    text: "The QA team raised 12 bugs on your feature yesterday. Were you aware of this before pushing to staging?",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "st_11",
    situationType: "standup",
    text: "Quick check — what's your confidence level that the mobile push notification work ships this sprint? Give me a number.",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "st_12",
    situationType: "standup",
    text: "You mentioned a dependency on the backend team last week. Has that been resolved or is it still blocking you?",
    difficulty: "easy",
    suggestedFramework: null
  },

  // ── ONE-ON-ONE (12) ───────────────────────────────────────────────────────
  {
    id: "oo_01",
    situationType: "oneonone",
    text: "I want to give you some feedback. I've noticed you're not speaking up in cross-functional meetings. What's holding you back?",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "oo_02",
    situationType: "oneonone",
    text: "Honestly — how are you finding the team? Are there dynamics I should know about as your manager?",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "oo_03",
    situationType: "oneonone",
    text: "I got feedback from two people that you were quite sharp in the retro last week. Can you tell me your side of it?",
    difficulty: "hard",
    suggestedFramework: "STAR"
  },
  {
    id: "oo_04",
    situationType: "oneonone",
    text: "You told me in your last review that you want to lead a team by end of year. I haven't seen the initiative from you yet. What's going on?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "oo_05",
    situationType: "oneonone",
    text: "I need to talk to you about something sensitive — there have been complaints about your communication style in Slack. Tell me how you see it.",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "oo_06",
    situationType: "oneonone",
    text: "Your performance this quarter has been solid but I know you've been handling a lot at home. How are you really doing?",
    difficulty: "easy",
    suggestedFramework: null
  },
  {
    id: "oo_07",
    situationType: "oneonone",
    text: "I want to discuss your growth plan. Where do you see yourself in 18 months and what do you need from me to get there?",
    difficulty: "medium",
    suggestedFramework: "PREP"
  },
  {
    id: "oo_08",
    situationType: "oneonone",
    text: "You've been at this company for three years and you haven't been promoted yet. Walk me through why you think that is.",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "oo_09",
    situationType: "oneonone",
    text: "I have an opportunity for you to own a new workstream but it means working closely with Arjun, and I know that's been difficult. Are you up for it?",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "oo_10",
    situationType: "oneonone",
    text: "I want to hear directly from you — do you think the team's workload is sustainable right now? Be honest with me.",
    difficulty: "medium",
    suggestedFramework: null
  },
  {
    id: "oo_11",
    situationType: "oneonone",
    text: "I'm going to push back on your last self-assessment. You rated yourself 'exceeds expectations' but I see some gaps. Let's talk.",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "oo_12",
    situationType: "oneonone",
    text: "You mentioned wanting a salary review last month. Let's have that conversation now — make the case.",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },

  // ── ESCALATION (12) ──────────────────────────────────────────────────────
  {
    id: "es_01",
    situationType: "escalation",
    text: "The production system has been down for two hours. Half our enterprise clients are affected. What is your current status and what do you need from me right now?",
    difficulty: "hard",
    suggestedFramework: "PSB"
  },
  {
    id: "es_02",
    situationType: "escalation",
    text: "I'm getting a call from the client's CEO in 20 minutes. Their data migration failed midway and their team can't access anything. Give me a 60-second brief.",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "es_03",
    situationType: "escalation",
    text: "Our compliance team just flagged that last week's release may have violated DPDP data residency requirements. How serious is this?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "es_04",
    situationType: "escalation",
    text: "One of your engineers just resigned and she's the only one who knows the entire billing integration. How are you handling this?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "es_05",
    situationType: "escalation",
    text: "A journalist just contacted our PR team with a screenshot of what appears to be a bug that exposed user emails. What happened and what are we doing about it?",
    difficulty: "hard",
    suggestedFramework: "PSB"
  },
  {
    id: "es_06",
    situationType: "escalation",
    text: "The launch is 48 hours away and QA just raised a severity-1 bug in the payment flow. We can delay or we can ship with a known risk. What's your call?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "es_07",
    situationType: "escalation",
    text: "We've had three production incidents in four weeks. The board is asking me why. I need your analysis and your fix before end of day.",
    difficulty: "hard",
    suggestedFramework: "CAR"
  },
  {
    id: "es_08",
    situationType: "escalation",
    text: "Your team and the data team have been in conflict for two weeks now and it's affecting delivery. I need one of you to fix this. What's the actual problem?",
    difficulty: "medium",
    suggestedFramework: "PSB"
  },
  {
    id: "es_09",
    situationType: "escalation",
    text: "The CFO is asking why the infrastructure cost went up 3x this month. Your team owns the platform. Can you explain this?",
    difficulty: "hard",
    suggestedFramework: "PREP"
  },
  {
    id: "es_10",
    situationType: "escalation",
    text: "I've heard from the sales team that a deal worth ₹2 crore fell through because of a product gap you knew about. Did you know?",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "es_11",
    situationType: "escalation",
    text: "Two senior engineers on your team have approached HR independently. They're both unhappy. What's happening on your team?",
    difficulty: "hard",
    suggestedFramework: null
  },
  {
    id: "es_12",
    situationType: "escalation",
    text: "The app store rating dropped from 4.3 to 3.6 in one week. Almost all negative reviews are about the new checkout flow your team shipped. Own this.",
    difficulty: "hard",
    suggestedFramework: "CAR"
  },

  // ── GENERAL FLUENCY (25) — everyday professional + social situations ──────────
  {
    id: "gf_01", situationType: "general", difficulty: "easy",
    text: "You're running 20 minutes late to an important in-person meeting. Call the organiser and explain.",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_02", situationType: "general", difficulty: "easy",
    text: "A colleague you don't know well asks you to explain what you do at the company. Keep it natural.",
    suggestedFramework: null
  },
  {
    id: "gf_03", situationType: "general", difficulty: "medium",
    text: "You disagree with a decision made by your manager in a team meeting. Raise it respectfully right now.",
    suggestedFramework: "PREP"
  },
  {
    id: "gf_04", situationType: "general", difficulty: "medium",
    text: "Someone on your team has been missing deadlines and it's affecting you. Have the conversation.",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_05", situationType: "general", difficulty: "hard",
    text: "You are at a networking event and someone senior asks: 'So what are you working on that's interesting?'",
    suggestedFramework: null
  },
  {
    id: "gf_06", situationType: "general", difficulty: "easy",
    text: "Your cross-functional partner from another team says your team's work is blocking theirs. Respond calmly.",
    suggestedFramework: "CAR"
  },
  {
    id: "gf_07", situationType: "general", difficulty: "medium",
    text: "You need to ask your manager for a week off at short notice. Make the ask.",
    suggestedFramework: null
  },
  {
    id: "gf_08", situationType: "general", difficulty: "hard",
    text: "In a team retrospective, someone publicly blames your feature for the sprint failure. Respond.",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_09", situationType: "general", difficulty: "easy",
    text: "Introduce yourself to a new team of 8 people on your first day. Keep it warm but professional.",
    suggestedFramework: null
  },
  {
    id: "gf_10", situationType: "general", difficulty: "medium",
    text: "Your manager gives you critical feedback that you feel is unfair. Respond without getting defensive.",
    suggestedFramework: "PREP"
  },
  {
    id: "gf_11", situationType: "general", difficulty: "medium",
    text: "A client asks why the project is delayed by two weeks. Give a clear, honest answer.",
    suggestedFramework: "CAR"
  },
  {
    id: "gf_12", situationType: "general", difficulty: "hard",
    text: "You are asked to present your team's quarterly results to an audience who expected better numbers.",
    suggestedFramework: "PREP"
  },
  {
    id: "gf_13", situationType: "general", difficulty: "easy",
    text: "Someone asks you for your honest opinion of a presentation that you thought was weak.",
    suggestedFramework: null
  },
  {
    id: "gf_14", situationType: "general", difficulty: "medium",
    text: "You are in a job interview and they ask: 'Why are you leaving your current role?'",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_15", situationType: "general", difficulty: "hard",
    text: "You made an error that caused a production incident. Explain it to your leadership team.",
    suggestedFramework: "CAR"
  },
  {
    id: "gf_16", situationType: "general", difficulty: "medium",
    text: "A peer asks you to take on extra work when you're already at capacity. Decline gracefully.",
    suggestedFramework: null
  },
  {
    id: "gf_17", situationType: "general", difficulty: "easy",
    text: "Explain a complex technical project you're working on to someone from finance who has no tech background.",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_18", situationType: "general", difficulty: "medium",
    text: "You want to ask for a salary raise. You're in your manager's office. Make the case.",
    suggestedFramework: "PREP"
  },
  {
    id: "gf_19", situationType: "general", difficulty: "hard",
    text: "Your company is going through layoffs. A worried team member asks if their job is safe. Respond honestly.",
    suggestedFramework: null
  },
  {
    id: "gf_20", situationType: "general", difficulty: "medium",
    text: "You are chairing a meeting that has gone off-track. Bring it back to the agenda without embarrassing anyone.",
    suggestedFramework: null
  },
  {
    id: "gf_21", situationType: "general", difficulty: "easy",
    text: "Someone praises your work publicly in a meeting. Respond in a way that's confident but not arrogant.",
    suggestedFramework: null
  },
  {
    id: "gf_22", situationType: "general", difficulty: "medium",
    text: "You are giving feedback to a junior team member whose work is below standard. Be direct but kind.",
    suggestedFramework: "PSB"
  },
  {
    id: "gf_23", situationType: "general", difficulty: "hard",
    text: "Two senior stakeholders disagree in a meeting and both turn to you to resolve it. What do you say?",
    suggestedFramework: "PREP"
  },
  {
    id: "gf_24", situationType: "general", difficulty: "easy",
    text: "You've just joined a video call that started without you. Catch up and contribute within your first 2 minutes.",
    suggestedFramework: null
  },
  {
    id: "gf_25", situationType: "general", difficulty: "medium",
    text: "You need to push back on a timeline your manager just committed to a client without consulting you.",
    suggestedFramework: "PSB"
  }
];
