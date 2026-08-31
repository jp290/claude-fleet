# Die Drück-Liste — sieben Wellen über die offene Queue (2026-08-07)

*Herkunft: der Wert-Review aller offenen Zeilen, gefahren in Slot 2 (`task-review`, Haupt-Checkout,
Session-Transcript `1b1e4718`) in der Nacht vom 06. auf den 07.08. gegen Baum `082141a`, ~25 Belege
am Baum nachgemessen. Ausführung und die Korrekturen darunter: Session 33, Baum `dc2940e`.*

**Warum diese Datei existiert:** der Review lebte nach seinem Lauf nur in einer `.jsonl` und einem
Session-Scratchpad. Exakt so sind am 06.08. die vier Ideen-Scout-Vollreports verschwunden — die
Queue-Zeilen waren die einzige überlebende Fassung. Diese Datei ist die Gegenmaßnahme, kein Bericht.

Der Register-Stand selbst ist **abgeleitet, nicht hier**: `./register.sh`. Was hier steht, ist die
REIHENFOLGE und ihr Warum — das, was ein Skript nicht ableiten kann.

---

## 1 · Was am 07.08. bereits ausgeführt ist

**Vier Owner-Entscheide, alle umgesetzt:**

| Frage | Entscheid | Ausführung |
|---|---|---|
| F0 Slot-6-Share | sofort widerrufen | `POST /api/slots/6/unshare`, `shares: []`, Gäste getrennt |
| Archiv-Liste | alle 13 + 3 Formfehler | 13 archiviert (77 → 64 offen); Formfehler s. §5 |
| F2 Schwellen-Klasse | Bau und Auswertung **trennen** | als Kommentar auf `08f44054 380d24ee 5ff7233f 7d380d5e bbf2eea1` |
| F1 Kollisionswahrheit | Weg **(a)** — der Analyst bekommt Dateien | als Kommentar auf `9e0fdc3b 05ba5609 db02104d` |

**Drei Archiv-Kandidaten trugen Inhalt, der vor dem Archivieren weitergetragen wurde** — ohne das
wäre er mit der Zeile gestorben:

- `24f9213f` → Kommentar auf `0c7da157`: die vier Client-Stellen, an denen ein Land ankommt
  (`src/client.ts:856-859`, `:868-871`, `:890-892`, `:4589-4593`), und dass keine davon Erfolg meldet.
  `landCelebrate()` gehört dort mitgebaut. Der Partikel-Schauer bewusst nicht übernommen.
- `9821035e` → Kommentar auf `356333db`: die Elf-Snapshot-Messung, die `transcriptFact.mtime` als
  Aktivitätssignal widerlegt (bytes konstant über zehn Stunden, mtime rückt stündlich auf die
  gleiche Sekunde vor). `bytes` ist das belastbare Signal.
- `94565a55` → Kommentar auf `bbf2eea1`: der Digest-TTL-Mechanismus (2-min-TTL gegen stündlichen
  Puls → der Cache kann einen Puls nie bedienen, der Worker-Fehler wird nie gelesen).

**Aufgeräumt:** fünf verwaiste Worktrees entfernt (alle Branches Ancestor von `main`, null
uncommittete Dateien) samt Branches; die leeren Altlast-Verzeichnisse `steward.worktrees/` und
`fleet/` entfernt.

---

## 2 · Die Wellen

Harte Grenzen, die die Reihenfolge diktieren — nicht Themen:
**max 2 `server.ts`-Lanes gleichzeitig** · **UI-Zeilen kollidieren in `src/client.ts` miteinander** ·
**`21c6eb4b` läuft allein** · **Lands immer seriell**, ~12 min Takt (110 s Gate + ~600 s Post-Land-Audit
auf EINEM Suite-Mutex).

### Welle 0 — kostenlos (read-only, kein Land, kein Mutex, neben allem)

| Zeile | Knopf | Warum |
|---|---|---|
| `caaf8b16` | ▸ start lane | Fertiger `jq`-Block in `docs/autonomy-map` §12. Basiswert `landed 78, checked 0` — die ≥20 Lands existieren bereits, das ist ein rückwirkender Join, keine Feldmessung. Deshalb **nicht** Teil der F2-Klasse. |
| `32fc334a` | ▸ start lane | 430 MB unerklärt, Zähler stehen (`server.ts:6124-6170`), reines Ablesen. |

*Status: beide laufen seit 07.08. (Slot 1 und 4).*

### Welle 1 — der Takt selbst

