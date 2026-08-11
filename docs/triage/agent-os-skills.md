# Agent OS P0-B — Skills und Capabilities

**Stand:** HEAD `b29d2c7`, 2026-08-11 · **Art:** read-only Inventar · **Gate:** G0

**Ablaufdatum:** Nach G0 ist `agent-os-synthesis.md` die operative Wahrheit. Dieses Inventar
wandert beim ersten Phase-1-Land ins Agent-OS-Attic.

## Ergebnis in einem Satz

Fleet hat bereits eine brauchbare Harness-Capability-Quelle in `server.ts`, aber keine gemeinsame
Registry fuer Skills, Requirements, Scope, Mutation und tatsaechliche Installation; der einzige
Repo-Skill `graphify` ist zugleich Query, Builder, Installer, Exporter und Watcher.

## Sichtbare Skill- und Command-Wurzeln

| Wurzel | Bestand | Scope | Status |
|---|---:|---|---|
| `.claude/skills/` | 1 Skill (`graphify`) | repo/Claude | getrackt, Versionmarker vorhanden |
| `.claude/commands/` | 5 Commands | repo/Claude | `foreman`, `inspektion`, `projekt-blick`, `rundgang`, `steward` |
| `commands/` | 2 Commands | repo/Agent-Prompt | `gosharp`, `sharpen`; kein gemeinsames Manifest |
| Session-/globale Skills | dieser Session teilweise bekannt | user/machine | ausserhalb des Repos; weder Fleet-Inventar noch stabile Zielgarantie |
| Harness-Adapter | 4 Eintraege | Fleet runtime | `server.ts::Harness` + `/api/harnesses` |

Global sichtbare Skills oder Programme werden hier bewusst nicht mit privaten Installationspfaden
festgeschrieben. Ohne Zielprobe ist „in dieser Main-Session vorhanden“ keine Aussage ueber eine
Lane, andere Maschine oder einen Container.

## Repo-Skill `graphify`: heutiger Vertrag

**Quelle:** `.claude/skills/graphify/SKILL.md`; beworbener Trigger `/graphify`, plus die
Repo-Regel, Codebase-Fragen zuerst als Query an einen vorhandenen Graph zu richten.

Der Vertrag umfasst mindestens fuenf Autoritaetsklassen:

- read-only Query/Path/Explain gegen `graphify-out/graph.json`;
- Corpus-Scan und AST-/Semantik-Extraktion;
- install/upgrade von `graphifyy`;
- persistente Updates, Watcher und Exportdateien;
- Clone/Add/Pull-artige Netzarbeit bei URL-Inputs.

Damit kann ein harmloser Trigger „Frage zum Code“ semantisch neben Install-, Schreib- und
Netzwerkfaehigkeit liegen. P3-B sollte mindestens in `graphify-query` (read-only, vorhandener
Graph) und `graphify-build-update` (mutierend, eigener Stopppunkt) trennen. Export/Neo4j/Watch
koennen spaeter eigene Capabilities werden; sie muessen nicht in Backbone v1 beworben werden.

## Harness-Capabilities: heutige Code-Wahrheit

Quelle ist `server.ts::Harness`; `/api/harnesses` projiziert `supports`, Effort-Level, Note,
`automatable`, Default und Rolle einmalig an den Client. `worker`, `context`, `hostCommits`,
`pinsSession` und `laneForm` sind dagegen heute keine gemeinsame Skill-Registry.

| Harness | Resume | Transcript | Modell | Effort | Context-Sensor | Worker | Self-Schedule beworben | Host commit | Unattended |
|---|---|---|---|---|---|---|---|---|---|
| Claude | ja | ja | ja | nein | ja | ja | ja | nein | ja |
| pi | ja | nein | ja | ja | ja, eigenes Usage-Format | nein | nein | ja | ja |
| Codex | nein | nein | ja | ja | nein | nein | nein | ja | nein |
| container | ja | nein | ja | nein | nein | nein | nein | nein | nein |

Nuancen, die eine boolesche Registry erhalten muss:

- `container` ist `role:"place"`, kein Agent; seine Supports beschreiben den heutigen
  containerisierten Default-Agenten.
- pi kann technisch ein Self-Credential im Pane haben, aber die Nutzung ist ungemessen und wird
  deshalb ehrlich nicht beworben.
- Codex probt als lebender Prozess auch auf einem Login-Screen; deshalb ist `automatable:false`
  trotz funktionierendem Spawn die richtige Aussage.
- Claude-Worker nutzen einen separaten ToolProfile-/Transcript-Vertrag; Slot-Faehigkeit und
  Throwaway-Worker-Faehigkeit sind nicht dasselbe.
