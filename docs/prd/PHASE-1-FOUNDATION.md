# PRD — Phase 1: Foundation

**Product:** QuorentX IQ  
**Phase:** 1 — Foundation  
**Status:** Spec  
**Buyers:** HR/TA + technical hiring managers (mid-market → enterprise)

---

## 1. Goal

Ship a reliable core interview workflow: schedule → structured kit → live panel → scorecards → hiring-manager visibility, with light ATS sync — so customers can run fair, auditable interviews without stitching vendors.

---

## 2. In scope

| Capability | Description | Priority |
|------------|-------------|----------|
| Scheduling + calendar sync | Book panels; Google/Microsoft calendar sync | P0 |
| Interview kit builder | Role templates: questions, rubrics, timeboxes | P0 |
| Live video interview hosting | Host/join interviews in-product (or embedded provider) | P0 |
| Panel scorecards + structured feedback | Per-competency scores, required comments, submit lock | P0 |
| Hiring manager dashboard | Pipeline, upcoming interviews, score summaries | P0 |
| ATS integration (1–2 majors) | Greenhouse and/or Lever sync candidates + stage | P1 |
| Org provisioning | QuorentX-issued company access (no public self-serve) | P0 |
| Candidate auth | Invite credentials; assessment sitting (current IQ core) | P0 |

---

## 3. Out of scope (later phases)

AI question generation, transcripts, auto-scoring, ranking, bias/DEI analytics, async video, mock interviews, Slack/Teams/HRIS deep integrations.

---

## 4. User stories

1. As a recruiter, I schedule a panel and sync it to calendars so interviewers show up prepared.  
2. As a hiring manager, I open a kit with rubrics so feedback is comparable across candidates.  
3. As an interviewer, I score live against competencies and submit before leaving the call.  
4. As a TA lead, I see dashboard status without exporting spreadsheets.  
5. As QuorentX ops, I provision a company workspace and admin without public signup.

---

## 5. Success metrics

- Time from “candidate ready” → first scored interview ≤ baseline − 30%  
- ≥ 90% of interviews have complete scorecards within 24h  
- Calendar no-show rate tracked; target ↓ vs pre-IQ  
- ATS sync success rate ≥ 99% for supported providers  

---

## 6. Non-functionals

SSO-ready auth model; audit log of score submits; SOC2-minded data handling; WCAG AA for candidate/interviewer UI; region data residency path documented.

---

## 7. Dependencies

Video provider selection; calendar OAuth; ATS partner APIs; legal review of recording consent copy.

---

## 8. Exit criteria

Demo org can run end-to-end: schedule → kit → live interview → scorecards → HM dashboard, with one ATS bidirectional sync of candidate stage.
