# Product Vision: An Adaptive, Duolingo-Style Exam Preparation App

I think we should be ambitious here.

**Do not build PrimaEd with a prettier UI.**
Do not build a traditional LMS.
Do not build a website containing hundreds of quizzes.

We should build something that feels closer to **Duolingo meets a personal tutor meets a modern mobile game**, specifically engineered for passing high-stakes examinations.

The first product is provisional licence preparation, but the architecture should become reusable for **any examination**.

I'll refer to the working product concept as **the app/platform** below.

---

# 1. The Core Product Philosophy

The biggest mistake would be thinking our product is about questions.

It isn't.

The product is about taking someone from:

> "I don't know if I'm ready"

to:

> "I know exactly what I understand, what I don't understand, and what I need to do to pass."

That difference changes the entire product.

PrimaEd's model is essentially:

> Here is the material → Do quizzes → Repeat → Hopefully pass.

Our model should be:

> We diagnose you → Understand how you learn → Build your path → Teach you → Challenge you → Identify weaknesses → Fix them → Test you under realistic conditions → Tell you when you're ready.

That is the product.

---

# 2. The Duolingo Inspiration, Without Blindly Copying Duolingo

Duolingo is brilliant at several things:

* Extremely low friction
* Clear next action
* Short sessions
* Visible progression
* Streak psychology
* Immediate feedback
* Gamification
* Celebration
* Making learning feel approachable
* Getting users to come back daily

We should borrow those principles.

But there are things I would **not** copy.

## We should not make it childish

A person preparing for a provisional licence is trying to pass an exam, not raise a virtual pet.

The visual language should be:

* Fun
* Energetic
* Modern
* Friendly

But also:

* Intelligent
* Trustworthy
* Competent
* Adult

Think:

> **Duolingo's engagement system + Stripe's product clarity + a modern mobile game's progression loop.**

---

# 3. The Main Product Loop

Everything should revolve around one addictive learning loop.

## The loop

```text
OPEN APP
   ↓
SEE TODAY'S GOAL
   ↓
COMPLETE SHORT SESSION
   ↓
ANSWER QUESTIONS
   ↓
GET INSTANT FEEDBACK
   ↓
UNDERSTAND WHY
   ↓
MASTER CONCEPT
   ↓
EARN PROGRESS
   ↓
SEE READINESS IMPROVE
   ↓
UNLOCK NEXT CHALLENGE
   ↓
COME BACK TOMORROW
```

The learner should almost never wonder:

> "What should I do now?"

The app should always know.

---

# 4. The First-Time Experience

This is critical.

Do not dump the user into a dashboard.

## Screen 1: Welcome

Something simple:

> **Let's get you ready to pass.**

Subtext:

> Learn smarter. Practise what matters. Know when you're ready.

Button:

**Start my preparation**

No giant forms.

---

## Screen 2: The Goal

Ask:

> What are you preparing for?

Initially:

🪪 **Provisional Licence Test**

Later the architecture supports:

* O-Level Mathematics
* Learner licence
* Professional certifications
* University entrance exams
* Industry certifications

The user selects their goal.

---

## Screen 3: When is your test?

Options:

* This week
* Within 2 weeks
* This month
* I'm not sure yet

This matters.

Someone sitting the test in three days should receive a very different learning strategy from someone with six weeks.

---

## Screen 4: Confidence

Ask:

> How prepared do you feel?

Slider:

```text
😰 Not at all prepared
       ●────────────
                 😎 Very confident
```

This is psychologically useful.

Later we compare:

**Perceived readiness vs actual readiness.**

---

## Screen 5: Diagnostic

Then:

> Before we build your study plan, let's see where you are.

Explain:

> This isn't your exam. There are no consequences.

Start diagnostic.

---

# 5. The Diagnostic Test

This should be one of the most important systems.

Not a 100-question test.

I would start with perhaps **15–25 intelligently selected questions**.

Questions should cover:

* Junction rules
* Road signs
* Regulations
* Carriageway markings
* Traffic lights
* Safety
* Difficult/common trap concepts

But importantly:

### Not every user gets exactly the same diagnostic.

The engine selects questions that maximize information.

Example:

If the user gets an easy junction question right, the system may show a harder junction scenario.

If they fail a basic junction question, there's no point immediately throwing an extremely complicated scenario at them.

The objective is to quickly estimate:

