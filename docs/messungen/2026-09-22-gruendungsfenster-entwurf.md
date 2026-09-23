---
frage: Wie sieht das Gründungsfenster am leeren Slot aus (Rolle als Comic-Seite, dann Profil und Kontext, dann Repo), und was davon trägt der Server heute?
urteil: Das Mockup steht in vier Stufen. Ohne Server-Arbeit trägt der heutige Server zwei der drei genannten Rollen (Orchestrator über das Label beim Öffnen, Worker auf neuem Worktree über open-worktree). Er trägt auch die ganze Profil-Spalte (Harness/Modell/Effort sind heute schon Spawn-Felder) und die Repo-Karte nach Lesart b aus dirinfo plus sessions. Nicht getragen werden der Worker auf vorhandenem Worktree auf dem geklickten Platz (POST /api/lanes attach wählt den Platz selbst), jede Wahl von Context-Packs (eine Gründung von Hand bekommt heute KEINE Packs, es gibt keine Route zum Wählen oder Nachändern) und die Packs eines Repos auf der Karte (dirinfo blendet .fleet/ aus). Dazu kommen zwei Namenskollisionen: „profile" heißt im Server das Maschinen-Profil eines Programs, „context" auf /open das codex-Kontextfenster.
bereich: [gruendungsfenster, rollen, profil, context-packs, repo-karte, client]
belege: [src/client.ts#openPicker, src/client.ts#spawnBody, src/client.ts#showDirDetail, src/client.ts#startWorktree, src/client.ts#openPacks, server.ts#isOrchestratorLabel, server.ts#deliverOrchestratorSpawnCard, server.ts#contextOf, server.ts#dirInfo, server.ts#openSlot, server/dir-explorer.ts#dirEntries, context-plan.ts#planContext, context-packs.ts, server/types.ts#SEPARATE_LANE_SLOTS, docs/design/grammatik.md, docs/design/sidebar/marken3.js]
nicht-gemessen: kein Produktcode, keine Testinstanz (das Mockup ist eine eigene statische Seite mit der Demo-Flotte aus sidebar/marken-daten.js); keine Nutzerprobe; die Repo-Gesichter nur für die fünf Demo-Repos gerendert, nicht über viele Pfade auf Entartung vermessen; die Session-Marke ist nicht gebaut (Entwurf Runde 3), (a) zeigt also ein Gesicht, das es im Produkt noch nicht gibt
stand: 2026-09-23
---

# Gründungsfenster am leeren Slot: Entwurf mit statischem Mockup

2026-09-23, Lane `fleet/260923213642-a592`, Baum `18aa69da`. Program „Oberfläche aus einem Guss"
(`0d51b4d4`), nach Grammatik (`docs/design/grammatik.md`, Zeile `8d7d47b7`) und Inventar
(`2026-09-22-untermenue-und-einstellungen-inventar.md`, Zeile `d8e37852`, Fläche 69).
Frage: **Wie sieht das Fenster aus, aus dem der Owner wählt, und was davon kann der heutige Server?**

Owner, wörtlich (2026-09-21, Intake Slot 12): „Ich wollte Überhaupt das Rollen, Profil und Kontext
System ein gutes Stück mehr in die UI einbinden^^ Ich stelle es mir so vor das wenn man auf einen
leeren slot klickt, sich dann ein kleines, wie die seite eines comics aufgeteiltes, Fenster, rechts
neben dem  angeklicktem, öffnet. Hier soll man dann zwischen Orchestrator, Worker mit neuem oder auf
vorhandenem Worktree usw. auswählen können und dann ein weiteres Menü vorfinden (das eben einmal das
profil und damit die Konfiguration des Agenten, und auch den Kontext in Form von z.b kontext packs
gezeigt wird" — Nachtrag: „Agenten), und daneben dann auch die Kontext Konfiguration* Wenn man das
dann gewählt und bestätigt hat kann man ein repo auswählen. Hier würde ich die Repo's gewissermaßen
als Agenten 'erkennbar' machen."

Weitergereicht (Orchestratorin Slot 14, 2026-09-22, **Paraphrase**, nicht wörtlich): Kontext-Packs
sollen je Gründung zusammensteckbar und nachträglich änderbar sein, nicht fest verdrahtet.

**Mockup:** `docs/design/gruendungsfenster/index.html` (`?s=1`, `2`, `3a`, `3b`). Ansehen:
`python3 -m http.server 8799 --bind 127.0.0.1 -d docs/design` → `/gruendungsfenster/?s=1`.
ES-Module brauchen http, über file:// laden sie nicht. **Bilder** (`docs/design/gruendungsfenster/bilder/`):

| Bild | Stufe |
|---|---|
| `1-rolle-1200.jpg` | Klick auf den freien Platz 9 → Fenster rechts daneben, Comic-Seite mit drei Rollen und dem offenen „usw." |
| `2-profil-kontext-1200.jpg` | Profil links, Kontext-Packs daneben, Confirm |
| `3a-repo-gesicht-1200.jpg` | Repo-Wahl, Lesart (a): jedes Repo mit Gesicht, darunter die Marken seiner Agenten |
| `3b-repo-karte-1200.jpg` | Repo-Wahl, Lesart (b): Repo-Karte mit „Wer hier arbeitet" und „Was es einem Agenten mitgibt", jede Zeile mit Quelle |
| `1-rolle-390.jpg` | Stufe 1 am Handy (`MOBILE_MQ`): Vollbild, Panels untereinander |

Alle Bilder zeigen die geschwärzte Demo-Flotte (`docs/design/sidebar/marken-daten.js`, Pfade
`/Users/o/…`). Die drei Commits in 3b sind echte Subjects von `main` zum Stand `18aa69da`.

---

## 1. Sein Satz → Element

Jedes Element im Mockup hat hier eine Zeile. Was keinen Satz hatte, ist rausgeflogen: eine Zeile
„Profil-Vorlage" (für das Register `fa07734f`) stand im ersten Bild und ist entfernt, weil der Owner
keine Vorlagen genannt hat.

| # | Sein Satz (wörtlich) | Element im Mockup | Bild |
|---|---|---|---|
| S1 | „das Rollen, Profil und Kontext System ein gutes Stück mehr in die UI einbinden" | Die drei Schritte im Fensterkopf: `1 Rolle · 2 Profil & Kontext · 3 Repo`. Jeder Schritt zeigt, was vorher gewählt wurde (Zeile „Gewählt:" mit „ändern") | alle |
| S2 | „wenn man auf einen leeren slot klickt" | Auslöser ist die Zeile „frei · Session starten" (heute `src/client.ts#openPicker`); der geklickte Platz bleibt markiert | 1 |
| S2 | „ein kleines … Fenster, rechts neben dem angeklicktem" | Fenster links an der Leistenkante, der Zeiger (Kerbe) zeigt auf die Zeile von Platz 9. Breite 640 px (Stufe 1) statt des heutigen Pickers, der fast die ganze Seite deckt (Inventar-Bild `25-picker-1200`) | 1 |
| S2 | „wie die seite eines comics aufgeteiltes" | Panels verschiedener Größe mit schwarzen Rinnen, je Panel ein Bild, ein Beschriftungskasten oben links, ein Satz unten, eine Panel-Nummer | 1 |
| S3 | „zwischen Orchestrator, Worker mit neuem oder auf vorhandenem Worktree … auswählen" | Drei Panels: Orchestrator (groß, links), Worker auf neuem Worktree, Worker auf vorhandenem Worktree; ein Klick merkt vor (Tintenkante, G4.4), „Next" übernimmt | 1 |
| S3 | „usw." | Ein leeres, gestricheltes Panel mit Sprechblase: „welche Rollen gehören noch auf diese Seite?" Nicht gefüllt, siehe Frage F1 | 1 |
| S4 | „dann ein weiteres Menü vorfinden" | Stufe 2, im selben Fenster (kein zweites Fenster) | 2 |
| S4 | „das profil und damit die Konfiguration des Agenten" | Spalte „Profil" links: Harness, Modell, Effort (die heutigen Spawn-Felder aus `spawnBody`), dazu ein Reiter „Mehr" für Browser, Container, Kontextfenster je nach Harness | 2 |
| S4 | „den Kontext in Form von z.b kontext packs" | Spalte „Kontext": je Pack Id, Zweckzeile (`useWhen`), Größe; gruppiert nach „Immer" und „Für diese Arbeit" | 2 |
| S4 | „und daneben dann auch die Kontext Konfiguration" | Die Kontext-Spalte steht rechts NEBEN dem Profil, nicht darunter | 2 |
| Para | „zusammensteckbar" (Paraphrase) | on/off je Pack (G1.3) und die gestrichelte Zeile „+ Pack zusammenstecken … (Form: Frage an dich)" | 2 |
| Para | „nachträglich änderbar" (Paraphrase) | Fußzeile „später änderbar im Info-Tab". Der Ort ist der heutige Packs-Chip im Info-Tab (`src/client.ts#openPacks`); die Form ist Frage F3 | 2 |
| S4×S3 | (Profil wirkt auf Kontext) | Packs, die zum gewählten Harness nicht passen, stehen blass mit dem Grund („Passt nicht zu pi-zai — nur claude und pi-unfenced"). Das ist die heutige Regel `harness-unsupported` aus `context-plan.ts#contextOmissionFor`, kein neues Element | 2 |
| S5 | „Wenn man das dann gewählt und bestätigt hat" | Knopf „Confirm" (primär), „Back" zurück zur Rolle | 2 |
| S5 | „kann man ein repo auswählen" | Stufe 3: die Repos der laufenden Flotte, nach Zahl der Agenten sortiert; dazu „Anderer Ordner …", der den heutigen Verzeichnisbaum öffnet (sonst ließe sich ein Repo ohne laufende Session nicht wählen) | 3a, 3b |
| S6 | „die Repo's gewissermaßen als Agenten 'erkennbar' machen" | Zwei Lesarten, §3 | 3a, 3b |
| — | (Fenstermechanik, Grammatik G4.1) | ✕ oben rechts, „Cancel", Esc; mobil Vollbild (G0.7, G4 mobil) | alle |

## 2. Das Mockup gegen die Grammatik

Material nach G0.1: nur der `--chat-*`-Block, die Hex-Werte stehen einzig in den kopierten
`:root`-Tokens. Die Radien sind `--r1`/`--r2`, die Leistenzeile behält ihre 12 (W3). Blau hat
keine Bedeutung (G0.2); Gelb (`--amber`) heißt nur in 3b „heute ungemessen/fehlt". Die Schrift folgt G0.3: Sans
für Lesetext, Mono für Ids, Pfade, Modellnamen, Größen und Shas. Handlungswörter bleiben
Fleet-Englisch („Next", „Confirm", „Start lane"), Erklärtexte sind deutsch (G0.5).

| Element | Regel | Abweichung, entschieden |
|---|---|---|
| Fenster rechts neben dem Slot | G4.1 (Material, Esc, Außenklick, Fokus zurück) | **W6:** G4 sagt „mehr als eine Liste = Fenster (`openShell`, zentriert)". Der Owner nennt ausdrücklich ein kleines Fenster NEBEN dem Slot. Entschieden: sein Satz bestimmt die Lage, die Grammatik das Material. Also angeheftet wie ein Popover, im G4.1-Material; mobil Vollbild wie `openShell` (G6.3 mobil) |
| Comic-Panels | G4.4 (Auswahl: vorgemerkt = Tintenkante, primärer Knopf übernimmt) | Panels sind große Auswahlflächen statt Zeilen. Die Rinnen sind `--chat-void` |
| Harness, Effort | G3.1 (Segment) / G4.4 | — |
| Modell | G4.3 (Wert + Chevron) | — |
| Pack an/aus | G1.3 (Umschalt-Knopf, „an" = Tinte) | — |
| „Mehr" im Profil | G3.2 (Reiter) | — |
| Schritte im Kopf | G3.1 (Tabs) | Tabs zeigen hier einen Fortschritt, sie schalten keine Ansicht um. Zurück geht per „ändern" |
| Repo-Karte 3b | G6 Karten, Abschnitte als Reiter-Überschriften | — |
| Quellen-Schildchen (`dirinfo`, `sessions`, `fehlt heute`) | Mockup-Beschriftung | gehören nicht ins Produkt; sie zeigen dem Owner, woher jede Zeile käme |

## 3. „Repos als Agenten erkennbar": beide Lesarten

**(a) Jedes Repo bekommt ein eigenes Gesicht wie eine Session** (Bild 3a). Das Gesicht zeichnet
dieselbe Maschine wie die Session-Marke (`docs/design/sidebar/marken3.js`, System C Attraktor,
die Empfehlung aus Runde 3), im selben Farbton (`projectHue(Pfad)`, heute schon in
`src/client.ts#projectHue`). Der Seed kennt nur den Pfad, weil ein Repo keinen Slot und keine
Öffnungszeit hat. Unter dem Gesicht stehen die 16-px-Marken seiner Agenten: Repo und Sessions
teilen sichtbar den Ton. **Befund am Bild:** eins von fünf Gesichtern ist entartet. `privatraum`
zeigt im Standbild nur zwei Punkte, weil der Attraktor dieses Seeds auf einen Fixpunkt fällt.
Runde 3 hat 19 Session-Seeds auf Verwechslung geprüft, Repo-Seeds nicht. Lesart (a) braucht
also eine Entartungsprobe über viele Pfade. Außerdem hängt (a) an einer Marke, die im Produkt
nicht gebaut ist (Session-Marke, Runde 4 offen, `9376f87c`).

**(b) Die Repo-Karte zeigt, wer dort arbeitet und was das Repo einem Agenten mitgibt** (Bild 3b).
Jede Zeile nennt ihre Quelle:

| Zeile der Karte | Quelle heute | Feld |
|---|---|---|
| Branch, sauber/dirty, ahead/behind | `GET /api/dirinfo` | `branch`, `dirty`, `ahead`/`behind` (`null` = kein Upstream) |
| Zuletzt (Commits) | dirinfo | `recent` (5, `DIRINFO_COMMITS`), `last` |
| AGENTS.md, CLAUDE.md liegen da | dirinfo | `entries` (Dateinamen der obersten Ebene) |
| Worktrees auf der Platte | dirinfo | `lanes` = Verzeichnisse unter `<repo>.worktrees` |
| Wer hier arbeitet (Marke, Platz, Label, Harness · Modell) | `/api/sessions`, im Client schon vorhanden | `cwd` bzw. `worktree.repo` je Slot |
| Context-Packs des Repos | **fehlt heute** | dirinfo blendet Punkt-Einträge aus (`server/dir-explorer.ts#dirEntries` zählt sie nur als `hidden`), `.fleet/context-packs.json` ist unsichtbar |
| Worktrees ohne Platz (Kandidaten für Rolle 3) | **fehlt heute** als Feld | ableitbar im Client: `GET /api/dirs?path=<repo>.worktrees` minus die `cwd` der Slots. Das ist ungenau, weil ein Verzeichnis kein geprüfter git-Worktree ist |

**Empfehlung: (b) als Grundlage, das Gesicht aus (a) als Kopfbild der Karte**, wie in 3b oben
links. Grund: (b) trägt die Fakten, nach denen man ein Repo für einen Worker wählt (wer arbeitet
schon dort, was bekommt der Agent mit). (a) trägt nur Identität und hängt an einer ungebauten Marke
mit gemessenem Entartungsfall. Die Wahl liegt beim Owner (F2). Antwortet er vorher, schrumpft
dieser Abschnitt auf eine Lesart.

## 4. Was der Server heute NICHT hat, und der erste Schnitt ohne Server-Arbeit

| Fläche | Heute im Code | Fehlt |
|---|---|---|
| Rolle Orchestrator | Keine Rollen-Route. Die Rolle hängt am **Label**: `POST /api/slots/:id/open` nimmt `label`, `server.ts#isOrchestratorLabel` (Wortgrenze + „orchestrator" oder 🎛) entscheidet, ob `deliverOrchestratorSpawnCard` die Rollenkarte samt Kontext-Ankern zustellt. Der Picker sendet heute **kein** Label (`spawnBody`: harness, model, effort, container, containerContext) | nichts für den ersten Schnitt: das Panel sendet `label: "Orchestrator"` |
| Rolle Worker, neuer Worktree | `POST /api/slots/:id/open-worktree` (`src/client.ts#startWorktree`), auf dem geklickten Platz | nichts |
| Rolle Worker, vorhandener Worktree | `/open` in einen Worktree-Pfad gründet eine **Nicht-Lane** (`openSlot(…, worktree = null)`, kein Land, kein drift). Eine Lane auf einem vorhandenen Worktree setzt nur `POST /api/lanes {repo, attach}`: nur Waisen (409, wenn der Baum in einem Slot steht), der Platz wird per `freeSessionSlot("lane")` **vom Server gewählt** | ein `slot`-Feld an `/api/lanes` attach; eine Waisenliste je Repo |
| Profil | Harness/Modell/Effort/Container/Browser/Kontextfenster sind Spawn-Felder je Gründung. Ein gespeichertes Profil gibt es nicht: `.fleet/klassen.json` existiert nicht (nur `context-packs.json`, `init.md`), die Zeile `fa07734f` ist offen (Schatten) | ein Profil-Register, falls der Owner Vorlagen will; dafür hat er bisher keinen Satz gesagt |
| **Name „Profil"** | Im Server heißt `profile` das **Maschinen-Profil eines Programs** (`standard` / `game-maker`, `POST /api/programs/:id/profile`), und der Info-Tab zeigt es als Zeile „Profile" | Namensentscheid (F4) |
| Kontext-Packs | Drei Quellen: Fleet-Samen (`context-packs.ts`, 6 Packs), Repo-Manifest (`.fleet/context-packs.json`, hier 2), Program-Packs (≤ 5, `PROGRAM_CONTEXT_PACKS_MAX`). Gewählt wird **nur serverseitig** durch `planContext` aus Auslöser, Harness, Modus und Fähigkeiten. Zugestellt wird beim Queue-Dispatch (`DISPATCH_CONTEXT_TRIGGERS = always, verification`), bei der Program-MAIN-Gründung, bei der Orchestrator-Gründung (Label) und beim Land-Resolver. **Eine Gründung von Hand über den Picker (`/open`, `/open-worktree`) bekommt keinen Brief und damit keine Packs** | eine Route, die den Plan für eine geplante Gründung zeigt; ein `packs`-Feld an den Gründungstüren; eine Tür zum Nachändern (die Quittung wird heute einmal bei der Gründung geschrieben) |
| **Name „Kontext"** | Das Feld `context` an `/open` ist das **codex-Kontextfenster** `{window, compactAt}` (`server.ts#contextOf`, nur codex, `takesContext`) | Namensentscheid im Code, bevor ein `packs`-Feld dazukommt |
| Repo-Packs, Waisen | siehe §3 | zwei Felder an dirinfo |
| Platzbänder | `FLEET_SEPARATE_LANE_SLOTS` steht nicht in `.env` (den Env des laufenden Servers nicht gelesen); ohne ihn teilen Lanes und MAINs die Plätze 1–16. Ist er an, verweigert `openSlot` eine Lane auf 1–16 („lane requires a place above bands 1..16") | nichts, solange der Schalter aus ist. Ist er an, muss Stufe 1 die Worker-Panels auf Plätzen 1–16 sperren |

**Erster Bau-Schnitt ohne Server-Arbeit** (Grundlage für B1):
- Stufe 1 mit zwei tragenden Panels. Orchestrator sendet das Label, Worker neu ruft `open-worktree`.
  Das Panel „vorhandener Worktree" steht da, ist aber gesperrt, mit dem Satz, dass dieser Weg
  heute einen anderen Platz nehmen kann. Die Alternative (attach mit Hinweis „landet im nächsten
  freien Platz") widerspricht S2 und ist darum nicht gewählt.
- Stufe 2: Das Profil ist die heutige Optionszeile, umgezogen. Die Kontext-Spalte ist
  **nur lesend** und sagt die Wahrheit über die kommende Gründung: bei Orchestrator „Rollenkarte
  mit Ankern", bei Worker von Hand „keine Packs". Keine Schalter, weil sie heute nichts bewirken
  würden.
- Stufe 3 als Lesart (b) aus dirinfo plus sessions, ohne die zwei gelben Zeilen. „Anderer Ordner"
  öffnet den heutigen Baum.

## 5. Karten-Vorlagen (höchstens drei, gerankt; nicht gefilt, die MAIN filt)

1. **B1 (M, nur Client)**: Gründungsfenster Stufe 1–3 wie §4 „erster Schnitt"; ersetzt den
   Einstieg von `openPicker` am leeren Slot, der Baum bleibt hinter „Anderer Ordner".
   REGELN G4.1, G4.3, G4.4, G3.1, G1.3, G0.5, G0.7. FLÄCHE `src/client.ts` (openPicker, spawnBody,
   startWorktree), `public/index.html`. VERIFY pins + tsc + build + Screenshot 1200/390 gegen dieses
   Mockup + Suite-Offer `FLEET_E2E_MODULES=slots` (die K9-Anker-Checks am Gründungsfenster in
   `e2e/slots.ts` ziehen mit). VERBOTEN neue Routen, Pack-Schalter.
2. **B3 (S, Server)**: `POST /api/lanes` attach nimmt `slot` (den geklickten Platz, 409, wenn er
   belegt ist); dirinfo liefert `packs` (Ids aus `.fleet/context-packs.json` am HEAD) und `orphans`
   (git-Worktrees ohne Slot). Danach entsperrt B1 das dritte Panel und die zwei gelben Zeilen.
   VERIFY pins + tsc + e2e an lanes/dirinfo.
3. **B2 (M–L, Server + Client, erst nach F3)**: Packs je Gründung wählbar. Dazu eine Plan-Route
   für eine geplante Gründung (Repo, Harness, Modus → selected/omitted wie `planContext`), ein
   `packs`-Feld an `/open`, `/open-worktree` und `/api/lanes` mit Zustellung und Quittung wie beim
   Dispatch, dann die Schalter in Stufe 2. Vorher den Namensentscheid F4/`context` im Code.
   Nachändern an einer laufenden Session ist eine eigene, spätere Zeile.

Unter der Linie: ein Profil-Register (dafür gibt es keinen Owner-Satz; `fa07734f` bleibt, wie es ist)
und die Repo-Gesichter aus (a), solange die Session-Marke nicht gebaut ist.

## 6. Fragen an den Owner (gebündelt)

- **F1 „usw."**: Welche Rollen gehören noch auf die Seite? Der Code kennt heute zusätzlich: die
  einfache Session in einem Ordner (der heutige Standard des Pickers, auf der Seite fehlt sie),
  Steward, Supervisor, Game-Maker-MAIN, Clarify-Lane. Welche davon, und wohin kommt die einfache
  Session?
- **F2 Repos erkennbar**: Lesart (a) Gesicht, (b) Karte oder (b) mit dem Gesicht als Kopfbild?
- **F3 Kontext zusammenstecken**: je Pack an/aus (wie im Bild), eigene benannte Kombinationen, oder
  beides? Und „nachträglich ändern" heißt: an einer laufenden Session Packs dazugeben, sodass sie
  die neuen Anker zugestellt bekommt?
- **F4 Name „Profil"**: Im Info-Tab heißt heute „Profile" das Maschinen-Profil des Programs
  (standard/game-maker). Soll dein „Profil" (Harness/Modell/Effort) diesen Namen bekommen und das
  andere umbenannt werden?
- **F5 Reihenfolge**: Die Packs eines Repos sind erst nach der Repo-Wahl bekannt, der Kontext kommt
  aber vorher. Bleibt die Reihenfolge (Repo-Packs erscheinen in Schritt 3), oder kommt das Repo nach
  vorn?

## Methode

```sh
# Erdung (Auszug): Rollen-, Pack- und Spawn-Wege am Baum 18aa69da
rg -n "isOrchestratorLabel|deliverOrchestratorSpawnCard" server.ts
rg -n 'slotMatch\[2\] === "open"|"open-worktree"|/api/lanes' server.ts
rg -n "planContext\(|DISPATCH_CONTEXT_TRIGGERS" server.ts
sed -n '/^async function dirInfo/,/^}/p' server.ts; sed -n '/export async function dirEntries/,/^}/p' server/dir-explorer.ts
rg -n "takesContext|function contextOf" server.ts; rg -n "allowsLanes:|effortLevels:" server.ts
ls .fleet   # context-packs.json, init.md — kein klassen.json
# Bilder: statische Seite, lokal serviert, Headless-Shell aus ~/Library/Caches/ms-playwright
python3 -m http.server 8799 --bind 127.0.0.1 -d docs/design &
chrome-headless-shell --headless --hide-scrollbars --window-size=1200,900 --virtual-time-budget=3000 \
  --screenshot=out.png "http://127.0.0.1:8799/gruendungsfenster/?s=1"   # je Stufe; 390,844 für mobil
sips -s format jpeg -s formatOptions 88 out.png --out docs/design/gruendungsfenster/bilder/<name>.jpg
```

## Was nicht gemessen wurde

- Kein Produktcode, keine Testinstanz. Die Leiste im Mockup ist eine vereinfachte v6-Kopie, nicht
  die gebaute Leiste.
- Die Entartung der Repo-Gesichter ist an fünf Pfaden gesehen, nicht über viele gezählt.
- Ob `/api/dirs` unter `<repo>.worktrees` genau die git-Worktrees liefert, ist nicht geprüft.
  Nur der Weg ist gelesen.
- Esc, Außenklick und Fokus sind im Mockup nicht verdrahtet; es ist ein Bild, keine Bedienung.
- Wie das Fenster neben einem Platz ganz unten in der Leiste sitzt, ist nicht fotografiert. Die
  Regel steht in `gf.js#anchor`: das Fenster rutscht hoch, der Zeiger bleibt an der Zeile.
