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

> **Nachtrag 2026-09-09 (der Rest dieser Notiz ist unveraendert der Stand vom 2026-09-04).** Die
> Wurzel ist inzwischen bestimmt und repariert: `docs/verify-tiering.md` §11.2u. Zwei Saetze fuer
> jeden, der ueber diese Namen rechnet — der Nenner-Defekt, den der zweite Punkt oben beschreibt,
> ist behoben (`plantScreen` schreibt seit dem 2026-09-09 auch im Erfolgsfall eine Zeile), und die
> hier zitierten Zeilennamen mit Slotnummer existieren nicht mehr: die Slotnummer steht im Detail,
> und der Marker-Pflanzer dieses Blocks heisst jetzt
> `unbound succession: pane rendered the typed harness screen`. Die Zahlen oben bleiben gueltig
> fuer die Laeufe, die sie vermessen haben.

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

---

## 6. Nachtrag: die Dauer als Lastsensor — gepruft und als GENERELLER Treiber widerlegt

Anlass: zwei Startbelege des Controllers Slot 9 (2026-09-04, aus der Adjudikation von
`at=1788550781547` durch die Fleet-Betrieb-MAIN). (1) `ms` steht ungelesen in jeder Zeile von
`post-land-audits.jsonl` und ist ein Lastsensor; der 17-Fail-Lauf war mit 38,3 min der laengste
lokale Audit im Ledger. (2) §11.2o `projection nextAction` ist HEUTE auf ~22 % gesprungen gegen
~0,5 % davor, Faktor ~40.

Beide Hinweise waren richtig und beide fuehren woanders hin, als die naechstliegende Lesart nahelegt.

### 6.1 Roh sieht die Last-Lesart zwingend aus

105 lokale Voll-Audits (`checks.ran > 3000`), nach Dauer in Quartile geschnitten:

| Quartil | Dauer | n | rot |
| --- | --- | ---: | ---: |
| Q1 | 20,9–24,1 min | 26 | 8 (31 %) |
| Q2 | 24,1–25,1 min | 26 | 8 (31 %) |
| Q3 | 25,2–27,0 min | 26 | 14 (54 %) |
| Q4 | 27,1–40,4 min | 27 | 21 (78 %) |

Monoton, und der Abstand ist gross. Genau so soll ein Lastsensor aussehen.

### 6.2 Der Test, der ihn umwirft: dasselbe noch einmal, mit festgehaltenem TAG

Die Dauer waechst ueber die Tage, und die Rot-Rate waechst ueber die Tage. Das macht jede Rechnung,
die beide ueber das ganze Fenster vergleicht, zu einer Aussage ueber das DATUM. Also derselbe
Vergleich neun Mal getrennt, je Tag mit n >= 6, langsamere gegen schnellere Haelfte:

**Gepoolt: langsamere Haelfte 25/47 = 53 % rot, schnellere Haelfte 23/47 = 49 % rot.**

Vier Prozentpunkte. Der Gradient aus 6.1 (31 % -> 78 %) ist damit im Wesentlichen
**Datums-Konfundierung**, nicht Last. Fuer den einzelnen 38,3-min-Lauf bleibt die Beobachtung des
Controllers unberuehrt — er war der laengste und er trug die Kaskade; sie verallgemeinert nur nicht.

### 6.3 Was die Dauer stattdessen misst: die Suite ist gewachsen, die Maschine nicht langsamer

| Tag | median `checks.ran` | median min | ms je Check |
| --- | ---: | ---: | ---: |
| 08-24 | 3 011 | 24,6 | 491 |
| 08-28 | 3 133 | 21,0 | 403 |
| 09-01 | 3 366 | 25,9 | 462 |
| 09-04 | 3 602 | 28,6 | 477 |

`ran` waechst monoton um 20 % (3 011 -> 3 602). **`ms` je Check bleibt flach** (403–499, ohne
Trend). Die Dauer-Drift ist also fast vollstaendig Suite-WACHSTUM, nicht eine langsamer werdende
Maschine.