```text
Junction Rules        █████░░░░░ 50%
Road Signs            ████████░░ 80%
Regulations           ███░░░░░░░ 30%
Carriageway Lines     ██████░░░░ 60%
Traffic Lights        █████████░ 90%
```

Then the app says:

# Here's your starting point

> You already have a strong understanding of road signs and traffic lights.

> Your biggest opportunity is junction rules and road regulations.

Then:

**We'll build your learning path around that.**

This immediately feels personalized.

---

# 6. The Home Screen

The home screen should be incredibly simple.

Not a dashboard with 20 cards.

Something like:

---

## Good afternoon, Tawanda 👋

### You're 62% ready

```text
████████████░░░░░░░░
```

### Your next step

🛣️ **Fix Junction Priority**

Estimated time: **6 minutes**

**START**

---

Below:

### Today's progress

🔥 4-day streak

⚡ 120 XP today

🎯 3 concepts mastered

---

Then:

### Continue learning

Cards:

* Junction Priority
* Difficult Road Signs
* Your Mistakes
* Quick Challenge

The primary CTA must always be obvious.

# START THE NEXT BEST LESSON

---

# 7. The Learning Path

Duolingo's path concept is excellent.

We should have a vertical progression path.

But ours should adapt.

For example:

```text
        🏆
    Mock Exam
       🔒

      ⚡
  Difficult Questions
       🔒

      🚦
 Traffic Lights
       ✓

      🛣️
 Junction Rules
       ▶ CURRENT

      🚗
 Road Regulations
       ✓

      🪧
 Road Signs
       ✓
```

However, unlike Duolingo:

## The path should not be identical for everyone.

A learner struggling with junctions might see:

```text
Road Signs ✓

Junction Basics ✓

Junction Practice ▶

Fix Your Mistakes 🔥

Junction Challenge 🔒
```

While another learner may progress differently.

---

# 8. Micro-Learning Sessions

This is where we beat traditional quiz platforms.

A learning session should not always be:

> Here are 25 questions.

Instead:

```text
CONCEPT
↓
EXAMPLE
↓
QUESTION
↓
FEEDBACK
↓
EXPLANATION
↓
ANOTHER APPLICATION
```

Example:

---

# Junction Priority

### Rule

When vehicles arrive at an uncontrolled junction, priority depends on their relative positions and movements.

[Simple animated diagram]

**Got it**

---

Then:

### Quick check

Which car moves first?

[Diagram]

A
B
C

User selects B.

---

# Correct! 🎉

### Why?

Car B has priority because...

[Visual animation]

Then:

> Let's make it harder.

Next question.

---

This is fundamentally different from dumping someone into a test.

---

# 9. Question Experience

Every question should feel excellent.

## Question screen

Minimal.

```text
← Exit

Junction Rules
Question 4 of 10

● ● ● ● ○ ○ ○ ○ ○ ○

Which vehicle should move first?

      [DIAGRAM]

A. Vehicle A
B. Vehicle B
C. Vehicle C

────────────────

Check
```

No distractions.

---

# 10. Answer Interaction

When the learner selects an answer:

Don't immediately jump to the next question.

Show a response.

## Correct

```text
        ✓

      Correct!

You recognized the priority correctly.

+10 XP

[See why] [Continue]
```

But occasionally ask:

> **Do you know why?**

Because lucky guessing is a problem.

The system needs to distinguish:

* Knowledge
* Guessing
* Memorization
* Genuine understanding

---

## Incorrect

Never simply:

> Wrong.

Instead:

```text
        ✕
Not quite.

The correct answer is Vehicle C.

But let's understand why.

[Show explanation]
```

Then explain visually.

---

# 11. Explanations Should Be a Major Competitive Advantage

PrimaEd only has explanations for around 21% of analyzed question slots.

I think we should aim for:

# 100% explanation coverage.

Not necessarily manually written in the same way.

Each question should have structured explanation data.

For example:

```javascript
{
  question: "...",
  correctAnswer: "B",

  explanation: {
    short: "...",
    detailed: "...",
    rule: "...",
    visualExplanation: "...",
    commonMistakes: [...]
  }
}
```

Then AI can personalize the explanation.

---

# 12. The AI Explanation System

This is important:

## Do not ask an LLM to decide the correct answer.

The answer should come from our validated database.

The LLM should be used to **explain**, not determine truth.

Architecture:

```text
QUESTION DATABASE
       ↓
Correct Answer
       ↓
Rule / Knowledge Context
       ↓
User's Selected Answer
       ↓
USER PERFORMANCE HISTORY
       ↓
           LLM
            ↓
Personalized explanation
```

