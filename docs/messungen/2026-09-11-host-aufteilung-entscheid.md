# Host-Aufteilung: der Entscheid, und die Messungen, die die Frage umgestellt haben

Owner-Entscheid 2026-09-11. Eigenes Dokument, wie `HANDOFF.md` §5.4 verlangt — ausdruecklich
KEINE Erweiterung von `f3ca2e05`. Alle Zahlen sind an diesem Tag gemessen, Methode je Zeile
genannt, damit sie nachgefahren werden koennen. Ein Wert ohne Methode ist hier keiner.

## 0 · DER ENTSCHEID, WOERTLICH UND IN SEINER FOLGE

Owner-Ziel, woertlich: **„max usability ist mein ziel auf beiden am ende"**.

Gewaehlt: **erst zwei Listen, spaeter eine — wenn es weh tut.**

Operativ heisst das drei Dinge, und alle drei sind Vorgabe, nicht Vorschlag:

1. **Jetzt:** der `second-host` bekommt eigene, echte Arbeit. Er kann alles ausser iOS. Der `oldmac`
   behaelt iOS und Leichtes. Das kostet **keine Zeile Code** — beide Instanzen laufen bereits (§2).
2. **Spaeter:** die gemeinsame Liste wird gebaut, wenn das Umschalten zwischen zwei Boards
   nachweislich stoert. Der AUSLOESER ist der Schmerz, nicht ein Datum — und er faellt beim
   Arbeiten von selbst an, wenn Schritt 1 laeuft.
3. **Nicht:** `f3ca2e05` in seiner heutigen Fassung. Siehe §4.

## 1 · WARUM „A ODER B" DIE FALSCHE GABEL WAR

`HANDOFF.md` §8 stellt die Frage als (A) dortige Instanz wird primaer vs. (B) der Mac dispatcht
Lanes hinueber, und nennt den Fehlentscheid teuer: „wird das falsch entschieden, wird alles
darunter zweimal gebaut". Die Analyse der Kosten stimmt. Die GABEL stimmt nicht:

- **(A) opfert den `oldmac`** zum Nebengeraet.
- **(B) opfert den `second-host`** zur Marionette — sein Board zeigte dann nichts Eigenes.

Beide opfern eine Maschine. Das Owner-Ziel ist aber, dass **beide** am Ende maximal nutzbar sind.
Die Gabel, die wirklich traegt, ist deshalb eine andere: **zwei Listen oder eine.**

## 2 · DIE MESSUNG, DIE DIE PRAEMISSE VON §8 WIDERLEGT

§8 liest (A) als zu planende DATENMIGRATION. Das ist ueberholt: **auf dem `second-host` laeuft
bereits eine vollstaendige zweite Fleet-Instanz, seit fuenf Tagen.**

Methode: Read-only-ssh, `ps`, `ls`, `git`, plus ein `curl` vom `oldmac` aus. Nichts geschrieben.

| Befund | Beleg |
|---|---|
| eigener tmux-Socket `claudefleet` mit Session `srv` | `ps -eo pid,etime,command`, etime **5-08:41:07** |
| laufende `bun server.ts` | zwei langlebige (etime 02:07 / 01:06) plus Suite-Instanzen |
| eigene Queue-Datei | `~/claude-fleet/fleet.json`, 123 326 B, **mtime 13:44 desselben Tages** |
| eigene Ledger | `audit.jsonl` 220 Z. · `lane-outcomes.jsonl` 11 Z. · `deploys.jsonl` 5 Z. · `context-receipts.jsonl` 15 Z. |
| eigener Bestand | 11 tasks · 2 programs · `dispatch: true` |
| **vier belegte Slots zur Messzeit** | Slot 8 `scrollFix` im dortigen `~/claude-fleet`, zwei in `[privates Owner-Repo]`, einer in `Dokumente` |

