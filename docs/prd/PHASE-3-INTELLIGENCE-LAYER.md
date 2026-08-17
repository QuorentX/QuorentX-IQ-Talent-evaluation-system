# PRD — Phase 3: Intelligence Layer

**Product:** QuorentX IQ  
**Phase:** 3 — Intelligence layer  
**Depends on:** Phase 2  
**Status:** Spec · **Requires legal/compliance review before build**

---

## 1. Goal

Add organizational interview intelligence: sentiment/confidence signals, bias detection flags, interviewer consistency metrics, and DEI funnel reporting — built for auditability and regulatory scrutiny, not vanity dashboards.

---

## 2. In scope

| Capability | Description | Priority |
|------------|-------------|----------|
| Sentiment / confidence analysis | Language-level signals from transcripts (not face/voice biometrics by default) | P1 |
| Bias detection flags | Heuristics + disparity alerts on score patterns | P0 |
| Interviewer consistency metrics | Calibration across interviewers for same role | P0 |
| DEI / diversity funnel reporting | Stage funnel by permitted demographic dimensions | P1 |
| Policy controls | Region toggles, feature flags, data retention | P0 |
| Legal review pack | DPIA template, customer disclosures, exportable methodology | P0 |

---

## 3. Guardrails (mandatory)

- Build only after counsel review per launch region.  
- Opt-in features for high-scrutiny modules.  
- No automated adverse action from Phase 3 signals alone.  
- Document protected-class handling and customer responsibility.  
- Prefer text/transcript analytics over biometric affect recognition.

---

## 4. User stories

1. As a TA leader, I see interviewer harshness/leniency vs peers for a role.  
2. As a DEI partner, I review funnel drop-offs with methodology footnotes.  
3. As compliance, I disable sentiment modules in restricted jurisdictions.  
4. As a hiring manager, I get a bias flag with explanation I can investigate — not a silent reject.

---

## 5. Success metrics

- Calibration variance across interviewers ↓ over 2 quarters  
- Customer audit pass rate for AI/EEO inquiries  
- Feature adoption only where legal pack signed  

---

## 6. Exit criteria

At least one regulated-market customer live with consistency + bias flags + funnel reporting under signed compliance pack; sentiment module behind jurisdiction flag.
