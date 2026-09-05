# Dual-Host S1 — die Kanarie: ein echter claude-Slot auf der zweiten Instanz (2026-09-05, 20:26–20:40)

Schnitt S1 aus `docs/dual-host-topologie-entscheidung-2026-09-05.md` §3, gefahren vom
🎛 Fleet Controller (Slot 4) unter der Owner-Delegation „übernimm das komplett" (20:2x).
Owner-Gates W1 (ein Slot auf dem zweiten Host öffnen) und W1b (zwei Tipp-Akte in die Pane) sind
damit vom Controller ausgeführt, nicht vom Owner; jeder Host-Akt steht unten einzeln.

**Ergebnis in einem Satz: A steht.** Ein claude-Slot auf dem Folger bootet, ist über die dortige
API sichtbar, nimmt einen `/send` beobachtbar an und beantwortet ihn mit seiner eigenen
`GET /api/self`-Zeile. Ein Sensor von fünf ist rot, und der ist ein Defekt der Transcript-Route,
nicht der Topologie (§3).

## 1. Die fünf Sensoren, wörtlich

Alle Messungen über read-only ssh auf den Folger und `curl` gegen dessen Instanz (Token aus der
dortigen `.env`, nie durch diese Pane). Slot 1 des Folgers, Harness claude, `claude-opus-5[1m]`,
`effort high`, cwd = der dortige Fleet-Checkout.

| # | Sensor | Wert | Urteil |
|---|---|---|---|
| 1 | `GET /api/sessions` dort → Slot 1 | `{'cwd': '<checkout>', 'model': 'claude-opus-5[1m]', 'effort': 'high', 'agent': 'alive'}` | grün |
| 2 | `tmux -L claudefleet list-panes -t s1 -F '#{pane_pid} #{pane_current_command}'` + Kind | `100529 bash` → `100530 claude` | grün |
| 3 | `GET /api/slots/1/transcript` dort nach dem Codewort | `{"entries": [], "total": 0, "source": null}` — das Transcript EXISTIERT aber: `~/.claude/projects/<cwd-slug>/2588a75e-….jsonl`, 26 778 B, `grep -c KOLIBRI-7` = 3 | **rot** (§3) |
| 4 | `POST /send {slot:1, submit:true, text:"Kanarie KOLIBRI-7 …"}` → Receipt | `"acceptance":"observed"` (sendId `59ff45f6…`, 20:38:39) | grün |
| 5 | Antwort der Pane auf „führe `curl … /api/self` aus": | `KOLIBRI-7` + `{"slot":1,"label":null,"cwd":"<checkout>","mission":null,"awaiting":null,"lane":null,"idleMs":64,"observed":true,"autos":[],"watches":[],"events":[]}` — „Ran 1 shell command", 9 s | grün |

Der Slot wurde danach per `POST /api/slots/1/kill` geschlossen; `active slots after kill: []`.

## 2. Was VOR dem grünen Lauf stand — vier Erststart-Dialoge, und der Sensor sieht keinen