**`FLEET_LANDS='0'` steht wirklich in der dortigen `.env`**, mit Datum und Begruendung
(„2026-09-05 W2 Controller Slot 7: Folger landet nie (Dual-Host S2)"). `HANDOFF.md` §8 fuehrte das
als *nur durch ein Doc gedeckt, nicht durch eine Messung* — diese Zeile schliesst das.

**Beide Boards sind voneinander erreichbar.** `curl` vom `oldmac` auf das `second-host`-Board:
**HTTP 200 in 0,111 s**. `FLEET_INSTANCES` traegt beide Hosts und ist auf beiden Maschinen
identisch gesetzt. Der Umschalter ist also nicht zu bauen, er ist da.

## 3 · DER EINZIGE ECHTE UNTERSCHIED: NUR EINE HAT ARBEIT

|  | `oldmac` | `second-host` |
|---|---|---|
| Tasks | 200 | 11 |
| aktive Programs | 4 | 2 |
| Lane-Ergebnisse gesamt | 858 | 11 |
| Kerne | — | **16** |
| RAM | 8 GB | **7 GB** |
| Last zur Messzeit | ~30 Sessions | **0,38** |
| `xcodebuild` | ja | **nein** |

Zwei Folgerungen, die man leicht falsch zieht:

- **Der Kapazitaetsgewinn ist CPU, NICHT Speicher.** Die Maschinen sind dieselbe Speicherklasse.
  Die gemessene iOS-Gate-Havarie (`docs/messungen/private-repo-p-audit-2026-09-03/A1-prozess-forensik.md`)
  lief bei Last 20–33 auf 8 GB. Wer „mehr Luft" mit Speicher uebersetzt, wiederholt sie dort.
- **iOS bleibt am `oldmac`, und das ist belegt, nicht Geschmack.** Kein `xcodebuild` auf Linux,
  heute gegengeprueft; das Land-Gate fuer `private-repo-p` verwaltet Simulator-Lease, UDID und
  `DEVELOPER_DIR`. Das ist die einzige HARTE Grenze der Aufteilung.

Die Ursache der Trennung ist eine Zeile: `server.ts#STATE_FILE` bindet die Queue an
`import.meta.dir`. Eine Platte, eine Liste. Darum gibt es keine „Fleet", sondern zwei — und darum
ist „eine gemeinsame Liste" ein echter Umbau und kein Schalter.

## 4 · WAS DER ENTSCHEID FUER `f3ca2e05` HEISST

`f3ca2e05` (CROSS-HOST-DISPATCH) ist heute in Richtung **(B)** formuliert: der `oldmac` oeffnet
Lanes auf dem `second-host`. Der Preis dafuer, gemessen: `server.ts` nennt `tmux` an **144** Stellen,
und der Server hat **null ausgehende `fetch(`** — der einzige Treffer ist der `Bun.serve`-Handler
selbst. Es waere der erste ausgehende HTTP-Client, den dieser Server je haette.

**Unter dem Entscheid aus §0 wird dieser Preis nicht gezahlt.** Die Zeile ist NICHT zu dispatchen,
solange sie so formuliert ist. Sie ist nicht falsch und nicht tot — sie beantwortet eine Frage,
die der Owner anders entschieden hat. Wer sie wieder aufnimmt, formuliert sie zuerst um.

## 5 · WAS NICHT GEPRUEFT WURDE

- Ob der `second-host` unter echter Last (nicht 0,38) seine 16 Kerne bei 7 GB ausspielt. Die
  Speicherklasse legt eine Decke nahe, gemessen ist sie nicht.
- Was die vier belegten Slots dort tun und ob ihre Arbeit gesichert ist. Der Owner hat den dort
  einzigen nicht gesicherten Commit (`2de3fdc7`, weder im Hub noch am `oldmac`) am 2026-09-11
  ausdruecklich als **nicht erhaltenswert** beurteilt; er wurde deshalb nicht gerettet.
- Ob `maxParallelSuites: 2` am Geraet stimmt — das ist weiterhin die Selbstauskunft des Daemons
  im Heartbeat, keine Messung.

## 6 · NEBENBEFUND: DER HUB SIEHT DIREKT-COMMITS NICHT

`hub/main` stand zur Messzeit auf `cf7280b4`, der lokale `main` des `oldmac` auf `e2f4f345` —
zwei Commits weiter. Grund: beide waren **Direkt-Commits im Haupt-Checkout**, und `pushLandToHub`
haengt an `recordLand`. Die bekannte Regel „ein Direkt-Commit ist fuer jedes land-seitige Ledger
unsichtbar" gilt damit auch fuer den **Hub**, und das steht bisher nirgends. Fuer einen Zwei-Host-
Betrieb ist das die relevantere Haelfte: die zweite Maschine zieht aus dem Hub.

## 7 · NACHTRAG 2026-09-11 ~20:00 — SCHRITT 1 WAR SCHON ERFUELLT, UND DIE QUEUE SAGTE DAS GEGENTEIL

Gemessen von der Owner-MAIN (Slot 9) beim Ausfuehren von §0 Schritt 1. Read-only ssh plus drei
`git rev-list`; der einzige Schreibakt war das Setzen dreier Zeilen auf `done`.

**Der Befund:** die Queue des `second-host` fuehrte drei `auftrag`-Zeilen als **`pending`**, jede mit
der Notiz `lane closed before landing — review and requeue if still wanted`. Ihre Arbeit liegt
**vollstaendig auf dem dortigen `main`** — je `git rev-list --count main..<branch>` == **0**:

| Zeile | Branch | Commit auf main |
|---|---|---|
| `084bfe8b` (Act B5) | `fleet/260911044419-ccdf` | `5857975` refactor(sweeps): ein Gate-Modul fuer BA, Welt und ATS |
| `b750f712` (Act B6) | `fleet/260911044507-8055` | `1d39dc7` feat(jd): elf JD-Volltexte woertlich fuer den Korb vom 10.09. |
| `a2366439` (Act B7) | `fleet/260911080412-137d` | `a4081e4` fix(sweep): drei gemessene Lecks in der Suche schliessen |

Dazu **zehn verwaiste Worktrees** unter `[privates Owner-Repo].worktrees/`, alle 0 Commits vor `main`.

**Die Ursache ist kein Bug, sondern eine Naht, die niemand zu Ende gedacht hat.** Die Briefs dieser
Zeilen schreiben ausdruecklich vor: *„Dein Ergebnis wird als ein Diff gelesen und von der MAIN
selbst gemerged."* Der Fleet sieht dadurch **nie ein Land**. Der Requeue-Pfad findet eine Lane, die
ohne Land geschlossen wurde, stuft die Zeile auf `pending` zurueck und haengt eine Notiz an, die
das **Gegenteil der Wahrheit** behauptet.

**Das ist §6 in seiner teureren Haelfte.** §6 sagt: der Hub sieht einen Direkt-Commit nicht. Hier
sieht die **Queue selbst** die erledigte Arbeit nicht — und auf einem Host mit `FLEET_LANDS='0'`
ist „Abschluss ohne Land" nicht die Ausnahme, sondern **der einzige moegliche Abschluss**. Die
Folge ist nicht Rauschen: eine Zeile, die „requeue if still wanted" sagt, LAEDT DAZU EIN, gebaute
Arbeit ein zweites Mal zu bauen. Genau das waere hier beinahe passiert.

**Was daraus folgt und was nicht.** Nicht: Land-Zwang auf dem Folger — `FLEET_LANDS='0'` steht dort
mit Datum und Begruendung. Sondern: entweder sagt die Notiz **„unbekannt"** statt eine Empfehlung,
oder es gibt einen Abschluss-Akt, den eine MAIN **ohne Land** vollziehen kann. Die Frage ist als
**Q1 in den Brief von `f3ca2e05`** geschrieben (Owner-Brief, 2026-09-11 ~20:00) — dieselbe Zeile,
die §4 als B-foermig zurueckgestellt hat, jetzt auf die Luecke gerichtet, die wirklich weh tut.

**Korrektur an §3 dieser Notiz:** die dortige Tabelle liest „Tasks 11 / Lane-Ergebnisse 11" als
*nur eine Maschine hat Arbeit*. Das war richtig gezaehlt und falsch gedeutet — der `second-host`
HATTE Arbeit, sie war nur nicht mehr sichtbar. Stand jetzt: **8 archiviert, 3 done, 0 offen.**
Schritt 1 des Entscheids ist damit nicht „zu tun", sondern **erfuellt** — was offen bleibt, ist die
Sichtbarkeit, nicht die Auslastung.
