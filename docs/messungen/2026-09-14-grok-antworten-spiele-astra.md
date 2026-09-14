---
frage: Was antwortete Grok (zwei Sessions, 2026-09-14) auf die beiden Prompts aus docs/messungen/2026-09-14-grok-fragen-spiele-astra.md — Astra-Orchestrierung und Astra-Game-Development?
urteil: ROHMATERIAL, WOERTLICH, Antwort 2 vollstaendig (Owner 2026-09-14 09:1x, Board-Editor); Antwort 1 seit 12:4x per Chat, mit drei markierten Luecken; das aeltere Fragment bleibt darunter — der zweite Einfuegeversuch brachte Antwort 2 doppelt. Auswertung und die daraus gefileten Zeilen in eigener Notiz. Groks eigener Schluss: naechster Auftrag = Empfehlung 1 (Stack-Duell 24 h / ein spielbarer Wasser-Schnitt in einem Thread) als isolierte Lane mit messbarem Abbruch, kein neues Rollenpapier.
bereich: [spiele, astra, grok, orchestrierung, game-dev]
belege: [Prompts: docs/messungen/2026-09-14-grok-fragen-spiele-astra.md (490953f9); Plan §5d docs/plan-fleet-betrieb-2026-09-13.md; Richtung 262a8f71]
nicht-gemessen: alles — das ist Recherche eines Dritten; Quellen darin sind ungeprueft, bis eine Auswertungs-Zeile sie nachschlaegt
stand: 2026-09-14
---

# Grok-Antworten zu den Spiele-Prompts (G2) — Rohmaterial

Beide Antworten woertlich, vom Owner eingefuegt (Grok-Sessions 2026-09-14). Prompts: 2026-09-14-grok-fragen-spiele-astra.md.

## Antwort 1 — Astra-Orchestrierung (Prompt 1)

Woertlich, vom Owner 2026-09-14 12:4x per Chat an die Orchestratorin durchgereicht (nicht ueber den
Board-Editor). DREI LUECKEN, alle als `<!-- LUECKE -->` markiert: der Anfang fehlt (der Text setzt
mitten im Satz ein), ein Satz in §1 ist abgeschnitten, und der Uebergang von §5 zu „Drei
Empfehlungen" samt Empfehlung 1 fehlt. Eine Vollfassung ueber den Editor ersetzt diesen Block.

