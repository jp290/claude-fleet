---
frage: Welcher der vier Hebel (Familien toeten, Schlange, UNKNOWN, weniger Checks) macht die Pruefapparatur am staerksten deterministischer und leichter, gerechnet aus Trail und Ledgern?
urteil: Zwei der vier Hebel sind seit der Owner-Richtung vom 09-08 schon weitgehend verbraucht (Schlange 21 min auf 0,3 min, UNKNOWN 20,6 % auf 2,5 %); zuerst bauen sind Hebel 1 an den vier Familien, die NACH ihrem Fix oder ohne Fix noch feuern (11.2y, 11.2q, 11.2ab, 11.2w), und Hebel 4 als modulweiser Messschnitt
bereich: [flake, audit, pruefapparatur]
belege: [e2e-trail/*.jsonl, post-land-audits.jsonl, audit-adjudications.jsonl, lane-outcomes.jsonl, docs/e2e-trail.md, server.ts#runPostLandAudit, server.ts#helperClaimBar, docs/messungen/2026-09-04-flake-ranking-trail.md]
nicht-gemessen: Lese-/Adjudikationszeit je rotem Audit; Mutex-Wartezeit lokaler Vorschaulaeufe; Helfer-Trails (der Helfer haelt nur die drei neuesten); ob ein nie-roter Check eine Invariante bewacht; UI-Darstellung von unknown
stand: 2026-09-18
---

# Pruefapparatur: welcher Hebel macht sie deterministischer und leichter?

2026-09-18, Lane `fleet/260918091528-b56e`. Auftrag: Owner-Richtung 2026-09-08 („all solche tools
und die checks … muessen deterministisch und leichter werden"), vier Hebel ORDNEN, nichts bauen.
Quellen sind Trail (`e2e-trail/*.jsonl` im Haupt-Checkout plus `$TMPDIR/fleet-e2e-trail/`, Vertrag in
`docs/e2e-trail.md`) und die Ledger im Haupt-Checkout. `docs/verify-tiering.md` liefert nur die
**Zuordnung** Check-Name → Familie, also welche wörtlichen Check-Namen eine Familie bilden, und die
Fix-SHAs. Jede Rate unten ist aus dem Trail oder einem Ledger gezählt. Jede Fix-SHA ist mit
`git merge-base --is-ancestor <fix> main` geprüft (zwei Doc-SHAs lagen nicht auf main, dafür stehen
ihre Rebase-Landungen in der Tabelle).

Alle Kommandos und Skripte stehen im Anhang. Jede Zahl trägt einen Verweis `[S:<skript>]`.

## 0. Die Ausgangszahlen der Owner-Richtung, heute nachgerechnet

Die Richtung vom 09-08 stützt sich auf Zahlen vom 09-08. Seitdem hat sich das Regime gedreht:
Voll-Audits laufen zweifach geshardet auf dem Helfer, docs-only-Lands bekommen die Kurzkette.

| Größe | Richtung 09-08 | heute | Rechenweg |
| --- | --- | --- | --- |
| Post-Land-Audits | 536 | 728: 442 grün · 175 rot · 111 unknown | `jq -r .result post-land-audits.jsonl \| sort \| uniq -c` |
| Urteile (je Zeile) | 177: flake 82 · unknowable 41 · stale-test 30 · real 24 | 190: flake 88 · unknowable 45 · stale-test 31 · **real 26 = 13,7 %** | `jq -r .verdict audit-adjudications.jsonl \| sort \| uniq -c` |
| Urteile (je Audit, letztes Urteil) | — | 140 von 175 roten Audits geurteilt, **16 real = 11,4 %**, 35 ungeurteilt | [S:hit] |
| Audit-Dauer, letzte 40 ohne Kurzkette | median 37 min, max 86 | **median 14,2 min**, max 65,9 (37 Helfer, 3 lokal, ab 09-16) | [S:audits] |
| dieselbe Größe, die letzten 40 vor 09-08 | — | median 37,7 min, max 85,8 (Kontrolle: stimmt mit der Richtung überein) | [S:audits] |
| Land → Abholung durch den Drain | „median 21 min Schlange" | **median 0,2 min** (letzte 40), 0,3 min (seit 09-14) | [S:audits] |
| Anteil auf dem Helfer | 7 von 20 | **95 von 101** Voll-Audits seit 09-14 | [S:audits] |
| UNKNOWN-Anteil | 20 % | bis 09-07: 107/519 = 20,6 % · **seit 09-08: 4/161 = 2,5 %** (ohne Kurzkette) | [S:audits] |
| rote Audits je Tag | — | 09-14 13/31 · 09-15 9/25 · 09-16 4/12 · 09-17 1/24 · 09-18 0/3 | Kommando A3 |
| Checks je Lauf | ~4 000 | lokaler Volllauf median 4 835 (seit 09-14), Helfer-Audit 5 123–5 132 (zwei Shards) | [S:lever4], Ledger `checks.ran` |
| Flake-Familien | 21 (§11.2a–u) | **28**: 26 in §11.2 (a–ab, ohne die Nicht-Familien d und t) plus 2 in §5b | Kopfzeilen `grep -n '^### 11.2' docs/verify-tiering.md` |

**Was daraus folgt:** Die Kosten von 37 min, die der Brief pro Land nennt, gibt es nicht mehr. Die
Trefferquote eines roten Audits ist dagegen weiter so niedrig wie der Brief sagt: je Urteilszeile
13,7 %, je Audit 11,4 %.

## (a) Rangliste der Familien nach Auslösehäufigkeit

**Definitionen.** Ein Lauf *erreicht* eine Familie, wenn er mindestens eine Zeile mit einem ihrer
Check-Namen trägt. Er *löst sie aus*, wenn eine dieser Zeilen `ok:false` ist. Die Rate ist
auslösende Läufe durch erreichende Läufe, also mit einem Nenner, der nur Läufe zählt, die die Familie
überhaupt gefahren haben (`docs/e2e-trail.md` §7). Gezählt wird Suite `isolated`; §11.2f zählt über
`claude-gate`, §11.2m über `postland-audit`, weil die Familie dort läuft.

- **Nach Fix**: nur Läufe, deren `tree` die Fix-SHA enthält. Die Nenner sind Untergrenzen, denn
  Läufe mit `tree:null` oder einem Baum, den git nicht mehr kennt, stehen in Spalte „u“.
- **7 T**: Läufe ab 2026-09-11.
- **Audit**: Einträge in `post-land-audits.jsonl` mit `fails`-Feld (ab 09-02, 201 Zeilen; fast nur
  Helfer-Läufe), in denen ein Mitglied rot ist, gesamt / nach Fix.

Sortiert ist nach der **aktuellen Rate**: bei reparierten Familien die Nach-Fix-Rate, sofern der
Nenner mindestens 20 ist, sonst die 7-Tage-Rate.

| # | Familie | Fix (auf main) | aktuelle Rate | nach Fix (u) | 7 T | seit 09-04 | gesamt | zuletzt rot | Audit ges. / nach Fix |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | §11.2y M1/M5-Setup | `6988539d` | **20,8 %** | 5/24 (2) | 6/86 | 6/123 | 6/123 | 09-17 | 6/201 · 0/31 |
| 2 | §11.2q Q6 fleet-report | `5c849e55` | **12,0 %** | 3/25 (2) | 16/100 | 25/213 | 28/252 | 09-17 | 1/201 · 0/33 |
| 3 | §11.2ab unattended-send-Rollback | — | **6,0 %** | — | 6/100 | 6/100 | 6/100 | 09-17 | 0/201 |
| 4 | §5b steward send-cap 429/409 | — | 2,4 % | — | 2/84 | 2/187 | 13/802 | 09-13 | 0/201 |
| 5 | §11.2v s2-Pane-Trias | — | 2,0 % | — | 2/101 | 3/219 | 11/896 | 09-12 | 0/201 |
| 6 | §11.2b reseed + live bytes | `02e991c8` | 1,6 % | 1/64 (16) | 1/102 | 2/221 | 10/912 | 09-15 | 6/201 · 0/95 |
| 7 | §11.2w Self-Land REPAIRED | `f8f3ee90` | 1,5 % | 1/67 (2) | 3/87 | 3/193 | 3/382 | 09-17 | 2/201 · 0/110 |
| 8 | §11.2aa ②-Sektion | `e4d8e1ba` | 1,0 % (7 T; nach Fix n=14) | 0/14 (16) | 1/97 | 1/207 | 4/854 | 09-17 | 1/201 · 0/21 |
| 9 | §11.2l busy-receiver | `7d089c1` | 0,5 % | 1/200 (2) | 0/100 | 10/212 | 39/585 | 09-06 | 8/201 · 1/192 |
| 10 | §11.2g §7 lines=0 | `69615a52` | 0,3 % | 1/320 (2) | 0/69 | 1/172 | 7/418 | 09-06 | 0/201 |
| 11 | §11.2 merge/resolver FIX1 | `0916a9fa` | 0,1 % | 1/841 (16) | 0/124 | 0/233 | 9/879 | 08-04 | 0/201 |
| 12 | §11.2o projection nextAction | `4c562e7` | 0 % | 0/145 (2) | 0/87 | 26/193 | 28/382 | 09-05 | 12/201 · 0/171 |
| 13 | §11.2s D2-Vorbedingung ¹ | `2a06185f` | 0 % | 0/144 (2) | 0/100 | 1/195 | 1/195 | 09-06 | **10/201** · 0/168 |
| 14 | §11.2u unbound succession | `4bbfa626` | 0 % | 0/93 (2) | 0/88 | 17/191 | 18/192 | 09-09 | 2/201 · 0/144 |
| 15 | §11.2j pi-unfenced | `1db9296` | 0 % | 0/194 (6) | 0/125 | 5/241 | 35/631 | 09-05 | 4/201 · 0/179 |
| 16 | §11.2r Watch-Idempotenz | `119c1b3e` | 0 % | 0/58 (5) | 0/100 | 1/212 | 5/692 | 09-05 | 5/201 · 0/73 |
| 17 | §11.2x surface re-derive ¹ | `6a1a2a9e` | 0 % | 0/39 (6) | 0/80 | 0/80 | 0/80 | — | 2/201 · 0/36 |
| 18 | §11.2z backlog nudge | `33e1a80d` | 0 % | 0/26 (6) | 4/94 | 6/197 | 7/580 | 09-16 | 0/201 |
| 19 | §11.2k raw-review | `05f37f1` | 0 % | 0/249 (16) | 0/96 | 0/199 | 9/831 | 09-01 | 0/201 |
| 20 | §11.2h owner-token ambient | `c8088e0e` | 0 % | 0/333 (2) | 0/86 | 0/192 | 4/378 | 08-26 | 0/201 |
| 21 | §11.2f send-boot (claude-gate) | `54bae42f` | 0 % | 0/923 (11) | 0/295 | 0/510 | 40/1518 | 08-19 | — |
| 22 | §11.2n ⏸ re-run guard | — | 0 % | — | 0/74 | 4/184 | 11/820 | 09-04 | 0/201 |
| 23 | §11.2m RW-parked (postland-audit) | — | 0 % (7 T n=12) | — | 0/12 | 3/51 | 9/58 | 09-04 | 0/201 |
| 24 | §11.2e commit idle gate | — | 0 % | — | 0/100 | 0/210 | 4/865 | 08-08 | 0/201 |
| 25 | §11.2c stalled pane-observation | — | 0 % | — | 0/98 | 0/214 | 2/742 | 08-06 | 0/201 |
| 26 | §5b review.state „inflight“ | — | 0 % | — | 0/99 | 0/216 | 0/879 | — | 0/201 |
| — | §11.2i Phasen-Neustart | `1e4f8f24` | **unbekannt** | | | | | | |
| — | §11.2p requeue-teardown-empty | — | **unbekannt** | | | | | | |

¹ Die Familie war nur auf dem Helfer rot (s: lokal 1/195, Audit 10/201; x: lokal 0/80, Audit 2/201).
Die Trail-Spalten unterschätzen sie strukturell, siehe „Lücken im Register“.

**Die zwei `unbekannt`-Zeilen:**
- **§11.2i** scheitert, bevor ein Check läuft (`server did not come up`, keine `server.log`). Der Trail
  hat keine Zeile, die sie zählen könnte.
- **§11.2p** zählt im erhaltenen Trail 0/637. Der eine registrierte Beleg-Lauf
  `isolated-20260904T190127Z-33824` existiert aber in keinem der beiden Trail-Verzeichnisse mehr
  (`ls` auf beide Pfade: `No such file`). Das Register hat den Beleg verloren. Eine 0 wäre hier eine
  falsche Harmlosigkeitsaussage.

**Vier Familien feuern auf dem aktuellen Stand**: Rang 1, 2, 3 und 7. Alle waren zuletzt am
2026-09-17 rot.
- **§11.2y** fiel nach `6988539d` auf vier verschiedenen **sauberen** Bäumen: `dc2cc522`, `2ace81a2`,
  `984ef5b7`, `fc76d3f5`.
- **§11.2q** fiel nach `5c849e55` auf drei sauberen Bäumen: `2a834e26`, `984ef5b7`, `0e313a49`.
- **§11.2w** fiel nach `f8f3ee90` einmal, auf dem sauberen Baum `2a834e26`.

Nach dem Regelbuch („Ein Rot NACH dem Fix-SHA … ist wieder ECHT“) sind das offene Befunde, keine
Restrauschen. Bei zwei oder mehr verschiedenen sauberen Bäumen kann es nicht das Diff eines
einzelnen Fragenden sein (`docs/e2e-trail.md` §7). Rechenweg: [S:families3], die
Sauber-Einzelnachweise über Kommando A4.

Rang 3 (§11.2ab) und die RW-Familie (§11.2m) sind unrepariert. §11.2m ist seit 09-04 still, bei nur
12 erreichenden Läufen in 7 Tagen.

**Die elf Familien mit 0 % nach Fix halten.** Das deckt sich mit dem Befund vom 09-04
(`docs/messungen/2026-09-04-flake-ranking-trail.md` §2): die Beweisordnung funktioniert.

### Lücken im Register (gemessen, nicht behoben)

1. **Helfer-Läufe fehlen im Trail.** Der Helfer hält nur die drei neuesten Trail-Dateien
   (`find /var/lib/fleet-helper -name 'isolated-*.jsonl' | wc -l` → 3, per ssh am 2026-09-18). Seit
   09-14 laufen aber 95 von 101 Voll-Audits dort. Familien, die nur auf dem Helfer feuern (s, x), sieht
   nur die `fails`-Spalte des Audit-Ledgers, und die hat keinen Nenner je Check.
2. **`$TMPDIR/fleet-e2e-trail/` hält heute 11 Dateien.** Die Post-Land-Audit-Läufe vor der Aufräumung
   sind weg (§11.2p ist der erste messbare Verlust).
3. **12 von 27 roten Audits seit 09-14 liegen in KEINER Familie.** Es sind zwei Checks, die nur auf dem
   Helfer fielen:
   - `clarification identical retry …`: lokal 0/531
   - `Program-MAIN chain setup: B succeeds to C …`: lokal 1/101

   Beide fielen in je sechs aufeinanderfolgenden Audits (09-14 08:43–12:19 und 09-15 09:27–15:51) und
   seitdem nicht mehr. Eine Serie aufeinanderfolgender Audits ist die Signatur eines deterministischen
   Host-Defekts, nicht eines Flakes. Registriert ist keiner der beiden. [S:attrib], Kommando A5.

## (b) Gewinn je Hebel: Minuten je Land und Prozentpunkte Trefferquote

**Bezugsfenster:** 2026-09-14 bis 2026-09-18 12:00Z. In diesem Fenster:
- 148 gelandete Lanes (109 davon mit `e2eTouched`)
- 127 lokale `isolated`-Läufe mit zusammen 1 961 min, also **13,3 Mac-Suite-Minuten je Land**
- 123 Audits, davon 21 Kurzkette, zusammen 2 177 Helfer-Minuten, also **14,7 Helfer-Minuten je Land**

Rechenweg: [S:previews], Kommando A6.

**Trefferquote** = Anteil `real` unter den geurteilten roten Audits (letztes Urteil je Audit). Im
Fenster mit `fails`-Feld (ab 09-02) sind es 67 rote Audits:
- 40 davon bestehen **nur** aus Fails registrierter Familien. Von ihnen sind 26 geurteilt, 2 real.
- 27 tragen mindestens einen Fail ohne Familie. Von ihnen sind 13 geurteilt, 1 real.

Zusammen ergibt das 3/39 = **7,7 %**. [S:hit]

| Hebel | Min/Land (gemessen bzw. Obergrenze) | Trefferquote (pp) | Stand |
| --- | --- | --- | --- |
| (1) Familien töten | ≤ 3,9 Mac-min/Land: 18 rote Läufe mit nur Familien-Fails / 148 Lands = 0,12 je Land × 32,2 min medianer Volllauf; gilt nur, wenn jedes solche Rot einen seriellen Same-Tree-Rerun auslöst. Dazu 0,07 rote Audits je Land zum Lesen (10 von 148), deren Lesezeit nicht gemessen ist | **+0 bis +12 pp** (7,7 % → 7,7 %, falls die 2 echten Defekte unter Familien-Checks mit verschwinden; → 3/15 = 20 %, falls sie weiter rot würden); **−60 % rote Audits** (40 von 67) | offen; vier Familien feuern (a) |
| (2) Schlange | ≤ 0,3 min/Land Rest (Median Land→Abholung). Der gesamte Gewinn der Richtung, 37,7 → 14,2 min median, ist **realisiert** | 0 pp (die Schlange ändert kein Urteil) | erledigt: 95 von 101 auf dem Helfer |
| (3) UNKNOWN ehrlich | ≈ 0 min/Land messbar | 0 pp auf die Rot-Trefferquote (unknown ist nicht rot) | Ledger typisiert seit jeher `unknown` + `reason`. Seit 09-08 sind es 4 von 161 (2,5 %): 3× `declined to run (exit 42)`, 1× `shard 2/2 lapsed`. 106 von 111 unknown sind nie geurteilt |
| (4) Weniger Checks | Obergrenze **7,7 Mac-min/Land** (0,58 × 13,3) und **8,5 Helfer-min/Land** (0,58 × 14,7) | **0 pp per Konstruktion**: ein nie roter Check erzeugt kein falsches Rot | 3 309 von 5 002 Checks der 42 lokalen Volläufe seit 09-14 waren in je ≥ 100 Läufen nie rot und tragen 58,0 % der `msSincePrev`-Summe |

Drei Vorbehalte, ohne die die Tabelle falsch gelesen wird:

- **(4) ist eine Obergrenze, keine Schätzung.** `msSincePrev` misst die Kosten bis zu dieser Zeile,
  nicht die Laufzeit des Checks selbst (`docs/e2e-trail.md` §4). Die Fixture eines nie roten Checks
  trägt meist auch rote Checks, und wer den Check streicht, spart deren Aufbau nicht.
- **Ob ein Check je einen echten Regress gefangen hat, gibt der Trail nicht her.** Der Brief nahm das
  an. Der Trail kennt aber nur `ok`, nicht `real` oder `flake`. Nur `audit-adjudications.jsonl` sagt
  „real“, und das pro Audit, nicht pro Check. Insgesamt waren 765 von 5 755 Check-Namen jemals rot
  [S:lever4]. Rechenbar ist also „nie rot“, nicht „nie einen Regress gefangen“.
- **Der Rest der falschen Rots liegt nicht in den Familien.** Die 27 roten Audits ohne Familie urteilen
  nicht besser: 1 real von 13 geurteilten. Sie sind stale-test (3), unknowable (5) und die zwei
  Helfer-Serien aus „Lücken“ 3. Hebel 1 allein hebt die Trefferquote deshalb höchstens auf ~20 %.

## (c) Welche zwei zuerst gebaut werden

1. **Hebel 1, geschnitten auf die vier Familien, die heute feuern:** §11.2y (20,8 % nach Fix),
   §11.2q (12,0 % nach Fix), §11.2ab (6,0 %, unrepariert) und §11.2w (1/67 nach Fix, ein Produkt-Pfad).
   - **Grund:** Hebel 1 ist der einzige der vier, der die Trefferquote überhaupt bewegt, und der
     einzige mit einer gemessenen offenen Menge. Die anderen 22 Familien schweigen nach ihrem Fix oder
     seit ≥ 7 Tagen.
   - **Einrichtung der Zeilen:** Je Familie eine Zeile, Brief nach „Rot nach Fix ist echt“. Die erste
     Frage jeder Zeile ist also, was der Fix nicht geschlossen hat, nicht wie man den Check lockert.
   - **Drei Zusatzposten, alle gemessen:**
     - die zwei Helfer-Serien aus „Lücken“ 3 als Sichtungen registrieren (12 rote Audits, keine
       Familie);
     - die Trail-Aufbewahrung auf dem Helfer, denn ohne sie bleibt jede Helfer-Familie unzählbar;
     - die Aufbewahrung von `$TMPDIR/fleet-e2e-trail/`, denn dort ist schon ein Beleg verloren (§11.2p).
2. **Hebel 4, als modulweiser Messschnitt vor jedem Streichen.**
   - **Grund:** Hebel 2 ist verbraucht, Hebel 3 hat 2,5 % Rest. Die Minuten liegen heute bei den
     **lokalen Vorschauläufen**: 13,3 Mac-min je Land, median 32,2 min je Volllauf, während sie den
     Suite-Mutex halten. Das ist Queue-Zeit (Owner-Priorität 2026-09-18, Zeile `0f2024dc`).
   - **Schnitt:** je `e2e/<family>.ts`-Modul
     - den Zeitanteil seiner nie roten Checks aus `phases`/`phaseSum` messen (die Felder existieren
       seit 09-14, `docs/e2e-trail.md` §4a);
     - dann per Modul-Auswahl (`FLEET_E2E_MODULES`, `docs/verify-tiering.md` §16) messen, was ein
       Weglassen wirklich spart, statt die Obergrenze von 58 % zu glauben.
   - **Vor jeder Streichung:** Die Frage, ob der Check eine Invariante bewacht, entscheidet ein Mensch
     je Check.

**Nicht zuerst:** Hebel 2, denn er ist gebaut (Helfer-Anteil 95/101, Schlange 0,3 min). Und Hebel 3:
4 unknown in 161 Audits seit 09-08. Offen bleibt dort nur, die 106 ungeurteilten unknown-Zeilen
abzuarbeiten oder als `unknowable` zu schließen. Das ist Ledger-Pflege, kein Umbau.

## (d) Welche harte Invariante keiner der Vorschläge schwächt

- **Der Land-Gate bleibt autoritativ.** Keiner der Vorschläge berührt `watchdog.sh`/`VERIFY_CMD`, die
  Reihenfolge der Kette (`RULE_VERIFY` in `e2e/pins.ts`) oder die Suiten des Gates (`claude-gate`,
  `clean-review`, `security`, pins).
  - Hebel 1 repariert Sonden oder Produkt.
  - Hebel 4 misst die `isolated`-Suite (Stufe 2 und Vorschau). Er schließt `e2e/security.ts` aus,
    weil es nur dort läuft, und die Pins, weil sie der Gate sind.
- **Ein Rot bleibt rot.** Kein Vorschlag führt eine Liste bekannter Flakes ein, die ein Rot
  grünfärbt, und keiner einen Retry, der ein Rot überschreibt. Hebel 1 bearbeitet genau die Familien,
  deren Rot nach dem Fix als echt zu lesen ist.
- **Abwesenheit von Messung wird nie als Harmlosigkeit gerendert.**
  - Diese Notiz selbst führt §11.2i und §11.2p als `unbekannt`, nicht als 0.
  - Die Helfer-Familien sind als strukturell unterzählt markiert.
  - Hebel 4 darf nur auf Grund gemessener Modul-Einsparung und Einzelurteil streichen, nie auf Grund
    von „0 Rot im Trail“ allein. Ein Check mit 0 Rot in einem Register, das die Helfer-Läufe nicht
    enthält, ist unterzählt, nicht bewiesen harmlos.
- **Ein roter Check ist deiner, bis du das Gegenteil beweist.** Hebel 1 verlangt je Familie den Beweis
  am Register (≥ 2 saubere Bäume), nicht einen grünen Rerun.

## Was nicht gemessen wurde

- **Lese- und Adjudikationszeit je rotem Audit.** Der Ledger trägt das Urteil, nicht die Mühe. Die
  Minuten in (b) für Hebel 1 und 3 sind deshalb ohne diesen Posten gerechnet.
- **Mutex-Wartezeit lokaler Vorschauläufe.** Die Trail-Zeile trägt keine Wartezeit, und die
  `[suite-lock]`-Zeilen stehen nur in der Pane.
- **Die Rate von Helfer-Familien je Check.** Es fehlt der Nenner, siehe „Lücken“ 1.
- **Ob die unknown-Zeilen irgendwo in der UI wie grün aussehen.** `server.ts`/`src/client.ts` nicht
  gelesen. Belegt ist nur, dass der Ledger `unknown` mit `reason` führt.
- **Die Zuordnung Check → Familie.** Sie ist Handarbeit über die wörtlichen Namen der Tiering-Doc
  (Muster in `FAM`, Anhang). Ein seitdem umbenannter Check fällt aus seiner Familie heraus. §11.2j und
  §11.2l teilen sich Fixture-Checks (`subject-gone`, `counterprobe`); hier sind sie §11.2j
  zugeschlagen.
- **Gate-Laufzeit (Stufe 1).** Nicht Gegenstand. Die Kosten je Land in (b) sind Stufe 2 und
  Vorschau.

## Anhang: Rechenweg

Skripte liegen im Scratch, nicht im Baum. Zum Wiederholen: die Blöcke unten in ein Verzeichnis
`$S` schreiben und in der Reihenfolge `scan → families3 → famdef → attrib/hit/audfix/previews/lever4`
laufen lassen. `M=/Users/owner/claude-fleet`.

**Kommandos:**

```sh
# A1 Audit-Ergebnisse / A2 Urteile
jq -r .result $M/post-land-audits.jsonl | sort | uniq -c
jq -r .verdict $M/audit-adjudications.jsonl | sort | uniq -c
# A3 rote Audits je Tag seit 09-14
jq -r 'select(.at>1789344000000 and .fails) | "\(.at/1000|strftime("%m-%d")) \(.result)"' $M/post-land-audits.jsonl | sort | uniq -c
# A4 Nach-Fix-Rots mit Baum und dirty (Beispiel §11.2y; SHA/Muster je Familie tauschen)
grep -h -F 'M1 setup' $M/e2e-trail/isolated-*.jsonl | grep -F '"ok":false' | jq -r '"\(.run) \(.tree) \(.dirty)"' | sort -u \
  | while read run tree d; do git -C $M merge-base --is-ancestor 6988539d $tree && echo "$run $tree $d"; done
# A5 Helfer-Serien ohne Familie
jq -r 'select(.fails) | select(any(.fails[]; test("^clarification identical retry|^Program-MAIN chain setup: B succeeds"))) | "\(.at/1000|strftime("%m-%d %H:%M")) \(.mainSha[0:8])"' $M/post-land-audits.jsonl
# A6 lokale Suite-Minuten und Audit-Minuten im Fenster 09-14..09-18 12Z
jq '[.[] | select(.first>=1789344000000 and .first<1789732800000 and (.dir|test("fleet-e2e-trail")|not)) | (.last-.first)/60000] | {n:length, sum:(add|floor)}' $S/runs.json
jq -s '[.[] | select(.at>=1789344000000 and .at<1789732800000)] | {n:length, remote_min:([.[]|select(.remote)|.ms]|add/60000|floor)}' $M/post-land-audits.jsonl
# A7 Beleg-Verlust §11.2p
ls $M/e2e-trail/isolated-20260904T190127Z-33824.jsonl $TMPDIR/fleet-e2e-trail/isolated-20260904T190127Z-33824.jsonl
# famdef.ts aus families3.ts ableiten
{ echo 'type F = { id: string; name: string; pats: string[]; fix: string | null; suite?: string };'; sed -n '/^const FAM: F\[\] = \[/,/^\];/p' families3.ts | sed 's/^const FAM/export const FAM/'; } > famdef.ts
```


**[S:scan]** — `M=/Users/owner/claude-fleet S=$S bun scan.ts`

```ts
// per-check scan over isolated trail files: runs, failing runs, clean-tree failing runs, distinct clean trees, per-day
import { readdirSync, readFileSync, statSync } from "fs";
const dirs = [process.env.M + "/e2e-trail", process.env.TMPDIR + "/fleet-e2e-trail"];
type C = { runs: number; fail: number; cleanFail: number; dirtyFail: number; nullFail: number; trees: Set<string>; lastFail: number; firstSeen: number; lastSeen: number; failDays: Record<string, number>; runDays: Record<string, number> };
const per = new Map<string, C>();
const runsMeta: any[] = [];
for (const d of dirs) {
  let files: string[] = []; try { files = readdirSync(d).filter(f => f.startsWith("isolated-")); } catch {}
  for (const f of files) {
    const txt = readFileSync(`${d}/${f}`, "utf8");
    const seen = new Map<string, { ok: boolean; tree: string | null; dirty: boolean; ts: number }>();
    let n = 0, fails = 0, first = 0, last = 0, tree: string | null = null, dirty = false, treeWhy = "";
    for (const line of txt.split("\n")) {
      if (!line) continue; let r: any; try { r = JSON.parse(line); } catch { continue; }
      n++; if (!r.ok) fails++; if (!first) first = r.ts; last = r.ts; tree = r.tree ?? null; dirty = !!r.dirty; treeWhy = r.treeWhy ?? "";
      const prev = seen.get(r.check);
      if (!prev || (prev.ok && !r.ok)) seen.set(r.check, { ok: r.ok, tree: r.tree ?? null, dirty: !!r.dirty, ts: r.ts });
    }
    if (!n) continue;
    runsMeta.push({ f, dir: d, n, fails, first, last, tree, dirty, treeWhy });
    for (const [k, v] of seen) {
      let c = per.get(k);
      if (!c) { c = { runs: 0, fail: 0, cleanFail: 0, dirtyFail: 0, nullFail: 0, trees: new Set(), lastFail: 0, firstSeen: v.ts, lastSeen: v.ts, failDays: {}, runDays: {} }; per.set(k, c); }
      const day = new Date(v.ts).toISOString().slice(0, 10);
      c.runs++; c.runDays[day] = (c.runDays[day] ?? 0) + 1;
      c.firstSeen = Math.min(c.firstSeen, v.ts); c.lastSeen = Math.max(c.lastSeen, v.ts);
      if (!v.ok) {
        c.fail++; c.lastFail = Math.max(c.lastFail, v.ts); c.failDays[day] = (c.failDays[day] ?? 0) + 1;
        if (v.tree === null) c.nullFail++; else if (v.dirty) c.dirtyFail++; else { c.cleanFail++; c.trees.add(v.tree); }
      }
    }
  }
}
const out = [...per].map(([check, c]) => ({ check, ...c, trees: c.trees.size }));
await Bun.write(process.env.S + "/checks.json", JSON.stringify(out));
await Bun.write(process.env.S + "/runs.json", JSON.stringify(runsMeta));
console.log("checks", out.length, "runs", runsMeta.length);
```

**[S:families3]** — `M=/Users/owner/claude-fleet S=$S bun families3.ts`

```ts
// family ranking over the trail register (isolated; §11.2f over claude-gate) + audit-ledger `fails`
import { readdirSync, readFileSync } from "fs";
const M = "/Users/owner/claude-fleet";
type F = { id: string; name: string; pats: string[]; fix: string | null; suite?: string };
const FAM: F[] = [
  { id: "5b-inflight", name: "review.state inflight", pats: ['records review.state "inflight"'], fix: null },
  { id: "5b-cap", name: "steward send-cap 429/409", pats: ["a second send of the same kind×slot within the episode window is 429", "a capped send is audited (steward_send_capped)"], fix: null },
  { id: "11.2", name: "merge/resolver FIX1", pats: ["FIX1: concurrent merges settle", "G1b setup: conflicting lane resolved", "G1b: confirm-land", "outcome: repaired conflict resolution"], fix: "0916a9fa" },
  { id: "11.2b", name: "reseed + live bytes", pats: ["reseed + live bytes"], fix: "02e991c8" },
  { id: "11.2c", name: "stalled pane-observation", pats: ["stalled setup: the lane's output was observed", "stalled is served as a fact", "a stalled lane is NOT done-looking", "stalled-since is served"], fix: null },
  { id: "11.2e", name: "commit idle gate", pats: ["one-gesture commits the dirty conflicting lane", "lane commit stages untracked", "main-session commit stages tracked", "commit refuses a detached HEAD", "commit agent mode lands", "FIX4: commit refuses"], fix: null },
  { id: "11.2f", name: "send-boot fixtures (claude-gate)", pats: ["unprobed fixture: the pane is still unobserved", "boot-race fixture: the pane is still unobserved", "observed-pane fixture probe: the printing harn", "a pane that already printed takes the unchanged no-delay", "silent-alive fixture: the pane has still never printed", "boot-timeout fixture: the pane is still unobserved"], fix: "54bae42f", suite: "claude-gate" },
  { id: "11.2g", name: "§7 fixture lines=0", pats: ["§7 fixture: the land gate actually ran"], fix: "69615a52" },
  { id: "11.2h", name: "owner-token ambient use", pats: ["owner-token ambient use: a BEARER merge"], fix: "c8088e0e" },
  { id: "11.2j", name: "pi-unfenced watch quartet", pats: ["pi-unfenced", "held: 100+ pre-paste refusals", "rollback live falsifier: recycled slot identity", "subject-gone: the torn-down lane's undelivered event", "counterprobe: the live subject's held event"], fix: "1db9296" },
  { id: "11.2k", name: "raw-review persist", pats: ["outcome: a reviewer answer that did NOT parse"], fix: "05f37f1" },
  { id: "11.2l", name: "busy-receiver restart", pats: ["restart keeps the busy pending event", "busy -> later idle delivers the SAME", "repeated ticks produce no duplicate event", "a dead receiver leaves its event inspectable", "deleting a Watch does not delete its acknowledged", "subject teardown after event creation"], fix: "7d089c1" },
  { id: "11.2m", name: "RW parked quartet", pats: ["(RW) …after the env repo's run", "(RW) …while a land in a repo with neither", "(RW) the entry is PARKED", "(RW) another repo's land is audited meanwhile"], fix: null, suite: "postland-audit" },
  { id: "11.2n", name: "⏸ re-run guard", pats: ["⏸ a re-run is refused while the resolution is still rebased"], fix: null },
  { id: "11.2o", name: "projection nextAction", pats: ["projection nextAction:"], fix: "4c562e7" },
  { id: "11.2p", name: "requeue-teardown-empty", pats: ["requeue probe (empty)", "an empty lane is torn down by its own requeue", "…and no slot left held by it either"], fix: null },
  { id: "11.2q", name: "Q6 fleet-report", pats: ["Q6 "], fix: "5c849e55" },
  { id: "11.2r", name: "watch idempotency pair", pats: ["re-subscribing to the same target returns the SAME watch, never a second", "delete the spent transport Watch"], fix: "119c1b3e" },
  { id: "11.2s", name: "D2 precondition", pats: ["D2 setup: both closing lanes reached the spent shape"], fix: "2a06185f" },
  { id: "11.2u", name: "unbound succession pane", pats: ["unbound succession", "…and delivers it WHOLE once that marker appears"], fix: "4bbfa626" },
  { id: "11.2v", name: "s2 pane triad", pats: ["composed text visible in s2 pane", "export contains session content"], fix: null },
  { id: "11.2w", name: "self-land REPAIRED candidate", pats: ["self-land progress guard: a REPAIRED candidate"], fix: "f8f3ee90" },
  { id: "11.2x", name: "surface re-derive", pats: ["surface: a new brief re-derives it"], fix: "6a1a2a9e" },
  { id: "11.2y", name: "M1/M5 setup", pats: ["M5 setup: the docs land fired", "M1 setup", "(iii) M5 setup", "(iv) M5: a DOCS-ONLY land"], fix: "6988539d" },
  { id: "11.2z", name: "backlog nudge B-not-A", pats: ["backlog nudge sends exactly one slot in the round", "backlog nudge sends the same session", "backlog nudge: a new row re-arms", "backlog nudge: after cooldown", "backlog nudge obeys FLEET_BACKLOG_NUDGE_MAX"], fix: "33e1a80d" },
  { id: "11.2aa", name: "② author hand-off", pats: ["② "], fix: "e4d8e1ba" },
  { id: "11.2ab", name: "unattended send rollback", pats: ["an unattended send whose payload is NOT accepted rolls"], fix: null },
];
const match = (f: F, c: string) => f.pats.some((p) => c.includes(p));
const git = (args: string[]) => Bun.spawnSync(["git", "-C", M, ...args]).exitCode;
for (const f of FAM) if (f.fix && git(["merge-base", "--is-ancestor", f.fix, "main"]) !== 0) console.error("fix not on main", f.id, f.fix);
const since14 = Date.parse("2026-09-04T00:00:00Z");
type Hit = { run: string; tree: string | null; dirty: boolean; ts: number; failed: boolean };
const hits = new Map<string, Hit[]>(FAM.map((f) => [f.id, []]));
const dirs = [M + "/e2e-trail", process.env.TMPDIR + "/fleet-e2e-trail"];
for (const d of dirs) {
  let files: string[] = []; try { files = readdirSync(d); } catch {}
  for (const file of files) {
    const suite = file.startsWith("isolated-") ? "isolated" : file.startsWith("claude-gate-") ? "claude-gate" : file.startsWith("postland-audit-") ? "postland-audit" : null;
    if (!suite) continue;
    const fams = FAM.filter((f) => (f.suite ?? "isolated") === suite);
    const txt = readFileSync(`${d}/${file}`, "utf8");
    if (suite === "claude-gate" && !txt.includes("fixture")) continue;
    const state = new Map<string, Hit>();
    for (const line of txt.split("\n")) {
      if (!line) continue; let r: any; try { r = JSON.parse(line); } catch { continue; }
      for (const f of fams) if (match(f, r.check)) {
        const h = state.get(f.id) ?? { run: file, tree: r.tree ?? null, dirty: !!r.dirty, ts: r.ts, failed: false };
        if (!r.ok) h.failed = true; state.set(f.id, h);
      }
    }
    for (const [id, h] of state) hits.get(id)!.push(h);
  }
}
// ancestor cache
const anc = new Map<string, number>();
const contains = (fix: string, tree: string) => { const k = fix + tree; if (!anc.has(k)) anc.set(k, git(["merge-base", "--is-ancestor", fix, tree])); return anc.get(k)!; };
// audit ledger: rows carrying `fails` with a real run
const audits = readFileSync(M + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((a) => Array.isArray(a.fails) && (a.checks?.ran ?? 0) > 0);
const rows: any[] = [];
for (const f of FAM) {
  const hs = hits.get(f.id)!;
  const all = { n: hs.length, r: hs.filter((h) => h.failed).length };
  const h14 = hs.filter((h) => h.ts >= since14); const w14 = { n: h14.length, r: h14.filter((h) => h.failed).length }; const h7 = hs.filter((h) => h.ts >= Date.parse("2026-09-11")); const w7 = { n: h7.length, r: h7.filter((h) => h.failed).length };
  let post: any = null;
  if (f.fix) {
    const p = { n: 0, r: 0, trees: new Set<string>(), unattr: 0 };
    for (const h of hs) {
      if (!h.tree) { p.unattr++; continue; }
      const c = contains(f.fix, h.tree);
      if (c === 0) { p.n++; if (h.failed) { p.r++; p.trees.add(h.tree); } } else if (c !== 1) p.unattr++;
    }
    post = { n: p.n, r: p.r, trees: p.trees.size, unattr: p.unattr };
  }
  const last = hs.filter((h) => h.failed).reduce((m, h) => Math.max(m, h.ts), 0);
  const aud = audits.filter((a) => a.fails.some((c: string) => match(f, c))).length;
  rows.push({ id: f.id, name: f.name, fix: f.fix, suite: f.suite ?? "isolated", all, w14, w7, post, last: last ? new Date(last).toISOString().slice(0, 10) : null, audHits: aud });
}
console.log("audit rows with fails:", audits.length, "from", new Date(Math.min(...audits.map((a) => a.at))).toISOString().slice(0, 10));
await Bun.write(process.env.S + "/families3.json", JSON.stringify(rows, null, 1));
for (const r of rows) console.log([r.id, r.all.r + "/" + r.all.n, r.w14.r + "/" + r.w14.n, r.w7.r + "/" + r.w7.n, r.post ? `${r.post.r}/${r.post.n} t${r.post.trees} u${r.post.unattr}` : "-", r.last, r.audHits].join("\t"));
```

**[S:audits]** — `M=/Users/owner/claude-fleet S=$S bun audits.ts`

```ts
import { readFileSync } from "fs";
const M = "/Users/owner/claude-fleet";
const A = readFileSync(M + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const J = readFileSync(M + "/audit-adjudications.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const min = (ms: number) => +(ms / 60000).toFixed(1);
const kind = (a: any) => a.proportional || a.cmdSource === "proportional" ? "short" : a.remote ? "remote" : "local";
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const period = (t: number) => t < Date.parse("2026-09-08") ? "P1 bis 09-07" : t < Date.parse("2026-09-14") ? "P2 09-08..13" : "P3 09-14..18";
const tab: Record<string, Record<string, number>> = {};
for (const a of A) { const k = `${period(a.at)} ${kind(a)}`; tab[k] ??= { green: 0, red: 0, unknown: 0 }; tab[k][a.result]++; }
console.log("== result by period x kind"); for (const k of Object.keys(tab).sort()) console.log(k, JSON.stringify(tab[k]));
console.log("total", A.length, JSON.stringify(A.reduce((m: any, a) => (m[a.result] = (m[a.result] ?? 0) + 1, m), {})));
// last 40 audits: duration, land->verdict latency, queue
const lastN = (n: number, filt = (a: any) => true) => A.filter(filt).slice(-n);
for (const [label, rows] of [["last40 all", lastN(40)], ["last40 non-short", lastN(40, (a) => kind(a) !== "short")], ["P3 non-short", A.filter((a) => period(a.at).startsWith("P3") && kind(a) !== "short")], ["P1 non-short (last 40 before 09-08)", A.filter((a) => a.at < Date.parse("2026-09-08") && kind(a) !== "short").slice(-40)]] as const) {
  const ms = rows.map((a) => a.ms);
  const lat = rows.filter((a) => a.covers?.length).map((a) => a.at - Math.min(...a.covers.map((c: any) => c.at)));
  const pre = rows.filter((a) => a.covers?.length).map((a) => (a.remote?.claimedAt ?? a.startedAt) - Math.min(...a.covers.map((c: any) => c.at)));
  const lockw = rows.filter((a) => a.workMs != null && !a.remote).map((a) => a.ms - a.workMs);
  const kinds = rows.reduce((m: any, a) => (m[kind(a)] = (m[kind(a)] ?? 0) + 1, m), {});
  console.log(`== ${label}: n=${rows.length} kinds=${JSON.stringify(kinds)} from ${day(rows[0].at)}`);
  console.log(`   ms median ${min(med(ms))} max ${min(Math.max(...ms))} | land->verdict median ${min(med(lat))} max ${min(Math.max(...lat))} | land->pickup median ${min(med(pre))} | ms-workMs (local, n=${lockw.length}) median ${min(med(lockw))}`);
  console.log(`   results ${JSON.stringify(rows.reduce((m: any, a) => (m[a.result] = (m[a.result] ?? 0) + 1, m), {}))}`);
}
// unknown reasons
console.log("== unknown reasons (first 70 chars), by period");
const ur: Record<string, number> = {};
for (const a of A.filter((a) => a.result === "unknown")) { const r = `${period(a.at).slice(0, 2)} ${kind(a)} exit=${a.exitCode} ${(a.reason ?? "(no reason)").replace(/[0-9a-f]{7,}/g, "<sha>").replace(/\d+/g, "N").slice(0, 70)}`; ur[r] = (ur[r] ?? 0) + 1; }
for (const [k, v] of Object.entries(ur).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v, k);
// adjudications joined to audits
const byAt = new Map(A.map((a) => [a.at, a]));
const jt: Record<string, Record<string, number>> = {};
for (const j of J) { const a = byAt.get(j.auditAt); const k = `${a ? period(a.at) : "unjoined"} ${a ? a.result : "?"}`; jt[k] ??= {}; jt[k][j.verdict] = (jt[k][j.verdict] ?? 0) + 1; }
console.log("== adjudications by period x audit result"); for (const k of Object.keys(jt).sort()) console.log(k, JSON.stringify(jt[k]));
console.log("adjudicated", J.length, "distinct audits", new Set(J.map((j) => j.auditAt)).size, "red+unknown audits", A.filter((a) => a.result !== "green").length);
const reds = A.filter((a) => a.result === "red"); const adjReds = reds.filter((a) => J.some((j) => j.auditAt === a.at));
console.log("red audits", reds.length, "adjudicated", adjReds.length);
```

**[S:attrib]** — `M=/Users/owner/claude-fleet S=$S bun attrib.ts`

```ts
import { readFileSync } from "fs";
import { FAM } from "./famdef.ts";
const M = "/Users/owner/claude-fleet";
const A = readFileSync(M + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const J = readFileSync(M + "/audit-adjudications.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fam = (c: string) => FAM.find((f) => f.pats.some((p) => c.includes(p)))?.id ?? null;
for (const [label, from] of [["seit 09-02 (fails-Feld)", "2026-09-02"], ["seit 09-14", "2026-09-14"]] as const) {
  const reds = A.filter((a) => a.result === "red" && a.at >= Date.parse(from) && Array.isArray(a.fails) && a.fails.length);
  const redNoFails = A.filter((a) => a.result === "red" && a.at >= Date.parse(from) && !(Array.isArray(a.fails) && a.fails.length)).length;
  let allKnown = 0; const famCount: Record<string, number> = {}; const soleFam: Record<string, number> = {}; let unreg = 0; const unregNames: Record<string, number> = {};
  for (const a of reds) {
    const ids = a.fails.map(fam); const set = new Set(ids);
    if (ids.every((x: string | null) => x)) allKnown++; else { unreg++; for (const c of a.fails) if (!fam(c)) unregNames[c.slice(0, 90)] = (unregNames[c.slice(0, 90)] ?? 0) + 1; }
    for (const id of set) if (id) famCount[id] = (famCount[id] ?? 0) + 1;
    if (set.size === 1 && ids[0]) soleFam[ids[0]] = (soleFam[ids[0]] ?? 0) + 1;
  }
  const verdicts: Record<string, number> = {};
  for (const a of reds) for (const j of J.filter((j) => j.auditAt === a.at)) verdicts[j.verdict] = (verdicts[j.verdict] ?? 0) + 1;
  console.log(`== ${label}: red audits with fails ${reds.length} (+${redNoFails} red without fails list); only registered families ${allKnown}; with an unregistered fail ${unreg}`);
  console.log("   audits touched per family", JSON.stringify(Object.entries(famCount).sort((a, b) => b[1] - a[1])));
  console.log("   audits whose ONLY family is X (all fails in X)", JSON.stringify(Object.entries(soleFam).sort((a, b) => b[1] - a[1])));
  console.log("   verdicts on these audits", JSON.stringify(verdicts));
  console.log("   unregistered fail names:"); for (const [k, v] of Object.entries(unregNames).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log("     ", v, k);
}
```

**[S:hit]** — `M=/Users/owner/claude-fleet S=$S bun hit.ts`

```ts
import { readFileSync } from "fs";
import { FAM } from "./famdef.ts";
const M = "/Users/owner/claude-fleet";
const A = readFileSync(M + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const J = readFileSync(M + "/audit-adjudications.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fam = (c: string) => FAM.some((f) => f.pats.some((p) => c.includes(p)));
// one verdict per audit: the LAST adjudication for that auditAt
const last = new Map<number, string>(); for (const j of J) last.set(j.auditAt, j.verdict);
const reds = A.filter((a) => a.result === "red" && Array.isArray(a.fails) && a.fails.length);
const grp = { only: reds.filter((a) => a.fails.every(fam)), other: reds.filter((a) => !a.fails.every(fam)) };
for (const [k, rows] of Object.entries(grp)) { const v: Record<string, number> = {}; for (const a of rows) { const x = last.get(a.at) ?? "unadjudicated"; v[x] = (v[x] ?? 0) + 1; } console.log(k, rows.length, JSON.stringify(v)); }
// overall per-audit last verdict
const v: Record<string, number> = {}; for (const a of A.filter((a) => a.result === "red")) { const x = last.get(a.at) ?? "unadjudicated"; v[x] = (v[x] ?? 0) + 1; } console.log("all red audits, last verdict:", JSON.stringify(v));
const u: Record<string, number> = {}; for (const a of A.filter((a) => a.result === "unknown")) { const x = last.get(a.at) ?? "unadjudicated"; u[x] = (u[x] ?? 0) + 1; } console.log("unknown audits, last verdict:", JSON.stringify(u));
// last 40 non-short reds
const recent = A.filter((a) => !(a.proportional || a.cmdSource === "proportional")).slice(-40).filter((a) => a.result !== "green");
for (const a of recent) console.log(new Date(a.at).toISOString().slice(5, 16), a.result, a.reason?.slice(0, 60) ?? "", (a.fails ?? []).map((c: string) => c.slice(0, 60)).join(" | "), last.get(a.at) ?? "-");
```

**[S:audfix]** — `M=/Users/owner/claude-fleet S=$S bun audfix.ts`

```ts
import { readFileSync } from "fs";
import { FAM } from "./famdef.ts";
const M = "/Users/owner/claude-fleet";
const fix2: Record<string, string> = { "11.2g": "69615a52", "11.2s": "2a06185f", "11.2f": "54bae42f" };
const A = readFileSync(M + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((a) => Array.isArray(a.fails) && (a.checks?.ran ?? 0) > 0);
const anc = (x: string, y: string) => Bun.spawnSync(["git", "-C", M, "merge-base", "--is-ancestor", x, y]).exitCode;
for (const f of FAM) {
  const fix = fix2[f.id] ?? f.fix;
  const hit = A.filter((a) => a.fails.some((c: string) => f.pats.some((p) => c.includes(p))));
  if (!hit.length) continue;
  const post = fix ? A.filter((a) => anc(fix, a.mainSha) === 0) : A;
  const postHit = post.filter((a) => hit.includes(a));
  const days = [...new Set(hit.map((a) => new Date(a.at).toISOString().slice(5, 10)))].join(",");
  console.log(`${f.id}\thits ${hit.length}/${A.length}\tpost-fix ${postHit.length}/${post.length}\tdays ${days}`);
}
```

**[S:previews]** — `M=/Users/owner/claude-fleet S=$S bun previews.ts`

```ts
import { readFileSync } from "fs";
import { FAM } from "./famdef.ts";
const runs: any[] = JSON.parse(readFileSync(process.env.S + "/runs.json", "utf8"));
const lo = readFileSync("/Users/owner/claude-fleet/lane-outcomes.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const since = Date.parse("2026-09-14"), until = Date.parse("2026-09-18T12:00:00Z");
const landed = lo.filter((o) => o.disposition === "landed" && o.ts >= since && o.ts < until);
const e2eLands = landed.filter((o) => o.e2eTouched).length;
const fam = (c: string) => FAM.some((f) => f.pats.some((p) => c.includes(p)));
const P = runs.filter((r) => r.first >= since && r.first < until && !r.dir.includes("fleet-e2e-trail"));
let red = 0, onlyFam = 0, full = 0, redFull = 0, famFull = 0; const mins: number[] = [];
for (const r of P) {
  const fails = readFileSync(`${r.dir}/${r.f}`, "utf8").split("\n").filter((l) => l.includes('"ok":false')).map((l) => JSON.parse(l).check);
  const isFull = r.n >= 4000; if (isFull) { full++; mins.push((r.last - r.first) / 60000); }
  if (fails.length) { red++; if (isFull) redFull++; if (fails.every(fam)) { onlyFam++; if (isFull) famFull++; } }
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
const sum = mins.reduce((a, b) => a + b, 0);
console.log(`window 09-14..09-18 12Z: lands ${landed.length} (e2eTouched ${e2eLands}); local isolated runs ${P.length}, red ${red}, red only-registered-family ${onlyFam}; full(>=4000) ${full}, red ${redFull}, only-family ${famFull}; full median ${med(mins).toFixed(1)} min, sum ${sum.toFixed(0)} min`);
console.log("slots/offered present:", P.filter((r) => true).length);
```

**[S:lever4]** — `M=/Users/owner/claude-fleet S=$S bun lever4.ts`

```ts
import { readFileSync } from "fs";
const S = process.env.S!;
const checks: any[] = JSON.parse(readFileSync(S + "/checks.json", "utf8"));
const runs: any[] = JSON.parse(readFileSync(S + "/runs.json", "utf8"));
const since = Date.parse("2026-09-14");
const full = runs.filter((r) => r.first >= since && r.n >= 4000);
const ms = new Map<string, number>(); let total = 0;
for (const r of full) for (const line of readFileSync(`${r.dir}/${r.f}`, "utf8").split("\n")) {
  if (!line) continue; const o = JSON.parse(line); ms.set(o.check, (ms.get(o.check) ?? 0) + o.msSincePrev); total += o.msSincePrev;
}
const byName = new Map(checks.map((c) => [c.check, c]));
const inRecent = [...ms.keys()];
const cls = { neverRed100: 0, neverRedLow: 0, redSome: 0, msNever100: 0, msRed: 0, msLow: 0 };
for (const k of inRecent) { const c = byName.get(k); const m = ms.get(k)!;
  if (c.fail === 0 && c.runs >= 100) { cls.neverRed100++; cls.msNever100 += m; } else if (c.fail === 0) { cls.neverRedLow++; cls.msLow += m; } else { cls.redSome++; cls.msRed += m; } }
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
console.log("full P3 runs", full.length, "median checks/run", med(full.map((r) => r.n)), "median run min", (med(full.map((r) => r.last - r.first)) / 60000).toFixed(1));
console.log("distinct checks in these runs", inRecent.length, JSON.stringify(cls, null, 0));
console.log("share of wall time: never-red(>=100 runs)", (cls.msNever100 / total * 100).toFixed(1) + "%", "red-at-least-once", (cls.msRed / total * 100).toFixed(1) + "%", "never-red(<100 runs)", (cls.msLow / total * 100).toFixed(1) + "%");
const allN = checks.length, never = checks.filter((c) => c.fail === 0).length, never100 = checks.filter((c) => c.fail === 0 && c.runs >= 100).length;
console.log("all-time checks", allN, "never red", never, "never red with >=100 runs", never100, "red at least once", allN - never);
```
