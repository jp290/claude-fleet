# Recovered task queue — snapshot 2026-07-28 08:49 (Time Machine), deleted 09:45

Source: `/Volumes/Owner's Mac's BackUp's/2026-07-28-090618.previous/Macintosh HD - Data~/claude-fleet/fleet.json`


---

## `e361058f` — pending / steward / created 2026-07-25 22:04

```
[steward-brief] Lane: root-cause + proper fix for the land/rebase machinery mislabeling a CLEAN rebase as a "resolved conflict"

THIS IS AN INVESTIGATION + FIX-PROPOSAL LANE. Land NOTHING to real main. Do not touch the live server (defaults = live socket/port — CLAUDE.md forbids it).

THE OBSERVED SYMPTOM (real, captured 2026-07-25 from the running server):
Slot 7 lane `fleet/260725170807-e5dd` is a DOC-ONLY lane (adds docs/security-review-2026-07-25.md + one docs/README.md catalog line). A sibling lane (ac4b) landed first, advancing main. When the owner ran ⏫ merge on e5dd, its stored merge verdict became:
  status: "resolved"
  detail: "agent answer was not the JSON contract: Rebase completed cleanly with no conflicts.\n\n{\"status\": \"rebased\", \"detail\": \"Ran `git rebase main`; it completed automatically with no conflicts (the lane's single docs commit e99f36d touched only do — resolved the conflicts; review the diff, then land."
  conflicted: []
The rebase ACTUALLY SUCCEEDED (e5dd HEAD is now parented on ac4b's commit 95b544a, clean tree). But because the agent returned PROSE + malformed/truncated JSON instead of the strict contract, Fleet fell back to status "resolved" — treating a clean rebase as an agent-resolved conflict awaiting review. The lane will not land through the normal ⏫→⏏ flow. Compounded: main advanced again (95b544a → 4913ac9) so the lane is `behind` once more and each land retry re-invokes the same flaky agent path.

THE ROOT-CAUSE HYPOTHESIS TO CONFIRM OR REFUTE (do not assume — verify against the code):
A deterministically-checkable fact — "`git rebase main` exited 0, tree clean, main is now an ancestor of the branch" — is being classified via the LLM merge-agent's free-text/JSON self-report. That violates the codebase's own facts-outrank-claims / deterministic-over-LLM doctrine (docs/verification.md, docs/steward-intelligence.md §8). A clean rebase should be detected DETERMINISTICALLY and marked "rebased" with NO agent parse; the agent (runMerge) should be consulted ONLY when `git rebase` actually leaves conflicts.

ENVIRONMENT (read before editing):
- server.ts: the rebase attempt (grep `"rebase", main` — ~3067 and ~5204), `runMerge` (~3074), the sibling `runRebase`/clean-review analog (~3115), `mergeJob` (grep `mergeJob`), the agent-output JSON-contract parse (grep `summaryViaSubprocess` / the `{status,detail}` parse and the "not the JSON contract" fallback string), `advanceIntegration` (~984-996, ff-only — grep `not a fast-forward`), and the land / confirm-land endpoint (~5150-5275, esp. the `body?.confirm` path ~5191-5246 and the "resolved awaits review" guard ~5261-5266).
- Existing design context — READ FIRST so you extend, not reinvent: docs/merge-review-autonomy.md, docs/autonomy-plan.md, and any land-hardening notes. Known RETIRED ideas (do NOT re-propose): git rerere, and a hard-block gate.
- e2e: the merge checks live in e2e/merge.ts (runner fleet-e2e.ts, harness e2e/harness.ts). MERGE_CMD is stubbable via FLEET_MERGE_CMD (a subprocess stand-in) — the isolated suite already uses fake merge/verify commands.

DONE-CRITERION (one sentence + its verification): a root-cause writeup (docs/, e.g. append to merge-review-autonomy.md or a new note) that CONFIRMS-or-REFUTES the hypothesis with cited code sites, PLUS a proposed fix that makes a clean rebase classify as "rebased" deterministically (agent consulted only on real conflicts) and handles the moving-target case (main advancing between resolve and land) without an agent loop — PROVEN by: `bunx tsc …` clean, `bun run build`, `./e2e-isolated.sh` tail "ALL PASS", `./e2e-claude-gate.sh`, PLUS a NEW e2e check in e2e/merge.ts that reproduces the bug and pins the fix: (a) a sibling-landed lane whose `git rebase main` is clean → verdict "rebased" (NOT "resolved") and lands via ff; (b) the merge-agent returning non-contract prose on a clean rebase → still deterministically classified "rebased", never "resolved".

SILENT COMPLEMENT (reason internally; do not emit):
- The rebase-vs-merge asymmetry: `git merge-tree` (3-way) auto-resolves the README append while `git rebase` replays the patch with context and can conflict — so "the merge was clean" does NOT imply "the rebase is clean". Establish which operation Fleet actually gates on and why.
- The moving-target problem: main advancing under a resolved lane forces re-rebase (confirm-land path ~5202-5213). The fix must not send the owner into an agent re-run loop for a deterministically-clean re-rebase.
- The never-eat-work invariant is sacred: whatever you change, land must still refuse to lose commits/dirty work (advanceIntegration ff-only + removeWorktreeSafe). Do not weaken it to make landing easier.
- Contract fragility is the surface bug; the DEEP fix is not "make the agent's JSON more robust" but "don't ask the agent about a fact git already answers." Prefer the deterministic classifier.
- Knowledge maintenance (CLAUDE.md): structural server.ts changes pull the affected claims in docs/operating-model.md ("Land") + docs/merge-review-autonomy.md into the SAME lane.

OUTPUT CONTRACT: the root-cause writeup + the proposed fix (diff or a crisp design if the fix is large) + one line on anything unresolved. A proposal the owner reviews is a complete deliverable — do NOT land it.
```

---

## `6e4baf6d` — pending / steward / created 2026-07-25 23:38

