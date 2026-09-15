---
frage: Was nimmt Fleet stillschweigend ueber das Repo einer Lane an, und was bekommt eine Lane in einem FREMDEN Projekt (nicht claude-fleet) tatsaechlich an Kontext, Regeln und Pruefschritten?
urteil: Fleet-Texte und ein Teil der Mechanik setzen claude-fleet voraus. Der Nachfolge-Brief behauptet fest „Kontext voll" und „Auftrag unveraendert" und traegt keine MAIN-Entscheidung (Treibstoff der K1-Schleife); das globale Codex-Regelwerk ist eine maschinell umgeschriebene Claude-Kopie (falsche Attribution, Claude-Befehle, tote Pfade); Fleet-Betriebszustand steht in Projektdateien; die Frage „ist das claude-fleet?" wird an mehreren Stellen einzeln beantwortet, und eine davon hat sie vergessen.
bereich: [harness, lane-kontext, fremdrepo, codex, nachfolge, verify]
belege: [streams/prompts.jsonl (Gruendungsprompt Zeile 449c4a03, K1-Lane Session 1 und 90), server.ts#buildLaneSuccessionBrief, server.ts#laneHandoffReportFor, server.ts#createWorktree, server.ts#laneLocalProof, server.ts#verifyPlanFor, server.ts#repoRunsShortChain, server.ts#verifyCmdFor, server.ts#auditCmdFor, verify-proportion.ts#localProofFor, watchdog.sh VERIFY_CMD/AUDIT_CMD, ~/.codex/AGENTS.md, private-repo-aa AGENTS.md und docs/plan/nachweise/K1.md]
nicht-gemessen: Gruendungsbrief der Private-repo-aa-MAIN selbst; ob Program-Kontext-Packs an Lanes in fremden Repos gehen; Programs Private-repo-j und Private-repo-j; vollstaendige Liste aller Repo-Annahmen (die Zaehlung in §3 ist eine Stichprobe).
stand: 2026-09-15
---

# Was eine Lane in einem fremden Repo von Fleet bekommt

Orchestratorin Slot 4, 2026-09-15, auf Owner-Frage: „ob wir die Briefe zu kurz formuliert und nicht
bedacht haben, dass nicht jedes Projekt das Repo des Harness selbst ist". Anlass: die Private-repo-aa-K1-Lane
(Repo private-repo-aa) lief 89 Nachfolgen lang (docs/messungen/2026-09-15-private-repo-aa-einlauf-gegen-kartenkette.md).

## 1. Was eine fremde Lane wirklich erhaelt (gelesen, nicht erschlossen)

- **Gruendung (Zeile 449c4a03):** der Brief woertlich, danach `LANE_EXIT_FOOTER`. Nichts davor, keine
  Kontext-Packs. Die Gruendung einer Karten-Lane (K1) setzt die Karte vor den Auftragstext.
- **Worktree:** `server.ts#createWorktree` kopiert gitignorte Geruestdateien aus dem REPO DER LANE, nicht
  aus claude-fleet. Eine fremde Lane bekommt also kein Fleet-Regelbuch — nur, was ihr Repo selbst traegt.
- **Codex laedt** das Projekt-`AGENTS.md` plus das globale `~/.codex/AGENTS.md`.

## 2. Befunde, nach Kosten

1. **Der Nachfolge-Brief sagt der Nachfolgerin Falsches.** `server.ts#buildLaneSuccessionBrief` schreibt
   fest „Deine Vorgängerin hat übergeben, weil ihr Kontext voll lief" und „Der Auftrag ist unverändert";
   uebergeben werden nur die Queue-Zeile im Wortlaut und ein `handoff`-Report
   (`server.ts#laneHandoffReportFor` filtert `status === "handoff"`). Eine Ablehnung der MAIN steht nie darin.
   Kosten: jede der 89 K1-Nachfolgerinnen las den abgelehnten Auftrag als gueltig und erklaerte ihn erneut fuer fertig.
2. **Das globale Codex-Regelwerk ist eine umgeschriebene Claude-Kopie.** `~/.codex/AGENTS.md` traegt
   `Co-Authored-By: Codex Opus 4.6 (1M context) <noreply@anthropic.com>` (in 28 der letzten 200
   Commit-Bodies auf private-repo-aa main, 26 der letzten 300 auf claude-fleet main), Claude-Befehle
   (`/handoff`, `/clear`, `/catchup`, „Auto-compaction at ~83%"), nicht existierende Pfade
   (`~/.Codex/knowledge`, `~/.Codex/commands/sharpen.md` — `ls` leer) und die Regel „Lektionen ins
   AGENTS.md des Projekts". Kosten: jede Codex-Session in jedem Projekt; falsche Attribution in der Historie.
3. **Fleet-Betriebszustand steht in Projektdateien.** private-repo-aa `AGENTS.md` nennt eine
   Orchestratorin-Slotnummer mit Deploy-SHA und `~/claude-fleet/task-waves.ts:58`; `K1.md` trug das
   Report-/succeed-Ritual. Mechanismus fuer das zweite erschlossen: Befund 2 („Lektionen ins
   Projekt-AGENTS.md"). Kosten: veraltet in Stunden, spaetere Sessions handeln danach.
4. **Der Lane-Footer ist fuer jeden Harness und jedes Repo gleich.** Er beschreibt `handoff` → `POST
   /api/self/succeed` auch einer Codex-Lane, die selbst kompaktiert, und Suite-Offer auch in Repos ohne Suiten.
5. **`/api/self/gate` empfiehlt fremden Repos die claude-fleet-Schritte.** `server.ts#laneLocalProof` ruft
   `verify-proportion.ts#localProofFor` ohne Repo-Frage; eine docs-only Lane in einem fremden Repo bekaeme
   `install, pins` empfohlen. Der Land-Gate hat die Sperre (`server.ts#verifyPlanFor` mit
   `repoRunsShortChain`, seit dem Private-repo-j-Fall), die Self-Route nicht. In Private-repo-aa-Rollouts kein Aufruf
   gefunden — latent. Verwandt: die Land-Notiz eines fremden Repos nennt `LOCAL_PROOF_STEPS` (Fleet-Namen),
   obwohl `bun run verify` lief.
6. **Kein Post-Land-Audit fuer private-repo-aa** (Audit-Kommando exit 42): jeder Land dort ist `audit=unknown`.
7. **Kurze Owner-Zeilen fuer fremde Repos lassen Pflichtwissen weg** — Beispiel Zeile 2fd387de
   (Private-repo-aa AT-Daten): keine ROLLE (ein Handstart fiele auf das Fleet-Default-Modell), keine
   Lektuereliste, keine Werkzeug-/Host-Fakten, keine Regel „kein succeed, Nachweise ohne Prozess-Text".
   Der ausfuehrliche Einlauf-Brief 449c4a03 hatte all das und lief sauber.

## 3. Die eigentliche Struktur: „was gilt fuer dieses Repo?" wird mehrfach beantwortet (Stichprobe)

| Frage | heutige Quelle |
|---|---|
| Verify-Kommando | `FLEET_VERIFY_CMD_REPOS` (.env, JSON) → `server.ts#verifyCmdFor` |
| Audit | `repoWorkers[].audit` (fleet.json) + env → `server.ts#auditCmdFor` |
| Lane-Deckel | `repoLaneCaps` (fleet.json) |
| „ist das claude-fleet?" | Sentinel `[ -f fleet-e2e.ts ]`, einzeln in watchdog.sh VERIFY_CMD, watchdog.sh AUDIT_CMD, `server.ts#VERIFY_PROPORTIONAL_CMD`, `server.ts#repoRunsShortChain` |
| Regelbuch | Existenz von `rulebook/` → `server.ts#laneRulebookFor` |

Befund 5 ist die Drift daraus: dieselbe Entscheidung an zwei Stellen, eine vergessen. Ein naheliegender
Schnitt ist eine Lesefunktion, die die vorhandenen Quellen buendelt (claude-fleet als normaler Eintrag, ein
Pin gegen direkte Sentinel-Pruefungen) — kein neues Konfigurationsformat. Vor dem Bau fehlt die
vollstaendige Inventur.

## 4. Mindestinhalt eines Briefs fuer ein fremdes Repo (bis die Mechanik es traegt)

Harness/Modell/Effort · Projekt-`AGENTS.md` als Regelrahmen · Verify woertlich · Lektuere mit Pfaden ·
Abhaengigkeit nur als `card.after` · Host-Fakten (Netz, fehlende Werkzeuge, Scratch-Ort) · ein kurzer
Fleet-Block: der Report ist der einzige Kanal, keine Nachfolge bei Codex, Nachweise enthalten Ergebnisse
und keine Handlungsanweisungen, kein Fleet-Zustand in Repo-Dateien.
