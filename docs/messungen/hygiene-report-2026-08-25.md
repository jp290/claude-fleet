---
frage: Welche der 34 Worktrees, tmux-Sockets und TMPDIR-Scratch-Familien sind sauber verwerfbar, welche tragen Arbeit, und welche sind live?
urteil: Von 34 Worktrees sind 14 SAFER, 16 ARBEIT (2 Rail-Lanes nachweislich abgelöst, 1 vermutlich), 0 UNKLAR, 4 AKTIV; alles ist report-only, Ausführung ist ausschließlich Ownersache
bereich: [hygiene]
belege: [f16b470, /Users/owner/claude-fleet.worktrees/, /private/tmp/tmux-501/]
nicht-gemessen: Der Haupt-Checkout selbst (dessen Untracked-Dateien lagen außerhalb des Auftrags, nur gemeldet); die Messung ist ein Schnappschuss eines lebenden Systems (main, e2e und Slots schoben während des Lesens weiter)
stand: 2026-08-25
---

# Maschinen-Hygiene 2026-08-25 — Bestandsaufnahme (REPORT-ONLY)

Gemessen am 2026-08-25 ~15:45 von Lane `fleet/260825134349-0d91`. Diese Lane hat nichts gelöscht,
nichts entfernt, keinen Server gekillt — nur gelesen. Alle Befehle unten sind Vorschläge für den
Owner; **ausführen tut ausschließlich der Owner.**

Messbasis: lokal `main` stand bei Messung auf `f16b470` (lebendes System, schiebt weiter);
`origin/main` = `c9e9af7` (2026-08-21). Unmerged-Bewertung pro Lane via `git log main..HEAD` plus
Patch-Äquivalenz-Check (`git cherry main <branch>`) — Hash-Abweichung durch Squash/Reword wird so
nicht fälschlich als Arbeit gezählt. Dirty via `git status --porcelain`. Lebende Slots via
`tmux -L claudefleet list-panes -a`.

## A. Worktrees unter `/Users/owner/claude-fleet.worktrees/` (34)

Legende: **SAFER** = SAFE-TO-DISCARD (keine unmerged Patch-Commits, nicht dirty bzw. nur
`.agents/`-Duplikat, kein lebender Slot) · **ARBEIT** = HAT-ARBEIT (genaue Angabe) · **UNKLAR** ·
**AKTIV** = lebender Slot, nicht in Hygiene einschließen.

