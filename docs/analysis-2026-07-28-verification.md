# Session 11 — Verifikation gegen HEAD, vor der Ausführung

**2026-07-28, HEAD 9d3944f** (= 5e33d59 + Template-Fix; server.ts/src/client.ts/alle .sh identisch).
Begleitband zu `analysis-2026-07-28-findings.md` (Session 10). Hier stehen nur **am Baum
verifizierte Low-Level-Fakten** — drei read-only Agenten + Hauptsession, jede Zeile mit Anker.
Nichts hiervon ist Plan; die Reihenfolge-Entscheidungen stehen als gemessene Kollisionen da.

## 0. Funktionsprüfung: alle sechs Stufen grün auf diesem Baum

Ausgeführt seriell unter `/tmp/fleet-e2e.lock`, 2026-07-28 vormittags:
tsc über 9 Dateien (7 Gate-Dateien + postland-Harness + merge-prompt) OK ·
`./e2e-clean-review.sh` ALL PASS · `./e2e-security.sh` ALL PASS · `./e2e-claude-gate.sh` ALL PASS ·
`./e2e-isolated.sh` ALL PASS (Trail-Rows geschrieben, tree=5e33d59… gestempelt) ·
`./e2e-postland-audit.sh` ALL PASS. Der Land-Pfad und Tier-2 sind damit auf diesem Baum
deterministisch bewiesen.

## 1. Must-agree-Paare (Agent 1): 34 verifiziert, Klassifikation, Brüche

**Heute gebrochen (jeder Anker gelesen):**
- `BACKGROUND_MARKS` `server.ts:1779` = 2 Marker (`:1777/:1778`), aber `runWorker` (`:2155`,
  einzige `summaryViaSession`-Aufrufstelle `:2158`) hat **8 Aufrufstellen**: `:2237` summary ✓Mark,
  `:2470` review ✓Mark, `:2575` commit-msg, `:2663` enhance, `:3805` merge-resolver, `:3829`
  repair, `:3913` ② clean-review, `:5492` digest — **6 unmarkiert**. Produktion nimmt an allen 8
  den Session-Pfad (watchdog.sh:101 setzt keine `FLEET_*_CMD`-Stand-ins). Fix-Form: Pflichtfeld in
  `WorkerSpec` `:2149-2154`.
- Render-Key `src/client.ts:2604-2607` listet `branch, dirty, ahead` — **`behind` fehlt**,
  gerendert in `renderSlots` bei `:2386`; `:1268` nutzt `behind` zusätzlich im Brief-Pfad.
- `steward-arena.sh:155` kopiert 2 von 4 lokalen server.ts-Imports (`server.ts:7-10`:
  merge-prompt, lane-signals, enhance-prompt, continuity — es fehlen die letzten beiden);
  `:153-154` formuliert selbst die verletzte Invariante.
- `docs/verify-tiering.md:321-322/:335-336/:359-360` behauptet Tier-2 auskommentiert/off —
  `watchdog.sh:81-88,:101` fährt es live.
- **NEU** `watchdog.sh:67-70` Kommentar „NOT here: … ./e2e-security.sh" ↔ `:71` fährt genau diese
  Suite im Gate (Register A2.5).
- **NEU** tsc-Liste `watchdog.sh:71` (7 Dateien) ↔ 5× `fleet-e2e*.ts` auf Platte:
  `fleet-e2e-postland-audit.ts` fehlt (Register A2.6).
- NUL-Byte in `src/client.ts`: **GEFIXT** (0 von 205.340 Bytes; Commit `688d22e`). Die CLAUDE.md-
  Regel dazu war veraltet und ist heute entfernt.