Der erste Versuch (20:26) lief in den **Login-Auswahldialog** von Claude Code, obwohl der Login da
war (`claude auth status` → `loggedIn: true`, Credentials-Datei von 18:53). Grund: der Owner hatte
den Login nicht-interaktiv erledigt, `hasCompletedOnboarding` fehlte in `~/.claude.json`. Danach
kamen nacheinander der **Ordner-Vertrauensdialog** („Yes, I trust this folder"), die
**Bypass-Permissions-Bestätigung** („Yes, I accept") und ein **TUI-Tipp** („Yes, try it"). Jeder
`/send` mit `submit:true` hat den jeweils offenen Dialog BEANTWORTET — einmal mit „No, exit", was
claude beendete und die Pane als Shell zurückließ.

Vier Host-Akte des Controllers auf dem Folger, alle reversibel, Backup `~/.claude.json.bak-20260905-2030`:

1. `hasCompletedOnboarding: true` in `~/.claude.json` (20:29).
2. `projects["<checkout>"].hasTrustDialogAccepted: true` in `~/.claude.json` (20:32) — derselbe
   Schlüssel, den der kanonische Host für seinen Checkout trägt.
3. Bypass-Bestätigung per `tmux send-keys -t s1 Down Enter` (20:36); für diese Bestätigung gibt es
   in `~/.claude.json` und `~/.claude/settings.json` KEINEN Schlüssel (geprüft auf beiden Hosts).
4. Den TUI-Tipp hat der Enter des nächsten `/send` beantwortet (20:37); sein Text ging verloren.

**Der Befund dahinter, und er ist nicht second-host-spezifisch:** `agent: alive` und die Pane-Kette
`bash → claude` sind auf ALLEN vier Dialogen grün, und `acceptance` war auf den ersten dreien
`unobservable`, auf dem vierten `observed`. Die Faktschicht unterscheidet „claude läuft" nicht von
„claude wartet auf einen Erststart-Dialog". Für codex existiert dafür `paneReadiness()` mit dem
Gate `blocked-screen` (Regelbuch, „Codex-Dispatch wartet auf Readiness"); für claude gibt es kein
Gegenstück. Auf dem kanonischen Host fällt das nie auf, weil dort alle Flags längst gesetzt sind.
Jede FRISCHE Maschine (oder ein frisches HOME) trifft es beim ersten Slot.

## 3. Der rote Sensor: die Transcript-Route pinnt auf die Slot-`sessionId`

`server.ts#transcriptFile`: hat der Slot eine `sessionId`, wird ausschließlich
`<projDir>/<sessionId>.jsonl` gelesen und bei Abwesenheit `null` zurückgegeben — der
Newest-by-mtime-Fallback läuft NUR für Slots ohne `sessionId`. Der Slot des Folgers trug
`sessionId a648496c-…` (Receipt), claude schrieb sein Transcript aber unter `2588a75e-….jsonl`.
Warum claude dort nicht unter der übergebenen Session-Id schreibt, ist NICHT isoliert (Kandidaten:
die Erststart-Dialoge davor; ein Unterschied im Spawn-String; die Version 2.1.261). Auf dem
kanonischen Host arbeitet dieselbe Route. Der Sensor ist damit als Gerätefrage offen, die Kanarie
selbst nicht: das Transcript liegt vor und enthält das Codewort dreimal.

## 4. Entscheidungen E1–E7 (Controller unter Owner-Delegation, 20:2x)

| # | Entscheidung | Konsequenz |
|---|---|---|
| E1 | **A** — zwei Instanzen, der Mensch föderiert | S1 (diese Notiz) → S2 → S3 → S4; B wird nicht begonnen |
| E2 | Gate 2 bleibt **NEIN** | Rückweg = Richtung R (Branch holen, hier landen); der Owner liest das zweite Board; kein Relay vor einem S4-Befund |
| E3 | **JA**, Land-Sperre als Env-Mechanismus (S2) | wird als Lane dispatcht; W2 (`FLEET_LANDS=0` in die dortige `.env` + `srv`-Restart) fährt der Controller nach dem Land |
| E4 | **A** — Program-Datensatz auf der zweiten Instanz neu bestätigen | zwei Handgriffe je Program, kein Sync-Code |
| E5 | **JA**, Kanarie sofort | gefahren, siehe §1 |
| E6 | **NEIN** vorerst — claude-only auf dem Folger | codex/pi/container bleiben Mac-Formen; eine codex-Installation wäre ein Login auf dem Owner-Konto und würde einzeln gefragt |
| E7 | **JA**, C-Guard härten | eigene kleine Zeile nach S2, keine Abhängigkeit |

## 5. Was nicht gemessen wurde

Kein zweiter Slot, keine Lane, kein Program auf dem Folger (das ist S4). Keine Messung, ob
`--session-id` dort grundsätzlich ignoriert wird (§3). Keine Messung der Erststart-Dialoge für
codex/pi auf dem Folger (E6 = nein).
