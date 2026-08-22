# Kritik am Rollen-/Capability-Entwurf — adversarial, Opus, 2026-08-21

Gegenstand: `docs/rollen-architektur-glm-2026-08-21.md` (A–I).
Mit-Prüfgegenstand: `docs/rollen-evidenz-2026-08-21.md` (Dossier, keine Autorität).
Baum: `de1f6c6` (`git rev-parse HEAD`, selbst gemessen). Laufender Server: `bootHead 0ce32dc`,
`behindCount 4`, `codeBehind:false` (live gegen `/api/sessions` gemessen).

**Beweismarken.** **BESTÄTIGT** = ich habe die Stelle gelesen; die Zeilenangabe ist
`datei:zeile` in genau diesem Baum. **VERMUTET** = Schluss; die Lücke steht im selben Satz.
Ein Befund ohne Marke gibt es hier nicht. Wo ich einen Zahl-/Zeilen-Anspruch des Entwurfs
nachgezählt habe, steht das Ergebnis, nicht das Wort „stimmt".

**Was ich gegen den Code gehalten habe:** `server.ts` (abschnittsweise, nie am Stück),
`src/protocol.ts`, `capability-map.ts`, `e2e/pins.ts`, `context-packs.ts`, `context-plan.ts`,
`context-manifest.ts`, `land-candidate.ts`, `lane-signals.ts`, `rulebook.ts`, `watchdog.sh`,
`SYSTEM.md`, `docs/agentic-control-plane-program-2026-08-20.md` §6 Act 5–8. Dazu vier
Live-Messungen: `fleet.json` (Programme, Tasks, Supervisor-Bindung), `lane-outcomes.jsonl`,
`context-receipts.jsonl`, `GET /api/sessions`.

---

## 0. Die zwei Owner-Fragen, zuerst

### 0.1 Fügt der Interventions-Rail (H) notwendige Kontrolle hinzu oder vermeidbare Komplexität?

**Urteil: in der vorgeschlagenen Form vermeidbare Komplexität. Notwendig ist genau EIN Stück
daraus, und es ist nicht der Rail — es ist eine synchrone MAIN→eigene-Lane-Kante nach dem
Muster des Replys.**

Drei Gründe, alle gemessen:

1. **H.2 ist Vokabular ohne Konsumenten.** Die vier Decision-Arten werden von nichts gelesen.
   Der einzige vorgeschlagene Join, `respondsTo` „als Audit-Detail", landet im `detail`-Feld von
   `audit()` — ein **untypisierter Freitext-String** (`server.ts:2992`, BESTÄTIGT). Kein Index,
   kein Schema, kein Leser. Der Entwurf verbietet sich selbst ein Decision-Register und ersetzt
   es durch ein Feld, das dieselbe Aufgabe nachweislich nicht erfüllen kann. Fehlerfolge: ein
   Betrachter, der später „welche Reparatur gehört zu welchem Finding" fragt, bekommt eine
   `grep`-Antwort über Freitext und hält sie für eine Kette.
2. **H.4 ist gegen den Code invertiert** (Befund 10). Der einzige mechanische Vorschlag in H
   klassifiziert die sechs `DeliveryGate`-Werte genau falsch herum.
3. **H.1/H.3 sind Bestandsaufnahme.** Sie sind gut und stimmen (ich habe jede Zeile der
   Kanten-Tabelle nachgeschlagen, siehe §2). Aber eine korrekte Bestandsaufnahme ist kein Rail;
   sie ist eine Doku-Seite, und sie steht schon im Dossier §12.

Was bleibt: Kante B. Die ist real gebraucht (heute kostet eine blockierte Lane einen
Owner-Handgriff plus den geladenen Kontext der Lane) — aber ihr Kostenanschlag im Entwurf ist
falsch (Befund 6). **Kleinste Empfehlung: H.2 und H.4 ersatzlos streichen, H.1/H.3 als
Doku-Absatz an `docs/self-api.md` hängen, und Kante B als eigenständigen Schnitt nach dem
`replyClarification`-Muster (synchron, eigener Gate, volles Occupant-Triple) führen — nicht als
FleetEvent-Anhängsel.**

### 0.2 Welche Behauptung will ich VOR jeder Implementierung gemessen sehen — und wie?

**Nicht die Dispatcher-Behauptung.** Die habe ich hier fertig geprüft, sie trägt (§2.1); sie
noch einmal zu messen wäre verschwendete Zeit.

**Die zu messende Behauptung ist Schnitt 1s implizite Voraussetzung: „die Capability-Karte kann
eine dritte, VORSCHLAGENDE Zeile aufnehmen, und `bun e2e/pins.ts` bleibt grün."** Sie ist die
Voraussetzung von Schnitt 1 UND Schnitt 2, sie steht im Entwurf nirgends als Risiko, und ich
habe drei Typ-/Pin-Wände dagegen gelesen (Befund 3). Wenn sie fällt, fällt die erste Stufe des
Land-Gates, und zwar in jeder Lane, die den Schnitt anfasst.

Kommando (in einer Lane, nicht hier — ich habe es bewusst NICHT ausgeführt, mein Auftrag ist
read-only): in `capability-map.ts` eine dritte Zeile mit `name: "propose_task"`,
`stateEffect: "proposes"`, `roles: ["program-main"]` einsetzen und

```
bun capability-map.ts && bun e2e/pins.ts; echo "exit=$?"
```

fahren. Erwartung nach meiner Lesung: `tsc`/Bun bricht schon vorher an drei Stellen
(`CapabilityFunction`, `CapabilityRole`, `stateEffect: "none"`), und selbst nach Typ-Aufweitung
schlagen zwei Pins an. Ein grüner Lauf würde meinen Befund 3 widerlegen — das ist der Punkt.

---

## 1. Befunde, gerangt nach Fehlerfolge

### 1 — `kind`-Default `auftrag` öffnet drei unbeaufsichtigte Verbraucher, die der Entwurf nicht nennt

