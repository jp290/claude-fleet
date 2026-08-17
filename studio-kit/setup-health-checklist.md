# Setup-health checklist (kit v1)

Run by the MAIN after the FIRST TWO worker cycles, before any gate is attempted. Results are
written into the decision record. Any failure stops work: repair the kit instantiation, then
re-run. This turns day one into a forced setup audit instead of hopeful progress.

Leading indicators (all measurable from the trails already collected):

- [ ] **ACK integrity:** every spawned agent's first action was the ACK commit, hash matches,
      latency unremarkable. A mismatch or absence = the delivery seam is open (the
      three-swallowed-briefs failure mode).
- [ ] **Brief re-explanation count = 0:** no worker asked the MAIN to restate a standing rule or
      contract clause. Each occurrence names the brief slot that failed to carry.
- [ ] **Standing-rules question rate = 0:** no question whose answer is inside the verbatim
      block (a nonzero rate means the block is present but not binding — the 1/10 failure mode).
- [ ] **Pack fidelity:** zero guardian rejections; zero silently capped fields found on spot
      check.
- [ ] **Residency growth:** context growth over the first two cycles is within the declared
      budget slope (numbers per program; the SLOPE being wildly super-linear this early predicts
      the quadratic blow-up).

Thresholds are tuned after each studio's first work-trail audit; the checklist items themselves
change only by owner promotion.
