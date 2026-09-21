---
frage: Wie bestimmt die Dispatch-Mechanik Flaeche, Nebenlauf, Abhaengigkeit und Program einer Zeile, und was braeuchte ein Buendel-Vorschlag der Maschine?
urteil: Die Flaeche ist eine Erwaehnungsliste statt einer Schreibliste (62 % der gelandeten Lanes schrieben ausserhalb, 33 % der beanspruchten Dateien blieben unberuehrt); Abhaengigkeiten gehen an drei benennbaren Stellen verloren, allen voran an der Autorenkarte, die `after` gar nicht annimmt; Buendel schlaegt die Land-Faltung heute schon vor, aber nach einer anderen Regel als der des Owners. Drei Schnitte ueber der Linie, zwei darunter.
bereich: [queue, dispatch, buendelung]
belege: [task-metadata.ts#intentText, task-metadata.ts#deriveTaskMetadata, server.ts#taskSurfaceOf, server.ts#startPlanNow, start-plan.ts#collision, start-plan.ts#releaseVerdict, server.ts#releaseCardRefusal, server.ts#authorCardFrom, card-extract.ts#parseFormattedCard, card-extract.ts#validateCard, waits.ts#namedAfterIds, task-land-waves.ts#classify, server.ts#tickDispatch, server.ts#laneAutoCloseRefusal]
nicht-gemessen: der Moment „4 von 7 Plaetzen" selbst (heute nur noch 2 Lanes offen); Report 23758b7e der Sichtung d6bbca83 (fuer eine Lane nicht lesbar); ob S5 mehr Merge-Konflikte erzeugt; fremde Repos ausser der Private-repo-aa-Stichprobe
stand: 2026-09-21
---

# Dispatch und Aggregierung: Flaeche, Nebenlauf, Abhaengigkeit, Buendel

2026-09-21, Lane `fleet/260921185749-5eea` (Zeile 3488416a). Owner, woertlich: „Danach möchte ich
dann das du dir auch nochmal die task dispatch bzw die aggrierungsfunktion, die sich um betroffene
Flächen, nützliches bündeln, usw. guckt". Frage: **Wo liegt die Mechanik falsch, die heute bestimmt,
was eine Zeile anfasst, was neben was laufen darf, worauf sie wartet und womit sie gebuendelt wird?**

Aufgebaut auf: `2026-09-12-spezifizierung-buendelung-befund.md` (Datei ist kein Kollisionsmass),
`2026-09-13-task-aggregation-a-e-fable.md` (Filing-Format), `2026-09-15-start-plan-stau-schnitt.md`
(Claims wartender Wellen), `2026-09-16-buendelung-systempruefung-glm.md` (Wellen 1,6 % der Lands),
`2026-09-20-quellen-referenzen-retention.md` (`NACH:` → `card.after` laeuft). Diese Befunde werden
hier nicht wiederholt, nur dort benutzt, wo sie eine neue Zahl tragen.

Markierung: **[G]** = heute gemessen (Kommando in §Methode), **[C]** = am Code gelesen (Symbol
genannt), **[A]** = abgeleitet, nicht gemessen.

## Ergebnis

### (a) Wie die Flaeche einer Zeile bestimmt wird, und wo sie falsch liegt

Rangfolge in `server.ts#taskSurfaceOf` [C]: (1) eine bestaetigte Liste (`filesOrigin:"confirmed"`),
(2) ein Karten-Lift (`filesOrigin:"card"`, nur mit Program und `surfaceValid`), (3) die Dateien
einer **gueltigen** Karte, (4) sonst die Prosa: `task-metadata.ts#deriveTaskMetadata` nimmt jeden
getrackten Pfad aus Zeilentext **und Brief**. Maskiert werden dabei nur VERIFY-Zeilen und zitierte
Kommandos (`task-metadata.ts#intentText`). Eine laufende Lane beansprucht die Flaeche ihrer Zeilen;
ihre echten Hunks (`land-collision-stats.ts#laneHunkRanges`) ersetzen nur auf einer Datei, die die
Zeile schon nennt, den Ganz-Datei-Rueckfall (`start-plan.ts#collision` laeuft ueber `a.files`, die
Lane-Dateien in `server.ts#startPlanNow` sind nur die Zeilenflaechen).

Offener Bestand, 33 `auftrag`-Zeilen pending/queued [G]: Flaechen-Herkunft 17 `card`, 13 `derived`
(Prosa), 3 ohne Flaeche. Drei Zeilen haben eine **gueltige** Karte mit 0 Dateien und fallen deshalb
auf die Prosa zurueck (1832c7eb 8 Dateien, cd0dda27 11, 0873aafa 7).

Wo sie falsch liegt, gemessen an 201 gelandeten claude-fleet-Lanes seit 2026-09-14, deren Zeile
eine Flaeche und deren Outcome `filesTouched` traegt [G]:
- **Zu eng:** 125 von 201 Lanes (62 %) schrieben mindestens eine Datei ausserhalb ihrer Flaeche,
  349 Dateien insgesamt. Spitze: `e2e/pins.ts` 41-mal (die VERIFY-Maske loescht den Pin genau dort,
  wo er steht), `server/audit-log.ts` 18, `docs/messungen/INDEX.md` 14, `docs/self-api.md` 13. Solche
  Dateien sieht der Startplan nie, auch nicht, wenn die Lane sie schon geschrieben hat [C].
- **Zu weit:** 227 von 696 beanspruchten Dateien (33 %) wurden nie beruehrt, in 81 Zeilen.
  Spitze: `server.ts` 24-mal, `server/types.ts` 12, `AGENTS.md` 8, `card-extract.ts` 7. Ursache [C]:
  `LESEN:`-, Anlass- und Beleg-Zeilen sind nicht maskiert. Der Live-Fall ist diese Lane selbst: Zeile
  3488416a traegt die abgeleitete Flaeche `AGENTS.md card-extract.ts docs/messungen/INDEX.md
  docs/queue-*.md (3) register.sh server.ts start-plan.ts` (9 Dateien) und schreibt zwei Dateien
  unter `docs/messungen/`. Solange sie laeuft, haelt sie jede Zeile, die eine der sieben gelesenen
  Dateien ohne Range nennt [A, aus `start-plan.ts#rangesOn`].

Herkunft der 201: 111 card, 68 derived, 22 confirmed [G]. Nach Herkunft getrennt ist nicht
ausgewertet.

### (b) Was der Tick nebeneinander laufen laesst, und wo er irrt

`server.ts#tickDispatch` laeuft die Wellen von `start-plan.ts#projectStartPlan` in Planordnung ab.
Je Welle gilt die Reihenfolge [C]: `after` hart → Freigabe (`releaseVerdict`) → Kollision mit
laufender Lane → Kollision mit frueherer, wartender Welle (nur bekannte Ranges) → Repo-Deckel →
Program-Deckel → ohne gebundene MAIN hoechstens eine Policy-Lane.

**Haelt zurueck, obwohl es parallel ginge:**
1. Die Ueberbreite aus (a): eine gelesene Datei wird zur beanspruchten. Die 33 % unberuehrten Dateien
   sind die Obergrenze dieses Fehlers [G]; wie viele Wartestunden er gekostet hat, ist nicht gemessen.
2. **Fertige Lanes belegen Arbeitsplaetze.** Der Repo-Deckel zaehlt `slots.filter(inRepo)`, also
   jede Worktree-Lane, auch eine mit Report `complete` und Kandidat [C, `server.ts#tickDispatch`,
   `server.ts#inRepo`]. Der Auto-Close schliesst nur Lanes ohne landbaren Kandidaten
   (`server.ts#laneAutoCloseRefusal`). Heute, 14 Lands mit vorangehendem `complete`-Report: Abstand
   Report → Land Median 16 min; 4 ueber 100 min (106, 142, 436, 549); Summe 23,5 Lane-Stunden [G].
   Nach Lander getrennt: Fleet-Betrieb-MAIN 7 Lands mit 4 bis 69 min; Jev-MAIN 142 und 549 min;
   **programlose Zeilen, vom Owner gelandet, 8, 106 und 436 min** [G]. Der Stau haengt also
   zusammen mit (c): eine programlose Lane hat keine MAIN, die sie landet.

**Laesst parallel, obwohl es kollidiert:**
3. Die Unterbreite aus (a): 62 % der Lanes schreiben Dateien, die im Plan nicht vorkommen. Sie
   treffen sich erst beim Merge [G fuer die Dateien, A fuer die Folge].
4. `files: null` erzeugt keine Kante (`start-plan.ts#collision`, bewusst seit 2026-09-14). Das
   betrifft heute 3 Zeilen (4b6854fa, 20cf559e, 4249c5ef), alle mit ungueltiger Karte, starten also
   nur nach Handfreigabe [G].
5. Verlorene `after`-Kanten, siehe (c). Dieser Fall ist der teuerste, weil er die Reihenfolge
   umdreht, nicht nur den Nebenlauf.

### (c) Wo Abhaengigkeiten und Program-Zugehoerigkeit beim Filen verloren gehen

Wer die Karte liest [G, 33 offene Zeilen]: 5 der Parser (`model: "format"`), 9 eine Autorenkarte
(`author`), 19 das Modell. Der Parser scheitert bei 21 Zeilen an der ersten Zeile, weil
sie mit „Owner 2026-09-21 woertlich …" beginnt statt mit `[TITEL]` oder einem Schluessel; dazu
bei `ZIEL:`, `REPO:`, `BEFUND:`, `OFFEN, …` mitten im Kopf (`card-extract.ts#parseFormattedCard`
bricht bei der ersten unbekannten Zeile ab). Gueltig sind 18 von 33 Karten.

Abhaengigkeit, die der Text per Id nennt (`waits.ts#namedAfterIds`), die aber nicht in `card.after`
steht [G]: **5 Kanten auf 4 Zeilen.**

| Zeile | Program / Politik | Text nennt | card.after | Kartenweg | Was sie heute haelt |
|---|---|---|---|---|---|
| 49105904 | Private-repo-aa / card-valid | `NACH: 3cf96d68, a036ca50` (3cf96d68 pending) | leer | author | nur ein Hold |
| d5a399ff | Oberflaeche / manual | „NACH b3dc378b starten" | leer | author | Freigabe; getrennte Welle von b3dc378b |
| 057b1bf4 | Oberflaeche / manual | „NACH 0504e7c8 starten" | leer | author | Freigabe; gleiche Welle, Reihenfolge nur zufaellig per `created` |
| fa07734f | Fleet-Betrieb / card-valid | `NACH: 8b2baf60` (im Brief) | leer | format | ungueltige Karte |

Drei Verlustorte [C]:
1. **Die Autorenkarte kann `after` nicht tragen.** `server.ts#authorCardFrom` liest nur
   `ziel, surface, done, verify, verboten, size` und weist jedes weitere Feld mit 400 ab. Das trifft
   beide Tueren (`POST /api/tasks` und die MAIN-Tuer `createTaskForMain`). `AGENTS.md` Punkt 5 unter
   „Rows for a repo that is not claude-fleet" verlangt aber genau `card.after`. 49105904 schreibt
   deshalb `NACH:` UND `after:` in die Prosa; beides wird nie gelesen, weil eine Autorenkarte erst
   neu gelesen wird, wenn der Brief sich bewegt.
2. **Die Pruefung „Text nennt NACH, Karte nicht" gibt es nur an einer von drei Freigabe-Tueren.**
   `server.ts#releaseCardRefusal` steht nur in `releaseTaskForMain`. Die ▸-queue-Tuer des Owners
   prueft sie nicht, und `start-plan.ts#releaseVerdict` unter `card-valid` auch nicht. Ohne den Hold
   wuerde 49105904 per Politik vor seinem Vorgaenger 3cf96d68 starten [A, aus dem Code].
3. **Prosa ohne Id oder ohne Signalwort.** `namedAfterIds` kennt `nach|after|wartet auf` + Id.
   Nicht erkannt werden „folgt auf f29538f8" (25d9ac1e, b3dc378b; Ziel jeweils done, also heute
   harmlos), „gleiche Flaeche wie d5a60f5e — nacheinander" (7274be6f), „sobald … 5f8a6aad existiert"
   (d5a399ff). Das bleibt Absicht (`2026-09-20-quellen-referenzen-retention.md`: keine Heuristik);
   nur „folgt auf" ist ein festes Signalwort, das fehlt.

