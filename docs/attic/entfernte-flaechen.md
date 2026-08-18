# Attic: Entfernte Flächen (Gast-Konsole, Share-`interact` — `41cf01d`, 2026-08-10)

**Status:** Inventar zweier bewusst ENTFERNTER Flächen, aus `CLAUDE.md` umgezogen 2026-08-18. Die
Wächter-Sätze (Container-Pfad ≠ Gast-Fläche · „guest" = Share-Zuschauer lebt als Fenster · keine
gelöschten Pfade in Backticks) stehen weiter in `CLAUDE.md` §Deploy.

## Die Gast-Konsole

- **Die Gast-Konsole ist ENTFERNT** (2026-08-10 gelandet als `41cf01d`, Owner-Entscheid ToS-Konformität).
  Weg sind: FLEET_GUEST_CMD samt Zeile in watchdog.sh, die Routen /api/guest*, das Panel in der Info-Karte,
  die fünf guest-Shell-Skripte (ctl/expose/bootstrap/claude-volume/firewall), das guest-Modul der e2e-Suite,
  der guest-ops-Brief und der §8-Gast-Block in fleet-e2e-security.ts. Grund: Container-Instanzen für Dritte
  zu provisionieren und deren Claude-Credential zu halten sieht wie „provide the Services to third parties"
  aus — und es ist überflüssig, sobald Kollaboration über Artefakte (GitHub, Intake) läuft statt über
  Clients. Was BLEIBT und nicht verwechselt werden darf: der Container-/Sandbox-Pfad (Dockerfile,
  docker-entrypoint.sh, docker-verify.sh, container-firewall.sh — vormals guest-firewall.sh, umbenannt, weil
  „guest" als Begriff nicht mehr existiert; opt-in über FLEET_FIREWALL=1) — der ist der Agenten-Zaun, nicht
  die Gast-Fläche. Zweite Falle: „guest" heisst im Code weiterhin auch „Share-Zuschauer"
  (guest_ws_connect, guests: an der Slot-Zeile, src/share.ts) — das ist ein anderes Feature und lebt, aber
  nur noch als FENSTER.

## Der Share-Modus `interact`

- **Ein Share hat keinen Modus mehr — `interact` ist entfernt, nicht abgeschaltet** (gelandet im selben
  `41cf01d`). Weg sind: das Feld mode an Share und an WSData, die Route /api/slots/:id/share-mode (auch aus
  der Slot-Action-Regex), die Gast-Send-Route /s/:id/send samt Compose-Bar und term.onData in src/share.ts,
  der Modus-Umschalter in beiden Share-Dialogen des Owner-Clients und das Audit-Ereignis share_mode_change.
  Der WS-Handler lässt Gast-Input jetzt bedingungslos fallen (`if (ws.data.share) return;`) — es gibt keinen
  Modus mehr nachzuschlagen, also auch keinen, den ein späterer Commit falsch nachschlägt. Grund: §2 der
  Consumer Terms wird beim BENUTZEN gebrochen, nicht beim Veröffentlichen — ein tippender Gast schickt SEINE
  Prompts als DEINE Inputs auf deinem Abo. Zuschauen ist das nicht. Zwei Dinge, die bewusst bleiben: die
  Share-Kommentare (sie tippen nichts in die pty und sind der einzige Rückkanal des Gastes) und die
  Prompt-Log-Quelle "share" (alte Zeilen tragen sie weiter; nur erzeugt sie niemand mehr). Und eine Sonde
  wurde dabei sichtbar geschwächt: der Prompt-Log-Check in e2e/restart.ts verlangte einen Eintrag mit
  source:"share", den nur die entfernte Route erzeugen konnte — die Hälfte ist gestrichen, mit Begründung im
  Code, nicht still gedreht. **Beim Nachpflegen dieser zwei Einträge:** keine gelöschten Pfade in Backticks
  nennen, sonst fällt der Pfad-Pin in `e2e/pins.ts` (die Lane ist genau da einmal hineingelaufen).
