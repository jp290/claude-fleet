# Queue-Bereinigung 2026-09-11 — Register aller 194 offenen Zeilen, Urteile mit Beleg

Stand: HEAD `7627fbad`, Queue aus `fleet.json` gelesen 2026-09-11 ~02:2x. Ausgeführt von der Fable-Session
Slot 8 (Nachfolgerin von fableBack Slot 7) auf Owner-Wort „die veralteten Einträge im Task-Backlog sind
jetzt als erstes dran". Die Urteile stammen aus sechs parallelen Opus-5-Lesungen am Baum (kein API-Call,
keine Suite); ich habe sie gegen Astras Dispositionsstand (Controller Slot 10, Pane-Antwort 2026-09-11)
gelegt. **Dieses Dokument ist das dauerhafte Gegenstück zur Archivierung**: `capTasks` darf archivierte
Zeilen irgendwann verwerfen, der Text hier bleibt.

Vokabular: GELANDET = die verlangte Arbeit liegt auf main · ÜBERHOLT = Gegenstand weg oder durch
Owner-Entscheid/Nachfolgezeile ersetzt · LEBENDIG = offen und sinnvoll · GEPARKT = Program auf Eis ·
UMGESETZT/GESICHERT = Befund im Code bzw. in einem Doc · OFFEN-BEFUND/OFFEN-IDEE = weiterhin Material.

## 0. Ausgangslage (gemessen)

| Menge | Zahl |
|---|---|
| offene Zeilen | 194 (auftrag 41 · betrieb 4 · notiz 141 · richtung 8) |
| davon in COMPLETE Programs (e3b3a064, eec69528, b2a14b54, b9c1e0d9) | 46 |
| davon ohne Program | 75 (auftrag 9, betrieb 1, notiz 61, richtung 4) |
| aktive Programs | f170dc46 Fleet-Betrieb (MAIN Slot 3) · 233e1c2b Land-Pipeline (Slot 11) · 9ce08219 Private-repo-j (auf Eis) · f9dc8e10 Leichtgewicht (Astra Slot 10) |

Astras Plan-Kern (Pane-Antwort, keine Aktion): f9dc8e10 setzt die P2-Feldschnitte fort (criterion →
refine; unabhängig files, filesProposal, capTasks); f170dc46 schließt die Lebenszyklus-Rückwege
(18e87e67, c62aa3e9, 3ea89f71, 288f6359, 66df05b4); 233e1c2b hat nur noch Restpflichten (59ffeda0,
800c965b) und eine Abschlussfrage; Private-repo-j bleibt auf Eis. Warnung Astra: „COMPLETE-Program allein
beweist keinen entfallenen Leser" — deshalb je Zeile ein Beleg.

## 1. Aufträge und Betriebszeilen (45)

### 1a. Erledigt oder überholt → geschlossen

| id | kind | Program | Urteil | Beleg |
|---|---|---|---|---|
| 0e069d4c | auftrag | – (steward-brief) | GELANDET → done | `eb07267e` „record local audit failure names", server.ts#localFailNames |
| 4872457b | betrieb | f170dc46 | GELANDET → done | beide übergebenen Lanes auf main: `5eaf0955`, `ac48155a`; Slot 3 meldet „discharged in substance" |
| cb0dc4e7 | betrieb | f9dc8e10 | GELANDET → done | `24cd54e3`, server.ts#briefAndSend reicht `cluster`, e2e/tasks.ts d5-order/d5-cluster |
| 8e1e0be4 | auftrag | f170dc46 | ÜBERHOLT → archiviert | Ziel „Handoff am Program statt git" via `b11a1a1c` + `captureProgramHandover` erreicht; die verlangte Fläche `POST /api/self/handoff` wird nicht mehr gebraucht |
| 6788efc6 | auftrag | f9dc8e10 | ÜBERHOLT → archiviert | `~/private-repo-j/kritik/` existiert nicht; Private-repo-j durch Private-repo-j-Neustart ersetzt (`c95194d`), Pack `437132577c84-20260903-214440` liegt noch auf Platte |
| 7de5bb6a | betrieb | – | ÜBERHOLT → archiviert | Nachtfenster endete 2026-09-08 02:00 UTC; Spur B gelandet (`ebf42e0e`, `42692a0a`, `7d21a841`) |

