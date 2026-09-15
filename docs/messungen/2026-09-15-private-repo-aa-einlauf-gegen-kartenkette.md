---
frage: Liefert derselbe Private-repo-aa-Schritt (K1-Laenderfix + K3) als EIN Astra-Auftrag mit Sub-Agents mehr als die Program-/Karten-Kette, die ihn vorher trug?
urteil: Ja, in diesem einen Fall deutlich — 31,5 min, eine Session, ~5 Codex-Punkte, gelandet mit gruenem Land-Gate und zwei benannten AT-Luecken, gegen ~4,2 h, 89+8 Nachfolgen und 0 Lands auf dem Karten-Weg. n=1 und der Einlauf baute auf K1-Code und der MAIN-Ablehnung auf, die die Kette erzeugt hatte.
bereich: [orchestrierung, queue, programme, codex, sub-agents]
belege: [audit.jsonl (task_dispatch 449c4a03, lane_succession Slot 7/13, fleet_report_open), lane-outcomes.jsonl (Branch fleet/260915193807-1010, sessionMs), git notes --ref=fleet/land show 343e6a4 im Repo private-repo-aa, fleet-report 731c8301, docs/plan/nachweise/K3.md (used_percent vorher/nachher), bun codex-quota.ts]
nicht-gemessen: isolierter Kontingentverbrauch je Session (das Wochenfenster ist geteilt); Qualitaet des Codes jenseits von bun run verify (kein Post-Land-Audit fuer dieses Repo, exit 42); ob ein zweiter Einlauf ohne Vorarbeit gleich gut waere.
stand: 2026-09-15
---

# Private-repo-aa: ein Einlauf gegen die Kartenkette

Orchestratorin Slot 4, 2026-09-15. Anlass: der Owner sah in die Private-repo-aa-Session und vermutete
einen Fehler; die K1-Lane lief in einer Nachfolge-Schleife. Der Owner fragte danach, ob Workflows
ueberhaupt noch tragen, und gab den Versuch frei: denselben Schritt als einen gut gebrieften
Astra-Auftrag, spaeter ergaenzt um „Astra koordiniert Sol/Terra-Agenten".

## 1. Die beiden Wege

| | Karten-Kette (Program 247a3746) | Einlauf (Zeile 449c4a03) |
|---|---|---|
| Form | MAIN (Astra medium) + Karte K1 → Karte K3 (`after`), Lanes Astra high | eine Owner-Zeile, Astra xhigh, Sub-Agents 2× gpt-5.6-terra (schreibend, disjunkte Dateien) + 1× gpt-5.6-sol (lesend) |
| Zeitraum | K1-Branch fleet/260915151443-70a2 offen 17:14 → Stopp 21:26 (~4,2 h); dazu ein frueherer K1-Branch vom 14.09. | Dispatch 21:38:07 → Report 22:09:34 (sessionMs 1 893 262) |
| Sessions | K1: 89 Nachfolgen, 89 Reports; K3: 8 Nachfolgen | 1 |
| Ergebnis | K1 von der MAIN abgelehnt (P1 Laenderbindung); K3 nie begonnen, wartete auf K1 | 7 Commits, 17 Dateien, +1 606 Zeilen; Laenderfix + K3 DE/ICON-D2 |
| Land | 0 | gelandet `343e6a4`, Land-Gate `bun install --frozen-lockfile; bun run verify` ok:true |
| Codex-Kontingent | 0 → 14 % zwischen Reset (~20:3x) und Stopp (21:3x), ueberwiegend die Schleife (erschlossen, nicht isoliert) | 15 → 20 % laut eigenem Rollout (K3.md), Wochenfenster geteilt |

## 2. Warum die Kette scheiterte (Mechanik, belegt)

- `docs/plan/nachweise/K1.md` (private-repo-aa) schrieb in jedem Session-Abschnitt „… Fleet-Report und
  `/api/self/succeed`"; jede Nachfolgerin las die Datei als Pflichtlektuere und wiederholte das Ritual.
  `server.ts#succeedLane` nahm jede Nachfolge ohne handoff-Report und ohne Deckel an (Zeile 3f79ff74).
- Die Ablehnung der MAIN erreichte die Lane nie: Zustellung nur bei idle Pane (GLM-Pruefung
  2026-09-16-buendelung-systempruefung-glm.md B2: 134 unzustellbar gegen 33 zugestellt in 14 d).
- K3 wartete ueber `after` auf einen K1-Land, der nicht kommen konnte, und verifizierte in 8 Sessions
  nur die Basis.

## 3. Was den Einlauf trug

- Ein Brief mit Codebasis (nur die zwei K1-Code-Commits), dem Laenderfix als pruefbarem Satz, K3-DONE
  woertlich, Verbot von succeed und von Prozess-Text in Repo-Dateien, genau einem Report.
- Die Luecken wurden benannt statt geglaettet: AT-Stundenanalyse (Intervalllage, Referenzzeit) und
  INCA-Nowcast (Akkumulationsgrenzen) dekodiert, aber gesperrt; Report `needs-main`.
- Eine Brief-Ergaenzung mitten im Lauf (Sub-Agents schreibend) wurde angenommen, ohne Neustart.

## 4. Grenzen dieses Vergleichs

- n=1. Der Einlauf stand auf der Vorarbeit der Kette: K1-Vertragscode (`cf2903a`, `7b13a86`) und die
  MAIN-Pruefung, die den Laenderfix erst praezise machte. Ein Einlauf ohne diese Vorarbeit ist nicht gemessen.
- Modellstufe verschieden (xhigh gegen high) — der Effekt der Stufe ist nicht vom Effekt der Form getrennt.
- Kein Post-Land-Audit fuer private-repo-aa (Audit-Kommando exit 42); der Beleg ist das Land-Gate.
- Korrektur an mir selbst: dem Owner nannte ich die Kettendauer zunaechst „~6,5 h" — der Branchname
  traegt UTC, die Dauer auf diesem Branch ist ~4,2 h.

## 5. Folgen

- Offene AT-Luecken als Private-repo-aa-Folgezeile, nicht in diesen Lauf nachgeschoben.
- Die Bauform „ein Auftrag, Astra koordiniert Sol/Terra" ist der naechste Default fuer grosse Schritte;
  die Kette bleibt nur, wo `card.after` auf eine lebende Zeile zeigt (GLM-Pruefung, kleinstes Modell).