Prompt concept:

> The learner selected option B. The validated correct answer is C. Explain the mistake in simple Zimbabwean English. Do not change the validated answer. Focus on the misunderstanding behind selecting B.

This dramatically reduces hallucination risk.

---

# 13. The AI Coach

The AI coach should not be a generic chatbot.

That would be lazy.

The AI needs context.

The coach should know:

* Who the learner is
* What they are studying
* Their weak topics
* Their recent mistakes
* Their streak
* Their confidence
* Their readiness score
* Their upcoming exam date
* Their recent performance

Then the user can ask:

> Why am I so bad at junctions?

The AI knows:

> You've answered 43 junction questions. You're getting basic priority questions right, but you're consistently struggling when three vehicles arrive simultaneously.

That's useful.

---

# 14. AI Coach Personality

The coach needs a personality.

Not corporate.

Not overly enthusiastic.

Not:

> Great job! You're doing amazing! 🌟✨

Every five seconds.

That gets irritating.

I would make the coach:

* Smart
* Calm
* Encouraging
* Occasionally funny
* Direct
* Honest

Example:

### User

> Am I ready?

AI:

> Honestly? Not yet.

> Your overall score is improving, but you're still making predictable mistakes in junction priority.

> I'd recommend two more focused sessions before taking another mock exam.

Then:

**Start 8-minute Junction Recovery**

That is an intelligent coach.

---

# 15. AI Coach Actions

The AI should not only talk.

It should be able to trigger product actions.

Example:

User:

> I only have 10 minutes.

AI:

> Perfect. Let's use them properly.

> Based on your progress, your best use of 10 minutes is:
>
> * 4 junction questions
> * 3 regulations questions
> * 1 difficult scenario

**Start my 10-minute session**

---

Another:

> Give me something difficult.

AI:

> Alright. No warm-up questions.

**Start Hard Mode 🔥**

---

This makes the AI functional.

Not decorative.

---

# 16. "Explain Like..." Feature

This could be brilliant.

After getting a question wrong:

> Explain this:

Buttons:

* 👶 Simply
* 🧠 In detail
* 🎯 Exam focused
* 🖼️ Show me visually

The same explanation changes.

---

### Simply

> Car C goes first because it has priority over the other vehicles based on its position.

### Exam focused

> In questions like this, first identify whether the junction is controlled. Then compare vehicle positions before considering turning direction.

### Detailed

The AI provides the complete reasoning.

---

# 17. The Mistake Book

This should be one of the best features.

Every mistake should be remembered.

The user gets:

# Your Mistakes

```text
🔥 Needs attention

Junction Priority
12 mistakes

[Fix this]

Road Regulations
8 mistakes

[Fix this]

Road Signs
3 mistakes

[Review]
```

The system then schedules mistakes for review.

But importantly:

## Do not repeatedly show exactly the same question.

Instead:

```text
Concept: Junction Priority

Original mistake:
Question A

Follow-up:
Question B testing same concept

Mastery challenge:
Question C in harder context
```

This tests understanding rather than memorization.

---

# 18. Spaced Repetition

We should absolutely implement this.

Conceptually:

```text
Got wrong
   ↓
Review soon

Got right
   ↓
Review later

Got right again
   ↓
Review much later

Consistently correct
   ↓
Mastered
```

Something similar to Anki's principles, but invisible to the user.

The learner should not have to understand the algorithm.

They just see:

> You have 8 concepts ready for review.

---

# 19. The Readiness Score

This could become the most important product metric.

Not:

> You completed 74% of the course.

That's meaningless.

Instead:

# Exam Readiness: 76%

But this score should be intelligently calculated.

Potential inputs:

```text
Topic mastery                30%
Recent performance           20%
Mock exam performance        20%
Consistency                  10%
Response confidence          10%
Speed                        10%
```

Not necessarily these exact weights.

The score should change meaningfully.

---

## Readiness categories

### 0–30%

🟥 Getting Started

> Focus on fundamentals.

### 31–55%

🟧 Building Knowledge

> You're learning, but major gaps remain.

### 56–75%

🟨 Almost Ready

> Focused practice can make a big difference.

### 76–90%

🟩 Strong Preparation

> You're performing consistently.

### 91–100%

🏆 Exam Ready

> Based on your performance, you're well prepared.

Important:

Never say:

> You WILL pass.

We can't guarantee that.

Instead:

> Based on your demonstrated performance, you're showing strong readiness.

