# Making a pack

Read this before you write a context pack or change one. How to write any text for agents is
`docs/start/writing-for-agents.md`, and how a note becomes knowledge is the pack `how-fleet-remembers`. This covers
only what is particular to packs: when one is born, what goes in, how it is cut and registered, what the checks
demand, and whom it reaches.

A pack teaches how to do a kind of work: the orientation, conventions, standards, traps and tool choices of one
situation. It earns its place when it holds what an agent can't infer from its model and doesn't get from the
server. The model knows how to land a branch in general; it doesn't know that the land door here compares your
check against the entry's base and answers 409 otherwise. That sentence is pack material. "Run the tests before
you land" is not.

## When a pack is born

- **From use.** A lesson that came back, a correction the owner gave twice, or an idea the owner brought. One episode
  is a note, not a rule.
- **Ask of every sentence: would it be true on another Fleet?** Yes: it goes into the pack, which travels with a
  shared setup. No, but it holds for weeks (a host, an account, a demo that must stay up): it goes into the local
  binding, `~/local-notes/this-machine.md`, never into the repo, because tracked files carry no hostnames,
  addresses or names. No, and it changes by the hour (usage, what runs where): a script measures it, no text holds
  it.
- **A number that belongs to a setting stays out.** A threshold in a text goes stale silently and overrides the
  setting the owner sees and changes. Name where the setting lives instead.
- **What the server enforces stays out.** Nothing lands without a green check and nothing deploys over an unjudged
  red audit; a pack doesn't repeat that. It says what the door can't know: what to read before you knock, and what
  its answer means.
- **Other homes.** What something is and why it matters is a concept. A standing owner decision is an entry in the
  owner's corrections. A fact only you need stays in your notebook.

## What goes in

- **The moment to read it,** in the first line: "Read this before you land, deploy …". Name the role it is for.
- **Rules as a sentence with its reason,** half a sentence each: "Trigger a deploy once: the door answers 202 and
  the verdict comes with the next boot." The reason lets an agent judge a case the rule didn't foresee.
- **Traps with their trigger and their counter-probe.** What you see when you are in it, and the one read that
  tells you.
- **The check that ends the work,** so a finished report rests on an observed result, not on a plan.
- **Pointers, not pastes.** A route, a file and symbol, another pack. Fleet shows what every setup reads, with
  source and size, so a pointer costs little and stays current.
- **No incidents.** Dates and stories explain why a rule exists; they go into a measurement note under
  `docs/messungen/` that the pack can point to. A reader who starts a session reads the rule, not the history.
- **Every claim about the system checked** in the code or on a route before it goes in. The notes a pack grows out
  of are often months old and the code has moved since, so a claim holds only as you read it today.

## Shape and size

- One Markdown file in `docs/packs/`, in English, with one `#` title and short `##` sections built for scanning. The
  title line is the anchor the registry points to.
- A registered section runs from its anchor line to the next heading of the same or a higher level, subheadings
  included. So a pack anchored on its title is delivered whole, and a pack that lives as a `##` section of a
  larger document (`nachfolge-klug` in `docs/controller.md`) ends at that document's next `##`. Extend such a pack
  with `###` subsections under its anchor, and its registry entry follows.
- A start carries few packs and every line in it pulls attention; the five packs in the orchestrator's start are
  under 6 KB each. Where you have more to say, the rest waits behind a pointer, and the pack says when to go there.

## Registering it

The registry is `.fleet/context-packs.json`, one entry per pack. Copy a neighbour's entry (`setting-up-agents` for
a pack of its own file, `testinstanz-abnahme` for a section with a variant) and change what differs:

- `id`: lowercase and hyphens, the file's name.
- `useWhen`: one line of at most 120 characters, written as the moment to read, because it is the line a seat
  sees in its reading hints.
- `triggers`: when the plan selects the pack. `always` rides every lane and MAIN founding; `orchestration` comes
  with the founding of a MAIN; `landing` is the borrow before a land; `visible-surface` is read off a card whose
  surface names `src/` or `public/`; `measurement`, `rulebook-edit`, `jev-use` and `harness-selection` come from a
  card's text. `orchestrator-start` is reserved for the five packs of her start, which carries no other trigger.