**BESTÄTIGT.** Schnitt 1 legt fest: „kind validiert gegen `TASK_KINDS` :1625 mit Default
`auftrag`", und B nennt die Wirkung `proposes` mit dem Satz, Starten bleibe Owner-Sache. Der
Präzedenzfall, auf den sich der Entwurf beruft, macht das Gegenteil: die Steward-Route setzt
Default **`notiz`** (`server.ts:16244`). Der Unterschied ist nicht Zeremonie — drei
Maschinen-Pfade selektieren `kind === "auftrag"` **im Zustand `pending`**:

- `tickAnalysisSweep` (`server.ts:6677`) — spawnt je Zeile einen Analysten-Worker.
- `briefDue`/`tickBriefSweep` (`server.ts:6624`, `:6637`) — spawnt je Zeile einen Brief-Compiler.
- `tickBacklogNudge` (`server.ts:8756`) — **pastet Text in eine fremde, lebende Nicht-Lane-Pane**
  (`server.ts:8787` `sendText`), gedeckelt durch `BACKLOG_NUDGE_MAX` und Cooldown.

Ein `notiz` ist von allen dreien ausgeschlossen; die Kommentare sagen es wörtlich („Advisory
categories never enter this set, whatever their status", `:8754`).

**Fehlerfolge:** eine gebundene MAIN kann ohne jeden Owner-Akt (a) Modell-Spend auf zwei
Worker-Familien auslösen und (b) die Maschine dazu bringen, in die Pane einer ANDEREN Session zu
tippen. Das ist genau die Klasse „still den Scope erweitern", die die harte Owner-Regel
ausschließt — nur eben nicht über `queued`, sondern daran vorbei. Der Betrachter sieht keine
Freigabe und trotzdem Maschinenarbeit.

Heute ist der Schaden null, aber **nur per Konfiguration, nicht per Invariante**: live gemessen
läuft srv mit `FLEET_ANALYSIS_MS=0` (`watchdog.sh:148`), `FLEET_BRIEF_MS` unset (Default 0,
`server.ts:6489`) und `FLEET_BACKLOG_NUDGE_MS` unset (Default 0, `server.ts:8512`). Drei
env-Nullen sind kein Gate.

**Kleinste Empfehlung:** Default `notiz` wie beim Präzedenzfall; `auftrag` nur bei expliziter
Angabe — dann steht die Entscheidung in der Zeile und nicht im Default.

### 2 — E.3/E.4 „nichts Maschinelles bricht" ist falsch; Schnitt 4 reißt die erste Stufe des Land-Gates ein und kippt genau den Sitz, den Schnitt 3 braucht

**BESTÄTIGT.** `STEWARD_LABEL` ist nicht nur Rollenfindung. Es trägt fünf getrennte
Verhaltensgates, keines davon token-abhängig:

- `successionScopeError` (`server.ts:5138`): der Steward darf nicht migrieren
  („a standing role — it does not migrate"). Ohne Ersatz kann der Pulse-Sitz nach dem Schnitt
  `POST /api/self/succeed` fahren.
- Watch-Ziel-Verbot (`server.ts:4898`): der Steward ist nie `done-looking`-Ziel.
- Empfängerauswahl dreier Ticks (`:8696` Audit-Ping, `:8767` Backlog-Nudge, `:8822` Migrate).
- Lane-Signale `doneLooking`/`hostCommitLooking`/`stalled` (`:15184`, `:15189`, `:15195`,
  `:15202`, `:15206`).
- **Das non-lane-Prädikat der vier Self-Routen**: `s.worktree && s.label !== STEWARD_LABEL` bei
  `watch` (`:16591`), `fleet-report` (`:16618`, invertiert), `clarifications/reply` (`:16628`)
  und `attention` (`:16643`).

Der letzte Punkt ist der tödliche. Der Pulse-Sitz sitzt in einem **Worktree**
(`claude-fleet.worktrees/steward`) — deshalb existiert die Label-Klausel überhaupt, sie ist
sonst tote Bedingung. Fällt das Label ersatzlos, kollabiert das Prädikat auf `s.worktree`, und
derselbe Sitz kippt von „non-lane" auf „lane": `watch`, `reply`, `attention` und die geplante
`propose_task` antworten ihm dann **409**. Schnitt 3 braucht diesen Sitz als Produzenten;
Schnitt 4 verweigert ihn.

Und: **`e2e/pins.ts:732` pinnt den Literalstring** `if (s.worktree && s.label !== STEWARD_LABEL)`
im Attention-Handler. `bun e2e/pins.ts` ist die ERSTE Stufe von `VERIFY_CMD` (`watchdog.sh:91`).
Schnitt 4 ist damit rot am Land-Gate, bevor irgendein Verhalten geprüft wird — und das
Done-Kriterium des Schnitts (`rg -c 'STEWARD_LABEL' server.ts` = 0) misst die falsche Menge:
das 22. Vorkommen steht in `e2e/pins.ts`.

**Fehlerfolge:** Schnitt 4 landet nicht, und wenn er per Hand-Commit doch landet, verliert der
Puls vier Routen und gewinnt die Fähigkeit, sich selbst wegzumigrieren.

**Kleinste Empfehlung:** die Label-Klausel nicht löschen, sondern durch `isBoundSupervisor(s)`
ERSETZEN — in allen fünf Familien in einem Schnitt, inklusive `e2e/pins.ts:732`; Done-Kriterium
über den ganzen Baum (`rg -c 'STEWARD_LABEL' -g '*.ts'`), nicht über `server.ts`.

### 3 — Die Capability-Karte kann `propose_task` strukturell nicht tragen; Schnitt 1 fällt an seinem eigenen Proof-Kommando

**BESTÄTIGT.** Der Entwurf bucht als Typ-Kosten genau eine Zeile: „(5) Typ-Erweiterung
`CapabilityRole`". Gemessen sind es mindestens fünf Wände:

- `CAPABILITY_FUNCTIONS = ["describe_self", "get_project_context"]` (`src/protocol.ts:252`), und
  `SystemCapability.name: CapabilityFunction` (`:271`) — der Name ist ein Union-Typ, kein String.
- `SystemCapability.stateEffect: "none"` ist ein **Literaltyp** (`src/protocol.ts:275`). Die
  Karte kann heute per Typ ausschließlich lesende Fähigkeiten ausdrücken. Die ganze
  Wirkungs-Taxonomie aus Abschnitt B (`none|proposes|mutates|irreversible`) ist in der Karte
  nicht schreibbar. Dasselbe gilt für den Ausweichweg `CapabilityAdapterProbeDataset` (`:283`),
  der ebenfalls `stateEffect: "none"` festnagelt.
- `CapabilityRole = "session" | "program-main"` (`:255`) — vom Entwurf korrekt gesehen.
- Pin „the capability source declares exactly the two promoted stable functions"
  (`e2e/pins.ts:593`): `declaredNames.length === 2`.
- Pin „every stable function comes from SYSTEM.md" (`e2e/pins.ts:610`): jeder Funktionsname muss
  als `- \`name\`` im Block `## Funktionen statt Routenwissen` von `SYSTEM.md` stehen. `SYSTEM.md`
  führt acht Namen (`:172–180`) — `propose_task` ist keiner davon; der nächstliegende heißt
  `delegate_act`.

Schnitt 1s *Write-Set* nennt weder `src/protocol.ts` noch `SYSTEM.md`. Sein *Proof-Kommando*
beginnt mit `bun e2e/pins.ts`.

**Fehlerfolge:** die Lane, die Schnitt 1 baut, kann ihr eigenes Done-Kriterium nicht erfüllen und
verbrennt einen Zyklus damit, den Grund zu suchen. Schlimmer: der naheliegende Ausweg — die
Zeile als `stateEffect: "none"` deklarieren — würde eine vorschlagende Fähigkeit als lesend
ausweisen und das Register in genau der Achse verfälschen, für die es gebaut wurde.

**Kleinste Empfehlung:** Schnitt 1s Write-Set um `src/protocol.ts` und `SYSTEM.md` erweitern und
die Aufweitung von `stateEffect` als eigene Zeile in die Neu-Bilanz aufnehmen — sie ändert, was
das Register IST, und gehört nicht in eine Fußnote.

### 4 — Es gibt nicht EINE Program-MAIN-Bindung, sondern vier verschieden strenge Prädikate; das strengste bricht bei Codex von selbst

**BESTÄTIGT.** Abschnitt A und C bauen auf „die Program-MAIN-Bindung … geprüft in
`boundProgramForMain` :5706" als EIN Rollenkriterium. Gemessen sind es vier:

| Stelle | Prüft | Folge |
|---|---|---|
| `boundProgramForMain` `server.ts:5706` | slot + openedAt + **sessionId** + `status==="active"` | attention, program-execution-Autorität |
| `programExecutionView` `server.ts:2035` | slot + openedAt, **jeder Status** | rendert `sessionIdMatch: "divergent"` als eigenen Wert (`:2080`) |
| `supervisorNudge` `server.ts:13465` | slot + openedAt + `active` | sessionId **nicht** geprüft |
| `handleSelfSucceed` `server.ts:5197` | slot + openedAt, **plus Eindeutigkeitsprüfung** | 409 bei >1 |

Und `clarificationReceiverFor` sagt den Grund im Klartext: „sessionId is deliberately reported,
**never gated**: a Codex bind may change it inside this exact slot+openedAt occupant"
(`server.ts:5301–5302`).

Genau das passiert. Codex hat `pinsSession: false` (`server.ts:871`); `bootstrapProgramMain`
schreibt die Bindung mit `sessionId: free.sessionId ?? null` (`server.ts:13680`), also `null`;
`tickCodexRecovery` setzt danach `s.sessionId = <uuid>` (`server.ts:3675`), ebenso der
Owner-Bind (`server.ts:17190`). Ab diesem Tick ist `null === "uuid"` falsch.

**Fehlerfolge:** eine Codex-Program-MAIN verliert `POST /api/self/attention` — und unter
Schnitt 1 zusätzlich `propose_task` — mit der Meldung „not the current bound MAIN of an active
program", obwohl sie es ist. Nudge und Clarification laufen weiter. Der Betrachter sieht eine
MAIN, die den Owner nicht mehr erreichen kann, und eine Fehlermeldung, die auf einen
Occupant-Wechsel zeigt, der nie stattgefunden hat. Der Entwurf nennt dieses Prädikat
ausdrücklich „das einzige heutige Rollenkriterium, das einen Occupant-Wechsel korrekt bricht" —
es bricht auch ohne Wechsel.

**Kleinste Empfehlung:** die neue Route an das Prädikat hängen, das `clarificationReceiverFor`
benutzt (slot + openedAt + `active`, sessionId berichtet statt gegated), und die Divergenz in
der Antwort mitliefern.

### 5 — `boundProgramForMain` ist ein `.find`, keine Eindeutigkeitsprüfung — live existieren 13 aktive Programme

**BESTÄTIGT.** `server.ts:5706` ist `programs.find(...)`. Der gleiche Baum kennt die Gefahr und
behandelt sie an anderer Stelle korrekt: `handleSelfSucceed` refust `bound.length > 1` als
„ambiguous succession" (`server.ts:5199`). Live gemessen (`fleet.json`): **36 Programme, davon 13
`active`, 12 davon mit `main`-Bindung.**

**Fehlerfolge:** heute begrenzt (eine Attention landet am erstgefundenen Program). Unter Schnitt 1
hängt eine TASK still am falschen Program — und `task.programId` wandert beim Dispatch auf den
Slot (`server.ts:6162`) und von dort in die Empfängerauflösung jeder Clarification dieser Lane
(`server.ts:5297`). Eine falsch attribuierte Zeile leitet also später Fragen an die falsche MAIN.

**Kleinste Empfehlung:** dieselbe Ambiguitäts-409 wie `:5199`, an derselben Funktion.

### 6 — Kante B kann die FleetEvent-Schiene nicht kostenlos benutzen: ihr Waiver ist genau für sie nicht begründet

**BESTÄTIGT.** H.3 verkauft B als „hängt die vorhandene FleetEvent-Schiene an den fehlenden
Absender an — kein zweiter Transport". Der Transport ist `tickWatches`, ein **unbeaufsichtigter
Tick**, und er waivt das Fremd-Harness-Gate mit einer namentlichen Begründung:

> „Two policy gates are waived for this one-shot: quiet hours … and the foreign-harness
> WORK-PROMPT policy. A Watch exists only after an explicit Owner/Self subscription and its text
> is **fixed server-generated completion facts, never caller-chosen work**." (`server.ts:8966–8971`)

Die einzige heute existierende Abwärtskante hält sich nicht an diesen Weg: `replyClarification`
liefert **synchron** aus dem Request des Aufrufers, prüft das volle Worker-Triple **inklusive
sessionId** (`server.ts:5549–5550`) und begründet seinen Waiver mit „This worker explicitly
requested this reply" (`server.ts:5556–5558`).

**Fehlerfolge:** B über `tickWatches` transportiert MAIN-verfassten Arbeitstext unbeaufsichtigt
in Panes, deren Harness genau dafür als `automatable:false` markiert ist (pi-zai, pi-unfenced,
container). Der Waiver, der das erlaubt, wurde für Server-Fakten geschrieben. Es entsteht also
nicht „kein zweiter Transport", sondern ein stillschweigend erweiterter erster.

**Kleinste Empfehlung:** B synchron nach dem `replyClarification`-Muster bauen (eigene Route,
eigener `canDeliver`-Aufruf, volles Occupant-Triple), FleetEvent nur für die Quittung. Dann
stimmt auch H.5s Kostenbild nicht mehr — und das ist die ehrlichere Zahl.

### 7 — Der `canary`-Zustand hat keinen Weg, je ausgeliefert zu werden; Schnitt 5 widerspricht sich selbst

**BESTÄTIGT.** Die Omissions-Leiter ist geordnet und rein, und `status` steht auf Stufe 3 —
**vor** harness, mode, trigger, capability:

```
if (!ctx.sourceAvailable) return "source-unavailable";
if (pack.status !== "active") return "status-not-active";      // context-plan.ts:80
```

`ContextPlanContext` (`context-plan.ts:60–66`) führt fünf Felder: `sourceAvailable`, `harness`,
`mode`, `triggers`, `capabilities`. **Es gibt kein Faktum, das eine Ausnahme von `status` tragen
könnte**, und `planContext` kennt keinen zweiten Weg (`:96–115`); der Manifest-Pfad läuft durch
dieselbe Leiter (`context-manifest.ts:11`).

Damit steht im Entwurf ein Zirkel:

- Schnitt 5s Done-Kriterium beschreibt **nur** den omittierten Arm („Ein Pack mit
  `status:"canary"` wird mit dem gepaarten Grund omittiert").
- F definiert den Wirksamkeits-Canary als **zwei Arme**, „Pack ausgewählt vs. omittiert".
- I.2 macht den gelaufenen Canary zur Bedingung für `canary → promoted`.

Der ausgewählte Arm hat keinen Mechanismus. Also läuft kein Canary, also wird nichts promotet,
also ist die ganze Aufnahme-Stufe tot. I.6s Deckel (3) („Canary ist ohne expliziten Trigger
unsichtbar") beschreibt korrekt die halbe Wahrheit: unsichtbar ja — der „explizite Trigger"
existiert nicht.

**Fehlerfolge:** Schnitt 5 liefert eine Statuskonstante und einen Auslassungsgrund und lässt den
Owner glauben, die Aufnahme-Stufe sei gebaut. Der erste Versuch, ein Pack tatsächlich zu
promovieren, findet, dass ihm die Voraussetzung fehlt.

**Kleinste Empfehlung:** den Canary-Arm über ein BESTEHENDES Faktum der Leiter fahren (ein
eigener `trigger`-Wert, den nur der Canary-Lauf setzt) statt über `status`. Dann bleibt die
Leiter rein, `status` bleibt zweiwertig-hart, und es entsteht keine sechste Station.

### 8 — Provenienz und Lizenz sterben mit dem Kandidaten — an genau der Stelle, die I.4 „die Bedingung des Ganzen" nennt

**BESTÄTIGT.** `ContextPackBase` (`context-packs.ts:47–66`) führt: `id`, `useWhen`, `scope`,
`audience`, `triggers`, `hardness`, `requiredCapabilities`, `harnesses`, `modes`,
`estimatedBytes`, `evidence`, `owner`, `status`, `supersedes`. `PublicContextPack` ergänzt
`sources`, `sourceHash`, `observedAt` (`:68–72`). **Kein Lizenz-, Provenienz-, Attributions- oder
Upstream-Feld** — das Dossier §13.3 sagt es, ich habe es nachgeschlagen, es stimmt.

I.1 stellt Provenienz und Lizenz als „NEU, Kandidatenebene" auf — und I.1 legt den Kandidaten
ausdrücklich **außerhalb des getrackten Baums** ab, wo er „verfällt". `owner: "owner"` bleibt
Literal (`context-packs.ts:62`), also ist das promovierte Pack per Konstruktion owner-verfasst.

**Fehlerfolge:** ein promotetes Pack liegt in einem **öffentlichen** Repo und trägt keine
Aufzeichnung, aus welcher fremden Quelle die Praxis stammt oder unter welcher Lizenz sie geprüft
wurde. Das Lizenz-Urteil, das I.4 zum Pflichtfeld erklärt und dessen `unknown` „Promotion
mechanisch blockiert", ist nach der Promotion nicht mehr auffindbar — es blockiert genau einmal
und hinterlässt nichts. Damit ist I.4 eine Regel ohne Speicher, und die riskanteste Lücke des
Dossiers bleibt offen, obwohl der Entwurf sie behandelt zu haben glaubt.

**Kleinste Empfehlung:** ein Pflichtfeld `provenance { url|commit, license }` am Pack — drei
Fakten, kein Inhalt, verletzt die Zeiger-Doktrin nicht (I.4 nennt sie selbst „immer tragbar").

### 9 — Die Cap-Wahl ist eine Größenordnung daneben, und die Queue ist live an ihrem Deckel

**BESTÄTIGT (Code + Live).** Schnitt 1 wählt „eine Cap-Konstante je Program in der Form von
`STEWARD_MAX_PENDING` (:2611, Default 10)". Der Präzedenzfall ist aber **kein** Per-Objekt-Cap:
er zählt `t.source === "steward" && t.status === "pending"` **global** (`server.ts:16235`).

Live gemessen (`fleet.json`): **200 Tasks — exakt `MAX_TASKS` (`server.ts:2239`)**, davon
123 `done`, 72 `pending`, 3 `archived`, 1 `queued`, 1 `sent`. 13 aktive Programme.
`capTasks` (`server.ts:2244`) darf **nur terminale Zeilen** verdrängen.

**Fehlerfolge:** ein Per-Program-Cap von 10 erlaubt bei 13 aktiven Programmen 130 pending
Zeilen — auf einem Board, das schon 72 pending trägt. Die Summe schiebt die gesamte
`done`-Historie aus `fleet.json`, und zwar still: `capTasks` protokolliert nichts. Der Owner
verliert das Register seiner eigenen Urteile, um Vorschläge zu speichern.

**Kleinste Empfehlung:** globalen Cap in der Form des Präzedenzfalls (`source === "main" &&
pending`), nicht per Program.

### 10 — H.4 klassifiziert die sechs Zustell-Gates umgekehrt zum Code

**BESTÄTIGT.** `DeliveryGate` ist die geschlossene Sechsermenge (`server.ts:5942`) — soweit
richtig. Die Einteilung ist es nicht:

- Der Entwurf steckt **`harness`** in die „Adapter-/Transportklasse (Fähigkeit/Transport fehlt)"
  und leitet daraus ein „Adapter-Defekt-Verdikt" nach zwei Fehlzustellungen ab. Der Code nennt
  denselben Gate wörtlich das Gegenteil: „a **POLICY** refusal, unlike every other gate here,
  does not resolve by waiting: it holds until the owner flips `FLEET_HARNESS_AUTOMATION`"
  (`server.ts:6005–6007`) — und behandelt ihn bereits: **einmal** quittieren, den Lauf
  verbrauchen, nicht wiederholen (`:6008–6011`).
- Der Entwurf steckt **`not-alive`** in die Zustandsklasse („nichts ist kaputt, es ist gerade
  nicht dran"). Im Transport ist `not-alive` der **einzige terminale** Gate: er setzt das Event
  auf `receiver-gone` (`server.ts:8979–8983`), während `busy` und `kill-switch` `pending` halten.

**Fehlerfolge:** das vorgeschlagene Verdikt feuert dauerhaft und fälschlich auf jeden korrekt
konfigurierten `automatable:false`-Slot (pi-zai, pi-unfenced, container) und trägt eine
Owner-Env-Entscheidung als „Harness-Defekt" in die Capability-Karte ein — eine Falschaussage an
genau dem Ort, der die ausführbare Wahrheit sein soll. Gleichzeitig feuert es nie auf die tote
Pane, den einzigen Fall, den man als Defekt melden möchte.

**Kleinste Empfehlung:** H.4 streichen. Die Unterscheidung, die der Rail sucht, existiert bereits
und heißt retryable / terminal / policy — an genau einer Stelle, `canDeliver`s Aufrufern.

### 11 — Das Dossier zählt drei Credential-Klassen; es sind vier. Der übersehene ist ausgerechnet der nächste Verwandte von `propose_task`

**BESTÄTIGT — Befund gegen den Kurator.** Dossier §2 führt „drei Credential-Klassen plus
Gast/Share", der Entwurf übernimmt das in C („Heute: drei … Ziel: zwei"). Gemessen gibt es eine
vierte: `POST /intake` hinter `FLEET_INTAKE_SECRET` (`server.ts:2535`), Handler `:13775–13813`,
Route registriert **vor** dem Share-Host-Gate (`:16362`), mit eigener Sperre nach 50 Fehlversuchen
(`:2547`), eigenem Rate-Limit und eigenem Audit-Wort. Sie erzeugt genau das, was der Entwurf neu
bauen will: eine `pending`-Zeile, `kind: "auftrag"`, `repo: null`, kein `programId`
(`server.ts:13806–13808`). Aktuell latent, weil das Secret ungesetzt ist (der Code sagt es
selbst, `:2544`).

**Fehlerfolge:** zweifach. (a) Cs Zielrechnung ist arithmetisch falsch — die Steward-Falte führt
von vier auf drei, nicht von drei auf zwei; die Zahl ist das Verkaufsargument des Abschnitts.
(b) Der Entwurf übersieht den einzigen bestehenden Nicht-Owner-Produzenten, der Rate-Limit,
Lockout und `repo:null`-Härtung schon hat — also den natürlichen Wiederverwendungskandidaten,
den seine eigene Reuse-Doktrin verlangt.

**Kleinste Empfehlung:** `/intake` in C als vierte Klasse und in E als Reuse-Quelle nennen.

### 12 — Der Pin, auf den C.1 und Schnitt 2 bauen, prüft Existenz, nicht Tier

**BESTÄTIGT.** C.1 verspricht: „Schnitt 2 pinnt die Tier-Zugehörigkeit jeder deklarierten Route
(owner/self) … derselbe Pin-Mechanismus, der heute schon jeden benannten HTTP-Adapter der Karte
gegen `server.ts` hält [gemessen e2e/pins.ts:634]." Der Pin an `:634` tut etwas anderes: er baut
`serverPairs` aus einem **Zeilen-Scanner** über `url.pathname === "<literal>"` plus
`req.method === "<METHOD>"` in derselben Zeile (`e2e/pins.ts:620–631`) und prüft, dass jeder
deklarierte Adapter darin **vorkommt**. Er sagt nichts über die Position und nichts über die
Rollenbedingung.

Zwei harte Folgen: **(a)** Owner-Routen sind überwiegend Regex-Routen
(`/^\/api\/slots\/(\d+)\/merge$/`, `server.ts:17752`) und für diesen Scanner strukturell
unsichtbar — ein Tier-Pin über die Owner-Wand kann diesen Mechanismus gar nicht benutzen.
**(b)** Rollenbedingungen werden heute nur als **Literal-Regex auf den Handler-Text** gepinnt
(`e2e/pins.ts:726–735`), was funktioniert, aber jede Umformulierung des Handlers rot macht — und
genau daran hängt Befund 2.

Der Entwurf weiß es halb: G führt „ob der Pin-Mechanismus Tier-Assertions ohne Erweiterung trägt"
als offene Frage. C.1 behauptet dieselbe Sache als gemessen. **Fehlerfolge:** eine Lane liest C.1,
plant Schnitt 2 als Deklarations-Arbeit und stößt auf einen Pin-Neubau, den niemand budgetiert
hat.

**Kleinste Empfehlung:** C.1 auf Gs Formulierung zurücknehmen — Tier-Pin ist Neubau, nicht
Wiederverwendung.

### 13 — Der Kontext-Wachstumspfad, den I.6 nicht abdeckt, ist das Rulebook; und `estimatedBytes` deckelt nichts

**BESTÄTIGT.** I.6 antwortet auf „bläht das den Kontext auf" mit vier Deckeln, die alle über
**Context Packs** reden. I.3 nennt aber als Ziel Nr. 2 das **Rulebook-Fragment**. Dort gilt
keiner der vier Deckel:

- `FRAGMENTS_FOR.main` = **alle sieben Fragmente** (`rulebook.ts:41`); die Lane bekommt drei
  (`loader`, `lane-discipline`, `self-scheduling`).
- Gemessen: `CLAUDE.md` = **63 368 B**; `rulebook/lane-discipline.md` allein = 20 979 B.
- Kein Byte-Budget, keine Omissions-Leiter, keine Receipt, kein Auslassungsgrund. Eine promovierte
  Praxis in einem Fragment ist ab dem nächsten Render Pflichtlektüre für jede MAIN und (je nach
  Fragment) jede Lane.

Und Deckel (2) selbst ist falsch: `estimatedBytes` wird validiert (`context-pack-validator.ts:213`),
in Plan und Selection getragen (`context-plan.ts:40`, `:111`) und **nirgends mit einem Budget
verglichen** — kein Summieren, kein Abschneiden; `truncated` wird hart als `false` geschrieben
(`server.ts:6383`). Ein Seed führt `estimatedBytes: 99108` (`context-packs.ts:195`). Der Deckel
ist mit `[gemessen]` markiert und existiert nicht.

**Fehlerfolge:** die Antwort „dieser Pfad bläht nichts auf" ist für den Träger richtig, den I.6
prüft, und ungeprüft für den Träger, auf dem Regeln tatsächlich landen. Wer sie liest, promoviert
in ein Fragment und stellt drei Monate später fest, dass CLAUDE.md wieder gewachsen ist.

**Kleinste Empfehlung:** I.6 um einen fünften Satz ergänzen — für den Fragment-Träger gibt es
keinen Deckel, also gilt dort die Partitionsregel plus ein benannter Byte-Vergleich vor und nach
jeder Promotion; und Deckel (2) auf „die Zeiger-Doktrin" korrigieren, die der echte Deckel ist.

### 14 — Zwei Owner-Entscheidungen, als eine verkauft

**BESTÄTIGT am Entwurf.** Die Owner-Grenze sagt „genau fünf Stationen … EINE geprüfte
Promotions-Entscheidung". I.2 behauptet „genau EINE Entscheidungsnaht (der Owner-Commit)" und
tabelliert darunter **zwei** Owner-Commits mit **verschiedenen Beweisanforderungen**:
`proposed → canary` (Validator + Lizenz ≠ `unknown`) und `canary → promoted` (gelaufener
Wirksamkeits-Canary). Zwei Tore mit zwei Beweisen sind zwei Entscheidungen; dass beide die Form
„ein Commit" haben, ist ein Namenstrick, kein Zusammenfall.

**Fehlerfolge:** der Owner glaubt, er habe eine Grenze durchgesetzt, und bekommt eine Stufe mehr
— zusammen mit dem Zweiarm-Experiment aus Befund 7 ist das ein Verfahren, keine Datennaht.

**Kleinste Empfehlung:** entweder als zwei Entscheidungen ausschreiben und begründen, oder
`proposed → canary` streichen (der Kandidat lebt ohnehin außerhalb des Baums; der erste Commit
IST der Canary).

### 15 — `Act Lead` und `delegate_act` aus dem Zielbild sind weder übernommen noch abgelehnt

**BESTÄTIGT.** `SYSTEM.md:61–63`: „Ein komplexer Worker darf als **Act Lead** Child-Acts
erzeugen; dafür braucht Fleet keine weitere permanente Hierarchiestufe." `SYSTEM.md:175`:
`delegate_act` steht im Zielvokabular. Der Entwurf schließt Lanes an der Produzenten-Route
ausdrücklich aus (409) und führt in A sieben Kandidaten plus den Steward — Act Lead ist in keiner
Zeile, weder angenommen noch verworfen.

**Fehlerfolge:** die eine Rollenfrage, die das Zielbild ausdrücklich offen zugunsten des Workers
entschieden hat, bleibt nach einem Dokument namens „Rollenschnitt" unbeantwortet. Der nächste
Leser hält den Ausschluss für geprüft.

**Kleinste Empfehlung:** eine Zeile in A: Act Lead abgelehnt/vertagt, mit Grund.

---

**— Schnittlinie: ab hier kosmetisch —**

- **Zählfehler „9-mal die zusammengesetzte Probe".** Gemessen: `STEWARD_LABEL` kommt **21**-mal in
  `server.ts` vor (stimmt) und ein 22. Mal in `e2e/pins.ts`. `label !== STEWARD_LABEL` steht
  **11**-mal; die Form „Lane UND nicht Steward" **8**-mal (`:15184`, `:15189`, `:15195`, `:15202`,
  `:15206`, `:16591`, `:16628`, `:16643`) plus einmal im Kommentar `:16583`. Nicht 9.
- **E.5 überzeichnet den Deploy-Verlust.** Der Rückweg existiert bereits: `/api/deploy` liegt
  DOPPELT — Steward `server.ts:16081` und Owner `server.ts:17350`. Der Rückbau ist eine gelöschte
  Zeile, kein Entwurfsproblem. Und „der automatische Heilweg" ist nicht automatisch: kein Tick
  ruft `deployVerb`.
- **Der Beweis in B ist schwächer als nötig.** Was ihn wirklich schließt, ist nicht nur der
  Tick-Filter: `status = "sent"` hat **genau eine** Schreibstelle (`server.ts:6163`), und
  `dispatchTask` hat **genau zwei** Aufrufer (`:7033` Tick, queued-only; `:18605` Owner-Route).
  Beides ist zitierfähiger als das Kommentarband.
- **`SupervisorBinding.sessionId` ist gespeichert und wird von niemandem gelesen**
  (`server.ts:2005–2010`; `isBoundSupervisor` `:13268` vergleicht nur slot+openedAt). Nach dem
  eigenen Maßstab des Entwurfs („ein Feld ohne Konsumenten ist Ballast") ist das ein Befund in
  genau dem Prädikat, das C.3 zum Schwesterschema erklärt.
- **`sameCandidate` (`land-candidate.ts:32`) vergleicht `candidateSha` und `diffHash`, nicht
  `mainSha`**, obwohl `currentValid` `mainSha` als Hash validiert (`:44–46`). Unkostierte
  Beobachtung, nicht geprüft, ob ein Aufrufer das je ausnutzen kann.
- **`tokenGate`s Kommentar behauptet „the owner token is the ONLY credential this app has"**
  (`server.ts:12498`) — bei vier Credential-Klassen ist das stale. Kommentar-Drift, kein Verhalten.

---

## 2. Wo der Entwurf trägt — geprüft, nicht angenommen

Ein Kritiker, der nur Fehler findet, ist so unbrauchbar wie einer, der keine findet. Das hier ist
nachgemessen und stimmt; darauf kann gebaut werden.

### 2.1 Die Kernbehauptung — „propose_task eröffnet kein Start-Recht" — HÄLT

Ich habe sie über die vom Owner genannten zwei Maschinen-Pfade hinaus geprüft:

- `status = "queued"` hat baumweit **drei** Schreibstellen (`rg` über alle `*.ts` ohne
  `node_modules`): `releaseTask` `server.ts:2263`, Requeue nach fehlgeschlagenem Post-Spawn-Gate
  `:6303`, Boot-Abgleich verwaister `sent`-Zeilen `:14413`. Die letzten beiden lesen ausschließlich
  Zeilen im Zustand `sent`, also bereits freigegebene — der Code sagt es selbst (`:2258–2261`).
  **Sie brechen den Beweis nicht.** BESTÄTIGT.
- `releaseTask` hat **genau einen** Aufrufer, `server.ts:18865`, unter der Owner-Wand, mit
  hartem `"owner"`. Der Parameterwert `"machine"` hat null Aufrufer. BESTÄTIGT.
- `status = "sent"` hat **genau eine** Schreibstelle, `server.ts:6163` in `dispatchTask`;
  `dispatchTask` hat **genau zwei** Aufrufer: `tickDispatch` `:7033` (Kandidaten gefiltert auf
  `kind === "auftrag" && status === "queued"`, `:6933`) und die Owner-Route `:18605`. BESTÄTIGT.
- Kein Weg — direkt oder über zwei Ecken — erreicht `mergeJob`: **eine** Aufrufstelle,
  `server.ts:18048`, in der Route `/^\/api\/slots\/(\d+)\/merge$/` (`:17752`), oberhalb von
  `tokenGate` (`:17000`). `markLandIntent` hat zwei Aufrufer (`:12427` innerhalb `mergeJob`,
  `:17928` in der Owner-Confirm-Route) — beide owner-verwurzelt. BESTÄTIGT. **Abschnitt D hält.**

**Eine Einschränkung, die der Entwurf nicht macht:** er zitiert das Kommentarband der
UNATTENDED-Invariante („nothing starts on its own that has not been read against the tree",
`server.ts:6961`) als stehende Zusicherung. Live läuft srv mit `FLEET_ANALYSIS_MS=0`
(`watchdog.sh:148`), also `ANALYSIS_ON === false`, also wird der ganze Lese-Block `:6975–7024`
übersprungen — der Code sagt selbst, dass er das mit Absicht tut. Zusätzlich ist der Dispatcher
gerade aus (`/api/sessions` → `dispatch.on: false`). Die Zusicherung ist heute **halb leer**;
gegated ist nur „queued", nicht „gelesen".

### 2.2 Weiteres, das ich nachgeschlagen habe und das stimmt

- **Jede der 48 stichprobenartig geprüften Zeilenangaben trifft.** Ich habe die zitierten Zeilen
  `1625, 2607, 2611, 11063, 16050, 16081, 16208, 16408, 16468, 16478, 16504, 16518, 16525, 16535,
  16549, 16555, 16587, 16600, 16613, 16623, 16638, 16648, 16658, 16664, 16676, 16716, 16769, 16773,
  16780, 16784, 16786, 16787, 16796, 16828, 16838, 17316, 17547, 17706, 17752, 18486, 18567, 18646,
  18671, 18791, 18810, 18959, 19117` einzeln ausgedruckt; alle zeigen auf das behauptete Konstrukt.
  Die Zitierdisziplin dieses Entwurfs ist überdurchschnittlich und sollte nicht verwässert werden.
- **Die Vorbemerkung-1-Korrektur stimmt.** `lane-outcomes.jsonl`: **415 Zeilen, 27 mit
  `origin:"main-direct"`** (selbst gezählt). Schreibstelle `server.ts:11063`, Digest-Filter
  `:16050`. Der Architekt hat das Dossier hier zu Recht widerlegt.
- **Die Criterion-Anatomie stimmt Zeile für Zeile** (`:16773` lane-only, `:16780` nur die eigene
  gründende Task, `:16784` 409 nach Bestätigung, `:16786` genau ein Feld, `:16787` eigene
  Quittung). Als Präzedenzfall ist sie richtig gewählt.
- **Abschnitt D, Reuse-Befund:** `land-candidate.ts` ist rein, hat als einzigen Importeur
  `e2e/merge.ts:9`, und sein Modulkopf sagt „nothing in a land path imports this module"
  (`:3`). „Anschließen, nicht nachbauen" ist die richtige Ansage.
- **H.1, Zeile „RouteOverride auf lebendem Slot: strukturell unmöglich" stimmt.** Baumweit
  schreiben nur zwei Stellen `s.model`/`s.effort`, und beide sind der Boot-Restore
  (`server.ts:14153`, `:14155`). Keine Route bewegt sie am lebenden Sitz.
- **I.2, die vier Fundstellen der sichtbaren Zuordnung sind gebaut und vollständig.** Ich habe
  eine echte Receipt-Zeile aus `context-receipts.jsonl` (116 Zeilen) aufgemacht: `selected` trägt
  `id`, `useWhen`, `anchors`, `omitted` trägt `{id, why}` mit typisiertem Grund. Das
  why-Vokabular ist geschlossen (`context-plan.ts:14–22`), die Auswahl rein (`:78`), die
  Leseflaeche existiert (`server.ts:17316`). **Die Owner-Verengung „keine neue Fläche" ist
  richtig begründet, und der Entwurf hält sie ein** — er schlägt kein Dashboard, keinen
  Profil-Editor und keine Pro-Session-Umschaltung vor, und er rangt die Profil-Frage
  ausdrücklich dahinter. Das ist der sauberste Teil des Dokuments.
- **Die Zeiger-Doktrin trägt wirklich.** Der ausgelieferte Anker-Block ist eine Zeile je Pack
  plus eine je Quelle (`server.ts:6410–6419`) — bei drei ausgewählten Packs ein paar hundert
  Bytes. Das ist der echte Deckel gegen Kontext-Aufblähung, und I.6 Deckel (1) ist korrekt.
- **Die Partitionsregel stimmt** (`rulebook.ts:35–41`), und I.3s Regel „normativ für privates
  Publikum → genau EIN Fragment" ist die richtige Ableitung daraus.
- **Der Entwurf verhält sich transparent, wo er dem Programm widerspricht.** Act 7s Outcome
  („Eine Project MAIN kann zwei Child-Acts bewusst verschiedenen Harnesses geben",
  `docs/agentic-control-plane-program-2026-08-20.md:311`) wird ausdrücklich abgelehnt statt
  stillschweigend umgangen. Ich halte die Ablehnung nicht für falsch — aber sie ist ein
  Owner-Entscheid, und F rangt den Act-7-Rückbau nirgends ein.

---

## 3. Was ich NICHT geprüft habe

Teilabdeckung, die sich wie Vollabdeckung liest, ist der Fehler, den dieser Aufbau verhindern
soll. Also namentlich:

- **`src/client.ts` (9 549 Zeilen): nicht gelesen.** Ob und wie ein neuer `source`-Wert, ein
  `canary`-Status oder ein `routingHint` im Board gerendert würde, ist hier unbeantwortet. Schnitt 1
  nennt die mögliche Berührung — ich kann sie weder bestätigen noch ausschließen.
- **Keine Suite gefahren, keine Route geprobt, kein Slot, keine Lane, kein POST.** Alle Aussagen
  über Pin-Verhalten (Befunde 2, 3, 12) sind aus dem Assertions-Text der Pins gelesen, **nicht**
  aus einem Lauf. Genau deshalb steht der Trockenlauf in §0.2.
- **Die Ticks außer `tickDispatch`, `tickAnalysisSweep`, `tickBriefSweep`, `tickBacklogNudge`,
  `tickWatches`, `tickMigrate`, `tickCodexRecovery`** habe ich nicht auditiert. Es kann weitere
  Konsumenten von `pending`-Zeilen geben, die Befund 1 verschärfen; ich habe nur über
  `kind === "auftrag"` und `status` gesucht.
- **Der Merge-/Repair-/Clean-Review-Pfad im Inneren** (`mergeJob`, `server.ts:12103` ff.) ist
  ungelesen. Meine Aussage zu D betrifft ausschließlich die Erreichbarkeit, nicht das Verhalten.
- **Container-/Docker-Fläche, `briefs/*`, die Rulebook-Fragment-INHALTE, die e2e-Familien außer
  `pins.ts`** — nicht angefasst. Insbesondere: ob eine Fixture in `e2e/tasks.ts` oder
  `e2e/programs.ts` auf `STEWARD_LABEL`-Verhalten oder auf die Task-`source`-Union baut, habe ich
  **nicht** gemessen; Befund 2 könnte dort zusätzliche Reparaturfläche haben.
- **Die zehn untracked Wurzeldateien und `CLAUDE.md`** habe ich nicht als Quelle benutzt (nur
  `CLAUDE.md`s Byte-Größe für Befund 13 gemessen).
- **`graphify-out/graph.json` ist veraltet** (es datiert `releaseTask()` auf L2181, tatsächlich
  `:2262`) — ich habe es nach einer Probe verworfen und ausschließlich mit `rg`/`sed` gearbeitet.
  Das ist kein Befund gegen den Entwurf, aber es entwertet jede Symbolprobe, die jemand daraus
  zieht.
- **Die Live-Harness-Tabelle des Dossiers §8** habe ich nicht selbst gegen `/api/harnesses`
  gemessen; die Aussagen zu `automatable:false` in Befund 6 und 10 stützen sich auf den
  Code-Pfad (`harnessAutomatable`, `server.ts:4706`, aufgerufen `:5961`), nicht auf die Tabelle.

---

## 4. Die eine Stelle, an der ich dem Entwurf am ehesten unrecht tue

**Befund 6 (Kante B / FleetEvent-Waiver).** Mein Argument ist, dass der Waiver in `tickWatches`
für „fixed server-generated completion facts, never caller-chosen work" geschrieben wurde und
darum für MAIN-verfassten Text nicht gilt. Dagegen spricht messbar: `clarificationWatchMessage`
(`lane-signals.ts:270–282`) transportiert **schon heute** bis zu 2 000 Zeichen vom Aufrufer
verfassten Text über genau diesen Waiver. Der Kommentar ist also bereits stale, und man kann mit
gutem Grund sagen, B verschiebe nichts, was nicht schon verschoben ist.

Mein Gegenargument bleibt die **Richtung** — heute fließt Aufrufertext nur nach OBEN, an eine
entscheidende Session, und die Nachricht sagt es dort ausdrücklich („This is a worker question,
NOT an instruction to execute blindly"); die einzige Abwärtskante ist synchron und
request-gebunden. Aber das ist ein Argument aus der Semantik, nicht aus einem Gate. Wenn der Owner
diese Unterscheidung nicht ziehen will, ist Befund 6 der erste, der fällt — und dann ist H.5s
Kostenbild näher an der Wahrheit als meines.