---

# 20. Mock Exam Experience

This needs to feel serious.

## Before

```text
Mock Exam

25 Questions
20 Minutes
Mixed Topics

Difficulty: Exam Level

Ready?

START EXAM
```

Once started:

## No XP distractions

No celebrations.

No streak animations.

This is exam mode.

Clean.

Focused.

---

## Timer

```text
Question 12 / 25

14:32 remaining
```

---

# 21. Dynamic Mock Exams

This is where we technically crush the static model.

The engine should generate:

```javascript
generateMock({
  topics: {
    junctions: 0.25,
    signs: 0.25,
    regulations: 0.30,
    markings: 0.10,
    trafficLights: 0.10
  },

  difficulty: "exam",

  questionCount: 25,

  excludeRecentlySeen: true
})
```

But more sophisticated.

It should avoid:

* Repeating recently seen questions
* Overrepresenting one topic
* Unrealistic difficulty distribution

And eventually support:

### Personalized Mock

> Simulates the exam while slightly emphasizing your weaknesses.

### Standard Mock

> Balanced examination simulation.

### Nightmare Mode 🔥

> Difficult questions only.

---

# 22. Post-Mock Review

Do not just say:

> 21/25

The app should provide a complete breakdown.

# Mock Exam Result

## 84%

**Almost there.**

```text
Road Signs        █████████ 90%
Traffic Lights    ██████████ 100%
Junction Rules    ██████░░░ 60%
Regulations       ████████░ 80%
```

### Biggest risk

🚨 Junction Priority

You missed 3 questions involving three-vehicle intersections.

**Fix this weakness**

---

# 23. "I Have 5 Minutes"

This is a feature I strongly recommend.

A button on the home screen:

# How much time do you have?

* 3 min
* 5 min
* 10 min
* 20 min
* Surprise me

The engine creates the optimal session.

For five minutes:

> You have time for 5 questions.

It chooses the highest-value questions based on:

```text
Weakness
+
Upcoming review
+
Exam importance
+
Time available
```

This is extremely practical.

---

# 24. Daily Goal System

Not:

> Complete 5 lessons.

Instead allow:

### My daily goal

🐣 Casual
5 minutes

🔥 Serious
15 minutes

⚡ Locked In
30 minutes

The user chooses.

The app adapts.

---

# 25. Streaks

Absolutely use streaks.

But don't become evil about it.

The streak should encourage:

> Come back tomorrow.

Not guilt the user.

Example:

🔥 **7-day streak**

> One quick session keeps it alive.

Also:

## Streak Freeze

Allow occasional misses.

Maybe earned through activity rather than purchased aggressively.

---

# 26. XP System

Use XP, but make it meaningful.

Example:

```text
Correct answer       +10 XP
Difficult question   +20 XP
Perfect session      +30 XP
Daily goal           +50 XP
Comeback streak      +25 XP
```

But:

## Do not make XP the main objective.

The primary objective remains:

# Readiness.

XP is engagement.

Readiness is value.

---

# 27. The Progress System

We should have multiple progress metrics.

### Learning Progress

How much content explored.

### Mastery

How well concepts are understood.

### Readiness

How prepared for the exam.

### Consistency

How regularly the learner studies.

This prevents one number from becoming misleading.

---

# 28. Lives? I Would NOT Copy Duolingo Here

Strong opinion:

# Do not use lives.

Duolingo's heart system works commercially, but in an exam preparation app, punishing someone for mistakes is counterproductive.

Mistakes are literally valuable training data.

We want users to answer difficult questions.

Not avoid them because:

> I only have one heart left.

Wrong answers should trigger learning, not punishment.

---

# 29. Challenges

We can introduce optional challenge modes.

## Daily Challenge

One difficult question.

Everyone gets the same question.

---

## Speed Run

Answer 10 questions as fast as possible.

---

## Survival

Keep answering until you make 3 mistakes.

---

## Weakness Challenge

The system attacks your weakest topic.

---

## Redemption

Questions based entirely on your previous mistakes.

> Can you beat the questions that beat you?

This is psychologically compelling.

---

# 30. The Question Bank Architecture

Do not structure content as:

```text
Quiz 1
Quiz 2
Quiz 3
Quiz 4
```

That is the competitor's architecture.

Instead:

```text
QUESTION
│
├── Subject
├── Exam
├── Topic
├── Subtopic
├── Difficulty
├── Concepts
├── Correct answer
├── Distractors
├── Explanation
├── Common misconception
├── Image
├── Tags
├── Estimated time
└── Version
```

