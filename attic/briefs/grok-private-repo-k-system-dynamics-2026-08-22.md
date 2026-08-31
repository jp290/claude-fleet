# Grok Research Brief: Private-repo-k System Dynamics

Research a systemic design model for a standalone AA-indie 3D tower-defense survival shooter.
This is not a feature brainstorm and must not choose the engine, setting, camera, art direction,
final roster, or balance numbers.

## Owner anchors

- Exactly three weapon identities. The shotgun is one of them, not the whole hook.
- Shotgun knockback is distance- and enemy-mass-sensitive.
- Every weapon has several play-style-changing upgrade axes, not only percentage increases.
- Placeable turrets need distinct roles, placement tradeoffs, targeting behavior, upgrades,
  readable state, and meaningful synergies with the player weapons.
- A world-space base contains distinct health, weapon, defense, and otherwise justified
  workbenches. They must create decisions, not act as decorative menus.
- The central loop couples personal combat, horde pressure, positioning and retreat, workbench
  spending, turret coverage, resource timing, and wave escalation.
- Losses must be causally legible. Particle/VFX feedback supports readability and impact but does
  not substitute for system design.

## Research task

Use primary sources where possible: developer talks, postmortems, official design documentation,
patch notes that expose systemic changes, and directly inspectable game documentation. Compare
relevant games without treating popularity as design evidence.

Investigate:

1. How horde pressure can force movement, retreat, spatial commitment, and recovery without simply
   increasing enemy health or count.
2. Resource loops whose income rhythm and spending windows make fighting, returning to the base,
   using a workbench, and placing a turret genuine competing choices.
3. Turret roles and targeting policies that interact with weapon properties rather than replacing
   the player or collapsing into one dominant layout.
4. Three-weapon roster structures in which each identity occupies a different decision space and
   every upgrade axis changes targeting, risk, crowd control, movement, timing, or synergy.
5. Physically readable knockback that respects distance, enemy mass, collision, crowd density,
   stun/control budgets, and anti-exploit limits.
6. Dominant strategies, degenerate loops, false choices, snowballing, stall states, trap builds,
   turret-only wins, combat-only wins, and upgrade paths that become mandatory.
7. How the player can understand why a defense failed and which earlier decision caused it.

## Required deliverables

1. Exactly three distinct causal-loop proposals. They are options, not a final selection.
2. For each proposal:
   - state variables and transitions;
   - player decisions and opportunity costs;
   - workbench and turret interactions;
   - weapon-role and upgrade-axis constraints;
   - wave/escalation behavior;
   - expected dominant-strategy risks;
   - smallest engine-neutral vertical-slice scenario.
3. A common deterministic simulation schema covering fixed-tick inputs, enemies by mass/class,
   player state, weapons, resources, workbenches, turrets, targeting, damage, knockback, wave state,
   win/loss, and escalation.
4. At least three committed replay scenarios per proposal: combat-only, defense-only, and mixed.
5. Telemetry predicates that could prove the mixed strategy is meaningful and parameter mutations
   that would deliberately break every predicate.
6. Falsifiers for positioning pressure, resource timing, turret-weapon synergy, knockback
   readability, and loss legibility.
7. A short attack on each proposal: how it could still produce a technically functional but dull
   game.
8. The smallest owner decision the evidence can support. Do not make that decision for the owner.

Keep observed facts, derived hypotheses, proposals, and `unknown` explicitly separate. Do not
produce a broad feature inventory or silently decide the two non-shotgun weapons.
