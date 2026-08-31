# Spielbare Artefakte — 2026-08-19, alle einzeln verifiziert

> **Redigiert 2026-08-31 beim Tracken in das public Repo:** Tailscale-IP → `100.64.0.1`
> (der Platzhalter, den `watchdog.sh` und `SHARING.md` führen), `/Users/<account>/` → `~/`,
> die Leck-Guard-Muster durch ihre Beschreibung ersetzt. Der Inhalt ist sonst unverändert.

Nicht nur HTTP 200: bei jedem steht der Titel, den der Link wirklich ausliefert.

| Spiel | Link | belegt durch |
|---|---|---|
| **Private-repo-g** | http://100.64.0.1:4520/ | `<title>Private-repo-g</title>`, Bundle 509.920 B laedt (Build 20:38) |
| **Private-spiel-a** | http://100.64.0.1:8101/private-repo-l/ | `Private-spiel-a — The Untertitel-a, Pier Six` (Commit 21:45) |
| **Private-spiel-b** | http://100.64.0.1:8101/private-task-06/ | `Private-spiel-b — the Untertitel-b` (Commit 19:31) |
| **Private-spiel-f** | http://100.64.0.1:8101/private-task-01/ | `PRIVATE-SPIEL-F — UNTERTITEL-C` |
| **Private-spiel-c** | http://100.64.0.1:8101/private-task-02/ | `PRIVATE-SPIEL-C` |
| **Private-spiel-d** | http://100.64.0.1:8101/private-task-03/ | `PRIVATE-SPIEL-D` |
| **Private-spiel-e** | http://100.64.0.1:8101/private-task-04/ | `PRIVATE-SPIEL-E — Untertitel-d` |
| **Private-repo-d** (alt) | http://100.64.0.1:4510/ | Seite stempelt `0962c2a` == git HEAD |
| **Private-repo-c I** (alt) | http://100.64.0.1:4321/ | laeuft seit 02:40 |

Uebersicht aller Arcade-Aufgaben: http://100.64.0.1:8101/

## Was ich seit deiner Nachricht getan habe

- **`~/private-repo-i` angelegt** (Commit `48da590`): AGENTS.md mit dem Arbeitskreis, dein Anker
  woertlich uebernommen, die zwei offenen Geschmacksfragen, `package.json` mit Verify-Zeile.
  **Kein Code** — was aus `~/private-repo-d` uebernommen wird, entscheidet die neue MAIN und weist
  es als Uebernahme aus.
- **Die `.env`-Zeile selbst gesetzt** und deployed (Verb 2, Verdikt `ok:true`). Der laufende
  Server traegt `~/private-repo-i` — an `ps eww` des Prozesses verifiziert, nicht
  geglaubt. Backup der alten `.env` liegt im Job-Scratch.
- **Programm `4eada64c` vorgeschlagen.**

## Der eine Knopf, den nur du druecken kannst

    ~/claude-fleet/promote-program.sh 4eada64c --go

(Der volle Pfad ist noetig, wenn du in `~` stehst — das Skript wechselt selbst in sein
Verzeichnis, funktioniert also von ueberall. Ohne `--go` zeigt es nur den Inhalt an,
ohne Argument listet es alle offenen Vorschlaege.)

Danach bootstrappe ich die Fable-MAIN auf `~/private-repo-i` — gebunden, mit der harten Regel
"baut nie selbst". Der alte Private-repo-d-MAIN schreibt gerade seinen Handoff; ich lege ihn
nicht still, bevor er fertig gemeldet hat.
