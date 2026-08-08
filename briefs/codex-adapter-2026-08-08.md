# Codex-Adapter — Harness #4, gebaut und gemessen

Auftrag (2026-08-08): Codex als Adapter #4 in die Registry, nach dem Muster von
Pi (`a64b681`) und Container (`ec7d191`). Der Spike war bereits gefahren; seine
Zahlen standen im Brief. Dieser Brief ist das Ergebnis des BAUS — jede Zeile
darin ist entweder eine eigene Messung mit Kommando und Ausgabe oder ein Verweis
auf den Check, der sie festhält.

---

## 1. Was nachgemessen wurde (nicht übernommen)

Die Brief-Messungen wurden nicht geglaubt, sondern die drei, an denen der Adapter
hängt, wiederholt.

**Binary und Version:**

```
$ which codex; codex --version
/Users/owner/.local/bin/codex
codex-cli 0.147.0
```

**Modell-Flag und das Approval/Sandbox-Paar** — aus `codex --help`, nicht geraten:

```
  -m, --model <MODEL>
          Model the agent should use
  -s, --sandbox <SANDBOX_MODE>
          [possible values: read-only, workspace-write, danger-full-access]
  -a, --ask-for-approval <APPROVAL_POLICY>
          - untrusted / on-request / never
      --dangerously-bypass-approvals-and-sandbox
          Skip all confirmation prompts and execute commands without sandboxing.
          EXTREMELY DANGEROUS. Intended solely for running in environments that
          are externally sandboxed
```

Ohne Subcommand ist `codex` die interaktive TUI — die Form, die ein Slot will.
`codex exec` ist headless und hier nicht gemeint.

**Der Prozessbaum — die einzige Messung, die eine Entscheidung erzwungen hat.**
Eine Scratch-tmux-Pane auf eigenem Socket (nie der Live-Socket), Kommando
`codex --sandbox workspace-write --ask-for-approval never; exec /bin/zsh`, nach 6 s:

```
panepid=5353 comm=zsh
  d1 pid=5355 comm=node
    d2 pid=5356 comm=/Users/owner/.local/lib/node_modules/@openai/codex/
                     node_modules/@openai/codex-darwin-arm64/vendor/
                     aarch64-apple-darwin/bin/codex
```

Damit bestätigt: das native Binary liegt auf **Ebene 2**. `paneAgentAt`
(server.ts, `pgrep -P <panePid>`) geht **eine** Ebene tief und nimmt den
Basename. `comms: ["codex"]` allein hätte also eine kerngesunde Codex-Pane als
`no-agent` gemeldet — exakt der Defekt, den `4955444` für Pi repariert hat.

---

## 2. Die vier Entscheidungen, und warum sie so fielen

### 2.1 comms = `["codex", "node"]` (nicht: das native Binary direkt spawnen)

Gewählt wurde die **generische, aber gescopte** Variante. Das Argument ist nicht,
dass `node` ein spezifischer Name wäre, sondern dass die Sonde gescopt ist:
`paneAgentAt` fragt die Pane-PID und deren eigene Kinder ab, nie die Prozess-
tabelle der Maschine. Das einzige `node`, das sie je sehen kann, ist das, das
dieser Slot gestartet hat.

Was das kostet, benannt: eine Codex-Pane, in der der Wrapper noch lebt und der
native Agent gestorben ist, liest weiter `alive`. Das ist ein **strikt kleineres**
Loch als die Alternative, die jede gesunde Pane für tot erklärt.

Die verworfene Alternative, damit sie nicht neu vorgeschlagen wird: das native
Binary direkt spawnen und `["codex"]` deklarieren. Preis wäre
`codex-darwin-arm64/vendor/aarch64-apple-darwin` in der Spawn-Zeile — ein arch-
UND versionsspezifischer Pfad innerhalb `node_modules`, der bei `npm update`, auf
einem anderen Mac und auf jedem Nicht-arm64-Host bricht, still und beim Spawn.
`codex` ist der unterstützte Einstiegspunkt; um ihn herumzugehen, damit eine
Sonde hübscher wird, ist der falsche Tausch.

### 2.2 Approval/Sandbox = `--sandbox workspace-write --ask-for-approval never`

Die **konservative** Entsprechung, nicht die passende. `--dangerously-bypass-
approvals-and-sandbox` wird von Codex' eigenem Help EXTREMELY DANGEROUS genannt
und auf extern gesandboxte Umgebungen eingeschränkt — ein Lane-Worktree auf der
Dev-Box des Owners ist keine. Das gewählte Paar hält den Sandbox AN und macht die
Pane trotzdem unbeaufsichtigt-tauglich (sie bleibt nie an einer Rückfrage hängen).

