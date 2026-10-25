# How a client writes

2026-10-06. Counterpart to `docs/haltung-worker.md`: how MAIN and the orchestrator write a card so that it brings
out the best version of the agent who carries it out. The owner, the same day: „[Zitat entfernt]“
 The context pack `haltung-auftraggeber`
points at the section below.

## How we write cards, and why

Preferences, not rules. The card form itself (header lines, DONE, VERIFY) stays as the parser reads it.

- **Think of the cast first, then write.** Who would be the best fit for exactly this work, what do they already
  know, what do they still need, what would get in their way? A card written for the person you picture comes out
  different from one written against the mistake you fear.
- **The first sentence addresses this version.** It names the work and the expertise it takes, for this task, not
  as a formula that sounds the same on every card.
- **Goal, why, done, material.** What should be different afterwards, in the owner's words; why it matters; how to
  tell it is finished; where the material lies. The how belongs to the agent. Methods, report outlines and
  spelled-out check chains take away the work we bring the agent in for.
  For a product program, the card names the confirmed draft with its SHA and the sentence of the success
  criterion it serves, and its done sentence includes the integration check: the draft's integration command then
  runs over the whole flow, not only the card's own check.
  Until the draft is confirmed (by the orchestrator; a new or changed success criterion by the owner), the
  prototype is the only implementation line. A running program keeps building until a new user-visible strand
  starts there (`AGENTS.md` §Hard invariants).
- **Only real limits.** VERBOTEN names what really can't be done (other people's surfaces, outside effect, the
  owner's acts), not every conceivable error. A long list of prohibitions reads as distrust and makes the work
  small.
- **Give room explicitly.** Say what they may decide themselves, for example taking a needed neighbouring surface
  along and naming it in the report. Without that sentence a good lane asks instead of building.
- **Write for the model that gets the card.** A weaker or foreign model needs more situation and material, not more
  prohibitions: the same sharpness, a smaller scope.
- **Ask for feedback on the card.** Ask in the card that the lane ends with one sentence on what the card lacked or
  what got in its way. That is how the next card learns from the last.

### An example

```
ROLLE: codex/gpt-6.1-sol/high
GROESSE: mittel
FLAECHE: state.sh, e2e/ctl.ts
VERIFY: the localProof.steps from GET /api/self/gate, as AGENTS.md §Verify maps them
DONE: ./state.sh --brief stays under 80 lines and 10 KB at live size and still answers the six start questions in one call.
VERBOTEN: no server or route change

You know shell renderers and context budgets: bring the start output back to its budget.
After the deploy the orchestrator read 663 lines and 150 KB, about 15 % of a Codex window, just
to start; state.sh#group names a budget and still prints everything. How you cut is your call;
a capped category says how much is missing and where it stands. If you need a neighbouring file,
take it along and name it. End with one sentence on what this card lacked.
```
