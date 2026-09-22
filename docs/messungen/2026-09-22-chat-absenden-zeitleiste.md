# Chat-Ansicht: Absenden bis sichtbare Blase — Zeitleiste, Ursache, Fix

Stand 2026-09-22. Auslöser, Owner 2026-09-21 wörtlich: „und das absenden über die chat ansicht dauert
auch ganz komisch lange..“

## Aufbau der Messung

- Wegwerf-Instanz aus diesem Baum (Scratchpad-Kopie, eigener tmux-Socket `fleetlane160d`, Port 8871,
  `FLEET_CMD=claude`). Slot 1 lief mit dem echten `claude` (Claude Code 2.1.278, Opus 5), Slot 2 mit dem
  echten `pi`. Jede Nachricht war „Reply with only the word OK. m-xxxxxx“, optional mit 25
  Füllzeilen (≈1,6 KB, die Form einer echten Owner-Nachricht).
- Client: Playwright (`playwright-core` 1.58.1, headless Chromium). Alle Client-Zeiten stammen aus einer Uhr
  (`performance.now()` der Seite) und laufen ab dem Enter-`keydown` im Composer. `fetch /send` wurde in
  der Seite umwickelt, die Blase per MutationObserver auf `.msg.user` mit dem Marker erkannt, Long Tasks
  per `PerformanceObserver("longtask")` aufgezeichnet. Vor dem Enter liegen 0–3 s Zufallsverzögerung,
  damit der Sendezeitpunkt nicht immer an derselben Stelle der 1-s-Poll-Kette liegt. Zwischen dem Tippen
  und dem Enter lagen 2,5 s, so wie ein Mensch nach dem Tippen absendet.
- Server: nur in der Scratch-Kopie Zeitstempel an jeder Phase von `server.ts#sendText` und am Ein- und
  Ausgang des `/send`-Handlers (`[sendt]`/`[sendh]` in der `server.log` der Instanz). Nicht committet.
- Profil der Ursache: CDP-`Profiler` auf einem nicht minifizierten Bundle der Scratch-Kopie.

## Zeitleiste vor dem Fix (ms ab Enter)

| Fall | Läufe | `/send` Antwort | Blase sichtbar | Long Tasks |
|---|---|---|---|---|
| claude idle, kurz | 10 | 348–523 | 379–1365 (4 von 10 > 1 s: 1298 · 1265 · 1365 · 1094) | keine |
| claude idle, 25 Zeilen | 4 | 353–447 | 381 · 477 · 1575 · 1660 | 2 von 4: 980 und 997 ms, Beginn 583/652 ms |
| pi idle, kurz | 3 | 272–338 | 886 · 933 · 3351¹ | keine |
| claude mitten im Turn | 1 | 391 | 6430 | keine |
| claude idle, Datensparmodus | 3 | 349–361 | 495 · 1528 · 2218 | keine |

¹ Erster Send an einen frischen pi. Die Session-Datei entsteht erst dabei, und `pollChat` fängt beim
Quellwechsel von vorn an (ein Poll mehr). Nicht weiter verfolgt.

Serverphasen, claude idle (aus `[sendt]`, 12 Sends): Composer-Vorlesen +12–16, Agentenprobe +40–63,
`load-buffer`+`paste-buffer` +57–81, **fixer Schlaf 150 ms** (`sendText`, `await Bun.sleep(150)`), Ankunft
+5–10, Enter +5, dann die Annahmeprüfung (`awaitComposer` bis der Composer leer ist) **+90–275 ms**, bis der
Claude-TUI das Feld leert. Zusammen 330–548 ms. Beim pi leert sich das Feld in 6–10 ms, zusammen
232–254 ms. `curl` gegen denselben `/send` braucht 346–377 ms. Der Server hat also keinen versteckten Rest.

## Ursache

1. **Die Blase existiert erst, wenn der Transkript-Poll sie bringt.** `doSend` schreibt nichts in die
   Chat-Ansicht. Die Nachricht erscheint erst, nachdem `POST /send` geantwortet hat (0,25–0,55 s, davon sind
   150 ms fixer Schlaf und bis 275 ms Annahmeprüfung), der Agent sie in seine Datei geschrieben hat und
   `Pane#pollChat` die Datei als nächstes liest. Das passiert alle `chatMs` = 1000 ms, im Datensparmodus alle
   3000 ms (`src/pollplan.ts`). Mitten im Turn schreibt Claude die Nachricht erst nach dem laufenden Schritt,
   im gemessenen Fall nach 6,4 s. Die Zeit kostet die fehlende lokale Anzeige in `src/client.ts#doSend`, nicht
   eine einzelne langsame Zeile. Jeder Server-Anteil ist gewollt: die Annahmeprüfung verhindert, dass ein
   Brief in einem fremden Screen verschwindet (dort ist nichts zu holen, `ACCEPT_WAIT_MS` bleibt).
