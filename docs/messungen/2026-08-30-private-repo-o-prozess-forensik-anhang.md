---
frage: Rohdaten-Anhang zur Synthese vom 2026-08-30 — Timeline, Akt-Register und Owner-Berührungen des Private-repo-o-Game-Maker-Laufs (Baseline für künftige Lauf-Vergleiche).
urteil: Kein eigenes Urteil — die Urteile stehen in der Synthese und in Stufe 2; dieses Dokument konserviert die erhobenen Tabellen, die sonst mit der Audit-Session sterben.
bereich: [game-maker, lane-lifecycle, ledger]
belege: [lane-outcomes.jsonl Z.609–630, context-receipts.jsonl Z.316–338, post-land-audits.jsonl Z.349–366, git-Log game-maker-private-repo-o-fresh 00b6095..0f86bc5, fleet.json tasks/programs/attentionRequests]
nicht-gemessen: pi-zai-Reviewer-Sensorik (Adapter liefert weder sessionMs noch toolResultBytes); Task-Filing-Zeitpunkte (kein Ledger-Feld); Anteil Arbeit/Warten im Nacht-Stall.
stand: 2026-08-30
---

# Prozess-Forensik Private-repo-o — Datenanhang (2026-08-30)

Erhoben von einem Wegwerf-Agenten der Audit-Session; jede Zahl trug im Original ihre Quellzeile.
Zeiten lokal (+0200). Messbefund vorab: **Fleet-Branch-Namen kodieren UTC** — über drei Paare
Branch-Name ↔ Receipt ↔ Land-Zeit verifiziert; ohne die Korrektur wären alle Lane-Starts 2 h falsch.

## Timeline (Wanduhr je Phase, gesamt 19h41m)

| Phase | Von → Bis | Dauer |
|---|---|---|
| Seed + Program-Bind | 29. 12:39:50 → 12:42:25 | 3 min |
| Preflight (Draft 12:57 · Reviewer 13:05 · Card FINAL 13:16 · **Warten auf Owner-Land 1h37m** · Land 14:53) | → 14:53:28 | 2h13m |
| Build B1–B4 (B1 15:16–17:57 · B2/B3 parallel 18:00–19:21/22 · B4 19:24–21:21) | → 21:21:14 | 6h27m |
| R1–R2 (von MAIN Slot 2 selbst gelandet) | → 22:07:29 | 46 min |
| Succession + Nacht-Stall (HANDOFF 22:09 · Owner „mach^^" 22:51 · neue MAIN 22:56 · Checkpoint 23:12 · **Stall bis 02:52**) | → 02:52:47 | 4h45m |
| R3–R4 + Doku (Lands 03:24/03:49 · Taste-Gate-Attention 03:59) | → 04:04:17 | 1h11m |
| **Quiet-Hours-Gap** (R5 spawnt exakt 07:00:04, 4 s nach Ende) | → 07:00:04 | 2h55m |
| R5–R6 + Halt (Lands 07:25/08:17 · Schlusscheckpoint 08:21) | → 08:21:03 | 1h20m |

## Akt-Register (13 Akte; Kontextlast = toolResultBytes, Dauer inkl. Land-Wartezeit)

| Akt | Typ | Modell/Harness | Kontextlast | Dauer | Ausgang |
|---|---|---|---|---|---|
| Architect | Vertrag | opus-5[1m] high | 45 KB | ~2h08m | killed-dirty, Draft als Tag gepinnt |
| Reviewer | Review | pi-zai/GLM high | kein Sensor | ~1h48m | Card FINAL gelandet; GAME-CARD:603 ungeprüft durchgewinkt |
| B1 | Vertrag+Sim | opus[1m] | 166 KB | ~2h42m | gelandet; beide Naht-Defekte wurzeln in B1-Konventionen |
| B2 | Renderer | opus[1m] | 1,83 MB | ~1h21m | gelandet; Spiegelungs-Naht-Anteil, Kantenlinie fehlt |
| B3 | Input/HUD | **sonnet-5 high** | **474 KB** | ~1h22m | gelandet, vertragskonform, kein zugeordneter Defekt |
| B4 | Integration | opus[1m] | 1,77 MB | ~1h56m | gelandet, erstes verified:true |
| R1 | Reparatur Sim/Input | opus[1m] | 848 KB | 22 min | gelandet; vorbildlicher Messreihen-Commit-Body (`f471804`) |
| R2 | Reparatur Renderer | opus[1m] | 2,69 MB | ~45 min | gelandet (3 Commits) |
| R3 | Reparatur Sim/Input | opus[1m] | 260 KB | ~32 min | gelandet |
| R4 | Reparatur Renderer | opus[1m] | **3,77 MB** (Read 3,49) | ~56 min | gelandet |
| R5 | Renderer/Sim-Naht | opus[1m] | 887 KB | ~26 min | gelandet |
| R6 | Renderer/HUD | opus[1m] | 3,49 MB (Read 3,24) | ~48 min | gelandet; falsche Verify-Berichtszeile (MAIN-Gegenmessung fing sie) |
| pi-B1-Dublette | — | pi | — | — | nie gestartet; als scharfe Mine im HANDOFF geführt |

Kontextlast-Muster: die Spitzen sind zu >90 % Read-Bytes. Kumulierte Lane-Lebenszeit 13,28 h;
Lane-Kontextvolumen gesamt 16,24 MB.

## Owner-Berührungen und Stillstände

4 Owner-Lands via Board-Cookie (Card 14:53 · B1 17:57 · B2/B3 19:21/22) — ab der
Promotion `selfLand:"guarded"` (bestätigt 19:40:58) landete die MAIN 8 Lands mit 0 min
Owner-Wartezeit. Insgesamt 8 Owner-Berührungspunkte + 1 Lane-Prompt; 5 Owner-Token-Deploys
ambivalent (Mensch oder Session nicht ableitbar). Stillstände auf dem kritischen Pfad ~10h10m
= 52 % der Wanduhr: Owner-Lands 3h35m · Übergabe-Zuruf 12 min · Nacht-Stall 3h40m (Anteil
Warten/Arbeit nicht trennbar) · Quiet Hours 2h55m. Attention-Rufe: 5 (4 davon Fleet-Mechanik,
1 Produkt/Taste — die blieb bis zum Audit offen).

## Gate-Realität

Card+B1–B3 `verified:null` (fehlender Worktree-Schlüssel; geschlossen durch Fleet-Commit
`54445c6`, deployt 21:06); ab B4 alle Lands `verified:true`. Post-Land-Audits: **11 von 11**
`unknown` mit exit 42 — der Audit-Guard ist fleet-spezifisch, für jedes Nicht-Fleet-Repo
konstruktionsbedingt; die MAIN las das als „reproduzierbaren Fleet-Defekt (2 von 2)" und
kompensierte mit handgefahrenem `bun run verify` je Stand (Fehldiagnose-Kosten: 2 Doku-Commits,
1 Attention-Punkt). Vorschlag dazu: V6 in der Synthese.
