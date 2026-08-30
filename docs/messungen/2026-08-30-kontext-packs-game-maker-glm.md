---
frage: Was haette man jeder Session des Game-Maker-Workflows ab Minute 0 mitliefern sollen (kuratiertes Paket im Brief oder Datei im Repo), je Arbeitsschritt-Typ, und wo ist ein Pack die falsche Loesung?
urteil: Der Katalog hat sieben Pack-Typen; nur zwei davon sind Byte-Packs im eigentlichen Sinn (Builder-/Render-Kaltstart, Critic-ENV-KIT), der Rest sind Form-/Regel-Packs. Die messbare Luecke sitzt nicht im Brief-Inhalt — die Briefe des Laufs (R1, R7, B4 mit ihren GEMESSENEN FAKTEN) waren bereits besser als jedes generische Pack — sondern in drei wiederkehrenden Loechern: (1) jede Bau- und Reparaturlane liest die gleiche byte-gepinnte 1254-Zeilen-Card und den gleichen Vorgaenger-Quelltext ganz (B2: ~71 KB Card + ~54 KB B1-Quelle im Kaltstart; R4: ~170 KB Render-Quelle), weil kein Abschnitts-Manifest existiert; (2) mechanische Umgebung wird je Lane neu erfunden (Server-Port-Kollision 5173, captures/-ENOENT, Playwright-ToolSearch, Screenshot-Pfad-Deny — beim Critic 8 von 113 Calls reine Reibung); (3) die MAIN grpendet ihre eigene API-Karte durch Probes auf 401-Routen. Ein Pack, das diese drei Loecher schliesst, spart je Lane Minuten und 0,5–1 MB Kontext [abgeleitet], aber es senkt nicht die >90-%-Read-Byte-Spitzen der Reparatur-Loops — das bleibt Lesedisziplin, Messsonden und Modellwahl (Stufe 2). Zwei Packs sollten beim naechsten Lauf sofort existieren: das Critic-ENV-KIT und der Kaltstart-Schnitt per Skript.
bereich: [game-maker, lane-lifecycle, kontext]
belege: [docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md, docs/messungen/2026-08-30-private-repo-o-prozess-forensik-anhang.md, docs/messungen/2026-08-30-worktrail-audit-stufe2-kontext-modellmix.md, docs/messungen/2026-08-30-game-maker-instrument-audit-glm.md, fleet.json f99e9354 (Briefe 607e6ea0, 8e91fdc9, 58ec764b, 08990ab0, cb869598, 3f422975, 887756f4), Transcript-Indices im Session-Scratchpad (Architect dd40c125, B2 7392123f, R4 18ecaad3, Critic ec20370b, MAIN-alt 1cc4a350), private-repo-o HANDOFF.md @ HEAD f4973b5]
nicht-gemessen: R2/R6-Loop-Tiefaudits (Schwester-Lanes); pi-zai-Reviewer-Kontextlast (Adapter ohne Sensor, zitiert aus Anhang); ob jpeg-Captures die Urteilsqualitaet eines blinden Critic erhalten (ungeraten, GRENZE markiert); B3/Sonnet-Transcript (nicht indexiert, B3-Zahlen aus Anhang/Stufe 2); die 44k-Zahl des Gründungsbriefs ist der Messweg der Stufe 2 — meine eigene Messung der ersten User-Nachricht ergab 14 380 Zeichen.
stand: 2026-08-30
---

# Kontext-Pack-Katalog Game-Maker (Denk-Lane, evidenzbasiert)

Coverage-Plan: Ich habe die vier gelandeten Audit-Dokumente ganz gelesen, alle Brief-Textrumpfs
des Laufs aus fleet.json gefiltert und sieben davon ganz (Architect, Reviewer, B1, B4, R1, R7,
Critic), fuenf Session-Kaltstarte per Index-Skript vermessen (nur erste ~25–60 Bloecke, niemals
ganze Transcripts in den Kontext) und den Spiel-Repo-Checkpoint HEAD gelesen; "gut" heisst fuer
diese Notiz: jede Pack-Forderung traegt ihre Quelle, und jede Zahl ist als verifiziert oder
abgeleitet markiert.

## 0. Messbasis (was diese Notiz selbst gemessen hat)

Mapping Branch→Akt ueber lane-outcomes.jsonl Z. 609–630 (Modelle und toolResultBytes stimmen mit
dem Anhang berein). Fuenf Sessions indexiert (Skript→Scratchpad→grep, Transcript je Zeile):