### 6.4 Der eigentliche Treiber, und er korrigiert die Rangliste aus §2

Rot-Rate je Familie je Tag (rote Laeufe / Laeufe mit ausgefuehrter Familie):

| Familie | 08-26 | 08-29 | 08-30 | 09-01 | 09-02 | 09-03 | 09-04 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| watch pi-unfenced | 0/12 | 0/23 | **6/16** | 6/31 | 7/37 | 1/23 | 5/34 |
| busy-receiver | 0/12 | 0/23 | 0/16 | 0/31 | **12/37** | 17/23 | 15/33 |
| succession-pane | – | – | – | – | – | – | **8/25** |
| projection | 1/12 | 0/22 | 0/14 | 0/30 | 2/36 | 0/23 | **6/32** |
| merge re-run-Guard | 1/12 | 0/23 | 0/14 | 0/31 | 1/36 | 3/23 | **5/33** |

Jede Familie springt von **exakt null** auf ihre Dauerrate — an dem Tag, an dem sie gelandet ist.
watch pi-unfenced: 0/53 vor dem 30.08., danach ~15 % durchgehend. busy-receiver: 0/113 vor dem
02.09. succession-pane: heute geboren, 8/25.

**Der Generator ist damit benannt, und er ist keine der einzelnen Familien: eine neue Check-Familie
landet ohne eigenen Flake-Beweis und ist von Geburt an rot.** Jede Familie der Rangliste in §2 ist
so entstanden. Die Reihenfolge in §2 bleibt richtig — die Familien sind echt und einzeln
reparierbar —, aber das Kriterium (b) des Programs (lokale Rot-Rate unter 2/10 ueber 5 Tage) ist
**mit Reparaturen allein nicht erreichbar**, solange derselbe Weg weiter neue rote Familien
nachliefert.

### 6.5 Was daraus NICHT folgt

- „Kaskade unter Last" bekommt **keine** eigene Programm-Zeile als Last-Familie; 6.2 traegt sie
  nicht. Die Kaskaden-FORM (eine nicht gehaltene Vorbedingung, zwoelf rote Vertraege) ist als
  §11.2p registriert und bleibt echt.
- Die AUTOCLOSE-Hypothese des Controllers (`FLEET_LANE_AUTOCLOSE=1` im Audit-`srv`) ist waehrend
  der Niederschrift dieses Nachtrags von Lane `0a099c62` **am Prozess widerlegt**: `auditChildEnv`
  verwirft jede `FLEET_*`-Variable, der Audit-Suite-Server traegt die `1` also nicht (waehrend
  `FLEET_PORT` in derselben Abfrage lesbar ist — die Sonde konnte messen). Der echte Durchgriff
  sitzt anderswo, bei `runVerify`: die LAND-GATE-Kette wird ohne env-Option gespawnt und erbt die
  volle Server-Umgebung. Fuer das 17-Fail-AUDIT faellt die Erklaerung damit weg. Anmerkung: das
  Regelbuch fuehrt den Flag als „Stand 2026-09-04: GEBAUT, nie gelaufen"; `./state.sh` zeigt ihn
  live auf `1`. Diese Zeile ist ueberholt.
- Damit steht §11.2o **ohne Ursache** da, und 6.4 ist die einzige verbliebene gemessene Erklaerung
  fuer den 09-04-Sprung: die Familie ist an dem Tag als schon-rote Familie in die Suite gekommen.
  Das ist eine ATTRIBUTION, keine Diagnose — die Wurzel von §11.2o bleibt offen.
- Eine Regel „keine neue Check-Familie ohne N gruene serielle Laeufe" waere die Konsequenz aus 6.4.
  Sie ist hier **vorgeschlagen, nicht gesetzt** — in diesem Repo wird eine Dauerregel erst durch
  Owner-Promotion normativ.

---

## 7. Nachtrag II: Nebenlaeufigkeit direkt aus dem Trail gemessen — und als Erklaerung ausgeschlossen