| Worktree | HEAD (Datum) | Dirty | Unmerged (patch-echt) | Slot | Einstufung |
|---|---|---|---|---|---|
| fleet-260821211509-0be7 | 920c9c4 (08-22) | – | 2 docs(auftragsmarkt) | – | ARBEIT |
| fleet-260822142649-61ec | 2d188da (08-22) | – | 0 | – | SAFER |
| fleet-260822143207-d70d | cb26c00 (08-22) | – | 1 AGENTS.md (event-driven-Warten) | – | ARBEIT¹ |
| fleet-260822183548-25e2 | 3c3474c (08-22) | – | 1 feat(acp-26) Composer-Rollback | – | ARBEIT |
| fleet-260823075928-af51 | 57d8d28 (08-23) | – | 0² | – | SAFER |
| fleet-260823085611-1869 | 105c234 (08-23) | – | 0 | – | SAFER |
| fleet-260823085612-7ea4 | 105c234 (08-23) | – | 0 (Duplikat von 1869) | – | SAFER |
| fleet-260823092612-470f | cc9b90e (08-23) | – | 0 | – | SAFER |
| fleet-260823095659-c1f5 | 8d54efc (08-23) | – | 1 docs(wta-1), 1931 Zeilen | – | ARBEIT |
| fleet-260823111940-b6a6 | b5109df (08-23) | – | 3 docs (GLM/Fable-Audits) | – | ARBEIT |
| fleet-260823111941-e426 | b6ddc5a (08-23) | – | 3 docs (GLM-Kausal/Peer-Review) | – | ARBEIT |
| fleet-260823111942-36d2 | 6b4b01a (08-23) | – | 0 | – | SAFER |
| fleet-260823124303-98b6 | 78c0f61 (08-23) | `.agents/`³ | 1 docs(worktrail-B B-2) | – | ARBEIT |
| fleet-260823124447-a0e9 | ec3bb33 (08-23) | `.agents/`³ | 7 (Rail)⁴ | – | ARBEIT⁴ |
| fleet-260823135537-a33a | ffdb3a4 (08-23) | `.agents/`³ | 1 docs(worktrail-III) | – | ARBEIT |
| fleet-260823144541-f753 | e03e782 (08-23) | `.agents/`³ | 8 (Rail)⁴ | – | ARBEIT⁴ |
| fleet-260823151620-c4cd | 8710eee (08-23) | – | 1 docs(Tower-Forensik) | – | ARBEIT |
| fleet-260823152120-d234 | f3c45d5 (08-23) | – | 0 | – | SAFER |
| fleet-260823152423-fb4e | 0bbd0aa (08-23) | – | 1 docs(audit) | – | ARBEIT |
| fleet-260823154740-7f2d | 2a1dd45 (08-23) | `.agents/`³ | 2 docs(studio) | – | ARBEIT |
| fleet-260823175022-e9f8 | 1654ba7 (08-23) | `.agents/`³ | 1 docs(ios) | – | ARBEIT |
| fleet-260824001124-93a6 | 6f75a8c (08-23) | – | 0 | – | SAFER |
| fleet-260824041324-e2ff | 072fcf3 (08-24) | – | 1 docs(authority-critic) | – | ARBEIT |
| fleet-260824041848-c6d8 | 6f75a8c (08-23) | – | 0 (Duplikat von 93a6) | – | SAFER |
| fleet-260824041850-18ea | 6f75a8c (08-23) | – | 0 (Duplikat von 93a6) | – | SAFER |
| fleet-260824065830-242a | 210fcd9 (08-24) | `.agents/`³ | 0 | – | SAFER |
| fleet-260824134950-4879 | b62f612 (08-24) | `.agents/`³ | 0 | – | SAFER |
| fleet-260824141942-1976 | 75daf22 (08-24) | `.agents/`³ | 0 | – | SAFER |
| fleet-260824154644-b066 | 75daf22 (08-24) | – | 0 | – | SAFER |
| fleet-260825115726-9790 | fe27764 (08-25) | 1 staged docs | 0 | **s8 live** | AKTIV |
| fleet-260825130027-0c11 | 0dc7a33 (08-25) | 1 staged docs | 0 | **s10 live** | AKTIV |
| fleet-260825134348-365b | f16b470 (08-25) | – | 0 | **s4 live** | AKTIV |
| fleet-260825134349-0d91 | f16b470 (08-25) | – | 0⁵ | **s13 live** (diese Lane) | AKTIV |
| glm-gamedev-harness-research | 6d73c0f (08-22) | – | 1 docs(gamedev) | – | ARBEIT |