```
[steward-brief] Lane: helpedGitSince scores a foreign land as a main-session nudge's effect — fix the instrument before anything feeds on it

TASK
A steward send to a NON-lane slot whose cwd is an integration checkout (slot 8 = ~/claude-fleet, main) is outcome-measured by helpedGitSince (server.ts) counting rev-list baselineHead..HEAD in that cwd. But every lane land ff-merges main IN THAT REPO, so a land by anyone advances the slot's HEAD and the nudge scores `helped` although the session did nothing. The tally this pollutes (outcomeTally -> promotionEligible) is exactly what nudge graduation reads (graduation-criteria.md §4). Fix: for non-worktree slots, exclude commits that carry a server-authored land note (refs/notes/fleet/land, grep writeLand/`notes` in server.ts) from the helped count — or, if you can show that is unreliable, make helpedGit abstain (never count) for slots whose cwd is a repoBase, falling back to the output signal. Evidence direction is the doctrine: a confounded signal must read as noEffect, never as helped (unknown ≠ zero).

KNOWN ASYMMETRY to fix or explicitly document in the same move: the A2 control ring (measureControls) scores controls by `gi.ahead > aheadBaseline`, which is permanently false for main slots (ahead=0 by construction) while the nudged path uses the sha cursor — nudged and control arms currently measure different signals on the same slot class.

ENVIRONMENT
- server.ts: helpedGitSince, measureOutcomes, measureControls, the gitBaseline park in handleStewardSend.
- e2e/steward-outcomes.ts is your check family (insert next to related checks, never at EOF; e2e/harness.ts has the plumbing). Sibling lanes may be touching stewardSlotsView and renderStewardMessage — stay out of both.

DONE means: a new check in e2e/steward-outcomes.ts proving a commit bearing a fleet/land note in the slot's cwd does NOT flip the outcome to helped (and one proving a genuine own-commit still does), red against old code; then the Verify line in this worktree's CLAUDE.md, tail ALL PASS. Commit; no untracked files. Report: summary + quoted verification + one line on anything unresolved.
```

---

## `27b97958` — queued / owner / created 2026-07-25 23:43

```
[P1-Security] MERGE_TOOLS-Agenten behalten die MCP-Connectors des Owners — --strict-mcp-config fehlt

BEFUND (2026-07-25, Folgebefund aus der SEC-2-Lane, dort als Kandidat gemeldet, NICHT verifiziert — das ist dein erster Job): --setting-sources "" schneidet die settings.json des Owners ab, aber MCP-Connectors leben in ~/.claude.json, nicht in settings. Die drei MERGE_TOOLS-Agenten (Merge-Resolver, Repair-Loop, ②-Clean-Reviewer — grep MERGE_TOOLS) koennten also weiterhin die MCP-Werkzeuge des Owners erreichen. Die fuenf Text-only-Agenten sind ueber --strict-mcp-config bereits abgedeckt (grep TEXT_ONLY_TOOLS).

WARUM DAS SCHWERER WIEGT ALS DER DATEI-LESE-BEFUND: die verbundenen Connectors sind Gmail, Google Drive, Google Calendar, Figma und Playwright. Und der ②-Reviewer laeuft auf dem UNBEAUFSICHTIGTEN Auto-Land-Pfad (FLEET_CLEAN_REVIEW=shadow ist live). Ein per Prompt-Injection irregefuehrter Reviewer mit Mail-Zugriff ist eine andere Groessenordnung als einer, der Dateien liest.

AUFTRAG:
1. VERIFIZIERE ZUERST empirisch, ob das Loch existiert. Nicht fixen, was nicht offen ist. Spawn ein claude mit exakt der MERGE_TOOLS-Flagkombination und lass es einen MCP-Aufruf VERSUCHEN. Entscheidend, und die SEC-2-Lane ist genau darueber gestolpert: eine Modell-Weigerung ("ich mache das nicht") ist KEIN Beweis. Nur eine mechanische Verweigerung des Harness zaehlt, woertlich zitiert. Wenn kein Loch existiert: melde das mit Beleg und aendere NICHTS.
2. Falls offen: --strict-mcp-config zu MERGE_TOOLS hinzufuegen, in derselben Form wie bei TEXT_ONLY_TOOLS.
3. Positivkontrolle danach: der Resolver muss weiterhin im cwd lesen/schreiben und git-Kommandos ausfuehren koennen — sonst hast du den Land-Pfad kaputtgemacht statt ihn zu verengen.
Nebenbei, als Ein-Zeilen-Meldung (nicht fixen, ausser es kostet nichts): claude warnt bei jedem MERGE_TOOLS-Spawn, dass "Write(**)" von der Dateiberechtigungspruefung gar nicht erfasst wird — die Zeile ist tot, Edit(**) deckt es ab.
Commit: "fix(security): drop the owner MCP connectors from the merge-path agents"

VERIFIKATION: bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts · bun run build · ./e2e-isolated.sh (Tail MUSS "ALL PASS") · ./e2e-claude-gate.sh (ALL PASS).
ACHTUNG zur e2e-Bewertung: gemessen am 2026-07-25 ist ./e2e-isolated.sh unter Maschinenlast NICHT deterministisch — ein Lauf fiel mit 3/759 auf einem Baum mit null Code-Aenderungen, der davor und danach gruen war. Ein Fail zaehlt trotzdem als DEINER, ausser du beweist ihn als Flake: gleicher Check, frischer HEAD-Worktree, Transcript in den Report. Rate nicht "ist bestimmt der Flake".
Keine untracked Reste. NICHT selbst landen. Keine Refactorings ausserhalb des Scopes.
OUTPUT: Diff, Verifikations-Ausgaben, eine Zeile zu Ungeloestem.
```

---

## `733e1c3b` — queued / owner / created 2026-07-25 23:43

