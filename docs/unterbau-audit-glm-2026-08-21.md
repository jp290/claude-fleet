# Unterbau-Audit der GLM-Rollenarchitektur (2026-08-21)

Status: **Read-only-Audit der Maschinerie UNTER dem Vorschlag.** Baum `de1f6c6` — derselbe
Baum, gegen den Dossier und Vorschlag erhoben wurden; jede unten zitierte Stelle habe ich selbst
gelesen. Prüfgegenstand: `docs/rollen-architektur-glm-2026-08-21.md` (A–I) gegen
`server.ts`, `context-packs.ts`, `context-plan.ts`, `context-manifest.ts`,
`context-pack-validator.ts`, `analysis-staleness.ts`, `e2e/pins.ts`, `e2e/context-packs.ts`.
Zwei Fragen, keine dritte: **welche Annahme trägt der Unterbau nicht** · **welche gebaute
Maschinerie wird übersehen**. Kein Gegenentwurf, kein Rollenurteil, keine Wiederholung des
Opus-Kritikers. `land-candidate.ts` als Reuse-Fall ist bereits gemeldet und wird nicht
wiederholt.

Beweisdisziplin: jeder Befund trägt **VERIFIED** (selbst gelesen, `datei:stelle`) oder
**INFERRED** (Schluss aus Gelesenem, Lücke benannt), nennt eine konkrete Fehlerfolge, und endet
mit genau einer Empfehlung aus `fix · reuse · retire`.

---

## 1. Die zwei Owner-Fragen

### 1.1 Fuegt der Interventions-Rail notwendige Kontrolle hinzu oder vermeidbare Komplexitaet?

**Antwort: Die Typisierung ist notwendige Kontrolle zu null Maschinenkosten — aber zwei seiner
Bindungen sind heute Behauptungen ohne Traeger, und der harte Teil (das Defekt-Verdikt) misst
etwas, das niemand aufzeichnet.**

Welche Bindungen die heutigen Mechanismen **wirklich herstellen** (alle selbst verifiziert):

| Bindung | Traeger | Beleg |
|---|---|---|
| Empfaenger-Occupant-Triple | `FleetEventBase` traegt `receiverSlot/openedAt/sessionId` (server.ts:1247–1256); jeder Transportversuch re-prueft live (`fleetEventReceiver` :5369); der Nudge prueft den MAIN-Occupant frisch (supervisorNudge :13446ff.) | VERIFIED |
| Ack | `POST /api/self/events/:id/ack` (:16648) — quadriert Empfnger-Slot UND Occupant, verweigert Inbox-Self-Ack | VERIFIED |
| Zustellbudget | `FLEET_EVENT_MAX_OPEN_PER_SLOT` (:2561), geprueft bei jeder Neumintung (openClarification :5404–5408, openFleetReport :5487–5491) | VERIFIED |
| Begrenzte Nutzlast | 2000 Zeichen Nudge/Attention/Clarification (:2570, :2583→2563, :2566, :13279), 4000 Fleet-Report — hart validiert | VERIFIED |
| Quittung | `sendId` VOR Transport gemintet; `audit("supervisor_nudge")`; `logPrompt(..., nudgeId, "sent"\|"uncertain")`; HTTP-Receipt | VERIFIED |
| Toter Empfaenger | `receiver-gone` terminal (:1245), gesetzt bei Teardown UND Boot (:5374, Boot-Sweep bei :14395ff.), `pruneFleetEvents` | VERIFIED |
| Verweigerung mit Grund | jede Kante 409 mit benanntem Gate (`canDeliver` :5943–5968, sechs benannte Gates :5942) | VERIFIED |

Welche Bindungen **Behauptungen ohne Traeger** waeren:

1. **`attemptId`/`stepId`** — eigene Symbolprobe `rg -uu -g '*.ts' -g '!node_modules'`: **0
   Treffer** im ganzen Baum. VERIFIED. Der Vorschlag kennzeichnet sie als fehlend — richtig —,
   aber jede Rail-Zeile, die sie als Join anbietet, ist bis dahin Typ ohne Instanz.
2. **Staleness-Bindung an die ARBEIT.** Es existiert genau eine Staleness-Maschinerie
   ausserhalb des Land-Pfads: `analysis-staleness.ts` (reine Regel, an Datei-Flaeche gebunden,
   unknown fail-closed) plus `TaskAnalysis.head`/`fillMovedSurface` im Dispatcher (:6991–6996).
   Kein Nudge-, Clarification- oder Reply-Weg bindet eine Handlung an einen bewegten Branch-Tip.
   VERIFIED (contextOmissionFor ist die einzige „Leiter" dieser Art im Frage-Transport;
   `analysisStale` :7001 ist ihr einziges Vorbild).
3. **Das Adapter-Defekt-Verdikt (H.4) zaehlt Beobachtungen, die nicht existieren.** H.4
   verlangt „zwei konsekutive Fehlzustellungen derselben (Empfaenger, Gate)-Paarung". VERIFIED:
   **keine** Nudge-Verweigerung schreibt irgendeine Zeile — alle 409-Pfade in supervisorNudge
   returnen ohne `audit(...)`; `writeStewardJournal` hat genau drei Aufrufstellen (:14850, :16313,
   :18882), keine davon im Nudge. Ein Verdikt ueber zwei Fehler benoetigt einen
   Fehler-Eintrag; den gibt es fuer diese Kante nicht. (Das Vorbild existiert und wird unten
   als Reuse gemeldet: `tickAutos` bucht Policy-Verweigerungen als `auto_skip`.)