**Klassifikation (Auswahl mit beiden Ankern):** protocol.ts-Klasse (TS↔TS): `MAX_CHUNK=1000`
`src/client.ts:17` ↔ WS-Cap 1024 `server.ts:7090` (stiller Drop!); `DISPO_VERDICTS`
`src/client.ts:2980` ↔ `DISPOSITION_VERDICTS` `server.ts:3733`; Worker-Literale `src/client.ts:1589/
:3365/:3838/:3901` ↔ `DISPOSITION_WORKERS` `server.ts:3730-3732`; `GitInfo` doppelt definiert
`src/client.ts:137` ↔ `server.ts:801`; `PostLandAuditInfo` `src/client.ts:2523` ↔ Projektion
`server.ts:3369-3372`; Modell-Literal `server.ts:90` ↔ `fleet-e2e-claude-gate.ts:220`; doneMark↔
Contract-Key ×8 (u. a. `server.ts:3806`↔`merge-prompt.ts:70`, `:3914`↔`merge-prompt.ts:262`).
pins.ts-Klasse (.sh/.md-Seite): cp-Listen ×6 ↔ `server.ts:7-10`; `VERIFY_SKIP_EXIT=42`
`server.ts:2822` ↔ `watchdog.sh:71/:88`; `VERIFY_SKIP_MARK` `server.ts:2828` ↔ watchdog-Echo;
Port-Band-Tabelle `e2e-isolated.sh:22-40` ↔ 6 `PORT=`-Zeilen (heute deckungsgleich, security auf
21400 umgelegt); `FLEET_CLEAN_REVIEW`-Parse-Menge `server.ts:2715-2716` ↔ watchdog `shadow`.

**Platzierungs-Folgen (entscheidet Lane-Reihenfolge):**
- `src/protocol.ts` mit server.ts-Import → Pflicht-Edit an **5** cp-Listen (clean-review,
  claude-gate, postland, steward-arena, drill-3); isolated+security kopieren `src/` bereits.
- Top-Level `protocol.ts` → alle 7 Listen.
- `e2e/pins.ts` als Runner-Modul → `fleet-e2e.ts:10-38` MUSS editiert werden (explizite
  Registrierung); als Standalone-Skript (`bun e2e/pins.ts` im Baum, nicht im Scratch) → kein
  Runner-Edit, keine cp-Listen-Abhängigkeit.
- `drills/drill-3.sh:33-41` ist der einzige abgeleitete cp-Guard; seine Regex `:34`
  (`from "\./[A-Za-z0-9_-]+"`) **matcht keine Subpfade** — `./src/protocol` wäre unsichtbar.

## 2. Harness-Fold (Agent 2): Zahlen und Divergenzen

- cp-Listen: nur `e2e-isolated.sh:49` kopiert `e2e/`. Die 4 Einzeldatei-Harnesse haben **0 lokale
  Imports** — nur deshalb booten sie ohne `e2e/`.
- Dupliziertes Plumbing gegen existierende geteilte Module: claude-gate ≈24 Z., clean-review ≈45,
  security ≈21, postland ≈40 → **≈130**; plus Paar-Duplikation clean-review↔postland ohne
  geteiltes Modul (Seeding cr:56-63↔pla:149-156, openLane cr:68-91↔pla:160-175, driveMerge
  cr:92-107↔pla:176-187) ≈32-40; Shell-Blöcke ×5 Wrapper (Reap-Loop, Bind-Wait, trap, Teardown)
  ≈90. **−260 trägt nur TS+Shell zusammen; TS allein ≈150 netto.**
- **4 Divergenzen sind Entscheidungen, kein Drift:** (a) `waitMerge` pollt in cr/pla bei
  `!running && last===null` weiter, `e2e/lane-helpers.ts:36` returnt (cr trägt Begründung);
  (b) `FLEET_TOKEN`-Env honorieren harness.ts:45+security, die 3 anderen nicht; (c) SOCK/PORT-
  Defaults: harness.ts:10-11 = LIVE `claudefleet`/8790, Harnesse eigene Bänder; (d) Live-Socket-
  Refusal: unbedingt in allen 4 Harnessen, Escape-Hatch im Runner (fleet-e2e.ts:42-43), **fehlt
  in harness.ts komplett**.
- Trail: `writeTrailRow` `e2e/trail-emit.ts:121-132`, einziger Importeur `e2e/harness.ts:5`.
  `FLEET_E2E_SUITE` wird **nirgends** gesetzt (einziger Leser trail-emit.ts:62, Default
  "isolated") — auch gefaltete Harnesse stempeln falsch, bis ihre Wrapper sie setzen. Die
  `node_modules`-Symlinks für `sourceTree()` setzen alle 4 Wrapper bereits.
