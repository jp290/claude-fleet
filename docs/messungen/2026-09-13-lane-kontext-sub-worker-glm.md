---
frage: Was hilft wirklich gegen vollaufende Worker-Lanes (Owner: „ueber 35 %, einzelne 40–50 %") — und traegt „Worker haben Worker" auch schwaechere Modelle, oder ist es Orchestrierungs-Ueberbau?
urteil: Die Verteilung traegt die Owner-Wahrnehmung als DEZIL-Befund: p50 des Endkontexts fertiger Claude-Lanes liegt bei 25,3 % von 1M, p90 bei 41,9 %, max 88,7 % — >35 %: 32/142 (23 %), >40 %: 18 (13 %), >50 %: 4; die Haelfte aller Lanes endet OBERHALB des 25-%-Qualitaetsbands. Der Lane-Staffelstab (73957a97) laeuft live NIE — bestätigt: Registrierung nur bei MIGRATE_PCT>0 (server.ts:25532), Default 0, watchdog.sh setzt FLEET_MIGRATE_PCT nicht —, aber es ist KEIN Bug, sondern bewusst default-off (Kommentar server.ts:12441–12451) und seit 2026-08-30 als dunkel gemessen; Kandidat Nr. 1 bleibt er trotzdem: eine Env-Zeile. „Worker haben Worker" auf Fleet-Ebene traegt die Daten NICHT: Lanes haben keine Dispatch-Tuer (409-Familie), der Repo-Deckel liegt live bei 1 Lane, sub-Worker-Vermehrung multipliziert ungepruefte Claims, und selbst das KOSTENLOSE in-pane Task-Tool wurde in 14 Tagen von 0/142 Lanes benutzt — Delegation passiert nicht von selbst, sie wird gebrieft. Schwache Modelle tragen bereits heute auf den kleinsten Slices (GLM 88,9 % landed, files p50 1, e2e 1/18) — die Fuellstand-Problemzone (e2e/server, p50 28,4 %) wurde ihnen aber fast nie gegeben; die naechste Messung ist eine normale GLM-Lane auf einem echten e2e-Schnitt, keine neue Maschinerie.
bereich: [lane-kontext, kontext, succession, modelle, orchestrierung]
belege: [lane-outcomes.jsonl (930 Zeilen, Stand 2026-09-13 ~17:2x), ~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*/ (173 Fenster-Lanes), server.ts#tickMigrate #contextFill #laneMigrateMessage #LANE_EXIT_FOOTER, watchdog.sh:192, streams/prompts.jsonl (13 257 Zeilen), post-land-audits.jsonl, commit 73957a97, docs/messungen/opus-lane-kontextkosten-2026-09-12.md, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md, docs/messungen/2026-09-06-kontext-gesundheit-glm.md, docs/messungen/2026-08-30-worktrail-audit-stufe2-kontext-modellmix.md, docs/messungen/2026-08-30-agent-slot-session-nahtstellen-glm.md]
nicht-gemessen: Fremd-Harness-Transkripte (pi/codex: 59+ Lanes ohne Claude-JSONL — sessionMs/toolResultBytes fehlen dort im Ledger); Kausalitaet Fuellstand→Qualitaet (nur Korrelate: Disposition, repairRounds, rote Audits); Geld-/Tokenkosten; Fenster der 31 Transkript-Lanes ohne [1m]-Tag (nur Tokenwerte, von Prozenten ausgeschlossen); card.size-Join (0/142 Fenster-Lanes haben eine Karten-Zeile — Karten erst ab 09-12 gefilet); quantitative GLM-Fehlerquote (Kontrollnotizen sind qualitativ); Subagent-Nutzung in MAIN-Sessions (Frage war Lanes)
stand: 2026-09-13
---

# Lane-Kontext-Fuellstaende, Sub-Worker und schwaechere Modelle — eine kritische Messnotiz

Auftrag (Owner 2026-09-13 ~16:1x, wörtlich): *„was wir wirklich gegen unsere vollaufenden worker
lanes (ueber 35% aber und einzelne bei schon 40-50%...) tun koennten. Vielleicht sollten worker auch
wiederum worker haben.. Ich weiss es nicht, aber die gleiche Idee waere irgendwie auch interessant
um schwaechere Models mit einbinden zu koennen, quasi tasks weiter aufteilen oder mit einer
weiteren stufe orchestrieren."* — Rollenvorgabe: KRITISCHE Stimme, gegen die Idee argumentieren,
wo die Daten es tragen. Read-only, eine Messnotiz.

## 1. Grundmenge und Methode

Ledger `lane-outcomes.jsonl` (930 Zeilen), Fenster 2026-08-30T00:00Z..2026-09-13, dedupliziert je
Branch (juengstes `ts` gewinnt): **263 Lanes** (landed 228 · killed-empty 25 · killed-dirty 9 ·
shelved 1). Modelle: opus-5[1m] 146 · unbekannt 43 · gpt-* 36 · glm-5.3 18 · fable 20. **173** der
263 haben ein direktes Claude-Transkript; **142** davon traegt ein benennbares Fenster
(`[1m]`-Tag im Outcome: opus-5[1m] 131, fable-5-1[1m]/fable 11 → 1 000 000). Kontext je
Assistant-Turn = `input + cache_read + cache_creation` (Definition wie Opus-Note und Stufe-2-Note);
Endkontext = letzte Usage-Zeile der Lane (chronologisch ueber alle Session-Dateien). Kompaktierung
traegt das Symbol nirgends: 2/142 Lanes mit Compact-Marker. Scratch und Skripte: `/tmp/glm-ctx/`
(extract.py → lanes14.json, analyze.py); Rohkommandos nie ausgegeben, `ps` nie aufgerufen.

## 2. Q1 — Verteilung des Endkontexts

| Gruppe | n | p50 | p90 | max | >35 % | >40 % | >50 % |
|---|---:|---:|---:|---:|---:|---:|---:|
| alle (Fenster bekannt) | 142 | 25,3 % | 41,9 % | 88,7 % | 32 | 18 | 4 |
| davon landed | 138 | 26,1 % | 42,6 % | 88,7 % | 31 | 18 | 4 |
| killed-empty | 3 | 12,3 % | 14,1 % | 14,1 % | 0 | 0 | 0 |
| opus-5[1m] | 131 | 25,0 % | 41,9 % | 88,7 % | 31 | 17 | 4 |
| fable-5-1 | 11 | 25,7 % | 30,8 % | 42,8 % | 1 | 1 | 0 |
| e2eTouched | 115 | 28,4 % | 43,3 % | 88,7 % | 30 | 17 | 4 |
| nicht e2e | 27 | 21,1 % | 33,8 % | 42,8 % | 2 | 1 | 0 |
| filesTouched ≤ 2 | 38 | 19,5 % | 32,0 % | 42,8 % | 2 | 1 | 0 |
| filesTouched 3–5 | 44 | 28,6 % | 41,9 % | 88,7 % | 10 | 6 | 1 |
| filesTouched > 5 | 60 | 30,8 % | 45,1 % | 59,8 % | 20 | 11 | 3 |
| commitCount ≥ 2 | 60 | 31,9 % | 45,7 % | 88,7 % | 25 | 13 | 4 |

Token-Niveau: p50 253 366 · p90 419 351 · max 886 807. **Die Owner-Wahrnehmung ist ein
Dezilphaenomen**: die mediane Lane endet auf dem Qualitaetsband (25 %, Owner-Entscheid 2026-08-30),
nur das oberste Zehntel laeuft wirklich voll — aber das sind ~2 Lanes/Tag, und alle vier >50 %-Lanes
sind e2e- und viele-Dateien-Lanes. 72/142 (51 %) enden OBERHALB des Bands: die Flotte arbeitet
routinemaessig in der gemessenen Abfallzone, nicht am Kliff (83 % erreichte keine, max 88,7 % endet
knapp darunter — Auto-Compaction war fast nie relevant).

`card.size` (GROESSE) ist fuer 0/142 Fenster-Lanes joinbar — Karten existieren erst seit 09-12 in
der Queue; `filesTouched` ist der Proxy, und der korreliert stark (Tabelle). Das ist Konfund, nicht
Kausalitaet: grosse Schnitte haben mehr Dateien UND mehr Kontext.

### 2.1 Wohin der Kontext geht

Erster Turn p50 **69 315** → erster Schreib-Marker (Edit/Write/commit) p50 **189 349** (130/142 mit
Marker) → Ende p50 **253 366**. Die Erdung bis zum ersten Schreiben (~120 k Tokens ≈ 47 % des
medianen Endkontexts) ist der groesste einzelne Block — konsistent mit Worktrail IV (75 k Erdung,
33 Aufrufe, server.ts in 143/171 Lanes) und der Opus-Note (Marker bei 177 k, 52 Bash davor). Danach:

- Tool-Result-Bytes im Transkript: p50 216 KB je Lane (Ledger: 202 KB); Bash-Aufrufe p50 113,5,
  p90 257 — Bash bleibt die Kontextwaehrung (Opus-Note: 98,9 % der pre-Marker-Bytes aus Bash).
- Suite- und Log-Oberflaeche: e2e-Kommandos in 126/142 Lanes (p50 10,5), Log-Tail/Suite-Muster
  p50 16,5, p90 50 Aufrufe — der S8-Fall (111 Suite-Wrapper- + 49 FAIL-Zeilen im Pane) ist die
  Spitze einer breiten Verteilung, kein Einzelfall.
- Warten: `sleep N` in **112/142** Lanes, 1 331 Aufrufe (p50 5, p90 27, max 74) — trotz „go idle"
  im Footer; Worktrail IV mass 1 676/135 ueber ein etwas breiteres Fenster.
- Retries am Report-Deckel: **322** abgewiesene Fleet-Reports in **117/142** Lanes (p50 1, max 12)
  — der Deckelstand in AGENTS.md (56d2e084) ist gefilet, aber im Fenster noch voll wirksam; die
  Wiederholungen passieren bei ~293 k Kontext (Worktrail IV), also genau in der oberen Dekile.

### 2.2 Fuellstand gegen Ergebnis — wird es messbar schlechter?

Nein, nicht in den harten Groessen dieses Fensters. Landed-Rate nach Fuellstand: ≤20 %: 91,2 %
(34) · 20–30 %: 100 % (53) · 30–40 %: 97,3 % (37) · **>40 %: 100 % (18)**. `repairRounds` = 0
fuer ALLE 142. `verified:false` 1 Lane (in 30–40 %). Rote Post-Land-Audits (Join `covers[].mainAfter`
→ 209 Fenster-Audits, 102 nicht gruen, 67/142 Lanes bedeckt): Rot-Rate 46 % / 46 % / 56 % nach
Fuellstand-Bucket — flach bis 40 %, schwach erhoeht darueber, konfundiert (e2e-Lanes sind voller UND
audit-anfaelliger; bekannte Flake-Familien). Die 88,7 %-Lane (2 600 Bash, 3,2 h, 5 Dateien) LANDETE.

**Kritische Lesart:** Der Satz „voller Kontext = schlechteres Ergebnis" ist in diesem Fenster eine
ANNahme. Was belegt bleibt, ist: (i) das 25-%-Band mit EINEM datierten Gegenfakt (Stufe-2-Note:
frische MAIN fuhr bei 18 % sofort die Runde, die alte bei 35–38 % neun Stunden nicht — n=1), (ii)
der Schwanzverbrenner (88,7 % ≈ 3,5× der Median-Token fuer 5 Dateien), (iii) vier von fuenf
datierbaren Defektakten des Private-repo-o-Laufs lagen ueber dem Band (n=5, Basisrate konfundiert).
Fuer die Empfehlung reicht das — aber als Kostenargument (verbrannte Tokens, Verzoegerung),
nicht als Qualitaetsbeweis.

## 3. Der Staffelstab-Befund am Code — bestätigt, mit einer Korrektur am Framing

Geprueft (nicht geglaubt): `server.ts:12441` `MIGRATE_PCT = Number(process.env.FLEET_MIGRATE_PCT
?? 0)`; `server.ts:25532` `if (MIGRATE_PCT > 0) setInterval(… tickMigrate …)`; `server.ts:13169`
`threshold = lane ? LANE_MIGRATE_PCT : MIGRATE_PCT`; `server.ts:12451` `LANE_MIGRATE_PCT`-Default
40. `watchdog.sh:192` startet den Server OHNE `FLEET_MIGRATE_PCT` (setzt aber u. a.
`FLEET_DISPATCH_MAX_LANES=1`) → Tick nie registriert → Lane-Schwelle 40 wirkungslos. Gegenprobe:
`streams/prompts.jsonl` (13 257 Zeilen) enthaelt 13 `Staffelstab`-Treffer — alle sind
Selbstberichte der S8-Lane selbst, ihr Brief und zwei Notizen; **0 Zustellungen von
`laneMigrateMessage`**. audit.jsonl: 0 Treffer.

Zwei Korrekturen am Befund: (1) Der Commit ist `73957a97` (S8, 2026-09-12), nicht `ab632dae` —
das ist der Pre-Rebase-Lane-Sha aus der Notiz ca9a4b30 („S8 GELANDET HEISST NICHT SCHARF"), die
das schon wusste. (2) Es ist **kein Einzeiler-Bug, sondern bewusst unbewaffnet**: der Kommentar
server.ts:12441–12451 sagt es selbst („every deployment parameter is explicit … arming is one env
line"). Dieselbe Dunkelheit wurde bereits 2026-08-30 gemessen
(agent-slot-session-nahtstellen-glm: „tickMigrate existiert, laeuft aber nie"). Der Befund ist
also: eine gebaute, gepinnte, doppelt dokumentierte Mechanik, die seit 14 Tagen auf eine
Owner-Entscheidung wartet. Das ist ein Argument FUER das Bewaffnen (nichts zu bauen) und GEGEN
neue Orchestrierung (die zweite Stufe waere die drittewartende Entscheidung).

Sichtbarkeit: `contextFill` (server.ts:25974) liest claude/pi/pi-zai (glm-5.3 → 1 M benannt) und
codex (windowFromFile) — der Staffelstab koennte also auch GLM-Lanes wie diese sehen. Aber:
pi-zai ist `automatable:false` (Adapter-Tabelle; `{kind:"lane"}`-Watch 409 seit b6956c9b) — die
Nachfolge selbst (POST /api/self/succeed) steht Lanes aller Harnesses offen.

### 3.1 Retten oder verschieben? Die 40-%-Uebergabe kritisch gelesen

- **Sie rettet den Schwanz, nicht die Zone.** 18/142 Lanes (>40 %) bekommen den Stoss; die
  37 Lanes zwischen 30 und 40 % und die 53 zwischen 20 und 30 % laufen auch bewaffnet durch —
  dabei liegt genau in 25–40 % die Stufe-2-Evidenz (Defektakte bei 32–38 %).
- **Die Nachfolgerin erdet neu — das ist Kosten UND Grenze.** Median startet sie bei ~69 k
  (erster Turn) und braucht bis zum Marker ~120 k nach. Uebergabe bei 40 % heisst: die Arbeit geht
  mit ~25 % Kopfzimmer weiter (real: die Nachfolgerin erdet fuer DEN REST-Schnitt, nicht die ganze
  Lane nochmal). Unter ~15 % Restaufwand ist die Succession ein Nettoverlust (Erdung > Ersparnis).
- **Der Beweis-Satz bleibt gewahrt**: 409 erzwingt leeren Baum, der handoff-Report ist typisiert,
  die Nachfolgerin erbt Branch/Slot/Brief + git log + Report. Kein Qualitaetsverlust am Beweis
  sichtbar — aber auch hier: 0 messbare Faelle live, die Aussage ist Design, keine Messung.

## 4. Q2 — die Optionen

**(a) Staffelstab einschalten.** Beleg: §3 — Mechanik steht, ist dunkel seit 14 Tagen, eine
Env-Zeile bewaffnet beide Rails (Achtung: `FLEET_MIGRATE_PCT` bewaffnet AUCH die MAIN-Schwelle;
getrennt steuerbar nur via `FLEET_LANE_MIGRATE_PCT` darunter). Kosten: pro ausgeloester Uebergabe
~120 k Erdungs-Tokens der Nachfolgerin + ein Report; Zustellnaht bekannt fragil (Composer-occupied-
Spirale, Worktrail-III-B1) — die ersten Zustellungen beobachten. Gegenargument: §3.1 — es ist ein
Schwanzschnitt, kein Qualitaetsband; und der Stoss kommt vom SERVER, nicht vom eigenen Sensor
(GPT/pi-Lanes ohne Footer-Anzeige sehen ihre Fuellung nicht — Kontext-Gesundheit-GLM Befund 5).

**(b) Kontext-Diaet (56d2e084, ctxPacks, Tool-Ausgaben in Dateien).** Beleg: Erdung ~120 k = 47 %
des Median-Endkontexts (§2.1); Worktrail IV: Briefs mit Datei#Symbol → 12–40 Aufrufe bis zum
Marker gegen 32–149 ohne; `estimatedBytes`-Feld wirkt in keinem Codepfad (Kontext-Gesundheit-GLM
Befund 11) — der Effekt muss ueber Inhalt kommen, nicht ueber Metadaten. Kosten: Pflege der Packs
gegen Drift (Fable IV §3.4 schraenkt das Register ein, Validator noetig). Gegenargument: der
Arbeitsblock NACH dem Marker (64 k Median) bleibt unberuehrt; eine Lane, die eine Suite fahrt,
liest deren Ausgabe trotzdem. Diaet senkt den Fussboden, nicht die Steigung.

**(c) Kleinere Schnitte schon beim Filen.** Beleg: filesTouched>5 → p50 30,8 % gegen 19,5 % bei ≤2
(§2, mit Konfundvorbehalt). Gegenargument (durchschlagend): der Erdungsboden ist PRO LANE —
N kleine Lanes zahlen N×~120 k Erdung; Kleinschneiden unterhalb des Bodens ist reine Reibung
(auch Worktrail IV: DONE-Block/FLAECHE senken Aufrufe, nicht den Marker-Kontext). Kleinschneiden
lohnt nur fuer Schnitte, die OHNE gemeinsame Erdung zerlegbar sind — das ist ein Karten-Inhalt-
Problem (c71b96eb), kein Dispatch-Problem.

**(d) Sub-Agents INNERHALB einer Lane (Claude-Code Task-Tool).** Beleg der Nichtnutzung: 0/142
Fenster-Lanes mit einem einzigen `Task`/`Agent`-tool_use; 0 verschachtelte Subagent-Transkripte in
allen 173 Verzeichnissen. Der EINE gemessene Fall ist die Worktrail-IV-Lane selbst, die vier
Audit-Dateien (~400 KB Prosa) von einem Opus-Subagent unter Zitatpflicht lesen liess — funktioniert,
wenn es der Plan vorschreibt. Kosten: naeherungsweise null (keine Fleet-Maschinerie, Subagent-
Transkript bleibt ausserhalb des Hauptkontexts). Gegenargument: spontan passiert es nicht —
0/142 trotz 14 Tagen Gelegenheit; wer Sub-Delegation will, muss sie BRIEFEN („lies X per Subagent,
zitiere Zeilen"), nicht hoffen. Als billiger Erstversuch klar vor (e).

**(e) „Worker haben Worker" auf Fleet-Ebene.** Dagegen, mit Code: (i) Lanes haben keine
Dispatch-Tuer — `/api/self/tasks` ist MAIN-bindend, die 409-Familie fuer Lanes umfasst clarify,
gate, drift, suite-offer, wave-split, criterion und Merge-Operationen (server.ts:27745 ff.);
eine Sub-Lane zu starten braechte eine neue Autoritaetsschicht. (ii) Der Repo-Deckel liegt live
bei 1 (`FLEET_DISPATCH_MAX_LANES=1`, watchdog.sh:192; Code-Default 3) — Sub-Lanes serialisieren
sich hinter den Geschwistern, parallelisieren nichts. (iii) Land-Pfad und Verantwortung: eine
Lane landet nicht selbst; wer verifiziert die Sub-Lane-Arbeit? Der Parent — und damit landet die
Verifikation (Diff + Verify-Output) im Parent-Kontext zurueck, die genau die Bytes sind, die man
sparen wollte. (iv) Der Beweis-Satz „a worker's report is a CLAIM" multipliziert: jede Stufe
verlaengert die Kette ungepruefer Behauptungen, die irgendwann eine MAIN erden muss.
(v) Empirie: null Adoption der kostenlosen Variante (d) — das System zeigt keinen organischen
Bedarf. Fazit: Ueberbau. Was von der Idee uebrig bleibt — Mess-/Such-/Lesearbeit auslagern —
leistet (d) ohne eine Zeile Servercode.

**(f) Schwaechere Modelle als Unter-Worker (GLM, Haiku).** Was die Kontrollnotizen tragen:
GLM-5.3 landet 88,9 % (16/18) im Fenster — nahe Opus (93,8 %) —, brauchte aber die kleinsten
Schnitte (filesTouched p50 1 gegen 5, e2e 1/18 gegen 113/146) und 3/18 Owner-Prompts gegen 41/146
bei Opus. Dichte Briefs wirken (Kontext-Packs-Note: die Lauf-Briefe mit GEMESSENEN FAKTEN waren
besser als jedes generische Pack), aber die Fehlerbilder sind dokumentiert: der GLM-Reviewer
winkte die einzige normative Richtungszeile ungeprueft durch (Stufe-2-Note); die
Kontext-Gesundheits-GLM-Haelfte brauchte zwei Rueckgaberunden (6+3 Korrekturpunkte); die
Forensik-Note zeigt ineffiziente Suchpfade (10,9 s Vollpass gegen moegliche 1,6 s). Kritisch:
GLM-Paritaet ist fuer eng gebriefte Lese-/Pruefslices belegt, NICHT fuer die Zone, in der das
Kontextproblem lebt (e2e/server, p50 28,4 %) — genau dorthin wurde GLM fast nie geschickt.
Koordinationskosten gegen Ersparnis: jede GLM-Unter-Arbeit braucht einen dichten Brief (~9–10 k B
Median) PLUS Parent-Verifikation; das rechnet sich nur fuer wegwerfbare Mess-/Sucharbeit — wieder
(d), nicht (e).

## 5. Q3 — Empfehlung: drei Schnitte, dann Schluss

1. **Staffelstab bewaffnen (Owner-Entscheid, eine Env-Zeile).** `FLEET_MIGRATE_PCT` setzen und
   `FLEET_MIGRATE_PCT` setzen und `FLEET_LANE_MIGRATE_PCT` bewusst waehlen (Vorschlag dieser
   Notiz: Lane 35 statt 40 — der Stufe-2-Schaeden lag in 25–40 %; MAIN getrennt entschieden).
   Done-Kriterium: in den naechsten 14 Tagen ≥1 `laneMigrateMessage`-Zustellung in
   `streams/prompts.jsonl` (auto, enthält „Staffelstab", nicht von der Lane selbst), Anteil >50 %
   bei 0, >40 % halbiert gegen §2 (gleiche Skripte, `/tmp/glm-ctx/`).
2. **Erdungsboden senken — c71b96eb-Snippets bzw. ctxPacks MIT INHALT priorisieren.** Der Boden
   (~120 k, 47 % des Medians) ist zugleich der Preis JEDE Succession aus Schnitt 1: ihn zu
   halbieren verdoppelt den Wert des Staffelstabs. Done-Kriterium: Marker-Median <150 k ueber
   10 aufeinanderfolgende Lanes mit Karten-Snippet-Brief (Messweg §2.1, Worktrail-IV-Rezept).
3. **Eine GLM-Paritaetsprobe als NORMALE Lane auf einem echten e2e/server-Schnitt** (dichte Karte,
   Datei#Symbol, Verify-Kette) — nicht als Unter-Worker-System. Done-Kriterium: landed,
   repairRounds 0, End-Fuellstand < Opus-e2e-p50 (28,4 %); erst danach ueber Modell-Mix in der
   Zone reden, in der das Problem lebt.

**Schnittlinie — was sich NICHT lohnt:** (e) Sub-Lane-Orchestrierung auf Fleet-Ebene (keine Tuer,
Deckel 1, Claim-Kette, null organische Nachfrage — alles, was daran wertvoll ist, leistet (d) per
Brief fuer null Maschinerie); generelles Kleinschneiden unterhalb des Erdungsbodens (c); ctxPack-
Ausbau VOR dem Bewaffnen des Rails (eine Zeile gegen Wochen Pflege); „GLM als Sub-Worker"
solange die Paritaetsprobe auf dem Zielslice nicht gefahren ist.

## 6. Reproduktion und Verify

Scratch: `/tmp/glm-ctx/` (extract.py, analyze.py, lanes14.json; 142/173/263-Zeilen-Join). Ledger-
und Audit-Stand eingefroren 2026-09-13 ~17:2x; appendede Zeilen veraendern die Reproduktion nicht.
Verify dieser Lane (docs-only, Kurzkette):

```text
$ bun install --frozen-lockfile && bun e2e/pins.ts
```

Tail im Report. Keine Suite, kein Serverstart, keine Owner-Route, keine Datei ausserhalb
`docs/messungen/` im Baum. Eigener Fuellstand: kein Sensor; nach gelesenen Bytes geschaetzt
~10–15 % des 1M-Fensters — unter dem Band, kein Succession-Bedarf.
