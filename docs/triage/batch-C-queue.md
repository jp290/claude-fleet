# Triage-Batch C-queue — Queue-Mechanik, Register, Analyse/Brief/Refine

**11 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `391a6cab`  ·  kind=lane  ·  angelegt 2026-08-09 11:28  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[queue, DEFEKT mit Beleg] `POST /api/tasks/:id/reanalyse` ist auf diesem Deployment eine LOESCHUNG, kein Refresh — und antwortet ok:true. Analyse: docs/auftragsweg-2026-08-09.md §6 B2.

BEFUND (am Code gelesen, 2026-08-09, HEAD bbb5dbd): die Route setzt `t.analysis = undefined` und wirft zusaetzlich einen un-editierten Brief weg (server.ts:13886-13888). Beide werden AUSSCHLIESSLICH von `tickAnalysisSweep` wiederhergestellt — Brief bei server.ts:4018, Analyse bei 4049. Dieser Sweep wird nur bei `ANALYSIS_TICK_MS > 0` registriert (server.ts:10181), und live steht `FLEET_ANALYSIS_MS=0` in der srv-Spawn-Zeile (watchdog.sh:153; der Config-Sensor von ./state.sh bestaetigt live=0). Es gibt keinen zweiten Aufrufer: `grep -n 'tickAnalysisSweep('` liefert genau die Definition und die eine Registrierung.

KONSEQUENZ: ein Klick vernichtet unwiederbringlich ein Opus-5-Urteil und einen kompilierten Brief, und die Antwort ist `ok:true`. Betroffene Menge, an fleet.json gemessen: 109 Zeilen mit Analyse, 128 mit Brief (davon 84 maschinen-kompiliert, 44 owner-editiert).

DER KOMMENTAR AN ORT UND STELLE IST NICHT FALSCH, er beschreibt eine andere Welt: "analyse this again means the whole reading, and a brief the owner never touched is the analyst's own output, not an input worth preserving" — das stimmt fuer ein Fleet mit laufendem Analysten. Genau das ist der Fehlermodus, den dieses Repo oft trifft: eine Aussage, die wahr war, als sie geschrieben wurde.

DER SCHNITT, und er ist klein: die Route verweigert bei `ANALYSIS_TICK_MS === 0` mit 409 und sagt den Grund ("kein Analyst konfiguriert — niemand wuerde neu urteilen, dies waere eine Loeschung"). Kein neues Feld, kein Zustand. Die gleiche Form wie die uebrigen 409 dieses Servers: erkanntes Prinzipal, Frage nicht beantwortbar, Grund im Klartext.

ZU ENTSCHEIDEN (darum Entwurf): 409 verweigern ODER ausfuehren mit ehrlicher Antwort (`{ok:true, recompiled:false, warning:"..."}`). Die Analyse empfiehlt 409 — eine Route, die auf Nachfrage loescht, ist eine Route, die man einmal versehentlich klickt.

DONE-KRITERIUM: bei `FLEET_ANALYSIS_MS=0` antwortet `POST /api/tasks/:id/reanalyse` mit 409 und laesst `t.analysis` UND `t.brief` unveraendert — belegt an einer Zeile, die beides traegt. Gegenprobe, gleichrangig: bei `FLEET_ANALYSIS_MS>0` verhaelt sich die Route unveraendert (loescht beides, ok:true) — sonst ist die Reparatur ein Regress fuer jedes Fleet mit Analysten.

VERIFY-WEG: `./e2e-isolated.sh` (e2e/tasks.ts ist die Familie; die Suite faehrt selbst FLEET_ANALYSIS_MS=0 und startet fuer die Analyse-Checks eigene Instanzen mit eigenem Env — beide Seiten sind dort also fixturierbar) plus `bun e2e/pins.ts`.
```

## `684a9d99`  ·  kind=lane  ·  angelegt 2026-08-09 11:28  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[queue/dispatch, ENTSCHEIDUNG VOR BAU] Der Analyst ist AUS, der Dispatcher ist AN — damit ist der gesamte "unattended invariant" nicht in Kraft. Analyse: docs/auftragsweg-2026-08-09.md §6 B1.

BEFUND (Code + Live-Zustand, 2026-08-09): `FLEET_ANALYSIS_MS=0` steht in watchdog.sh:153 (Config-Sensor: live=0), gleichzeitig meldet `GET /api/sessions` live `dispatch: {available:true, on:true, maxLanes:2}`. Der Sweep laeuft also nie, und im Dispatcher steht der GESAMTE Pruefblock — nicht-analysiert-Gate, Staleness-Gate, Kollisions-Gate — in einem `if (ANALYSIS_TICK_MS) { ... }` (server.ts:4269-4308). Ist der Analyst aus, wird nichts davon geprueft. Zusaetzlich wird kein Brief kompiliert (einziger Schreiber: server.ts:4018), also uebergibt `briefAndSend` den ROHTEXT der Zeile (`next.brief?.text ?? next.text`, server.ts:3808).

DAS IST BEWUSST SO GEBAUT und im Kommentar begruendet (server.ts:4266-4268): "a released queue that silently never drains is worse than an unread one ... No reader configured, no read required" — dieselbe Haltung wie bei einem abwesenden FLEET_VERIFY_CMD. Die Begruendung traegt fuer ein Fleet OHNE Dispatcher. Hier ist er an.

WAS HEUTE NOCH BREMST, und nur das: `queued` entsteht ausschliesslich aus einem Owner-Klick (`releaseTask`, server.ts:1399; gemessen `releasedBy`: 47 owner / 0 machine), und aktuell sind 0 Zeilen `queued`. Die Aussage ist also eine ueber den NAECHSTEN Klick, nicht ueber den jetzigen Zustand: ein Klick genuegt, und die Zeile geht ungelesen, ungeprueft, unkollisionsgeprueft und mit ihrem Rohtext in eine unbeaufsichtigte Lane.

DIE FRAGE IST NICHT "Analyst an oder aus". Sie lautet: soll `▸ queue` bei abgeschaltetem Analysten ueberhaupt in eine UNBEAUFSICHTIGTE Lane fuehren duerfen — oder gehoert die Aussage "niemand hat das gelesen" an den KNOPF statt an den Tick? Drei Wege, sie schliessen einander aus:
 (a) Der Dispatcher verweigert bei ANALYSIS_TICK_MS===0 und schreibt es auf die Row-Note ("waiting: kein Analyst konfiguriert"). Ehrlich, aber genau der Deadlock, den der Kommentar vermeiden wollte.
 (b) `▸ queue` sagt es dem Owner im Moment des Klicks (die Freigabe ist die Entscheidung, also gehoert die Warnung dorthin). Kein Gate, nur Sichtbarkeit.
 (c) Analyst wieder einschalten — dann aber mit dem Preis, den dabbd1880 gemessen hat (der Sweep kann an einem Land-Tag nie konvergieren). SERIALISIEREN mit dabbd1880.
Die Analyse empfiehlt (b): sie aendert kein Gate, kostet nichts und stellt die Wahrheit dorthin, wo die Entscheidung faellt.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): bei abgeschaltetem Analysten sagt die Oberflaeche VOR der Freigabe, dass diese Zeile ungelesen und ohne kompilierten Brief in eine Lane geht — und `GET /api/tasks` bzw. der Poll traegt denselben Fakt maschinenlesbar, damit register.sh ihn zeigen kann. Gegenprobe, gleichrangig: mit laufendem Analysten erscheint der Hinweis NICHT.

VERIFY-WEG: `./e2e-isolated.sh` (e2e/tasks.ts) plus `bun e2e/pins.ts`; ein Pin haelt fest, dass der Pruefblock und der Hinweis dieselbe Bedingung lesen — sonst driften sie beim naechsten Umbau auseinander, was genau die Klasse ist, aus der dieser Befund stammt.
```