Die Orchestratorin zaehlte sechs Prosa-Abhaengigkeiten (Report 23758b7e, nicht gelesen). Hier
gemessen sind 5 per Id plus 3 ohne Signalwort. Die Mengen sind nicht abgeglichen.

**Program:** 1 von 33 offenen Zeilen hat keins (63ed4614, Owner) [G], und **die Zeile dieser Lane
selbst** (3488416a, Kopf „[FLEET-BETRIEB · …") hat auch keins. Damit laeuft ihre Lane ohne
`slot.programId`, zaehlt gegen keinen Program-Deckel und hat keine MAIN, die sie landet. Mechanik [C]:
die MAIN-Tuer stempelt das Program aus der Bindung; die Owner-Tuer `POST /api/tasks` nur, wenn der
Body `programId` nennt. Nachtraeglich zuordnen kann seit 02880ee6 (2026-09-15) nur der Owner, per
`POST /api/tasks/:id/program`. Das Kartenfeld `program` wird extrahiert und gespeichert
(`card-extract.ts#validateCard`, 3 offene Karten tragen es), aber **kein Leser liest es** (`rg`
ueber `server.ts`, `src/`, `start-plan.ts`, `task-land-waves.ts`, `wave-brief.ts`). Folgen einer
programlosen Zeile [C]: Politik `manual`, also nie per Politik gestartet; die Land-Faltung setzt sie
allein (`kein-program`); die Lane landet der Owner (siehe (b)2).

Notiz 47ef9b60 (Filing-Tuer meldet ungueltige Karte nicht) bleibt offen und ist bestaetigt: 15 von 33
offenen Karten sind ungueltig [G]. Ihre zwei ungeprueften Fragen am Code [C]: die Owner-Tuer hat
dasselbe Loch fuer Prosa-Zeilen, eine Autorenkarte dagegen wird synchron geprueft und mit 400
abgewiesen; unter der Politik `all` startet eine Zeile mit ungueltiger Karte (`releaseVerdict`
antwortet `released` vor jeder Kartenpruefung).

### (d) Was ein Buendel-Vorschlag der Maschine braeuchte

Eine Buendel-Maschine gibt es schon: die Land-Faltung (`task-land-waves.ts#projectLandWaves`) baut
Wellen, und der Tick startet eine Welle als EINE Lane (`server.ts#tickDispatch`,
`server.ts#waveRowsOf`). Ergebnis heute [G, CLI in §Methode]: claude-fleet 28 Wellen, davon 2
mehrzeilig, beide im Program Oberflaeche:
`{b3dc378b, 0504e7c8, 057b1bf4}` und `{d5a399ff, 0c2d5975}`, geteilt `src/client.ts`,
`public/index.html`. Die 26 Einzelwellen stehen allein wegen: 12 `flaeche-nur-abgeleitet`,
8 `flaeche-ohne-bereich`, 3 `keine-flaeche`, 1 `kein-program`, 2 ohne Partner.

Die Regel des Owners (2026-09-18: gleiche Flaeche, hoechstens mittel, ein VERIFY, ein Program)
gegen die Faltung [C]:

| Owner-Regel | Faltung heute | Luecke |
|---|---|---|
| ein Program | Faltung nur innerhalb eines Programs | keine |
| gleiche Flaeche | kollidierende gemeinsame Datei (R4, ±40 Zeilen); Prosa-Flaeche buendelt nie, Karten-Flaeche nur mit Ranges auf beiden Seiten | Flaeche aus (a) ist ungenau, also sind die Kanten es auch |
| hoechstens mittel | Budget 5 Einheiten (klein 1, mittel 2, gross 3), max. 6 Zeilen | Welle 1 oben wiegt 4 = mittel+klein+klein, ueber der Owner-Grenze [A: „hoechstens mittel" gelesen als Gesamtgroesse der Sammelzeile] |
| ein VERIFY | nur Klasse docs/code | kein Vergleich von `card.verify` |
| Reihenfolge | `after` ordnet die Zeilen innerhalb der Welle | verlorene Kanten aus (c): d5a399ff steht in einer eigenen Welle neben b3dc378b statt dahinter |

Was fuer einen VORSCHLAG fehlt [A]: (1) eine Flaeche, die Schreibflaeche meint (Schnitt 2), sonst
schlaegt die Maschine Buendel auf gelesenen Dateien vor; (2) ein Filter nach der Owner-Regel ueber
den Wellen, mit Einheitensumme ≤ 2 und gleicher normalisierter VERIFY-Stufenmenge (die Stufennamen
kennt `card-extract.ts#validateCard` schon, `LOCAL_PROOF_STEPS`); (3) die „Folge": Zeilen, die per
`after` verkettet sind und dieselbe Flaeche haben, als EIN Worktree vorgeschlagen, wo die Faltung sie
heute in getrennte Wellen legt; (4) ein Ort, an dem der Vorschlag steht und von MAIN/Owner
angenommen wird, statt vom Tick gestartet: `GET /api/start-plan` traegt die Wellen schon und ist die
Flaeche, die der Owner liest.

## Schnitte, gerankt

Vorgabe woertlich: „die sich um betroffene Flächen, nützliches bündeln, usw. guckt". Ueber der
Linie steht, was Flaechen und Buendeln direkt betrifft; darunter, was der Anlass (2) und (3) nennt
und heute schon einen Handgriff hat.

1. **Abhaengigkeiten halten an jeder Tuer.** Flaeche: `server.ts#authorCardFrom` (liest `after`,
   gleiche Pruefung wie `card-extract.ts#validateCard`), `start-plan.ts#releaseVerdict` (neuer
   Check-Wert: vom Text genannte Id fehlt in `card.after` → harte Verweigerung unter `card-valid`),
   die Owner-▸-queue-Tuer (dieselbe Verweigerung wie `server.ts#releaseCardRefusal`),
   `waits.ts#namedAfterIds` (+ „folgt auf"). Groesse: mittel. VERIFY: install, pins, tsc; Suite-Offer
   mit `FLEET_E2E_MODULES=tasks`. Behebt (1): die 5 Kanten auf 4 Zeilen werden entweder Karte oder
   laut verweigert; 49105904 haengt nicht mehr an einem Hold.
2. **Flaeche = Schreibflaeche.** Flaeche: `task-metadata.ts#intentText` (maskiert `LESEN:`/`BELEG:`/
   `ANLASS:`-Zeilen und das Quellpaket wie VERIFY), `server.ts#startPlanNow` + `start-plan.ts#collision`
   (Lane-Dateien = Zeilenflaeche ∪ Dateien mit Hunks). `SURFACE_RESOLVER` hochzaehlen. Groesse:
   mittel. VERIFY: install, pins, tsc; Suite-Offer `tasks`. Behebt (b)1 und (b)3: Obergrenze 227
   ueberbeanspruchte und 349 ungesehene Dateien der 201 Lanes; Voraussetzung fuer Schnitt 3.
   Nachmessung: dieselbe Auswertung (§Methode, q7) nach 7 Tagen.
3. **Buendel als Vorschlag nach der Owner-Regel.** Flaeche: neue reine Funktion in
   `task-land-waves.ts` (Filter: ein Program, Einheiten ≤ 2, gleiche VERIFY-Stufen, `after`-Folge
   gleicher Flaeche als ein Worktree), Ausgabe als Feld `buendel` in `server.ts#startPlanNow`; kein
   Start durch den Tick. Groesse: mittel. VERIFY: install, pins, tsc, build; Suite-Offer `tasks`.
   Behebt (4): die Sammelzeile wird ein angezeigter Vorschlag statt Handarbeit einer Sichtungs-Lane.
   Nutzen je vermiedenem Land laut `docs/queue-wellen-2026-09-06.md` §3: ≈ 26,5 min Mutex-Zeit
   (Gate 107 s + Audit), weil ein Audit faktisch ein Land deckt (§1.4).

— **Schnittlinie.** Darunter: vorhandene Handgriffe tragen, und bei 5 ist der Preis ungemessen. —

4. **Programlose Zeile bekommt einen Adressaten.** Flaeche: `waits.ts#deriveWaits` (Grund
   „kein Program", Adressat owner, Tuer `POST /api/tasks/:id/program`), Vorschlag aus dem heute
   ungelesenen `card.program`. Groesse: klein. VERIFY: install, pins, tsc. Behebt (2) sichtbar
   statt still; die Zuordnung bleibt Owner-Akt.
5. **Fertige Lane zaehlt nicht gegen den Arbeitsdeckel.** Flaeche: `server.ts#tickDispatch`
   (Repo-Deckel zaehlt Lanes mit eigenem `complete`-Report und sauberem Baum getrennt, mit eigenem
   Deckel fuer „wartet aufs Land"), gespiegelt in `start-plan.ts#projectStartPlan`. Groesse: mittel.
   VERIFY: install, pins, tsc; Suite-Offer `tasks`. Behebt (3): heute 23,5 Lane-Stunden. Preis
   ungemessen: mehr offene Kandidaten, mehr Rebase-Konflikte beim spaeten Land. Der billigere Hebel
   ist 4, weil 2 der 3 langen Owner-Lands programlose Zeilen waren.

Nicht in der Liste: der tolerantere Kopf-Parser (21 von 33 Zeilen fallen an der ersten Zeile aufs
Modell). Schnitt 1 macht den Parser-Fehlgriff fuer die Reihenfolge harmlos, und Notiz 47ef9b60 traegt
den Rest.

## Methode

Stand `24b64676`, `fleet.json` des Haupt-Checkouts lesend gelesen (keine Token-Felder ausgegeben),
Skripte im Session-Scratchpad:

```
# q.py/p.ts: 33 offene auftrag-Zeilen; Karte, Kartenweg (card.model), Flaechen-Herkunft,
#   namedAfterIds(text+brief) ∩ Queue-Ids minus card.after; parseFormattedCard je Text
bun p.ts        # import aus card-extract.ts und waits.ts dieses Baums
# q6.py: lane-outcomes.jsonl ts ≥ 2026-09-21 00:00 lokal, disposition landed; je Land der letzte
#   fleetReports-Eintrag status complete mit provenance.taskId = taskId und reportedAt ≤ ts
# q7.py: lane-outcomes.jsonl ts ≥ 2026-09-14, landed, repo claude-fleet; Zeile aus tasks oder
#   tasks-archive.jsonl; Flaeche = task.surface.files (sonst task.files); Vergleich mit filesTouched
bun task-land-waves.ts --state /Users/owner/claude-fleet/fleet.json --default-repo /Users/owner/claude-fleet
```

Code gelesen: `start-plan.ts` ganz; `task-metadata.ts` Z. 1–470; `card-extract.ts#validateCard`,
`#parseFormattedCard`; `task-land-waves.ts` Z. 1–330; `waits.ts#namedAfterIds`; in `server.ts`
`#tickDispatch` (bis zum Program-Deckel), `#taskSurfaceOf`, `#liftCardSurface`, `#startPlanNow`,
`#releaseCardRefusal`, `#authorCardFrom`, `#createTaskForMain` (Kopf), die Routen `POST /api/tasks`,
`POST /api/tasks/:id/program`, `#laneAutoCloseRefusal` (Kopf); `register.sh` Abschnitt 2;
`docs/queue-sammelzeilen-verfahren.md`.

## Was nicht gemessen wurde

- Der Stau „4 von 7" als Momentaufnahme; heute gemessen ist nur der Abstand Report → Land.
- Wartestunden, die die Ueberbreite gekostet hat; nur die Dateimengen.
- (a) nach Flaechen-Herkunft getrennt, und ob `filesTouched` generierte Dateien
  (`docs/repo-map.generated.md`) mitzaehlt, die keine Karte nennen sollte.
- Report 23758b7e und der Abgleich mit den sechs Prosa-Abhaengigkeiten der Orchestratorin.
- Nicht gelesen: `docs/queue-wellen-2026-09-06.md` (nur §1.4 und §3) und `docs/queue-redesign-2026-09.md`
  (nur Gliederung; es ist ein Ansichts-Entwurf, keine Dispatch-Mechanik) im Volltext,
  `server.ts#startVariantGroup`, der Rest von `#tickDispatch` nach dem Program-Deckel.
