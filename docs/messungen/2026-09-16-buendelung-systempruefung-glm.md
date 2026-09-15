---
frage: Wie Fleet Auftraege aggregiert und buendelt — wo das Zusammenfassen, Zerlegen, Buendeln und Verketten von Arbeit hilft, wo es schadet und was fehlt, geprueft gegen Code und Ledger von der Owner-Aeusserung bis zum Land.
urteil: Die Einzelzeile ist die einzige Form, die heute zuverlaessig landet (312 Lands in 14 Tagen, die schnellen fünf gestern in 10–20 min); Wellen feuern 5-mal in 14 Tagen und tragen, Variantengruppen feuerten nie, und die teuerste Decomposition — die Private-repo-aa-Kartenkette — erzeugte 89 Nachfolgen und 89 Reports ohne einen Land, weil die MAIN-Ablehnung die Lane nie erreichte. Die Ketten- und Halte-Mechanik kennt keinen Adressaten und kein Ende: after-Ziele in geparkten Programmen, Holds ohne Aufhebungsbedingung, Notizen, die zu 98 % offen bleiben. Das kleinste tragende Modell ist die Karte auf der Einzelzeile, Programm-Politik als Freigabe, der Startplan als einzige Rechnung — und Bündelung nur noch dort, wo der Sensor ein echtes Paar sieht.
bereich: [queue, karten, wellen, after, hold, nachfolge, programme, notizen, report-kanaele]
belege: [audit.jsonl (lane_succession, fleet_report_open, task_release, task_wave_dispatch/start/split, variant*, note_verdict, fleet_report_decision_*), fleet.json (Status, hold, card.after, Programme), lane-outcomes.jsonl (312 Lands 14 d), tasks-archive.jsonl, cards-Nummern aus fleet.json, server.ts#releaseTaskForMain #succeedLane #startVariantGroup #deliverFleetReportDecision #tickDispatch, start-plan.ts#rowFacts #after-Check, task-land-waves.ts (Projektion), card-extract.ts#validateCard, private-repo-aa docs/plan/FLEET-REIBUNG.md, docs/plan/nachweise/K1-MAIN-REVIEW.md, Lane-Worktree fleet-260915151443-70a2/docs/plan/nachweise/K1.md]
nicht-gemessen: der laufende Gegenversuch 449c4a03 (Astra xhigh, Sol/Terra-Sub-Agents; dispatched 09-15 21:38, Ergebnis offen); .env und Prozesstabelle (verboten); Server-API (nicht gebraucht); die 21 ungueltigen Karten nicht einzeln gegen ihre Texte gelesen (nur Status); kein Zeitverlauf des Startplans; Helper/Second-host; Produkt-Repos ausser private-repo-aa; Succession-Briefs nur als Anzahl, nicht im Wortlaut; warum die K1-Lane um 15:14 gruendete, der Zeilen-Eintrag a8bbd1af aber erst 17:14 auditiert wurde (main_task/task_release 17:14; erste Nachfolge 17:30 — Diskrepanz benannt, nicht aufgeklaert).
stand: 2026-09-16
---

# Systempruefung Aggregation und Buendelung, 2026-09-16 (GLM)

Orchestratorin Slot 4, pi-zai/glm-5.3/high, read-only gegen den Haupt-Checkout
`/Users/owner/claude-fleet` (Ledger mit python3/rg -uu, kein API-Call, keine Suite). Code gelesen im
eigenen Worktree auf Stand `48c09050`. Vorarbeiten gelesen: queue-wellen-2026-09-06 ·
2026-09-11-queue-bereinigung-register · 2026-09-12-spezifizierung-buendelung-befund ·
2026-09-13-buendelung-live-kontrolle-glm (eigene fruehere Kontrolle) · 2026-09-13-queue-pipeline-system-entwurf ·
2026-09-14-queue-intelligenz-schichten · 2026-09-15-queue-stau-und-orchestrierungs-entscheide ·
2026-09-15-start-plan-stau-schnitt · 2026-09-15-warten-ohne-adressat · 2026-09-15-sichtung-wartende-auftraege.

Leitzahlen des Tages (python3 ueber fleet.json, 2026-09-16 ~01:0x): **96 offene Zeilen** — auftrag 60
(44 pending · 9 queued · 7 sent), notiz 25, richtung 11; Karten der Auftraege: **36 gueltig · 21 ungueltig ·
3 ohne**; **5 gehalten**. (Brief sagte 95/6 sent/2 ohne — Live-Drift um je 1.) Wellen-Sensor heute
(`bun task-land-waves.ts --state fleet.json --default-repo /Users/owner/claude-fleet`):
**52 Wellen, genau 1 Mehrzeiler** (7bcabbfd+84888f35, e2e/tasks.ts+server.ts); Einzelgruende:
flaeche-nur-abgeleitet 13 · kein-program 11 · flaeche-ohne-bereich 10 · keine-flaeche 2 · gate-aenderer 2 ·
ohne Grund (allein bündelfähig, kein Partner) 8.

## 1. Urteil in fuenf Saetzen

1. Die Kette Eingang→Karte→Freigabe→Startplan→Land funktioniert fuer die Einzelzeile messbar gut:
   Median Freigabe→Land 125 min, und fuenf gestern gefilete Zeilen schafften Brief→Report→Land in 10–20 min.
2. Jede Form der CROSS-LANE-Bündelung ist heute Randerscheinung oder Belastung: fuenf Wellen gegen 312
   Lands in 14 Tagen, Variante nie gestartet, die Program-Kartenkette Private-repo-aa lief ~6 h mit 89
   Nachfolgen und 89 Reports ohne einen Land.
3. Das Wetterschaden-Muster ist nicht das Bündeln, sondern das Zerlegen in serielle Karten mit
   Rueckkanaelen, die die Pane-idle brauchen: die MAIN-Ablehnung kam nie an, der Nachfolger startete
   trotzdem (Freigabe ohne Karte), drei weitere Karten wurden per Hold gestoppt — Warten ohne Adressat,
   dreifach gestapelt.
4. Aggregation fehlt dort, wo sie arbeiten wuerde: der Notiz-Kanal schliesst fast nie (278 offen gegen
   5 erledigt, alle Zeit), die sechs Bündel-Notizen von 09-11 sind selbst Dauerzeilen geworden, und 72 %
   der Lands haben keinen messbaren Freigabe-Zeitpunkt — jede Durchsatzrechnung fliegt blind.
5. Das kleinste Modell, das alle Belege tragen: Karte auf der Einzelzeile, Freigabe per Programm-Politik,
   Startplan als einzige Rechnung, Bündelung nur auf Sensor-Signal, Ketten nur mit card.after auf
   existierende, lebende Zeilen — und Decomposition nur noch dort, wo Parallelitaet real ist.

## 2. Befunde, gerankt nach Kosten

**B1 — Private-repo-aa-K1: 89 Nachfolgen, 89 Reports, 0 Lands; die Dokumentation verschrieb die Schleife selbst.**
Beleg (neu; geprueft in warten-ohne-adressat, queue-stau-und-orchestrierungs-entscheide,
sichtung-wartende-auftraege — keines kennt die Private-repo-aa-Zahlen): `python3` ueber audit.jsonl,
Slot 7 ab 09-15 17:14: **lane_succession 89, fleet_report_open 89**, erste Nachfolge 17:30, letzte 21:23
(im Schnitt alle 2,7 min); Slot 13 (K3): 8. Lane-Worktree `fleet-260915151443-70a2` (ggruendet 15:14):
`grep -c "self/succeed" docs/plan/nachweise/K1.md` = **22**, `grep -c "Abschlussprüfung Session"` = **57**
(Nummern bis Session 61), 796 Zeilen, 67 Commits auf dem Branch. K1-MAIN-REVIEW.md: „Ergebnis: nicht
landbar" (laenderabhaengiger Kern widerspricht Owner-Richtung). Kostet: ~6 h Slotbetrieb plus 89
Session-Boots und Reports ohne Land; drei Nachfolger-Karten (K4/K5/K6a) blockiert. Kleinster Schnitt:
`server.ts#succeedLane` kennt `s.laneSuccessions` — ein Deckel (z. B. 10) plus genau eine Attention an die
MAIN bricht die Schleife beim zehnten Uebergang, ohne die Migration-Mechanik anzutasten.

**B2 — Der Report-Rueckkanal faellt erst mal ins Leere: 134 unzustellbare gegen 33 zugestellte Entscheidungen in 14 Tagen.**
Beleg (Zahl neu; Mechanik angrenzend bekannt aus queue-intelligenz §3 „Reports fluechtig"): `python3`
ueber audit.jsonl, 14 d: **fleet_report_decision_undelivered 134 · fleet_report_decision_delivered 33**.
Code: `server.ts#deliverFleetReportDecision` (server.ts:8456) — Zustellung verlangt besetzte, erreichbare
Pane (`canDeliver`), sonst „undelivered". Kostet: MAIN-Entscheide — im Private-repo-aa-Fall die Ablehnung —
erreichen Lanes unzuverlaessig; die Lane laeuft weiter und verschwendet Kontingent. Kleinster Schnitt: die
Entscheidung zusaetzlich als Note auf die Zeilen/den Slot schreiben und beim naechsten Fleet-Event
zustellen; Pane-Paste bleibt Bonus, nicht Bedingung.

**B3 — Die MAIN-Freigabe fragt keine Karte: K3 startete 13 min nach dem Filen, NACH stand nur im Text.**
Beleg (neu; geprueft in 2026-09-13-Entwurf Stufe 4/5 und sichtung — dort nicht): fleet.json: 1da3b56c
(K3) **card null**, Text enthaelt wortlich „NACH: a8bbd1af"; audit.jsonl: `main_task` und `task_release`
1da3b56c beide 09-15 17:27, while a8bbd1af (K1) `sent`, nicht done. Code: `server.ts#releaseTaskForMain`
(9712–9830) enthaelt „card" genau einmal, in einem Kommentar — kein Kartentor; `start-plan.ts:405`
`after: strings(src.card?.after)` — after-Tatsachen kommen NUR aus der Karte. FLEET-REIBUNG.md
bestaetigt: „K3 startete nach self-Release in Slot 13 vor K1-Land trotz NACH/after". Kostet: verfruehter
Start einer grossen Zeile auf abgelehntem Vertrag; Kompensation = 3 Holds (task_hold 17:29–17:31). Kleinster
Schnitt: die MAIN-Tuer verlangt eine gelesene Karte mit `after` (wie die card-valid-Politik es fuer den
Tick schon tut), bevor sie released — ein Tor im Bracket der existierenden Tuer.

**B4 — Halten ohne Aufhebungsbedingung: 5 gehaltene Zeilen, Lift nur durch einen expliziten MAIN-Akt.**
Beleg (Instanz neu; geprueft in sichtung — dort Holds nur als Snapshot-Fakt): python3 ueber fleet.json:
**hold auf f3ca2e05, d02fd2bd, f68d27d7 (K4), d61133e3 (K5), e49b91bf (K6a)**, gehalten von MAIN Slot 5/9
am 09-14/09-15; `audit.jsonl task_hold`: 19 in 14 d. Code: einziger Lifter ist `releaseTaskForMain`
(4) „this door lifts the hold" — kein Tick, keine Frist, kein Sensor (der Stau-Sensor 80f61ed8 ist selbst
pending). Kostet: drei gestapelte Private-repo-aa-Karten warten auf eine MAIN-Aufmerksamkeit, die nichts weckt.
Kleinster Schnitt: Hold traegt eine Bedingung (Vorgänger done / Datum); abgelaufene Holds werden als
Attention sichtbar — nicht automatisch freigegeben.

**B5 — after auf nie endende Ziele: ad3b3960 wartet auf 32fed872, pending im Programm auf Eis.**
Beleg (Klasse aus warten-ohne-adressat bekannt — fehlendes Ziel; Instanz geparktes Programm neu): fleet.json:
ad3b3960 [pending], card.after [32fed872]; 32fed872 [pending] in Program 9ce08219 (Private-repo-j, Owner 09-11:
„bleibt auf Eis"). Code: `start-plan.ts` after-Check `input.statuses[id] !== "done"` — pending gilt ewig
als „nicht fertig", und die Zeile traegt keine Note, weil ihr Ziel existiert. Kostet: eine dauerhaft
blockierte Zeile, unsichtbar. Kleinster Schnitt: after-Ziel in einem Program ohne lebende MAIN /
COMPLETE-Status → benannte Note plus MAIN-Attention (dieselbe Form wie `waiting: after … not landed`).

**B6 — Variantengruppen: seit Bau null Starts, ueber alle Zeiten.**
Beleg (neu; in keiner Vorarbeitung gemessen — sichtung kennt nur die Deckelluecke 4b02bd09): `python3`
ueber audit.jsonl, alle Zeiten: **Events mit Praefix `variant` = 0**. Code: `server.ts#startVariantGroup`
(12380–12470) samt Task.variants-Verdrahtung und Checks. Kostet: gepinnte, nie gefeuerte Maschinerie;
jede kuenftige Aenderung am Dispatch zahlt Wartung fuer einen toten Pfad. Kleinster Schnitt: Streichliste
(§4) — oder der Owner nennt den ersten echten Anwendungsfall, bevor weiter investiert wird.

**B7 — Wellen: 5 in 14 Tagen gegen 312 Lands; eine nach 3 min gesplittet; heute 1 von 52 bündelbar.**
Beleg: `python3` ueber audit.jsonl, 14 d: **task_wave_dispatch 3 · task_wave_start 2 · task_wave_split 1**
(Split 09-14 18:34, Grund: Clarification „MAIN sagt Nicht bauen; Owner-Entscheidung");
`lane-outcomes.jsonl`: **312 landed**. Alle 5 Wellen-Lanes landeten (18e87e67 · b2f439fe, sessionMs 420 min ·
a672a626, 139 min · 7ed73694, Wave-Start 18:31 → Land 19:16 · 66df05b4, 81 min), Ersparnis laut
audit-detail „saves" zusammen **~11,9 ks Mutex** in 14 Tagen. Kostet/Nutzen: die Ersparnis ist real, aber
1,6 % der Lands; der Split zeigt die Grenze — eine Entscheidung, die nur der Owner treffen kann, sprengt
die Welle sofort. Und die Bündel-Vorbedingungen haben sich seit 09-13 nicht bewegt (flaeche-ohne-bereich
10 · abgeleitet 13 · kein-program 11). Kleinster Schnitt: kein weiterer Ausbau der Bündel-Vorbedingungen;
die Welle bleibt fuer echte Paare (Sensor entscheidet).

**B8 — Notiz-Kanal schliesst nichts: 278 offen gegen 5 erledigt, alle Zeit; die sechs Bündel-Notizen sind selbst Dauerzeilen.**
Beleg (14-d-Fassung bekannt aus queue-intelligenz §3: 196/5; All-time-Zahl und Bündel-Notiz-Status neu):
`python3` ueber audit.jsonl, alle Zeiten: **note_verdict offen 278 · erledigt 5**; fleet.json:
**df55f6c2, ba7df947, 24bff40e, c104ba1d, 58f61b33, 9238013d alle pending** — die am 09-11 als
Aggregation gefileten Bündel warten seit fuenf Tagen auf Verarbeitung. Kostet: die Bündelung der Befunde
hat die Queue um sechs Dauerzeilen VERMEHRT statt Arbeit zu bündeln; ihr Inhalt lebt im Register-Doc, die
Zeilen haben keinen Leser. Kleinster Schnitt: Bündel-Notizen muessen bei Annahme entweder Auftraege
ableiten oder archiviert werden — „notiz pending" ist ein Endzustand ohne Ende (§3d).

**B9 — 72 % der Lands ohne messbaren Freigabe-Zeitpunkt.**
Beleg (Luecke benannt im 09-13-Entwurf nicht-gemessen; hier quantifiziert): Join lane-outcomes.jsonl ×
audit.jsonl task_release, 14 d: **81 mit / 226 von 312 gelandeten Lanes ohne task_release-Ereignis**
(Owner-Knopf auditiert nicht; kein `releasedAt`-Feld auf der Zeile). Kostet: die Kernfrage „wie lange
wartet freigegebene Arbeit" ist fuer drei Viertel der Lands unbeantwortbar. Kleinster Schnitt:
`releaseTask` schreibt `releasedAt` auf die Zeile; state.sh zaehlt den Median.

**B10 — Invalid-Karten verharren: 21 offene Auftraege mit ungueltiger Karte, 3 ganz ohne.**
Beleg: python3 ueber fleet.json (Zahl oben). Mechanik bekannt und unveraendert (eigene Kontrolle
2026-09-13 C7-2: `server.ts#cardDue` liest nur bei Validator-Bump oder bewegtem Brief erneut;
`CARD_MAX_ATTEMPTS` zaehlt nur Transportfehler). K3 (B3) ist der erste Fall, wo eine FEHLENDE Karte
nicht nur Bündelung, sondern eine Start-Abhaengigkeit kostete. Kleinster Schnitt: B3 deckt den Startfall;
fuer die 21 ungueltigen gilt weiter E1 (Karten-Vertrag) aus queue-intelligenz.

**B11 — Hub server.ts weiter in 36 von 60 offenen Auftraegen genannt — aber der Stau hat die Ursache gewechselt.**
Beleg: python3 ueber fleet.json (Flaechen aus card.surface + surface): **server.ts 36 · e2e/tasks.ts 10 ·
AGENTS.md 9**. Bekannt aus queue-stau-und-orchestrierungs-entscheide §2; NEU ist der Zustand NACH dem
c2-Schnitt (start-plan-stau-schnitt, gelandet — `start-plan.ts` claims nur noch auf bekannten Ranges):
die heutigen Einzelgruende sind Flaeche/Programm (B7-Zahlen), nicht Kollision. Der Deckel 3 wirkt nicht
mehr als 1; der Engpass ist die Bereichs-Abdeckung der Karten. Kleinster Schnitt: keiner zusaetzlich —
c2 wirkt; die Bereichs-Abdeckung ist E1/S2-Arbeit, keine neue Regel.

## 3. Antworten auf a–e

**a) Welche Form fuehrte zu Lands, welche nur zu Wartezeit?** (14 d, Zaehlungen wie oben)
- **Einzelzeile:** 312 Lands; 81 messbar Freigabe→Land: **Median 125 min, p90 857 min, max 1 848 min**;
  die fuenf Einzel-Auftraege von gestern: d9ff7057 18 min · fd0b88b4 20 · 1d0e3b46 19 · 2f03b832 17 ·
  1e3cbf54 10 (task_dispatch→self_land_start, audit.jsonl). sessionMs-Median aller gelandeten Lanes 93 min
  (n=238). Die Form, die traegt.
- **Welle:** 5 Starts, 5 Landungen (B7) — hilft (Mutex-Ersparnis ~11,9 ks), Randerscheinung (1,6 %).
- **after-Kette:** gemischt: 10 after-Zeilen done, 11 offen; offene zerfallen in satisfizierbare
  (Ziel done: a1610fd7, 80f61ed8), auf sent-Vorgaenger wartende (Private-repo-aa K4–K6a) und nie endende (B5).
  after allein erzeugt heute mehr Wartezeit als Lands — die Erfolge (10) liefen ueber kurze Ketten mit
  lebenden Zielen.
- **Variantengruppe:** 0 Starts, 0 Lands, nie (B6). Nur Wartung.
- **Program-Karte (Private-repo-aa):** 0 Lands; 2 sent (davon 1 verfrueht, B3), 3 held; 89+8 Nachfolgen. In
  dieser Messung die teuerste Form: reine Warte- und Schleifenzeit.

**b) Wo kostet das Zerlegen mehr Koordination, als Parallelitaet bringt?**
Drei belegte Stellen: (1) Private-repo-aa: die K-Kette kaufte NULL Parallelitaet — K3 startete verfrueht auf
abgelehntem Vertrag, K4–K6a sind seriell gestapelt und gehalten; die Koordination (89 Reports, 89
Nachfolgen, 1 MAIN-Review, 3 Holds) stieg linear mit der Kartenzahl. (2) Hub-Dateien: 36 Zeilen nennen
server.ts — Zerlegung in Karten erzeugt keine Parallelitaet, solange die Flaechen ohne Ranges auf
derselben Datei landen (B11, bekannt). (3) Nachfolge als Dauerzustand: 98 lane_succession in 14 Tagen,
davon 97 auf zwei Private-repo-aa-Slots — die Session-Grenze (Kontext-Hygiene) wurde zur Kostenquelle, weil
kein Deckel existiert (B1). Umgekehrt kauft Zerlegung etwas, wo Flaechen disjunkt sind — genau das ist
der Gegenversuch 449c4a03 (EIN Auftrag, Sub-Agents IN der Session): Ergebnis offen, aber die Hypothese
„bündeln in der Session statt ueber Lanes" ist mit B1–B3 konsistent.

**c) Wo fehlt Aggregation, die Arbeit sparen wuerde?**
(1) Notizen: 278 offen / 5 erledigt — der Kanal hat keine Senke (B8). (2) Die sechs Bündel-Notizen sind
selbst zu wartenden Zeilen geworden statt Quellen von Auftraegen (B8). (3) Release-Sensorik: 72 % der
Lands ohne Freigabe-Zeitpunkt (B9) — ohne diese Zahl kann niemand aggregieren, was eigentlich parallel
ging. (4) Dubletten: die bekannte Dublette (0d3a5b76/f58d0112, queue-stau §4) ist geschlossen — kein
offener Fall gefunden; das Duplikat-Risiko bleibt eine Filendisziplin, kein Sensor. (5) reports
fleet_report_open je Slot (14 d): Slot 7 → 102, Slot 1 → 67, Slot 3 → 52, Slot 4 → 45 — ein Aggregator,
der „mehr als N Reports ohne Land je Slot" als Attention feuert, haette B1 beim fuenften Report beendet.