<!-- LUECKE: Anfang der Antwort (Stand-der-Recherche-Zeile, Vorspann bis „…startet ihr Astra mit") fehlt -->

…startet ihr Astra mit `codex -m gpt-6-astra` bzw. `model = "gpt-6-astra"` in `config.toml`. Ab etwa CLI 0.153.x ist Astra wählbar; 0.154.0 (9.9.2026) nimmt Astra in den Picker und ergänzt experimentelle Worktrees. Azure nennt 0.152.1 und 0.153.0 als mit Astra **validiert**, inkl. Multi-Agent-Orchestrierung — das ist Versionskompatibilität, kein Qualitätsbeweis für Spiele.

**Fehlende Astra-Belege (ausdrücklich).**
- Keine öffentliche Anleitung „Astra formuliert selbst geeignete Teilaufträge für Spiele".
- Kein reproduzierbarer Vergleich native Threads vs. getrennte Worktree-Sessions unter Astra.
- Kein Beleg, dass Astra Selbstbehauptungen (Kommentar = Beweis) zuverlässiger erkennt als frühere Modelle.
- Codex Cloud: Astra dort laut inoffizieller Modellspiegelung **nicht** verfügbar; lokal/CLI/IDE ja.
- Community-Setups (Astra-Orchestrator + Luna-Subagents, Drittanbieter-Gateways) sind keine OpenAI-Vorgabe.

---

### 1. Instruktionen und Harness-Einstellungen für Delegation

#### Belegt: Wann Codex überhaupt delegiert

Offizielle Codex-Doku beschreibt **zwei** Auslöser, die sich je nach Seite leicht widersprechen:

1. **Explizite Nutzeranweisung** — Formulierungen wie „spawn two agents", „delegate this work in parallel", „use one agent per point". Eine Konzepteite sagt zusätzlich: Codex spawne **nicht automatisch** und solle Subagents nur nutzen, wenn ihr ausdrücklich parallel Arbeit verlangt.
2. **Projekt-/Skill-Texte** — aktuelle Subagent-Seite: lokale Codex-Releases delegieren auch, wenn `AGENTS.md` oder Skills Delegation verlangen.

Das ist ein **Doku-Widerspruch** (Juli-Konzepteite vs. spätere How-to-Seite). Für den Pilot gilt konservativ: Delegation nur dann als Absicht behandeln, wenn der Brief *und* `AGENTS.md` sie namentlich verlangen; nicht darauf vertrauen, dass Astra „von selbst" sinnvoll teilt.

Offizielle Prompt-Form für parallele Arbeit: Arbeitsteilung sagen, warten oder nicht warten sagen, gewünschte Rückgabe sagen. Beispiel aus der Doku:

> Review this branch with parallel subagents. Spawn one subagent for security risks, one for test gaps, and one for maintainability. Wait for all three, then summarize the findings by category with file references.

#### Belegt: Harness-Knöpfe

In `config.toml` unter `[agents]`:

| Einstellung | Öffentliche Wirkung |
|---|---|
| `enabled` | Multi-Agent-Tools an/aus (Default an) |
| `max_concurrent_threads_per_session` / Legacy `max_threads` | Deckel offener Kind-Threads (Default oft 6) |
| `max_depth` | Schachtelung; Default 1 = Kinder dürfen nicht weiter delegieren |
| `default_subagent_model` / `default_subagent_reasoning_effort` | Spawn-Defaults |
| Custom-Agent-TOML in `.codex/agents/` | `name`, `description`, `developer_instructions`; optional `model`, `sandbox_mode` |

Eingebaute Rollen: `explorer` (leseintensiv), `worker` (Umsetzung), `default`. Custom-Agent mit `sandbox_mode = "read-only"` ist das dokumentierte Muster für Beweis-Sammlung ohne Schreibrecht.

`AGENTS.md` lädt vor der Arbeit: Build/Test-Befehle, Kon<!-- LUECKE: Satz abgeschnitten -->…geer Default `max_threads ≈ 6` **nicht** konservativ. Öffentliche Issues zeigen 429er schon bei Parent + wenigen Kindern.

---

### 2. Native Sub-Agent-Threads vs. getrennte Sessions mit Worktrees

#### Was nativ ist (Codex)

Native Threads: Parent nutzt `spawn_agent` / Follow-ups; Codex wartet, sammelt, schließt Threads; `/agent` wechselt. Kind erbt Sandbox und Freigabemodus des Parents, außer Custom-Agent setzt `sandbox_mode`. Es gibt **keine** offizielle Aussage, dass native Threads automatisch eigene Git-Worktrees bekommen. Parallel schreibende Kinder teilen denselben Baum — genau die Warnung der Doku.

Im Codex-Quelltext existiert `fork_turns` (wie viel Elternkontext an Kinder geht). Das ist Implementierungsdetail, keine Nutzer-Garantie für vollständige Kontextübernahme.

#### Was Worktrees isoliert

**Codex-App (dokumentiert, nicht experimental):** Modus *Worktree* legt einen Git-Worktree an (`$CODEX_HOME/worktrees`), eigener Dateibaum, geteiltes `.git`. Ein Branch nur in einem Worktree gleichzeitig. Ignorierte Dateien nur mit `.worktreeinclude`. Codex-managed Worktrees sind wegwerfbar.

**Codex CLI 0.154.0 (9.9.2026, experimental):** `--worktree` / `/worktree` für neue oder geforkte Sessions; Feature erst aktivieren. Gilt für Session/Fork/`codex exec`, **nicht** als dokumentierte Auto-Isolation jedes nativen Kindes.

**Claude Code (Vergleich, nicht Astra):** Sessions mit `--worktree`; Subagents mit `isolation: worktree`. Offiziell: Worktrees isolieren Dateiedits; Subagents teilen Arbeit in einer Session. Es gibt dokumentierte Bugs (cwd-Bleed in den Parent).

„Claude Fleet" als Produktname ist öffentlich vor allem ein Drittrepo, nicht euer internes MAIN/Lanes/Gate. Übertragbar ist nur das Muster: isolierter Checkout + begrenzter Auftrag + serverseitiges Merge-Gate.

#### Vergleich (belegt vs. Schlussfolgerung)

| Achse | Native Threads (Codex) | Getrennte Session + Worktree |
|---|---|---|
| Kontextübernahme | Parent orchestriert; Summaries zurück; `fork_turns` im Code, Umfang nicht nutzergarantiert | **Belegt:** kein automatischer Chat-Kontext. Brief muss Quellen tragen |
| Schreibisolation | **Belegt:** gemeinsamer Baum, Konfliktrisiko | **Belegt:** eigener Checkout. Branch-Exklusivität beachten |
| Unabhängige Kritik | Dieselbe Session/Modelllinie synthetisiert. Kein zweiter Wahrnehmungskanal | Zweite Session kann denselben Diff ohne Parent-Narrativ lesen. **Unabhängig ≠ wahr** |
| Kosten | Mehr Tokens je Kind; Quota/429 bei Parallelität | Zweite Session + zweites Reasoning; Worktree-Plattenplatz |
| Integration | Automatisches Wait/Consolidate | Owner/MAIN muss Diff mergen; passt zu eurem Gate |

**Meinung, als Übertragung markiert:** Lesende Exploration → native Threads mit `read-only`. Schreibende Lane → **eine** Session in einem Worktree, nicht drei native Writer. Das ist Harness-Physik plus RAM, kein Astra-Superpower.

---

### 3. Wie MAIN Ergebnisse prüft — und welche Fehler belegt sind

#### Belegte Prüfinstrumente (Codex, modellunabhängig)

Offizielle Best Practices: nicht bei „Änderung gemacht" stehen bleiben; Tests laufen, Checks, Verhalten bestätigen, Diff prüfen. `/review` gegen Basisbranch, uncommitted oder Commit; `/diff`. `AGENTS.md` soll „Done" und Verifikation enthalten.

Das prüft **Baum und Tests**, nicht Geschmack und nicht „ist das Spiel spielbar". Owner-Stand 13.09. bleibt maßgeblich: nicht gespielt = nicht abgenommen. Das ist euer interner Befund, kein OpenAI-Satz.

#### Prüfprotokoll, das die öffentlichen Lücken schließt

MAIN sollte Handoffs **nicht** am Kind-Text messen. Minimal:

1. **Tatsächlicher Diff** — `git diff` / `/diff` gegen den Auftrag; Dateien außerhalb der Schreibfläche = Fail.
2. **Revision** — Commit-Hash im Worktree, nicht „ich habe gepatcht".
3. **Testausgabe** — Roh-Log der genannten Befehle, nicht Paraphrase.
4. **Ausgelassene Pflichten** — Brief-Checkliste Punkt für Punkt; fehlender Punkt = unfertig, kein Teil-Erfolg.
5. **Nicht zugestellte Resultate** — Thread geschlossen ohne Artifact-Pfad; Quota vollgelaufen; Spawn abgelehnt.

Unabhängige Produktwahrnehmung (anderer Browser-Rechner, Mensch) bleibt außerhalb des Modells. Interne Private-repo-p-Synthese (Kommentar als Beweis) ist **Erfahrungsbericht**, übertragbar als Prüfvorschrift, nicht als Astra-Messung.

#### Typische Fehler — getrennt

**Belegt öffentlich (Harness):**
- Fertige Subagents zählen weiter gegen das Thread-Limit, bis explizit geschlossen.
- Mehr als wenige gleichzeitige Streams: 429, auch Parent+Kinder. Ab ~29.8.2026 in einem dokumentierten Pro-Setup.
- Je nach Parent-Modell: Kinder ignorieren konfiguriertes Billigmodell, Threads fehlen in `/agent`, Token-Bleed. Issue vom 12.7.2026, CLI 0.144.1 — **nicht** an Astra gebunden.
- Parallel schreiben im selben Baum: offizielle Warnung, kein Einzelfall-Blog.

**Erfahrungsbericht intern (keine Astra-Kontrollgruppe):**
- Selbstbehauptung im Proof (Private-repo-j I, 26.08.).
- Historische Proofs nach Reparatur, kein Produktstopp (Private-repo-j II, 27.08.).
- Hoher Prozessanteil, unklare Trennung zweier Anläufe (Private-Repo-C).
- Gate bleibt offen nach vielen Critic-Runden; Aufwand in Browserstart/Lesbarkeit/Brief (Private-repo-f, 19.08.).
- MAIN akzeptiert Kommentar als Beweis (Private-repo-p, 03.09.).

**Nicht belegt:** Astra sei immun gegen diese Fehler. OpenAI behauptet leichtere Nachvollziehbarkeit und weniger Iteration bis „production quality" — Vendor-Claim ohne euer Abnahmekriterium.

---

### 4. Kurze Brief-Form und nutzbarer Beispielbrief

#### Was nachweislich dokumentiert ist (nicht „wirkt nachweislich in Spielen")

Belegt als *empfohlene Form*, nicht als Outcome-Studie:

- Vierfelder: Goal / Context / Constraints / Done when.
- Bei Delegation: Teilung, Wait-Regel, Rückgabeform.
- Für Astra: Quellen, Vorlagen, Constraints, Checks.
- Schmale Custom-Agents, Toolfläche = Job, kein Driften.

„Nachweislich kürzer = besser" ist **nicht** belegt. Unbelegte Prompt-Wirkung = Hypothese.

#### Beispielbrief (direkt nutzbar)

Status: **Übertragung** der offiziellen Vierfelder-Form auf euren Scope. Wirkung auf Astra: Hypothese.

```text
ROLLE: Lesender Subagent (explorer). Kein Schreiben außer einer Datei unter /tmp/handoff/.

ZIEL
Karten, wie im aktuellen Checkout Wasser gerendert und als Spielzustand
geführt wird. Keine Feature-Arbeit. Kein Damm-Gameplay erfinden.

QUELLEN (nur diese)
- Repo-Root inkl. AGENTS.md
- Suche nach: water, dam, beaver, canvas, webgl, swiftshader
- docs/ oder README, falls vorhanden
Nicht nutzen: alte Demo-Videos, Chat-Erinnerungen, „früher hat's geklappt".

BEFUGNISSE
- Lesen, Suchen, Tests im Dry-Run lesen
- Höchstens bestehende headless Testdateien ausführen, wenn der Befehl
  in AGENTS.md steht
- Keine Commits, keine Abhängigkeiten installieren, die nicht schon da sind
- Keine zweiten Agenten spawnen (max_depth bleibt 1)

SCHREIBFLÄCHE
Nur /tmp/handoff/water-map.md
Verboten: src/, public/, package.json, Testdaten, AGENTS.md

ABSCHLUSSBEWEIS (ohne das ist der Auftrag unfertig)
Datei mit:
1. Dateipfaden + Symbolnamen für Renderpfad (Canvas2D vs WebGL2)
2. Wo Wasser ein Spielzustand ist — oder wörtlich: „kein Zustand, nur Optik"
3. Befehl, der auf dieser Maschine (headless Linux, ≤8 GB) eine
   sichtbare Wasserfläche startet; oder „kein reproduzierbarer Startbefehl"
4. Rohauszug der letzten 30 Zeilen, falls ein Befehl lief
Kein Satz der Form „funktioniert", „demo ready", „Damm wirkt".

RÜCKGABE
- Pfad der Handoff-Datei
- git rev-parse HEAD
- Liste unerledigter Briefpunkte
MAIN prüft Diff (muss leer sein im Repo) + Handoff-Datei.

STOP-GRENZE
Nach 25 Minuten Wandzeit oder nach 1 fehlgeschlagenen Testdurchlauf: stoppen,
Handoff mit Lücken schreiben. Keine Reparaturspuren, kein zweiter Anlauf
im selben Thread. Keine Promotion nach main.
```

Schreibende Variante: eine Datei oder ein Verzeichnis als Schreibfläche; Done when = *menschlich* im anderen Browser sichtbares Verhalten plus Testlog; Promotion bleibt Owner.

---

### 5. Kleiner Vergleich — ohne Delegationszahl als Erfolg

**Belegt als Designregel:** Subagent-Zahl und Prozessmenge sind Kosten, keine Qualität. Offiziell steigen Tokens mit jedem Kind. Interne Audits zeigen Prozess ohne spielbare Abnahme.

**Versuchsplan (Meinung/Übertragung, messbar):**

Gleicher Auftrag, neues Repo, Steinbruch nur als gelesene Vorlage, Stack frei aber Startziel fest:

> „Eine leere Karte, ein Biber, ein Wasserfeld. Spieler kann einen Damm-Balken setzen. Wasser staut sich sichtbar (Canvas2D reicht). Kein Gegner, keine Ökonomie, kein Sieg."

Drei Arme à ein Lauf, nicht parallel auf derselben Maschine (RAM + 429):

| Arm | Harness |
|---|---|
| A | Eine Astra-Session, keine Subagents, lokaler Checkout |
| B | Astra-MAIN + ein nativer `explorer` (read-only), danach MAIN schreibt selbst |
| C | Astra in `codex exec --worktree` (CLI ≥ 0.154, Feature an), ein Writer, eigener Checkout |

**Messgrößen (Empfänger = Owner oder benannter Prüfer, anderer Browser):**
- Zeit bis *spielbare* Änderung: erste Session-Startzeit → Zeitpunkt, an dem der Prüfer den Damm setzt und Stau *sieht* (nicht Agent-Behaupt<!-- LUECKE: Rest der Messgroessen, Ueberschrift „Drei Empfehlungen" und Empfehlung 1 fehlen; der Text setzt mitten in Empfehlung 1 wieder ein -->…budget: 45 min inkl. MAIN-Prüfung.
- Abbruch: Spawn ohne Brief, Schreibversuch im Repo, oder „Wasser wirkt" ohne Pfad/Log.

**2. Eine Schreibfläche, ein Writer, Worktree sobald CLI 0.154 trägt.**
Keine parallelen Writer auf dem Hauptcheckout. Native Threads nicht für gleichzeitige Edits.
- Erfolg: spielbarer Damm-Stau auf dem menschlichen Browser-Rechner; `git diff` nur in der vereinbarten Fläche; Testlog angehängt.
- Zeitbudget: 3 h Wandzeit für den ersten Slice (leere Karte + Wasser + ein Damm).
- Abbruch: zweiter Writer, Merge-Konflikt im selben Baum, oder nach 3 h kein vom Menschen gesehener Stau — Slice verwerfen, nicht „weiter reparieren".

**3. MAIN prüft Artefakte, nicht Prosa.**
Checkliste: Diff, HEAD, Testrohlog, Briefpunkte, Stop-Grenze. `/review` und `/diff` als Werkzeug, nicht als Abnahme. Owner spielt oder der Slice gilt als nicht geliefert.
- Erfolg: Prüfer braucht ≤ 20 min und entscheidet promote / reject ohne Agent-Kommentar als Beweis.
- Zeitbudget: 20 min Prüfung pro Handoff.
- Abbruch: Kommentar ohne Diff, wiederverwendeter Alt-Proof, oder Gate-Diskussion länger als die Spielfrist.

---

**Kurzfassung:** Astra kann im Codex-Harness Threads starten, warten und zusammenfassen. Geeignete Teilaufträge entstehen öffentlich belegt durch *euren* Brief, `AGENTS.md` und Custom-Agents — nicht durch eine dokumentierte Astra-Autonomie für RTS. Native Threads teilen den Baum; Isolation ist Worktree/Session, bei CLI noch experimental. Wirksamkeit in eurem Spiel ist ungemessen. Der Pilot wertet sichtbaren Stau und Prüferzeit, nicht die Zahl der Agenten.

### Antwort 1 — aelteres Fragment aus dem Terminal-Paste (deckt u.a. den fehlenden Anfang: Modellkarte, Erfahrungsberichte)

- Belegt zu Astra als MODELL, nicht zur Delegation: gpt-6-astra, Kontext 1 050 000 / Output 128 000,
  Efforts low|medium|high|xhigh|max, kein `none`; Tools computer_use, code_interpreter, apply_patch;
  Cutoff 30.04.2026. Produkttext = Marketing, kein Delegationsbenchmark. Azure Foundry: CLI 0.152.1/0.153.0
  mit Astra inkl. Multi-Agent validiert — Validierung, kein Qualitaetsvergleich (04.09.2026).
- Erfahrungsberichte: Ricouard "Building games with Astra" 04.09.2026 — EIN Thread, klare Constraints,
  window.__…-Inspektion, Vitest+Playwright, Headless-Chromium/SwiftShader, KEINE Subagents;
  Loop reproduzieren → State/Screenshot → Patch → derselbe Check. Playco/OpenAI 03.09.: "50 % weniger
  manuelle Fixes", Vendor-Fall, Unity/Godot, keine Replikation. Community-Plugins (Astra Root, Luna/Sol/Terra
  Kinder): Drittanbieter. Forum 11.09.: Astra lehnte "Exit 0"-Kind ab, weil Artefakt fehlte (Einzelbericht).
- Fehlende Belege: KEIN Beleg, dass Astra bessere Teilauftraege formuliert als gpt-5.6-* im selben Harness;
  Subagent-Katalog nennt gpt-5.6/Terra/Luna. Kinder auf Astra = teuer und unbelegt.
- Eigenes Arbeiten: parallel lohnt bei leselastigen unabhaengigen Schnitten; Schreiben in dieselben Dateien =
  Konflikte. Meinung: bei leerem Repo + 8 GB ein einzelner Astra-Thread bis erster spielbarer Kern.
- §2 Tabelle native Sub-Agent-Threads vs Worktree-Sessions: Kind startet mit Auftrag + ererbtem
  Modell/Effort/Sandbox, Rueckgabe = Zusammenfassung; Schreibisolation schwach (gleicher Tree), Parent-owned
  V2-Threads read-only fuer Direktinput; Worktree stark; Kritik unabhaengiger in frischer Session; Kosten:
  Astra API $10/$50 je 1M, Cache $1/$12.50; zweiter Headless-Chromium+SwiftShader ist der RAM-Engpass;
  Integration: Gefahr "fertig" ohne Artefakt. Codex CLI --worktree experimentell 0.154.0 (09.09.2026).
  Uebertragung: native Threads fuer kurze LESENDE Schnitte; Worktree-Sessions sobald geschrieben wird.
- §3 MAIN prueft: git diff / /diff (nicht Kind-Zusammenfassung) · /review mit eigenem review_model,
  Reviewer schreibt nicht · Testausgabe mit Exitcode · Sandbox-Grenze read-only vs workspace-write.
  Nicht automatisch geprueft: ausgelassene Pflichten, nicht zugestellte Resultate.
  Fehlermuster-Tabelle: Zusammenfassung statt Artefakt (Forum 11.09.) · Kommentar als Beweis (intern) ·
  Parallelwriter · Kind erbt Root-Tools (#38687) · High-Tier-Parent umgeht Kind-Limit, Token-Bleed (#32510) ·
  Spawn ignoriert Wunschmodell (V2, 10.07.) · fertige Kinder blockieren max_threads (15.05.) ·
  Gate offen trotz Critic-Runden (intern Private-repo-f).
  Mindestpruefung: (a) git status+Diff gegen Brief, (b) Commands mit Exitcode, (c) beobachtbarer
  Spielzustand (Mensch oder zweiter Headless-Lauf), (d) Liste "beauftragt aber nicht geliefert".
- §4 Brief-Form: OpenAI Best Practices = Goal, Context, Constraints, Done when (+Output/Boundaries);
  AGENTS.md fuer dauerhafte Rules. Beispielbrief (wasser-damm): ZIEL / QUELLEN (nur diese) / BEFUGNISSE
  (Schreiben nur 4 Pfade, Commands, kein push, keine Subagents, bei Blockade STOP+Frage) / SCHREIBFLAECHE /
  ABSCHLUSSBEWEIS (diff --stat, Test-Exit 0, e2e Exit 0, Screenshot vor/nach + State-Dump
  window.__BEAVER__.water[cell], ein Browser) / RUECKGABE (Diff-Stat, Kommandos+Exit, Screenshotpfade,
  State-Dump, Risiken; keine Erfolgsprosa) / STOP-GRENZE (45 min oder 2 e2e-Fehlversuche oder Datei
  ausserhalb Schreibflaeche).
- §5 Vergleich A/B/C, gleiche Aufgabe, frisches Repo, Cap 45 min: A ein Astra-Thread ohne Subagents ·
  B Astra-MAIN + EIN natives Kind explorer read-only, MAIN schreibt selbst · C zweite Session
  codex --worktree -m gpt-6-astra fuer den Schreib-Schnitt. Messgroessen: Zeit bis SPIELBARE Aenderung
  (e2e Exit 0 UND Mensch sieht Stau), Nacharbeit (Minuten+Commits), Pruefaufwand Empfaenger; Tokens/
  Spawn-Zahl nur zaehlen. Abbruch: Cap ohne Beweis, Schreibflaeche verlassen, zweiter Chromium,
  Selbstbehauptung ohne Diff.
- Drei Empfehlungen: (1) ein spielbarer Wasser-Schnitt, ein Thread, maschinenlesbarer Done; 2×45 min;
  Erfolg = Beweis 1-4 + Owner hat gespielt; Abbruch nach zwei Laeufen ohne State-Dump/e2e.
  (2) danach A/B/C n=1 je Arm, 3×45 min + 30 min Owner; Arm mit kleinster Summe wird Default;
  Abbruch wenn B/C Summe ≥20 % ueber A oder Isolation bricht. (3) MAIN-Checkliste in AGENTS.md,
  Reviewer read-only: Diff gegen Brief-Pfade, Command+Exit, State-Dump, beauftragt/nicht geliefert,
  /review mit getrenntem review_model; kein Merge ohne die vier Punkte; Abbruch: Merge auf Kind-Prosa.
- Luecken: kein Astra-vs-Fleet-Vergleich, kein RTS-Benchmark, Subagent-Doku 5.6-zentriert,
  CLI-Worktrees experimentell, RAM 7 GB als harte Decke, SwiftShader ≠ Ziel-GPU.

## Antwort 2 — Astra-Game-Development (Prompt 2)

Stand der Recherche: **14.09.2026**. Unten getrennt in **belegt**, **Erfahrungsbericht** und **Meinung**. Astra-Übertragungen sind als solche markiert. Öffentliche Belege für *Astra als Spielbauer* sind dünn; sie beschreiben vor allem Modellfähigkeit und ein Studio-Tool, nicht euer Beaver-RTS.

---

## 1. Etablierte Wege 2026

**Belegt – der dominante Produktionsweg ist „kleiner spielbarer Loop zuerst, dann harte Play-/Reparaturschleife“, nicht „Vertical Slice als Hochglanzfilm“.**

OpenAIs Codex-Leitfaden für Browser-Spiele (Dokumentation, Stand 09.07.2026) schreibt genau diese Reihenfolge: erst `PLAN.md` mit Ziel, Loop, Steuerung, Sieg/Niederlage, Optik, Stack und Meilensteinen; dann `AGENTS.md`; dann Bau; dann Iteration **gegen den laufenden Build** mit Playwright, nicht gegen den Prompt.
Dieselbe Sammlung listet als erste Aufgabe „Build the first playable loop“.

Der kuratierte Skill `develop-web-game` (Quelle: `openai/skills`, Apache-2.0; Spiegel 10.09.2026) macht daraus eine Zwangsform: eine Änderung → `window.advanceTime(ms)` → `window.render_game_to_text` → Playwright-Aktionen → Screenshot **und** Zustands-JSON prüfen. Ohne Deterministik-Hook gilt der Test als flaky. Screenshots sollen angesehen, nicht nur erzeugt werden.

**Öffentlicher Jahresbenchmark, kein Studio-Standard:** Cursor Vibe Jam 2026 (01.04.–01.05.2026, Regeln u. a. ≥90 % KI-Code, sofort im Browser ohne Login) schloss mit **945 Spielen** und **242 212 Spielern**. Organisator Pieter Levels; Jury u. a. Tim Soret. Gold: *A Game About Capybaras Delivering Food* (Leo, Claude Code + Three.js, zwei Wochen, >27 000 Zeilen, $25 000).
**Gegenbeispiel / Geschmack:** Juror Tim Soret, 03.05.2026: KI sei für große kreative Spieleprobleme noch schwach; viele Jam-Spiele seien „still slop“, der Jam messe vor allem die *Trajektorie*.

**Konkrete Agenten-Spielprojekte (reproduzierbar oder wenigstens live):**

| Projekt | Agent / Zeitraum | Was belegt ist | Was *nicht* belegt ist |
|---|---|---|---|
| XDA-Vergleich: Browser-Roguelike, identisches Briefing | Claude Code / Codex / Antigravity; Artikel 30.08.2026 | Claude baute Headless-Sim **und** hunderte Zeilen Playwright (Waffen, Ziele, Sieg/Tod, Viewport). Codex: ~24 Browser-Checks. Autor spielte und urteilte. | Kein Peer-Review; ein Autor, ein Brief; „poliert“ ≠ unabhängige Playtests. |
| Outpost Ulu, Tower Defense, `td.buildaloud.ai` | Claude Code, 21.05.–Mitte 06.2026 (~3 Wochen) | Next.js-PWA + Phaser-Render, BDD **93 Feature-Dateien / 698 Szenarien**, Headless-Simulationsmatrix in CI. | Spaß nur vom Builder behauptet. |
| 24h-3D-Roguelite (Reddit, 08.–09.08.2026) | Claude Code, drei Gauntlet-Prompts | Three.js/TS/Vite; Agent fuhr **echte Input-Events** durch den Input-Manager und schrieb Frames; Trailer = Sim-Replay, kein Screen-Grab. | Ein Anon-Post; Assets teils Kenney/KayKit. |
| Luden.io / SuperWEIRD-Preprod | Cursor/Zed + LÖVE, 09.07.2025 | GDD → Agent startet Spiel selbst, liest Gameplay-Logs; Tiled + prozedurale Grafik. | Älter als Astra; Lua-Engine, nicht Browser. |
| Catan-Selbsttest | Cursor Auto, Dez. 2025 | Agent spielt Partien, loggt Regelbrüche, Replay per RNG-State; Mensch erst für „gültig aber schlecht“. | Brettspiel, nicht Echtzeit-RTS. |
| Vibe Jam 2026 / Capybara | Claude Code, 2 Wochen | Preis + öffentliche Beschreibung (Three.js, Multiplayer, Editor-Tools). | Kein Audit eures Typs; Owner hat nicht „RTS-Kern“ verlangt. |

**Screenshots allein sind 2026 etabliert als Diagnose, nicht als Abnahme.** Der Codex-Skill verlangt sie *zusätzlich* zu Zustands-JSON und Interaktion. Visual-Regression (`toHaveScreenshot`, Vitest 4 Browser Mode, 03.09.2026) prüft Layoutstabilität, nicht ob jemand eine Partie zu Ende gespielt hat.

**Passender erster Slice für euer Versprechen** (Meinung, an die oben belegte Loop-Lehre gebunden):

**„Ein Teich, ein Damm, eine Welle.“** Eine Karte im Look 1999–2003 (isometrisch oder ¾-Aufsicht, Palette RCT2/AoE2). Spieler entscheidet, *wo* 3–8 Dammsegmente stehen und welchen Graben das Wasser nimmt. Eine feindliche Kolonne hat einen sichtbaren Pfad; Wasser staut, flutet oder zwingt Umwege. **Sieg:** Feindlager steht unter Wasser *oder* Welle ist tot, bevor die Lodge fällt. **Niederlage:** Lodge zerstört/geflutet oder Zeit abgelaufen (3–5 min). Keine Ökonomie, kein Tech-Tree, kein Editor. Das ist der kleinste Kern mit *Entscheidung, Gegnerwirkung und Ende* – genau das, was Audit I/II am alten Wasser-Demo vermissten (**interne Historie; Übertragbarkeit auf Astra offen**).

---

## 2. Wie ein Agent Spaß und Aussehen beurteilt, ohne dass ein Mensch jede Runde spielt

Drei Schichten. Vermischung war der Warnfall eurer Audits.

### A. Automatisierte Spielbarkeit — messbar, kein Spaß

| Signal | Was es leistet | Grenze |
|---|---|---|
| Headless-Sim / Tick-Runner | Regeln, Sieg/Niederlage, Pfadfindung, Dammwirkung ohne GPU | Sieht nichts. Builder kann Predikate an den eigenen Code hängen. |
| `advanceTime` + Aktionslog | Deterministische Repro | Nur so gut wie die Hook-Treue. |
| Playwright-Eingaben (echte `keydown`/`click`) | Beweist, dass die *Runtime* auf Input reagiert | Bot-Pfad ≠ menschliches Timing. |
| Replay (Seed + Input-Log, gleicher Runtime-Pfad) | Fix-Verifikation, Trailer ohne Screen-Grab (siehe 24h-Roguelite) | Beweis der Repro, nicht der Lust. |

**Belegt:** Codex-Skill und XDA-Claude bauen genau diese Schicht. Catan-Loop zeigt: Agenten finden Regelbrüche zuverlässiger als „fühlt sich falsch an“.

### B. Visuelle Lesbarkeit — halbautomatisch

Screenshots, Video, Accessibility-Baum (für DOM-UI, **nicht** für Canvas-Inhalt), Pixel-Diff gegen Baseline.

**Belegt:** Playwright-MCP `scale: device` (PR 25.06.2026) verbessert Vision-Input; Canvas bleibt für den A11y-Baum stumm, Vision muss das Bild lesen.
Chromium-Doku: SwiftShader-WebGL ist **opt-in** (`--enable-unsafe-swiftshader`), kein Garant für Player-GPU.

Lesbarkeit-Proxys, die ein Agent prüfen *kann*: Kontrast Lodge vs. Wasser vs. Feind; Dammeffekt in zwei aufeinanderfolgenden Frames (Wasserlinie wandert); Einheit nicht hinter Terrain verloren; HUD überdeckt Ziel nicht.

**Grenze:** Pixelgleichheit ≠ „liest sich wie AoE2“. Software-WebGL weicht von Player-GPU ab – ein Headless-Grün ist kein Geräte-Grün.

### C. Subjektiver Spaß — Agent nur als blinder Critic *nach* Fremdinput

**Erfahrungsbericht / öffentliche Praxis:** Builder, der dasselbe Spiel gerade erzeugt hat, ist ein schlechter Geschmacksrichter (XDA-Antigravity „habe durchgespielt“ bei kaputter Bewegung; euer Private-repo-p-Fall: Kommentar als Beweis).

Blinde Critics brauchen **Build + Capture ohne Builder-Rationale** – das steht bereits in eurem Fleet-Vertrag und entspricht der Catan-Trennung „Bug vs. unerwünscht“.

**Wo Mensch nötig bleibt (Meinung, aber deckungsgleich mit Soret und Playco-Zitat):** Steuerungstakt, „ist der Damm *sichtbar wirksam*“, Geschmack 1999–2003, ob man eine zweite Partie will. Playco/Vieira, 03.09.2026: der Nutzen von Astra war, *mehr Ideen selbst zu spielen*, nicht sie wegzuproxyn.

**Spaß-Proxys und ihre Grenze**

- Bot überlebt / stirbt in erwarteter Tickzahl → Regelwerk, nicht Spannung.
- Heatmap „Spieler klickt Dammslots“ → Aufmerksamkeit, nicht Freude.
- Sessionlänge (CODEX MORTIS nannte 71 min; **Erfahrungsbericht/Marketing**, nicht euer Genre).
- Critic-Score auf Screenshot → Lesbarkeit höchstens.

Kein Proxy ersetzt eine vom Owner gespielte Partie bis Sieg oder Niederlage.

---

## 3. Minimale Studio-/Aktstruktur

**Belegt als Muster, nicht als Pflicht-Orga:** wenig Rollen, harte Isolation, ein Gate nach *gespielt*, nicht nach *gebaut*.

Was sich in öffentlichen Projekten wiederholt:

1. **Plan-Akt** (kurz, schriftlich): Ziel, Sieg/Niederlage, Stack, Was-nicht. Codex `/plan` → `PLAN.md`.
2. **Bau+Selbstspiel in derselben Session:** derselbe Agent implementiert, startet Build, sendet Input, liest Konsole/JSON, flickt. Das ist der Codex-Skill und Luden.io-Loop. Isolation *innerhalb* dieser Session lohnt nicht.
3. **Unabhängige Prüfung:** frischer Kontext, kein Builder-Tagebuch. Anthropic dokumentiert Worktrees genau dafür (`claude --worktree`, Subagent `isolation: worktree`, Docs Stand 12.09.2026). Codex CLI hat experimentelles `--worktree` ab rust-v0.154.0 (09.09.2026).
4. **Promotion:** Mensch. Playco lässt Astra Prototypen bauen; Abnahme bleibt „gameplay preferences“.

**49-Agenten-Studios** (Claude Code Game Studios, Mai 2026; Codex Game Studio-Templates) sind **Vorschläge**. Kritik vom 19.05.2026: alle Rollen teilen eine Session, „unabhängiger“ Reviewer ist dasselbe Modell mit anderem Prompt.
Das deckt sich mit eurer Lage: **neue Rollenentwürfe nicht vor Belegen festziehen.**

**Astra-Übertragung, nicht Beleg:** Euer „Program-MAIN + Worktree-Lanes + serverseitiges Gate“ ist *strukturell* nah an Worktree-Isolation + Review-Gate. Öffentliches „Claude Fleet“ (`ibrews/claude-fleet`) ist ein **anderes** Produkt (Multi-Maschine, Git-Inbox). Nicht verwechseln.

**Fallen (belegt + interne Historie, Übertrag offen):**

| Falle | Öffentliche Spur | Eure Historie |
|---|---|---|
| Endloskritik / Critic vor Spielinput | 49-Agent-Hierarchien ohne Play-Gate; Opusfived als Karikatur der Selbstprüfung | Private-Repo-C Gate 1 nach fünf Critic-Runden offen |
| Vorweggenommenes Geschmacksgate | Builder bewertet eigene Screenshots | Private-repo-p: Kommentar = Beweis |
| Verlorene Übergabe | Shared Context, Markdown-„Gedächtnis“ | Wasser-Demo → Messrunden statt Kernloop |
| Prozess statt Produkt | Metaplay 14.05.2026: Buildzeit ist der Flaschenhals; Headless/CLI-Check als Multiplikator | Prozessarbeit überwog nach Audit |
| Worktree-Bleed | Claude-Code-Issue #93438, 10.09.2026: Parent-cwd rutscht in Child-Worktree | relevant für Fleet-Lanes |

Metaplay (14.05.2026): Logik **außerhalb** der Engine kompilieren, Headless-Clients, ein CLI-Befehl für den ganzen Check.

**Minimal genug für den Neustart:** Architect-Preflight + eine Builder-Session (bauen, selbst spielen, reparieren) + eine isolierte Review-Lane auf Capture-Paket + Owner-Partie. Keine sensorische Kritik vor fremdem Spielinput.

---

## 4. Engines / Frameworks für dieses Browser-RTS

Anforderungen aus eurem Auftrag: Agent editiert Text; Headless Linux, konservativ **8 GB** (ältere Messung 7 GB); Canvas2D und WebGL2 gehen; WebGL = SwiftShader; Mensch spielt auf anderem Gerät.

**Wichtige Unterscheidung (belegt in RTS-/Sim-Repos):**

- **Seed-/Tick-Replay im selben Runtime-Pfad:** fester Tick, Seed-PRNG, Input-Log, keine `Date.now`/`Math.random` in der Sim. Erreichbar in TS. Beispiele: Clockwork Engine (Pixi *oder* Headless-Memory-Backend), Lattice (`replay.test.ts` bricht absichtlich bei `Math.random`), dune-clone (`npm run sim` / `nettest`).
- **Plattformübergreifender Bit-Determinismus** (Builder-Linux vs. Player-Chrome): JS-Float, SIMD, Browser-Math divergieren. Dafür Fixed-Point / integer math (z. B. `@shaisrc/fixed-point`, 20.01.2026) oder bewusste *Nicht*-Behauptung. VOIDSTRIKE beschreibt Checksums + Merkle-Desync-Suche – Aufwand jenseits des ersten Kerns.

Chier Hu, Analyse Mitte 2026: zuverlässigste Kombi sei textueller Agent (Claude Code / Codex / Cursor) plus **code-first** Engine (Godot-Text oder Web/Phaser/Three). Editor-schwere Stacks sind agentenfeindlich. **Meinung eines Autors**, aber konsistent mit den Jam-Hits.

Phaser aktuell: **v4.2.1 „Giedi“, 09.07.2026**; Canvas-Renderer in v4 deprecated, WebGL2-Pfad ist der produktive.
Godot-Web 4.x: nur **Compatibility / WebGL2**, kein Forward+; C# nicht web; Export-Templates versionsgleich.

SwiftShader: offiziell CPU-GL; automatischer WebGL-Fallback deprecated, Opt-in `--enable-unsafe-swiftshader`. Historischer Chromium-Bug: SwiftShader-Renderer-Konstruktion allein ~80 MB Arbeitsstrukturen – plus Szenen. Für 8 GB-Host mit 16 Kernen, Chromium, Node und Agent gilt: **Sim ohne GPU-Prozess** ist der konservative Testpfad; WebGL-Capture nur stichprobenartig.

### Vergleich (kompakt)

| Kandidat | Rendering | Agent-Editierbarkeit | Headless-Tests | SwiftShader-Kosten | Assets 1999–2003 | Repro-Build | Determinismus |
|---|---|---|---|---|---|---|---|
| **TS + Canvas2D, eigene Sim** | 2D, kein GL | Hoch (wenig API-Halluzination) | Sim ohne Browser; Playwright nur für Input/Bild | Niedrig (kein GL) | Prozedural + wenige Sprites | Vite/esbuild, lockfile | Selber Pfad: ja. Cross-Browser-Bits: nur mit Int-Math |
| **PixiJS v8** | WebGL/WebGPU-Renderer, ~200 KB | Hoch, TS | Render braucht GL; Sim abtrennbar | Mittel | Gut für 2D-Sprites | npm, reproduzierbar | Wie oben; Clockwork nutzt Pixi als *eine* Platform |
| **Phaser 4.2.1** | WebGL2-Framework, ~500 KB | Hoch, viel Trainingsmasse | Szenen + Plugins; mehr Laufzeit | Mittel–hoch | Tilemaps, 2D-RTS-üblich | npm | Loop oft an Engine-Clock – `advanceTime`-Hook Pflicht |
| **Excalibur.js** | TS-first 2D | Hoch, klein | Gut testbar | Mittel | Weniger Ökosystem | npm | Eher selbsterklärt als Phaser |
| **Three.js (r185-Klasse, 07.2026 in Sekundärquellen)** | 3D/WebGL2, WebGPU-Fallback | Sehr viel Jam-Code | GL fast immer | Hoch unter Software-GL | Falsch für RCT2/AoE2-2D, außer streng orthografisch | npm | Wie Pixi; viele Agentenspiele, falscher Look-Fit |
| **Godot 4.x HTML5** | Compatibility/WebGL2 + Wasm | Szenen `.tscn` Text: gut; Editor-Rest: schlecht | `godot --headless` nativ stark; **Web**-Export + Chromium teuer | Hoch (Wasm + SwiftShader + Editor-Templates) | 2D-Tiles ja | Export-Templates = exakte Engine-Version | Native-Headless ≠ Browser-Runtime |
| **Unity WebGL** | Schwer | Schlecht im CLI | Langsame Loops (Metaplay) | Unpassend für 8 GB | Overkill | Schlecht | Nicht der erste Slice |

Playco+Astra (03.09.2026) arbeitete in **Unity/Godot via Playbot**, nicht in eurem Codex-CLI-Browserpfad. **Keine Übertragung „Astra mag Godot, also Godot-Web“.**

**Kleine Probe, die den Stack entscheidet** (einen Tag, dasselbe Slice-Skelett dreimal): 64×64-Karte, 20 Einheiten, Wasser-Update/Tick, Damm-Toggle. Messen auf dem **Builder**: RSS von Node *und* Headless-Chromium (Canvas vs. WebGL-SwiftShader), Tickzeit für 10 k Schritte ohne Draw, Tickzeit mit Draw 30 s, ein Playwright-Click-Pfad bis Siegflag. Abbruch eines Kandidaten: Chromium+GL > ~2 GB RSS oder Tick ohne Draw > 2 ms Mittel.

**Was am Spielergerät gemessen werden muss** (nicht auf SwiftShader ableiten): Input-Latenz Click→Einheit wählt; 30–60 ms Framezeit bei vollem Teich; Lesbarkeit Damm/Wasser auf *dessen* DPI; Touch/Maus. Headless-FPS ist kein Player-FPS.

---

## Öffentliche Astra-Belege (kurz, keine Erfolgsgeschichte)

- Modell-ID `gpt-6-astra`, API/Codex/Azure/Bedrock. OpenAI-Seite: Coding-, Computer-Use- und Sites/Spiele-Claims; Zahlen sind **Benchmarks**, keine Shipping-Spiele. Datum der Seite nicht als Pressemitteilung datiert; Playco-Case **03.09.2026**.
- Playco: Playbot in Unity/Godot, „50 % weniger manuelle Fixes“, drei thematisierte Prototypen aus einer Greybox; Abnahme durch Menschen. **Anderer Stack, anderes Produkt.**
- Endor Labs, 08./09.09.2026: Codex+Astra 82,1 % FuncPass / 34,6 % SecPass – **kein Spielbenchmark**.
- Community: `awesome-gpt-6-astra`, Orchestrator-Plugins. **Nicht geprüft, nicht euer Repo.**
- Internes `gpt-6-astra` + native Subagent-Threads: öffentlich gibt es Subagent-/Worktree-Muster bei Codex und Claude; **euer Fleet-Vertrag ist nicht öffentlich belegt.**

---

## Drei Empfehlungen

### 1. Stack-Duell in 24 h, bevor eine Lane Architektur schreibt
- **Tun:** Identisches Mini-Skelett in Canvas2D-Sim und in Pixi *oder* Phaser 4.2.1. Sim vom Draw trennen. CLI: `sim`, `play-headless`, `capture`.
- **Erfolg:** Ein Stack schafft 10 k Ticks ohne Draw unter 2 ms Mittel **und** Chromium-RSS unter 2 GB bei 30 s Capture; Wasserlinie ändert sich in zwei Pflicht-Screenshots plus JSON.
- **Zeit:** 1 Builder-Session.
- **Abbruch:** Beide GL-Varianten sprengen 2 GB oder der Agent verliert den Tick-Hook. Dann Canvas2D-Sim + späteres Skinning.
- **Astra-Transfer:** unbelegt, ob Astra Phaser-Szenen besser hält als Canvas; die Probe misst *euren* Host.

### 2. Spielbarer Kern „Teich / Damm / Welle“ in 3–5 Kalendertagen
- **Tun:** Eine Karte, Spieler setzt Dämme, eine Feindwelle, Sieg und Niederlage, Restart. `advanceTime` + `render_game_to_text` + Input-Replay. Kein Economy-Creeper.
- **Erfolg:** Unabhängige Lane (frischer Worktree, kein Builder-Log) spielt **mit dem Capture-Paket** eine Partie zu Ende; Owner spielt dieselbe Build-URL einmal bis Sieg *oder* Niederlage. Damm ändert nachweisbar den Feindpfad (Tick-Log, nicht Screenshot-Rhetorik).
- **Zeit:** max. 5 Tage oder 3 Builder-Sessions.
- **Abbruch:** Nach Session 2 kein Siegzustand *oder* Damm ohne kausale Wirkung *oder* Owner hat nicht gespielt. Dann Slice schneiden, nicht Rollen vermehren.
- **Grenze des Spaß-Proxys:** Bot-Winrate darf nur das Regelwerk grün färben.

### 3. Ein Gate, zwei Verbote
- **Tun:** Preflight Architect. Builder darf in-session reparieren. Sensorischer Critic erst nach Fremd-Play. Gate bekommt Binary/URL + Replay + 20 s Video **ohne** Begleitessay.
- **Erfolg:** Gate-Artefakt von einem Agenten erzeugt, der den Code nicht geschrieben hat; Critic nennt mindestens einen falsifizierbaren Mangel (Steuerung, Lesbarkeit, Ende).
- **Zeit:** parallel zu Tag 4–5 von Empfehlung 2.
- **Abbruch:** Critic-Runde 2 ohne neues Spielinput → Stopp (Private-Repo-C-Muster). Geschmack nur Owner.
- **Beleglücke:** Es gibt 2026 **kein** publiziertes, unabhängiges „Agent hat Spaß korrekt vorhergesagt“-Experiment für RTS.

---

**Beleglücken:** kein öffentliches Astra-Beaver-RTS; kein belastbarer SwiftShader-RAM-Wert für *eure* Szene; Phaser-Canvas offiziell zweitrangig; Cross-Browser-Determinismus in TS bleibt Spezialprojekt; Vibe-Jam-Qualität ist Jury-Meinung plus Oversurvival der Hits. **Gegenbeispiele:** Antigravity-„durchgespielt“ mit kaputter Bewegung; Soret „slop“; METR-Befund in Hu-Analyse (erfahrene Devs mit AI 19 % langsamer – **nicht spielspezifisch**, aber gegen Selbstbehauptung).

Keine Umsetzung in diesem Dokument. Der nächste sinnvolle Auftrag wäre Empfehlung 1 als isolierte Lane mit messbarem Abbruch, nicht ein neues Rollenpapier.
