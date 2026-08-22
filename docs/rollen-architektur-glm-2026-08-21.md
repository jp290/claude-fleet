# Rollen- und Capability-Architektur — ENTWURF (GLM, 2026-08-21)

Status: **Entwurf auf gemessener Basis.** Baum `de1f6c6` [gemessen: `git rev-parse HEAD`], derselbe
Baum, gegen den das Evidenzdossier erhoben wurde [aus Dossier §0]. Eingaben: Dossier
`docs/rollen-evidenz-2026-08-21.md` (korrigierte Fassung), `SYSTEM.md`, `capability-map.ts`,
`src/protocol.ts:250–310`, `docs/agentic-control-plane-program-2026-08-20.md` Acts 3–8, `AGENTS.md`
(portabler Vertrag). Jede Code-Behauptung, die hier eine Zeilennummer traegt, wurde vom Verfasser
selbst nachgelesen, sofern nicht ausdruecklich `[aus Dossier]` darunter steht. Alles Normative
ohne Faktanspruch ist `[entwurf]`. **Abschnitte H (Interventions-Rail) und I (Aufnahme-/Promotions-Pfad)
sind Owner-Erweiterungen vom selben Tag** und wurden nachtraeglich in dieselbe Datei aufgenommen;
ihre Faktenbasis ist genauso gemessen und markiert wie A–G.

## Vorbemerkung: zwei Messkorrekturen zur Eingabe

1. **Dossier §7 ist in einer Aussage widerlegt.** „Eine MAIN-Session in ihrem eigenen Repo erzeugt
   darin nie eine Zeile" gilt nicht absolut: `lane-outcomes.jsonl` hat 415 Zeilen, davon 27 mit
   `"origin":"main-direct"` [gemessen: `rg -uu -c` auf der Ledger-Datei; Schreibstelle
   server.ts:11063]. Richtig ist: ein Direkt-Commit **ohne** die freiwillige main-direct-Meldung
   bleibt jedem land-seitigen Ledger unsichtbar; die Meldeschiene existiert, ist belegt genutzt und
   wird im Steward-Digest bewusst herausgefiltert [gemessen server.ts:16050]. Kein STOP: die
   operationelle Kernaussage des Dossiers (un-instrumentierte Hand-Lands sind unsichtbar) bleibt
   wahr; die Schiene staerkt die Wiederverwendungsposition dieses Entwurfs.
2. **Die Kurator-Korrektur zu `/api/self/criterion` und `/api/self/attention` ist bestaetigt.**
   Criterion ist lane-only [gemessen server.ts:16773], findet nur die eigene gruendende Task
   [:16780], schreibt genau ein typisiertes Feld [:16786], ist nach Owner-Bestaetigung unaenderbar
   (409) [:16784] und quittiert selbst [:16787]. `openAttention` lehnt jeden Nicht-gebundenen
   Aufrufer ab [gemessen server.ts:5742–5745] mittels `boundProgramForMain`, das das volle Triple
   slot+openedAt+sessionId **und** `status === "active"` prueft [gemessen server.ts:5706–5710].
   Beides ist fuer diesen Entwurf konstitutiv, nicht Fussnote.

---

## A. Rollenschnitt

**These: Drei Agentenrollen genuegen — als typisierte Bindungen auf einem Sitz, nicht als
Credential-Klassen.** [entwurf]

Eine Rolle ist hier **eine benannte, mechanisch pruefbare Bindung eines Slot-Sitzes**, nicht ein
Token und nicht ein Label. Der Code kennt heute schon drei solche Bindungen: die Lane
(`s.worktree !== null`), die Program-MAIN-Bindung (`program.main`-Triple, server.ts:1940, geprueft
in `boundProgramForMain` :5706) und die Supervisor-Bindung (`supervisor.slot/openedAt`, geprueft in
`isBoundSupervisor` :13268) [gemessen]. Es braucht keine vierte. Darunter liegen zwei
Nicht-Agenten-Prinzipale: der **Owner** (Mensch, Owner-Token) und die **Maschine** (Ticks, Gates —
deterministisch, ohne Credential und ohne Ermessen; der Dispatcher-Tick ist ihr Praezedenzfall,
server.ts:6927). [entwurf, gestuetzt auf gemessene Bindungen]

### Die sieben Kandidaten des Owners