- Laufzeit-Gate ≈104 Checks (cr läuft 2×: Gate- + Shadow-Phase, e2e-clean-review.sh:107/120);
  statisch 154 in den 4 Dateien. Die „158" aus Session 10 wurde nicht reproduziert.

## 3. Intervention-Outcome (Agent 3): Session-10-Claim korrigiert

- **`outcomeTally` hat VIER Schreiber, nicht einen:** measureOutcomes `server.ts:917` (nie
  gelaufen — `grep -c steward_send audit.jsonl` = 0, Log unrotiert seit 21.07.), Harm-Route
  `:6190` (nie), **propose-Pfad `:6745` (lief 11×** — `steward_propose_outcome`=11, live-Tally
  propose {helped:7, dismissed:4}), Boot-Restore `:4752`.
- **`promotionEligible("propose")` `server.ts:3703-3706` wäre heute TRUE** (7≥5, harmed 0,
  Attest 25.07. + 14d TTL frisch bis 08.08.) — gespeist nur vom propose-Pfad, nie von der
  Send-Messung. Leser: exakt 2 (GET-Route `:5706`, Harm-Response `:6202`); **Client: 0 Treffer.**
- Bestand server.ts **318 Zeilen**: :294-312 Konstanten, :494 saveState-Felder, :851 Aufruf,
  :857-880 helpedGitSince, :882-924 measureOutcomes, :926-953 measureControls, :3638-3706
  Deklarationen+Prädikat, :4722-4767 Boot-Restore, :5108-5137 Produzent, :5700-5723 GET,
  :6171-6203 Harm-POST. e2e: `e2e/steward-outcomes.ts` ~278 von 657, `fleet-e2e-claude-gate.ts:
  79-117` ~39, `e2e/security.ts:66` Pin, Wrapper-Knobs `e2e-isolated.sh:273`/`e2e-claude-gate.sh:
  85`. Gesamt ≈645 berührte Zeilen.
- Persistenz: `fleet.json` trägt heute outcomePending:[] :102, outcomeTally :103-110,
  harmCandidates:[] :111, harmAttestAt :112. Nach Löschung: Restore liest Keys defensiv einzeln →
  unbekannte Keys ignoriert, Felder verschwinden beim **ersten saveState nach Restart**.
- Zwei falsche dismissed-Rows: nur als Aggregat in fleet.json:103-110 (nicht unterscheidbar),
  roh in audit.jsonl (ts 1785224757396/1785224759044) + steward-journal.jsonl. Nach Löschung
  liest **niemand** mehr den Zähler → Reparatur gegenstandslos. **Offene Teilentscheidung:**
  propose-Block `server.ts:6730-6748` — `audit()`-Call ist der einzige Lösch-Trail für
  Steward-Tasks (behalten), `bumpTally`-Write verliert sein Ziel (kappen).
- NICHT mit weg: handleStewardSend :5051-5107+:5139-5140, stewardRecentSends :322-331,
  Lane-Outcome-Ledger (Namensvetter, :3412-3439 u. a.), Dispositions-Rail :3708-3770 (nur
  `:3767` schreibt harmAttestAt), Journal-Infrastruktur :5155-5160/:5725-5760. e2e-Kopplungen
  brauchen Umbau statt Schnitt: Digest-Anker steward-outcomes.ts:308-318, Tier-1-Block :549-656
  nutzt Fixture oc2 (:156), security.ts:66-Pin muss editiert werden (Paritäts-Check :147-150).

## 4. Gemessene Kollisionsflächen → erzwungene Serialisierung

- protocol-Lane ↔ fold-Lane: 5 Wrapper-cp-Listen (wenn src/protocol.ts vor der Ableitung landet).
- protocol-Lane ↔ delete-Lane: `fleet-e2e.ts:10-38` (Runner-Registrierung, falls pins als Modul)
  + server.ts-Deklarationsregionen (:294-312, :3638-3706 werden gelöscht).