**d) Zustaende, die nie enden koennen — je mit dem Code-Symbol, das sie erlaubt:**
1. after auf pending-Ziel ohne Aussicht (`start-plan.ts#after-Check`, statuses!==done; Instanz B5).
2. Hold ohne Aufhebungsbedingung (`server.ts#releaseTaskForMain` (4) — einziger Lifter ist ein
   freiwilliger MAIN-Akt; Instanz B4).
3. Ungueltige Karte, nie wieder gelesen (`server.ts#cardDue`; 21 Zeilen, B10 — bekannte C7-2).
4. Notiz pending ohne Verarbeitung (kein Leser-Pfad; 25 notiz + 11 richtung, B8).
5. Report-Entscheidung unzustellbar (`server.ts#deliverFleetReportDecision` + canDeliver; 134 Faelle, B2).
6. Nachfolge ohne Deckel (`server.ts#succeedLane` zaehlt `s.laneSuccessions`, niemand liest es; B1).
7. Programmlose Zeilen buendeln nie (`task-land-waves.ts#classify` kein-program; 11 Zeilen — bekannte C7-3).

**e) Kleinste Modell der Arbeitsorganisation, das die Belege tragen — und was dafuer gestrichen wird.**
Modell: **Eine Zeile, eine Karte, eine Lane, ein Land.** Eingang als Karte (Pflichtformat), Freigabe per
Programm-Politik (card-valid), Startplan als einzige Rechnung (after, Kollision, Deckel, Welle in einem
Projektor — gebaut, funktioniert), Land durch die MAIN. Bündelung NUR auf Sensor-Signal (echtes Paar:
Fläche + Programm + Range), Ketten NUR mit card.after auf existierende, lebende Zeilen, Decomposition nur
bei disjunkten Flaechen — sonst EIN Auftrag mit interner Delegation (449c4a03 testet genau das). Kein
Warten ohne Adressat: jede Warte-Note nennt einen Empfaenger, der davon erfaehrt (Attention), jeder Hold
eine Bedingung, jede Nachfolge einen Deckel. **Dafuer streichen:** siehe §4.