| Kandidat | Urteil | Begruendung (warum keine Zusammenfall-Loesung reicht bzw. nicht reicht) |
|---|---|---|
| **Globaler owner-seitiger Controller** | **Scope-Parameter einer Project-MAIN, keine eigene Rolle** | Ein Coordinator mit Fleet-weiter **Schreib**autoritaet waere funktionell der Owner — ein zweites solches Credential ist ein Autoritaetsleck, kein Fortschritt [entwurf]. Mit **Lese**autoritaet ist er eine MAIN, deren Program das Fleet-Repo selbst zum Gegenstand hat; die dafuer noetigen Lese-Sichten existieren (Steward-Digest :16083, `supervisor-view` :16518, Owner-Board-Routen) [gemessen]. SYSTEM.md nennt den Controller „Coordinator mit verschiedenem Scope" neben der Project-MAIN — genau das: Scope, nicht Klasse [aus SYSTEM.md, Rollenmodell]. |
| **Supervisor** | **Eigene Rolle (duennste)** | Die Bindung existiert und wird schon heute mechanisch geprueft (:13268, benutzt in :16522, :16529) [gemessen]. Sie ist die einzige Rolle, deren Saettigung **rein beobachtend** ist: View aggregiert, mutiert nichts; Nudge schreibt genau einen Paste in genau einen abgeleiteten Pane [gemessen server.ts:13258–13266 Kommentarband]. Sie faellt nicht mit der Project-MAIN zusammen, weil eine MAIN Partei ihres Programs ist und eine beobachtende Rolle unparteiisch ueber Programme hinweg sein muss — eine MAIN, die sich selbst beobachtet, ist keine Kontrolle [entwurf]. |
| **Project-MAIN** | **Eigene Rolle** | Die Bindung existiert mit dem staerksten Identitaets-Triple im System (:1940, :5706–5710) [gemessen]. Sie faellt nicht mit dem Supervisor zusammen (Partei vs. unparteiisch, s.o.) und nicht mit dem Worker (Haelter des Arbeitszusammenhangs vs. Ausfuehrender eines begrenzten Stuecks). Sie ist die Rolle, deren Faehigkeitsluecke der Anlass ist [gemessen, Dossier §1, eigene Nachpruefung]. |
| **Fable / kreative MAIN** | **Gar keine** | Ein Program ist ein Program; „kreativ" ist Inhalt, kein Autoritaetsunterschied [entwurf]. Die einzigen messbaren Unterschiede einer kreativen MAIN waeren Harness/Modell — und das sind Spawn-Parameter (server.ts:17550–17560: harness/model/effort sind Koerper der Lane-Route), keine Rollen [gemessen]. SYSTEM.md lehnt die Rolle ausdruecklich ab („dafuer braucht Fleet keine weitere permanente Hierarchiestufe oder eigene ‚Fable-MAIN'-Rolle") [aus SYSTEM.md]. Eine zusaetzliche Rolle hier waere reine Zeremonie. |
| **Builder-Lane** | **Modus des Workers** | „Die Lane" ist keine Bau-Lane neben anderen Lanes: `s.worktree !== null` ist die eine harte, schon existierende Unterscheidung [gemessen]. Bauen/Kritisieren/Analysieren/Verifizieren sind Brief- und `kind`-Varianten (`TASK_KINDS = auftrag|richtung|notiz|betrieb`, server.ts:1625) [gemessen], keine Autoritaetsstufen. SYSTEM.md nennt Build/Repair/Critique ausdruecklich „Specialist-Modi, keine neuen dauerhaften Autoritaeten" [aus SYSTEM.md]. |
| **Critic / Resolver** | **Gar keine als Rolle — Critic ist ein Modus, Resolver ist eine Policy** | Der ephemere Merge-Critic ist als **wegwerfender, read-only Specialist ohne jede Autoritaet** geschnitten: er kann nur auf `needs-human`/`unknown` herunterstufen [aus Programmdokument Act 8; dort auch: „ein Critic besitzt keine Schreib-, Land-, Deploy- oder Policy-Autoritaet"]. Als Rolle waere er ein stehendes Ermessen — das groesste Leak, das dieser Entwurf verhindern kann [entwurf]. „Resolver" ist noch klarer: Aufloesen ohne Owner-Diffpruefung heisst dort **owner-promovierte Policy** (Maschine klassifiziert deterministisch), nicht Agentenrolle [aus Programmdokument Act 8, SYSTEM.md PromotionPolicy]. Kritik als Arbeit existiert heute schon auf existierenden Schienen: Analyst-Urteile (`analysis-verdicts.jsonl`, server.ts:106), Dispositionen (:98) [gemessen]. |
| **Worker** | **Eigene Rolle** | Der Sitz mit Worktree, gegruendet durch eine Task (`t.slot === s.id && t.status === "sent"`, so liest ihn criterion :16780) oder durch Lane-Oeffnung mit optionalem Parent-Anker [gemessen server.ts:17547–17567, `laneParentOf`]. Er faellt nicht mit der MAIN zusammen, weil sein Brief, sein Write-Set und seine Rueckkanal-Limits genau begrenzt sind und bleiben muessen (lane-only-Routenfamilie :16600–:16796) [gemessen]. |

**Nicht im Kandidatensatz des Owners, aber im Code: der Steward.**Dieser Entwurf behandelt ihn
nicht als zusaehlende Rolle, sondern als **doppelte Implementierung einer vorhandenen**: Es gibt
bereits **zwei beobachtende Instanzen** — die 🧿-Supervisor-Bindung (View + Nudge, :16518/:16525)
und den ⚙-Steward (Token + Label + 14 Routen, Router :16067) [gemessen]. SYSTEM.md loest den
Steward ohnehin in deterministische Sensoren plus temporieren Digest-Specialist auf [aus SYSTEM.md,
Funktionen-Absatz]. **Entwurfsentscheidung: die Steward-Credential-Klasse entfaellt; seine
Pflichten verteilen sich auf Supervisor (Beobachtung), Producer-Muster (Task-Datei) und eine
owner-promovierte Policy-Klasse (Deploy-Verb).** Das ist der groesste Rueckbau dieses Dokuments
(Abschnitt E) und ein Owner-Entscheid (Abschnitt G).

### Stellungnahme zum Programmschnitt (Acts 3–8)

- **Act 2 (ausfuehrbare Capability-Quelle): behalten und erweitert.** Er ist die
  Deklarationsflaeche fuer Rollenbedingungen; kein zweites Register wird gebaut [entwurf, im
  Sinne von SYSTEM.md: „kein zweites Register"].
- **Act 3 (Promotions-Identitaet, Policy-Sensor): behalten, unberuehrt.** Andere Naht
  (Land-Kandidaten-Identitaet); dieser Entwurf baut nichts darueber [entwurf].
- **Act 5 (Program → Act → Attempt): nicht ersetzt, aber nicht mehr Voraussetzung.** Die Luecke
  ist ohne Act-Objekt schliessbar — Task + Program-Bindung reichen [entwurf]. Der hier
  vorgeschlagene Produzenten-Pinnt `programId` aus der Bindung ab (nie aus dem Koerper), genau die
  Form, die ein spaeteres Act-Objekt anschlussfaehig haelt [entwurf].
- **Act 6 (Role Bootstrap): eingeengt.** Sein Rollen-Inhalt kommt aus der Capability-Karte
  (Schnitt 2), nicht aus einem eigenen Rollenvertragsspeicher — sonst entstuende das zweite
  Register, das SYSTEM.md verbietet [entwurf].
- **Act 7 (Harnesswahl, adressierte Frage): teilweise ueberfluessig geworden.** Harness-/Modellwahl
  bei Erzeugung existiert bereits in beiden besuchten Spawn-Routen [gemessen server.ts:17550–17560,
  :18580–18590]; adressierte Frage existiert auf der Self-Schiene [gemessen :16600, :16638].
  Uebrig bleibt als neuer Teil nur die **direkte Delegation einer MAIN an zwei Harnesses** — und
  genau die lehnt dieser Entwurf fuer die MAIN ab (sie proposeiert, der Owner released, die
  existierende Maschine startet; s. B/C). Act 7 schrumpft auf: Routing-Vorschlag als Feld der
  Task-Zeile, das der Owner beim Freigeben sieht und ueberschreiben kann [entwurf].
- **Act 8 (Resolve-Policy, Critic): behalten, exakt.** Er ist das Vorbild dafuer, dass Critic und
  Resolver keine Rollen sind; dieser Entwurf liefert ihm nur das Rollenvokabular [entwurf].

---

## B. Capability-Tabelle

Zustandswirkung: `none` (liest) · `proposes` (erzeugt Vorschlag bis Owner-Promotion) · `mutates`
(aendert Maschinenzustand) · `irreversible`. **Was es heute gibt, wird namentlich wiederverwendet.**
Quittung nennt Ledger und Schreibstelle. Degradation benennt, was passiert, wenn der Harness die
Faehigkeit nicht hat — heute faellt sie still weg [aus Dossier §8]; dieser Entwurf erklaert sie in
der Karte (`harnessSupport`-Dimension ist bereits als offen deklariert, capability-map.ts
`UNMODELED_CAPABILITY_DIMENSIONS`) [gemessen capability-map.ts].

### Sitz-Basis (jede Session, Self-Token; identisch fuer alle Rollen)

| Faehigkeit | Wirkung | Autoritaet (1 Satz) | Adapter | Quittung | Degradation |
|---|---|---|---|---|---|
| describe_self | none | Nur die eigene Slot-Zeile, eigene Plaene, Watches, Events lesen. | `GET /api/self` server.ts:16408 (existiert, ist die eine adaptierte Capability) | keine (Lesen) | kein API-Zugang → Faehigkeit fehlt; Karte deklariert das |
| schedule_auto | proposes | Nur eigene Zukunftsakte dieser Session terminieren, gedeckelt. | `POST /api/self/autos` :16468 | `audit.jsonl` | Deckel 5/Slot [aus Dossier §5]; ohne API still abwesend |
| watch | mutates | Nur eigene Subscriptions auf fremde Terminalpraedikate; nie Lane-auf-Lane. | `POST /api/self/watch` :16587 (non-lane-only, 409 :16591) | `audit.jsonl` | Zustellung in den Pane laeuft durch `canDeliver` :5943; `automatable:false`-Harnesses sind unattended nicht erreichbar [aus Dossier §8] |
| ack_event | mutates | Nur eigene Event-Zeile quittieren. | `POST /api/self/events/:id/ack` :16648 | `audit.jsonl` | wie describe_self |
| succeed / retire | mutates | Nur den eigenen Sitz uebergeben/ruhen lassen; Nachfolge bindet an den eigenen Token. | :16658 / :16664; Token-Rotation :4494, `successionStarted` :5118 | `audit.jsonl` | — |

### Rolle `lane` (Worker; Builder/Critic/Analyst sind Modi)

| Faehigkeit | Wirkung | Autoritaet (1 Satz) | Adapter | Quittung | Degradation |
|---|---|---|---|---|---|
| report_result | proposes | Nur deklarativer Endstatus (complete/needs-main/failed) der eigenen Lane; nichts gated darauf. | `POST /api/self/fleet-report` :16613 (lane-only :16617) | `audit.jsonl`; Endzeile in `lane-outcomes.jsonl` :88 durch den Land-/Endpfad | ohne API: Ergebnis nur im Pane-Scrollback — unquittiert |
| ask_main | proposes | Genau eine offene Frage an die server-seitig ermittelte MAIN; Empfaenger nie vom Koerper waehlbar. | `POST /api/self/clarifications` :16600 | `audit.jsonl` + Event-Queue | Empfaenger-Aufloesung bricht, wenn die MAIN-Bindung unbesetzt ist [gemessen server.ts:5297–5305 `clarificationReceiverFor`] |
| propose_done_criterion | proposes | Nur am eigenen gruendenden Task, nur das eine Feld, nur bis zur Owner-Bestaetigung. | `POST /api/self/criterion` :16769 (Praezedenzfall, s. Vorbemerkung) | `audit("criterion_proposed")` :16787 | ohne API bleibt das Kriterium unsichtbar; Owner-Promotion unmoeglich |
| report_verify | none | Nur eigener Bericht ueber einen Verify-Lauf; erreicht Board und Audit, nichts weiter. | `POST /api/self/verify-intent` :16796 | `audit.jsonl` | — |
| read_drift / read_gate | none | Nur eigene Drift-/Proof-Empfehlung lesen. | :16676 / :16716 | keine | — |

### Rolle `program-main`

| Faehigkeit | Wirkung | Autoritaet (1 Satz) | Adapter | Quittung | Degradation |
|---|---|---|---|---|---|
| ask_owner | proposes | Nur als aktuell gebundene MAIN eines aktiven Programs; idempotent je Bindung+Art+Text, gedeckelt offene Anfragen. | `POST /api/self/attention` :16638 → `openAttention` :5716, Bindungspruefung :5742 | `audit.jsonl`; Attention-Objekt | ohne API: keine Frage an den Owner — einziger Ersatzweg ist der Pane-Mensch |
| propose_program | proposes | Nur Programmentwurf; Wahrheit erst durch Owner-Confirm/Activate. | `POST /api/self/programs` :16478; Owner-Gate der Promotion :16816–16821 | `audit.jsonl` | — |
| read_execution | none | Nur Ausfuehrungssicht des eigenen Programs; eine Lane erhaelt 409. | `GET /api/self/program-execution` :16504 | keine | — |
| direct_work_provenance | mutates | Nur im eigenen Checkout, nur Selbstmeldung: Preflight bindet Tip vorher, Finalize verifiziert, dass der Integration-Tip wirklich wanderte und zur Angabe passt — `landed` ist Beleg, nie ein Fleet-Land. | `GET/POST /api/self/main-direct*` :16535/:16549/:16555 | **`lane-outcomes.jsonl`, Zeilen mit `origin:"main-direct"`** :11063 (27 Zeilen gemessen) | ohne API: Hand-Land bleibt unquittiert — genau die Messluecke aus Dossier §7 |
| **propose_task (NEU, Kernstueck)** | proposes | Als gebundene MAIN ausschliesslich **vorschlagende** Task-Erzeugung fuer das eigene Program: `status` hart `pending`, `programId` aus der Bindung abgeleitet (Koerper-Angabe → 400), `repo:null`, gedeckelt je Program; Starten bleibt Owner-Freigabe vorbehalten. | **neu**: `POST /api/self/tasks`, gleiche Form wie Steward-Route :16208–16254, Rollenbedingung `boundProgramForMain` :5706 zuzueglich Lane-Ausschluss (409) | `audit("main_task", slot, program:task)` — gleiche Zeilenform wie `steward_task` :16252 | ohne API faellt die Faehigkeit still aus; Ersatzweg: `ask_owner` mit Text — schlechter, aber vorhanden |

**Warum `propose_task` kein neues Start-Recht eroeffnet — der gemessene Beweis:** Der unattended
Dispatcher-Tick filtert `t.status === "queued"` [gemessen server.ts:6933]; eine `pending`-Zeile
kann von ihm nie gestartet werden. Die besuchte Start-Route akzeptiert zwar auch `pending`
[gemessen :18574], liegt aber unter dem Owner-Gate [:18567 < :17000-Wall]. Der Start einer
MAIN-Datei verlaeuft also zwingend durch genau eine Bruecke: die Owner-Freigabe (Queue-Klick).
Damit gilt weiterhin das unattended Invariante-Kommentar des Ticks wortgleich („nothing starts on
its own that has not been read against the tree", :6962ff.) [gemessen]. **Die Luecke schliessen
heisst hier: die MAIN darf die Schlange fuettern, nicht den Zaun oeffnen.** [entwurf]

### Rolle `supervisor` (beobachtend; nimmt nach Rueckbau die Steward-Pflichten auf)

| Faehigkeit | Wirkung | Autoritaet (1 Satz) | Adapter | Quittung | Degradation |
|---|---|---|---|---|---|
| read_fleet_state | none | Nur aggregierte Fuenf-Faktengruppen-Sicht; mutiert nichts. | `GET /api/self/supervisor-view` :16518 (Bindung :16522) | keine | — |
| nudge | mutates | Genau ein Paste in genau einen abgeleiteten Pane; nichts persistiert ausser Quittung und Journalzeile. | `POST /api/self/nudge` :16525 | `steward-journal.jsonl` :85 + `audit.jsonl` | Zustellung durch `canDeliver` :5943; `automatable:false` → unattended nicht zustaendig |
| propose_task (nach Schnitt 3) | proposes | Wie program-main, aber ohne Program-Bezug (`programId` bleibt undefiniert); uebernimmt die Steward-Pulse-Datei mitsamt Ref-Dedup und Cap. | Schnitt 3: dieselbe neue Route, Rolle `isBoundSupervisor` :13268 | `audit("supervisor_task", …)` | Ersatzweg: Steward-Journal-Notiz (heutige Form) |
| read_digest / read_register | none | Nur Rundgang-Digest und eigenes Journal lesen (heutige Steward-Routen, umgecredentiaelt). | :16083 / journal-GET in :16068–:16290 | keine | — |

### Owner (Mensch; kein Agent, zur Vollstaendigkeit)

Promotiert (Queue, criterion-confirm :18791, program confirm/activate :16816), landet
(merge-Route :17752, einzige `mergeJob(`-Aufrufstelle :18048), deployed, oeffnet/toetet Slots und
Lanes (:17547, :18959), schreibt Dateien, setzt Pins. Alles positionell hinter der einen Wall
:16999/:17000 [gemessen]. **Keine dieser Zeilen wird durch diesen Entwurf bewegt.** [entwurf]

### Maschine (Ticks/Gates; kein Credential, kein Ermessen)

Dispatcher-Tick :6927 (startet nur `queued`, eine Lane pro Tick, serial, :7028–:7033), Verify-Gate
(`VERIFY_CMD`, dreiwertig [aus Dossier §6]), `canDeliver` :5943. Die Maschine ist der Grund, warum
Produzent/Promoter ohne neues Start-Recht funktioniert [entwurf].

---

## C. Autoritaetsmodell

**Heute: drei Credential-Klassen.** Ziel: **zwei.**

| Klasse | Urteil | Begruendung |
|---|---|---|
| Owner-Token (`tokenGate` :12501, Wall :17000) | **bleibt** | Es ist die einzige positionelle Regel, die dieser Entwurf behaelt — als **aeussere Wand**, hinter der die Owner-Flaeche liegt. Position ist als EINE aussenliegende, gepinnte Regel tragfaehig; als verteilte Berechtigungslogik war sie es nie („owner-only by POSITION", sieben explizite Kommentarstellen :17148, :17293 u.a.) [gemessen]. |
| Self-Token je Slot (:1841, Rotation :4494, in die Pane gebacken :4332 [aus Dossier]) | **bleibt — die einzige Agenten-Credential** | Identitaet haengt am Sitz, nicht an der Rolle; Rotation und Nachfolge-Bindung (:5118) machen ihn recyclingfest [gemessen :4494]. Rollen kommen **nie** als eigene Tokens dazu. |
| Steward-Token (:2608, Persistenz :14353 [aus Dossier], Abfang :16838) | **verschwindet** (Schnitt 4) | Es ist die einzige der drei Klassen, deren Rolle **nicht** mechanisch, sondern per Labelstring bestimmt wird (naechster Absatz). Seine Pflichten haben alle einen besseren Ort (A, E). |

**Was ersetzt die drei heutigen Autoritaetsmechanismen?**

1. **Positionelle Autoritaet (Zeilennummer)** → bleibt **nur** als Owner-Wand und wird selbst zum
   gemessenen Fakt: Schnitt 2 pinnt die Tier-Zugehoerigkeit jeder deklarierten Route (owner/self)
   in `e2e/pins.ts` — derselbe Pin-Mechanismus, der heute schon jeden benannten HTTP-Adapter der
   Karte gegen `server.ts` haelt [gemessen e2e/pins.ts:634]. Position hoert auf, Folklore zu sein,
   und wird eine assertierte Invariante. [entwurf]
2. **Labelstring `"⚙ steward"`** (`STEWARD_LABEL` :2607, **21 Vorkommen**, davon 9-mal die
   zusammengesetzte Probe `s.worktree && s.label !== STEWARD_LABEL` [gemessen: `rg -c` = 21 bzw. 9];
   Rollenfindung per `stewardSlot()` :2673 = reiner Labelvergleich [gemessen]) → **entfaellt
   vollstaendig** mit der Steward-Falte. Ein Rename duerfte nie eine Rolle wechseln; das Label war
   Autoritaet aus Anzeige-Text. Ersatz sind die beiden Bindungspraedikate. [entwurf]
3. **Program-Bindung** (`program.main`-Triple :1940) → **bleibt unverdert und wird die benannte
   Koordinator-Autoritaet.** `boundProgramForMain` (:5706) prueft das volle Triple **plus**
   `status === "active"` — es ist das einzige heutige Rollenkriterium, das einen Occupant-Wechsel
   korrekt bricht statt falsch weiterzuberechtigen [gemessen :5706–5710]. `isBoundSupervisor`
   (:13268, slot+openedAt) ist sein Schwesterschema fuer die beobachtende Rolle [gemessen].

**Der kleinste Schnitt dorthin:** kein Rollenfeld auf `Slot` [gemessen: Feldinventar des Interface
enthaelt keins], kein Middleware-Layer, kein RBAC-Framework. Eine Faehigkeit wird geprueft als
**Credential (Self-Token) → benanntes Bindungspraedikat (`boundProgramForMain` /
`isBoundSupervisor` / `worktree`) → Route**, und genau diese Kette wird **deklariert** in
`capability-map.ts` (`roleCondition`-Feld existiert im Schema seit Act 2 [gemessen
capability-map.ts, `SELF_ADAPTER.roleCondition`]) und **gepinnt** gegen `server.ts`. Die
401/403-Disziplin des Steward-Routers („gueltiges Credential, falscher Scope = 403, unterscheidbar
von 401", :16838 Kommentarband) bleibt als Muster fuer jede Rollenverweigerung erhalten [gemessen].
Typseitig wird `CapabilityRole` um `"lane"` und `"supervisor"` erweitert (heute
`"session" | "program-main"`, src/protocol.ts:255; `QuestionRole` kennt alle vier schon, :305)
[gemessen]. [entwurf]

---

## D. Wo das Landen wohnt

Das Landen bleibt **eine Owner-Handlung auf genau einer Route**: `POST /api/slots/:id/merge`
(:17752) enthaelt die einzige `mergeJob(`-Aufrufstelle (:18048) im ganzen Monolithen [gemessen;
bestaetigt durch die Kommentare :527 und :15392, die eben diese Eindeutigkeit behaupten]; kein
Tick, kein Auto, kein Dispatch-Pfad erreicht sie [aus Dossier §6, mit :527/:15392 mitgemessen].
Die **Invariante, die nie fallen darf: kein Agenten-Credential — Self-Token einer MAIN, einer
Lane, eines Supervisors — erreicht je `mergeJob` oder `markLandIntent`.** Die einzige kuenftige
Ersaetzung fuer den Owner-Klick ist eine **owner-promovierte Policy** (Act 8), also ein
Policy-Dokument mit benannter Version, nie eine Rolle und nie ein Ermessen [aus Programmdokument
Act 8; SYSTEM.md PromotionPolicy]. **Reuse-Befund (nachtraeglich selbst gemessen):** Die halbe
Maschinerie dafuer ist bereits GEBAUT und ungenutzt — die Typen `LandCandidateVerifyRun`/`LandCandidate`/
`CandidateFreshness`/`VerifyFreshness`/`PromotionRiskClass` (sechs Werte)/`PromotionPolicyFacts`
[gemessen src/protocol.ts:318/:334/:341/:342/:343/:351] und die reine Projektion
`projectPromotionPolicyFacts` [gemessen land-candidate.ts:29], deren `sameCandidate` an `candidateSha`
UND `diffHash` bindet [gemessen land-candidate.ts:31–33] und deren Freshness ohne beobachtete
Ist-Identitaet ehrlich `unknown` bleibt statt fresh zu behaupten [gemessen land-candidate.ts:36–39
samt Modulkopf]. Aufgerufen wird sie ausschliesslich von `e2e/merge.ts` (:541/:551/:690); KEIN Land-Pfad
importiert sie — laut Modulkopf mit Absicht („nothing in a land path imports this module") [gemessen
land-candidate.ts:1–4]. Fuer Act 8 heisst das: **anschliessen, nicht nachbauen.** An der Invariante
oben aendert das nichts, denn die Projektion ist rein lesend und von keinem Land-Pfad erreicht [gemessen].
Dazu gehoert die ehrliche Randnotiz des heutigen Zustands: Eine
non-lane MAIN mit Shell kann `main` im eigenen Checkout von Hand bewegen — das kann Fleet nicht
verhindern, nur **sichtbar** machen; genau dafuer existiert die main-direct-Schiene (Preflight/
Finalize, Belegzeilen mit `origin:"main-direct"`, 27 Zeilen gemessen), und genau deshalb muss sie
**Beleg bleiben und nie Land werden**: kein Verify-Gate, kein Tier-2-Lauf, keine `fleet/land`-Note
haengen an ihr [gemessen :11004–:11070; aus Dossier §6/§7]. Der Owner-gegebenen
„Rueckgaenglich"-Grenze (undo-land deckt genau ein Land, :17706 [aus Dossier]) widerspricht das
nicht: Sie beschreibt die merge-Route, nicht die Selbstmeldung.

---

## E. Rueckbau — die Liste

**Neue Dinge dieses Entwurfs (5):** (1) eine Route `POST /api/self/tasks` [entwurf]; (2)
`Task.source`-Wert `"main"` neben `"owner"|"intake"|"steward"` [gemessen Union :1646] plus eine
Cap-Konstante je Program in der Form von `STEWARD_MAX_PENDING` (:2611, Default 10 [gemessen]);
(3) ein Audit-Wort `main_task`; (4) Karte: Zeilen fuer `propose_task` plus deklarierte
`roleCondition` je Self-Faehigkeit und die `harnessSupport`-Dimension (heute als unmodelliert
markiert [gemessen capability-map.ts]); (5) Typ-Erweiterung `CapabilityRole` (src/protocol.ts:255).
Die Rueckbau-Liste ist länger:

1. **`POST /api/steward/tasks` (:16208–:16254) entfaellt.** Datei-, Cap-, Ref-Dedup- und
   Pending-Pinn-Logik wandern in die neue Produzenten-Route (nicht umgekehrt: die allgemeinere
   Form ersetzt die engere). *Was bricht:* der Regeltext des Pulses (rundgang/inspektion, private
   Owner-Flaeche, hier nicht gelesen) und jede Tasche, die den Pfad hartverdrahtet — beides ist
   vor Schnitt 3 zu tragen, nicht danach.
2. **Steward-Token-Klasse entfaellt** (`stewardToken` :2608, Persistenz :14353 [aus Dossier],
   Abfang :16838–:16840 inkl. 403-Fallback). *Was bricht:* der laufende Puls verliert sein
   Credential, sobald der Host es nicht mehr traegt — deshalb muss die Supervisor-Bindung des
   Pulse-Sitzes VORHER stehen (Reihenfolge in F). Der Eintrag in `fleet.json` ist Host-Flaeche und
   Owner-Hand.
3. **`STEWARD_LABEL` samt allen 21 Vorkommen entfaellt** (:2607; 9 davon in der zusammengesetzten
   Rollenprobe [gemessen]). *Was bricht:* nichts Maschinelles, wenn 2 vorher kam — im Gegenteil:
   ein Slot-Rename wechselt dann keine Autoritaet mehr. Anzeige-Labels duerfen Anzeige bleiben.
4. **`stewardSlot()` (:2673) entfaellt.** Ersatz: der Occupant der Supervisor-Bindung
   (`isBoundSupervisor`). *Was bricht:* jede Funktion, die „den Steward-Slot" sucht — das sind
   genau die Audit-Attributionen der Steward-Routen; sie schreiben kuenftig auf die Bindung.
5. **`/api/deploy` als Steward-Verb (:16081) verliert seine Credential-Grundlage.** Der Verb war
   begruendet mit „VERB 2 fuer den Prinzipal, der die Luecke SIEHT" [gemessen :16079–:16080
   Kommentarband]. Ziel-Ort: eine **owner-promovierte Policy-Klasse** (deterministische
   Eligibility `bundleStale/deployGap`, gleiche zwei Funktionen, kein zweiter Code) oder — bis der
   Owner eine Policy promoviert — zurueck hinter die Owner-Wand. *Was bricht:* der automatische
   Heilweg fuer stale Bundles, solange die Policy nicht existiert. Das ist ein echter Verlust auf
   Zeit und muss vom Owner entschieden werden (G).
6. **`handleStewardRoute` (:16067, 14 Routen) loest sich auf** in: Supervisor-Bindung
   (sessions/digest/journal/deploys-GET/transcript/brief), Produzent (tasks, s. 1), Nudge-Form
   (send) und Policy/Owner (deploy). *Was bricht:* nichts, wenn 1–5 vorher kamen; der Router selbst
   ist dann leer.
7. **Verhinderter Rueckbau (nicht gebaut, mit Begrundung):** kein Fleet-Controller-Credential
   (waere ein zweiter Owner); keine Fable-MAIN-Rolle (Modus/Parameter); keine Critic-/Resolver-Rolle
   (Act-8-Verstoss); kein Rollenfeld auf `Slot` (Bindungen sind staerker und existieren); kein
   zweites Faehigkeitsregister neben der Karte (SYSTEM.md verbietet es); kein zusaetzliches
   Start-Recht fuer MAINs (der Tick-Beweis in B macht es unnoetig).

---

## F. Migrationsschnitte, gerangt

**Schnitt 1 — Produzenten-Route fuer gebundene MAINs.**
*Liefert:* `POST /api/self/tasks` gemaess B (pending-gepinnt, `programId` aus Bindung, kind
validiert gegen `TASK_KINDS` :1625 mit Default `auftrag`, `repo:null`, Cap je Program,
Ref-Dedup wie :16226 uebernehmbar, Lane-Ausschluss 409), Audit `main_task`, Karte: Zeile
`propose_task` (roles: program-main) mit Adapter und Probe, Pin in `e2e/pins.ts` nach dem
bestehenden Adapter-Pin (:634). *Exklusives Write-Set:* `server.ts` (eine Route im Self-Tier,
Task-Typ :1646, eine Konstante), `capability-map.ts`, `docs/system-capabilities.generated.md`
(generiert), `e2e/pins.ts`, minimal `src/client.ts` (Board-Darstellung eines neuen
`source`-Werts — zu pruefen, ob ueberhaupt gerendert). *Done-Kriterium (pruefbarer Satz):* „Eine
gebundene Program-MAIN erzeugt mit ihrem Self-Token eine Task mit `status:"pending"` und ihrer
programId; ein ungebundener Sitz, eine Lane und das Steward-Token erhalten 409; eine
Koerper-`programId` wird mit 400 abgelehnt; der Dispatcher-Tick startet die Zeile nicht, solange
sie `pending` ist." *Proof-Kommando:* `bun e2e/pins.ts && bunx tsc --noEmit --strict --target
esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts
src/share.ts server.ts fleet-e2e.ts` plus die Task-Familie in `e2e/` laut AGENTS-Regel („neben
ihrer Familie", nicht ans Dateiende). *Nicht anfasst:* Owner-Tier, Dispatch, Merge/Land,
Steward-Tier, Act-Objekte, Loader. *Allein wertvoll:* ja — schliesst die gemessene Luecke vollstaendig,
ohne dass Schnitt 2 je kommt. *Haengt ab von:* nichts Neuem (`boundProgramForMain` :5706 existiert).

**Schnitt 2 — Rollenbedingungen als gepinnte Autoritaetsflaeche.**
*Liefert:* `roleCondition` je Self-Faehigkeit in der Karte (lane-only / non-lane / bound-main /
bound-supervisor / jede Session), Tier-Pin fuer jede deklarierte Route (Owner-Wand wird
assertiert statt kommentiert, s. C.1), `harnessSupport`-Dimension je Faehigkeit,
`CapabilityRole`-Erweiterung. *Write-Set:* `capability-map.ts`, `src/protocol.ts`,
generiertes Dokument, `e2e/pins.ts`. *Done:* „Jeder der 22 Self-Wege traegt eine deklarierte
Rollenbedingung oder ist ausdruecklich als Transport markiert; der Pin schlaegt bei jeder
Bedingungs- oder Tier-Aenderung an." [Selbst-Stueckzahl 21 Handler-Bloecke / 22 Pfade, gemessen]
*Proof:* `bun e2e/pins.ts` (byte-frisch) und tsc wie Schnitt 1. *Nicht:* Server-Verhalten aendert
sich nicht. *Haengt ab von:* Schnitt 1 nur praktisch, nicht strukturell.

**Schnitt 3 — Steward-Datei auf die Produzenten-Route umziehen.**
*Liefert:* der Pulse-Sitz wird als Supervisor gebunden (Bootstrap existiert, owner-gated :16828,
:13157) und filed ueber `POST /api/self/tasks`; `/api/steward/tasks` entfaellt (E.1). *Write-Set:*
`server.ts` (Routenloeschung, Rollenbedingung `isBoundSupervisor` an der Produzenten-Route),
`e2e/pins.ts`, Karte. *Done:* „Der Rundgang legt als gebundener Supervisor Tasks mit Ref-Dedup und
Cap an; die alte Route antwortet 404; keine Zeile doppelt sich beim Umzug." *Proof:* pins, tsc,
Steward-/Task-Familie. *Nicht:* deploy, digest, journal, send (bleiben fuer Schnitt 4). *Haengt
ab von:* 1, plus Owner-Akt der Bindung.

**Schnitt 4 — Steward-Credential entfaellt.**
*Liefert:* E.2–E.6 komplett: Token-Klasse weg, 21 Label-Vergleiche weg, Router aufgeloest,
Deploy-Verb auf Policy-Klasse oder Owner-Wand (Owner-Entscheid). *Write-Set:* `server.ts`,
`e2e/pins.ts`, Karte, generiertes Dokument; Host-Seite (`fleet.json`) ist Owner-Hand, nicht Code.
*Done:* „`rg -c 'STEWARD_LABEL' server.ts` ergibt 0; der Puls laeuft als gebundener Supervisor;
Suite-Ende `ALL PASS`." *Proof:* das rg-Kommando plus volle AGENTS-Kette. *Nicht:* Merge/Land,
Self-Tier-Disziplin, Dispatch. *Haengt ab von:* 3 und dem Owner-Entscheid zu Deploy (G).

**Schnitt 5 — Kontext-Aufnahme, minimal (aus Abschnitt I).**
*Liefert:* Statuswert `canary` im Pack-Vokabular plus genau ein gepaarter Auslassungsgrund;
Rolle/Act als Referenzfelder in das Vokabular der Karte, konsumiert von derselben Leiter mit je
einem gepaarten Grund; die Kandidatenform als Session-Artefakt ausserhalb des Baums. Keine neue
Flaeche — die sichtbare Zuordnung steht bereits [gemessen :6376/:91, context-plan.ts:15–22, :78,
:17316]. *Write-Set:* context-packs.ts, context-plan.ts, context-pack-validator.ts,
context-manifest.ts (dieselben Nahte, die Seeds und Manifest bereits teilen), `e2e/pins.ts`.
*Done:* „Ein Pack mit `status:"canary"` wird mit dem gepaarten Grund omittiert und in der Receipt
unter diesem Grund benannt; ein `active` Pack verhaelt sich byte-identisch zu heute; Rolle/Act-Felder
werden validiert und von der Auswahl deterministisch konsumiert; ein Pack ohne Rolle/Act-Feld
trifft dieselbe Auswahl wie heute." *Proof:* `bun e2e/pins.ts` und die Kontext-Familie in `e2e/`
(dort, wo die Receipt-/Plan-Pins leben). *Nicht anfasst:* Receipt-Schema ausser den zwei neuen
ctx-Fakten Rolle/Act; Loader; Brief-Compiler; UI. *Haengt ab von:* Schnitt 2 (das Rollenvokabular
der Karte).

**Ausdruecklich HINTER Kernlieferung und Wirksamkeits-Canary gerangt [Owner-Grenze 2026-08-21]:
benannte Profile, Owner-Ein/Aus-Schalter, Pro-Session-Umschaltung, jede Anzeige- oder
Freigabe-Flaeche.** Sie sind spaetere Komposition bereits bewaehrter Packs, keine Voraussetzung —
erhalten bleibt nur die Datennaht (Rolle/Act-Felder). **Der Wirksamkeits-Canary misst genau die im
Kandidaten erklaerte Verhaltenswirkung** an einer echten Session: zwei Arme desselben Acts — Pack
ausgewaehlt vs. omittiert, die Receipt benennt den Arm [gemessen selected/omitted je Zeile] —,
verglichen auf der Output-Evidenz des Acts (Proof-Laeufe, Done-Kriterium), nie auf
Selbsteinschaetzung. Ein Pack, dessen Wirkung nie gemessen wurde, ist ein Kandidat bzw. Canary,
kein bewaehrtes Pack.

---

## G. Was ich nicht weiss

**Aus dem Dossier uebernommen ohne eigene Messung:** die Zeilen von refine/refine-confirm
(:18646/:18671) und undo-land (:17706); `watchdog.sh:91` und die Dreiwertigkeit von `VERIFY_CMD`;
die Live-Harness-Tabelle samt `effort`/`transcript`/`automatable`-Werten — der Kurator hat sie am
2026-08-21 als eigene Live-Messung an `GET /api/harnesses` bestaetigt (claude: effort false,
transcript true, selfSchedule true; pi: effort true, transcript/selfSchedule false; pi-zai zusaetzlich
automatable false); eigene Messung des Verfassers fehlt weiterhin, nur die Codeformen `canDeliver`
:5943 und `harnessIdOf` sind gelesen;
Routenzaehlungen 75/42/~117/40; `STEWARD_SENDS_PER_HOUR`-Nutzung; die fremden Repo-Zaehler in
`lane-outcomes.jsonl` (nur Gesamtzahl 415 und main-direct 27 selbst gezaehlt); die Aussage, das
Owner-Token liege im Klartext in `fleet.json` und sei dort fuer jede Session lesbar (vom Kurator als
gemessen bestaetigt; ich habe die Datei bewusst nicht geoeffnet — Tokenmaterial, und das
Bewusst-Nicht-Oeffnen war richtig und bleibt richtig).

**Nicht gelesen:** `src/client.ts` (9 549 Zeilen — ob und wie `source` im Board gerendert wird,
ist ungewiss; Schnitt 1 nennt deshalb die moegliche Mini-Beruehrung); die `e2e/`-Familien ausser
den Faehigkeits-Pins (:588–:645); die Ticks ausser `tickDispatch`; Container-/Docker-Flaeche;
`rulebook/*`, `briefs/*`, die zehn untracked Wurzeldateien und `CLAUDE.md` (letzteres bewusst:
Loader-Grenze aus AGENTS.md).

**Offene Messfragen, die der Code nicht ohne weiteres hergibt:** ob eine Lane als `program.main`
gebunden werden kann (die bootstrap-main-Route wurde nicht gelesen; der Entwurf schliesst Lanes an
der neuen Route dennoch explizit aus, deckt also beide Faelle ab); ob der Pin-Mechanismus Tier-
Assertions ohne Erweiterung traegt (Schnitt 2 setzt das voraus).

**Nur der Owner kann entscheiden:** (1) ob die Steward-Falte ueberhaupt gewollt ist — der Puls
ist Produktionsrealitaet, dieser Entwurf empfiehlt die Falte, befiehlt sie nicht; (2) die Heimat
des Deploy-Verbs (Policy-Klasse vs. Owner-Wand) und ob die Uebergangsluecke in Kauf genommen wird;
(3) ob MAIN-Dateien den Default `auftrag` haben duerfen (startfaehig nach Freigabe) oder
konservativ `notiz`; (4) die Fable-Frage als Letztentscheid (dieser Entwurf sagt: gar keine Rolle);
(5) ob eine zweite beobachtende Rolle (spezialisierter Supervisor) je noetig wird — SYSTEM.md
sieht den Fall vor und loest ihn ueber Watch-Scope, nicht ueber neue Rollen [aus SYSTEM.md].

**Mess-Lehre dieses Dokuments:** Der Verfasser hat selbst eine unzulaessige Symbolprobe produziert (ein `rg`-Aufruf mit nicht existierendem `--include`-Flag, dessen Fehlerausgabe nach /dev/null ging und als „null Treffer" gelesen wurde) und sie erst auf Kurator-Hinweis reproduziert und korrigiert. Korrekte Form ist `rg -uu -g '*.ts' -g '!node_modules'` ueber alle 31 Wurzelmodule [gemessen: `ls *.ts | wc -l` = 31]. Der Exit-Code hinter einer Pipe ist der von `head`, nie der von `rg`.

**Widersprueche Zielbild/Ist, hier bewusst nicht geglaettet:** Die vier Kernobjekte aus SYSTEM.md
(`AgentInstance`, `Act`, `ContextEnvelope`, `Trace`) sind reines Zielbild: **null Treffer** fuer sie und
fuer `actId`/`attemptId`/`traceId` im ganzen Baum [gemessen: `rg -uu -g '*.ts' -g '!node_modules'`].
Die **Promotions-Haelfte dagegen EXISTIERT als Code** und ist ungenutzt: `PromotionPolicyFacts`/
`LandCandidate`/`PromotionRiskClass` samt Freshness-Typen in src/protocol.ts (:318/:334/:341/:342/:343/:351)
und die reine Projektion `land-candidate.ts` mit `sameCandidate` ueber candidateSha+diffHash; Aufrufer
ausschliesslich `e2e/merge.ts` (:541/:551/:690), kein Land-Pfad importiert sie, mit Absicht laut
Modulkopf [alles selbst gemessen; Abschnitt D traegt den Reuse-Befund]. Fuer den Ist-Stand gilt der
Code: Task, Slot, Program, Ledger, ContextPack sind die realen Objekte, und dieser Entwurf baut
ausschliesslich auf ihnen. Das Zielbild bleibt unangetastet — es beschreibt, wohin die Objekte
wandern, nicht was heute tragfaehig ist.

*Nachtrag: G wurde vor H und I verfasst; deren eigene Mess- und Wissensgrenzen stehen in den
Abschnitten selbst und ergaenzen diese Liste, statt sie zu ersetzen.*

---

## H. Der Interventions-Rail (Owner-Erweiterung 2026-08-21)

**These: Der Rail ist keine neue Rolle und kein neues Register — er ist eine Typisierung von
Kanten, die zu drei Vierteln bereits stehen.** [entwurf] Die harte Owner-Regel („ein Modell darf
vorschlagen; es darf nicht still den Scope erweitern, nicht eine fremde Lane mutieren, nicht
landen, nicht Policy promoten") ist im Code bereits mehrfach mechanisch eingebaut als Verweigerung
— der Rail macht sie nur benennbar [entwurf auf den unten gemessenen 409s].

### H.1 Bestandsaufnahme der Kanten (selbst gemessen, Kurator-Messung bestaetigt)

| Kante | Status | Beleg |
|---|---|---|
| A Supervisor→MAIN (Nudge) | **steht** | Route :16525, `supervisorNudge` :13446. Waechter allesamt gemessen: `isBoundSupervisor` sonst 409; Ziel aus `program.main` abgeleitet, Body nennt nur programId; Program `active` sonst 409; Occupant neu geprueft sonst 409 („the bound Program-MAIN occupant is gone or was replaced“); `awaiting === "owner"` → 409 „escalate, never nudge past it“; `canDeliver` mit attended Waiver (killSwitch/quietHours/harness gewaivt, `alive` nicht); sendId vor Transport gemintet; unsicherer Ausgang als eigener Beleg; `audit("supervisor_nudge")` nie der Text. Persistiert wird bewusst nichts ausser Quittung und Journalzeile [gemessen :13258–13259] |
| B MAIN→eine eigene Lane | **FEHLT GANZ** | Der Reply (:16623) ist eine ANTWORT auf eine Lane-Frage („a lane may not reply — lane-waits-on-lane is a coupling only MAIN may close“, :16627); `/send` :19117 liegt unter der Owner-Wand; es gibt keine dritte MAIN→Lane-Kante [gemessen] |
| C Lane/Critic→MAIN (Finding) | **steht, zweifach typisiert** | Clarification: lane-only :16605, genau eine offen je Worker, ≤2000 Zeichen, Empfaenger servergewaehlt [gemessen route + capability-map QUESTION_ROUTES]. Fleet-Report: lane-only :16617, geschlossene Statusmenge, deklarativ — „no land, dispatch, auto, Watch, or tick path gates on its status“ [gemessen capability-map] |
| D MAIN→Owner | **steht** | :16638, nur gebundene MAIN eines aktiven Programs, programId aus der Bindung [gemessen :5742, :5706] |
| Receipt+Ack-Maschinerie | **steht, von A ungenutzt** | `FleetEventBase` :1247 mit Occupant-Triple, Statusmenge :1245 (pending|send-uncertain|delivered|acknowledged|receiver-gone nebst inbox), Ack :16648 [gemessen] |
| RouteOverride auf lebendem Slot | **strukturell unmoeglich** | Modell/Effort werden nur beim Spawn gesetzt und bei open/kill geloescht [gemessen Slot-Kommentar „chosen at spawn … cleared on open/kill“]; keine Route veraendert sie am lebenden Sitz |

### H.2 Die vier Decision-Arten, typisiert

Vorab die Autoritaetsfrage: **NUDGE entscheidet der Supervisor in seiner begrenzten, nicht-normativen
Form — Repair, Route und Reject entscheidet der Owner.** Das ist keine Entwurfszier, sondern der
gemessene Zustand: der Nudge-Text ist selbst als Nicht-Entscheidung formuliert („the decision remains
with you as Program-MAIN“, :13484ff.) [gemessen], und jede startende/archivierende Wirkung liegt
heute hinter der Owner-Wand [gemessen :18486/:18567/:18810]. Agenten duerfen alle vier VORSCHLAGEN
— auf Schienen, die stehen: attention (D), clarification/fleet-report (C), propose_task (Schnitt 1).
[entwurf]

| Art | Ausloesen darf | Bindung (MUSS) | Quittung | Ablehnung | Wiederverwendung |
|---|---|---|---|---|---|
| **NUDGE** (laufender Versuch) | Supervisor (Kante A) oder Owner (`/send`); Agenten schlagen vor (D) | Empfaenger-Occupant-Triple + Programm aktiv + nicht `awaiting:"owner"` [gemessen :13446ff.]; **fuer Kante B NEU:** Gruender-Task-ID + Lane-Branch-Tip (Staleness) | A: sendId + Journal + audit [gemessen]; B: FleetEvent + Ack :16648 [Wiederverwendung] | 409 mit benanntem Grund [gemessen]; NEU: 409 bei bewegtem Branch-Tip | supervisorNudge traegt A vollstaendig; B haengt die **vorhandene** FleetEvent-Schiene an den **fehlenden** Absender an — kein zweiter Transport |
| **REPAIR_ATTEMPT** (neue begrenzte Task) | MAIN via propose_task (Schnitt 1); Critic als Finding (C) | `originId`-Kette [gemessen :16243] + `respondsTo`-Finding-ID (neu, als Audit-Detail) | Task-Zeile + audit | Owner entscheidet mit Queue-Klick oder Disposition; der Tick startet nur `queued` [gemessen :6933] — die harte Owner-Regel ist hier schon Maschine | propose_task + existierender Dispatcher; **keine eigene Route** |
| **ROUTE_OVERRIDE** (naechster Versuch / anderes Modell) | Owner im Freigabe-Klick; Agenten schlagen ein `routingHint`-Feld auf der Task-Zeile vor (proposes) | Task-ID; consumoert wird der Hint vom **bereits existierenden** Klick-Koerper, der harness/model/effort liest [gemessen :18582–:18590] | `audit("task_dispatch")` mit harness-Detail [gemessen :18606ff.] | Feld ignorieren = Status quo; lebende Slots werden NICHT umgeroutet | „naechster Attempt“ braucht das Attempt-Objekt (null Treffer, s. G) — bis dahin bleibt RouteOverride ehrlich ein Hinweis auf die NAECHESTE Freigabe, kein Eingriff in einen Lauf |
| **REJECT / ARCHIVE** | Owner | Objekt-ID | taskAct-Verben delete/archive [gemessen :18810]; Disposition :98, :11393 („stamped, never read from the body“); Attention-Antwort (Owner-Tier) | Disposition IST die Ablehnungsquittung | alles steht |

**Das typisierte DECISION-Objekt existiert nicht als neue Tabelle, und das ist Absicht:** jede
Entscheidung quittiert auf dem Ledger, das es schon gibt (Task-Zeile, Disposition, Audit, Journal),
gejoint ueber `respondsTo`. Ein zweites Decision-Register waere die dritte Ereigniswahrheit neben
audit.jsonl und den Dispositionen — genau das zu verhindernde Duplikat. [entwurf]

### H.3 Adressierungsmatrix

| Wer → Wen | Urteil | Begruendung gegen die „eine Kante je Rolle“-Regel [gemessen benannt in :16631–:16633 fuer attention/watch und :16627 fuer reply] |
|---|---|---|
| Supervisor → MAIN | bleibt (A) | die eine beobachtende Kante; Ziel server-hergeleitet, nie koerperwaehlbar [gemessen] |
| MAIN → Lane **im eigenen Program** | **NEU (B), genau eine** | Die Regel heisst nicht „keine MAIN→Lane-Kante“ — der Reply IST eine, nur antwortgebunden [gemessen :16623]. B ist die initiale Zwillingsschwester mit denselben zwei Eigenschaften, die jede sichere Kante hier hat: Identitaet hergeleitet (Ziel muss `lane.programId === eigene Program-Bindung` sein, sonst 409 — herleitbar, Slots mit programId filterbar [gemessen :2093]) und Occupant-gebunden (FleetEvent-Triple) |
| MAIN → Owner | bleibt (D) | |
| Lane/Critic → MAIN | bleibt (C) | ein Critic IST eine Lane im Kritik-Modus (Abschnitt A); keine eigene Kante |
| Supervisor → Lane | **verboten** | zwei Pfade in einen Pane machen Attribution mehrdeutig; der Supervisor spricht die MAIN, die MAIN ihre Lane |
| Lane → Lane | **verboten** | steht als 409 [gemessen :16591, :16627] |
| Agent → Policy | **verboten** | harte Owner-Regel; deckungsgleich mit Abschnitt D |

### H.4 Prompt-Anstups gegen Adapter-/Capability-Defekt (mechanisch)

`DeliveryGate` ist eine geschlossene Sechsermenge [gemessen :5942]. **Adapter-/Transportklasse**
= `harness`, `blocked-screen` (Faehigkeit/Transport fehlt); **Zustandsklasse** = `kill-switch`,
`busy`, `not-alive` (nichts ist kaputt, es ist gerade nicht dran). Mechanische Regel
[entwurf, in J.4/Streichung 4 geaendert]: ein Adapter-Defekt-Verdikt setzt zunaechst einen SENSOR
voraus — verweigerte Zustellungen muessen eine Zeile schreiben, bevor irgendeine Schwelle zaehlen
koennte; die Schwelle selbst ist Owner-Policy, nicht Architektur. Das Routing-Urteil lautet
`unsupported` — dasselbe Wort, mit dem die Karte heute schon Abwesenheit misst
[gemessen: `recipient: "unsupported"` fuer supervisor-Fragen]. Nach Verdikt verweigert der Rail
weitere Nudges an diesen Sitz mit eben diesem Verweis (die 409 existiert je Zustellung schon; das
Verdikt macht sie dauerhaft und sichtbar statt wiederholbar). Ein **Harness-Fix** ist ein Owner-Akt
an der Spawn-/HARNESSES-Flaeche [gemessen :17550–:17560] — wiederholtes Anstupsen nach Verdikt ist
ein Kategorienfehler, den der Rail verweigert, nicht retryt. Der Nudge selbst bleibt bewusst ohne
Retry-Schleife [gemessen: keine Retry-Maschinerie in :13446ff.].

### H.5 Notwendige Kontrolle oder vermeidbare Komplexitaet?

**Antwort: necessary, aber schmaler als gefordert — und eine der vier Arten ist ersatzlos
entbehrlich als eigener Mechanismus.** NUDGE, REPAIR_ATTEMPT und REJECT/ARCHIVE kosten NULL neue
Maschinerie (H.2). ROUTE_OVERRIDE schrumpft auf ein Vorschlagsfeld, konsumiert von einem
bereits existierenden Klick-Koerper. Der einzige echte Neubau ist **Kante B** samt Staleness-Bindung
— und auch sie hat heute einen Workaround: Owner toetet die blockierte Lane, MAIN filed eine
Repair-Task, der Owner released sie (alles existierend). Der Preis des Workarounds ist der geladene
Kontext der Lane plus ein Owner-Handling pro Blockade. **Empfehlung: Kante B bauen (begrenzt:
nur Text, nur eigene Program-Lanes, eine offene je Lane, FleetEvent-Quittung + Ack); aber der Owner
kann sie verneinen, ohne dass der Rail kollabiert — dann bleibt der Rail reine Typisierung des
Bestehenden.** [entwurf]

**Bilanz H — Zuwachs (4) gegen Nichtbau/Rueckbau (5):** NEU: (1) Kante-B-Zufuhr auf FleetEvent,
(2) `respondsTo`-Join als Audit-Detail, (3) Adapter-Defekt-Verdikt in der Karte, (4) `routingHint`
als proposes-Feld. NICHT GEBAUT, mit Grund: (1) kein lebender RouteOverride — wuerde die
Spawn-Invariante brechen [gemessen Slot-Kommentar]; (2) kein zweites Decision-Register — drei
Ereigniswahrheiten sind schon zwei zu viel potentiell; (3) kein Supervisor→Lane-Kanal — Attribution;
(4) keine Nudge-Retry-Schleife — der Defekt-Fall gehoert an die Karte, nicht an den Wiederholer;
(5) keine eigene Repair-Route — identisch mit propose_task aus Schnitt 1.

---

## I. Der Aufnahme-/Promotions-Pfad fuer fremdes Praxismaterial (Owner-Erweiterung 2026-08-21)

**These: Der Pfad ist kein neues Wissenstraeger-Format, sondern eine Nicht-Normativ-Stufe VOR
bereits existierenden Traegern.** [entwurf] Die Doktrin „Anker statt Kopie“ ist eingebaut —
„Context packs are metadata pointers into existing sources, never a second knowledge store“
[gemessen context-packs.ts:1] — und genau daran wird der Pfad angeschlossen.

### I.1 Die Kandidaten-Form

Der Kandidat ist **Evidenz, kein Baumobjekt**: er lebt ausserhalb des getrackten Baums (Scratch/
Session-Artefakt; der portable Vertrag legt Scratch-Dateien ohnehin ausserhalb des Repos ab) und
wird auf bestehenden Produzenten-Schienen vorgeschlagen — attention (D-Kante) oder propose_task
(Schnitt 1). **Keine eigene Kandidaten-Route.** [entwurf]

| Feld | Urteil | Fundstelle / Begruendung |
|---|---|---|
| Provenienz (Quelle, Commit/URL) | **NEU**, Kandidatenebene | kein Provenienz-/Lizenzfeld im Baum [aus Dossier; Kurator-Messung] |
| Lizenz | **NEU, Pflicht**, geschlossene Menge `permissive|fact-only|derived-needs-license|unknown` | dito; `unknown` blockiert Promotion mechanisch (Validator-Gate, I.2) |
| Datum (beobachtet am) | teils | `observedAt` existiert an Packs [gemessen PrivateContextPack]; am Kandidaten NEU |
| atomare Behauptung / Praxis | **NEU**, NUR Kandidat | im Artefakt wird sie NICHT mitgetragen — dort bleibt `useWhen` (eine Zweck-Zeile) + Anker [gemessen]; sonst zweite Wissenshaltung contra Firewall :1 |
| vorgesehene Rolle / Act / Harness | Harness **steht** (`harnesses` [gemessen]); Rolle/Act **NEU als Referenzfeld** — Wertevorrat ist das EINE Vokabular der Karte (CapabilityRole, Schnitt 2), kein eigenes Enum | die laut Owner erhaltene **Datennaht fuer spaetere Profile: Feld, kein Feature** — die Leiter konsumiert sie deterministisch (Station 4), Profil-/Umschalt-/UI-Arbeit entsteht dadurch nicht [Owner-Grenze 2026-08-21] |
| erwartete Verhaltenswirkung | **NEU**, NUR Kandidat (Evaluationsvertrag) | kein Feld im Baum; gehoert zum Beweis des Uebergangs, nicht zum Zeiger |
| Gegenbeispiel / Risiko | **NEU**, NUR Kandidat | dito |
| Evaluationsprobe | **NEU**, NUR Kandidat/Uebergang | `evidence` bleibt Frische-Beweis (tree-anchor|private-content-hash [gemessen :42–43]) — die Verhaltensprobe ist eine andere Kategorie und gehoert NICHT dorthin |
| Status `proposed|canary|promoted|retired` | teils — `retired`/`superseded` stehen [gemessen :44–45], `promoted` ≡ `active`; **NEU im Baum: nur `canary`**; `proposed` wohnt ausserhalb (Kandidat) | `CONTEXT_PACK_STATUSES` ist geschlossen [gemessen] |
| Ziel | **GESTRICHEN** | kein Consumer: der Selektor liest scope/audience/triggers [gemessen Omissions-Leiter], nie ein Zielfeld; Redundanz zu Trägerwahl + scope — Ballast |

### I.2 Die fuenf Stationen, die EINE Entscheidung, und die vier Fundstellen

Der Pfad hat genau fuenf Stationen [Owner-Grenze 2026-08-21]: **nicht-normative Quelle/Kandidat →
EINE gepruefte Promotions-Entscheidung → bestehendes Ziel/Pack-Manifest → deterministische
Rollen-/Act-Auswahl → bestehendes Receipt.** Jede sechste Station waere einzeln zu begruenden;
dieser Abschnitt enthaelt keine — alles Weitere sind Felder an diesen fuenf Stationen.

**Die „sichtbare Zuordnung“ ist bereits vollstaendig gebaut. Nichts wird dafuer entworfen; sie wird
benannt und angeschlossen** [Owner-Grenze; alle vier Fundstellen selbst nachgemessen]:
1. Die Receipt-Zeile entsteht je Dispatch [gemessen server.ts:6376, appendEvent auf
   `CONTEXT_RECEIPT_FILE` :91] und traegt selected (id, useWhen, Anker, sourceHash — gebaut von
   `contextReceiptSelections` :6421) UND omitted als `{id, why}` mit typisiertem why, dazu repo,
   head, taskId, originId, programId, slot, branch, harness, model, effort, mode, triggers,
   deliveredBytes, renderer, briefHash, briefSource und einen Hash ueber {anchorBlock, planFacts}
   [gemessen :6363–:6380].
2. Das why-Vokabular ist geschlossen und deterministisch: manifest-invalid · source-unavailable ·
   status-not-active · harness-unsupported · mode-unsupported · trigger-not-matched ·
   capability-missing [gemessen context-plan.ts:15–22].
3. Die Leseflaeche steht: `GET /api/context-receipts` [gemessen server.ts:17316], Owner-Tier
   (oberhalb der Wand :17000), read-only.
4. Die Auswahl ist rein und deterministisch: `contextOmissionFor(pack, ctx)` entscheidet aus
   {sourceTree, harness, mode, triggers, capabilities} — kein Modell, kein Ermessen
   [gemessen context-plan.ts:78].

**Die einzige offene Frage an dieser Naht** [Owner-Grenze]: dem Vokabular fehlt der Wert, den ein
nicht-normativer Kandidat BENENNEN koennte. Heute omittiert die Leiter jedes `status ≠ "active"`
mit dem generischen Grund `status-not-active` [gemessen context-plan.ts:80] — ein Canary-Pack
wuerde als „nicht aktiv“ verschluckt statt als „absichtlich nicht-normativ“ benannt. Kleinster
Schnitt: **ein Statuswert `canary` plus genau ein gepaarter Auslassungsgrund**; fuer Rolle/Act als
Selektoren dasselbe Muster (je ein gepaarter Grund), damit die Auswahl deterministisch bleibt und
die Receipt die Tatsache nennt. Drei geschlossene Werte, kein Freitext.

Die Zustaende sind DATEN, keine Flaechen — genau EINE Entscheidungsnaht (der Owner-Commit):

| Uebergang | Wer | Beweis | Rueckfalltuer |
|---|---|---|---|
| ∅ → proposed | jeder Agent (Vorschlag auf D-Kante/propose_task) oder Owner | Kandidatenform vollstaendig, Lizenz-Urteil gesetzt (auch `unknown` erlaubt) | Kandidat verfaellt ausserhalb des Baums; Ablehnung als Disposition [gemessen :98] |
| proposed → canary | **Owner** (EIN Commit eines Packs mit `status:"canary"`) | reiner Validator (derselbe, den Seeds und Manifest teilen [gemessen context-manifest.ts:2–4]); Lizenz ≠ `unknown`; Behauptung hat Probe ODER das Receipt fuehrt „Probe fehlt“ als eigene Tatsache | Status zurueck — ein Komma im Baum |
| canary → promoted | **Owner** (Commit `status:"active"`) | Wirksamkeits-Canary gelaufen (Definition in F, Schnitt 5): die erklaerte Verhaltenswirkung an ≥1 echter Session, Arme lesbar aus den vorhandenen Receipts [gemessen selected/omitted je Zeile] | bleibt canary bis Beweis; alternativ retired |
| promoted → retired | Owner | — | `supersedes`-Kette existiert [gemessen] |

**Mechanisch woran die Owner-Promotion haengt:** an genau dem Monopol, das Abschnitt D beschreibt —
`status:"active"` im getrackten Baum ist eine Baumanderung, und der Land-Pfad ist Owner. Es gibt
keine Route und kein Agent-Credential, das diesen Uebergang setzt; deckungsgleich mit Programs
(Owner-Confirm :16816), Tasks (Queue-Klick) und AGENTS-Regeln (Owner-Commit). **Der Canary-Zustand
bleibt unsichtbar, bis ihn jemand ausdruecklich zieht**: die Leiter omittiert jedes
`status ≠ "active"` [gemessen context-plan.ts:80] — fuer jede ordinaere Session aendert sich nichts.
Das ist die mechanische Garantie, dass die Nicht-Normativ-Stufe keinen Kontext aufblaehen kann.

### I.3 Die neun Ziele

| Ziel | Traeger | Fundstelle |
|---|---|---|
| portable AGENTS-Regel | AGENTS.md selbst (Owner-Commit) | portable Kern ist der eine Ort fuer Geltung-fuer-alle [AGENTS-Vertrag] |
| privates Rulebook-Fragment / CLAUDE-Render | rulebook.ts-Fragmente (7, feste Ordnung, PARTITION) | [gemessen :23–31, :34–37]; Render byte-exakt + Pin [aus Dossier; imports gemessen e2e/pins.ts:29–30] |
| Rollen-Capability-/Gruendungsblock | capability-map.ts — das EINE Register | [gemessen; Schnitt 2] |
| Project Context Pack | Fleet-Seed ODER Zielrepo-Manifest | [gemessen CONTEXT_PACKS / :16] |
| Studio-Workflow-Pack | **Zielrepo-Manifest**, nicht Fleet | [gemessen Header :1–5] |
| Fleet-Wartungs-/Selbstverbesserungs-Pack | Fleets eigene Seeds (scopes verify-e2e/land-mechanics/task-queue/harness-adapter) | [gemessen] |
| Brief-Template | briefs/*.md | Referenz bestehender Briefs [gemessen server.ts:18646-Kommentar „briefs/task-refine.md“] |
| Code-Capability | capability-map.ts-Zeile mit Adapter+Probe | [gemessen Schema] |
| Archiv/Ablehnung | Disposition + retired | [gemessen :98, :44–45] |

**Regel, welches Ziel wann richtig ist:** normativ fuer alle → AGENTS.md; normativ fuer privates
Publikum → genau EIN Fragment (Partitionsregel [gemessen :34–37]); Zeiger fuer Kontext → Pack im
richtigen Baum (I.5); ausfuehrbar → Karten-Zeile; promptfoermig → Brief-Template; keines von
allem → Ablehnung als Disposition. **Sechs Traeger fuer neun Ziele, kein neuer.**

### I.4 Lizenz und oeffentliches Repo — die Bedingung des Ganzen

Mechanische Regeln [entwurf auf dem gemessenen Formenapparat]: (1) Ein getrackter Anker darf nur
auf eine Datei zeigen, deren Lizenz Weitergabe erlaubt, ODER auf die eigene destillierte
Formulierung; (2) URL, Commit, Lizenzname sind Fakten und immer tragbar; (3) bei unbekannter
Lizenz mit Substanz bleibt nur das private Overlay in Hash-Form — genau dafuer existiert
`PrivateContextPack` (nur privateSourceId + sourceHash, keine Quellen [gemessen]); (4) die Grenze
zwischen destilliert und abgeleitet: eigene Worte, die eine Praxis benennen, sind destilliert;
eine Uebersetzung/Kuerzung einer substantiellen Anleitung ist ein abgeleitetes Werk und braucht
die Lizenz. Das Lizenz-Urteil ist Pflichtfeld des Kandidaten; `unknown` blockiert Promotion
mechanisch. Ohne diese Regel ist der ganze Pfad unbenutzbar — alles getrackte ist publizierbar.

### I.5 Studio-Produktwissen gegen Fleet-Wartungswissen — mechanisch

Die Trennung verlaeuft **am Baum**: Fleet-Wissen lebt in Fleets Baum (Seeds im Code, docs/);
Studio-Produktwissen lebt im Zielrepo-Manifest `.fleet/context-packs.json`, das der Zielrepo ueber
sich selbst deklariert — „Fleet stores no pack content, authors no pack, and owns no registry“
[gemessen context-manifest.ts:1–5], gelesen am Commit, den die Quittung behauptet [gemessen], mit
eigenen Grenzen 65 536 B / 64 Packs / 64 Pfade [gemessen :18–20]; die Scopes `repo-contract` und
`product-quality` existieren ausdruecklich fuer diese Seite [gemessen context-packs.ts:3–5].
**Komponieren erlaubt, Verschmelzen verboten:** der Planer liest beide Quellen durch dieselbe
Omissions-Leiter [gemessen context-plan.ts:78–85]; ein Brief darf beide anbieten — gepflegt wird
jede Regel in genau einem Baum. Das ist dieselbe Disziplin wie die Fragment-Partition [gemessen
rulebook.ts:34–37], eine Ebene hoeher.

### I.6 Warum blaeht dieser Pfad den Kontext NICHT auf — und wo der Kritiker recht haben wird

Vier Deckel: (1) Packs sind Zeiger, nie Kopien [gemessen :1]; (2) `estimatedBytes` + Omissions-Leiter
begrenzen jede Zustaellung [gemessen]; (3) Canary ist ohne expliziten Trigger unsichtbar [gemessen
:80 + I.2]; (4) der getrackte Baum wächst NUR durch Owner-Promotion — Kandidaten bleiben draussen.
**Wo der Kritiker recht haben wird, hier vorweg genommen:** (a) Der `useWhen`-Einzeiler ist eine
Behauptungsflaeche, die vom Anker driften kann — der Frische-Beweis prueft Bytes, nicht Bedeutung
[gemessen evidence-Kategorie]; Restrisiko bleibt, ein Pin hilft, beseitigt es aber nicht. (b) Die
Evaluationsprobe ist die schwaechste Stelle: eine Verhaltensprobe fuer eine Prompt-Praxis ist teuer,
und ohne sie ist „promoted“ ein Geschmacksurteil — das Receipt fuehrt beide Faelle deshalb offen
auseinander (Probe referenziert vs. leer). (c) Neun Ziele draengen zu neun Traegern; dieser
Entwurf buendelt auf sechs bestehende, und genau diese Einengung ist der Angriffspunkt, wenn sie
zu eng geraten sollte.

**Bilanz I — Zuwachs (4) gegen Nichtbau/Rueckbau (7):** NEU: (1) Statuswert `canary` plus genau ein
gepaarter Auslassungsgrund (Rolle/Act analog, je einer — I.2), (2) Rolle/Act als Referenzfelder in
das Vokabular der Karte — die Datennaht fuer spaetere Profile, (3) Kandidatenform ausserhalb des
Baums, (4) Lizenz-/Provenienz-Felder am Kandidaten. NICHT GEBAUT, mit Grund: (1) **keine neue
Anzeige-, Profil- oder Freigabe-Flaeche** — die sichtbare Zuordnung steht bereits (I.2, vier
Fundstellen); (2) kein zweites Wissenstraeger-Format — Kandidaten bleiben Evidenz ohne Baumobjekt;
(3) kein Rollen-Enum im Pack-Vokabular — Referenz auf die Karte; (4) kein `Ziel`-Feld — kein
Consumer; (5) keine Verhaltensprobe in `evidence` — Frische und Wirkung bleiben getrennte
Kategorien; (6) keine eigene Kandidaten-Route — Vorschlag reitet auf attention/propose_task;
(7) kein `respondsTo`-Pflichtfeld — die vorhandenen Provenienz-Felder (taskId/originId/programId
[gemessen :1316/:1336]) tragen den Findungsweg bereits.

---

## J. Delta: Program-Autonomie-Huelle (Owner-Korrektur 2026-08-21)

Dieser Abschnitt korrigiert die ZIELRICHTUNG von B und F, nicht ein Detail: die alte These „die
MAIN darf die Schlange fuettern, nicht den Zaun oeffnen" war **zu restriktiv fuer das beabsichtigte
Fleet** [Owner, 2026-08-21]. Massstab sind nur die drei groben Klassen: **(A) reversible
Entscheidungen im bestaetigten Program-Scope → die MAIN handelt. (B) begrenzte
Ausfuehrung/Ressourcen/Routing in diesem Scope → die MAIN handelt innerhalb expliziter Limits.
(C) Scope-Erweiterung · irreversible Richtung · externe Wirkung oder Kosten · Deploy/Submit · ein
erklaertes Geschmacks-Gate → Owner.** Keine vierte Klasse, keine Rubrik darunter [entwurf auf
Owner-Vorgabe].

### J.1 Die kleinste Autonomie-Huelle (Faehigkeit · Naht · Grenze als Praedikat/Zahl)

| Faehigkeit | Naht | ausdrueckliche Grenze |
|---|---|---|
| Task anlegen | `propose_task` (B, Schnitt 1) [entwurf] | hoechstens **10 offene** je Program (Praezedenz `STEWARD_MAX_PENDING`, Default 10 [gemessen :2611]); programId aus der Bindung, nie Koerper |
| **Task freigeben UND starten** | **`releaseTask(t, "machine")` — die Naht ist GEBAUT und hat null Aufrufer** [gemessen server.ts:2262; Zweck woertlich: „it is the transition a future UNATTENDED promote will make, and `by` must not be forgettable there", :2251–:2261; einzige heutige Aufrufstelle :18865 uebergibt hart `"owner"`; `releasedBy` wird persistiert :2265]. Start: `dispatchTask(t, free, false, false, {harness, model, effort})` — ein unattended Aufrufer MIT Spawn ist einkalkuliert („a future unattended caller that does pass one", [gemessen :6103–:6105]) | (1) `t.programId === program.id` der eigenen Bindung, sonst 409; (2) nur `kind:"auftrag"` (Maschine [gemessen :6097]); (3) nicht-automatisierbarer Harness verweigert — der **Bolt** [gemessen :6105–:6107] ist die gebaute Modellwahl-Grenze der Klasse B; (4) die unattended Analyse-Pflicht bleibt unangetastet: „nothing starts on its own that has not been read against the tree" [gemessen :6962ff.] — MAIN-Release ist ein UNATTENDED promote (:2254), kein attended Klick, und darf kein Gate des Ticks umgehen; (5) `DISPATCH_MAX_LANES` je Repo (live 2 [aus Kurator-Messung]); ein Start serial; (6) der Stempel `releasedBy:"machine"` ist Pflicht, damit die Zeile nie als Owner-Arbeit zaehlt (:2255–:2261) |
| Worker anstupsen | Kante B aus H.2 (FleetEvent + Ack :16648) [entwurf] | nur Lanes im eigenen Program; eine offene je Lane; Occupant-Triple; 409 bei bewegtem Branch-Tip |
| Wiederholen | neue Task mit `originId`-Kette [gemessen :16243] | dieselben Deckel wie anlegen+starten |
| Ersetzen | — (nur als „neue Task + alte auslaufen lassen") | **kill/shelve/`done|archive` bleiben Owner** [gemessen :18959 Owner-Tier, :18810 taskAct] — bewusst keine Erweiterung |
| Modell waehlen | Spawn-Argument des EIGENEN Starts; Feld `routingHint` auf der eigenen Task | nie am lebenden Slot (Spawn-Invariante, Slot-Kommentar „chosen at spawn … cleared on open/kill"); Harness-Charset-Validierung [gemessen :18582–:18590]; Bolt |
| Gewoehnliche Critic-Reparatur loesen | = anlegen + freigeben der Repair-Task | Klasse A solange kein Land, keine Policy, kein externer Akt (C-Liste) |

Die C-Liste bleibt unveraendert und unangetastet: Deploy/Submit, irreversibel, extern, Kosten,
Geschmack → Owner (Abschnitt D gilt weiter vollstaendig).

### J.2 Scoped principal checks — mechanisch

(a) **Fremdes Program:** `programId` wird nie aus dem Koerper gelesen — das Muster steht in
`openAttention` [gemessen :5742/:5706]; Praedikat je Faehigkeit: `t.programId ===
boundProgramForMain(s).id`, sonst 409. Die Vererbung `task.programId → Slot → Empfaengerloesung`
[gemessen :6162 → :5297] haelt jede Lane-Zaehlung im Program, ohne das ein CROSS moeglich waere.
(b) **Nach aussen promoten:** alle Faehigkeiten der Huelle sind Self-Tier-Routen OBERHALB der
Owner-Wand; Land, Policy-Commit und Deploy liegen unterhalb und sind von einem Self-Token
strukturell unerreicht [gemessen :16999–:17000, :18048]. Hier ist die positionelle Autoritaet
richtig verbaut: als WAND, nicht als verteilte Regel.

**Inbetriebnahme-Bedingung (kein Code, aber hart):** die Bindung wird durch dieses Delta zur
Autoritaetswurzel und hat zwei gemessene Defekte, beide selbst verifiziert: (1)
`boundProgramForMain` (:5706) ist ein `.find` OHNE Eindeutigkeitspruefung, waehrend
`handleSelfSucceed` dieselbe Gefahr korrekt mit 409 behandelt [gemessen :5199–:5201] — kleinste
Form: dieselbe 409. (2) Das `sessionId`-Gate bricht bei Codex von selbst:
`bootstrapProgramMain` schreibt `null` [gemessen :13680], `tickCodexRecovery` setzt spaeter eine
echte uuid [gemessen :3675] — ab da ist der Vergleich dauerhaft falsch; `clarificationReceiverFor`
 gating deshalb bewusst NICHT auf `sessionId` [gemessen :5301]. Korrektur-Form: slot+openedAt als
Identitaet (wie `isBoundSupervisor` :13268), sessionId berichten, nie gate. **Je mehr Autoritaet
an dieser Bindung haengt, desto teurer sind beide** [aus Kurator-Messung].

### J.3 Die Landefrage, ehrlich

**Ja — ohne Invariantverletzung**, denn SYSTEM.md erlaubt den Policy-Weg woertlich: ein Land geht
„entweder auf einen benannten Owner-Akt oder auf eine benannte, zuvor vom Owner promovierte Policy"
zurueck [aus SYSTEM.md] — die Invariante schuetzt die POLICY-Promotion, und die Policy selbst ist
ein Baum-Commit unter der Owner-Wand. Die Maschinerie dafuer ist gebaut und ungenutzt
(`projectPromotionPolicyFacts`, `sameCandidate` ueber candidateSha+diffHash, ehrliches `unknown`;
`PromotionRiskClass` mit sechs Werten [gemessen src/protocol.ts:343, land-candidate.ts]; Aufrufer
nur `e2e/merge.ts`). **ABER die unaufgeloeste semantische Grenze:** „reversibel" ist beim Landen
keine Eigenschaft der Handlung, sondern der Handlung MAL der Rate. `undo-land` deckt genau EIN
Land und nur bis zum naechsten [gemessen :17706, `undoableFor` :9873] — Land N ist unerreichbar,
wenn der Alarm erst bei Land N+1 kommt. Eine vorab autorisierende Policy muss deshalb entweder
**die RATE binden** (kleinste Form, Deckel-Präzedenz :2611: hoechstens EIN offener policy-autorisierter
Land je Program und je undo-Fenster) **oder ehrlich erklaeren, dass undo nicht der Rueckweg ist**
und den Ersatz benennen — ein revert auf main waere ein neuer Schreibakt und damit selbst eine
Autoritaetsfrage, die hier NICHT geloest wird. Die Wahl ist Owner-Entscheid. Zweitens: „gewöhnlich"
braucht ein Vokabular; die sechs RiskClass-Werte sind der Kandidat, aber welche Klasse „gewöhnlich"
ist, ist Policy-Inhalt, nicht Architektur. Diese Grenze bleibt offen und ist benannt, nicht geglaettet.

### J.4 Was aus dem eigenen Entwurf dadurch FAELLT (Pflicht-Liste)

1. **Die These „schlange fuettern, nicht zaun oeffnen" — FAELLT.** Ersetzt durch: die MAIN oeffnet
den Zaun FUER IHREN SCOPE; die Grenze ist die C-Liste plus die existierenden Maschinen-Gates,
nicht die Freigabe-Schlange selbst.
2. **Schnitt 1 als ENDE der Kette — AENDERT sich.** Kette wird `pending → release("machine") →
Start durch dieselben unattended Gates`. Schnitt 1 bleibt allein wertvoll und unverändert; NEU
**Schnitt 1b** direkt danach: Done-Kriterium „eine gebundene MAIN released eine eigene pending-Task
mit `releasedBy:"machine"`; ungebundene, fremd-programmige und Lane-Aufrufe 409; die Zeile startet
nur durch dieselben unattended Gates wie heute; der Stempel ist in jeder Zeile sichtbar". Proof:
pins + Task-Familie. Haengt ab von: Schnitt 1 UND den J.2-Vorbedingungen. Write-Set: `server.ts`
(eine Self-Route, Aufruf der bestehenden Funktion :2262), `e2e/pins.ts`.
3. **E.7 „kein zusaetzliches Start-Recht" — FAELLT** (durch dieses Delta aufgehoben).
4. **H.4-Zwei-Schwellen-Verdikt — FAELLT ersatzlos** (Gehorsam statt Faehigkeit: eine Schwelle,
 die nichts aufzeichnet). Ersatz: erst der Sensor — verweigerte Zustellungen muessen eine Zeile
schreiben, bevor irgendeine Schwelle zaehlen kann [aus Kurator-Messung: eine VERWEIGERTE
Nudge-Zustellung schreibt heute keine Zeile]; die Schwelle selbst ist Owner-Policy. Der H.4-Kern
(Prompt-Anstups vs. Adapter-Defekt ueber die `DeliveryGate`-Sechsermenge [gemessen :5942]) bleibt.
5. **H.2 ROUTE_OVERRIDE „nur Owner im Klick" — AENDERT sich:** der Owner behaelt es; die MAIN
bekommt Modellwahl FUER EIGENE STARTS (Bolt-gebunden), nie am lebenden Slot.
Unberuehrt: D-Invariante (die Huelle startet Lanes, sie landet nicht — `mergeJob` bleibt unerreicht
fuer jedes Self-Token), C-Zwei-Credential-Modell, Rueckbauliste E, F-1-Alleinwert.

### J.5 Eigentum, Reparatur-Regel, Unsicherheit

**Prinzip [Owner, normativ]:** Jede gebundene Session BESITZT und VERWALTET ihren erklaerten Scope
und wird an ERGEBNISSEN, BELEGEN und GRENZ-EINHALTUNG gemessen — nicht daran, ob sie einen zentral
geskripteten Mikro-Workflow befolgt hat. Kein hoeherer Manager, keine neue Regel fuer jeden Fehler.
Besitz: Project-MAIN ↔ ihr Program · Lane ↔ ihre Task · Supervisor ↔ Fleet-Gesundheit · Controller
↔ Portfolio und Owner-Uebersetzung. Kontexte BEFAEHIGEN, sie gehorchen nicht.

**Ebenen-Trennung (harte Vorgabe, erhalten, nicht gebaut):** Context Packs sind beratende
Wissens-Eingaben. Sie gewaehren und entziehen NIE Autoritaet und GATEN nie heimlich:
`ContextPackCapability`/`requiredCapabilities` kommt in server.ts ausschliesslich als Typ-Import
(:33) und als Plan-Eingabe-Konstanten (:6208/:12849/:12853) vor — als Angabe, welche Faehigkeiten
der KONTEXT hat, geprueft von `contextOmissionFor` gegen Zeiger-Zustellwuerdigkeit [gemessen
context-plan.ts:78], in KEINEM Auth-Pfad. Autoritaet wohnt in `capability-map.ts#roleCondition`
(Schnitt 2) und in den Routen-Praedikaten — anderes File, andere Ebene; die beiden duerfen nie
verschmelzen.

**Reparatur-Regel des Systems** [Owner, verdichtet]: erst die kleinste stromaufwaerts liegende
Ursache klassifizieren, dann NUR diese eine aendern — fehlendes/irrefuehrendes Wissen → Brief/Pack ·
Handlung nicht verfuegbar/auffindbar → Capability/Adapter · falsche Autoritaetsgrenze → Program-/
Rollen-Vertrag · schlechte Modell-Passung → Routing · Ergebnis unbeobachtbar → Sensor/Receipt ·
gewoehnlicher Urteilsfehler → Feedback/Reparatur INNERHALB derselben Rolle. Danach canary; wirkungslose
Anweisungen zurueckziehen. **Eine einzelne Anekdote bleibt Evidenz, nie eine globale Regel;**
wiederholte Fehlschlaege koennen eine Promotion in geteiltem Kontext rechtfertigen. Auf die
Huelle angewandt — je Faehigkeit die ERSTE vermutete Ursache bei Fehlschlag: Anlegen/Starten
verweigert mit spezifischem Grund → Capability/Adapter (der Bolt und die Tick-Gates antworten
bereits spezifisch [gemessen :6105–:6107, :6962ff.]); verweigert ohne jede Zeile → Sensor/Receipt;
Nudge-409 auf `awaiting:"owner"` → korrekte Autoritaetsgrenze, KEIN Fix [gemessen :13452ff.];
ergebnislose, aber fehlerfreie Ausfuehrung → Wissen (Brief/Pack) oder Routing; Fehlentscheidung
im Scope → Urteilsfehler, Feedback in der Rolle. **Eine Faehigkeit, deren Fehlschlag auf „neue
Regel" zeigt, ist falsch geschnitten.**

**Was dieses Prinzip UNSICHER macht — gefaehrlichste Unschaerfe [entwurf]:** „Im bestaetigten
Program-Scope" ist nur zur Haelfte mechanisch. Der Code kann ex ante NUR die Form pruefen
(`t.programId`-Praedikat, Deckel, Gates — die Grenze); ob eine Entscheidung inhaltlich im Sinne
von `intent/successCriterion/nonGoals` liegt [gemessen :1948], ist ein Urteil (der Massstab) und
nur ex post messbar. Autonomie-Drift nach innen sieht dann so aus: jede Entscheidung nennt sich
„im Scope", solange die formalen Deckel halten. Gegenmittel ohne Schritt-Maschine: der
Program-Vertrag als Massstab, Ex-post-Messung (Attention, Disposition) und die Reparatur-Regel
— die Rest-Mehrdeutigkeit bleibt bewusst offen und ist dem Kritiker als solche gemeldet, nicht
zugedeckt. Zweite offene Stelle: „reversibel" × Rate (J.3); dritte: „gewöhnlich" (J.3).