Example:

```json
{
  "id": "q_001",

  "exam": "zim_vid_provisional",

  "topic": "junction_rules",

  "subtopic": "right_of_way",

  "difficulty": 3,

  "question": "...",

  "options": [],

  "correctAnswer": "option_c",

  "explanation": {
    "short": "...",
    "detailed": "..."
  },

  "misconceptions": [
    "confuses turning direction with priority"
  ],

  "estimatedSeconds": 35
}
```

This architecture enables everything.

---

# 31. The Content Management System

We need our own internal admin.

Not WordPress.

The content team should be able to:

### Create a question

* Add question
* Add image
* Add options
* Select answer
* Write explanation
* Assign topic
* Assign difficulty

### Review

Workflow:

```text
DRAFT
 ↓
REVIEW
 ↓
APPROVED
 ↓
PUBLISHED
```

### Analytics

For every question:

```text
Times attempted: 12,492

Correct rate: 62%

Average time: 18 seconds

Most common wrong answer:
Option B — 31%

Difficulty:
Hard

Flagged by users:
4
```

This eventually becomes incredibly valuable.

---

# 32. Question Quality Intelligence

Eventually the system should identify bad questions.

For example:

> This question has a 98% correct rate.

Maybe too easy.

Or:

> Users who score highly elsewhere consistently fail this question.

Maybe the wording is confusing.

Or:

> 74% select option B.

That tells us something about the misconception.

This is where the platform becomes more than content.

---

# 33. The AI Architecture

Now to your LLM requirement.

You specifically want something **completely free**, especially for:

* AI Coach
* Answer explanations
* Interactivity

My honest answer:

## There is no cloud LLM API I would trust as permanently "free forever" for a commercial product.

Free tiers change, have rate limits, and can disappear. Current options such as Gemini, Groq, Cerebras and OpenRouter offer useful free access, but relying on a third party's free tier as permanent production infrastructure is risky. ([Klymentiev][1])

So I recommend a different architecture.

# Use a hybrid AI strategy.

---

# 34. My Recommended LLM Strategy

## Primary development model: Groq

For early development and testing:

**Groq + open-weight model**

Why?

* Extremely fast
* OpenAI-compatible API style
* Good for conversational responses
* Excellent for interactive UX
* Useful free tier

But don't hardwire the app to Groq.

Create an abstraction:

```javascript
AIProvider
```

Then:

```text
AI Request
    ↓
AI Gateway
    ↓
 ┌───────────────┐
 │ Provider Router│
 └───────────────┘
    ↓
Groq
Gemini
Local Model
OpenRouter
Future Provider
```

---

# 35. Truly Free Long-Term AI

If you mean:

> I want zero marginal API cost.

Then there is only one serious answer:

# Self-host an open-weight model.

For example using:

* Ollama
* vLLM
* llama.cpp

with an open-weight model such as an appropriate Qwen, Llama, Gemma, or Mistral-family model.

Running locally/self-hosted removes provider rate limits, although it shifts the cost to hardware and hosting. ([AI Cost Hub][2])

My recommendation:

## Development

Use free cloud inference.

## Production at small scale

Use a provider abstraction with free-tier fallbacks.

## Once usage grows

Self-host a smaller efficient model.

---

# 36. Important: Do We Even Need an LLM for Every Explanation?

No.

And this is where we can be smarter.

Most explanations should not require AI.

Example:

```text
User answers Question

↓
Fetch validated explanation

↓
Display immediately
```

Zero AI cost.

Then:

### Explain further

Only then invoke the AI.

The AI gets:

```json
{
  "question": "...",
  "correct_answer": "...",
  "user_answer": "...",
  "validated_explanation": "...",
  "topic": "junction_priority"
}
```

Then generates a personalized response.

This means:

# AI is an enhancement layer, not infrastructure required for every answer.

Huge cost advantage.

---

# 37. AI Usage Tiers

I would implement:

## Level 1: Deterministic

No AI.

* Correct answer
* Explanation
* Visual explanation
* Rule reference

---

## Level 2: AI-assisted

User asks:

> Why?

AI explains.

---

## Level 3: AI coaching

User says:

> I'm confused about junctions.

AI analyzes their performance.

---

## Level 4: AI planning

AI creates:

> A personalized 7-day preparation plan.

This minimizes unnecessary LLM calls.

---

# 38. The AI Coach UI

Don't make a separate boring chat screen.