```
[P1-Perception] done-looking ist bei zwei von sechs Klauseln PERMISSIV, und lastOutput:0 waescht ein Unbekannt in einen bekannten Extremwert

BEFUND (2026-07-25, aus docs/state-reality-divergence.md; nachpruefen, nicht glauben): lane-signals.ts behauptet im Kopfkommentar, jede Klausel sei ein Negationstest und ein unbekannter Fakt lese nie als "fertig". Fuer zwei Klauseln stimmt das nicht:
  { prose: "no git op in progress", holds: (v) => v.gitOp !== true }   -> bei gitOp === null WAHR
  { prose: "no blocked/errored merge", holds: (v) => !MERGE_BLOCKING.includes(v.merge?.status ?? "") }  -> bei merge === null WAHR
Beide lesen ein Unbekannt als "in Ordnung". Und eine Ebene hoeher setzt killSlot lastOutput auf 0, wodurch idleMs zu einem riesigen BEKANNTEN Wert wird, statt null zu bleiben — die Null-Tests koennen dann gar nicht mehr greifen.

KOSTEN: laneDoneLooking triggert auto-③ heute schon von selbst, und es ist der naheliegende Trigger fuer jede kuenftige Automatik. Ein Praedikat, dessen Kommentar strenger ist als sein Code, ist die gefaehrlichste Sorte: es wird gelesen und geglaubt. In dieser Session ist genau das passiert — der Orchestrator hat die Behauptung aus dem Kommentar uebernommen und weitergegeben.

AUFTRAG:
1. Reproduziere beide Permissivitaeten als Test (die Praedikatsfunktion ist rein — das ist ein billiger, exakter Unit-Test, kein e2e).
2. Entscheide begruendet: Klauseln streng machen (gitOp === false, merge !== null && ...) ODER den Kommentar an den Code angleichen. Streng ist die sichere Richtung, ABER pruefe zuerst, ob gitOp/merge im Normalbetrieb ueberhaupt jemals null sind — wenn ja, wuerde "streng" done-looking dauerhaft ausschalten und auto-③ stillegen. Miss das an echten Daten (GET /api/sessions), rate es nicht. Wenn die strenge Variante das Feature abschaltet, ist die richtige Antwort eine dritte: die Fakten verfuegbar machen statt das Praedikat zu verbiegen. Begruende deine Wahl im Report.
3. lastOutput:0 getrennt behandeln: ein Slot ohne je gesehene Ausgabe muss idleMs=null liefern, nicht "unendlich lange idle". Pruef, wo das gerechnet wird, und ob eine Aenderung andere Konsumenten trifft.
4. Der Kopfkommentar von lane-signals.ts MUSS am Ende die Wahrheit sagen — er ist der Grund, warum der Fehler geglaubt wurde.
Commit: "fix(perception): done-looking must not read an unknown fact as permission"

VERIFIKATION: bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts · bun run build · ./e2e-isolated.sh (Tail MUSS "ALL PASS") · ./e2e-claude-gate.sh (ALL PASS).
ACHTUNG zur e2e-Bewertung: gemessen am 2026-07-25 ist ./e2e-isolated.sh unter Maschinenlast NICHT deterministisch — ein Lauf fiel mit 3/759 auf einem Baum mit null Code-Aenderungen, der davor und danach gruen war. Ein Fail zaehlt trotzdem als DEINER, ausser du beweist ihn als Flake: gleicher Check, frischer HEAD-Worktree, Transcript in den Report. Rate nicht "ist bestimmt der Flake".
Keine untracked Reste. NICHT selbst landen. Keine Refactorings ausserhalb des Scopes.
OUTPUT: Diff, Verifikations-Ausgaben, eine Zeile zu Ungeloestem.
```

---

## `69307891` — queued / owner / created 2026-07-25 23:43

```
[P1-Measurement] Ein Verify-TIMEOUT wird als Fehlschlag geschrieben statt als Nicht-Messung — und das vergiftet genau die Zahlen, auf denen die Autonomie-Entscheidung ruht

BEFUND (2026-07-25, aus docs/verify-tiering.md; nachpruefen): runVerify (server.ts, grep VERIFY_TIMEOUT_MS und "timedOut") schreibt bei Timeout ok:false — also "die Verifikation ist FEHLGESCHLAGEN". Der dritte Zustand existiert eine Zeile daneben und wird fuer den self-declared skip benutzt (ok:null, grep VERIFY_SKIP_EXIT). Ein Timeout ist aber keine Evidenz fuer einen Defekt, sondern eine ausgefallene MESSUNG — dieselbe Unterscheidung, die dieses Projekt an drei anderen Stellen ausdruecklich trifft (unknown != zero).

KOSTEN, und die sind konkret: gemessen ist ./e2e-isolated.sh unter Last nicht deterministisch, und das Gate laeuft auf derselben Maschine wie die Sessions. Ein Lastartefakt wird damit als roter Verify in die Outcome-Row geschrieben, zaehlt in K1 als Fehlschlag und stoppt ein Land, das nichts kaputt hat. Je autonomer der Betrieb, desto haeufiger — weil dann mehr parallel laeuft.

AUFTRAG:
1. Timeout auf ok:null umstellen, mit einem Grund-Feld, das "timeout nach N ms" von "hat sich selbst uebersprungen" unterscheidet — die beiden duerfen im Ledger nicht ununterscheidbar werden.
2. Der Auto-Land-Pfad behandelt ok:null bereits als stop-and-review (server.ts, grep "verify SKIPPED itself") — pruef und BELEGE, dass ein Timeout danach immer noch nicht auto-landet. Das ist die sicherheitskritische Zeile dieser Aenderung: sie darf ein Timeout nicht versehentlich in ein Land verwandeln.
3. Pruef alle Leser von verify.ok (grep) auf die neue Dreiwertigkeit — Client-Anzeige eingeschlossen. HINWEIS: src/client.ts enthaelt (bis ein anderer Task das behebt) ein rohes NUL-Byte, weshalb grep dort STILL nichts findet. Benutz grep -a oder bun, sonst uebersiehst du jeden Client-Leser.
4. Ein e2e-Check, der den Timeout-Fall festnagelt.
Commit: "fix(verify): a timeout is a failed measurement, not a failed verification"

VERIFIKATION: bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts · bun run build · ./e2e-isolated.sh (Tail MUSS "ALL PASS") · ./e2e-claude-gate.sh (ALL PASS).
ACHTUNG zur e2e-Bewertung: gemessen am 2026-07-25 ist ./e2e-isolated.sh unter Maschinenlast NICHT deterministisch — ein Lauf fiel mit 3/759 auf einem Baum mit null Code-Aenderungen, der davor und danach gruen war. Ein Fail zaehlt trotzdem als DEINER, ausser du beweist ihn als Flake: gleicher Check, frischer HEAD-Worktree, Transcript in den Report. Rate nicht "ist bestimmt der Flake".
Keine untracked Reste. NICHT selbst landen. Keine Refactorings ausserhalb des Scopes.
OUTPUT: Diff, Verifikations-Ausgaben, eine Zeile zu Ungeloestem.
```

---

## `18533823` — queued / owner / created 2026-07-25 23:56