| Session | Akt | Fenster (lokal) | Tool-Calls | Result-Bytes gesamt |
|---|---|---|---|---|
| dd40c125 (fleet-260829104522) | Architect | 12:45:26→13:03:10 | 19 | 47 124 B |
| 7392123f (fleet-260829160018) | B2 Renderer | 18:00:23→19:21:07 | 215 | 1 835 984 B |
| 18ecaad3 (fleet-260830005248) | R4 Reparatur | 02:52:53→03:47:29 | 188 | 3 786 504 B |
| 1cc4a350 (MAIN-Checkout) | MAIN-Founding | 12:42:24→22:57:24 | 189 | 1 339 048 B |
| ec20370b (fleet-260830111803) | Sensory Critic | 13:18:08→13:48:23 | 113 | 7 723 737 B |

Alle fuenf: VERIFIZIERT aus den Transcript-Indices (Timestamps sind UTC im Transcript; lokal +2 h;
Branch-Namen kodieren UTC — Messbefund des Anhangs, hier bestätigt an Spawn-Zeiten).

Wichtige Nuance zur Byte-Zahlung: Claude-Code persisiert uebergrosse Tool-Outputs in Dateien und
stellt dem Modell nur Kopf+Zeiger (~2,3 KB). R4s `cat AGENTS.md GAME-CARD.md` (68,2 KB) kostete
so nur 2,3 KB Kontext — dafuer hatte die Lane den Vertrag faktisch NICHT gelesen. Ein Pack, das
die relevanten Zeilen IN den Kontext liefert, ist besser als ein Persist-Zeiger auf alles.

## 1. Sessions — Faktenkasten, Befunde, Pack-Anschluss

### 1.1 Architect (dd40c125)

Faktenkasten siehe Tabelle. Aktivarbeit ~18 min; die Lane sass die restliche Stunde auf Land-/
Reviewer-Wartezeit (sessionMs 7 662 593 ms ≈ 2 h 08 m, Anhang). Ergebnis: ein Commit, 1132 Zeilen
GAME-CARD (8b79436d, Transcript Z. 113–115).

Kaltstart-Sequenz (Z. 19–55): Repo-Inventar (599 B) → INTAKE-sha + AGENTS.md (3 760 B) → INTAKE
ganz in 3 Bereichen (12 141 + 20 169 + 2 495 B) → Toolchain-Check bun/node (48 B) → dann reines
Schreiben der Card in 4 Anhaenge. Result-Bytes 47 124 B gesamt — der kontextaermste Akt des Laufs.

Befunde:
1. Der Architect hatte KEIN Kontextproblem — 47 KB, 19 Calls, alles Quelle erster Ordnung
   (AGENTS, INTAKE). Ein Byte-Pack fuer den Architect loest nichts. [VERIFIZIERT]
2. Das Produktproblem der Card (1254 Zeilen final, ~170 Zeilen eingebetteter Code, verrottete
   Quantitaeten nach 11 Reparaturen — GLM-Notiz Luecke 4) ist ein FORM-Loch: der Brief ordnete
   Struktur an, aber keine Obergrenze und kein Zahlen-Manifest. Der Architect-Brief (fleet.json
   607e6ea0) fordert 12 Abschnitte, aber nirgends "maximal N Zeilen" oder "jede Zahl als
   breaker:<id> oder taste markiert". [VERIFIZIERT am Brieftext]
3. Kleine Reibung am Schluss: fleet-report-Text >4 000 Zeichen wurde abgewiesen und musste
   gekuerzt neu gesetzt werden (Z. 128–135). [VERIFIZIERT]

Pack-Anschluss → Typ A (Architect/Card): ein FORM-Pack, kein Byte-Pack.

### 1.2 B2 Renderer (7392123f)

Kaltstart (Z. 19–138): Repo-Inventar (1 429 B) → GAME-CARD ganz in 5 Bereichen (11 990 + 15 859 +
16 152 + 12 831 + 14 284 = 71 116 B) → contract.ts + package.json + tsconfig + .gitignore
(5 998 B) → tools/serve.ts + ambient.d.ts + index.html (7 041 B) → track.ts mit wc-Tabelle
(8 647 B) → sim/index+pair+swap (12 918 B) → kart+mathx (12 494 B) → items (6 671 B) → bun-Probe,
bun install, three-Faehigkeitsprobe → erste eigene Zeile um 18:10, also ~10 min nach Spawn.
B1-Quell-Lesen gesamt ≈ 53 769 B. [VERIFIZIERT]