## `6d07877f`  ·  kind=lane  ·  angelegt 2026-08-09 11:28  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[queue/kollision, gemessen] `Task.files` ist ueber 198 Zeilen NULL mal gesetzt — die einzige mechanische Wahrheit ueber eine noch nicht gestartete Zeile existiert als Feld und ist leer. Analyse: docs/auftragsweg-2026-08-09.md §6 B3.

BEFUND (an fleet.json und audit.jsonl gemessen, 2026-08-09): 198 Zeilen, davon **0** mit `files`. 8 Zeilen tragen ein `refine`, `audit.jsonl` kennt **2** `task_refine_confirm`. Das Feld wird ausschliesslich von `refine-confirm` geschrieben (server.ts:13952, aus `RefineChild.files`) — die einzige Stelle im ganzen Server. Sein eigener Kommentar (server.ts:1083-1090) nennt es "the only machine-readable surface a NOT-YET-STARTED task can have: a running lane has a git diff, a queued row has nothing else".

KONSEQUENZ, und `./register.sh` §2 sagt es selbst: die Kollisionsflaeche einer offenen Zeile ruht vollstaendig auf zwei schwaecheren Werten — `[grob]` (Dateinamen aus der Prosa gelesen; "gleiche DATEI ist nicht gleicher Code") und `[modell]` (das Urteil des Analysten, das bei FLEET_ANALYSIS_MS=0 ohnehin nicht mehr produziert wird). Der Deckel DISPATCH_MAX_LANES=2 ist damit wieder die einzige Sache, die zwei kollidierende Lanes auseinanderhaelt — genau der Zustand, den der Kommentar bei server.ts:4290 als ueberwunden beschreibt ("the only thing that used to keep two colliding lanes apart was DISPATCH_MAX_LANES, a number that knows nothing about files").

ZU ENTSCHEIDEN, bevor gebaut wird — die naive Antwort ist die falsche: "dann soll der Analyst `files` schreiben" macht aus einer VERIFIZIERTEN Angabe (der Refiner prueft die Pfade gegen den Baum, der Owner promotet sie) eine geratene. Das Feld ist absichtlich propose/promote. Drei Wege:
 (a) Der Owner kann `files` beim Anlegen/Editieren einer Zeile selbst setzen (POST/PATCH) — dieselbe Beweiskraft wie heute, ohne den Umweg ueber einen refine-Lauf.
 (b) `files` wird aus der `Files:`-Prosazeile abgeleitet, die der Brief ohnehin traegt — billig, aber es verwandelt `[grob]` in etwas, das wie `[mechanisch]` aussieht. Die Analyse raet ab: das ist ein Wahrheitswert-Downgrade, das sich als Upgrade liest.
 (c) So lassen und stattdessen register.sh/das Board sagen, dass die Spalte strukturell leer ist.
Empfehlung: (a), und (c) unabhaengig davon — eine leere Spalte, die niemand als leer erkennt, ist schlimmer als keine Spalte.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): eine offene Zeile kann `files` tragen, ohne durch refine gegangen zu sein; `register.sh` §2 fuehrt sie danach unter `[mechanisch]` statt `[grob]`; und eine Zeile OHNE `files` wird weiterhin ausdruecklich als UNBEKANNT gefuehrt, nie als "beruehrt nichts" (briefs/work-register.md §4). Gegenprobe, gleichrangig: ein per Hand gesetztes `files` ueberschreibt niemals ein aus refine-confirm stammendes, ohne dass die Herkunft sichtbar bleibt.

