---
frage: Was laedt jede Rolle in Claude Fleet beim Start an Dateien und Kontext-Anreicherungen, was widerspricht sich, ist tot, aufgeblaest oder fehlt — nach Kosten fuer den Owner rangiert?
urteil: Die servergebauten Briefs sind klein und sauber (7,3–9,5 kB gemessen, Anchor-Block nur Pointer). Die Regelbuch-Schicht einer MAIN summiert sich auf ~106,4 kB GEMESSENE Quellbytes (korrigiert in §0, urspruenglich ~114,5 kB; ohne MEMORY.md und HANDOFF-Block — mit ihnen ~117,6 kB, §5) — dass eine MAIN genau diese Dateien vor dem ersten Toolcall traegt, ist aus dem Loader-Vertrag ABGELEITET, und die ~26,6 k Tok / ~10,3 % von 258 400 sind Bytes÷4 daraus; der reale Verbrauch ist an keiner laufenden Session BEOBACHTET (§4). Die Schicht enthaelt einen echten Widerspruch (graphify-in-Lane) und Drift (lane-signals-Zeilen, Task-Id 97c5d469, tote Sha b7d449a0), und der Steward liest mit docs/verify-tiering.md ein 241-kB-Dokument voll.
bereich: [kontext, rollen, rulebook, briefs]
belege: [rulebook.ts#FRAGMENTS_FOR, server.ts#buildProgramMainBrief, server.ts#LANE_EXIT_FOOTER, context-receipts.jsonl, docs/steward.md, /Users/owner/claude-fleet/rulebook/einstieg.md]
nicht-gemessen: REALER Verbrauch — keine Rolle wurde an einer laufenden Session am Fenster beobachtet; §1 ist ein Vertrags-Groessenbild aus gemessenen QUELLBYTES plus ABGELEITETER Zuordnung Datei→Rolle (§4), die einzige beobachtete Zustellgroesse sind die deliveredBytes der Dispatch-Briefe; gemessener Tokenverbrauch (Bytes÷4 ist Schaetzung); welche CLAUDE.md-Kopie im Steward-Worktree liegt; Program-JSON-Groesse einer echten Founding; ob Claude Code AGENTS.md neben CLAUDE.md laedt (nur Loader-Anweisung gelesen); Log-Pfad des Originalverifys (Scratchpad der Lane geloescht, §0 Punkt 5); MEMORY.md und der oberste HANDOFF.md-Block fehlen in JEDER Rollenzeile von §1 (§4)
stand: 2026-09-08
---

# Kontext-Gesundheit der Rollen — Groessenbild, Widersprueche, Drift, Luecken (GLM-Haelfte, blind)

2026-09-07, Lane `fleet-260907052117-ca39`. Auftrag (Owner, gefiltert vom Controller Slot 7):
kontextkritische Gegenlesung aller Rollen-Dateien durch Fable 5.1 UND GLM, unabhaengig. Diese
Notiz ist die GLM-Haelfte; die Fable-Notiz wurde bis Abschluss von §2 NICHT gelesen.

## §0 Nachtrag 2026-09-07 — sechs Korrekturen nach Rueckgabe

Diese Notiz wurde am 2026-09-07 07:29 gelandet (`f781c60`), bevor ihr Empfaenger sie geprueft
hatte; die Rueckgabe (Program-MAIN Slot 3, Zeilen `f70e70dd` + `a3878547`) traf eine bereits
geschlossene Lane. Dieser Nachtrag arbeitet ihre sechs Punkte ab — eine Textkorrektur, kein
zweiter Sweep. Korrigiert wird IM TEXT unten; die Originalwerte stehen hier, weil ein datierter
Snapshot nicht still umgeschrieben werden darf.

Messbasis des Nachtrags: main `0352148e`, 2026-09-07. Jede Zahl unten steht neben dem Kommando,
das sie reproduziert.

| # | Rueckgabe-Punkt | Original | Korrigiert |
|---|---|---|---|
| 1 | AGENTS.md-Basis | 21 368 B als "portabler Kontrakt" | **13 242 B** — 21 368 ist die GANZE Datei; der Abschnitt ist Zeile 22–171 |
| 2 | graphify in der Lane | fehlendes `graphify-out/` ⇒ Trigger nutzlos | lokal richtig, aber die Read-only-Query gegen den Main-Graphen traegt (§2 #14) |
| 3 | `97c5d469` | "SHA loest nicht auf" | **Task-Id**, kein Commit — der Status ist abfragbar (§2 #9) |
| 4 | `estimatedBytes` | Nutzer und Kosten behauptet, nicht belegt | Nutzer benannt, Kostenaussage auf das Gemessene zurueckgenommen (§2 #11) |
| 5 | Verify-Beleg | "ALL PASS" ohne Baum-Sha und ohne Log-Pfad | Sha gefunden, Log-Pfad **unknown** (unten) |
| 6 | Abdeckung | §4 nennt Luecken, trennt aber nicht gemessen/abgeleitet | §4 trennt beides ausdruecklich |

**Punkt 1 — die Basis war eine ganze Datei statt eines Abschnitts.**
`AGENTS.md` ist im Ganzen 21 368 B. Der Abschnitt, den eine Claude-Session laut Loader-Vertrag
liest ("read the **Portable operating contract** section once", `AGENTS.md` §Loader boundary),
reicht von `## Portable operating contract` bis vor `## Before you start`:

    git rev-parse main                                    # 0352148e
    git show main:AGENTS.md | wc -c                       # 21368   ganze Datei
    git show main:AGENTS.md | sed -n '22,171p' | wc -c    # 13242   der Abschnitt

13 242 B, unabhaengig bestaetigt: die Fable-Haelfte misst denselben Wert
(`docs/messungen/2026-09-06-kontext-gesundheit-fable.md:27`). Die 13 241 B der Rueckgabe sind
derselbe Wert bis auf den Schluss-Newline, kein Messstreit.

Der Fehler verschob die Zeilen von §1 in BEIDE Richtungen:
- **Controller/MAIN** zaehlte 21 368 statt 13 242: **8 126 B zuviel**.
- **Supervisor**, **Lane (claude)** und **Steward** zaehlten den Abschnitt GAR NICHT, obwohl
  derselbe Loader-Vertrag jede Claude-Session bindet: je **13 242 B zuwenig**. Der Nachtrag
  zaehlt ihn dort jetzt mit — Konsistenz-Korrektur, keine Neumessung.
- **Lane (pi/codex)** bleibt bei 21 368 und war richtig: ein Codex-/Pi-Harness laedt `AGENTS.md`
  GANZ ("Interactive Codex and Pi sessions load it automatically"). Genau diese Asymmetrie hatte
  die Originalfassung eingeebnet, indem sie beiden Rollen dieselbe Zahl gab.
- Unveraendert fehlt in ALLEN Zeilen, was §1 nie gezaehlt hat: `MEMORY.md` und der oberste
  `HANDOFF.md`-Block. Das folgt nicht aus der falschen Basis, sondern ist eine Quellenluecke —
  sie steht darum in §4.

**Punkt 5 — drei Verify-Belege, getrennt gehalten.**
1. **Originallauf der Lane 746513d1 (der Beleg dieser Notiz):** Baum `fb470c67`
   (`docs: Kontext-Gesundheitsanalyse GLM (blind, Gegenlesung zu Fable)`, 2026-09-07 07:28:41 +0200),
   Kommando `bun install --frozen-lockfile && bun e2e/pins.ts`, Tail `ALL PASS`.
   **Log-Pfad: unknown.** Der Lane-Report sagt nur "Log ausserhalb des Baums"
   (`fleet.json`, `events[56].payload.text`), und das Scratchpad der toten Lane
   (`/private/tmp/claude-501/…-fleet-260907052117-ca39/`) existiert nicht mehr. Ein Pfad wird
   hier nicht geraten.
   Zu `fb470c67` gehoert eine Warnung: das ist der PRE-REBASE-Commit der Lane. Er loest in der
   Object-DB dieses Checkouts auf, ist aber **kein Ancestor von main**
   (`git merge-base --is-ancestor fb470c67 main` → nein); ein frischer Klon findet ihn nicht.
   Der gelandete Zwilling heisst `f781c600`.
2. **Land-Gate, serverseitig — NICHT der Lane-Beleg:** Land-Note zu `f781c60` trägt
   `verify.mainSha` `2dfaa814`, `proportional:true`, `steps:["install","pins"]`, `ok:true`,
   748 ms (`git notes --ref=fleet/land show f781c60`). Er misst den Baum NACH dem Rebase, nicht
   den, auf dem die Lane gearbeitet hat.
3. **Lauf dieses Nachtrags:** §6.

## §1 Groessenbild je Rolle

**Drei Schichten, die diese Tabelle NICHT vermischt** (die Originalfassung nannte die ganze
Spalte "gemessen" und widersprach damit §4):

1. **GEMESSEN — Quellbytes.** Jeder Summand in der Spalte ist eine Datei- oder Abschnittsgroesse,
   mit `wc -c` am benannten Baum genommen. Diese Zahlen sind reproduzierbar.
2. **ABGELEITET — die Zuordnung Datei→Rolle.** Dass eine Rolle genau diese Dateien beim Start
   traegt, stammt aus Loader-Prosa (`AGENTS.md` §Loader boundary, `rulebook/loader.md`,
   `docs/steward.md`), nicht aus einem Zustell-Sensor. Einzige Ausnahme sind die Dispatch-Briefe:
   ihre `deliveredBytes` in `context-receipts.jsonl` sind wirklich beobachtet. Die Summen (`≈`)
   sind darum Vertragswerte, keine Messwerte.
3. **UNBEOBACHTET — der reale Verbrauch.** Keine Rolle wurde an einer laufenden Session am
   Fenster gemessen. Token = Bytes÷4 ist eine Umrechnung der Schicht-1-Zahlen, keine
   Verbrauchsmessung; die Prozente erben diese Eigenschaft. Prozent gegen 258 400
   (GPT-Abo-Fenster, Regelbuch §Modellpolitik) und 1 000 000.

Ladeannahme (Schicht 2): was der Harness beim Start automatisch laedt plus was die Rolle laut
eigenem Vertrag im ERSTEN Turn lesen soll.

| Rolle | Startladung (Quellbytes GEMESSEN, Zuordnung ABGELEITET) | ~Tok (Bytes÷4, kein Verbrauch) | % 258 400 | % 1 M |
|---|---|---|---|---|
| Controller / Program-MAIN (claude, Haupt-Checkout) | 8 090 (global `~/.claude/CLAUDE.md`) + 84 830 (CLAUDE.md main-Render, 7/7 Fragmente) + 226 (`.claude/CLAUDE.md`) + 13 242 (AGENTS.md §Portable operating contract — der ABSCHNITT, korrigiert §0) ≈ **106 388** | ~26 600 | ~10,3 % | ~2,7 % |
| Supervisor (claude, Haupt-Checkout) | 93 146 (dieselbe Basis) + 13 242 (§contract, in der Originalfassung vergessen — §0) + ~2 kB Supervisor-Brief (servergebaut) ≈ **108 400** | ~27 100 | ~10,5 % | ~2,7 % |
| Lane, claude-Harness (Worktree) | 8 090 + 37 226 (CLAUDE.md lane-Render, 3/7 Fragmente) + 13 242 (§contract, in der Originalfassung vergessen — §0) + Dispatch-Brief 7 278–9 478 (5 Receipts vom 09-07) ≈ **65 800–68 000** | ~16 500–17 000 | ~6,4–6,6 % | ~1,7 % |
| Lane, pi/codex-Harness (Worktree) | 8 082 (global `~/AGENTS.md`) + 21 368 (Projekt-AGENTS.md) + Dispatch-Brief ~7 360 (pi-zai-Receipt) ≈ **36 800** | ~9 200 | ~3,6 % | ~0,9 % |
| Steward (claude, Steward-Worktree, volles Laderitual) | 8 090 + CLAUDE.md-Kopie (Groesse n.g.) + 16 561 (README) + 11 671 (tailored-context) + 241 085 (verify-tiering) + 11 711 (steward.md) + 13 242 (§contract, in der Originalfassung vergessen — §0) ≈ **>302 000** | >75 000 | >29 % | >7,6 % |
| Skills (bei Trigger, on demand) | graphify 40 495 · unslop 4 121 · mess-notiz 5 534 · kriterium-grill 3 361 | 10 100 max | 3,9 % max | 1,0 % max |

Einzelmessungen: Fragmente loader 3 264 / einstieg 22 891 / lane-discipline 23 126 / supervisor
3 916 / self-scheduling 10 006 / deploy 19 935 / graphify 1 670 (Summe 84 808; main-Render 84 830,
lane-Render 37 226 — reconciliert mit `rulebook.ts` `FRAGMENTS_FOR`: lane = loader+lane-discipline+
self-scheduling). SYSTEM.md 13 120 · README 16 561 · controller.md 6 818 · steward.md 11 711 ·
lane-brief-template.md 9 331 · context-packs.json 1 441 · AGENTS.md 21 368 GANZ, davon
§Portable operating contract 13 242 (Zeile 22–171 am main `0352148e`; die Tabelle oben nutzt
seit §0 den Abschnittswert — ausser fuer pi/codex, die die ganze Datei laden).

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
   NACHTRAG (§0 Punkt 2): der Widerspruch bleibt, die Folgerung war zu weit. Das FEHLENDE lokale
   `graphify-out/` macht die Main-Graph-Query nicht nutzlos — mechanisch geprueft aus dieser Lane:
   `graphify` liegt auf dem PATH (`/Users/owner/.local/bin/graphify`), `ls -d graphify-out`
   schlaegt im Worktree fehl, und
   `"$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json"` loest auf eine
   lesbare 10,6-MB-Datei im Haupt-Checkout auf. Eine Lane verliert also nur `update`/`save-result`,
   nicht die Abfrage.

2. **[F] Zeilenverweise im UNDATIERTEN einstieg.md gedriftet.** `einstieg.md:34` nennt
   `laneWatchSignal` (`lane-signals.ts:92`) und `einstieg.md:36` `host-commit-looking`
   (`lane-signals.ts:73`); tatsaechlich liegt der Typ bei `lane-signals.ts:126` und der Abschnitt
   bei `:100` (Zeile 92/73 zeigen auf Anderes). Verstoesst gegen die eigene Owner-Promotion
   „Symbolverweise statt Zeilenverweise in undatierten Docs" (lane-discipline.md, 2026-08-25).
   Fix: `datei#symbol`. Verify: `rg -n 'laneWatchSignal|host-commit-looking' lane-signals.ts`.

3. **[V] Controller/MAIN-Startlast ~106,4 kB ≈ 26,6 k Tok ≈ 10,3 % des GPT-Fensters vor dem
   ersten Toolcall** (korrigiert §0; urspruenglich ~114,5 kB / 28,6 k Tok / 11 %).
   8 090 global + 84 830 main-Render + 226 + 13 242 portabler Kontrakt (Loader-Vertrag ordnet das
   Lesen des ABSCHNITTS an, nicht der Datei). Die Rangfolge des Befundes aendert sich nicht — der
   groesste Einzelposten bleibt der main-Render mit 84 830 B (80 % der Startlast), und der
   korrigierte Kontrakt ist mit 13 242 B nur noch der drittgroesste Posten. Jede Nachricht an die MAIN zahlt das erneut als Input
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

9. **[E] Pending-Verweis `97c5d469` + `ctl.sh` in docs/controller.md:53** (nicht `:34` — die
   Originalfassung nannte die falsche Zeile; schon am Land-Commit `f781c60` stand der Satz auf
   53). `ctl.sh` existiert nicht (`test -e` fehlgeschlagen).
   KORREKTUR (§0 Punkt 3): `97c5d469` ist **keine SHA, sondern eine Task-Id** — die
   Originalfassung stufte sie als „tote SHA"-Verwandte ein und schloss daraus, der Status sei
   nicht pruefbar. Beides ist falsch. `git cat-file -t 97c5d469` scheitert genau deshalb, weil es
   nie ein git-Objekt war; die Zeile steht als `tasks[].id` in `fleet.json` (Stand dieses
   Nachtrags: `kind:"auftrag"`, `status:"sent"`, `slot:11`, Titel „CONTROLLER-WERKZEUGE · `ctl.sh`
   MIT ACHT VERBEN"). Eine Nachfolge-Controllerin KANN den Status also pruefen — ueber die
   Task-Queue, nicht ueber git. Das Restrisiko ist kleiner und anders: die Formulierung „Zeile"
   laesst offen, in welchem Register man nachschlaegt.
   Fix: in controller.md als `Task-Id 97c5d469` ausschreiben. Verify:
   `git cat-file -t 97c5d469` (scheitert, ist KEIN Defekt) und
   `python3 -c "import json;print([t['status'] for t in json.load(open('fleet.json'))['tasks'] if t['id']=='97c5d469'])"`.

10. **[V] `einstieg.md` nennt „`server.ts` sind 24 603 Zeilen (gemessen 2026-09-04)" — heute
    26 748** (WC, dieser Baum; +8,7 %). Datiert, also ehrlich, aber die Zahl ist
    Brief-Checklisten-Input: Kostenschaetzungen fuer `server.ts`-Fenster laufen seit 4 Tagen ~9 %
    unter. Fix: „aktuell `wc -l` nachmessen" als Klausel daneben. Verify: `wc -l server.ts`.

11. **[F] context-packs.json `messnotiz-index` estimatedBytes 11 700 vs. real 34 733**
    (`docs/messungen/INDEX.md`, Faktor 3); `rulebook-generat` 25 900 vs. 28 894 (rulebook.ts
    6 503 + inventar 22 391) ist nur ~10 % zu klein. Die Abweichung selbst steht.
    KORREKTUR der Kostenaussage (§0 Punkt 4): die Originalfassung nannte `estimatedBytes` „was der
    Planer ueber Ladekosten glaubt", ohne einen Nutzer zu benennen. Nachgemessen — und das
    Ergebnis ist schwaecher als der Satz:
    `rg -n estimatedBytes server.ts src/client.ts rulebook.ts` findet **NICHTS**. Die einzigen
    Fundstellen im Baum sind vier Dateien:
    `context-packs.ts` (die sechs Literale selbst) · `context-plan.ts#planContext` und
    `#planRepoContext` (kopieren das Feld in die Selektion) ·
    `context-manifest.ts#readContextManifest` (kopiert es aus einem Repo-Manifest) ·
    `context-pack-validator.ts` (prueft nur `finite && >= 0`, Fehlercode `ESTIMATED_BYTES_INVALID`).
    **Kein Codepfad rechnet, vergleicht oder budgetiert damit**, und weder
    `server.ts#renderContextAnchorBlock` noch `server.ts#contextReceiptSelections` traegt das Feld
    in einen zugestellten Brief oder ein Receipt (beide Funktionen voll gelesen).
    Damit ist die Kostenaussage zurueckzunehmen: eine falsche `estimatedBytes` verbrennt heute
    **keine Tokens** ([V] trifft nicht zu) und aendert **keine Auswahl**. Das [F] im Kopf dieses
    Befundes bleibt, schrumpft aber auf einen Weg: ein MENSCH (oder eine Session), der die
    Packliste liest und den Faktor 3 fuer eine Ladekostenangabe haelt, plant falsch. Der Befund
    wird erst wieder teuer, sobald ein Budget-Konsument gebaut wird — heute existiert keiner.
    Fix: nachmessen und eintragen. Verify: `wc -c docs/messungen/INDEX.md` und
    `rg -n 'estimatedBytes' context-packs.ts context-plan.ts context-manifest.ts context-pack-validator.ts`.

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
    Fleet-Lane schnell feuert. ~10 k Tok.
    KORREKTUR (§0 Punkt 2): die Originalfassung nannte den Trigger „nutzlos", weil `graphify-out/`
    im Worktree per Konstruktion nie existiert. Das Fehlen ist richtig, die Folgerung war falsch —
    seit `49e35f6` (2026-08-31, „docs(agents): graphify in a lane queries the main checkout's
    graph read-only") befragt eine Lane den Main-Graphen read-only:
    `graphify query "<frage>" --graph "$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json"`
    (`AGENTS.md:274-285`, `rulebook/graphify.md`). Aus dieser Lane geprueft: Binary auf dem PATH,
    kein lokales `graphify-out`, Zieldatei 10 560 987 B lesbar.
    Der Befund verkleinert sich damit auf seinen echten Kern: 40 495 B fuer einen Skill, dessen
    lane-relevanter Teil ein einziges Query-Kommando ist, waehrend die uebrigen Regeln
    (`update`, `save-result`, `wiki/index.md`, `GRAPH_REPORT.md`) in einer Lane nicht greifen.
    Fix: lane-seitige Trigger-/Regelbeschreibung auf den Read-only-Pfad kuerzen (Owner-Entscheid).
    Verify: `wc -c .claude/skills/graphify/SKILL.md` und der Query-Einzeiler aus einem Worktree.

15. **[V] AGENTS.md Game-Maker-Preflight-Prosa laedt JEDE Fleet-Session** (nicht nur pi/codex —
    korrigiert §0), bindet aber nur Game-Program-MAINs und deren Reviewer. Nachgemessen:
    `git show main:AGENTS.md | sed -n '79,109p' | wc -c` = **2 818 B von 13 242 B = 21 % des
    portablen Kerns** (~700 Tok), nicht die urspruenglich geschaetzten ~3,3 kB. Die Fable-Haelfte
    misst denselben Block unabhaengig auf 2 818 B (`…-fable.md:193-203`). Weil der Block INNERHALB
    von Zeile 22–171 liegt, laedt ihn auch jede Claude-Session, die den Abschnitt laut
    Loader-Vertrag liest — die Originalfassung schrieb ihn nur den pi/codex-Lanes zu. VERMUTET als Bloat — die Autoritaet ist die Owner-Promotion, nicht dieses Urteil;
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

## §4 Abdeckung — was gemessen, was abgeleitet, was nicht geprueft

Ausdrueckliche Ausweisung nach §0 Punkt 6. Die Originalfassung nannte nur Luecken; sie trennte
nicht, welche Aussage auf einer eigenen Messung steht und welche aus Prosa abgeleitet ist.

**GEMESSEN — Datei ganz gelesen oder mit `wc -c`/`wc -l` vermessen:**
`AGENTS.md` (ganz gelesen und vermessen; §contract im Nachtrag neu abgegrenzt) · alle sieben
`rulebook/`-Fragmente (Groesse; loader/einstieg/lane-discipline/supervisor/graphify inhaltlich) ·
`CLAUDE.md` main- und lane-Render (Groesse; Rekonziliation gegen `rulebook.ts#FRAGMENTS_FOR`) ·
`~/.claude/CLAUDE.md` (nur Groesse 8 090, Inhalt NICHT gelesen) · `.claude/CLAUDE.md` (226) ·
`README.md` 16 561 · `docs/tailored-context.md` 11 671 · `docs/verify-tiering.md` 241 085 (nur
Groesse) · `docs/steward.md` 11 711 (gelesen) · `docs/controller.md` (gelesen) ·
`docs/lane-brief-template.md` 9 331 · `SYSTEM.md` 13 120 (nur Groesse) ·
`.claude/skills/{graphify,unslop,mess-notiz,kriterium-grill}/SKILL.md` (Groessen; graphify nur
Kopf bis Zeile 60) · `context-packs.json` 1 441 · `context-receipts.jsonl` (5 Receipts vom 09-07,
`deliveredBytes` je Zustellung — die einzige BEOBACHTETE Zustellgroesse dieser Notiz) ·
`docs/messungen/INDEX.md` 34 733 · `deploys.jsonl` (1 Treffer-Grep).
Im Nachtrag zusaetzlich gemessen: `fleet.json` `tasks[]`/`events[]` (zwei gezielte Lookups),
Land-Note zu `f781c60`, `lane-outcomes.jsonl` Zeile 825, `context-packs.ts`, `context-plan.ts`,
`context-manifest.ts`, `context-pack-validator.ts`, `server.ts#renderContextAnchorBlock` und
`#contextReceiptSelections` (beide ganz).

**NUR IN FENSTERN GELESEN (Aussage traegt nur fuer das Fenster):** `server.ts`, ~600 von 26 748
Zeilen — `laneOwnerPrompts`, `briefAndSend`, `LANE_EXIT_FOOTER`, `buildProgramMainBrief`,
`buildSupervisorBrief`, `succeedSupervisor`, `renderContextAnchorBlock`, plus die zwei
409-Stichproben (`nudge`, `isBoundSupervisor`).

**ABGELEITET, NICHT BEOBACHTET — der schwaechste Teil dieser Notiz:** die ZUORDNUNG Datei→Rolle
in §1. Gemessen sind Datei-GROESSEN; dass eine Rolle genau diese Dateien beim Start traegt, ist
aus Loader-Prosa abgeleitet (`AGENTS.md` §Loader boundary, `rulebook/loader.md`, `docs/steward.md`
Session-Start-Sequenz), nicht aus einem Zustell-Sensor. Einzige Ausnahme: die Dispatch-Briefe,
die als `deliveredBytes` in `context-receipts.jsonl` wirklich beobachtet sind. Konkret UNBELEGT
bleiben damit: ob der Harness `AGENTS.md` neben `CLAUDE.md` selbst laedt oder erst der Vertrag es
anordnet · ob der Steward sein Ritual je voll gefahren ist · ob eine MAIN den obersten
`HANDOFF.md`-Block tatsaechlich liest. §1 ist ein VERTRAGS-Groessenbild, kein Verbrauchsbild.

**Rollen: gemessen vs. abgeleitet.** Keine Rolle wurde an einer laufenden Session beobachtet.
Am dichtesten belegt ist die Lane (Receipts + eigener Worktree), am duennsten der Steward
(fremder Worktree, CLAUDE.md-Kopie dort nie gesehen — die Zeile ist deshalb ein `>`-Wert) und
der Supervisor (nur Brief-Code gelesen, keine Zustellung).

**Nicht geprueft (unveraendert aus der Originalfassung):**

- Gemessener Tokenverbrauch irgendwo — alles in §1 ist Bytes÷4. (Die Fable-Notiz war bis §5
  faellig und ist dort abgeglichen.)
- `MEMORY.md` (4 337 B laut Fable-Haelfte) und der oberste `HANDOFF.md`-Block (6 896 B ebenda)
  waren nie in meiner Quellenliste und fehlen darum in JEDER Zeile von §1 — die Zahlen dort sind
  entsprechend zu niedrig, siehe die Rekonziliation in §5.
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
- Groessenbild konvergent: Controller ~114 kB / ~28,5–28,6 k Tok / ~11 %.
  **KORREKTUR (§0 Punkt 1): die Uebereinstimmung der ~114 kB war ein Zufall zweier
  gegenlaeufiger Fehler.** (Der Nachtrag §0 schloss daraus „ohne sie ist die Konvergenz
  staerker" — das war zu viel; siehe die Aufloesung nach der Rechnung und §7 Punkt 2.)
  Beide Haelften kamen auf ~114 kB,
  aber mit unterschiedlicher Zusammensetzung: ich zaehlte `AGENTS.md` GANZ (21 368 statt 13 242,
  +8 126) und liess `MEMORY.md` und den obersten `HANDOFF.md`-Block ganz weg (−11 233); Fable
  zaehlte den Abschnitt richtig und beide Dateien mit, mass aber den main-Render einen Tag frueher
  (81 293 statt 84 830, −3 537). Rechnet man beide auf dieselbe Zusammensetzung und denselben
  Render:
  GLM korrigiert 106 388 + `MEMORY.md` 4 337 + `HANDOFF.md`-Block 6 896 = **117 621**;
  Fable 114 084 + Render-Zuwachs 3 537 = **117 621**.
  **Diese Byte-Gleichheit ist KEINE unabhaengige Zweitmessung, sondern eine Additions-Identitaet
  — und die Originalfassung („zweimal unabhaengig erreicht") hat sie als Bestaetigung gelesen.**
  Beide Seiten sind derselbe Satz von sechs Summanden, nur in anderer Reihenfolge notiert:
  8 090 + 84 830 + 226 + 13 242 + 4 337 + 6 896. Fables 114 084 enthaelt bereits 8 090, 81 293,
  226, 4 337, 13 242 und 6 896; die 3 537, die ich addiere, sind genau die Differenz
  84 830 − 81 293 aus MEINER Messung. Es wird also einmal gerechnet und zweimal aufgeschrieben;
  die Gleichheit koennte gar nicht ausbleiben und traegt darum kein Bestaetigungsgewicht.
  Was je Summand wirklich vorliegt:
  - **Von beiden Haelften unabhaengig gemessen und uebereinstimmend:** `~/.claude/CLAUDE.md`
    8 090 · `.claude/CLAUDE.md` 226 · `AGENTS.md` §Portable operating contract 13 242 (§0 Punkt 1).
    Nur diese drei sind doppelt belegt.
  - **Von beiden gemessen, aber an verschiedenen TAGEN:** der main-Render (Fable 81 293 am 09-06,
    ich 84 830 am 09-07). Die 3 537 sind die datumsuebergreifende Normalisierung dieses einen
    Summanden — der eigentliche Zweck der Rechnung.
  - **Nur von Fable gemessen, von mir UNGEPRUEFT uebernommen:** `MEMORY.md` 4 337 und der oberste
    `HANDOFF.md`-Block 6 896 (`docs/messungen/2026-09-06-kontext-gesundheit-fable.md:27`). Beide
    Dateien standen nie in meiner Quellenliste (§4) — ich habe sie nicht nachgemessen.
  Die belastbare gemeinsame Aussage lautet also nicht „~114 kB", sondern: **eine
  Controller-Startladung von ~117,6 kB ≈ 29,4 k Tok ≈ 11,4 % des 258-400-Fensters** — eine EINZIGE
  auf denselben Tag und dieselbe Zusammensetzung normalisierte Rechnung aus beiden Haelften, von
  der drei Summanden doppelt, einer datumsbereinigt und zwei nur einfach belegt sind. Die Zeile in
  `docs/messungen/INDEX.md:90` traegt noch die alte Zahl (~114,5 kB) — sie wurde in diesem
  Nachtrag bewusst nicht angefasst (Auftrag: keine INDEX-Aenderung).

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
  (GLM #8), Pending-Verweis Task-Id 97c5d469/ctl.sh (GLM #9 — im Nachtrag als Task-Id korrigiert,
  keine tote SHA), fehlende Fuellstand-Selbstmeldung im
  servergebauten Footer (GLM #5), fehlender MAIN→Controller-Rueckkanal gegen nudge-409 am Code
  verifiziert (GLM #6), Begriff „codex-MAIN" nirgends definiert (GLM #17), Deploy-Id 82f55be0
  keine tote SHA (GLM #20 — Klasse, die Fable nicht pruefte).
- Nur Fable: Lane-Render traegt ~6–7 kB Nicht-Lane-only-Regeln (Fable #11) — ich mass die
  komplementaere MAIN-Seite (supervisor/deploy-Fragmente in jedem main-Render, GLM #7); beide
  halten zusammen: die Audience-Partition ist an beiden Enden zu grob geschnitten.
- Render-Groessen differieren (Fable 81 293/35 209 B am 09-06, HEAD 6c089dd; GLM 84 830/37 226 B
  am 09-07 am Haupt-Checkout) — das Regelbuch wuchs ~3,5 kB an einem Tag; keine Widerlegung.
  Genau dieser Zuwachs von 3 537 B ist der Rest, der die Rekonziliation oben aufgehen laesst.

## §6 Verify-Lauf dieses Nachtrags

Eigener Beleg, getrennt vom Originallauf in §0. Diff-Datei: ausschliesslich diese Notiz.

    Baum:     Branch fleet/260907203323-0331, Basis main 0352148e
    Lane-Sha: d11235fe (der Commit, auf dem dieser Lauf lief — der Lane BEKANNT, siehe unten)
    Gelandet: 7539985d (Rebase-Land 2026-09-08 02:2x; nachgetragen vom Controller, nicht
              von der Lane)
    Kommando: bun install --frozen-lockfile && bun e2e/pins.ts
    Log:      <scratchpad>/verify-nachtrag.log (ausserhalb des Baums, stirbt mit der Session)
    Tail:     "ALL PASS" (exit 0)
    Umfang:   proportional install+pins — die einzige Diff-Datei ist diese Notiz (docs-or-prose)

**Was die Lane wusste und was nicht — die Originalfassung hat das eine mit dem anderen begruendet.**
Sie liess den Lane-Sha weg mit der Begruendung, er „loest nach dem Land nirgends mehr auf"; die
Nachfolgefassung schrieb dasselbe als „loest auf main nicht mehr auf". Beides ist falsch, und §0
Punkt 5 sagt es fuer `fb470c67` bereits richtig:

- **Bekannt war der eigene Sha immer.** `d11235fe` stand der Lane waehrend des Laufs zur
  Verfuegung (`git rev-parse HEAD`). Unbekannt war ausschliesslich der KUENFTIGE Landing-Sha, den
  der Rebase erst beim Land vergibt — genau er ist der Grund, warum nur die MAIN `7539985d`
  nachtragen kann.
- **Ein Rebase macht das Objekt nicht unaufloesbar.** `d11235fe` existiert in der Object-DB dieses
  Checkouts weiter und ist nur nicht mehr erreichbar von `main`:

      git cat-file -t d11235fe                                  # commit
      git merge-base --is-ancestor d11235fe main; echo $?        # 1  → kein Ancestor
      git cat-file -t 7539985d                                   # commit
      git merge-base --is-ancestor 7539985d main; echo $?        # 0  → Ancestor

  Was nach dem Land wirklich gilt: der pre-rebase-Commit ist **nicht Teil der main-Historie**, und
  ein FRISCHER Klon findet ihn nicht, weil er nie gepusht wurde — nicht, weil der Rebase ihn
  geloescht haette. Unerreichbar heisst hier: irgendwann `gc`-faehig, heute vorhanden.
- **`--is-ancestor` beantwortet nicht die Existenzfrage.** Es prueft ABSTAMMUNG und setzt voraus,
  dass beide Objekte aufloesen; auf ein fehlendes Objekt antwortet es mit einem FEHLER, nicht mit
  „nein" — gemessen am 2026-09-08 an main `d832a679`: `git merge-base --is-ancestor
  0000000000000000000000000000000000000001 main` gibt `fatal: Not a valid commit name` und
  **exit 128**, waehrend ein echtes Nicht-Ancestor-Objekt exit **1** gibt. Wer nur auf „exit != 0"
  prueft, verwechselt beide Faelle. Existenz fragt man mit `git cat-file -t <sha>`. Die Aussagen
  sind darum getrennt zu fuehren: `7539985d` loest auf UND ist Ancestor; `d11235fe` loest auf UND
  ist es nicht.

Der Sha des Laufs, der DIESE Korrektur belegt, steht nicht in diesem Dokument: er waere
selbstreferenziell (der Commit kann seinen eigenen Hash nicht enthalten) und nach dem Rebase
ohnehin ein anderer. Kandidaten-Sha und absoluter Log-Pfad gehen im Lane-Report an die MAIN;
eingetragen wird hier nichts, was die Lane nicht wissen kann.

## §7 Nachtrag 2026-09-08 — drei Widersprueche nach zweiter Rueckgabe

Die Fassung von §0 wurde am 2026-09-08 02:2x als `7539985d` gelandet, obwohl der zugehoerige
Report (`5aa233ab`) zu diesem Zeitpunkt **rejected** war; die Rueckgabe der Review-MAIN blieb
damit unbearbeitet im gelandeten Text stehen. Dieser Nachtrag arbeitet ihre drei Punkte ab —
wieder eine Textkorrektur, kein neuer Sweep, wieder nur diese eine Datei. Wie in §0 gilt: die
Originalformulierungen stehen hier, weil ein datierter Snapshot nicht still umgeschrieben wird.
Die **sechs Korrekturen aus §0 bleiben unangetastet** und sind auf den heutigen main-Stand
uebernommen worden, nicht auf die alte Fassung.

Messbasis dieses Nachtrags: main `d832a679`, 2026-09-08. Die Zahlen aus §0 und §1 wurden NICHT
neu erhoben — korrigiert ist, was ueber sie behauptet wird.

| # | Rueckgabe-Punkt | Original | Korrigiert |
|---|---|---|---|
| 1 | Frontmatter + §1-Tabelle | `urteil` sagt „verbrennt pro MAIN ~106,4 kB", Spaltenkopf sagt „Bytes, gemessen" — beides behauptet Verbrauchsmessung, waehrend §4 die Zuordnung ausdruecklich als abgeleitet und unbeobachtet ausweist | drei Schichten getrennt: **gemessene Quellbytes** (Schicht 1) · **abgeleitete Zuordnung Datei→Rolle** (Schicht 2, Ausnahme `deliveredBytes`) · **unbeobachteter realer Verbrauch** (Schicht 3). Spaltenkopf, `urteil` und `nicht-gemessen` tragen die Trennung jetzt |
| 2 | §5, die Zahl 117 621 | „Byte-genau dieselbe Zahl … zweimal unabhaengig erreicht" | Additions-Identitaet aus **einem** Satz von sechs Summanden. Drei davon (8 090 · 226 · 13 242) sind doppelt gemessen, einer (main-Render) datumsbereinigt, **zwei (`MEMORY.md` 4 337, `HANDOFF.md`-Block 6 896) stammen allein aus der Fable-Notiz und wurden von mir nie nachgemessen**. Es ist eine datumsuebergreifende Normalisierung, keine unabhaengige Zweitmessung |
| 3 | §6, die Sha-Begruendung | „der pre-rebase-Commit loest auf main nicht mehr auf" — und der Lane-Sha fehlte mit ebendieser Begruendung | getrennt: der eigene Sha war der Lane **bekannt** (`d11235fe`, jetzt eingetragen), unbekannt war nur der kuenftige Landing-Sha · ein Rebase macht Objekte **nicht unaufloesbar** (`git cat-file -t d11235fe` → `commit`) · `--is-ancestor` prueft **Abstammung, nicht Existenz** (exit 1 = kein Ancestor, exit 128 = Objekt fehlt) |

Punkt 3 hatte eine zweite Haelfte: die Rueckgabe verlangt ausdruecklich **keine
selbstreferenzielle Sha im Dokument**. Der Kandidaten-Sha dieses Nachtrags und der absolute
Log-Pfad seines Verify-Laufs gehen darum in den Lane-Report an die Review-MAIN, nicht in diesen
Text — ein Commit kann seinen eigenen Hash nicht enthalten, und nach dem Rebase-Land traegt
derselbe Inhalt ohnehin einen anderen.

Verify-Lauf dieses Nachtrags: Kette und Ergebnis stehen im Lane-Report; Umfang ist erneut
proportional (`install`+`pins`), da die einzige Diff-Datei diese Notiz ist (docs-or-prose).
