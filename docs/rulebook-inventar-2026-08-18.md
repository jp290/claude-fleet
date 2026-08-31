# Regelbuch-Inventar `CLAUDE.md` — Schritt 1 der Kontextlast-Kette

> Datierter Schnappschuss (2026-08-18): Zeilenverweise zeigen auf den Baum dieses Datums.

**Status:** Inventur, read-only. Nichts ist umgezogen; dieses Dokument schreibt auf, was wohin
gehörte. Der Schnitt selbst ist Schritt 2 und passiert im Haupt-Checkout (`CLAUDE.md` ist gitignored
— eine Lane kann ihre Kopie nicht landen).

**Messgrundlage:** `/Users/owner/claude-fleet/CLAUDE.md` (Haupt-Checkout, NICHT der
Lane-Snapshot), vor Beginn geprüft: `wc -l -c` = **1154 Zeilen / 109675 B** — deckungsgleich mit
`docs/kontextlast-2026-08-18.md`. `rg` ist auf dieser Datei blind (gitignored); gelesen und gemessen
wurde mit `grep`/`sed`/`awk`.

**Faktenbasis:** `docs/kontextlast-2026-08-18.md` (vollständig gelesen; Messungen nicht wiederholt,
Abschnitts-Summen unten als Kreuzprobe reproduziert).

## Angewandte Entscheide (getroffen vom Supervisor, hier nur angewandt)

- **Entscheid A — Startwissen:** was eine Session in den ersten fünf Minuten braucht, um nichts
  kaputtzumachen und sich zu orientieren: die Invarianten (unumkehrbar oder geteilte Realität), die
  Lane-Disziplin im Kern, das Erdungs-Ritual, der Zeiger-Index auf alles Übrige. Alles andere ist
  Nachschlagewissen und gehört nach `docs/`. Konkret: **`## Lane discipline` (Z. 257–540) und
  `## Einstieg für eine frische MAIN-Session` (Z. 30–256) bleiben in dieser Runde GANZ** — wo darin
  Messbelege stecken, ist das in der Spalte Begründung vermerkt; es ist eine spätere Runde.
