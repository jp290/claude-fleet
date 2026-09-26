---
frage: Was kosten die Suiten heute je Land, und spart ein Buendelzweig (Lanes landen leicht gegatet, volle Suiten erst beim Merge nach main) Suite-Minuten, ohne die Gewaehrleistung aufzugeben?
urteil: overhaul ist schon ein Buendelzweig, spart aber nichts, weil jedes overhaul-Land dieselbe Vollkette und ein eigenes Voll-Audit faehrt und es keinen Pfad nach main gibt. Sparbar sind die Tier-1-Suiten je Land (lokal 70 Min Arbeit und 93 Min Mutex-Warten am Tag) und bei Buendeln zu 5 rund 300 von 440 Helfer-Minuten Audit am Tag. Ein volles Suiten-Gate vor main ist das in work-register §7 beerdigte harte Gate und kippt zwischen 9 und 27 Lands je Buendel. Erster Schnitt als Vorschlag, nicht beschlossen: overhaul-Lands mit Quellkette ohne Suite-Mutex.
bereich: [verify, suiten, buendelzweig]
belege: [server.ts#verifyPlanFor, server.ts#integrationBranch, server.ts#laneBaseRef, server.ts#schedulePostLandAudit, server.ts#runPostLandAudit, server.ts#pushUndo, server.ts#remoteHoldsLandedRange, verify-proportion.ts#verificationProportionFor, docs/verify-tiering.md, docs/work-register-2026-08-06.md, docs/overhaul-plan-2026-09-25.md]
nicht-gemessen: Helfer-Vorschauen auf dem Second-host (nicht im lokalen Trail), der Anteil des Mutex-Wartens, den gerade die Tier-1-Suiten verursachen, und ob der overhaul-Zweig als Lane nach main gelandet werden kann
stand: 2026-09-26
---

# Buendelzweige: welche Suite wann laufen muss, gemessen an 14 Tagen Lands

2026-09-26, Lane `fleet/260926142440-73f4` (Task `1f1663fc`). Frage: **Spart es Suite-Minuten,
wenn Lanes leicht gegatet auf einen Buendelzweig landen und die vollen Suiten erst beim Merge nach
main laufen, und wo bleibt dann die Gewaehrleistung?**

Owner woertlich (26.09. ~16:4x): „In Worktree's zu unterteilen und dann erst die richtigen suiten
laufen zu lassen wenn es sich lohnt bzw auf main gemerged wird, könnte und bestimmt auch viel in der
Produktivität einbringen bzw. uns ermöglichen manche suiten nicht immer zu fahren und trotzdem volle
gewährleistung zu haben".

Alles unten ist Messung oder Vorschlag. Keine Position hier ist beschlossen.

Fenster: 14 Tage bis 2026-09-26 14:25 UTC, nur das Repo `claude-fleet`. Einige Trail-Zahlen gelten
ab 2026-09-18 00:00 (8,68 Tage). Erst ab dem 17.09. traegt der Trail `slot` und `branch`, erst ab
dann lassen sich Gate-Laeufe von Lane-Laeufen trennen (docs/e2e-trail.md §2a).

## Ergebnis

### (1) Suite-Minuten je Land

**Durchsatz.** In 14 Tagen gab es 412 Lands, also 29,4 am Tag (`lane-outcomes.jsonl`
`disposition:"landed"`, deckungsgleich mit 412 Land-Notes). Davon:

- 294 auf main mit Vollkette (21,0 am Tag)
- 109 auf main docs-only mit Kurzkette (7,8 am Tag)
- 9 auf overhaul (0,64 am Tag)

Ob ein Land zu main oder overhaul gehoert, entscheidet das Feld `base` der Note (19 Notes tragen
es). Fehlt es, entscheidet die Erreichbarkeit von `mainAfter` aus `main` bzw. `overhaul`.

**Je Land** (Mittel / p50 / p90, Minuten). Gate-Arbeit ist `verify.ms − verify.waitMs` der Land-Note.
Gate-Warten ist `verify.waitMs`, die Schlange vor dem Suite-Mutex. Audit-Minuten sind die Wanduhr
`ms` der Post-Land-Audit-Zeilen, geteilt durch die Zahl ihrer `covers`.

| Basis, Kette | Lands | Gate-Arbeit | Gate-Warten auf Mutex | Post-Land-Audit je gedecktem Land |
|---|---|---|---|---|
| main, Vollkette | 294 | 3,19 / 2,7 / 4,0 | 4,07 / 0 / 14,3 | 18,9 (272 Voll-Audits, 269 davon auf dem Helfer, 317 covers) |
| main, docs-only | 109 | 0,05 / 0,0 / 0,1 | Mutex nicht genommen | 0,1 (76 Kurz-Audits lokal, 85 covers) |
| overhaul, Vollkette | 9 | 4,4 / 4,3 / 5,0 | 12,3 / 1,2 / 44,6 | 20,6 (8 Voll-Audits auf dem Helfer, 8 covers) |

**Je Tag, gleiche Quellen:**

- Gate-Arbeit: 984 Minuten in 14 Tagen, also 70 min am Tag lokal.
- Gate-Warten: 1 307 Minuten in 14 Tagen, also 93 min am Tag.
- Voll-Audits: 280 Stueck, zusammen 6 151 Wanduhr-Minuten, also 439 min am Tag, fast alles auf dem
  Second-host. Summiert man die Shard-Laufzeiten, sind es 533 Shard-Minuten am Tag (nur Zeilen mit
  `shards`-Liste).
- Nur 3 Voll-Audits liefen lokal. Ihre Mutex-Wartezeit betrug zusammen 34 min.
- Ein Voll-Audit deckte im Mittel 1,16 Lands (325 covers auf 280 Audits). Tier 2 laeuft damit fast
  je Land.

**Wohin die Gate-Arbeit geht** (Trail seit 18.09., Dateien ohne `slot`; der Gate-Kind-Env streicht
alle `FLEET_*`-Variablen, `server.ts#verifyChildEnv`):

- clean-review: 352 Dateien, 202 min
- security: 176 Dateien, 38 min
- claude-gate: 522 Dateien, 292 min

Das sind 176 Gates (167 main plus 9 overhaul). Je Gate entfallen 3,02 min auf die drei
Tier-1-Suiten. Die Gate-Arbeit je Vollketten-Land lag im selben Zeitraum bei 3,78 min, also bleiben
**etwa 0,8 min fuer install, pins, tsc und build** (abgeleitet, nicht einzeln gestoppt).

**Was Lanes lokal selbst fahren** (Trail seit 18.09., Dateien mit `slot`; das ist weder Gate noch
Audit):

| Suite | Dateien | Minuten | je Tag | Dateien mit mindestens einem `ok:false` |
|---|---|---|---|---|
| `./e2e-isolated.sh` (Vorschau und Flake-Beweis) | 283 | 3 681 | **424** | 151 (53 %) |
| die drei Tier-1-Wrapper | 874 | 444 | 51 | 6 |
| `fleet-e2e-postland-audit` | 17 | 217 | 25 | 15 |

**Wie oft die Stufen rot sind.** Tier 1 am Gate: seit 18.09. eine rote Trail-Datei unter 1 050
(security). Voll-Audits in 14 Tagen: 56 rot bei 278 Verdikten, also 20,1 %. Davon fielen 38 mit
genau einem Check. Adjudiziert sind 20 Audits aus dem Fenster (`audit-adjudications.jsonl`, nach
`auditAt`):

- 11 flake
- 5 real (aus 3 Ursachen; bei 2 Zeilen steht „nicht vom gedeckten Land")
- 1 stale-test
- 3 unknowable

### (2) Was das overhaul-Muster heute ist

- **Basis:** `server.ts#integrationBranch(repo, requested)` prueft eine angefragte Basis und faellt
  sonst auf `repoBases[repo]` bzw. den HEAD des Haupt-Checkouts zurueck. `server.ts#laneBaseRef`
  bevorzugt die beim Fork gespeicherte `worktree.base`. Eine overhaul-Lane forkt, rebased und landet
  also gegen `overhaul`. Das haelt der Check `integration base: task and retargeted lanes land on
  overhaul; main stays byte-identical and audit names the tip` in `e2e/merge.ts` fest (Land
  `01d2e641`).
- **Gate beim Land auf overhaul:** Es ist dieselbe Kette wie auf main.
  `server.ts#verifyPlanFor(cwd, repo, mainSha)` fragt nur den Fussabdruck (`verificationProportionFor`)
  und das Repo (`repoRunsShortChain`), die Basis fragt es nicht. Es kennt genau zwei Ausgaenge:
  docs-only mit `install, pins`, sonst die volle konfigurierte Kette. Alle 9 overhaul-Notes tragen
  `proportional:false` und alle sieben Schritte. Ihr Mutex-Warten war hoeher als auf main (p90
  44,6 min gegen 14,3 min).
- **Post-Land-Audit:** `server.ts#schedulePostLandAudit(repo, main, …)` bekommt die Basis als `main`.
  8 Audit-Zeilen tragen `main:"overhaul"`, alle voll, alle auf dem Helfer in 3 Shards, 6 gruen und
  2 rot (`7b07f26a` mit 5 Fails, `69c27338` mit 0 benannten Fails). Das neueste Land `0f7e83d4` hatte
  beim Messen noch kein Audit.
- **Merge overhaul nach main: Diesen Pfad gibt es nicht.** `server.ts` enthaelt das Wort „overhaul"
  nicht. `git rev-list main..overhaul` zaehlt 18 Commits, `overhaul..main` 30. Gemerged wurde bisher
  nur in die andere Richtung: drei Hand-Commits „merge main into overhaul" (`ddb45712`, `b70987f8`,
  `e31e885f`) ohne Land-Note, also ohne eigenes Gate und ohne eigenes Audit. Geprueft wurden sie erst
  mit dem Tip des naechsten overhaul-Lands. Der Plan sagt „main wird erst nach Gesamtpruefung auf der
  Testinstanz in einem Zug nachgezogen" (docs/overhaul-plan-2026-09-25.md, Welle 0).
  `testinstanz.sh` faehrt keine Suite, laut Kopf fasst es `e2e-stage.sh` nie an. **Einen vollen
  Audit am Merge gibt es heute also nicht.**
- **Zwei Stellen sind je Repo geschluesselt, nicht je Zweig:**
  - `auditQueue` (`Map<repo, {main, covers}>`): `schedulePostLandAudit` ueberschreibt `q.main`. Ein
    main-Land und ein overhaul-Land vor demselben Drain wuerden gegen den Tip des zuletzt gemeldeten
    Zweigs auditiert. Beobachtet: 0 von 410 zuordenbaren covers im Fenster. Latent, wird aber
    haeufiger, je mehr auf overhaul landet.
  - `undoStack` (`server.ts#pushUndo`): Jeder Zweigwechsel zwischen zwei Lands ist eine GAP und
    leert den Stapel. Im Fenster gab es 14 solche Wechsel.
- **undo-land ist faktisch leer.** `server.ts#remoteHoldsLandedRange` verweigert das Undo, sobald ein
  Commit des Lands auf einem Remote liegt. Alle 412 Notes im Fenster tragen `hubPush.ok:true`, und
  `git branch -r --contains 1391139d` zeigt `hub/main`. Im Fenster: 0 undo-Ereignisse in
  `audit.jsonl`, 0 `reverted`-Zeilen in `lane-outcomes.jsonl`. Das ist aus Code und Ledger
  abgeleitet, an der Route selbst nicht geprobt (sie veraendert Zustand). Die Tiefe
  `UNDO_STACK_MAX = 3` beschreibt deshalb nicht, was heute zurueckrollbar ist.

### (3) Das Modell Buendelzweig: welche Stufe wo laeuft

| Stufe | Dauer, gemessen | heute (main) | Land auf den Buendelzweig | Merge Buendel nach main |
|---|---|---|---|---|
| install + pins | 17 s (Land `1391139d`) | Gate | Gate | Gate |
| tsc + build | ~0,8 min, abgeleitet | Gate | Gate | Gate |
| Modul-Suiten (`FLEET_E2E_MODULES` aus `verificationProportionFor.modules`) | eine Vorschau | Lane-Vorschau, nie Gate (verify-tiering §16a) | unveraendert eine Vorschau | – |
| clean-review, security-Wrapper, claude-gate | 3,02 min je Gate | Gate | **entfaellt** | Gate |
| `./e2e-isolated.sh` inkl. `e2e/security.ts` | 18,9–20,6 min Helfer (3 Shards), 35–41 min lokal (verify-tiering §6.2) | Post-Land-Audit | Post-Land-Audit am Buendel-Tip (wie heute auf overhaul) oder keiner | **Variante A:** hartes Gate vor main. **Variante B:** Post-Land-Audit auf main wie heute, dazu die Regel „nur ein Tip mit gruenem Buendel-Audit wird gemerged" |

Rechnung bei heutigem Durchsatz: 21 Vollketten-Lands am Tag, Buendel aus N Lands, also 21/N Merges
am Tag, 22 Helfer-Minuten je Voll-Audit.

- **Tier-1-Suiten:** 21 × 3,02 = 63 min am Tag lokal. Davon kommen 21/N × 3,02 am Merge zurueck.
  Bei N = 5 spart das **50 min am Tag**. Dazu kommt das Warten: Ein Land mit Quellkette nimmt den
  Suite-Mutex nicht (so wie die docs-only-Kette heute, siehe die Note von `1391139d`: „suite mutex:
  NOT TAKEN"). Fuer diese Lands faellt das Warten ganz weg (heute Mittel 4,07, p90 14,3 min je Land).
  Wie viel der 93 min am Tag die Tier-1-Laeufe selbst erzeugen, ist nicht gemessen: Den Mutex halten
  vor allem die Lane-Vorschauen mit 424 min am Tag.
- **Tier 2 nur am Merge:** 439 min am Tag heute. Mit Rerun-Regel und Bisect (Tabelle unter (4)) sind
  es bei N = 5 und r = 2 % noch 142 min, also **rund 300 Helfer-Minuten am Tag weniger**. Das spart
  Zeit auf dem Second-host, nicht auf dieser Maschine: 269 der 272 Voll-Audits auf main liefen dort.
- **Was der Buendelzweig nicht wegnimmt:** die 424 min am Tag an lokalen `e2e-isolated`-Vorschauen.
  53 % dieser Laeufe haben mindestens ein Rot. Die Vorschau ist also die Stelle, an der Lanes ihre
  eigenen Fehler mit Zuordnung finden. Fielen sie weg, landeten diese Baeume im Buendel.

### (4) Wo die Gewaehrleistung bleibt, und was sie kostet

- **Erkennung bleibt:** Jede Zeile Code laeuft vor main (Variante A) bzw. vor dem Merge (B) durch
  dieselben Suiten. In Variante A laeuft `e2e-isolated.sh` sogar **vor** main, heute nie
  (verify-tiering §6 (e)).
- **Zuordnung geht verloren:** Ein rotes Buendel-Gate nennt N Lands statt einem (verify-tiering §6
  (b)). Bisect kostet ⌈log2 N⌉ weitere Voll-Laeufe. Bei einer Flake-Rate von p_f ≈ 13 % je Lauf
  kann jeder Bisect-Schritt selbst flaken. p_f ist abgeleitet: 20,1 % rote Voll-Audits × 11/17
  adjudizierte flake. Die Mechanismen dahinter stehen je Familie in docs/verify-tiering.md §11.
- **Verhindern geht innerhalb des Buendels verloren:** Folgelanes forken von einem Buendel-Tip, den
  noch keine Tier-1-Suite gesehen hat. Tier 1 war seit 18.09. am Gate 1-mal in 1 050 Dateien rot, das
  Risiko ist klein, aber nicht null.
- **Zurueckrollen:** undo-land hilft weder heute noch im Buendel (siehe (2): Hub-Push 412/412,
  Stapel je Repo). Im Buendel heisst Rollback Revert-Commit oder Fix-forward auf dem Buendelzweig.
  main bleibt davon unberuehrt.
- **Beerdigt, und hier ausdruecklich benannt:** Variante A ist ein hartes Gate ueber die volle
  Suite. docs/work-register-2026-08-06.md §7 hat „`rerere` + ein hartes Pre-Land-Gate" beerdigt,
  weil die volle Suite zu nicht-deterministisch ist, um zu gaten. Diese Notiz widerlegt den Beleg
  nicht: 20,1 % rot, rund zwei Drittel davon flake. Sie aendert nur die Einheit (ein Gate je Buendel
  statt je Land). Ein rotes Buendel-Gate darf auch keinen Rollback ausloesen, das waere der ebenfalls
  beerdigte Auto-Rollback (1 von 15 roten Audits war damals `real`). Variante A wieder aufzumachen
  ist eine Owner-Entscheidung gegen den Beleg, keine Folge dieser Messung.

**Kipp-Rechnung.** Ein Buendel ist gruen mit P = (1 − p_f)(1 − r)^N. Dabei ist r die Rate echter,
landbedingter Rot je Land:

- Untergrenze r = 0,9 %: 3 landgebundene echte oder stale Befunde auf 325 gedeckte Lands.
- Obergrenze r = 6,1 %: die 36 nicht adjudizierten Rot wie die 17 entschiedenen aufgeteilt.

Das Modell je Merge: ein Lauf, bei Rot ein Rerun desselben Baums (verify-tiering §11.7), bei echtem
Rot ⌈log2 N⌉ Bisect-Laeufe × 1,13.

| N | P gruen (r 0,9 / 2 / 6 %) | Helfer-min am Tag (r 2 %) | gespart gegen 439 (r 2 %) | Zeit bis zum Schuldigen bei echtem Rot |
|---|---|---|---|---|
| 1 | 0,86 / 0,85 / 0,82 | 530 | −90 | 44 min |
| 3 | 0,85 / 0,82 / 0,72 | 202 | 238 | 94 min |
| 5 | 0,83 / 0,79 / 0,64 | 142 | 298 | 119 min |
| 10 | 0,79 / 0,71 / 0,47 | 98 | 342 | 143 min |
| 21 | 0,72 / 0,57 / 0,24 | 74 | 366 | 168 min |

Die Zeile N = 1 liegt ueber dem heutigen Wert, weil das Modell jedes Rot automatisch rerunnt; der
heutige Audit tut das nicht. Laeuft die Suite lokal statt auf dem Helfer (~38 min), sind alle
Zeiten ×1,7.

**Wo es kippt.** Suite-Minuten sprechen fuer jedes N ≥ 2. Die Ersparnis waechst mit 1 − 1/N, der
Bisect nur mit log N. Die Laufzeit T der Suite verschiebt diesen Punkt nicht, weil sie Ersparnis
und Bisect gleich skaliert; sie verlaengert nur die Latenz. Kippen tun zwei andere Groessen:

1. **Der Merge wartet oefter, als er geht,** sobald P gruen < 0,5 ist. Das geschieht bei
   N ≈ 61 / 27 / 9 fuer r = 0,9 / 2 / 6 %.
2. **Die Latenz nach main:** Bei 21 Lands am Tag in rund 16 aktiven Stunden entspricht N = 5 etwa
   4 h Buendelalter. Bei echtem Rot kommen 2 h Bisect hinzu. Live-Fixes muessen deshalb am Buendel
   vorbei direkt auf main, wie es die overhaul-Regel schon vorsieht.

Solange r nicht adjudiziert ist, liegt die sichere Zone bei **N ≤ 5**. Dort sind bei r = 6 % noch
64 % der Merges gruen, und der Bisect bleibt bei 3 Schritten.

### (5) Empfehlung mit Schnittlinie

Das kleinste Stueck, das der Owner-Satz verlangt („manche suiten nicht immer zu fahren"), ohne eine
beerdigte Position zu beruehren: **Buendel-Lands verlieren die Tier-1-Suiten und den Mutex, nicht
den Tier-2-Audit.** overhaul ist der einzige Buendelzweig, der heute existiert, also dort. Varianten
A und B fuer den Merge nach main bleiben ausdruecklich offen. Die Schnittlinie liegt nach diesem
einen Schnitt. Den Audit auf den Merge zu verschieben (die 300 Helfer-Minuten) setzt einen
Merge-Pfad voraus, den es nicht gibt, und ist eine eigene Entscheidung.

Karten-Entwurf (nicht gefilet):

```
ZIEL: Lands mit Basis overhaul fahren im Land-Gate nur install, pins, tsc, build und nehmen den Suite-Mutex nicht; der Post-Land-Audit auf overhaul bleibt voll.
FLAECHE: server.ts · verify-proportion.ts · e2e/merge.ts · e2e/pins.ts · docs/verify-tiering.md · AGENTS.md
DONE: Ein Check in e2e/merge.ts landet eine Lane mit Basis overhaul und server.ts im Diff; ihre Land-Note traegt steps ["install","pins","tsc","build"] und den Mutex-nicht-genommen-Vermerk, dieselbe Aenderung mit Basis main traegt alle sieben Schritte. Mutationsprobe: Basisbedingung entfernt, der Check wird rot. e2e/pins.ts pinnt den neuen Befehl neben VERIFY_PROPORTIONAL_CMD. Eine ./e2e-isolated.sh-Vorschau (Land-Pfad beruehrt) laeuft gruen per Suite-Offer.
ABBRUCH: Zwei Tier-1-Rot (clean-review, security, claude-gate) am overhaul-Tip innerhalb von 14 Tagen nach Deploy oder 20 overhaul-Lands, die sich einem ohne Vollkette gelandeten overhaul-Land zuordnen lassen: Schnitt zurueck, Vollkette fuer overhaul wieder an.
```

Was der Schnitt bei heutigem overhaul-Durchsatz (0,64 Lands am Tag) spart: rund 3 min Arbeit und
12 min Warten je Land, also etwa 10 min am Tag. Das ist wenig. Er wird erst gross, wenn strukturelle
Arbeit wie geplant auf overhaul landet: Ginge die Haelfte der 21 Vollketten-Lands dorthin, waeren es
rund 75 min am Tag lokal, und diese Lands warteten nicht mehr auf den Mutex. Die Zahl ist
hochgerechnet, nicht gemessen.

Zwei Funde aus (2), die jede Buendel-Arbeit vorher kennen muss (Befunde, keine zweite Karte):

- `auditQueue` und `undoStack` sind je Repo geschluesselt. Die Queue kann main- und overhaul-covers
  unter einem Tip zusammenlegen; der Stapel leert sich bei jedem Zweigwechsel.
- Es gibt keinen Merge-Pfad overhaul nach main und damit heute keinen vollen Audit am Merge.

## Methode

Alle Rohdaten wurden aus dem Haupt-Checkout gelesen, Skripte liegen im Scratchpad.

```sh
# Land-Notes (958 insgesamt; 412 im Fenster)
git notes --ref=fleet/land list | while read n c; do printf '%s\t' "$c"; git cat-file -p "$n" | tr '\n' ' '; echo; done > landnotes.tsv
# je Note: verify.ms, verify.waitMs, verify.proportional, verify.steps; Basis = note.base,
# sonst mainAfter in `git rev-list main` bzw. `git rev-list overhaul`
# Post-Land-Audits: post-land-audits.jsonl, repo endet auf /claude-fleet, at >= Fensteranfang;
#   remote = Feld remote oder cmd beginnt mit "remote helper"; Shard-Minuten = Summe shards[].ms
# Adjudikationen: audit-adjudications.jsonl, auditAt >= Fensteranfang
# Trail: e2e-trail/<suite>-<stamp>-<pid>.jsonl; Laufdauer = letzter ts − erster ts + erstes msSincePrev;
#   ohne slot = Gate-Kind (verifyChildEnv streicht FLEET_*), mit slot = Lane-Lauf; rot = eine Zeile ok:false
# Verdikte ohne Land: audit.jsonl{,.1} event merge_verdict (539 im Fenster, keines "blocked")
# Zweigwechsel: Lands nach at sortiert, Nachbarn mit verschiedener Basis gezaehlt
```

Kipp-Tabelle: P gruen = 0,87 · (1 − r)^N. Laeufe je Merge = 1 + (1 − P) + (1 − (1 − r)^N) ·
⌈log2 N⌉ · 1,13. Helfer-min am Tag = 21/N · Laeufe · 22. Zeit bis zum Schuldigen =
(2 + ⌈log2 N⌉ · 1,13) · 22 min.

## Was nicht gemessen wurde

- **Helfer-Vorschauen per Suite-Offer:** Sie laufen auf dem Second-host und stehen nicht im lokalen
  Trail. Die 424 min am Tag an Lane-Vorschauen sind nur der lokale Teil.
- **Ein rotes Tier-1-Gate im Ledger:** `merge_verdict` fuehrt kein `ok`. Ein rotes Gate auf dem
  sauberen Pfad endet als `resolved` (`server.ts#cleanVerifyStop`) und ist von einem Konflikt-Stopp
  nicht zu trennen. Die Tier-1-Rotrate oben stammt deshalb aus dem Trail, nicht aus Verdikten.
- **Einzelzeiten von tsc und build:** nur als Rest (~0,8 min) abgeleitet.
- **Ob der overhaul-Zweig selbst ueber den normalen Land-Pfad nach main gelandet werden kann:**
  nicht geprueft.
- **Welcher Anteil der 93 min am Tag Mutex-Warten auf Tier-1-Laeufe entfaellt:** nicht zerlegt.
- **r:** nur als Spanne; 36 von 56 roten Voll-Audits sind nicht adjudiziert.
- **Andere Repos:** `claude-fleet-demo`, `private-repo-ad` und weitere haben eigene Ketten und liegen
  ausserhalb.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-26T14:25Z	brief	vollen DONE-Text aus fleet.json gelesen	die Karte im Brief war abgeschnitten	fleet.json Task 1f1663fc	fuenf Punkte
2026-09-26T14:28Z	quellen	Gate-Minuten aus Land-Notes statt merge_verdict	merge_verdict fuehrt kein ok und keine Basis	server.ts#cleanVerifyStop	412 Notes im Fenster
2026-09-26T14:30Z	basis	Basis per note.base, sonst Erreichbarkeit von mainAfter	nur 19 Notes tragen base	git rev-list main/overhaul	403 main, 9 overhaul
2026-09-26T14:31Z	trail	Gate- und Lane-Laeufe am slot-Feld getrennt, erst ab 18.09.	verifyChildEnv streicht FLEET_*; slot existiert erst seit 17.09.	docs/e2e-trail.md §2a	176 Gates, 3,02 min Tier-1 je Gate
2026-09-26T14:33Z	audit	Auditqueue und undoStack am Code gelesen	Buendel braucht Tip-genaue Audits und Rollback	server.ts#schedulePostLandAudit, #pushUndo	beide je Repo geschluesselt; 0 Kreuz-covers beobachtet
2026-09-26T14:35Z	undo	undo-Route nicht geprobt, nur Code und hubPush gelesen	mutierende Route, nie mit Platzhalter proben	server.ts#remoteHoldsLandedRange	hubPush ok 412/412, 0 undo-Ereignisse
2026-09-26T14:37Z	modell	p_f aus Audit-Rotrate mal adjudiziertem Flake-Anteil, r als Spanne	36 von 56 Rot nicht adjudiziert	audit-adjudications.jsonl	p_f 0,13; r 0,9–6,1 %
2026-09-26T14:38Z	schnitt	Erster Schnitt ohne Merge-Gate und ohne Audit-Verschiebung	beides ist beerdigt oder braucht einen fehlenden Merge-Pfad	work-register §7	overhaul-Lands mit Quellkette
```