VERIFY-WEG: `./e2e-isolated.sh` (e2e/tasks.ts) plus `bun e2e/pins.ts`; zusaetzlich ein Lauf von `./register.sh` gegen eine Zeile mit gesetztem `files`, weil register.sh gitignored ist und kein Compiler sie sieht.
```

## `dabd1880`  ·  kind=lane  ·  angelegt 2026-08-07 14:24  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Der Brief sagt es selbst: „WAS ZU ENTSCHEIDEN IST (kein fertiges DONE — die Zeile braucht clarify)" und stellt drei Fragen (a)/(b)/(c), von denen (b) die Entwertungssemantik der einzigen maschinellen Kollisionsaussage der Queue ändert — das ist eine Owner-Entscheidung, kein ausführbarer Auftrag, und es gibt kein VERIFY. Die Befunde selbst tragen: `analysisBusy` als Single-Flight (server.ts:3575-35
- Analyst sagt kollidiert mit: e17a19b0, e4f87152, 8235c4bc, fleet/260808114656-6e86, 55264c21
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Der Analyse-Sweep kann an einem Land-Tag nie konvergieren — gemessen, nicht hergeleitet

BEFUND (2026-08-07, main-36, Slot 4). Um 12:23Z waren 0 von 59 offenen lane-Zeilen gegen den aktuellen Integrations-Tip beurteilt. NULL. Der Sweep lief in dieser Stunde durchgehend und hat kein einziges frisches Urteil vorzuweisen.

DIE RECHNUNG, beide Seiten gemessen:
- KAPAZITAET: 6 Zeilen pro ~5 min (12 Messpunkte im Minutentakt, 11:40Z-11:51Z: 0 -> 6 -> 12). Das sind ~72 Zeilen/Stunde, und es ist eine Obergrenze — `analysisBusy` (server.ts:2333) ist ein Single-Flight-Riegel, ANALYSIS_BATCH_CAP = 6, ANALYSIS_TIMEOUT_MS = 420_000.
- ENTWERTUNG: `analysisStale` schluesselt auf den Integrations-Tip. EIN Land entwertet damit ALLE 59 Urteile gleichzeitig. Heute sind sechs Lands gefallen.
=> 59 Entwertungen pro Land gegen 72 Urteile pro Stunde: ab etwa einem Land pro Stunde laeuft der Sweep dauerhaft hinterher, und der Register-Zustand ist strukturell `!head`. Das ist kein Fehler im Sweep, sondern seine Auslegung gegen die Land-Rate.

DIE VORGESEHENE GEGENMASSNAHME IST HIER WIRKUNGSLOS. `tickAnalysisSweep` sortiert `due` mit "RELEASED ROWS FIRST" (`status === "queued"` zuerst) — und der Kommentar begruendet das genau mit diesem Fall ("a busy afternoon can hand this sweep more work than one batch holds"). Gemessen: es gibt auf dieser Deployment NIE eine `queued`-Zeile, weil der Dispatcher (Tick 8 s) jede freigegebene Zeile sofort auf `sent` zieht. Die Vorzugsregel hat eine leere Population — dieselbe Fehlerform, die `500ff63` beim Eval-Gate beschrieben hat.

ZWEITE FOLGE, unabhaengig davon: eine per `POST /api/tasks/:id/reanalyse` angeforderte Neubeurteilung hat KEINEN Weg nach vorn. Sechs Zeilen, um 11:26Z angefordert, standen auf den Plaetzen 41-46 der Faelligkeitsschlange und hatten nach 30 min noch kein Urteil (gemessen, Watcher-Protokoll). Der Owner-Knopf ist damit heute ein Wunsch, kein Auftrag.

DRITTE FOLGE, still: ein Promote verwirft eine angeforderte Neubeurteilung ersatzlos. `526ecd5e` war eine der sechs; nach dem Dispatch steht sie auf `sent`, und der Sweep liest nur `pending`/`queued`. Ihr Urteil kommt nie, ohne dass irgendwo steht, dass es einmal angefordert war.

WAS ZU ENTSCHEIDEN IST (kein fertiges DONE — die Zeile braucht clarify):
(a) Soll eine ANGEFORDERTE Neubeurteilung Vorrang haben (eigene Warteschlange vor den bloss-stale-Zeilen)? Das ist die kleinste Aenderung und trifft die gemeldete Reibung direkt.
(b) Ist "jedes Land entwertet jedes Urteil" ueberhaupt richtig? Ein Land, das drei Dateien anfasst, macht das Urteil ueber eine Zeile in einem anderen Winkel des Baums nicht falsch. Denkbar: Entwertung nur fuer Zeilen, deren `files`/`collides` die gelandeten Dateien schneiden — HARTE VORBEDINGUNG `9e0fdc3b` (`files` als Feld), denn heute ist `analysis.files` auf ALLEN 44 Zeilen mit Analyse leer (gemessen).
(c) Soll ein Promote die angeforderte Neubeurteilung wenigstens SICHTBAR verwerfen statt still?

WARUM DAS ZAEHLT: `Task.analysis` ist die einzige maschinelle Aussage der Queue ueber Kollisionen. Ist sie strukturell nie frisch, ist jede Aussage darauf `!head` — und `!head` heisst laut Register ausdruecklich "unverifiziert, nicht falsch". Eine Evidenzschicht, die an jedem produktiven Tag unverifiziert ist, traegt keine Entscheidung.

FLAECHE: server.ts (tickAnalysisSweep, analysisDue, analysisStale) · e2e/tasks.ts
QUELLE: eigene Messung main-36 am 2026-08-07, Ledger + Owner-Poll, Watcher-Protokolle im Session-Scratchpad
```

## `8235c4bc`  ·  kind=lane  ·  angelegt 2026-08-07 13:55  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Der Brief nennt sich selbst „SKIZZE, UNGEPRÜFT" und endet mit einer Klärungsliste („Zu klären: Datenqualität/Vollständigkeit von analysis.files, Stale-Verhalten (!head), UI-Form") — kein DONE, kein VERIFY, nichts, was die Suite beurteilen könnte; die UI-Form der Wellen-Sicht ist zudem eine Owner-Entscheidung. Dazu stimmt die tragende Tatsachenbehauptung nicht: `TaskAnalysis` führt `verdict/blocker
- Analyst sagt kollidiert mit: dabd1880, e17a19b0, e4f87152, 55264c21, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion", "attribution"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[idee tweet-2026-08-07] Wellen-Gruppierung der Queue mechanisieren (advisory): Heute gruppiert der MENSCH queued Tasks in Wellen (Session-33-Praxis 'Wellenprogramm'); die Maschine liefert nur je Task Task.analysis mit collides/files (tickAnalysisSweep) und den Lane-Deckel FLEET_DISPATCH_MAX_LANES=2. Idee: aus analysis.files/collides eine Wellen-SICHT berechnen — nicht-kollidierende Batches, Reihenfolge so, dass spaetere Wellen auf fruehere bauen — und sie NUR ANZEIGEN (Queue-Overlay), kein Auto-Dispatch ueber die bestehenden Ventile hinaus (Owner-Entscheid 2026-08-04: kein Tick landet; Dispatcher startet nur queued). Zu klaeren: Datenqualitaet/Vollstaendigkeit von analysis.files, Stale-Verhalten (!head), UI-Form. SKIZZE, UNGEPRUEFT.
```

## `e17a19b0`  ·  kind=lane  ·  angelegt 2026-08-07 13:06  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — DONE ist dreiteilig, aber jeder Teil hat einen benannten Beweis in `e2e/` (Task-Id → `task`, kurzer SHA → `commit`, doppeldeutiges Hex → zwei Treffer, Unbekanntes → `unbekannt` statt 500, verschobene Zeile → als veraltet gemeldet und NICHT verlinkt), dazu die Gate-Kette — das ist von der Suite des Repos beurteilbar. Der Präzedenzfall stimmt am Baum: `/api/lane` existiert (server.ts:11812), `Measur
- Analyst sagt kollidiert mit: 55264c21, e4f87152, dabd1880, 8235c4bc, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > [main-36, 2026-08-07] ANLASS BESTAETIGT, WOERTLICH: Owner heute — "Hab nur keine moeglichkeit ueber '526ecd5e' etwas zu suchen". Die Zeile beschreibt keinen Komfort, sondern eine fehlende Grundfunktion.