- fold-Lane ↔ delete-Lane: `e2e-isolated.sh:273` (SRV_ENV-Zeile mit Outcome-Knobs),
  `e2e-claude-gate.sh:85` (Spawn-Zeile), `fleet-e2e-claude-gate.ts:79-117` (Branch 3 ruft
  `/api/steward/outcomes`).
- Konsequenz: **fold → protocol → delete, strikt seriell**; die Ableitung zuerst macht die
  protocol-Platzierung wrapper-frei (Akzeptanztest der Ableitung: ein späterer
  `./src/protocol`-Import reitet ohne Wrapper-Edit mit — Subpfad-Regex-Falle aus §1 beachten).

## 5. Merge-Pfad-Defekt am Baum bestätigt (Autonomie-Blocker)

`tryScriptRebase` `server.ts:3777-3786`: `await git(cwd, "rebase", "--abort")` `:3784` —
**Exit-Code verworfen**. Schlägt der Abort fehl (z. B. index.lock einer parallelen git-Operation),
bleibt die Lane mid-rebase; `pre.clean` ist fortan false, jede Route `landed:false`.
`tickGit` (Kommentar :809-812) *erkennt* wedged state (`gitOpInProgress`), verhindert ihn aber
nicht; `gitRetry` `:577` (index.lock-Backoff) ist nur an die Commit-Route `:2603/:2616`
verdrahtet, nicht an rebase/abort. Cross-Run-Fall-Through (HANDOFF-Korrektur 4): Durable-Intent-
Marker :3960-3974 deckt Restart-mid-run; der Lapse-Pfad über bewegtes main ist **nicht** hier
verifiziert — als Claim an die Härtungs-Lane.

## 6. Aufgeräumt / Nebenbefunde (Hauptsession)

- Orphan-Worktrees `a0fa`/`6883`: je **0 Commits vor main** (58/46 dahinter), Trees sauber →
  Worktrees + Branches entfernt, nichts verloren.