Befunde (gerankt):
1. ~71 KB Card-Ganzlesen fuer schaetzungsweise <20 KB slicespezifische Relevanz: B2s eigener
   Auftrag steht in Par. 13 hinten (Transcript Z. 58 zeigt den B2-Block erst im 5. Lesebereich),
   nevertheless las es §0–§13 komplett. Der B1-Brief ordnete das ausdruecklich an ("Lies sie
   vollstaendig", fleet.json 58ec764b); B2 eroeffnete mit demselben Programm (Z. 18). [VERIFIZIERT]
2. ~54 KB B1-Implementierungen, obwohl der Vertrag (contract.ts, 6 KB davon) die Schnittstelle
   ist: B2 las kart.ts, pair.ts, swap.ts, items.ts, track.ts GANZ. Was es brauchte: KartState-
   Felder, Track-Sampling, Event-Shapes — alles in contract.ts + Signaturzeilen. [VERIFIZIERT;
   Einsparung ABGELEITET]
3. Toolchain-Kaltstart je Lane: bun install nach Modulfehler (Z. 116–129), three-Versionssuche —
   mechanical, aber je Lane wiederholt. [VERIFIZIERT]
4. 1,83 MB Gesamtlast bei 1 h 21 m — der Kaltstart ist nur ~7 % davon; die Last entstand in der
   Bau- und Selbstpruef-Loop. Ein Pack haelt den Kaltstart kurz, die Loop lastet es nicht. [ABGELEITET]

Pack-Anschluss → Typ B (Builder-Slice): das dichteste Byte-Argument des ganzen Laufs.

### 1.3 R4 Reparatur (18ecaad3)

Kaltstart (Z. 19–149): git log + Baum + package.json (1 986 B) → wc-Tabelle render (729 B) →
AGENTS + GAME-CARD (68,2 KB, PERSISTIERT — nur ~2,3 KB in den Kontext, Vertrag faktisch
ungelesen) → render/index.ts (28 895 B) → camera+banner+props (16 184 B) → palette+spec+materials
(12 979 B) → render.test.ts (28 164 B) → verify+index.html+serve (9 280 B) → fx (11 620 B) →
world+geom (21 135 B) → figure+pose (25 534 B) → dev+devworld (13 752+2 314 B) → sim-Greps
(track-Konstanten, finished, coasting, COAST_DECEL) → HUD. Render-Quell-Lesen ≈ 169 857 B. [VERIFIZIERT]

Befunde (gerankt):
1. R4 las ALLES, was render war, ohne Priorisierung — weil niemand ihm sagte, wo Bild-Defekte
   sitzen (index: Szene/Loop, camera, pose, figure vorne; palette nur bei Farbwerten). Die
   wc-Tabelle baute es sich selbst (Z. 23) — ein Inventar mit Einzeilen-Verantwortung je Datei
   fehlte. [VERIFIZIERT; Einsparung ABGELEITET]
2. Persist-Orakel statt Vertrag: der eine Call, der AGENTS+Card lesen sollte, lieferte einen
   Zeiger. Die Lane arbeitete ohne gelesenen Vertrag weiter. [VERIFIZIERT]
3. Launch-Ritual mit zwei Fallen: Serverstart schlug fehl (node_modules fehlte im frischen
   Worktree), danach Port 5173 vom MAIN-Server belegt — R4 brauchte lsof-Forensik, um den fremden
   Prozess zu identifizieren (Z. 183–190), und fand dann den eigenen auf 5273. Später ENOENT auf
   captures/-Pfad beim ersten Screenshot (Z. 217–218). Der R7-Brief kannte die Port-Falle spaeter
   schon ("5173 gehoert dem Server des Owners, nimm z.B. 5273", fleet.json 3f422975). [VERIFIZIERT]
4. 3,77 MB Gesamtlast (Read 3,49 MB, Anhang) in 56 min: Kaltstart ~5 % — die Loop dominiert. [ABGELEITET]

Pack-Anschluss → Typ D (Render-Reparatur) + Typ E allgemeines Launch-Rezept.

### 1.4 Sensory Critic (ec20370b)

113 Calls, 7 723 737 B in 30 min — fast ausschliesslich Screenshot-Reads (~40+ PNGs als base64,
je 110–171 KB, Z. 62 ff.). Erste 8 Calls reine Umgebungsreibung: Port-Probe (000), Verweis auf
"bereit auf 5300" in einer Datei, eigener Serverstart, ToolSearch nach Playwright-Tools, dann
zwei gescheiterte Screenshot-Pfade (Access denied auf /private/tmp, dann ENOENT, dann mkdir -
Z. 42–57). Danach konvergierte die Lane auf ein sauberes Muster: eine Fahrt pro browser_run_code_
unsafe-Aufruf mit eingebettetem shot()-Helper, keyboard.up im finally, dann Read jedes PNG. [VERIFIZIERT]

Befunde:
1. Das ENV war das einzige Loch: Der Brief (fleet.json 887756f4) war vorbildlich — Blindheit,
   echte Eingabe, try/finally, "laenger als eine Minute", Berichts-Skelett. Was fehlte, war der
   erlaubte Screenshot-Pfad (MCP-Pfadrestriktion) und ein existierender shots-Ordner. 8 Calls ≈
   2–3 min und 2 Fehlerbilder. [VERIFIZIERT]
2. Byte-Budget des SEHENS: 7,7 MB fuer einen Critic-akt. Die groesste einzelne Hebelklasse sind
   die Capture-Bytes selbst: Serien-Shots als jpeg statt PNG (Detailurteile weiter als PNG)
   waere grob −60–70 % auf die Serienanteile [ABGELEITET, Qualitaetsrisiko markiert].
3. Der Critic-Verdikt war der wertvollste fremde Blick des Laufs (HANDOFF @ f4973b5: konkrete
   Bildpunkte statt "flach"; Fahrbarkeit als Kern benannt). Das bestaerkt V2 der Synthese:
   der Zeitpunkt (nach erstem PLAYABLE) wiegt schwerer als jedes Pack. [VERIFIZIERT am HANDOFF]

Pack-Anschluss → Typ E (Critic-ENV-KIT): rein mechanisch, null Semantik.

### 1.5 MAIN-Founding (1cc4a350)

Erste User-Nachricht (Transcript Z. 6): 14 380 Zeichen [VERIFIZIERT]; die "~44k" der Stufe 2 sind
deren Messweg (Brief+AGENTS+System in Tokens) [zitiert]. Kaltstart (Z. 19–108): AGENTS.md
(3 672 B) → git-State → INTAKE-sha + cat (persistiert) → program-execution (1 591 B) → INTAKE in
Ranges (persistiert, dann 9 561 + 15 935 + 4 394 B sichtbar) → Toolchain → /api/self (266 B) →
5 API-Probes auf capabilities/models/harnesses/spawn-options/help: ALLE unauthorized (349 B,
Z. 79–81) → Scratchpad-Brief (9 095 B) → Task-POST.

Befunde:
1. API-Karte fehlte: 5 Probes auf 401-Routen, und die Spawn-Tripel-Unsicherheit zwang einen
   Owner-Zuruf mid-turn ("aligning the spawn triple", Z. 105). Eine Route-Tabelle mit Auth-Klasse
   und eine Spawn-Tripel-Liste haetten beides genommen. [VERIFIZIERT]
2. Persist-Orakel auch hier: INTAKE-Ganzlesen erzeugte zwei nutzlose Zeiger-Ergebnisse, erst die
   dritte Range-Strategie trug. Eine Lese-Anweisung mit benannten Bereichen haette das gespart. [VERIFIZIERT]
3. Die teuersten Founding-Kosten waren keine Bytes: 3 h 35 m Owner-Land-Wartezeit vor selfLand-
   Promotion (Anhang, Wurzel 2) — Politisches (V4), kein Pack. [zitiert]

Pack-Anschluss → Typ F (MAIN-Founding).

### 1.6 MAIN-Succession (nicht selbst indexiert — Belege aus HANDOFF + Stufe 2)

Nachfolge-MAIN fuhr bei 18,1 % Fuellstand sofort die Runde, die die alte bei 35–38 % ueber Stunden
nicht fuhr (Stufe 2, Kontrafakt). Der Checkpoint war der Kanal und trug zugleich das Prosa-Problem:
Open-defect-Feld mit 5–7 Eintraegen gegen die one-defect-Spez, Urteile als Fakten (GLM Luecke 6),
unknown-Zeilen ohne Resolver (Luecke 3). [zitiert] Pack-Anschluss → Typ G (Succession-Shape).

## 2. Der Katalog

Legende je Typ: INHALT / NICHT-INHALT / BUDGET / ENTSTEHUNG / GRENZE. Durchgaengige Regel: ein
Pack ist ein VIEW auf gepinnte Quellen (HEAD-Stand beim Filing), nie ein zweites Dokument — nur
so rottet es nicht.

### Typ A — Architect/Card (FORM-Pack)

- INHALT: Card-TEMPLATE mit fester Abschnittsskelett-Obergrenze: 1 Seite Produktsatz + Non-Goals
  + Kern-Events als Prosa; Breaker-Manifest als Tabelle (jede quantitative Zeile → `breaker:<id>`
  oder `taste`); Worker-Brief-Tabellen mit den 5 Feldern (Dependencies/Write-Set/Stop/Done/Verify)
  — die Struktur, die der Lauf-Card-Brief schon forderte, plus die zwei Zeilen, die ihm fehlten:
  Zeilen-Deckel und Zahlen-Manifest-Pflicht. Dazu als Pflicht-Zeile im Template: der
  Konventions-Pin "steer=+1 ⇒ Bildschirm-x-Delta > 0" (V1 der Synthese) und das Messrezept
  Card-Liveness (Zahlen-Regex → Manifest-Eintrag, GLM Luecke 4, dort auf 2–3 h geschaetzt).
- NICHT-INHALT: alte Cards/Implementierungen (Frischlauf-Kontamination — der Architect-Brief
  verbietet sie zu Recht ausdruecklich); Intake-Zusammenfassungen (der Architect SOLL die Quelle
  ganz lesen; ein Summarisieren enteignet seine einzige Ideenquelle).
- BUDGET: 8–12 kB Template+Checkliste; gegen jedes Fenster vertretbar. Kein Byte-Problem
  (Architect: 47 kB gesamt, verifiziert).
- ENTSTEHUNG: Template lebt im Game-Maker-Profil (Fleet-Repo), Liveness-Check als verify-Stufe im
  Spiel-Repo, sobald eine Card existiert. Anti-Rott: der Check bricht rot, wenn eine ungemappte
  Zahl auftaucht — das Template kann nicht still verwaisten.
- GRENZE: Wenn V7 (Card-Schnitt auf 1 Seite + Manifest) promotet wird, loest sich dieser Typ
  weitgehend auf: die kleine Card braucht kein Kardieren mehr. Das Pack ist Uebergangsinstrument
  und Template zugleich; Wahrheit der Card bleibt Sache von Breakern und Reviewer, nicht des Packs.

### Typ B — Builder-Slice (B1–B4) (BYTE-Pack, Kaltstart-Schnitt)

- INHALT: (1) Abschnitts-Manifest der Card NUR fuer den eigenen Brief mit Zeilenbereichen
  (z. B. "§3:206–216, §11:593–761, §13/B2:1000–1060, T-Zeilen: …"), maschinell geschnitten; die
  Vertragsdatei contract.ts WOERTLICH (sie ist die Schnittstelle); (2) Vorgaenger-Signaturen statt
  Vorgaenger-Implementierungen: `git grep "^export" src/sim/` als Tabelle; (3) Launch-Rezept:
  bun install im frischen Worktree VOR dem ersten Startversuch, eigener Port (5173 gehoert dem
  MAIN-Server), stamp.json-Abgleich, Playwright-ToolSearch-Zeile, `mkdir -p captures` als erste
  Zeile, try/finally keyboard.up; (4) Verify-Zeilen wortwoertlich mit erwarteter Ausgabe (tat der
  Lauf-Brief schon — unangetastet lassen); (5) Nicht-anfassen-Liste (Write-Set-Form, vorhanden).
- NICHT-INHALT: die ganze Card (71 kB fuer <20 kB Relevanz, verifiziert an B2); ganze
  Vorgaenger-Implementierungen (54 kB bei B2, Signaturtabellen reichen ausser fuer die je eigene
  Naht); MAIN-Checkpoint-Prosa (Urteile reisen als Fakten — GLM Luecke 6); die GEMESSENEN FAKTEN
  je Slice neu kopieren (sie sind Maschinenfakten → Profil, siehe Sammelabschnitt).
- BUDGET: 25–35 kB je Builder, und es ERSETZT Card-Ganzlesen (Netto: B2-Kaltstart ~127 kB → ~40 kB
  [ABGELEITET]). Gegen 200k-Fenster (Sonnet/B3): zusaetzliche ~35 kB ≈ 4–5 Prozentpunkte — deshalb
  die Ersetzungs-Regel: das Pack addiert nicht, es schneidet. B3 startete laut Stufe 2 bereits bei
  ~27 % nur aus Brief+Kontext; ein additiver Pack waere dort ein neues Loch.
- ENTSTEHUNG: `tools/pack.ts` im Spiel-Repo liest Card-Abschnittsmarker + contract.ts + Signatur-
  Grep vom gepinnten HEAD und schreibt `build/pack-<brief>.md` (gegitignored). Die MAIN ruft es beim
  Task-Filing auf und nennt den Pack-Pfad im Brief. Anti-Rott: je Filing frisch geschnitten — es
  existiert keine zweite, pflegebeduerftige Dokumentversion.
- GRENZE: Die 1,8-MB-Last von B2 entstand in der Loop, nicht im Kaltstart; ein Pack verschiebt die
  Kurve, es kappt sie nicht. Und solange die Card 1254 Zeilen bleibt, ist das Pack
  Symptomlinderung — V7 ist die Wurzel. Das Pack ist der Beweis-Aufbau dafuer, dass Schnitte
  tragen, bevor V7 promotet ist.

### Typ C — Sim-Reparatur (Regel-Pack, klein)

- INHALT: der RAHMEN-Block, den die Lauf-Briefs bereits trugen (verify ALL PASS, Playpfad-Pflicht,
  try/finally, SwiftShader-Perf-Verbot, captures-nach-Commit) — als stehendes Snippet; die
  Naht-Konventionskarte der Winkelkette in 6 Zeilen mit Symbolnamen (steer→targetMag→yawAcc→
  heading (sin,cos)→Render-Identitaetsabbildung→three.js rechts=cross(up,eye−target); steht
  faktisch fertig im R7-Brief); Trace-Rezept (`bun tools/trace.ts --drift/--compare`) mit
  erwarteter Zeilenform; Pin-Nachzieh-Regel (Hash-Aenderungen benennen, nicht still ziehen).
- NICHT-INHALT: Render-Internas fuer Sim-Lanes (R1 durfte render nicht anfassen); Tuning-Empfeh-
  lungen (Owner-Geschmack); Checkpoint-Urteile.
- BUDGET: ~5 kB. Die Defektmathematik selbst (R1-Brief: `(8+19|steer|)·(1,15/grip)²`) ist je
  Defekt MAIN-Messarbeit VOR dem Filing — sie zu templatisieren waere falsch, sie ist der Beweis.
- ENTSTEHUNG: RAHMEN als Profil-Snippet (die MAIN kopierte ihn ohnehin von R1 zu R2); Nahtkarte
  referenziert Breaker-Namen statt blosser Dateizeilen — sobald der Konventions-Pin existiert,
  haelt der Breaker die Karte wahr bzw. schlaegt an, wenn sie rottet.
- GRENZE: R1 (22 min, 848 kB) zeigt: ein Brief mit gemessener Defektursache braucht kein Pack.
  Das Pack zahlt nur auf die Brief-Erzeugung der MAIN ein (Schneller schreiben, nichts vergessen).

### Typ D — Render-Reparatur (BYTE-Pack + Prioritaeten)

- INHALT: Modul-Inventar von src/render/** als Tabelle (wc -l + Kopfkommentar-Zeile je Datei — B2
  schrieb solche Kommentare selbst, R4 baute sich die wc-Tabelle im 2. Call); Lese-PRIORITAET je
  Defektklasse (Bild/Kamera/Lesbarkeit → index, camera, pose, build/figure zuerst; Farbwerte →
  palette/spec/materials); Bild-Koordinaten-Messrezept: die NDC-Maschinerie render.test.ts:491–495
  (rowPx) und :580–590 (worstNdc) mit dem R2/R7-Präzedenzfall (ROLE_SCREEN_GAP 7 % Bildhöhe,
  Konventions-Pin); Launch-Rezept wie Typ B; die Szenenspiegelungs-Falle als Verbot (R7: Text und
  asymmetrische Flaechen drehen mit).
- NICHT-INHALT: ganze GAME-CARD (nur die visuellen Paragraphen im Manifest); Sim-Implementierungen
  (Signaturen); Erlebnisberichte der MAIN ("flach" ist Owner-Klasse, kein Defekt-Befund).
- BUDGET: 6–8 kB Inventar+Rezept; geschaetzte Kaltstart-Ersparnis bei R4-Klasse: ~170 kB Ganzlesen
  → ~60–80 kB zielgerichtet [ABGELEITET, Annahme ~50 %]. Die 3,49-MB-Loop-Last bleibt unberuehrt.
- ENTSTEHUNG: `tools/pack.ts render` — Inventar generiert je HEAD (wc -l + erste Kommentarzeile),
  Prioritaeten sind 5 feste Regeln im Profil. Anti-Rott: je Filing neu generiert.
- GRENZE: Die Spitzen (R2 2,69 MB, R4 3,77, R6 3,49) sind Loop-Kosten: lesen→aendern→sehen→
  verwerfen. Dagegen wirken Messsonden statt Voll-Reread (R6-Lehre: Sonde druckt `curve=A..F
  stage=<n>`, der Bericht kopiert Werkzeugzeilen — GLM Luecke 5), A/B kleinere Modelle (Stufe 2)
  und kleinere Viewports bei Serien-Captures. Wer das Pack als Loesung der Render-Last verkauft,
  misst das falsche Loch.

### Typ E — Sensory Critic (ENV-KIT, blind)

- INHALT (nur Mechanik): im Seal-Vorgang vorgebauter shots-Ordner am EINEN erlaubten Pfad samt
  wörtlicher funktionierender Screenshot-Zeile (die MCP-Pfadrestriktion war unbekannt — Critic
  Z. 42–57); die fertige ToolSearch-select-Zeile; Serverstart mit freiem Port + curl-Probe;
  Fahr-Rezept (eine Fahrt pro Aufruf, shot()-Helper, keyboard.up im finally — Critic erfand es
  selbst, Z. 72, gut, aber nach 8 Reibungs-Calls); Capture-Byte-Regel: Serien jpeg, Detailurteile
  PNG (Kanten, Flimmern am Fluchtpunkt brauchen PNG) [ABGELEITET]; Berichts-Skelett (die 6 Fragen
  des Lauf-Briefs) mit Pflichtfeld "Bildpfad + was darauf zu sehen ist".
- NICHT-INHALT: ALLES Semantische — Card, HANDOFF, Hypothesen, Vorurteile, Tastenwirkungen jenseits
  der Belegungsliste, Reparaturvorschlaege. Kontamination ist hier nicht Risiko, sondern
  Ausschlusskriterium des Akts. Ein einziges semantisches Halbwort im Kit entwertet den Critic.
- BUDGET: ~3 kB. Die 7,7 MB Seh-Kosten sind der Preis des Akts; das Kit senkt nur Reibung und
  (mit der jpeg-Regel) die Serienbytes [ABGELEITET: grob −60–70 % auf Serienanteile].
- ENTSTEHUNG: das Kit erzeugt dasselbe Skript, das das sealed Paket baut (Operator-Orchestrierung) —
  Pfadzeilen stammen aus Live-Konfiguration, nicht aus Erinnerung. Anti-Rott: Seal-Skript und Kit
  sind ein Guss; wer neu seal't, bekommt das Kit neu.
- GRENZE: Blindheit ist per Aussage, nicht erzwungen (HANDOFF @ f4973b5) — ein Werkzeug (Lane-cwd
  ausserhalb des Repos + MCP-deny auf den Quelltext) waere das echte Instrument; das Kit leistet
  das nicht. Und der Zeitpunkt (Critic nach erstem PLAYABLE, V2) wiegt mehr als jedes Kit. Ein
  billigerer Zwischen-Critic (jpeg, kuerzer) koennte oefter laufen [ABGELEITET].

### Typ F — MAIN-Founding (Landkarten-Pack)

- INHALT: API-Karte der MAIN-Rolle (existierende /api/self/*-Routen als Tabelle MIT Auth-Klasse;
  gemessen: capabilities/models/harnesses/spawn-options/help antworten 401 auf self-token —
  MAIN-old Z. 79–81); Spawn-Tripel-Tabelle (aus fleet.json ableitbar); Seed-Baum-Fakten (2
  Dateien, HEAD, INTAKE-sha — lag im Architect-Brief, der MAIN haette sie genauso bekommen
  koennen); Lese-Anweisung INTAKE mit benannten Bereichen (persist-Orakel vermeiden, MAIN-old
  Z. 27–68); selfLand-/Promotion-Status zum Startzeitpunkt (haette die 3 h 35 m Owner-Land-Warte
  wenigstens als bekannte Tuersituation ausgewiesen).
- NICHT-INHALT: Produktvorurteile (die MAIN ist Programm-MAIN, nicht Designer); das INTAKE als
  Paket (sie liest die Bindungsquelle selbst — AGENTS verlangt es); Fleet-Attention-Historie
  (Debugging-Kontext des Vortags).
- BUDGET: 4–6 kB.
- ENTSTEHUNG: API-Karte als Generat aus server.ts-Routen (regeneriert je Deploy); Spawn-Tripel je
  Spawn. Anti-Rott: Generat aus Code.
- GRENZE: Die teuersten Founding-Kosten des Laufs waren Tueren und Timer (52 % Wanduhr Wartezeit,
  Anhang) — V4/V5-Politik, kein Byte-Pack. Und program-execution ist ein Live-Sensor: die Karte
  nennt die Route, das Fahren bleibt aktuell.

### Typ G — MAIN-Succession (FORM-Pack, Kanal-Shape)

- INHALT: Checkpoint-SHAPE-Vertrag: falsifizierbare Anker (Seed, Input-Sequenz, erwartetes
  Observable) als maschinenlesbare Fixture im Spiel-Repo mit Replay-Assert (GLM Luecke 6,
  Ersatz-Check); Urteile ausdruecklich [urteil]-markiert; unknown-Zeilen mit Resolver
  (Instrument+Trigger, blockiert `Next: hold` — Luecke 3/V3); Preflight-Receipt-Form (existiert im
  HANDOFF und war gut); Replay-Erstakt-Rezept (exakter Commit, Seed 1, echte Tastatur, TAUSCH-A/B
  mit erwarteten Zahlen — der Nachfolger fuhr es und gewann den Kontrafakt von Stufe 2).
- NICHT-INHALT: Vorgaenger-Biographie ("was ich versucht habe" — lebt im git log); ein Zweitkanal
  neben dem Checkpoint (studio 349: genau ein Handover-Kanal — das Pack ist die FORM des Kanals,
  kein Zusatzdokument).
- BUDGET: 3–5 kB Shape-Vertrag; der Checkpoint selbst bleibt der einzige Inhaltsträger.
- ENTSTEHUNG: Shape als Regeltext im Profil; Anker-Fixture wird Teil des Builds (Assert bricht,
  wenn der Anker luegt). Anti-Rott: der Replay-Assert ist der Rott-Schutz.
- GRENZE: Succession-Qualitaet hing im Fall am Fuellstand der ALTEN MAIN (35–38 % vs. 18,1 % des
  Nachfolgers — Stufe 2), nicht an der Form. Context self-management (bereits promotet) ist das
  Instrument; das Shape-Pack verhindert nur, dass Prosa-Urteile als Fakten erben.

## 3. Ranking nach Ertrag je Aufwand und die zwei fuer den naechsten Lauf

| Rang | Pack | Aufwand | Ertrag (Beleg) |
|---|---|---|---|
| 1 | Typ E Critic-ENV-KIT | ~1–2 h, 3 kB | beendet die gemessene Reibungsklasse (8 Calls, 2 Fehlerbilder) und senkt mit der jpeg-Regel die teuerste Byte-Klasse des Akts; null Kontaminationsflaeche (Critic Z. 42–57) |
| 2 | Typ B/D Kaltstart-Schnitt `tools/pack.ts` | ~1 Tag | ersetzt Card-Ganzlesen (71 kB→~30 kB, B2 Z. 24–60) und Render-Ganzlesen (~170 kB→~60–80 kB [abgeleitet]) je Bau-/Reparaturlane; Minuten je Lane plus 0,5–1 MB gesamt [abgeleitet]; baut die Evidenz fuer V7 |
| 3 | Typ C RAHMEN+Nahtkarte | ~2 h | RAHMEN existiert schon; Nahtkarte steht fertig im R7-Brief, muss nur ins Profil |
| 4 | Typ F API-Karte | ~2–3 h (Generat) | 5 tote Probes + 1 Owner-Zuruf vermieden (MAIN-old Z. 79–105) |
| 5 | Typ G Succession-Shape | ~3–4 h, teils = GLM Luecke 6 | Anker-Fixture + unknown-Resolver; zaehlt erst, wenn Successions haeufiger werden |
| 6 | Typ A Architect-Template | ~2 h + Liveness 2–3 h | zahlt nur bis V7; danach weitgehend aufgeloest |

**Die zwei, die beim NAECHSTEN Lauf sofort existieren sollten: das Critic-ENV-KIT (Typ E) und der
Kaltstart-Schnitt per `tools/pack.ts` (Typ B+D).** Begruendung: Sie adressieren die einzigen beiden
Loecher, die in den ersten ~25 Tool-Calls JE gemessenen Session sichtbar wurden (B2, R4, Critic,
MAIN-old: alle vier bauten sich Umgebung und Vertragsausschnitte selbst), und beide sind rein
mechanisch — sie gefaehrden keine der harten Invarianten (Critic-Blindheit, ein-Handover-Kanal).

## 4. Sammelabschnitt — was ins stehende Game-Maker-Profil gehoert

Ins Profil (maschinenstabil, je Lauf identisch), nicht je Lauf geschnitten:
- der GEMESSENE-FAKTEN-Block (Playwright-Haltetasten 66/66 Frames, try/finally-Pflicht nach
  6155-ms-Nebenbefund, SwiftShader: Bilder ja/Bildraten wertlos, captures erst nach Commit,
  5173=MAIN-Server/Eigenport-Regel) — die Lauf-Briefs (B4, R1, R7) kopierten ihn wiederholt;
- der RAHMEN-Block fuer Reparaturlanes (vorhanden);
- der Konventions-Pin als Pflicht-Breaker je Card (V1) + Nahtkarte bis der Pin existiert;
- die Seal+Kit-Erzeugung fuer den Critic (ein Skript);
- die API-Karte der MAIN als Deploy-Generat;
- der Checkpoint-SHAPE-Vertrag (Typ G).

NICHT ins Profil: produktspezifische Zahlen (Tuning, Strecken), Card-Inhalte, Defektmathematik —
das sind je-Lauf-Messungen der MAIN bzw. des Architects. Ein Profil, das Produktwissen speichert,
rottet mit dem naechsten Spiel und kollidiert mit dem Frischlauf-Non-Goal (Architect-Brief:
alte Implementierungen sind keine Eingabe).

## 5. Deckung

GELESEN: die vier Audit-Dokumente ganz; Briefe 607e6ea0, 8e91fdc9, 58ec764b, 08990ab0, cb869598,
3f422975, 887756f4 ganz (fleet.json); HANDOFF.md @ f4973b5 ganz; Transcript-Indices der fuenf
Sessions (erste 56–60 Bloecke je, plus Summenzeile ueber die ganze Datei).
ABGELEITET: alle Einsparungs- und Verteilungsschaetzer (ausdruecklich markiert); die 44k-Zahl der
Stufe 2 als deren Messweg gegen meine 14 380-Zeichen-Messung der ersten User-Nachricht.
NICHT GEPRUEFT: R2/R6-Loops im Detail (Schwester-Lanes); B3-Transcript; pi-zai-Reviewer (kein
Sensor); ob jpeg die Critic-Urteilsqualitaet erhaelt; die tatsaechliche Einsparung des
pack.ts-Schnitts vor seinem ersten Einsatz.
