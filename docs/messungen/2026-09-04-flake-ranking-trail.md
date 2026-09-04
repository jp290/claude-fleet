# Flake-Ranking aus dem Trail-Register — 7 Tage bis 2026-09-04, Suite `isolated`

urteil: 112 von 191 isolierten Suite-Laeufen (59 %) sind in sieben Tagen rot — deshalb hat ein
rotes Post-Land-Audit heute keinen Signalwert. Nach Basisrate INNERHALB des jeweils eigenen
Reparatur-Fensters fuehrt die pi-unfenced-Watch-Familie (§11.2j) mit 10/79 = 12,7 % auf sieben
Baeumen, obwohl sie am 2026-09-01 repariert wurde; danach Q6-fleet-report 6/87, succession-pane
10/180, merge-rerun-guard 9/175, Q5-fleet-report 6/135, projection 7/171. Zwei Reparaturen
HALTEN nachweislich: raw-review 0/76 nach `05f37f1`, busy-receiver 0/11 nach `7d089c1`.

Erhoben als erster Akt des Programs „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`),
das aus der Owner-Frage vom 2026-09-04 21:2x („was hat es eigentlich mit diesen nachrichten immer
auf sich … vllt die audits ausbessern oder sowas") entstand. Die Notiz ist die gemeinsame
Rangliste, auf die sich jede Zeile dieses Programs beruft.

## 1. Datenbasis und Methode

Quellen: `e2e-trail/*.jsonl` im Haupt-Checkout plus `$TMPDIR/fleet-e2e-trail/` (dorthin schreiben
Laeufe ohne aufloesbaren Git-Baum, u. a. Post-Land-Audits). Fenster: Dateien mit mtime der letzten
sieben Tage — 1 688 Dateien, davon 191 mit `suite == "isolated"`. Ein Lauf gilt als rot, sobald er
mindestens eine `ok:false`-Zeile traegt.

- 191 isolierte Laeufe, **112 rot = 59 %**
- 104 verschiedene Baeume
- **32 Laeufe ohne `tree`** — dort ist jede Attribution unmoeglich. Sie sind aus allen
  Fenster-Rechnungen unten ausgeschlossen, weshalb die Nenner der Nach-Fix-Fenster
  UNTERGRENZEN sind.

Fenster je Familie: wo eine Familie schon einmal repariert wurde, zaehlt nur, was auf Baeumen lief,
die den Fix enthalten (`git merge-base --is-ancestor <fix> <tree>`). Sonst zaehlen alle sieben Tage.
Das ist die Beweisordnung aus `docs/verify-tiering.md` §11.2l: es entscheidet das Register, nicht
ein Rerun — bei 2–13 % Basisrate beweist ein gruener Rerun nichts.

## 2. Die Rangliste

| Familie | rote Laeufe / Laeufe | Rate | Baeume | Fenster |
| --- | --- | --- | --- | --- |
| watch pi-unfenced (§11.2j) | 10/79 | 12,7 % | 7 | nach `b20e7e4` |
| Q6 fleet-report | 6/87 | 6,9 % | 4 | 7 Tage |
| succession-pane (`e2e/programs.ts`) | 10/180 | 5,6 % | 7 | 7 Tage |
| merge re-run-Guard (§11.2n) | 9/175 | 5,1 % | 8 | 7 Tage |
| Q5 fleet-report | 6/135 | 4,4 % | 6 | 7 Tage |
| projection nextAction (§11.2o) | 7/171 | 4,1 % | 5 | 7 Tage |
| raw-review (§11.2k) | 0/76 | 0 % | 0 | nach `05f37f1` |
| busy-receiver (§11.2l) | 0/11 | 0 % | 0 | nach `7d089c1` |

Ein Lauf zaehlt fuer eine Familie nur, wenn er mindestens einen ihrer Checks ueberhaupt erreicht
hat — eine Suite, die vorher abbricht, verduennt die Rate nicht.

**Die zwei letzten Zeilen sind der eigentliche Befund dieser Erhebung**: die Beweisordnung
funktioniert. `05f37f1` (raw-review) haelt ueber 76 Laeufe, `7d089c1` (busy-receiver, gelandet
heute) ueber 11. Roh, ueber alle sieben Tage, fuehrt busy-receiver mit 44/178 = 24,7 % auf 27
Baeumen die Liste an — die Zahl ist historisch, nicht aktuell, und genau deshalb ist das
Nach-Fix-Fenster die richtige Sortierung.

## 3. Warum §11.2j oben steht

Die Familie wurde am 2026-09-01 test-seitig repariert (`b20e7e4`). Vor dem Fix: **13/34 = 38 %**.
Nach dem Fix: **10/79 = 12,7 %** auf sieben Baeumen. Der Fix hat also gewirkt und die Familie
nicht geschlossen. Die aufgezeichneten Details zeigen mindestens zwei getrennte Faeden:

- `attempts` von 100 bis 341 auf Zeilen, deren Empfaenger-Composer laut Fixture besetzt ist
  (`{"living":"pending","attempts":341,"doomed":"pending"}`), dazu `draftBytes:546` statt 45 —
  der pre-paste-Refusal-Pfad wurde nicht genommen, die VORBEDINGUNG der Fixture hielt nicht.
- `freed:400` in `subject-gone` — die Budget-Tuer weigert sich, obwohl eine Zeile terminal wurde.
  Das ist ein eigener Faden und faellt auch dort, wo `gone` korrekt `subject-gone` liest.

Die Vorbedingung „der Composer haelt exakt `draft`" steht heute als Teilbedingung IN der Messung
(`heldDraft.text === draft` in der `held`-Assertion, `e2e/watch.ts`), nicht als eigener `check()`.
Damit liest sich „nie gemessen" wie „Vertrag verletzt" — genau die Klasse, die das Regelbuch als
„eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern" fuehrt.

## 4. Die offene Frage des Programs zu `unbound succession: pane s8` — beantwortet

Die Programm-Evidenz fuehrte „`unbound succession: pane s8 rendered the harness screen` faellt 2/2
auf EINEM Baum" und machte daraus das Tor vor allem anderen. Am Register korrigiert:

- Es sind **drei** Vorkommen, nicht zwei, und auf **zwei** Baum-Identitaeten: zweimal auf
  `ad75273a` (von dessen drei Laeufen) und einmal in einem Lauf **ohne** `tree`.
- „2/2" bzw. „3/3" war **nie eine Rate**: `plantScreen` (`e2e/harness.ts#plantScreen`) legt diese
  Zeile AUSSCHLIESSLICH im Fehlerfall an. Der einzig ehrliche Nenner ist die Setup-Zeile derselben
  Sektion, die in **24** Laeufen auf **13** Baeumen lief — also 3/24 = 12,5 %.
- Das Detail lautet jedes Mal woertlich „the pane died with the command". Diese Zeile schreibt
  `plantScreen`, wenn `respawn-pane` mit 0 zurueckkam, der Screen aber binnen 5 s nicht erschien
  UND `has-session` auf denselben Slot fehlschlug: die gepflanzte Stand-in-Pane war weg. Das ist
  eine Aussage ueber die FIXTURE der Suite, nicht ueber die Succession-Naht des Servers. Warum die
  Pane wegging (Stand-in beendet, Session abgeraeumt, etwas Drittes), ist hier NICHT bestimmt.
- Die Schwester-Zeile derselben Sektion, `…and delivers it WHOLE once that marker appears`, faellt
  6/24 = 25 % mit `500 {"error":"successor delivery held (not-alive)"}` — dieselbe Richtung
  (die gepflanzte Pane gilt als nicht lebendig). Ein einzelner Fehlschlag dort traegt stattdessen
  `401 {"error":"unauthorized"}` und ist ein DRITTER, hier nicht untersuchter Faden.

**Konsequenz:** die Frage ist mit „Fixture" beantwortet und ist kein Tor. Die Familie
succession-pane steht mit 5,6 % auf Rang 3 und wird in ihrer eigenen Zeile bearbeitet, nicht vor
allen anderen.

## 5. Was diese Erhebung NICHT sagt

- Sie misst Laeufe, nicht Audits. Dass 59 % der isolierten Laeufe rot sind, erklaert die Rot-Rate
  der Post-Land-Audits, ersetzt aber die Messung (b) des Programs nicht — die wird an
  `post-land-audits.jsonl` gemacht.
- Sie nennt fuer keine Familie ausser §11.2j einen Mechanismus. Die Raten sind eine REIHENFOLGE,
  keine Diagnose.
- Die 32 Laeufe ohne `tree` bleiben unattribuierbar. Dass der Runner `tree` in JEDE Zeile schreibt,
  ist ein offener Schnitt-Kandidat aus der Programm-Evidenz; er ist hier nicht gebaut.
- Sieben Tage sind das Fenster, weil aeltere Trail-Dateien fuer die heutigen Fixtures nichts
  aussagen. Fuer eine Familie mit 4 % Basisrate ist auch dieses Fenster duenn.
