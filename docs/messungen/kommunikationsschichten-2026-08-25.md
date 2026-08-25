# Kommunikationsschichten — Formate, Transporte und die Annahmen darunter

2026-08-25, Lane `fleet/260825134622-c71a`, Baum `40e1bf8`. Frage: **Welche stillschweigende
Voraussetzung macht jede der vier Kommunikationsschichten (Hinweg-Brief, Transport, Rückweg,
Format), wo ist sie gemessen gebrochen, und was wäre je Schicht die nächste KLEINE Stufe Richtung
typisierter Funktionen (SYSTEM.md §Funktionen statt Routenwissen), ohne den von §Implementierungsgrenze
verbotenen Loader-/Briefcompiler-Umbau?**

Konventionen wie in `docs/messungen/system-analyse-2026-08-25.md` (im Folgenden „System-Analyse"),
auf der diese Notiz aufbaut: **VERIFIZIERT** = am Code oder Live-Zustand dieser Maschine gelesen.
**GEFOLGERT** = aus verifizierten Stücken abgeleitet. **UNGEPRÜFT** = nicht gelesen. Zwei
Vorbemerkungen: `docs/messungen/autonomie-tueren-2026-08-25.md` existiert auf main **nicht**
(`git show main:` → „does not exist", geprüft 2026-08-25); und der Auftrag zitiert „7× 409 am
25.08." für §B.6b — die System-Analyse selbst sagt **viermal** über gut zwei Minuten. Ich übernehme
die Zahl der Notiz (dort gemessen); die 7 sind UNGEPRÜFT.

---

## Schicht 1 — HINWEG: Gründungsbriefe und Task-Briefs

### (a) Ist-Mechanismus — VERIFIZIERT

Eine einzige Assembly-Naht für Lane-Briefs: `briefAndSend` (`server.ts:7512`) wählt
`next.brief?.text ?? next.text` (`:7519-7521`), hängt den Anchor-Block an (`renderContextAnchorBlock`,
`:7618` / `:7667-7676` — reine Zeiger, „no source content is copied") und den `LANE_EXIT_FOOTER`
(`:7486-7511`), dessen Status-Liste aus der Routen-Konstante `FLEET_REPORT_STATUSES` gerendert wird
— Footer und Route können dort nicht driften. Die Herkunft ist ein geschlossenes 5-Wert-Set
`BriefSource` (`:7458-7473`: compiled · owner · raw · clarify · founding), gelesen im Moment der
Byte-Wahl, nicht später von der mutierbaren Row. Aufs Receipt gehen `deliveredBytes`, `briefHash`
und `anchorBlock` (`:7630`, `:7639-7646`); `briefHashOf` (`:12299`) ist derselbe Hash, den
`LaneOutcome` als Join-Key nutzt. Die vier Founding-Varianten (Program-MAIN und Supervisor,
Bootstrap `:14780-14856` und Succession `:14914`, `:15466`) bauen Rollentext +
`PROGRAM_MAIN_RAIL_BLOCK` (`:14717ff`) + Anchor-Block und stempeln `briefSource: "founding"`.

### (b) Die stillschweigende Voraussetzung, und wo sie brach

**Annahme: ein einmaliger Text-Paste trägt die ganze Rolle — für die gesamte Lebensdauer der
Session.** Drei Brüche:

1. **Was der Paste nicht enthält, existiert für die Session nicht.** Der Kommentar über dem
   Rail-Block (`server.ts:14694-14701`) dokumentiert den gemessenen Root-Cause: bis 2026-08-24
   nannten alle vier Founding-Briefs keine einzige Tür, und zwei live Target-Repo-MAINs (iOS,
   Tower) bauten das ganze Produkt im eigenen Checkout, „because they never learned a worker lane
   was available" — die Tower-MAIN bekam die Self-Routen erst, als der Owner sie von Hand in die
   Pane tippte. VERIFIZIERT als Code-Kommentar mit Messverweis; die Messung selbst habe ich nicht
   wiederholt. Der Fix (Rail-Block) ist dieselbe Bauform: mehr Bytes in denselben Paste.
2. **Der Paste ist ein Spawn-Zeit-Snapshot.** CLAUDE.md-Kopie und `docs/`-Regal driften; der Sensor
   existiert (`rulebookDrifted`, `server.ts:18920-18927`), aber die Reparatur ist wieder ein
   Agenten-Akt („lies die Quelle nach"). Ein Brief hat keine Rücklesetür: kompaktiert die Session
   ihren Kontext oder stirbt der Anfang des Transcripts, gibt es keinen Ort, an dem sie ihre
   eigene Gründung nachschlagen kann — `GET /api/self` (`server.ts:18544-18560`) trägt Slot,
   Label, cwd, Mission, awaiting, lane, idle, autos, watches, events, aber keinen Brief
   (VERIFIZIERT am Payload-Objekt der Route).
3. **Die Act-Felder leben in Brief-Prosa.** System-Analyse §B.7.2: SYSTEM.md §84-93 verlangt
   Write-Set, Proof-Kriterium, Wake-Ziel als Felder; die Task-Zeile trägt keines davon typisiert.

### (c) Bessere Varianten

**V-K3 — die Brief-Rücklesetür (kleinste `get_act`/`describe_self`-Scheibe).** Eine read-only
Route (oder ein Feld auf `GET /api/self`): `briefHash`, `briefSource`, `deliveredAt` und — wo noch
vorhanden — die Brief-Bytes. Quelle wäre `s.history` (der Brief wird dort abgelegt, `:7648` bzw.
`:14953`), das aber `MAX_HISTORY`-getrimmt ist; das Receipt trägt nur `deliveredBytes` als Zahl
und den Anchor-Block, **nicht** die Bytes (`:7630-7646`). Ehrliche Form also: `brief: string | null`
mit `null` = „nicht mehr vorhanden", nie ein Re-Kompilat. Kosten: eine Route, kein neuer Zustand,
solange man das Trimmen akzeptiert; sonst ein persistiertes Brief-Feld je Slot (Bytes bekannt:
`deliveredBytes` liegt heute schon im Receipt). Autonomie-Wert: eine Session kann ihre Rolle
selbst wiederherstellen statt sie zu erraten — genau die Lücke, für die heute der Owner die Pane
nachfüttert. Verify: ein e2e-Check, dass die Route nach Dispatch den `briefHash` des Receipts
liefert.

**Nicht vorschlagen:** noch mehr Bytes in den Paste (die Bauform des Rail-Blocks skaliert nicht —
jeder weitere Block erhöht die ACP-21-Verlustfläche von Schicht 2 und altert als Snapshot).

## Schicht 2 — TRANSPORT: tmux paste-buffer als einziger Eingang

### (a) Ist-Mechanismus — VERIFIZIERT

`sendText` (`server.ts:5206-5292`): serialisiert über `s.inputChain` (`:5206`), liest VOR dem
Tippen den Composer und verweigert einen belegten (`SendRefused`, `:5211-5218`; Klasse `:5124`),
fährt für frische Panes eine gedeckelte Boot-Probe (`SEND_BOOT_FRESH_MS` 15 s /
`SEND_BOOT_WAIT_MS` 3 s, `:5095-5105`), pastet über tmux `load-buffer` + `paste-buffer`
(`:5250-5259`), wartet bis der Paste GERENDERT ist, schickt EIN Enter (`:5260-5269`) und beobachtet
Akzeptanz als Composer-Drain (`Acceptance` 4-wertig, `:5106-5123`; Fenster `ACCEPT_WAIT_MS` 3 s,
`:5136`). Nicht-akzeptierte EIGENE Payloads rollt `rollbackOwnComposerPayload` (`:5175-5205`) mit
exakt N BSpaces zurück — nur bei identischem Occupant, lebendem Agenten und byte-identischem
Composer-Inhalt. codex deklariert Screen-Readiness (Accept-Marker `>_ OpenAI Codex (v`, zwei
Block-Screens Trust/Sign-in, `:1052-1074`); `paneReadiness` (`:5385`) liest sie,
`waitForFoundingReadiness` (`:5394-5411`, Budget `READY_WAIT_MS` 20 s) gated Founding-Prompts,
`canDeliver` verweigert `blocked-screen` mit dem `why` (`:7153`, `:7180`).

### (b) Die stillschweigende Voraussetzung, und wo sie brach

**Annahme: das pty der Pane ist der einzige Eingang — alles Strukturelle muss als Text durch eine
TUI, deren Annahme nur per Screen-Scraping beobachtbar ist.** Der Code behandelt diese Annahme
inzwischen als das, was sie ist (eine Messaufgabe), aber jeder Bruch wurde einzeln bezahlt:

1. **Enter geht verloren:** 2/7 auf der echten claude-TUI (ACP-21, Kommentar `:5107-5110`,
   Messnotiz `docs/messungen/acp21-prompt-annahme-2026-08-22.md`) — Text bleibt im Composer, das
   alte Receipt sagte trotzdem `submitted:true`.
2. **codex-Screens fressen Pastes:** der Trust-Prompt beantwortet Paste+Enter mit „Yes, continue"
   und bootet einen LEEREN Composer (Dispatch-Race 2026-08-10, Kommentar `:1052-1060`) — der Brief
   ist weg, ohne Fehler.
3. **Ein Composer-Rest hält alles an:** 129 Zeichen Agenten-Residue → 2 572 held-Retries über
   3,69 h (System-Analyse §B.6, dort am Ledger gezählt; von mir nicht nachgezählt). Die
   ACP-26r-Rollback-Mechanik arbeitet seit `d0fa215`; strukturell bleibt, dass sechs Stellen den
   belegten Composer „owner draft" nennen (§B.6-Textbefund, V4 der System-Analyse — dort gerankt,
   hier nicht dupliziert).

### (c) Bessere Varianten

**Oberhalb der Schnittlinie: nichts.** Die gemessenen Opfer dieser Schicht sind durch ACP-25/26
versorgt (beobachtete Akzeptanz, exakter Rollback, Readiness-Gates); der verbleibende strukturelle
Schritt — Briefe als kurzen Zeiger stellen statt als Voll-Paste (**V-K4**) — schwächt die eine
Garantie, auf der Schicht 1 ruht: „the founding brief is the only text such a session is
guaranteed to read" (`:14700-14701`). Ein Zeiger verlangt einen Agenten-Akt, bevor die Rolle
existiert; und §Implementierungsgrenze autorisiert den Umbau der Zustellwege ausdrücklich nicht.
V-K4 wird darum unter der Linie geführt: erst sinnvoll, wenn V-K3 (Rücklesetür) existiert und
gemessen ist, dass Sessions sie zuverlässig ziehen. GEFOLGERT, kein Messfall dagegen.

## Schicht 3 — RÜCKWEG: Watches, FleetEvents, Reports, Attention

### (a) Ist-Mechanismus — VERIFIZIERT

Zwei getrennte Fakten im selben Tick (alle 5 s, `AUTOS_TICK_MS` `:3027`, `setInterval` `:16539`):
Watch-Prädikate minten Events (`:10241-10281`; ein totes Ziel entwaffnet den Watch mit
`lastResult`, in die Pane kommt NICHTS, `:10245-10249`), und Zustellung ist nur ein
Transport-Versuch für ein existierendes Event (`:10285-10375`): `canDeliver` mit gewaiverten
Quiet-Hours, `send-uncertain` VOR tmux persistiert, `SendRefused` → `pending` + `fleet_event_held`
+ nächster Tick (`:10338-10343`), kein Attempts-Deckel, kein Backoff, kein Terminalzustand.
Eingehende Kanäle: `openClarification` (`:6041`), `openFleetReport` (`:6143`), `openAttention`
(`:6929`, MAIN→Owner), `POST /api/self/nudge` (`:18657`, Supervisor→MAIN). Der Deckel:

```
deliveryDebts + armedReservations >= FLEET_EVENT_MAX_OPEN_PER_SLOT   → 409
```

an zwei Stellen (`:6064` Clarification, `:6160` Fleet-Report), mit
`FLEET_EVENT_MAX_OPEN_PER_SLOT = WATCH_MAX_PER_SLOT = 5` (`:2988`, `:2993`).

### (b) Die stillschweigende Voraussetzung, und wo sie brach

**Annahme: die eigenen Sinne eines Empfängers (armed Watches) und die eingehenden Berichte seiner
Lanes sind dieselbe Art Schuld und teilen sich fünf Plätze.** Der Konstanten-Kommentar direkt
darüber (`:2985-2988`) verspricht genau das Gegenteil für das Nachbar-Paar: Auto- und Watch-Deckel
seien getrennt, „so a session can hold both without either surface starving the other". Zwischen
Watches und Events existiert diese Trennung nicht — und das Starving, das der Kommentar für
Autos/Watches verhindert, ist zwischen Watches und Reports am 25.08. eingetreten: ein Koordinator
mit 4 armed Watches lässt genau 1 Report-Platz für dieselben 4 Lanes; diese Lane-Familie bekam
viermal `fleet-report receiver has no FleetEvent delivery budget` (System-Analyse §B.6b, dort
live gemessen). Der Kanal ist in beide Richtungen zu: die Lane erfährt die Ablehnung laut, der
Koordinator erfährt **nichts**.

Die Begründung des Summierens ist lesbar und ernst zu nehmen (`:2989-2992`): jede armed
Reservation wird beim Feuern ein Event, die Summe hält das Event-Array beweisbar beschränkt.

### (c) Bessere Varianten

**V-K1 — Budget-Split: Reservierungen und Schulden getrennt deckeln.** Statt der Summe zwei
Vergleiche: `deliveryDebts < FLEET_EVENT_MAX_OPEN_PER_SLOT` und `armedReservations <
WATCH_MAX_PER_SLOT` (letzterer existiert an der Watch-Route bereits — die Doppelzählung an den
zwei Report-/Clarification-Stellen fällt weg). Kosten, ehrlich benannt: die Schranke des
Event-Arrays je Slot steigt von 5 offen auf bis zu 10 offen (5 Schulden + 5 feuernde Watches);
beschränkt bleibt sie. Diff: zwei Zeilen (`:6064`, `:6160`) plus ein Pin, dass ein Slot mit 5
armed Watches noch Reports empfangen kann. Autonomie-Wert: der einzige am 25.08. gemessene
zugehaltene Rückweg öffnet sich, und zwar strukturell — ein Koordinator skaliert dann auf N
beobachtete Lanes, statt bei 4 zu ersticken. Das ist die kleinste Stufe Richtung `watch_act` +
`report_result` als KOEXISTENTE Funktionen.

**V-K1b — der stille Gegenpart: die Ablehnung dem Empfänger sagen.** Heute mintet die 409 nur
eine Antwort an den Sender; eine `audit`-Zeile existiert nicht (VERIFIZIERT: kein `audit(`-Aufruf
in `server.ts` erwähnt das Budget). Kleinste Form: beim Budget-409 eine Audit-Zeile
`fleet_event_budget_refused` auf den EMPFÄNGER-Slot — dann trägt der Betriebs-Blick (V1 der
System-Analyse, dort mit Pflichtfeld `waitingOn:"Empfänger ohne Zustellbudget"` schon gefordert)
einen Fakt statt einer Vermutung. Kosten: eine Zeile. V-K1 macht den Fall selten, V-K1b macht den
Restfall sichtbar; sie konkurrieren nicht.

## Schicht 4 — FORMATE: Freitext vs typisierte Rows

### (a) Ist-Mechanismus — VERIFIZIERT

Die typisierten Rows existieren und sind diszipliniert: `FleetReport` (`:1540-1550`) trägt
`status` aus einem 3-Wert-Set (`src/protocol.ts:33`) + `text` ≤ 4000 (`:6150-6152`), der Body
lehnt jedes weitere Feld ab (`:6144-6146`); `AttentionRequest` (`:1560-1576`) trägt `kind` aus
{decision, blocked, review-ready} + Prosa + Provenienz-Fünftupel; `ClarificationRequest` analog.
Die Pane-Nachricht des Reports ist bereits ein ZEIGER auf die typisierte Row („Read the typed row
with GET /api/self/fleet-report", `:6136-6141`; Route `:18756`) — das richtige Muster. Die
Merge-/Audit-Watch-Nachrichten tragen typisierte Verdikte (`landed=YES|NO`, Verify-Ausgang,
`lane-signals.ts:228ff`).

### (b) Die stillschweigende Voraussetzung, und wo sie brach

**Annahme: die Prosa im `text`-Feld trägt den Beleg — der Empfänger kann aus der Row entscheiden.**
Zwei Stellen, wo das messbar nicht gilt:

1. **Die lane-ready-Nachricht widerlegt sich selbst**, wörtlich (`lane-signals.ts:217-221`): das
   Prädikat „reads identically for a lane running a suite, a lane parked waiting on the owner, and
   a lane that compiled a brief instead of building. Read the pane before you act, and never land
   on this message alone." Vier Zwillingszustände, und die vorgesehene Auflösung ist
   Pane-Lektüre — genau der Freitext-Rückfall, den das Zielbild (§UI: „nicht aus frei
   interpretiertem Terminaltext") abbauen will. Jede Pane-Lektüre kostet den Koordinator Kontext
   und koppelt ihn an Render-Details.
2. **Das „quoted verification result" ist Konvention, kein Feld.** Der Footer verlangt es
   (`server.ts:7500-7502`), nichts validiert es; `report_result` im Zielbild (SYSTEM.md §167-189)
   nennt Ergebnis, Artefakte, Unsicherheiten und Belege als BESTANDTEILE. Eine MAIN, die auf einen
   `complete`-Report hin landen will, parst heute Prosa oder liest die Pane.

### (c) Bessere Varianten

**V-K2 — server-gestempelte Lane-Fakten auf der Report-Row.** Nicht neue Pflichtfelder vom
Agenten (die wären Behauptungen), sondern: `openFleetReport` stempelt beim Annehmen die
Server-Sicht der Worker-Lane auf die Row — dieselben Fakten, aus denen `laneWatchSignal` schon
rechnet (idle, dirty, ahead; Frische des Ticks mit angeben, GEFOLGERT: ob sie am Slot gecacht
vorliegen oder einen git-Read kosten, habe ich nicht geprüft). Damit werden drei der vier
Zwillingszustände auf der ROW unterscheidbar: `complete` + clean + ahead>0 (landefähig) vs
`complete` + dirty (uncommitted — der 28-%-Ausgang aus der mess-notiz-Statistik) vs `complete` +
ahead=0 (nichts gebaut). Kosten: ein Objektfeld auf `FleetReport`, Legacy-Rows ohne Feld bleiben
`unknown`. Verify: e2e-Check, dass ein Report aus einer dirty Lane den Stempel trägt. Autonomie-
Wert: der Empfänger entscheidet vom typisierten Row-Paar (Claim + Server-Fakt) statt von der
Pane — die erste `report_result`-Scheibe, die keine Agenten-Ehrlichkeit voraussetzt.

**Nicht vorschlagen:** ein Pflicht-Schema für `text` (erzwungene Struktur in Prosa erzeugt
ausgefüllte Formulare, keine Belege — dieselbe Klasse Fehler wie LLM-as-judge als Gate).

---

## Rangliste — nach Autonomie-Wert, mit Schnittlinie

| # | Variante | Schicht | Was es kauft | Kosten |
|---|---|---|---|---|
| 1 | **V-K1 Budget-Split** (+ V-K1b Audit-Zeile) | Rückweg | öffnet den einzigen am 25.08. gemessen zugehaltenen Kanal; Koordinator skaliert auf N Lanes | 2 Zeilen + 1 Pin; Event-Schranke je Slot 5→10 offen |
| 2 | **V-K2 Server-Stempel auf FleetReport** | Format | Zwillingszustände auf der Row unterscheidbar; landet die erste `report_result`-Scheibe ohne Vertrauensannahme | ein Feld, Legacy = `unknown`; evtl. ein git-Read je Report |
| 3 | **V-K3 Brief-Rücklesetür** | Hinweg | Session stellt ihre Rolle selbst wieder her; erste `get_act`-Scheibe | eine read-only Route; `null` bei getrimmter History, sonst persistiertes Feld |

**— SCHNITTLINIE —** (darunter, weil ohne aktuelles gemessenes Opfer oder gegen eine explizite Grenze)

| # | Variante | Warum unter der Linie |
|---|---|---|
| 4 | V-K4 Zeiger-Brief statt Voll-Paste | schwächt die Founding-Garantie (`server.ts:14700`); Zustellweg-Umbau, den §Implementierungsgrenze nicht autorisiert; erst nach bewährtem V-K3 |
| 5 | Held-Backoff/Terminalzustand | strukturell offen, aber ohne Opfer seit `d0fa215` (System-Analyse §B.6/§D dort schon so gerankt) |
| 6 | Routen-Rename auf die acht Verben | von der System-Analyse §B.7.1 explizit als falscher Schritt begründet — die Verben sind Ausgabevokabular der künftigen Registry, kein Umbauziel |

Gemeinsamer Nenner der drei über der Linie, GEFOLGERT: keine ist ein neues Subsystem — jede macht
einen existierenden typisierten Fakt an der Stelle verfügbar, an der heute ein Agent raten, eine
Pane lesen oder ein Owner nachtippen muss. Das ist die Implementierungsgrenzen-konforme Lesart von
„Funktionen statt Routenwissen": nicht neue Verben bauen, sondern die vorhandenen Fakten dorthin
legen, wo das Verb sie erwarten würde.

## Methode

Alles read-only in dieser Lane; kein Server gestartet, keine Pane, kein Prozess-Listing.

```sh
git show main:docs/messungen/autonomie-tueren-2026-08-25.md   # → existiert nicht
sed -n '145,260p' SYSTEM.md                                    # Zielbild-Abschnitte
rg -n 'FOUNDING_BRIEF_SOURCE|briefHash|deliveredBrief' server.ts
sed -n '5080,5340p;7440,7660p;10240,10400p' server.ts          # sendText, Brief-Naht, Event-Tick
sed -n '2975,3000p;6030,6165p;6871,6930p' server.ts            # Deckel, Report/Clarify/Attention
sed -n '725,745p;1045,1080p;1530,1580p' server.ts              # Readiness-Adapter, Row-Typen
rg -n 'function laneWatchMessage' -A 25 lane-signals.ts
grep -n 'deliveryDebts + armedReservations' server.ts          # :6064 :6160
```

Jede Zeilenangabe ist am Baum `40e1bf8` gelesen; Ledger-Zahlen (2 572 held, 4× 409, 2/7
Enter-Verlust) sind aus den zitierten Messnotizen bzw. Code-Kommentaren übernommen und dort als
gemessen ausgewiesen, von mir nicht erneut gezählt.

## Was nicht gemessen wurde

- **Die Ledger-Zahlen selbst** (held-Sturm, Enter-Verlustrate, 409-Anzahl) — übernommen aus
  System-Analyse §B.6/§B.6b und ACP-21-Notiz; die Diskrepanz 4 vs 7 (Auftrag) bleibt offen.
- **Ob die Lane-git-Fakten für V-K2 am Slot gecacht vorliegen** oder je Report einen git-Read
  kosten — entscheidet V-K2s Preis, nicht seine Richtung.
- **Wie oft die Rücklesetür (V-K3) tatsächlich `null` liefern würde** (History-Trimmung) — würde
  entscheiden, ob das persistierte Feld nötig ist.
- **Attention-/Nudge-Zustellung im Detail** (`:6929ff`, `:18657`) — nur Typ und Existenz gelesen,
  nicht der Transportpfad.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-08-25T14:55:00Z	lesepfad	System-Analyse vollstaendig vor jedem Code-Blick	Auftrag verlangt es; B.6b/B.2 sind die Anker	docs/messungen/system-analyse-2026-08-25.md	Budget-5 und Owner-Weg-Befund uebernommen
2026-08-25T14:57:00Z	korpus	autonomie-tueren auf main geprueft statt angenommen	Auftrag sagt "falls schon auf main"	git show main:	existiert nicht, kein Aufbau
2026-08-25T15:00:00Z	messung	Zahl 4 vs 7 fuer die 409s nicht harmonisiert	die Notiz hat gemessen, der Auftrag zitiert	system-analyse §B.6b	4 uebernommen, 7 als UNGEPRUEFT markiert
2026-08-25T15:20:00Z	befund	Schicht 2 ohne Vorschlag ueber der Linie gelassen	gemessene Opfer seit d0fa215 versorgt; V-K4 verletzt Implementierungsgrenze	server.ts:14700, SYSTEM.md:238	V-K4 unter die Linie
2026-08-25T15:25:00Z	befund	Watch/Event-Summe gegen den eigenen Nachbar-Kommentar gelesen	:2985-2988 verspricht Trennung, :6064/:6160 summieren	server.ts	V-K1 als #1
2026-08-25T15:30:00Z	scope	V-K2 als Server-Stempel statt Agenten-Pflichtfeld entworfen	ein Agenten-Feld waere eine Behauptung, kein Beleg	AGENTS.md §Hard invariants (report=claim)	Rang 2
2026-08-25T15:35:00Z	scope	Verb-Rename explizit NICHT vorgeschlagen	System-Analyse B.7.1 begruendet es bereits	system-analyse §B.7.1	unter die Linie
2026-08-25T15:45:00Z	messung	zwei UNGEPRUEFT-Marker vor dem Commit nachgemessen	billig schliessbar, Notiz behauptet sonst aus zweiter Hand	server.ts:18544-18560, grep audit(	beide VERIFIZIERT: kein Brief-Feld, keine Budget-Audit-Zeile
```
