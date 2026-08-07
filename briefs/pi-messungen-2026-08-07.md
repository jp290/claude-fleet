# Pi — die vier Messpunkte, die der Spike nicht beweisen konnte (2026-08-07)

Nachtrag zu `briefs/pi-adapter-2026-08-06.md` §7 („Was NICHT bewiesen ist"). Jener
Spike lief ohne Credentials; alles unten war deshalb offen. Beide Vorbedingungen
sind inzwischen gefallen — die Adapter-Mechanik ist als `a64b681` gelandet, und der
Login-Schritt hat sich erledigt, statt erledigt zu werden (§0).

**Gegen welche Mechanik gemessen wird** (`a64b681`, Commit-Body ist der Kontrakt):
`FLEET_HARNESS_COMMS` (Komma-Liste von comm-Präfixen; LEER = „unprobed"-Waiver) ·
`FLEET_HARNESS_MODEL_FLAG` · `HARNESS_MODEL_RE` (fremdes Charset mit `/ : * @`;
claude behält `MODEL_RE`) · das Feld `agent` pro Slot auf `GET /api/sessions`
(`alive|no-agent|no-pane|unprobed|null`).

**Es wurde kein Fleet-Code geändert.** Alles unten ist Messung und Vorschlag; die
Abnehmerin ist die F1-Bauscheibe (Queue-Zeile `cc3b735c`).

---

## 0. Der Stand der Vorbedingungen, nachgeprüft statt geglaubt

`~/.pi/agent/auth.json` ist **2 Bytes** (leer), `models-store.json` ebenso, und
`pi --list-models` listet trotzdem **8 Modelle**, alle unter Provider
`claude-bridge` (`claude-fable-5`, `claude-haiku-4-5`, `claude-opus-4-6/4-7/4-8`,
`claude-opus-5`, `claude-sonnet-4-6`, `claude-sonnet-5`). Die Bridge
(`pi install npm:pi-claude-bridge`, in `~/.pi/agent/settings.json` als
`"packages": ["npm:pi-claude-bridge"]`) läuft über das Claude Agent SDK und nutzt
die vorhandene Claude-Code-Anmeldung der Maschine.

**Die alte Behauptung „der Modell-Katalog ist auth-gated" (Spike-Befund 9) ist für
den Bridge-Provider widerlegt — und für die DIREKTEN Provider bestätigt**, und das
zum Nulltarif, weil die Ablehnung vor jedem Modellaufruf kommt:

```
$ pi -p --model anthropic/claude-haiku-4-5 "hi"      → EXIT=1
  No API key found for anthropic.
  Use /login to log into a provider via OAuth or API key.
```

Der Katalog zeigt entsprechend **keinen** direkten Provider an. Für den Adapter
heißt das: die in §F1 geplante Modell-Options-Zeile hat unter der Bridge eine
nicht-leere Liste — der „leere Zustand" bleibt nötig, aber nur für den Fall, dass
jemand die Bridge entfernt.

---

## (a) Session-Pinning / Resume — **GEMESSEN**

**Frage:** Ist `--session-id <id>` wirklich create-or-attach (der Hilfetext sagt
„creating it if missing", die README kennt das Flag gar nicht)? Ist das auf Fleets
Pin/Resume abbildbar? Wo liegen die Session-Dateien, überleben sie den Prozess-Tod?

### Rechenweg

Zwei getrennte `pi`-Prozesse, dieselbe `--session-id`, im selben cwd:

```
# Lauf 1
$ pi -p --session-id 019fdcac-…-0a01 --model claude-bridge/claude-haiku-4-5 \
     "Merke dir das Codewort BERGZIEGE. Antworte mit genau einem Wort: OK"
  stderr: Warning: No project session found with id '019fdcac-…-0a01';
          creating a new session with that id.
  EXIT=0, 10.6 s

# Lauf 2 — NEUER Prozess, gleiche id
$ pi -p --session-id 019fdcac-…-0a01 --model claude-bridge/claude-haiku-4-5 \
     "Habe ich dir in dieser Unterhaltung schon eine Nachricht geschickt? …"
  stdout: Codeword BERGZIEGE, antwort mit genau einem Wort OK.
  stderr: (leer)
  EXIT=0, 8.4 s
```

Drei unabhängige Belege in einem Lauf:

1. **Inhaltlich** — Lauf 2 zitiert Lauf 1s Nachricht wörtlich zurück. Dieselbe
   Konversation, nicht nur dieselbe Datei.
2. **Mechanisch** — Verzeichnis vorher `files=1 lines=5`, nachher `files=1
   lines=7`. **Eine** Datei, um zwei Zeilen gewachsen (User-Message +
   Assistant-Message). Kein zweites File, kein Fork.
3. **Der Discriminator** — die Warnung `creating a new session with that id`
   erscheint bei Lauf 1 und **fehlt bei Lauf 2**. Create und Attach sind von außen
   unterscheidbar, ohne die Datei zu lesen.

### Session-Dateien und Prozess-Tod

```
~/.pi/agent/sessions/--<cwd, / → ->--/<ISO-timestamp>_<session-id>.jsonl
```

Der Dateiname trägt die **exakte** übergebene ID als Suffix — der Glob
`*_<id>.jsonl` findet sie deterministisch (Spike-Befund 5 bestätigt: kein direkter
Pfad, aber auch kein mtime-Raten). Prozess-Tod ist per Konstruktion überlebt: Lauf
1 und Lauf 2 sind verschiedene Prozesse.

**Zusätzlich der Fleet-relevante Fall — der Pane-Neustart**, gemessen zum Nulltarif
(kein Modellaufruf): TUI-Pane mit `--session-id …0b02` gespawnt, zwei Turns
gefahren, `tmux kill-session`, dann mit **derselben** Zeile neu gespawnt. Die
respawnte Pane rendert beide alten Turns (`Antworte mit genau einem Wort: OK / OK /
… FERTIG`), und die `creating a new session`-Warnung fehlt. Das ist genau der Pfad,
den `ensureSlot` fährt.

### Abbildung auf Fleet

`slotCmd(sessionId, resume, model)` (server.ts:82) baut für claude **zwei** Flags:

```ts
`${BASE_CMD} ${resume ? "--resume" : "--session-id"} ${sessionId}`
```

Für Pi ist es **ein** Flag in beiden Rollen. Der `resume`-Parameter bleibt in der
Signatur (claude braucht ihn) und wird vom Pi-Adapter ignoriert — das bestätigt den
Entwurf aus dem Spike-Brief §3, jetzt ausgeführt statt aus dem Hilfetext gelesen.

> **VORSCHLAG** `supports.resume: true`. Der Adapter gibt in beiden Fällen
> `--session-id <id>` aus.

---

## (b) Idle-Erkennung an der TUI — **GEMESSEN**

**Frage:** Fleets Idle-Begriff hängt an Pane-Ausgabe. Eine TUI, die repaintet,
sieht ewig aktiv aus. Repaintet Pis TUI im Leerlauf von selbst?

### Methodenkorrektur, die das Ergebnis überhaupt erst gültig macht

Der Auftrag nennt „capture-pane-Hashes". **Das ist nicht Fleets Sensor**, und die
Differenz läuft in die gefährliche Richtung. `lastOutput` wird gestempelt, wenn die
**pipe-pane-Stream-Datei wächst** (server.ts:2970, `s.lastOutput = Date.now()` unter
`if (size > s.offset)`); die Datei füttert `pipe-pane -o "exec cat >> …"`
(server.ts:1872). Ein Repaint, der denselben sichtbaren Frame neu malt, schreibt
Bytes (Cursor-Bewegungen, Escape-Sequenzen), lässt den capture-pane-Hash aber
**unverändert**. Ein reiner Hash-Vergleich hätte „still" gemeldet, wo Fleet
„aktiv" sieht. Darum wurde **beides** gemessen, mit Fleets eigenem Sensor als
Entscheider.

### Rechenweg

Eigener Socket `pimess` (der Live-Socket `claudefleet` wurde nur einmal lesend
gelistet), Fleets Spawn-Form aus `slotCmd`:
`new-session -d -x 200 -y 50 -c <cwd>` mit
`export PATH='…'; pi --session-id <id> --model 'claude-bridge/claude-haiku-4-5'; exec /bin/zsh`,
`default-shell` auf zsh gesetzt. Dann `pipe-pane -o "exec cat >> stream.raw"` wie
Fleet, und alle 2 s Byte-Zahl + Frame-Hash.

**Zustand 1 — frische TUI, nie geprompted, 30 s:**

| | Ergebnis |
|---|---|
| Stream-Bytes | `0` bei t=2…30 s, jedes Delta `0` |
| Frame-Hash | `4a61e4ac52c2`, **15×/15 identisch** |

**Zustand 2 — nach einem echten Turn** (Eingabe über Fleets exakten Weg:
`load-buffer` → `paste-buffer -p -d -b` → `send-keys Enter`; funktionierte
unverändert, Spike-Befund 4.2 bestätigt):

```
t=1s  bytes=17288  delta=16789     ← Antwort läuft
t=3s  bytes=62679  delta=41504
t=5s  bytes=82015  delta=15449
t=6s … t=20s       delta=0         ← 15 s flach
+5s … +30s         delta=0         ← weitere 30 s flach, gleicher Zählerstand
```

**Ergebnis: Pis TUI ist im Leerlauf byte-still — kein Spinner, keine Uhr, keine
tickende Statuszeile.** 45 s zusammenhängend ohne ein einziges Byte nach Antwortende.
Fleets `idle`/`stalled`-Sensorik trägt für Pi-Slots unverändert; sie braucht **keine**
Sonderbehandlung, und die Sorge aus dem Spike-Brief §7 ist gegenstandslos.

### Was daran NICHT gemessen ist (ehrlicher Rand)

Das Fenster war 45 s. Die TUI zeigt eine `Update Available`-Box, d. h. Pi macht
Netz-Operationen; ob ein späterer Update-/Telemetrie-Tick über Stunden einen
Repaint auslöst und damit die Idle-Uhr zurücksetzt, ist **ungemessen**.
`--offline` / `PI_OFFLINE=1` unterdrückt laut Doku die Startup-Netzoperationen —
ob auch spätere, ist ebenfalls ungemessen (schon Spike-Befund 7 ließ das offen).

> **VORSCHLAG** Pi-Slots ohne Idle-Sonderfall führen. Wenn ein Pi-Slot je über
> Stunden laufen soll, `--offline` in die Spawn-Zeile aufnehmen und dann erneut
> über ein langes Fenster messen — nicht vorher, das wäre geraten.

---

## (c) `pi -p` als Worker-Tier — **GEMESSEN**

**Frage:** Kann `pi -p` die Wegwerf-Worker-Rolle (`SUMMARY_MODEL`-Klasse) füllen?
Antwortzeit, stdin vs argv, Exit-Code bei Fehler, `--mode json`?

### Rechenweg — je eine Form, je ein Beispiel

| Form | Kommando | Exit | Zeit | stdout |
|---|---|---|---|---|
| argv | `pi -p --session-id … --model … "…"` | `0` | 10,6 s | Antworttext |
| argv (Folge-Turn) | dito, gleiche id | `0` | 8,4 s | Antworttext |
| **stdin** | `echo "…" \| pi -p --no-session --model …` | `0` | 5,9 s | `STDINOK` |
| **json** | `pi -p --mode json --no-session --model … "…" < /dev/null` | `0` | 7,4 s | 6988 B JSONL |

**Fehlerpfade — alle `EXIT=1`, Text auf stderr, stdout leer** (und alle vier ohne
einen einzigen Modellaufruf, s. §Kosten):

```
--model claude-bridge/no-such-model-xyz → 1  "Claude Code returned an error result: …"
--model nosuchprovider/foo              → 1  "Model … not found. Use --list-models …"
--not-a-flag                            → 1  "Error: Unknown option: --not-a-flag"
--model anthropic/claude-haiku-4-5      → 1  "No API key found for anthropic."
```

### Zwei Befunde, die ein Adapter kennen MUSS

**1 — `--mode json` blockiert auf offenem stdin, `--mode text` nicht.** Der erste
Versuch, mit argv-Prompt aber offenem stdin, hing **3 Minuten bis zum Abbruch und
schrieb null Bytes** auf stdout wie stderr. Derselbe Aufruf mit `< /dev/null`:
`EXIT=0` in 7,4 s. Die Text-Form lief in derselben Umgebung mit offenem stdin
problemlos durch — die Variable ist also der Modus, nicht die Umgebung.
*Kosten:* ein Worker, den ein Server via `Bun.spawn` mit geerbtem stdin startet,
hängt unter `--mode json` **für immer** und liefert dabei nicht einmal eine
Teilausgabe, an der ein Timeout etwas diagnostizieren könnte.

**2 — Ein Ein-Wort-Prompt kostet ~9,4k Token, weil Pi Kontextdateien lädt.** Aus
dem json-Stream, wörtlich:

```json
{"input":10,"output":77,"cacheRead":6760,"cacheWrite":2553,"totalTokens":9400,
 "cost":{"total":0}}
```

10 Input-Token Prompt, **9.313 Token Kontext** drumherum. Pi liest `AGENTS.md`
*oder* `CLAUDE.md` global + alle Elternverzeichnisse + cwd (Spike §6 — hier ist es
gemessen statt zitiert, und der Effekt ist beim Worker-Tier das Gegenteil eines
Geschenks). `cost.total: 0` weil Abo, nicht weil gratis.

*Nebenbeleg für denselben Mechanismus:* der allererste Testprompt („Merke dir das
Codewort …") wurde vom Modell als Injection-Test **abgelehnt** — mit ausdrücklichem
Verweis auf „system instructions and CLAUDE.md". Der geladene Kontext ist also nicht
nur groß, er verändert das Verhalten des Workers.

### Struktur der json-Ausgabe

JSONL, ein Event pro Zeile, in dieser Reihenfolge:

```
session · agent_start · turn_start · message_start · message_end
· message_start · message_update ×12 · message_end · turn_end
· agent_start … agent_end · agent_settled
```

Der finale Text ist aus dem letzten `message_end` mit `role:"assistant"` sauber
extrahierbar (`content[].type === "text"`), samt `usage`. **Für ein Worker-Tier
brauchbar** — mit den zwei Auflagen oben.

**Beiläufig, aber für die Autonomie-Arbeit relevant:** der Strom endet auf ein
explizites **`agent_settled`**. Das ist ein maschinenlesbares „fertig", das Fleet
bei claude nicht hat — dort wird Fertigsein aus Byte-Stille *erschlossen*. Kein
Vorschlag hier, nur der Hinweis, dass es existiert (vgl. Zeile `00e5f771`).

> **VORSCHLAG** Worker-Tier-Zeile: `pi -p --no-session -nc --model <provider/id> < /dev/null`
> — `--no-session` (kein Session-Müll pro Wegwerf-Worker), **`-nc`
> /`--no-context-files`** (schneidet die ~9,3k Token und die Verhaltensänderung
> weg), stdin explizit geschlossen. `-nc` ist NICHT gemessen; es ist die aus Befund
> 2 abgeleitete Empfehlung und gehört vor Übernahme einmal nachgemessen.

---

## (d) Der Bridge-Prozessbaum — **GEMESSEN, und er korrigiert die Erwartung**

**Frage:** Mit der Bridge spawnt `pi` Claude Code unter sich — der Baum trägt beide
comms. Was folgt daraus für `FLEET_HARNESS_COMMS`?

### Was Fleets Probe überhaupt sieht

`paneAgentAt` (server.ts:2072) prüft **genau zwei Ebenen**: den Pane-PID selbst,
und `pgrep -P <panePid>` — die **direkten** Kinder. Tiefer geht sie nicht. Der
Vergleich ist `comm.startsWith(c)` nach `.split("/").pop()`, d. h. Basename, ein
absoluter Pfad in `comm` wird korrekt reduziert.

### Rechenweg — die Pane-Topologie, gemessen

Fleets Spawn-Form erzeugt `<shell>; exec /bin/zsh`, die Pane bleibt also die Shell:

```
depth 0   pane_pid 12713   zsh          ← paneAgentAt prüft
depth 1            12715   pi           ← paneAgentAt prüft (pgrep -P)
depth 2                    claude       ← AUSSERHALB der Reichweite
```

Sampling über einen echten Prompt, alle 0,6 s:

```
t=0.6…4.2s   d1=[pi]  d2=[claude]     ← Anfrage in Flug
t=4.8…9.6s   d1=[pi]  d2=[-]          ← SDK-Kind wieder weg
im Leerlauf  d1=[pi]  d2=[]           ← gar kein claude im Baum
```

Der Pfad des Kindes, vollständig:
`~/.pi/agent/npm/node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude`
(Basename `claude`). Gegenprobe im `-p`-Fall über 30 Snapshots: identisch —
`pi` durchgehend, das SDK-`claude` als **Kind von pi**, T4…T17, danach mit pi weg.

### Was das gegenüber der Erwartung aus `a64b681` korrigiert

Der Commit-Body begründet die Listen-Form so: *„eine Harness, die eine andere
umschließt … trägt BEIDE im Prozessbaum — ein Entwurf auf genau einen comm-Namen ist
falsch, bevor er gebaut ist."* **Die Listen-Form ist richtig, die Begründung trifft
für diese Bridge aber nicht zu, und zwar aus zwei unabhängigen Gründen:**

1. **Zeitlich** — im Leerlauf existiert `claude` im Baum **überhaupt nicht**. Das
   SDK-Kind lebt nur, solange eine Anfrage läuft. Ein Slot, der auf Eingabe wartet
   (der Normalzustand eines Fleet-Slots!), trägt nur `pi`.
2. **Räumlich** — selbst während einer Anfrage sitzt `claude` auf **depth 2**, und
   die Probe reicht bis depth 1. Sie könnte es also nie sehen, auch nicht im
   günstigsten Moment.

Konsequenz: `FLEET_HARNESS_COMMS=claude` allein würde einen kerngesunden,
wartenden Pi-Slot als **`no-agent`** melden — also genau als den stillen Fall, den
`a64b681` benennbar gemacht hat, nur diesmal als Fehlalarm. Und `pi,claude` ist
nicht falsch, kauft aber **nichts**: der zweite Name ist an dieser Probe tot.

> **VORSCHLAG (d):** `FLEET_HARNESS_COMMS=pi` — ein Name, gemessen ausreichend.
> `pi,claude` als defensive Variante ist unschädlich, aber ohne Wirkung; wer sie
> setzt, sollte wissen, dass sie keine Rückfallebene ist.
>
> `AUTHOR_COMMS = HARNESS_COMMS ∪ {claude}` bleibt davon unberührt richtig: mit
> `pi` in der Liste antwortet `pi` auf depth 1, und `wakeAuthor` bekommt sein
> positives Ergebnis, ohne je den Waiver zu nehmen.

---

## Zusammengefasst: der Adapter-Vorschlag

Alles hier ist **Vorschlag**, kein Code. Abnehmerin: Zeile `cc3b735c`.

```ts
// gemessen 2026-08-07 gegen pi 0.84.0 + pi-claude-bridge
spawnCmd({ sessionId, resume /* ignoriert — Pi hat EIN Flag für beide Rollen */, model }) {
  const parts = ["pi"];
  if (sessionId) parts.push("--session-id", sessionId);
  if (model)     parts.push("--model", `'${model}'`);  // Quoting tragend: Globs erlaubt
  return parts.join(" ");
}
```

| Env-Knopf | Vorschlag | Grundlage |
|---|---|---|
| `FLEET_HARNESS_COMMS` | `pi` | (d), gemessen |
| `FLEET_HARNESS_MODEL_FLAG` | `--model` | `pi --help` + jeder Lauf oben |
| Modell-String | `claude-bridge/claude-haiku-4-5` u. a. | passt in `HARNESS_MODEL_RE` (`/` erlaubt), nicht in `MODEL_RE` |

| supports-Flag | Vorschlag | Status |
|---|---|---|
| `resume` | `true` | **gemessen** (a), inkl. Pane-Respawn |
| `model` | `true` | **gemessen** — 8 Bridge-Modelle, `--model` wirkt |
| `transcript` | `true` | **gemessen** (a) — Pfad + Glob `*_<id>.jsonl` deterministisch; die Adapter-Variante für `projDir` bleibt Arbeit (Spike-Befund 5) |
| `effort` | `true` | **ungemessen** — `--thinking` existiert und die TUI-Fußzeile zeigt `medium`, aber kein Lauf hat den Wert variiert |
| `selfSchedule` | `true` | **ungemessen** — per Konstruktion (Env-Export vor dem Kommando, Spike §6), hier nicht nachgeprüft |

**Unverändert offen und nicht von diesen Messungen berührt:** Spike-Befund 1 — Pi
hat keine Berechtigungs-Schicht, ein Pi-Slot ist ab dem ersten Prompt das, was bei
claude `--dangerously-skip-permissions` wäre. Das bleibt der Owner-Entscheid, der
vor jedem spawnbaren Pi-Slot steht, und keine Messung hier macht ihn kleiner.

---

## Kosten

Alle Aufrufe auf **`claude-haiku-4-5`**, alle Prompts ein Satz oder kürzer.

| | Anzahl |
|---|---|
| Vollständige Modell-Turns (abgerechnet) | **6** |
| Mitten im Flug abgebrochen (Sampler-Bug, 2-min-Timeout; Anfrage evtl. angefangen) | 1 |
| Modell abgelehnt vor Generierung (`no-such-model-xyz` erreichte Claude Code) | 1 |
| Aufrufe ohne jeden Modell-Kontakt (3 Fehlerpfade + der `--mode json`-Hänger, 0 Bytes) | 4 |

Die sechs echten Turns: 2× `-p` argv (Session-Beweis), 2× TUI (Idle-Beweis + Baum),
1× stdin, 1× json. Der Pane-Respawn-Beweis (a) und alle Fehlerpfad-Messungen (c)
sowie die Auth-Gegenprobe (§0) kosteten **null** Modellaufrufe.

Ambiente Ablesung aus der TUI nach dem ersten Turn, nicht mir allein zurechenbar:
`Claude rate limit warning: 1% used (seven_day)`.

## Hygiene

Scratch-Socket `pimess` mit `kill-server` beendet (`no server running` bestätigt),
keine `pi`-Prozesse übrig. Der Live-Socket wurde **nie beschrieben** — die einzige
Berührung war ein lesendes `list-sessions` zur Kontrolle (13 Sessions, unverändert).
An `~/.pi` und `~/.local` wurde nichts installiert, deinstalliert oder
umkonfiguriert; die angelegten Session-Dateien unter `~/.pi/agent/sessions/` sind
Pis eigenes Laufzeit-Artefakt aus den Messläufen.
