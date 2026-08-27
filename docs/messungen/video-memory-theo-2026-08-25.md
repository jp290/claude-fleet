---
frage: Was von diesem Video trifft unsere vier Wissens-Ebenen, und sollten wir Claude-Code-Auto-Memory abschalten oder anders dosieren?
urteil: Dosieren, nicht abschalten; die eigene Messung fällt milder aus als die des Videos (1,75 zu 1 statt 3 zu 1 write zu read, 27 von 35 Dateien nie gelesen), der Recall trägt eine Altersmarkierung, und die feedback-Klasse ist die vom Video selbst ausgenommene
bereich: [regelwerk]
belege: [~/.claude/projects/-Users-owner-claude-fleet/memory/, e2e/pins.ts, AGENTS.md, docs/data-saver.md]
nicht-gemessen: Das Fenster ist 30 Tage (die 27 nie-gelesenen sind Obergrenze); ob Auto-Memory geschadet hat nicht gemessen; Kontamination von Modellvergleichen möglich, nicht nachgesehen; die 22 undatierten docs nicht inhaltlich geprüft; das Video nicht angesehen
stand: 2026-08-25
---

# Video-Tiefenanalyse: „Turn off Claude Code's Memory" (Theo / t3.gg)

2026-08-25, Lane `fleet/260825151208-57de`. Quelle:
`https://www.youtube.com/watch?v=Jf54k7tFeEc`, 39:28, veröffentlicht 2026-08-25.
Frage: **Was von diesem Video trifft unsere vier Wissens-Ebenen — und sollten wir
Claude-Code-Auto-Memory abschalten oder anders dosieren?**

Arbeitsmodus (Owner-Vorgabe): Transkript und Synthese selbst, Roherfassung durch zwei
Sub-Agenten (A = Punkte, B = Referenzen), deren Zitate stichprobenartig gegen die
Transkriptdatei geprüft wurden (14/14 wörtlich belegt, ein Beleg über eine Blockgrenze
hinweg — siehe §Methode).

Alle Zeitmarken beziehen sich auf das Auto-Transkript (`en-orig`), Blockbeginn.
Auto-Untertitel verstümmeln Eigennamen; Rekonstruktionen sind als solche markiert.

---

## 1. Kernthese in drei Sätzen

Automatisches Agenten-Gedächtnis ist der falsche Ort für Codebase-Wissen, weil Code der
Ground Truth ist und jeder zweite Ablageort zwangsläufig driftet (03:13, 03:43) — belegt
an den eigenen Maschinen mit einer Messung: 3:1 Schreiben zu Lesen, 26 von 45 Memories nie
gelesen, der Inhalt überwiegend Momentzustände, PR-Nummern und Redundanz zur AGENTS.md
(21:12, 17:01). Was stattdessen wirkt, ist eine Wertordnung nach Wirksamkeit: Fehlerklassen
architektonisch eliminieren, sonst Lint/CI, erst dann Skills, zuletzt der Mensch (24:16–30:12).
Und der Startkontext jedes Threads gehört kuratiert in AGENTS.md/CLAUDE.md — Identität,
Werte, Glossar, Geschmack —, damit der Agent nicht nur Verbote kennt, sondern die Richtung
(23:25, 38:26).

---

## 2. Punkte-Liste (chronologisch, gefiltert)

Erfasst von Sub-Agent A; von mir auf Sinnhaftigkeit gefiltert. Verworfenes: Fußnote am Ende
dieses Abschnitts.

### 2.1 These und Rahmen (00:00–01:49)

