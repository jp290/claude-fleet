# Agent OS P0-A — Regeln und Kontext

**Stand:** HEAD `b29d2c7`, 2026-08-11 · **Art:** read-only Inventar · **Gate:** G0

**Ablaufdatum:** Nach G0 ist `agent-os-synthesis.md` die operative Wahrheit. Dieses Inventar
wandert beim ersten Phase-1-Land nach `docs/attic/agent-os-2026-08-11/` und wird nicht weiter
gepflegt.

## Ergebnis in einem Satz

Fleet hat bereits einen starken portablen Sicherheitskern und ein reiches privates Incident-
Archiv; der Defekt ist nicht Regelmangel, sondern dass `AGENTS.md` Codex/pi auf ein fast 100-KB-
Gesamtbuch verweist, ohne taskbezogenes Routing oder einen Live-Beleg, was der Harness wirklich
geladen hat.

## Gemessener Bestand

| Traeger | Bytes | Getrackt | Heutige Rolle |
|---|---:|---|---|
| `AGENTS.md` | 5.534 | ja | portabler Codex-/pi-Kern: Done, Verify, Land, rote Checks, Testort, Reporting |
| privates `CLAUDE.md` | 98.663 | nein | Main-Betrieb, Incident-Regeln, Lane-Disziplin, Self-Scheduling, Deploy, Harness-Fakten |
| `.claude/CLAUDE.md` | 226 | ja | Claude-seitiger Hinweis nur auf `graphify` |
| `.claude/commands/*.md` | 32.440 | ja | fuenf operative Claude-Rituale |
| `commands/*.md` | 4.198 | ja | zwei weitere Prompt-/Arbeitskommandos |
| `.claude/skills/graphify/SKILL.md` | 40.495 | ja | ein sehr breiter Skill-Vertrag |

Messung: `wc -c` gegen denselben HEAD. Die Bytezahl ist nur eine Sekundaermetrik; der historische
Lane-Kostenbefund in `docs/attic/lane-cost-study.md` zeigt, dass Tool-Ergebnisse und das erneute
Lesen des Gespraechs den groesseren Kontexthebel bilden.

## Loader-Matrix: Fakt, Claim und Unknown

| Harness | Automatisch belegt | Danach verlangt | Status |
|---|---|---|---|
| Claude | privates `CLAUDE.md` laut Repo-Konvention | keine zweite Voll-Lektuere | Claim aus Regelbuch; frische Live-Probe in P1-D noetig |
| Codex | `AGENTS.md` | `CLAUDE.md` voll lesen | Auto-Load in `AGENTS.md` dokumentiert; manuelle Folgelast nicht gemessen |
| pi | `AGENTS.md` | `CLAUDE.md` voll lesen | Live-Pane-Messung vom 2026-08-08 in `AGENTS.md`/`CLAUDE.md`; erneut messen |
| container | haengt vom Agent im Container und dessen Mount ab | heute kein eigener Routervertrag | unknown; `server.ts::CONTAINER_HARNESS` misst keinen Host-Transcript |

Der entscheidende Unterschied ist: „Datei automatisch im Boot-Kontext“ und „Agent wurde
angewiesen, sie spaeter komplett zu lesen“ sind zwei verschiedene Kosten und zwei verschiedene
Fehlermodi. P1-D muss beide beobachten.

## Klassifikation der heutigen Regelgruppen

| Klasse | Bleibt wo | Beispiele / Anker |
|---|---|---|
| `core` | kompakt in `AGENTS.md` | Done+Beweis, ordered Verify, Tree-Hygiene, fail-as-itself, questions read-only, Scope/Stop, ehrliches Reporting |
| `private-overlay` | privates `CLAUDE.md` | Deploy-Realitaet, lokale Credentials/Services, private Maschinen- und Owner-Fakten |
| `topic-routed` | bestehende Docs oder kleine Module | `docs/land-mechanics.md`, `docs/verify-tiering.md`, `docs/tailored-context.md`, `docs/lane-brief-template.md`, Harness-/Self-Scheduling-Abschnitte |
| `history/evidence` | Commit-Body oder Attic | datierte Incident-Erzaehlung, verworfene Varianten, alte Messpopulationen |

Die Einteilung ist eine Zielklassifikation, noch kein Verschiebeauftrag. Insbesondere wird kein
Text aus dem privaten Buch kopiert, bevor Boot-Matrix, Canary und Redaktionsreview bestanden sind.

## Dubletten, Widersprueche und Last

1. **Autoritaetswiderspruch:** `AGENTS.md` sagt, bei Konflikt sei `CLAUDE.md` die Wahrheit. Fuer
   Codex/pi ist diese Wahrheit aber nicht automatisch geladen und unversioniert. Ein stiller Drift
   kann daher weder am Commit noch am Context Plan aufgeloest werden.
2. **Verify-Dopplung mit Absicht:** Die komplette Befehlsfolge steht in `AGENTS.md` und privat.
   Solange mehrere Harnesses unterschiedliche Startdateien laden, ist das ein notwendiges
   must-agree-Paar und gehoert mechanisch nach `e2e/pins.ts`, nicht per Hoffnung synchronisiert.
3. **Incident-Archiv im Ausfuehrungspfad:** Das private Buch mischt aktuelles Verhalten,
   historische Messung, Ausnahmen und Bedienanleitung. Diese Herkunft ist wertvoll, aber nicht
   jede Erzaehlung muss fuer jede Task im Prompt stehen.
