# Grok engine-evidence triangulation — 2026-08-22

## Provenance and limit

The owner supplied three independent Grok answers to
`briefs/grok-gamedev-evidence-adapters-2026-08-22.md` in the controller conversation. This file is the
controller's bounded intake, not a verbatim archive of those answers. The answers named classes of
primary sources but did not carry their direct URLs next to individual claims; therefore their
numeric scores and engine recommendation are research proposals, not promotion evidence.

## Three-arm convergence

All three arms independently:

- ranked Godot 4 first;
- rejected a universal GameDev harness in favor of native CLI plus project-local adapters;
- required a versioned structured-state exporter on every engine;
- separated deterministic/reproducible simulation state from non-deterministic rendered pixels;
- proposed a common artifact contract containing replay, state, metrics, logs, frames, hashes, and
  a manifest;
- kept motion/readability/impact and final engine promotion at an owner gate;
- rejected a green build as sufficient pilot evidence.

Two arms ranked Unity 6 as the credible alternative; one ranked Unreal Engine 5. That disagreement
is meaningful: Unity is the lower-burden proof/production alternative, while Unreal is the
higher-ceiling visual alternative. The current evidence does not decide which fallback matters.

Approximate Grok scores are not comparable across arms: weights changed (for example determinism
22 versus 25, performance 10 versus 15) and one arm scored Godot about 78/100, while two used
roughly 4.15–4.2/5. Treat the unanimous ordering as a hypothesis, not a quantitative meta-score.

## Primary-source corrections checked by the controller

1. Godot 4.7.2 is the current stable release as of 2026-08-22, released 2026-08-18:
   https://godotengine.org/download/archive/
2. Godot's official physics introduction explicitly says its physics is not deterministic,
   regardless of physics engine. Fixed physics ticks improve consistency but do not prove replay
   determinism:
   https://docs.godotengine.org/en/stable/tutorials/physics/physics_introduction.html
3. Godot `--headless` disables rendering and window-management functions. A proof pipeline must
   split the headless/state run from a rendering-capable capture run, or use another explicitly
   rendering-capable offscreen setup:
   https://docs.godotengine.org/en/4.7/classes/class_displayserver.html
4. `NavigationServer3D` exists, but the 4.7 class documentation labels it experimental and names
   synchronization/avoidance limitations. It is candidate capability, not evidence that the target
   horde already works:
   https://docs.godotengine.org/en/4.7/classes/class_navigationserver3d.html
5. Unity's current official pricing confirms Personal below the $200,000 threshold and Pro at
   $2,310/year prepaid or $210/month per seat in 2026:
   https://unity.com/products/pricing-updates
6. Unreal's current official license confirms game royalties on lifetime gross product revenue
   above $1 million, normally 5%, with Epic Games Store revenue royalty-free:
   https://www.unrealengine.com/license

## Decision implications for the new studio

- Godot becomes the leading **candidate**, not the promoted engine.
- No arm measured the representative private-repo-k scenario, horde/VFX load, authoring velocity,
  or owner visual bar. The recommendation remains falsifiable.
- Do not start the proposed engine pilot before the engine-neutral loop model and visual/technical
  research have supplied T0 with the scenario and scorecard. Otherwise the pilot silently chooses
  the architecture by being first.
- The smallest eventual pilot should test one candidate first, not build two mini-games by default.
  A second engine is the fallback only if a precommitted Godot falsifier fires.
- Simulation and visual capture should be two coupled proof phases sharing the same replay/scenario
  identity. State hashes are judged within declared machine/version bounds; pixels are visual
  evidence, never cross-machine deterministic truth.
- Avoid one JSON file per tick by default. Prefer an input file, bounded state JSONL or key-tick
  snapshots, metrics JSONL/CSV, exact logs, sparse frames, hashes, and one manifest.

## Current bounded recommendation

Proceed in this order:

1. engine-neutral causal loop model and telemetry/falsifiers;
2. three visual/technical-art territories and a precommitted readability rubric;
3. MAIN integrates those with this intake into a T0 option scorecard;
4. fresh critic reviews the integrated evidence;
5. owner may promote one engine candidate and one bounded spike;
6. only then implement the project-local evidence adapter and representative pilot.

Open/unknown: whether Godot meets the owner's visual bar and target horde/VFX performance, whether
state replay without deterministic built-in physics is sufficient, and whether Unity's production
advantage or Unreal's visual ceiling is the correct fallback axis.
