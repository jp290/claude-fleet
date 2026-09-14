# HANDOFF — Orchestrator Slot 5 → Nachfolgerin (Opus 5 high, Haupt-Checkout, Owner-Token): Spiele-Spur neu (Spiel komplett neu, Second-host), G1 vorgezogen, Wissens-System/RAG recherchiert (nichts bauen), C4/C6 gefilet; 2026-09-13 ~23:1x, ctx GEMESSEN 29,7 %

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Brief bleibt `docs/plan-fleet-betrieb-2026-09-13.md`** (§2a Reihenfolge, §5b, §5d Spiele-Spur mit Stand 23:0x, §6 Lease-Locks unter der Linie). Rolle: filen/schaerfen/freigeben. **Die Program-MAIN Fleet-Betrieb ist jetzt SLOT 7** (gebunden 23:02, `GET /api/programs` gemessen 23:1x; Slot 9 ist leer) — sie landet/deployt, ihre Pflichten (a)–(g) stehen im Abschnitt darunter; wo Plan/Zeilen „Slot 9" sagen, ist Slot 7 gemeint.
- **Owner-Prioritaet jetzt, woertlich 22:4x:** „einiges an Last vom MacBook runternehmen und aufs Second-host auslagern und dann wiederum das Biber-Game entwickeln und die iOS-App". Owner 23:0x: **das Spiel komplett neu** (neues Repo auf dem Second-host, Stack offen, private-repo-j hoechstens Steinbruch).
- **Commit-Regel, heute bezahlt:** vor jedem Direkt-Commit `merges` in fleet.json lesen und bei `running`/`interrupted` NICHT committen — mein `9b8b52b7` landete unter dem Land von Slot 4 (`waitRounds 1`, Gate 56,6 min, davon 54 Warten). Mein `&&`-Sensor hat das Land gezeigt, aber nicht gestoppt.
- **Hintergrund-Waechter sterben mit mir.** Neu aufsetzen: Statuswechsel von `1aaf7eb8`, `d7b4b47d`, `31df1009`, `a5878da7`, `35bc6afe` (60-s-Takt).

## 0.1 IN FLUG (gemessen ~23:1x, Deckel 3 voll)

| Zeile | Slot | Stand | Danach |
|---|---|---|---|
| `1aaf7eb8` C1 Second-host-Scratch | 1 | wartet auf Vorschau/Audit | Slot 9: daemon-update, /tmp waechst nicht; dann C5 denkbar |
| `d7b4b47d` Sharding-Probe (Fable) | 3 | laeuft | — |
| `31df1009` graphify 2/2 | 4 | **Land lief 23:04** | — |
| `a5878da7` **G1** Grok-Prompts Spiele (Astra medium) | — | queued, bewusst VOR `35bc6afe` | Owner fragt Grok (G2) |
| `35bc6afe` Karte anreichern | — | **pending gehalten**; ein Waechter (stirbt mit mir!) requeued sie, sobald G1 `sent` ist — sonst von Hand `POST /api/tasks/35bc6afe/queue` | danach `6d841a14` allein |

## 0.2 HEUTE IN MEINER SCHICHT

- Commits: `ca511009` (Altbestand nachgemessen, C4/C6 im Plan) · `9b8b52b7` (Lease-Locks §6) · `53ebf96b` (Spiele-Spur neu, Headless-Probe).
- Gefilet pending: `81030f46` C4 Bytebudget Transkript-Leser · `f38d8e15` C6 state.sh-Hygiene (nach `7363b89f`) — beide Karte gueltig. Freigegeben: `d7b4b47d`, `35bc6afe`+`31df1009` (35bc6afe danach zurueckgehalten, s. o.).
- Notizen: `3ecfd6d3` Lease-Locks (Astra/Solo; ersetzt archiviertes `cd192acd` mit falscher Aussage: eine Kollisionspruefung beim Start gibt es seit 2026-09-10 NICHT) · `17b67cf8` Wissens-System (Grok + Abgleich) · `922b37c7` RAG: nichts bauen.
- Gemessen: Second-host /tmp 37 % nach Slot-7-Loeschung · Headless-Chromium Second-host: Canvas 2D ok, WebGL2 nur SwiftShader · Lane spawn→land p50 ~1 h, p90 ~5,5 h (Branch-Zeit UTC).

## 0.3 BEFUNDE, DIE STEHEN

- **Claude Code laedt AGENTS.md nicht** (Haiku-Sonde mit Kontrolle in private-repo-j: CLAUDE.md-Fakt gewusst, AGENTS.md-Fakt nicht; private-repo-i NONE). 11 von 13 Verify-Repos haben nur AGENTS.md ⇒ Claude-Sessions dort ohne Projektvertrag, sofern kein Brief ihn nachreicht (ungeprueft).
- `~/.codex/AGENTS.md` = sed-Kopie der globalen CLAUDE.md mit totem Pfad `~/.Codex/knowledge/`. `~/.claude/knowledge` letzter Commit 2026-08-05. Home-Memory 390 Dateien, ruhend seit 2026-08-03.
- Second-host-Fleet-Instanz: 4 Slots (Bewerbungskampagne, scrollFix), 0 offene Tasks, `FLEET_LANDS='0'`, Last 0,05; Owner-Entscheid 2026-09-11 (`39857582`): Second-host alles ausser iOS, zwei Listen.
- Biber-Program `9ce08219`: letzter private-repo-j-Commit 2026-09-04, 17 offene Zeilen (viele an tote Controller). G4 archiviert die alten Biber-Zeilen, Mandat `a33d7300` nur Ideen-Eingang.

## 0.4 OFFENE OWNER-FRAGEN

1. **Schritt 1 Wissens-System:** in 12 Repos CLAUDE.md mit `@AGENTS.md` anlegen (empfohlen ja). Schritte 2 (eine globale Datei, toter Pfad weg, Home-Memory ins attic) und 3 (= Synthese-Schnitt 1) darf ich ohne Rueckfrage — noch NICHT begonnen.
2. **Welche Mac-Sessions schliessen:** 6 (ohne Label), 14 storage, 15 usage, 16 private-repo-aa (85 % ctx), 11 Astra Worktrail, 2 Supervisor — nicht selbst geoeffnet, also kein Kill ohne Owner.
3. Fuenf Synthese-Fragen (gaten G3) · UI §5c — unveraendert. **Browser-MCP ist KEINE Owner-Frage mehr:** Astras C2 aendert nur die Startzeile neuer Lanes, keine globale Einstellung — gefilet als `b4477db3` (pending, Opus 5 high; ~200 MB je Claude-Lane, ~170 je Codex; nur 3/193 Lanes nutzten Playwright in 14 d). Beruehrt server.ts#agentCmd — nach `6d841a14` oder parallel nur, wenn Flaechen disjunkt bleiben.

## 0.5 UNGEPRUEFT

- Die in Grok-Runde 2 neu genannten Studien (2605.15184 u. a.); geprueft nur 2602.11988 und 2606.09090.
- Verdikt des Lands von `31df1009`: lief beim Commit dieser Uebergabe (23:2x) noch und wartete hinter einem `e2e-isolated.sh` auf den Mutex. Dieser Commit wurde BEWUSST darunter gesetzt (Wiederholungsrunde ~Gate-Arbeit p50 105 s gegen ~40 min Warten) — `waitRounds` in `git notes --ref=fleet/land show <landSha>` zeigt den Preis.
- Alle zitierten Shas `git merge-base --is-ancestor … main` geprueft ok; alle genannten Queue-Zeilen und Kartenstaende 23:1x nachgeschlagen.

