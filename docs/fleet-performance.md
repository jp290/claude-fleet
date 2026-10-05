# Performance an Claude Fleet

Stand 2026-10-05. Grundlage: Anthropics Performance-Post vom 23.09.2026 und Theos Video dazu,
diesmal mit Fleet als Web-System gelesen, nicht als Kontextfrage. Belege, Messwege und die
Labormessungen stehen in `docs/messungen/2026-10-05-fleet-als-websystem.md`. Ein Kontext-Pack zeigt
auf den Abschnitt unten.

## Performance-Arbeit an Fleet

Das sind Vorlieben, keine Regeln. Wo deine Lage etwas anderes nahelegt, wiegt dein Urteil.

### Wie Fleet als Web-System gebaut ist

- Ein Bun-Prozess (`server.ts`) bedient eine Vanilla-TS-Oberfläche ohne Framework.
  - `public/index.html` hat 308 KB. Davon sind rund 229 KB Inline-CSS und rund 57 KB CSS-Kommentare. Die Datei wird `no-store` ausgeliefert, also bei jedem Aufruf neu geladen.
  - `public/app.js` hat 1,10 MB minifiziert und 336 KB mit gzip. Es ist über `?v=` unveränderlich gecacht. Die größten Teile sind xterm mit seinen Renderer-Addons (483 KB), `src/client.ts` (211 KB) und `src/queue.ts` (124 KB).
- Der Zustand kommt per HTTP-Polling (`src/pollplan.ts#pollPlan`):
  - `GET /api/sessions` alle 2 s.
  - Je Chat-Pane `…/transcript?after=` alle 1 s.
  - Bei offener Info-Spalte alle 3 s `brief`, ein Transkript-Umriss und `worktrees`.
  - Nur das Terminal läuft über einen WebSocket (`/ws/:slot`). Der Server liest den Stream dafür alle 100 ms nach.
  - Versteckte Tabs pollen nicht. Der Datensparmodus streckt die Takte auf 10/3/10 s.
- Fleet misst keine Nutzerlatenz: es gibt keine `performance.mark` und kein `Server-Timing`.
- Was es gibt:
  - Bytezähler je Pfad und Gegenstelle (`server/transport.ts#countHttp`, lesbar über `GET /api/transport`).
  - Ein festes Byte-Budget von 14 KiB für die Session-Payload an einer 16-Slot-Fixture (`e2e/tasks.ts#run`).
  - p50/p90 nach nächstem Rang für Suite-Dauern (`server.ts#nearestRankStats`).

### Was wir bevorzugen, und warum

- **Zuerst die Zeit, die der Owner spürt.** Wir messen je Ablauf ab der Nutzeraktion bis zum sichtbaren, richtigen Ergebnis und berichten p75. Ein Zähler, der nicht mit dieser Zeit mitgeht, lenkt Optimierung auf den falschen Hügel. Anthropic hat solche Benchmarks deshalb gestrichen.
- **Client und Server getrennt.** Sie haben verschiedene Hebel.
  - Beim Senden braucht Fleet im Client 2–7 ms bis zur wartenden Blase und auf dem Server 350–550 ms.
  - In den Server-Millisekunden steckt ein fester Schlaf von 150 ms.
  - Dazu kommen bis zu 275 ms Annahmeprüfung. Sie verhindert, dass ein Brief in einem fremden Bildschirm landet.
- **Das Feld vor dem Labor.** Eine Zahl vom Gerät des Owners ist uns lieber als eine Laborzahl. Fleets Labor ist systematisch zu klein:
  - Eine Scratch-Instanz mit acht leeren Sessions liefert 5,5 KB Session-Payload. Ein Kommentar in `e2e/ctl.ts` nennt live rund 154 KB.
  - localhost hat keine Netzlatenz.
  - Mit `FLEET_CMD=true` entsteht kein Transkript.

  Für Laborvergleiche nehmen wir die Scratch-Instanz nach dem Muster von `e2e-isolated.sh`, auch weil sie keine echte Pane berührt.
- **Nichts neu bauen, was sich nicht geändert hat.** Einen unnötigen Neuaufbau zu überspringen ist uns lieber, als ihn schneller zu machen.
  - Die Info-Spalte baut `#boardbody` alle 3 s komplett neu, auch ohne neue Daten.
  - Dafür holt sie jedes Mal `brief`. Das kostet auf dem Server schon an einem leeren Repo p50 146 ms, weil es acht bis zehn Git-Aufrufe nacheinander sind.
  - Die Sidebar zeigt, wie es geht: `src/client.ts#refresh` vergleicht einen Schlüssel und baut nur bei Änderung neu.
