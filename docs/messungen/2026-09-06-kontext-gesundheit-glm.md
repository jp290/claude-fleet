---
frage: Was laedt jede Rolle in Claude Fleet beim Start an Dateien und Kontext-Anreicherungen, was widerspricht sich, ist tot, aufgeblaest oder fehlt — nach Kosten fuer den Owner rangiert?
urteil: Die servergebauten Briefs sind klein und sauber (7,3–9,5 kB gemessen, Anchor-Block nur Pointer), aber die Regelbuch-Schicht verbrennt pro MAIN ~114,5 kB (~28,6 k Tok, ~11 % von 258 400) vor dem ersten Toolcall, enthaelt einen echten Widerspruch (graphify-in-Lane) und Drift (lane-signals-Zeilen, 97c5d469, b7d449a0), und der Steward liest mit docs/verify-tiering.md ein 241-kB-Dokument voll.
bereich: [kontext, rollen, rulebook, briefs]
belege: [rulebook.ts#FRAGMENTS_FOR, server.ts#buildProgramMainBrief, server.ts#LANE_EXIT_FOOTER, context-receipts.jsonl, docs/steward.md, /Users/owner/claude-fleet/rulebook/einstieg.md]
nicht-gemessen: gemessener Tokenverbrauch (Bytes÷4 ist Schaetzung); welche CLAUDE.md-Kopie im Steward-Worktree liegt; Program-JSON-Groesse einer echten Founding; ob Claude Code AGENTS.md neben CLAUDE.md laedt (nur Loader-Anweisung gelesen)
stand: 2026-09-07
---

# Kontext-Gesundheit der Rollen — Groessenbild, Widersprueche, Drift, Luecken (GLM-Haelfte, blind)

2026-09-07, Lane `fleet-260907052117-ca39`. Auftrag (Owner, gefiltert vom Controller Slot 7):
kontextkritische Gegenlesung aller Rollen-Dateien durch Fable 5.1 UND GLM, unabhaengig. Diese
Notiz ist die GLM-Haelfte; die Fable-Notiz wurde bis Abschluss von §2 NICHT gelesen.

## §1 Groessenbild je Rolle

Token = Bytes÷4 (Schaetzung, kein gemessener Verbrauch). Prozent gegen 258 400 (GPT-Abo-Fenster,
Regelbuch §Modellpolitik) und 1 000 000. Ladeannahme: was der Harness beim Start automatisch
laedt plus was die Rolle laut eigenem Vertrag im ERSTEN Turn lesen soll.

| Rolle | Startladung (Bytes, gemessen) | ~Tok | % 258 400 | % 1 M |
|---|---|---|---|---|
| Controller / Program-MAIN (claude, Haupt-Checkout) | 8 090 (global `~/.claude/CLAUDE.md`) + 84 830 (CLAUDE.md main-Render, 7/7 Fragmente) + 226 (`.claude/CLAUDE.md`) + 21 368 (AGENTS.md portabler Kontrakt, per Loader-Anweisung e i n Abschnitt) ≈ **114 514** | ~28 600 | ~11,1 % | ~2,9 % |
| Supervisor (claude, Haupt-Checkout) | 93 146 (dieselbe Basis) + ~2 kB Supervisor-Brief (servergebaut) ≈ **95 100** | ~23 800 | ~9,2 % | ~2,4 % |
| Lane, claude-Harness (Worktree) | 8 090 + 37 226 (CLAUDE.md lane-Render, 3/7 Fragmente) + Dispatch-Brief 7 278–9 478 (5 Receipts vom 09-07) ≈ **52 600–54 800** | ~13 500 | ~5,2 % | ~1,3 % |
| Lane, pi/codex-Harness (Worktree) | 8 082 (global `~/AGENTS.md`) + 21 368 (Projekt-AGENTS.md) + Dispatch-Brief ~7 360 (pi-zai-Receipt) ≈ **36 800** | ~9 200 | ~3,6 % | ~0,9 % |
| Steward (claude, Steward-Worktree, volles Laderitual) | 8 090 + CLAUDE.md-Kopie (Groesse n.g.) + 16 561 (README) + 11 671 (tailored-context) + 241 085 (verify-tiering) + 11 711 (steward.md) ≈ **>289 000** | >72 000 | >28 % | >7,2 % |
| Skills (bei Trigger, on demand) | graphify 40 495 · unslop 4 121 · mess-notiz 5 534 · kriterium-grill 3 361 | 10 100 max | 3,9 % max | 1,0 % max |

Einzelmessungen: Fragmente loader 3 264 / einstieg 22 891 / lane-discipline 23 126 / supervisor
3 916 / self-scheduling 10 006 / deploy 19 935 / graphify 1 670 (Summe 84 808; main-Render 84 830,
lane-Render 37 226 — reconciliert mit `rulebook.ts` `FRAGMENTS_FOR`: lane = loader+lane-discipline+
self-scheduling). SYSTEM.md 13 120 · README 16 561 · controller.md 6 818 · steward.md 11 711 ·
lane-brief-template.md 9 331 · context-packs.json 1 441 · AGENTS.md 21 368.

## §2 Befunde, nach Kosten fuer den Owner rangiert

Kosten-Typ: **V** = verbrannte Tokens je Session, **F** = falsche Handlungen, **E** = blockierte
Entscheidungen. Jeder Befund: Beleg (datei:zeile) · Fix · Verify-Kommando. VERIFIZIERT gegen
 Baum/Code, so nicht markiert.

1. **[F] Widerspruch im selben MAIN-Render: „`graphify` gibt es in einer Lane nicht" vs.
   read-only-Query.** `rulebook/einstieg.md:203` (Brief-Checkliste) gegen `rulebook/graphify.md:8`
   („Seit `49e35f6` kann eine Lane den Main-Graphen READ-ONLY befragen") und AGENTS.md §Codex
   (Query-Rezept). Code entscheidet: SHA `49e35f6` existiert, AGENTS.md-Rezept gegen geprueft. Eine
   MAIN, die nach der Checkliste briefet, verweigert Lanes das staerkste Orientierungswerkzeug.
   Fix: einstieg.md:203 auf „nicht lokal, aber read-only gegen den Main-Graph (graphify.md)".
   Verify: `rg -n 'gibt es in einer Lane nicht' rulebook/einstieg.md` (leer).

2. **[F] Zeilenverweise im UNDATIERTEN einstieg.md gedriftet.** `einstieg.md:34` nennt
   `laneWatchSignal` (`lane-signals.ts:92`) und `einstieg.md:36` `host-commit-looking`
   (`lane-signals.ts:73`); tatsaechlich liegt der Typ bei `lane-signals.ts:126` und der Abschnitt
   bei `:100` (Zeile 92/73 zeigen auf Anderes). Verstoesst gegen die eigene Owner-Promotion
   „Symbolverweise statt Zeilenverweise in undatierten Docs" (lane-discipline.md, 2026-08-25).
   Fix: `datei#symbol`. Verify: `rg -n 'laneWatchSignal|host-commit-looking' lane-signals.ts`.

3. **[V] Controller/MAIN-Startlast ~114,5 kB ≈ 28,6 k Tok ≈ 11 % des GPT-Fensters vor dem ersten
   Toolcall.** 8 090 global + 84 830 main-Render + 226 + 21 368 portabler Kontrakt (Loader-Vertrag
   ordnet das Lesen des Abschnitts an). Jede Nachricht an die MAIN zahlt das erneut als Input
   (Regelbuch §Modellpolitik: ~96 % des Verbrauchs ist Input). Ladeannahme, nicht beobachtete
   Zustellung. Fix (Owner-Entscheid): Audience-Partition feiner schneiden — supervisor.md,
   deploy.md sind fuer die meisten MAINs nicht erste-Turn-relevant. Verify: `wc -c` nach Re-Render.

4. **[V] Steward-Laderitual liest `docs/verify-tiering.md` VOLL: 241 085 B ≈ 60 k Tok ≈ 23 % des
   GPT-Fensters.** `docs/steward.md` Schritt 2 der Session-Start-Sequenz nennt es ohne
   Zeilen-/Abschnittsgrenze (README+tailored+verify-tiering+steward.md = 281 kB Regal). Fix:
   Ritual auf Abschnitts-Anker (z. B. §5b, §11–§13, die lane-discipline ohnehin zitiert)
   einschraenken — Owner-Entscheid. Verify: `wc -c docs/verify-tiering.md`.

5. **[E] Luecke: der servergebaute Dispatch-Brief enthaelt KEINE Fuellstand-Selbstmeldung.**
   `LANE_EXIT_FOOTER` (server.ts:8107–8137, voll gelesen) nennt COMMIT/REPORT/IDLE, aber keinen
   „melde deinen Fuellstand bei halbvoll"-Satz; einstieg.md §GPT-Checkliste („Lass sie ihren
   Fuellstand SELBST melden") ist MAIN-Handarbeit pro Brief. GPT-Lanes haben `ctx: null` — ohne
   die Handzeile verlieren sie den einzigen Sensor und sterben im Auto-Compacting. Fix: eine Zeile
   in den Footer (server.ts, eine Naht). Verify: `rg -n 'halbvoll' server.ts`.

6. **[E] Luecke: eine Program-MAIN hat keinen adressierten Rueckkanal zum Controller.**
   Verifiziert: `/api/self/nudge` verweigert Nicht-Supervisor (server.ts:23864
   `if (!isBoundSupervisor(s)) … 409`); MAIN-Kanaele sind attention (→ Owner), clarifications
   (→ eigene Arbeiterinnen), tasks, release, land, watch. Braucht eine MAIN Controller-Kapazitaet
   (Slot/Pane frei machen), bleibt nur die Owner-Attention als Umweg. AGENTS.md Rollentabelle
   beschreibt das faktisch korrekt — es ist eine Luecke im System, nicht in der Doku. Fix:
   Owner-Entscheid (Route `main→controller` oder dokumentierte Antwort „Attention ist der Weg").

7. **[V] supervisor.md-Fragment (3 916 B) und deploy.md (19 935 B) reiten in JEDEM main-Render**,
   auch fuer MAINs, die nie deployen und keine Supervisoren sind; der Supervisor umgekehrt bekommt
   lane-discipline (23 126 B) — Regeln fuer Rollen, die er strukturell nicht ausueben kann (sein
   Brief verbietet landen/deployen explizit, server.ts:19289ff). ~29 kB ≈ 7 k Tok pro Supervisor-
   Session an unbenutzbarem Regelwerk. Fix: dritte Audience `supervisor` in `RULEBOOK_AUDIENCES`.
   Verify: `rg -n 'RULEBOOK_AUDIENCES' rulebook.ts`.

8. **[F] Toter SHA: `b7d449a0` in docs/steward.md:151.** `git cat-file -e b7d449a0` schlaegt fehl
   (Objekt existiert nicht im Baum — Arbeitstree teilt Object-DB mit main). Der Satz behauptet
   Belegbarkeit einer Inspektion. Fix: SHA korrigieren oder als verloren markieren. Verify:
   `git cat-file -e b7d449a0`.

9. **[E] Pending-Verweis `97c5d469` + `ctl.sh` in docs/controller.md:34.** SHA loest nicht auf,
   `ctl.sh` existiert nicht (`test -e` fehlgeschlagen); Formulierung „sobald Zeile `97c5d469`
   gelandet ist" ist ehrlich, aber eine Nachfolge-Controllerin kann den Land-Status nicht pruefen.
   Fix: Land-Vermerk nachtragen. Verify: `test -e ctl.sh && echo da || echo fehlt`.

10. **[V] `einstieg.md` nennt „`server.ts` sind 24 603 Zeilen (gemessen 2026-09-04)" — heute
    26 748** (WC, dieser Baum; +8,7 %). Datiert, also ehrlich, aber die Zahl ist
    Brief-Checklisten-Input: Kostenschaetzungen fuer `server.ts`-Fenster laufen seit 4 Tagen ~9 %
    unter. Fix: „aktuell `wc -l` nachmessen" als Klausel daneben. Verify: `wc -l server.ts`.

11. **[F] context-packs.json `messnotiz-index` estimatedBytes 11 700 vs. real 34 733**
    (`docs/messungen/INDEX.md`, Faktor 3). `estimatedBytes` ist, was der Planer ueber Ladekosten
    glaubt (Anchor-Block selbst kopiert keine Bytes — server.ts:8266 nur Pointer, verifiziert);
    `rulebook-generat` 25 900 vs. 28 894 (rulebook.ts 6 503 + inventar 22 391) ist nur ~10 % zu
    klein. Fix: nachmessen und eintragen. Verify: `wc -c docs/messungen/INDEX.md`.

12. **[V] Messgeschichten-Anteil der Fragmente.** einstieg.md (22 891 B) und deploy.md (19 935 B)
    erzahlen bezahlte Vorfaelle inline (Sessions 34/35/44, 2026-09-05-Vorfaelle, Update-Clock-
    Geschichte) und VERLINKEN zusaetzlich attic/messgeschichten — die Langfassungen existieren
    also schon ausgelagert. Anteil VERMUTET ~40 % der beiden Fragmente (nicht zeilengenau
    vermessen). AGENTS.md-Invariante „History … out of the normative core" bindet nur den portablen
    Kern — die Kosten zahlt trotzdem jede Session. Fix: Inline auf eine Zeile+Wirkung+Attic-Link
    kuerzen (Owner-Promotion noetig).

13. **[V] 409-Scope-Listen dreifach gepflegt: AGENTS.md Rollentabelle + self-scheduling.md-Fragment
    + docs/self-api.md** (dort verifiziert: self-api.md:68,142,324,421). Fuer EINE Session nicht
    doppelt geladen (claude-Lane: Fragment; pi-Lane: AGENTS.md), ABER eine claude-MAIN laedt
    AGENTS.md-Abschnitt UND self-scheduling-Fragment — dieselben 409-Fakten zweimal im Fenster,
    und jede neue Route muss drei Dateien treffen. Fix: Fragment verweist auf `docs/self-api.md`
    (getrackt, fuer jede Lane lesbar) statt die Liste zu wiederholen. Verify:
    `rg -c 'a lane may not' rulebook/self-scheduling.md docs/self-api.md AGENTS.md`.

14. **[V] graphify-SKILL.md 40 495 B getrackt in `.claude/skills/`** — groesster Skill, externe
    Adaption, Trigger-Beschreibung „any question about a codebase" ist so breit, dass er in einer
    Fleet-Lane schnell feuert — wo `graphify-out/` per Konstruktion nie existiert (graphify.md-
    Fragment sagt das der Lane). ~10 k Tok bei nutzlosem Trigger. Fix: lane-seitige Trigger-
    Beschreibung abschaerfen oder Skill fuer Lane-Audience weglassen (Owner-Entscheid). Verify:
    `wc -c .claude/skills/graphify/SKILL.md`.

15. **[V] AGENTS.md Game-Maker-Preflight-Prosa (~3,3 kB des portablen Kerns) laedt JEDE
    pi/codex-Lane**, bindet aber nur Game-Program-MAINs und deren Reviewer. ~800 Tok x jede
    Fleet-Lane. VERMUTET als Bloat — die Autoritaet ist die Owner-Promotion, nicht dieses Urteil;
    Gegenargument (ein Vertrag, keine forkenden Fassungen) steht daneben. Fix nur per Owner.

16. **[F] Rollenklarheit Controller: genau eine operative Definitionsstelle (docs/controller.md,
    verifiziert), aber die Gruendung ist HANDGESCHRIEBEN.** `BriefSource "founding"` existiert nur
    fuer Program-MAIN/Supervisor (server.ts:8084ff, `FOUNDING_BRIEF_SOURCE`); controller.md
    ordnet an, der Gruendungsbrief schrumpfe auf „Lies docs/controller.md + HANDOFF-Block". Rollen-
    Identitaet haengt an Owner-Disziplin, nicht an einer Maschine. Kleine Kosten, asymmetrisch
    gegenueber MAIN/Supervisor. Fix (wenn gewollt): servergebauter Controller-Founding-Brief.

17. **[E] codex-MAIN: keine Definitionsstelle gefunden.** `rg 'codex-MAIN'` ueber docs/, AGENTS.md,
    SYSTEM.md, README, rulebook/: leer. Existiert als Begriff nur im Auftragstext. Wenn gemeint
    ist „Program-MAIN unter codex-Harness": dieselbe Definition wie jede Program-MAIN
    (buildProgramMainBrief, server.ts:19190), der Brief ist harness-agnostisch. Kein Fix noetig;
    Begriff sollte nicht in neue Doku wandern.

18. **[V] Erst-Turn-Sequenzen existieren und sind ausfuehrbar:** `state.sh` + `register.sh`
    ausfuehrbar in diesem Worktree verifiziert; Gruendungsbriefe nennen sie (Standard-MAIN
    server.ts:19206ff, Lane-Succession server.ts:5782ff, Supervisor server.ts:19299ff).
    Target-repo-Frame nennt stattdessen git-Erdung + Zielrepo-AGENTS.md — passend. Kein Befund,
    positive Kontrolle.

19. **[V] Dispatch-Briefs sind kurz und deterministisch (7 278–9 478 B, 5 Receipts 09-07),
    Anchor-Block nur Pointer (server.ts:8266), Clarify-Brief ohne Exit-Footer (server.ts:8225
    `clarify ? "" : …`)** — die Serverseite der Kontextgesundheit ist gut. Positive Kontrolle;
    kein Fix.

20. **[F] `82f55be0` in deploy.md:129,135 ist KEIN toter SHA, sondern eine Deploy-Id** — verifiziert
    gegen `deploys.jsonl` (1 Treffer). Als Beleg eingestuft statt SHA — es loest in git nie auf und
    liest sich fuer jede Session wie der Fehlertyp aus Befund 8. Fix: in deploy.md als
    „Deploy-Id" kennzeichnen. Verify: `rg -c 82f55be0 deploys.jsonl`.

## §3 Was gut ist

- Fragment-Partition mit Backref-Block (rulebook.ts `renderBackref`): fehlende Teile werden
  BENANNT mit Lese-Pfad, Byte-Pin via e2e/pins.ts §6b haelt Render=Fragmente.
- Briefs sind servergebaut, deterministisch, klein; clarify/refine/merge sind reine Funktionen mit
  Injection-Fences (defuseDelimiters) und Data-Markierung von Queue-Text.
- context-receipts.jsonl misst `deliveredBytes` je Zustellung — die Zahlen in §1 sind nachlesbar,
  nicht geraten.
- AGENTS.md-Rollentabelle ist praezise gegen Code verifizierbar (Stichproben: nudge-409,
  supervisor-watch, suite-offer alle vorhanden); Supervisor-Brief nennt strukturelle
  Unmoeglichkeiten statt Verhaltensprosa.

## §4 Nicht geprueft

- Fable-Notiz (bis §5 faellig); gemessener Tokenverbrauch irgendwo (alles §1 ist Bytes÷4).
- Steward-Worktree selbst (liegt ausserhalb dieses Baums): welche CLAUDE.md-Kopie dort liegt, ob
  das Ritual je voll gelaufen ist.
- server.ts vollstaendig (~26 748 Zeilen; gelesen: Fenster um laneOwnerPrompts/briefAndSend/
  LANE_EXIT_FOOTER/buildProgramMainBrief/buildSupervisorBrief/succeedSupervisor/renderContextAnchorBlock,
  ~600 Zeilen); railBlockFor, studioBlockFor, programContent nur dem Namen nach.
- `src/client.ts`, `watchdog.sh` Volltext, `e2e/*`, `fleet.json`, `streams/`, `.claude/commands/*`,
  README unterhalb „Ops", graphify-SKILL unterhalb Zeile 60 (nur Kopf + Groesse).
- Ob Claude Code AGENTS.md neben CLAUDE.md automatisch laedt — nur die Loader-Anweisung gelesen
  (deshalb in §1 als Ladeannahme markiert); Harnessfenster-Eigenschaften nicht behauptet.
- live fleet.json Zustand (Programs, Slots) — bewusst nicht gelesen (keine Prozess-/Zustandsdaten
  in die Messung gezogen); HANDOFF.md (Stapelstruktur), `.claude/settings.json` (graphify-Hook),
  der Inhalt von `~/.claude/CLAUDE.md` (nur Groesse gemessen) — nicht Teil meiner Quellenliste.

## §5 Abgleich mit der Fable-Notiz (nach eigenem Urteil gelesen)

**Wo einig** (unabhaengig gefunden, je eigene Verifikation):
- Zeilenverweise im undatierten einstieg.md gedriftet, gegen die eigene Symbol-Regel (GLM #2 =
  Fable #6); server.ts-Zeilenzahl als Brief-Checklistenzahl veraltet (GLM #10 = Fable #6).
- Messgeschichten-Anteil der Fragmente: Regel + Attic-Zeiger statt Inline-Retelling (GLM #12 =
  Fable #17).
- Controller-Rollenbrief wird nicht servergebaut, Gruendung haengt an Prosa-Disziplin
  (GLM #16 = Fable #2).
- context-packs.json estimatedBytes daneben (GLM #11 = Fable #16; ich mass messnotiz-index
  Faktor 3, Fable rulebook-generat gegen den Render — gleiche Fehlerklasse).
- Game-Maker-Prosa im portablen Kern, den jede fremde Lane mitlaedt (GLM #15 = Fable #12).
- Zeiger auf 241-kB-Dokument (verify-tiering) ohne Abschnittsanker (GLM #4 = Fable #13).
- Groessenbild konvergent: Controller ~114 kB / ~28,5–28,6 k Tok / ~11 % — unabhaengig gleich.

**Wo uneinig oder ergaenzend**:
- Fable #1 (HANDOFF.md-Stapel: „lies nur den obersten Abschnitt" liest eine fremde Rolle) liegt
  ausserhalb meiner Quellen; ich kann es weder bestaetigen noch widersprechen — nicht gemessen.
- Fable #5 (Supervisor-Modellpolitik widerspruechlich: supervisor.md Opus 5 vs einstieg
  „Fable fuer alles, was orchestriert"): ich habe beide Fragmente gelesen und KEINEN harten
  Widerspruch befunden, weil die MODELLPOLITIK den Supervisor nicht nennt und die spezielle Regel
  (supervisor.md) vor der allgemeinen Aufzaehlung steht — Grenzfall, keine Widerlegung Fables.
- Fable #3/#4 (graphify-Hook je Tool-Aufruf; Kontext-Band 60 % in globaler CLAUDE.md): gitignoriert
  bzw. ausserhalb meiner Quellenliste — nur der Große nach nichts geprueft.
- Nur GLM: graphify-in-Lane-Widerspruch einstieg:203 vs graphify.md:8 (GLM #1), tote SHA b7d449a0
  (GLM #8), Pending-Verweis 97c5d469/ctl.sh (GLM #9), fehlende Fuellstand-Selbstmeldung im
  servergebauten Footer (GLM #5), fehlender MAIN→Controller-Rueckkanal gegen nudge-409 am Code
  verifiziert (GLM #6), Begriff „codex-MAIN" nirgends definiert (GLM #17), Deploy-Id 82f55be0
  keine tote SHA (GLM #20 — Klasse, die Fable nicht pruefte).
- Nur Fable: Lane-Render traegt ~6–7 kB Nicht-Lane-only-Regeln (Fable #11) — ich mass die
  komplementaere MAIN-Seite (supervisor/deploy-Fragmente in jedem main-Render, GLM #7); beide
  halten zusammen: die Audience-Partition ist an beiden Enden zu grob geschnitten.
- Render-Groessen differieren (Fable 81 293/35 209 B am 09-06, HEAD 6c089dd; GLM 84 830/37 226 B
  am 09-07 am Haupt-Checkout) — das Regelbuch wuchs ~3,5 kB an einem Tag; keine Widerlegung.