Instead, the coach should exist throughout the app.

Example after wrong answer:

```text
Wrong

Here's why...

[Explain simpler]

[Ask Coach 🤖]
```

User taps Ask Coach.

Bottom sheet appears:

> What are you confused about?

Suggested questions:

* Why is my answer wrong?
* Explain it simply
* Show another example
* Give me a similar question

This is far better than:

> Type anything into this chatbot.

---

# 39. AI-Generated Follow-Up Questions

This needs caution.

I would not initially let AI generate official-style examination questions without review.

Instead:

AI can generate:

### Practice examples

> Let's test whether you understand the rule.

These should be explicitly:

**Practice scenario**

Not:

**Official-style exam question**

Later, with validation pipelines, we can allow AI-assisted question authoring.

---

# 40. The Best Feature: "Teach Me Until I Understand"

Imagine this flow.

User gets a junction question wrong.

They click:

# I don't understand this.

AI:

> No problem. Let's slow down.

Step 1:

> Which vehicle reaches the junction first?

User answers.

AI:

> Correct.

Step 2:

> Now, which vehicle has priority over the other?

User answers.

AI:

> Exactly.

Step 3:

> Now look at the full situation again.

Original question.

User gets it right.

🎉

# Now you've got it.

This is interactive teaching.

Not chat.

This could become one of our strongest differentiators.

---

# 41. JavaScript Mobile-First Architecture

I strongly agree with JavaScript-first.

My recommendation:

# Frontend

### React + TypeScript

Why:

* Massive ecosystem
* Easy developer hiring
* Mobile-first
* Reusable
* Excellent PWA support

Potential stack:

```text
React
TypeScript
Vite
Tailwind CSS
Zustand
TanStack Query
```

---

# 42. PWA First

I would absolutely build this as an installable PWA first.

The product should:

* Install to home screen
* Open like an app
* Work offline
* Cache questions
* Cache images
* Store progress locally
* Sync automatically

A local-first architecture using IndexedDB for structured content and queued synchronization is well suited to unreliable connectivity. ([Instant PWA][3])

Recommended:

```text
React
+
Vite
+
TypeScript
+
PWA plugin
+
Workbox
+
IndexedDB
```

---

# 43. Local Database

Use:

# IndexedDB

I would recommend:

**Dexie.js**

Store:

```text
Questions
Images
User answers
Session history
Mastery state
Pending sync events
Downloaded packs
```

Architecture:

```text
USER ACTION
     ↓
LOCAL DATABASE
     ↓
UI UPDATES INSTANTLY
     ↓
SYNC QUEUE
     ↓
SERVER WHEN ONLINE
```

This is important.

## The user should never wait for the server after answering a question.

Answer:

Tap.

Instant feedback.

Save locally.

Sync later.

---

# 44. Backend

I would recommend initially:

## Supabase

For:

* Authentication
* PostgreSQL
* Storage
* Edge functions
* Realtime where needed

But architect it so Supabase is infrastructure, not the application logic itself.

Potential structure:

```text
Frontend
   ↓
API Layer
   ↓
Application Services
   ↓
Supabase/Postgres
```

---

# 45. Database Core Tables

Roughly:

```text
users

exams

subjects

topics

subtopics

questions

question_options

question_explanations

question_assets

learning_sessions

question_attempts

user_topic_mastery

user_concept_mastery

spaced_repetition_schedule

mock_exams

mock_exam_questions

user_streaks

achievements

xp_transactions

ai_conversations

ai_messages

payments

subscriptions
```

---

# 46. Event Tracking

This is non-negotiable.

Track everything meaningful.

Example:

```javascript
{
  event: "question_answered",

  userId: "...",

  questionId: "...",

  correct: false,

  selectedAnswer: "B",

  correctAnswer: "C",

  responseTime: 14.2,

  mode: "smart_practice",

  timestamp: "..."
}
```

Because later:

# Events become intelligence.

---

# 47. The Learning Engine

This should be a separate domain.

Something like:

```text
Learning Engine
│
├── Mastery Calculator
├── Difficulty Selector
├── Spaced Repetition
├── Recommendation Engine
├── Mock Generator
├── Readiness Calculator
└── Study Planner
```

Do not bury this logic inside React components.

---

# 48. Mastery Model

Each user has:

```javascript
{
  userId: "...",

  topic: "junction_priority",

  mastery: 0.67,

  confidence: 0.81,

  attempts: 42,

  correct: 29,

  averageTime: 17,

  lastReviewed: "..."
}
```

