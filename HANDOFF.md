# HANDOFF — Controller (Slot 9, Fable), Tagsession 2026-08-26 (zweite)

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Hier steht nur, was daraus
nicht hervorgeht. Vorgänger-Handoff (Tagsession-Beginn) in der Historie (`8b55384`).

## North Star (Owner, unverändert)

Etappe 2 läuft breit: der Owner gründet Produkte. **Sechs aktive Produkt-Programme** (Private-repo-j,
Private-repo-q, Private-repo-r, Private-repo-s, Private-repo-t + Private-repo-p-Programm ohne MAIN). Owner will sich als Nächstes
wieder der **Verbesserung von Fleet selbst** widmen — Befunde dafür liegen als Notizen bereit.

## Was diese Session geschlossen hat (Bodies: git log 8b55384..HEAD + Ledger)

1. **Mutex-Helfer gelandet + deployt + LIVE** (`93182c6`, Deploy `69af4a04` boot-ok): Owner-Gerät
   ist als Helper registriert (Token via `GET /api/helper/token`; URL beim Owner). Claimbare Jobs
   entstehen nur, wenn die Dev-Maschine schon kaut — Owner will einen PING, wenn einer offen ist.
2. **Flake-Familie 9 repariert + gelandet** (`4bde073`+`28e6f3f`): tmux 3.6a lässt
   `new-session -c <gone>` still auf $HOME zurückfallen — die Sonde kontrolliert den Heal jetzt
   (remain-on-exit + tote Pane). Regelbuch-Fragment nachgezogen, CLAUDE.md neu gerendert.
3. **Kurzketten-Repo-Guard gelandet** (`9c8597d`, cb525212): docs-Land in fremden Repos = SKIPPED
   (exit 42) statt rot; dreiseitiger Pin. **DEPLOY STEHT NOCH AUS** (siehe IN FLIGHT).
4. **Ernte der 15 ARBEIT-Worktrees gelandet** (`80df0e2`ff, 22 Commits): 12 geerntet (eine stille
   Regression gegen `b861b9a` abgefangen; ein Host-Leak vom leak-pin gestellt), 1 abgelöst, 3
   Owner-Entscheide → `docs/messungen/ernte-arbeit-worktrees-2026-08-26.md`. Die 13
   remove-Zeilen NUR auf Owner-Go fahren.
