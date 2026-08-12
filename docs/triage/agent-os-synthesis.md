# Agent OS — G0-Synthese und Owner-Entscheidung

**Stand:** 2026-08-11 · **Status:** G0 `pass`; P1-A ist dieser Landschnitt; Product-Code unveraendert

Diese Datei ist nach G0 die operative Phase-1-Bruecke. Bei Widerspruch gilt heutiger Code-/Ledger-
oder Sensorbefund vor dieser Synthese; der Widerspruch wird hier korrigiert, nicht uebergangen.

## Entscheidung in einem Blick

**Owner-Entscheidung vom 2026-08-11: G0 `pass` fuer einen engen Backbone-v1-Schnitt, nicht fuer das Gesamtzielbild.**

Durch die Owner-Bestaetigung freigegeben:

1. kompakter getrackter Governance-Kern;
2. read-only Context-Pack-Manifest mit Validator;
3. Live-Boot-Matrix vor jedem Rulebook-Split;
4. nur bei positivem Befund: Canary- und redaktionsgesicherter Router-/Overlay-Schnitt;
5. danach Provenienz, Registry/Compiler und manueller Learning Loop bis G4.

Nicht freigegeben: neue Queue-UI, dauerhafter Artefaktstore, Maschinen-Sync, autonome
Adjudikation/Promotion, Land oder Deploy.

## Was Phase 0 gegen den Ausgangsplan korrigiert hat

1. **Kontexthebel:** Primaer wird Prompt-/Tool-Result-Footprint gemessen. Die 5,5-KB-/98,7-KB-
   Regeltraeger bleiben relevant fuer Routing-Korrektheit, aber Bytes allein sind kein Erfolg.
2. **Baseline:** Alte Rows koennen Korrektur, Scope, Harness und Context nicht fair joinen.
   Bestehende n=18-Footprint-Evidenz bleibt historischer Anker; andere Metriken starten ab P2.
3. **Reihenfolge:** Boot-Matrix P1-D liegt vor dem riskanten P1-C-Split. P1-C braucht Canary und
   zweiten Redaktionsblick.
4. **Owner-Engpass:** Gates tragen Minutenbudget und `insufficient-evidence`; P4 adjudiziert alle
   hohen Risiken plus eine reproduzierbare Stichprobe, nicht jede Row.
5. **Private Provenienz:** v1 behauptet fuer private Context Packs nur Content-Hash + Zeitstempel.
6. **Artefakte:** Ein sicherer 20-MB-Worktree-Drop existiert bereits. Phase 6 erweitert ihn um
   explizite dauerhafte Refs/Store-Semantik, statt einen zweiten Upload zu bauen.
7. **Taskklasse:** Mechanische Fakten werden abgeleitet, Modelllabels nur vorgeschlagen und vom
   Owner promotet; sonst `unknown`.
8. **Prioritaet:** Der aktive Queue-/Task-Dashboard-Plan gewinnt bei Konflikt um Owner-Zeit,
   Task-Schema oder Client-Flaeche.

## G0-Vertrag

### Gemeinsames Glossar

Owner entscheidet · Maintainer synthetisiert und schneidet · Harness beschreibt den Executor ·
Slot ist ein wiederverwendbarer Platz · Lane ist isolierte Produktion · Task ist die bestehende
Queue-Einheit · Brief sind die bestaetigten exakten Auftragsbytes · Context Pack ist ein Verweis,
kein Speicher · Capability ist geprobt · Skill ist ein triggerbarer Vertrag · Verify/Land/Deploy/
Audit bleiben getrennte Akte.

### Nicht verhandelbar

- Beobachtung vor Label; unknown bleibt unknown.
- Worker schlaegt vor, Owner promotet.
- Fragen, Diagnose und Review sind read-only.
- Mutation, externe Writes, Host-Sync, Land und Deploy brauchen ihren ausdruecklichen Stopppunkt.
- Eine Wahrheit hat einen mechanischen Traeger; `src/protocol.ts` fuer TS↔TS,
  `e2e/pins.ts` fuer TS↔Doc/Shell.
