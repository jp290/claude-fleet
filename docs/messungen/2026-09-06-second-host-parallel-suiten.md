---
frage: Bleiben auf dem Second-host zwei gleichzeitige `./e2e-isolated.sh`-Laeufe desselben Baums so gruen wie ein serieller?
urteil: Ja, mit einer Bedingung. Zwei gleichzeitige Suiten kosten auf dem Second-host 0,2 % Laufzeit, 224 MB und 0,26 Lastpunkte von 16 Threads und erzeugen im sauberen Zwei-Suiten-Fenster keinen Fail ueber die serielle Baseline hinaus (Arm A ALL PASS), womit die Mac-Regel „Fehler auf BEIDEN Baeumen" fuer dieses Geraet nicht gilt; der Deckel muss aber ZAEHLEN statt messen, denn `maxLoad1=4` sieht eine zweite Suite strukturell nicht (drei kamen auf Peak-Load1 1,32) und der Daemon hat waehrend der Messung ungefragt eine dritte gestartet
bereich: [multi-host, verify, helper-daemon, suite-kontention]
belege: [e2e-stage.sh, helper-daemon/daemon.ts#localMode, 'e2e/watch.ts#"D2 setup: both closing lanes"', 'e2e/steward-core.ts#"transcript fact: a pinned slot reports"', e2e/restart.ts#PLANTED_TR, 31c39fdcead804a8cf4e65438496d65e8409c807, docs/messungen/2026-09-04-falsifikator-second-host.md]
nicht-gemessen: Vier oder mehr gleichzeitige Suiten, der Land-Gate-Pfad (drei Wrapper, drei Mutex-Runden) und ob die zwei roten Checks unter Last HAEUFIGER werden — n=1 je Arm
stand: 2026-09-06
---

# Traegt der Second-host zwei gleichzeitige `./e2e-isolated.sh`?

2026-09-06, Lane `fleet/260906120032-6390`, gemessen per ssh auf dem Geraet „second-host"
(Debian 13, 16 Threads, 7 858 MB RAM, `/tmp` als tmpfs 3 930 MB). Frage:
**Erzeugt Parallelitaet dort dieselben Fehler auf beiden Baeumen wie auf dem 8-GB-Mac, dessen
Messung der Grund fuer den EINEN Suite-Mutex ist (`CLAUDE.md` §Lane discipline)?**

Alle drei Laeufe auf demselben Baum `31c39fdc`, `dirty:false` (aus den Trail-Zeilen abgelesen,
nicht behauptet), jeder in einer eigenen Kopie mit eigenem `FLEET_SUITE_LOCK` — der Mutex haette
sie sonst serialisiert, und genau ihn zu umgehen war der Zweck.

## Ergebnis

| Lauf | Checks | Fails | Dauer | Exit | Trail-Datei |
|---|---:|---:|---:|---:|---|
| Baseline (1 Suite, seriell) | 3 742 | 1 | 2 101 s | 1 | `isolated-20260906T120356Z-682468` |
| Arm A (2 gleichzeitig) | 3 742 | **0** (ALL PASS) | 2 106 s | 0 | `isolated-20260906T124005Z-798898` |
| Arm B (2 gleichzeitig) | 3 742 | 2 | 2 107 s | 1 | `isolated-20260906T124005Z-798897` |

Die Sensoren sind maschinenweit und lassen sich nicht je Arm zuordnen — beide Arme teilen dieselbe
Maschine. Sie stehen darum unten als Fenster-Tabelle, nicht als Spalten hier. Gemessen alle 15 s
aus `/proc/loadavg` und `/proc/meminfo`; „RAM belegt" = `MemTotal − MemAvailable`, Leerlauf vor
der Messung 1 013 MB. **Swap blieb in allen drei Fenstern bei 0 MB.** Die Kurzfassung:
Peak-Load1 0,94 → 1,20, Peak-RAM 1 319 → 1 543 MB, Peak `/tmp` 230 → 271 MB.

**Laufzeit: +5 s und +6 s gegen die Baseline, also +0,24 % und +0,29 %.** Das ist die zentrale
Zahl. Sie ist so klein, weil die Suite auf diesem Geraet nicht rechenbegrenzt ist: bei EINER Suite
liegt die 1-Minuten-Last im Mittel bei 0,21 von 16 Threads — 1,3 % der Maschine. Die Suite wartet,
sie rechnet nicht. Ein zweiter Arm konkurriert deshalb um fast nichts.

**Speicher: +224 MB fuer den zweiten Arm** (1 543 gegen 1 319 MB Spitze), also ~250–300 MB je
Suite ueber dem Leerlauf. Bei 7 858 MB und 6 812 MB frei zum Startzeitpunkt ist Speicher hier
nicht die bindende Groesse. Auch `/tmp` nicht: die Instanz-Verzeichnisse liegen im tmpfs und
kosten ~45 MB je Lauf, Spitze 271 MB von 3 930 MB.

### Die drei Fails, einzeln benannt

1. **Baseline, `D2 setup: both closing lanes reached the spent shape …`** (`e2e/watch.ts`).
   KEINE neue Signatur: `docs/messungen/2026-09-04-falsifikator-second-host.md` §5/§9 fuehrt genau
   diesen Check als second-host-lastige Sonde (dort 2 rot in 2 eigenen Laeufen, 0 rot in 5 lokalen;
   §9 derselben Notiz korrigiert das dann selbst zu „faellt nicht in jedem Second-host-Lauf").
   Basisrate im lokalen Mac-Trail-Register: **1 rot in 47 Sichtungen (2,1 %)**. Keiner der
   registrierten §11.2*-Familien zugeordnet — die Notiz von 2026-09-04 sagt das ausdruecklich und
   nennt die Sonde eine korrekt als sie selbst fallende Vorbedingungspruefung.
2. **Arm B, derselbe `D2 setup`-Check**, ts 14:44:26 — also im Zwei-Suiten-Fenster. Arm A war an
   derselben Stelle GRUEN. Beide Arme liefen zeitgleich auf demselben Baum, also ist die
   Nicht-Determiniertheit dieser Sonde hier direkt belegt: 1 Baum, 3 Laeufe, 2 rot, 1 gruen.
3. **Arm B, `transcript fact: a pinned slot reports its transcript's exact bytes + a plausible
   mtime`** (`e2e/steward-core.ts`), Detail `null`, ts **15:09:53**. Nicht als Familie
   registriert, aber auch **nicht neu**: im lokalen Mac-Trail-Register steht sie bei **1 rot in
   675 Sichtungen (0,15 %)**, und diese eine Sichtung
   (`isolated-20260818T044408Z-91626.jsonl`, 2026-08-18) traegt **dasselbe Detail `null`** —
   dieselbe Signatur, nicht nur derselbe Check.

Kein Fail in irgendeinem Arm ist NEU. Beide Signaturen sind im Register vorhanden, eine davon
ausdruecklich als Second-host-Signatur.

## Die Bedingung: der Daemon hat mitten in die Messung eine DRITTE Suite gestellt

Um **15:06:47** hat `fleet-helper` auf demselben Geraet ein echtes Audit geclaimt
(`claimed audit claude-fleet main@3f584914`) und dazu einen dritten `./e2e-isolated.sh` gestartet —
waehrend beide Arme noch liefen (sie endeten 15:15:09 und 15:15:10). Die letzten **8 min 23 s**
des Paar-Fensters sind also ein DREI-Suiten-Fenster, und das ist in den Sensoren zu trennen:

| Fenster | Samples | Peak-Load1 | Mittel-Load1 | Peak-RAM belegt | Peak `/tmp` | Swap |
|---|---:|---:|---:|---:|---:|---:|
| 1 Suite (Baseline) | 143 | 0,94 | 0,21 | 1 319 MB | 230 MB | 0 |
| 2 Suiten (14:40:03–15:06:47) | 107 | 1,20 | 0,41 | 1 543 MB | 271 MB | 0 |
| 3 Suiten (15:06:47–15:15:10) | 34 | 1,32 | 0,71 | 1 824 MB | 299 MB | 0 |

**Und der eine Fail, der die Baseline-Signatur ueberschreitet, liegt in diesem dritten Fenster:**
`transcript fact` fiel 15:09:53, drei Minuten nach dem Eintritt der dritten Suite. Der
`D2 setup`-Fail von Arm B liegt dagegen bei 14:44:26 im sauberen Zwei-Suiten-Fenster.

Das ist **Korrelation bei n=1, kein Kausalbeweis** — die Basisrate 0,15 % existiert unabhaengig von
Last, und ein einzelner Treffer beweist keinen Mechanismus. Aber die Aussage, die diese Notiz
tragen kann, ist praezise: **im sauberen Zwei-Suiten-Fenster hat das Paar keinen Fail erzeugt,
den die serielle Baseline nicht auch hatte.** Der einzige darueber hinausgehende Fail faellt in
das Fenster, in dem eine dritte Suite dazukam.

### Warum der Daemon das durfte — und warum das der eigentliche Befund ist

`helper-daemon/daemon.ts#localMode` kennt genau drei Tore: `enabled`, Quiet Hours und
`maxLoad1`. Der Host-Config setzt `maxLoad1` auf 4. Der Daemon hat waehrend meines gesamten
Paar-Fensters durchgehend `mode active` protokolliert; sein hoechster eigener Messwert zwischen
14:40 und 15:16 war **1,26** (15:05:59), also gut ein Drittel der Schwelle. Nach dem Claim
protokolliert er ueberhaupt keinen Modus mehr, solange der Job laeuft — die letzte Zeile vor
Ende der Messung ist der Claim selbst. **Der Lastdeckel des Daemons kann eine
zweite oder dritte gleichzeitige Suite auf diesem Geraet strukturell nicht verhindern** — die
Suite erzeugt zu wenig Last, um ihn auszuloesen. Was sie heute verhindert hat, ist allein der
Suite-Mutex `/tmp/fleet-e2e.lock`, den ich fuer die Messung absichtlich umgangen habe.

Der Daemon hat sein Audit nicht falsch gemacht: aus seiner Sicht war die Maschine bei Last 0,84
leer. Er hat kein Instrument, das „zwei fremde Suiten laufen" sagt, ausser dem Mutex.

**Offengelegt, weil es ein fremdes Ergebnis beruehrt:** das Audit von `main@3f584914` lief seine
ersten 8,5 Minuten neben meinen zwei Armen. Faellt es rot aus, ist ein Teil dieser Roete
moeglicherweise meine.

## Urteil: ist ein zweiter Mutex-Slot dort tragbar?

**Ja, unter einer Bedingung.** Die Zahlen tragen es: 0,2 % Laufzeitaufschlag, 224 MB, 0,26
Lastpunkte von 16 verfuegbaren, kein Swap, kein Fail ueber die serielle Baseline hinaus im
sauberen Fenster. Die Mac-Regel „zwei Suiten gleichzeitig erzeugen hier Fehler auf BEIDEN
Baeumen" ist eine MAC-Messung und uebertraegt sich nicht auf dieses Geraet — sie bleibt fuer den
Mac gueltig und ist hier nicht angetastet.

Die Bedingung hat drei Teile, und sie folgen aus dem, was heute passiert ist:

1. **Der Deckel muss der Mutex sein, nicht der Lastdeckel.** `maxLoad1: 4` ist fuer diese
   Arbeitslast kein Sensor — 3 Suiten kamen auf Peak 1,32. Ein „max parallel claims"-Feld muss
   ZAEHLEN, nicht messen.
2. **Zwei, nicht mehr.** Diese Notiz misst 2 sauber und 3 nur als 8-Minuten-Randfenster mit genau
   einem Fail darin. Ein Deckel von 2 ist belegt; ein Deckel von 3 waere es nicht.
3. **Der `suiteTimeoutSec: 3600` des Daemons bleibt tragfaehig** — 2 107 s parallel gegen 2 101 s
   seriell laesst 24 Minuten Luft. Bei einem Deckel > 2 muesste diese Zahl neu geprueft werden,
   weil sie nicht mitwaechst.

Der Folgeschnitt (ein Daemon-Feld `max parallel claims`) ist ausdruecklich nicht Teil dieser
Messung.

## Methode

```sh
# auf second-host, aus ~/private-repo-w; jeder Lauf in einer eigenen Kopie von ~/claude-fleet,
# beide per `git checkout 31c39fdc` auf den Baseline-Baum gepinnt
cat run.sh   # exportiert PATH (launchd/ssh-PATH kennt ~/.bun/bin nicht), setzt
             # FLEET_SUITE_LOCK je Arm, misst Start/Ende, schreibt <log>.result

# Sensor, alle 15 s: epoch HH:MM:SS load1 load5 memTotal memAvail swapUsed tmpUsed nIsolated nBun
cat sampler.sh

# Baseline
./run.sh ~/private-repo-w/A /tmp/private-repo-w-A.lock ~/private-repo-w/base.log BASE

# Paar, gleichzeitig gestartet
./run.sh ~/private-repo-w/A /tmp/private-repo-w-A.lock ~/private-repo-w/armA.log ARMA &
./run.sh ~/private-repo-w/B /tmp/private-repo-w-B.lock ~/private-repo-w/armB.log ARMB &
```

**Artefakte auf dem Geraet:** `~/private-repo-w/keep/` traegt die drei Suite-Logs mit allen PASS/FAIL-
Zeilen, die drei `.result`-Dateien (Exit + Dauer), beide Sensor-Reihen und den Baseline-Trail.
Die beiden ARM-Trail-Dateien sind beim Aufraeumen der Baumkopien mitgeloescht worden: die oben
zitierten Fail-Zeitstempel (14:44:26, 15:09:53) und das Detail `null` stammen aus ihnen und
wurden vor dem Loeschen abgelesen, sind auf dem Geraet aber nicht mehr nachschlagbar. Die Logs
tragen dieselben Fail-Zeilen samt Detail, nur ohne Zeitstempel.

Fails und Zeitstempel wurden aus den Trail-Dateien gelesen
(`e2e-trail/isolated-*.jsonl`, `"ok":false`), nicht aus dem Log-Tail — der ist hinter `nohup`
blockgepuffert. Die Basisraten stammen aus dem lokalen Mac-Register
(`/Users/owner/claude-fleet/e2e-trail/`, 6 385 Dateien): Sichtungen = Dateien, die den
Check-Namen tragen; rot = Zeilen mit `"ok":false` fuer diesen Namen.

## Was nicht gemessen wurde

- **Vier oder mehr gleichzeitige Suiten.** Die Kurve zwischen 2 und 3 ist flach, aber zwei Punkte
  sind keine Kurve.
- **Der Land-Gate-Pfad.** Gemessen ist `./e2e-isolated.sh`. Ein Land-Gate nimmt den Mutex DREIMAL
  (`e2e-clean-review.sh`, `e2e-security.sh`, `e2e-claude-gate.sh`, je eigenes `e2e-stage.sh`); ob
  zwei parallele Gates sich anders verhalten als zwei parallele Isolated-Laeufe, sagt diese
  Messung nicht.
- **Ob die zwei roten Checks unter Last HAEUFIGER werden.** n=1 je Arm. Fuer `transcript fact`
  waere die Gegenprobe ein serieller Wiederholungslauf mit derselben Sonde; er wurde nicht
  gefahren.
- **Der Mac.** Die Mac-Messung hinter der Regelbuch-Zeile wurde nicht wiederholt und nicht
  angezweifelt.
- **Ein Nebenbefund, nicht angefasst:** `/tmp/fleet-e2e.lock` trug beim Messbeginn die tote PID
  560072 (seit 11:16). Das Lock heilt sich beim naechsten Anwaerter selbst (Reap-Regel in
  `e2e-stage.sh`); es wurde bewusst nicht von Hand geraeumt.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-06T12:02:00Z	aufbau	zwei Kopien von ~/claude-fleet statt des Daemon-Work-Trees	der Daemon-Tree wird von daemon-update ersetzt und stand auf 780d2f5, fuenf Commits hinter main	ls /var/lib/fleet-helper/work	A und B auf 31c39fdc
2026-09-06T12:03:00Z	aufbau	Baseline im selben Kopie-Setup wie die Arme, nicht im Original	sonst waere die Baseline nicht mit sich selbst vergleichbar	run.sh	Baseline = Arm-A-Baum
2026-09-06T12:03:30Z	aufbau	PATH in run.sh exportiert	nicht-interaktives ssh kennt ~/.bun/bin nicht — erster Versuch starb an `bun: not found`	base.log erster Lauf	Abbruch nach 31 s, sauber neu gestartet
2026-09-06T12:39:00Z	aufbau	beide Kopien auf 31c39fdc gepinnt statt frisch kopiert	~/claude-fleet war waehrend der Baseline auf 7b43011e gewandert	git log -1 vor dem Pin	drei Laeufe auf EINEM Baum
2026-09-06T13:06:47Z	stoerung	die dritte Suite nicht abgebrochen	es ist ein echtes Audit; ein Abbruch haette ein fremdes Ergebnis zerstoert, die Trennung im Sensor kostet nichts	journalctl claimed audit	Fenster 2 und 3 getrennt ausgewertet
2026-09-06T13:30:00Z	auswertung	Fails gegen das Mac-Trail-Register statt gegen die Familienliste gezaehlt	beide Checks stehen in KEINER §11.2*-Familie; ohne Basisrate waere „neu" eine Behauptung	e2e-trail/ 6385 Dateien	2,1 % und 0,15 %, beide bekannt
```
