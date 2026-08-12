# Agent OS P0-C — Provenienz und Lerndaten

**Stand:** HEAD `b29d2c7`, 2026-08-11 · **Art:** read-only Inventar · **Gate:** G0

**Ablaufdatum:** Nach G0 ist `agent-os-synthesis.md` die operative Wahrheit. Dieses Inventar
wandert beim ersten Phase-1-Land ins Agent-OS-Attic.

## Ergebnis in einem Satz

Fleet besitzt genug Rohbeobachtung fuer einen Lernloop, aber keinen stabilen Join von
Owner-Request ueber Task und Harness bis Outcome: In allen 247 heutigen Outcome-Rows fehlen
`taskId`, `originId`, `programId`, `harness`, `effort`, Context-Plan und Skill-Fassung.

## Reale Population am Stichtag

| Quelle | Rows / Groesse | Wichtige Fakten |
|---|---:|---|
| `fleet.json.tasks` | 200 Rows | 189 `auftrag`, 11 `notiz`; 56 pending, 104 done, 40 archived |
| Task-Unterlagen | 136 Briefs, 108 Analysen, 60 mit Comments, 8 Refines | 0 persistierte `files`, 0 persistierte `cluster`; Projection geschieht read-only |
| `streams/prompts.jsonl` | 4.769 Rows / ca. 6 MB | 4.690.297 Textzeichen; source+slot+cwd, aber kein Task/Harness/Modell |
| `lane-outcomes.jsonl` | 247 Rows / ca. 384 KB | 166 landed, 70 killed-empty, 9 killed-dirty, 2 shelved |
| `audit.jsonl` | 3.328 Rows / ca. 304 KB | Laufzeitereignisse nach `slot` und freiem `detail` |
| `dispositions.jsonl` | 2 Rows | Ownerurteil fuer bestehende advisory Worker |
| `post-land-audits.jsonl` | 129 Rows / ca. 636 KB | serverseitige Suite-Runs und abgedeckte Lands |
| `audit-adjudications.jsonl` | 35 Rows | bestehendes append-only Ownerurteil fuer Audit-Rows |

Die Zahlen sind ein Schema-/Coverage-Census, keine Qualitaetswertung. Die Logs sind gitignored und
0600-operativ; ihr Inhalt darf nicht in getrackte Analyseartefakte kopiert werden.

## Writer-/Reader-Karte

| Objekt | Writer | Reader / Surface | Retention |
|---|---|---|---|
| Task/Brief/Analysis/Comment/Refine | Task-Routen, Analyse-/Refine-Worker | `GET /api/tasks`, Queue-Detail, Poll-Digests | `fleet.json`, insgesamt auf 200 Tasks gedeckelt; terminale Rows werden zuerst verdraengt |
| Prompt | `server.ts::logPrompt` fuer owner/share/auto/terminal/steward | `/api/prompts`, History, Continuity, Dossier-Hilfsjoin | append-only, **keine Rotation und kein Cap** |
| Transcript | jeweiliger Harness/Provider | Claude-View/Summary; pi nur Usage; Codex/container heute nicht integriert | ausserhalb Fleet; provider-spezifisch, Fleet-Retention unbekannt |
| LaneOutcome | `server.ts::buildLaneOutcome` / Disposition | `/api/lane-outcomes`, Akte, Steward-Reports | `appendEvent`, 5-MB-Schwelle, aktuelle + eine `.1`-Generation |
| Audit | `server.ts::audit` | `/api/audit`, Health-/Steward-Projektionen | wie LaneOutcome |
| Post-land audit | Audit-Runner | `/api/post-land-audits`, Board/Steward | wie LaneOutcome |
| Audit-Adjudikation | Ownerroute | Audit-Projektion und Delivery | wie LaneOutcome; Vorschlag und Urteil getrennt |
| Disposition | Ownerroute | Advisory-/Review-Oberflaeche | wie LaneOutcome |

`server.ts::readLedger` liest die beiden Generationen, zaehlt malformed Rows separat und erfindet
keine Vollstaendigkeit. Der Prompt-Log ist der abweichende, unrotierte Pfad.

## Feld- und Join-Matrix

| Frage | Task | Prompt | Slot/Lane | Outcome | Status heute |
|---|---|---|---|---|---|
| Owner-Request / Programm | nein | nein | nein | nein | strukturell unknown |
| Task-ID | eigene `id` | nein | `Task.slot` nur laufzeitnah | nein | nach Ende kein stabiler Join |
| Lane-ID | `slot` | `slot`, `cwd` | Slot-ID + Branch/Worktree | `branch`, optional `repo` | nur ueber cwd/branch heuristisch joinbar |
| Harness | Dispatch/Slot intern | nein | Slot traegt Harness | nein | geht im Outcome verloren |
| Modell | Brief/Analyse-Modell, nicht Executor | nein | Slot traegt Modell | 55/247 non-null | Executor-Modell oft unknown |
| Effort | nein | nein | Slot traegt Effort | nein | geht im Outcome verloren |
| Brief | gespeicherter Text | Founding-Prompt vorhanden | erster Prompt | `briefHash` in 190/247 | Hash-Join moeglich, Task-Join fehlt |
| Verify | Criterion kann Befehl nennen | nein | Merge-State | `verified` bool/null | kein Befehl, Tail, Tier oder Fehlergrund |
| Review | Analyse ist vor Dispatch | nein | Review-State | `review` in 243/247 | brauchbar, aber nicht Task-gebunden |
| Files/Surface | Projection/confirmed optional | nein | Git-Fakten | `filesTouched` 247/247 | Soll/Ist nicht gemeinsam joinbar |
| Context Packs / Skills | nein | nein | nein | nein | 0/247 |
| Korrektur / Stop / Scope-Ausweitung | Comments nur indirekt | Owner-Promptzaehler ableitbar | teilweise Ereignisse | `ownerPrompts`; keine Semantik | fuer alte Rows nicht verlaesslich rekonstruierbar |
| Artefakte | keine Refs | Mention nur Text | Drop im Worktree | keine Refs | stirbt mit Worktree oder wird manuell committed |

