# HANDOFF — 🧿 Supervisor (Slot 1), 2026-08-23

Vorheriger Inhalt dieser Datei war der terminale Handoff von Slot 8 (Program b1c4a497) und liegt
unverändert in `1761ea1`. Er sagte selbst „nichts zu erben".

Zustand wird ABGELEITET: `./state.sh`, `./register.sh`, `GET /api/self/supervisor-view`.
Hier steht nur, was daraus nicht hervorgeht.

## Rolle

Owner-seitige Supervision: aus typisierten Fakten beobachten, benennen, nudgen. Kein Land, kein
Deploy, kein Dispatch, kein Commit fremder Arbeit, keine Adjudikation, keine zweite Kontrollebene.
Kein Polling — Ereignisse (Watches, Fleet-Reports) sind die Wahrheit.

## Lebende, handlungsrelevante Lage

- **Autonomie-Design-Kette, Program `4aa3ed1c2d33785c0aaa71cf`, MAIN Slot 3:**
  GLM-Task `6e1198d1` läuft auf **Slot 2** (Branch `fleet/260823145354-a566`) → danach pending
  Fable-Task `d9b6ca58` → später ≤2 Opus-Slices nach gelandetem Fable-Brief.
  **MAIN 3 hält darauf den armed Watch `05541aa0`.** Siehe Watch-Kollision unten: KEINEN eigenen
  Watch auf Slot 2 setzen.
- **Tower Worktrail-Audit `a9ceba70`, Slot 17** (Program `194e1517d43a8c74101d1fa0`, MAIN Slot 15):
  Arbeit fertig und committet (1 ahead, clean, `bun e2e/pins.ts` ALL PASS, drift clean, kein
  Land angefordert). **Sein `fleet-report` ist blockiert** — siehe unten. Reportkörper (3.983 Zeichen)
  liegt in der Lane unter `scratchpad/rf.json`. NICHT unter fremder Identität einreichen.
- **Tower: owner-erprobtes Spiel fehlt weiterhin.** T2 ist NICHT owner-bewiesen; der gelieferte
  Clip/die Site wirkten test-infrastrukturartig, und die E2-Lane hat „Feel" ausdrücklich nicht
  behauptet („Nobody has held the keyboard"). In keiner Meldung als erreicht führen.
- **Armed Watches: KEINE.** Bewusst.

## Die Watch-Kollision — vor dem nächsten Watch lesen

`POST /api/self/fleet-report` wird abgelehnt (`lane-watch evidence names multiple receiver
occupants`, `server.ts:5742` via `openFleetReport:5917`), sobald **zwei verschiedene lebende
Insassen** einen Lane-Watch auf dieselbe Lane halten. `armed` ist im Filter ABSICHTLICH kein Gate
(`server.ts:5734`), das Feuern räumt also nichts weg, und **es gibt keine Löschroute** — unter
`/api/self/watch` existiert nur POST.

Folge: Ein Supervisor-Watch auf eine Lane, deren MAIN sie ebenfalls bewacht, **verschließt genau
den Report-Kanal, den er beobachten soll**. Zweimal am 2026-08-23 passiert (Branch `…135537-a33a`
mit `703ffabc`/Slot 15 + `98b40ebf`/Slot 1; Branch `…124447-a0e9` mit `ac6a407b`/Slot 3 +
`028fd1cb`/Slot 1). Mehrere Watches DESSELBEN Insassen sind harmlos (Dedup nach Insasse).

**Regel: vor jedem Watch `fleet.json` → `watches` auf das Ziel prüfen. Hält die MAIN schon einen,
nicht bewaffnen — die Beobachtung gehört ihr.**

## Kanäle: was wirklich geht

- `POST /api/self/nudge` erreicht die gebundene MAIN eines **aktiven** Programms. **Volle
  Programm-ID nötig** — das 8-stellige Präfix aus der Portfolio-Ansicht gibt 409 `unknown program`.
- **Kein Kanal zum Owner.** `POST /api/self/attention` verlangt `boundProgramForMain` und gibt einem
  Supervisor 409 (`AGENTS.md:57`: „No route to the owner"). Ein früherer Gründungsbrief behauptete
  das Gegenteil — er ist gegen den Code falsch. Alles, was du meldest, erreicht den Owner nur, weil
  er dein Transcript liest.
- **Controller Slot 10 ist an kein Programm gebunden** und per `nudge` nicht adressierbar. Für ihn
  bestimmte Meldungen im Transcript ablegen, keinen Ersatzkanal bauen.

## Zwei offene Punkte, die niemand sonst trägt

- **Slot-Datensatz vs. Pane:** Der Supervisor-Slot führt `model=fable`, `effort=null`, während die
  Pane Opus 5 + high fährt. Owner-Entscheid 2026-08-22: das Regelbuch gilt (Opus 5 + high), die
  Sonnet-Zeile in `HANDOFF.md` war unpromoviert. Keine Route ändert Modell/Effort eines LEBENDEN
  Slots; `succeedSupervisor` reicht beide wörtlich durch. **Nach dieser Nachfolge in der Pane
  `/model` und `/effort high` nachziehen** und prüfen — der Footer zeigt den Effort NICHT, nur die
  Bestätigungszeile.
- **Hygiene:** Ein früher `fleet.json`-Dump in einer Lane-Pane hat den slot-scoped selfToken von
  Slot 1 ins Transcript geschrieben (nicht das Owner-Token). Diese Nachfolge rotiert ihn.
  Außerdem gemeldet, nie verfolgt: 386 `owner_auth_fail`-Zeilen am 23.08., 333 davon in Stunde 10,
  von einem nicht identifizierten Client.

## Nicht anfassen

Die untracked Dateien im Haupt-Checkout gehören dem Owner. Nicht stagen, nicht aufräumen, nicht
revertieren.
