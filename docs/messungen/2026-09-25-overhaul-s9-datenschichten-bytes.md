---
frage: Was kostet jede Route, jeder Ledger und jede Ausgabe des Fleet an Bytes pro Aufruf mal Aufrufen pro Tag, und welcher Leser liest davon welche Felder?
urteil: Der 2-Sekunden-Poll ist die ganze Rechnung; von seinen 120 366 B sind 34 168 B Zeilen, die kein Renderer zeichnet (112 terminale Tasks, 68 abgeschlossene Programs), und die zweitgroesste Schicht ist kein Netz, sondern Agenten-Kontext (3 318 B feste Huelle je Brief, 78 904 B state.sh+register.sh je MAIN-Gruendung)
bereich: [datenschichten, poll, briefe, ledger]
belege:
  - server.ts#taskDigest
  - server.ts#programDigest
  - src/pollplan.ts#pollPlan
  - src/client.ts#qClosed
  - server.ts#laneDossier
  - server/persist.ts#readLedger
  - server/persist.ts#coalescedSaver
  - docs/data-saver.md
  - docs/messungen/2026-09-25-overhaul-kern-5-datenschichten.md
nicht-gemessen: Aufrufe pro Tag fuer jede Owner-Token-Route (kein Zugriffslog, /api/transport ist owner-gated), also auch die Zahl sichtbarer Dashboard-Tabs heute; die Aufteilung der 36 520 B, die der Live-Poll ueber den nachgebauten Teil hinaus traegt (Slots samt live abgeleiteten Feldern), auf ihre einzelnen Felder; Schreibfrequenz von fleet.json.
stand: 2026-09-25
---

# Was Datenschichten und Antworten im Fleet pro Tag kosten

2026-09-25, Lane `fleet/260925144008-4944`, Slot 22. Frage: **Welche Route, welcher Ledger und
welche Ausgabe kostet wie viele Bytes pro Aufruf mal Aufrufen pro Tag, wer liest sie, und welche
Felder liest dieser Leser nachweislich?**

Anlass ist der Owner-Nachtrag vom 25.09. (`docs/overhaul-plan-2026-09-25.md` §0b): „Aber genauso
ist es wichtig das dwir Datenschichten und auch sonstige Responses vom Fleet System usw, schmalern
und effizienter gestalten."

## 0. Drei Waehrungen, und warum sie nicht addiert werden

Die Schnittliste in §5 ist nach Bytes pro Tag gerankt, wie beauftragt. Sie fuehrt aber eine Spalte
**Waehrung**, weil drei verschiedene Dinge gespart werden und ein Summenstrich darueber falsch
waere:

- **Netz** — Bytes ueber die Leitung an einen Browser. Der Server komprimiert (gemessen: `Vary:
  accept-encoding`, `Content-Encoding: gzip`, 4 392 B → 1 525 B auf `/api/self/memory?view=sources`),
  also zaehlt fuer diese Waehrung die **gzip**-Zahl, nicht die rohe.
- **Agenten-Kontext** — Bytes, die in das Kontextfenster einer Session laufen (Briefe,
  `state.sh`/`register.sh`, `ctl.sh`). Hier gibt es keine Kompression; jedes Byte ist ein Token.
  Diese Waehrung ist in Bytes pro Tag klein und in Wirkung gross, und die Rangliste unterschaetzt
  sie systematisch.
- **Platte** — Bytes, die je Aufruf gelesen oder geschrieben werden, ohne je ein Netz zu sehen.

---

## 1. Routen: Bytes pro Aufruf

Gemessen mit dem Self-Token dieser Lane, `curl -s -o /dev/null -w '%{size_download}'`, unkomprimiert
(ohne `--compressed`). Owner-Token-Routen antworten dieser Lane 401 und sind als **UNGEMESSEN**
gefuehrt — ihr Koerper ist in §2 stattdessen aus dem Live-Zustand nachgebaut.