| # | Zeit | Punkt |
|---|---|---|
| P1 | 00:00 | Damit AI in einem Codebase arbeitet, muss sie wissen, *was* er ist, *wo* Dinge liegen, *wie* man etwas erledigt. Ausgangsprämisse, keine Begründung. |
| P2 | 00:00 | Viele Leute bauen Spezialsysteme (Libraries, Plugins, Features), um das automatisch zu kodieren. Beobachtungsbehauptung. |
| P3 | 00:14 | Claude Code speichere neuerdings aggressiv: „it will save things in some magic hidden file somewhere on the computer after you ask it to do something." Eigene Beobachtung. |
| P4 | 00:30 | **Kernthese:** „I don't think memory is the right place to keep track of how things should be done in your codebase." |
| P5 | 00:46 | Bei Menschen lag Wissen im Kopf und das ging okay; Agenten „forget everything when a new thread spins up". Struktureller Unterschied. |
| P6 | 01:01 | Automatisches Speichern für den nächsten Lauf ist „just not great" — an dieser Stelle Wertung, später mit P63 unterfüttert. |
| P7 | 01:01 | Quellclip: Mario (Pi) im Gespräch mit Armin [rekonstruiert von „Armen"] (Flask). |

### 2.2 Clip-Teil 1 und seine Kommentierung (03:13–07:41)

| # | Zeit | Punkt |
|---|---|---|
| P14 | 03:13 | **Mario:** „Code is truth. Code is the ground truth. It's also evolving and I don't need another place that I need to maintain." Fürs Coding kein Memory-System. |
| P15 | 03:27 | Kommentare veralten und werden dann **aktiv schädlich**: „It's now actively harmful because it steers people and agents the wrong way." |
| P16 | 03:43 | Split-Brain: „the more you split up that knowledge, the more split brain problems you end up with". |
| P17 | 04:18 | „slop markdown plan files" im Repo veralten; er ist bei Lakebed selbst schuldig. „It's so easy to context yourself to hell". |
| P18 | 04:36 | **Mario:** Modelle erschließen Struktur und Stil aus ein, zwei Dateien; eine Ordner-Karte mit Kurzbeschreibungen sei okay und billig zu pflegen. |
| P19 | 04:50 | **Mario:** Alles darüber (Embeddings/RAG) sei Zeitverschwendung — „I'm pretty sure you've never done an evaluation if that actually produces better outputs and I guarantee you it does not." Keine eigene Messung genannt. |
| P20 | 05:06 | Cursor als Kronzeuge: „their ability to get models to behave well in code bases is unprecedented." |
| P21 | 05:24 | Cursors historische RAG-Systeme; Michael (CEO) sprach am liebsten davon, dass Kontextfenster den ganzen Codebase aufnehmen würden. |
| P22 | 05:58 | Es kam genau andersherum; damals war Cursors Job, den Modellen alles zu geben, weil sie nichts selbst holen konnten. |
| P23 | 06:15 | **Claude Code hat den Gegenbeweis geliefert:** „Turns out if you just give it the tools it needs and bash, it can find what it needs relatively well." |
| P24 | 06:33 | Selbst Cursor habe sich davon vollständig abgewandt — „they just don't care anymore". Behauptung, keine Demo. |
| P25 | 06:50 | Wer heute ein Graph-RAG statt bash-Tools baut, ist „behind the curve now". |

### 2.3 Marios jq-Setup und der Chat-vs-Code-Exkurs (07:41–10:12)

| # | Zeit | Punkt |
|---|---|---|
| P27 | 07:41 | **Mario:** Slack-Bot „mom (master of mischief)" liest per `jq` ein Append-only-JSONL aller Prompts und Antworten — „that basically gives it infinite memory". |
| P28 | 07:59 | Theos Deutung: jedes Ein-/Ausgabe-Paar roh in eine einzige riesige Append-only-Datei, Zugriff über ein Standardwerkzeug — statt kuratiertem Gedächtnis buchstäblich alles. |
| P29 | 08:19 | Memory ergibt in **Chat**-Kontexten mehr Sinn als in Code; ChatGPTs Umsetzung findet in einem schlechter kartierten Raum erstaunlich gut das Richtige. |
| P30 | 08:37 | **Der strukturelle Grund:** Im Codebase kann man von einem Button programmatisch zu allem Berührten tracen; bei „mein Schulter tut weh" ist die Tastaturfrage von vor einem Monat unintuitiv relevant. „There is no direct path … where there is a very direct one in the code bases." |
| P31 | 09:16 | Zugeständnis: „memory as a way of tagging relevant information that is **user specific** can be a little useful" — und er kommt als Anti-Memory-Mensch daher (kein Memory in T3 Chat). |
| P32 | 09:35 | Er glaubt, GPT-4o-Memory habe schwere psychische Schäden verursacht, weil sie einen erreichten „psychosis state" zementierte. Überzeugungsbehauptung, keine Quelle. |
| P33 | 09:56 | **Sein eigentlicher Vorbehalt:** „answers stop being useful because they're too full of your context." Eigener Workaround bei ChatGPT: „My friend has this problem". |

### 2.4 Clip-Teil 2 und die drei Designprinzipien (10:12–13:17)

| # | Zeit | Punkt |
|---|---|---|
| P34 | 10:12 | **Clip:** „bash is all you need in the sense that the models are inherently trained to use bash now"; unabhängig von beiden Sprechern etwa im Juli/August entdeckt. |
| P35 | 10:47 | **Mario:** Sentry-**Skill** statt Sentry-**MCP** — „here's a prompt that it can load on demand, but it also encompasses its own tools". Auth so gelöst, wie er wollte. |
| P36 | 11:33 | Kontext-Effizienz durch Deckeln: „I showed you three items, but I downloaded 52 into this JSON file" — Rest bleibt auf Platte, abrufbar. |
| P37 | 11:49 | **Theos Teil-Widerspruch:** „I think people reach to make skills a little bit too aggressively overall." Und: die beiden hätten AGENTS.md/CLAUDE.md stärker behandeln sollen. |
| P38 | 12:20 | Die drei Prinzipien des verlinkten Posts: (1) Coding braucht kein separates Memory-System, (2) bash is all you need, (3) Tool-Outputs nur bei Bedarf in den Kontext. |
| P39 | 12:37 | Wird der Output nicht gebraucht, sollte es kein Tool-Call sein, sondern ein Bash-Call in eine Datei plus `cat` eines Teils. |
| P40 | 12:37 | Prinzip 3 sei eigentlich keins: die neueste Modellgeneration überlade ihren Kontext nicht mehr. „That's not our problem." |

### 2.5 Die Live-Inspektion der eigenen Memories (13:17–21:50) — das empirische Herzstück

| # | Zeit | Punkt |
|---|---|---|
| P42 | 13:17 | Setup: Box „BB1" (Framework Desktop), hunderte bis tausende Threads mit Fable und Soul über Claude Code bzw. Codex. |
| P43 | 13:52 | Erste Abfrage („what memories do you have of this project?"): **eine** Memory, 9 Tage alt, ein Spec eines Features, das er nie ausliefern wollte. „Incredibly stupid." |
| P44 | 14:27 | Zweite Maschine: das Modell greift eine **zufällige** von mehreren T3-Code-Klonen, tief in `~/.claude/projects` [rekonstruiert von „cloud/ projects"]. |
| P45 | 14:46 | Gespeichert wurde, dass das Setzen des Output-Style auf `concise` „didn't update the global file" — eine Momentaufnahme eines Ärgers als dauerhaftes Wissen. |
| P46 | 14:59 | Lakebed: Memories über fünf Projektverzeichnisse (Railway-Topologie, gelockte Worktrees, Blob-Storage-Plan mit Vergleichsbewertung, V8-Isolate-Planung, Launch-Audits, God-File-Refactors). |
| P47 | 15:21 | Ein Eintrag behauptet eine „harte Regel" zu Mobile-Builds. Urteil: „Huh. This is garbage." |
| P48 | 15:21 | **Memory verfälscht seine Benchmarks:** die „ping round modernizations" [so im Transkript] testen neue Modelle — „if it is storing these things in memory, that makes that test less pure". |
| P49 | 15:44 | Benchmark-Konfigurationswissen (Effort-Hints, Provider-Defaults) gespeichert: „Useless. None of this should be saved here. This can change at any time." |
| P50 | 16:04 | Fremdkontext: Moonlight-Fork, „fish slop rebuild" (wieder ein Benchmark), die Waschmaschinen-/Trockner-Discord-Bridge, ccusage-Pricing-Overrides. |
| P51 | 16:22 | Der Hauptklon: **45 Memories** — Onboarding-Overhaul, Babysit-Monitoring-Flows, Sidebar-Draft „Variante C". „This is slop. All of this is garbage." |
| P52 | 16:41 | Auf seine Frage schätzt der Agent selbst: „Honest take maybe a third of it earns its keep today." Drei Verfallsprobleme. |
| P53 | 17:01 | **Verfall 1 — Redundanz:** 10 Dateien doppeln die AGENTS.md, „which every agent reads anyways". Sein Kommentar: vieles stand *vor* der Memory schon dort. |
| P54 | 17:38 | **Verfall 2 — abgelaufene Feature-Designs:** 12 Dateien. „why are specific PR numbers finding their way in my [ ] memory?" |
| P55 | 17:55 | **Verfall 3 — Point-in-Time-Zustände, aktiv riskant:** „These describe a moment the drift got migrated or didn't. The PR's merged or didn't." |
| P56 | 18:12 | Beispiel: veraltete GitHub-CLI-Version als Memory. „I updated it. The problem is solved. Go the [ ] away." |
| P57 | 18:29 | Beispiel: Probing-Notizen zu einer Meta-CLI, verlinkt auf einen thematisch fremden Eintrag. „How the [ ] is that related?" |
| P58 | 19:27 | Ein Zwischenverständnis aus einem Spec-Gespräch („desktop already completed") wurde als dauerhafte Wahrheit einzementiert. |
| P60 | 20:14 | **Ältere Memories tragen kein Datum** — „the older memories don't have dates". Damit ist ihre Alterung nicht beurteilbar. |
| P61 | 20:33 | Zugeständnis: „Probably actually useful in here otherwise though." Er bricht das Lesen ab. |
| P62 | 20:53 | Entscheidung: flottenweit Memory abschalten, vorhandene archivieren, labeln, löschen. |
| **P63** | **21:12** | **Die Messung:** über 355 Sessions auf dieser Maschine haben **19** je eine einzelne Memory-Datei geöffnet, **80** haben geschrieben oder editiert — **3:1 Schreiben zu Lesen**. **26 von 45** Memories wurden nie ein einziges Mal gelesen. |

### 2.6 Sein Gegenmodell (21:50–24:16)

| # | Zeit | Punkt |
|---|---|---|
| P65 | 21:50 | Zwei Ziele: (1) weniger Fehler, (2) das Modell tut das Gewünschte, ohne dass man jedes Detail sagt. |
| P66 | 22:23 | Beide klingen ähnlich, sind verschieden — „People seem to think memories will magically give you both, and they don't." |
| P67 | 22:39 | Der naive Weg: bei jedem Fehler eine kleine Regel in die AGENTS.md. „And that does help. It does work." |
| P68 | 22:56 | Aber die Ursachen liegen tiefer: Denkweisen-Unterschied, für Agenten unintuitive Architektur, Kommunikationslücke. „There's all of these different layers between you the code and the AI". |
| P69 | 23:25 | **Sein Rat:** „communicate not just what you don't want the agent to do rather how you want the agent to think about what it would do." |
| P70 | 23:46 | Richtungsangleichung reduziert die kleinen Fehler von selbst — Erfahrungsbehauptung, keine Zahlen. |

### 2.7 Die Wertordnung (24:02–30:12) — Quelle: „Potato Lauren"

| # | Zeit | Punkt |
|---|---|---|
| P71 | 24:02 | Quelle der Ordnung: „Potato Lauren", Dev aus der React-Welt, jetzt bei Cursor („Pstack"). |
| P72 | 24:16 | **Grundregel:** „Every time you intervene and correct your agent, you should think about how to eliminate it entirely." Von oben nach unten anwenden, bis das Problem weg ist. |
| P73 | 24:31 | **Stufe 1:** „categorically eliminate the problem through better architecture or choice of data structures" — tRPC, T3 Stack. |
| P74 | 24:46 | Convex/tRPC: Typsicherheit über die Backend-Frontend-Grenze „removes those categories entirely". |
| P75 | 25:17 | Was Codebases für Menschen leicht beitragbar macht, macht sie unbeabsichtigt auch gut für Agenten. |
| P76 | 25:34 | Beispiel außerhalb Webdev: Garbage Collection, Memory Safety. |
| P77 | 25:50 | **Stufe 2:** „turn it into a lint rule or tests so that CI can catch it." |
| P78 | 26:08 | Sein Fall: Bandbreite von T3 Code, weil er im Flugzeug/Tunnel seinem Thread folgen will. |
| P79 | 26:27 | Der Bloat: „tens of megabytes down the wire over websockets just to load a thread." Er räumte auf und baute sich eine lokale Mess-Suite. |
| P80 | 26:43 | **Regressionen kamen binnen Tagen zurück** — Aufräumen allein hält nicht. |
| P81 | 27:15 | Die CI-Lösung: Fake-Replays echter Threads für Codex und Claude, gemessen wird, wie viel über den WebSocket geht. Ergebnis: konsistent unter 100k, meist unter 10K. |
| P82 | 27:35 | Eine automatisch kommentierende Action nennt die Bandbreite pro Änderung; **Decke ~30 % über dem optimierten Stand**, darüber schlägt der PR fehl. |
| P83 | 28:11 | Wirkung: „the agent fixes it before it tells me it's done." |
| P84 | 28:28 | Zwei Jahrzehnte Team-Schutzmechanismen funktionieren für Agenten „arguably even better". |
| P85 | 28:45 | Die Regel: „make it so the agent can figure out the thing sucks before it bothers you about it." |
| P86 | 29:00 | Gewichtung: Stufe 1 immer und maximal; Lint/CI nur „hesitantly"; wenn es dann noch nicht reicht — reflektieren, wahrscheinlich geht es doch. |
| P87 | 29:18 | **Stufe 3 (mit schwerem Seufzer):** Skill oder Regel. „less useful for things that have to do with the code and more useful for things with the **process** around it" — Beispiel: Server über Tailscale exponieren. |
| P88 | 29:37 | „They are a safety net. They are a fallback. You should treat them accordingly." |
| P89 | 30:12 | **Stufe 4:** Mensch in der Schleife. „You should not have to do this." |

### 2.8 Der Preis der Doktrin und Uncle Bob (30:12–32:44)

| # | Zeit | Punkt |
|---|---|---|
| P90 | 30:12 | Der SwiftUI-Rewrite kostet die geteilte TypeScript-Data-Layer über Web/Electron/React-Native: „it is basically impossible for us to make a change that breaks one of them and not the other two." |
| P91 | 31:02 | Die SwiftUI-App ist bereits regressiert; sie wird **nicht gemerged**, obwohl er sie für besser hält, weil sie Codebase-Drift erzeugt. |
| P92 | 31:18 | **Uncle Bob:** „It's probably a mistake to impose human discipline on an agent, but it's not a mistake to impose human values on the agent." |
| P93 | 31:34 | Uncle Bobs Beispiel TDD. **UNKLAR:** das Transkript ist an dieser Stelle in sich widersprüchlich („they always fall back on doing that. They always end up doing that") — ob gemeint ist „sie fallen davon ab" oder „sie tun es am Ende doch", ist aus der Datei nicht entscheidbar. |

### 2.9 Der AGENTS.md-Durchgang (32:44–37:26)

| # | Zeit | Abschnitt seiner Datei |
|---|---|---|
| P96 | 32:44 | Aufbau: erst **was es ist**, dann **wie es funktioniert** — knapp, die Teile, die zählen. |
| P97 | 33:01 | Produkt-Positionierung („Open-Source-BYO-Subscription-Alternative zu …"). |
| P98 | 33:15 | Warum der Agent das Produkt kennen muss: „Have you ever had an engineer on your team that doesn't actually understand the product? I have. It's not fun." |
| P99 | 33:28 | Abschnitt **„what makes T3 code special"** — explizit für Richtungstreue von Contributors *und* ihren Agenten. |
| P100 | 33:47 | Wert **„open at the core"** schneidet eine ganze Vorschlagsklasse ab: Modelle schlugen zuvor vor, Teile zu schließen. |
| P101 | 34:02 | Wert **„performance without compromise"**: „this change here affected the amount of regressions we saw in data loading more than any of the systemic changes I made in the actual code side." Keine Zahlen genannt. |
| P102 | 34:35 | Wert **„remote ready"**: sonst baut das Modell etwas, das lokal (auch im Electron-Test) läuft und remote scheitert. |
| P103 | 34:48 | **Multi-Surface**-Abschnitt: welche Services es gibt, Änderungen müssen überall greifen. |
| P104 | 35:03 | **Persönliche Notiz** über ihn selbst — für Ton, Kontext und wieder die Richtung. |
| P105 | 35:19 | Betriebsregel: den laufenden T3-Code-Server nicht killen. |
| P106 | 35:35 | **Glossar** — gemeinsame Sprache; hilft außerdem gegen „Claude's thing where it just makes up these fancy terms". |
| P107 | 35:52 | Abschnitt für Verhaltensweisen, die trotz allem wiederkamen (Server-Kill). „This fixes most of them." |
| P108 | 36:06 | **„Hit every surface"** — hält Web und Mobile synchron. |
| P109 | 36:22 | Abschnitte zu **Dev-Servern** und **Testdaten** (echte Daten in einen Worktree klonen). |
| P110 | 36:22 | **Verification**-Abschnitt: keine riesigen repoweiten Checks, außer es wird danach gefragt. |
| P111 | 36:40 | **Pull Requests** und wie man sie einreicht — schon wegen lesbarer Titel. |
| P112 | 36:40 | **„Where code lives"** — „Probably the least useful thing within this." |
| P113 | 36:54 | **Taste**-Abschnitt, gespeist aus dem Ärger des Kollegen Julius über seinen Slop-Code. |
| P114 | 36:54 | Konkrete Taste-Regeln: Komplexität an der Adapter-Boundary, dumme UI, einfache Orchestrierung; keine `any`-Typen, keine unnötigen Annotationen, inferiert bevorzugt; „Comments should describe how a thing is used and they should move when the code moves." |

### 2.10 Fazit (37:09–39:28)

| # | Zeit | Punkt |
|---|---|---|
| P115 | 37:09 | **Der Reifegrad-Test:** Der Agent soll dich so gut verstehen, dass er sagt „willst du das nicht auch für diese drei anderen Dinge?" — „If you don't find yourself in that spot often, you haven't tuned these things well enough yet." |
| P116 | 37:41 | Zuschreibung: „it's these files and it's certainly not the [ ] memory. In fact, they probably hurt." Erfahrungsbehauptung, keine Messung für die *Zuschreibung* (die Messung P63 belegt Nutzung, nicht Schaden). |
| P118 | 38:26 | Ziel „lock step"; Rahmenbedingung ist der Thread-Reset. |
| P119 | 38:26 | „That doesn't mean we need automatic memories … They're actually worse than that." Was man will: am Groundhog Day hat das Modell das Wichtige **kuratiert** im Kopf. |
| P120 | 38:41 | „Take the opportunity to get a little more personal with how you talk to your agents". |

> **Verworfen** (erfasst, aber ohne Inhalt für uns): P8 (Zielgruppen-Ansage), P9–P12 (Sponsor-Segment WorkOS, 01:49–03:13), P13 und P41 (Struktur-Ansagen), P26 („wäre schön, wenn es hier härtere Probleme gäbe"), P59 (iOS-Arbeit mit Soul, Nebenbemerkung), P64 (Rant-Eskalation), P94 (Uncle Bob habe in 3 Monaten aufgeholt), P95 (Überleitung), P117 (Rückblick auf den eigenen Video-Bogen), P121 (Schlussappell, inhaltlich = P119).

---

## 3. Referenz-Register

Erfasst von Sub-Agent B. `[rek.]` = aus verstümmelter Auto-Untertitel-Schreibweise erschlossen.

### 3.1 Tools, Produkte, Firmen

| Referenz | Zeit | Sicherheit |
|---|---|---|
| Claude Code | 00:14, 06:33, 13:17, 21:12, 39:24 | sicher / `[rek. von „quad code", „clad code", „Cloud Code"]` |
| Codex | 13:32, 14:59, 27:15, 33:15 | `[rek. von „Codeex"/„codecs"]`, 14:59 korrekt |
| Cursor | 01:49, 05:24–07:08, 24:16, 33:15 | sicher; 05:43 `[rek. von „Kurser"]` |
| Pi (Agent/CLI) · Flask | 01:17, 10:29, 12:20 | sicher |
| Sentry (+ Sentry-MCP) | 11:03–11:33 | sicher; „Century" `[rek.]` |
| ChatGPT / GPT-4o | 08:37, 09:35, 10:12 | `[rek. von „chat GBT", „GPT40"]` |
| T3 Code · T3 Chat · T3 Connect · T3 Stack | 09:35, 13:17 ff., 24:46 | sicher |
| tRPC · Convex | 24:46, 25:02 | sicher |
| Electron · React Native · SwiftUI · TypeScript | 30:27, 30:45 | sicher |
| Claude Desktop · Codex App · Glass · Conductor | 33:15 | teils `[rek.]` |
| Railway · Slack · Discord · jq · GitHub CLI | 07:41, 14:59, 16:04, 18:12 | sicher |
| Lakebed (sein Projekt) · Moonlight-Fork · ccusage | 04:18, 14:59, 16:04 | sicher; 04:18 `[rek. von „Lake Bet"]` |
| Tailscale | 29:37 | `[rek. von „tail scale"]` |
| „mom — master of mischief" (Marios Slack-Bot) | 07:41 | sicher |
| Framework Desktop „BB1" | 13:32 | sicher |
| Meta „Muse Code" CLI | 18:29–19:07 | Produktname evtl. verstümmelt |
| WorkOS + Sponsor-Umfeld (OpenAI, Anthropic, Thinking Machines, Cloudflare, Firecrawl, Resend, Monday, Kernel) | 01:49–03:13 | sicher — Sponsor-Segment |
| „Pstack" (Lauren Tan, bei Cursor) | 24:16 | Agent B: UNKLAR. **Aufgelöst aus unserem eigenen Repo:** `pstack` = `github.com/cursor/plugins`, MIT, © 2026 Lauren Tan — belegt in `.claude/skills/unslop/SKILL.md:8` und `.claude/skills/mess-notiz/SKILL.md:8`. Die Auflösung stammt aus dem Repo, nicht aus dem Transkript. |

### 3.2 Features und Mechanismen

| Referenz | Zeit |
|---|---|
| Memory / Memory-Systeme (Claude Code) | 00:30, 13:52, 17:01, 21:12, 39:24 |
| Skills (on-demand-Prompt mit eigenen Tools) | 11:17–11:33, 29:18–29:55 |
| MCP (als Gegenstück zum Skill) | 11:03, 11:33 |
| Output Style „concise" | 14:46 |
| „bash is all you need" | 06:33, 10:29, 12:37 |
| Embeddings / Code-Graph-Traversal / RAG | 04:50, 07:08 (04:50 teils unlesbar: „using a …") |
| git worktrees, „locked work trees" | 14:59, 17:18, 20:33, 36:22 |
| Lint-Regeln / Tests / CI als Absicherung | 26:08, 28:45, 29:18 |
| CI-Bandbreiten-Check mit Auto-Kommentar am PR | 27:53–28:11 |
| Human-in-the-loop als letzte Stufe | 30:12 |
| AGENTS.md-Abschnitte: „what makes X special", Glossar, hit-every-surface, dev servers, test data, verification, pull requests, where code lives, taste | 33:28–36:54 |

### 3.3 Dateien und Pfade

| Referenz | Zeit | Sicherheit |
|---|---|---|
| `AGENTS.md` | 04:50, 17:18, 22:56, 32:44 ff. | `[rek. von „agents MD"/„agent MD"/„HSMD"]` |
| `CLAUDE.md` | 23:46 | `[rek. von „claude MD"]` |
| `~/.claude/projects/` (Memory-Ablage) | 14:27 | `[rek. von „cloud/ projects"]` |
| `~/.claude/worktrees/` (wird midrun auto-pruned) | 20:33 | `[rek. von „claude/work trees"]` |
| „the global file" (Output-Style) | 14:46 | Datei nicht benannt |
| JSONL-Append-only-Log (Marios Bot) | 07:41 | sicher |
| „slop markdown plan files" im Repo | 04:18 | sicher |
| 45 einzelne Memory-Dateien im Hauptklon | 16:22, 17:18, 21:27 | sicher |

### 3.4 Personen

Mario (Pi) 01:17 · Armin (Flask) 01:17 `[rek. von „Armen"/„Arlene"]` · Michael, CEO Cursor 05:43 ·
David (Sentry-Kontext) 11:03 · „Potato Lauren" (React-Welt, jetzt Cursor) 24:02 · Uncle Bob
31:18–38:10 · Julius (Kollege, Quelle des Taste-Abschnitts) 36:40.

### 3.5 Modelle

Fable 13:32 · Opus 13:52 · Soul 13:32, 19:27 · GPT-4o 09:35 `[rek.]` · ein Modell mit
Effort-Parameter 15:44 (Nummer unlesbar, „GBD56").

### 3.6 Was er zum Abschalten konkret nennt

**Nichts Ausführbares.** Das Video nennt **kein Flag, keinen Settings-Key, kein Kommando**, um
Memory abzuschalten. Konkret sind nur:

- **13:52** Diagnose-Prompt: „what memories do you have of this project?"
- **17:01** Diagnose-Prompt: „how often are memories actually being used in sessions?"
- **20:53** Der delegierte Ablauf: „have Fable go across my fleet, disable memory … archive the ones that I have, label them correctly, and then delete the memories."
- **14:27** Ablageort, nur als Beobachtung: `~/.claude/projects/…` `[rek.]`

### 3.7 Nicht auflösbar

„OMD" (WorkOS-Produkt, 02:45) · der Sponsor-Kurzlink (03:13) · das abgeschnittene Akronym bei
„using a …" (04:50) · „Grockbot" (24:16) · Modellnummer „GBD56" und „dash pro mode" (15:44) ·
„probing mdash" (18:47) · „cla probe test leak processes" (18:12) · „Lakewood file blob storage
plan" — evtl. verstümmeltes „Lakebed" (14:59) · „ping round modernizations" (15:21) · „to server
baster race hazard" (15:21).

---

## 4. Mapping auf unsere vier Ebenen

Regel: keine Umbau-Empfehlung ohne Video-Beleg **und** zitierten Ist-Stand mit Anker.

### (a) Claude-Code-Auto-Memory, wie wir es nutzen

Unser Ist-Stand: `~/.claude/projects/-Users-owner-claude-fleet/memory/`, **35 Memory-Dateien**
plus `MEMORY.md` als Index (6.834 B, 35 Zeilen), der in **jede** Session dieses Projekts injiziert
wird. Kategorien der Dateinamen: 9 × `feedback-*`, 24 × `project-*`, 2 × `reference-*` (= 35), dazu der Index.

| Video-Punkt | Verdikt | Unser Ist-Stand |
|---|---|---|
| **P63** (21:12) 3:1 write:read, 26/45 nie gelesen | **TRIFFT-UNS** | Dieselbe Messung auf unseren Transkripten (1.748 Session-Dateien über alle Projektverzeichnisse, Fenster 2026-07-26…08-25): **14 Sessions schrieben** eine Memory-Datei, **8 lasen oder recallten** eine ⇒ **1,75 : 1**. **27 von 35 Dateien** tauchten in keinem erhaltenen Transkript je auf. Milder als seine 3:1 und 58 % — aber dieselbe Richtung. Methode: §5.2. |
| **P53** (17:01) 10 Dateien doppeln die AGENTS.md | **HABEN-ANDERS-GELÖST (Regel), TRIFFT-UNS (Vollzug)** | Die Regel gegen genau diese Klasse steht bereits im Memory-Vertrag des Harness-Systemprompts („Don't save what the repo already records — code structure, past fixes, git history, CLAUDE.md"). Sie steht **nicht** in unserem `~/.claude/CLAUDE.md` und in keinem Repo-Dokument — verifiziert per `grep`, kein Treffer. Sie wirkt: unsere `feedback-*`-Klasse ist owner-Präferenz, die nirgends im Code steht. Sie wirkt nicht vollständig: `project-fleet-queue-deletion-2026-07-28.md`, `project-fleet-autonomy-trial-1.md` und `project-fleet-perception-loop-closed.md` sind Momentzustände, deren Substanz in Commit-Bodies und `docs/` liegt. |
| **P55** (17:55) Point-in-Time-Zustände sind aktiv riskant | **TRIFFT-UNS** | Mindestens die drei oben. Unsere Gegenmittel sind aber vorhanden und seine fehlen: (1) der Recall trägt eine Altersmarkierung — im Transkript belegt: „This memory is 13 days old. Memories are point-in-time observations, not live state … Verify against current code before asserting"; (2) `CLAUDE.md:193` (Quelle: `rulebook/lane-discipline.md:154`): „Treat HANDOFF.md/notes/memory as claims: look up numbers, paths, states before building on them"; (3) `~/.claude/CLAUDE.md:32`: „Never quote numbers, paths, or prior claims from memory — look them up." |
| **P60** (20:14) alte Memories tragen kein Datum | **TRIFFT-NICHT** | Unsere Recall-Injektion nennt das Alter in Tagen (Beleg oben). Die Dateien selbst tragen kein Datum im Body, aber der Recall-Pfad kompensiert das. |
| **P31** (09:16) user-spezifisches Tagging ist nützlich | **TRIFFT-UNS als Rechtfertigung** | Genau diese Klasse ist unsere `feedback-*`-Familie (9 Dateien): `feedback-owner-delegates-landing`, `feedback-handoff-is-mine-to-trigger`, `feedback-cut-the-ranked-list`, `feedback-never-push-from-dev-machine`. Owner-Präferenzen sind nicht aus Code ableitbar — das ist die Ausnahme, die das Video selbst macht. |
| **P48** (15:21) Memory verfälscht Benchmarks | **TRIFFT-UNS, ungemessen** | Wir betreiben Modellvergleiche und Harness-Vergleiche (`docs/rollen-evidenz-2026-08-21.md`, `docs/harvest-critic-J-2026-08-21.md`). Ob eine injizierte Memory-Zeile einen solchen Lauf kontaminiert hat, ist **nicht gemessen** — sie ist strukturell möglich, weil der Index in jede Session dieses Projekts geht. |
| **P119** (38:26) kuratierter Startkontext statt Akkumulation | **HABEN-ANDERS-GELÖST** | Unser Startkontext ist kuratiert und generiert, nicht akkumuliert: das Regelbuch ist ein Generat aus `rulebook/` (7 Fragmente, Lane bekommt 3 davon — `CLAUDE.md:355 ff.`), plus ContextPlan-Anker im Gründungsbrief. Der Auto-Memory-Index ist der **einzige** akkumulierende Teil unseres Startkontexts. |

### (b) Unser Wissens-Regal (`docs/` + Commit-Bodies + git notes)

Ist-Stand: 79 `.md` in `docs/` oben (davon **57 mit Datum im Dateinamen**, 22 ohne), 60 in
`docs/attic/`, 12 in `docs/messungen/`; 4,2 MB gesamt. 1.045 Commits, deren **Bodies das
Befund-Register sind** (`CLAUDE.md:238`), 294 Land-Notes (`git notes --ref=fleet/land list | wc -l`).

| Video-Punkt | Verdikt | Unser Ist-Stand |
|---|---|---|
| **P17** (04:18) slop markdown plan files veralten | **HABEN-ANDERS-GELÖST** | Zwei Mechanismen, die er nicht hat: das **Datum im Dateinamen** macht 57 von 79 Dokumenten selbstdeklarierte Momentaufnahmen; **`docs/attic/`** (60 Dateien) ist der Archivpfad. Sein Vorwurf trifft die 22 undatierten Dokumente, die Gegenwart behaupten — die älteste unberührt seit 2026-08-05 (`docs/lane-brief-template.md`, `docs/scope-inflation.md`). |
| **P15/P16** (03:27, 03:43) Kommentare/Docs driften, Split-Brain | **HABEN-ANDERS-GELÖST — und wir gehen weiter** | Genau dieser Drift ist bei uns **maschinell geprüft**: `e2e/pins.ts` ist die erste Stufe des Land-Gates (`CLAUDE.md:59`, `watchdog.sh` `VERIFY_CMD`) und prüft „die Muss-Paare, deren andere Seite kein TypeScript ist (Shell, Doc) — genau die Drift, die kein Compiler sieht" (`e2e/pins.ts:1-13`). `RULE_VERIFY` vergleicht die Ordnung der Verify-Kette über `watchdog.sh`, `AGENTS.md` und `verify-proportion.ts`. Das ist Laurens Stufe 2, angewandt auf die Wissensschicht selbst — im Video kommt diese Idee nicht vor. |
| **P19** (04:50) Embeddings/RAG oberhalb einer Ordnerkarte = Zeitverschwendung | **HABEN-ANDERS-GELÖST** | Bereits entschieden und dokumentiert: Memory `project-fleet-knowledge-layer-decision` hält fest, dass der Stresstest auf „dream mode v1 first, **indexless**" gekippt wurde und Phase 2 (Embedding-Quelle) geparkt ist. `graphify` existiert als **on-demand**-Werkzeug, nicht als stehender Index, und läuft nur im Haupt-Checkout (`CLAUDE.md:230`). |
| **P23/P25** (06:15, 06:50) bash + Tools schlagen dynamische Kontextsysteme | **HABEN-ANDERS-GELÖST** | Unser Zugriffsweg ist genau das: `rg`/`grep`/`ast-grep` mit einer gemessenen Zugriffsregel — „`rg` respektiert `.gitignore` … Operatives → `rg -uu`" (`CLAUDE.md:230`). Kein Index dazwischen. |
| **P27/P28** (07:41) Append-only-JSONL + jq statt Memory | **HABEN-ANDERS-GELÖST, gleiche Form** | Unsere Append-only-Schicht: `lane-outcomes.jsonl`, `post-land-audits.jsonl`, `audit.jsonl` (alle gitignored, `CLAUDE.md:230`), plus 294 `git notes --ref=fleet/land` und die Commit-Bodies. Das ist Marios Muster, auf drei Substrate verteilt. |
| **P110** (36:22) „nicht ständig repoweite Checks fahren" | **HABEN-ANDERS-GELÖST, feiner** | Wir haben das nicht als Bitte, sondern als Route: `GET /api/self/gate` liefert `localProof.steps` — die proportionale Beweismenge je nach angefasster Datei (`CLAUDE.md:42-49`, Mapper `verify-proportion.ts`). Für diese Lane hat sie geantwortet. |

### (c) HANDOFF- und Erdungs-Mechanik

| Video-Punkt | Verdikt | Unser Ist-Stand |
|---|---|---|
| **P5/P118/P119** (00:46, 38:26) Groundhog Day: jeder neue Thread löscht das Gehirn | **TRIFFT-UNS — und ist bei uns maschinell beantwortet** | `HANDOFF.md` (aktuell 7.156 B) ist der Transfer, und `POST /api/self/succeed` **verweigert** die Nachfolge, wenn die Datei fehlt, unsauber ist oder ihr Commit älter als die Session ist: `server.ts:5847` — „HANDOFF.md must exist, be clean, and have a commit newer than this session — otherwise the successor would have nothing to read". `server.ts:2045` erklärt, warum der Vergleich am Occupant hängt. Sein Rat ist bei uns ein Gate. |
| **P63** (21:12) geschrieben ≫ gelesen | **TRIFFT-NICHT für HANDOFF** | Der Gründungsbrief der Nachfolgerin zeigt strukturell auf die Datei („Lies nur den obersten Abschnitt von HANDOFF.md", `server.ts:5807`, `:14798`, `:14829`). Ein HANDOFF wird per Konstruktion gelesen; eine Memory-Datei nur, wenn der Recall sie trifft. |
| **P58** (19:27) ein Zwischenverständnis wird als Wahrheit einzementiert | **TRIFFT-UNS** | Dieselbe Gefahr trägt jeder HANDOFF. Gegenmittel steht bereits als Regel: `CLAUDE.md:193` „Treat HANDOFF.md/notes/memory as claims". Kein Gate erzwingt das — es ist Disziplin, nicht Mechanik. |
| **P17** (04:18) veraltete Dateien im Kontext | **TRIFFT-UNS, benannt** | Der Lane-Snapshot ist ausdrücklich als alternd dokumentiert: „Dein `docs/`-Regal ist ein Spawn-Zeit-Snapshot — lies Wissen aus `main:`" (`CLAUDE.md:210`), mit Beleg und Verweis auf `docs/knowledge-currency.md` §3. Für das Regelbuch selbst ist es sogar gemessen: `GET /api/self/gate` liefert `rulebookDrifted` (für diese Lane: `false`). |

### (d) Regelbuch und `AGENTS.md`

Ist-Stand: `AGENTS.md` 15.418 B (portabler Vertrag), `CLAUDE.md` 32.135 B (Lane-Fassung, 3 von 7
Fragmenten), Quelle `rulebook/` (7 Fragmente, 68.651 B).

| Video-Punkt | Verdikt | Unser Ist-Stand |
|---|---|---|
| **P96/P97/P99** (32:44–33:28) erst was es ist, dann Werte | **HABEN-ANDERS-GELÖST** | `AGENTS.md:24` „Project identity and non-negotiable properties" ist genau sein „what makes X special": „It never trades away owner promotion, isolated production, observations before claims, explicit `unknown`, deterministic done, honest surfaces, or review effort proportional to the decision." |
| **P106** (35:35) Glossar gegen erfundene Begriffe | **HABEN-ANDERS-GELÖST** | `AGENTS.md:30` „Shared vocabulary" — und es leistet mehr als ein Glossar: es trennt Akte, die verwechselt würden („**Verify** proves a tree; **commit** records it; **land** promotes it server-side; **deploy** updates a running instance; **audit** measures a landed tree. These are distinct acts."). |
| **P110** (36:22) Verification-Abschnitt | **HABEN-ANDERS-GELÖST** | `AGENTS.md:127` §Verify plus der proportionale Beweis über `/api/self/gate`. |
| **P111** (36:40) Pull-Requests-Abschnitt | **HABEN-ANDERS-GELÖST** | `AGENTS.md:169` §Landing und `AGENTS.md:214` §Reporting; PRs gibt es hier nicht, der Land-Pfad ersetzt sie. |
| **P112** (36:40) „where code lives" ist am wenigsten nützlich | **HABEN-ANDERS-GELÖST** | Wir haben keinen solchen Abschnitt — konsistent mit seinem eigenen Urteil. |
| **P113/P114** (36:54) **Taste-Abschnitt** | **TRIFFT-UNS — echte Lücke** | Weder `AGENTS.md` noch `CLAUDE.md` noch ein `rulebook/`-Fragment trägt Code-Geschmack für DIESES Repo. `AGENTS.md:105` „Collaboration preferences" ist Zusammenarbeits-, nicht Code-Geschmack. Der Code-Geschmack existiert nur **global** in `~/.claude/CLAUDE.md` §Code Principles (kein `any`, keine spekulativen Abstraktionen, 200–400 Zeilen) — also generisch, für jedes Projekt gleich. Das ist genau die Umkehrung seines „least generic agent MD files". |
| **P104** (35:03) persönliche Notiz für Ton und Richtung | **TRIFFT-UNS — Lücke** | Es gibt keinen Owner-Abschnitt in `AGENTS.md`/`CLAUDE.md`. Das Owner-Modell existiert, aber in zwei ungoverneten Artefakten: `OWNER.md` (15.023 B, **gitignored** — `.gitignore:37`; Memory `project-steward-risk-doctrine-revision` nennt sie „the safety-critical owner-model") und den 9 `feedback-*`-Memories. Keines der beiden reist mit dem Repo; der Startkontext trägt das Owner-Modell also **über genau den Kanal, den das Video abschaffen will**. |
| **P69** (23:25) sag, **wie** der Agent denken soll, nicht nur was verboten ist | **TRIFFT-UNS, teilweise erfüllt** | `CLAUDE.md` ist überwiegend Verbotsliste — aber fast jedes Verbot trägt seine Messung und damit sein Warum (Beispiel `CLAUDE.md:126`: das `pkill`-Verbot mit dem Datum, dem getroffenen Prozess und der Respawn-Zeit). Das ist mehr als „don't do this again", aber es ist Kasuistik, keine Denkweise. |
| **P92** (31:18) Werte ja, Disziplinen nein | **SPANNUNG — bewusst anders gelöst** | Unser Regelbuch schreibt sehr wohl Disziplinen vor: die exakte Verify-Kette, die Beweisordnung bei rotem Check (`CLAUDE.md:105 ff.`). Der Unterschied zu Uncle Bobs Warnung ist die Durchsetzung: unsere Disziplin ist **maschinengeprüft** (das Gate FÜHRT die Kette aus, `CLAUDE.md:68`), nicht per Prompt erbeten. Auf Laurens Leiter ist das Stufe 2, nicht Stufe 3 — Uncle Bobs Einwand zielt auf per Instruktion auferlegtes Verhalten. |
| **P87/P88** (29:18, 29:37) Skills sind Fallback, und eher für Prozess als für Code | **HABEN-ANDERS-GELÖST, deckungsgleich** | Wir haben 4 Repo-Skills, **alle vier Prozess**, keiner Code: `mess-notiz` (Ergebnis als getrackte Datei ablegen), `kriterium-grill` (Done-Kriterium klären), `unslop` (Text vor der Ausgabe säubern), `graphify`. Und die Herkunft schließt den Kreis: zwei davon sind Adaptionen von **Laurens eigenem pstack** (`.claude/skills/unslop/SKILL.md:8`, `.claude/skills/mess-notiz/SKILL.md:8`) — der Person, deren Wertordnung das Video zitiert. |
| **P72–P89** (24:16–30:12) die Wertordnung | **HABEN-ANDERS-GELÖST, vollständig belegt** | Stufe 1 (Architektur eliminiert die Klasse): `src/protocol.ts` teilt Deklarationen, damit `tsc` Drift zum Compile-Fehler macht — beschrieben in `e2e/pins.ts:7-9`. Stufe 2 (Lint/CI): `e2e/pins.ts` + die Verify-Kette + 2.916 `check(`-Aufrufe in `e2e/` + der Post-Land-Audit als Stufe 2 nach dem Land. Stufe 3 (Skill/Regel): die vier Prozess-Skills. Stufe 4 (Mensch): Owner-Promotion als harte Invariante (`AGENTS.md:24`). Wir fahren seine Leiter — nur hat sie hier vier gebaute Stufen statt einer Empfehlung. |
| **P81/P82** (27:15, 27:35) CI-Decke gegen Bandbreiten-Regression | **TRIFFT-UNS — echte Lücke** | Wir haben denselben Fall gemessen und behoben: `docs/data-saver.md` §1 nennt `/api/sessions` @2 s als dominierenden Posten, erwartete Wirkung „3,37 → ~0,15 MB/min (−95 %)", vier Lanes A–D gelandet. Wir haben **keine Decke**: `grep` über alle `check("`-Namen in `e2e/` und den vier Einzeldatei-Harnesses findet keinen Byte-/Payload-/Budget-Check. Genau seine P80 („Within days … regressions started to happen") ist bei uns strukturell möglich und würde von keinem Gate gesehen. |
| **P115** (37:09) Reifegrad-Test | **TRIFFT-NICHT als Übernahme** | Ein subjektiver Test ohne Verifikationsweg. Unser Äquivalent ist gemessen statt gefühlt: die K1/K2-Zähler und `lane-outcomes.jsonl` (Memory `project-fleet-perception-loop-closed`: „K1 6/20"). |
| **P40** (12:37) „Kontextmanagement ist nicht unser Problem" | **TRIFFT-NICHT** | Für uns ist es gemessen unser Problem: `docs/kontextlast-architektur-2026-08-19.md` und `docs/kontextschicht-analyse-2026-08-20.md` existieren, weil das Regelbuch selbst als Kontextlast auffiel. Er redet über einen Einzelentwickler mit einer Session; wir spawnen viele Sessions gegen denselben Startkontext. |

---

## 5. Drei Kandidaten für uns — mit Schnittlinie

Die Owner-Frage lautete: **abschalten oder anders dosieren?** Antwort aus dem Mapping:
**dosieren, nicht abschalten** — die Klasse, die das Video selbst ausnimmt (P31, 09:16,
user-spezifisches Tagging), ist bei uns die Mehrheit des Nutzens, und der Recall trägt bei uns
eine Altersmarkierung, die seiner fehlte (P60).

### K1 — Die `project-*`-Momentaufnahmen aus der Auto-Memory nehmen, `feedback-*` behalten

- **Video-Beleg:** P55 (17:55) „These describe a moment the drift got migrated or didn't" ·
  P53 (17:01) Redundanz zur AGENTS.md · P63 (21:12) 26 von 45 nie gelesen.
- **Unser Ist-Stand:** 27 von 35 Dateien tauchten im Fenster 2026-07-26…08-25 in keinem
  Transkript auf (§5.2). Die Substanz der `project-*`-Klasse liegt ohnehin doppelt: in den
  Commit-Bodies (`CLAUDE.md:238`) und in `docs/`. `feedback-*` (9 Dateien) hat kein zweites
  Zuhause und ist genau P31s Ausnahme.
- **Kosten:** Der Index schrumpft von 35 auf ~11 Zeilen; er geht in jede Session dieses Projekts.
- **Was zuerst zu klären ist:** Ob die drei Momentaufnahmen-Memories wirklich in `docs/`
  gespiegelt sind — sonst ist das Löschen ein Verlust, kein Aufräumen.

### K2 — Ein Taste- und ein Owner-Abschnitt in `rulebook/` (nicht in `CLAUDE.md`)

- **Video-Beleg:** P113/P114 (36:54) der Taste-Abschnitt und seine konkreten Regeln ·
  P104 (35:03) die persönliche Notiz · P100/P101 (33:47, 34:02) ein deklarierter Wert schneidet
  eine ganze Vorschlagsklasse ab und wirkte messbar stärker als Code-Änderungen.
- **Unser Ist-Stand:** Code-Geschmack für dieses Repo existiert nirgends; `AGENTS.md:105` ist
  Zusammenarbeits-, nicht Code-Geschmack, und `~/.claude/CLAUDE.md` §Code Principles ist global
  und generisch. Das Owner-Modell reist heute über `OWNER.md` und die 9 `feedback-*`-Memories —
  also über genau den Kanal, den K1 verkleinert. K1 ohne K2 verliert Substanz.
- **Mechanik:** Fragment in `rulebook/` schreiben und rendern, nie `CLAUDE.md` editieren
  (Memory `project-fleet-rulebook-is-generated`; `CLAUDE.md:355 ff.` nennt Quelle und Hash).
- **Was zuerst zu klären ist:** Welche Fassung welche Fragmente bekommt — ein Taste-Abschnitt
  nützt der Lane, ein Owner-Abschnitt eher MAIN und Controller.

### K3 — Eine Payload-Decke als Check, damit die Data-Saver-Arbeit nicht still regressiert

- **Video-Beleg:** P80 (26:43) „Within days of me fixing this transit layer … regressions started
  to happen" · P82 (27:35) Decke ~30 % über dem optimierten Stand, PR schlägt fehl ·
  P83 (28:11) „the agent fixes it before it tells me it's done."
- **Unser Ist-Stand:** `docs/data-saver.md` §1/§3 dokumentiert Messung, Lane-Aufteilung A–D und
  erwartete Wirkung (−95 %); alle vier sind gelandet. Ein Check, der diesen Stand hält, existiert
  nicht — kein `check(`-Name in `e2e/` oder den vier Einzeldatei-Harnesses nennt Byte, Payload,
  Size oder Budget. Die Verifikation steht in `docs/data-saver.md` §4 als **manuelles**
  `curl … | wc -c` × Pollrate.
- **Was zuerst zu klären ist:** Ob eine deterministische Fixture für `/api/sessions` überhaupt
  billig ist — sonst wird aus einem Check ein Flake, und wir haben acht Familien davon
  (`docs/verify-tiering.md`).

### ── Schnittlinie ──

**Darunter bewusst nicht.** Sechs Dinge, die das Video nahelegt und die ich hier **nicht**
vorschlage, jeweils mit Grund:

1. **Auto-Memory ganz abschalten (P62, P121).** Sein Kronzeuge ist seine eigene Messung; unsere
   fällt milder aus (1,75:1 statt 3:1), unser Recall trägt eine Altersmarkierung, und die
   `feedback-*`-Klasse ist die vom Video selbst ausgenommene. Abschalten würde K1 mit erledigen
   und K2 seine Quelle nehmen.
2. **`graphify` oder Index-Ideen entfernen (P19, P25).** Bereits entschieden, indexless
   (Memory `project-fleet-knowledge-layer-decision`); `graphify` ist on-demand. Nichts zu tun.
3. **Die 22 undatierten `docs/`-Dateien anfassen.** Der Vorwurf trifft, aber die Rangliste ist
   hier zu Ende — drei Kandidaten waren die Vorgabe (`docs/scope-inflation.md` §7).
4. **Den Reifegrad-Test übernehmen (P115).** Subjektiv, kein Verifikationsweg; wir haben K1/K2
   und `lane-outcomes.jsonl`.
5. **Skills reduzieren (P37, P88).** Wir haben vier, alle Prozess, zwei davon Adaptionen genau
   der Quelle, die er zitiert. Nichts zu reduzieren.
6. **Das Regelbuch von Disziplin auf Werte umbauen (P92).** Unsere Disziplinen sind
   maschinengeprüft, nicht per Prompt erbeten — Uncle Bobs Einwand zielt auf Instruktion.

---

## 5.1 Methode — Transkript

```
mkdir -p "$TMPDIR/video-analyse" && cd "$TMPDIR/video-analyse"
yt-dlp --no-update --skip-download --write-auto-subs --sub-langs en-orig \
  --sub-format srt --output transcript "https://www.youtube.com/watch?v=Jf54k7tFeEc"
# srt -> Klartext: Cue-Blöcke parsen, aufeinanderfolgende Dubletten verwerfen,
# je 8 Cues zu einem Block mit [MM:SS]-Präfix zusammenfassen
```

Ergebnis: 1.130 Cues, 0 Dubletten (die Auto-Subs dieses Videos rollen nicht), 142 Blöcke,
8.339 Wörter. Das Transkript blieb im `TMPDIR` und wurde nicht ins Repo gelegt.

**Zitatprüfung:** 14 Zitate aus beiden Agenten per `grep -c` gegen `transcript.txt` geprüft,
14 belegt. Ein Fall verdient die Notiz: „Code is truth. Code is the ground truth" (P14) steht über
eine Blockgrenze verteilt — Blockende [03:13] „Code is the", Blockanfang [03:27] „ground truth."
Inhalt korrekt, Zeitmarke korrekt. Eine Rekonstruktion von Agent A wurde korrigiert: das
Transkript sagt „ping round modernizations" (15:21), nicht „ping pong".

## 5.2 Methode — Memory-Nutzung im eigenen Fleet

Gemessen über **alle** Projekt-Transkriptverzeichnisse (`~/.claude/projects/*/*.jsonl`,
1.748 Dateien), gezählt wurden Sessions, nicht Ereignisse:

- **write** = eine `tool_use`-Zeile mit `name` ∈ {Write, Edit, MultiEdit} und einem `file_path`
  unter `~/.claude/projects/-Users-owner-claude-fleet/memory/`, ohne `MEMORY.md`
- **read** = dieselbe Zeile mit `name` = `Read`
- **recall** = eine Zeile mit `This memory is …`, in der ein Dateiname aus unserem Verzeichnis
  vorkommt

| | |
|---|---|
| Session-Transkripte gesamt | 1.748 |
| davon berühren dieses Memory-Verzeichnis | 56 |
| **schrieben** eine Memory-Datei | **14** |
| **lasen** eine (Read-Tool) | 8 |
| hatten eine **Recall**-Injektion daraus | 4 |
| **lasen ODER recallten** (Vereinigung) | **8** |
| Verhältnis write : read-or-recall | **1,75 : 1** |
| Memory-Dateien (ohne Index) | 35 |
| davon im Fenster nie gelesen/recallt | **27** |

## 5.3 Was nicht gemessen wurde

- **Das Fenster ist 30 Tage** (älteste Transkriptdatei im Projektverzeichnis: 2026-07-26, jüngste:
  2026-08-25). **14 der 35 Memory-Dateien** wurden zuletzt VOR dem Fensterbeginn geschrieben —
  ihre frühere Nutzung ist unbeobachtbar, nicht „null". Die 27 sind damit eine Obergrenze für
  „nie gelesen", keine Feststellung.
- **Ob Auto-Memory geschadet hat**, ist nicht gemessen — weder bei ihm (P116 ist Zuschreibung,
  seine Messung P63 belegt Nutzung) noch bei uns. Gemessen ist nur, wie oft geschrieben und
  gelesen wurde.
- **Ob eine Memory-Injektion einen unserer Modell-/Harness-Vergleiche kontaminiert hat** (P48) —
  strukturell möglich, nicht nachgesehen.
- **Die 22 undatierten `docs/`-Dateien** wurden nicht auf inhaltliche Aktualität geprüft, nur auf
  das Datum ihres letzten Commits.
- **Ob die drei `project-*`-Momentaufnahmen in `docs/` gespiegelt sind** — Voraussetzung für K1,
  nicht verifiziert.
- **Das Video wurde nicht angesehen**, nur sein Auto-Transkript gelesen. Alles, was er auf dem
  Bildschirm zeigt und nicht ausspricht (die AGENTS.md-Datei selbst, die CI-Action, die
  Memory-Listen), ist in dieser Analyse nur so weit erfasst, wie er es vorliest.