BEFUND UNABHAENGIG NACHGERECHNET (nicht aus dem Zeilentext uebernommen): 152 hex-artige Tokens (7-8 Zeichen) in den Texten der offenen Zeilen, davon 83 echte Task-Ids = 55%. Ein Regex-Linkifier laege bei 45% falsch. Alle 143 Task-Ids sind 8 hex, kurze SHAs 7 — aber git kuerzt auch auf 8 ab, die 
  > [main-36, 2026-08-07] OWNER-PRAEZISIERUNG, woertlich: "Ich WILL diesen blauen hash anklicken KOENNEN. Oder zumindest darueber hovern und eine kurze info oder so bekommen.. Ich weiss halt nicht worauf du hier referenzierst wenn du die erwaehnst."

DAS AENDERT DEN ZUSCHNITT ZUM GUENSTIGEN: der erste Schritt ist HOVER, nicht Link. Ein Tooltip mit dem Kurztitel braucht kein Sprungziel, keine Route, keine Navigation und keine Entscheidung darueber, WOHIN ein Commit-Sha fuehrt — nur den aufgeloesten N

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Bezeichner aufloesen statt anzeigen — `f520e704` soll sagen koennen, was es IST (Mensch: Link · Agent: eine Abfrage)

OWNER-WUNSCH vom 2026-08-07, woertlich: „wir sollten all diese 'hash-werte' wie 'f520e704' usw. bald mal besser gestalten. Vllt anklickbar und es öffnen den task/slot/file idk, könnte sogar für den agenten ansich hilfreich sein, hmm"

DIE ZWEI EMPFAENGER SIND NICHT DERSELBE FALL, und der zweite ist der schwierigere:
- **Mensch am Board:** will klicken und die Zeile/den Slot/die Datei sehen. Ein Link.
- **Agent (Lane, Steward, Main-Session):** liest denselben Bezeichner als TEXT — im Brief, im Commit-Body, im Report, in der Queue. „Anklickbar" ist fuer ihn bedeutungslos. Was ihm hilft, ist **aufloesbar**: EIN Aufruf, der sagt, was das Token ist und wo es hingehoert. Heute kostet ihn das je nach Art einen anderen Weg (Task: `GET /api/tasks` + filtern · SHA: `git show` · Branch: die Akte · Trail-Lauf: eine Datei in zwei moeglichen Verzeichnissen), und er muss die Art VORHER erraten.

GEMESSEN am Baum `ed4270c` — das Problem hat eine Groesse und eine Form:
- **137 Task-Ids, alle exakt 8 Hex-Zeichen.**
- In den Texten der OFFENEN Queue-Zeilen allein stehen **142 hex-artige Tokens** (`\b[0-9a-f]{7,8}\b`): **77 sind Task-Ids, 65 sind etwas anderes** (kurze SHAs, Trail-Laeufe, Sonstiges). Ein Linkifier nach FORM wuerde also ~46 % falsch beschriften.
- **Die Form kann nicht klassifizieren:** Task-Id = 8 hex, kurzer SHA = 7 hex, beide `[0-9a-f]{7,8}`. Nur eine Aufloesung entscheidet. Das ist die zentrale Design-Konsequenz, und sie schliesst die naheliegende Loesung (Regex + Prefix-Regel im Client) aus.
- **Ein falscher Link ist schlechter als Text — belegt, nicht befuerchtet:** heute sind VIER veraltete Zeilenrefs aufgetreten (`server.ts:7660`->`8314` Digest-Route, `4226`->`4538` notes-Schreiber, `4511`->`4599` Client-Kommentar, `6674`->`6812` Linsen). Klartext „server.ts:7660" liest sich als Behauptung, die man prueft; ein KLICKBARER Link liest sich als Tatsache und springt an eine falsche Stelle. Ein `file:line`-Ref darf deshalb nur verlinkt werden, wenn er gegen den AKTUELLEN Baum aufgeloest wurde — sonst sichtbar als „Ref veraltet", nie stillschweigend.

DER PRAEZEDENZFALL EXISTIERT UND SOLL NICHT NEU ERFUNDEN WERDEN: die Akte (`GET /api/lane?branch=…`, gelandet `9940ac3`) loest bereits GENAU EINE Art auf (Branch -> ganze Geschichte, mit `Measured<T>` als Ehrlichkeitstyp: `read` mit Wert | `unknown` mit Begruendung). Der Auftrag hier ist die Verallgemeinerung derselben Idee auf die uebrigen Arten — und wo die Akte schon antwortet, zeigt der Resolver auf sie, statt einen zweiten Leser zu bauen.

DONE (drei Teile):
(a) **Eine Aufloesungs-Route**, die ein rohes Token nimmt und sagt, was es ist: `task | commit | branch | slot | file-ref | trail-run | unbekannt` — plus dem, was man braucht, um es zu oeffnen (bei `task` die Zeile, bei `commit` Subject + ob es auf main ist, bei `branch` der Zeiger auf die Akte, bei `file-ref` ob die Zeile heute noch das enthaelt, worauf sie zeigte). **Mehrdeutigkeit wird ausgegeben, nicht aufgeloest:** faellt ein 7-8-stelliges Hex auf eine Task-Id UND einen Commit, liefert die Antwort BEIDE Treffer. Ein Rater, der still einen waehlt, ist schlechter als eine ehrliche Liste. `unbekannt` ist ein Ergebnis, kein Fehler.
(b) **Client:** Bezeichner im Board (Queue-Texte, Kommentare, Reports, Land-Zettel) werden anklickbar und oeffnen das aufgeloeste Ziel — aber NUR, wenn die Aufloesung eindeutig war. Mehrdeutige und unbekannte Tokens bleiben Klartext bzw. zeigen die Auswahl. Kein Link, der raet.
(c) **Fuer den Agenten dokumentiert:** eine Zeile in `CLAUDE.md`/`docs/`, dass es diesen einen Weg gibt — sonst ist er gebaut und niemand ruft ihn. (Dieselbe Krankheit wie `git notes --ref=fleet/land`: 108 Zettel, null Leser, bis `9940ac3` einen gebaut hat.)