Then the engine determines:

```text
Needs Review
Learning
Improving
Strong
Mastered
```

---

# 49. Difficulty Should Be Dynamic

Each question should have:

### Author difficulty

Set by content creator.

And:

### Empirical difficulty

Calculated from users.

Example:

```text
Author difficulty: Medium

Actual difficulty:
Hard

Correct rate: 34%
```

Eventually use the actual data.

---

# 50. Recommendation Engine

Every time the user opens the app:

```javascript
getNextBestActivity(user)
```

Possible output:

```json
{
  "activity": "weakness_recovery",

  "topic": "junction_priority",

  "reason": "Repeated errors detected",

  "estimatedDuration": 7,

  "questions": [...]
}
```

This function becomes central to the product.

---

# 51. Study Plans

The user says:

> My test is in 14 days.

The app generates:

# Your 14-Day Plan

```text
Day 1 ✓
Road Signs

Day 2 ✓
Regulations

Day 3 ▶
Junction Priority

Day 4 🔒
Weakness Recovery

Day 5 🔒
Mixed Practice

...

Day 14 🏆
Final Mock Exam
```

But it adapts.

If the user is already strong in road signs:

The plan changes.

---

# 52. Notifications

Notifications should be intelligent.

Bad:

> Don't forget to learn!

Good:

> You have 6 junction questions ready for review.

Better:

> You fixed your junction weakness yesterday. A 4-minute review now will help lock it in.

Best:

> You're 3 focused sessions away from completing your weekly goal.

Specific.

Relevant.

---

# 53. Social Features

I would not prioritize social networking.

But some lightweight features could work.

### Study challenge

Share:

> Can you beat my score?

Friend receives challenge.

### Referral

> Invite someone preparing for their provisional.

### Milestone card

Generate shareable images:

🏆

> 7-Day Learning Streak

or

> Junction Rules Mastered

These become organic marketing.

---

# 54. Visual Design Direction

I would avoid copying Duolingo's green.

We need our own identity.

Visual characteristics:

* Bright but not childish
* Lots of white space
* Large buttons
* Rounded cards
* Bold typography
* Strong progress visuals
* Satisfying micro-animations

The question screen should feel calm.

The reward screens can be energetic.

---

# 55. Motion Design

This matters more than people realize.

Correct answer:

* Small success animation
* Button transforms
* Progress fills

Wrong answer:

* Gentle shake
* Clear correction
* No aggressive red flashing

Completion:

* Confetti sparingly
* XP count animation
* Progress path movement

The app should feel alive.

---

# 56. Sound

Optional.

Subtle sounds for:

* Correct
* Incorrect
* Streak
* Completion

But:

### Default should be subtle.

And mute must be easy.

---

# 57. Accessibility

Must support:

* Large text
* High contrast
* Screen readers
* Clear touch targets
* Low-motion preference

Also important:

Images and junction diagrams must be understandable.

---

# 58. Monetization Strategy Inside the Product

I would start with:

## Free

Users can:

* Take diagnostic
* Learn some basics
* Do limited daily practice
* Experience AI explanations within limits
* See progress

Then:

# Upgrade when value is obvious.

Premium unlocks:

* Unlimited Smart Practice
* Unlimited Mock Exams
* Full personalized plan
* Complete mistake review
* Advanced readiness analysis
* Expanded AI coach access
* Offline packs

---

# 59. Do Not Put a Paywall Before Value

The user should first think:

> This app is actually useful.

Then:

> I want more of this.

Then paywall.

---

# 60. AI Monetization

This is where AI can justify premium without ruining the free experience.

Free:

* Basic explanations
* Limited coach interactions

Premium:

* Personalized AI coaching
* Unlimited explanations
* Interactive teaching sessions
* Personalized study planning

But again:

Most users should not need AI to get the core value.

---

# 61. Product Modes

The main navigation could be:

```text
🏠 Home

📚 Learn

🎯 Practice

🏆 Progress

🤖 Coach
```

Five items maximum.

---

# 62. Learn Tab

The learning path.

```text
YOUR JOURNEY

✓ Road Signs

✓ Traffic Lights

▶ Junction Rules

🔒 Advanced Junctions

🔒 Regulations

🏆 Final Preparation
```

---

# 63. Practice Tab

Quick actions:

```text
SMART PRACTICE
Personalized for you

QUICK 5
Five-minute session

FIX MY MISTAKES
Review weak concepts

CHALLENGE
Something difficult
```