- Keine Capability ohne Zielprobe und keinen Skill trotz fehlender Requirement routen.
- Keine private Identitaet, Credential-, Host- oder Maschinenrealitaet in den public tree.
- Keine zweite Queue, kein zweiter Wissensspeicher, kein zweites Dashboard.
- Code/Ledger/Sensor gewinnt gegen Planstatus.
- Owner-Aufmerksamkeit ist begrenzt: kleine Vorlagen, feste Budgets, Stichprobe, ehrlicher Exit.

### Private/oeffentliche Trennlinie

**Getrackt:** Glossar, Invarianten, Arbeitsvertrag, Context-Pack-/Registry-Schema, oeffentlich
tragbare Topic-Regeln, Validatoren, pure Projektionen und Tests.

**Privat:** Identitaeten, Credentials, Host-/Netz-/Deploy-Realitaet, Maschineninventar, private
Skillpfade, Prompt-/Transcript-Inhalte und lokale Artefakte.

Das private `CLAUDE.md` bleibt bis zu P1-D unangetastet. Ein spaeterer Split verschiebt nur
oeffentlich tragbare Regeln nach Canary und Redaktionsreview. Private Quellen erhalten in v1 Hash
+ Zeitstempel; eine aufloesbare Version braucht eine separate private History.

## Minimale Provenienz fuer Backbone v1

Pflicht auf jeder **neuen** Lane/Outcome-Kette oder mit benanntem Unknown-Grund:

```text
originId · programId? · taskId · laneId
repoId · branch · baseSha
harness · model · effort?
briefHash
contextPlanId · contextPlanHash
privateContextHash? · privateContextObservedAt?
skillRefs[] · capabilitySnapshotId
derived task facts · promoted taskClass or unknown
verify { commandId/hash, status, tailRef?, unknownReason? }
review · artifactRefs[]
startedAt · endedAt · disposition
```

Altrows werden nicht migriert. `originId` ueberlebt Task-Splits; `laneId` ueberlebt Slot-Recycling;
`taskId` fliesst bei jeder Disposition bis zum Outcome.

## Minimales Skill-/Capability-Modell

```text
id · kind · scope(repo/user/harness/machine/container) · provider
triggers[] · jobs[] · requirements[]
authority(read-only/worktree/repo-metadata/host/network/external)
mutationStop · sourceHash/version? · targets[] · status · probe
```

Erster Registry-Inhalt: vier Harness-Ziele, der harte Arbeitsvertrag, Verify/E2E-Pack und
`graphify-query`. `graphify-build-update` bleibt eigener mutierender Vertrag mit Stop vor Install,
Netzfetch, Watcher oder externem Push.

## Backbone-v1-Schnitt

| Phase | Liefert | Stop/Gate |
|---|---|---|
| P1 | Kern, Manifest, Boot-Beleg, optional gesicherter Split | G1: Loader+Canary+Redaktion |
| P2 | Herkunfts-/Task-/Lane-/Executor-/Context-Join | G2: neue Rows vollstaendig oder named unknown |
| P3 | Registry, Requirements, purer Context Compiler, inspectable Plan | G3: 0 Fehlroutings |
| P4 | manueller Normalizer, Findings, Sampling-Adjudikation, Proposal/Lifecycle | G4: zwei belegte Laeufe |

Phase 5–8 bleiben Expansion und brauchen eigene Owner-Freigabe. Besonders Task UI wartet auf den
Queue-Plan; Artifact Store wartet auf G5/G6.

## Gate- und Owner-Budget