| Route | Bytes/Aufruf | Aufrufe/Tag | Leser | Welche Felder nachweislich |
|---|---|---|---|---|
| `/api/self` | **311** | UNGEMESSEN | Session selbst | ganze Zeile (13 Schluessel), Zweck laut `CLAUDE.md` §Self-scheduling |
| `/api/self/gate` | **1 521** | UNGEMESSEN | Lane vor dem Verify | `verify.cmd/timeoutMs/waitMs/skipExit`, `rulebookDrifted`, `suiteLock` |
| `/api/self/drift` | **561** | ~31/Tag (`self_drift` in `audit.jsonl`, 214 in 7 T) | Lane vor dem Done-Report | `wouldConflict`, `behind`, `dirty` |
| `/api/self/memory?view=work` | **1 709** | UNGEMESSEN | Session | Task-Status, `hold.grund`, Land-/Audit-Zustand |
| `/api/self/memory?view=sources` | **4 392** (gzip **1 525**) | UNGEMESSEN | Session | deklarierte vs. gelieferte Kontext-Refs |
| `/api/self/memory?view=evidence` | **1 441** | UNGEMESSEN | Session | Reports und Lands der Task |
| `/api/self/memory?view=observations` | **1 738** | UNGEMESSEN | Session | `state-snapshots.jsonl` |
| `/api/self/program-execution` | 86 (409 fuer eine Lane) | — | nur MAIN | — |
| `/api/sessions` | **120 366** roh / **21 883** gzip (Owner-Token, Gegenprobe der MAIN); von dieser Lane nachgebaut ≥ **83 846** roh / ≥ **17 027** gzip | **43 200 je dauerhaft sichtbarem Tab** | Browser-Board; `refresh()` | s. §2 |
| `/api/state`, `/api/programs`, `/api/tasks`, `/api/audit`, `/api/lane-outcomes`, `/api/post-land-audits`, `/api/prompts`, `/api/context-receipts`, `/api/deploys`, `/api/transport`, `/api/errors`, `/api/events` | **UNGEMESSEN** (401 fuer eine Lane) | UNGEMESSEN | Board, `state.sh`, `ctl.sh get` | — |
| `/api/lane?branch=…` | UNGEMESSEN (401) | UNGEMESSEN | Board-Lupe (`src/client.ts:16143`), nie gepollt | s. §3 (Lesekosten) |

**Die 43 200.** `src/pollplan.ts#pollPlan` gibt `pollMs: 2_000` fuer einen sichtbaren Tab,
`10_000` im Sparmodus und **`0`** fuer einen versteckten — `armPolls` (`src/client.ts:10007-10013`)
armt danach. 86 400 s / 2 s = 43 200 Antworten pro Tag und **pro dauerhaft sichtbarem Tab**. Wie
viele sichtbare Tab-Stunden dieser Tag wirklich hatte, ist **nicht gemessen**: der Zaehler, der es
sagen koennte (`GET /api/transport`), ist owner-gated. Die letzte Messung dazu ist
`docs/data-saver.md` §2, 2026-08-07: **1,01 sichtbare Tabs**, versteckte Tabs 0.

---

## 2. `/api/sessions` — der Koerper, aus dem Live-Zustand nachgebaut

**Methode und ihre Grenze.** Die Route antwortet dieser Lane 401. Der Koerper ist deshalb aus
`/Users/owner/claude-fleet/fleet.json` **nachgebaut**, feldweise nach `server.ts#taskDigest`,
`server.ts#programDigest` und der echten, importierten `src/opsevents.ts#opsPollRow`. Dasselbe
Verfahren hat `server.ts` (Kommentar ueber `publicProgram`) am 2026-09-05 schon einmal benutzt.
Nicht nachgebaut sind die **live abgeleiteten** Slot-Felder (`git`, `ctx`, `agent`, `stalled`,
`autoCloseRefusal`, `inboundToday`, …) und die vier aus `taskView`/Karte stammenden Digest-Felder
(`files`, `filesOrigin`, `cluster`, `size`). Alle Zahlen unten sind daher **Untergrenzen**.

**Gegenprobe mit dem Owner-Token (2026-09-25 ~15:2x, durch die empfangende MAIN, nicht durch diese
Lane).** Die Live-Antwort misst **120 366 B roh / 21 883 B gzip**. Die Untergrenze haelt: die
nachgebauten 83 846 B sind 69,7 % davon, die uebrigen **36 520 B** sind `slots` samt den live
abgeleiteten Feldern, die dieser Lane verschlossen sind. Das Budget von 14 336 B, gegen das
`e2e/tasks.ts` eine Fixture misst, wird live also um das **8,4-fache** ueberschritten, nicht nur um
das 5,8-fache der Untergrenze. Ebenfalls bestaetigt: `streams/prompts.jsonl` 35 447 818 B.

