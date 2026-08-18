# Bedeutungs-Probe des Regelbuch-Schnitts Runde 2 (2026-08-18)

Das Pruef-Artefakt: 117 Regeln der Vor-Schnitt-Fassung als pruefbare Saetze, je mit
formulierungsfestem Kern-Muster und Soll-Ort (**C** = muss in `CLAUDE.md` selbst stehen,
**U** = Union aus `CLAUDE.md` + getrackten Zieldokumenten reicht — bewusster Zeiger).
Abgleich nach dem Schnitt: **117/117 bestanden** (und die Baseline VOR dem Schnitt war
ebenfalls gruen — die Probe misst also wirklich). Muster in Backticks sind Substrings,
keine Pfade/Auftraege an den Leser.

| id | Ort | Regel | Kern-Muster |
|---|---|---|---|
| L1 | C | Claude-Session liest aus AGENTS.md den portablen Vertrag; Rest ist Nachschlag | <code>AGENTS.md</code> |
| L2 | C | Regeln werden nur durch Owner-Promotion normativ | <code>propose/promote</code> |
| L3 | C | Doc-vs-Code-Widerspruch: Code gewinnt; Widerspruch stoppt Arbeit | <code>gilt der Code</code> |
| L4 | C | Fable-5-Safeguard: Owner-Phrasierung, Retry-Rezept | <code>false-flagged</code> · <code>rephrase</code> |
| E1 | C | Erdungs-Reihenfolge vor jedem Plan | <code>./state.sh</code> · <code>register.sh</code> |
| E2 | C | altes Backlog nicht als Register lesen | <code>KEIN lebendes Register</code> |
| E3 | C | Idle!=fertig; Pane lesen UND ahead/dirty | <code>vier Zustände sehen gleich aus</code> · <code>ahead/dirty</code> |
| E4 | C | Warten auf Lane -> Watch; aus Lane 409 -> Hintergrund-Watcher | <code>/api/self/watch</code> · <code>409</code> |
| E5 | C | Lands seriell, keine Wartepflicht auf Audit | <code>Lands gleichzeitig</code> |
| E6 | C | Mutationsprobe nie via checkout--, sondern stash/Kopie | <code>stash push</code> |
| E7 | C | Host-Commit vor Probe macht checkout-- harmlos | <code>erst der Host-Commit, dann die Probe</code> |
| E8 | C | Direkt-Commit: Verifikation von Hand + im Handoff sagen | <code>Ledger unsichtbar</code> |
| E9 | C | Uebergabe beginnt bei ~44% | <code>44 %</code> |
| E10 | C | Lane-Start-Anker ~36%, kein Zaun | <code>36 %</code> |
| E11 | C | Kompaktierungs-Kliff 83% = Verlustereignis | <code>83-%</code> |
| E12 | C | Fuellstand messen (ctx am eigenen Slot), nie schaetzen | <code>MISST DU</code> · <code>s["ctx"]</code> |
| E13 | C | ctx:null heisst unmessbar, nicht leer | <code>ctx: null</code> |
| E14 | C | Beerdigtes nicht wieder aufmachen | <code>Beerdigtes</code> |
| E15 | C | Zeile ohne Done-Kriterium nie direkt dispatchen | <code>clarify first</code> |
| E16 | C | GPT-Fenster 258400 statt 1M | <code>258 400</code> |
| E17 | C | Hebel ist Tool-Ausgaben-Disziplin | <code>Tool-Ausgaben-Disziplin</code> |
| E18 | C | 1M-Schwellen nicht auf GPT-Fenster uebertragen | <code>NICHT übertragen</code> |
| E19 | C | Brief: Dateien mit Zeilenbereich | <code>Zeilenbereich</code> |
| E20 | C | Brief: Abschnitte nennen, nicht wholesale Regelbuch | <code>ABSCHNITTE</code> |
| E21 | C | Suite-Ausgaben in Log-Datei, Tail lesen | <code>Log-DATEI</code> |
| E22 | C | eine GPT-Lane = ein Schnitt | <code>Ein Schnitt, kein Programm</code> |
| E23 | C | GPT-Lane meldet Fuellstand selbst | <code>SELBST melden</code> |
| E24 | C | Codex-Dispatch wartet auf Accept-Marker, requeued ehrlich | <code>>_ OpenAI Codex (v</code> |
| E25 | C | canDeliver-Gate blocked-screen; Trust-Screen frisst Paste | <code>blocked-screen</code> |
| E26 | C | Codex-TUI: verrutschte Ansicht via /agent zurueck | <code>/agent</code> · <code>Main [default]</code> |
| D1 | C | proportionale Verifikation: erst self/gate fragen | <code>localProof.steps</code> |
| D2 | C | Suite am Tail beurteilen | <code>ALL PASS</code> |
| D3 | C | review-sweep = mechanische Review-Haelfte | <code>bun review-sweep.ts</code> |
| D4 | C | Verify-Kette woertlich vorhanden | <code>bun install --frozen-lockfile && bun e2e/pins.ts</code> |
| D5 | C | pins ist erste Stufe des Land-Gates und wird ausgefuehrt | <code>ERSTE Stufe</code> |
| D6 | C | e2e-isolated: Vorschau, Pflicht nur bei benannten Ausloesern | <code>Tier-2-Vorschau, kein Gate</code> |
| D7 | C | Ausloeser: Aussage aendern, ueber die eine Behauptung steht | <code>Behauptung steht</code> |
| D8 | C | e2e/security.ts laeuft nur in e2e-isolated | <code>AUSSCHLIESSLICH in</code> |
| D9 | C | Audit-Pfad-Aenderung -> eigene Suite fahren | <code>e2e-postland-audit.sh</code> |
| D10 | C | lane landbar: committen, keine untracked files | <code>untracked</code> |
| D11 | C | Drift-Check vor Done-Report; null=UNKNOWN | <code>wouldConflict</code> |
| D12 | C | gate: timeoutMs vs waitMs getrennt | <code>zwei Budgets</code> |
| D13 | C | waitedOut ist nie ok:false | <code>waitedOut</code> |
| D14 | C | rulebookDrifted null != kein Drift | <code>rulebookDrifted</code> |
| D15 | C | Clarify-Lane: vorschlagen und stoppen | <code>CLARIFY-Lane</code> |
| D16 | C | 5x-Schleife = strukturell, stoppen | <code>~5</code> |
| D17 | C | roter Check ist deiner bis Gegenbeweis | <code>DEINER</code> |
| D18 | C | Beweis: zuerst denselben Baum erneut | <code>denselben Baum</code> |
| D19 | C | frische Arbeit: erster Verdaechtiger ist die Sonde | <code>SONDE</code> |
| D20 | C | Sonde, die nicht laufen konnte, scheitert als sie selbst | <code>SIE SELBST</code> |
| D21 | C | Flake-Familien sind kein Freifahrtschein | <code>Freifahrtschein</code> |
| D22 | C | FIX1 behoben; neues FIX1-Rot ist echt | <code>FIX1</code> |
| D23 | C | Suite-Mutex: pid-Datei entscheidet; pid-lose Dir = Park-Halt | <code>existiert ≠ gehalten</code> · <code>pid</code> |
| D24 | C | Owner-Vorgabe woertlich zitieren, Rangliste abschneiden | <code>wörtlich zitieren</code> |
| D25 | C | concurrency-safe gilt nicht fuer Last; Beweis seriell | <code>Maschinenlast</code> |
| D26 | C | fails-identically-Beweis MUSS seriell laufen | <code>seriell</code> |
| D27 | C | claude-gate: drei Phasen, Paar 1+2 | <code>DREI Phasen</code> |
| D28 | C | Phase ohne server.log = nie gemessen | <code>server.log</code> |
| D29 | C | fleet-e2e.ts ist nur Runner; Checks in e2e/<family> | <code>runner only</code> |
| D30 | C | Kopierlisten abgeleitet aus e2e-stage.sh, nie Hand-Listen | <code>e2e-stage.sh</code> |
| D31 | C | CLAUDE.md gitignored; Lane meldet Regelaenderungen als Text | <code>nur KOPIERT</code> |
| D32 | C | HANDOFF/Notes als Claims behandeln | <code>claims</code> |
| D33 | C | operative Dateien: rg -uu oder grep | <code>rg -uu</code> |
| D34 | C | strukturelle Fragen: ast-grep | <code>ast-grep</code> |
| D35 | C | state/register-greps nicht naiv auf rg umstellen | <code>state.sh/register.sh</code> |
| D36 | C | Zustand ableiten, nicht aufschreiben | <code>./state.sh</code> |
| D37 | C | Bodies sind das Befund-Register | <code>Commit-BODIES</code> |
| D38 | C | Wissen aus main: lesen, nicht aus Working Tree | <code>git show main:</code> |
| D39 | C | Strukturaenderungen ziehen doc-Claims in derselben Lane mit | <code>Wissenspflege</code> |
| D40 | C | main-seitige Doc-Analyse committen vor Lane-Spawn | <code>committen, bevor</code> |
| D41 | C | Steward: eigener Worktree, landet nie selbst | <code>⚙ steward</code> |
| D42 | C | Demo bricht ohne Gate-Signal; eigener typecheck/build | <code>kein Gate hier sagt es</code> |
| D43 | C | Client-Bundles bauen vor Deploy | <code>bun run build before any client deploy</code> · <code>gitignored build artifacts</code> |
| D44 | C | nie bun server.ts mit Default-Env in einer Lane | <code>NEVER run bun server.ts</code> |
| D45 | C | Scratch-Instanzen nie per pkill-Muster beenden | <code>pkill -f "bun server.ts"</code> |
| D46 | C | Suite-Lauf nur ueber notierte PID beenden | <code>notierte PID</code> |
| D47 | C | Wrapper-Kill reicht nicht; Runner+tmux-srv killen | <code>kill <wrapper-pid> reicht NICHT</code> |
| D48 | C | ausserhalb des Repos: stoppen und melden | <code>shared reality</code> |
| S1 | C | Supervisor-Rolle: Opus 5 high; nicht mechanisch durchgesetzt | <code>Opus 5</code> · <code>effort high</code> |
| S2 | C | /model+/effort in Pane aendert Slot-Datensatz nicht | <code>aktualisiert den Slot-Datensatz aber nicht</code> |
| S3 | C | im eigenen Composer nie C-u bei moeglichem Owner-Entwurf | <code>nie C-u</code> |
| S4 | C | waechst der Text, tippt ein Mensch | <code>tippt ein Mensch</code> |
| F1 | C | Self-Env-Vars in jeder Pane; vor Gebrauch pruefen | <code>FLEET_SELF_TOKEN</code> |
| F2 | C | lane-only: vier Routen, 409 nie 401 | <code>verify-intent</code> |
| F3 | C | watch: Lane bekommt 409 | <code>lane may not subscribe</code> · <code>409</code> |
| F4 | C | succeed/retire: Lane und Steward 409 | <code>stehende Rolle</code> |
| F5 | C | autos: Deckel 5, Mindestintervall, Run-Cap | <code>max 5</code> |
| F6 | C | Self-Scheduling nie gegen expliziten Stop | <code>Stop</code> |
| F7 | C | Watch-Nachricht = Server-Praedikat; Pane lesen | <code>nie auf sie allein landen</code> |
| F8 | C | succeed: frischer committeter Handoff, sonst 409 | <code>jünger als diese Session</code> |
| P1 | C | watchdog-Aenderungen brauchen kickstart | <code>launchctl kickstart</code> |
| P2 | C | public-Repo: Leck-grep vor Commit leer | <code>muss LEER sein</code> |
| P3 | C | alte Branches: nie blind git merge main | <code>421 fremde Commits</code> |
| P4 | C | 127.0.0.1 antwortet nie; sieht tot aus | <code>127.0.0.1:8790</code> |
| P5 | C | nach Deploy bundleStale auf /api/sessions pruefen | <code>bundleStale</code> |
| P6 | C | Verify-Gate dreiwertig; skipped auto-landet nie | <code>unconfigured ≠ skipped</code> |
| P7 | C | kein Tick landet; einzige mergeJob-Stelle ist Route | <code>kein Tick
  landet</code> · <code>mergeJob</code> |
| P8 | C | Full Access Normalzustand; Lanes committen selbst | <code>FULL ACCESS</code> |
| P9 | C | Lese-Reichweite = Provider-Reichweite | <code>VERTRAUENSFRAGE</code> |
| P10 | C | Fixture fuer Ausfuehrbares muss ausfuehren | <code>AUSFÜHREN</code> |
| P11 | C | --allowedTools additiv; nur mechanische Verweigerung zaehlt | <code>ADDITIV</code> |
| P12 | C | undo-land gilt fuer genau ein Land | <code>genau EIN Land</code> |
| P13 | C | Cast auf Netz-Antwort = Behauptung | <code>BEHAUPTUNG über eine fremde Fläche</code> |
| P14 | C | Audit-Gruen an ms/PASS-Zeilen pruefen | <code>ran:0</code> |
| P15 | C | Verb 2: ok:null NIE ein Pass | <code>ok:null</code> |
| P16 | C | Deploy lehnt bei laufendem Audit 409 ab | <code>409</code> |
| P17 | C | Gast-Konsole weg; Container-Pfad ist Agenten-Zaun | <code>Gast-Konsole ist ENTFERNT</code> |
| P18 | C | Share ohne Modus; Gast-Input faellt | <code>keinen Modus mehr</code> |
| P19 | C | keine geloeschten Pfade in Backticks | <code>gelöschten Pfade in Backticks</code> |
| P20 | C | nur auftrag freigebbar; 409 an beiden Tueren | <code>darf freigegeben werden</code> |
| P21 | C | Brief-Kompiler eigener Schalter; Suiten beide 0 | <code>FLEET_BRIEF_MS</code> |
| P22 | C | Harness ohne Stand-in: auto-3 abschalten | <code>FLEET_AUTO_REVIEW_MS=0</code> |
| P23 | C | vier Probe-Mengen; wer eine anfasst, muss wissen welche | <code>VIER Probe-Mengen</code> |
| P24 | C | ein Adapter je Harness; Bruecke verdeckt Agenten | <code>EIN Adapter</code> |
| P25 | C | agent-Feld = Faktschicht, nie Gate; null keine Antwort | <code>nicht das Gate</code> |
| P26 | C | [1m]-Modellnamen single-quoted, sonst stirbt jeder Spawn | <code>single-quoted</code> |
| G1 | C | graphify nur im Haupt-Checkout | <code>In einer Lane gibt es ihn nie</code> |
