# PRD — Phase 2: AI Differentiator

**Product:** QuorentX IQ  
**Phase:** 2 — AI differentiator  
**Depends on:** Phase 1 Foundation  
**Status:** Spec

---

## 1. Goal

Make QuorentX IQ clearly smarter than scheduling/scorecard tools: generate role-fit questions, produce transcripts/summaries, score against rubrics with **explainable** rationale, and rank candidates comparatively — without black-box face/tone scoring.

---

## 2. In scope

| Capability | Description | Priority |
|------------|-------------|----------|
| AI interview questions from JD/role | Draft kits from job description + competencies | P0 |
| Automated transcript + summary | Post-interview transcript, chaptered summary | P0 |
| Candidate scoring vs rubric | Suggested scores with evidence quotes | P0 |
| Comparative candidate ranking | Side-by-side rank with criteria transparency | P1 |
| Human override | Interviewer/HM can accept/edit AI suggestions; audit trail | P0 |
| Explainability panel | “Why this score” — rubric mapping + excerpts | P0 |

---

## 3. Out of scope

Facial emotion analysis; unconsented biometric inference; automated hire/no-hire decisions without human; Phase 3 DEI/bias productization.

---

## 4. Principles (compliance-first)

- AI assists; humans decide.  
- No silent score mutation after submit.  
- Every AI score shows evidence + model/version stamp.  
- Candidates informed where law requires (transcript/recording).

---

## 5. User stories

1. As a recruiter, I paste a JD and get a draft kit in minutes.  
2. As an interviewer, I review AI summary + suggested scores before locking my card.  
3. As a hiring manager, I compare three finalists with ranked criteria I can defend in debrief.  
4. As compliance, I export an audit of AI suggestions vs final human scores.

---

## 6. Success metrics

- Kit draft time ↓ ≥ 50%  
- Debrief prep time ↓ ≥ 40%  
- ≥ 70% of AI score suggestions accepted or lightly edited (not discarded)  
- Zero critical audit gaps on AI vs human score history  

---

## 7. Risks

Model hallucination in summaries; bias amplification; customer distrust of opaque AI — mitigated by evidence quotes, override UX, and no biometric black boxes.

---

## 8. Exit criteria

Pilot customers use AI kits + transcript summaries + explainable rubric scores in live hiring loops with documented override rates.
