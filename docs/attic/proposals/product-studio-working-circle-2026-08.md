# Product Studio as a Fleet working-circle profile

**Status:** owner-confirmed design hypothesis, 2026-08-14. It is a future consumer of the
Program/Origin + Context Plan + MAIN-bootstrap corridor, not a current implementation program.
It creates no task wave, registry, context compiler, permanent agent roster or platform choice.

## The idea in one sentence

Claude Fleet should be able to run a durable, nearly autonomous **Product Studio working
circle** whose specialized roles, tools and session context are composed for a concrete product;
the owner remains the source of direction and taste, while Fleet handles preparation,
production, integration, proof, iteration and maintenance.

The first goal is not a universal studio. It is the smallest credible product experiment that
can earn money, while leaving behind reusable studio capability even if the product is simplified
or changed.

## The missing organizational layer

The proposed relationship is:

```text
Program / Origin artifact
  what we want, why, success, non-goals and owner decisions
        -> Working-circle profile
  how this kind of work is organized: roles, tools, quality paths, owner touchpoints
        -> Context Plan
  the smallest relevant context + capabilities for this session and act
        -> MAIN / direct work / specialist worker
  execute the smallest sensible path
        -> Outcome + Work Trail
  result, proof, detours and proposed context/rule improvements
```

`Program` says **what and why**. The working-circle profile says **how this kind of work is
organized**. The Context Plan says **what this particular participant needs to know and use**.

## Compose profiles; do not fork studios

`game-studio`, `ios-studio`, `roblox-studio` and `steam-studio` are likely mostly the same
organization. Avoid separate monoliths and the later cross-product of `ios-game-studio`, etc.
Compose thin dimensions over one Product Studio core:

| Dimension | Examples |
|---|---|
| Domain | game · app · tool |
| Platform/runtime | web/Three.js · iOS · Roblox · Steam |
| Phase | discovery · production · release · maintenance |
| Role | creative · research · context · code · art · audio · review · release |
| Quality/touchpoint | technical · visual · audio · gameplay · store · owner tasting |

A small Three.js game is therefore Product Studio + game + web/Three.js + the roles and quality
paths its current phase actually needs. A later iOS game can reuse game knowledge while swapping
the platform layer.

## Roles are modes, not a permanent agent army

Potential specialist roles include:

- adaptive MAIN/producer: keeps the program coherent and chooses direct work, worker, lane or job;
- research worker: closes a bounded knowledge gap and reports evidence and unknowns;
- context curator: proposes the relevant packs, anchors, tools and omissions for a Context Plan;
- creative director: protects product identity and translates owner tasting into usable direction;
- code/gameplay, art and audio workers: produce and integrate their respective artifacts;
- visual/audio reviewers and playtest workers: inspect the actual build, not only source or prose;
- release worker: platform builds, store artifacts and release checks;
- learning curator: proposes small pack/rule improvements from repeated Work-Trail evidence.

Fleet instantiates only the roles needed for the current act. A role is primarily a context,
capability and output contract; the same harness may serve several roles at different times.

## Smart session enrichment: information layers

Do not dump the whole project into every session. A Context Plan should select across layers:

1. **Owner/program:** intention, success, non-goals, taste and confirmed decisions.
2. **Domain:** game/app principles and maintained external knowledge.
3. **Project:** architecture, gameplay pillars, art direction, asset and system contracts.
4. **Task:** exact done criterion, affected surfaces, dependencies and proof path.
5. **Role:** only the discipline and examples needed by this specialist.
6. **Live facts:** current HEAD, concurrent work, collisions, harness capabilities and events.
7. **Learning:** relevant prior outcomes, recurring detours and promoted lessons.

Specialist agents may **propose** enrichment of these layers. Context Packs remain focused,
versioned references selected for a reason; they are not a growing universal prompt. Noise and
inspiration that never became a decision stay out.

## Owner tasting is a first-class production loop

The owner is not removed from questions of identity, feel and commercial judgment. Fleet should
bring small, real, playable/usable increments to an explicit tasting point:

```text
real production slice -> owner tastes the build -> feedback is interpreted
  -> concrete decision / direction / task -> targeted iteration -> taste again
```

Informal feedback such as "generic", "movement feels cheap" or "keep exactly this explosion"
is useful input. A creative/context role translates it into explicit product decisions, positive
and negative examples, or proposed project context. It must not silently promote one reaction into
a universal rule.

Technical agents may help prepare screenshots, video, audio comparisons and playtest evidence,
but an AI judging AI output is not the sole proof of taste.

## Durable development, not a stream of throwaway demos

A vertical slice means the first small **production-capable** version on the real stack, not a
disposable prototype. Work should accumulate in:

- a small reusable studio kit (build/run, input, audio, settings, persistence, debugging and asset
  pipeline where appropriate);
- a deliberately simple product architecture containing only what this product needs;
- reversible experiments that are either integrated, refined or removed after tasting.

For an initial web game, the current hypothesis is a simple Three.js stack plus selected open
libraries, not a custom engine or premature universal framework. The exact libraries and target
platform remain product decisions and require current research when a real experiment is chosen.

Fleet must also be able to say that continued polishing is not earning clarity. After bounded,
explicit iterations it should present choices: improve the current core, simplify it, reuse the
working pieces in a better direction, or stop. Changing direction must preserve reusable code,
assets, decisions and lessons rather than resetting the studio to zero.

## Anti-slop contract

Nearly autonomous production is not maximum output. Avoid AI slop by construction:

- few strong product/gameplay pillars before content volume;
- one coherent creative direction and explicit negative examples;
- curation, rejection and deletion are normal production acts;
- no bulk asset or feature generation merely to occupy parallel agents;
- integrate and taste small real slices before widening scope;
- preserve human judgment at identity, feel and commercial decision points;
- verification matches the artifact: code/build checks plus visual, audio or playtest review where
  those claims are made.

The target is self-directed refinement under taste constraints, not unattended content volume.

## Choosing the first revenue experiment

Do not choose a platform because a studio profile already exists. Compare a small set of current
opportunities using at least:

- time to a genuinely sellable release;
- target user and concrete promise;
- reachable distribution channel and monetization clarity;
- production, review and release burden;
- how reliably agents can build and test it;
- reusable capability for follow-up products;
- owner taste, domain insight and willingness to keep iterating;
- explicit time/downside limit and a cheap simplification or exit path.

No current winner is asserted here. iOS, Roblox, Steam and web economics, policies and discovery
change; the selection requires a fresh market/store/competition research program. Optimize for the
simplest **credible money experiment**, not theoretical market size or infrastructure elegance.

## Provenance and cut line

The STARBATTLE/TokenGremlin tweet was a creative trigger, not evidence of a disclosed multi-agent
studio architecture. None of this proposal is presented as a finding about that project.

Reactivate this hypothesis only after the core has real Program/Origin artifacts, inspectable
Context Plans and MAIN bootstrap—or when the owner explicitly starts the first revenue experiment.
Until then: document it, do not build it.
