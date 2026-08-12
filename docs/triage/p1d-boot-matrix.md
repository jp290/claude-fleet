# P1-D + H0 — Live-Boot-/Loader- und Capability-Matrix

**Gemessen:** 2026-08-12 · HEAD `90d711c` (Server-`bootHead` identisch, Deploy `dcc271ed` verifiziert)
**Art:** read-only Messkampagne mit zwei Wegwerf-Messlanes (Slots 11/12, nach der Messung entsorgt,
Baum sauber). Kombiniert P1-D (Loader-Wahrheit, Manifestfeld-Nutzen) mit dem H0-Minimum
(Capability-Fakten für den kleinsten Harness-Unblocker). Keine Freigabe des H1–H6-Gesamtprogramms.

**Versionen:** pi v0.84.0 · Codex CLI v0.147.0 · Modell beider fremden Lanes `gpt-5.6-sol` (effort low)
· claude = die messende MAIN-Session selbst (Slot 2).

## 1. Loader-Matrix — wer lädt was wirklich

| Harness | automatisch geladen | NICHT geladen | Beleg |
|---|---|---|---|
| claude (main) | `~/.claude/CLAUDE.md`, Projekt-`CLAUDE.md`, `.claude/CLAUDE.md`, Memory-Index | `AGENTS.md` | eigener Boot-Kontext dieser Session |
| pi (Lane, gezäunt) | `AGENTS.md` allein | `CLAUDE.md` | Pane-Boot: `[Context] AGENTS.md`; Probe-Antwort 2 |
| pi-unfenced (main) | wie pi (gleiches Binary) — **inferiert, nicht neu gemessen** | — | Spawn-Profil Slot 1 mechanisch gelesen: `pi --session-id … --thinking high`, kein `sandbox-exec` |
| codex (Lane, Clone-Form) | `AGENTS.md` + Environment-Kontext (Modell-Auskunft, kein Boot-Banner) | `CLAUDE.md` | Probe-Antwort 2 |

Byte-Konsequenz unverändert zur Baseline: fremde Harnesses starten mit ~5,5 KB (`AGENTS.md`);
das ~99-KB-Privatbuch erreicht sie nur über die Pflichtlektüre-Anweisung.

## 2. Capability-Matrix (H0-Minimum, im echten Agenten-Pfad gemessen)

| Probe | claude (Host) | pi (Lane, Zaun) | codex (Lane, Clone) |
|---|---|---|---|
| `/tmp`-Write | PASS | PASS | PASS |
| Git-Commit im eigenen Baum | PASS (Wegwerf-Repo) | **FAIL** `Unable to create '…/.git/worktrees/…/index.lock': Operation not permitted` | **FAIL** `Unable to create '…/.git/index.lock': Operation not permitted` |
| Fleet-API (`/api/self`) | PASS | **PASS** | **FAIL** (leere Antwort; Netz gesperrt) |
| tmux-Socket (`-L claudefleet`) | PASS | **PASS** (Socket liegt unter `/tmp`, das der Zaun öffnet) | **FAIL** `error connecting to /private/tmp/tmux-501/claudefleet (Operation not permitted)` |
| `~/.claude`-Write | PASS | **FAIL** `Operation not permitted` | **FAIL** `Operation not permitted` |
| Netz (`https://example.com`) | PASS (200) | PASS (200) | **FAIL** (`000`, exit 6) |

Überraschung gegenüber der Dokumentenlage: die gezäunte pi-Lane erreicht **Fleet-API und den
Live-tmux-Socket** — der Zaun sperrt `~/.claude`, nicht `/tmp`. Eine pi-Lane könnte also mehr
Suiten-Anteile fahren als „alles claude-Abhängige scheitert" nahelegt; die harte Grenze ist genau
`~/.claude` (Transkript-Pfade) und das eigene `.git`.

## 3. Canary-Fragen (aus `AGENTS.md` allein beantwortet)