- **Entscheid B — Schnittlinie:** Kandidaten 1–3 aus §5 gelten, **Kandidat 4 nicht**. Blöcke, die nur
  unter K4 fielen („hier stand X"-Umschreibung), bekommen BETRIEB. Die Korrektur-neben-dem-korrigierten-
  Satz-Bauform bleibt unangetastet.

**Verdikt-Vokabular (genau drei Werte):** **BETRIEB** = bleibt in `CLAUDE.md` · **BELEG** = Messung/
Begründung hinter einer heute gültigen Regel, zieht nach `docs/…`, die Regel behält einen Zeiger ·
**TOT** = Zustand existiert nicht mehr, keine heutige Regel hängt daran, wird eine Zeile im Attic.

**Zielorte:** `docs/attic/harness-zaun-messungen.md` · `docs/attic/entfernte-flaechen.md` ·
`docs/harness-adapter.md` (Nachschlage-Teil von `## Deploy`, vorgesehen in §5) · `docs/verify-tiering.md`
(bestehend; Sonden-/Beweis-Regeln der Testfläche — thematisch passender als der Adapter-Zielort) ·
`docs/queue-analyst.md` (bestehendes Vertrag-Dokument der Queue-Automation; trägt bereits §5a
Brief-Kompiler — der Dispatcher-Block ist dieselbe Fläche) · **`docs/self-api.md` (neu, benannt und
begründet):** die Self-API-Referenz (autos/watch/succeed: Feldformen, Deckel, Ablehnungen,
curl-Beispiele) ist reine Nachschlage-Fläche; kein bestehendes Dokument deckt sie, und sie auf drei
fremdfokussierte Dateien zu verteilen wäre schlechter auffindbar als ein Ort.

## Die Gefahrenklasse innerhalb von `## Deploy`

Der Abschnitt wird INNEN getrennt, nicht als Ganzes bewegt. BETRIEB trotz Referenz-Lage (je Zeile im
Supervisor-Brief benannt): **674–678** (Watchdog-Änderungen brauchen `launchctl kickstart`) ·
**694–701** (`127.0.0.1:8790` antwortet nie / `bundleStale` auf dem Owner-Poll) · **702–707**
(strittig; `verify.ok:null` = skipped auto-landet nie — dieselbe Dreiwertig-Klasse wie Z. 912) ·
**901–916** (kickstart bleibt nötig; `ok:null` ist NIE ein Pass; 409 bei laufendem Post-Land-Audit) ·
**1132–1137** (ungequotete `[1m]`-Modellnamen töten jede neue Session beim Spawn; tsc-blind).

## Blocktabelle — jede Zeile 1–1154 genau einmal

| # | Zeilen | B | Abschnitt | Kurztitel | Verdikt | Zielort | Begründung |
|---|---|---:|---|---|---|---|---|
| 1 | 1-2 | 16 | Präambel+Loader | Titel | BETRIEB | CLAUDE.md | Dateiidentität; gehört zur Datei. |
| 2 | 3-4 | 47 | Präambel+Loader | Loader-Vertrag (Überschrift) | BETRIEB | CLAUDE.md | Führt den Ladevorgang; Vertrag dieser Datei. |
| 3 | 5-7 | 245 | Präambel+Loader | Lies zuerst AGENTS.md | BETRIEB | CLAUDE.md | Loader-Kern: AGENTS.md zuerst, diese Datei ist das Overlay (Entscheid A: der Zeiger-Index beginnt hier). |
| 4 | 8-10 | 252 | Präambel+Loader | propose/promote | BETRIEB | CLAUDE.md | Normierungs-Invariante: Worker schlägt vor, nur Owner befördert. |
| 5 | 11-14 | 222 | Präambel+Loader | Widerspruch stoppt | BETRIEB | CLAUDE.md | Harte Invariante (geteilte Realität); Doc-vs-Code gilt der Code. |
| 6 | 15-19 | 354 | Präambel+Loader | Repo-Identität Owner-Tool | BETRIEB | CLAUDE.md | Orientierungsrahmen Minute eins: Owner-Tool auf eigener Maschine. |
| 7 | 20-22 | 268 | Präambel+Loader | Fable-5-Phrasierung | BETRIEB | CLAUDE.md | False-Flag-Abwehr; Nichtlesen kostet Turns in genau diesem Repo (3x passiert). |
| 8 | 23-25 | 165 | Präambel+Loader | Safeguard-Retry | BETRIEB | CLAUDE.md | Retry-Rezept fuer abgetoetete Turns; kleine Live-Betriebsgefahr. |
| 9 | 26-29 | 252 | Präambel+Loader | launchd-PATH-Exporte | BELEG | docs/harness-adapter.md | Watchdog-Spawn-Umgebung; gebraucht nur beim Debuggen von Spawn-Symptomen, nicht zur Orientierung. |
| 10 | 30-31 | 89 | Einstieg | Einstieg (Überschrift) | BETRIEB | CLAUDE.md | Abschnitt bleibt per Entscheid A ganz. |
| 11 | 32-41 | 1045 | Einstieg | Erdungs-Ritual | BETRIEB | CLAUDE.md | state.sh/register.sh/handoff/queue — der Kern von Entscheid A. |
| 12 | 42-52 | 982 | Einstieg | Idle≠fertig (4 Zustaende) | BETRIEB | CLAUDE.md | Fehllesen kostet fertige Arbeit; immer Pane lesen. |
| 13 | 53-94 | 4200 | Einstieg | Erdung=Schnappschuss, Watch | BETRIEB | CLAUDE.md | Watch-Prinzip ist Kern; enthaelt BELEG (Messgeschichten Z. 82–94) — spaetere Runde, nicht diese. |
| 14 | 95-112 | 1757 | Einstieg | Land-Takt | BETRIEB | CLAUDE.md | Seriell ja, Wartepflicht nein; enthaelt BELEG (covers-Histogramm) — vermerkt, spaetere Runde. |
| 15 | 113-124 | 1221 | Einstieg | checkout-- zerstoert Lane-Arbeit | BETRIEB | CLAUDE.md | Unumkehrbare Zerstoerung fremder Arbeit im Worktree. |
| 16 | 125-133 | 874 | Einstieg | Direkt-Commit unsichtbar | BETRIEB | CLAUDE.md | Verhindert falsch-aber-korrekte Ledger-Schluesse; Audit von Hand fahren. |
| 17 | 134-172 | 3678 | Einstieg | Kontext-Schwelle 44 % | BETRIEB | CLAUDE.md | Kern der MAIN-Session-Steuerung; Fuellstand messen, nicht schaetzen. |
| 18 | 173-177 | 364 | Einstieg | Beerdigtes | BETRIEB | CLAUDE.md | Beerdigtes nicht wieder aufmachen; Liste mit Belegzeiger. |
| 19 | 178-183 | 517 | Einstieg | clarify-first-Vorgabe | BETRIEB | CLAUDE.md | Kein Dispatch ohne hartes Done-Kriterium. |
| 20 | 184-219 | 3308 | Einstieg | GPT-Fenster 258 400 | BETRIEB | CLAUDE.md | Brief-Checkliste fuer fremde Modelle; Abschnitt bleibt ganz. |
| 21 | 220-252 | 3198 | Einstieg | Fremdes Modell: dichter Brief | BETRIEB | CLAUDE.md | Brief-Regeln aktuell; enthaelt BELEG (Adapter-Historie (1)/(2)) — vermerkt, spaetere Runde. |
| 22 | 253-254 | 1027 | Einstieg | Codex-Boot-Race (geschlossen) | BETRIEB | CLAUDE.md | Readiness-Mechanik aktuell (codex.automatable=true per Pin an der Naht). |
| 23 | 255-256 | 640 | Einstieg | Codex-TUI-Ansicht | BETRIEB | CLAUDE.md | Bedienungswissen fuer den Umgang mit codex-Panes (verrutschte Ansicht). |
| 24 | 257-258 | 94 | Lane discipline | Lane discipline (Überschrift) | BETRIEB | CLAUDE.md | Abschnitt bleibt per Entscheid A ganz. |
| 25 | 259-267 | 679 | Lane discipline | Proportionale Verifikation | BETRIEB | CLAUDE.md | Gate-Einstieg jeder Lane (localProof). |
| 26 | 268-269 | 200 | Lane discipline | Done-Kriterium vorab | BETRIEB | CLAUDE.md | Kern-Disziplin: Kriterium + Befehl vor dem Start. |
| 27 | 270-272 | 233 | Lane discipline | review-sweep | BETRIEB | CLAUDE.md | Mechanische Review-Haelfte; Sensor-Nutzung. |
| 28 | 273-296 | 1923 | Lane discipline | Verify-Kette = Land-Gate | BETRIEB | CLAUDE.md | Die Kette selbst; enthaelt BELEG (Gate-Angleichung 2026-08-15) — vermerkt, spaetere Runde. |
| 29 | 297-324 | 2832 | Lane discipline | e2e-isolated = Tier-2 | BETRIEB | CLAUDE.md | Vorschau-Pflichtregel mit richtigem Ausloeser; enthaelt BELEG (8e154dd-Geschichte) — vermerkt. |
| 30 | 325-326 | 158 | Lane discipline | Landable halten | BETRIEB | CLAUDE.md | Committen, keine untracked files — Land-Blocker. |
| 31 | 327-334 | 833 | Lane discipline | Drift-Check | BETRIEB | CLAUDE.md | Ritual vor jedem Done-Report; wouldConflict-Semantik. |
| 32 | 335-345 | 1148 | Lane discipline | Gate abfragbar | BETRIEB | CLAUDE.md | Live-Gate-Felder; zwei Budgets; rulebookDrifted nie "kein Drift". |
| 33 | 346-352 | 712 | Lane discipline | CLARIFY-Lane | BETRIEB | CLAUDE.md | Vertrag der Clarify-Lane: vorschlagen und stoppen. |
| 34 | 353-354 | 191 | Lane discipline | Nur die Scheibe | BETRIEB | CLAUDE.md | Berichts-Disziplin; still erden. |
| 35 | 355-355 | 93 | Lane discipline | 5x-Schleife strukturell | BETRIEB | CLAUDE.md | Stoppen statt neu wuerfeln. |
| 36 | 356-362 | 705 | Lane discipline | Fail ist deiner | BETRIEB | CLAUDE.md | Beweisreihenfolge: gleicher Baum zuerst; Transcript in den Report. |
| 37 | 363-374 | 1212 | Lane discipline | Sonde vor Code | BETRIEB | CLAUDE.md | Erster Verdaechtiger an frischer Arbeit; Signatur lesen; Sonde scheitert als SIE SELBST. |
| 38 | 375-388 | 1507 | Lane discipline | Flake-Familien | BETRIEB | CLAUDE.md | Register mit Zeigern nach verify-tiering; kein Freifahrtschein. |
| 39 | 389-394 | 649 | Lane discipline | Suite-Mutex | BETRIEB | CLAUDE.md | existiert≠gehalten; PID-lose Lock-Dir = Park-Halt. |
| 40 | 395-396 | 181 | Lane discipline | Owner-Wortlaut | BETRIEB | CLAUDE.md | Vorgabe wortlich zitieren, Rangliste dort abschneiden. |
| 41 | 397-413 | 1768 | Lane discipline | concurrency-safe≠lastsicher | BETRIEB | CLAUDE.md | Beweis MUSS seriell laufen; nichts neben dem Audit belegen. |
| 42 | 414-427 | 1497 | Lane discipline | claude-gate 3 Phasen | BETRIEB | CLAUDE.md | Phasenstruktur; enthaelt BELEG (Port-Warteschleifen-Messung 2026-08-09) — vermerkt. |
| 43 | 428-442 | 1577 | Lane discipline | Runner only | BETRIEB | CLAUDE.md | Wo ein Check hingehoert; Stage-Fold; keine Hand-Kopierlisten. |
| 44 | 443-448 | 592 | Lane discipline | CLAUDE.md gitignored | BETRIEB | CLAUDE.md | Spawn-Snapshot; Aenderungen als Text melden — Grundregel dieses Auftrags. |
| 45 | 449-449 | 99 | Lane discipline | HANDOFF=claims | BETRIEB | CLAUDE.md | Zahlen/Wege/Staende nachschlagen vor dem Bauen. |
| 46 | 450-468 | 1991 | Lane discipline | rg blind, ast-grep | BETRIEB | CLAUDE.md | rg -uu fuer alles Operative; ast-grep-Ebene; Werkzeug-Regel dieses Repos. |
| 47 | 469-474 | 580 | Lane discipline | state.sh-Ableitung | BETRIEB | CLAUDE.md | Zustand ableiten, nicht aufschreiben; HANDOFF traegt nur den Rest. |
| 48 | 475-479 | 423 | Lane discipline | Commit-Bodies | BETRIEB | CLAUDE.md | Bodies sind das Befund-Register, nicht die Subjects. |
| 49 | 480-486 | 749 | Lane discipline | docs aus main: | BETRIEB | CLAUDE.md | Spawn-Snapshot des docs-Regals; git show main: ist immer aktuell. |
| 50 | 487-489 | 228 | Lane discipline | Wissenspflege | BETRIEB | CLAUDE.md | Claims/Zeilenrefs in derselben Lane mitziehen. |
| 51 | 490-496 | 659 | Lane discipline | Doc-Kollision | BETRIEB | CLAUDE.md | Uncommittete Analyse im Haupt-Checkout ist fuer Lanes unsichtbar. |
| 52 | 497-499 | 305 | Lane discipline | Steward-Konvention | BETRIEB | CLAUDE.md | Steward nie im Haupt-Checkout (fleet.json/Token). |
| 53 | 500-508 | 904 | Lane discipline | Demo extern | BETRIEB | CLAUDE.md | Demo baut gegen Nachbar-Checkout; kein Gate hier sagt den Bruch. |
| 54 | 509-510 | 185 | Lane discipline | Lane-Edits/Live-Server | BETRIEB | CLAUDE.md | Edits wirken erst nach Land + Restart; build vor Client-Deploy. |
| 55 | 511-519 | 830 | Lane discipline | NIE bun server.ts default | BETRIEB | CLAUDE.md | Live-Adoption-Invariante (Entscheid A nennt sie explizit); Scratch-Muster. |
| 56 | 520-522 | 308 | Lane discipline | pkill trifft Live-Server | BETRIEB | CLAUDE.md | Namensmuster trifft den Live-Server; nur Socket/PID. |
| 57 | 523-530 | 792 | Lane discipline | pkill trifft Audit | BETRIEB | CLAUDE.md | Muster-Kill nimmt den Post-Land-Audit mit (rotes Nichts); nur notierte PID. |
| 58 | 531-537 | 684 | Lane discipline | kill PID reicht nicht | BETRIEB | CLAUDE.md | Runner laeuft weiter (ppid 1); tmux-srv mitkillen; verschränkte Logs. |
| 59 | 538-540 | 217 | Lane discipline | Worktree nur dieses Repo | BETRIEB | CLAUDE.md | Draussen geteilte Realitaet: stoppen und melden (Entscheid A). |
| 60 | 541-542 | 84 | Supervisor | Supervisor (Überschrift) | BETRIEB | CLAUDE.md | Rollen-Abschnitt. |
| 61 | 543-553 | 983 | Supervisor | Nachfolge-Modell-Falle | BETRIEB | CLAUDE.md | succeedSupervisor reicht Modell/Effort woertlich durch; der Insassin ab Minute eins. |
| 62 | 554-562 | 701 | Supervisor | C-u/Owner-Entwurf | BETRIEB | CLAUDE.md | C-u kann Owner-Input zerstoeren (geteilte Realitaet); zweimal lesen, wachsend = Mensch. |
| 63 | 563-564 | 42 | Self-scheduling | Self-scheduling (Überschrift) | BETRIEB | CLAUDE.md | Mechanismus-Abschnitt der eigenen Pane. |
| 64 | 565-570 | 507 | Self-scheduling | Self-Env-Vars | BETRIEB | CLAUDE.md | Jede Pane traegt FLEET_SELF_TOKEN/SLOT; Grundlage aller Self-Routen. |
| 65 | 571-578 | 754 | Self-scheduling | Self-Prinzipal | BETRIEB | CLAUDE.md | Inventar der Self-Befugnisse; GET /api/self ist Orientierung. |
| 66 | 579-593 | 1365 | Self-scheduling | Scope-Regeln 409 | BETRIEB | CLAUDE.md | 409=Feature (nie 401); verhindert Token-Fehldiagnose beim API-Gebrauch. |
| 67 | 594-610 | 927 | Self-scheduling | autos Feldformen | BELEG | docs/self-api.md | API-Referenz (curl-Beispiel, Felder, Deckel, Mindestintervall); Deckel/Intervall bleiben als Zeiger. |
| 68 | 611-619 | 548 | Self-scheduling | autos-Disziplin | BETRIEB | CLAUDE.md | Verhaltensregeln inkl. Invariante: nie um expliziten Stop herum. |
| 69 | 620-631 | 1165 | Self-scheduling | Watch-Prinzip+Kinds | BETRIEB | CLAUDE.md | Rueckkanal-Prinzip (Einstieg verweist hierher) + S55-Regel: nach Merge-POST sofort {kind:merge} abonnieren. |
| 70 | 632-656 | 1674 | Self-scheduling | Watch-Referenz | BELEG | docs/self-api.md | Feld-/Ablehnungs-Semantik; die fette Regel "nie allein landen, Pane lesen" bleibt als Zeiger (verdoppelt Idle-Block 42–52). |
| 71 | 657-671 | 834 | Self-scheduling | succeed/retire | BELEG | docs/self-api.md | Ausstiegs-Mechanik; Pflicht "erst frischer committeter Handoff" bleibt als Zeiger (Kontext-Schwellen-Block verweist hierher). |
| 72 | 672-673 | 11 | Deploy | Deploy (Überschrift) | BETRIEB | CLAUDE.md | Abschnitt wird innen getrennt, nicht als Ganzes bewegt. |
| 73 | 674-678 | 533 | Deploy | Deploy+Kickstart | BETRIEB | CLAUDE.md | Watchdog-Aenderungen brauchen launchctl kickstart (Z. 706/907) — Gefahrenklasse. |
| 74 | 679-687 | 964 | Deploy | Repo oeffentlich | BETRIEB | CLAUDE.md | Leck-Invariante + grep-Kontrolle; unumkehrbar (Entscheid A nennt sie explizit). |
| 75 | 688-693 | 617 | Deploy | Zwei Baeume | BETRIEB | CLAUDE.md | Blindes merge main auf alter Historie = 421 fremde Commits; unumkehrbar. |
| 76 | 694-701 | 770 | Deploy | Health/bundleStale | BETRIEB | CLAUDE.md | Benannte Gefahrenklasse (Z. 695/696): Tailscale-IP sieht tot aus; bundleStale auf /api/sessions. |
| 77 | 702-707 | 575 | Deploy | Verify-Gate dreiwertig (strittig) | BETRIEB | CLAUDE.md | skipped (ok:null) auto-landet nie — gleiche Dreiwertig-Klasse wie Z. 912; im Zweifel bleibt er stehen. |
| 78 | 708-725 | 1950 | Deploy | Land-Pfad-Flags | BELEG | docs/harness-adapter.md | Env-Konfigurations-Referenz (REPAIR_ROUNDS/CLEAN_REVIEW/AUTOMATION); aktuelle Werte bleiben als Zeiger-Zeile. |
| 79 | 726-740 | 1463 | Deploy | Full-Access-Korrektur | BELEG | docs/attic/harness-zaun-messungen.md | Traegt die heutige Regel (Full Access Normalzustand, /commit Notweg, container Sonderfall, Lese-Reichweite-Frage); Regel bleibt als Satz, Zaun-Geschichte zieht. |
| 80 | 741-756 | 1669 | Deploy | Codex Lese-Zaun | BELEG | docs/attic/harness-zaun-messungen.md | Sandbox existiert nicht mehr, aber die Vertrauensfrage (Lese-Reichweite=Provider-Reichweite, Bind-Mount-Falle) haengt an dieser Messung; Zeiger bleibt. |
| 81 | 757-792 | 3596 | Deploy | Codex kann nicht committen | TOT | docs/attic/harness-zaun-messungen.md | Seit fc8f4ad committet jede Lane selbst; Arbeitsteilung ist erklaerte HISTORIE; keine heutige Regel haengt am Block — Attic-Zeile. |
| 82 | 793-830 | 3826 | Deploy | pi-Zaun sandbox-exec | TOT | docs/attic/harness-zaun-messungen.md | Zaun seit fc8f4ad entfernt; Zaun-Mechanik ohne heutige Regel — Attic-Zeile. |
| 83 | 831-842 | 1183 | Deploy | Fixture-Regel | BELEG | docs/attic/harness-zaun-messungen.md | Allgemeine Regel (ausfuehrbares Artefakt AUSFUEHREN, Sonden an USABLE) gilt heute ueber Sandboxen hinaus; Zeiger bleibt. |
| 84 | 843-849 | 764 | Deploy | allowedTools additiv | BELEG | docs/harness-adapter.md | Spawn-Konfigurations-Referenz (--setting-sources/--tools, MERGE_TOOLS); Nachschlage-Flaeche. |
| 85 | 850-860 | 1112 | Deploy | Post-Land-Audit | BELEG | docs/harness-adapter.md | Audit-Betriebs-Referenz; undo-land-Grenze (genau ein Land) bleibt als Zeiger. |
| 86 | 861-875 | 1486 | Deploy | awaiting/Cast-Regel | BELEG | docs/verify-tiering.md | Cast=Behauptung ueber fremde Flaeche; Instanz offen (e2e/tasks.ts:122); Sonden-Schreibregel gehoert zur Test-Nachschlageflaeche. |
| 87 | 876-900 | 2311 | Deploy | Gruen ohne Messung | BELEG | docs/verify-tiering.md | Beweisregel (Gruen an ms/PASS-Zeilen pruefen) bleibt als Zeiger; Entkopplungs-Geschichte zieht (Bauform wie §11.2b). |
| 88 | 901-916 | 1575 | Deploy | Verb 2 Deploy-Route | BETRIEB | CLAUDE.md | Drei Gefahrsaetze (kickstart bleibt noetig; ok:null NIE Pass; 409 bei laufendem Audit) — benannte Gefahrenklasse (Z. 907/912). |
| 89 | 917-928 | 1203 | Deploy | Gast-Konsole entfernt | BELEG | docs/attic/entfernte-flaechen.md | Zustand entfernt, aber Waechter leben (guest=Share-Zuschauer im Code; Container-Pfad ist Agenten-Zaun) — Waechter-Zeile bleibt, Rest zieht. |
| 90 | 929-942 | 1500 | Deploy | Share-Modus entfernt | BELEG | docs/attic/entfernte-flaechen.md | interact entfernt; Waechter leben (keine geloeschten Pfade in Backticks — Pfad-Pin; Share-Kommentare bleiben) — Zeile bleibt, Rest zieht. |
| 91 | 943-1019 | 7676 | Deploy | Dispatcher/kinds/refine | BELEG | docs/queue-analyst.md | Queue-Automation-Referenz (Dispatcher, kinds, Brief-Kompiler §5a, refine, clarify); Vertrauensgrenzen (nur Owner-Freigabe startet; kein Tick landet; nur auftrag freigebbar) bleiben als Zeiger. |
| 92 | 1020-1027 | 851 | Deploy | auto-③ | BELEG | docs/harness-adapter.md | Env-Knoepfe + Suite-Stand-in-Pflicht (AUTO_REVIEW_MS=0) — Nachschlage; Pflicht bleibt als Zeiger. |
| 93 | 1028-1030 | 291 | Deploy | Modell-Tiers | BELEG | docs/harness-adapter.md | §5 Kandidat 3 nennt sie explizit; Konfigurations-Referenz. |
| 94 | 1031-1046 | 1507 | Deploy | Repo-Worker | BELEG | docs/harness-adapter.md | §5 Kandidat 3 nennt sie explizit; Route/Validierung ist Nachschlage. |
| 95 | 1047-1123 | 7680 | Deploy | Harness-Adapter | BELEG | docs/harness-adapter.md | §5 Kandidat 3 Kern (Probe-Mengen, Modell-Charset, Ein-Adapter-je-Harness, Codex-Recovery, Container-per-Slot). |
| 96 | 1124-1131 | 858 | Deploy | agent-Faktschicht | BELEG | docs/harness-adapter.md | Faktschicht vs aliveInfo-Gate — Adapter-Referenz; "null ist KEINE Antwort" bleibt als Zeiger. |
| 97 | 1132-1137 | 430 | Deploy | [1m] single-quoted | BETRIEB | CLAUDE.md | Ungequotete Klammer toetet JEDE neue Session beim Spawn; tsc-blind — Gefahrenklasse. |
| 98 | 1138-1154 | 1231 | graphify | graphify gesamt | BETRIEB | CLAUDE.md | Lane-Satz (graphify nie in einer Lane) ist Orientierung; Nutzungsregeln klein — Aufteilung lohnt keinen eigenen Zielort; spaetere Runde moeglich. |

## Summen

| Verdikt | Bytes | Blöcke | Bedeutung |
|---|---:|---:|---|
| BETRIEB | 65062 | 76 | bleibt in `CLAUDE.md` |
| BELEG | 37191 | 20 | zieht nach `docs/…`; die Regel behält je einen Zeiger (Größe setzt Schritt 2) |
| TOT | 7422 | 2 | wird je eine Zeile im Attic-Dokument |
| **Summe** | **109675** | **98** | = `wc -c` der Messgrundlage, exakt |

Abschnitts-Summen (Kreuzprobe gegen `docs/kontextlast-2026-08-18.md` §2 — deckungsgleich):
Präambel+Loader 1821 · Einstieg 22900 (alles BETRIEB) · Lane discipline 27738 (alles BETRIEB) ·
Supervisor 1768 (alles BETRIEB) · Self-scheduling 7816 (4381 BETRIEB / 3435 BELEG) ·
Deploy 46401 (**5475 BETRIEB / 33504 BELEG / 7422 TOT** — 88 % des größten Hebels ziehen um) ·
graphify 1231 (alles BETRIEB).

**Restgröße von `CLAUDE.md` nach Schritt 2:** mindestens 65062 B plus die Zeiger-Sätze aus den 20
BELEG-Blöcken (realistisch grob 67–71 KB). Das in §5 genannte Ziel ~35–40 KB ist mit DIESER Runde
strukturell nicht erreichbar: die zwei per Entscheid A geschützten Abschnitte (Einstieg + Lane
discipline) stellen allein 50638 B BETRIEB. Die Differenz ist ausdrücklich eine spätere Runde; die
BELEG-Stellen darin sind in der Tabelle vermerkt.

## Nachrechnen

Bedingung 1 (lückenlose Partition 1–1154) und Bedingung 2 (Byte-Summe 109675) sind mit diesem
Kommando nachrechenbar (ausgeführt im Worktree der Lane; `CL` notfalls anpassen):

```sh
CL=/Users/owner/claude-fleet/CLAUDE.md
awk -F'|' -v cl="$CL" '
function b(s,e,  cmd,l){cmd="sed -n \x27"s","e"p\x27 "cl" | wc -c"; cmd|getline l; close(cmd); return l+0}
$3 ~ /^ *[0-9]+-[0-9]+ *$/ {
  split($3,r,"-"); s=r[1]+0; e=r[2]+0; claimed=$4+0
  if(s!=prev+1){print "LUECKE/UEBERLAPPUNG bei "s; bad=1}
  if(claimed!=b(s,e)){print "BYTE-FEHLER "s"-"e": "claimed" != "b(s,e); bad=1}
  prev=e; sum+=claimed; n++
}
END{ if(prev!=1154||sum!=109675){print "SUMME/ENDE falsch: "prev" "sum; bad=1}
     if(!bad) print "OK: "n" Bloecke, lueckenlos 1..1154, Byte-Summe "sum" == 109675" }' \
  docs/rulebook-inventar-2026-08-18.md
```

Ergebnis des Laufs (2026-08-18, Lane `fleet-260818131659-0c04`):

```
OK: 98 Bloecke, lueckenlos 1..1154, Byte-Summe 109675 == 109675
```

## Offenes

- Block 702–707 ist **strittig** (BETRIEB): Dreiwertig-Semantik des Land-Gates — gleiche Klasse wie
  die benannte Gefahr Z. 912, aber kein fünf-Minuten-Fall. Im Zweifel bleibt eine Regel stehen.
- Die BELEG-Vermerke IN den geschützten Abschnitten (Einstieg, Lane discipline) sind keine Verdikte
  dieser Runde; sie markieren das Material der späteren.