VERIFIKATION: Checks in der zustaendigen `e2e/`-Familie. Mindestens: eine bekannte Task-Id loest als `task` auf · ein kurzer SHA als `commit` · ein Hex, das BEIDES ist, liefert zwei Treffer statt einen geratenen · ein Token, das nichts ist, liefert `unbekannt` und keinen 500 · ein `file:line`, dessen Zeile sich verschoben hat, wird als veraltet gemeldet und NICHT verlinkt (Fixture: eine Datei, in die vorne Zeilen eingefuegt werden). Dazu die volle Gate-Kette aus CLAUDE.md.

FLAECHE / REIHENFOLGE: `server.ts` + `src/client.ts`. **Nicht starten, solange zwei `server.ts`-Lanes laufen** (Deckel; Stand bei Erstellung: `7c890b09` und `00e5f771`). Der Client-Teil kollidiert ausserdem mit der UI-Kette (`c0a8366b` -> `ed4a318c` -> `c8e2ddd7`) — vor dem Start pruefen, wo die steht.

FILES: `server.ts` · `src/client.ts` · `e2e/` · `CLAUDE.md` nur als Report-Text (gitignored, wird beim Lane-Spawn kopiert)
GRUPPE: G6
QUELLE: Owner-Wunsch 2026-08-07 an Session 35, gemessen am Baum `ed4270c`
```

## `65af341f`  ·  kind=lane  ·  angelegt 2026-08-07 01:26  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — DONE requires flipping two rows of the LIVE queue (10ac2528, 63626cdb) — they sit in fleet.json, which is gitignored runtime state of the running fleet server, i.e. shared machine state no worktree can contain and no e2e can judge; the code half is fine (adopt is indeed the only kind mutation, note→lane at server.ts:13190, and the archive/delete sent-guard exists at server.ts:13159, so a check()-p
- Analyst sagt kollidiert mit: c8e2ddd7, ed4a318c, f5cf00dd, fleet/260808114656-6e86
- Analyst-Blocker: ["reach", "attribution"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
kind lane->note fehlt als Route — adopt ist eine Einbahnstrasse. GEMESSEN 2026-08-07: t.kind wird in server.ts an genau zwei Stellen gesetzt, 9606 (adopt, note->lane) und 7799 (Steward-Create). Es gibt KEINEN Weg, eine falsch als lane angelegte Zeile auf note zu ziehen. Folge, live aufgetreten: der Owner entschied am 08-07, die drei Formfehler 10ac2528, 63626cdb und 0be58694 auf note zu korrigieren (sie sagen alle im ersten Satz NOTIZ — kein Arbeitsauftrag, waren aber kind:lane und damit per Promote startbar). Ausfuehrbar war nur 0be58694, weil es ohnehin auf der Archiv-Liste stand; die anderen beiden stehen bis heute als startbare lane-Zeilen da, die sich selbst als Nicht-Auftrag deklarieren. Archivieren waere das falsche Werkzeug — es nimmt sie aus dem Register, eine note bliebe sichtbar und unstartbar. DONE: eine Route, die kind lane->note zieht, mit demselben Riegel wie archive/delete (409 wenn status==sent, server.ts:9575) und ohne den propose-outcome-Kanal zu beruehren (der misst helped/dismissed, eine Formkorrektur ist keins von beidem); 10ac2528 und 63626cdb danach auf note; ein Pin in e2e/tasks.ts, der beweist, dass eine lane-Zeile auf note gezogen werden kann UND dass eine sent-Zeile das mit 409 verweigert. VERIFIKATION: bunx tsc-Kette + bun run build + ./e2e-isolated.sh (der Pin muss im Tail auftauchen).

FILES: server.ts src/client.ts e2e/tasks.ts
QUELLE: gemessen in Session 33 beim Ausfuehren des Owner-Entscheids zur Archiv-Liste
```

## `c8e2ddd7`  ·  kind=lane  ·  angelegt 2026-08-07 08:35  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief hands its DONE to a later clarify lane ("KLAERUNGSAUFTRAG ... leite daraus ein hartes DONE ab") — a full redesign of both panes whose finished state no gate in this repo can judge, and the taste call is explicitly the owner's. Its one "Messung, keine Vermutung" is also false today: `adjudicate` occurs twice in src/client.ts (:7431 comment, :7437 "un-adjudicated — nobody has ruled on this
- Analyst sagt kollidiert mit: ed4a318c, f5cf00dd, 65af341f, 5d55bcfc, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion", "attribution"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > REIHENFOLGE, vom Owner am 2026-08-07 entschieden: 21c6eb4b (Token-Umbau, laeuft ALLEIN) zuerst, diese Zeile danach. Begruendung des Owners: die neue Flaeche soll auf fertigen Tokens gebaut werden statt sie zu erben. Vorbereitung laeuft: 21c6eb4b und bb0475b8 sind am 07.08. durch den Refine-Kompiler geschickt.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NEUENTWURF DER QUEUE-OBERFLAECHE — beide Panes zusammen, nicht als Einzelfixes. ERSTER KNOPF IST ▸ clarify first, nicht ▸ start lane: was „besser" heisst, ist Geschmack des Owners und darf nicht vom Produzenten geschrieben werden (Owner-Vorgabe 2026-08-07).

OWNER-VORGABE vom 2026-08-07, woertlich: „ich denke das wir dann gleich mal die task queue oberfläche gründlich überarbeiten müssen"
Zwei Entscheide dazu, in derselben Runde: (1) Flaeche = NEUENTWURF DER GANZEN FLAECHE, beide Panes zusammen — nicht Liste allein, nicht Detail allein, nicht nur die Luecken. (2) Reihenfolge = NACH `21c6eb4b` (Token-Umbau), damit die neue Flaeche auf fertigen Tokens gebaut wird statt sie zu erben.