### 1b. Lebendig (bleiben pending)

**f9dc8e10 (Astra, P2-Reihenfolge):** df50b95b criterion · 666d0b67 refine (freigabereif, analysis liegt) ·
f547e2f0 files (UI-Schnitt, src/client.ts:8318 hängt an `fprop`) · e0c1ba07 filesProposal
(`SELF_TASK_FIELDS` server.ts:8378 ohne `files`) · cf0d3cd4 capTasks-Nullbudget (`slice(-0)`,
server.ts:2178) · f6db3487 Betriebsnachweis (blockiert bis f547e2f0) · 60fff186 `from`-Feld ·
60257e41 Program-Prosa-Zensus (klein) · a17a630b Controller-Sicht (read-only) · 9940ec64
program-phase ohne Report-Fakten · a05fa7ff Critic-Liveness (Besteller unklar) · 531bab26 → 67abe12c
(Kette: `until()` fehlt in e2e/harness.ts, Modulfilter fehlt) · db756205 Q6-Sonden (Stopplinie offen) ·
04a1f158 Prozess-Doku (Punkt 1 ist seit `ac48155a` tot, Doc fehlt) · **04f55eba C5-Zielprojektion:
das Write-Set liegt (`docs/messungen/2026-09-07-c5-zielprojektion-gegenfaelle.md`, `b640915e`) — Astra
führt es als Untersuchungsbedarf; nicht geschlossen, Astra entscheidet.**

**f170dc46 (Betriebs-MAIN):** 18e87e67 abgelehnte Lane erfährt Ablehnung nicht (server.ts#decideFleetReport
quittiert nur das eigene Event) · c62aa3e9 adressierter Rückweg MAIN↔Controller · 3ea89f71 Brief-Schärfung
ohne Owner-Aussage (`TaskBrief` kennt keinen dritten Autor) · 288f6359 audit-red Inbox-Writer (kind
reserviert, Writer fehlt) · 66df05b4 Codex-Session-ID-Ack (server.ts:7183 verlangt exakte Gleichheit) ·
201d0240 Harness-Prüfung hinter beiden Deckeln (server.ts:9644/9666/9681) · 1832c7eb Program-Lane-Deckel
nie gesetzt (watchdog.sh) · 7ed73694 Program-Blick Client (Server-S2 liegt, `executionStatus` im Client
0 Treffer) · ee47b0f8 `paneModel`-Sensor (0 Treffer).

