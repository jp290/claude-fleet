# Sanierung beschleunigen — Messung und Vorschlag, 2026-09-02 (14:50)

Fleet Controller Slot 15 (Fable 5.1). Owner-Frage 13:30, woertlich: „das waeren ja zwei Wochen...
Oder wuerde der second-host split das ganze nochmal potenziell stark beschleunigen? Ich glaube
tatsaechlich auch das die Hauptdauer heute von einer reihe an fehlerhaften suites produziert
wurde.. Vllt muessten wir hier nochmal gut nachdenken ob wir den Plan-ablauf oder sonstwas nicht
vielleicht besser strukturieren/optimieren koennen."

Drei read-only Opus-Agenten haben die fuenf Hypothesen aus `HANDOFF.md` §5 gegen Ledger und Code
gemessen. Ihre vollstaendigen Berichte liegen daneben, jede Zahl mit Ableitungskommando:

- `sanierung-beschleunigung-2026-09-02/agent-zeitbudget.md` (+ `zeitbudget.py`) — Mutex-Minuten je Tag × Kategorie
- `sanierung-beschleunigung-2026-09-02/agent-protokoll.md` — Slice-Protokoll Schritt fuer Schritt
- `sanierung-beschleunigung-2026-09-02/agent-second-host.md` — was der Helfer heute verlagern kann

Der Plan gehoert der Sanierungs-MAIN (Slot 12). Dies ist ein VORSCHLAG an sie und den Owner,
keine Planaenderung.

## 0. Ergebnis in fuenf Saetzen

1. **Die Owner-Hypothese traegt nur zu einem Viertel:** rot + Wand-unknown + Reruns sind am 09-02
   22,4 % der Mutex-Zeit (weit gerechnet, jeder Lauf mit ≥1 FAIL: 45,8 %). Der groesste Posten
   ist die **Vorschau in Lanes: 422,8 min = 52,5 %** (18 Laeufe), mehr als das Doppelte aller
   lokalen Audits (265,6 min).
2. **Die Maschine ist voll:** am 09-02 war der Suite-Mutex 841,5 von 851 Minuten belegt (98,9 %).
   Folge: **200 min Gate-WARTEN** bei 21 min Gate-ARBEIT ueber 11 Lands — der Gate ist billig, er
   steht nur Schlange. Zwei Lands sind heute an der 45-min-Wartewand gestorben, ohne den Baum je
   anzusehen (`c09d5f1`, `1b677e58`).
3. **Der Second-host-Split (H1) ist halb wahr, und der wahre Teil kostet nichts:** nur Post-Land-Audit
   und Lane-Vorschau koennen ueberhaupt remote — beides ist gebaut. A1 (`3bb5a5c9` + Grace 60000)
   verlagert bis ~280 min/Tag; `suite-offer` lief heute schon einmal remote. S2–S4 verlagern
   **null** Suite-Minuten. Der Helfer ist EIN serieller Slot; ein **zweites Geraet (0 Code)** ist
   mehr wert als jede der drei Zeilen.
4. **H2 (Vorschau streichen) ist als Regel falsch und als Filter richtig:** fuer einen reinen Move
   ohne Treffer in `e2e/` ist sie redundant (belegt: P4 Slice 1, 3443/0; P3 lief ganz ohne sie);
   fuer jeden Slice, der ein Symbol bewegt, das eines der 12 `e2e/*.ts`-Module per Pfad liest und
   transpiliert (79 Stellen), ist sie der einzige Pre-Land-Beweis — kein Gate faehrt diese Module.
5. **H4 (P5/P6 vorziehen) traegt:** `e2e/pins.ts` serialisiert P4 und P5 seit `e03d44c` nicht mehr
   (die `universe()`-Konstruktion ist genau dagegen gebaut; der einzige Cross-Pin vergleicht
   Wort-Mengen). Was bleibt, ist eine Rebase-Konfliktflaeche in disjunkten Hunks.

## 1. Die Zahlen, die den Vorschlag tragen