| Zeile | Knopf | Begründung |
|---|---|---|
| `62302c47` | ▸ start lane | `server.ts:6795` `setInterval(tickAutos, 5000)` und `:6798` `tickDispatch, 8000` sind **Literale**, während die Nachbarn `ANALYSIS_TICK_MS` (`:2056`) und `AUTO_REVIEW_MS` (`:3605`) aus dem Env kommen. Einzige Zeile, die den 12-min-Takt selbst senkt — jede spätere Welle wird billiger. **Kosten-Ehrlichkeit: die eigene Verifikation sind 3 serielle isolated-Läufe ≈ 21 min Mutex.** Nicht neben ein Land planen. |
| `028bdcc1` | ▸ start lane | Geschärftes Kind von `cccd76b2`. Der Timer bei `server.ts:4025` armt an `Bun.spawn`, `:4027` liest stdout **gepuffert** — er kann die Acquire-Zeile nie sehen; `suiteWait` (`:3989`) speist nur das Verdict. Teuerster Fehlertyp der Maschine: ein `verify.ok:false`, das nie gemessen hat. Pin: `waitedOut` ist NIE `ok:false`. |

*Status: beide laufen seit 07.08. (Slot 5 und 7). `62302c47`s Refine kam als `unchanged:true`
zurück — der Triage-Riegel griff korrekt, die Zeile trug ihr Kriterium schon.*

### Welle 2 — die Kollisionswahrheit + das Fundament

| Zeile | Knopf | Begründung |
|---|---|---|
| `05ba5609` + `db02104d` | clarify first, als EINE Lane | Unter Weg (a) beide neu zu briefen. `05ba5609`s Defekt ist bestätigt (`server.ts:5333`, `baseSha` nur an `1439/1440/1952` geschrieben). `db02104d`s Mechanismus ist **widerlegt** — s. §5. |
| `2bd333ac` | ▸ start lane | Fläche `src/client.ts` + `public/index.html` (+ `server.ts:9385-9405`, disjunkt). Die einzige Zeile der Queue mit dreiteiligem hartem DONE **plus** Verifikationsweg **plus** eigenem Kollisionshinweis. Sie ist der *Mechanismus* zur Owner-Vorgabe „nie ohne Kriterium dispatchen" — ohne sie bleibt die eine Disziplin, die jede Welle neu wiederholt werden muss. |
| `7ba4bd9d` | ▸ start lane | Doc-only, vier belegte Falschaussagen, kalibriert den frisch gelandeten L1-Rot-Detektor gegen einen sauberen Baum. |

*Status: `7ba4bd9d` läuft seit 07.08. (Slot 9). `2bd333ac` reanalysiert, wartet auf einen freien
`server.ts`-Platz. `1e0c9434` ist bewusst nach Welle 3 gerutscht.*

**Serialisierung:** `cabf3c88` teilt die Row-Fläche mit `2bd333ac`, bleibt aber in **4b** — zwei
Wellen Abstand. Grund: `cabf3c88` steht auf clarify, weil ihr Mechanismus von der eigenen Analyse
widerlegt ist (`next.status = "sent"` wird bei `server.ts:1954` **synchron** gesetzt, bevor der Tail
existiert — das behauptete offene Fenster gibt es so nicht). Eine fertig spezifizierte Zeile an eine
ungeklärte zu ketten wäre ein Verlust.

**Reihenfolge-Konsequenz für die UI-Welle:** `2bd333ac` fügt eine CSS-Zeile in `public/index.html`
ein und landet damit **vor** `21c6eb4b` (Token-Umbau). Das ist richtig herum — der Token-Umbau
absorbiert die eine Zeile; umgekehrt wäre es ein Konflikt in einem mehrhundertzeiligen Diff.

### Welle 3 — die Worker-Blindheit

Ohne diese Zeilen kann man dem Register nicht glauben.

| Zeile | Knopf | Begründung |
|---|---|---|
| `1e0c9434` | ▸ start lane | `releasedBy` kommt in `server.ts` + `src/` **0×** vor. Klein, trägt DONE + VERIFY. |
| `3975427d` | ↻ refine, dann start | `console.error\|console.warn` = **0**, `serverLog\|recentErrors\|lastError` = leer. Zusatzbeleg: `register.sh` führte am 07.08. **sechs** Zeilen mit `unknown (analyst timed out)`. Nicht Ergonomie — Voraussetzung dafür, dem Register zu glauben. |
| `bbf2eea1` + `7d380d5e` | ▸ start lane, als EINE Lane | Beide fassen dieselbe Digest-Route an (`server.ts:7660ff`). Getrennt zu fahren ist eine garantierte Kollision. |