| Canary | pi | codex |
|---|---|---|
| A: Verify-Reihenfolge + Stop beim ersten Fail | **korrekt und vollständig** | **korrekt und vollständig** |
| B: Wer committet/landet die Lane-Arbeit? | **FALSCH:** „The lane agent commits" — Sekunden nach dem eigenen EPERM | **FALSCH:** „The lane agent commits" — dito |
| C: Wie wird ein rotes e2e berichtet? | korrekt (same-tree-Rerun, Transcript, Tail zitieren) | korrekt |

**Kernbefund:** `AGENTS.md` trägt Verify- und Rot-Disziplin sauber, aber **nicht die
Commit-Wahrheit gezäunter Lanes**. Der Abschnitt „If you are a Codex lane" nennt Suiten und Netz,
verschweigt aber `.git`-read-only und den Host-Commit-Weg (`POST /api/slots/:id/commit`); für pi
gibt es gar keinen Abschnitt. Beide Harnesses erfinden daraus dieselbe falsche Antwort.

## 4. Readiness-Befunde (Boot-Blocker, live beobachtet)

1. **Codex-Trust-Prompt:** eine Clone-Lane bootet in „Do you trust the contents of this
   directory?" und frisst dort jeden unbeaufsichtigten Brief. Neben dem bekannten Paste-Race ein
   zweiter, bisher undokumentierter Grund, warum Prozess-Präsenz ≠ ready ist. (Manuell mit Enter
   quittiert; danach arbeitete die Lane fehlerfrei.)
2. **Füllstands-Selbstauskunft ist unbrauchbar:** pi meldete „35%", die Pane maß real 1,9 %/272k;
   codex meldete „31%" ohne Gegenmessung. Die Regelbuch-Krücke „sag Bescheid bei halber Füllung"
   misst nichts — der Sensor muss mechanisch sein (pi-Statuszeile ist per capture-pane lesbar).
3. **pi-unfenced:** Singleton belegt (Slot 1, Owner-Session) — bewusst nicht hineingeprobt; nur
   Spawn-Profil mechanisch verifiziert (unfenced bestätigt).

## 5. Manifestfeld-Nutzen (P1-B gegen die Messung)

| Feld | trägt heute eine reale Entscheidung? |
|---|---|
| `harnesses` | **ja, bestätigt:** `land-mechanics` nennt `["claude","pi-unfenced"]` — deckt sich exakt mit der Commit-Zeile der Capability-Matrix |
| `requiredCapabilities` + `ContextPackCapabilitySnapshot` | **Naht existiert, Fakten fehlten:** der Validator prüft `REQUIRED_CAPABILITY_MISSING`, aber `e2e/context-packs.ts` füttert einen fiktiven Voll-Snapshot (`fullCapabilities()`). Diese Matrix liefert erstmals echte Werte. |
| `triggers` · `modes` · `audience` · `estimatedBytes` | **kein Konsument** — kein Loader, kein Compiler liest sie. Nicht automatisch v1-Vertrag (YAGNI-Probe aus dem Theo-Vergleich §8.6). |

## 6. Nicht gemessen (ehrlich)

- claude-**Lane** (nur main gemessen; Mechanismus identisch — `CLAUDE.md` wird in Worktrees kopiert —, aber nicht frisch belegt);
- codex in **Worktree-Form** (nur Clone, der Adapter-Default);
- `suite-fast`/`suite-full` real gefahren (nur Vorbedingungen gemessen);
- ob die `CLAUDE.md`-Kopie in der Codex-**Clone**-Lane auf Platte lag (nur: nicht geladen);
- Verhaltens-Matrix aus dem alten P1-D-Brief (read-only-Disziplin, Scope-Stopp) — bewusst auf
  einen späteren Lauf verschoben, die Kampagne war auf Loader+Capabilities begrenzt.

## 7. Konsequenz

Der kleinste messbar begründete nächste Schnitt ist eine **Doc-Korrektur an `AGENTS.md`**
(Commit-Wahrheit gezäunter Lanes, Abschnitt für pi verallgemeinern) — beide fremden Harnesses
scheitern heute an derselben Canary. Danach: die echten Capability-Fakten dieser Matrix als
Snapshot in die P1-B-Validator-Familie. G1/P1-C bleibt offen, bis ein Router-Nutzen belegt ist;
diese Matrix allein rechtfertigt keinen Rulebook-Split.