| Mutex-Minuten (Union der Trail-Intervalle) | 08-31 | 09-01 | 09-02 (bis 14:40) |
|---|---|---|---|
| Vorschau in Lanes | 311,9 (12) | 745,6 (31) | 422,8 (18) |
| Audit gruen / rot / Wand-unknown | 50,7 / 25,2 / 0 | 51,7 / 105,3 / 15,3 | 141,1 / 65,6 / 58,8 |
| Reruns / Beweislaeufe | 25,2 (1) | 0 | 56,3 (2) |
| Gate-Ketten (3 Suiten-Schritte) | 15,0 | 44,9 | 58,4 |
| **Tagessumme** | **429,6** | **943,6** | **841,5** |
| Gate-Warten (nicht in der Summe) | 0 | 26,8 | **200,2** |
| Auslastung des Fensters | 44 % | 64 % | **98,9 %** |

Zweiter Befund, unabhaengig: die Suite ist am 09-02 **langsamer**, nicht fehlerhafter —
453 → 675 ms/Check bei +3,3 % Checks. Beide Wand-`unknown` des Tages liefen fehlerfrei und wurden
nur gekillt; bei der Rate vom 08-31 waeren sie fertig gewesen. Die Wand stand noch auf 30 min,
weil `64c05bf` (45 min) erst mit dem srv-Restart 04:24 aktiv wurde.