- `hostCommits` ist Ownership, nicht die Faehigkeit, Dateien im Worktree zu produzieren.

## Minimales Registry-Schema fuer G0

```text
id
kind: skill | command | capability
scope: repo | user | harness | machine | container
provider: claude | pi | codex | fleet | generic
triggers[]
jobs[]
requirements[]
authority: read-only | worktree-write | repo-metadata | host | network | external-write
mutationStop: none | before-write | before-external | before-host
source: path + contentHash + optional version
targets[]
status: active | experimental | unavailable | deprecated
probe: command-or-pure-check + observedAt + result
owner
```

`requirements` verweisen auf Capability-IDs, nicht auf freie Prosa. Eine Skill-Zeile sagt nie
allein, dass sie nutzbar ist; erst `skill.requirements ⊆ target.capabilities` macht sie routbar.

## Capability-Probe-Matrix fuer P3

| Capability | Pure/Runtime-Probe | Fail-closed Ergebnis |
|---|---|---|
| `repo.read` | Zielpfad + tracked snapshot lesbar | Skill nicht routen |
| `worktree.write` | Harness-/Sandbox-Deklaration plus kontrollierte Temp-Probe | read-only Kontextplan |
| `repo.commit` | `hostCommits` und benannter Host-Commitpfad | Lane darf Commit nicht als Done behaupten |
| `transcript.read` | Adapter liefert Parser + existierende Sessiondatei | transcriptbasierte Skills ausblenden |
| `context.usage` | Adapter liefert Datei + Parser und nicht-null Messwert | Kontextmetrik `unknown` |
| `worker.throwaway` | `worker()` nicht-null + ToolProfile + Rueckkanal | keinen Background-Worker starten |
| `tmux` | serverseitige Socket-Probe | Suite-/Pane-Aktion scheitert als tmux |
| `network` | explizite Harness-/Sandbox-Policy | nie aus Binärpraesenz ableiten |
| `browser` | benannter Client/Tool + Zielscope | keine UI-Handprobe behaupten |
| `external.write` | konkrete App/API-Autoritaet + Owner-Stop | vor Mutation stoppen |
| `host.sync` | Zielmaschine, Dry-run und attended apply | kein Fan-out |

Probe-Ergebnisse brauchen mindestens `targetId`, `capabilityId`, `status`, `observedAt`,
`sourceHash` und einen Fehlergrund. Eine fehlgeschlagene Probe darf nicht als fehlgeschlagener
Skill-Output erscheinen.

## Commands: was Registry und Routing unterscheiden muessen

- `foreman`, `rundgang`, `inspektion` und `steward` sind Rollen-/Ritualvertraege, keine beliebig
  in Produktionslanes routbaren Tools.
- `projekt-blick` ist eine Code-/Projektanalyse und kann read-only bleiben.
- `gosharp`/`sharpen` bearbeiten Arbeitsqualitaet beziehungsweise Prompts; ihr Mutationsscope muss
  explizit aus dem Auftrag kommen, nicht aus dem Namen.
- Ein Command mit langen eingebetteten Regeln ist selbst Kontextlast; Registry-Metadaten duerfen
  ihn nicht automatisch in jeden Brief kopieren.

## Empfohlener erster Schnitt

1. P3-A bildet nur das Schema, die vier Harness-Ziele und `graphify` ab; keine Installation und
   kein Sync.
2. P3-B trennt Query von Build/Update und verlangt beim mutierenden Teil einen Stop vor Install,
   Netzfetch, Watcher oder externem Push.
3. P3-C routet zunaechst nur `core-work-contract`, `verify-and-e2e` und `graphify-query`.
4. Unbekannte globale/machine-private Skills bleiben `unavailable/unknown`, bis eine lokale
   Overlay-Probe sie fuer genau dieses Ziel belegt.

## Offene G0-Entscheide

- Ist `scope × requirements × authority × mutationStop` das minimale Skill-Modell?
- Darf `graphify-build-update` erst nach Backbone v1 mutierend routbar werden?
- Sollen private/global Skills in v1 nur als lokale Overlay-IDs sichtbar sein, ohne Pfad oder
  Konfiguration in das oeffentliche Repo zu tragen?

## Nicht geprueft

Keine Binary-Version, Authentifizierung, Netzreichweite oder Container-Installation wurde neu
ausgefuehrt. Die Matrix beschreibt den aktuellen Codevertrag, nicht automatisch den Zustand jeder
Maschine. Keine globale Skill-Datei wurde gelesen oder veraendert.