**ohne Program:** 02131402 Helfer-Portal vierter Arm (server.ts#helperClaimBar) · e1ce58fd Steward-ctx
(kein Steward läuft) · fa1112eb Steward-Merge-View liest `mergeLast` (gleicher Wurzelbefund wie e9c47a54,
mit dem zusammen erledigen) · e9c47a54 Merge-Zustandsfläche (server.ts:19402 `interrupted` vor dem ersten
await; ctl.sh:658 ohne Recycling-Guard) · 3f7363bf Prüfapparatur deterministisch (Hebel-Rangliste liegt in
`docs/messungen/2026-09-04-flake-ranking-trail.md`, b/c/d fehlen) · 21ade485 Modellklassen-Profile
(Denkauftrag) · c269023d Provider-Profile (Denkauftrag) · 9fe80661 README-Neuschnitt · d2e4f219
Suite-Offer-Wartebudget 800 s < Remote-Minimum 597 s+ (Program b2a14b54 complete → braucht Träger).

**9ce08219 Private-repo-j (GEPARKT, nicht angefasst):** 32fed872 und 0610f3a5 sind am Biber-Repo
faktisch überholt (`GAME-CARD.md` existiert nirgends, 39 Commits Spielbau seit `c95194d`;
M1-Quellenkorrektur `41bd398a` liegt auf einer Lane-Branch), ad3b3960 und e80466c9 warten auf das
Mandat, 6e7de1eb (Cross-Model-Review) hat nie stattgefunden. **Owner-Entscheid nötig, ob das Program
mit diesen fünf Zeilen weiter „auf Eis" liegt oder geschlossen wird.**

## 2. Notizen und Richtungen in COMPLETE Programs (46)

### 2a. Archiviert (31)

| id | Grund |
|---|---|
| 0ac22a00 | Code `c7184f85`: `POSTLAND_AUDIT_WAIT_MS` trennt Warte- von Arbeitsbudget |
| 789d9034 | Code `2dfaa814`: killedGate nimmt waitedOut/timedOut aus |
| be20f4b4 | Code `d32b69d2`: Watch-Dedupe verlangt `armed` |
| c3bf1e7c | Vorschlag (a) am lebenden System widerlegt (`47610207`), (b) durch 409-Text beantwortet |
| f9db018e, abb81258 | Code `52673b64`: `ranIsLowerBound` |
| c7a5e061 | exakt die Fassung, die `d32b69d2` gelandet hat |
| 2d0e73fa | Doc docs/verify-tiering.md §11.2l |
| e48ab251 | Code `2dfaa814` mit dem Done-Kriterium der Zeile |
| 0dfff4b1, e45751a5 | Konversation erfüllt (Beratung + Zeilennummer-Korrektur an Controller Slot 10) |
| b1d4f2d5 | Brief-Nachtrag vor Dispatch 746513d1, Program abgeschlossen |
| e7e356e9 | Doc docs/messungen/2026-09-08-astra-s3-inbox-report-contract-security.md; Schnitte leben als 18e87e67/c62aa3e9/288f6359 |
| a3878547 | sechs Rückgabepunkte über 1d0f4ca4/56e4427d abgearbeitet |
| 4ec2cb84 | Doc docs/messungen/2026-09-06-plan-luecken-register.md |
| 4fc45ae2, 4d38bb22, 82ae9cc4 | Vollzug gemeldet (Commit `4bc1ee9d`), Empfängerin nennt sie schließbar |
| b78d31b7 | Mandat „bis Astra-Reset ~12 h"; drei Artefakte liegen auf main |
| 16018401, 615513af, 81147563 | Receipts/Nachträge, „keine Antwort nötig" |
| 3f1cec58 | Doc docs/messungen/2026-09-08-48h-vorschau-zielprojektion.md |
| 02290721 | Doc docs/messungen/2026-09-07-datenvertraege-umsetzungsplan.md; C0 als cf0d3cd4 neu gefilet |
| 365f213b, 506fdce6 | beantwortet (506fdce6; 21ade485 lebt eigenständig) |
| fafc4320 | ersetzt durch eec64457 → heute 04f55eba |
| f3f9aafc | Zuordnungskorrektur, beide Gegenstände terminal |
| b6b973f2 | Doc c5-zielprojektion-gegenfaelle (gleicher Land-SHA, gleiche Join-Regel) |
| b6e498c7 | „kann nach Kenntnisnahme geschlossen werden" |
| b19d23b7 | Code `42b92af7`: rejectedReportForLand als Guard (11) |

### 2b. Behalten — brauchen einen neuen Träger (15, bleiben pending, NICHT umgehängt)

| id | Träger | Was offen ist |
|---|---|---|
| e229aa2f | f170dc46 / 233e1c2b | zwei Owner-Entscheide 09-07 ungebaut: Deploy-Preflight 409 bei schmutzigem Tree; undo-land-Rückspiegelung `--force-with-lease` |
| bf3dd138 | f170dc46 | F2–F5 nie disponiert; F4 (capPrograms wirft complete Programs samt offener Tasks weg, server.ts:1639) ist die Ursache dieser Triage |
| e4a001b0, (07ef9694) | f170dc46 | `CLAUDE_HARNESS` ohne `readiness` — Trust-Screen frisst Gründungsbrief |
| f0c28e8f | f170dc46 | Gate-Rot aus CLAUDE.md/rulebook (SOURCE_DIR, e2e/pins.ts:3382) sperrt die Self-Land-Tür der Lane dauerhaft |
| d2e4f219 | f170dc46 | Suite-Offer-Wartebudget 800 s unter Remote-Minimum |
| 606cfbeb | f170dc46 | Owner-Zielbild 09-05 (Auto-Modus, Modellwahl je Aufgabenart, Usage-Panel) hat kein Doc |
| c52c49f9 | f9dc8e10 | vier von fünf Punkten der Owner-Architekturrichtung nirgends verstetigt |
| 6f90781c, 7b6c997e | f170dc46 | Cross-Host-Dispatch (Lanes auf dem Second-host) — Owner-Zielsatz ohne Träger seit cd110019 complete; Startbrief nie ausgeführt |
| 563ec115 | f170dc46 | program-phase#R9 nennt die Land-Tür nach rotem Verdikt, das die Route mit 409 abweist |
| 04fdfc77 | f170dc46 | §11.2n unrepariert: e2e/lane-helpers.ts#settleForMerge fällt still durch |
| 6d2a4d4b | f170dc46 | kein Pin vergleicht den EFFEKTIVEN Repo-Verify-Befehl mit der Kette |
| 99c9458f | f170dc46 | gpt-6-astra-Provider-Sperre auf „adversarial + Merge/Deploy-Code" in keinem Doc |
| 8b0114e1, (c90ea457) | f170dc46 | kein `{kind:"main"}`-Watch |
| 18a14e37, (11bc0a1c) | f170dc46 | `GET /api/post-land-audits` ohne `?mainSha=` |

## 3. Notizen und Richtungen ohne Program (65)

### 3a. Archiviert (28)

UMGESETZT: 945038e2, 1018ea26, d43455df (alle `2f442a46`, Gründungs-Readiness) · 9c429719
(`composerArrival`) · a28e82cb (`1e5419ce` deployBlocker nennt Merge) · 6d156308 (`93e54601`) · 051cb897
(`52673b64`) · 629e8b2d (`40ee5965`+`be2dbeb6`+`0ec5f149`) · 1ac30f1e (watchdog.sh Audit-Timeout 75 min) ·
3ad9e850, d018d52d (`f8babcdb` Fail-Namen) · 50bd17e9 (`a0b3b405` selfLand-Promotion) · ada76ad9
(`2f442a46` Binding (id, openedAt)) · 2ad90d28 (`ebf42e0e` Attention → Program-Inbox).
GESICHERT: deb0de66 (CLAUDE.md §Deploy) · bd7c7b8d (verify-tiering §11.2b/§11.2u) · 1a7dd56e
(rulebook/loader.md) · dfc1506a (queue-wellen-2026-09-06.md) · 0544306f (fleet-hub-overlay-2026-09-06.md,
die vier Owner-Fragen §5 bleiben dort).
ÜBERHOLT: 641897ec, 0431a588, ec5d6cf0 (durch 529e5914 widerlegt) · 51753e67 (Owner 09-09: kein
Auto-Compact) · 970238ad (`3863b29a`) · 06166516, 33ead5ea, 2f0d7811, 70632fba (Tagesoperativa 09-07,
Adressaten retiret, Züge gefahren).

### 3b. Bleiben pending — Material für Aufträge (37)

**OFFEN-BEFUND (14):** 1d05c49b Auto-Close ohne `removeWorktreeSafe` (server.ts:11351) · 07ef9694
claude-Readiness · 1410a078 + 9ec887d1 Audit-Ping ohne Zuständigkeit/Repo-Filter (server.ts:11500) ·
f53cb7ac Rollback ohne Compare-and-Set (server.ts:12048) · 43444dd8 Stream-Attach prüft Pipe-Ziel nie
(server.ts:4738) · 0c190377 `MAX_ADJUDICATION_NOTE = 300` · 578e8975 byHuman-Arm landet mit stale Verify ·
6a691420 e2e-stage.sh reapt keine Pane-Kinder · e9e22694 Rest lane-signals.ts:382 `$FLEET_SELF_TOKEN` ·
3d6285f9 `ACCEPT_WAIT_MS` fix 3000 · ca6dc7a7 (b) kein `HEAD==bootHead`-Refusal · 529e5914 (c)
Composer-Inhalt vor Succession-Cleanup · d1373cf7 Rest Pane-Zeilen bei not-alive · 6a0a9ff2 zwei rote Audits
adjudizieren (f170dc46, kein Code).
**OFFEN-IDEE (17):** b5665e17 B1 · dbd6beb3 B2 · 2c306a87 B3-Rest · c14fcd75 B4-Rest · c90ea457 B5 ·
11bc0a1c B6 · 3690e3c6 B8-Rest · 15896dfd B9-Rest · 955bcc85 B10 · c64bcb62 B12 · 0aa4cc48 B13 · 524d4812
D2 · 48a91762 · 3d5c87cb · 10540266 · 98979607 · 8f56e1fc · d19dfca7.
**RICHTUNG-UNGETRAGEN (3):** 812e8458 → rulebook/einstieg.md · 233ee108 → Dispatch-Prozessdokument ·
0694cb78 Teil 2 (Docs erzeugen keinen git-HEAD) → Bauformen-Entwurf.
**UNGEPRÜFT (2):** e66d9bfc (ff-lost im guarded-confirm), bd7c7b8d Nebenbefund Debian-Lock.

## 4. Notizen in AKTIVEN Programs (39) — nicht angefasst

f170dc46 15 · 9ce08219 10 · f9dc8e10 8 · 233e1c2b 5. Sie haben lebende Leser; Slot 11 führt seine fünf
ausdrücklich als Owner-Tore (f7493755, 59ffeda0). Bereinigung dort ist Sache der jeweiligen MAIN.

## 5. Ergebnis und Vorschlag

- Geschlossen: 3 done + 62 archiviert = 65 von 194; die Ausführungsliste steht unten in §6.
- Rest 129 offen, davon 33 lebendige Aufträge (Astras P2-Reihenfolge und die Betriebs-Rückwege),
  15 Trägerlose aus complete Programs, 37 Befund-/Ideen-Zeilen, 39 in aktiven Programs, 5 Biber.
- Vorschlag Reihenfolge: (1) Deploy `7627fbad` (Attention b57b0287; Fix für die laufende
  Composer-Blockade) · (2) Astra released P2 wie geplant · (3) die 15 Trägerlosen und 14 OFFEN-BEFUNDE
  als ≤ 6 Bündel-Notizen an f170dc46/f9dc8e10 (Owner-Entscheid 09-08: ≤ 20 Bündel), Originale danach
  archivieren · (4) Private-repo-j: Owner entscheidet Eis oder Schluss · (5) die drei Richtungen ins
  Regelbuch-Fragment bzw. ein Dispatch-Prozessdokument.

## 6. Ausführungsliste (als Beleg dessen, was diese Session per Owner-Route geändert hat)

done: 0e069d4c 4872457b cb0dc4e7
archive: 8e1e0be4 6788efc6 7de5bb6a 0ac22a00 789d9034 be20f4b4 c3bf1e7c f9db018e abb81258 c7a5e061 2d0e73fa
e48ab251 0dfff4b1 e45751a5 b1d4f2d5 e7e356e9 a3878547 4ec2cb84 4fc45ae2 4d38bb22 82ae9cc4 b78d31b7 16018401
615513af 81147563 3f1cec58 02290721 365f213b 506fdce6 fafc4320 f3f9aafc b6b973f2 b6e498c7 b19d23b7 945038e2
1018ea26 d43455df 9c429719 a28e82cb 6d156308 051cb897 629e8b2d 1ac30f1e 3ad9e850 d018d52d 50bd17e9 ada76ad9
2ad90d28 deb0de66 bd7c7b8d 1a7dd56e dfc1506a 0544306f 641897ec 0431a588 ec5d6cf0 51753e67 970238ad 06166516
33ead5ea 2f0d7811 70632fba

Was diese Session NICHT geprüft hat: das Biber-Repo (nur Existenz von Dateien), Suiten (kein Lauf),
ob Astra einzelne P2-Zeilen zwischenzeitlich released hat, die 39 Notizen in aktiven Programs.

## 7. Nachtrag 2026-09-11 ~10:5x — Bündelung ausgeführt, Knackpunkte-Doc gelandet, Deploy gefahren

- **Astras Knackpunkte-Dokument** (`docs/messungen/2026-09-11-knackpunkte-verschlankung-astra.md`, Lane f8d9c037,
  codex/gpt-6-astra/medium) ist von der Betriebs-MAIN Slot 3 gelandet: main `092083c2`, Audit grün. Gegenprobe
  durch zwei Opus-Lesungen: 16/17 Kostenzahlen wörtlich reproduziert (Abweichung nur die lebende fleet.json-Größe),
  6/6 Mechanismen am Baum bestätigt, eine Spannung gefunden (Program-Inbox-Einträge lösen `tickInboxNudge` aus,
  Owner-Entscheid 09-08 für Astras Pane). Daraus drei Zeilen in f170dc46: **f4889e3c** (K1 Backoff),
  **92ffd17c** (K2 capPrograms-Retention, trägt bf3dd138 F4), **288f6359** Brief nachgezogen (K4 audit-red,
  trägt 1410a078/9ec887d1). Notiz **27df8a78** an f9dc8e10.
- **Deploy** `c5279397` (Verb 2): Boot auf `092083c2` = main, `hitTarget:true`, `bundleStale:false`, kein Audit
  getroffen (Audit war 5 min vorher grün). Attention b57b0287 damit erledigt; der Zustellungs-Fix `5eaf0955` ist live.
- **Sechs Bündel-Notizen** (Owner-Ziel ≤ 20 Bündel) tragen jetzt die 15 Trägerlosen aus §2b und die 14 offenen
  Befunde aus §3b, 32 Originale archiviert (Volltexte bleiben in fleet.json unter `archived`):

| Bündel | Program | Inhalt | Originale |
|---|---|---|---|
| df55f6c2 | f170dc46 | Zustellung und Lane-Lebenszyklus nach K1 | e4a001b0 07ef9694 f53cb7ac 3d6285f9 1d05c49b 43444dd8 e9e22694 529e5914 d1373cf7 |
| ba7df947 | f170dc46 | Deploy, Undo-Land, Owner-Zielbild | e229aa2f bf3dd138 ca6dc7a7 606cfbeb |
| 24bff40e | f170dc46 | Cross-Host-Dispatch Second-host | 6f90781c 7b6c997e |
| c104ba1d | f170dc46 | Verify, Gate, Audit | f0c28e8f d2e4f219 04fdfc77 6d2a4d4b 563ec115 578e8975 0c190377 6a691420 6a0a9ff2 |
| 58f61b33 | f170dc46 | Self-API-Ergänzungen | 8b0114e1 c90ea457 18a14e37 11bc0a1c 99c9458f |
| 9238013d | f9dc8e10 | Owner-Architekturrichtung | c52c49f9 |
| (K4-Brief) | f170dc46 | über 288f6359 getragen | 1410a078 9ec887d1 |

- Betriebszeilen 4872457b und a9507514 sind done (Übergaben vollzogen). Queue danach: **107 pending**
  (auftrag 39 · notiz 62 · richtung 4 · betrieb 2).
- Nicht gebündelt, bewusst: 15 OFFEN-IDEEN (B1…B13, D2 u. a.) und 3 ungetragene Richtungen bleiben einzeln
  pending — Ideen sind Portfolio, keine Befunde; die Richtungen brauchen je einen Regelbuch-/Doc-Ort, keinen Träger.
- Offen beim Owner: Private-repo-j 9ce08219 (5 Zeilen, zwei am Repo überholt) — Eis oder Schluss.
