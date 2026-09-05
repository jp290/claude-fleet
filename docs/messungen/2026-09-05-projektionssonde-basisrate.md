# Die Projektions-Sonde (§11.2o): Basisrate ueber beide Trail-Register, ein Regimewechsel und ein gebrochener Zwoelfer-Streak

urteil: Der Check `projection nextAction: … names the MAIN's OWN land door` ist ueber 250
Beobachtungen zu 8,0 % rot, aber das ist ein Durchschnitt ueber zwei Regime: **3/207 = 1,4 % vor
dem 2026-09-04** gegen **17/43 = 39,5 % danach**. Die laengste rote Serie ueberhaupt (ZWOELF) endete
am 2026-09-05 04:50 mit einem Gruen im Post-Land-Audit von `eb07267` — einem Baum, der den Diff
enthaelt, der im Lane-Baum `c7be3668` zweimal rot lief. Ein Regress kann das nicht. Die
Autoclose-Hypothese ist widerlegt; die fuehrende Hypothese ist LAST, und sie ist billig
falsifizierbar.

Erhoben von der Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 5) als
Nebenprodukt der Adjudikation, mit der `3cd64a5f` gelandet wurde. Ergaenzt und KORRIGIERT die
Queue-Zeilen `35cf0c23` und `65358fef`; §11.2o in `docs/verify-tiering.md` fuehrt weiterhin 2,9 %
(6/209) — den Durchschnitt ueber beide Regime, der den Sprung genau verdeckt.

## 1. Datenbasis, und der Fehler, den diese Notiz an sich selbst korrigiert

Quellen sind ZWEI Register, und das ist der Punkt: `<haupt-checkout>/e2e-trail/*.jsonl` (215
Beobachtungen dieses Checks) **plus** `$TMPDIR/fleet-e2e-trail/` (35 weitere, dort mit
`tree: null`, weil ein Post-Land-Audit aus einer Kopie ohne aufloesbaren Git-Baum faehrt).

`65358fef` zaehlte nur das erste und untertrieb dadurch — 215/12 statt 250/20. Die Zweiteilung
steht in `./state.sh` und in `docs/messungen/2026-09-04-flake-ranking-trail.md` §1; sie war bekannt
und wurde beim ersten Zaehlen ueberlesen. Wer eine Basisrate an EINEM Register misst, misst die
Laeufe der Audits nicht mit — und der Post-Land-Audit ist genau der Ort, an dem dieser Check den
groessten Schaden anrichtet.

Methode: je Laufdatei die erste JSONL-Zeile, deren `check` den Text
`names the MAIN's OWN land door` traegt; gruppiert nach `ok`; geteilt an `ts` = 2026-09-04 00:00.
Read-only, kein Suite-Mutex, in Sekunden wiederholbar.

## 2. Die Zahlen

|  | Laeufe | rot | Rate |
| --- | ---: | ---: | ---: |
| TOTAL | 250 | 20 | **8,0 %** |
| vor 2026-09-04 | 207 | 3 | **1,4 %** |
| seit 2026-09-04 | 43 | 17 | **39,5 %** |

Laengste rote Serie ueberhaupt: **12**, vom 2026-09-04 19:01 bis 2026-09-05 04:13, ueber acht
verschiedene Baeume (`940887dc` · `fb20d077` · `acbac59f` · `83a90148` · `f4b160b3` · `c7be3668`
2x · `9cc5471e`) und vier Audit-Laeufe ohne Baum.

Nicht-Determiniertheit ist unabhaengig davon bewiesen, erklaert das Regime aber nicht: nur zwei
Baeume zeigen beide Ausgaenge (`2d88521f` 8 gruen / 1 rot, `ad75273a` 1 gruen / 2 rot), und beide
liegen VOR dem 2026-09-04.

## 3. Der Streak-Bruch, und warum er die Zurechnung entscheidet

Am 2026-09-05 04:50 lief der Check GRUEN — im Post-Land-Audit von `eb07267`
(`isolated-20260905T023326Z-15248`, 3 661 checks / 0 failed, 1 834 955 ms, exit 0).

`eb07267` ist der Integrations-Tip NACH dem Land von `3cd64a5f` und enthaelt damit exakt den Diff,
der im Lane-Baum `c7be3668` **zweimal hintereinander** rot lief. Derselbe Code, gruen. Damit ist
die Zurechnung nicht mehr nur Register-Attribution ueber fremde Baeume, sondern am gelandeten Baum
gegengeprueft.

## 4. Eine widerlegte und eine offene Hypothese

**WIDERLEGT, bitte nicht erneut fahren:** `566cbae` (2026-09-04 17:54) armiert
`FLEET_LANE_AUTOCLOSE=1` in der srv-Spawn-Zeile, und der Streak beginnt 19:01. Ein Leck in die
Suite wuerde die Fixture-Lane zwischen `waitDoneLooking` und der Projektionslesung schliessen —
genau R6 („sent row owns no live lane") und damit `phase: "UNKNOWN"`, die beobachtete Signatur.
Sie faellt trotzdem: der Leck-Fix `c8c016a` (2026-09-04 21:55, „FLEET_LANE_AUTOCLOSE wird von jedem
Wrapper GESTATET statt geerbt") ist Vorfahr BEIDER heute roten Lane-Baeume
(`git merge-base --is-ancestor c8c016a fleet/260904190610-05a1` und `…/260904232513-0b9b`, beide
wahr), und sie fallen danach weiter — mehr als die Haelfte der Rots liegt nach diesem Fix.

**FUEHREND: Last.** Das Gruen faellt in das Fenster, in dem die Maschine leer wurde: `29844` hatte
um 04:07 nach 3 h 39 min Wartezeit den Suite-Mutex bekommen und war fertig, die Contention fiel
weg. Der Handoff `79cf723` (2026-09-04 14:30) hatte „projection-Rot war Last" schon einmal notiert.
Die Mechanik passt: die Sonde liest die Projektion Sekundenbruchteile nach `waitDoneLooking`, und
unter Last verpasst sie die Tick-Auffrischung der Git-Fakten.

**Falsifikation, ohne Mutex-Kosten:** die naechsten Beobachtungen gegen die gleichzeitige
Wrapper-Zahl auftragen. Traegt die Hypothese, liegt die Rate bei ruhiger Maschine bei ~1,4 % und
bei drei gleichzeitigen Suiten nahe 100 %.

## 5. Was nicht gemessen ist

WELCHE der beiden UNKNOWN-Regeln feuert — R6 („sent row owns no live lane") oder R10 („lane facts
incomplete"). Die Sonde druckt ausschliesslich `phase` und wirft `phaseBasis` und `unknown` weg,
obwohl der Server beide in derselben Antwort mitliefert. Solange das so ist, ist jede Aussage hier
ATTRIBUTION, keine Diagnose — und der erste Schnitt bleibt der billigste: die Evidenzzeile um
`phaseBasis`/`unknown` erweitern, dann sagt der naechste rote Lauf die Wurzel selbst.