```
[docs] Behauptungen, die durch die Lands vom 2026-07-25 falsch geworden sind, nachziehen

Lies zuerst CLAUDE.md im Worktree. Doc-only, kein Code. Diese Aufgabe ist Wissenspflege: eine Behauptung im Regal, die die Realitaet ueberholt hat, ist schlimmer als eine fehlende — sie wird gelesen und geglaubt.

BEKANNT VERALTET (pruef jede einzeln nach, uebernimm sie nicht):
1. docs/README.md, Eintrag zu gate-coverage.md: beschreibt "the post-land audit tier that was designed and never built". Die Stufe IST gebaut und gelandet (grep POSTLAND_AUDIT_CMD in server.ts und in watchdog.sh) und seit 2026-07-25 im Live-Deploy scharf. Der Eintrag zu verify-tiering.md direkt daneben sagt es bereits richtig — die beiden widersprechen sich aktuell.
2. docs/gate-coverage.md selbst: die post-land-audit-Lane hat es mitgeaendert. Pruef, ob im Doc noch Stellen stehen, die die Stufe als unbebaut oder als blossen Entwurf fuehren.
3. docs/perception-layer.md: laut dem Ledger-Audit sagt §5, die Zeilen ohne Review-Key seien 1-3; es sind 1-4. Verifiziere das an lane-outcomes.jsonl im HAUPT-Checkout (nur lesen, niemals committen — die Datei ist gitignored).
4. docs/security-findings.md: SEC-2 ist seit 57ca0cb gefixt und gelandet, SEC-3/SEC-12 sind noch offen. Zieh den Status von SEC-2 nach. WICHTIG: der Fix weicht bewusst vom Plan ab — "Read(**)" allein war nachweislich WIRKUNGSLOS, weil --allowedTools additiv zur Allow-Liste in ~/.claude/settings.json ist; erst --setting-sources "" laesst die Anker binden. Das gehoert in die Statuszeile, weil sonst der naechste Leser den falschen Fix wiederholt.

SUCH SELBST WEITER: geh den Abschnitt "The corpus" in docs/README.md durch und pruef, ob jeder Zeiger auf eine existierende Datei aufloest (der Tombstone-Absatz am Ende erklaert, warum das der billigste Check ist, der den Index ehrlich haelt). Melde jede weitere Behauptung, die durch die acht Lands von heute falsch geworden ist — aber aendere nur, was du BELEGEN kannst.

DISZIPLIN: keine Umformulierungen aus Geschmack. Jede Aenderung braucht einen Beleg (Datei/Zeile oder Kommando-Ausgabe), und der gehoert in den Report. Wo du unsicher bist: als Zeile melden, nicht still korrigieren.

VERIFIKATION: git grep -n auf jeden geaenderten Anker; jeder in docs/README.md genannte Pfad existiert; git status --porcelain leer.
Doc-only: tsc/build/e2e nicht betroffen, nicht ausfuehren.
NICHT selbst landen. Keine untracked Reste.
Commit: "docs: reconcile the shelf with what landed 2026-07-25"
OUTPUT: der Diff, die Belege je Aenderung, und eine Zeile zu dem, was du gefunden aber nicht geaendert hast.
```

---

## `16d652aa` — queued / owner / created 2026-07-26 08:26

```
[P1-Gate] Den gemessenen Gate-Vorschlag aus docs/verify-tiering.md uebernehmen — erste Land-Pfad-Abdeckung ueberhaupt

Lies zuerst CLAUDE.md, dann docs/verify-tiering.md (besonders die Messtabelle und Paragraph 8, der den fertigen String enthaelt). Der Vorschlag ist bereits gemessen und begruendet — dein Job ist Umsetzung plus eigene Verifikation, nicht Neuentwurf.

WAS: FLEET_VERIFY_CMD in watchdog.sh erweitern um (a) die drei getrackten .ts, die heute NIE typgepruft werden (die Standalone-Harnesses — finde sie, verifizier dass sie fehlen) und (b) ./e2e-clean-review.sh. Gemessene Kosten laut Doc: ~65,6 s Median statt heute ~47 s.
WARUM ES ZAEHLT: das heutige Gate deckt den LAND-Pfad zu null ab — und genau dort haengt inzwischen auch der Trigger fuer Verifikations-Stufe 2 (schedulePostLandAudit sitzt in recordLand). Eine Regression dort nimmt Undo-Record und Auditor zusammen mit, und das Gate merkt es nicht.
NICHT hinzufuegen: ./e2e-isolated.sh. Sie ist unter Last messbar nicht-deterministisch (ein Lauf fiel mit 3/759 auf einem unveraenderten Baum) — als hartes Pre-Land-Gate verwandelt sie Maschinenlast in gestoppte Lands. Dafuer existiert Stufe 2.

VERIFIZIERE SELBST, statt dem Doc zu glauben: miss den neuen Gate-Befehl (mind. 2 Laeufe, Median + Spanne, Lastlage nennen) und beleg, dass die drei Harnesses vorher NICHT und nachher SCHON geprueft werden (z.B. per Mutation: Typfehler einbauen, Gate muss rot werden, Fehler zuruecknehmen).
watchdog.sh-Aenderungen wirken erst nach launchctl kickstart — fuehr das NICHT aus, das macht der Owner. Nenn im Report die genaue Kommandofolge.
Commit: "feat(gate): typecheck the standalone harnesses and cover the land path"

VERIFIKATION: bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts · bun run build · ./e2e-isolated.sh (Tail MUSS "ALL PASS") · ./e2e-claude-gate.sh · bei Merge-/Land-Pfad zusaetzlich ./e2e-clean-review.sh.
./e2e-isolated.sh ist unter Last gemessen nicht-deterministisch — ein Fail bleibt trotzdem DEINER, bis du ihn als Flake beweist (gleicher Check, frischer HEAD-Worktree, Transcript in den Report).
Keine untracked Reste. NICHT selbst landen. Keine Refactorings ausserhalb des Scopes.
OUTPUT: Diff, Verifikations-Ausgaben, eine Zeile zu Ungeloestem.
```

---

## `252c01c2` — queued / owner / created 2026-07-26 08:26