**Eine Konvention für „Absenz vs. Fehler", nicht zwei** — gehört in beide Briefe.

### Welle 4 — belegte Defekte, paarweise (max 2 × `server.ts`)

| Paar | Zeilen | Knopf | Notiz |
|---|---|---|---|
| 4a | `25b79c23` · `2c92a467` | ▸ start lane | `MERGE_TOOLS` heute bei `:4072` (die Zeile nennt `4007` — Drift), kein `git commit` darin; `merge-prompt.ts:187` verlangt es wörtlich. `25b79c23` ist Vorbedingung für `acb5839d`. `2c92a467` ist die einzige Zeile, die im laufenden Betrieb Ressourcen frisst. |
| 4b | `cabf3c88` · `9e0fdc3b` | `cabf3c88` clarify · `9e0fdc3b` start | `9e0fdc3b` ist die einzige maschinenlesbare Dateiquelle, die es je geben wird — und unter Weg (a) harte Vorbedingung. |
| 4c | `380d24ee` · `0d39cc94` | ▸ start lane | Kopierliste `server.ts:1256` = `[".env","CLAUDE.md",".claude/settings.local.json"]` — `OWNER.md` fehlt, exakt wie behauptet. `0d39cc94` ist `ready` und braucht keine Credentials. |
| 4d | `8bdf0e81` + `8830dddc` | ▸ start lane, als EINE Lane | `runVerify:4025` = ein `p.kill()`; die Eskalation existiert nur im Post-Land-Audit (`:4554`, `kill(9)` + Grace). `verifyCmdFor\|repoVerify` = 0×. Gemeinsame Fläche `e2e/merge.ts`. |
| 4e | `989cccf7` | ▸ start lane — **nur nach Owner-Ja** | `api/deploy` = 0×. Blockiert von F3. |

### Welle 5 — Hardening + Verb-Vorbedingungen

`4544f602` (start — Info-Disclosure, seit 2026-07-18 offen, trägt DONE+VERIFY) ·
`04607d0b` (start — `/commit` bei `:9139` prüft nur `commitInflight`, kein `lastOutput`) ·
`5388c07d` (start — stiller `wip:`-Fallback bei `:3735-3748` bestätigt) ·
`785ce63d` (clarify — Provenienz lässt sich nachträglich nicht reparieren) ·
`acb5839d` (start, **nach** `25b79c23`) ·
`9b565be8` (clarify — zwei Teile, strikte Reihenfolge, größte Zeile der Welle) ·
`5ff7233f` (start — doc-only; der `CLAUDE.md`-Teil nur als Report-Text, s. §5).

### Welle 6 — Betriebssicht

| Zeile | Knopf | Notiz |
|---|---|---|
| `6b9f77d0` | ↻ refine, dann start | Ersetzt die 7-min-Wiederholungspflicht pro Rot durch Daten. 49 MB Trail vorhanden, **0 Leser**. Muss **vor** `d375c581`(c) laufen. |
| `691e1ec4` | ↻ refine, dann start | 99 Land-Zettel, `fleet/land` 0× in `src/client.ts`. |
| `54560617` | clarify first | `slot-stats` 0× im Client. Offen ist, ob der Owner das Badge oder die Ursache will (F12). |
| `d375c581` | ↻ refine — **nur (a)+(b)** | 7 tote Instanzverzeichnisse, 49 MB Trail. (c) an `6b9f77d0` koppeln, sonst wird weggeworfen, was nie jemand gelesen hat. |
| `5aafbee4` | clarify first | Macht aus `[grob]` ein `[mechanisch]`. Nach Welle 2 (`baseSha`), sonst zeigt sie 37-fach zu viel. |
| `6440c392` | ↻ refine, dann start | Argumentiert selbst für „spät": Rückstand null, alle 15 Rote adjudiziert. |

### Welle 7 — UI, streng seriell

**7.0 zuerst und ALLEIN:** `21c6eb4b` + `bb0475b8` (↻ refine). 751 Hex-Literale bestätigt;
`share.html:12-17` hat das Token-Set schon. `bb0475b8` (Bewegungs-Vokabular + fehlende
`prefers-reduced-motion`-Klausel) ist derselbe `index.html`-Block.
**Verify: `bun run build` + Screenshot-Vergleich vorher/nachher, der Diff muss optisch NULL sein** —
das einzige belastbare Done-Kriterium für einen Token-Umbau.