DIE FLAECHE IST FESTGENAGELT (gemessen 2026-08-07 an Baum d046ceb, nicht geschaetzt):
- Liste: `renderQueue()` `src/client.ts:5673-5754`, 82 Zeilen. `＋ New task`, vier Gruppen aus `Q_GROUPS` (needs you · released · running · backlog). Eine Zeile = `qFirstLine(t.id)` plus EINE Untertitelzeile, die bis zu NEUN Fakten mit „ · " aneinanderhaengt: Verdict, Filing-Tag, Quelle, Kriterium-Zustand, Kommentarzahl, Repo, Alter, Slot, Note.
- Detail: `renderQueueDetail()` `src/client.ts:5331-5672`, 342 Zeilen. Zwoelf Knoepfe (adopt · start lane inkl. roher Variante · clarify first · refine · release · re-analyse · hold · restore · done · archive · delete · comment-delete) und vier Editoren (Kommentar, Brief, Kriterium, Refine-Vorschlag).
- Zusammen 424 Zeilen. Population, die sie tragen muss: 64 offene von 123 Zeilen (lane=54, note=10).

DREI ZWAENGE, DIE DER ENTWURF NICHT BRECHEN DARF (jeder ist im Code begruendet, nicht Meinung):
(a) `qKey` `:5680-5688` — die Liste wird NUR bei echter Aenderung neu gebaut. Ohne das baut der 2-s-Poll die Liste unter dem Cursor neu und setzt die Auswahl alle zwei Sekunden zurueck. Der Kommentar nennt es „the same class of defect as the compose box above". Ein Neuentwurf, der das verliert, ist ein Regress, auch wenn er huebscher ist.
(b) Sortierung `:5723-5728` — „released" ist die EINZIGE Gruppe mit echter Ordnung: das ist die Pick-Reihenfolge des Dispatchers (Erstellungsreihenfolge). Newest-first waere dort eine Luege darueber, was als naechstes laeuft. Ueberall sonst ist newest-first richtig.
(c) Der Untertitel darf nicht laenger werden. Neun Fakten in einer Punktkette sind schon die Beschwerde.

WAS NACHWEISLICH FEHLT (eine Messung, keine Vermutung): `adjudicate` kommt in `src/client.ts` NULL mal vor — ein rotes Post-Land-Audit ist nur per curl beurteilbar. Alle 16 Rote sind so beurteilt worden, drei davon am 2026-08-07. CLAUDE.md sagt es selbst: „Einen Knopf im Board gibt es dafuer noch nicht." Ob das in DIESE Flaeche gehoert oder auf den Audit-Rail (`6440c392`), ist eine der Klaerungsfragen.
GEGENPROBE, die eine naheliegende Vermutung WIDERLEGT: `done`, `archive`, `unarchive`, `unqueue` HABEN Knoepfe (`:5656-5660`). Die Knopfleiste ist fast vollstaendig — das Problem ist also nicht „Aktionen fehlen". Wer mit dieser Annahme anfaengt, baut am Befund vorbei.

WAS DIE ZEILE HEUTE NICHT ZEIGT: `files` — die Dateiflaeche einer Zeile. Das Feld entsteht erst durch `9e0fdc3b`; bis dahin ist Kollision auf der Zeile unbekannt und darf nie wie „keine" aussehen.