- Stash vom 21.07. („parked to clean main for landing") ist **nicht überholt**: will
  `klaus.example.com` aus FLEET_ALLOWED_HOSTS/FLEET_SHARE_HOSTS (watchdog.sh:101 trägt
  beide noch) + Emoji-Wechsel in share.html:298. Owner-Entscheid; unangetastet.
- Hygiene: **693** geleakte `fleet*`-Sockets entfernt (Glob matcht `claudefleet` nicht;
  live-Socket danach verifiziert: 7 Sessions, Server 200), **109** Scratch-Verzeichnisse
  (~800 MB) gelöscht. `$TMPDIR/fleet-e2e-trail` bewusst behalten (Audit-Trail-Daten).
  Wachstums-Mechanismus bleibt (Register A5.3: Wrapper behalten Scratch bei Fehler, kein Reaper).
- Live-Gate-Beschreibung in `docs/lane-brief-template.md:84` gefixt (`9d3944f`).

## 7. Steward-Region tiefgelesen (Agent, Session 11) — Grenze hält, fünf Defekte

Grenzprüfung positiv: default-deny hinter Owner-Gate-Vorrang (`server.ts:5832-5835`), kein
Land/Merge/Kill/Open/Share/Mission/Harm über Steward-Token (e2e-Belege `e2e/steward-core.ts:
173-181`), Share-Hosts sehen die Routen gar nicht (404 vor Token, `:5795-5797`), Autos hart
slot-gebunden, Tasks hart „pending", keine Perpetuals. ABER Sends/Brief/Transcript erreichen
**jeden aktiven Slot** (kein Lane-Guard, `:5072-5073/:5647/:5655`) — kein Doku-Widerspruch
gefunden, aber auch keine Guard-Zeile.

Defekte, gerankt:
1. **`ref:"verify"` sagt einer blockierten Lane „Lane gelandet"**: `:5026-5028` prüft
   `status !== "interrupted"` statt des vorhandenen `landed`-Felds (`:2893-2894`) — auch
   `blocked`/`error` rendert die Land-Behauptung. Kosten: Lane verifiziert gegen falsche Prämisse.
2. **Pulse kann fremde Session zitieren**: `pulseLastOutput` `:4958-4976` nutzt den
   newest-by-mtime-Fallback `:1797-1815`, den `transcriptFact` `:5198-5201` explizit als
   „silently swaps subject" verweigert — vierte Datenquelle am Kommentar `:4933-4934` vorbei.
3. **Quiet-Hours-Lücke**: direkter Send gemutet (`:5083`), ein Steward-One-Shot-Auto feuert in
   tickAutos trotzdem (`:1552` `quietHours: a.everySec !== null`) — nur eigene Pane, Kill-Switch
   greift.
4. **Steward-Token nie rotiert, schwächer gebunden als `:275-278` behauptet**: send/tasks/journal/
   sessions/brief/transcript brauchen keinen existierenden Steward-Slot; Widerruf = fleet.json
   von Hand.
5. **Journal-POST ohne Rate-Cap** (`:5729-5757`): fächert `laneFacts()`-git-Subprozesse pro
   aktiver Lane auf; Loop rotiert den eigenen Rundgang-Anker aus der `.1`-Generation.

Uncosted: doppeltes ⚙-Label möglich (Token in JEDE matchende Pane, `:1211-1212`); Audit-
Attribution gemischt (send=Ziel-Slot `:5107`, tasks/journal=Steward-oder-undefined); Hourly-Cap
global, nirgends so dokumentiert.

## 8. Assertion-Substrat (Agent, Session 11): 488 Checks gelesen — 469 OK / 17 SCHWACH / 2 LEER

Land-Pfad-Familien (merge, land-provenance, land-durability, ref-advance, lanes-*) enthalten
**null** Quelltext-Regex-Stellvertreter und bauen explizit anti-tautologisch. Konzentrierte
Schwächen: (1) `e2e/security.ts:71-82` Pre-Auth-Pin matcht nur Literal `url.pathname` — eine
destrukturierte Route entgeht Extraktor UND Stray-Detektor, §2-Matrix nur bei Pflege der
`dangerous()`-Liste; (2) `e2e/merge.ts:377` „lands (clean, merged)" beweist nur HTTP-`.ok`;
(3) `e2e/merge.ts:62-63` „exactly what will land" prüft weder Base noch Exklusivität;
(4) Steward-Brief-Read nie wert-geprüft (`e2e/steward-core.ts:129`); (5) `land-durability.ts:
194-195` fragt das Undo-Record nicht ab. Strukturnote: „hat main NICHT erreicht"-Negationen
sind fenster-begrenzt (`git log -3..-6`), nicht ancestry-basiert.

## 9. FIX1-Basisrate: die Tier-2-Röte ist ein vorbestehender ~44%-Flake — und vermutlich das Race

Trail-Historie über 18 Läufe / 6 Bäume (Kommando: FIX1-Rows je `e2e-trail/*.jsonl` +
Audit-Trail zählen): FIX1 läuft 2× pro Suite-Lauf; **in 8 von 18 Läufen fällt genau eine
Instanz**, Signatur immer identisch („agent reported rebased, but the lane is not clean — fake
rebased"). Betroffen u. a. c0439f15 (27.07., 2/2·1/2·2/2·1/2), 4df2898e (vor dem Fold, 2/2·1/2·
1/2), ecbd2a40 (nach dem Fold, 1/2) — **die Rate ist baumunabhängig und älter als jede Änderung
dieser Session.** Der rote Post-Land-Audit auf 3d38960 und der rote Same-Tree-Rerun sind damit
kein Regress, sondern die Basisrate. Konsequenz 1: Tier-2 ist bei dieser Rate ~50 % der Zeit
alarmierend — der Alarm verliert seinen Informationswert. Konsequenz 2 (Hypothese, prüfbar):
der Flake-Mechanismus IST das Git-Race (tickGit-`status` gegen `rebase`/`--abort` unter der
Concurrency des Checks). **Abnahmekriterium der merge-Härtungs-Lane: FIX1-Basisrate im Trail
fällt von 8/18 auf ~0.** Kept instance des Rerun-Fails inspiziert und entsorgt.