## 4. Streichliste (Vorschlaege an den Owner, propose nicht promote)

1. **Variantengruppen-Mechanik** (`server.ts#startVariantGroup`, Task.variants, zugehoerige Checks):
   0 Nutzungen seit Bau. Entfernen oder einfrieren; ein Wiedereinstieg braucht einen benannten Fall.
2. **Bündel-Notiz als Form**: keine notiz-Zeile mehr als Bündel-Träger — Bündel leben im Program
   (Doku/Auftrag), nicht als Queue-Zeile ohne Leser. Die sechs offenen Bündel-Notizen: je Ableitung in
   Auftraege oder Archiv (Inhalt steht im Register-Doc).
3. **Weiterer Ausbau der Bündel-Vorbedingungen** (Budget, Bestätigungs-Ketten): stoppen, bis die
   Bereichs-Abdeckung der Karten steigt — der Sensor sagt seit Tagen dieselben 3 Gruende (13/11/10).
4. **Pane-idle als zwingende Bedingung fuer Entscheidungs-Zustellung**: ersetzen durch Note+Event
   (B2-Schnitt); das Paste bleibt Bonus.
5. **Nicht streichen**: Startplan, card-valid-Politik, Wellen-Tuer (fuer echte Paare), task-waves.ts
   (Sicht), die Karte selbst — alle haben in dieser Messung geliefert oder kosten nichts.

