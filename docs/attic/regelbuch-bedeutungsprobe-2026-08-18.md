# Bedeutungs-Probe des Regelbuch-Schnitts Runde 2 (2026-08-18)

Das Pruef-Artefakt: 117 Regeln der Vor-Schnitt-Fassung als pruefbare Saetze, je mit
formulierungsfestem Kern-Muster und Soll-Ort (**C** = muss in `CLAUDE.md` selbst stehen,
**U** = Union aus `CLAUDE.md` + getrackten Zieldokumenten reicht — bewusster Zeiger).
Abgleich nach dem Schnitt: **117/117 bestanden** (und die Baseline VOR dem Schnitt war
ebenfalls gruen — die Probe misst also wirklich). Muster in Backticks sind Substrings,
keine Pfade/Auftraege an den Leser.

## Die Fragment-Spalte (2026-08-19, Schnitt B1)

`CLAUDE.md` ist seit B1 ein GENERAT: die Quelle sind sieben Fragmente in `rulebook/` (gitignored
wie das Regelbuch selbst), zusammengesetzt von `renderRulebook("main", …)` aus `rulebook.ts`.
Die Spalte **Fragment** sagt, in welchem der sieben eine Regel steht. Sie ist NICHT redaktionell:
sie kommt aus dem id-Praefix (`FRAGMENT_BY_RULE_PREFIX` in `rulebook.ts` — L·E·D·S·F·P·G), fuer
115 der 117 Zeilen ohne jedes Einzelurteil.

**Zwei Ausnahmen, beide der Schnitt C** (`docs/kontextlast-architektur-2026-08-19.md` §3): `D36`
(Zustand ableiten) und `D41` (Steward-Konvention) sind mit B1 aus `lane-discipline` nach
`einstieg` gezogen — beide gehen eine Lane nichts an. Ihre id behaelt das alte Praefix, weil eine
Umbenennung die Historie dieser Tabelle zerschnitte; die Spalte sagt, wo die Regel wirklich steht.
Genau dafuer ist die Spalte da: **sie faengt einen Umzug ab**, statt ihn unbemerkt zu lassen.

**Eine Muster-Reparatur, und sie ist ein Befund des Schnitts:** `F6` trug als Kern-Muster
`Stop` — ein Substring, der in der Self-scheduling-Sektion NIE stand. Gegen den Monolithen fand
er ein `Stop` aus einer ANDEREN Sektion und bestand vakuum-gruen; erst der Fragment-Suchraum hat
das aufgedeckt. Das Muster lautet jetzt `explicit stop instruction` und steht genau einmal, in
`self-scheduling.md`. Die Regel selbst ist unveraendert.

**Was der Check in `e2e/pins.ts` (Abschnitt 6b) daraus macht** — zwei Aussagen, nicht eine:

- **hart:** jede der 118 Regeln ist mit ihrem VOLLSTAENDIGEN Muster-Satz in dem Fragment
  auffindbar, das ihre Spalte nennt. 118/118. Das ist der Satz, der einen Verlust oder einen
  stillen Umzug faengt.
- **gemessen und berichtet, nicht gefordert:** bei 107 der 118 ist dieses Fragment auch das
  EINZIGE, in dem der Muster-Satz steht. Die uebrigen 11 tragen ein generisches Substring
  (`409`, `mergeJob`, `⚙ steward`, `ALL PASS`), das anderswo mitlaeuft. Das ist kein
  Ueberdeckungs-Fehler: die Zuordnung ist trotzdem eindeutig, weil die Spalte eine PARTITION ist
  — jede Regel steht in genau einer Zeile und nennt genau ein Fragment. Uniqueness zu FORDERN
  hiesse, elf Muster umzuschreiben, und ein Muster umschreiben heisst die Probe entschaerfen.

Das Matching normalisiert beide Seiten (Backticks, `**`, Zeilenumbrueche in einer Tabellenzelle)
— sonst faende `ahead/dirty` die Stelle nicht, an der `` `ahead`/`dirty` `` steht. Eine Zeile ohne
extrahierbares Muster ist ein FAIL unter eigenem Namen, nie ein stilles Bestehen: `P7`s Zelle
laeuft ueber zwei physische Zeilen und lieferte einem zeilenweisen Parser NULL Muster, was auf
`all([]) === true` hinauslief — die vakuum-gruene Form derselben Krankheit wie `F6`.

## Schnitt S1 (2026-09-14): der Lane-Render unter 20 000 Zeichen

