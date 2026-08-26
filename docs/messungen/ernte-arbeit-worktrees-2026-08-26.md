# Ernte der 15 ARBEIT-Worktrees — 2026-08-26

Folgeakt zu `docs/messungen/hygiene-report-2026-08-25.md` §A. Gemessen und geerntet von Lane
`fleet/260826112129-ec93` gegen main `28e6f3f`. **Diese Lane hat nichts gelöscht** — kein
`worktree remove`, kein `branch -D`. Verwerfen ist Owner-Sache; hier stehen die Belege und die
fertigen Kommandos.

Methode je Branch: `git cherry main <branch>` (Patch-Äquivalenz — schon Gelandetes fällt heraus),
Diff gelesen, überlebende Doc-Commits per `git cherry-pick -x` in diesen Branch geholt. Die
`-x`-Zeile jedes Commits nennt den Quell-Hash, die Provenienz ist also im Log nachlesbar.

## Verdikt-Tabelle

| Branch | Commits (patch-echt) | Verdikt | Beleg |
|---|---|---|---|
| `fleet/260821211509-0be7` | 2 docs(auftragsmarkt) | **geerntet-hier** | `docs/auftragsmarkt-integration-2026-08-21.md` (476 Z., neu) |
| `fleet/260823095659-c1f5` | 1 docs(wta-1) | **geerntet-hier** | `docs/worktrail-contracts-a/{act1-analysis.md,sample.v1.json}` (1931 Z., neu) |
| `fleet/260823111940-b6a6` | 3 docs(messungen) | **geerntet-hier** | `docs/messungen/2026-08-23-studio-autonomy-causal-audit-fable.md` (396 Z., neu) |
| `fleet/260823111941-e426` | 3 docs(messungen) | **geerntet-hier** | `docs/messungen/2026-08-23-studio-autonomy-causal-audit-glm.md` (431 Z., neu) |
| `fleet/260823124303-98b6` | 1 docs(worktrail-B) | **geerntet-hier** | `docs/worktrail-B/B2-opus-audit-2026-08-23.md` (354 Z., neu) |
| `fleet/260823135537-a33a` | 1 docs(worktrail-III) | **geerntet-hier** | `docs/worktrail-audit-III/private-repo-k.md` (555 Z., neu) |
| `fleet/260823151620-c4cd` | 1 docs(worktrail-III) | **geerntet-hier** | `docs/worktrail-audit-III/tower-grossfehler-glm.md` (376 Z., neu) |
| `fleet/260823152423-fb4e` | 1 docs(audit) | **geerntet-hier** | `docs/worktrail-audit-III/tower-grossfehler-ox.md` (228 Z., neu) |
| `fleet/260823154740-7f2d` | 2 docs(studio) | **geerntet-hier + reconciled** | `docs/product-studio-working-circle.md`, einzige Kollision — siehe §1 |
| `fleet/260823175022-e9f8` | 1 docs(ios) | **geerntet-hier** | `docs/private-repo-p-sol-research-2026-08-23.md` (523 Z., neu) |
| `fleet/260824041324-e2ff` | 1 docs(messungen) | **geerntet-hier** | `docs/messungen/2026-08-24-authority-critic.md` (177 Z., neu) |
| `glm-gamedev-harness-research` | 1 docs(gamedev) | **geerntet-hier, Pfad korrigiert** | `briefs/grok-gamedev-pi-harness.md` — siehe §2 |
| `fleet/260822143207-d70d` | 1 AGENTS.md | **lebt — Owner-Entscheid (Promotion nötig)** | Fußnote 1 des Hygiene-Reports ist WIDERLEGT — siehe §3 |
| `fleet/260823124447-a0e9` | 7 (Rail) | **teilweise abgelöst — NICHT verwerfbar** | ein Commit undisplaced, ein Beleg falsch — siehe §4 |
| `fleet/260823144541-f753` | 8 (Rail) | **teilweise abgelöst — NICHT verwerfbar** | Obermenge von a0e9 — siehe §4 |
| `fleet/260822183548-25e2` | 1 feat(acp-26) CODE | **abgelöst-mit-Beleg** | in main als `d0fa215` — siehe §5 |

**Bilanz: 12 Branches geerntet · 1 abgelöst-mit-Beleg (verwerfbar) · 3 Owner-Entscheid
(nicht verwerfbar).**

## §1 Die einzige Doc-Kollision: `docs/product-studio-working-circle.md` (7f2d)

