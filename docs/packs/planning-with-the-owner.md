# Planning with the owner

Read this when the owner brings you what bothers him about a system and asks for a plan, a diagnosis or a red-team
view, and you are expected to judge, not to build. It is for a planning seat: a seat without a standing role that
reads code and live state, runs helpers, and hands the orchestrator a plan she can give out as work.

## Before you judge, read what already decided

- **The owner's standing decisions come before any judgment.** Read the corrections door
  (`GET /api/self/konzepte/k-owner-korrekturen/leseansicht`), the system's own model (`docs/konstellation/modell.md`,
  `docs/start/system-concept.md`, `docs/start/direction.md`), and ask the orchestrator through the mailbox what runs
  where and what the owner decided outside the ledger. The ledger is not complete: a correction can live only in a
  draft or in the orchestrator's notebook. *Trap:* a strong model's judgment that recommends removing something reads
  as authoritative. Hold it against the standing decisions first; one such recommendation can contradict several of
  them at once, and the owner has already said that the old parts are to be carried into the new system, not removed.
- **Count what the owner has already said.** Much of what a first diagnosis finds is his own analysis from an earlier
  text (`docs/neuaufbau/plan.md` §0 is one). An echo is not a finding. Say "known since …" and move on.
- **Use his words for the system** (agent, constellation, edge, template, context pack, setup, succession; never "stone" for a pack, he finds it confusing) and name things by
  what they do for him. He will tell you when you are confusing; then stop explaining and ask yes-or-no questions, each
  with "yes means … / no means …".

## Facts, judgment, counter-check: three kinds of agents, in that order

- **Fact finders (cheaper model) per symptom**, judges (stronger model) on top, then an independent counter-check of your
  own diagnosis with the owner's own texts in its brief, then a critic over every idea. Each brief names the files, what
  done looks like, the evidence form (`file:line`, command → result, live state through `./ctl.sh get`), a word limit and
  a closing line "Not verified:". Statistics only for a size question; the owner's correction: understanding a system means reading its code.
- **Write a digest file first for every later round** (target picture in the owner's words, what he said today, standing
  decisions, what exists, the plan so far, the rules for ideas) and make every agent read it first. It is what makes a
  round coherent: agents that start from the same digest give findings that fit together, agents that start from your
  prompt alone give findings that contradict each other. *Trap:* the scratchpad dies with your session. Copy reports to
  `~/local-notes/<strand>/<date>/` and name the folder in your standing handover.
- **Verify the load-bearing claims yourself before they reach the owner.** One `sed -n` per claim, in one call. A report's
  summary is a claim until you have seen the line.
- **Hold every finding against the target picture both ways.** Does the dynamic pull toward it or away? Where the picture
  is silent on something that hurts daily, the silence is itself a finding.

## Working with his reactions

- **After his feedback, restate how you now read his concerns in relation to each other** before you run anything, and
  send that as an interim. He reads along live and corrects early; that saves a whole round.
- **Lead each version with what changed since the last and where you disagree**, with the reason. He wants your view, and
  he wants to see that his words landed.
- **Ask only the question that is due**, at the end. A decision he must make later (a right, a version to publish) goes
  into the plan as "needs his word when …", not into today's question.
- **When he says a package is basic and doesn't interest him**, keep it in the plan and stop explaining it. Put the ambition where
  he points: another round of ideas with the digest, a critic over them, a harvest with his answers written in.

## Use the system you are analysing

- **Helpers as seats where it matters.** Pane subagents win on cost and breadth; a Fleet seat wins for another model,
  other rights, an independent check or anything that must outlive you. A planning seat that runs a dozen helpers
  outside Fleet's constellation shows `GET /api/self/constellation` empty, and the owner notices: it is the very
  dynamic such a plan tends to describe. Decide per round and say which you chose.
- **Give your successor what you lacked** (`POST /api/self/einrichten` with the packs you had to go find) and give
  your children the context packs the task needs, not your whole luggage.

## Keep state as you go

- A work plan in your notebook with one status per step; the standing handover rewritten at every finished step; the
  handover point only after a finished step. Background agents end with your session: if one is close, wait; if not,
  write its brief into the handover so the successor can restart it.
- Commit the plan on your branch as soon as the owner says it fits in substance; send its path to the orchestrator only
  after that, and say in the message which questions are still open.

## Done

The owner says the plan fits and asks for the next round instead of deciphering the last one.
