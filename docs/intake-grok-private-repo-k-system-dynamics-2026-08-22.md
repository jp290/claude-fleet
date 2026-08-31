# Grok systems-dynamics intake — 2026-08-22

## Provenance and confidence

The owner supplied one Grok answer to
`briefs/grok-private-repo-k-system-dynamics-2026-08-22.md` in the controller conversation. This is a bounded
intake, not a verbatim archive. The answer named developer talks, postmortems, interviews, patch
history, and academic work, but did not attach direct URLs per claim. Therefore its reference
claims must be source-checked before promotion. All concrete thresholds and system structures are
proposals until simulated and tasted.

## Research claims worth carrying

- Sanctum 2: the hybrid target was deep strategy plus intense action; free-mazing and a shared
  resource-drop race reportedly failed; flexible tower/weapon/perk systems helped iteration, while
  RPG-style stat dilution was rejected.
- Orcs Must Die: spatially legible trap surfaces, physics displacement feeding damage traps,
  location-conditioned income, and behavioral upgrade changes are cited as successful hybrid
  patterns.
- Left 4 Dead: intensity/stress pacing, orthogonal special pressures, recovery windows, and
  spatial-commitment crescendos are cited as alternatives to HP/count inflation.
- Physics/hit-reaction sources: distance-scaled impulse, mass response, collision propagation,
  recovery/stun budgets, and measurable displacement/duration are proposed as the honest form of
  shotgun knockback.

These are useful hypotheses. None establishes the new game's final design.

## Three causal-loop proposals

### A. Intensity-paced spatial commitment

Density, specials, proximity, damage, and nearby kills feed an intensity state. Pressure forces a
positioning or retreat decision; bounded recovery windows create opportunities to reposition,
spend, or repair coverage. Turret policies such as nearest, densest, highest-mass, and
player-marked become useful only when the player creates their conditions.

Primary risks: recovery-edge farming, metronomic pacing, turret coverage that removes movement,
and one mandatory upgrade path.

### B. Competing resource-timing economy

Combat produces burst income but costs position; returning to world-space workbenches opens spend
opportunities but cedes pressure; turret placement makes resources spatially sticky. Distinct
workbenches compete for physical presence and spend timing.

Primary risks: an optimizable visit schedule, combat-only income that never returns to base,
passive early turret investment, and one mandatory workbench path.

### C. Weapon-turret synergy forcing

Weapon effects deliberately satisfy turret activation or targeting conditions. Shotgun knockback
can funnel mass classes; other still-unknown weapons could create timing/control or mark/commitment
conditions. Workbench axes mutate the conditions rather than merely increasing damage.

Primary risks: rote synergy recipes, a universal synergy that erases weapon identity, automatic
upgrades that remove the decision, and turrets replacing the player.

The three are not mutually exclusive, but combining all of them before one falsifiable loop exists
would conceal which mechanism produces the decision.

## Engine-neutral state and replay proposal

Fixed-tick input: movement, aim, fire/reload, placement, interaction, and workbench choice.

Countable state:

- enemy class, mass, health, control budget, position/velocity, density contribution, target;
- player position/velocity/health, resources, intensity/timing, three weapon states and axes;
- resource income event with time and kill/location provenance;
- workbench location/type/open state/spend queue;
- turret placement, role, targeting policy, activation condition, charge/ammo, coverage;
- deterministic targeting priority;
- damage and knock event with distance falloff, mass response, collision propagation, and consumed
  control budget;
- wave phase/escalation/spawn schedule;
- win/loss plus causal trace: last spend, last placement, player position, missed condition.

Required replay family per candidate loop: combat-only, defense-only, and mixed on the same seeds.

## Proposed discriminating predicates

1. Mixed play outperforms both pure strategies on the same seed set.
2. Correctly timed spend predicts later survival better than total resources earned.
3. Satisfied turret-weapon conditions predict remaining objective health better than raw damage
   from either side alone.
4. Distance- and mass-sensitive knock changes cluster position in a way pure damage does not.
5. A loss retains a recoverable causal chain rather than only a final-health label.

Deliberate breakers: remove spend/recovery windows; make turret policies identical and independent
of the player; collapse axes to percentage damage; remove mass/distance from knock; erase decision
history on loss. Every predicate must fail under at least one named mutation or it is tautological.

## Research answer's proposed owner question

The answer asks whether the first slice should enforce one hard competing window (intensity,
spend, or synergy) or make all three soft/optional. Treat this as a proposal for T0 framing, not a
question that must immediately interrupt the studio. The owner already requested meaningful
tradeoffs; Studio-MAIN should first show which smallest loop and falsifiers make that request
testable.

## Open/unknown

- Direct source URLs and exact scope of each cited claim.
- Which one causal mechanism should lead the first model.
- The identities of the two non-shotgun weapons.
- Any numeric threshold, balance value, control budget, or intensity formula.
- Whether observers can read the proposed causal chain in motion.
- Whether a technically discriminating loop is enjoyable.