Die Slot-ID allein ist kein langlebiger Join, weil Slots recycelt werden. `LaneAnchor` loest die
Elternschaft einer Lane, nicht die Herkunft des Tasks. `worktreePathFor(repo, branch)` ist ein
bewusst stabiler Hilfsjoin fuer alte Prompts, bleibt aber Rekonstruktion statt First-Class-ID.

## Sensible Felder und Datenschutzgrenze

- Prompts, Transkripte, Tasktexte, Comments und Review-Rohantworten koennen Sourcecode, Secrets
  und private Unterhaltung enthalten.
- `fleet.json` traegt Auth-/Share-/Self-Zustand und darf nie Analyseinput fuer einen fremden
  Provider werden, nur weil der Code sie lesen kann.
- `cwd`, `repo`, Labels und Branches koennen lokale Identitaet offenlegen; getrackte Reports
  brauchen relative oder aggregierte Angaben.
- Context-/Skill-Provenienz speichert IDs und Hashes, nicht geladene Inhalte oder Tokens.
- Learning-Reader lesen lokal und persistieren abgeleitete Events mit Evidenzankern, keine zweite
  Vollkopie von Transkripten.

## Minimales Provenienzschema fuer neue Rows

Das Schema wird nur vorwaerts geschrieben; alte Rows bleiben ohne Migration ehrlich unknown.

```text
originId            # eine Owner-/Intake-Absicht; stabil ueber Task-Splits
programId?          # optionale Programmklammer, z.B. agent-os
taskId
laneId              # stabile Run-ID, nicht Slotnummer
repoId + branch + baseSha
harness + model + effort?
briefHash
contextPlanId + contextPlanHash
privateContextHash? + privateContextObservedAt?
skillRefs[]          # id + sourceHash/version
capabilitySnapshotId
taskFacts            # derived files/process/size + promoted taskClass oder unknown
verify               # commandId/hash, status, tailRef, unknownReason
review               # bestehender OutcomeReview-Vertrag
artifactRefs[]
startedAt + endedAt + disposition
```

`originId` entsteht beim Anlegen einer Owner-/Intake-Zeile und wird beim Refine-Split an Kinder
vererbt. `taskId` fliesst beim Dispatch auf den Slot/Run und von dort in **jede** Disposition.
`laneId` wird einmal beim Spawn erzeugt; Slot, Branch oder Session-ID allein ersetzen sie nicht.

## Minimales Learning-/Adjudikationsschema

```text
finding: id, runId, taxonomyVersion, classProposal, severityProposal,
         populationId, denominator, evidenceRefs[], createdAt, model
adjudication: findingId, verdict, correctedClass?, note?, ownerAt
ruleProposal: findingIds[], targetPackOrSkill, expectedEffect, reviewAt, status
```

Findings und Urteile sind getrennte append-only Rows. Alle hohen Risiken plus eine reproduzierbar
gezogene Zufallsstichprobe werden adjudiziert; der Rest bleibt `unadjudicated`. Sampling-Seed,
Population und Nenner gehoeren in den Report, damit der Owner nicht nur die bequemen Rows sieht.

## Retention-Entscheide vor P2/P4

1. Prompt-Log: Cap/Rotation oder bewusst begruendete unbegrenzte lokale Retention festlegen; der
   heutige 6-MB-Pfad waechst ohne Grenze.
2. Provenienz-Ledger: dieselbe zwei-Generationen-Semantik wie `appendEvent` nur nutzen, wenn der
   Lernhorizont die moegliche Rotation vertraegt; sonst separater lokaler Langzeitanker.
3. Findings speichern Evidenzreferenz + Hash + Zeit, nicht Rohtranskript.
4. Private Overlay-Hashes brauchen Zeitstempel; ohne private History sind sie nicht aufloesbar.
5. Artefakt-Retention getrennt behandeln: heutige Drops sterben mit der Lane, dauerhafte Refs
   brauchen einen expliziten Store-/Delete-Vertrag.

## Offene G0-Entscheide

- Ist `originId + taskId + laneId` die minimale stabile Kette?
- Darf Backbone v1 alte Rows ohne Migration als unknown stehen lassen? Empfehlung: ja.
- Welche Provider duerfen fuer P4 welche lokalen Transkripte lesen?
- Welche Retention soll fuer den unrotierten Prompt-Log gelten?

## Nicht geprueft

Keine Volltranskripte wurden gelesen. Der Census validiert parsebare JSONL-Rows, nicht semantische
Korrektheit jedes Feldes. Externe Provider-Retention und private Backups wurden nicht untersucht.