KLAERUNGSAUFTRAG (das ist der Inhalt der Clarify-Lane, NICHT Bauauftrag): benenne je Pane, welche Frage der Owner an der Flaeche stellt und heute nicht in einem Blick beantwortet bekommt; leite daraus ein hartes DONE ab, das ohne Geschmacksurteil pruefbar ist; und einen Verifikationsweg, der fuer eine reine Darstellungsaenderung ueberhaupt trennscharf ist (ein Screenshot-Vergleich beweist bei einem NEUENTWURF nichts — anders als bei `21c6eb4b`, wo „Diff optisch NULL" genau richtig ist).

REIHENFOLGE UND KOLLISION: Flaeche ist `src/client.ts` + `public/index.html` — dieselbe wie `21c6eb4b`/`bb0475b8` (Welle 7.0, laufen allein) und wie jede weitere Welle-7-Zeile. STRIKT NACH `21c6eb4b`. Solange eine Lane in `src/client.ts` sitzt, wird diese Zeile nicht gestartet.

FILES: `src/client.ts`, `public/index.html`
GRUPPE: G-UI
QUELLE: Owner-Vorgabe + Flaechenmessung durch Session 34 (main), 2026-08-07, Baum d046ceb
```

## `ed4a318c`  ·  kind=lane  ·  angelegt 2026-08-07 08:51  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — Teil B is an owner decision the brief itself refuses to let a lane make ("soll eine Lane ueberhaupt noch einen der 16 Plaetze verbrauchen ... STOPPT. Kein Code") — no repo-judgeable finished state, and it ships bundled with buildable Teil A in one set of bytes, so a released lane gets both. Teil A additionally hangs on precondition c0a8366b, which the brief names as unlanded. The measurements them
- Analyst sagt kollidiert mit: c8e2ddd7, f5cf00dd, 65af341f, fleet/260808114656-6e86
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > OWNER-IDEE vom 2026-08-07, woertlich: „ich frage mich hier auch wie wir später auf einen worktree slot verweisen, vielleicht wäre die möglichkeit das kürzel direkt beim draufklicken kopieren zu können, hier ganz gut"

Das ist die fehlende HAELFTE von Teil A und gehoert dort mit gebaut, nicht als eigene Zeile: Teil A nimmt der Lane-Zeile die Nummer weg — dann muss etwas anderes der Griff sein, an dem man sie benennt. Sonst tauscht die Zeile eine schlechte Referenz gegen gar keine.

WAS DER GRIFF 

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Main-Sessions behalten ihre Nummer, LANES werden frei — zwei Teile, strikte Reihenfolge, Teil B geht ueber ▸ clarify first.

OWNER-VORGABE vom 2026-08-07, woertlich: „die slotZuweisung der sessions entfernen so das sie 'frei sind' und keine lose Nummer tragen" — und auf Nachfrage praezisiert, woertlich: „ich will eigenltich das main sessions ihne nummer behalten und worktree sessions aber fei werden.." Das ist der Zuschnitt: die Nummer bleibt fuer Main-Sessions, sie faellt fuer Lanes. NICHT die Nummer als Identitaet abschaffen — das war eine der abgelehnten Lesarten.

WAS DIE NUMMER LANES HEUTE KOSTET (gemessen 2026-08-07, Baum d046ceb):
- `MAX_SLOTS = 16` (`server.ts:33`) ist ein FESTES Raster; der Kommentar sagt „fixed places — the sidebar always shows all of them", `slots` ist ein Array fester Laenge (`:297`).
- Eine Lane bekommt ihren Platz aus demselben Raster: `server.ts:2378` `slots.find((s) => !s.cwd && !laneSpawn.has(s.id))` — der erste freie NUMMERIERTE Platz.
- Belegung zum Messzeitpunkt: 16 Plaetze = 7 main · 4 lane · 5 frei. Lanes sind fluechtig (Dispatcher spawnt, Land raeumt ab), Main-Sessions sind langlebig — und beide konkurrieren um dasselbe knappe Budget. Ein Lane-Burst kann eine neue Main-Session aussperren; nicht `FLEET_DISPATCH_MAX_LANES` ist hier die Grenze, sondern das Raster.

DIE HARTE GRENZE, die Teil B formt (am LAUFENDEN Pane von Slot 7 nachgesehen, `ps eww`): `FLEET_SELF_SLOT=7` steht im Prozess-Env, und `FLEET_SELF_TOKEN` ist an diesen Slot gebunden. Die interne ID einer laufenden Lane ist damit fuer ihre Lebenszeit UNVERAENDERLICH. Was fallen kann, ist die Nummer als GRID-POSITION und als ANZEIGE — nicht die interne Identitaet. Dazu: `sess = (id) => `s${id}`` (`server.ts:562`, 13 Aufrufstellen) macht den tmux-Namen zur Nummer, `/api/slots/:id/…` ist die gesamte Owner-API, `slotstats.ts` (240 Z.) schluesselt Historie darauf, und `Task.slot` / `autos.slot` / `shares.slot` sind Fremdschluessel.

TEIL A — ANZEIGE (klein, client-only, ▸ start lane).
DONE: eine Lane-Zeile in der Seitenleiste traegt keine Slot-Nummer mehr, sondern ihren Branch; sie erscheint ausschliesslich unter ihrem Stapel-Anker. Main-Session-Zeilen behalten ihre Nummer unveraendert — das ist die Owner-Vorgabe und zugleich die Gegenprobe: eine Aenderung, die BEIDE entnummert, hat die Zeile falsch erfuellt. Wo die Nummer operativ noch gebraucht wird (Fehlermeldung, Copy-Ziel, `/api/self`-Debugging), bleibt sie erreichbar, nur nicht als Titel.
VERIFIKATION: Fixture mit einer Main-Session und zwei Lanes im selben Repo — die zwei Lane-Zeilen nennen ihren Branch und keine Nummer, die Main-Zeile nennt ihre Nummer. Gegenprobe: der Check faellt heute. Dazu `bun run build` und die stehende Gate-Kette.
VORBEDINGUNG: `c0a8366b` (Stapel-Anker auf `lastOutput`) — ohne einen richtig haengenden Stapel wandern Lanes unter die falsche Session UND verlieren gleichzeitig ihre Nummer, das ist schlechter als heute.

TEIL B — ZUTEILUNG (▸ clarify first, NICHT direkt starten).
Die offene Frage, die kein Bau beantworten darf: soll eine Lane ueberhaupt noch einen der 16 Plaetze verbrauchen, oder wird sie ausserhalb des Rasters vergeben? Das entscheidet, ob `MAX_SLOTS` weiter eine gemeinsame Grenze ist oder nur noch fuer Main-Sessions gilt — und beruehrt `sess()`, die Routen und `slotstats`. Die Clarify-Lane traegt zusammen, was am Raster haengt, schlaegt ein hartes DONE vor und STOPPT. Kein Code.

REIHENFOLGE: Dateiflaeche Teil A = `src/client.ts`; Teil B zusaetzlich `server.ts`. STRIKT NACH `21c6eb4b` und NACH `c0a8366b`. Kollidiert mit `c8e2ddd7` (Queue-Neuentwurf) in derselben Datei — seriell, Reihenfolge offen.

FILES: `src/client.ts` (A), zusaetzlich `server.ts` (B)
GRUPPE: G-UI
QUELLE: Owner-Vorgabe + Messung durch Session 34 (main), 2026-08-07, Baum d046ceb
```

## `f5cf00dd`  ·  kind=lane  ·  angelegt 2026-08-07 09:35  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Both parts are bounded and machine-checkable: POST /api/slots/:id/open-worktree already forwards `typeof body.branch === "string" ? body.branch : ""` into openLaneInSlot (server.ts:13415), createWorktree (:2266) resolves the toplevel via rev-parse --show-toplevel, auto-names `fleet/<stamp>-<hex>` on an empty branch, validates with check-ref-format and rejects an existing branch — so "named branch 
- Analyst sagt kollidiert mit: c8e2ddd7, ed4a318c, 65af341f, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Einen Worktree schnell und BENANNT starten — der Knopf existiert, aber er kann nur Lanes und nur mit Zufallsnamen.

OWNER-VORGABE vom 2026-08-07, woertlich: „nur muss ich leider sagen das wir gerade keinen knopf haben damit ich einen leeren worktree einfach auf die Schnelle starten kann" — Anlass war eine reine DENK-Session (Ueberblick + Mitarbeiter-Idee), fuer die ein neutraler Baum gebraucht wurde.

GEMESSEN 2026-08-07 (Baum 438c326) — die Praemisse stimmt nur halb, und die Korrektur ist der eigentliche Zuschnitt:
- Der Knopf EXISTIERT: `⎇ New lane here` im Picker-Detail (`src/client.ts:3513`), ruft `startWorktree(path)` -> `POST /api/slots/:id/open-worktree {repo}`.
- Er ist bedingt: `if (info?.git && !info.worktree)` (`:3512`). Auf einem Repo sichtbar, INNERHALB eines Worktrees nicht. Genau das laesst ihn wie „gibt es nicht" aussehen, wenn man gerade in einem Baum steht.
- Er kann nur EINEN Namen: der Client uebergibt kein `branch`, also immer `fleet/<stamp>-<hex>` (`server.ts`, grep `createWorktree` — auto-benannt, wenn branch leer). Die ROUTE nimmt `branch` bereits entgegen (`server.ts:10151ff`, `typeof body.branch === "string" ? body.branch : ""`) — die Faehigkeit ist da, die Oberflaeche reicht sie nicht durch.
- Und alles, was er baut, ist eine LANE: `FLEET_SELF_TOKEN` gebacken, taucht im Stapel auf, zaehlt als Lane. Fuer eine Denk-/Scratch-Sitzung ist das mehr Apparat als noetig.

DONE, zwei Teile:
(1) Der Picker reicht einen NAMEN durch: ein optionales Feld neben `⎇ New lane here`; leer gelassen = heutiges Verhalten (auto-benannt), gefuellt = dieser Branchname. Server-seitig ist nichts zu bauen — `branch` wird bereits akzeptiert; die Validierung, die `createWorktree` heute schon fuehrt (Zeichensatz, Kollision mit bestehendem Branch), muss ihre Fehlermeldung sichtbar machen statt sie in einen 400 fallen zu lassen.
(2) Der Knopf ist auch sichtbar, wenn man in einem Worktree steht — er soll dann den TOPLEVEL des Repos als Ziel nehmen, nicht den Worktree (`createWorktree` speichert ohnehin das symlink-aufgeloeste Toplevel, `server.ts:455`). Heute ist das Verstecken kein Schutz, sondern eine Sackgasse.
BEWUSST NICHT Teil dieser Zeile: einen zweiten, lane-losen Baumtyp einfuehren. Das waere ein neues Konzept neben `Slot.worktree` und braucht eine eigene Klaerung — hier geht es nur darum, dass die vorhandene Faehigkeit die Oberflaeche erreicht.

VERIFIKATION: Check gegen `POST /api/slots/:id/open-worktree` mit gesetztem `branch` — der entstehende Worktree traegt GENAU diesen Branchnamen; mit leerem `branch` weiterhin das `fleet/<stamp>-<hex>`-Muster; ein bereits existierender Branchname wird abgelehnt und die Meldung erreicht den Aufrufer. Gegenprobe: der erste Check faellt heute nicht am Server, sondern ist ueber die Oberflaeche gar nicht ausloesbar — deshalb zusaetzlich ein Client-Check, dass das Feld existiert und sein Wert im Request landet. Dazu `bun run build` und die stehende Gate-Kette.

REIHENFOLGE: Dateiflaeche `src/client.ts` (Teil 1+2), Server nur falls die Fehlermeldung nachgebessert werden muss. Kollidiert mit der UI-Kette — seriell nach `21c6eb4b`, Reihenfolge gegenueber `c0a8366b`/`ed4a318c`/`c8e2ddd7` offen. Klein genug, um zwischen zwei groessere zu passen.

FILES: `src/client.ts` (ggf. `server.ts`)
GRUPPE: G-UI
QUELLE: Owner-Vorgabe + Messung durch Session 34 (main), 2026-08-07, Baum 438c326
```

## `55264c21`  ·  kind=lane  ·  angelegt 2026-08-07 17:50  ·  source=owner

- Analyst (Opus-5, 08-08): **ready** — Bounded und suite-prüfbar: ein benannter Einstieg auf der Info-Karte (`#board`), der `showFileView` mit `<slot.cwd>/CLAUDE.md` öffnet und bei fehlender Datei die Absenz meldet — plus Gate-Zeile und ein Check in der passenden `e2e/<family>.ts`; die Grenze ist explizit gezogen („KEIN zweiter Viewer", „NICHT tun: /api/tree um ignorierte Dateien erweitern"). Alle Symbole existieren und die Diagnose st
- Analyst sagt kollidiert mit: e17a19b0, e4f87152, 8235c4bc, dabd1880, fleet/260808114656-6e86
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rulebook] CLAUDE.md vom Board aus in einem Klick öffnen — der Explorer kann sie strukturell nicht zeigen