Anlass: dasselbe Fehler-TRIO fiel am 2026-09-05 auf zwei aufeinanderfolgenden Audits (`ed36971`
`at=1788565731607` und `5202fd6` `at=1788567702804`), beide docs-only, beide ohne Kante zum Diff.
Zwei identische Trios hintereinander sehen nicht nach Muenzwurf aus, und zur selben Zeit stand der
Suite-Mutex mit fuenf Wartenden (laengste Wartezeit 1 h 38). Das ist die Last-Lesart in ihrer
staerksten Form, also noch einmal gepruft — diesmal mit einem Sensor, den §6 nicht hatte.

**Der Sensor:** jede Trail-Zeile traegt `ts`. Aus erster und letzter Zeile einer Laufdatei ergibt
sich das Zeitintervall des Laufs; die Ueberlappung zweier Intervalle ist damit direkt zaehlbar.
Das misst Nebenlaeufigkeit **ohne** Prozess-`grep` und rueckwirkend ueber das ganze Register
(223 isolated-Laeufe mit Zeitstempeln, 9 Tage).

**Das Ergebnis, in einem Satz: die Ueberlappung ist praktisch ueberall NULL.**

| Familie | rot/Laeufe | median Ueberlappung rot | gruen | median Dauer rot | gruen |
| --- | ---: | ---: | ---: | ---: | ---: |
| unbound succession | 8/32 | 0 | 0 | 29,5 min | 30,5 min |
| delivers WHOLE | 8/32 | 0 | 0 | 30,1 min | 30,3 min |
| projection §11.2o | 16/198 | 0 | 0 | 31,7 min | 26,7 min |

Genau **drei** von 223 Laeufen ueberlappen ueberhaupt einen anderen, und alle drei sind GRUEN.

Zwei Schluesse:

1. **Der Suite-Mutex haelt.** Isolierte Laeufe laufen auf dieser Maschine faktisch nie gleichzeitig,
   auch nicht in einer Schlange mit fuenf Wartenden. Die Warnung des Regelbuchs („zwei
   `./e2e-isolated.sh` gleichzeitig vergiften sich gegenseitig") beschreibt eine echte Gefahr, aber
   keinen eingetretenen Zustand — und ein Beweislauf, der endlich drankommt, wird nicht von einem
   parallelen isolierten Lauf verdorben. Das ist eine gute Nachricht fuer die Beweisfuehrung des
   Programs.
2. **Fuer die succession-pane-Familie ist Last als Erklaerung ausgeschlossen**, und zwar auf beiden
   Achsen: die roten Laeufe ueberlappen so wenig wie die gruenen, und sie sind sogar minimal
   KUERZER (29,5 gegen 30,5 min). Wer dort eine Renn-Wurzel sucht, sucht sie nicht in der
   Maschinenbelegung. Fuer §11.2o bleibt ein schwacher Dauer-Unterschied (31,7 gegen 26,7 min) —
   derselbe schwache Effekt wie in §6.2, und dort war er gepoolt vier Prozentpunkte wert.

**Was dieser Nachtrag NICHT ausschliesst:** Last aus allem, was KEIN isolierter Lauf ist — Lanes,
Land-Gates, Builds, der Server selbst. Der Sensor sieht nur Trail-schreibende Laeufe. Die Aussage
lautet also praezise: *isolierte Laeufe stoeren einander nicht*, nicht *die Maschine war ruhig*.

**Und das Trio bleibt damit unerklaert.** Zwei identische Trios hintereinander sind bei 25 % · 25 %
· 8 % unwahrscheinlich genug, dass „Zufall" die schwaechste der offenen Antworten ist; die beiden
staerkeren — eine gemeinsame Wurzel der drei, oder ein Zustand der Maschine, den der Trail nicht
sieht — sind beide offen. Fail 2 ist ausserdem laut Controller eine FOLGE von Fail 1, was das Trio
auf zwei unabhaengige Wurzeln reduziert und die Unwahrscheinlichkeit entsprechend mildert.