```
[P1-Rollback] undo-land deckt genau EIN Land ab — im Burst ist der Rollback weg, bevor der Alarm kommt

BEFUND (2026-07-26, aus docs/verify-tiering.md; nachpruefen an server.ts, grep undoableFor und die undo-land-Route): der Undo-Record gilt fuer genau ein Land und nur bis zum naechsten — die Route loescht ihn, sobald main weitergezogen ist. Verifikations-Stufe 2 nennt "undo-land" aber ausdruecklich als ihren Rollback (server.ts, im Kommentarblock der Stufe). Bei drei Lands innerhalb von zwei Minuten — genau das Muster, das ein laufender Dispatcher erzeugt — ist der Undo beim Eintreffen eines roten Audits schon nicht mehr da.

AUFTRAG: analysieren und EINEN Weg vorschlagen und umsetzen, begruendet aus zwei Optionen:
 (a) mehr Undo-Records vorhalten (Tiefe N statt 1) — pruef, was das fuer die Semantik bedeutet: ein Undo von main auf einen Stand vor mehreren Lands wirft fremde Arbeit mit weg. Das ist moeglicherweise SCHLIMMER als kein Undo.
 (b) die Behauptung korrigieren statt den Mechanismus: Stufe 2 nennt einen Rollback, den sie nicht garantieren kann — dann muss der Kommentar (und docs/gate-coverage.md) sagen, was wirklich gilt, und der ehrliche Rollback ist git revert von Hand.
Entscheide mit Belegen. Es ist ein voellig legitimes Ergebnis, dass (b) richtig ist und der Code unveraendert bleibt — dann ist das Deliverable eine Doku-Aenderung plus eine Zeile im Kommentar an der Entscheidungsstelle.
ZUSATZ, klein und getrennt committen wenn du es machst: docs/verify-tiering.md schlaegt vor, ein rotes Stufe-2-Ergebnis EINMAL gegen dieselbe mainSha nachlaufen zu lassen, bevor Alarm — weil die Suite unter Last falsch-rot wird. Bewerte das und setz es um oder begruende das Nein.
Commit: "fix(rollback): say what undo-land actually covers"

VERIFIKATION: bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts · bun run build · ./e2e-isolated.sh (Tail MUSS "ALL PASS") · ./e2e-claude-gate.sh · bei Merge-/Land-Pfad zusaetzlich ./e2e-clean-review.sh.
./e2e-isolated.sh ist unter Last gemessen nicht-deterministisch — ein Fail bleibt trotzdem DEINER, bis du ihn als Flake beweist (gleicher Check, frischer HEAD-Worktree, Transcript in den Report).
Keine untracked Reste. NICHT selbst landen. Keine Refactorings ausserhalb des Scopes.
OUTPUT: Diff, Verifikations-Ausgaben, eine Zeile zu Ungeloestem.
```

---

## `d87685de` — queued / owner / created 2026-07-26 08:34

```
[korrigiert 2026-07-26 — ersetzt Task fcfc5244 des Stewards, der per `done` zurueckgezogen wurde (NICHT `delete`: das haette ein falsches `dismissed` in outcomeTally.propose geschrieben). Inhalt unveraendert bis auf die markierte Stelle.]

[steward-brief] Lane: state_relay refs for facts the server already knows and no session can see (deploy gap, stale bundle, red post-land audit)

TASK
renderStewardMessage (server.ts) implements the mined playbook's largest lever — state_relay, ~18% of real owner mid-session prompts were deterministic machine-state relays (steward-autonomy.md, Empirical base) — with only two refs, both keyed on mergeLast, so it is unusable for any non-lane session. Add refs keyed on server facts that already exist: `deploy_gap` (deployGap(): codeBehind true — the running srv is behind main), `bundle_stale` (bundleStale().stale true — client build older than src), `postland_red` (latest post-land audit row red, grep POSTLAND_AUDIT in server.ts). Each ref follows the existing pattern exactly: if the fact does not currently hold, return { error } (like the `commit`/`verify` refs); the rendered text is `[steward] Status: <fact verbatim>` — a fact, NEVER a diagnosis or directive, and no verification suffix (playbook item 1 states why). Do not add a ref whose source is a transcript or an LLM output — deterministic sources only.

ENVIRONMENT
- ACHTUNG, seit dem Land von 4d9b47c (kind:"pulse", 2026-07-26) geaendert: renderStewardMessage ist jetzt ASYNC und nimmt VIER Parameter — (kind, ref, s, question), Rueckgabe Promise<{text}|{error}> (server.ts, grep "async function renderStewardMessage"). Deine neuen refs muessen in diese Form passen; die aufrufende Stelle awaited bereits. Lies die Funktion, bevor du "dem bestehenden Muster folgst" — das Muster hat sich geaendert, seit dieser Task geschrieben wurde.
- server.ts: renderStewardMessage, StewardKind handling in handleStewardSend (kind vocabulary may need `state_relay` refs only — do NOT add a new kind), deployGap, bundleStale, the post-land audit trail.
- e2e/steward-core.ts is your check family (insert next to the existing steward-send checks, never at EOF). A sibling lane owns helpedGitSince/measureOutcomes — do not touch the outcome-measurement region; the outcomePending park in handleStewardSend stays as-is (your refs ride the existing park).

DONE means: e2e checks in e2e/steward-core.ts asserting (a) each new ref renders the expected `[steward] Status:` text when its fact holds, (b) each returns an error when the fact does not hold (fail-closed, unknown ≠ fact), red against old code; then the Verify line in this worktree's CLAUDE.md, tail ALL PASS. Commit; no untracked files. Report: summary + quoted verification + one line on anything unresolved.
```

---

## `188aa60e` — queued / owner / created 2026-07-26 08:34

```
[korrigiert 2026-07-26 — ersetzt Task 30622a35 des Stewards, der per `done` zurueckgezogen wurde (NICHT `delete`: das haette ein falsches `dismissed` in outcomeTally.propose geschrieben). Inhalt unveraendert bis auf die markierte Stelle.]

[steward-brief] Lane: `commit-looking` — the main-session analogue of done-looking (the reviewable unit is the commit, not the branch)

TASK
Every reached-a-reviewable-point signal in Fleet is branch-shaped: lane-signals.ts requires git.ahead>0 and stewardSlotsView additionally gates doneLooking/doneLookingSince on !!s.worktree. A main session commits TO its integration branch, so ahead==0 by construction and the whole condition vocabulary (pulse, digest conditions, auto-③) is structurally blind to slots like 8/11/12/13. Add the commit-shaped analogue: `commitLooking` for active non-worktree, non-steward slots = alive===true AND idle ≥ threshold AND clean tree AND head advanced since the steward's prior journal record. The delta source already exists: the digest's sinceLastLook is computed server-side from the prior journal record's lane map — read that assembly (grep sinceLastLook in server.ts) and extend the journal record + comparison to non-lane slots keyed by cwd@branch, then derive commitLooking from it. ACHTUNG — diese Anweisung lautete urspruenglich "Follow lane-signals.ts's construction exactly: every clause a negation test". DAS IST FALSCH und wuerde denselben Fehler nachbauen: zwei der sechs bestehenden Klauseln sind PERMISSIV, nicht negationsgetestet (`gitOp !== true` ist bei null WAHR; `!MERGE_BLOCKING.includes(merge?.status ?? "")` ist bei null WAHR). Belegt in docs/state-reality-divergence.md (gelandet in 6781024); der Kopfkommentar von lane-signals.ts behauptet das Gegenteil und ist unzutreffend. Ein weiterer Fehler eine Ebene hoeher: lastOutput:0 verwandelt ein Unbekannt in einen extremen BEKANNTEN idleMs-Wert, sodass Null-Tests gar nicht greifen.
Bau also die INTENTION nach, nicht den Code: JEDE Klausel von commitLooking muss ein echter Negationstest sein — jeder unbekannte Fakt (null alive, null git, kein Vorgaenger-Record, nicht getickte idleMs) liest als NICHT commit-looking, nie als Erlaubnis. Schreib zu jeder Klausel den Unbekannt-Fall als eigenen e2e-Check, sonst ist die Behauptung wieder nur ein Kommentar. Queued task 733e1c3b behebt die bestehenden zwei Klauseln; wenn sie vor dir landet, richte dich nach dem dann geltenden Code und sag es im Report. Put the predicate IN lane-signals.ts beside DONE_LOOKING_RULES so prose and test cannot drift. Display rung only: NOTHING may consume it in this lane — no trigger, no auto-③ wiring, no send.

ENVIRONMENT
- lane-signals.ts (the pattern to extend), server.ts: stewardSlotsView, the journal write/read + sinceLastLook assembly in handleStewardRoute.
- e2e/steward-core.ts is your check family (insert next to the doneLooking/view checks, never at EOF). Sibling lanes are adding a `mission` field to stewardSlotsView and refs to renderStewardMessage — add fields, don't reorder, don't touch their regions.

DONE means: e2e checks proving (a) a non-lane slot with advanced head + clean + idle reads commitLooking:true, (b) each unknown input (no prior journal record; null git) reads false, red against old code; then the Verify line in this worktree's CLAUDE.md, tail ALL PASS. Commit; no untracked files. Report: summary + quoted verification + one line on anything unresolved.
```