Danach, je eine Lane:
`0c7da157` (+ `landCelebrate()` aus dem `24f9213f`-Kommentar, ↻ refine — 24 `alert()`, `toast()` bei
`:7213` ohne Klasse/Stapeln) · `1cb6778e` (Tab-Ampel, ↻ refine — `document.title` 0×; der Kern ist,
dass ein versteckter Tab **gar nichts** pollt) · `3a622ea1` (▸ start — Projektion `server.ts:8348`
führt kein `awaiting`; kleinste echte Lücke) · `f551f930` (↻ refine — der teuerste Vorgang der
Maschine ist in der einzigen immer sichtbaren Liste unsichtbar) · `b3a81fd0` (↻ refine —
`bundleStale`-Prüfen ist Pflicht, die Anzeige Desktop-only) · `34205199` (↻ refine — billigster
Kohärenzgewinn) · `f6e085d5` (clarify — fasst `renderBoard` an, strikt nach 7.0 und allein) ·
`6ebb4c85` (↻ refine) · `4d7aba33` (↻ refine) · `16d5e973` (clarify — größter UI-Posten, das ganze
Risiko ist die Fokus-Grenze gegen die xterm-Textarea, und die gehört vor den Bau).

---

## 3 · Offene Owner-Fragen

F0/F1/F2 und die Archiv-Liste sind entschieden (§1). Offen bleiben:

- **F3** Verb 2 (Deploy) bauen — ja/nein? (`989cccf7`, `ready`, `api/deploy` = 0×.)
- **F4** Pi-Login (`944281c5`) — braucht echte Anmeldung + `pi install npm:pi-claude-bridge`.
  `0d39cc94` (harness-fähig, ohne Credentials) kann vorher laufen.
- **F5** F6-Upload-Ablage (`2784427e`): der Entwurf sagt „**AUSSERHALB** des Worktrees
  (`~/.claude-fleet/drops/<slot>/`)", der kompilierte Brief sagt „**IM** Worktree" — die Analyse hat
  die Umkehrung gefunden. Welche gilt? Einzige Owner-Zeile ohne DONE.
- **F6** Ist F7 (`577b26fa`) überhaupt noch gewollt? Steht nur im Brief, erbt die Kante, die F6
  bewusst vermeidet (untracked Datei blockt den Land).
- **F7** `info-card-controls` — ist der Wunsch vom 03.08. mit F4 erfüllt?
- **F8** Compose-Drafts pro Gerät oder server-synced? (`9bf62ae6` fragt es selbst.)
- **F9** Session-Archiv: Retention nach Anzahl oder Alter? (`df5b74ba`; `archiveSlot|archive.json`
  = 0×, komplett ungebaut, sechs benannte Edge-Cases.)
- **F10** Die Zeit der letzten Ausgabe (`356333db`): `lastOutput` ist präzise aber flüchtig,
  `transcriptFact.mtime` überlebt Neustarts, ist aber als Signal widerlegt (Kommentar auf der Zeile).
- **F11** `b759e8d9` von Notiz auf Lane heben? `sinceLastLook` schlüsselt nur nach Branchname und
  hat einen Falschalarm „main wurde rewritten" erzeugt.
- **F12** `54560617` — das Badge oder die Untersuchung? 26× `no-transcript` auf **nur** Slot 1 in
  sieben Tagen.

---

## 4 · Was der Steward an der Registerpflege trägt

*Besetzt am 07.08. als Slot 12, Worktree frisch von `main`. Stündlicher `/rundgang` als auto.*

Die Trennlinie ist **nicht** „was ist Steward-Arbeit", sondern: **wo ist das Urteil mechanisch, und
wo ist es das des Owners.** Der Steward taugt für das erste; der Schaden entsteht immer dort, wo er
das zweite anfasst — belegt durch seine eigenen fünf Alt-Notizen (`05320523`: über eine Lane
geurteilt, ohne ihren 90 Minuten alten Schlussbericht zu lesen).

**Vier ableitbare Aufgaben, keine davon eine Entscheidung:**

1. **Zeilen-Frische als Fakt.** Stale-Verdicts durch `POST /api/tasks/:id/reanalyse` schicken.
   *Vorbedingung `3975427d` oder `bbf2eea1`* — sonst kann er „Worker gestorben" nicht von „noch
   nicht dran" unterscheiden und stößt endlos an.
