# Triage-Batch A-verben — Autonomie-Verben, Provenienz, Auto-Land

**7 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**
Die als „wörtlich“ markierten Zeilentexte bleiben inhaltlich unverändert; reine Dokumentpfade
folgen späteren Regal-Moves, damit sie weiterhin auflösen.

---

## `f0a710db`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Its own gate is unmet and waiving it is your call, not the session's: fleet.json today holds 21 `source:"steward"` rows and every one is `kind:"note"` — 0 lane rows — so the required "≥5 kind:lane-Zeilen, davon ≥2 ready" cannot be reached, which is exactly the empty population docs/autonomy-bausteine-2026-08-06.md §2.3 measured ("14× note und 0× lane") when it concluded "Verb 4 vor Verb 3". Releas
- Analyst sagt kollidiert mit: 785ce63d, acb5839d, 9b565be8, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Verb 3 (Auto-Promote) bauen — erst nachdem `releasedBy` gelandet ist und der Steward ≥5 `kind:"lane"`-Zeilen gefilt hat, davon ≥2 ohne Nachhilfe `ready` (Schwelle aus `docs/autonomy-bausteine-2026-08-06.md` §2.3). Ein Tick befördert `pending → queued` genau für `source:"steward" && kind:"lane" && analysis.verdict==="ready"` mit derselben Frische-Regel wie `tickAnalysisSweep`, unter `dispatchOn`/Lane-Deckel/Quiet Hours, mit eigenem Audit-Event (ein maschineller Promote darf nie wie ein Owner-Akt aussehen). DONE: eine Steward-Zeile mit `ready` geht ohne Owner-Klick auf `queued`, das Audit-Event trägt die Maschinen-Freigabe, und eine Owner-Zeile mit `ready` geht NICHT (der `500ff63`-Einwand ist gepinnt). VERIFIKATION: volle Gate-Kette; Checks in `e2e/` neben der Dispatch-Familie, darunter zwingend der Negativ-Check „Owner-Entwurf bleibt liegen".

FILES: `server.ts` (neben `tickDispatch`), `e2e/` Dispatch-Familie
GRUPPE: G6
QUELLE: `docs/autonomy-verbs-2026-08-06.md:75-92 @1e46b8b` — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `08f44054`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The finished state is a multi-day field statistic no lane can produce: "über 20 Pulse filet der Steward ≥5 kind:lane-Zeilen" with "VERIFIKATION: keine Suite … Nachweis ist die Messung über 20 Pulse" — and the steward has been unstaffed since 2026-08-06 16:30 per the cited doc, so pulse 1 of 20 has not happened. The branch it hangs on that measurement ("Verb 3 wird abgeblasen") is your decision, no
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > OWNER-ENTSCHEID 2026-08-07 zu F2 (Schwellen-Klasse): Bau und Auswertung werden GETRENNT. Diese Zeile traegt ein DONE, dessen Schwelle eine Feldmessung ueber Tage/Pulse/Lanes ist — eine Lane kann das nie abschliessen, deshalb urteilt der Analyst zu Recht needs-you. Neue Form: die Lane baut NUR den Sensor und ist fertig, wenn er misst und gepinnt ist (hartes, lane-abschliessbares DONE). Die Schwellen-Klausel faellt aus dem Lane-DONE heraus und wird eine eigene note-Zeile, die auf die Datenmenge wa

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Verb 4 — Ritual-Revision des Rundgangs (`.claude/commands/rundgang.md`), NICHT die Erlaubnis nachrüsten (die steht in Zeile 36), sondern die FORM: ein Befund mit Verfallsfenster (Deploy aussteht, Review reif, Rot offen) wird `kind:"lane"` mit Done-Kriterium und Verify-Weg im Text; ein Befund ohne Fenster bleibt `note`. Beleg für die Notwendigkeit: alle vier `needs-you`-Verdicts der Queue nennen „kein Kriterium" als Blocker (Zahl vor dem Bauen neu rechnen). Zusätzlich: Digest-Reparatur (siehe eigene Zeile Map E, nicht hier duplizieren) und der Maschinen-Fakt in den Puls (siehe Steward-Blindheit). DONE: über 20 Pulse filet der Steward ≥5 `kind:"lane"`-Zeilen und ≥2 davon erreichen ohne Nachhilfe `ready`; bei 0 Lane-Claims nach 20 Pulsen ist das Ritual nicht der Hebel und Verb 3 wird abgeblasen, nicht nachgeschärft. VERIFIKATION: keine Suite (Ritualdatei); Nachweis ist die Messung über 20 Pulse aus `steward-journal.jsonl` + `fleet.json`.