---

## `7319e7ad` — queued / owner / created 2026-07-26 08:34

```
[gap] Ein gefilter Task laesst sich nicht korrigieren, ohne entweder das Log zu faelschen oder eine Messung zu verderben

BEFUND (2026-07-26, vom Steward benannt, hier im Code nachgeprueft): auf Tasks gibt es KEIN PATCH/PUT unter keinem Prinzipal — die einzigen Mutationen sind POST /api/tasks/:id/{queue,unqueue,done,delete} (server.ts, grep "taskAct"). "Korrigieren" heisst deshalb: alten Text zurueckziehen, neuen filen.
Und der naheliegende Weg ist die Falle: bei einem steward-stammigen Task im Status pending schreibt `delete` ein `dismissed` und `queue` ein `helped` in outcomeTally.propose (server.ts, grep "proposeOutcome"). Wer zwei Tasks loescht, UM SIE ZU VERBESSERN, schreibt zwei falsche Ablehnungen in die einzige Messung, die es davon gibt, ob Steward-Vorschlaege taugen.
BELEG, dass das nicht theoretisch ist: am 2026-07-25 hat der Orchestrator b32458bc geloescht, weil ein Nachfolge-Task es ausdruecklich verlangte. Die Zeile steht im Journal — {"ref":"b32458bc","outcome":"dismissed"} — und ist FALSCH: der Task wurde abgeloest, nicht verworfen. Von zwei `dismissed` in der Tally ist damit eines unecht.
Der Umweg (`done` statt `delete`, schreibt nichts) funktioniert, luegt aber im Log: er markiert als erledigt, was ersetzt wurde.

AUFTRAG: entscheide begruendet EINEN Weg und setz ihn um.
 (a) Ein `supersede`-Uebergang, der weder helped noch dismissed schreibt und im Task sichtbar macht, wodurch er ersetzt wurde.
 (b) Ein Korrektur-Eintrag im Journal, mit dem ein Konsument eine falsche Zeile neutralisieren kann, ohne die Tally von Hand zu editieren.
 (c) Begruendet gar nichts aendern und stattdessen die Regel dokumentieren.
Wichtig: die Tally NICHT von Hand nachjustieren — eine Messung still zu korrigieren ist schlimmer als ein bekannter Fehler darin. Wenn dein Weg die bestehende falsche Zeile heilt, muss die Heilung im Journal sichtbar sein.
VERIFIKATION: e2e-Check, dass der neue Uebergang (falls du einen baust) NICHTS in outcomeTally schreibt, und dass queue/delete ihre bisherigen Labels unveraendert schreiben. Plus die Gate-Zeile aus CLAUDE.md. NICHT selbst landen.
Commit: "feat(tasks): superseding a proposal must not read as dismissing it"
```

---

## `babbf719` — queued / owner / created 2026-07-26 08:34

```
[finding] Ein srv-Neustart verwirft einen laufenden Post-Land-Audit — Deploy und Stufe 2 konkurrieren

BEFUND (2026-07-26, beobachtet): Stufe 2 laeuft nach jedem main-bewegenden Land 5-7 Minuten (gemessen: 5.6 und 6.5 min). Ihre Queue und das Draining liegen im Prozessspeicher (server.ts, grep "auditQueue" und "auditDraining") — es gibt keine Rehydrierung ausstehender Arbeit beim Boot, nur die des LETZTEN fertigen Rows. Ein "tmux -L claudefleet kill-session -t srv" in diesem Fenster verliert also die Messung still: kein Row, keine Zeile im Log, kein Hinweis, dass etwas fehlte.
WARUM DAS ZUSAMMENFAELLT: genau dann will man deployen. Ein Land, das server.ts anfasst, setzt deployGap.codeBehind auf true UND startet den Auditor — der naheliegende naechste Schritt des Owners ist der Neustart, und der frisst das Ergebnis. Der Auditor ist das einzige Instrument, das misst, ob unbeaufsichtigte Lands heil waren; eine still verlorene Messung ist schlimmer als gar keine, weil das Trail dann luekenhaft ist, ohne es zu zeigen.

AUFTRAG: analysieren und EINEN Weg umsetzen, begruendet:
 (a) beim Shutdown eine `unknown`-Zeile mit reason "srv restarted during audit" schreiben, damit die Luecke SICHTBAR ist (billig, ehrlich, aendert nichts am Ablauf) — pruef, ob es einen brauchbaren Shutdown-Hook gibt und was bei SIGKILL passiert;
 (b) ausstehende Audit-Arbeit persistieren und beim Boot fortsetzen (teurer, und ein Audit gegen einen inzwischen weitergezogenen Tip misst etwas anderes — pruef das, bevor du es baust);
 (c) nur dokumentieren und im Deploy-Ablauf (CLAUDE.md, docs/gate-coverage.md) eine Zeile "vor dem Neustart pruefen, ob ein Audit laeuft" verankern, mit dem Kommando dafuer.
(a) ist der Verdacht des Vorschlagenden, aber entscheide selbst mit Belegen; (c) allein ist ein legitimes Ergebnis.
VERIFIKATION: Reproduktion (Audit starten, srv neu starten, zeigen dass heute kein Row entsteht), dann der Nachweis, dass dein Weg greift. Plus die Gate-Zeile aus CLAUDE.md; bei Merge-/Land-Pfad zusaetzlich ./e2e-clean-review.sh. NICHT selbst landen.
Commit: "fix(audit): a restart during a post-land audit must not lose the measurement silently"
```