5. **Zehnte Flake-Familie identifiziert** (ambient-use-Check, ~10 % Basisrate, kreuz-baum belegt —
   Worker-Report `b9103d11`): verursachte ALLE vier Audit-Rots des Tages, alle adjudiziert
   (auch 69615a52 nachgetragen — Urteile liegen in `audit-adjudications.jsonl`, die Audit-Zeile
   selbst bleibt „rot"). Meine 052da8e-These war falsch, Notiz `9a83554e` gilt als widerlegt.
6. **Drei Spiele-Programme gegründet** (Owner: „entscheide du" + explizit Private-repo-r): Private-repo-r S12 ·
   Private-repo-s S13 · Private-repo-t S14 (je Repo mit gebundenem Intake + AGENTS.md, MAINs Fable, Owner hat
   Effort auf **high** gedreht — Slot-Datensätze sagen noch xhigh, nach Heal/Nachfolge in der
   Pane nachziehen!). Seilschaft (Lizenz-Trio) + Windschatten (Design-Risiko) bewusst als Vorrat.
7. **Private-repo-j:** DEM+P2 gelandet (3/3 Flüsse) · Spaß-Gate gespielt (Owner ~5 min, kein binäres
   Wort — S10 ordnet Reibungen Prämisse-vs-RTS selbst ein) · GLM-Öko-Review (pi-zai, glm-5.3)
   gelandet `e92571d` — Top-Befund Mehr-Uhren-Design. **GLM-Zeilen laufen NUR über attended
   Hand-Dispatch** (`POST /api/tasks/:id/dispatch {harness:"pi-zai",model:"glm-5.3"}` mit
   Owner-Token — der unbeaufsichtigte Pfad lehnt korrekt ab); S10 filet pending und meldet.
8. **Private-repo-q-MAIN war leer** (Boot-Race) — Brief nachgestellt, arbeitet. Dasselbe Race traf ALLE
   DREI neuen MAINs → Notiz `0a7447a7` (bootstrapProgramMain braucht das claude-Äquivalent des
   Codex-Readiness-Gates). Workaround: nach jedem Programm-Bootstrap die Pane prüfen, Brief per
   /send nachstellen.

## IN FLIGHT (Watches sterben mit diesem Slot — Nachfolgerin muss NEU verankern!)

- **DEPLOY `9c8597d` FÄLLIG:** Server läuft auf `93182c6` (`codeBehind:true`), wartet auf das
  LAUFENDE Audit (isolated, covers 2: `9c8597d`+`0001402`). Nach Audit-Ende: `POST /api/deploy`,
  Verdikt an `GET /api/deploys` prüfen. Audit-Rot mit ambient-use-Signatur = zehnte Familie,
  adjudizieren wie Punkt 5.
- **S2 = Private-repo-j-Skalen-Prototyp** (`69af55c1`, Opus high) — landet über Controller (confirm im
  Nicht-Fleet-Repo), danach S10 benachrichtigen. **S3 = Zehnte-Familie-Fix** (`be8c73b2`, Opus
  high, fleet-Repo) — normales Gate-Land.
- Watch-Deckel ist 5 und zählt auch verbrauchte Zeilen mit — bei „max 5" einfach später nachlegen.
- S16: unbeschriftete lebende Session im Fleet-Checkout, Zweck unklar — Owner fragen oder Pane lesen.
- S10-Sensorik: Owner-Poll zeigt für S10 ctx >100 % und model `claude-opus-5`, der Footer sagt
  Fable/28 % — Pane ist die Wahrheit, der Slot-Datensatz driftet (Heal-Vorsicht).

## Arbeitsmodus (Owner-gesetzt, gilt fort)

Controller erörtert, AGENTEN fixen — selbst nur briefen, landen, deployen, ernten. Programm-Lands
über Controller bis zur Self-Land-Promotion — **deren MAIN (S7) hat der Owner beim Aufräumen mit
entfernt** (auch S1/S2/S3/S5/S6-Insassen von heute Morgen); Programme sind per bootstrap-main
wiederbelebbar, stale Bindings fallen durch. Supervisor-Rolle ist vakant.

## Offene OWNER-Entscheide (gesammelt, neueste zuerst)

- Aus der Ernte: d70d-Promotion (AGENTS.md event-driven-Warten — main FEHLEN fünf Bestandteile,
  Wortlaut im Ernte-Bericht §3) · Rail-Commit `3600618` (lebender Code, dispatchen/verwerfen;
  f753 vollständiger) · 13 Worktree-remove-Zeilen (im Ernte-Bericht, nur auf Go).
- `FLEET_VERIFY_CMD_REPOS`-Repos verlieren bei docs-Lands ihr eigenes Gate (jetzt ehrlich
  SKIPPED) — Proportionalität dort ganz abschalten? (S8-Report, eine Zeile.)
- Bestand: Dossier-Auswahl Rest (Seilschaft/Windschatten als Vorrat) · Lizenz-Trio Spiele-Doc ·
  DEM-Download + Private-repo-j-Gates (laufen über S10-Attentions) · Private-repo-q Name/Modalität ·
  Publish-Rückstand (~1020 Commits, origin 5 Tage alt) · Fragment-Promotion geschmack/owner ·
  Programm-Triage (7 COMPLETEs/10 Discards).

## Nächste Schritte (Reihenfolge begründet)

1. Triage-Auto anlegen (15 min, runs Pflicht) · Watches: S2, S3, Audit-Watch auf
   `{kind:"audit", repo:<fleet>, mainAfter:9c8597d…}` → **danach sofort Deploy**.
2. S3 (Zehnte-Familie-Fix) ernten/landen — danach sind die Audit-Rots strukturell vorbei.
3. S2 ernten → confirm-landen → S10 benachrichtigen.
4. Owner-Entscheide aus der Ernte einholen; auf Go die remove-Zeilen fahren.
5. Produkt-MAINs an ihren Gates begleiten (S12 Loop-Beweis-Zahlen, S13 Interaktions-Skizze,
   S14 Schnipp-Feel, S11 Kostenbild — kommen als Attentions/Reports von selbst).
6. Fleet-Verbesserung mit dem Owner: Boot-Race `0a7447a7` ist der reife erste Schnitt.
