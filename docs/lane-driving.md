# Driving a lane — what was rigid, what is forced, and what to try next

**2026-07-28**, written after two lanes were briefed, run and landed in one session. Amends
`lane-brief-template.md`, which already contains most of this and was not followed. Also carries the
ideas this session produced that have no home yet (§5) and the two it measured shut (§6).

The owner's instinct that started this: *"besser wäre, wenn die main session mit Sachverstand eine
Lane aufmacht, statt das über halb steife Strukturen zu machen."* It is two propositions in one, and
they do not fail together.

---

## 1. The rigid part was the brief, not the decomposition

Both briefs ran to ~40 lines and **enumerated things the lane could have found by reading** — file
paths, line numbers, the shape of the defect. `lane-brief-template.md`'s own norms section already
rules that out: a brief's job is *"only the residue — what the lane cannot discover by reading,
because it exists only in the conversation"*: a decision and its reason, a hazard and why the
obvious precedent does not apply, the owner's ranking between two goods. **Everything discoverable
should be found, not listed.**

The evidence that the enumeration was not what made the lanes work is that both contributed things
no brief contained:

- Lane A found `drills/drill-3.sh` as a **sixth** consumer of the port table (the brief named five),
  and measured that the 8800 band collides with long-lived local services (8815, 8850, 8862, 8899,
  8901, 8924) — a second, independent reason those runs fail to bind, which nobody had asked for.
- Lane A declined to touch `HANDOFF.md`'s stale band numbers, correctly, to avoid a doc collision
  with the main checkout.
- Lane B declined to touch `docs/security-findings.md:45` (SEC-2, status OPEN), on the grounds that
  re-assessing an open security finding's status is the owner's call and not a lane's.

None of that came from the brief. It came from judgment the brief neither supplied nor needed to.
**A longer brief buys placement, not competence.**

## 2. The decomposition is not a preference — it is the reversibility

Two constraints force it, both measured in this repo:

1. **Lanes that touch the same file collide at land.** `audit-implementation-plan.md` partitioned
   wave 1 by `server.ts` **region**, not by finding number, for exactly this reason. The 2026-07-28
   split (Lane A: wrappers and harnesses; Lane B: `server.ts` and `e2e/prompts.ts`) had a
   collision surface of zero, and the two landed in sequence with a clean rebase between them.
2. **Undo is exactly one land deep** (`undoLast`, one record per repo, overwritten by every land).
   One lane doing both concerns produces **one** land over eleven files and two unrelated subjects.
   If either half turns out wrong, it cannot be reversed without taking the other with it.

So the split is not tidiness one pays for. It *is* the ability to take half of it back. A single
combined lane would also have serialised roughly two hours of concurrent work.

**Corollary for sequencing, applied on 2026-07-28:** land the lane you are most likely to want back
**last**, because only the last land is undoable. Lane A (test substrate, failure = a loud red gate)
went first; Lane B (production code on unattended paths, failure = silent) went last.

## 3. What actually went wrong: fire-and-forget

The defect was not the structure. It was that the session delivered one brief and then went silent
for an hour. The knowledge that had just been assembled — five agent reports, a register, a measured
refusal — sat in the main session and did nothing while two lanes worked.

The channel exists: `POST /send {slot, text}` reaches any lane's pane at any time, and the `⚙ steward`
convention exists for precisely this kind of supervision. Neither was used.

**The proposition, stated so it can be refuted:** a short brief (decision, reason, territory,
done-criterion — nothing discoverable) plus **mid-flight correction** beats a long brief plus
silence. What would confirm it: fewer wrong turns per lane-hour, or a lane reaching a question the
main session answers in one message instead of the lane spending twenty minutes. What would refute
it: interruptions that cost more context than they save, or a lane that becomes dependent and stops
establishing its own complement.

**Do not read §1 as "briefs are bad".** Read it as: the brief carries the residue, the channel
carries the rest, and today the channel was unused so the brief had to carry everything.

## 4. The limit neither a shorter brief nor a chattier channel fixes

A lane does not know what it has not asked. `lane-brief-template.md` records the instance: a lane set
a timeout constant to exactly the value of a server-wide `idleTimeout` it had never seen, because that
constant lived outside its diff. Every suite was green; the behaviour was wrong. A conversational
channel does not reliably catch that, because **both sides would have had to already suspect it.**

And the honest bound on all of the above: **n = 2.** Two lanes, both successful. That is not a
validated method. It is one data point per proposition.

## 5. Ideas with no home yet

Each with its cost and with what would kill it.

- **A derived register, not a maintained one.** Rows of `(claim, file, anchor-text)` plus a ~30-line
  script that checks the anchor still exists. It cannot rot silently — it either passes or names the
  rows that moved. Evidence it is the right shape: of 117 checked `file:line` doc references, **15
  hit and 102 do not** (deviations up to +2463 lines), while **38 of 38 symbol anchors resolve**.
  Killed by: nobody running the script, which is the same failure as an unindexed doc.
- **The symbol-anchor convention.** Replace `file:line` in load-bearing docs with
  `` (`file`, grep `symbol`) ``, starting with `docs/security-model.md`, where every sampled anchor
  is dead. A convention, not a tool — cheaper than the lint, and the measurement above says it works.
- **A config sensor.** `state.sh` derives HEAD, lanes, ledgers, process identity and machine hygiene,
  and **zero configuration**, while 31 of 42 `FLEET_*` values have no sensor anywhere. The cheapest
  fix for the class that lets `deployGap` go green over a `watchdog.sh` change that is not live.
- **Give `e2e-postland-audit.sh` a caller.** It is broken because nothing runs it; it is also the
  only proof of the tier-2 queue/drain/snapshot path. A caller, not a deletion.
- **Conversational lane driving** — §3, as an experiment with a stated refutation condition.

## 6. Measured shut — do not re-propose without new evidence

- **Extracting the ledger layer (or anything) out of `server.ts`.** The measurement is in
  `analysis-2026-07-28-findings.md` §1: 4777 code lines, +908 in two days, best clean seam 3.3 %,
  eight invariants that survive only by co-location. The pattern that *does* work here is the six
  modules already extracted — **derivations out, never state.**
- **A maintained knowledge register or index.** `knowledge-layers.md` §3 already catalogued the rot,
  and `479f78c` is six docs unindexed within hours of being written. More rows rot faster. The
  derived form in §5 is the only version worth building.