---

## `639e35ff` — pending / owner / created 2026-07-26 10:10

```
[P1-Measurement] `landInitiatedBy` — die Achse, ohne die "unbeaufsichtigt gelandet" nicht zählbar ist

Lies ZUERST CLAUDE.md in deinem Worktree. Doc-Pflege gehört in dieselbe Lane (Wissenspflege-Regel).

## BEFUND (verifiziert durch Lesen, nicht aus einem Handoff zitiert)

`docs/adversarial-2026-07-25.md:87` (B3) und `docs/graduation-criteria.md:153` halten fest:
`confirmedByHuman: false` heisst NICHT "unbeaufsichtigt". Die Merge-Route ist owner-token-gegated
(das Self-Token einer Lane bekommt 403), also ist JEDES bisherige Land ein owner-initiierter Merge;
das Flag bedeutet "kein ZWEITER menschlicher Schritt". Wortlaut B3: *"Criterion 1 would license
unattended landing on a population containing zero unattended lands."*

Daraus folgt die Luecke — und sie ist NICHT, dass `confirmedByHuman` kaputt oder mehrdeutig waere.
Das Feld ist gut (`docs/outcome-ledger-audit.md:166`: "good, misread easily") und beantwortet seine
eigene Frage weiterhin korrekt. **Es fehlt eine zweite, orthogonale Tatsache: hat ueberhaupt ein
Mensch dieses Land ausgeloest?** Heute ist die Antwort ausnahmslos ja. Sobald ein Auto-Merge-Tick
existiert, ist sie es nicht mehr — und nichts im Schema wuerde diesen Populationswechsel markieren.

## WARUM JETZT UND NICHT MIT DEM TICK

Solange kein Tick existiert, ist "Feld fehlt ⇒ owner-initiiert" durch B3 BEWIESEN, nicht vermutet.
Landet das Feld erst zusammen mit dem Tick, ist genau diese Schlussfolgerung fuer die Zeilen an der
Grenze nur noch geraten. Das Zeitfenster zwischen diesem Land und dem Tick ist der Grund, dass die
Migration verlustfrei by construction ist.

Der eigentliche Gewinn ist nicht Schema-Hygiene: ein kuenftiges Kriterium "N unbeaufsichtigte Lands
ohne Undo" ist HEUTE nicht berechenbar, weil die Tatsache nirgends steht. Danach ist es formulierbar.

## SCOPE — additiv, `confirmedByHuman` bleibt UNVERAENDERT

Fass `confirmedByHuman` nicht an. Es haengt an ~11 e2e-Assertions, an `kProgress` in src/client.ts,
an der Kriterien-Kopfzeile und an HANDOFF §1. Eine Ersetzung war der urspruengliche Gedanke und ist
nach dem Lesen von B3 als falsch verworfen worden.

Neues Feld: `landInitiatedBy: "owner" | "gate"`.
ZWEI Werte, nicht drei. "clean" gehoert NICHT hinein — das ist ein Abschlusspfad, kein Initiator,
und steht bereits in `confirmedByHuman:false` + `resolvedConflict:false`. Ein dritter Wert wuerde
genau die Vermischung wieder einfuehren, die dieses Feld aufloest. `"gate"` hat heute bewusst keinen
Erzeuger; der Union-Wert existiert, damit die erste Tick-Zeile ihn schreiben KANN, ohne dass die
Bedeutung frueherer Zeilen nachtraeglich verhandelt werden muss. Schreib das als Kommentar hin.

Beruehrte Stellen (alle verifiziert, Zeilen koennen um wenige driften):
1. `LaneOutcome` — Feldtyp + Kommentar neben `confirmedByHuman` (server.ts ~3066), Schreibstelle
   in `buildLaneOutcome` (~3225).
2. `LandFacts` (~3098) und BEIDE Konstanten: `NO_LAND_FACTS` (~3103) und `OWNER_LAND_FACTS` (~3107).
3. Die zwei Land-Sites: clean auto-land (~3697) und confirm-land (~5732/5738).
4. **`LandProvenance` (~2701) und `writeLandNote` (~2715).** Die git-Notiz ist ein ZWEITES Zuhause
   derselben Tatsache. Wird nur eines gepflegt, divergieren Ledger und Notiz still — genau die
   Klasse Fehler, die dieses Projekt teuer bezahlt hat.
5. Client: der Row-Typ (`src/client.ts` ~2844) und der Facts-Chip (~3086, heute binaer
   "owner-confirmed land" / "auto-landed clean+green"). **ACHTUNG: `src/client.ts` enthaelt ein rohes
   NUL-Byte — `grep` meldet fuer JEDES Muster still nichts. Benutz `grep -a`.**
6. Docs in derselben Lane: `docs/merge-review-autonomy.md` (:69 und :246 nennen die Feldliste),
   `docs/outcome-ledger-audit.md` (die Feld-Vertrauenstabelle ~:166), `docs/lane-autonomy-future.md:30`.
   Und in `docs/graduation-criteria.md` bei B3/§153 EINE Zeile, die auf das neue Feld verweist —
   kein Kriterium aendern, keine Schwelle bewegen. Das ist eine Notiz, kein Amendment.

## HARTE REGEL — die 40 bestehenden Zeilen werden NICHT nachtraeglich befuellt

"Feld fehlt ⇒ owner-initiiert" ist eine LESE-Regel und darf niemals ein Schreibvorgang werden.
Ein Messjournal nachtraeglich zu beschriften ist genau das, was HANDOFF §7 verbietet ("silently
adjusting a measurement is worse than a known error in it"). Kein Backfill, kein Migrationsskript,
keine Neuberechnung von lane-outcomes.jsonl. Wenn du glaubst, das Gegenteil sei noetig — melden,
nicht tun.

## KANTEN, die du explizit behandeln musst

- `NO_LAND_FACTS` gilt fuer nicht-gelandete Dispositionen (killed/shelved/reverted). Dort ist das
  Feld bedeutungslos und muss der ehrliche n/a-Default sein, genau wie die anderen land-shape facts
  (siehe den Kommentar bei server.ts ~3060-3063). Schreib hin, was der Default DORT bedeutet.
- Ein Leser, der "fehlt" als Wert behandelt, ist der gefaehrliche Ausgang. Absent ist definiert und
  wird getestet, nicht dem Zufall ueberlassen.

## VERIFIKATION (Ausgaben in den Report zitieren)

1. e2e in der richtigen Familie — `e2e/outcomes.ts` fuer die Ledger-Row, `e2e/land-provenance.ts`
   fuer die git-Notiz; neben die verwandten Checks, NIE ans Dateiende, NIE in den Runner.
   Mindestens: (a) clean auto-land schreibt `"owner"` auf Row UND Notiz; (b) confirm-land schreibt
   `"owner"` auf Row UND Notiz; (c) eine Legacy-Row OHNE das Feld wird gelesen, ohne dass irgendein
   Zaehler kippt — insbesondere darf `kProgress` sich nicht aendern.
2. **ROTBEWEIS, nicht nur Gruen:** zeig, dass mindestens ein neuer Check gegen den alten Code
   FAEllt. Wenn ein Check auch ohne deine Aenderung besteht, ist er tautologisch — dann repariere
   ihn, so wie es die dispatch-persist-Lane heute vorgemacht hat. Transcript in den Report.
3. `bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun
   src/client.ts src/share.ts server.ts fleet-e2e.ts merge-prompt.ts` · `bun run build` ·
   `./e2e-isolated.sh` (Tail MUSS "ALL PASS") · `./e2e-claude-gate.sh` · `./e2e-clean-review.sh`.
4. **Suiten SERIELL laufen lassen, nie parallel.** Heute gemessen (Lane b798): gleichzeitige
   `./e2e-isolated.sh`-Laeufe erzeugen auf dieser Maschine zuverlaessig Fehler auf BEIDEN Baeumen.
   Ein Fail gehoert dir, bis du ihn als Flake beweist — gleicher Check, frischer HEAD-Worktree,
   seriell, Transcript in den Report.

## NICHT IM SCOPE

- Den Auto-Merge-Tick bauen. Dieses Feld ist seine Vorbedingung, nicht sein Anfang.
- Eine Gate-Konfigurationsversion auf der Row (spekulativ, solange kein Gate existiert; aus
  Commit-Historie + Audit-Log rekonstruierbar).
- `confirmedByHuman` umbenennen, entfernen oder umdeuten.
- Irgendein Kriterium in graduation-criteria.md aendern.

Keine untracked Dateien. NICHT selbst landen.
Commit: "feat(ledger): landInitiatedBy — record who triggered the land, before a gate ever can"
OUTPUT: Diff, zitierte Verifikations-Tails inkl. Rotbeweis, eine Zeile zu Ungeloestem.
```

