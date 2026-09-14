# HANDOFF — Orchestrator Slot 3 → Nachfolgerin (Haupt-Checkout, Owner-Token): Shard-Rollout 528aa37c live, Deploy a0433312 verifiziert, 16 Owner-Reports entschieden, Astra-Lauf 1 geerntet, Freigabe-Schnitt B gefilt; Schnitt 56669352 wartet weiter auf EIN sauberes Voll-Audit; 2026-09-14 23:2x, ctx GEMESSEN 32,3 %

## 0. SOFORT BEIM ANTRITT

- **Owner-Auftrag dieser Schicht (woertlich 2026-09-14 ~22:0x):** „ich will im grunde alles was noch offen ist, sauber angehen, überleg selbst was das heißt im zusammenhang, gib dir mühe, own your work" — und danach: „Sag mir ansonsten einfach was ich machen muss wenn es etwas gibt". Also: selbst entscheiden, nur echte Owner-Akte melden, knapp.
- **Watches erben nichts.** Kein Audit laeuft oder wartet (23:2x). Das naechste VOLL-Audit entsteht erst nach dem naechsten Code-Land (Lane Slot 1 `fleet/260914204509-f68d` laeuft). Nach dessen Land: `./ctl.sh watch audit <mainAfter>`.
- **Program-MAIN Fleet-Betrieb sitzt jetzt in Slot 7** (war 8). Vor jedem Send `./ctl.sh send --main f170dc46e4b026ee34d9392e <datei>` — das Verb loest die Bindung selbst auf.

## 1. OFFEN — in dieser Reihenfolge

1. **Schnitt fuer die Veroeffentlichung:** Kriterium (HANDOFF ca26435c §2): ein gruenes Voll-Audit, das `56669352` deckt, >4 500 ran, 0 failed. Zweimal knapp verfehlt, beide Male UNGEMESSEN statt Regress, beide `unknowable` beurteilt:
   - `8b244a1e` (lokal, Second-host quiet): e2e/slots.ts Quiet-Window-Sonde fand ihre Vorbedingung 4/4 nicht, Invariante `detail null`.
   - `15d5f056` (Second-host, noch ungesharded — Claim vor dem Deploy): `(iv) M5` in e2e/programs.ts, `fired:false`, 409 „not done-looking (no signal)"; Detail in `streams/helper-artifacts/26ea1a205005/1789420869280/suite.log:3455`. Fixture-Zeile `c1410c99` gefilt.
   Wird das naechste Voll-Audit gruen mit 0 failed: dem Owner den dann gedeckten Tip (nicht mehr 56669352 allein) als Schnitt nennen. Ist eine der beiden Sonden WIEDER rot: Owner-Regel „zweimal gleiches Audit-Rot = sofort reparieren" greift — Reparatur per Hand-Dispatch.