FILES: `.claude/commands/rundgang.md` (getrackt), ggf. `.claude/commands/inspektion.md`
GRUPPE: G6
QUELLE: `docs/autonomy-verbs-2026-08-06.md:94-111 @1e46b8b` — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `acb5839d`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Its load-bearing tree claim is false at HEAD: the brief says "`git commit` kommt in `MERGE_TOOLS` 0× vor", but server.ts:6038 now lists `"Bash(git commit:*)"` — landed 2026-08-08 for the very queue row 25b79c23 the brief orders the drill to wait behind, and docs/attic/agent-visibility-2026-08-06.md:275 is annotated "ERLEDIGT 2026-08-08 (Zeile `25b79c23`)". So both the sequencing constraint and the reaso
- Analyst sagt kollidiert mit: f0a710db, 785ce63d, 9b565be8, fleet/260808114656-6e86
- Analyst-Blocker: ["attribution", "criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Verb 5 (Auto-Land) — noch nicht bauen, sondern seine Einschalt-Bedingung (a) erfüllen: eine bewusste Feuerprobe der beiden Auffangpfade in einer Drill-Lane — ein gestellter Konflikt UND ein gestellter Repair-Lauf, damit `repairRounds > 0` und `resolvedBy` mindestens einmal unter Beobachtung gefeuert haben. Ohne das ist jedes Sicherheitsnetz von Verb 5 Dekoration (`docs/attic/autonomy-map-2026-08-06.md` §11.1.1). Achtung, direkt gekoppelt: `docs/attic/agent-visibility-2026-08-06.md` §4 Rang 1 sagt, der Repair-Pfad läuft vermutlich wirkungslos (`git commit` kommt in `MERGE_TOOLS` 0× vor) — die Feuerprobe muss also NACH Queue-Zeile `25b79c23` laufen, sonst misst sie das Tool-Profil statt den Pfad. DONE: eine Ledger-Zeile mit `repairRounds ≥ 1` und eine mit `resolvedBy` aus einem beobachteten Lauf, beide mit zitiertem Transcript. VERIFIKATION: der Drill selbst ist die Verifikation; volle Gate-Kette für jeden Code, den er nötig macht.

FILES: Drill-Fläche (`drills/`), abhängig von `server.ts` `MERGE_TOOLS` / `merge-prompt.ts`
GRUPPE: G6
QUELLE: `docs/autonomy-verbs-2026-08-06.md:113-159 @1e46b8b` — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `785ce63d`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The deliverable is a provenance decision the brief itself hands back to you — "Die Wahl gehört begründet, nicht getroffen: Provenienz lässt sich nachträglich nicht reparieren" — with DONE being "eine Entscheidung im Commit-Body" and verification reduced to "der Doc-/Kommentar-Diff": prose about an unrepairable design choice, which the repo's own verification cannot judge. Both pointers are also st
- Analyst sagt kollidiert mit: f0a710db, acb5839d, 9b565be8, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion", "attribution"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Die Provenienz-Vorbedingung für serverseitige Sender klären, bevor irgendein Verb an eine Lane schreibt — `docs/attic/autonomy-map-2026-08-06.md` §2 Punkt 3 + §11.1 Punkt 3 ist der Auftrag. Entweder ein sechster Wert in der Quell-Union (`server.ts:566`) für „Maschine mit Owner-Credential", oder — und das ist die Position der Landkarte — die Regel festschreiben, dass jeder maschinelle Sender eine EIGENE Route mit eigener Quelle bekommt und `/send` die Owner-Route bleibt. Die Wahl gehört begründet, nicht getroffen: Provenienz lässt sich nachträglich nicht reparieren. DONE: eine Entscheidung im Commit-Body plus, falls die Union erweitert wird, ein Pin, dass keine bestehende Route den neuen Wert schreibt. VERIFIKATION: volle Gate-Kette; bei reiner Regel-Festschreibung genügt der Doc-/Kommentar-Diff.

FILES: `server.ts` (Quell-Union ~566, `/send` ~9503), `e2e/` Prompt-/Auth-Familie
GRUPPE: G6
QUELLE: `docs/autonomy-map-2026-08-06.md:71-78, 489-492 @1e46b8b` (§2 Punkt 3, §11.1 Punkt 3) — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `9b565be8`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Every anchor holds and the work is bounded by an explicit order with named pins: `awaiting` is the clause at lane-signals.ts:102 and `STALLED_RULES` begins at 105 exactly as stated, no parked/Parkung slot field exists yet (the only `parked` in the tree is the suite-gate lock in src/client.ts), both source briefs are present with the cited spans real (stalled-parked-and-ledger.md Teil 1 at 22-52, T
- Analyst sagt kollidiert mit: f0a710db, 785ce63d, acb5839d, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
`briefs/stalled-parked-and-ledger.md` als Lane fahren, in der dort festgeschriebenen Reihenfolge und nicht anders: Teil 1 (Parkungs-Markierung) vollständig fertig und verifiziert, bevor Teil 2 (Instanz-Ledger) anfängt — ein Ledger vor der Markierung füllt seine ersten Zeilen mit genau den Fällen, die die Feuerprobe scheitern lassen. Teil 1: ein persistiertes Slot-Feld nach dem Muster von `awaiting` (`lane-signals.ts:102`, `STALLED_RULES` ab 105), owner-gesetzt (ein Produzent darf sich nicht selbst von der Messung ausnehmen), mit Grund (eine Parkung ohne Text ist von Vergessen nicht unterscheidbar), zieht nur `stalled` ab und ist neben dem Fakt sichtbar; Lebensdauer bei `openSlot`/`killSlot` begründen (ein recycelter Slot, der die Parkung erbt, wäre derselbe Bug in Grün). Teil 2 nach dem Entwurf in `briefs/lane-stalled-ledger.md` — dessen sechs tragende Entscheidungen nicht neu erfinden; wo du widersprichst, sag es VOR dem Bauen. `lastOutput` NICHT persistieren (zwei Belege im Brief). Aus `docs/attic/autonomy-map-2026-08-06.md` §10.1 mitnehmen, steht im Brief nicht: jede Ledger-Zeile trägt zusätzlich die Zahl der srv-Neustarts in ihrem Fenster — bei 5–12 Neustarts/Tag und 30-min-Schwelle ist die Stichprobe ohne diese Zahl nicht auswertbar, und die Zahl ist eine Untergrenze. DONE: die beiden realen Notiz-Worktrees hören auf, `stalled` zu melden (das ist die Abnahme, nicht ein grüner Testlauf); Teil-2-Pins für Öffnen/Schließen, Dwell gegen ein Einzelbyte, kein Erben durch einen recycelten Slot, `endedBy:"unknown"` mit markierter Lücke über einen Neustart, und die Schwelle in der Zeile. VERIFIKATION: volle Gate-Kette aus CLAUDE.md.

FILES: `lane-signals.ts` (`STALLED_RULES` ~105), `server.ts` (Slot-Feld, Persistenz, `tickGit`, `killSlot`), `src/client.ts` (Sichtbarkeit), `e2e/` Lane-Signals-Familie
GRUPPE: G3
QUELLE: `briefs/stalled-parked-and-ledger.md:22-52` (Teil 1) und `:56-107` (Teil 2) `@1e46b8b` — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `5ff7233f`  ·  kind=lane  ·  angelegt 2026-08-07 00:09  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The done state is an adoption statistic across 20 landed lanes — "VERIFIKATION: keine Suite (Doku); die Verifikation IST die 20-Lanes-Messung" — which no session can reach, and the branch below 20 % ("es gehört in den Gründungsbrief, nicht in eine schärfere Regelzeile") is your decision. What it would actually edit is two lines and is fully attributable: `POST /api/self/verify-intent` exists (serv
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > OWNER-ENTSCHEID 2026-08-07 zu F2 (Schwellen-Klasse): Bau und Auswertung werden GETRENNT. Diese Zeile traegt ein DONE, dessen Schwelle eine Feldmessung ueber Tage/Pulse/Lanes ist — eine Lane kann das nie abschliessen, deshalb urteilt der Analyst zu Recht needs-you. Neue Form: die Lane baut NUR den Sensor und ist fertig, wenn er misst und gepinnt ist (hartes, lane-abschliessbares DONE). Die Schwellen-Klausel faellt aus dem Lane-DONE heraus und wird eine eigene note-Zeile, die auf die Datenmenge wa

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Die zwei ungenannten Lane-Fähigkeiten benennen — `docs/attic/agent-visibility-2026-08-06.md` §4 Rang 3 ist der Auftrag. Achtung, Ausführungsfalle: `CLAUDE.md` ist gitignored und wird beim Lane-Spawn nur KOPIERT — eine Lane, die sie ändert, sieht die Änderung nie in `git status` und verliert sie beim Land. Die Zeilen gehören als Text in den Report, damit sie im Haupt-Checkout von Hand nachgezogen werden; getrackt änderbar ist nur `docs/lane-brief-template.md`. Inhalt: `POST /api/self/verify-intent` (die Lane sagt, dass sie eine Suite fährt — sonst sieht der Owner eine stumme Pane, obwohl die Route genau dafür gebaut wurde) und `suiteLock` im `/api/self/gate`-Payload (die Lane prüft den Mutex, bevor sie startet, statt die Wartezeit als Hänger zu deuten — der 300-s-Timeout-Vorfall). DONE: Schwelle aus dem Doc — Anteil der Lanes, die mindestens einmal `verify-intent` posten, über 20 gelandete Lanes; unter 20 % ist `CLAUDE.md` als Träger widerlegt und es gehört in den Gründungsbrief, nicht in eine schärfere Regelzeile. VERIFIKATION: keine Suite (Doku); die Verifikation IST die 20-Lanes-Messung.

FILES: `docs/lane-brief-template.md` (getrackt); `CLAUDE.md` nur als Report-Text
GRUPPE: G5
QUELLE: `docs/agent-visibility-2026-08-06.md:276-314 @1e46b8b` (§4 Rang 3; heutiger Ort: `docs/attic/agent-visibility-2026-08-06.md`) — Doc-Aggregation 2026-08-07, Lane fleet/260806214956-3b38 (Vollbericht beim Owner)
```

## `3d707a1d`  ·  kind=lane  ·  angelegt 2026-08-09 07:56  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
RICHTUNGSNOTIZ (Owner-Frage 2026-08-09, "vllt ohne mainSessions, mit codex-Pruefern?"): Die Antwort ist NICHT ein zweiter Modell-Richter — der lief hier schon als K2-Shadow (45 Zeilen, 37 valide, alle "pass", NULL Widerspruch; beerdigt, work-register §7). "Ohne Main-Session" ist EINE Frage: darf ein Tick mergeJob rufen? Fuenf der sieben Main-Griffe sind bereits Knoepfe ohne Aufrufer (mergeJob, slots/:id/commit, refine/analysis/clarify, adjudicate, POST /api/deploy). Was strukturell fehlt, wenn niemand zusieht: (1) ein rotes Tier-2-Audit hat keine Antwort — 22/110 rot, undo-land deckt nur das neueste Land; (2) die vier Idle-Zustaende sind ununterscheidbar, doneLooking sagt selbst, dass es das nicht weiss; (3) das Wissensregal pflegt kein Tick. Vorschlag: nicht abschaffen, sondern jeden Routinegriff zu Mechanismus+Ledger machen, bis die Session nur noch sieht, was ein Mechanismus zu entscheiden ABGELEHNT hat. Bleibt die Ausnahmeliste ueber Tage leer, laeuft es bereits ohne. Erste Zeile danach: ein rotes Post-Land-Audit stoesst von selbst eine Untersuchung an (Bisect ueber covers, Adjudikations-Vorschlag, KEIN Rollback).
```