---

## `cc913fe1` — pending / owner / created 2026-07-26 14:59

```
[P1-Judge] Der ②-Reviewer antwortet in ~1 von 14 Laeufen GAR NICHT — die einzige ueberlebende Fehlerklasse

ERSETZT 10ab6127 (per `done` zurueckgezogen, nicht `delete` — `delete` haette auf einem pending
steward-origin Task ein falsches `dismissed` in outcomeTally geschrieben). Und es ersetzt ihn, weil
seine Praemisse widerlegt ist, nicht weil sie unwichtig waere: der alte Task zaehlte "8 von 14
Contract-Fails" ueber ein REGIME-GEMISCHTES Fenster — die ersten 14 Shadow-Rows liegen fast alle VOR
dem Parser-Fix 7e385e4 (2026-07-25 17:26). Nachgerechnet 2026-07-26 aus lane-outcomes.jsonl, geteilt
an diesem Commit: davor 9 Rows / 2 gueltig; danach 14 Rows / 13 gueltig / 0 Contract-Misses.
**Der Parser-Fix haelt. Contract-Fails sind KEIN offenes Problem.**

WAS UEBRIG BLEIBT: rund 1 von 14 Laeufen liefert `rawAnswer: ""` — der Reviewer laeuft und sagt
NICHTS. Kein Parse-Problem: es kam nie Text an. Vermutung (NICHT verifiziert, das ist Teil der
Aufgabe): Timeout unter Maschinenlast; CLEAN_REVIEW_TIMEOUT_MS ist 180s per Default
(server.ts, grep CLEAN_REVIEW_TIMEOUT_MS) und `summaryViaSession` spawnt ein interaktives
tmux-claude, das erst booten muss.

WARUM ES ZAEHLT: im Gate-Modus faellt jeder solche Lauf GESCHLOSSEN aus, d.h. er degradiert ein
sauberes Auto-Land zu einem Stop-and-Review. Bei 1/14 kostet der Gate also rund 7% der sauberen
Lands einen zusaetzlichen Menschenklick — bevor der Richter ueberhaupt etwas Inhaltliches gesagt hat.
Das ist der Unterschied zwischen "Bremse" und "Reibung".

AUFGABE
1. Diagnose zuerst, Fix danach. Belege aus den vorhandenen Rows, WAS in den leeren Laeufen passiert
   ist — server.log der jeweiligen Zeit, die Transkript-Datei des Summarizer-Sessions
   (`summaryViaSession` pinnt die session-id, der Pfad ist bekannt), Dauer bis zum Abbruch.
   Wenn es ein Timeout war: wie lange lief er wirklich, und wo genau ging die Zeit hin (Boot,
   Antwort, Poll-Intervall)?
2. Erst mit dieser Antwort einen Fix vorschlagen. NICHT blind das Timeout hochdrehen — ein
   laengeres Timeout auf dem Land-Pfad verlaengert jedes Land, auch die gesunden.
3. `raw: true` + leere `rawAnswer` MUSS eine ehrliche Nicht-Messung bleiben. Nichts an diesem Task
   darf dazu fuehren, dass ein stiller Lauf als `pass` gezaehlt wird — das ist F5s Lektion und der
   Grund, warum die K2-Zahl ueberhaupt etwas wert ist.

NICHT IM SCOPE: FLEET_CLEAN_REVIEW auf 1 stellen · am ②-Prompt drehen (eine Feuerprobe laeuft, und
Prompt-Tuning vor ihrem Ergebnis ueberfittet auf ein einzelnes Paar — judge-calibration.md:28).

VERIFIKATION: die Verify-Zeile aus CLAUDE.md dieses Worktrees, SERIELL gefahren (heute gemessen:
gleichzeitige e2e-isolated-Laeufe erzeugen zuverlaessig Fehler auf beiden Baeumen). `./e2e-clean-review.sh`
ist hier nicht optional — sie ist die einzige Suite, die den ②-Pfad bootet.
Keine untracked Dateien. NICHT selbst landen.
```