---

# 64. Progress Tab

Not just charts.

Explain progress.

# You're improving 📈

### This week

Questions answered: 142

Accuracy:

72% → 81%

Biggest improvement:

🛣️ Junction Rules +18%

Still needs work:

🚗 Road Regulations

**Fix this**

---

# 65. Coach Tab

The AI Coach.

But contextual.

At the top:

> What do you need help with?

Suggestions based on user data.

```text
Why do I keep missing junction questions?

Am I ready for a mock?

Build me a study plan.

I only have 10 minutes.
```

---

# 66. What I Think Is the Killer Feature

If I had to identify one thing that makes this product memorable:

# Adaptive Recovery Sessions

User performs badly.

The app does not just say:

> 12/25.

It says:

> We found the problem.

> You're not struggling with junctions generally.

> You're specifically struggling when vehicles approach from three directions and one vehicle is turning right.

Then:

# Let's fix that.

The app creates a mini lesson.

```text
EXPLAIN
↓
SIMPLE EXAMPLE
↓
GUIDED QUESTION
↓
SIMILAR QUESTION
↓
HARDER QUESTION
↓
MASTERY CHECK
```

That is the experience I would build around.

---

# 67. The Complete Product Architecture

```text
                    MOBILE PWA
                        │
        ┌───────────────┼───────────────┐
        │               │               │
      LEARN          PRACTICE         COACH
        │               │               │
        └───────────────┼───────────────┘
                        │
                 LEARNING ENGINE
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
   MASTERY         RECOMMENDATION      READINESS
      │                 │                 │
      └─────────────────┼─────────────────┘
                        │
                 ASSESSMENT ENGINE
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
 QUESTIONS          MOCK ENGINE      SPACED REVIEW
      │
      │
 CONTENT PLATFORM
      │
      ├── Topics
      ├── Questions
      ├── Images
      ├── Explanations
      └── Rules
                        │
                     BACKEND
                        │
                 POSTGRES DATABASE
                        │
                 ANALYTICS EVENTS
                        │
                  AI GATEWAY
              ┌─────────┼─────────┐
              │         │         │
            Groq      Gemini   Self-hosted
```

---

# My Recommended MVP Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand
* TanStack Query

## Mobile

* PWA first
* Service Workers
* Workbox
* IndexedDB
* Dexie

## Backend

* Supabase
* PostgreSQL
* Edge Functions

## AI

**Development / MVP:**

* Provider abstraction
* Groq as primary fast inference option
* Gemini as fallback

**Long-term zero marginal API-cost option:**

* Self-hosted open-weight model via Ollama/vLLM

Free cloud tiers are excellent for development, but I would architect for provider switching because free quotas and policies can change. ([Continuum][4])

---

# My Strongest Product Recommendation

I would build the MVP around exactly these pillars:

### 1. Beautiful Duolingo-style learning path

### 2. Intelligent diagnostic

### 3. Adaptive practice

### 4. 100% explanation coverage

### 5. Interactive AI teacher

### 6. Mistake recovery system

### 7. Spaced repetition

### 8. Dynamic timed mock exams

### 9. Meaningful readiness score

### 10. Offline-first PWA

### 11. Gamification without childishness

### 12. AI that acts, not just chats

And I would **not** waste early development time on:

* Social feeds
* User profiles
* Complex avatars
* Public leaderboards
* Fancy AI-generated question banks
* Video-heavy courses
* Dozens of exams
* Native Android/iOS apps initially

Build the learning engine first.

Because ultimately the defensible asset isn't the UI, and it isn't even the questions.

# It's the system that learns how each student learns.

That's where I think this can become substantially more valuable than PrimaEd rather than merely becoming a better-looking competitor.

[1]: https://klymentiev.com/blog/free-llm-api?utm_source=chatgpt.com "Free LLM APIs in 2026: 13 Providers Compared (OpenAI, Claude, Gemini, Groq) - Dmytro Klymentiev"
[2]: https://aicosthub.com/guides/free-ai-apis-2026/?utm_source=chatgpt.com "Free AI APIs 2026: Best Free Tiers — Gemini, Groq, Ollama, Hugging Face"
[3]: https://instantpwa.com/blog/pwa-offline-first-architecture?utm_source=chatgpt.com "Offline-first PWA architecture that survives real networks"
[4]: https://continuumcode.ai/guides/free-llm-api/?utm_source=chatgpt.com "Free LLM API: real limits and catches, compared (2026)"