- `sources`: `path` and `anchor` (the heading line; `context-sections.ts#sectionSpan` takes the line equal to it,
  else the line that starts with it, and refuses more than one as `source-anchor-ambiguous`, so write the whole
  line), an `id`, a `sorte` (`anleitung` for how-to, `wissen` for background) and `positions` per role: `box`
  comes with the start, `ausleihe` arrives as the useWhen line and is borrowed with `GET /api/self/context/<id>`
  when the moment comes.
- `hardness`: `hard` or `guidance`. It only labels the pointer ("Bindend" or "Hinweise"); it enforces nothing.
- `estimatedBytes`: the exact byte count of the cut section (`context-sections.ts#sourceSection`). One test pins its
  pack to the exact figure; set yours exact too, and set it again after every edit.
- The rest is vocabulary: `group`, `harnesses`, `modes`, `requiredCapabilities` (`tracked-source-read` for a
  tracked Markdown source), `evidence: tree-anchor`, `owner`, `status: active`.
- Optional anatomy: `varianten` give a role's variant its own Kern (`live-bau` today), and `zusaetze` add sources
  under a condition. A Zusatz may bring one MCP server (name, command, args); Claude applies it, the other
  harnesses don't yet, and no pack uses it so far.

## What the checks demand

- The validator refuses a source path that is not tracked. `git add` the new file before you run anything, or every
  plan check marks the pack `manifest-invalid` without saying why.
- The anchor must be present and unique in its file; a `useWhen` over 120 characters or with a line break is
  invalid; unknown keys and values are refused. The validator names the code, not the fix: read the code's name
  (`USE_WHEN_INVALID`, `SOURCE_ANCHOR_MISSING`, `SOURCE_PATH_MISSING`) and look up its rule in
  `context-pack-validator.ts`.
- Run before you commit: `bun e2e/pins.ts`, `bun e2e/context-plan.ts`, `bun e2e/context-packs.ts`, and
  `bun test server/fassung.test.ts server/pruefpraxis-pack.test.ts`. Then `bun ci/merge-check.ts <branch>`; the
  orchestrator lands. A red in a job your change can't have touched: run that test on your branch and on main
  before you blame the change.
- No real hostname, address, name or token in the file. The `leak-pin` lines of `bun e2e/pins.ts` catch addresses
  and the configured hosts. Names they can't know: the local grep for them is in `rulebook/deploy.md`, the
  gitignored source `CLAUDE.md` is rendered from, and it must come back empty.

## Whom it reaches

- A pack only helps where it is loaded. Registered pointers reach lane and MAIN foundings through their triggers.
  The orchestrator's start loads exactly five packs (`server/orchestrator-start.ts`); any other pack reaches her
  only through a line under "Read when you need it" in her role, which is the owner's text. Propose that line in
  your report, as one sentence that names the moment and the path.
- A pointer is read less than you think. Measured in October for one pack: Claude lanes didn't open it as a
  pointer, Codex lanes mostly did (`docs/messungen/2026-10-08-pack-zeiger-gelesen.md`). If the work can't go well
  without it, give it `box` for that role, or name it in the brief.
- Give it one cold read before it goes into a start (`writing-for-agents`, principle 10): a fresh agent says its
  goal in one sentence, its first three acts, where it stumbled and what is missing. What it stumbles over is the
  result.
- Whether a pack helps shows only across runs that end in a check. A with-and-without comparison (same task, fresh
  sessions, only the pack varies) is the way to know; until one has run, say the benefit is unproven rather than
  claim it.

## When it grows out of notes

- Write a table beside the pack, note by note: the sentence that now carries it, or the reason it is stale. That
  table is what makes deleting the notes safe. Keep the incidents there as dates.
- Judge each note as it reads today, against the code, not against the plan that listed it. Parts that are
  overtaken are named and not carried.
- A note that holds a host, an account or a demo goes into the local binding, not the pack.

## Before you hand it back

Branch tip, merge-check exit code, the pack's size in bytes, the registry entry's roles and triggers with one
sentence why, the proposed role line, and one sentence on what was missing from your start.