**Offene Owner-Frage, bewusst nicht im Code beantwortet:** ob eine Codex-Lane
`workspace-write` reicht. Der Sandbox erlaubt Schreiben im Workspace; was er
zusätzlich einschränkt (Netz, Pfade außerhalb), wurde hier **nicht** vermessen.
Falls sich das im Betrieb als zu eng zeigt, ist die Antwort `--add-dir` oder eine
Owner-Entscheidung über den Bypass-Flag — nicht eine stille Erweiterung des
Literals. Ein Pin in `e2e/pins.ts` hält das fest.

### 2.3 automatable = `false`

Und hier ist der Grund **gemessen**, nicht prozedural: `codex login status` sagt
`Not logged in`. Eine un-authentifizierte Codex-Pane steht auf ihrem Sign-in-
Screen, während der node-Wrapper LÄUFT — die Sonde antwortet also korrekt `alive`,
und ein unbeaufsichtigter Pfad (Auto, Dispatch, Steward-Send, auto-③) würde einen
Brief in eine Login-Maske tippen, wo er ohne Fehlermeldung verschwindet. Die
Faktschicht kann diesen Zustand nicht unterscheiden.

Das ist eine **benannte Grenze, kein Defekt, den dieser Adapter repariert**: das
Login ist ein Owner-Akt, und die Suiten fahren nie gegen das echte Binary.
`automatable: false` bleibt, bis eine echte Codex-Lane einmal beobachtet gelaufen
ist. Was es NICHT kostet: der Owner darf einen solchen Slot von Hand öffnen,
fahren und landen — nur die unbeaufsichtigten Pfade sind zu, und zwar auch mit
`FLEET_HARNESS_AUTOMATION=1`.

`note` sagt genau das am Picker, vor dem Spawn:
`you run \`codex login\` yourself — an un-authenticated pane waits on its sign-in
screen and still probes alive`.

### 2.4 Die kleineren Felder

- **`pinsSession: false` / `supports.resume: false`.** Codex hat kein
  `--session-id`. Resumption ist der Subcommand `codex resume` — ein interaktiver
  Picker (`--last` für den neuesten), also nichts, was beim Spawn gepinnt werden
  kann. Das unterscheidet Codex von BEIDEN Vorgängern (claude: zwei Flags, Pi:
  ein create-or-attach-Flag). Ein Pane-Respawn beginnt ein neues Gespräch.
- **`supports.transcript: false`.** Codex schreibt seine Rollout-Dateien unter
  `$CODEX_HOME` (`~/.codex`), nicht als Claude-Code-`.jsonl` unter `projDir()`.
  Ein hoffnungsvolles `true` würde `transcriptFile()`s newest-by-mtime-**Fallback**
  in `~/.claude/projects/<cwd-slug>/` schicken und dem Slot das Gespräch einer
  fremden Session aus demselben cwd unterschieben. Sichtbar scheitern schlägt eine
  fremde Unterhaltung als Antwort.
- **`modelRe: HARNESS_MODEL_RE`.** Codex-Modellnamen tragen `:` (die lokalen
  Provider-Tags unter `--oss`, z. B. ein ollama `qwen2.5-coder:7b`) und `/`
  (provider-qualifizierte ids). Strikter SUPERSET von `MODEL_RE`, also geht kein
  Name verloren, den ein claude-Fleet genommen hätte. Keine env-konfigurierbare
  Regex — die Verbotsregel gilt unverändert.
- **`effortLevels: []`.** Codex hat kein Effort-FLAG; Reasoning-Effort ist Config
  (`-c key=value`), und ein `-c`-Durchreichen wäre eine zweite Injektionsfläche in
  die Pane-Zeile für einen Knopf, den niemand verlangt hat. Leer heißt: die Routen
  WEISEN ein `effort` ab, statt es still fallenzulassen.
- **`supports.selfSchedule: false`.** Nicht die Behauptung, der Env fehle —
  `ensureSlot` exportiert `FLEET_SELF_TOKEN` in jede Pane mit cwd, egal welche
  Harness. Ungemessen ist, ob Codex' eigenes Tooling ihn je benutzt. „Nicht
  bewerben" ist das Einzige, was eine ungemessene Fähigkeit bedeuten darf.

---

## 3. Was gebaut wurde

- `server.ts`: `CODEX_HARNESS` als Adapter #4, in `HARNESSES` registriert. Kein
  anderer Teil von server.ts angefasst — der Client zieht den Katalog über
  `GET /api/harnesses` und braucht keine Zeile.
- `e2e/security.ts` §6e — 14 neue Checks, plus codex in der Quote-Ablehnungs-Schleife von §6.
- `e2e/lanes-basic.ts` — die `POST /api/lanes`-Route mit Harness+Modell.
- `e2e/pins.ts` — vier Quelltext-Pins auf das Adapter-Literal.

Merge-/Land-Pfad **nicht** angefasst. Nichts außerhalb dieses Worktrees
installiert oder konfiguriert (codex war bereits installiert).

---

## 4. Die Done-Kriterien, jedes an seinem Check