| Gate | Budget | Evidenz |
|---|---:|---|
| G0 | 30 min | diese Entscheidung plus vier Inventare/Baseline |
| G1 | 25 min | kontrollierte Boot-/Canary-/Redaktionsmatrix |
| G2 | 20 min | ein End-to-End-Join + neue Row-Coverage |
| G3 | 20 min | positive und negative Routing-Proben |
| G4 | 45 min je Lauf | alle hohen Risiken + max. 12 Rows oder 20 % der Restpopulation |

Population-Gates enden nach 10 vergleichbaren Lanes oder 14 Tagen in `pass`, `fail` oder
`insufficient-evidence`. Letzteres verlangt eine Owner-Entscheidung; es ist kein stiller Waiver.

## Durch G0 bestaetigte Owner-Entscheide

| # | Entscheid | Empfohlener Default | Auswirkung |
|---|---|---|---|
| 1 | Programmname | `Agent Operating System` | nur Arbeitsname, kein neues Runtime-Produkt |
| 2 | Backbone v1 | Phasen 1–4 wie oben | verhindert Feature-Fan-out |
| 3 | Oeffentlich/privat | getrackter Kern + privates Overlay | P1-C bleibt bedingt durch Boot/Canary/Redaktion |
| 4 | Private Version | v1 Hash+Zeitstempel | kein falscher Versionsclaim; private History separat |
| 5 | Adjudikation | alle hohen Risiken + Zufallsstichprobe | Owner-Budget bleibt begrenzt |
| 6 | Transcript-Provider | lokal/gleicher vertrauter Provider; cross-provider explizit | bestimmt P4-Reader |
| 7 | Erste Learning-Population | Claude zuerst; Codex erst nach gemessenem Rollout-Normalizer | heutiger Codex-Adapter hat keinen Context-/Transcript-Reader |
| 8 | Queue-Prioritaet | Queue-Plan gewinnt bei Konflikt | Agent OS baut keine parallele UI |
| 9 | Artifact v1 | privat; vorhandener Drop als kurzlebiger Ingress | kein Public Sharing, kein zweiter Upload |

Die Owner-Anweisung vom 2026-08-11 bestaetigt diese Tabelle als G0 `pass`. Spaetere Abweichungen
bleiben explizite Owner-Entscheide.

## Aktueller Landschnitt nach G0

**P1-A — Governance-Kern, nur getrackte Docs/Types, kein privater Split — ist dieser implementierte Landschnitt.**

- **Done:** Glossar, Invarianten, Arbeitsmodi und Stopppunkte stehen kompakt in einem getrackten
  Kern; `AGENTS.md` verweist eindeutig darauf; bestehende Verify-/Land-Regeln bleiben must-agree;
  keine private Information gelangt in den Diff.
- **Verify:** `bun e2e/pins.ts`, pure Anchor-/Schema-Proben, kompletter Repo-Gate soweit die Lane
  ihn ausfuehren kann.
- **File Ownership:** `AGENTS.md`, ein neues kleines Agent-Kontext-Modul, `e2e/pins.ts`; keine
  gleichzeitige Rulebook-Lane.
- **Stop:** commitbarer Diff und Report; kein `CLAUDE.md`, kein Land, kein Deploy.

P1-B beginnt erst nach dem P1-A-Land. P1-D misst danach live; P1-C bleibt bis zum P1-D-Beleg
plus einer expliziten Owner-Entscheidung gesperrt.

## Phase-0-Artefakte und Attic-Regel

Mit diesem P1-A-Landschnitt werden `agent-os-rules.md`, `agent-os-skills.md`, `agent-os-data.md`
und `agent-os-surfaces.md` mechanisch nach `docs/attic/agent-os-2026-08-11/` verschoben. Die
Baseline bleibt als datierter Vergleichsanker; diese Synthese und der Masterplan tragen den
operativen Status.

## Nicht gebaut

Kein Product-Code, Context-Compiler, Ledgerfeld, Skill-Sync, Upload, Store, UI, Rulebook-Split,
Task oder automatische Aktion wurde erzeugt. G0 ist `pass`; P1-B, P1-D und P1-C wurden nicht
begonnen.