| Teil der Antwort | roh B | gzip B | Anteil roh | Was der Client daraus zeichnet |
|---|---|---|---|---|
| `tasks` (203 Digests) | **51 569** | 9 332 | 61,5 % | die Queue — aber nur die **nicht** terminalen Zeilen (s. u.) |
| `programs` (77 Digests) | **11 135** | 4 312 | 13,3 % | Titel/Status; 9 davon sind `active` |
| `slots` (persistierter Teil, 20) | 15 664 | — | 18,7 % | die Leiste; dazu die live abgeleiteten Felder |
| `watches` (18) | 5 434 | 916 | 6,5 % | „eine armierte Subscription, die niemand SIEHT" — benannter Zweck |
| `events` (130 → 1 sichtbar) | 281 (roh 106 242 ungefiltert) | — | 0,3 % | Ops-Panel; `opsPollVisible` schneidet 129 von 130 weg |
| **Summe der nachgebauten Teile** | **83 846** | **17 027** | | |

**Gegen das eigene Budget.** `e2e/tasks.ts` misst diese Antwort gegen **14 KiB** (14 336 B) und hat
den Fixpunkt am 2026-08-24 zweimal bei 13 033 B und 13 053 B abgelesen. Diese Messung laeuft gegen
eine **Fixture**, nicht gegen den Live-Zustand: live liegt allein der nachgebaute Teil bei 83 846 B,
also beim **5,8-fachen** des Budgets, das die Kommentare in `server.ts` an ~15 Stellen als
Begruendung fuer Feld-Auslassungen zitieren.

### 2.1 Was auf dem Poll steht und kein Renderer zeichnet

- **112 terminale Task-Zeilen (`done` 82, `archived` 30) = 24 366 B roh je Antwort.**
  `src/client.ts#qClosed` (`:11623`) definiert `done || archived`, `qGroupOf` (`:11624`) gibt fuer
  eine solche Zeile **`null`** zurueck, und die Queue zeichnet sie nicht. Sie bleiben im Speicher
  des Clients nur als Nachschlagewerk (`tasksList.find` fuer `variantOf`, Abhaengigkeitszeilen,
  die Archiv-Aktionen `:14196`). Die Volltexte liegen ohnehin schon hinter `GET /api/tasks`.
- **68 abgeschlossene Programs = 9 802 B roh je Antwort.** `programDigest` traegt alle 77; `active`
  sind 9 (1 333 B).
- **`briefReview`** steht im Digest und wird von **keinem** Client gelesen (0 Treffer in
  `src/client.ts`, `src/hub.ts`, `src/share.ts`); der einzige Leser ist `e2e/tasks.ts:8666`. Heute
  kostet es 0 B, weil keine Live-Zeile das Feld traegt — eine latente Zeile, kein Schnitt.

Alle uebrigen Digest-Felder werden nachweislich gelesen (`grep -c '\.<feld>\b' src/client.ts`):
`repo` 87, `files` 37, `programId` 36, `size` 21, `comments` 14, `note` 12, `review` 13,
`filesOrigin` 13, `criterion` 11, `notes` 8, `hold` 7, `variants` 7, `briefAt` 6, `refining` 5,
`touched` 4, `cluster` 4, `verdicts` 4, `refine` 4, `filesProposal` 2.

### 2.2 Marginalkosten je Kandidat

Je Kandidat aus derselben Basis entfernt und neu serialisiert/gzippt. Die Zeilen sind **einzeln**
gemessen und nicht additiv (gzip teilt sich Woerterbuecher).

| Kandidat | roh B/Antwort | gzip B/Antwort |
|---|---|---|
| `tasks` mit `done`/`archived` weglassen | −24 366 | −3 113 |
| `programs` mit `status != active` weglassen | −9 802 | −3 727 |
| `task.touched` weglassen | −7 671 | −2 116 |
| `task.repo` weglassen | −6 231 | −193 |
| `task.note` weglassen | −5 154 | −1 049 |
| `watches` weglassen | −5 434 | −916 |
| `programs` ganz weglassen | −11 133 | −4 189 |

---

## 3. Ledger: Bytes pro Lesung

