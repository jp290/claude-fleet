# Pi-Adapter-Brief — das Harness-Interface aus §F1, geschärft an der echten CLI

Ergebnis des F1-Pi-Spikes (2026-08-06). Auftrag war: verifizieren was „Pi" ist,
user-lokal installieren, Flags gegen die ECHTE Installation dokumentieren,
TUI-in-Pane real testen, **server.ts nicht anfassen**. Dieser Brief ist das
Ergebnis; es wurde kein Code geändert (`git diff` zeigt nur diese Datei).

Vorlage ist `briefs/ui-next-level-2026-08-06.md` §F1. Was dort als Entwurf steht,
steht hier gemessen — inklusive der Stellen, an denen die Messung den Entwurf
korrigiert.

---

## 1. Was Pi ist (Primärquelle, nicht geraten)

- **Pi Coding Agent**, „a minimal terminal coding harness". Herausgeber Earendil
  Inc.; Autor laut npm-Metadaten Mario Zechner, Maintainer `badlogic` +
  `mitsuhiko`.
- npm-Paket **`@earendil-works/pi-coding-agent`**, Repo
  `github.com/earendil-works/pi` (Verzeichnis `packages/coding-agent`).
- Binary heißt **`pi`** (`bin: {pi: dist/cli.js}`), Shebang `#!/usr/bin/env node`,
  `engines.node >= 22.19.0`.
- **Installierte Version für diesen Spike: 0.84.0** (npm dist-tag `latest`; es gibt
  daneben einen Tag `legacy-node20` auf 0.74.2).
- `pi.dev` ist die Website dieser Harness — bestätigt, das war die Vorgabe des
  Owners und sie hält: die Website nennt exakt dieses npm-Paket.

**Nicht verwechseln:** auf npm existiert zusätzlich `@mariozechner/pi-coding-agent`
(alter Scope desselben Autors). Kanonisch ist der `@earendil-works`-Scope — das ist
der, auf den pi.dev und das GitHub-Repo zeigen.

---

## 2. Was installiert wurde, und wie man es wieder los wird

Installiert wurde **user-lokal, ohne sudo, ohne brew-global**:

```sh
npm install -g --prefix ~/.local --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` ist die von Pi selbst dokumentierte Empfehlung. `--prefix ~/.local`
war nötig, weil `npm config get prefix` auf dieser Maschine **`/opt/homebrew`**
zeigt — ein blankes `npm i -g` wäre also genau die brew-globale Installation
gewesen, die der Owner ausgeschlossen hat.

Ergebnis auf Platte:
- `~/.local/bin/pi` → Symlink auf `~/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js`
- `~/.local/lib/node_modules/@earendil-works/…` (144 Pakete)
- **`~/.pi/agent/`** — legt Pi beim ERSTEN Start selbst an (`auth.json`,
  `models-store.json`, `sessions/`, `trust.json`), plus `~/.pi/agent/bin/fd`
  (s. Befund 7).

**Vollständig entfernen** (beides nötig — npm räumt `~/.pi` nicht mit weg):

```sh
npm uninstall -g --prefix ~/.local @earendil-works/pi-coding-agent
rm -rf ~/.pi
```

Das überlebt das Verwerfen dieser Lane — deshalb steht es hier und nicht nur im
Report.

---

## 3. Die Flag-Fläche, die der Adapter braucht (aus `pi --help` der Installation)

| Fleet braucht | Pi 0.84.0 | claude-Gegenstück |
|---|---|---|
| Session pinnen beim Spawn | `--session-id <id>` — *„Use exact project session ID, creating it if missing"* | `--session-id <uuid>` |
| Session wieder aufnehmen | **dasselbe** `--session-id <id>` | `--resume <uuid>` (eigenes Flag) |
| Modell | `--model <pattern>` (`provider/id`, optional `:<thinking>`), dazu `--provider <name>` | `--model <id>` |
| „Effort" | `--thinking <level>`: `off, minimal, low, medium, high, xhigh, max` | (kein CLI-Flag) |
| Nicht-interaktiv (Worker-Tier) | `-p/--print`, `--mode json`, `--mode rpc` | `-p` |
| Werkzeuge beschneiden | `--tools/-t`, `--exclude-tools/-xt`, `--no-tools/-nt`, `--no-builtin-tools` | `--allowedTools`/`--tools` |
| Prompt mitgeben | argv (`pi "text"`), `@datei`, `--append-system-prompt` | argv |