4. **Brief-Doktrin versus Realitaet:** `docs/tailored-context.md` und
   `docs/lane-brief-template.md` verlangen schmale, passende Kontexte; Codex/pi erhalten danach
   dennoch den Auftrag zur Komplett-Lektuere des privaten Buchs.
5. **Keine messbare Tool-Output-Regel:** Das private Buch kennt bereits „Zeilenbereiche, Tails,
   Ausgaben in Datei“. Dieser grosse Hebel ist noch keine gemessene Lane-Eigenschaft.

## Vorgeschlagener Governance-Kern fuer G0

### Gemeinsames Glossar

- **Owner:** Mensch, der Scope, Promotion, Gate-Waiver, Land und Deploy entscheidet.
- **Maintainer:** koordinierende Main-Session; synthetisiert Belege und schneidet Arbeit.
- **Agent/Session:** laufender Executor bzw. dessen fortsetzbarer Arbeitskontext.
- **Harness:** Adapter, der Spawn, Modell, Resume, Transcript und Capabilities ehrlich beschreibt.
- **Slot:** wiederverwendbarer Fleet-Platz; keine dauerhafte Identitaet.
- **Lane:** isolierte, wegwerfbare Arbeitskopie fuer Produktion.
- **Task:** Owner-sichtbare Arbeitseinheit in der bestehenden Queue.
- **Brief:** exakt bestaetigter Auftrag, den eine Lane erhaelt.
- **Context Pack:** versionierter Verweis auf vorhandene Regeln, keine Inhaltskopie.
- **Capability:** mechanisch pruefbare Moeglichkeit am Ziel; kein Wunsch.
- **Skill:** triggerbarer Arbeitsvertrag, der Capabilities voraussetzt.
- **Verify / Land / Deploy / Audit:** Beweis im Lane-Baum / serverseitige Promotion / laufende
  Instanz erneuern / Nachmessung am gelandeten Baum.

### Harte Invarianten

`unknown` bleibt unknown · propose/promote · questions/review/diagnose read-only · Mutation nur im
benannten Scope · ein Diff pro Owner-Schnitt · keine private Identitaet im public tree · keine
Capability ohne Probe · Done hat einen Beweisbefehl · Stop vor Land/Deploy/Host-Sync ohne Auftrag ·
Code/Ledger gewinnt gegen Planprosa · keine zweite Queue oder Wissensdatenbank.

### Defaults, keine Invarianten

Maximal zwei Produktionslanes · Claude als Default-Harness · Context Packs als Pfad+Anchor ·
Owner-Adjudikation per Stichprobe · private Packs in v1 mit Hash+Zeitstempel · 14-Tage-/10-Lane-
Timebox. Diese Werte duerfen spaeter mit Beleg veraendert werden.

## Erste Context-Pack-Schnitte

| Pack | Trigger | Quellen | Haerte |
|---|---|---|---|
| `core-work-contract` | jede produzierende Lane | kompakter getrackter Kern | hard |
| `verify-and-e2e` | Tests, Gate, Merge, e2e-Dateien | `AGENTS.md`, `docs/verify-tiering.md`, passende e2e-Familie | hard bei Treffer |
| `land-mechanics` | Merge, Rebase, Land, Branch | `docs/land-mechanics.md` | hard |
| `task-and-queue` | Task-/Brief-/Queue-Surface | `docs/queue-analyst.md`, aktiver Queue-Plan | routed |
| `harness-adapter` | Adapter, Spawn, Context, Sandbox | getrackte Adapter-Docs + private lokale Caveats | routed/private |
| `deploy-private` | ausdruecklicher Deploy-/Hostauftrag | nur privates Overlay | private hard |

Kein Pack darf die Quellen kopieren. `paths/anchors`, Trigger, Requirements, Content-Hash und
Kosten reichen; fuer private Quellen ist der Hash ohne private History nicht aufloesbar.

## Canary- und Redaktionsanforderung fuer P1-C

Vor und nach einem Split beantworten frische Claude-, Codex- und pi-Lanes dieselben drei Fallen:

1. Welche Verify-Reihenfolge gilt, und wann muss die Suite am ersten Fehler stoppen?
2. Wer committet eine Codex/pi-Lane, und welche Suite-Grenze darf die Lane ehrlich behaupten?
3. Wie wird ein roter Check oder eine nicht laufende Probe berichtet?

Der oeffentliche Diff bekommt danach einen zweiten read-only Blick auf Identitaeten, Host-/Netz-
Details, Credential-Orte, private Skillpfade und Betriebsgeheimnisse. Bekannte Literal-Greps sind
eine Zusatzprobe, kein Ersatz.

## Offene G0-Entscheide

- Darf der vorgeschlagene Glossar-/Invariantensatz der getrackte Kern werden?
- Bleibt privates Overlay in v1 unversioniert mit ehrlichem Hash+Zeitstempel, oder soll vor P1-C
  eine separate private History entstehen?
- Rechtfertigt die noch ausstehende Boot-Matrix ueberhaupt einen privaten Split fuer alle Harnesses?

## Nicht geprueft

Keine frische Harness-Pane wurde gestartet; automatische Loader-Fakten sind deshalb historisch,
nicht am heutigen Prozess neu gemessen. Es wurden keine privaten Inhalte in dieses getrackte
Inventar kopiert und keine Regeldatei veraendert.