2. **Ein Einfrieren von 1–2,7 s bei mehrzeiligen Nachrichten.** Ändert sich die Höhe des Composers (beim
   Tippen einer neuen Zeile und beim Leeren nach dem Senden), ruft `reshapeSurface` 200 ms später `settle()`
   auf, und das ruft `p.refit()` für **jedes** Pane auf. Das gilt auch für den Terminal, den die Chat-Ansicht
   nur mit `visibility: hidden` versteckt (`public/index.html`, `.pane.chat .paneterm`). Er behält also
   seine Box, `FitAddon.fit()` ändert die Zeilenzahl, und xterm reflowt seinen 10 000-Zeilen-Puffer
   (`scrollback: 10000`). CDP-Profil: 2 734 ms Eigenzeit in `handleResize` unter `fit` ← `refit` ←
   `settle`. Ohne Pause zwischen Tippen und Enter blockierte das die Auflösung der `/send`-Antwort
   (Seite 1270–2794 ms gegenüber Server 435 ms). Mit Pause trifft es das Leeren nach dem Send und verzögert
   die Blase in 2 von 4 Läufen auf 1,6 s.
   Wer eine Zeile mehr tippt, friert ebenfalls rund 1 s ein.

Kein Befund: `transcriptPayload` liest pro Poll die ganze Datei. Gemessen auf den drei größten Transkripten
dieser Maschine (16–25 MB) kostet das 19–175 ms je Poll. Das ist echt, aber es ist nicht der Hauptposten.

## Fix (kleinster Schnitt, nur `src/client.ts` + `src/pendingsend.ts`)

- **Lokale Blase beim Enter.** `doSend` → `Pane#addPending` hängt die gesendete Nachricht sofort als
  `.msg.user.pending` an („you · wird gesendet…“, halbe Deckkraft). Nach der Antwort steht dort
  „gesendet“, und bei einem Fehler (409 refused/uncertain, Netz) wird die Blase entfernt. Der Text bleibt
  wie bisher im Composer. Kommt der Eintrag im Transkript an, ersetzt ihn `Pane#appendEntry`, sobald der Text
  übereinstimmt (`src/pendingsend.ts#pendingSettledBy`: gleicher Text, nur Leerraum darf abweichen). Server,
  `ACCEPT_WAIT_MS` und Annahmeprüfung sind unberührt.
- **Kein Refit für einen Terminal, den die Chat-Ansicht versteckt.** `settle()` refittet nur Panes mit
  `!isChat`, und `setView("term")` refittet auf dem Rückweg. Nachgeprüft: die Terminalbox war nach dem
  Rückwechsel 693 px hoch und der xterm-Screen 686 px, das passt, Bild aus der Scratch-Instanz.

## Zeitleiste nach dem Fix (dieselbe Instanz und dasselbe Skript, ms ab Enter)

| Fall | Läufe | wartende Blase | `/send` Antwort | Transkript-Blase | Long Tasks | Doppel? |
|---|---|---|---|---|---|---|
| claude idle, kurz | 5 | **2–4** | 352–531 | 414–1181 | keine | nicht erhoben |
| claude idle, 25 Zeilen | 4 | **3–7** | 388–573 | 558–1315 | **keine** (vorher 2 von 4) | nicht erhoben |
| pi idle, kurz | 3 | **2–6** | 244–314 | 401–1017 | keine | 1 Blase, 0 wartend |
| claude mitten im Turn | 1 | **2** | 375 | 1061 | keine | 1 Blase, 0 wartend |
| claude idle, Datensparmodus | 2 | **2** | 354–376 | 2087 · 3015 | keine | 1 Blase, 0 wartend |
| claude, Composer mit Entwurf (409 refused) | 1 | 3, entfernt | 41 (409) | — | keine | 0 Blasen |

Die Zeit bis zur sichtbaren Blase liegt im Idle-Fall jetzt bei 2–7 ms (Ziel < 1 s), in allen Fällen und
Läufen. Die Transkript-Blase kommt so spät wie vorher, denn die Poll-Kette ist unverändert. Sie ersetzt
jetzt aber eine schon sichtbare Blase, statt als Erstes zu erscheinen. Den „Doppel?“-Wert las das Skript
zwei Sekunden nach der Transkript-Blase: genau eine `.msg.user` mit dem Marker und keine wartende mehr.

## Check

`e2e/slots.ts`, in der Client-Sektion hinter dem Datensparmodus: drei Checks führen `pendingSettledBy`
wirklich aus (gleicher Text und neu umbrochen retirieren, anderer Text oder Präfix nicht, leer nie). Drei
Form-Checks prüfen die Verdrahtung in `src/client.ts`: `addPending` vor `await deliver` und `dropPending`
beim Fehler, `settlePending` in `appendEntry` über das Modul, `!p.isChat` in `settle()` und `refit()` in
`setView`. Gegen `git show HEAD:src/client.ts` sind die drei Form-Checks rot, das Modul existiert dort nicht.

## Offen

- Ein Text über `PASTE_MAX_BYTES` (32 KB) kommt als eine Ankündigungszeile ins Transkript. Die wartende Blase
  findet dann keinen gleichen Text und bleibt als „gesendet“ stehen, bis der Slot neu zugewiesen oder die
  Seite neu geladen wird. Nicht gebaut, weil es selten vorkommt und die Blase nichts Falsches sagt.
- Mitten im Turn rendert die parallele Lane `bd92c340` den `queued_command`. Rendert sie ihn als
  User-Text mit demselben Text, retiriert er die wartende Blase ebenfalls. Nicht geprüft, weil ihr Stand
  nicht auf main ist.
- Eine laufende Poll-Kette nach dem Send früher anzustoßen (`chatPump()`) würde die Transkript-Blase im Mittel
  um ~0,5 s vorziehen. Nicht gebaut, weil das Ziel ohne sie erreicht ist.