Owner-OK 2026-09-14 19:0x auf die Streichliste `docs/messungen/2026-09-14-s1-streichliste.md`. Nach dem
Muster von Schnitt C wandern fuenf Regeln in ein anderes Fragment als ihr id-Praefix sagt, und die
Spalte sagt, wo sie wirklich stehen: `F3` (watch antwortet einer Lane 409), `F4` (succeed/retire:
Lane und Steward 409), `F7` (Watch-Nachricht ist Server-Praedikat) und `F8` (succeed braucht frischen
Handoff) sind mit den MAIN-Tueren aus `self-scheduling` nach `einstieg` gezogen — eine Lane bekommt
auf jede dieser Tueren 409, der Lane-Render soll sie nicht tragen (Tuer-Probe = 0); `D40`
(main-seitige Doc-Analyse committen, bevor man eine Lane spawnt) ist eine Handlung der MAIN und
steht deshalb ebenfalls in `einstieg`. Eine Zeile ist GESTRICHEN: `D4` (Verify-Kette woertlich im
Regelbuch) — die Kette steht seit S1 nur noch in `AGENTS.md` §Verify, gehalten von `RULE_VERIFY`
in `e2e/pins.ts`; das Regelbuch verweist. Die Tabelle traegt damit 117 Zeilen. Die uebrigen
Kuerzungen von S1 (AGENTS-Dubletten je ein Verweis-Satz, Suiten-Innenleben je ein Satz mit
Attic-Verweis, Geschichten ins Attic) lassen jedes Kern-Muster in seinem Fragment stehen — die
Muster sind die Regel, nicht ihre Erzaehlung.