4. **Die „Journal-Zeile" des Nudge existiert nicht** (Befund B4) — Dossier §12 UND GLM H.1
   behaupten sie; der Code schreibt nur audit + prompt-log.

**Kante B (MAIN→Lane) ist anschliessbar, und der Vorschlag sagt das richtig:** Transport,
Ack, Budget und receiver-gone stehen komplett und sind empfaengeragnostisch (ein
FleetEvent kann eine Lane als Empfaenger tragen; die Zustellschleife tickWatches :8877–9023
fragt nichts ueber Rollen). Der Neubau ist nicht der Transport, sondern die **Minting-Quelle**
(wer darf das Event erzeugen, gegen welche Budget-Zelle) plus die Staleness-Bindung. Beides ist
im Vorschlag als NEU markiert — die Annahme „kein zweiter Transport" haelt.

**ROUTE_OVERRIDE am lebenden Slot:** korrekt verneint (Spawn-Invariante, Modell/Effort nur bei
open/restart). VERIFIED indirekt: keine Route schreibt `model`/`effort` eines lebenden Slots
(Slot-Kommentar „chosen at spawn … cleared on open/kill"); der Klick-Koerper liest
harness/model/effatt (:18582–18590, selbst gelesen). Der Konsum-Punkt der GLM-Behauptung stimmt.

**Urteil:** necessary als Typisierung (sie benennt existierende 409s nur neu und macht die
Owner-Regel greifbar), vermeidbar als Verdikts-Maschine, solange der Beobachtungstraeger fehlt.
Der kleinste echte Schritt, der den Rail hart macht, ist eine Verweigerungs-Zeile am Nudge —
nicht ein neues Register.

### 1.2 Koennen die heutigen Context-Pack-Manifeste, Receipts und Promotions-Flaechen den Wissens-Aufnahmepfad tragen?

**Antwort: vier der fuenf Stationen traegt der Unterbau unmittelbar. Der Pfad scheitert heute
nicht am Receipt und nicht am Manifest, sondern an drei Stellen: das Lizenz-Gate hat keinen
Maschinenleser, der Wirksamkeitsbeweis hat keinen Auswahl-Trager, und die Rollen-/Act-Auswahl
existiert noch nicht als Leiter-Kontext. Ausserdem sprengt der vorgeschlagene canary-Zwischenzustand
die Owner-Grenze „genau fuenf Stationen".**

Je Bindung Traeger oder Luecke:

| Station / Bindung | Traeger? | Detail |
|---|---|---|
| Nicht-normative Quelle (Kandidat ausserhalb des Baums) | **ja, eingeschraenkt** | Vorschlag ueber attention/propose_task-Text + Scratch-Artefakt. VERIFIED: `/api/self/attention` ist non-lane-only (:16641–16643 „a lane may not raise attention"); propose_task ist nach Schnitt 1 bound-main-only. **Eine Lane (Worker/Critic) hat keinen Vorschlagsweg** (B5). Nutzlast: 2000 (attention) / 20 000 (Task-Text). |
| EINE gepruefte Promotions-Entscheidung | **teils** | Trager: der Owner-Commit selbst — alle Datei-Schreib-Routen liegen hinter der Wand (:16999–17000, selbst gelesen), kein Agenten-Credential setzt eine getrackte Manifest-Zeile. Luecke 1: das Lizenz-Urteil ist **mechanisch nicht durchsetzbar** — `PACK_KEYS` ist geschlossen, ein `license:`-Feld scheitert als `PACK_UNKNOWN_KEY` (context-pack-validator.ts:89, :164), der Kandidat lebt ausserhalb des Baums und wird von keinem Maschinenschritt gelesen (B2). Luecke 2: GLM macht aus der EINEN Entscheidung **zwei** Owner-Commits (proposed→canary, canary→promoted) plus einen Evaluationsvertrag — Grenzverstoß (B7). |
| Bestehendes Ziel/Pack-Manifest | **ja, vollstaendig** | VERIFIED: Manifest getrackt, am Commit gelesen, den das Receipt behauptet (`git show head:path`, von e2e/pins.ts als REGEL gepinnt); geschlossen validiert (context-pack-validator.ts); Fleets eigenes Manifest ist land-gepinnt („unlandable while invalid"). Fremdes Material ist nur darstellbar als destillierte eigene Worte in einer getrackten Datei oder als private Hash-Referenz (`SOURCE_PATH_INVALID`/`SOURCE_PATH_MISSING` fuer alles andere) — der Vorschlag bildet das in I.4 korrekt ab. |
| Deterministische Rollen-/Act-Auswahl | **nein — Luecke, anschliessbar** | VERIFIED: `ContextPlanContext` kennt `{sourceAvailable, harness, mode, triggers, capabilities}` (context-plan.ts:57–63) — weder Rolle noch Act. Rolle ist am Seam ableitbar (Dispatch=Founding-Lane, Bootstrap=program-main/supervisor), Act hat **kein Vokabular** (`TASK_KINDS` ist Anfrage-Kategorie, nicht Act). Neue Selektoren brauchen zwingend ein Reachability-Aequivalent zum Trigger-Pin, sonst entstehen „authored, validated, committed, and silently never delivered"-Packs — der Pin (e2e/pins.ts:1185ff.) sagt diese Folge fuer Trigger heute schon wortgleich (B11). |
| Bestehendes Receipt | **ja, vollstaendig** | Alle vier Fundstellen des Owner-Briefs verifiziert: Schreibung server.ts:6376ff. mit `selected`/`omitted:{id,why}`; why-Vokabular geschlossen (context-plan.ts:13–22); Leseflaeche `GET /api/context-receipts` (:17316, Owner-Tier, rows-as-written); Auswahl rein (`contextOmissionFor` :78). Die Maschinerie leistet, was der Brief von ihr behauptet. |

Drei weitere Bindungen des Pfads, geprueft:

- **Verschwindender Anker:** repo-deklarierte Packs werden als `manifest-invalid` omittiert und
  IN DER RECEIPT benannt (context-manifest.ts:96–104: „an anchor Fleet could not check is exactly
  as undeliverable as one it checked and did not find"). Ehrlich, receipted — aber grob: der
  Grund nennt eine Datei-Klasse, nicht den toten Anker; die Pack-ID macht es trotzdem auffindbar.
  Fleet-Seeds werden am Seam NICHT neu geprueft, sondern von der Land-Gate-Familie gehalten
  (e2e/context-packs.ts:84–87 validiert die realen Seeds gegen den realen Baum). Kein Befund.
- **`estimatedBytes`:** deklarativ. Eigene Suche: **null Konsumenten** ausserhalb der
  Kontext-Module (nur e2e-Fixtures). Kein Budget am Seam, kein Vergleich mit `deliveredBytes`
  (B8).
- **`status ≠ active` heute:** `status-not-active`, generisch (context-plan.ts:80) — die
  GLM-Diagnose „ein canary wuerde als nicht-aktiv verschluckt statt benannt" stimmt; ihr
  gepaarter Grund ist der richtige Schnitt. Aber der Mess-Nutzen des Zustands ist zirkulaer (B1).

---

## 2. Befunde, gerangt nach Fehlerfolge

### B1 — Der Wirksamkeits-Canary hat keinen Auswahl-Träger: die Promotion-Regel verhungert strukturell. [Flaechen 12, 11]

**VERIFIED.** GLM F (Schnitt 5) und I.2 verlangen fuer `canary → promoted` einen
Zweiarms-Beweis: „Pack ausgewaehlt vs. omittiert, die Receipt benennt den Arm". Die Leiter
prueft `pack.status !== "active"` **vor** harness, mode und triggers
(context-plan.ts:79–85: Reihenfolge sourceAvailable → status → harness → mode → triggers →
capabilities). Ein `status:"canary"`-Pack wird fuer **jede** Zustellung deterministisch
omittiert; es gibt keinen zweiten Auswahlweg: `planContext` (context-plan.ts:94) und
`planRepoContext` (context-manifest.ts:76) sind die einzigen Planquellen, kein Override, kein
per-Session-Schalter — und letzterer waere nach Owner-Grenze verboten. **Fehlerfolge:** der
geforderte Beweis kann unter dem vorgeschlagenen Mechanismus nie entstehen; „canary" ist ein
Zustand, den nichts misst; jede canary-Phase endet entweder ohne Beweis in `retired` oder die
Regel wird still umgangen. Der messbare Ausweg existiert — ein lane-lokales Manifest, das den
Pack am Lane-Head als `active` traegt (der Seam liest `git show <head>:<path>`,
e2e/pins.ts:1058–1076) — ist aber nicht der vorgeschlagene und macht den canary-Status fuer das
Experiment selbst redundant. **Empfehlung: `retire` — den canary-Status streichen; den
Wirksamkeitsbeweis (falls gewollt) ueber ein lane-lokales aktives Manifest fahren, wofuer der
Unterbau heute schon alles mitbringt.**

### B2 — Die Lizenz-Promotions-Gate ist eine Behauptung ohne Maschinenleser. [Flaeche 12]

**VERIFIED.** GLM I.2: „Lizenz-Urteil ist Pflichtfeld; `unknown` blockiert Promotion mechanisch
(Validator-Gate)". Fakt: `PACK_KEYS` ist geschlossen (context-pack-validator.ts:89–93); ein Pack
mit `license:`/`provenance:`-Feld scheitert als `PACK_UNKNOWN_KEY` (:164). Der Kandidat lebt
nach I.1 ausserhalb des Baums („Session-Artefakt"), und **kein** Route, Tick oder Validator
liest ihn — es gibt keine Kandidaten-Route, kein Ledger-Feld, keinen Prompt. **Fehlerfolge:**
die einzige harte Regel des Aufnahmepfads fuer ein oeffentliches Repo wird nur durch Prosa
getragen; nach der Promotion ist im Baum von einem `unknown`-Urteil nichts mehr trennbar — der
 spaetere Leser (und jeder Lizenz-Streit) findet einen sauberen Zeiger ohne Herkunft. Genau das
Risiko, das Dossier §13.3 als „riskanteste Luecke" misst, wird vom Vorschlag benannt und dann
doch nicht mechanisiert. **Empfehlung: `fix` — entweder Lizenz/Provenienz als geschlossene
Pflichtfelder ins Pack-Schema aufnehmen (dann validierbar, pin-bar, in der Receipt sichtbar)
oder die Behauptung „mechanisch" streichen; ein halb-mechanische Gate ist schlimmer als ein
ehrlich prozessuales.**

### B3 — Die Steward-Falte nimmt an, die Supervisor-Bindung trage das Label — das Label markiert aber „Nicht-Lane TROTZ Worktree". [Flaeche 1, Rollenschnitt]

**VERIFIED.** Der Steward-Sitz ist ein **Worktree**-Sitz; genau deshalb braucht die
done-looking-Probe die Label-Ausnahme `s.worktree && s.label !== STEWARD_LABEL`
(:16578–16591, 9 Vorkommen) und das fleet-report-Gate `!s.worktree || s.label ===
STEWARD_LABEL` (:16614–16616). `isBoundSupervisor` (:13268) prueft NUR `slot+openedAt`, kein
worktree; dass ein Supervisor nie Lane ist, ist laut Kommentar :13261–13263 eine **Konvention
der Bootstrap-Route** („the bootstrap opens a plain session"), keine Mechanik. GLM E.6 sagt zum
Aufloesen des Routers „nichts [bricht], wenn 1–5 vorher kamen". **Fehlerfolge:** Entfaellt das
Label (Schnitt 4) und die Verbundproben verkuerzen sich auf `s.worktree`, dann wird der
Supervisor-Sitz — falls er wie der heutige Puls einen Worktree haelt — lane-klassifiziert:
done-looking, und ihm stehen lane-only-Faehigkeiten zu (clarification, fleet-report, drift,
gate, criterion), die der Rollenschnitt der beobachtenden Rolle gerade aberkennen will. Oder die
Puls-Session muss ihre Arbeitsform (Worktree) aufgeben — ein Betriebswechsel, den der Rueckbau
nicht benennt. **Empfehlung: `fix` — in Schnitt 3/4 explizit entscheiden: entweder die
Bindungspraedikate (`isBoundSupervisor`, ggf. `boundProgramForMain`) in die Lane-ness-Proben
aufnehmen, oder den Pulse-Sitz vor Schnitt 4 auf einen plain session umsiedeln; beides ist
klein, aber eines von beiden ist Pflicht.**

### B4 — Die Nudge-Quittung ist duenner als Dossier UND Vorschlag behaupten: es gibt keine Journal-Zeile, und Verweigerungen schreiben ueberhaupt nichts. [Flaechen 11, 13]

**VERIFIED.** supervisorNudge (:13446–13545, vollstaendig gelesen) schreibt bei Erfolg
`audit("supervisor_nudge", ...)` und `logPrompt(..., nudgeId, "sent")`, bei unsicherem Ausgang
`logPrompt(..., "uncertain")` — und **nichts sonst**. `writeStewardJournal` hat genau drei
Aufrufstellen (:14850, :16313, :18882), keine im Nudge. Dossier §12 („Receipt + eine
Journal-Zeile") und GLM H.1 (Quittung „steward-journal.jsonl :85 + audit.jsonl") sind beide
falsch; auch der Codekommentar („the one journal line") beschreibt eine Zeile, die nicht
existiert — Doc-gegen-Code, der Widerspruch ist selbst der Befund. Schwerer wiegt die zweite
Haelfte: **jede** 409-Verweigerung des Nudge (unbekanntes Programm, Occupant weg, awaiting
owner, canDeliver-Hold) returnet ohne jeden Ledger-Eintrag. **Fehlerfolge:** (a) Ein Audit, das
das Steward-/Supervisor-Journal liest, sieht null Interventionen — die einzige vollstaendig
gebaute Interventions-Kante ist im Register unsichtbar. (b) H.4s Verdikt-Regel („zwei
konsekutive Fehlzustellungen derselben (Empfaenger, Gate)-Paarung") hat keinen zaehlbaren
Sachverhalt: nicht einmal EIN Fehlzustand wird aufgezeichnet. Ein Rail, der ein Defekt-Verdikt
verspricht, aber Verweigerungen verschluckt, typologisiert eine Beobachtung, die nirgends
entsteht. **Empfehlung: `fix` — eine `audit`-Zeile je Nudge-Verweigerung mit Gate-Namen (das
Muster existiert: `auto_skip` in tickAutos); damit traegt der Unterbau H.4s Zaehlung sofort und
ohne neues Register.**

### B5 — „Jeder Agent" kann keinen Kandidaten vorschlagen: Lanes haben keinen Aufnahme-Weg. [Flaeche 12]

**VERIFIED.** GLM I.2, Uebergang ∅→proposed: „jeder Agent (Vorschlag auf D-Kante/propose_task)
oder Owner". `/api/self/attention` verweigert Lanes ausdruecklich (:16641–16643); propose_task
ist nach Schnitt 1 `boundProgramForMain`-only. Eine Lane hat genau fleet-report (≤4000, an genau
eine server-hergeleitete MAIN) und clarification (≤2000, eine offen). **Fehlerfolge:** fremdes
Praxismaterial wird typischerweise von Workers/Critics gesehen; der vorgeschlagene Pfad
erzwingt ein Relay durch die MAIN (die das Material aus dem fleet-report-Exzerpt — 4000 Zeichen,
vom Worker gekuerzt — neu formulieren muss). Der Kandidat, der beim Owner ankommt, ist dann
sekundaer; die Kandidaten-Integritaet (Zitat, Anker, Lizenz) hat keinen direkten Weg vom
Beobachter zur Entscheidung. **Empfehlung: `fix` — die Behauptung auf „gebundene MAIN oder
Owner" korrigieren; wenn Lanes vorschlagen sollen, ist das eine bewusste Erweiterung von
fleet-report (nuance: dort existiert bereits `taskId/originId/programId` als Provenienz), nicht
eine Selbstverstaendlichkeit des Pfads.**

### B6 — Die Controller-Begruendung nennt Lese-Sichten, die anderen Prinzipalen gehoeren. [Rollenschnitt, Flaeche 1]

**VERIFIED.** GLM A, Kandidat „Globaler Controller": „Mit Leseautoritaet ist er eine MAIN …; die
dafuer noetigen Lese-Sichten existieren (Steward-Digest :16083, supervisor-view :16518,
Owner-Board-Routen)". Fakt: der Steward-Digest liegt im Steward-Router hinter dem
Steward-Credential (:16083 in `handleStewardRoute`); `supervisor-view` verweigert jeden
Nicht-gebundenen Supervisor mit 409 (:16522, `isBoundSupervisor`-Gate — vom Canary P4 live
bestaetigt); die Board-Routen liegen hinter der Owner-Wand (:17000). Eine Fleet-scope MAIN
(plain non-lane session) liest: `self`, `flakes`, `autos`, `programs`, `program-execution` —
und sonst 403/409. **Fehlerfolge:** die Verneinung der Controller-Rolle stuetzt sich auf eine
Faehigkeit („kann alles Lesen, was er braucht"), die dieser Prinzipal nach heutigem Unterbau
nicht hat. Eine solche MAIN waere auf attention-Eskalation an den Owner angewiesen — der
Rollen-Verzicht waere also nicht kostenlos, wie der Abschnitt suggeriert. **Empfehlung: `fix` —
die Begruendung korrigieren („die Sichten existieren, aber gebunden an Steward/Supervisor/Owner;
eine Fleet-MAIN haette sie nicht"). Ein Oeffnen von supervisor-view fuer MAINs waere ein
eigenstuetziger Owner-Entscheid, kein Rand des Rollenschnitts.**

### B7 — Der canary-Zwischenzustand ist eine sechste Station gegen die Owner-Grenze. [Flaeche 12, Grenzverstoß]

**VERIFIED** (als Verstoss gegen die bindende Verengung, nicht als Code-Widerspruch). Die
Owner-Grenze vom 2026-08-21 nennt genau fuenf Stationen und „EINE gepruefte
Promotions-Entscheidung". Der vorgeschlagene Pfad hat: Kandidat (∅→proposed) → **proposed→canary
(Owner-Commit eines Packs mit `status:"canary"` IN den getrackten Baum)** → canary→promoted
(Owner-Commit plus gelaufener Wirksamkeits-Canary) → retired. Das ist eine zusaetzliche
Baum-Station mit eigener Entscheidung, eigenem Zustandswert, gepaartem Auslassungsgrund und
einem Evaluationsvertrag — exakt die „Freigabe-Buerokratie", die die Grenze ausschliesst. Der
Vorschlag zitiert die Grenze mehrfach und haelt sie fuer Station 3–5, nicht aber fuer den
canary-Zwischenzustand selbst. **Fehlerfolge:** ein oeffentliches Repo traegt zukommaende
nicht-normative Zustaende im getrackten Manifest, die kein Konsument je sieht (Leiter omittiert
sie), deren Pflege (supersedes-Ketten, Statuspflege) aber Commit-Arbeit erzeugt; und der
„erste Schnitt bleibt klein" wird um eine ganze Zustandsklasse erweitert, bevor die fuenf
erlaubten Stationen einmal gelaufen sind. **Empfehlung: `retire` — im ersten Schnitt gibt es
nur „Kandidat (draussen) → ein Owner-Commit (active) → Receipt"; der canary-Zustand gehoert in
die Beweis-Ebene (lane-lokales Manifest, s. B1), nicht in die Ziel-Flaeche.**

### B8 — `estimatedBytes` ist Dekoration: der zaehlte Deckel existiert nicht. [Flaeche 12]

**VERIFIED.** GLM I.6 zaehlt als Deckel (2) „`estimatedBytes` + Omissions-Leiter begrenzen jede
Zustaellung". Eigene Suche: `estimatedBytes` hat **null Konsumenten** ausserhalb der
Kontext-Module (grep ueber server.ts, src/protocol.ts, src/client.ts, capability-map.ts,
e2e/pins.ts: nichts; Treffer nur in e2e-Fixtures als Testdaten). Die Leiter begrenzt, **welche**
Packs ausgewaehlt werden — nie eine Byte-Summe; es gibt kein Budget am Seam und keinen Vergleich
mit dem gemessenen `deliveredBytes` (das in jeder Receipt-Zeile steht, aber gegen nichts gelegt
wird). Der groesste Seed traegt 99 108 `estimatedBytes` (private-deploy-overlay,
context-packs.ts:195) und ist unbeschadet dessen zustellbar — weil der Renderer nur die
Pointerzeile liefert. **Fehlerfolge:** die Anti-Blaehungs-Begruendung des Aufnahmepfads steht
zu einem Drittel auf einem Feld, das nichts entscheidet; wer den Deckel glaubt, stellt
Sicherheitsrechnungen an, die der Seam nicht haelt (ein manifest mit 64 Packs kleinen
Schaetzwerts rendert 64+ Zeilen unterm Brief, unbudgetiert). **Empfehlung: `fix` — entweder ein
echtes Budget am Seam (Summe der `estimatedBytes` der selected Packs mit gepaartem
Auslassungsgrund bei Ueberschreitung) oder die Deckel-Aufzaehlung auf die drei tragenden
Deckel kuerzen.**

### B9 — Staleness an der Arbeit: kein Traeger — aber die wiederverwendbare Regel steht schon da. [Flaeche 11, Reuse]

**VERIFIED** (Traegerlosigkeit) **+ reuse-Vorschlag.** Kein Frage-/Nudge-/Reply-Weg bindet
eine Handlung an den Zustand der Arbeit; `attemptId/stepId/traceId` haben 0 Treffer (eigene
Probe). GLM H.2 kennzeichnet die Kante-B-Bindung („Gruender-Task-ID + Lane-Branch-Tip, 409 bei
bewegtem Tip") als NEU — richtig —, nennt aber nicht, dass die Form **zweimal bereits existiert**:
`analysisStaleness` (analysis-staleness.ts:31–46: reine Regel, an die Datei-Flaeche der Zeile
gebunden, unknown fail-closed) und der Dispatcher, der den Tip dafuer frisch liest statt zu
cachen (server.ts:6984–6996 samt `fillMovedSurface`). Fuer Kante B ist das der natuerliche
Anschluss: die Gruender-Task traegt bereits eine Flaechen-/Tip-Historie (analysis), und die
ClarificationRequest bindet die Worker-Identitaet schon an `{slot, openedAt, sessionId, cwd,
branch}` (:1319–1322). **Fehlerfolge ohne Reuse:** eine zweite, abweichende Staleness-Definition
entstünde nahe einer bestehenden reinen, gepinnten — zwei Regeln fuer dieselbe Frage
(„hat sich der Boden bewegt, auf dem diese Zeile steht") driften auseinander, und der Pin, der
die eine haelt, kennt die andere nicht. **Empfehlung: `reuse` — die Kante-B-Staleness als
Anwendung von `analysisStaleness` (oder seiner Faktenform) definieren, nicht als neue Regel.**

### B10 — `originId` ist ein Bracket, keine Kette; der Vorschlag widerspricht sich selbst zu `respondsTo`. [Flaeche 5]

**VERIFIED.** `Task.originId` ist der „stable bracket around tasks minted from one request"
(server.ts:1639–1642): Wurzeln nehmen die eigene id, refine-Kinder erben. GLM H.2
(REPAIR_ATTEMPT) nennt als Bindung „`originId`-Kette [gemessen :16243] + respondsTo-Finding-ID
(neu, als Audit-Detail)"; GLM I.7 (Nichtbau-Liste) sagt das Gegenteil: „kein respondsTo-Pflichtfeld
— die vorhandenen Provenienz-Felder (taskId/originId/programId) tragen den Findungsweg bereits".
Beides kann nicht gleichzeitig gelten: eine Repair-Task, die auf ein Finding antwortet, startet
nach heutiger Form einen EIGENEN Bracket (neue Wurzel mit eigenem originId), es sei denn, die
neue Route erbt ausdruecklich — dann ist es aber genau das „respondsTo", das I.7 verneint, nur
unter anderem Namen. **Fehlerfolge:** wenn H.2 gilt, entsteht ein dritter Join neben
audit-detail und provenance (Duplikat); wenn I.7 gilt, ist die H.2-Zeile „Bindung: originId-Kette"
falsch adressiert — der Rueckschluss „welches Finding hat diese Repair erzeugt" bricht fuer jede
nicht-refine-Verwandtschaft. **Empfehlung: `fix` — eine Form waehlen und die andere Streichen;
der konsistenteste Ort ist das Feld `Task.originId`-Vererbung an der neuen Route (kein neues
Feld, keine dritte Wahrheit).**

*— Schnittlinie: ab hier kosmetisch bzw. strukturelle Hinweise ohne unmittelbare Betriebsfolge —*

### B11 — Neue Rolle/Act-Selektoren brauchen ein Reachability-Aequivalent, sonst entstehen stille Regal-Packs. [Flaeche 13]

**VERIFIED** (Pin existiert) **+ INFERRED** (Folge fuer neue Selektoren: ich schliesse aus dem
Pin-Text auf den Fall, der fuer Rolle/Act noch nicht existiert). e2e/pins.ts haelt heute per
REGEL fest, dass jeder aktive Pack mindestens einen Trigger hat, den einer der **drei** Seams
tatsaechlich durchreicht (DISPATCH_CONTEXT_TRIGGERS :6202, BOOTSTRAP_CONTEXT_TRIGGERS :12846,
landingAnchorBlock), inkl. einer expliziten DORMANT-Liste (`task-queue`, `harness-selection`,
`deployment`). Schnitt 5 fuegt Rolle/Act als Selektoren hinzu, ohne dieses Muster zu erweitern.
**Fehlerfolge:** ein Pack mit Rolle/Harness-Kombination, die an keinem der Seams je abgefragt
wird, wird validiert, committet und dann still nie ausgewaehlt — der exakte Fall, fuer den der
Pin steht („authored, validated, committed, and silently never delivered"). **Empfehlung:
`reuse` — das Trigger-Reachability-Pin-Muster beim Einfuehren der Selektoren
mit-schneiden.**

### B12 — Der Konsum eines `routingHint` ist nicht quittiert. [Flaeche 11]

**VERIFIED.** Der Klick-Koerper liest harness/model/effort (:18582–18590), und
`audit("task_dispatch")` traegt den gewaehlten Harness (:18606). Aber ob der Owner dem Hint
FOLGTE oder ihn ueberstimmte, ist aus den Ledgern nicht rekonstruierbar: der Hint selbst lebt
nur auf der Task-Zeile, sein Einfluss auf die Wahl nirgends. **Fehlerfolge:** der Vorschlag
verkauft ROUTE_OVERRIDE als proposes-Faehigkeit mit Quittung; faktisch ist nur der Vorschlag
persistent, nicht die Entscheidung UEBER den Vorschlag — ein Audit kann „Agent schlug vor /
Owner waelte ab" nicht zeigen. **Empfehlung: `fix` — beim Dispatch-Audit den Hint-Wert neben
dem gewaehlten Harness nennen (ein Feld im Detail-String, kein neues Ereignis).**

---

## 3. Uebersehene, wiederverwendbare Maschinerie (Frage 2 des Auftrags)

Ausser dem bereits gemeldeten `land-candidate.ts`:

1. **`analysis-staleness.ts`** — reine, flaechengebundene Staleness-Regel mit
   unknown-fail-closed (siehe B9). Der Vorschlag baut Kante-B-Staleness als NEU, ohne sie zu
   erwaehnen.
2. **`auto_skip`-Buchung in `tickAutos`** — das Muster „eine Policy-Verweigerung wird
   aufgezeichnet und der Lauf gilt als verbraucht" (server.ts:6005–6013): genau der
   Beobachtungstraeger, den H.4 fuer sein Verdikt braucht und heute nirgends hat (siehe B4).
3. **Zustellbudget-Muster `FLEET_EVENT_MAX_OPEN_PER_SLOT`** (:2561, geprueft bei :5404, :5487)
   — jede neue Event-Minting-Quelle (Kante B) sollte diese Pruefung uebernehmen, nicht eine
   eigene Deckelung erfinden.
4. **Receiver-Todes-Sweeps** — `markFleetEventReceiverGone` (:5374),
   `reconcileClarifications` (:5349), `reconcileAttention` (Boot :14402ff.): Kante B bekäme
   toten-Empfaenger-Handling, send-uncertain-Crash-Sichtbarkeit und Boot-Reconciliation
   GRATIS, weil die Maschinerie empfaengeragnostisch ist. Im Vorschlag unbenannt.
5. **`writeStewardJournal`/`readStewardJournal(ref)`** (:14858/:14863) — falls der Nudge
   tatsaechlich eine Journal-Zeile haben soll (wie Dossier und GLM glauben): die Maschinerie
   existiert, wird vom Nudge bloss nicht gerufen (siehe B4). Auch das ref-keyed Dedup
   („one live proposal per ref") ist das fertige Muster fuer propose_task-Dedup jenseits von
   Program-Caps.
6. **Provenienz-Dreifeld `taskId/originId/programId`** an Clarification (:1319),
   FleetReport (:5490), Attention (:5756) — der Join, den H.2 als `respondsTo` neu erfinden
   will, steht dreimal (siehe B10).
7. **Trigger-Reachability-Pin mit DORMANT-Liste** (e2e/pins.ts:1185ff.) — die Vorlage fuer
   jeden neuen Selektor (B11).
8. **`main-direct` preflight/finalize** — der Vorschlag reitet korrekt darauf; hier nur
   bestaetigt: die Schiene existiert, bindet Tip vorher, verifiziert Integration-Bewegung
   (:16535–16561, Schreibstelle :11063), und bleibt bewusst Beleg ohne Gate.
9. **`supervisorNudge`-Receipt-Anatomie** (sendId vor Transport, uncertain als eigener
   Beleg) — der Vorschlag uebernimmt sie fuer Kante B implizit via FleetEvent; die
   Zustellungs-Id-Bindung des Nudge ist dennoch das einfachere Vorbild fuer jede neue Kante,
   die KEIN Event sein soll.

---

## 4. Flaechen-Abdeckung (1–13, jede Flaeche mit Aussage)

| # | Flaeche | Ergebnis |
|---|---|---|
| 1 | Prinzipal-/Credential-Grenzen | **B3, B6.** Sonst geprueft, nichts ueber Dossier hinaus: Intake default-aus (404 ohne Secret, handleIntake :13777–13782 selbst gelesen), Owner-Wand positionell (:16999–17000), Self-Routen pruefen selbst. Grenze-nur-Konvention: „Supervisor hat nie Worktree" (:13261–13263) — in B3 gehoben. |
| 2 | Task-/Dispatch-Transport | **Geprueft, nichts gefunden.** Requeue schreibt Grund auf die Zeile (:6296–6312), Caps je Repo (`DISPATCH_MAX_LANES`), serial one-lane-per-tick (:7034), Boot-Reconcile verwaister `sent` (:14411–14416). Wartezustaende sind laut (note). |
| 3 | Frage-/Ergebnis-Transport | **Geprueft, nichts gefunden ausser B4/B9.** send-uncertain wird vor tmux persistiert und nie blind replayed (tickWatches FACT 2 :8980–8990); eine ungewiss zugestellte Frage ist ueber `GET /api/self/clarifications` (receiver-gebundene Zeilen, :5437–5443) rettbar. INFERRED-Luecke: ob der MAIN-Founding-Brief dieses Pollen lehrt, habe ich nicht gelesen (buildProgramMainBrief nicht im Fenster). |
| 4 | Context-Plan-Auswahl und Receipts | **Geprueft: die vier Fundstellen des Owner-Briefs stimmen** (6376ff.; context-plan.ts:13–22; :17316; context-plan.ts:78). Auslassungen werden quittiert, nie verschluckt — inkl. `@manifest`-Zeile fuer Datei-Defekte (context-manifest.ts:22–24). Nuancen: `manifest-invalid` ist grob, aber ehrlich; Seed-Anker haelt die Land-Gate-Familie (e2e/context-packs.ts:84–87), nicht der Seam. B8 (estimatedBytes) ist der einzige echte Befund der Flaeche. |
| 5 | IDs und Lebenszyklus-Joins | **B10.** Sonst geprueft, nichts gefunden: briefHash-Join Receipt↔LaneOutcome ist exakt (beide hashen deliveredBrief, :6369–6373); `covers[]` = {branch, mainAfter} im Land-Trail (:1478–1479, src/protocol.ts:81); sendId ueber audit-Detail + prompt-log joinbar (Text-Join, nicht Feld — fuer B4 relevant). |
| 6 | Restart / Nachfolge / Recovery | **Geprueft, nichts gefunden.** succeed verlangt committedes HANDOFF.md (:5193–5194), verweigert Ambiguitaet (>1 Programme; Supervisor+MAIN zugleich, :5200–5207), persistiert die Retirement-Deadline mit Token-Gate (:5236–5239), Boot exekutiert Ueberfaellige (:14417–14421). Occupant-Wechsel verliert nichts still: Gebundenes wird refused/disarmed/receiver-gone (alle sweeps gelesen). |
| 7 | Harness-Paritaet und Degradation | **Geprueft, nichts ueber Dossier hinaus.** canDeliver-Sechserkette selbst gelesen (:5943–5968); die zwei Politik-Flags (`transcript:false`, `selfSchedule:false`) inkl. ihrer Begruendungskoemmentare selbst gelesen (:541–560) — Dossier §16 recht gegeben. Der stille Wegfall der Ernte bleibt der einzige stille (Canary P6). |
| 8 | Rueckgabewege der Worker | **Geprueft, nichts gefunden.** runWorker prueft den Contract-Mark vor dem Spawn (:8062–8064); Caller failen geschlossen oder mit Fallback (agentCommitMessage → wip mit `messageFallback`-Flag :9125ff.; Summary → 500; Analytiker → transient unknown mit Backoff, :6468–6472). „summarizer timed out without an answer" :7987 wird nie verschluckt. |
| 9 | Land-/Verify-/Deploy-Autoritaet | **Geprueft, nichts gefunden.** ok:null-Invarianten samt „never-auto-land" selbst gelesen (:9502–9520); undo-land genau ein Land (Kommentare :3969, :9766); Tier-2 laeuft nach dem Land und gated nichts (Route :17323ff. advisory); Deploy-Verb 2 im Steward-Tier mit eigener Begruendung (:16079–16081). |
| 10 | UI-Projektion und Beobachtbarkeit | **Geprueft: nichts gefunden ausser dem Nudge-Blindtfleck aus B4.** /api/sessions traegt watches, events (inkl. receiver-gone), attentionOpen-Count, TaskDigest ohne Texte (:17027–17075); supervisorView casts mit malformed-Zaehlern und expliziten unknown-Zeilen — ehrlich. Ein Cast auf eine Netz-Antwort als Typ: `/api/self/gate` wird in e2e/self-token.ts:322 typisiert getestet — dort kein Befund. |
| 11 | Interventions-Rail | **B4, B9, B10, B12**; Kante A vollstaendig verifiziert (alle Waechter wie vom Vorschlag zitiert); FleetEvent-Maschinerie, Ack, Budget, receiver-gone verifiziert (Tabelle in §1.1). Die Rail-Typisierung selbst steht auf tragfaehigen Kanten; die Luecken sind die vier genannten. |
| 12 | Wissens-Aufnahme | **B1, B2, B5, B7, B8, B11**;positive Verifikation: Manifest/Receipt/Promotion tragen vier von fuenf Stationen (§1.2). |
| 13 | Drift Code/Doku/Laufzeit | **B4** (Dossier UND GLM falsch zur Journal-Zeile — der Widerspruch ist selbst der Befund), **B11**; pins-Struktur verifiziert: Trigger-Reachability, 5-Writer-Zaehlung („a sixth delivery seam cannot be added silently", :1230–1236), Fleet-Manifest-Pin, git-show-Regel; `rulebookDrifted` existiert an der Gate-Route und ist e2e-getestet (e2e/self-token.ts:419–424). Laufzeit-gegen-Platte (bootHead/behindCount) persistiert (:1495–1502) — im Fenster nicht weiter vertieft. |

---

## 5. Grenzen dieses Audits

- `src/client.ts` (9 549 Z.) nicht gelesen — UI-Gesten bleiben unbewertet (wie im Dossier §10;
  B6 betrifft nur die Server-Seite der genannten Sichten).
- `buildProgramMainBrief`/Founding-Brief-Texte nicht gelesen (Befund-3-INFERRED-Luecke: wird
  Pollen gelehrt?).
- Container-/Docker-Flaeche nicht angefasst; Ticks ausser `tickDispatch`/`tickWatches`/
  `tickAutos` nur stichprobenartig.
- Keine Suite, kein Server-Call, kein Laufzeit-Beweis: alles oben ist Code-Lesung am Baum
  `de1f6c6`. Zeilenangaben gelten fuer diesen Baum.
