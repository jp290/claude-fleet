# Brief: the craft of REPEATEDLY setting up agent working circles (to relay to Grok)

**How to use:** copy everything below the rule into a fresh Grok conversation, unedited.
Self-contained; no hosts, tokens, or names. Provenance: `docs/private-repo-c-aufstellung-2026-08-17.md`,
`docs/harness-doktrin-2026-08-17.md`, `docs/private-repo-e-worktrail-audit-2026-08-17.md`,
`docs/grok-working-circle-second-opinion-2026-08-17.md`. Scope guard: this is NOT a
which-harness-product comparison (we ran and closed that question); it is about the craft layer
ABOVE any harness.

---

Context: my actual recurring work is not building one app — it is repeatedly SETTING UP small
multi-agent working circles ("studios") that then build apps. Two instances exist: a turn-based
artillery game (complete through several gates, fully work-trail-audited) and a real-time
private-repo-c (setup designed, about to start). Each studio: one MAIN session (synthesis, briefing,
review, commits), bounded sub-agent workers (one deliverable, two attempts, ~100-120-turn cap
with a distilled state note), a blind multimodal critic on a tracked rubric, targeted
cross-family code review at gate boundaries, and a single standing-rules file whose block is
copied verbatim into every brief (a brief without it is invalid). Everything is
propose/promote: producers never write the anchor they are measured against; a human owner
promotes.

What we have LEARNED, measured, about the setup craft itself:
- The contract seam is the failure point, not the contract: rules held at MAIN altitude reached
  workers 1/10 times until they became mechanical checks in a verbatim brief block.
- Founding-message delivery is unproven in most harnesses (three silently swallowed founding
  briefs in one day); we now require an ACK-commit with a content hash as the receiver's first
  action.
- Harness choice splits by axes: the harness dominates the PATH (ergonomics, delivery,
  intervention rate) and matters most for unstructured work; model+rubric+brief structure
  dominate the DESTINATION (finding quality) once scripts own the data and evidence crosses the
  boundary as compact packs.
- Evidence-pack truncation produced our only false audit finding — pack fidelity is a
  first-order property of any judgement pipeline.
- Context residency, not iteration count, is the cost driver (quadratic growth; ~70M of 78.8M
  cache-read was replay of resident material).
- Each new studio so far is hand-assembled: contract file, standing-rules file, decision record,
  gate chain, proof media, critic rubric — copied and adapted by judgement, with lessons carried
  in prose documents between instances.

The question — attack the CRAFT, not the instance: if setting up such studios is the recurring
product, what are the structural mechanisms we are missing? Specifically:

1. **Instantiation:** what should a reusable "studio kit" contain versus what must stay
   per-program? Where does templating go wrong (cargo-culted rules that fit game 1's failure
   modes, not game 2's)? Is there a principled way to decide which lessons transfer — beyond our
   current "every deviation must cite a trail finding"?
2. **Contract inheritance and drift:** the standing-rules file solves rule delivery WITHIN a
   studio. Across studios we have only prose. What mechanism keeps a cross-studio lesson ledger
   alive without becoming a growing rulebook every new MAIN must swallow (our windows are
   finite; ingest cost is real and measured)?
3. **Setup-quality signal, early:** a studio's setup quality currently shows only after gates —
   too late. What leading indicators of a BAD setup exist in the first day of trails (brief
   re-explanations? worker question rate? pack fidelity?) and what cheap sensor would surface
   them?
4. **The proof-medium decision:** we now believe choosing the proof medium (screenshot vs
   telemetry replay vs test suite) is THE central setup decision — it determined both studios'
   entire shape. Right frame, or are we over-indexing on two data points? What is the general
   procedure for deriving the proof medium from a product's properties?
5. **Roles we never considered:** given the measured shape above, name any role or seam that
   established multi-agent practice (or your own reasoning) considers load-bearing and that is
   absent here. Justify each by a failure mode we WILL hit, not by symmetry or completeness.
6. **Rank everything** you propose: the one change to make before the private-repo-c studio boots,
   versus what waits for its first work-trail audit, versus what needs a third studio to be
   worth building.

Constraints: mechanisms with named failure modes, not tips; one dev machine; nothing auto-binds
(human promotes); assume finite context windows are a permanent design constraint, not a bug to
wait out.