| id | Ort | Fragment | Regel | Kern-Muster |
|---|---|---|---|---|
| L1 | C | loader | Claude-Session liest aus AGENTS.md den portablen Vertrag; Rest ist Nachschlag | <code>AGENTS.md</code> |
| L2 | C | loader | Regeln werden nur durch Owner-Promotion normativ | <code>propose/promote</code> |
| L3 | C | loader | Doc-vs-Code-Widerspruch: Code gewinnt; Widerspruch stoppt Arbeit | <code>gilt der Code</code> |
| L4 | C | loader | Fable-5-Safeguard: Owner-Phrasierung, Retry-Rezept | <code>false-flagged</code> · <code>rephrase</code> |
| L5 | C | loader | Pi/Codex lesen das private Overlay nicht pauschal; MAIN- und Lane-Render sind verschieden | <code>nicht vollständig</code> · <code>kleineren Render</code> |
| E1 | C | einstieg | Erdungs-Reihenfolge vor jedem Plan | <code>./state.sh</code> · <code>register.sh</code> |
| E2 | C | einstieg | altes Backlog nicht als Register lesen | <code>KEIN lebendes Register</code> |
| E3 | C | einstieg | Idle!=fertig; Pane lesen UND ahead/dirty | <code>vier Zustände sehen gleich aus</code> · <code>ahead/dirty</code> |
| E4 | C | einstieg | Warten auf Lane -> Watch; aus Lane 409 -> Hintergrund-Watcher | <code>/api/self/watch</code> · <code>409</code> |
| E5 | C | einstieg | Lands seriell, keine Wartepflicht auf Audit | <code>Lands gleichzeitig</code> |
| E6 | C | einstieg | Mutationsprobe nie via checkout--, sondern stash/Kopie | <code>stash push</code> |
| E7 | C | einstieg | Host-Commit vor Probe macht checkout-- harmlos | <code>erst der Host-Commit, dann die Probe</code> |
| E8 | C | einstieg | Direkt-Commit: Verifikation von Hand + im Handoff sagen | <code>Ledger unsichtbar</code> |
| E9 | C | einstieg | Uebergabe-Entscheidung bei 25 % (Owner-Entscheid 2026-08-21, ersetzt ~44 %) | <code>25 % = Uebergabe-ENTSCHEIDUNG</code> |
| E10 | C | einstieg | ab 30 % keine neue unklare Tiefenarbeit (ersetzt den ~36-%-Anker) | <code>30 % = keine NEUE unklare Tiefenarbeit</code> |
| E11 | C | einstieg | Kompaktierungs-Kliff 83% = Verlustereignis | <code>83-%</code> |
| E12 | C | einstieg | Fuellstand messen (ctx am eigenen Slot), nie schaetzen | <code>MISST DU</code> · <code>s["ctx"]</code> |
| E13 | C | einstieg | ctx:null heisst unmessbar, nicht leer | <code>ctx: null</code> |
| E14 | C | einstieg | Beerdigtes nicht wieder aufmachen | <code>Beerdigtes</code> |
| E15 | C | einstieg | Zeile ohne Done-Kriterium nie direkt dispatchen | <code>clarify first</code> |
| E16 | C | einstieg | GPT-Fenster 258400 statt 1M | <code>258 400</code> |
| E17 | C | einstieg | Hebel ist Tool-Ausgaben-Disziplin | <code>Tool-Ausgaben-Disziplin</code> |
| E18 | C | einstieg | 1M-Schwellen nicht auf GPT-Fenster uebertragen | <code>NICHT übertragen</code> |
| E19 | C | einstieg | Brief: Dateien mit Zeilenbereich | <code>Zeilenbereich</code> |
| E20 | C | einstieg | Brief: Abschnitte nennen, nicht wholesale Regelbuch | <code>ABSCHNITTE</code> |
| E21 | C | einstieg | Suite-Ausgaben in Log-Datei, Tail lesen | <code>Log-DATEI</code> |
| E22 | C | einstieg | eine GPT-Lane = ein Schnitt | <code>Ein Schnitt, kein Programm</code> |
| E23 | C | einstieg | GPT-Lane meldet Fuellstand selbst | <code>SELBST melden</code> |
| E24 | C | einstieg | Codex-Dispatch wartet auf Accept-Marker, requeued ehrlich | <code>>_ OpenAI Codex (v</code> |
| E25 | C | einstieg | canDeliver-Gate blocked-screen; Trust-Screen frisst Paste | <code>blocked-screen</code> |
| E26 | C | einstieg | Codex-TUI: verrutschte Ansicht via /agent zurueck | <code>/agent</code> · <code>Main [default]</code> |
| D1 | C | lane-discipline | proportionale Verifikation: erst self/gate fragen | <code>localProof.steps</code> |
| D2 | C | lane-discipline | Suite am Tail beurteilen | <code>ALL PASS</code> |
| D3 | C | lane-discipline | review-sweep = mechanische Review-Haelfte | <code>bun review-sweep.ts</code> |
| D5 | C | lane-discipline | pins ist erste Stufe des Land-Gates und wird ausgefuehrt | <code>ERSTE Stufe</code> |
| D6 | C | lane-discipline | e2e-isolated: Vorschau, Pflicht nur bei benannten Ausloesern | <code>Tier-2-Vorschau, kein Gate</code> |
| D7 | C | lane-discipline | Ausloeser: Aussage aendern, ueber die eine Behauptung steht | <code>Behauptung steht</code> |
| D8 | C | lane-discipline | e2e/security.ts laeuft nur in e2e-isolated | <code>AUSSCHLIESSLICH in</code> |
| D9 | C | lane-discipline | Audit-Pfad-Aenderung -> eigene Suite fahren | <code>e2e-postland-audit.sh</code> |
| D10 | C | lane-discipline | lane landbar: committen, keine untracked files | <code>untracked</code> |
| D11 | C | lane-discipline | Drift-Check vor Done-Report; null=UNKNOWN | <code>wouldConflict</code> |
| D12 | C | lane-discipline | gate: timeoutMs vs waitMs getrennt | <code>zwei Budgets</code> |
| D13 | C | lane-discipline | waitedOut ist nie ok:false | <code>waitedOut</code> |
| D14 | C | lane-discipline | rulebookDrifted null != kein Drift | <code>rulebookDrifted</code> |
| D15 | C | lane-discipline | Clarify-Lane: vorschlagen und stoppen | <code>CLARIFY-Lane</code> |
| D16 | C | lane-discipline | 5x-Schleife = strukturell, stoppen | <code>~5</code> |
| D17 | C | lane-discipline | roter Check ist deiner bis Gegenbeweis | <code>DEINER</code> |
| D18 | C | lane-discipline | Beweis: zuerst denselben Baum erneut | <code>denselben Baum</code> |
| D19 | C | lane-discipline | frische Arbeit: erster Verdaechtiger ist die Sonde | <code>SONDE</code> |
| D20 | C | lane-discipline | Sonde, die nicht laufen konnte, scheitert als sie selbst | <code>SIE SELBST</code> |
| D21 | C | lane-discipline | Flake-Familien sind kein Freifahrtschein | <code>Freifahrtschein</code> |
| D22 | C | lane-discipline | FIX1 behoben; neues FIX1-Rot ist echt | <code>FIX1</code> |
| D23 | C | lane-discipline | Suite-Mutex: pid-Datei entscheidet; pid-lose Dir = Park-Halt | <code>existiert ≠ gehalten</code> · <code>pid</code> |
| D24 | C | lane-discipline | Owner-Vorgabe woertlich zitieren, Rangliste abschneiden | <code>wörtlich zitieren</code> |
| D25 | C | lane-discipline | concurrency-safe gilt nicht fuer Last; Beweis seriell | <code>Maschinenlast</code> |
| D26 | C | lane-discipline | fails-identically-Beweis MUSS seriell laufen | <code>seriell</code> |
| D27 | C | lane-discipline | claude-gate: drei Phasen, Paar 1+2 | <code>DREI Phasen</code> |
| D28 | C | lane-discipline | Phase ohne server.log = nie gemessen | <code>server.log</code> |
| D29 | C | lane-discipline | fleet-e2e.ts ist nur Runner; Checks in e2e/<family> | <code>runner only</code> |
| D30 | C | lane-discipline | Kopierlisten abgeleitet aus e2e-stage.sh, nie Hand-Listen | <code>e2e-stage.sh</code> |
| D31 | C | lane-discipline | CLAUDE.md gitignored; Lane meldet Regelaenderungen als Text | <code>nur KOPIERT</code> |
| D32 | C | lane-discipline | HANDOFF/Notes als Claims behandeln | <code>claims</code> |
| D33 | C | lane-discipline | operative Dateien: rg -uu oder grep | <code>rg -uu</code> |
| D34 | C | lane-discipline | strukturelle Fragen: ast-grep | <code>ast-grep</code> |
| D35 | C | lane-discipline | state/register-greps nicht naiv auf rg umstellen | <code>state.sh/register.sh</code> |
| D36 | C | einstieg | Zustand ableiten, nicht aufschreiben | <code>./state.sh</code> |
| D37 | C | lane-discipline | Bodies sind das Befund-Register | <code>Commit-BODIES</code> |
| D38 | C | lane-discipline | Wissen aus main: lesen, nicht aus Working Tree | <code>git show main:</code> |
| D39 | C | lane-discipline | Strukturaenderungen ziehen doc-Claims in derselben Lane mit | <code>Wissenspflege</code> |
| D40 | C | einstieg | main-seitige Doc-Analyse committen vor Lane-Spawn | <code>committen, bevor</code> |
| D41 | C | einstieg | Steward: eigener Worktree, landet nie selbst | <code>⚙ steward</code> |
| D42 | C | lane-discipline | Demo bricht ohne Gate-Signal; eigener typecheck/build | <code>kein Gate hier sagt es</code> |
| D43 | C | lane-discipline | Client-Bundles bauen vor Deploy | <code>bun run build before any client deploy</code> · <code>gitignored build artifacts</code> |
| D44 | C | lane-discipline | nie bun server.ts mit Default-Env in einer Lane | <code>NEVER run bun server.ts</code> |
| D45 | C | lane-discipline | Scratch-Instanzen nie per pkill-Muster beenden | <code>pkill -f "bun server.ts"</code> |
| D46 | C | lane-discipline | Suite-Lauf nur ueber notierte PID beenden | <code>notierte PID</code> |
| D47 | C | lane-discipline | Wrapper-Kill reicht nicht; Runner+tmux-srv killen | <code>kill <wrapper-pid> reicht NICHT</code> |
| D48 | C | lane-discipline | ausserhalb des Repos: stoppen und melden | <code>shared reality</code> |
| S1 | C | supervisor | Supervisor-Rolle: Opus 5 high; nicht mechanisch durchgesetzt | <code>Opus 5</code> · <code>effort high</code> |
| S2 | C | supervisor | /model+/effort in Pane aendert Slot-Datensatz nicht | <code>aktualisiert den Slot-Datensatz aber nicht</code> |
| S3 | C | supervisor | Composer-Entwurf ist Claude Codes eigener Rest, nie ein Owner-Entwurf | <code>CLAUDE CODES EIGENER REST</code> |
| S4 | C | supervisor | den Owner NICHT fragen, ob ein Entwurf seiner ist | <code>NICHT, ob ein Entwurf seiner ist</code> |
| F1 | C | self-scheduling | Self-Env-Vars in jeder Pane; vor Gebrauch pruefen | <code>FLEET_SELF_TOKEN</code> |
| F2 | C | self-scheduling | lane-only: vier Routen, 409 nie 401 | <code>verify-intent</code> |
| F3 | C | einstieg | watch: Lane bekommt 409 | <code>lane may not subscribe</code> · <code>409</code> |
| F4 | C | einstieg | succeed/retire: Lane und Steward 409 | <code>stehende Rolle</code> |
| F5 | C | self-scheduling | autos: Deckel 5, Mindestintervall, Run-Cap | <code>max 5</code> |
| F6 | C | self-scheduling | Self-Scheduling nie gegen expliziten Stop | <code>explicit stop instruction</code> |
| F7 | C | einstieg | Watch-Nachricht = Server-Praedikat; Pane lesen | <code>nie auf sie allein landen</code> |
| F8 | C | einstieg | succeed: frischer committeter Handoff, sonst 409 | <code>jünger als diese Session</code> |
| P1 | C | deploy | watchdog-Aenderungen brauchen kickstart | <code>launchctl kickstart</code> |
| P2 | C | deploy | public-Repo: Leck-grep vor Commit leer | <code>muss LEER sein</code> |
| P3 | C | deploy | alte Branches: nie blind git merge main | <code>421 fremde Commits</code> |
| P4 | C | deploy | 127.0.0.1 antwortet nie; sieht tot aus | <code>127.0.0.1:8790</code> |
| P5 | C | deploy | nach Deploy bundleStale auf /api/sessions pruefen | <code>bundleStale</code> |
| P6 | C | deploy | Verify-Gate dreiwertig; skipped auto-landet nie | <code>unconfigured ≠ skipped</code> |
| P7 | C | deploy | kein Tick landet; einzige mergeJob-Stelle ist Route | <code>kein Tick
  landet</code> · <code>mergeJob</code> |
| P8 | C | deploy | Full Access Normalzustand; Lanes committen selbst | <code>FULL ACCESS</code> |
| P9 | C | deploy | Lese-Reichweite = Provider-Reichweite | <code>VERTRAUENSFRAGE</code> |
| P10 | C | deploy | Fixture fuer Ausfuehrbares muss ausfuehren | <code>AUSFÜHREN</code> |
| P11 | C | deploy | --allowedTools additiv; nur mechanische Verweigerung zaehlt | <code>ADDITIV</code> |
| P12 | C | deploy | undo-land ist ein Stack der Tiefe 3, nicht ein einzelnes Land | <code>STACK der Tiefe 3</code> |
| P13 | C | deploy | Cast auf Netz-Antwort = Behauptung | <code>BEHAUPTUNG über eine fremde Fläche</code> |
| P14 | C | deploy | Audit-Gruen an ms/PASS-Zeilen pruefen | <code>ran:0</code> |
| P15 | C | deploy | Verb 2: ok:null NIE ein Pass | <code>ok:null</code> |
| P16 | C | deploy | Deploy lehnt bei laufendem Audit 409 ab | <code>409</code> |
| P17 | C | deploy | Gast-Konsole weg; Container-Pfad ist Agenten-Zaun | <code>Gast-Konsole ist ENTFERNT</code> |
| P18 | C | deploy | Share ohne Modus; Gast-Input faellt | <code>keinen Modus mehr</code> |
| P19 | C | deploy | keine geloeschten Pfade in Backticks | <code>gelöschten Pfade in Backticks</code> |
| P20 | C | deploy | nur auftrag freigebbar; 409 an beiden Tueren | <code>darf freigegeben werden</code> |
| P21 | C | deploy | Brief-Kompiler eigener Schalter; Suiten beide 0 | <code>FLEET_BRIEF_MS</code> |
| P22 | C | deploy | Harness ohne Stand-in: auto-3 abschalten | <code>FLEET_AUTO_REVIEW_MS=0</code> |
| P23 | C | deploy | vier Probe-Mengen; wer eine anfasst, muss wissen welche | <code>VIER Probe-Mengen</code> |
| P24 | C | deploy | ein Adapter je Harness; Bruecke verdeckt Agenten | <code>EIN Adapter</code> |
| P25 | C | deploy | agent-Feld = Faktschicht, nie Gate; null keine Antwort | <code>nicht das Gate</code> |
| P26 | C | deploy | [1m]-Modellnamen single-quoted, sonst stirbt jeder Spawn | <code>single-quoted</code> |
| G1 | C | graphify | graphify nur im Haupt-Checkout | <code>In einer Lane gibt es ihn nie</code> |