**Wichtig: `--session-id` steht NICHT in der README.** Die README kennt nur
`--session <path|id>` („use specific session file or partial UUID"). Erst
`pi --help` der Installation zeigt `--session-id`, und nur dieses Flag hat die
create-if-missing-Semantik, die Fleet beim Spawn braucht. Genau dafür war die
Auflage „die ECHTE Installation ist die Wahrheit" da — der Adapter auf
README-Basis hätte das falsche Flag genommen.

**Folge für das Interface aus §F1:** `spawnCmd` bekommt kein `resume`-Verhalten
mehr, das sich vom Create unterscheidet. Bei claude sind es zwei Flags, bei Pi ist
es eins. Der Parameter bleibt in der Signatur (claude braucht ihn), aber der
Pi-Adapter ignoriert ihn:

```ts
// Pi-Adapter, gemessen — nicht entworfen
spawnCmd({ sessionId, resume /* ignoriert */, model, effort }) {
  const parts = ["pi"];
  if (sessionId) parts.push("--session-id", sessionId);
  if (model)  parts.push("--model", `'${model}'`);   // Quoting: s. Befund 3
  if (effort) parts.push("--thinking", effort);       // off|minimal|low|medium|high|xhigh|max
  return parts.join(" ");
}
supports: { resume: true, transcript: true, model: true, effort: true, selfSchedule: true }
```

---

## 4. Was real getestet wurde (eigener tmux-Socket `pispike`, danach `kill-server`)

Der Live-Socket `claudefleet` wurde **nie beschrieben** — die einzige Berührung war
ein lesendes `list-sessions` zur Kontrolle danach (10 Sessions, unverändert).

Gefahren wurde Fleets eigene Spawn-Form (`new-session -d -x 200 -y 50 -c <cwd>`
mit `export PATH='…'; <cmd>; exec /bin/zsh` — die Form aus `slotCmd`, server.ts:82):

1. **TUI rendert in der Pane.** Header, Editor, Footer (cwd + git-Branch,
   Token/Kosten, Modell + Thinking-Level). Kein Fullscreen-Alternate-Screen in
   `--tui-mode regular` (Default).
2. **Fleets Eingabeweg funktioniert unverändert.** `load-buffer` →
   `paste-buffer -p -d -b` → `send-keys Enter` (server.ts:1666-1684): der Text
   erschien im Editor, Enter löste ab. Kein Modifier nötig, deshalb ist Fleets
   Submit von der tmux-extended-keys-Frage (Befund 8) **nicht** betroffen.
3. **Fehlerfall ohne Credentials ist sanft:** „Error: No API key found for
   amazon-bedrock." als Meldung IN der TUI, Pane lebt weiter, kein Absturz.
4. **`!!cmd` läuft lokal ohne Modell** — brauchbar als credential-freie Sonde.
5. **`--session-id` auf eine unbekannte ID:** „No project session found with id
   '…'; creating a new session with that id." — beim Respawn mit derselben ID
   identisch, also idempotent-sicher, kein Fehler.

---

## 5. Befunde, die den Entwurf ändern (nach Tragweite)

**1 — Pi hat KEINE Berechtigungs-Schicht, also auch kein Gegenstück zu
`--dangerously-skip-permissions`.** `docs/security.md` der Installation, wörtlich:
*„Pi does not include a built-in sandbox. Built-in tools can read files, write
files, edit files, and run shell commands with the permissions of the pi process."*
Der „Project Trust"-Dialog ist ausdrücklich **kein** Tool-Gate — er entscheidet nur,
ob projekt-lokale Settings/Extensions geladen werden.
*Kosten:* Fleets sicherer Default („claude WITH its permission prompts",
server.ts:71-73) lässt sich für Pi **nicht ausdrücken** — ein Pi-Slot ist ab dem
ersten Prompt das, was bei claude erst `--dangerously-skip-permissions` ist. Die
einzige verfügbare Bremse ist die Werkzeug-Allowlist (`--tools read,grep,find,ls`
= read-only). **Owner-Entscheid nötig**, bevor ein Pi-Slot spawnbar wird — und
besonders, bevor ein *Gast* einen bekommt.

> **Nachtrag 2026-08-08 — die *Messung* oben steht, ihre *Kostenzeile* nicht mehr.**
> Pi selbst hat weiterhin keine Berechtigungs-Schicht (`pi --help` kennt weder
> sandbox noch approval/permission/restrict). Was sich geändert hat: die Bremse
> muss nicht aus Pi kommen. `PI_HARNESS.spawnCmd` legt den Zaun jetzt von **außen**
> um die Spawn-Zeile — `sandbox-exec` (macOS seatbelt, dasselbe Werkzeug, das Codex
> für sein `--sandbox workspace-write` benutzt) mit einem pro Lane aus ihrem cwd
> erzeugten SBPL-Profil. Damit ist „ein Pi-Slot ist ab dem ersten Prompt
> `--dangerously-skip-permissions`" falsch: er kann außerhalb seiner eigenen
> Arbeitskopie **nicht schreiben**. Die Werkzeug-Allowlist ist nicht mehr die
> einzige Bremse. Was der Zaun NICHT ist, und das bleibt die offene Hälfte:
> **kein Lese-Zaun und kein Netz-Zaun** (Owner-Entscheid: „netz anbindung waere
> schon sehr gut, auch fuer research") — Lese-Reichweite ist damit
> Exfiltrations-Reichweite, dieselbe Vertrauensfrage wie bei Codex.

**2 — `claudeAlive` gibt für jede Nicht-claude-BASE_CMD blind `true` zurück**
(server.ts:1698). Heute ist das folgenlos (es gibt keinen zweiten Harness); mit Pi
wäre ein Pi-Slot dauerhaft „alive", und `canDeliver`s Gate (server.ts:1818) wäre
ein No-op. *Kosten:* genau der Schaden, den der Kommentar an server.ts:5171 selbst
benennt — Prosa wird in eine blanke zsh getippt und dort als Kommandos ausgeführt.
*Gemessen, und die Reparatur ist klein:* das Kind der Pane trägt
`comm = pi` (nicht `node`, trotz `#!/usr/bin/env node`). `claudeAliveAt`
(server.ts:1705) prüft `comm.startsWith("claude")` — es reicht, diesen Präfix pro
Harness zu parametrisieren, die Prozessbaum-Logik selbst trägt unverändert.

**3 — `MODEL_RE` (server.ts:101) passt nicht auf Pi-Modellnamen, und die
Erweiterung ist sicherheitsrelevant.** Pi-Muster enthalten `/` (`anthropic/claude-…`),
`:` (`sonnet:high`) und ausdrücklich Globs (`anthropic/*`, `*sonnet*`).
*Kosten:* `*` ist ein zsh-Glob. Die Single-Quote-Regel aus `slotCmd` (heute wegen
`[1m]` da) wird damit aus einem **zweiten** Grund tragend, und die Zeichenklasse
muss sich öffnen. Empfehlung: **pro Adapter eine eigene Regex**, nicht die
bestehende aufweiten — claude-Slots sollen `/`, `:`, `*` weiterhin nicht
akzeptieren dürfen.

**4 — Ein unauflösbares Modell macht den Slot zur blanken Shell.** Gemessen mit
`--model 'no-such-model-xyz'`: Pi druckt „Model … not found", **beendet sich**, und
`; exec /bin/zsh` fängt die Pane auf. `pane_dead=0`, aber kein Agent.
*Kosten:* ohne Befund 2 ist das ein unsichtbar toter Slot, der Prompts annimmt.
Ein Vorab-Check (`pi --list-models`) hilft nur nach Login — s. Befund 9.

**5 — Der Transcript-Pfad ist anders gebaut als Fleets `projDir`.**
Pi: `~/.pi/agent/sessions/--<cwd mit / → ->--/<timestamp>_<uuid>.jsonl`
(`docs/session-format.md`; zwei eigene Messungen bestätigen den `--…--`-Rahmen).
Fleet: `~/.claude/projects/<cwd mit ALLEN Nicht-Alnum → ->/<uuid>.jsonl`
(server.ts:553, `projDir`).
Drei Unterschiede, die zählen: (a) nur `/` wird ersetzt, nicht jedes Sonderzeichen;
(b) der Rahmen `--`…`--`; (c) der Dateiname trägt einen **Zeitstempel-Präfix**, die
Session-ID ist also nur per Glob `*_<uuid>.jsonl` zu finden — kein direkter Pfad.
Zusatz: Pi kanonisiert die cwd (`/tmp/x` landete unter `--private-tmp-x--`).
*Kosten:* `projDir` und die Transcript-Ansicht (server.ts:2681) brauchen je eine
Adapter-Variante; ein blinder Reuse liefert ein leeres Transcript.

**6 — Modell-Muster raten den Provider mit.** `--model 'sonnet:high'` löste sich
zu **`us.anthropic.claude-sonnet-5` über amazon-bedrock** auf — nicht über den
Anthropic-Provider. *Kosten:* ein lockeres Muster wählt stillschweigend einen
Provider (und damit eine Abrechnung/Credential-Quelle). Der Adapter muss
`provider/id` vollständig pinnen, nie ein Kurzmuster durchreichen.

**7 — Pi lädt beim ersten Start ungefragt eine Binary nach:** „fd not found.
Downloading… fd installed to `~/.pi/agent/bin/fd`" (2,9 MB). *Kosten:* ein
Netzzugriff + eine fremde Binary beim ersten Spawn. `PI_OFFLINE=1` unterdrückt laut
Doku die Startup-Netzoperationen (Update-Check, Telemetrie); ob es auch diesen
Download unterdrückt, wurde **nicht** geprüft.

**8 — Jede Pi-Pane warnt sichtbar über tmux extended-keys** („Add `set -g
extended-keys on` to ~/.tmux.conf"). Fleets Submit ist davon nicht betroffen
(Befund 4.2, plain Enter). Betroffen wäre nur Shift/Ctrl+Enter beim direkten
Tippen im Terminal. *Das ist geteilte Realität* (`~/.tmux.conf` bzw. eine Option am
Live-Socket) — hier nur gemeldet, nicht angefasst. tmux ist 3.6a, `csi-u` wäre also
verfügbar.

**9 — Der Modell-Katalog ist auth-gated.** Ohne Login liefert `pi --list-models`
„No models available." *Kosten:* die in §F1 geplante Options-Zeile kann für Pi
**keine Modell-Liste anzeigen**, bevor der Owner `/login` gemacht hat. Die
Options-UI braucht dafür einen leeren/deaktivierten Zustand — sonst sieht das erste
Aufklappen kaputt aus.

---

## 6. Zwei Dinge, die den Lane-Fall billiger machen als gedacht

- **Pi liest `CLAUDE.md` von sich aus** als Kontextdatei (`AGENTS.md` *oder*
  `CLAUDE.md`, global + alle Elternverzeichnisse + cwd). Die Lane-Disziplin, die
  Fleet beim Spawn in den Worktree kopiert, gilt für eine Pi-Lane also **ohne
  Adapter-Arbeit**. (Eine `AGENTS.override.md` im Verzeichnis würde sie
  verdrängen — heute existiert keine.)
- **Self-Scheduling ist harness-agnostisch.** `FLEET_SELF_TOKEN`/`FLEET_SELF_SLOT`
  werden als Shell-Export VOR das Kommando gehängt (server.ts:1484-1494), nicht von
  claude verarbeitet — Pis bash-Tool erbt sie wie jedes Kind. `supports.selfSchedule`
  ist für Pi also `true`, ungeprüft-per-Konstruktion. (Pi legt in bash-Tool-Aufrufen
  zusätzlich `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_MODEL`, `PI_REASONING_LEVEL`
  ab — brauchbar, falls eine Lane später über sich selbst berichten soll.)

Und der Grund, warum Lanes hier überhaupt kein zweiter Pfad sind, bleibt gültig:
`slotCmd` hat genau einen Aufrufer (server.ts:1494) und baut die Zeile für
Hauptsession wie Lane; der Unterschied ist allein der vorangestellte Env-Export.

---

## 7. Was NICHT bewiesen ist

Alles unten ist mangels Credentials offen — `~/.pi/agent/auth.json` ist leer, und
der Spike hat bewusst keinen Login und keinen bezahlten Modellaufruf gemacht.

- **Resume-Pfad.** Dass `--session-id` eine *bestehende* Session wieder aufnimmt,
  steht in seinem eigenen Hilfetext („creating it if missing") — es wurde **nicht**
  ausgeführt. Ohne erfolgreichen Turn entsteht keine Session-Datei: das Verzeichnis
  wird beim Start angelegt, die `.jsonl` erst mit Inhalt. Bewiesen ist nur der
  Create-Zweig.
- **Ob Fleets Idle-Erkennung an Pis TUI greift.** Pi malt in `regular`-Mode nur den
  oberen Teil der Pane; der Rest bleibt leer. Ob `capture-pane`-Vergleich und
  Idle-Schwellen damit dasselbe leisten wie bei claude, ist ungeprüft.
- **Ob `pi -p` / `--mode json` als Worker-Tier taugt** (summarize/review/enhance/
  merge-resolver). Die Flags existieren; gelaufen ist keiner.
- **Ob `PI_OFFLINE=1` den `fd`-Download unterdrückt** (Befund 7).

---

## 8. Nächster Schnitt, wenn der Owner weitergehen will

Erst Befund 1 entscheiden (Berechtigungs-Modell), dann Befund 2+3 (alive-Gate und
Modell-Validierung pro Harness) — das sind die beiden, ohne die ein Pi-Slot
unsicher *und* still kaputt wäre. Befund 5 (Transcript) ist Komfort und darf
warten; ein Pi-Slot funktioniert ohne Transcript-Ansicht.