¹ Konzept ist in heutigem main enthalten („Monitoring is event- or terminal-driven"), die exakte
Formulierung der Lane nicht — vermutlich abgelöst; zum Wegwerfen einmal querlesen.
² `git log main..HEAD` zeigt 1 Commit, aber `git cherry`: Patch ist in main gelandet (Reword/Squash).
³ `.agents/` ist untracked. Geprüft: alle 9 Kopien byte-identisch (13 Files, md5 über alle Files
gleich); Inhalt = main-getrackte `.claude/skills/` (graphify/kriterium-grill/mess-notiz/unslop,
SKILL.md md5-identisch) plus unveränderte Referenzdateien. Nichts Einmaliges — kein Verlust beim
Wegwerfen.
⁴ Die 7–8 Commits der Self-Land/Milestone-Rail sind inhaltlich **abgelöst**: Repo-Cap → `e730694`,
return-path → `d93ab4a`, abgeleitete Phase → `6a12838`, Self-Land-Tür → `3233ba7`, und der
Attempt-Cap wurde in main durch den Progress-Guard ersetzt (`FLEET_SELF_LAND_MAX_ATTEMPTS` kommt in
main nicht mehr vor). Die beiden e2e-Fixes der Lane zielen auf das alte Cap-Design. Zum Wegwerfen
nach kurzer Gegenprobe, formal aber unmerged.
⁵ Der eigene Report-Commit dieser Lane entsteht erst nach der Messung.

**Bilanz: 14 SAFER · 16 ARBEIT (davon 2 Rail-Lanes nachweislich abgelöst, 1 vermutlich abgelöst) ·
0 UNKLAR · 4 AKTIV.**

### Copy-Paste für den Owner — je SAFER-Zeile (einzeln oder gesammelt)

Hinweis: bei den 3 Zeilen mit `.agents/`-Duplikat (242a, 4879, 1976) verweigert
`git worktree remove` wegen des untracked Verzeichnisses → `--force` nötig (Inhalt ist
Duplikat, siehe ³). Vor dem Sammel-Lauf `tmux -L claudefleet list-panes -a` gegenprüfen, dass
kein neuer Slot in einem der Worktrees läuft.

```sh
cd /Users/owner/claude-fleet
# sauber (kein --force noetig):
git worktree remove ../claude-fleet.worktrees/fleet-260822142649-61ec && git branch -D fleet/260822142649-61ec
git worktree remove ../claude-fleet.worktrees/fleet-260823075928-af51 && git branch -D fleet/260823075928-af51
git worktree remove ../claude-fleet.worktrees/fleet-260823085611-1869 && git branch -D fleet/260823085611-1869
git worktree remove ../claude-fleet.worktrees/fleet-260823085612-7ea4 && git branch -D fleet/260823085612-7ea4
git worktree remove ../claude-fleet.worktrees/fleet-260823092612-470f && git branch -D fleet/260823092612-470f
git worktree remove ../claude-fleet.worktrees/fleet-260823111942-36d2 && git branch -D fleet/260823111942-36d2
git worktree remove ../claude-fleet.worktrees/fleet-260823152120-d234 && git branch -D fleet/260823152120-d234
git worktree remove ../claude-fleet.worktrees/fleet-260824001124-93a6 && git branch -D fleet/260824001124-93a6
git worktree remove ../claude-fleet.worktrees/fleet-260824041848-c6d8 && git branch -D fleet/260824041848-c6d8
git worktree remove ../claude-fleet.worktrees/fleet-260824041850-18ea && git branch -D fleet/260824041850-18ea
git worktree remove ../claude-fleet.worktrees/fleet-260824154644-b066 && git branch -D fleet/260824154644-b066
# mit .agents/-Duplikat (--force noetig):
git worktree remove --force ../claude-fleet.worktrees/fleet-260824065830-242a && git branch -D fleet/260824065830-242a
git worktree remove --force ../claude-fleet.worktrees/fleet-260824134950-4879 && git branch -D fleet/260824134950-4879
git worktree remove --force ../claude-fleet.worktrees/fleet-260824141942-1976 && git branch -D fleet/260824141942-1976
```

Für die ARBEIT-Zeilen gilt: Commits vorher sichten (`git log main..fleet/<id> --oneline`,
Diff via `git diff main...fleet/<id>`) und entscheiden — landen, cherry-picken oder verwerfen;
erst danach der gleiche remove/branch-Befehl wie oben.

## B. tmux-Sockets (`/private/tmp/tmux-501/`)

| Socket | Zustand | Detail (nur gelesen) |
|---|---|---|
| `claudefleet` | **live, Produktion** | Sessions u. a. s1–s13, atlas-serve, lerntisch; srv/MAIN in `/Users/owner/claude-fleet`. Niemals killen. |
| `fleettest9644` | **live, e2e läuft JETZT** | Server `bun server.ts` (PID 1125, Start 15:26), Slots s2–s5, s15/s16 mit Fake-Codex; gehört zu `fleet-e2e-instance-9644`. Kein Leak — erst prüfen, ob die Suite durch ist (`tmux -L fleettest9644 list-sessions`, `ps -p 1125`), dann entscheidet der Owner. |
| `pi-trust-probe-20260823` | **live, geleakt seit 08-23 02:35** | Session `probe`, darin `pi` (node, PID 8606, PPID 8605). Owner-Option: `tmux -L pi-trust-probe-20260823 kill-server` (oder erst PID 8606 sichten). |
| 10 tote Socket-Dateien | Server tot, Datei bleibt | `acp21probe`, `acp25c2`, `acp25claude`, `acp25codex`, `acp25pi`, `acp25q`, `acp26f`, `acp26m`, `pi-ox-realproof-20260823`, `slp3probe` (jeweils „no server running"). Owner-Option: die Dateien in `/private/tmp/tmux-501/` löschen. |

## C. TMPDIR-e2e-Scratch (`/var/folders/sj/.../T/`)

Gemessen: **789 MB** gesamt über die Fleet-Familien (Auftrag nannte 679 MB — wächst mit laufender
e2e, inkl. 29 MB der live benutzten `fleet-e2e-instance-9644`).

| Familie | Dirs | Größe |
|---|---|---|
| `fleet-e2e-instance-*` | 37 | 708 MB (davon `…-9644` 29 MB **live**) |
| `fleet-e2e-gate-*` + `-fakebin` | 15 + 7 | 16 MB + 1,5 MB |
| `fleet-e2e-unprobed-*` | 8 | 14 MB |
| `fleet-acceptance-probe-*` | 4 | 13 MB |
| `fleet-e2e-harness-*` | 7 | 12 MB |
| `fleet-lane-graph-*` | 227 | 9,7 MB |
| `fleet-e2e-cleanreview-*` | 8 | 0 B |
| `fleet-acpx1-*` | 3 | 0 B |

Owner-Option (erst nach Abgleich, dass keine e2e/Suite mehr läuft — Suites nehmen einen
gemeinsamen Mutex; ein Lauf darf nicht unterbrochen werden):

```sh
# Liveness zuerst:   ps aux | grep -E 'fleet-e2e|bun server.ts' | grep -v grep
#                    tmux -L claudefleet list-sessions; tmux -L fleettest9644 list-sessions
# dann z. B. alles AUSSER der live instance-9644:
# cd "$TMPDIR" && for d in fleet-e2e-instance-* fleet-e2e-gate-* fleet-e2e-gate-fakebin-* \
#   fleet-e2e-unprobed-* fleet-e2e-harness-* fleet-e2e-cleanreview-* fleet-lane-graph-* \
#   fleet-acceptance-probe-* fleet-acpx1-*; do [ "$d" = fleet-e2e-instance-9644 ] || rm -rf "$d"; done
```

## Offene Grenzen

- `origin/main` steht 1015 Commits hinter lokal (`c9e9af7`, 2026-08-21): vier Tage Arbeit ohne
  Remote-Sicherung. Owner-Entscheid, kein Hygiene-Akt dieser Lane.
- Haupt-Checkout `/Users/owner/claude-fleet` selbst trägt Untracked-Dateien (u. a. `BEFEHLE.md`,
  `GROK-*.md`, `.agents/`, `.codex/`) — außerhalb des Auftrags („Worktrees"), nur gemeldet.
- Messung ist ein Schnappschuss eines lebenden Systems: main, e2e und Slots schieben während des
  Lesens weiter; vor jeder Owner-Aktion die Liveness-Checks aus B/C wiederholen.