| # | Kriterium | Beleg |
|---|---|---|
| 1 | `POST /api/lanes {repo, harness:"codex", model}` baut eine Pane-Kommandozeile mit `--model` in der gemessenen Form — bewiesen an der KOMMANDOZEILE | `e2e/lanes-basic.ts`: „a lane spawned with harness=codex runs codex, sandboxed, with --model in the measured form" — Regex gegen `#{pane_start_command}`, nicht gegen die Route-Antwort |
| 2 | Modell-Validierung bleibt zweigeteilt, mit Gegenprobe | §6 „the default adapter still rejects the foreign model shape" (3 Zeilen) bleibt grün; Phase 1 von `e2e-claude-gate.sh` unverändert grün. Neu in der Quote-Schleife: „§6 harness codex rejects a model carrying a single quote (400)" |
| 3 | Der Adapter deklariert comms SELBST und verliert den „unprobed"-Waiver | Laufzeit: §6e „a codex slot is genuinely PROBED …, never waived like the undeclared FLEET_CMD" (Diskriminator `!== "unprobed"`, dieselbe Konstruktion und derselbe Grund wie §6b — s. §5 unten). Struktur: Pin „the codex adapter declares its OWN comms — a null would hand it back the unprobed waiver" |
| 4 | Ein `[...]`-Modell bleibt in der tmux-Zeile single-quoted | §6e „the codex spawn line quotes the bracket model (an unquoted one aborts the pane under zsh)" — Modell `codex-probe-5[1m]`, Assertion auf `--model 'codex-probe-5[1m]'` in `pane_start_command` |
| 5 | `automatable` wirkt: kein unbeaufsichtigter Pfad fasst einen Codex-Slot an | §6e „the codex adapter is NOT automatable …, while pi is" am Katalog + Pin auf `automatable: false` im Literal. Die Laufzeit-Wirkung teilt sich den Choke-Point mit §6c (`canDeliver` → „harness X is not automatable"), der für pi bereits belegt ist |

---

## 5. Eine Abweichung vom Auftrag, benannt

Kriterium 3 verlangt wörtlich, ein Check müsse zeigen, dass ein Codex-Slot
**`no-agent`** meldet. Der Check assertiert stattdessen `!== "unprobed"`, und
das ist Absicht:

Ob die Antwort `alive` oder `no-agent` lautet, hängt davon ab, ob `codex` auf der
Maschine installiert ist, die die Suite fährt — auf DIESER ist es installiert,
also käme dort `alive` heraus, und ein Check, der `no-agent` fordert, wäre hier
rot und auf einer CI-Maschine grün. §6 sagt zu genau diesem Muster: das darf nie
eine Zeile entscheiden. `unprobed` ist die einzige Antwort, die beweist, dass die
Sonde NICHT gelaufen ist (der fleetweite leere Satz kurzschließt `paneAgentAt`),
also ist „nicht unprobed" exakt der Diskriminator — dieselbe Konstruktion, die
§6b für pi bereits trägt.

Die strukturelle Hälfte trägt der Pin: `comms: null` wäre die einzige Art, den
Waiver zurückzubekommen, und der Pin verbietet sie. Zusammen ist die Aussage
stärker als eine einzelne maschinenabhängige Zeile: die Sonde LÄUFT (Laufzeit),
und sie kann nicht aufhören zu laufen (Quelle).

Auf DIESER Maschine hat der Lauf entsprechend `alive` gemessen:

```
PASS  §6e a codex slot is genuinely PROBED (adapter-declared comms),
      never waived like the undeclared FLEET_CMD  (alive)
```

Das ist mehr als die Zeile fordert und der eigentliche Beleg für §2.1: eine echte
Codex-Pane, durch `paneAgentAt` gesehen, antwortet mit `comms: ["codex","node"]`
genau dann `alive`, wenn sie es ist. Mit `["codex"]` allein hätte hier `no-agent`
gestanden.

**Nebenwirkung, die man wissen muss:** auf einer Maschine mit installiertem codex
startet §6e für Sekunden eine echte Codex-TUI in der Test-Pane. Ohne Login bleibt
sie am Sign-in-Screen stehen, tut nichts, kostet nichts, und der Slot wird
unmittelbar danach gekillt.

---

## 6. Verifikation

Alle Kommandos aus dem Lane-Worktree, in der vorgegebenen Reihenfolge:

```
bun install --frozen-lockfile          → 9 packages installed
bun e2e/pins.ts                        → ALL PASS
bunx tsc --noEmit --strict …           → exit 0
bun run build                          → Bundled 4 modules
./e2e-clean-review.sh                  → exit 0, ALL PASS
./e2e-security.sh                      → exit 0, ALL PASS
./e2e-claude-gate.sh                   → exit 0, ALL PASS  (beide Phasen)
./e2e-isolated.sh                      → exit 0, ALL PASS (0 FAIL)
```

`./e2e-isolated.sh` lief, weil `e2e/` angefasst wurde — dort leben §6e, der
Lane-Check und die Pins.