- **Die Reihenfolge der Anfragen ordnen, statt Anfragen zu streichen.** Ein Agent, der Requests zählt, schaltet gern die Auffrischung ab. Dann zeigt die Oberfläche alte Daten. Theo führt das an einer Sidebar mit lokalem Cache vor, die gelöschte Threads weiter zeigt. Wir laden lieber zuerst, was bedienbar macht, und halten danach frisch.
- **Gecachte Daten als ungeprüft zeigen.** Zeigen wir für einen schnelleren Start den letzten Stand, dann lieber verblasst, bis der Server geantwortet hat. Sonst bleibt Gelöschtes stehen, und das kostet Vertrauen in die Anzeige.
- **Bytes als sinkende Decke, sichtbar im Ergebnis.** Bundle, HTML, Session-Payload und die Erstladung eines Chats lassen sich deterministisch zählen.
  - Theo hält solche Werte je Szenario fest: Basis von main, Wert des PR, Differenz und Decke. Ein Bot schreibt sie als PR-Kommentar, den auch die Agenten im Review lesen.
  - Bei uns ist `index.html` seit Juli von 59 KB auf 308 KB gewachsen und `app.js` von 592 KB auf 1,10 MB. Kein Check hat es gemeldet.
- **Absolute Millisekunden neben Prozent.** Minus 78 % von 200 ms sind weniger Wartezeit als minus 30 % von 4 s. Wir nennen beides, dazu den Ablauf, in dem die Zeit liegt.
- **Wartezeiten zuerst verstehen.** Fleets Wartezeiten tragen oft Last: die Annahmeprüfung beim Senden, der Generation-Schutz im Chat-Poll, die Seed-Runden beim Terminal. `server.ts#sendText` begründet jede seiner Pausen im Kommentar. Wir lesen das lieber, bevor wir eine Pause kürzen. Anthropic hat 900 Zeilen Build-Plugin für 2 ms pro Senden abgelehnt.
- **Die Sonde zuerst verdächtigen.** Eine neue Messung mit überraschendem Ergebnis hat oft selbst einen Fehler. Theos Agent fand in seiner Kapazitätsmessung einen Testaufbau, der still die alte Laufzeit erzwang. Wir bauen lieber einen Gegenfall ein, an dem die Sonde rot werden müsste.
- **Sichtbares dem Owner vorlegen.** Einblendungen, Skelette, Verblassen und Tabellen, die Zelle für Zelle erscheinen, sind Geschmack und keine Messwerte. Wir zeigen sie lieber mit Vorher/Nachher-Bild, als sie still zu entscheiden.

### Wo die Zeit heute liegt

Labor, 05.10.2026: Scratch-Instanz, acht Sessions, headless Chrome auf diesem Mac, n=15 je Zeile.
Das sind keine Feldwerte.

| Ablauf | p75 | Bemerkung |
|---|---|---|
| Dashboard kalt öffnen bis Sidebar-Zeilen | 224 ms, bei 4× CPU-Drossel 588 ms | Long Tasks kalt zusammen p75 407 ms |
| Dashboard warm öffnen | 63 ms, gedrosselt 437 ms | `app.js` aus dem Cache, `index.html` bei jedem Aufruf neu |
| Session wechseln bis erster Terminal-Frame | 49 ms | lokaler WebSocket, fast leere Panes |
| Nachricht senden bis wartende Blase | 2–7 ms (min–max) | Messung vom 22.09., echter Agent |
| `/send` bis Antwort | 350–550 ms (min–max) | Serveranteil, 150 ms davon fester Schlaf |
| Chat-Poll, Server liest ganze Datei | 4,6 ms bei 3,3 MB | p95-Datei 8,3 MB: 10,6 ms; größte 33,8 MB: 92 ms |
| `brief` der Info-Spalte | 170 ms | alle 3 s, Git-Aufrufe nacheinander |

### Werkzeuge, die schon da sind

- Eine Scratch-Instanz entsteht aus `git archive HEAD` mit eigenem Socket, Port und Token und `FLEET_CMD=true`. Seiten misst man mit `playwright-core` und dem installierten Chrome; die CPU-Drossel kommt per CDP `Emulation.setCPUThrottlingRate`.
- `bun build src/client.ts --minify --metafile=<datei>` zeigt die Bytes je Modul.
- `GET /api/transport` liefert Bytes, Requests und gzip-Ersparnis je Pfad. Es hat am 07.08. schon die Datenspar-Fragen beantwortet (`docs/data-saver.md` §2).
- Als Vorlage für eine Ablaufmessung mit echtem Agenten dient `docs/messungen/2026-09-22-chat-absenden-zeitleiste.md`: eine Uhr im Browser, Phasenstempel im Server, Long Tasks per `PerformanceObserver`.