Gemessen mit einem Nachbau von `server/persist.ts#readLedger` (beide Generationen, `.1` + aktiv)
gegen die Dateien im Haupt-Checkout, Bun 1.3.9, ein Lauf je Datei.

| Ledger | Bytes je Vollesung | Zeilen | Parse ms | Wer liest so, und wie oft |
|---|---|---|---|---|
| `streams/prompts.jsonl` | **35 438 271** | 20 027 | 210 | `laneDossier` (`server.ts:28212`) **ganz, je Aufruf**; `/api/prompts`; `continuity.ts` · Aufrufe/Tag UNGEMESSEN (nicht gepollt, Lupe im Board) |
| `audit.jsonl` (+`.1`) | **6 839 451** | 51 828 | 86 | `laneDossier` ganz je Aufruf; `/api/audit`; `state.sh` |
| `tasks-archive.jsonl` | 6 012 850 | 1 058 | 31 | `register.sh` (6×), `land-quality.ts` |
| `post-land-audits.jsonl` | 3 915 027 | 952 | 19 | `/api/post-land-audits`, Boot, `state.sh` |
| `state-snapshots.jsonl` | 3 306 445 | 4 228 | 18 | nur `/api/self/memory?view=observations` |
| `context-receipts.jsonl` | 2 377 104 | 1 257 | 15 | `/api/context-receipts`, `state.sh`, `briefstats.ts` |
| `fleet-reports.jsonl` | 1 876 168 | 1 197 | 13 | nur `server.ts:3196` (Memory-Historie) |
| `lane-outcomes.jsonl` | 1 730 424 | 1 364 | 29 | ~14 Leser, `/api/lane-outcomes`, `state.sh` |

**Der Dossier-Aufruf.** `GET /api/lane?branch=…` liest **42,3 MB** von Platte und verbringt **296 ms**
im Parsen, um danach nach `p.cwd === worktree` zu filtern. Der Median einer Lane in diesem Journal
ist **2 Prompt-Zeilen**; 1 308 Lane-Verzeichnisse teilen sich 5 823 von 20 027 Zeilen, und die
groesste Einzeladresse (der Haupt-Checkout) haelt allein 10 838. Das Ergebnis ist zusaetzlich bei
`DOSSIER_MAX_ROWS = 200` gedeckelt (`server.ts:28074`). Gelesen wird also das 17 719-fache dessen,
was der Median-Fall zurueckgibt.

**`fleet.json`.** 2 626 485 B, `JSON.stringify` des Zustands 4 ms. Zusammensetzung: `tasks`
1 127 382 B (42,9 %, davon `text` 604 210, `card` 168 315, `comments` 147 262), `programs` 441 300 B
(16,8 %, davon `inbox` 114 851, `intent` 57 231, `decisions` 49 468), `fleetReports` 189 222 B,
`events` 106 242 B, `slots` nur 15 664 B. Jede Sicherung schreibt die ganze Datei neu (tmp+rename)
plus eine `.bak` gleicher Groesse. `server/persist.ts#coalescedSaver` laesst **hoechstens einen**
Schreibvorgang gleichzeitig anstehen, faltet Bursts also zusammen; wie viele Schreibvorgaenge ein
Tag hat, ist damit aus den 85 `saveState()`-Aufrufen **nicht** ableitbar und bleibt UNGEMESSEN.

---

## 4. Ausgaben: Briefe, `state.sh`, `register.sh`, `ctl.sh`

### 4.1 Zustell-Briefe

Gemessen ueber `streams/prompts.jsonl`, Fenster 7 Tage bis 2026-09-25. Ein Gruendungsbrief ist eine
Zeile, die den Rueckweg-Block `--- HOW THIS LANE ENDS` traegt.

| Groesse | Wert |
|---|---|
| Sends gesamt | 4 629 in 7 T = **661/Tag**, 9 126 432 B = **1 303 776 B/Tag** |
| Gruendungsbriefe | 412 in 7 T = **58,9/Tag** |
| je Gruendungsbrief, Mittel | **11 438 B** |
| – Auftrag + Karte + Notizen + Quellauszug | 8 236 B |
| – Ankerblock (`ContextPlan v2 anchors`) | **683 B** |
| – Rueckweg-Block (`HOW THIS LANE ENDS`) | **2 326 B** |
| – Memory-Zeiger (`YOUR MEMORY: GET …`) | **309 B** |
| **feste Huelle zusammen** | **3 318 B = 29,0 % jedes Briefes**, 195 266 B/Tag |

