---
frage: Welche System-1.5-Schnitte tragen die Datenschichten des Fleets heute, und wo laeuft die Schnittlinie?
urteil: "Drei Schnitte tragen: Report-Erfuellungsurteil (Eingabe 384/393 = 97,71 %, Klasse B vom Vertragstext benannt, 113 menschliche Urteile mit 10 Negativen), Rot-Audit-Schatten (Herkunft 187/187 = 100 %, geschlossenes Vierer-Enum, aber nur 7/24 = 29,2 % gelabelt) und Queue-Kind (325/325 Zeilen mit Text, aber 2 Label-Akte im Fenster). Alle drei fehlen am LABEL, keiner an der Eingabe. Startwellen, Kartenlesung, Lane-Zwillinge, Empfaenger und Verify-Proportion fallen unter die Linie."
bereich: [system15, auswertung, jev, datenschichten]
welle: system15-2026-09-22
quelle: main@034f127d (Code) + ~/fleet-extract/2026-09-22-datenschichten/ (Auszug, Stand 2026-09-22T19:45:17.471+02:00)
marken: {V: von dieser Notiz am Auszug oder Code neu gerechnet, A: Ableitung, Z: zitierte Vorarbeit ohne Nachrechnung}
belege: [server.ts#ADJUDICATION_VERDICTS, server/types.ts#TASK_KINDS, server.ts#decideFleetReport, start-plan.ts#projectStartPlan, card-extract.ts#validateCard, server.ts#clarificationReceiverFor, verify-proportion.ts#verificationProportionFor, server.ts#HELPER_ARTIFACT_KEEP]
nicht-gemessen: siehe §N
stand: 2026-09-22
---

# Auswertung der Analyse-Welle System 1.5 — Rangliste der Schnitte

Auswerter ist Opus 5; die drei Bereichsnotizen DS, ES und DQ stammen von Astra (GPT-6) mit
Sol-Subagenten. Jede `[S]`- und `[A]`-Zahl, die hier ueber der Schnittlinie steht, ist am Auszug
oder am Code NEU GERECHNET und traegt `[V]` dieser Notiz — nicht das `[V]` der Bereichsnotiz.
Fenster ueberall `2026-09-15T00:00:00+02:00` bis `2026-09-22T19:45:17.471+02:00` (7,82 Tage).
Hausregel ist `docs/jev.md` §5: Code baut die legalen Optionen, Jev waehlt darunter, jede harte
Regel bleibt Skript, nie ein Gate ueber einem LLM.

## §0 Urteil

| Id | Befund | Kosten |
|---|---|---|
| AW-U1 | Drei Schnitte ueber der Linie, sieben darunter. Kein Schnitt scheitert an der EINGABE; alle drei ueber der Linie scheitern heute am LABEL [V] | Ein Bau vor dem Label misst nichts: Schwellen kommen laut `docs/jev.md` §5 aus eigenen Labels. |
| AW-U2 | Der Report-Schnitt ist der einzige, dessen Datenklasse der Vertragstext DIREKT als B benennt ("Lane-Reports nach Entfernen von Tokens, Hosts, Namen") [V an `2026-09-21-jev-vertragstexte-gelesen.md` §3] | Bei den anderen beiden ist B eine ABLEITUNG unter der Bedingung einer noch nicht gebauten Redigierung. |
| AW-U3 | 155/268 (57,8 %) Report-Urteile im Fenster sind die REGEL `accepted-by-land: landed`, kein menschliches Urteil [V] | Die brauchbare Labelmenge ist 113, nicht 268; der Negativanteil ist 10/113 (8,8 %), nicht 10/268 (3,7 %). |
| AW-U4 | Die Behauptung "keine Negativklasse" aus `2026-09-21-jev-ideen-stand.md` §4 gilt im Fenster NICHT: 8/10 Ablehnungen nennen einen Mangel oder eine Belegluecke, je gelesen [V] | Wer sie fortschreibt, verwirft den einzigen Schnitt, dessen Label heute Varianz hat. |
| AW-U5 | Der Startwellen-Schnitt faellt NICHT an seiner Idee, sondern daran, dass seine Eingabeschicht in DS gar keine Join-Quote hat: der Snapshot traegt 0/335 Lane-Identitaetsschluessel und 0/110 Task-Bezuege [V] | Die Rangliste der Primaerquellen (§4, Platz 3) haelt an diesem Schnitt fest; diese Notiz widerspricht ihr, siehe §3 W6. |

Die Schnittlinie ist eine DATEN-Linie, keine Ideen-Linie. Ein Schnitt kommt darueber, wenn seine
Eingabeschicht ab 09-15 mindestens 95 % Join-Quote traegt, sein Optionsbauer als Symbol existiert
oder in einem Satz baubar ist, seine Datenklasse A oder B ist und seine Label-Quelle benannt ist;
bei einer TEXT-Eingabe muss zusaetzlich eine DQ-Guetezahl danebenstehen. [A]

## §1 Rangliste mit Schnittlinie

### Ueber der Linie

| # | Schnitt | Eingabeschicht + Join-Quote ab 09-15 | Optionsbauer als Symbol | Jev-Form | bleibt Skript | Klasse | Label-Quelle | kleinster naechster Schritt mit pruefbarem DONE |
|---|---|---|---|---|---|---|---|---|
| R1 | **Report belegt/erfuellt** — typisiert, ob ein `complete`-Report sein DONE belegt | `fleet-reports.jsonl#open.taskId` → Task/Archiv **384/393 (97,71 %)** [V]; Textguete: `ALL PASS` **271/393 (69,0 %)**, SHA-Vorfahr **124/393 (31,6 %)** [V] | **ja** — `server.ts:10217#decideFleetReport` mit `accepted \| rejected` | **Noul-Batterie** (nennt ein konkretes Ergebnis? nennt eine pruefbare Evidenz? nennt eine offene Grenze?), nie ein Score | Empfaengerautoritaet, Zurueckweisung, Land-Sperre, die Annahme selbst | **B** — vom Vertragstext direkt benannt, nach Entfernen von Tokens/Hosts/Namen | `decision.reason` der 113 MENSCHLICHEN Urteile im Fenster (103 accept + 10 reject), 8/10 Ablehnungen nennen einen Mangel [V] | In jeden Annahmegrund ein fuehrendes `ERFUELLT: ja\|teilweise\|nein` gegen das Karten-DONE (heute 3/258 [V]). **DONE:** 50 Reports mit `ERFUELLT`-Token, davon ≥10 `teilweise\|nein`, mechanisch am Ledger zaehlbar. |
| R2 | **Rot-Audit-Schatten** — sortiert ein rotes Audit vor | `post-land-audits.jsonl#covers.mainAfter` → Git-Landnote **187/193 (96,89 %)**, nur `claude-fleet` **187/187 (100 %)** [V]; LABEL-Join dagegen `→ audit-adjudications.jsonl#auditAt` nur **7/24 (29,2 %)** [V] | **ja** — `server.ts:24552#ADJUDICATION_VERDICTS` = `real \| flake \| stale-test \| unknowable` | **Choice** ueber genau diese vier plus Enthaltung; kein fuenfter Ausgang, kein `green` | Ergebnis, Rotstatus, Carry-Flake-Regel, finale Adjudikation | **C roh → B** nach Redigierung von `out`/`fails` (Pfade, Hostnamen); die Redigierung ist Teil des Schritts | neuestes Owner-Urteil; im Fenster 8 Adjudikationen mit allen vier Klassen: real 3, flake 3, unknowable 1, stale-test 1 [V] | Logs ROTER Audits von der Artefakt-Pruning ausnehmen (`server.ts:24869#HELPER_ARTIFACT_KEEP`, Default 30 [V]) und die 404-Klasse ohne Helfer-Upload mitschreiben. **DONE:** 60 rote Audits mit lesbaren Log-Bytes UND Urteil — bei 3,07 roten Audits/Tag [V] rund 20 Tage vorwaerts. |
| R3 | **Queue-Kind** — empfiehlt das Kind einer neu eingegangenen Zeile | `fleet.json#tasks` ∪ `tasks-archive.jsonl#task`: **325/325 (100 %)** neue Zeilen tragen Text [V]; Kartenbezug `cards.jsonl#taskId` **348/350 (99,43 %)** [V]; Textguete: Karten `valid` **199/350 (56,9 %)**, DONE-Signal **285/350 (81,4 %)** [V] | **ja** — `server/types.ts:1202#TASK_KINDS` = `auftrag \| richtung \| notiz \| betrieb` | **Choice** ueber die vier plus eine eigene Anwesenheits-Noul fuer "keins davon" | Promotion, Dispatch, das geschriebene Kind, jede Owner-Aenderung | **gemischt**: `auftrag` 273/325 (84,0 %) → B nach Redaktion; `richtung` traegt Owner-Worte im Original → **C**, faellt aus dem Schnitt | `audit.jsonl#task_kind.detail`: **13 Akte gesamt, 2 im Fenster**, beide `auftrag→notiz`, beide per ID joinbar [V] | Das Kind bei der ANLAGE und den korrigierenden Akt als eingefrorenes Paar schreiben (heute steht nur der spaetere Zustand). **DONE:** 30 Korrekturakte mit beiden Richtungen (`→auftrag` und `auftrag→`), am Ledger zaehlbar. |

--- **SCHNITTLINIE** — darunter fehlt mindestens eine der vier Bedingungen; die Spalte "warum darunter" nennt welche. --- [A]

### Unter der Linie

| # | Schnitt | Eingabeschicht + Join-Quote ab 09-15 | Optionsbauer als Symbol | Jev-Form | bleibt Skript | Klasse | Label-Quelle | warum darunter · kleinster naechster Schritt mit pruefbarem DONE |
|---|---|---|---|---|---|---|---|---|
| R4 | **Startwellen priorisieren** unter bereits legalen `now`-Wellen | `fleet.json#tasks,slots,programs` — **KEINE DS-Join-Quote**; `state-snapshots.jsonl` traegt 0/335 Lane-Identitaetsschluessel und 0/110 Task-Bezuege [V] | **teilweise** — `start-plan.ts:361#projectStartPlan` liefert je Welle `next`; ein Filter `waves.filter(w => w.next === "now")` ist in einem Satz baubar, ist aber die PROJEKTION, nicht die Live-Menge aus `tickDispatch` | Choice ueber die `now`-Wellen | `after`, Release, Kollision, Repo-/Program-Caps, Master-Stop, Fallback-Reihenfolge | C | **keine** — kein vorab definiertes Wartezeit-/Kollisionsziel, kein Gegenfaktum fuer nicht gewaehlte Wellen | **Eingabe + Label.** Der Zustands-Schnappschuss je Tick aus `2026-09-22-jev-treiber-schatten-label.md` §e ist genau die fehlende Schicht. **DONE:** ein Tag echter Ticks mit eingefrorener `now`-Optionsmenge je Entscheidung, gegen die spaetere Wartezeit joinbar. |
| R5 | **Kartenlesung** — die ganze Karte aus einem Brief | `cards.jsonl#taskId` → Task/Archiv **348/350 (99,43 %)** [V] | **nein fuer die Gesamtkarte** — `card-extract.ts:210#validateCard` prueft eine FREIE strukturierte Ausgabe; die Felder `ziel/done/verify` sind Freitext, kein Optionsraum | — | Typ-, Pfad-, Symbol- und Verify-Pruefung, Release | C roh → B nach Redaktion | Validator fuer die Form, Diff/DONE fuer den Inhalt | **Optionsbauer.** Freitext ist laut `docs/jev.md` §5 und der Anbieterdoku ausdruecklich keine Jev-Aufgabe; die pruefbare Haelfte ist bereits DETERMINISTISCH (`validateCard`), und wo ein Fakt existiert, fragt niemand ein Modell. **Kein naechster Schritt** — der Schnitt ist gegenstandslos, nicht vertagt. |
| R6 | **Lane-Zwillinge** — done/stalled/spent semantisch trennen | `state-snapshots.jsonl#lanes[]` traegt nur `{s, alive, idleS, ahead, dirty, merge}`: **0/335 (0 %)** mit `branch`, `openedAt`, `taskId` oder `id` [V] | **nein** — `lane-signals.ts:142#laneWatchSignal` baut deterministische Signale, kein semantisches Quartett | Noul-Batterie (nach dem Identitaetsfix) | `done/stalled/spent`, Close- und Land-Regeln | C, Pane ausdruecklich ausgeschlossen | **keine** — eingefrorener Brief + Diff + belegter Bericht + unabhaengiges DONE-Urteil existieren nicht als Paar | **Eingabe.** Ohne stabilen Identitaetsschluessel im Messpunkt ist ein Outcome-Join wegen Slot-Recycling kein Beweis. **DONE:** `branch` + `openedAt` im Snapshot-Lane-Element, danach Outcome-Join ≥95 % ueber 7 Tage. |
| R7 | **Empfaenger einer Richtung/Notiz** typisieren | Richtungen 8, Notizen 44 im Fenster; Datum 8/8 bzw. 42/44; Rollenempfaenger DQ 13/44, eigene Regex 4/44 [V] — regexabhaengig, siehe §3 W4 | **nein** vermessen | Choice ueber Rollen | Zeit-, ID- und Regex-Pruefung | **C** — Richtungen tragen Owner-Worte im Original (Owner-Zitat-Muster 8/8) | **keine** benannt; DQ nennt die Handlesung, kein gespeichertes Label | **Klasse UND Label.** Klasse C ist ohne ZDR ein hartes Tor, nicht eine Guetefrage. **Kein naechster Schritt vor einer Owner-Freigabe je Korpus.** |
| R8 | **Empfaenger fuer Report/Event waehlen** | `fleet.json#programs,watches,slots` — historischer Routenjoin unknown | **nein** — `server.ts:9084#clarificationReceiverFor` ermittelt GENAU EINE Route oder verweigert | — | Bindung, Berechtigung, Liveness, Zustellbudget | C | exakte Occupant-Bindung + Zustellquittung | **Optionsbauer.** Das sind Autoritaetsrechte, keine gleichwertigen Empfaenger; ein Modell wuerde Autoritaet erfinden. Primaerquellen §4 Platz 4 und ES-K4 sagen dasselbe [Z]. **Kein naechster Schritt.** |
| R9 | **Verify-Proportion waehlen** | Git-Pfade → `classifiedAs`; historischer Diffjoin nicht gemessen | **ja, deterministisch** — `verify-proportion.ts:88#verificationProportionFor` | — | die gesamte Verify-Auswahl einschliesslich unbekannter Pfade | C interne Pfade | Pfadregel und Compiler/Suite | **Hausregel.** Eine Luecke in der Tabelle ist absichtlich `conservative-default`; ein Modell koennte hier nur eine harte Regel SCHWAECHEN, und das Land-Gate faehrt dieselbe Klassifikation. **Kein naechster Schritt.** |
| R10 | **Taskprofil am Lane-Outcome / Snapshot-Belegbarkeit / Nutzung** (DS-K1, DS-K3, DQ-K3) | Lane-Outcome → Task **204/211 (96,68 %)** [V]; Snapshot → Task **0/110 (0 %)** [Z DS-J9] | **kein Optionsbauer** — und keine Entscheidung definiert | — | Entpacken, ID-Join, Zaehler | C | keine Qualitaets- oder Entscheidungslabels | **Es gibt keine Entscheidung.** Das sind Mess- und Belegflaechen, keine Schnitte; sie gehoeren in die Eingabe von R1–R3, nicht in die Rangliste. |

## §2 Die Zahlen ueber der Linie, neu gerechnet

Jede Zeile: Behauptung der Bereichsnotiz → eigener Lauf am Auszug (§R) oder am Baum `034f127d`.

| Behauptung (Quelle) | dort | hier neu gerechnet | Verdikt |
|---|---|---|---|
| Report-Open-Zeilen im Fenster (DQ-Q1, ES-K8) | 393 | **393** | gleich [V] |
| Report → Task/Archiv (DS-J5) | 384/393 (97,71 %), 9 ohne Schluessel | **384/393**, 9 ohne `taskId` | gleich [V] |
| Reports mit Decision (ES-K8, ES §0) | 268/393 (68,2 %) | **268/393**; 258 accepted, 10 rejected | gleich [V] |
| davon Regel `accepted-by-land` | nicht im Fenster gemessen | **155/268 (57,8 %)**; occupant 215, owner 43 | NEU [V], siehe AW-U3 |
| Report-Text `ALL PASS` (DQ-Q1) | 271/393 (69,0 %) | **271/393** | gleich [V] |
| Report-Text SHA-Vorfahr von `52ce60df` (DQ-Q1) | 124/393 (31,6 %) | **124/393**, alle 124 ueber einen EINDEUTIGEN Praefix aufgeloest | gleich [V] |
| Report-Textlaenge (DQ-Q1) | min 241 · Median 2.322 · max 3.999 | **241 · 2.322 · 3.999** | gleich [V] |
| Report-Text explizite Offen-Zeile (DQ-Q1) | 277/393 (70,5 %) | **299/393 (76,1 %)** nach der woertlich beschriebenen Regel | ABWEICHUNG, §3 W1 [V] |
| Kartenpruefungen im Fenster (DQ-Q2, ES-K6) | 350 | **350**; Quelle `model` 206, `format` 144 | gleich [V] |
| Karte → Task/Archiv (DS-J10, ES-K6) | 348/350 (99,43 %) | **348/350** | gleich [V] |
| Karten `valid:true` (DQ-Q2) | 199/350 (56,9 %) | **199/350** | gleich [V] |
| Karten DONE-Signal (DQ-Q2) | 285/350 (81,4 %) | **285/350** — Regel unabhaengig nachgebaut | gleich [V] |
| Lane-Outcome → Task/Archiv (DS-J1) | 204/211 (96,68 %), 7 ohne Schluessel | **204/211**, 7 ohne `taskId` | gleich [V], §3 W2 |
| Neue Queue-Zeilen und Kinds (ES-K2) | 325; auftrag 273 (84,0 %), notiz 44, richtung 8, betrieb 0; Text 325/325 | **325; 273 / 44 / 8 / 0; 325/325** | gleich [V] |
| `task_kind`-Akte im Fenster (ES-K2) | 2/2 joinbar, beide `auftrag→notiz` | **2/2**, `5278d2fb` und `80f61ed8`, beide heute `notiz` | gleich [V], §3 W5 |
| Rote Audits → Adjudikation (ES-K1) | 7/24 (29,2 %) | **7/24**; Fensterbestand green 144 / red 24 / unknown 7 | gleich [V] |
| Audit `covers.mainAfter` → Landnote (DS-J3/J4) | 187/193 (96,89 %) bzw. 187/187 (100 %) | **187/193** bzw. **187/187**; die 6 ungeloesten alle `private-repo-aa` | gleich [V] |
| Lane-Messpunkte ohne Identitaetsschluessel (ES §0) | 0/335 (0 %) | **0/335**; Schluessel exakt `{s, alive, idleS, ahead, dirty, merge}` | gleich [V] |
| Richtungen/Notizen im Fenster (DQ-Q3/Q4) | 8 bzw. 44; Datum 8/8 bzw. 42/44 | **8 bzw. 44; 8/8 bzw. 42/44** | gleich [V] |
| Rollenempfaenger in Notizen (DQ-Q4, DQ-K2) | 13/44 (29,5 %) | **4/44** mit eigener Regex; Adressat in Richtungen **7/8** wie dort | regexabhaengig, §3 W4 [V] |
| Optionsbauer-Symbole (ES-K1/K2/K3/K5/K6, DS-K) | als existierend benannt | alle sieben am Baum `034f127d` gefunden, Zeilen in §1 | gleich [V] |

Von 20 nachgerechneten Behauptungen halten **18 exakt**, eine weicht ab (W1) und eine ist
regexabhaengig (W4). Das ist der Cross-Model-Befund: die Bereichsnotizen sind belastbar, und die
beiden Abweichungen liegen beide in derselben Klasse — Textsignale mit selbstgebauter Regex. [A]

## §3 Widerspruchstabelle

| Id | Stelle A | Stelle B | Was hier gemessen wurde | Kosten |
|---|---|---|---|---|
| W1 | DQ-Q1: "explizite Offen-Zeile 277/393 (70,5 %)" | DQ §2 beschreibt die Regel als "beginnt eine Zeile mit `offen\|open\|unresolved\|missing\|ausstehend\|remaining\|left`" | Die woertliche Regel gibt **299/393**; case-sensitive gibt 0; keine gepruefte Variante trifft 277 (naechste: 276 ohne `open`, 274 mit Doppelpunkt/Leerzeichen, 270 auf die letzten 600 Zeichen) [V] | Eines von vier Report-Textsignalen ist aus der Notiz nicht reproduzierbar. `ALL PASS` und die SHA-Quote — die beiden, die R1 traegt — stimmen exakt. |
| W2 | DS-J1: Nenner 211 Lane-Outcomes ab 09-15 | roher Zeilenzaehler des Fensters: 212 | **Aufgeloest zugunsten DS:** die 212. Zeile (`b0a8ddc1…`, 2026-09-22T11:26:20) traegt `origin: "main-direct"` und faellt unter DS-J2, nicht DS-J1 [V] | Kein Fehler, aber eine Falle: wer `lane-outcomes.jsonl` ungefiltert zaehlt, bekommt einen anderen Nenner als DS. |
| W3 | `2026-09-21-jev-ideen-stand.md` §4: "alle 12 Ablehnungsgruende lauten sinngemaess ueberholt — keiner sagt Ziel verfehlt" | ES §0: "9/14 Rejects (64,3 %) verlangen Mangel-/Belegkorrekturen; die alte Behauptung ist fuer diesen Auszug widerlegt" | **ES hat recht.** Alle 10 Ablehnungen des Fensters gelesen: 8 nennen einen Mangel oder eine Belegluecke ("verfehlt Done", "K1 NICHT fertig", "Noch nicht abnahmefaehig", "Ownerkonformitaet fehlt", "Integrationsblocker", "ZURUECK, 2 Punkte", "3 Korrekturen"), 1 ist eine Variantenwahl, 1 ein nachgereichtes Belegurteil [V] | Wer die alte Zeile fortschreibt, verwirft R1 — den einzigen Schnitt mit Vertrags-Klasse B und einer Negativklasse. |
| W4 | DQ-Q4/DQ-K2: Rollenempfaenger in Notizen 13/44 (29,5 %) | eigene Regex dieser Notiz: 4/44 | Die Populationen (44) und das Datumssignal (42/44) stimmen exakt; nur die Empfaenger-Regex divergiert, und DQ druckt ihren Ausdruck nicht ab [V] | Kein Widerspruch in der Sache, aber die Zahl ist nicht uebertragbar: R7 haengt ohnehin an Klasse C, nicht an dieser Quote. |
| W5 | ES-K2 nennt die Label-Schicht `audit.jsonl#task_kind.detail` | der Auszug: `audit.jsonl` enthaelt **0** `task_kind`-Zeilen | Alle 13 Akte liegen in `audit.jsonl.1` (8) und `audit.jsonl.archive` (5); die 2 des Fensters beide in `.1` [V] | Wer dem Zeiger folgt, findet eine LEERE Schicht und schliesst auf "kein Label". Das ist derselbe Rotationsbefund wie DS-U3 (`readLedger` erreicht 41.760/83.338 Archivzeilen nicht [Z]) — hier trifft er eine Labelquelle. |
| W6 | Primaerquellen §4 setzt "Unter bereits legalen Startwellen priorisieren" auf Platz 3 UEBER die Linie | ES-K3: Optionsbauer "teilweise", historischer Optionsjoin "unknown"; DS: keine Join-Quote fuer diese Eingabeschicht | Diese Notiz setzt den Schnitt **unter** die Linie [A] | Die Primaerquellen-Rangliste ordnet nach QUELLENDECKUNG (traegt der Anbieter die Form?), diese nach DATEN. Beide Antworten sind richtig auf ihre Frage; nur die zweite darf einen Bau ausloesen. |
| W7 | DS-K, ES-K und DQ-K klassifizieren durchweg "C roh, B nach Redigierung" | `2026-09-21-jev-vertragstexte-gelesen.md` §3 nennt "Lane-Reports nach Entfernen von Tokens, Hosts, Namen" ausdruecklich als **B** | Nur R1 hat damit eine Klasse aus dem VERTRAGSTEXT; R2 und R3 haben eine ABGELEITETE [V/A] | Ohne die Trennung sieht die Klassenspalte aller drei gleich aus, obwohl bei zwei von ihnen die Redigierung noch gebaut werden muss. |
| W8 | ES-K4/K5 und Primaerquellen §4 Platz 4/5 | — | Beide setzen Empfaenger-Routing und Verify-Proportion unter die Linie, aus derselben Begruendung [Z] | Keine Kosten: eine Uebereinstimmung ueber zwei Modelle hinweg, hier nur als Gegenprobe vermerkt. |

## §4 Was die drei Schnitte konkret entscheiden

**R1 · Report belegt/erfuellt.** Jev bekommt den redigierten Reporttext und die Karte der Zeile und
beantwortet drei unabhaengige Nouls ueber demselben State: nennt der Text ein konkretes Ergebnis,
nennt er eine pruefbare Evidenz, nennt er eine offene Grenze. Code kombiniert, Code schwellt, die
Annahme bleibt beim Empfaenger. Die Erfuellung selbst wird NICHT gefragt: sie ist ein Urteil gegen
das DONE, und dafuer fehlt heute das Label — das liefert erst der `ERFUELLT`-Token. `ALL PASS`
(271/393) und die SHA-Vorfahr-Quote (124/393) bleiben deterministische Vorfilter, keine Fragen. [A]

**R2 · Rot-Audit-Schatten.** Eine Choice ueber `real | flake | stale-test | unknowable` plus
Enthaltung, NACH dem Audit, ohne Einfluss auf dessen Ergebnis oder den roten Status. Das Enum ist
serverseitig validiert; ein fuenfter Ausgang ist strukturell unmoeglich. Der Blocker ist nicht die
Form, sondern der Korpus: 7 Label im Fenster, und aus der Vergangenheit ist er nicht beschaffbar
(42/43 adjudizierte Rot-Audits ohne Log-Bytes [Z `2026-09-21-jev-ideen-stand.md` §2]). Der Schritt
ist Retention-Arbeit am Audit-Pfad und gehoert dem Fleet-Betrieb, nicht einem Jev-Program. [A]

**R3 · Queue-Kind.** Eine Choice ueber vier Werte, deren Optionsmenge seit `TASK_KINDS` geschlossen
ist, plus eine Anwesenheits-Noul fuer "keins davon" — ohne sie muesste die Choice einen Wert nennen,
auch wenn keiner passt. Der Schnitt gilt nur fuer `auftrag` und `notiz`: eine `richtung` traegt
Owner-Worte im Original und ist Klasse C. Der Blocker ist die Labelmenge: 2 Akte im Fenster, beide
in derselben Richtung, und der Zeiger auf ihre Schicht ist irrefuehrend (W5). [A]

## §N Nicht gemessen

- **Kein Jev- oder TypeSafe-Aufruf, keine Guete-, Latenz- oder Kostenmessung.** Die Formangaben in
  der Spalte "Jev-Form" sind Ableitungen aus `docs/jev.md` §5 und den Primaerquellen, keine
  gemessene Eignung. Eine Klasse-A-Einstufung vergibt diese Notiz fuer keinen Korpus: die
  oeffentliche Verfuegbarkeit wurde nicht geprobt.
- **Klasse B ist bei R2 und R3 eine BEDINGUNG, kein Zustand.** Die Redigierung, die aus `out`/`fails`
  bzw. aus Zeilentext Klasse B macht, existiert nicht als Code und wurde hier nicht gebaut. Nur R1
  hat eine Klasse, die der Vertragstext direkt benennt — und auch dort ist die Redigierung ungebaut.
- **Die Rangfolge R1 > R2 > R3 ordnet nach LABELLAGE**, nicht nach Nutzen, Aufwand oder Risiko:
  R1 hat 113 menschliche Urteile mit 10 Negativen, R2 hat 7 Label mit vier Klassen, R3 hat 2 Akte in
  einer Richtung. Eine Nutzen- oder Kostenordnung wurde nicht erhoben.
- **Die 8/10-Lesung der Ablehnungsgruende (W3) ist eine Handlesung dieser Notiz**, auf die ersten
  150 Zeichen je Grund. Zwei Faelle sind strittig: ein nachgereichtes Belegurteil und eine
  Variantenwahl. Die 250 Annahmegruende wurden nicht gelesen.
- **Keine Zustellungs-, Lese- oder Wirkungsmessung.** Ob ein Label je gelesen wurde, steht in keiner
  gemessenen Schicht; DQ-N4 zeigt, dass die GET-Tuer kein Leseereignis schreibt [Z].
- **Kein Startplan-Replay, kein Live-Lauf, keine Pane, keine Transkripte.** `fleet.json` und `.env`
  des Haupt-Checkouts wurden nicht geoeffnet; gelesen wurde ausschliesslich der Auszug.
- **Die DS/ES/DQ-Zahlen UNTER der Linie sind zitiert, nicht nachgerechnet** ([Z]) — das war die
  Auftragsgrenze. Wer einen Schnitt von unten nach oben holen will, rechnet seine Zahlen zuerst nach.
- **Codebasis dieser Notiz ist `034f127d`**; die Bereichsnotizen lasen `c07427ce` (DS, ES) und
  `52ce60df` (DQ). Die SHA-Vorfahr-Probe wurde bewusst gegen `52ce60df` gefahren, um DQ zu
  reproduzieren; gegen `034f127d` waere sie eine andere Messung.

## §R Reproduktion

Den Block als `recheck.py` speichern und aus einem Checkout mit `034f127d` und dem gepinnten
Notes-Objekt `654173c2` ausfuehren: `python3 recheck.py ~/fleet-extract/2026-09-22-datenschichten/`.
Nur Standardbibliothek und Git, keine Fleet-API, kein Schreiben im Auszug, keine Rohtexte in der
Ausgabe. Jede `[V]`-Zahl in §1–§3 kommt aus diesem einen Lauf; `git rev-list 52ce60df` liefert die
Vorfahrenmenge der SHA-Probe. Symbolbelege: `git show 034f127d:<Datei> | nl -ba`.

```python
import json, re, sys, subprocess, collections
root = sys.argv[1].rstrip("/") + "/"
W0, END = 1789423200000, 1790099117471          # 2026-09-15T00:00+02:00 .. Auszugsmaximum
rows = lambda f: (json.loads(l) for l in open(root + f, encoding="utf-8") if l.strip())
state = json.load(open(root + "fleet.json"))
tasks = {}
for r in rows("tasks-archive.jsonl"):
    t = r.get("task") or {}
    if t.get("id"): tasks[t["id"]] = t
for t in state.get("tasks", []):
    if t.get("id"): tasks[t["id"]] = t            # lebende Zeile gewinnt gegen Archiv
ids, out = set(tasks), {}
# R1 · Reports
fr = list(rows("fleet-reports.jsonl"))
op = [r for r in fr if r.get("kind") == "open" and r.get("at", 0) >= W0]
out["opens"] = len(op)
out["open->task"] = [sum(1 for r in op if r.get("taskId") in ids), len(op)]
oid = {r["id"] for r in op}
dec = [r for r in fr if r.get("kind") == "decision" and r.get("id") in oid]
out["decisions"] = [len(dec), len(op)]
out["disposition"] = collections.Counter(r.get("disposition") for r in dec)
out["regel_accepted_by_land"] = sum(1 for r in dec if (r.get("reason") or "").startswith("accepted-by-land"))
out["erfuellt_token"] = sum(1 for r in dec if "ERFUELLT" in (r.get("reason") or "").upper())
out["ALL PASS"] = [sum(1 for r in op if "ALL PASS" in (r.get("text") or "")), len(op)]
rx = re.compile(r"^(offen|open|unresolved|missing|ausstehend|remaining|left)", re.I | re.M)
out["offen_woertliche_regel"] = [sum(1 for r in op if rx.search(r.get("text") or "")), len(op)]
L = sorted(len(r.get("text") or "") for r in op); out["laenge"] = [L[0], L[len(L) // 2], L[-1]]
anc = set(subprocess.run(["git", "rev-list", "52ce60dff05dd7be71a29772cea3e26fcef84644"],
                         capture_output=True, text=True).stdout.split())
pre = {}
for h in anc:
    for k in range(7, 41): pre.setdefault(h[:k], set()).add(h)
tok = re.compile(r"\b[0-9a-f]{7,40}\b")
out["sha_vorfahr"] = [sum(1 for r in op if any(t in pre for t in tok.findall(r.get("text") or ""))), len(op)]
# R2 · Audits
aud = [r for r in rows("post-land-audits.jsonl") if r.get("at", 0) >= W0]
red = [r for r in aud if r.get("result") == "red"]
adj = {r.get("auditAt") for r in rows("audit-adjudications.jsonl")}
out["audit_result"] = collections.Counter(r.get("result") for r in aud)
out["rot->adjudikation"] = [sum(1 for r in red if r.get("at") in adj), len(red)]
out["verdikte"] = collections.Counter(r.get("verdict") for r in rows("audit-adjudications.jsonl") if r.get("at", 0) >= W0)
tree = set(subprocess.run(["git", "ls-tree", "-r", "--name-only", "654173c21b41ac9bd4ee89cb0e9d06cb3d7ef1d8"],
                          capture_output=True, text=True).stdout.replace("/", "").split())
cov = [(r, c) for r in aud for c in (r.get("covers") or []) if isinstance(c, dict)]
out["covers->landnote"] = [sum(1 for _, c in cov if c.get("mainAfter") in tree), len(cov)]
fleetcov = [(r, c) for r, c in cov if (r.get("repo") or "").endswith("claude-fleet")]
out["covers->landnote_fleet"] = [sum(1 for _, c in fleetcov if c.get("mainAfter") in tree), len(fleetcov)]
# R3 · Queue-Kinds und Karten
new = [t for t in tasks.values() if (t.get("created") or 0) >= W0]
out["neue_zeilen"] = [len(new), sum(1 for t in new if (t.get("text") or "").strip())]
out["kinds"] = collections.Counter(t.get("kind") for t in new)
tk = [r for f in ("audit.jsonl", "audit.jsonl.1", "audit.jsonl.archive") for r in rows(f) if r.get("event") == "task_kind"]
out["task_kind"] = [len(tk), sum(1 for r in tk if r.get("ts", 0) >= W0),
                    sum(1 for r in tk if r.get("ts", 0) >= W0 and (r.get("detail") or "").split(":")[0] in ids)]
cards = [r for r in rows("cards.jsonl") if r.get("at", 0) >= W0]
out["karten"] = len(cards)
out["karte->task"] = [sum(1 for r in cards if r.get("taskId") in ids), len(cards)]
out["karte_valid"] = [sum(1 for r in cards if r.get("valid") is True), len(cards)]
def done(r):
    if r.get("source") == "model":
        a = r.get("answer")
        if not isinstance(a, str): return False
        m = re.search(r"\{.*\}", a, re.S)
        try: j = json.loads(a) if a.strip().startswith("{") else (json.loads(m.group(0)) if m else None)
        except Exception: return False
        d = ((j or {}).get("card") or {}).get("done")
        return isinstance(d, str) and d.strip() and "\n" not in d and "\r" not in d
    t = tasks.get(r.get("taskId")) or {}
    h = [l for l in (t.get("text") or "").splitlines() if l.startswith("DONE:")]
    return len(h) == 1 and h[0][5:].strip() != ""
out["karte_done"] = [sum(1 for r in cards if done(r)), len(cards)]
# R4/R6 · Lane-Outcomes und Snapshot-Messpunkte
lo = [r for r in rows("lane-outcomes.jsonl") if r.get("ts", 0) >= W0 and r.get("origin") != "main-direct"]
out["lane->task"] = [sum(1 for r in lo if r.get("taskId") in ids), len(lo), sum(1 for r in lo if not r.get("taskId"))]
lanes = [l for r in rows("state-snapshots.jsonl") if r.get("ts", 0) >= W0 for l in (r.get("lanes") or [])]
out["snapshot_lanes"] = [len(lanes), sum(1 for l in lanes if any(k in l for k in ("branch", "openedAt", "taskId", "id")))]
out["snapshot_keys"] = sorted({k for l in lanes for k in l})
print(json.dumps(out, indent=1, ensure_ascii=False, default=str))
```
