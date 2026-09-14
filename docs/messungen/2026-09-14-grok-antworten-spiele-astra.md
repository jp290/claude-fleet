---
frage: Was antwortete Grok (zwei Sessions, 2026-09-14) auf die beiden Prompts aus docs/messungen/2026-09-14-grok-fragen-spiele-astra.md — Astra-Orchestrierung und Astra-Game-Development?
urteil: ROHMATERIAL, WOERTLICH. Der Owner fuegt die Antworten unten ein (Board-Editor); die Auswertung und die daraus gefileten Zeilen stehen in einer eigenen Notiz, nicht hier. Bis dahin: nur Fragmente aus einem Terminal-Paste (unvollstaendig), als solche markiert.
bereich: [spiele, astra, grok, orchestrierung, game-dev]
belege: [Prompts: docs/messungen/2026-09-14-grok-fragen-spiele-astra.md (490953f9); Plan §5d docs/plan-fleet-betrieb-2026-09-13.md; Richtung 262a8f71]
nicht-gemessen: alles — das ist Recherche eines Dritten; Quellen darin sind ungeprueft, bis eine Auswertungs-Zeile sie nachschlaegt
stand: 2026-09-14
---

# Grok-Antworten zu den Spiele-Prompts (G2) — Rohmaterial

Owner: bitte die beiden Antworten WOERTLICH in die zwei Abschnitte einfuegen und speichern.
Die Datei ist getrackt; der Orchestrator committet nach dem Einfuegen und wertet in einer eigenen Notiz aus.

## Antwort 1 — Astra-Orchestrierung (Prompt 1)

<!-- HIER EINFUEGEN: Antwort 1 (Astra-Orchestrierung) — die RAG-Antwort, die hier stand, liegt jetzt in 2026-09-14-grok-antwort-rag-suche.md -->



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

## Anhang — Fragmente aus dem Terminal-Paste (unvollstaendig, nur bis die Vollfassung oben steht)

Antwort 1 (Fragment): kein oeffentlicher Beleg, dass gpt-6-astra bessere Teilauftraege formuliert als
gpt-5.6-* im selben Codex-Harness; Ricouard (04.09.2026) baute Spiele mit Astra in EINEM Thread ohne
Subagents; native Sub-Agent-Threads nur fuer kurze lesende Schnitte, Worktree-Sessions sobald
geschrieben wird; MAIN prueft Diff gegen Brief-Pfade, Commands mit Exitcode, beobachtbaren Spielzustand,
Liste "beauftragt / nicht geliefert"; Beispielbrief mit ZIEL/QUELLEN/BEFUGNISSE/SCHREIBFLAECHE/
ABSCHLUSSBEWEIS/RUECKGABE/STOP-GRENZE; Vergleich A (ein Thread) / B (ein lesendes Kind) / C (Worktree-
Session), Messgroessen Zeit bis SPIELBARE Aenderung, Nacharbeit, Pruefaufwand; drei Empfehlungen
(ein Wasser-Schnitt in einem Thread mit maschinenlesbarem Done · danach A/B/C n=1 · MAIN-Checkliste in
AGENTS.md, Reviewer read-only).