Der Rueckweg-Block hat bei 412 Briefen **92 verschiedene Fassungen**, und **403 von 412** liegen
zwischen 2 336 und 2 395 B; die haeufigste einzelne Fassung steht **147-mal woertlich gleich** da
(2 336 B). Vier Briefe tragen den Marker ohne Block, der groesste Block misst 7 771 B. Der Ankerblock traegt in **223 von 323** Zustellungen
der letzten 7 Tage genau dieselben vier Paket-Ids (`portable-core, verify-e2e, rulebook-generat,
messnotiz-index`), in 32 zusaetzlich `grammatik`, in 68 gar keine (Fremd-Repo). Das bestaetigt K4
§2 an einem zweiten Korpus.

Aus `context-receipts.jsonl`, 7 Tage: 323 Zustellungen, **46,1/Tag**, `deliveredBytes` Summe
3 690 429 B = **527 204 B/Tag**, Median 11 659, p90 16 033, Maximum 30 917. Quellauszug in 153 von
323 (Median 6 978 B), Notizvorschauen in 128 von 323.

### 4.2 Werkzeug-Ausgaben

Gemessen als `./<skript> 2>&1 | wc -c` aus dieser Lane.

| Ausgabe | Bytes je Aufruf | Aufrufe/Tag | Leser |
|---|---|---|---|
| `./register.sh` | **49 087** | UNGEMESSEN | MAIN, Schritt 2 des Gruendungsbriefs |
| `./state.sh` | **29 817** | UNGEMESSEN | MAIN, Schritt 1 |
| `./ctl.sh` (Usage) | 3 025 | UNGEMESSEN | jede Session, die sich den Verb-Satz holt |
| `./ctl.sh audits` | 1 807 | UNGEMESSEN | MAIN |
| `./ctl.sh merges` | 765 | UNGEMESSEN | MAIN, Controller |
| `./ctl.sh get /api/self --keys` | 605 | UNGEMESSEN | jede Session |
| `./ctl.sh lock --json` | 283 | UNGEMESSEN | jede Session vor einer Suite |
| `./ctl.sh lock` | 157 | UNGEMESSEN | dito |
| `./ctl.sh events` / `ctx` / `ctl.sh get` auf Owner-Routen | UNGEMESSEN (Owner-Token) | | |

Die beiden grossen Posten zerlegt in ihre Abschnitte:

| `state.sh` (29 817 B) | B | | `register.sh` (49 087 B) | B |
|---|---|---|---|---|
| `landed since the last handoff` | **12 814** | | `1. the queue — the register` | **22 727** |
| `config sensor` | 4 538 | | `4. docs/*.md open marker` | **14 348** |
| `is the running server the code on disk?` | 3 538 | | `2. collision surface` | 8 971 |
| `land health` | 2 308 | | `3. briefs/ — UNGEPRÜFT` | 1 719 |
| `lanes on disk` | 2 273 | | `5. docs/README.md index drift` | 1 084 |
| `machine hygiene` | 1 837 | | | |
| `Tueren` | 986 | | | |
| Rest (ledgers, hub, HEAD) | 796 | | | |

Der groesste Einzelposten in `state.sh` sind **120 Commit-Subjects** seit dem letzten Handoff; der
Abschnitt `is the running server the code on disk?` besteht zu 27 seiner 29 Zeilen aus
`stray pid …`-Zeilen geleakter Testinstanzen. Eine MAIN-Gruendung liest beide Skripte, also
**78 904 B** allein hierfuer — gegen 21 456 B Lane-Regelbuch und 31 496 B `AGENTS.md` (K4 §1).

---

## 5. Schnittliste, nach Bytes pro Tag

Die Netz-Zeilen sind **je dauerhaft sichtbarem Dashboard-Tab** gerechnet (43 200 Antworten/Tag,
§1). Bei der zuletzt gemessenen Belegung von 1,01 Tabs (2026-08-07) ist das der reale Faktor; wie
viele sichtbare Tab-Stunden heute anfallen, ist UNGEMESSEN, und die Netz-Zeilen skalieren linear
damit. Gespart wird in gzip, weil der Server komprimiert.

