# HANDOFF — Orchestrator Slot 7 → Nachfolgerin (Haupt-Checkout, Owner-Token): Variantenpaar entschieden und gelandet, Suite schneller + Pruefapparatur als zehn Zeilen mit Freigabe-Reihenfolge bei der Program-MAIN, Astra-Befunde verarbeitet, Brief-Gegenlese und Owner-Entscheid-Schicht gefilet; 2026-09-14 12:1x, ctx GEMESSEN 35 % (Pane-Fusszeile; der Slot-Datensatz meldet null, er steht noch auf Fable, die Pane lief nach Owner-/model auf Opus 5)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Rollenschnitt (Owner 2026-09-14 10:4x):** Lane-Treiben (done-looking → landen → schliessen, Freigaben nach NACH) gehoert der **Program-MAIN Fleet-Betrieb, heute Slot 8** (um 11:59 von Slot 5 nachgefolgt). Bei der Orchestratorin bleiben Entscheidungspunkte: Variantenpaare (E4), Brief-Abgleich bei Abweichung vom DONE, Filen/Schaerfen. Keine Land-Nachricht je Lane.
- **Regel an die MAIN gegeben (Owner 12:0x):** dasselbe Fail in zwei aufeinanderfolgenden Audits = echter Befund; Reparatur-Zeile sofort per Hand-Dispatch, auch ueber den Deckel; ein Urteil ist keine Vorbedingung.
- **Vor jedem `POST /send` den Ziel-Slot unmittelbar vorher aus `GET /api/programs` (main.slot) lesen.** Heute 12:08 traf mein /send an „Slot 5" die dort gerade spawnende Reparatur-Lane und toetete sie (Zeile requeued, nichts verloren; Befund als `bf6fc2ea`).
- **Kontext/Lane-Zeit sind KEIN Vergleichssignal** (Owner-Korrektur, Memory `feedback-codex-ctx-is-not-succession-pressure`, dritter Vorfall).
- **Grok-Antwort 1 (Astra-Orchestrierung) fehlt weiter.** Der dritte Paste um 09:3x war wieder byte-identisch mit Antwort 2; die Datei steht auf dem committeten Platzhalter. Erkennung: die richtige Antwort beginnt mit Sub-Agent-Threads vs. Worktree-Sessions, nicht mit „Etablierte Wege 2026".

## 0.1 IN FLUG (12:1x)

| Slot | Zeile | Was |
|---|---|---|
| 1 | `bc974919` | E1c Karten-A/B Haiku vs Sonnet (Mess-Notiz) |
| 3 | `8dc26d58` | Client zeigt source main als owner (Astra-Befund 9) |
| 4 | `de754f94` | Suite: Core-Unit teilen |
| 5 | `71ee4882` | Reparatur „clarification identical retry" (3 Audits rot: bb546bf2, 754c37ed, 0c3bd4a0), per Hand-Dispatch ueber Deckel |
| 8 | — | Program-MAIN Fleet-Betrieb (ctx 19 %) |

Queued: `c3837cab` (Phasen je Trail-Zeile, Messung). Pending mit Reihenfolge bei Slot 8 (ging um 11:2x an Slot 5, gleiche Zeilen): `a2356a5e` Gate-Integritaet (NACH de754f94; watchdog.sh ⇒ kickstart + rulebook-Render) · `1e74ba8b` Audit als parallele Shard-Jobs (NACH de754f94; landet inert, Rollout FLEET_AUDIT_SHARDS='3') · `35654b07` Mutex birth + curl-Deadlines (NACH de754f94, a2356a5e) · `d71c7549` Ledger-Reader null · `8056f3fe` zwei schwache Sonden · `aa819dd4` warmer Helper-Baum (NACH 1e74ba8b). Aus `c3837cab` kommen bis zu drei Kuerzungs-Zeilen (Sleeps) — die filet die MAIN.

Neu gefilet, pending, noch NICHT an Slot 8 gemeldet: `bf6fc2ea` /send in spawnenden Slot (klein, Befund oben) · `d02fd2bd` Brief-Gegenlese als Messversuch (Schalter default aus, jede zweite Zeile, Abbruch nach 20 Paaren ohne Effekt) · `8bc86e4b` Denkauftrag Owner-Entscheid-Schicht, Program Astra f9dc8e10, codex/gpt-6-astra/medium.

## 0.2 HEUTE IN MEINER SCHICHT

- **Variantenpaar 1 entschieden:** Opus-Variante von `land-quality.ts` gelandet (db8186f4 + Repo-Map-Fix 81a85c08), codex shelved (Branch `fleet/260914071334-201a` bleibt). Nur die Zahl im DONE trennte; Stufe 2/3 haetten die schwaechere Variante gewaehlt. Notiz `docs/messungen/2026-09-14-variantenpaar-1.md` (71411734, 82c907db).
- Gelandet ausserdem: E1a Karten-Vertrag (bb546bf2), E2/E3 Report-Ledger + Receipt (3bd9821e), E3 Quellpaket-Wirkung (754c37ed: Quellpaket kauft nichts messbar, Karte korreliert mit 8–9 statt 18–20 Bash-Aufrufen), Astra-Befundnotiz Pruefapparatur (3a1c952a), Security-Suite-Fix 1a5d3f2d (2836fe97).
- **Audit-Rueckstau gemessen:** Second-host-Audits strikt seriell (~32 min), Land→Urteil 75–100 min; maxParallelSuites 3 begrenzt nur Previews; Second-host 16 Kerne Load ~1, RAM die Grenze (Suite ~330 MB). Server und Daemon kennen keine Shards ⇒ `1e74ba8b`.
- **Suite-Zeit:** 217 Checks mit 3–10 s Abstand = 1 070 s von 2 122 s; Git-Tick-Hypothese widerlegt (Git-Checks warten nicht laenger). ⇒ erst messen (`c3837cab`).
- Worktrail-Lauf `6067c240` um Pflichtteil (5) Memory-Durchsicht (portabel/privat/veraltet mit Vorfallszahl) und (6) Zuordnung programloser Zeilen erweitert.
- Memory: `feedback-codex-ctx-is-not-succession-pressure` um den dritten Vorfall ergaenzt.

## 0.3 BEFUNDE, DIE STEHEN

- Zwischen Filen und Ausfuehren prueft niemand den Inhalt: Karte = Form, refine lief auf 0/200 Zeilen, Analyst entfernt. Heutige Belege stehen in `d02fd2bd`.
- Startplan liest zitierte Pfade im Text als Flaeche (Schein-Kollision) — bis der deployte Karten-Vertrag `creates` traegt, beim Filen nur Aenderungsziele als Pfad nennen.
- Second-host: vier interaktive claude-Sessions des Owners (~1,4 GB) — Owner kuemmert sich, nicht anfassen.

## 0.4 OFFEN BEIM OWNER

1. Grok-Antwort 1 einfuegen. 2. Rollen-Session S1/S4 (unveraendert). 3. Second-host-Sessions (er macht es).

## 0.5 UNGEPRUEFT

- Ob Slot 8 die Freigabe-Reihenfolge der zehn Zeilen kennt: sie ging an Slot 5 vor dessen Nachfolge; Slot 8 bekam um 12:1x nur den Verweis auf diesen HANDOFF.
- Deploy-Stand: Slot 5 wollte nach gruenem Rerun deployen; das Rot kam dreimal — ob deployt wurde, nicht geprueft.