Von den 13 Zieldateien existierte genau eine schon in main. Beide 7f2d-Commits (`3f412f4`,
`2a1dd45`, 2026-08-23) mergten **textuell konfliktfrei** — und hätten damit still vier Sätze
regressiert, die main am selben Tag mit `b861b9a` ("fold the 2026-08-23 owner strictness review
into the profile") ausdrücklich aufgehoben hatte. Der gefährliche Fall: kein Konfliktmarker, keine
Warnung, nur eine leise zurückgedrehte Owner-Korrektur.

Die vier Stellen und ihre Auflösung (Commit `77704fa`):

1. Wahrheitstabelle "an owner promotion (or a recorded waiver)" → Promotionsakt, MAIN-eigen unter
   Klausel 1, Owner nur an Klausel 7s Grenzen.
2. Schritt 1 "If the owner has not promoted one, the MAIN records an explicit waiver" → Klausel 1:
   der MAIN promotet den reversiblen Arbeitsanker selbst, mit Provenienz und Reopen-Trigger. Die
   Waiver-Form entfällt damit durchgängig (Schritt 6, Rail, Falsifikator 5, Kalibrier-Liste)
   zugunsten des Reopen-Triggers.
3. Schritt 4 "At most two builder rounds … der MAIN öffnet keine dritte Runde" → Klausel 2 verbietet
   genau diesen Satz wörtlich: *"There is no 'at most two repairs'."* Ersetzt durch das
   Fortschrittsbudget (Abbruch bei no-progress, cycling, Grenzdruck — nie an einer Zahl).
4. "What this section does not change" führte "owner promotion" als stehend → der
   Sieben-Grenzen-Vertrag ist das Stehende; der Abschnitt ist ihm untergeordnet.

Dazu zwei Verweise auf `AGENTS.md` "clause C" auf Klausel 7 gezogen, weil der Autoritätsvertrag
inzwischen im selben Dokument steht.

**Nebenbefund:** die Ernte schließt eine hängende Vorwärtsreferenz in main. `b861b9a` schreibt
"The `ownerPlaytest` separation and the one-step launch are preserved unchanged" — beides existierte
in main nicht; die Begriffe kamen erst mit diesem Abschnitt. `grep -n 'ownerPlaytest'` auf
`main:docs/product-studio-working-circle.md` lieferte genau einen Treffer: diesen Verweis selbst.

## §2 Warum eine Datei nicht unter `docs/` liegt

`glm-gamedev-harness-research@6d73c0f` legte den Grok-Brief als `PROMPT-GROK-GAMEDEV-PI-HARNESS.md`
ins **Repo-Wurzelverzeichnis**. main hält dort ausschließlich Vertragsdateien (`AGENTS.md`,
`HANDOFF.md`, `INTAKE.md`, `README.md`, `SHARING.md`, `SYSTEM.md`); alle sieben bestehenden
Grok-Briefs liegen unter `briefs/`. Geerntet wurde er deshalb als `briefs/grok-gamedev-pi-harness.md`
— Inhalt unverändert, nur der Pfad folgt der getrackten Konvention.

Das ist die einzige Abweichung von "nur `docs/`", und sie ändert die Beweislage nicht:
`verify-proportion.ts:44` nennt `briefs/` ausdrücklich neben `docs/`, beide klassifizieren als
`docs-or-prose`. Ein Wurzel-`.md` hätte übrigens dieselbe Klassifikation getroffen — die
Pfadwahl ist Konvention, nicht Beweisketten-Frage.

## §3 Gegenprobe d70d: die Lane-Formulierung ist NICHT abgelöst

Hygiene-Report Fußnote 1 vermutete: *"Konzept ist in heutigem main enthalten ('Monitoring is event-
or terminal-driven'), die exakte Formulierung der Lane nicht — vermutlich abgelöst."* Das Zitatpaar
widerlegt die Vermutung.

**main `AGENTS.md` (die vorhandene Fassung):**

> Monitoring is event- or terminal-driven. A Controller delegates observation to the bound
> Supervisor when a typed notification route exists; the Supervisor returns only the requested
> state transition, an exception requiring action, or a predeclared deadline. Otherwise use one
> long-lived quiet wait outside the transcript. Never replace a missing route with tmux injection,
> and never stream repeated pane, process, trail, or API snapshots into model context.

**Lane d70d `cb26c00` (die vorgeschlagene Fassung):**

> Waiting is event-driven. After you start a run that proceeds without you (a worker, a process,
> a build), one check is allowed: that the intended run accepted the work. If a reliable watch,
> notification, or wait mechanism exists for the awaited state, arm exactly one such return path
> and do not sample that state again until it fires; when it fires, read the evidence it names,
> not the whole surface. Sample the state yourself only when no return path exists or its defect
> is under investigation; then name the cadence and the stop line, and report `unknown` for every
> unobserved interval.

Sie sind nicht dieselbe Regel — schon der Geltungsbereich nicht. main regelt den **Modus
"monitoring"** und die Delegation Controller→Supervisor. d70d regelt **jede Session, die einen
Lauf gestartet hat, der ohne sie weiterläuft**. Fünf operative Bestandteile hat d70d, die main
nirgends trägt:

1. **Die eine erlaubte Prüfung** ("that the intended run accepted the work"). main kennt keine
   Annahmeprüfung — es sagt, wer beobachtet, nicht, was der Startende selbst noch nachsehen darf.
2. **"arm exactly one such return path"** — die Zahl. main sagt "delegiert, wenn eine Route
   existiert", nie *genau eine*.
3. **"do not sample that state again until it fires"** — das ausdrückliche Nachfrage-Verbot bis
   zum Feuern.
4. **"read the evidence it names, not the whole surface"** — was beim Feuern gelesen wird. In main
   nicht vorhanden; genau die Stelle, an der eine Session sonst wieder die ganze Pane liest.
5. **Die benannte Ausnahme** "or its defect is under investigation" plus "name the cadence and the
   stop line". mains "Otherwise use one long-lived quiet wait" deckt den Fall *keine Route* ab,
   aber nicht den Fall *die Route selbst ist der Untersuchungsgegenstand* — ohne diese Klausel
   verbietet die Regel das Debuggen des eigenen Watch-Mechanismus.

Umgekehrt trägt main drei Dinge, die d70d nicht hat (die Supervisor-Rückgabearten, das
tmux-Injektions-Verbot, das Snapshot-Streaming-Verbot). Die beiden Absätze ergänzen sich; keiner
ersetzt den anderen.

**Trotzdem nicht mitgenommen — und das ist Absicht.** `AGENTS.md` ist der portable Vertrag, und
er regelt seine eigene Änderung: *"Workers may **propose** findings, briefs, rules, skills, or
retirement; only the owner may **promote** a binding version."* Eine harte Invariante in den
Vertrag zu schreiben ist eine Promotion, keine Ernte. Der Text steht oben vollständig zitiert und
ist damit vorgeschlagen; `fleet/260822143207-d70d` bleibt bis zum Owner-Entscheid stehen.
Verwirft der Owner den Vorschlag, ist der Branch danach verwerfbar — der Wortlaut ist dann in
diesem Dokument konserviert.

## §4 Ablöse-Verifikation a0e9 + f753: drei von vier Belegen halten, der vierte nicht

Beide Branches tragen dieselben sieben Commits; `f753` hat einen achten (`e03e782`) obendrauf.

Die vier Belege aus Fußnote 4, einzeln geprüft:

| Beleg | Behauptung | Prüfung | Ergebnis |
|---|---|---|---|
| `e730694` | Repo-Cap | `git merge-base --is-ancestor e730694 main` = 0; Subject identisch zu Lane-`c04fdef` | **hält** |
| `d93ab4a` | return-path | in main; "program binding outranks watcher evidence" = Lane-`85972e7` | **hält** |
| `6a12838` | abgeleitete Phase | in main; "derived Phase projection" = Lane-`deaf03d` | **hält** |
| `3233ba7` | Self-Land-Tür | in main; "Progress-Guard statt Deckel" = Lane-`fabad73` | **hält** |
| `rg -uu 'FLEET_SELF_LAND_MAX_ATTEMPTS'` ist leer | Attempt-Cap kommt in main nicht mehr vor | **falsch** | siehe unten |

**Der vierte Beleg stimmt nicht wie geschrieben.** `rg -uu` liefert drei Treffer in main:

- `docs/program-transitions-brief-2026-08-23.md:61`
- `docs/promotion-policy-v1-2026-08-23.md:73`
- `docs/messungen/hygiene-report-2026-08-25.md:65` (der Report zitiert sich hier selbst)

Der gemeinte Sachverhalt hält trotzdem, nur enger: **im Code** ist der Name weg
(`git grep FLEET_SELF_LAND_MAX_ATTEMPTS main -- '*.ts' '*.sh' '*.json' '*.html'` = leer), ersetzt
durch den Progress-Guard (`main:server.ts` — `no progress since the last verdict — repair or
escalate`). Zwei Design-Docs in main nennen den Deckel weiter als lebende Prosa; das ist eine
eigene, hier nur gemeldete Doc-Drift.

**Der Grund, warum beide Branches NICHT verwerfbar sind, ist ein anderer.** Die vier Belege decken
vier der sieben Rail-Commits ab. Ein fünfter ist **undisplaced lebender Code**:

`3600618 feat(attention): getypte MAIN-Meilensteine playable-ready + incident, und die
Self-API-Referenz` — 6 Dateien, +310/−4 (`server.ts`, `src/client.ts`, `public/index.html`,
`e2e/pins.ts`, `e2e/programs.ts`, `docs/self-api.md` +153 Z.).

Gegenprobe in main:

    main:server.ts:1559: type AttentionKind = "decision" | "blocked" | "review-ready";

Die Lane-Fassung: `"decision" | "blocked" | "review-ready" | "playable-ready" | "incident"`.
`git grep 'playable-ready' main -- '*.ts'` ist leer, ebenso `incident` als Attention-Kind. Die
typisierten Meilensteine existieren in main nicht — weder Route, noch Client, noch Pin, noch
Doku-Abschnitt.

Die verbleibenden zwei bzw. drei Commits (`937abfa`, `ec3bb33`, `e03e782`) sind e2e-Fixes; `ec3bb33`
("der Versuchs-Deckel muss JEDEN Restart des Blocks begleiten") zielt auf das abgelöste
Cap-Design und stirbt mit ihm. `e03e782` ("der Milestone-Block lag HINTER dem Teardown, der seine
eigene Credential tötet") gehört zu `3600618` und lebt mit ihm.

**Verdikt: NICHT "nachweislich abgelöst, verwerfbar".** `f753` ist die Obermenge (`a0e9` + ein
e2e-Fix) und damit der einzige der beiden, den man für `3600618` noch braucht. Auftragsgemäß nicht
gemergt — es ist Code, und der Dispatch-Entscheid gehört dem Owner.

## §5 Sichtung 25e2: abgelöst

`3c3474c feat(acp-26): Composer-Rollback nach einem ehrlich nicht beobachteten Submit` (6 Dateien,
+279/−24) ist in main gelandet — als `d0fa215 fix(events): roll back only Fleet exact composer
payload`, auf `135ea83` (ACP-25) aufsetzend. Belege:

- `main:composer.ts` existiert mit `composerRows` (:63) und `composerHoldsExactly` (:110) —
  genau den beiden Lesern, die der Lane-Commit einführt.
- `main:server.ts:5143` trägt die `ComposerRollback`-Union mit denselben sieben Werten; zwei
  heißen anders und ehrlicher: `kept:occupant-changed` → `kept:identity-changed`,
  `kept:agent-gone` → `kept:agent-unobservable`.
- `main:server.ts:5183 rollbackOwnComposerPayload` ist die umbenannte `rollbackComposer`, samt
  der Einschränkung aus dem Lane-Body ("Rollback belongs only to a caller that marks the text as
  Fleet-owned", :5177).
- `main:docs/harness-adapter.md:223–261` trägt den §composer-Abschnitt inkl. der
  Adapter-Entscheidungen (claude/codex/pi apply, ohne Deklaration `not-applicable`).
- `main:e2e/watch.ts` importiert die drei Leser und fährt die Frame-Pins (:305–340).

**Verdikt: abgelöst** — die Mechanik steht vollständig in main, unter anderen Funktionsnamen und mit
zwei präziser benannten Union-Werten. Nichts zu cherry-picken.

Nicht abgedeckt und weiterhin offen (der Lane-Commit meldet es selbst als "Nicht gefixt,
gemeldet"): der `$`-Popup-Auslöser im Event-Text selbst (`laneWatchMessage`/`fleetReportMessage`)
— `$FLEET_SELF_TOKEN` im Text öffnet in Codex die Mention-Liste, die das Enter frisst. Eigener
Schnitt, nicht Teil dieser Ernte.

## Für den Owner — Kommandos je verwerfbarer Zeile

**Verwerfbar nach dieser Ernte (12 geerntete + 1 abgelöste).** Erst ausführen, wenn dieser Branch
gelandet ist; die Commits liegen dann in main. Vorher `tmux -L claudefleet list-panes -a`
gegenprüfen, dass kein Slot in einem der Worktrees läuft.

```sh
cd /Users/owner/claude-fleet
# geerntet — Inhalt ist nach dem Land dieses Branches in main:
git worktree remove ../claude-fleet.worktrees/fleet-260821211509-0be7 && git branch -D fleet/260821211509-0be7
git worktree remove ../claude-fleet.worktrees/fleet-260823095659-c1f5 && git branch -D fleet/260823095659-c1f5
git worktree remove ../claude-fleet.worktrees/fleet-260823111940-b6a6 && git branch -D fleet/260823111940-b6a6
git worktree remove ../claude-fleet.worktrees/fleet-260823111941-e426 && git branch -D fleet/260823111941-e426
git worktree remove ../claude-fleet.worktrees/fleet-260823151620-c4cd && git branch -D fleet/260823151620-c4cd
git worktree remove ../claude-fleet.worktrees/fleet-260823152423-fb4e && git branch -D fleet/260823152423-fb4e
git worktree remove ../claude-fleet.worktrees/glm-gamedev-harness-research && git branch -D glm-gamedev-harness-research
# abgeloest, Beleg §5 (Code steht als d0fa215 in main):
git worktree remove ../claude-fleet.worktrees/fleet-260822183548-25e2 && git branch -D fleet/260822183548-25e2
# geerntet, aber .agents/-Duplikat untracked -> --force noetig (Hygiene-Report Fussnote 3):
git worktree remove --force ../claude-fleet.worktrees/fleet-260823124303-98b6 && git branch -D fleet/260823124303-98b6
git worktree remove --force ../claude-fleet.worktrees/fleet-260823135537-a33a && git branch -D fleet/260823135537-a33a
git worktree remove --force ../claude-fleet.worktrees/fleet-260823154740-7f2d && git branch -D fleet/260823154740-7f2d
git worktree remove --force ../claude-fleet.worktrees/fleet-260823175022-e9f8 && git branch -D fleet/260823175022-e9f8
git worktree remove ../claude-fleet.worktrees/fleet-260824041324-e2ff && git branch -D fleet/260824041324-e2ff
```

**NICHT verwerfen — Owner-Entscheid offen:**

| Branch | Warum er stehen bleibt | Was den Entscheid auslöst |
|---|---|---|
| `fleet/260822143207-d70d` | Regeländerung an `AGENTS.md`, nur der Owner promotet (§3) | Promotion oder Verwerfen des zitierten Absatzes |
| `fleet/260823124447-a0e9` | enthält `3600618` (typisierte Meilensteine), in main nicht vorhanden (§4) | Dispatch oder Verwerfen |
| `fleet/260823144541-f753` | Obermenge von a0e9, plus `e03e782` zum selben Block (§4) | dito — dies ist der vollständigere der beiden |

Verwirft der Owner den d70d-Vorschlag, gilt für dessen Worktree derselbe `remove`/`branch -D`;
sein Wortlaut ist in §3 konserviert.

## Grenzen dieser Messung

- Geprüft wurde **Patch-Äquivalenz und Inhalt**, nicht, ob jeder geerntete Text heute noch stimmt.
  Die zwölf Doc-Ernten sind datierte Audits und Messungen; sie sind als Momentaufnahmen ihres Tages
  zu lesen, nicht als Gegenwartsprosa. Einzige Ausnahme ist
  `docs/product-studio-working-circle.md` — normative Gegenwartsprosa, deshalb §1.
- Die `.agents/`-Einstufung (untracked, byte-identische Duplikate) ist aus Fußnote 3 des
  Hygiene-Reports übernommen und **nicht neu gemessen**; die `--force`-Zeilen oben stützen sich
  darauf. Seit `93182c6` ist `.agents/` ohnehin gitignored.
- Die Worktrees selbst wurden nicht betreten — alles gelesen über `git log/show/diff/cherry` aus
  der geteilten Object-DB.
- `docs/program-transitions-brief-2026-08-23.md` und `docs/promotion-policy-v1-2026-08-23.md`
  nennen den abgeschafften `FLEET_SELF_LAND_MAX_ATTEMPTS` weiter als lebende Prosa (§4). Nur
  gemeldet, außerhalb des Ernte-Auftrags.