| # | Schnitt | Waehrung | B/Aufruf | Aufrufe/Tag | **B/Tag (gzip bzw. roh)** |
|---|---|---|---|---|---|
| 1 | `programs` auf `status === "active"` schneiden (68 von 77 Zeilen) | Netz | 3 727 gzip | 43 200 | **161,0 MB** |
| 2 | `tasks` auf nicht-terminale Zeilen schneiden (112 von 203) | Netz | 3 113 gzip | 43 200 | **134,5 MB** |
| 3 | `task.touched` hinter `GET /api/tasks` legen | Netz | 2 116 gzip | 43 200 | **91,4 MB** |
| 4 | `task.note` hinter `GET /api/tasks` legen | Netz | 1 049 gzip | 43 200 | **45,3 MB** |
| — | **Schnittlinie** | | | | |
| 5 | `watches` hinter eine eigene Route legen | Netz | 916 gzip | 43 200 | 39,6 MB — aber `server.ts` nennt den Zweck ausdruecklich („eine armierte Subscription, die niemand SIEHT"); ein Schnitt hier nimmt eine Sicht weg, die absichtlich mitfaehrt |
| 6 | `prompts.jsonl` fuer `laneDossier` indizieren statt ganz lesen | Platte | 35,4 MB je Aufruf | UNGEMESSEN | Kosten je Aufruf belegt, Aufrufe/Tag nicht — nicht rankbar |
| 7 | feste Brief-Huelle (Anker + Rueckweg + Memory-Zeiger) kuerzen | Agenten-Kontext | 3 318 B | 58,9 | 0,195 MB — in Bytes klein, in Tokens der teuerste Posten je Session |
| 8 | `state.sh` + `register.sh` fuer die MAIN-Gruendung kuerzen | Agenten-Kontext | 78 904 B | UNGEMESSEN | 12 814 B Commit-Subjects und 14 348 B Doc-Marker sind die beiden groessten Bloecke |
| 9 | `task.repo` weglassen | Netz | 193 gzip | 43 200 | 8,3 MB — 6 231 B roh, aber der Wert wiederholt sich und gzip nimmt fast alles; 87 Lesestellen im Client |
| 10 | `briefReview` aus dem Digest nehmen | Netz | 0 heute | 43 200 | 0 — kein Renderer liest es, aber keine Live-Zeile traegt es. Latenz, kein Schnitt |

**Warum die Linie nach 4 liegt.** Die Zeilen 1–4 sparen zusammen rund 432 MB/Tag je sichtbarem Tab
und nehmen dabei **keinem Leser etwas weg**: 1 und 2 schneiden Zeilen, die die Queue nachweislich
nicht zeichnet (`qGroupOf` → `null`), 3 und 4 schneiden Felder, deren Volltext-Geschwister schon
heute hinter `GET /api/tasks` liegen, das die Detail-Ansicht ohnehin holt. Ab Zeile 5 aendert jeder
Schnitt entweder eine benannte Absicht (5), hat keinen messbaren Nenner (6, 8) oder faellt in eine
andere Waehrung (7, 8) — das sind eigene Entscheidungen, keine Fortsetzung dieser.

**Was 1–4 nicht sind.** Sie machen die Antwort nicht klein: die vier Schnitte nehmen zusammen
46 993 B roh weg, von der gemessenen Live-Antwort bleiben also **73 373 B**, immer noch das
5,1-fache des 14-KiB-Budgets. Wer die Antwort wirklich unter ihr eigenes Budget bringen will, muss
an `slots` und die live abgeleiteten Felder — die 36 520 B, die diese Messung nur als Summe kennt.

---

## 6. Abgleich mit der Schnittliste vom 2026-09-07

`docs/schnittliste-kommunikation-datenschichten-2026-09-07.md` hatte vier Posten ueber der Linie.
Stand heute, am Code geprueft:

| Posten | Damals | Heute |
|---|---|---|
| M1 — Owner-Tuer fuer Reports | offen fuer 12 Zeilen vor `7a20eead` | **erledigt und weitergebaut**: `fleet-reports.jsonl` existiert seit 09-14 (1 197 Zeilen, 1,88 MB); `reportsAwaitingOwner` reitet als **eine Zahl** auf dem Poll und wird bei 0 weggelassen |
| M2 — Artefakte und Briefe in `/tmp` | offen | **nicht in dieser Messung geprueft** |
| M3 — aktive Programs mit toten Occupants | offen | Poll traegt nur noch `programDigest` (4 Felder); `programsStale` reitet als eine Zahl und wird bei 0 weggelassen. Die **Zahl der Zeilen** ist geblieben: 77 statt 69, davon 9 aktiv — Posten 1 dieser Liste |
| M4 — Send-Kanal per Paste | offen | **nicht in dieser Messung geprueft** |

Neu gegenueber 09-07 ist die Richtung des Drucks: die Schnittliste von damals mass **Speicherbestand
und Entscheidungswege**, diese hier misst **wiederholte Antworten**. Der teuerste Posten von damals
(`fleet.json`-Bestand) ist heute der zweitteuerste; teurer ist die Wiederholung derselben Bytes
alle zwei Sekunden.

---

## 7. Methode

Alle Kommandos aus dem Lane-Worktree, gegen den Haupt-Checkout
(`$(dirname "$(git rev-parse --git-common-dir)")` = `/Users/owner/claude-fleet`). Gitignorte
Dateien mit `grep`/`python3`/`Bun.file`, nie mit `rg`.

```sh
# Routen, Bytes je Antwort (Self-Token; Owner-Routen antworten 401)
U="$FLEET_SELF_URL"   # in jeder Pane gesetzt; keine Adresse in diese Datei
for p in /api/sessions /api/self /api/self/gate /api/self/drift \
         "/api/self/memory?view=work" "/api/self/memory?view=sources"; do
  printf '%-44s ' "$p"
  curl -s -o /dev/null -w '%{size_download} %{http_code}\n' \
    -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "$U$p"
done

# Kompression: derselbe Koerper mit und ohne Accept-Encoding
curl -s -o /dev/null -w 'plain=%{size_download}\n' -H "Accept-Encoding:" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "$U/api/self/memory?view=sources"
curl -s -o /dev/null -w 'gzip=%{size_download}\n' --compressed \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "$U/api/self/memory?view=sources"

# Werkzeug-Ausgaben
for c in "state.sh" "register.sh" "ctl.sh" "ctl.sh merges" "ctl.sh lock --json"; do
  printf '%-22s ' "$c"; ./$c 2>&1 | wc -c
done
# Abschnitte einer Ausgabe
./state.sh 2>&1 | awk '/^=== /{if(n)printf "%8d  %s\n",b,n; n=$0; b=0; next}
                       {b+=length($0)+1} END{if(n)printf "%8d  %s\n",b,n}' | sort -rn
```

`readLedger`-Nachbau, `taskDigest`/`programDigest`-Nachbau und die Marginalkosten liefen als drei
Bun-Skripte im Session-Scratchpad; ihr Kern steht hier, damit sie wiederholbar sind:

```ts
// Lesekosten je Ledger — server/persist.ts#readLedger, beide Generationen
async function readLedger(file: string) {
  const rows: any[] = []; let bytes = 0;
  for (const f of [`${file}.1`, file]) {
    let text: string; try { text = await Bun.file(f).text(); } catch { continue; }
    bytes += Buffer.byteLength(text);
    for (const line of text.split("\n")) { if (!line) continue;
      try { const r = JSON.parse(line); if (r && typeof r === "object" && !Array.isArray(r)) rows.push(r); } catch {} }
  }
  return { rows, bytes };
}

// Marginalkosten eines Schnitts, roh und gzip, aus derselben Basis
const B  = (x: unknown) => Buffer.byteLength(JSON.stringify(x));
const gz = (x: unknown) => Bun.gzipSync(Buffer.from(JSON.stringify(x))).length;
const base = { tasks: digests, programs: pgDigests, watches: s.watches, slots: s.slots };
const cut  = { ...base, tasks: digests.filter((t: any) => t.status !== "done" && t.status !== "archived") };
console.log(B(base) - B(cut), gz(base) - gz(cut));
```

Die Brief-Zerlegung schneidet jede Zeile von `streams/prompts.jsonl` der letzten 7 Tage an den drei
Markern `ContextPlan v2 anchors`, `--- HOW THIS LANE ENDS` und `YOUR MEMORY: GET` und misst die
vier Stuecke.

---

## 8. Was nicht gemessen wurde

- **Aufrufe pro Tag fuer jede Owner-Token-Route.** Es gibt kein Zugriffslog: `audit.jsonl` haelt
  Ereignisse, keine GETs, und der Zaehler, der es koennte (`GET /api/transport`), ist owner-gated.
  Damit ist auch die heutige Zahl sichtbarer Dashboard-Tabs ungemessen; alle Netz-Zeilen in §5
  sind **pro Tab** gerechnet.
- **Die vollstaendige `/api/sessions`-Antwort.** Die live abgeleiteten Slot-Felder (`git`, `ctx`,
  `agent`, `stalled`, `autoCloseRefusal`, `share`, `inboundToday`) und die vier aus
  `taskView`/Karte stammenden Digest-Felder sind nicht nachgebaut. Alle Zahlen sind Untergrenzen.
- **Schreibfrequenz von `fleet.json`.** `coalescedSaver` faltet Bursts; aus 85 `saveState()`-Stellen
  folgt keine Schreibrate. Ein Zaehler existiert nicht.
- **Latenz.** Gemessen ist Parse-Zeit von Ledgern in einem Bun-Prozess dieser Lane, nicht die
  Antwortzeit des Live-Servers unter Last.
- **WebSocket-Bytes und Terminal-Streams.** `docs/data-saver.md` §1 hat sie 2026-07-26 gemessen
  (96–186 KB/min ueber alle Panes); hier nicht nachgemessen.
- **M2 und M4 der Schnittliste vom 09-07** (`/tmp`-Artefakte, Send-Kanal) — ausserhalb dieser Frage.
- **Die `e2e/tasks.ts`-Budgetprobe selbst.** Ihre Zahlen (13 033 / 13 053 B, 2026-08-24) sind aus
  dem Quellkommentar zitiert, nicht neu gefahren.

---

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-25T14:40:00Z	umfang	Owner-Routen nicht ueber ein Owner-Token messen	Brief VERBOTEN: kein Token aus einer Pane-Kommandozeile	Gruendungsbrief	401 als UNGEMESSEN gefuehrt
2026-09-25T14:46:00Z	methode	/api/sessions aus fleet.json nachbauen statt UNGEMESSEN zu lassen	server.ts nutzt dasselbe Verfahren am 2026-09-05 (publicProgram-Kommentar)	server.ts#publicProgram	83 846 B roh, als Untergrenze benannt
2026-09-25T14:48:00Z	methode	gzip als Spar-Waehrung, nicht roh	Server komprimiert nachweislich (Content-Encoding gzip gemessen)	§1	Marginalkosten doppelt gefuehrt
2026-09-25T14:52:00Z	nenner	Netz-Zeilen je sichtbarem Tab rechnen	kein Zugriffslog; pollPlan gibt 0 fuer versteckte Tabs	src/pollplan.ts#pollPlan	43 200 als Faktor, Tab-Stunden UNGEMESSEN
2026-09-25T14:55:00Z	korrektur	erste ctl.sh-Messung verworfen	`timeout` existiert auf dieser Maschine nicht, 37 B waren die Fehlermeldung	§4.2	neu gemessen ohne timeout
2026-09-25T15:02:00Z	rangliste	Schnittlinie nach Posten 4	1-4 nehmen keinem belegten Leser etwas weg, ab 5 aendert jeder Schnitt eine Absicht oder die Waehrung	§5	4 ueber der Linie, 6 darunter benannt
2026-09-25T15:3xZ	korrektur	Owner-Token-Messung der MAIN in §1/§2/§5 eingesetzt, Untergrenze daneben stehen gelassen	die Notiz fuehrte die Route als UNGEMESSEN, waehrend die Zahl existierte; die Untergrenze bleibt der Beleg, dass der Nachbau traegt	fleet-report 65145e5ad4b4ea86913952b7	120 366 B roh, 8,4-faches Budget statt 5,8-faches
2026-09-25T15:3xZ	korrektur	die Tailscale-Adresse aus dem Methode-Block genommen	Brief VERBOTEN "IPs in die Notiz"; leak-pin sieht eine Datei erst, wenn sie GETRACKT ist, der Lauf vor dem Commit konnte sie nicht fangen	e2e/pins.ts leak-pin	pins wieder ALL PASS
```