2. **Shard-Rollout 528aa37c — Done-Kriterium noch nicht beobachtet:** „eine Audit-Ledger-Zeile mit shards[] (3 Eintraege) und result green". Stand: Second-host-Daemon `b744d50e` (Update `ac03728d4f02` reported ok, `device.features: ["audit-shard"]` — NUR ueber `GET /api/helper/jobs?deviceId=secondhostlinux1` sichtbar, der `/api/sessions`-Poll projiziert `features` nicht), `.env:38 FLEET_AUDIT_SHARDS='3'`, `./state.sh` config sensor `live=3`, Deploy `a0433312` ok/hitTarget. Das erste Audit nach dem Deploy lief noch ungesharded (Claim von vorher, so gewollt). Beim naechsten Voll-Audit `shards` auf der Ledger-Zeile pruefen und die Zeile 528aa37c dann auf done setzen.
3. **Freigabe-Richtung 247c2f37:** umgesetzt als Queue-Folge, Owner nicht mehr gefragt (Astra-Empfehlung B, `docs/messungen/2026-09-15-freigabe-analyse-astra.md` §5): `439283e4` Bug „POST /api/tasks/:id/queue ohne Statuspruefung" (am Code nachgeprueft: releaseTask setzt queued fuer jeden Status) → `c0db46e6` Schnitt B (Sammelfreigabe mit Vorschau/stamp + Zuordnungs-Tuer `POST /api/tasks/:id/program`), NACH 439283e4. Beide card-valid freigegeben, halten an Kollisionen. Entwurf A/C bewusst NICHT gefilt. Die Richtung 247c2f37 selbst bleibt als richtung-Zeile offen, bis B gelandet ist.
4. **Sol-Test 8e21d437:** bleibt bedingt. Verdrahtungsprobe gelandet (`1ab5fa25`, Urteil „teilweise": CLAUDE.md-Lane-Render nie geladen, drei Sensoren null); die MAIN hat `b4396c14` (AGENTS.md §Codex) und `640a74c9` (Ledger-Sensoren) gefilt. Erst nach deren Land ist der Test sinnvoll.

## 2. IN MEINER SCHICHT (21:5x–23:2x)

- **Deploy-Frage des Owners** („deploy vor 27 Commits — kam einer nicht durch?"): nein. 17:52 war ein Hand-`kill-session` der damaligen MAIN (Session 959671d0), darum ohne Ledger-Zeile. Zeile `de1d8d77`: Boot ohne Marker schreibt `by:"unattributed"`.
- **Deploy `a0433312`** 22:45:55 auf `cc81e727`, ok:true, behind 0. Client-Build vorher schon 21:5x (bundleStale war true).
- **16 Owner-Reports** entschieden (13 accept mit Land-Sha, 3 reject als ueberholt) nach Subagent-Sichtung + eigener Stichprobe (merge-base, `/api/file`, reportAwaitsOwner).
- **Astra-Lauf 1 geerntet**, drei INDEX-Zeilen (`d9b50963`, `da6a9eee`). Karten-Schaerfer: bewusst KEINE Neuanlage (Begruendung in der INDEX-Zeile).
- **Astra-Doku korrigiert** (`8b244a1e`): leeres FLAECHE befreit nicht — Flaeche aus `server.ts#symbol`-Belegen im Brief abgeleitet; Fix `POST /api/tasks/:id/files` mit der NEU-Datei.
- **Worktree `fleet-260913221107-a536`** entfernt (killed-empty, ahead 0, sauber). `201a` (shelved, 1 Commit) steht absichtlich.
- **Eigener Fehler, korrigiert:** beim Antritt meldete ich die drei Astra-Zeilen als programlos — falsches Feld gelesen (`program` statt `programId`). Folgenlos (queue = gleiche Freigabe wie card-valid).
- Direkt-Commits ohne Land-Ledger: `8b244a1e`, `d9b50963`, `da6a9eee` (docs, pins gruen).

## 3. UNGEPRUEFT

- Ob das erste gesharded Audit auf dem Second-host wirklich 3 Shards claimt und gruen zusammenfuehrt.
- Ob ein Deploy die Idle-Uhr eines laufenden Idle-Beweises getroffen hat — vor `a0433312` nicht bei den Programs abgefragt (nur die Fleet-Betrieb-MAIN war informiert).
# HANDOFF — Orchestrator Slot 4 → Nachfolgerin (Haupt-Checkout, Owner-Token): Schnitt-Kandidat 56669352 wartet auf sein Audit, drei Astra-Auftraege gefilt (Kontingent-Sensor + docs/astra-auftraege.md), Freigabe-Richtung 247c2f37 fuer die naechste Owner-Session, Shard-Rollout haengt an einer Owner-Antwort; 2026-09-14 21:5x, ctx GEMESSEN 32,6 % (Server-Prädikat)

## 0. SOFORT BEIM ANTRITT

- **Watches erben nichts.** Mein Audit-Watch auf `56669352` (2f51e352) und meine zwei Hintergrund-Watcher sterben mit mir. Neu legen: `./ctl.sh watch audit 56669352`. Das laufende Audit (Claim bis 22:14) deckt nur `9e22b1b3`; `4c387c00` + `56669352` kommen ins NAECHSTE, Ergebnis also gegen ~22:50.
- **Modell:** der Owner hat heute Abend mehrfach per `/model` gewechselt, zuletzt auf Opus 5. Ich succeede deshalb mit `claude-opus-5[1m]/high` (MODELLPOLITIK-Versuch „Orchestrator auf Opus"). Datensatz und Pane muessen passen: `./ctl.sh ctx` zeigt das Label, `POST /api/slots/:id/model` zieht den Datensatz nach, wenn der Owner wieder wechselt.
- **Program-MAIN Fleet-Betrieb ist nicht mehr Slot 1** — um 20:5x war es Slot 8. Vor jedem `/send` `GET /api/programs` main.slot lesen. Lane-Treiben und Landen bleiben bei ihr.
- **Codex-Kontingent beim Antritt messen** (neue Regel im MAIN-Render, `docs/astra-auftraege.md` §1). 21:3x: 33 % verbraucht bei 35 % verstrichenem Wochenfenster, Reset Sa 19.09. 10:19.

## 1. OFFEN BEIM OWNER (je eine Frage, nicht wiederholen)

1. **Shard-Rollout `528aa37c`:** der Code (`458724c6`) ist gelandet, aber nicht scharf — Second-host-Daemon `96c866e7` meldet keine `features`, `FLEET_AUDIT_SHARDS` fehlt in `.env`, Audits dauern weiter 33–34 min. Die Bedingung „sobald helperClaims leer" tritt nie ein: Audits claimen lueckenlos (20:21, 20:55, 21:29). Vorgeschlagen und am Code geprueft: Second-host `quiet` (`POST /api/helper/devices/secondhostlinux1/mode`) → laufende Jobs enden, der Server faehrt neue Audits nach 60 s lokal (`server.ts#isHelperClaimCandidate`) → bei `running 0` Update queuen → `active` → Heartbeat mit `audit-shard` pruefen → `.env` + `POST /api/deploy` ohne laufendes Audit/Land. Preis ~1 h gebremster Takt. **Antwort des Owners steht aus.** Nicht ohne sie draenieren. Warum nicht einfach dazwischen queuen: der alte Daemon startet das Update neben laufenden Jobs (Update-Job steht zuerst in `server.ts#helperJobsView`, `open.slice(0, free)`), der Neustart toetet sie, ein toter Audit-Claim blockiert bis 45 min (`HELPER_CLAIM_TIMEOUT_MS`).
2. **Freigabe-Richtung `247c2f37`** (Owner: „in der naechsten Session angehen"): Befund, Lesart und Sicherheitsrand stehen in der Zeile. Die Astra-Analyse `d3082219` bereitet die Vorlage vor — erst ernten, dann mit dem Owner reden.
3. **Sol-Test `8e21d437`:** wartet auf „System laeuft richtig"; die Verdrahtungsprobe `4725b5cb` laeuft in Slot 1.

## 2. SCHNITT FUER DIE VEROEFFENTLICHUNG

Owner will die letzten Fixes abwarten, dann ueber die Hauptmaschine (Sonnet-Subagenten) Leaks pruefen und veroeffentlichen. Kriterien: die drei wichtigen Lanes gelandet (erledigt: `5a0aeeb5`, `9e22b1b3`, `4c387c00`+`56669352`), ein gruenes Audit deckt `56669352` (>4 500 ran, 0 failed), Leak-Probe am Commit leer. **Wird das Audit gruen, dem Owner `56669352` als Schnitt nennen.** Leak gefunden und gefixt: `e6ae44fb` (Archiv zitierte die Probe mit Klarname/IP) — der Hub traegt die alte Zeile in der Historie, der Scrub muss Historie abdecken. Paket Runde 5 als Vorlage: `~/claude-fleet-private/publish-r5-2026-09-07/`.

## 3. IN MEINER SCHICHT (19:0x–21:5x)

- Ersatzzeilen fuer ungueltige Karten: `4725b5cb` (Sol-Probe, laeuft), `d3765352` (Orchestrator-Rollenkarte, NACH `e3e5084a` — der ist gelandet), `0bcfee35` (lange Lanes: Kontext als Budget, mit Kandidat F Sub-Agent-Erdung). Attention `06574f9d` beantwortet mit (a) Kopfleiste; gelandet als `bf2821c3`.
- Regelbuch: `succeed` hat eine Lane-Schiene (`server.ts#succeedLane`) — zwei Fragmente korrigiert; Astra-Verweis in `rulebook/einstieg.md`. Render + pins gruen.
- Astra-Lauf 1 (Anleitung `a3094316`, Korrektur `bede7d1e`): `d3082219` Freigabe-Analyse (high) · `9a54f3d4` Sichtung der 12 Zeilen ohne Program · `aa0841f5` Karten-Schaerfer. Eingaben ohne Token unter `~/claude-fleet-private/astra-inputs-2026-09-14/`. **Ernte = deine Arbeit:** Notiz lesen, zwei Belege pruefen, INDEX-Zeile setzen, dann umsetzen (Ersatzzeilen filen, archivieren). Astra schreibt keine Queue.
- Backlog-Befund 20:5x (Startplan): 13 freigegeben und nur durch 3/3 Plaetze + Kollisionen an `server.ts` gehalten, 12 ohne Program, 14 in Leichtgewicht (`manual`), 8 ungueltige Karten, 4 gehalten.
- Direkt-Commits ohne Land-Ledger: `e6ae44fb`, `a3094316`, `bede7d1e` (alle docs, pins gruen).

## 4. UNGEPRUEFT

- Ob Astra-Lanes mit leerem FLAECHE + NEU wirklich ohne Kollision starten (Karten gueltig, Start noch nicht beobachtet).
- Ob die Lane-Kopie des Regelbuchs nach dem 19:4x-Render bei neuen Lanes 20 768 Bytes traegt — an einer Lane gemessen (`fleet-260914171426-69ff`), nicht an allen.

# HANDOFF — Orchestrator Slot 8 → Nachfolgerin (Haupt-Checkout, Owner-Token): S1 Lane-Regelbuch GEBAUT (36 763 → 19 956 Zeichen, Tuer-Probe 0, pins ALL PASS), Sol-Richtung des Owners gefilt + Verdrahtungs-Messzeile, Audit zu 119c1b3e rot mit NEUEM Einzel-Fail; 2026-09-14 19:5x, ctx GEMESSEN 33,2 % (`./ctl.sh ctx`)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Program-MAIN Fleet-Betrieb ist SLOT 1** (ctx 24 %), Politik `card-valid`. Vor jedem `POST /send` `GET /api/programs` main.slot lesen. Rollenschnitt: Lane-Treiben = MAIN; Orchestratorin = Entscheidungspunkte, Filen/Schaerfen, Owner-Session-Arbeit. Nachfolge explizit mit `model: claude-fable-5-1[1m], effort: high` (MODELLPOLITIK: Fable orchestriert; Slot 8 lief so, Datensatz stimmt).
- **`./ctl.sh` benutzen** (`merges` vor jedem Direkt-Commit, `ctx`, `watch`, `events --ack`, `dispatch`). Eine Orchestratorin kann KEINE Attention stellen (409, nicht gebunden) — Owner-Fragen gehen als Kommentar an die Zeile oder in die Antwort.
- **Das Lane-Regelbuch ist seit 19:4x der kleine Render** (`rulebook/` untracked, CLAUDE.md dieses Checkouts neu gerendert, Pin §6b gruen). Laufende Lanes sehen `rulebookDrifted: true` — erwartet. Was gestrichen/verschoben wurde und warum: `docs/messungen/2026-09-14-s1-streichliste.md` §6 (Commit `8f295c56`). MAIN-Tueren (release/watch/succeed, Doc-Kollision) stehen jetzt am ENDE von `rulebook/einstieg.md`; die einstieg-Absaetze „Rueckweg" und der verschobene watch-Block ueberlappen — Zusammenziehen ist S4 (`b3767fc4`), nicht offen fuer dich.

## 0.0 ERSTER AUFTRAG: das Audit-Rot zu `119c1b3e` einordnen (NEUER Fail, kein Repeat)

Audit auf Tip `4348df34` (Cover `119c1b3e`, remote second-host, 2 004 s): 4520 ran / **1 failed: „surface: a new brief re-derives it — the stored sha is an INPUT hash, not a write stamp"**. Die beiden Watch-Fails der zwei Audits davor sind WEG — der Fix `119c1b3e` hat gewirkt. Der neue Fail ist zum ersten Mal da: Regel „zweimal gleiches Rot = Reparatur" greift noch NICHT; erst das naechste Audit (Land von Slot 3/5/7, alle im Gate) entscheidet. Faellt er dort wieder, Reparatur-Zeile per Hand-Dispatch ueber den Deckel (Owner-Memory 2026-09-14). Trail: `docs/e2e-trail.md`; die Sonde: `rg -n 'INPUT hash, not a write stamp' e2e/`. Event `2e647ee9` ist quittiert.

## 0.1 IN FLUG (19:5x) — Lanes gehoeren Slot 1

Sent: `7ed73694` (Slot 5, codex/gpt-5.6-sol, Gate-Kette lief 19:0x), `66df05b4`+`e3e5084a` (Slot 7), `8056f3fe` (Slot 3). Queued: `1b47e29a` (braucht Owner-Attention `06574f9d`: Flaeche a/b/c des „mehr"-Knopfs — OFFEN), `bf6fc2ea`, `3cbbe209`, `5421694d` (Kollisionen). Server auf `458724c6`, 5 Commits hinter (nur `119c1b3e` serverseitig); Deploy = Owner-/MAIN-Akt, erst nach gruenem Audit. Hub 4 Commits hinter (schliesst mit dem naechsten Land).

## 0.2 HEUTE IN MEINER SCHICHT (18:3x–19:5x)

- **S1 gebaut** (Streichliste `43b283d2` vor dem Render, Owner „ok ok ok" + „denk selbst nach", Bau `8f295c56`): Lane-Render 19 956, Tuer-Probe 0, Geschichte-Probe 0, pins ALL PASS. Sieben Abweichungen von der Tabelle mit Grund in §6 — die wichtigste: Suite-Offer-Zahlen 180/800 s MUESSEN im Fragment stehen (Pin). Astra-Baustein R3 = Nachfolge-Schiene; `/api/self/notes` existiert (server.ts ~30066), der Baustein behauptete das Gegenteil. Zeile `f4c2033d` archiviert (erledigt ohne Land).
- **Owner-Richtung Sol** (18:5x, woertlich in `8e21d437`): Worker/Betriebs-MAIN testweise auf Sol, aber erst GEGEN Opus; Verdacht „falsch verdrahtet". Ledger 14 d: Sol killed-empty 5/29 (17 %) vs Opus 5/176 (3 %), vier davon am 05.09. 08:16–08:18 binnen 2 min ohne audit-Spur → Spawn/Zustellung, nicht Modell; Slot 5 heute korrekt (`gpt-5.6-sol high`, `server.ts#CODEX_HARNESS` ok). Messzeile `0d6cb462` (read-only Verdrahtungsprobe, Opus/high) pending im Program — `card-valid` startet sie, wenn die Karte gueltig ist. Der Sol-Test selbst wartet auf „System laeuft richtig".
- Audit-Watch `fbb8aff8` gefeuert (rot, s. 0.0); Event quittiert.

## 0.3 OFFEN BEIM OWNER

1. Attention `06574f9d` (Flaeche „mehr"-Knopf) — ohne Antwort bleibt `1b47e29a` ungebaut. 2. S4-Rollenkarten-Text (`b3767fc4`). 3. Wann „das System richtig laeuft" fuer den Sol-Test (`8e21d437`).

## 0.4 UNGEPRUEFT

- Ob eine NEU gespawnte Lane den 19 956-Render wirklich bekommt (server.ts liest `rulebook/` zur Spawn-Zeit — am Code gelesen, nicht an einer Pane gemessen).
- Ursache der vier Sol-killed-empty vom 05.09. (kein Ledger traegt sie) — Zeile `0d6cb462`.
- 26 `owner_auth_fail` / 85 `self_heal_recreate` in `audit.jsonl` (aus dem Vorgaenger-Handoff, weiter nicht eingeordnet).

# HANDOFF — Orchestrator Slot 4 → Nachfolgerin (Haupt-Checkout, Owner-Token): Backlog 143→90, Engpass server.ts gemessen und gefilet, Freigabe-Politik card-valid gesetzt, Regeln A+B promoviert, S1 mit Owner-Antworten vorbereitet; 2026-09-14 18:0x, ctx GEMESSEN 19,6 % (`./ctl.sh ctx`, vor dem Handoff-Schreiben)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Program-MAIN Fleet-Betrieb ist SLOT 1** (seit ~15:10; Slot 8 war die Vorgaengerin). Vor jedem `POST /send` `GET /api/programs` main.slot lesen — ich habe es einmal falsch gehabt und rechtzeitig gemerkt. Rollenschnitt unveraendert: Lane-Treiben gehoert der MAIN, Orchestratorin = Entscheidungspunkte, Filen/Schaerfen, Owner-Session-Arbeit.
- **Modell dieser Pane:** der Owner hat sie waehrend der Schicht per `/model` auf Fable 5.1 gestellt (Datensatz sagt noch `claude-opus-5[1m]`). Nachfolge explizit mit `model: claude-fable-5-1[1m]` (17 Spawns im Ledger, MODELLPOLITIK: Fable orchestriert) angefordert.
- **`./ctl.sh` benutzen** (`merges` vor jedem Direkt-Commit, `ctx`, `dispatch`, `lock --reap`). Das Regelbuch nennt seit dieser Schicht die Verben statt der Rezepte (Fragmente untracked, kein Commit).
- **Freigabe-Politik Fleet-Betrieb = `card-valid` seit 18:11** (`POST /api/programs/f170dc46…/release {"release":{"v":1,"policy":"card-valid"}}`, Owner-Entscheid ueber Attention `9d10e142`, an mich delegiert). Wirkung sofort gemessen: claude-fleet von 1/3 auf 3/3 Lanes, 18 Zeilen freigegeben, die zwei Buendel-Wellen `7ed73694+1b47e29a` und `66df05b4+e3e5084a` sind als EINE Lane gestartet — die ersten Mehr-Zeilen-Lands seit 7 Tagen (0 von 116 vorher). Rueckfalltuer: `{"release":null}`.
- **Regeln A und B sind promoviert und gerendert** (Attention `9d10e142`, Punkte 2+3; `rulebook/einstieg.md` Kontext-Band-Absatz, `rulebook/lane-discipline.md` Namensmuster-Absatz; Pins ALL PASS 18:0x). A: HANDOFF.md nur bei echter Nachfolge. B: nie eine PID aus Lock/`gate` beenden.

## 0.0 ERSTER AUFTRAG: S1 LANE-REGELBUCH SCHRUMPFEN — MIT DEM OWNER, ANTWORTEN LIEGEN VOR (`f4c2033d`)

Gemessen 17:4x: Lane-Render **36 482 Zeichen** (Ziel < 20 000), Tuer-Probe 6 (Ziel 0), Geschichte-Probe 4, 9 Attic-Verweise. Fragmente der Lane: loader 3 264 · lane-discipline 23 467 · self-scheduling 9 734.
**Owner-Antworten (17:5x, per Auswahl):** (1) AGENTS-Dubletten (~5 200 Z.: Verify-Kette, proportionale Verifikation, Suite-Offer, roter Check, Runner-Regel) STREICHEN, je Thema ein Verweis-Satz auf `AGENTS.md` §. (2) self-scheduling: Owner fragt, ob Context-Packs eleganter waeren als ein achtes Fragment — Antwort unten. (3) Geschichten: Regel bleibt, Geschichte ins Attic mit §-Verweis (bestehendes Muster). (4) Gegenlesen: **Streichliste als Tabelle VOR dem Render** (Absatz · gestrichen/gekuerzt/verschoben · Grund · Zeichen), erst nach Owner-OK rendern.
**Antwort zu (2), am Code geprueft:** Context-Packs (`context-packs.ts`) sind Zeiger (path+anchor) mit Triggern always/verification/landing/task-queue/harness-selection/deployment — keine Rollen-Achse. Die MAIN-Tueren (watch/release/succeed) haben aber schon einen Traeger: `server.ts#RAIL_TAIL` nennt release, watch merge/audit und land woertlich, `docs/self-api.md` traegt die Feldformen. Die Regelbuch-Absaetze dazu sind Dubletten plus drei Host-Lehren (idleSec:0, Budget, 409-Scope-Liste). **Empfehlung:** fuer S1 die MAIN-Absaetze aus `self-scheduling` nach `einstieg` verschieben (kein achtes Fragment, keine Pin-Arithmetik); ob sie spaeter ganz aus dem Regelbuch in Rail/Pack wandern, entscheidet S4 (`b3767fc4`, Rollenkarten). Ein Pack mit Rollen-Trigger waere ein kleiner Code-Schnitt, aber nicht noetig, um S1 zu erfuellen.
**Pflicht beim Bau:** jede Streichung in `docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md` als Schnitt eintragen (Pin „every rule of the meaning probe stands in the fragment its Fragment column names“, 118 Zeilen) — sonst stirbt jedes Land an Stufe 1. Zwei curl-Rezepte (drift, gate) auf `${FLEET_SELF_URL:-…}` kuerzen. Rechnerisch ~18 500 Z. erreichbar. Dazu im selben Zug (DONE von f4c2033d): Astra-Baustein R3 in `docs/astra-briefbaustein-2026-09-07.md` durch Verweis auf die Nachfolge-Schiene ersetzen, `self/notes`-Satz streichen (getrackt ⇒ Commit).

## 0.1 IN FLUG (18:1x) — Lanes gehoeren Slot 1

Sent: `7ed73694`+`1b47e29a` (Buendel), `66df05b4`+`e3e5084a` (Buendel), `8056f3fe`; Slot 3 `1e74ba8b` (Audit-Shards, laeuft seit 14:41, Commit `c3eba7ae`); Slot 7 Land ohne Verdikt. Queued: `bf6fc2ea`, `3cbbe209`, `5421694d` (alle „collides on server.ts“). Gelandet heute durch mich angestossen: `4b2d39bf` (Watch-Idempotenz, Hand-Dispatch nach Regel „zweimal gleiches Audit-Rot“, gelandet ~17:5x).

## 0.2 HEUTE IN MEINER SCHICHT (14:3x–18:1x)

- **Backlog aufgeraeumt:** 143 → 90 offen (52 archiviert mit Beleg, 10 als Kommentar an ihre Auftraege, 5 notiz→auftrag). Tabelle + Korrektur der Archiv-Vorbedingung: `docs/messungen/2026-09-14-backlog-aufraeumen.md` (`13530391`). Volle Zeilen vorher gesichert: `~/claude-fleet-private/tasks-archive-backlog-2026-09-14.jsonl`. `220d9dcd` (tasks-archive.jsonl) bleibt sinnvoll, ist keine Vorbedingung. Ziel <60 nicht erreicht; naechster Hebel: 13 auftrag-`KEEP?` in der Tabelle.
- **Engpass gemessen:** 1/3 Lanes, alle queued „collides with lane 3 on server.ts“ — Lane ohne Ranges blockiert die Datei fuer ihre ganze Laufzeit; Datei-Kollision laut `land-collision-stats` zu 80 % Fehlalarm (P 0.20, n=34), Hunk-Regel P 0.60 ohne verpassten Konflikt. Gefilet `5421694d` (Start-Kollision gegen ECHTE Hunks laufender Lanen, konservativ). Range-Abdeckung 30/65 offene Auftraege; `3cbbe209` hebt sie.
- **Rollen-Synthese:** Owner hat alle 5 Fragen aus §4 wie empfohlen entschieden (Kommentar an `fa07734f`). S2 `8b2baf60`/S3 `fa07734f` haben ungueltige Karten → erst nach `3cbbe209`. S4-Text `b3767fc4` = Owner-Session.
- **Hygiene:** toter Suite-Lock gereapt; geleakter e2e-tmux-Server `fleetprobe877` (12.09.) per Socket beendet; 23 Testinstanzen (810 MB) bewusst belassen.
- Regelbuch: Land-Sensor und ctx-Rezept durch `./ctl.sh merges`/`ctx` ersetzt (E12-Muster `s["ctx"]` erhalten).

## 0.3 OFFEN BEIM OWNER

1. S1-Streichliste gegenlesen (Tabelle kommt von der Nachfolgerin). 2. S4-Rollenkarten-Text. 3. Handoff-Dynamik: Regel A ist promoviert; ob die Orchestratorin an ein Program gebunden wird, bleibt offen.

## 0.4 UNGEPRUEFT

- Ob `card-valid` heute Nacht Zeilen startet, die eine Owner-Klaerung brauchten (Politik startet nur Karten mit Done+Verify+Baumbeleg; `1ed2f6a0` CLARIFY FIRST hat keine gueltige Karte, geprueft 18:1x).
- 26 `owner_auth_fail` ohne Detail und 85 `self_heal_recreate` in 2 Tagen (`audit.jsonl`) — nicht eingeordnet.
- Ob Fable als Nachfolgerin den Effort-Wert `high` annimmt (Spawn-Validierung je Harness).

# HANDOFF — Orchestrator Slot 9 → Nachfolgerin (Haupt-Checkout, Owner-Token): Handoff-Dynamik diagnostiziert, Grok-Antwort 1 + Prompt 3 committet, Grok-Gegenlesen in Zeilen verwandelt (4 auftrag, 3 notiz), Klassen-Register als Router-Vorstufe geschaerft; 2026-09-14 13:1x, ctx GEMESSEN 34,3 % (Server-Praedikat, `/api/sessions`)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Rollenschnitt unveraendert (Owner 2026-09-14 10:4x):** Lane-Treiben gehoert der Program-MAIN Fleet-Betrieb (**Slot 8**, ctx 23 %, weiss die Freigabe-Reihenfolge — Pane-Zitat 12:13). Orchestratorin: Entscheidungspunkte, Filen/Schaerfen, Variantenpaare. **Vor jedem `POST /send` `GET /api/programs` main.slot lesen.**
- **Modell dieser Pane:** der Owner hat sie beim Antritt per `/model` auf Fable 5.1 gestellt und um 13:1x per `/model` zurueck auf **Opus 5** — das letzte Owner-Wort gilt; die Nachfolge wird mit `model: claude-opus-5[1m], effort: high` explizit angefordert, damit Pane und Datensatz zusammenfallen.
- **`ctl.sh` BENUTZEN, nicht Rezepte tippen:** `./ctl.sh merges` (exit 1 = Land in Flug; VOR jedem Direkt-Commit), `./ctl.sh ctx`, `./ctl.sh watch|land|report|events`. Diese Schicht hat alles davon von Hand gerollt, weil das Regelbuch die python/curl-Rezepte lehrt und `ctl.sh` nur einmal nennt. Gefilet: `8c5ecf37` (Verben `send --main`, `commit-main`). **Danach, im Haupt-Checkout (Fragment + Render + Pin):** in `rulebook/einstieg.md` die Rezepte fuer Land-Sensor und ctx durch die Verben ersetzen — Owner-Richtung 13:1x „wiederkehrende Abfragen durch alle Schichten mechanisch".
- **Handoff-Dynamik — Diagnose steht, Entscheid beim Owner (§0.3).** Die Orchestratorin MUSS HANDOFF committen (`server.ts#handleSelfSucceed`, ungebunden ⇒ `handoffCommittedAfterOpen`-Gate); die MAIN muss nicht, tut es aber, weil NACH-Reihenfolge, Rollout-Pflichten und Deploy-Stopp keine typisierte Heimat haben (Commit-Body `c104cfd3`), und weil `rulebook/einstieg.md:14` + `server.ts:23755` dazu einladen. 100 HANDOFF-Commits in 7 Tagen. Vorschlag an den Owner: MAIN schreibt nie HANDOFF (Rest als `betrieb`-Zeilen), Orchestrator→MAIN nur `POST /send`/Zeile, Orchestratorin entweder einzige Schreiberin oder an ein Program gebunden.
- **Grok-Antwort 1 liegt jetzt WOERTLICH in `docs/messungen/2026-09-14-grok-antworten-spiele-astra.md`** (`96ee589b`), mit drei `<!-- LUECKE -->`-Markern (Anfang; ein Satz §1; Uebergang §5→Empfehlung 1). Der Board-Editor war NIE defekt: Hash-Gate + Audit-Ledger (`file_write` 24 732 → 42 953 B) bewiesen, dass viermal Antwort 2 in der Zwischenablage lag. Eine Vollfassung ueber den Editor ersetzt den Block; Datei vorher NEU oeffnen (Hash).
- **Prompt 3 (Astra effektiv einsetzen) steht in `docs/messungen/2026-09-14-grok-fragen-spiele-astra.md`** (`b23ff3b8`) — Antwort kommt vom Owner; Kennzeichen: Tabelle Einstellung|Wirkung|Quelle zu config.toml/Effort.

## 0.0 ERSTER AUFTRAG DER NACHFOLGERIN: BACKLOG AUFRAEUMEN (Owner 13:4x „wann schaffen wir es, den Backlog mal richtig aufzuraeumen?")

Gemessen 13:4x (`fleet.json`): **142 offen von 200** (`server.ts#MAX_TASKS`; der Deckel verdraengt nur terminale Zeilen — es sind noch 58 done/archived da, die Historie wird vom Backlog aufgefressen). Offen: auftrag 64 (pending 56, queued 5, sent 3; Karte gueltig 25, mit Luecken 39) · **notiz 71** (davon 19 ≥7 d; der Notiz-Kanal schliesst nichts — Queue-Intelligenz §5 E5: 3 von 69) · richtung 6 · betrieb 1. Programlos: 30. Program-Verteilung: Fleet-Betrieb 69, Leichtgewicht 24, Private-repo-j 18, eine Zeile an einem `complete`-Program.
Regeln (Owner-Memory „Operatives selbst erledigen" + „Owner raus aus der Bewertungsschleife": pruefbare Sicherheitsbedingung, reversibel, kein Owner-Schritt): Archiv ist `POST /api/tasks/:id/archive`, rueckholbar per `/unarchive` (`server.ts`, grep `taskAct[2] === "archive"`).
1. **notiz (71):** je Zeile genau eine Disposition — (a) als Kommentar an die auftrag-Zeile, die sie betrifft, dann archivieren · (b) in auftrag mit Karte konvertieren (nur mit hartem DONE) · (c) archivieren mit Grund `ueberholt: <sha|Zeile>` oder `ohne Adressat ≥7 d`.
2. **auftrag (64):** gegen `git log --since=14.days` pruefen, ob gelandet/ueberholt → archivieren mit Sha; `NACHFOLGE:*`/`UMGEHAENGT`-Paare auf Dubletten; Zeile am `complete`-Program umhaengen oder archivieren; Kartenluecken nicht einzeln flicken (`3cbbe209` repariert den Validator).
3. **richtung (6):** NICHT archivieren — Owner-Richtung; nur im Bericht auflisten.
4. **programlos (30):** einem aktiven Program zuordnen oder archivieren.
**VORBEDINGUNG — ARCHIVIEREN IST HEUTE LOESCHEN MIT VERZOEGERUNG (Owner 13:5x „Archivierung und weitere Nutzung gut durchdenken", am Code geprueft):** `server.ts#capTasks` verdraengt bei >200 Zeilen die TERMINALEN (done/archived) — ersatzlos; kein Ledger haelt die Zeile (rg nach tasks-/archive-jsonl: nichts; `dispositions.jsonl` hat 2 Zeilen und ist etwas anderes). Bei 142 offenen bleiben 58 terminale Plaetze: 80 Archivierungen wuerden sofort aeltere done-Zeilen samt Text, Karte, Brief, Kommentaren LOESCHEN, und `unarchive` kaeme an archivierte Zeilen nur, bis sie verdraengt sind. Was dabei kaputtginge, ist genau die geplante Nutzung: `fa07734f` (4) klassifiziert rueckwirkend aus dem Zeilentext, `land-quality` joint Land→Zeile, E5-Worktrail liest die Queue-Historie, die Dispositionen selbst sind die Evidenz fuer `nennt[]`-Listen und fuer `b28b9d89`. **Also ZUERST eine kleine Zeile, DANN aufraeumen:** `tasks-archive.jsonl` (gitignored, append-only wie die anderen Ledger) bekommt die VOLLE Zeile beim Uebergang in einen terminalen Status und bei der Verdraengung, dazu `disposition{grund, beleg, by, at}`; `fleet.json` bleibt reiner Live-Zustand; `unarchive` liest aus dem Ledger, wenn die Zeile verdraengt ist; `register.sh` bekommt `--archived <muster>` fuer die „haben wir das schon?"-Frage (lexikalisch, kein RAG — Grok-RAG-Antwort). Checks: Verdraengung schreibt die Zeile vor dem Drop; unarchive nach Verdraengung stellt sie wieder her. Klein, Program Fleet-Betrieb, NICHT vor dieser Zeile archivieren.

Weg: EINE read-only Lane (claude/opus/high, Scratchpad-Tabelle `id | kind | Disposition | Beleg`), die Orchestratorin wendet die Tabelle in einem Zug an und legt sie als Mess-Notiz ab (`docs/messungen/2026-09-14-backlog-aufraeumen.md`). Ziel: <60 offene Zeilen, notiz <15. Richtung/Schnitt fuer „waechst nicht wieder": die Notiz braucht einen Schliessweg (E5-Befund) — als Zeile NACH dem Aufraeumen, nicht davor. **Zusammenhang:** `b28b9d89` (Program-gebundene kurzlebige Context-Packs, CLARIFY FIRST, Owner 13:5x) ist der zweite Teil desselben Befunds — viele Notizen sind Buendel-Wissen ohne Traeger. Beim Aufraeumen Disposition (d) mitzaehlen: „waere ein Program-Pack-Zeiger" (Anzahl in die Mess-Notiz), das ist die Evidenz fuer die Clarify.

## 0.1 IN FLUG (13:1x) — alles bei Slot 8

| Slot | Zeile | Was |
|---|---|---|
| 1 | `c3837cab` | Phasen je Trail-Zeile; Commit `b5a12b8e`; hat um 12:39 drei Gegenlese-Punkte von mir (50-ms-Toleranz, Mega-check teilen, Zeitstrahl-Tabelle) — im Report pruefen, ob eingearbeitet |
| 4 | `de754f94` | Suite: Core-Unit teilen |
| 5 | `71ee4882` | Reparatur des Audit-Rots (jetzt VIERMAL identisch: `bb546bf2`, `754c37ed`, `0c3bd4a0`, `2836fe97`, je 1 Fail); Commit `c8fd392d`, Beweislauf wartete hinter dem Mutex |

**DEPLOY (Owner 13:5x „ein Deploy waere langsam bestimmt auch ganz gut"):** Server auf `ba557b75`, ~40 Commits hinter HEAD. Blockiert war er durch das viermal identische Audit-Rot; die Reparatur `71ee4882` (Slot 5) war um 13:46 IM LAND. Weg, sobald ihr Land `merged` ist: Slot 8 (dem der Deploy gehoert) einmal mit dem Owner-Wunsch anstossen — `POST /api/deploy` (verweigert 409, solange ein Post-Land-Audit laeuft; dann auf `./ctl.sh watch audit <sha>` warten, nicht pollen), danach `bundleStale` auf `/api/sessions` und `deploys.jsonl`-Verdikt pruefen (`ok:null` ist KEIN Pass). Vorher die Programs fragen, deren Beleg an einem Idle-Fenster haengt (Deploy setzt die Idle-Uhr jeder Pane auf null). **Was der Deploy live macht (39 Commits, sechs serverseitig, 14:1x gelesen):** `bb546bf2` Karten-Vertrag + `FLEET_CARD_MODEL=sonnet` aus `.env` (heute NICHT live, config-Sensor ohne `live=`) · `92714664` Report-Ledger (bis dahin werden Reports bei 20 gepruned: 126 von 138 in 14 d) · `24a04501` Transkript-Tail max 1 MiB statt ganzer Datei (groesstes 29,6 MB) · `f8804bb1` Release-Politik card-valid/all je Program (danach `POST /api/programs/:id/release` setzbar) · `4a905807` Merge-Verdikt folgt der MAIN ueber `succeed` · `58c10f75` Server-Lock-Marker gegen Fremd-Kill · Client `751828fa` (`bundleStale:true`).

Gelandet seit `d5b29be6`: `bc974919` (E1c Karten-A/B, Notiz `517d869c`), `8dc26d58` (Client „▣ main", `751828fa`). Queued: `bf6fc2ea`, `f4d81b09`, `d71c7549`, `8056f3fe`, `3cbbe209` (neu, Karten-Validator-Luecken aus der A/B — von der MAIN gefilet). **Deploy: NICHT geschehen**, Server auf `ba557b75`, 36 Commits hinter HEAD, blockiert bis das Rot repariert ist (`71ee4882`).

## 0.2 HEUTE IN MEINER SCHICHT (12:1x–13:1x)

- **Grok-Code-Review von `b5a12b8e` gegen den Commit geprueft:** 3/5 Punkte halten (Toleranz, Mega-check, fehlende Tabelle), `results.length > 500` war ueberholt, einer Geschmack. Daraus `a93aa054` (AGENTS.md `## How a check is written` + `verify-e2e`-Pack, klein).
- **Grok-Antwort 1 in Zeilen verwandelt, jede am Baum geprueft:** `e8a5baab` (read-only `erdung`-Agent als TOML; Befund: `~/.codex/config.toml` ohne `[agents]`, 10 globale Agent-TOMLs ohne `sandbox_mode`, kein repo-lokales `.codex/agents/`, AGENTS.md ohne Delegationsregel — Schritt 1 ist die Harness-Probe, ob 0.153.4 repo-lokal laedt) · `ee865782` (Report traegt `outsideSurface`, gegen `files ∪ creates`, kein Gate) · Notiz `c52354d9` (drei Brief-Saetze an `8b2baf60`) · Notiz `13d65ef9` (Pilot A/B/C an Program `9ce08219`, nur Preflight-Vorlage).
- **Owner-Frage „Schwierigkeitsstufen → Modellzuordnung":** gemessen: 0/141 offene Zeilen mit Modell-Feld, `size` auf 31/141 (Wellen-Gewicht, keine Schwierigkeit), land-quality je Modell konfundiert (ohne Eingangs-Achse), kein Usage-Sensor. Antwort = **`fa07734f` geschaerft** (Register = Aufloesung Klasse→Tripel, `alternativen[].qualifiziert` mit Evidenzpflicht — „Fable als Worker" ist dort `OFFEN n=12`; Klasse deterministisch aus `KLASSE:`/`nennt[]`, KEIN Modell-Guess (Kartenregel 3); land-quality je Klasse, `unklassifiziert` als Sensor; kein Usage-Feld ohne Sensor). Dazu Angleichungen per Brief-Route: `e8a5baab` (Schritt 3 gestrichen — AGENTS.md §2d gehoert der Owner-Session), `ee865782` (`creates`), `21ade485` (E3-Sperre gefallen; Ausgabe als Registerfelder), `1ed2f6a0` (Varianten = `alternativen`, Evidenz fuer `qualifiziert`), `d02fd2bd` (ein Schreiber je Feld; Modell = `urteil`-Klasse). `8b2baf60`/`a93aa054` unveraendert. Alle sechs Briefe tragen `by: owner` (Semantik der Tuer; geschrieben von Slot 9).
- Slot 8 einmal gebuendelt informiert (12:47) ueber `a93aa054`, `e8a5baab`, `ee865782`, `c52354d9`; die Brief-Schaerfungen von 13:0x sind ihm NICHT gemeldet — die Zeilen sind pending, er liest sie beim Release.

## 0.3 OFFEN BEIM OWNER

1. **Handoff-Dynamik:** eine Schreiberin (Orchestrator) vs. Program-Bindung fuer den Orchestrator; MAIN-Rest als `betrieb`-Zeilen. Kein Schnitt gefilet — Owner-Entscheid steht aus.
2. Grok-Antwort 1 Vollfassung (Luecken) · Prompt 3 an Grok.
3. Rollen-Session S1/S4 (unveraendert).

## 0.4 UNGEPRUEFT

- Ob Slot 1 die drei Gegenlese-Punkte einarbeitet (Send `eeabba0c`, acceptance observed; kein Watch gesetzt — Lanes gehoeren Slot 8).
- Ob das vierte Audit-Rot auf `2836fe97` dieselbe Signatur hat wie die drei davor (nicht gelesen; die Reparatur-Lane laeuft ohnehin).
- Kontingent-Sensoren (Claude Code `/usage`, Codex) — nie geprobt; Voraussetzung fuer jede Usage-Schicht im Router.

# HANDOFF — Orchestrator Slot 7 → Nachfolgerin (Haupt-Checkout, Owner-Token): Variantenpaar entschieden und gelandet, Suite schneller + Pruefapparatur als zehn Zeilen mit Freigabe-Reihenfolge bei der Program-MAIN, Astra-Befunde verarbeitet, Brief-Gegenlese und Owner-Entscheid-Schicht gefilet; 2026-09-14 12:1x, ctx GEMESSEN 35 % (Pane-Fusszeile; der Slot-Datensatz meldet null, er steht noch auf Fable, die Pane lief nach Owner-/model auf Opus 5)

## 0. WAS BEIM ANTRITT SOFORT GILT

- **Rollenschnitt (Owner 2026-09-14 10:4x):** Lane-Treiben (done-looking → landen → schliessen, Freigaben nach NACH) gehoert der **Program-MAIN Fleet-Betrieb, heute Slot 8** (um 11:59 von Slot 5 nachgefolgt). Bei der Orchestratorin bleiben Entscheidungspunkte: Variantenpaare (E4), Brief-Abgleich bei Abweichung vom DONE, Filen/Schaerfen. Keine Land-Nachricht je Lane.
- **Regel an die MAIN gegeben (Owner 12:0x):** dasselbe Fail in zwei aufeinanderfolgenden Audits = echter Befund; Reparatur-Zeile sofort per Hand-Dispatch, auch ueber den Deckel; ein Urteil ist keine Vorbedingung.
- **Vor jedem `POST /send` den Ziel-Slot unmittelbar vorher aus `GET /api/programs` (main.slot) lesen.** Heute 12:08 traf mein /send an „Slot 5" die dort gerade spawnende Reparatur-Lane und toetete sie (Zeile requeued, nichts verloren; Befund als `bf6fc2ea`).
- **Kontext/Lane-Zeit sind KEIN Vergleichssignal** (Owner-Korrektur, Memory `feedback-codex-ctx-is-not-succession-pressure`, dritter Vorfall).
- **Grok-Antwort 1 (Astra-Orchestrierung) fehlt weiter.** Der dritte Paste um 09:3x war wieder byte-identisch mit Antwort 2; die Datei steht auf dem committeten Platzhalter. Erkennung: die richtige Antwort beginnt mit Sub-Agent-Threads vs. Worktree-Sessions, nicht mit „Etablierte Wege 2026".

## 0.1 IN FLUG (12:1x)

| Slot | Zeile | Was |
|---|---|---|
| 1 | `bc974919` | E1c Karten-A/B Haiku vs Sonnet (Mess-Notiz) |
| 3 | `8dc26d58` | Client zeigt source main als owner (Astra-Befund 9) |
| 4 | `de754f94` | Suite: Core-Unit teilen |
| 5 | `71ee4882` | Reparatur „clarification identical retry" (3 Audits rot: bb546bf2, 754c37ed, 0c3bd4a0), per Hand-Dispatch ueber Deckel |
| 8 | — | Program-MAIN Fleet-Betrieb (ctx 19 %) |

Queued: `c3837cab` (Phasen je Trail-Zeile, Messung). Pending mit Reihenfolge bei Slot 8 (ging um 11:2x an Slot 5, gleiche Zeilen): `a2356a5e` Gate-Integritaet (NACH de754f94; watchdog.sh ⇒ kickstart + rulebook-Render) · `1e74ba8b` Audit als parallele Shard-Jobs (NACH de754f94; landet inert, Rollout FLEET_AUDIT_SHARDS='3') · `35654b07` Mutex birth + curl-Deadlines (NACH de754f94, a2356a5e) · `d71c7549` Ledger-Reader null · `8056f3fe` zwei schwache Sonden · `aa819dd4` warmer Helper-Baum (NACH 1e74ba8b). Aus `c3837cab` kommen bis zu drei Kuerzungs-Zeilen (Sleeps) — die filet die MAIN.

Neu gefilet, pending, noch NICHT an Slot 8 gemeldet: `bf6fc2ea` /send in spawnenden Slot (klein, Befund oben) · `d02fd2bd` Brief-Gegenlese als Messversuch (Schalter default aus, jede zweite Zeile, Abbruch nach 20 Paaren ohne Effekt) · `8bc86e4b` Denkauftrag Owner-Entscheid-Schicht, Program Astra f9dc8e10, codex/gpt-6-astra/medium.

## 0.2 HEUTE IN MEINER SCHICHT

- **Variantenpaar 1 entschieden:** Opus-Variante von `land-quality.ts` gelandet (db8186f4 + Repo-Map-Fix 81a85c08), codex shelved (Branch `fleet/260914071334-201a` bleibt). Nur die Zahl im DONE trennte; Stufe 2/3 haetten die schwaechere Variante gewaehlt. Notiz `docs/messungen/2026-09-14-variantenpaar-1.md` (71411734, 82c907db).
- Gelandet ausserdem: E1a Karten-Vertrag (bb546bf2), E2/E3 Report-Ledger + Receipt (3bd9821e), E3 Quellpaket-Wirkung (754c37ed: Quellpaket kauft nichts messbar, Karte korreliert mit 8–9 statt 18–20 Bash-Aufrufen), Astra-Befundnotiz Pruefapparatur (3a1c952a), Security-Suite-Fix 1a5d3f2d (2836fe97).
- **Audit-Rueckstau gemessen:** Second-host-Audits strikt seriell (~32 min), Land→Urteil 75–100 min; maxParallelSuites 3 begrenzt nur Previews; Second-host 16 Kerne Load ~1, RAM die Grenze (Suite ~330 MB). Server und Daemon kennen keine Shards ⇒ `1e74ba8b`.
- **Suite-Zeit:** 217 Checks mit 3–10 s Abstand = 1 070 s von 2 122 s; Git-Tick-Hypothese widerlegt (Git-Checks warten nicht laenger). ⇒ erst messen (`c3837cab`).
- Worktrail-Lauf `6067c240` um Pflichtteil (5) Memory-Durchsicht (portabel/privat/veraltet mit Vorfallszahl) und (6) Zuordnung programloser Zeilen erweitert.
- Memory: `feedback-codex-ctx-is-not-succession-pressure` um den dritten Vorfall ergaenzt.

## 0.3 BEFUNDE, DIE STEHEN

- Zwischen Filen und Ausfuehren prueft niemand den Inhalt: Karte = Form, refine lief auf 0/200 Zeilen, Analyst entfernt. Heutige Belege stehen in `d02fd2bd`.
- Startplan liest zitierte Pfade im Text als Flaeche (Schein-Kollision) — bis der deployte Karten-Vertrag `creates` traegt, beim Filen nur Aenderungsziele als Pfad nennen.
- Second-host: vier interaktive claude-Sessions des Owners (~1,4 GB) — Owner kuemmert sich, nicht anfassen.

## 0.4 OFFEN BEIM OWNER

1. Grok-Antwort 1 einfuegen. 2. Rollen-Session S1/S4 (unveraendert). 3. Second-host-Sessions (er macht es).

## 0.5 UNGEPRUEFT

- Ob Slot 8 die Freigabe-Reihenfolge der zehn Zeilen kennt: sie ging an Slot 5 vor dessen Nachfolge; Slot 8 bekam um 12:1x nur den Verweis auf diesen HANDOFF.
- Deploy-Stand: Slot 5 wollte nach gruenem Rerun deployen; das Rot kam dreimal — ob deployt wurde, nicht geprueft.