Korrektur der Vorgaengerzaehlung („16 Audits, alle lokal, 326 min"): 16 Zeilen ja, davon 9 lokal
claude-fleet, 3 remote, 4 private-repo-p-Guard (exit 42, 0 ms). Lokaler Mutex 265,6 min.

H5 (die ~0-ms-`unknown`): alle sechs sind private-repo-p-Lands, deren Repo den Fleet-Audit strukturell
nicht faehrt (exit 42 bzw. exit 127 remote) — Rauschen in der Zaehlung, kein Zeitverlust. Dazu eine
siebte Art: ein Audit am 08-31 21:33 hat den Lock **nie bekommen** und starb an der Wand mit
0 gemessenen Checks; im Ledger unsichtbar von „30 min gelaufen".

Slice-Kosten heute, wenn alles gruen laeuft: ~26 (Vorschau) + ~2 (Gate-Arbeit) + ~28 (Audit) =
**~56 min Mutex je Slice**; der Plan budgetiert 15–25. Bei Warten realistisch 60–90 min.

## 2. Vorschlag an Slot 12 — vier Zuege, geordnet nach Minuten/Tag pro Aufwand

Schnittlinie nach Zug 4; alles darunter ist Beobachtung.

1. **A1 landen, Grace 60000, ein Tag messen.** Verlagert bis ~280 min/Tag Audit auf den Helfer
   und damit den groessten Teil der 200 min Gate-Warten. Falsifizierbarer Erfolgstest: in den
   `fleet/land`-Notes des naechsten vollen Tages faellt `verify.waitMs` fuer die Mehrzahl der
   Lands auf nahe 0. Faellt es nicht, war der Mutex nicht der Engpass. Zweiter Teil des Tests
   (GLM): die erste Remote-Audit-Zeile nach dem Daemon-Bootstrap traegt `fails[]` und ein
   `checks.ran` in lokaler Groessenordnung (~3400), nicht `ran:23` aus dem Tail. Und: den Filter
   aus Zug 2 NICHT am selben Mess-Tag einfuehren, sonst ist die Attribution weg. Kosten: eine Zeile
   (`3bb5a5c9`, Slot 1, fertig) + `.env` + Verb 2. **Kein Plan-Eingriff.**
2. **Vorschau (Schritt d) bedingt statt pauschal — als Zeile im Slice-Brief, nicht als Regel.**
   Vor dem Land: fuer jedes Symbol, das die Lane aus `server.ts`/`src/client.ts` herausbewegt,
   `rg -n '<symbol>' e2e/` ausserhalb `e2e/pins.ts`. Null Treffer → Vorschau entfaellt
   (−26 min Mutex). Restrisiko, das der Filter NICHT faengt (GLM §4): `RULE_SPAN` liest nur
   `e2e/pins.ts` selbst, nie die 12 Leser; und die Leser fuehren geschnittene Bloecke AUS
   (`e2e/explorer.ts` baut `new Function(ts.transformSync(fxSrc))`) — eine Laufzeit-Abhaengigkeit,
   deren Name nicht in `e2e/` steht, sieht `rg` nicht. Verstaerkung: ALLE im Hunk definierten
   Bezeichner rg-en, nicht nur das Zielsymbol. Ein
   Treffer → Leser in derselben Lane auf `serverU.span()`/`clientU.span()` umhaengen, dann
   Vorschau fahren. Fuer P4 Slice 1 haette der Filter „entfaellt" gesagt und recht gehabt.
   Widerspruch, benannt: `verify-proportion.ts` empfiehlt bei jeder `e2e/`-Beruehrung
   `isolatedPreview:true` — advisory, kein Gate; keine Code-Aenderung noetig.
3. **(nach GLM §4 unter die Schnittlinie verschoben — kleinster Ertrag, frisst die Rollback-Marge)**
   Betriebsteil von Schritt f buendeln: Dry-Boot/Deploy/Health/pins/graphify nicht je Slice,
   sondern je 2–3 Slices — Deckel drei, weil `undo-land` nur drei tief reicht. Faktisch lief es fuer
   Slice 1 schon so (kein Dry-Boot, kein Deploy). ~10 min je Slice.
4. **Zweites Helfergeraet — Owner-Entscheid, 0 Code** (nach GLM §4 ueber die Schnittlinie gehoben):
   der einzige Fix fuer den groessten Posten (Vorschau 52,5 %), sobald die Audits die eine
   Helfer-Nadel belegen; `helperDevices` ist eine Map, `mainMacbook` war am 09-01 23:17 kurz
   registriert.
5. **P5 als zweite Spur parallel produzieren, seriell landen — erst NACH dem Mess-Tag von Zug 1.** Reihenfolge innerhalb P5 drehen:
   `ui.ts`, Pane, Picker, Klein-Dialoge zuerst (billig, beweisen die Spur ohne Mutex); Explorer,
   Programs, Review/Outcomes, Watch zuletzt (die vier teuren Leser der 79-Stellen-Klasse).
   P6 vorerst nur LESEND auf `server/types.ts` (Befunde als Zeilen, Umsetzung nach P4).
   `e2e/pins.ts`: Spur A fasst nur `serverU`-Zeilen an, Spur B nur `clientU`-Zeilen.

--- Schnittlinie ---

- **Zweites Helfergeraet** (0 Code, `helperDevices` ist eine Map): entkoppelt Audit von Vorschau
  am seriellen Helfer-Slot. Owner-Akt; `audit.jsonl` zeigt am 09-01 23:17 eine
  `mainMacbook`-Registrierung, die sofort auf `off` ging.
- **H3 (Flake-Familien als Daten, maschinelle Adjudikation)** ist die Vorbedingung dafuer, dass
  A1 Zeit SPART statt verschiebt: zwei Geraete sind zwei Flake-Profile (Debian-Baseline, Locale,
  T14-Digest — gemessen). Bleibt eine B/P6-Zeile; heute nicht gemessen, ob die Familien-Namen die
  heutigen Rots vollstaendig decken.
- **Residual-Blindstelle der Remote-Audits:** `fails[]` liefert der neue Daemon (f62b1f5) — ungemessen,
  seit dem Bootstrap lief kein Remote-Audit. Aber `checks.ran` wird aus dem 40-Zeilen-Tail
  gezaehlt: die einzige Remote-GRUEN-Zeile (08-30) traegt `ran:23` bei 21 min. Schnitt beruehrt
  `server.ts` + Daemon → P6.
- **Die Wartewand (45 min) ist kein Budget, sondern ein Killer:** ein Gate, das ausgewartet wird,
  ist ein Land, das neu gestartet werden muss, und jeder Neustart ist wieder Schlange. Ein Land in
  eine Luecke zu legen (`POST /api/self/watch {kind:"audit"}` existiert) spart mehr als jede
  Protokollaenderung — wie oft die Luecke lang genug ist, wurde nicht gemessen.

**Was das fuer die Dauer heisst, mit Tilde:** heute ~2 Slices/Tag bei ~56 min Mutex je Slice und
98,9 % Auslastung. Mit Zug 1 (Audits remote) und Zug 2 (Vorschau entfaellt bei reinen Moves) faellt
der lokale Mutex je Slice auf ~2 min Gate-Arbeit; der Takt haengt dann an der Lane-Arbeit
(~130 min fuer Slice 1) und an der seriellen Helfer-Nadel (~23 min je Remote-Lauf), nicht mehr am
Mac. ~4 Slices/Tag sind dann Kapazitaet, nicht Hoffnung — P4 (vier Tiers + Rest) in ~3–4 Tagen,
P5 parallel. Eine Woche bis P7 ist damit die realistische Groessenordnung, sofern H3 die Remote-Rots
nicht zu Handarbeit macht.

## 3. Was nicht geprueft wurde

- Die Lane-Branches der P3-Slices (Abwesenheit einer Vorschau-Zeile in drei Commit-Bodies ist kein
  Beleg der Abwesenheit). — Die 79 `src/client.ts`-Stellen sind gezaehlt, vier gelesen; wie viele
  wirklich Bloecke schneiden, ist eine Obergrenze. — Kein Geraet angefasst, keine Suite gefahren.
- Die Vorschau-Minuten sind nicht nach Program getrennt (der Trail traegt kein Program-Feld):
  „422,8 min" sind alle `./e2e-isolated.sh`-Laeufe im claude-fleet-Baum, nicht nur Sanierung.
- 69 von 96 main-Commits seit 08-31 sind Direkt-Commits ohne Land-Note; deren Verifikation ist in
  keiner Zahl. Staging/Boot/Teardown je Wrapper (~20–60 s) fehlt in jeder Spanne — die
  Mutex-Zahlen sind Untergrenzen.

## 4. Zweitmeinung GLM-5.3 (pi-zai-Lane Slot 7, 15:05; Datei-Pointer, fuenf Fragen) — eingearbeitet

Was sie trifft (verifiziert an `e2e/pins.ts:152`, `e2e/explorer.ts:160-195`, `server.ts` Wand-Default
und Tail-Zaehlung), und was daraus oben geaendert ist:

- **Zug 2 war falsch begruendet:** „~0 Risiko, weil `RULE_SPAN` im Gate" — `RULE_SPAN` scannt nur
  `read("e2e/pins.ts")`, die 12 Pfad-Leser sieht er strukturell nicht. Das Risiko ruht allein auf dem
  `rg`-Filter, und der ist kein vollstaendiges Orakel: (a) Abhaengigkeitshuelle ausgefuehrter Bloecke,
  (b) Moves INNERHALB eines Anker-Paars (`PaintOpts`…`loadTree`), (c) Renames/Umsortierungen. Belegbasis
  n=1. → Zug 2 traegt jetzt das Restrisiko und die Verstaerkung (alle Hunk-Bezeichner rg-en).
- **Zug 1 misst Tempo, nicht Beweisqualitaet:** Remote-GRUEN ist schwach bewiesen (`checks.ran` aus
  dem 40-Zeilen-Tail; einziges Remote-Gruen trug `ran:23`), `fails[]` des neuen Daemons ist ungemessen.
  Wer den Beweiskanal auf eine ungepruefte Pipe verlagert, muss sie am ersten Tag pruefen. → Erfolgstest
  erweitert. **Das ist auch die Annahme, die die Dauer-Schaetzung zuerst kippt:** bleiben Remote-Rots
  ohne Check-Namen, ist jedes Rot Handarbeit plus lokaler 26-min-Rerun, und aus ~4 werden ~2–3
  Slices/Tag. Zweite Kante: Lane-Arbeit n=1 (130 min).
- **Zug 3 streichen** (jetzt unter der Linie): ~10 min/Slice, frisst die `undo-land`-Marge genau dann,
  wenn ein unbemerkter Leser-Bruch aus Zug 2 den Bisect braucht; gebuendeltes `graphify update` laesst
  Schritt a gegen einen 2–3 Slices alten Graphen schneiden (Praezedenz `e03d44c`: drei Symbole
  zurueckgewiesen).
- **Zweites Geraet gehoert ueber die Linie** (jetzt Zug 4): einziger Fix fuer den groessten Posten,
  0 Code, Owner-Akt. **Zug 5 (P5 parallel) erst nach dem Mess-Tag.**
- **Unbehandelt und benannt:** die Suite-Drift (453 → 675 ms/Check) adressiert kein Zug; lokale
  Rueckfaelle sterben weiter an der Wand (`server.ts` Default 30 min, `.env`/watchdog 45 min nur nach
  Restart); 69/96 Direkt-Commits ohne Land-Note machen alle Zahlen zu Untergrenzen.
