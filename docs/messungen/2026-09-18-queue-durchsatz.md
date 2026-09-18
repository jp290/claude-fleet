---
frage: Warum haengt die Queue hinter dem Plan — wo liegt die Durchlaufzeit einer Zeile, wie viel Lane-Deckel blieb ungenutzt, was ist der Mix, und welche hoechstens fuenf Schnitte bringen spuerbar mehr?
urteil: Die Zeit liegt VOR dem Dispatch, nicht in der Lane. p50 5,1 h von 6,5 h Durchlaufzeit wartet eine Zeile auf Start, die Lane selbst braucht bis zum Land p50 60 min. Seit dem Massen-Hold vom 2026-09-17 14:13–15:03Z (42 Holds ohne Grundfeld) lief der Deckel zu 36 % statt 78 %. Die Hypothese "KLEIN-Zeilen laufen zuerst" ist widerlegt (created→dispatcht p50 klein 5,4 h, mittel 1,2 h). Bestaetigt ist: die Queue speist sich selbst, 25 von 30 KLEIN-Zeilen stammen aus Befunden des Fleets ueber sich selbst.
bereich: [queue, durchsatz, kapazitaet, orchestrierung]
belege: [lane-outcomes.jsonl, audit.jsonl#task_hold, audit.jsonl#task_release, fleet-reports.jsonl, land-quality.jsonl, server.ts#releaseTask, server.ts#tickDispatch, docs/scope-inflation.md]
nicht-gemessen: Wartegrund je Fall (collides/after/card-invalid) historisch, weil kein Ledger ihn schreibt; der "Plan", gegen den die Queue haengt (es gibt keinen Soll-Ledger); Freigabezeitpunkt von 35 Owner-Freigaben ueber PATCH (kein Audit-Ereignis)
stand: 2026-09-18
---

# Warum die Queue hinter dem Plan haengt: Durchlaufzeit, Deckel, Mix, Nacharbeit

2026-09-18, Lane `fleet/260918084911-8816`, Horizont **2026-09-18T08:50:00Z**, Fenster 14 Tage
(ab 2026-09-04T08:50Z). Frage: **Wo verliert eine Zeile ihre Zeit, und welcher Schnitt holt am
meisten zurueck, ohne alles umzuwerfen?**

Die Owner-Vorgabe, woertlich (2026-09-18): *"wir muessen langsam wirklich mehr Effizienz in die Queue
bringen … super ineffizient, wir haengen durchgehend hinterm Plan … ich will genauso ungerne alles
einfach ueber den Haufen werfen … wir machen die ganze Zeit nur so winzige Fixes, von denen man nicht
viel merkt"*.

## 0. Die Hypothese der Orchestratorin, geprueft

Die Hypothese lautete: *die Queue speist sich selbst, Lanes erzeugen Befunde, Befunde werden KLEIN-Zeilen,
die laufen zuerst, und spuerbare grosse Schnitte liegen hinter Holds.* Sie hat drei Teile, und die
Messung trennt sie:

| Teil | Urteil | Tragende Zahl |
|---|---|---|
| Befunde werden KLEIN-Zeilen | **bestaetigt** | 17 von 30 KLEIN-Zeilen stammen aus dem Befund einer frueheren Lane, eines Audits oder einer Lane-Notiz, 8 aus einer Beobachtung von Orchestratorin oder MAIN an der Maschinerie, 4 vom Owner, 1 unklar (§c.3) |
| KLEIN laeuft zuerst | **widerlegt** | created→dispatcht p50: klein 5,4 h, mittel 1,2 h, gross 5,4 h (§a) |
| Grosse Schnitte liegen hinter Holds | **nicht belegt** | gehalten sind jetzt 37 offene auftrag-Zeilen: 3 gross (2 davon Private-repo-aa), 15 mittel, 8 klein, 11 ohne GROESSE. Gehalten wird quer ueber alle Groessen (§b, §c.2) |

Was die Hypothese nicht nennt und was die Messung an die erste Stelle stellt: **der Engpass ist die
Freigabe- und Halte-Hand, nicht die Lane und nicht der Dispatch.** Eine Zeile wartet p50 5,1 h auf
ihren Start, danach braucht sie p50 60 min bis zum Land. Seit dem Massen-Hold am 2026-09-17 lief der
Deckel zu 36 %.

## Ergebnis

### (a) Durchlaufzeit je gelandeter auftrag-Zeile

**Grundgesamtheit.** Im Fenster stehen 315 Lands in `lane-outcomes.jsonl`. Davon sind **160**
auftrag-Zeilen mit bekannter Zeile. **154** Lands tragen eine `taskId`, deren Zeile weder in `fleet.json`
noch in `tasks-archive.jsonl` steht: die Zeile wurde vor dem Start des Archivs (2026-09-15T16:06Z)
verdraengt. Diese Lands verteilen sich auf 09-04 bis 09-14. 1 Land hat keine `taskId`. Fuer die 154
sind created und freigegeben **UNBEKANNT**. Messbar bleibt dort nur dispatcht→gelandet: p50 118 min,
p90 7,5 h. Ueber alle 315 Lands: p50 80 min, p90 5,5 h.

**Phasen und ihre Quellen:**

- *created*: `task.created`.
- *freigegeben*: das erste `task_release`- oder `program_release_valid`-Ereignis in `audit.jsonl(.1)`,
  bei 89 Zeilen vorhanden.
  - Bei 36 Zeilen dispatchte die Owner-Tuer direkt (`task_dispatch`, `releasedBy: owner`). Dort ist
    freigegeben = dispatcht per Definition.
  - **35 Zeilen: UNBEKANNT.** Die Owner-Freigabe per PATCH (`server.ts#releaseTask`-Aufruf in der
    Task-PATCH-Route) schreibt kein Audit-Ereignis.
- *dispatcht*: der Zeitstempel im Lane-Branch (`fleet/YYMMDDhhmmss-…`, UTC), die frueheste Lane der
  Zeile, oder ein frueheres `task_dispatch`.
- *Lane fertig*: der erste fleet-report `open` mit Status complete/needs-main/failed desselben Branchs,
  bei 118 Zeilen. `fleet-reports.jsonl` beginnt erst am 2026-09-14T12:58Z. Davor gilt
  `self_land_start` (41 Zeilen). 1 Zeile ist UNBEKANNT.
- *gelandet*: `ts` der landed-Zeile in `lane-outcomes.jsonl`.

„negativ" heisst: der Branch-Zeitstempel ist auf die Sekunde abgeschnitten und liegt deshalb bis zu 1,8 s vor dem
Release-Ereignis. Solche Werte zaehlen als 0.

| Phase (alle, n=160) | n gemessen | UNBEKANNT | p50 | p90 |
|---|---|---|---|---|
| created→freigegeben | 125 | 35 | 2,5 h | 32,4 h |
| freigegeben→dispatcht | 125 | 35 | 0 min | 10,8 h |
| **created→dispatcht** | 160 | 0 | **5,1 h** | **28,3 h** |
| dispatcht→Lane fertig | 159 | 1 | 47 min | 2,0 h |
| Lane fertig→gelandet | 159 | 1 | 6 min | 42 min |
| dispatcht→gelandet | 160 | 0 | 60 min | 2,9 h |
| created→gelandet | 160 | 0 | 6,5 h | 30,3 h |

| created→dispatcht / dispatcht→gelandet / created→gelandet (p50 · p90) | n |
|---|---|
| klein: 5,4 h · 24,6 h / 1,1 h · 2,5 h / 6,5 h · 26,9 h | 76 |
| mittel: 1,2 h · 21,3 h / 1,0 h · 2,3 h / 2,6 h · 22,2 h | 42 |
| gross: 5,4 h · 19,0 h / 36 min · 1,5 h / 6,4 h · 22,2 h | 11 |
| ohne GROESSE-Zeile: 20,6 h · 220,7 h / 49 min · 4,5 h / 21,2 h · 225,9 h | 31 |

Lesart:

- 78 % der p50-Durchlaufzeit (5,1 von 6,5 h) liegen vor dem Dispatch.
- dispatcht→Lane fertig p50: klein 50 min, mittel 51 min, gross 16 min (n=11). Eine KLEIN-Lane kostet
  so viel Wanduhr wie eine MITTEL-Lane.
- Zeilen ohne GROESSE-Zeile warten am laengsten; ihre Zusammensetzung ist nicht ausgezaehlt.
- freigegeben→dispatcht p50 0 min heisst: ist eine Zeile frei, startet sie meistens sofort. Die
  Freigabe selbst ist die Wartezeit.

### (b) Kapazitaet: ungenutzter Deckel bei wartenden freigegebenen Zeilen

**Messbar: der Deckel ueber die Zeit.**

- Der Repo-Deckel fuer claude-fleet steht im ganzen Fenster auf 3. `repo_lane_cap` wurde am
  2026-09-07 auf 3 gesetzt, der Maschinen-Default `FLEET_DISPATCH_MAX_LANES` ist ebenfalls 3.
- Die Lane-Intervalle kommen aus `lane-outcomes.jsonl`: Branch-Zeit bis Outcome, 336 Branchs, jeder
  genau einmal. Die 3 laufenden Lanes stehen in `fleet.json.slots`.
- Der Master-Stopp stammt aus `dispatch_switch`. Er war 1 786 min (8,9 %) aus, und zwar 2026-09-15
  21:22Z → 09-16 19:25Z.

| Minuten im Fenster: 20 160 | Minuten | Anteil |
|---|---|---|
| Lanes < 3 | 9 418 | 46,7 % |
| Lanes < 3 bei Master-Stopp an | 8 348 | 41,4 % |
| … und mind. eine freigegebene, nicht gehaltene Zeile mit `task_release`-Ereignis wartete | **1 394** | **6,9 %** |
| belegte Lane-Minuten von 3 × Fenster | 47 369 von 60 480 | 78,3 % |

Die Verteilung laufender Lanes in Minuten: 0: 1 778 · 1: 3 273 · 2: 4 367 · 3: 7 931 · 4: 2 523 ·
5: 251 · 6: 37. In 2 811 Minuten liefen mehr als 3 Lanes. Welche Tuer die Ueberbelegung oeffnete,
ist nicht gemessen; der Deckel ist die Schranke des Ticks (`server.ts#tickDispatch`).

**Die 6,9 % sind eine untere Schranke.** Owner-Freigaben per PATCH erzeugen kein Ereignis (35 der 160
Zeilen), ihre Wartefenster fehlen deshalb in der Zeile.

**Wartegrund je Fall: mit den heutigen Ledgern nicht messbar.** 25 Zeilen warteten in Unterdeckung. Bei
keiner steht im Ledger, WARUM der Tick sie nicht startete. Messbar ist nur, was ausgeschlossen ist:

- *hold*: aus `task_hold` abgezogen.
- *kein-program*: alle 25 tragen ein `programId`.
- *after*: 3 tragen ein `card.after`, und das ist die heutige Karte, nicht die damalige.

`collides` und `card-invalid` stehen nirgends. Der Start-Plan-Grund (`reasonAgainst`, `next`) existiert
nur live in `GET /api/start-plan`, und `task.note` wird bei jedem Tick ueberschrieben.

**Fehlendes Feld:** ein Ereignis je Zustandswechsel des Start-Plan-Urteils einer Zeile, mit Zeitstempel
(`{ts, taskId, next: unreleased|after|collides|…, reasonAgainst}`). Genau das verlangt die gehaltene
Zeile `84888f35` (WARTE-REGISTER, gross). Dazu fehlt ein Grund in `task_hold`: das Ereignis traegt nur
`held|lifted`, das `hold`-Objekt nur `{by, slot, at}`.

**Der groesste Einzelposten ist der Massen-Hold.** Zwischen 2026-09-17 14:13Z und 15:03Z setzten die
MAIN-Slots 8 und 10 **42 `task_hold`-Ereignisse**, und keines davon traegt einen Grund. Nur eine der 32 heute noch gehaltenen Zeilen hat im
±2-h-Fenster einen Kommentar, der den Hold begruendet. 32 Zeilen
halten diesen Hold heute noch, 29 davon sind offen. Von 15:10Z bis zum Horizont (1 073 min) liefen
**855 min (80 %) weniger als 3 Lanes** bei eingeschaltetem Dispatch. Belegt waren 36 % des Deckels,
im 14-Tage-Mittel sind es 78 %.

Der Live-Start-Plan am Horizont zeigt den Endzustand: 38 claude-fleet-Zeilen in 36 Wellen, **jede** mit
`next: unreleased`. 34 davon sind "held by its MAIN", 4 pending ohne Freigabe. Startbar ist keine.
Die 3 laufenden Lanes haben diese `task_release`-Zeitpunkte:

- `56522568`: 09-18 08:21Z
- `f126fd17` (diese Lane): 09-18 08:49Z, `by=policy card-valid`
- `2cf40772`: 09-17 13:45Z, vor dem Massen-Hold. Dispatcht wurde sie erst 09-18 08:18Z; dazwischen
  lag ein Hold.

Unterdeckung bei Stopp=an, je Tag (UTC):

| 09-04 | 09-05 | 09-06 | 09-07 | 09-08 | 09-09 | 09-10 | 09-11 | 09-12 | 09-13 | 09-14 | 09-15 | 09-16 | 09-17 | 09-18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14 % | 40 % | 66 % | 52 % | 2 % | 25 % | 9 % | 100 % | 66 % | 43 % | 48 % | 47 % | 7 % | 29 % | 100 % |

Die Lane-Stunden je Tag lagen bei 38–86, am 09-11 bei 16. Die Ursache des 09-11 steht in keinem der
gelesenen Ledger.

### (c) Mix

**c.1 Fleet gegen Produkt.**

- Lands: **310 von 315 (98,4 %)** im Repo claude-fleet, dazu private-repo-aa 3, private-repo-p 1,
  astra-main 1.
- Lane-Zeit (`sessionMs`, alle Ausgaenge): claude-fleet 569,1 h, alle Fremdrepos zusammen 7,8 h
  (1,4 %). 91 Ausgaenge tragen kein `sessionMs`, ihre Zeit fehlt in beiden Summen.
- Innerhalb claude-fleet nach Program: Fleet-Betrieb 219, ohne Program 30, Leichtgewicht 15,
  Codebase-Review 12, Land-Pipeline 11, Dual-Host 8, Audit-Determiniertheit 6, Rest ≤ 2 je Program.
  Jeder dieser Programs arbeitet am Fleet selbst.

**c.2 Ankunft gegen Abschluss.** Belastbar ist nur die laufende Woche. Vor dem 2026-09-15T16:06Z
verdraengte Zeilen fehlen im Archiv, also sind die Ankuenfte von W36/W37 untere Schranken.

| ISO-Woche | angekommen (auftrag, bekannt) | gelandet (davon Zeile verdraengt) |
|---|---|---|
| W36 (ab 09-04) | ≥ 4 | 53 (53) |
| W37 | ≥ 59 | 115 (96) |
| W38 (09-14 bis 09-18 08:50Z) | 181 | 146 (5) |

Von den 181 Ankuenften der W38 sind **119 done, 29 archiviert, 33 offen**. Der Abschluss haelt mit der
Ankunft Schritt (82 % geschlossen). Die offene Menge (46 auftrag-Zeilen, 41 claude-fleet) waechst nicht,
sie **steht**: 37 davon sind gehalten, das Alter liegt bei p50 61 h und p90 264 h. Ankuenfte je Tag in
W38: 65 · 58 · 16 · 39 · 3. Lands je Tag: 46 · 45 · 15 · 35 · 5.

**c.3 Stichprobe: 30 KLEIN-Zeilen, die 30 juengsten gelandeten KLEIN-Zeilen im Fenster** (Land
2026-09-15 bis 09-18). Einordnung je Kopfzeile und BEFUND-Absatz; die Zuordnung ist Handarbeit:

- **17 aus dem Befund einer frueheren Lane, eines Audits oder einer Lane-Notiz.** 13 davon sind
  Defekt-Befunde:
  - `249f8d06` Befund der Lane 939ccb6f
  - `0270bf26` Rest aus Report 1849c4cd
  - `c06e8b5a` rotes Audit
  - `2b277f35` Report von c336cb5c
  - `ac1c6064` vorgeschlagen von Lane 69707f16
  - `30adf3a0`, `69707f16` Flake-Familien im Audit
  - `7bcabbfd` Nachfolge von 2d3cc525
  - `c336cb5c` Aufraeum-Session
  - `457ff5f0` Helfer-Vorschau-Rot der Lane 8eb85da6
  - `e736fcf4` Report cadc1867
  - `6ef9881c`, `cf4f6962` Agentenstaffel-Rangliste

  Die uebrigen 4 sind Schnitte aus Mess- oder Denk-Notizen: `2f147b22`, `bd783b5d`, `8d550b87`,
  `0d3ebca3`.
- **8 aus einer Beobachtung von Orchestratorin oder MAIN an der lebenden Queue:** `c2904891`,
  `53daa39c`, `fc35357f`, `80a1deb6`, `c3308a25`, `17252981`, `a0474870`, `c3d4b7df`.
- **4 vom Owner** (Entscheid oder Meldung): `7ce65a6a`, `5abc5408`, `eeacda0a`, `3f02ddad`.
- **1 unklar:** `259bf7af` ("Fremdrepo-Befund 5", Quelle nicht benannt).

Zusammen: 25 von 30 KLEIN-Zeilen entstehen, weil der Fleet sich selbst beobachtet. 4 davon betreffen
die Zuverlaessigkeit der Suite (Flake/Audit-Rot).

**c.4 Lane-Zeit je Groesse** (gelandete bekannte Zeilen, `sessionMs`): klein 78 Lands / 72,8 h
(0,93 h je Land), mittel 42 / 48,0 h (1,14 h), gross 11 / 12,0 h (1,09 h), ohne GROESSE 29 / 35,4 h.
Ein zweiter KLEIN-Inhalt in einer MITTEL-Lane kostet damit rund 0,2 h statt 0,93 h.

### (d) Nacharbeit: Stichprobe von 20 rework3d-Lands

**Stichprobe.** `land-quality.jsonl` (Stand @d8ece3a0) hat 642 Zeilen, davon 537 mit geschlossenem
3-Tage-Fenster und 274 mit `reworkLines3d > 0`. Genommen wurden die **20 juengsten** Treffer (Lane-Branches
2026-09-13 10:00Z bis 09-14 08:07Z).

**Methode.** Je Land wurde neu attribuiert, WELCHER spaetere main-Commit die Zeilen ueberschrieb
(`rework.py`, Methode). Die Blame-Regel ist die von `land-quality.ts`, dazu kommen die Namen der
Commits. Eingeordnet wurde nach dem ueberschreibenden Commit, bei `fix`-Subjects mit Blick in den
Body:

- **Fix-auf-Fix:** ein spaeterer Commit repariert einen Defekt genau dieser Land-Arbeit.
- **Folgeschnitt:** geplante Erweiterung, Refactor oder eine andere Funktion ueber dieselben Zeilen.
- **Nachbar-Anpassung:** eine `fix`-Zeile, die eine Erwartung an die Aenderung eines anderen Lands
  angleicht.

| Einordnung | Lands | ueberschriebene Zeilen |
|---|---|---|
| **Fix-auf-Fix** | **3** | 23 |
| Folgeschnitt, dazu 1 Land mit Fix-Anteil | 16 | 298 (davon 8 durch Fixes) |
| Nachbar-Anpassung | 1 | 2 |
| Summe | 20 | 323 |

Die drei Fix-auf-Fix-Faelle:

- `1733502c` "server did not come up is not a measurement": 14 Zeilen, ueberschrieben von
  `93412a52` (zwei Sonden meldeten ihr Setup als Produkt-Rot).
- `1fc3a5c8` M5-Sonde: 4 Zeilen, `4ab4ad8c` (die M5-Lands feuerten vor dem Tuer-Praedikat).
- `51df715e` Auto-Lift: 5 Zeilen, `c5296dfb` (der Lift verlor Ranges graph-loser Symbole).

Zwei der drei sind Sonden-Korrekturen in `e2e/`.

Das Land mit Fix-Anteil ist `57d7ec3b`, der Startplan-Sensor. Von seinen 98 ueberschriebenen Zeilen
gehen 77 auf die geplanten Folgeschnitte `765a4337` (Tick startet nach Plan) und `f8804bb1`
(Release-Policy) und 8 auf die Fixes `0ed37789` und `e549974e`.

Die groessten Folgeschnitte:

- `f8804bb1` ueberschrieb 55 Zeilen von `6d841a14`.
- `09959344` (Shard-Split) ueberschrieb 18 Zeilen von `d7b4b47d`.
- `8ff1b659` (readLedger-Refactor) ueberschrieb je 13 Zeilen in 2 Lands.

**Gegen den Proxy.** `reworkByFixSubject` stand bei 7 der 20 Lands auf `true`. Echter Fix-auf-Fix sind
davon 3, und `57d7ec3b` hat einen Anteil. Die uebrigen 3 kamen durch eine `fix`-Zeile zustande, die
einen anderen Defekt oder eine Nachbar-Erwartung reparierte (`e549974e`, `0961a749`, `ea2d0c52`).
`fix3d` ueberzeichnet in dieser Stichprobe also etwa um den Faktor 2. Der binaere `rework3d` misst hier
ueberwiegend den geplanten naechsten Schnitt derselben Flaeche; das deckt den Vorbehalt der Zeile
`b0f272b8`. Nacharbeit im Sinn von "die Lane hat es falsch gemacht" betrifft 3 von 20 Lands und 23
von 323 Zeilen (7 %).

### (e) Schnittliste mit Schnittlinie

Die Owner-Vorgabe, gegen die geschnitten wird, woertlich: *"mehr Effizienz in die Queue … wir haengen
durchgehend hinterm Plan … ich will genauso ungerne alles einfach ueber den Haufen werfen … nur so
winzige Fixes, von denen man nicht viel merkt"*. Daraus folgen drei Pruefsteine:

- mehr Zeilen je Woche durch die vorhandene Maschine (Leerlauf),
- spuerbare statt winziger Arbeit,
- kein Umbau.

**1 · BETRIEB, kein Code: kein Hold ohne Grund und Ablauf, und eine Leerlauf-Pflicht.**

- *Mechanismus:* Eine Hold-Welle ueber mehr als 3 Zeilen bekommt einen Kommentar mit Grund und
  Wiederfreigabe-Bedingung. Wer eine Betriebs-MAIN oder Orchestratorin antritt, prueft zuerst: laufen
  weniger als 3 Lanes, und gibt es gehaltene oder pending Zeilen? Dann wird je Zeile freigegeben,
  zusammengelegt oder archiviert, und das Stehenlassen ist keine der Optionen.
- *Tragende Zahl (§b):*
  - 42 Holds ohne Grund in 50 min, 37 davon von einem einzigen MAIN-Slot.
  - Danach 15 h ohne Lift (09-17 15:10Z bis 09-18 06:54Z, einzige Ausnahmen `53daa39c` und
    `cf4f6962`).
  - Deckel-Nutzung 36 % statt 78 %; 855 von 1 073 min unter dem Deckel.
  - `2cf40772` wurde von demselben Slot um 13:45Z freigegeben und 28 min spaeter gehalten.
- *Erwarteter Effekt:* (0,78 − 0,36) × 3 Lanes × 17,9 h ≈ **22 Lane-Stunden je vermiedener Nacht
  dieser Art**. Bei 0,93–1,14 Lane-h je Land (§c.4) sind das ≈ 20 Lands.
- *Done:* In den 7 Tagen nach Einfuehrung liegt die belegte Deckel-Minute bei Stopp=an ueber 70 %, und
  keine offene Zeile traegt einen Hold, der aelter als 24 h ist und keinen Kommentar mit Grund hat.
- *Verify:* `python3 cap.py <NOW_MS>` (Methode) gegen den neuen Horizont, dazu die Hold-Alter aus
  `fleet.json.tasks[].hold.at` gegen `comments[].ts`.

**2 · BETRIEB, Reihenfolge: ein Befund wird Teil einer Sammelzeile, nicht eine eigene KLEIN-Lane.**

- *Mechanismus:* Der Owner-Entscheid vom 2026-09-18 ("Kleine Lanes zusammenlegen": gleiche Flaeche,
  ≤ mittel, ein VERIFY, ein Program) wird auf die Quelle angewandt. Ein Befund aus einem Lane-Report,
  einem Audit-Rot oder einer Notiz landet als Absatz auf der offenen Zeile derselben Flaeche. Eine neue
  KLEIN-Zeile entsteht nur, wenn keine offene Zeile die Flaeche traegt.
- *Tragende Zahl (§a, §c):*
  - 25 von 30 KLEIN-Zeilen stammen aus Selbstbeobachtung, 17 aus einer frueheren Lane.
  - KLEIN ist die Haelfte aller gelandeten Zeilen (76 von 160).
  - Eine KLEIN-Lane braucht bis "fertig" so lange wie eine MITTEL-Lane (p50 50 gegen 51 min).
- *Erwarteter Effekt:* Von 5,4 KLEIN-Lands je Tag (76 / 14) wird die Haelfte gepaart. Das spart
  ≈ 2,7 × 0,7 h ≈ **2 Lane-Stunden je Tag** und 2,7 Land-Gates plus Post-Land-Audits je Tag. Die
  Audit-Kosten sind nicht gemessen.
- *Done:* Der Anteil KLEIN an den Lands der naechsten 7 Tage faellt unter 35 % (heute 76 / 160 =
  48 %), und die Lane-Stunden je Land steigen nicht ueber 1,2 h.
- *Verify:* `python3 qd.py <NOW_MS>` mit dem neuen Horizont, Groessen-Tabelle und `sessionMs` je
  Groesse.

**3 · BETRIEB, Budget: eine der drei claude-fleet-Lanes gehoert einer GROSS- oder Produktzeile.**

- *Mechanismus:* Ist eine GROSS- oder Produktzeile freigebbar, startet die Orchestratorin sie vor der
  naechsten KLEIN-Zeile, und ein Platz bleibt fuer sie reserviert, solange sie laeuft. Das ist eine
  Reihenfolge-Regel und kein neuer Deckel.
- *Tragende Zahl (§c):*
  - 98,6 % der Lane-Zeit (569 von 577 h) und 310 von 315 Lands gehen an den Fleet selbst.
  - Im Fenster landeten 11 GROSS-Zeilen.
  - Offen und gross sind 3, alle gehalten: `84888f35`, `f68d27d7` und `d61133e3`, die beiden letzten
    Private-repo-aa mit `after`.
- *Erwarteter Effekt:* Ein Drittel des Deckels ist bei 78 % Belegung ≈ **18 Lane-Stunden je Tag** fuer
  Arbeit, die man merkt. Das Mengenziel nennt die Orchestratorin, weil nur 3 gross-Zeilen bereitstehen.
- *Done:* In 7 Tagen landen mindestens 5 GROSS- oder Produktzeilen (heute 11 in 14 Tagen, also ≈ 5,5
  je 7 Tage), und der Produktanteil der Lane-Zeit liegt ueber 1,4 %.
- *Verify:* `python3 mix.py <NOW_MS>` und `qd.py` (Groesse gross).

**― Schnittlinie ―** Mit 1–3 ist die Vorgabe erfuellt:

- Leerlauf zurueckholen: 1.
- Winzige Fixes buendeln und ihre Wanduhr sparen: 2.
- Spuerbare Arbeit einplanen: 3.
- Keiner der drei Posten aendert Code.

Posten 4 steht unter der Linie, weil er selbst ein kleiner Fix ist. Er wird nur gebaut, wenn Posten 1
seine Wirkung nachweisen soll.

**4 · CODE, klein, unter der Linie: der Wartegrund wird Ledger.**

- *Mechanismus:*
  - `task_hold` bekommt einen Grund (Feld am `hold`-Objekt und im Audit-Detail).
  - Die Owner-Freigabe per PATCH schreibt `task_release` wie die anderen Freigaben.
  - Ein Ereignis je Wechsel des Start-Plan-Urteils einer Zeile (`next`, `reasonAgainst`) haelt fest,
    was heute nur live in `GET /api/start-plan` steht.
- *Tragende Zahl (§a, §b):*
  - 35 von 160 Zeilen haben keinen Freigabezeitpunkt.
  - 1 394 min Unterdeckung mit wartender freigegebener Zeile haben keinen ablesbaren Grund.
  - 42 Holds haben keinen Grund.
- *Erwarteter Effekt:* Keine Zeile je Woche direkt. Er macht Posten 1 messbar und (b) wiederholbar.
  Er gehoert in die gehaltene Zeile `84888f35` (WARTE-REGISTER) und nicht in eine neue Zeile.
- *Done:* Nach einem Tag Betrieb hat `cap.py` fuer jede Unterdeckungs-Minute mit wartender Zeile einen
  Grund, und die Spalte UNBEKANNT bei "freigegeben" in `qd.py` ist fuer neue Zeilen 0.
- *Verify:* `qd.py` und `cap.py`, dazu eine Sonde in `e2e/tasks.ts`, dass ein Hold ohne Grund
  abgelehnt wird oder `grund: null` traegt.

**Gegenliste: was NICHT getan werden soll, mit Beleg.**

- **Keine weitere Start-Plan- oder Kollisions-Mechanik.**
  - freigegeben→dispatcht p50 0 min.
  - Unterdeckung mit wartender freigegebener Zeile nur 6,9 % des Fensters.
  - Der Ranges-Schnitt der Notiz vom 2026-09-15 ist gebaut (`0ed37789`).
  - Der naechste Schnitt am Plan traefe einen Rand.
- **Den Deckel nicht erhoehen.**
  - Seit dem Massen-Hold ist er zu 36 % genutzt, im 14-Tage-Mittel zu 78 %.
  - In 2 811 min liefen ohnehin mehr als 3 Lanes.
  - Die freien Plaetze fehlen nicht, sie bleiben leer.
- **Land-Gate und Merge-Pfad nicht beschleunigen.**
  - Lane fertig→gelandet p50 6 min, p90 42 min.
  - Die Gate-Arbeit liegt bei p50 116 s, das Gate-Warten bei p50 0 s (Messung der Orchestratorin
    2026-09-18 aus `./state.sh`, hier nicht wiederholt).
- **Die Lane selbst nicht umbauen** (Modell, Harness, Brief-Format). dispatcht→gelandet p50 60 min fuer
  alle Groessen; 78 % der Durchlaufzeit liegen davor.
- **`rework3d` nicht als Steuergroesse fuer diese Schnitte nehmen.** Die Stichprobe in §d trennt
  Fix-auf-Fix von Folgeschnitt; der binaere Wert tut das nicht.
- **Aus dieser Notiz keine neuen KLEIN-Zeilen filen.** Das waere genau der Selbst-Speise-Kreislauf aus
  §c.3. Posten 4 gehoert auf `84888f35`, 1–3 sind Regeln.

### (f) Vorhandene Notizen: gebaut / nicht gebaut

Jede Sha wurde mit `git merge-base --is-ancestor <sha> main` geprueft. Die Zuordnung Zeile → Commit
kommt aus den Branch-Namen der `fleet/land`-Notes und den Commit-Subjects. Diffs gelesen wurden nur
fuer `0ed37789`, `0497df33` und `1c2130c2`.

- `2026-09-17-queue-reihenfolge.md`: **GEBAUT bis auf Punkt 6.**
  - `7d7dfcd3` Trail-Header
  - `0497df33` (`53daa39c`)
  - `1c2130c2` (`c2904891`, Validator 6)
  - `bcf1d451` Audit-Grace
  - `3971ded5` (`FLEET_E2E_MODULES`)
  - Punkt 6 ist offen: `a1610fd7` queued und gehalten, `3f79ff74` und `d518d09d` pending.
- `2026-09-17-beratende-zeilen-triage.md`: **NICHT GEBAUT.** Die 5 fertigen notiz-Zeilen (Population A)
  stehen weiter als `notiz` pending, keine `auftrag`-Zeile loest sie ab. Es war auch kein Code-Posten.
- `2026-09-17-freigabe-wartezustaende.md`: **GEBAUT.** Erst `0497df33` (VERBOTEN in `FORMAT_KEYS`),
  dann `1c2130c2`. Das optionale Projektionsfeld "Kollisionsziel ist pending" ist nicht gebaut.
- `2026-09-15-queue-stau-und-orchestrierungs-entscheide.md`: **GEBAUT** `0ed37789`. Das
  Sonden-Duplikat ist aufgeloest (`38f5451d`).
- `2026-09-15-start-plan-stau-schnitt.md`: **GEBAUT** `0ed37789` (Schnitt c2: wartende Wellen
  kollidieren nur auf bekannten Ranges).
- `2026-09-15-sichtung-wartende-auftraege.md`: **TEILWEISE.**
  - Die 4 Schliessungen sind archiviert.
  - 8 der 12 startbereiten Zeilen sind gelandet: `3197846b`, `8fbd46a9`, `5b409990`, `f94713c1`,
    `b3a67618`, `79a799b6`, `83156d2f`, `90824cf3`.
  - `84888f35`, `9940ec64`, `d02fd2bd` und `ee47b0f8` sind weiter pending und alle vier gehalten.
- `2026-09-15-warten-ohne-adressat.md`: **TEILWEISE, 4 von 5 gebaut:** `30988f1f`/`0d82558c`,
  `904ea277`, `e549974e`, `38c20ed5`. Der Stau-Sensor `80f61ed8` ist pending.
- `2026-09-17-orchestrator-token-effizienz.md`: **TEILWEISE.**
  - Rang 1: `2f147b22` ist gelandet (`9d4b7226`), `2cf40772` laeuft gerade.
  - Rang 2 (`10e2f7c0`, `--brief`) ist pending und gehalten.
  - Rang 3 (Usage-Sensor) ist nicht gebaut; eine Zeile dafuer wurde nicht gefunden.

Zwei Punkte fallen gegen (b) auf. Die zwei Posten, die das Warten selbst adressieren (`80f61ed8`
Stau-Sensor, `84888f35` Warte-Register), sind genau die, die nicht gebaut sind. Beide Zeilen liegen im
Massen-Hold oder dahinter.

## Methode

Alle Lesungen laufen nur lesend ueber die gitignorierten Ledger im Haupt-Checkout
`/Users/owner/claude-fleet`:

- `fleet.json` (nur `tasks`, `slots`, `programs`)
- `tasks-archive.jsonl`
- `audit.jsonl` und `audit.jsonl.1` (zusammen 2026-07-21 bis Horizont)
- `lane-outcomes.jsonl`
- `fleet-reports.jsonl`
- `land-quality.jsonl`

Dazu kommt `GET /api/start-plan` ueber `./ctl.sh get` sowie git auf `main`. Die vier Skripte lagen im
Scratchpad der Lane. Ihr Kern steht hier, damit jemand die Messung wiederholen kann. Der Horizont
wird als `NOW_MS` uebergeben, Default `1789721400000` (2026-09-18T08:50:00Z).

```python
# qd.py (a) — Phasen je gelandeter auftrag-Zeile
tasks = {a["task"]["id"]: a["task"] for a in jl("tasks-archive.jsonl")} | {t["id"]: t for t in fleet["tasks"]}
release_at[tid] = first(ts of audit event "task_release" | "program_release_valid" naming tid)
dispatched     = min(branch_ts(o["branch"]) for o in lane_outcomes if o["taskId"] == tid)  # fleet/YYMMDDhhmmss = UTC
                 # plus task_dispatch / task_wave_dispatch / task_wave_start, falls frueher
finished       = first fleet-report {kind:"open", status in complete|needs-main|failed, branch == land branch}["at"]
                 else first audit "self_land_start" naming tid
landed         = lane-outcome(disposition=="landed").ts
# Fenster: landed >= NOW-14d; kind=="auftrag"; ein Wert fehlt -> UNBEKANNT, keine Schaetzung; p50/p90 linear interpoliert

# cap.py (b) — Minuten-Sweep ueber das Fenster, Deckel 3
lanes  = [(branch_ts(o.branch), o.ts) for o in lane_outcomes if o.repo == claude-fleet]  + offene Slots bis NOW
on(t)  = letzter dispatch_switch <= t ist "on"
waits  = [(release_at[tid], dispatched[tid])]  nur mit task_release-Ereignis, >= 60 s
held(tid,t) = letzter Zustand aus task_hold held/lifted, task_release hebt auf (server.ts#releaseTask)
unter  = Minuten mit count(lanes) < 3 und on(t) und irgendein wait aktiv und nicht held

# mix.py (c) — Lands/`sessionMs` je repo und programId; Ankunft = task.created (kind auftrag) je ISO-Woche,
#               Abschluss = erste landed-Outcome je taskId je ISO-Woche
# rework.py (d) — land-quality.jsonl, reworkLines3d > 0, die 20 juengsten; je Land: eigene Commits
#   base..mainAfter (lane-outcome.base), spaetere main-Commits <= landedAt+3d ueber dieselben Dateien,
#   git diff -U0 C^ C -- f -> Altseiten-Ranges, git blame --porcelain -L ... C^ -- f, Zeilen deren
#   Commit in den eigenen liegt; Regel wie land-quality.ts#main, nur mit Namen der ueberschreibenden Commits
```

Weitere Kommandos, woertlich ausgefuehrt:

- `./ctl.sh get /api/start-plan`: Live-Wellen und `release.why` am Horizont.
- `bun land-quality.ts --summary --since 14d --root /Users/owner/claude-fleet`: die Zeile
  `all 309/227c rw 107/204 52% fix 36/148 24% red 59/296 20%` @d8ece3a0.
- `git merge-base --is-ancestor <sha> main` je Sha in §f.

## Was nicht gemessen wurde

- **Der "Plan".** Gegen welchen Soll-Termin die Queue "hinterher haengt", steht in keinem Ledger. Es
  gibt keine Zeile mit Plan-Datum. Gemessen ist nur Durchlaufzeit und Leerlauf, nicht der Abstand zu
  einem Plan.
- **Der Wartegrund je Fall** (collides / after / card-invalid) fuer die Vergangenheit. Kein Ledger
  schreibt ihn (§b, fehlendes Feld).
- **Der Grund des Massen-Holds am 2026-09-17 14:13Z.** `task_hold` traegt keinen Grund. Von den 32
  Zeilen, die den Hold noch tragen, nennt nur bei `42c53378` ein Kommentar im ±2-h-Fenster einen
  Hold-Grund ("MAIN-Disposition 17.09.: Hold bleibt …"). Bei 5 weiteren Zeilen stehen im selben
  Fenster Kommentare zu anderen Themen.
- **Die Ursache der Leerlauftage** 09-11 (16 Lane-h) und 09-18 00–08Z.
- **Die 154 verdraengten Zeilen** (created, freigegeben, Groesse, Herkunft) und 91 Ausgaenge ohne
  `sessionMs`.
- **Die Kosten von Land-Gate und Post-Land-Audit je Land** in Rechenzeit. Die Gate-Zahlen in §e
  stammen von der Orchestratorin und wurden nicht wiederholt.
- **Die Zuordnung der KLEIN-Stichprobe (§c.3) und der Rework-Stichprobe (§d)** ist Lesearbeit an
  Kopfzeilen und Commit-Subjects einer Person, ohne Zweitleser.
- **Die Regelvorschlaege der Notizen 2026-09-15-warten-ohne-adressat und
  2026-09-17-orchestrator-token-effizienz §5**: ob sie promoviert wurden, ist nicht geprueft.