2. **Beleg-Verfall melden, nicht Zeilen bewerten.** Zitierte Refs mechanisch nachprüfen und *nur bei
   Abweichung* filen. Der L1-Rot-Detektor macht das für Docs; für Queue-Zeilen macht es niemand.
3. **Adjudikation vorbereiten, nie sprechen.** Bei rotem Post-Land-Audit die vier Kandidaten
   `real|flake|stale-test|unknowable` mit Beleg vorlegen — der Knopf bleibt beim Owner.
   *Vorbedingung `6b9f77d0`*, sonst kostet jedes Urteil einen 7-min-Lauf unter dem Mutex.
4. **Archiv-Kandidaten mit Verfallsgrund statt Meinung.** Drei prüfbare Formen: *der Beleg zeigt ins
   Leere* · *die Vorbedingung existiert nicht und wird von keiner offenen Zeile gebaut* · *eine
   andere Zeile sagt wörtlich, dass sie sie auflöst*. „Ballast" ist keine davon.

**Ausdrücklich nicht:** Lane-Claims filen (Verb 4 — null Lane-Claims bisher; (1)–(4) beantworten
dieselbe Frage billiger als 20 Pulse) und **priorisieren** — das ist die einzige Arbeit hier ohne
mechanischen Wahrheitswert.

---

## 5 · Korrekturen, die aus dieser Runde stammen

- **Der Kollisionscheck sieht keine Dateien.** `server.ts:2158-2161` baut `lanes` als
  `{branch, task-TEXT}`, `analysis-prompt.ts:41` definiert `AnalysisLane { branch; task }` — kein
  Dateifeld. Die Row-Note `server.ts:2399` sagt trotzdem wörtlich *„same files, says the analyst"*,
  und der Kommentar `2382-2384` behauptet *„The analyst has always computed which other work touches
  the same files"*. Beides ist unwahr über den eigenen Code.
- **`files` fällt beim Refine-Confirm auf den Boden** — live gemessen am 07.08.: der Refine-Vorschlag
  zu `cccd76b2` trug `files` mit acht Dateien, das geminzte Kind `028bdcc1` hat `files: None`. Damit
  ist `9e0fdc3b` keine Verbesserung unter mehreren, sondern Vorbedingung.
- **`kind: lane→note` hat keine Route.** `t.kind` wird in `server.ts` an genau zwei Stellen gesetzt:
  `:9606` (`adopt`, note→lane) und `:7799` (Steward-Create). `adopt` ist eine Einbahnstraße. Deshalb
  war der Owner-Entscheid „die drei Formfehler auf `note` ziehen" nur für `0be58694` ausführbar (das
  ohnehin archiviert wurde); **`10ac2528` und `63626cdb` stehen weiter als startbare `lane`-Zeilen
  da, die sich im ersten Satz selbst als „NOTIZ — kein Arbeitsauftrag" deklarieren.** Als Zeile
  `65af341f` abgelegt.
- **Die Historien-Warnung in CLAUDE.md ist für den Steward-Branch veraltet.** Gemessen am 07.08.:
  `main..steward` = **0** Commits, `steward` war Ancestor von `main`, der Merge war ein reiner
  Fast-Forward — nicht „421 fremde Commits". Für die übrigen ~70 lokalen Branches ist die Warnung
  ungeprüft und bleibt stehen.
- **Der Steward-Worktree existierte gar nicht.** `claude-fleet.worktrees/steward` fehlte; was dort
  lag, waren zwei leere Verzeichnisse (`steward.worktrees/` vom 05.08., `fleet/` vom 21.07.).
  CLAUDE.md beschrieb einen Baum, den es nicht mehr gab.
- **Sechs Zeilen trugen verdict `unknown` = „analyst failed: summarizer timed out".** Das ist kein
  Urteil, sondern eine Absenz — und dieselbe Krankheit, die `3975427d` und `bbf2eea1` beschreiben.
  Alle sechs am 07.08. neu angestoßen.
- **`f378d4c` ist deployed.** Der Review schloss mit „weiterhin nicht aktiv, der `launchctl kickstart`
  steht noch aus"; der Prozess-Env von pid 91279 enthält `e2e/pins.ts`. Der Review hatte auf `082141a`
  geerdet und das Deploy-Fenster um 00:52 nicht mehr gesehen.
- **31 von 66 Lane-Zeilen trugen kein DONE**, 27 davon Scout-Zeilen. Für sie ist „▸ start lane" nie
  der erste Knopf — das ist der Normalfall dieser Queue, nicht die Ausnahme.