## 5. Was ich NICHT geprueft habe

- Den Gegenversuch 449c4a03 (laeuft; ausdruecklich nicht bewertet, nur als Hypothese eingeordnet).
- Die 21 ungueltigen und 36 gueltigen Karten nicht einzeln gegen ihre Zeilentexte gelesen (Status-Zaehlung
  aus fleet.json; Stichprosenlogik steht in der eigenen Kontrolle vom 09-13).
- .env, Prozesstabelle, Server-API, Suiten (verboten bzw. nicht gebraucht); Helper/Second-host.
- Kein Zeitverlauf des Startplans (zustaendslos, wie im c2-Schnitt benannt); wie lange die 9 queued-Zeilen
  heute schon warten (B9-Luecke gilt weiter).
- private-repo-aa nur die drei genannten Docs plus Lane-Worktree-K1.md gelesen; weder Code des Produkts
  noch die K1-Tests.
- Die Diskrepanz Lane-Gruendung 15:14 (Branchname) gegen Zeilen-Audit 17:14 (main_task/task_release
  a8bbd1af) offen gelassen — beide Zeitstempel benannt, keine Erklaerung behauptet.
- Zahlen-Herkunft: alle Befehle stehen bei den Befunden; nichts aus Erinnerung, nichts aus den Vorarbeiten
  uebernommen ohne eigene Zaehlung.