Problem, gemessen 2026-08-07: das Regelwerk ist auf dem Board ERREICHBAR, aber nicht AUFFINDBAR. Der Picker listet sie (dirEntries filtert nur Dotfiles) und jede Datei-Zeile öffnet den Viewer (src/client.ts:3736 → /api/file?path=…, server.ts:10513); editierbar wäre sie auch, FILE_WRITE_DENY (server.ts:3111) sperrt nur .env|fleet.json|.git. Aber das eine Fenster, das „zeig mir die Dateien dieses Repos" heißt — der Explorer — fragt `git ls-files` (/api/tree, server.ts:10562) und kann eine gitignorierte Datei damit NIE zeigen (Untertitel wörtlich „N tracked", src/client.ts:2048). Im public Repo fehlt sie ohnehin (.gitignore:28). Folge: der Owner findet das wichtigste Steuerdokument seiner Maschine nicht.

DONE heißt: von der Info-Karte aus öffnet ein benannter Einstieg („Rulebook") die CLAUDE.md des gewählten Slots in dem Viewer, den es schon gibt (showFileView, path = <slot.cwd>/CLAUDE.md), inkl. des vorhandenen ✎-Editorpfads; fehlt die Datei, sagt die Fläche das, statt einen toten Klick anzubieten. KEIN zweiter Viewer, kein zweiter Editor — nur ein Eingang zur bestehenden Treppe (die gleiche Regel, die openExplorer in src/client.ts:2036-2038 für sich notiert).
NICHT tun: /api/tree um ignorierte Dateien erweitern — dann stünde .env in derselben Liste.
VERIFY: bun e2e/pins.ts && bunx tsc (Gate-Zeile) && bun run build && ./e2e-claude-gate.sh; dazu ein Check in der passenden e2e/<family>.ts, der beweist, dass der Einstieg auf <slot.cwd>/CLAUDE.md zeigt und bei fehlender Datei die Absenz meldet. e2e-isolated.sh mitfahren (Lane fasst e2e/ an).

QUELLE: CLAUDE.md-Regelwerk-Session 2026-08-07 (Zeile 06e3189b), Owner-delegiert.
```
