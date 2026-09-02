---
frage: Liegt die eine Hauptaktion des Task-Details nach dem Land von 15a3e38b bei 1440x900 und 390x844 wirklich ohne Scrollen im sichtbaren Bereich — als Pixel-Messung im Browser, nicht als Rechnung ueber die CSS-Boxen?
urteil: "Ja, gemessen: die Hauptaktion steht bei 1440x900 34 px hoch bei y=274 in einem Pane, das ab y=179 634 px sichtbar ist (vorher: y=2297), scrollTop 0; bei 390x844 volle Breite 362 px, 44 px hoch, y=341, kein horizontaler Ueberlauf. Das Detail-Kriterium des Programs ist damit erfuellt."
bereich: [task-workbench, ux, sensorik]
belege: [71361fa9e3fd59df1789f19ccc71a27964b78754, a97f0f517e15723ed933f7a462d6b0af62f97d9e, src/client.ts#qHeadPlan, src/client.ts#qMainActionOf, docs/messungen/2026-09-02-task-workbench-visual-after.md]
nicht-gemessen: Leerzustand bei 0 offenen Tasks (live waren 75 offen), Tastaturfokus, Entwurfserhalt ueber zwei 2-s-Refreshes, Suche ueber ID/Program/Repo, History-Ansicht — das ist die Flaeche des unabhaengigen Reviews 07c061fa
stand: 2026-09-02
---

# Der Falz des Task-Details, im Browser gemessen (Bundle auf `71361fa`)

2. September 2026, 19:22–19:30, Program-MAIN „Fleet Task Workbench" (Slot 8), Playwright gegen den
LIVE-Server. Diese Notiz schliesst die einzige Luecke, die der Worker von 15a3e38b offen gemeldet
hat: er konnte den Falz nur ueber die deklarierten CSS-Boxen RECHNEN (`head=226 viewport=517`),
weil `fleet-e2e` keinen DOM hat. Hier stehen die Pixel.

## Welche zwei Baeume verglichen werden

- **Vorher:** `docs/messungen/2026-09-02-task-workbench-visual-after.md`, Bundle `3afb3f0`,
  gemessen 18:06–18:12 an einer `queued`-Zeile.
- **Nachher:** diese Notiz. main `71361fa` (Land von 15a3e38b, `verify.ok true`, volle
  Sieben-Schritt-Kette, 104,1 s Arbeit / 0 s Wartezeit), Client-Bundle von mir daraus gebaut
  (`bun run build`, `bundleStale` war davor `true`). **Der laufende Server ist aelter**
  (`deployGap.bootHead 3afb3f0`, `behindCount 15`) — fuer diese Messung ohne Belang, weil dieses
  Program `server.ts` nicht anfasst und der Kopf ausschliesslich Felder des bestehenden Polls liest.
  Kein Deploy gefahren.

## Gemessen, an derselben Zeilenart wie vorher

Gewaehlt: die erste `q-queued`-Zeile der Work-Ansicht („Wecken — Wake-on-LAN…"), roh, nicht
analysiert. Viewport 1440x900, Detail-Pane oben.

| Groesse | vorher (`3afb3f0`) | nachher (`71361fa`) |
| --- | --- | --- |
| sichtbare Hoehe des Detail-Panes | 634 px | 634 px (ab y=179) |
| Scrollhoehe desselben Panes | 2240 px | 2477 px |
| Abstand der Hauptaktion von der Viewport-Oberkante | 2297 px | **274 px** (Unterkante 308) |
| Hauptaktion ohne Scrollen sichtbar | **nein** | **ja** (`scrollTop 0`) |
| Detail-Kopf | genau ein Wort (`queued`) | Status · Program-Chip · Repo-Chip · Lifecycle-Leiste |

Der Kopf im Einzelnen, y-Werte aus `getBoundingClientRect()`: Status `queued` 191–209 ·
Chips `Dual-Host Fleet — Second-host Session Runtime` / `claude-fleet` 215–234 · Leiste
`pending queued sent landed/done` mit markierter Station 243–263 · Hauptaktion
`▸ start by hand — unchecked` 274–308 · Begruendungszeile 339–356. Alles innerhalb der ersten
177 px des Panes.

**Genau EINE Hauptaktion, nachgezaehlt:** `.qdmain` enthaelt **1 Button** und daneben genau ein
weiteres Kind — das eigene Bestaetigungs-Kaestchen dieses Buttons (`qrawack`, weil die Zeile roh
ist). Die e2e-Sonde heisst „exactly ONE action node reaches the head" und misst die QUELLFORM;
die Laufzeit gibt ihr recht, aber mit zwei Knoten. Wer die Sonde spaeter liest, soll das wissen.

**Reihenfolge der Abschnitte, live abgefragt:** `Actions` → `Overview & discussion` → `Refinement`
→ `Request` → `Evidence — lane & verify facts` → `Danger zone`. `✕ delete` liegt nicht im Kopf
(`.qdmain .danger` ist leer).

## 390x844

Hauptaktion `▸ start by hand — unchecked` bei y=341, **44 px hoch, 362 px breit** (volle Breite),
sichtbar ohne Scrollen bei `scrollTop 0`; Detail-Pane 527 px sichtbar bei 4501 px Scrollhoehe;
`document.documentElement.scrollWidth <= innerWidth`, also **kein horizontaler Ueberlauf**.

## Bilder

Ungetrackt im Wurzelverzeichnis (`.gitignore` `/*.png`), weil sie Account-Pfade ins Bild malen:
`workbench-head-1440x900-detail.png`, `workbench-head-390x844-detail.png`.

## Was diese Notiz NICHT sagt

Sie misst den Falz und die Kopf-Anatomie. Leerzustand, Tastaturfokus, Entwurfserhalt ueber den
2-s-Refresh, Suche und History sind hier **nicht** gemessen — sie sind der Gegenstand des
unabhaengigen Reviews (`07c061fa`), und ihr Fehlen hier ist keine Aussage ueber sie.
