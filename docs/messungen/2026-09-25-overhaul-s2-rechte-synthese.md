---
frage: Was gibt es heute an Berechtigung und Autonomie, was wollte der August-Versuch, woran ist er gescheitert, und was ist der Entwurf mit WENIGER Mechanik?
urteil: Der August-Versuch ist nicht am Entwurf gescheitert, sondern daran gelandet zu sein und nicht benutzt zu werden: die Self-Land-Tuer traegt 443 von 628 Lands seit 09-01, aber die starke Tuer (Owner-Bearer, 182 Lands, 109 an einer lebenden MAIN vorbei) ist die einzige unauditierte, waehrend die schwachen jede Freigabe mit Slot buchen (MAIN 116, Policy 48, Owner-Route 0); 4 von 5 Grants haben keinen Halter, 7 Provenienz-Felder sprechen 4 Vokabulare, 50 Kopien derselben Credential-Aufloesung, 0 von 5 Owner-Blockern durchgesetzt; der Entwurf nimmt 6 Credentials auf 4, 50 Aufloesungen auf 1, 7 Felder auf 1 und macht aus 0 Blockern 2 durchgesetzte, 1 teilweisen und 2 als nicht durchsetzbar benannte, und er stellt die orchestrierende Rolle als DREI Kandidaten, von denen der Plan-Vorschlag als einziger die Grant-Zahl erhoeht
bereich: [berechtigung, autonomie, prinzipale, provenienz]
belege: [server/auth.ts#tokenFrom, server.ts#tokenGate, server.ts#LandActor, server.ts#ownerLandActor, server.ts#selfLandTaskForMain, server.ts#isBoundSupervisor, server.ts#isOrchestratorLabel, server.ts#handleStewardRoute, server.ts#helperAuthed, server.ts#releaseTask, server.ts#releaseTaskForMain, e2e/security.ts#PRE_AUTH_ROUTES, ctl.sh#owner_token, docs/attic/authority-slice-brief-2026-08-23.md]
nicht-gemessen: src/client.ts (was das Board anzeigt), kein Suite-Lauf, keine Live-Probe einer Tuer, und die 352 Owner-Route-Freigaben seit 09-01 sind aus dem Outcome-Register erschlossen, nicht aus einem Audit-Trail, den es fuer diese Tuer nicht gibt
stand: 2026-09-25
---

# Berechtigung und Autonomie im Fleet — Bestand, August-Versuch, Scheiterursache, Konsolidierung

2026-09-25, Lane `fleet/260925144000-a9ba` (Slot 21), Program „Overhaul Kern", Strang S2.
Frage: **Was existiert heute an Berechtigung und Autonomie, was wollte der Versuch vor 1–2 Monaten,
woran ist er gescheitert, und welche Ordnung hat nachweislich WENIGER Mechanik als die heutige?**

Owner wörtlich (25.09.): *„Bedenke aber das wir das in großen Teilen schon haben, nur noch nicht
eben super sauber umgesetzt (hier bin ich vor 1-2 Monaten auch schon stark dran gescheitert, an
sauberen Berechtigungsstrukturen + Autonomie)"* — und die Richtung, die jede Abwägung hier
entscheidet, `09b577e9` (02.09.): *„zu allererst muss alles erstmal effizient, smart und effektiv
laufen … ohne uns dann wieder durch ein striktes, nicht zusammenhaengendes Berechtigungssystem
kaempfen zu duerfen."*

**Diese Notiz schlägt keinen Prinzipal als gesetzt vor.** Der `orchestrator`-Prinzipal aus
`docs/overhaul-plan-2026-09-25.md` §2 S2 ist in §D eine von drei Kandidatenlösungen und steht dort
neben zwei anderen. Gemessen ist der Bestand; entschieden ist nichts.

Alle Zeilennummern gelten gegen `main` `ba1382d9`. Die Register wurden am 25.09. zwischen 16:45 und
17:20 im Haupt-Checkout gelesen.

---

## A. Bestand — jede Credential, Tür, Grant und Bindung, die heute existiert

### A.1 Credentials: sechs im Code, fünf mit einem Halter

| # | Credential | Geprägt in | Akzeptiert in | Wer hält sie heute | Gemessene Nutzung |
|---|---|---|---|---|---|
| 1 | **Owner-Token** (`TOKEN`) | `FLEET_TOKEN`, sonst persistiert als `token` in `fleet.json` | `server/auth.ts#tokenFrom` → `server.ts#tokenOk`/`tokenGate` | Board (Cookie) **und jede Session, die `fleet.json` liest** (`ctl.sh#owner_token`, ein `sed` auf die erste Zeile) | 185 Lands seit 09-01: **182 `via=bearer`, 3 `via=cookie`** |
| 2 | **Self-Token** je Slot (`Slot.selfToken`) | `ensureSlot`, als `export FLEET_SELF_TOKEN` in den zsh-String jeder Pane | 50 identische Inline-Blöcke im `/api/self/*`-Bereich | jede Session mit `cwd` | 443 Lands seit 09-01 über `POST /api/self/tasks/:id/land`; 151 `self_drift` in 5 Tagen |
| 3 | **Steward-Token** (`stewardToken`) | `randomBytes(16)`, persistiert; exportiert **nur** in eine Pane mit `label === "⚙ steward"` (`server.ts:7562`) | `server.ts:39547` → `handleStewardRoute` | **niemand** — 0 von 20 Slots trägt das Steward-Label | **0** `steward_*`-Zeilen in `audit.jsonl` (20.09.–25.09.); letzte je: `2026-09-13 15:41` in `audit.jsonl.1`. 0 von 267 Deploys `by:"steward"` |
| 4 | **Helper-Token** (`helperToken`) | `randomBytes(16)`, persistiert | `server.ts#helperAuthed` | der Second-host (Tailscale-Adresse aus .env), heute online | 626 `helper_claim` / 805 `helper_result` in 5 Tagen; 2 `helper_auth_fail` je |
| 5 | **Share-Secret** je Share (`Share.secret`) | Owner beim Anlegen eines Shares | `server/auth.ts#shareGate` | Gäste eines Shares | 0 `share_auth_fail` |
| 6 | **Intake-Secret** (`INTAKE_SECRET`) | `FLEET_INTAKE_SECRET` | `server.ts#handleIntake` | **niemand — die Variable ist auf dieser Maschine nicht gesetzt**, die Route antwortet 404 `intake disabled` | 0 |

**Der Kern von A.1 in einem Satz:** Credential 1 ist die einzige, die *nicht* an eine Identität
gebunden ist, und sie ist genau die, über die heute alles läuft, was die anderen nicht dürfen.
`server.ts:22516` sagt das über sich selbst, ohne Beschönigung:

> *„PREVENTION IS CLASSIFIED UNSUPPORTED, and honestly: every session on this host runs as the
> owner uid, and fleet.json is 0600 but same-uid readable from any worktree. … What exists is this
> field, the `suspect` flag and the `owner_token_ambient_use` audit row — a ledger that can NAME
> the class, never a barrier."*

### A.2 Türen: vier Gates, drei gepinnte Vorhof-Listen

Der Request-Weg (`server.ts:38347` ff., `handle()`):

1. `server/auth.ts#guard` — Host-Allowlist + Origin (DNS-Rebinding / Cross-Site). Gilt für **alles**.
2. `/intake` (eigene Credential, heute tot).
3. Share-Host-Gate: auf dem öffentlichen Hostnamen existiert nur die Share-Fläche.
4. `/api/machine-settings` — eigener Owner-Check vor dem gemeinsamen Gate, damit ein gültiges
   Scoped-Credential ein 404 statt eines 401 bekommt.
5. Die **Self-Familie** (per-Slot-Credential), dann `handleStewardRoute`, dann `handleHelperRoute`.
6. `tokenGate` — die letzte Zeile. Alles darunter ist Owner.

Die drei Vorhof-Flächen sind maschinell gepinnt (`e2e/security.ts` §1 zieht die Routen aus dem
Quelltext und vergleicht sie gegen eine Liste):

| Liste | Einträge | Prinzipal |
|---|---|---|
| `PRE_AUTH_ROUTES` | **63** | Self-Token (plus `/`, `/favicon.ico`, die Share- und die zwei Supervisor-Bootstrap-Türen) |
| `STEWARD_ROUTES` | **11** | Steward-Token — darunter `POST /api/deploy` |
| `HELPER_ROUTES` | **7** Türen + 1 Guard-Regex | Helper-Token |

`/api/dispositions` steht in zwei Listen, also **81 unterscheidbare Vorhof-Einträge**. Darunter
liegen weitere 99 literale und 17 regex-adressierte `/api/*`-Pfade hinter `tokenGate`.

**Die 50fache Wiederholung.** Jede Self-Route löst ihre Credential selbst auf, mit einem
byte-gleichen Block:

```ts
const s = given ? slots.find((x) => x.cwd && x.selfToken && secretEq(given, x.selfToken)) : undefined;
if (!s) { await Bun.sleep(400); return json({ error: "unauthorized" }, 401); } // flat cost, same as tokenGate
```

**50 Kopien der Auflösung, 50 Kopien des 401** (`grep -c` gegen `server.ts`). Es gibt keinen
`resolvePrincipal`. Das ist keine Stilfrage: es ist der Grund, warum eine neue Regel heute
50-mal eingetragen werden müsste und warum `e2e/security.ts` §1 einen Extraktor braucht, der nur
zwei Schreibweisen liest — eine dritte wäre eine Tür, die der Pin strukturell nicht sieht.

### A.3 Grants und Bindungen: fünf, die etwas gaten — vier davon leer

| Grant / Bindung | Symbol | Wer setzt sie | Was sie öffnet | Stand heute |
|---|---|---|---|---|
| **Program-MAIN-Bindung** | `server.ts#boundProgramForMain` (30 Fundstellen) | Owner (`bootstrap-main`) bzw. Nachfolge | die MAIN-Türen: `self/tasks` anlegen/freigeben/halten/briefen, `self/tasks/:id/land`, Program-Inbox | **lebt** — 443 Lands und 116 auditierte Freigaben in 5 Tagen laufen hierüber |
| **`program.promotion`** | `{v:1, selfLand:"off"\|"green-only"\|"guarded"}`, `server.ts#selfLandTaskForMain` | Owner, `POST /api/programs/:id/promotion` | Selbst-Land der gebundenen MAIN | **lebt** — **43 von 77** Programs tragen eine Promotion |
| **Supervisor-Bindung** | `server.ts#isBoundSupervisor`, `#supervisorRefusal` | Owner, `/api/supervisor/bootstrap` \| `/bind` | `self/supervisor-view`, `self/nudge`, `self/supervisor-watch/:id/complete` | **STALE** — die Bindung nennt Slot 2 `openedAt 1788958257705` (gebunden 2026-09-09 12:51Z); Slot 2 trägt heute `openedAt 1790184006767`. `supervisorHealth()` liefert `stale`, alle drei Türen antworten jeder Session 409 |
| **`memoryGrant`** | `server.ts#effectiveGrant`, `PATCH /api/slots/:id/memory-grant` | Owner | Projekt-Memory-Projektionen über `GET /api/self/memory` | **0 von 20** aktiven Slots trägt einen Grant |
| **`reportDelegate`** | `PATCH /api/slots/:id/report-delegate` (24 Fundstellen) | Owner | Report-Urteil an einen anderen Slot delegieren | **0 von 20** aktiven Slots trägt einen Delegate |

Dazu **zwei Rollen-Labels**, die verschiedene Dinge tun:

- `STEWARD_LABEL = "⚙ steward"` (`server.ts:5006`) — gewährt selbst nichts, entscheidet aber, ob
  `ensureSlot` das Steward-Token in die Pane exportiert. Ein Label **ist** hier also der Schlüssel.
- `isOrchestratorLabel` (`server.ts:32268`, `🎛` oder `ORCHESTRATOR_LABEL_RE`) — gewährt
  **nichts**. Es erscheint an sechs Stellen, davon zwei in Fehlertexten, die das ausdrücklich
  sagen: *„— a role label grants nothing"*. Slot 9 trägt es heute.

### A.4 Provenienz: sieben Felder, vier Vokabulare

Die Frage „wer hat das getan" wird heute an sieben Stellen mit vier verschiedenen Wortschätzen
beantwortet:

| Feld | Typ | Geschrieben von | Vokabular |
|---|---|---|---|
| `LandActor` (`server.ts:22529`) | 3 Arme | `ownerLandActor`, `selfLandTaskForMain` | `owner{via: cookie\|bearer\|query, suspect?, bypassed?}` · `main{slot,program,task,sessionIdMatch}` · `unknown{why}` |
| `Task.releasedBy` | 2 Werte | `releaseTask(t, by)` | `owner` \| `machine` |
| `LandFacts.confirmedByHuman` | boolean | `confirmResolvedCandidate({byHuman})` | — |
| `Task.source` (`server/types.ts:1308`) | 4 Werte | die anlegende Route | `owner` \| `intake` \| `steward` \| `main` |
| `Deploy.by` | 3 Werte | `deployVerb` / `recordUnattributedBoot` | `owner` \| `steward` \| `unattributed` |
| `attention.answer.by` | — | u. a. `server.ts#closeStallAttention` | schreibt `owner`, auch wenn der Sensor schließt |
| `Task.kindChanges[].by` | — | `changeTaskKind(t, to, by)` | eigenes Set |

Dazu eine achte Stelle, die kein Feld ist, sondern **getippter Text**: der Zustellkopf
`server.ts#deliveryHeader` (`DELIVERY_HEADER_PREFIX` + `DELIVERY_SOURCE`, Anlass 4b085fd9 laut
Code-Kommentar: 18 von 75 reinen Paste-Zustellungen an claude-fable-5-1 wurden als fremd
abgelehnt). Er leitet sich aus dem `SendPath` ab, nicht aus einem Aktor. Für `path=owner`
schreibt er `POST /send mit Owner-Credential`. Der Code-Kommentar sagt selbst, warum: *„`owner`
names the CREDENTIAL, because the orchestrator sends through the same door with the same token and
the server cannot tell the two apart."* Das stimmt nur halb. Die `/send`-Route (`server.ts:42963`)
hat `req` in der Hand, und `server.ts#tokenChannel` trennt Cookie von Bearer auf demselben Weg, den
`ownerLandActor` beim Land benutzt. Der Kanal wird beim Senden nur nicht gelesen.

Keines dieser Felder nennt einen **Slot** ausser `LandActor.main`. Keines nennt einen
`openedAt`. Die Frage „welche Session war das" ist für sechs von sieben nicht beantwortbar.

### A.5 Wer benutzt was — gemessen

Fenster: Lands und Freigaben aus `lane-outcomes.jsonl` seit 2026-09-01 02:00 CEST
(`ts >= 1788220800000`); Audit-Zeilen aus `audit.jsonl`, dessen Fenster 2026-09-20 09:56Z bis
2026-09-25 14:44Z reicht.

**Lands seit 09-01 (n = 628):**

| Aktor | n | Kanal |
|---|---|---|
| `main` (Self-Land-Tür) | **443** (70,5 %) | Self-Token |
| `owner` | 185 (29,5 %) | 182 bearer, 3 cookie |

Von den 182 Bearer-Lands tragen **109** `suspect:"owner-token-outside-board"`, laufen also an einer
lebenden, gebundenen MAIN vorbei; 41 davon mit Report-Stand `accepted`, 24 `undecided`, 2 `none`.
`confirmedByHuman:true` steht auf **12** Zeilen — **11 davon via bearer**, eine via cookie. Das
Feld behauptet also elfmal einen Menschen, den es nicht gab.

**Die Audit-Asymmetrie, und sie ist die schärfste Messung dieser Notiz.** Im 5-Tage-Fenster:

| Tür | auditiert? | n im Fenster |
|---|---|---|
| MAIN-Freigabe (`server.ts:13470`, `releaseTaskForMain`) | **ja**, mit `slot` | 116 |
| Policy-Freigabe (`server.ts:16969`, `17501`) | **ja**, `by=policy` | 48 |
| **Owner-Route-Freigabe** (`server.ts:42471`, `releaseTask(t,"owner")`) | **nein, keine Zeile** | ≥ 67 (aus `releasedBy:"owner"` auf Lane-Zeilen desselben Fensters; die echte Zahl ist höher, weil nicht jede Freigabe eine Lane wird) |
| `POST /api/tasks` (Anlegen) | **nein** — nur `variant_group` bei Varianten | 289 „owner"-Zeilen seit 09-15 (K2 Ä1) |
| `archive` / `delete` | **nein** — nur `unarchive` schreibt `task_archive_restore` | 96 Archivierungen seit 09-15 (K2 Ä2) |
| `task_spawn` (Worker setzen) | ja, aber **`slot: null` in 150 von 150** Zeilen | 150 |
| Batch-Freigabe `/api/programs/:id/release-valid` (`server.ts#releaseValidForOwner`) | ja, `program_release_valid` | **0** — die Zeile existiert in keinem der drei Audit-Logs |
| Land | ja, `land_actor` 195 + `owner_token_ambient_use` 101 | — |

**Zustellungen.** 399 `send`-Zeilen mit `path:"owner"` im Fenster, **0 davon mit einem
Kanal-Feld** (Schlüssel: `acceptance, bytes, ctxPct?, detail, event, path, slot, ts`). Ob eine
Owner-Zustellung ein Board-Klick oder ein Agenten-`curl` war, ist also weder im Kopf noch im Ledger
sichtbar. Nach Messung der Orchestratorin vom 25.09. (von dieser Notiz nicht nachgemessen) steht der
Kopf außerdem sichtbar in der Chat-Blase des Owners, und ein `/model …` über `POST /send` wird
durch ihn zu Prosa: `deliveryHeader` hat keine Ausnahme für Text mit führendem `/`. Die einzige
kopflose Schiene ist `model-push` (`DELIVERY_SOURCE["model-push"] = null`), eine eigene Route.
Am 25.09. musste `/model` deshalb per `tmux send-keys` an Slot 21/22 getippt werden, außerhalb
jedes Audits. Auch dieser Bericht kam mit dem Kopf `path=owner` an, gefolgt vom lokalen
`/model`-Befehl.

**Die einzige Tür ohne Provenienz ist die mächtigste.** Die beiden auditierten Freigabe-Pfade sind
die, die ohnehin an eine Identität gebunden sind.

**Die toten Prinzipale.** Der Steward hat 11 Türen inklusive `POST /api/deploy` — und
0 Zeilen im aktuellen Audit-Log, 0 von 267 Deploys, kein Slot mit seinem Label. Der Supervisor hat
3 Türen — und eine Bindung, die seit dem 09.09. auf einen ersetzten Occupant zeigt. Beide
verweigern still: eine stale Bindung ist von „niemand hat es gebraucht" nicht unterscheidbar.

### A.6 Die fünf Owner-Blocker heute: null davon durchgesetzt

| Blocker | Fläche im Code | Stand |
|---|---|---|
| **Geld ausgeben** | `grep -cE 'PER_DAY\|perDay\|dailyCap\|MAX_AUTO\|costUsd\|spendUsd\|budgetUsd' server.ts` → **0** | keine Kosten- oder Durchsatz-Buchführung; Fleet ruft keine API auf, jeder Modell-Aufruf spawnt das CLI gegen ein Abo (`docs/attic/autonomy-plan.md` Gap 4, Owner-Entscheid 07-25: „off the critical path") |
| **Nach außen veröffentlichen** | `server.ts#pushLandToHub` (22702), gerufen aus dem Land-Pfad (22825, 30940) | **ein automatischer Push je Land**, gegen `FLEET_HUB_REMOTE` = `hub`. `hub` zeigt auf `ssh://<second-host>/~/git/claude-fleet.git` — die **eigene** zweite Maschine des Owners. **Kein Code-Pfad pusht nach `origin`** (GitHub, öffentlich). Trail: 52 `hub_skip`, 2 `land_hub_only`. Also: ein Publikations-Mechanismus existiert, zielt aber heute nirgends nach außen — und nichts im Code garantiert das, es ist eine Eigenschaft der `.env`-Zeile |
| **Secrets lesen oder ausgeben** | `/api/steward/token` und `/api/helper/token` sind owner-gated (`server.ts:40358/40363`) | **die Route ist nicht der Weg.** `ctl.sh#owner_token` liest das Owner-Token per `sed` aus `fleet.json`; `ensureSlot` backt die Self-Credentials in den zsh-String jeder Pane, also stehen sie in `ps`. Kein Gate dazwischen |
| **Fremde Slots schließen** | `killSlot` (16 Aufrufstellen, u. a. `server.ts:17004`, `19672`, `42918`) | die Self-Familie ist hart an den eigenen Slot gebunden (`/api/self/retire` schließt nur den Aufrufer). Eine Session **mit dem Owner-Token** erreicht jede Slot-Tür. Der Blocker existiert also gegen den Self-Prinzipal und gegen den Owner-Prinzipal gar nicht |
| **Owner-Memory überschreiben** | keine Server-Route schreibt es. `GET /api/self/memory` ist read-only (`server.ts:38485`, nur `GET`) | das Owner-Memory liegt unter `~/.claude/projects/…/memory/` und wird von Agenten mit dem Datei-Werkzeug geschrieben — **außerhalb des Servers, also außerhalb jeder Berechtigungsschicht, die Fleet bauen kann** |

**Ergebnis A.6:** Von fünf Blockern hat einer (Veröffentlichen) überhaupt eine Fläche im Server,
und die ist nicht gegated, sondern konfiguriert. Zwei (Secrets, fremde Slots) sind heute durch
dieselbe Same-uid-Eigenschaft offen, die `server.ts:22516` als *unsupported* deklariert. Einer
(Owner-Memory) liegt strukturell außerhalb. Einer (Geld) hat keinen Messpunkt.

---

## B. Der August-Versuch — was die sieben Quelldateien wollten

Gelesen aus `main:` (`git show main:<pfad>`), in der Reihenfolge ihrer Entstehung.

### B.1 `docs/attic/lane-autonomy-future.md` (2026-07-22) — die Doktrin
Die Verschiebung von **pre-hoc approval** zu **post-hoc accountability**: der Agent handelt,
dokumentiert, hält das Ergebnis trivial umkehrbar, der Owner sieht einen Feed und macht rückgängig.
Sechs Komponenten: strukturierter Auflösungs-Record · dauerhaftes Land-Ledger · erstklassiges Undo ·
Verified-green-Vorbedingung · **abgestuftes Autonomie-Gate, reversibilitäts-primär statt
konfidenz-primär** · Post-hoc-Review-Feed. Kernsatz: *„Reversibility + documentation are
prerequisites for safe autonomy."* Explizit **zurückgestellt** — gebaut wurde die kleine Version
(One-gesture-Land + Undo-last-Land).

### B.2 `docs/attic/orchestrator-autonomy.md` (2026-07-23) — die Rolle
Trennt **Architekt** (irreduzibel interaktiv, nie automatisiert) von **Foreman** (Koordination:
Claims prüfen, in Lanes schneiden, briefen, dispatchen, für den Land stapeln). These: *„make the
foreman stateless, not smart"* — ein Puls, der seinen Kontext jedes Mal aus dauerhaftem Zustand neu
ableitet, degradiert nicht. Und, für S2 die zentrale Zeile:

> *„‚propose' is only structurally propose under the **steward principal**: the steward task route
> hard-forces `pending` … Under the owner token the same filing COULD be `queued` … leaving only a
> textual leash. **Structural beats textual**, and the structural option is free."*

Der August wusste also bereits genau, was heute die Diagnose ist. Sechs stehende deterministische
Guards; Leiter observe → propose → act-then-notify → act-silently; **Land und Deploy sind unter
keinem Vehikel Foreman-Verben**. Gebaut: nur das `/foreman`-Ritual.

### B.3 `docs/attic/autonomy-plan.md` (2026-07-25) — die Axiome und die Diagnose
Zwölf Axiome, davon für S2 tragend: **A2 record → display → advise → gate → act** (jede urteilende
Instanz steigt durch gemessene Treffer, nie dadurch, gebaut worden zu sein) · **A3 kein Mess- oder
Urteilslayer ohne seinen Fütterer im selben Zug** · **A4 Unknown ≠ Null** · **A10 Unabhängigkeit muss
strukturell sein, nicht nominell**. Und der Satz, der das ganze Programm zusammenfasst:

> *„Fleet can already do the work unattended; what it cannot do is find out whether the work was
> good."*

Fünf Lücken, kritischer Pfad: Owner-Labels → Post-Land-Audit-Tier → **Defect-escape-Attribution** →
Dispatcher-Briefing → Attention-Routing.

### B.4 `docs/attic/autonomy-verbs-2026-08-06.md` (06.08.) — die fünf Verben
Verb 1 Maschinen-Fakt an seine Konsumenten · Verb 2 Deploy · Verb 3 Auto-Promote ·
Verb 4 Steward neu aufstellen · Verb 5 Auto-Land. Reihenfolge 1→2→3→4→5. Das Dokument nennt
sich selbst klein, weil die Kette „Steward-Befund → analysierte, dispatchbare Task" **vollständig
existiert** und nur drei Glieder fehlen.

### B.5 `docs/attic/autonomy-map-2026-08-06.md` (06.08.) — die Landkarte und das Gegengewicht
§11.1 nennt fünf Dinge, die **nicht** automatisiert werden sollen, jedes mit Begründung statt
Vorsichtsgeste. §11.2 ist die methodisch wertvollste Seite des ganzen Korpus: **kein Vorschlag ohne
Schwelle** — je Schritt „welche Zahl, über wie viele Läufe, wann man abbricht". Sieben Zeilen A–G,
davon drei inzwischen als erledigt durchgestrichen.

### B.6 `docs/autonomy-bausteine-2026-08-06.md` (06.08.) — die Korrekturen
Korrigiert drei Prämissen der Vorgänger (u. a.: „nach `queued` kommt eine Zeile ausschließlich durch
den Owner-Promote" ist **falsch**, zwei Maschinenpfade schreiben ihn auch) und hängt vier Bausteine
an. 2.1 ist für S2 der wichtigste: **kein Feld sagt, ob eine Lane von der Maschine oder vom Owner
freigegeben wurde** — und `confirmedByHuman` sieht so aus, als täte es das. Vorschlag:
`releasedBy: "owner" | "machine"`, **„muss vor Verb 3 landen"**.

### B.7 `docs/attic/authority-slice-brief-2026-08-23.md` (23.08.) — der Bau
Die Owner-Politik wörtlich: *„Ordinary clean/green in-program land decisions belong to the owning
Project MAIN, not the Owner."* Fünf Eskalationsklassen plus Erschöpfung; alles andere ist MAINs
Arbeit. Mechanismus: `program.promotion` als geschlossenes Schema ·
`POST /api/self/tasks/:id/land` · Resolved-Candidate-Confirm für die `guarded`-Sprosse ·
**Aktor-Provenienz** (`LandProvenance.actor`, `LaneOutcome.landedBy`, Audit `land_actor`,
`suspect:"owner-token-outside-board"` + `owner_token_ambient_use`) · und ausdrücklich:
*„Prevention stays UNSUPPORTED (same uid) and documented."*

**Was davon heute im Baum steht — nachgeprüft, nicht angenommen:** `program.promotion` mit drei
Sprossen (`server.ts#selfLandTaskForMain`, 43 von 77 Programs tragen eine) · die Self-Land-Tür
(443 Lands seit 09-01) · `LandActor` mit drei Armen und `ownerLandActor`s Bypass-Benennung ·
`owner_token_ambient_use` (101 Zeilen) · `releasedBy` (B.6, 314 `machine` / 352 `owner` seit
09-01). **Der August-Versuch ist gebaut worden.**

---

## C. Die Scheiterursache — je Ursache ein Beleg

Der Owner sagt, er sei gescheitert. Die Messung sagt: **nicht am Entwurf und nicht am Bau, sondern
an fünf Dingen, die der Entwurf nicht adressiert hat.** Gerankt nach Wirkung.

### C1. Die starke Tür wurde nie eingeschränkt, nur beschriftet — und sie ist die einzige unauditierte

`docs/attic/authority-slice-brief-2026-08-23.md` §2.4 schreibt „Prevention stays UNSUPPORTED" und
baut stattdessen ein **Etikett**: `suspect`, `bypassed`, `owner_token_ambient_use`. Dieses Etikett
funktioniert — 109 von 182 Bearer-Lands seit 09-01 tragen es korrekt. Es hat nur nichts geändert:
KW36 24 Bypass-Lands, KW37 30, KW38 3, KW39 **53** (K1 Ä1). Ein Etikett, das niemand liest, ist die
Definition von A3 („kein Urteilslayer ohne seinen Fütterer").

Und die Asymmetrie aus A.5 macht es schlimmer als wirkungslos: `releaseTaskForMain` (`13470`)
schreibt eine Audit-Zeile **mit Slot**, die Owner-Route (`42471`) schreibt **keine**. Dieselbe
Inversion bei Anlegen und Archivieren. Wer die schwache Tür nimmt, hinterlässt eine Spur; wer die
starke nimmt, nicht. Das ist ein Anreiz, und er wirkt: 150 Modellwechsel in 5 Tagen liefen alle
über `task_spawn` mit `slot: null`, weil die MAIN-Tür für `spawn` fehlt (K2 Ä2).

**Kosten:** Für 29 % der Lands und für jede Task-Mutation über die Owner-Route ist „wer war das"
unbeantwortbar. Die Owner-Vorgabe „Owner raus aus der Bewertungsschleife" ist deshalb **nicht
messbar** — man kann nicht zählen, wie oft der Owner noch entschieden hat.

### C2. Der Prinzipal, den die Arbeit braucht, wurde nie gebaut — und der, der gebaut wurde, hat keinen Halter

`docs/attic/orchestrator-autonomy.md` §3 entscheidet sich ausdrücklich für den **Steward**-Prinzipal,
weil er strukturell auf `propose` gedeckelt ist. Die Rolle, die den Fleet heute fährt, ist aber die
**Orchestratorin** — und sie hat nur ein Label, das nach dem Code selbst „nichts gewährt"
(`server.ts:3529`, `12087`). Sie braucht Türen, die der Steward-Entwurf bewusst nicht vorsah
(anlegen, freigeben, spawn ändern, archivieren über alle Programs), also nimmt sie die einzige
Credential, die sie hat: das Owner-Token aus `fleet.json`.

Gleichzeitig steht der gebaute Steward-Prinzipal leer: **0 Zeilen im aktuellen Audit-Log, letzte je
am 2026-09-13, 0 von 267 Deploys, kein Slot mit seinem Label** — und dieselbe Fläche `POST
/api/deploy` wird 265-mal `by:"owner"` benutzt. Der Supervisor-Prinzipal daneben hat seit dem
09.09. eine **stale** Bindung und antwortet jeder Session 409.

**Der Mechanismus ist immer derselbe:** ein Prinzipal, dessen Schnitt nicht die Arbeit trifft, wird
nicht enger benutzt — er wird umgangen. Das ist keine Disziplinfrage; die Umgehung ist ein `sed`
(`ctl.sh#owner_token`).

### C3. Die Rechte wurden Tür für Tür entschieden, nie als Tabelle

Es gibt keinen `resolvePrincipal` und keine Rolle-×-Aktion-Zuordnung. Stattdessen: **50 identische
Inline-Auflösungen**, 63 Verweigerungen mit 409 und 52 mit 401 allein im Self-Bereich, **10
unterschiedliche Formulierungen** von „not a lane" und **18** Sätze der Form
„a lane may not …" / „a lane cannot …". Jede ist für
sich begründet; zusammen sind sie genau das, was der Owner am 02.09. benannt hat: *„ein striktes,
nicht zusammenhaengendes Berechtigungssystem"*.

Die Folge ist nicht Unsicherheit, sondern **Unveränderbarkeit**: eine neue Regel kostet 50 Edits,
also entsteht sie nicht, also wächst stattdessen die Zahl der Sonderfälle. `e2e/security.ts` §1
muss deshalb einen Quelltext-Extraktor fahren, der nur zwei Schreibweisen kennt — eine dritte wäre
eine unsichtbare Tür.

**Wichtige Abgrenzung, die diese Zählung ehrlich hält:** die `not a lane`-409er sind **keine
Berechtigungsregeln**. Sie sagen „diese Frage ergibt für dich keinen Sinn" (eine Drift-Messung
braucht einen Worktree), und `docs/self-api.md` nennt die Verweigerung ausdrücklich ein Feature —
409 statt 401, damit niemand nach einem Token sucht, das er schon hat. Sie dürfen in §D also nicht
als eingesparte Mechanik mitgezählt werden.

### C4. Provenienz wurde je Fläche erfunden statt einmal

Sieben Felder, vier Vokabulare (A.4), und keines nennt eine Session. Die drei sichtbaren Folgen sind
alle gemessen: `confirmedByHuman` behauptet elfmal einen Menschen, den es nicht gab (A.5);
`closeStallAttention` schreibt `by:"owner"` für 75 von 140 Attention-Schließungen, die der Sensor
selbst vorgenommen hat (K3 F5); `Task.source` steht in `POST /api/tasks` hart auf `"owner"`, während
mindestens 154 von 289 dieser Zeilen sich im eigenen Text als agentisch ausweisen (K2 Ä1).

Der Zustellkopf (A.4) ist derselbe Fehler, nur sichtbar statt gespeichert. Er nennt die
Credential statt des Aktors, obwohl die Route den Kanal kennt. Damit ist er dieselbe Klasse wie
`byHuman`/`confirmedByHuman` in K1 Ä1, und er erreicht als einziger Provenienz-Träger direkt den
Menschen, nämlich als Text in seiner eigenen Chat-Blase. Die Nebenwirkung auf `/model` ist die
Art Kosten, die C1 beschreibt: der Umweg (`tmux send-keys`) hinterlässt keine Spur.

Das ist A4 („Unknown ≠ Null") als Systemfehler: überall dort, wo keine Identität vorlag, wurde
`owner` eingesetzt statt `unknown`. `LandActor` ist die **eine** Stelle, die es richtig macht — sein
dritter Arm sagt wörtlich, dass der Aktor nicht rekonstruierbar ist, statt einen zu erfinden.
Genau dieser Arm ist das Muster, das den anderen sechs Feldern fehlt.

### C5. Vier von fünf Grants haben keinen Halter — der Bau lief weiter, die Benutzung nicht

`memoryGrant` 0 von 20 Slots. `reportDelegate` 0 von 20. Supervisor-Bindung stale. Steward-Token
ohne Pane. Gebaut sind alle vier, gepinnt sind alle vier, und drei von ihnen verweigern **still**:
409 „no grant" ist von 409 „niemand hat es je gebraucht" nicht zu unterscheiden.

Das ist A3 aus `autonomy-plan.md` („kein Mechanismus ohne seinen Fütterer") in der Fassung, die das
Dokument selbst als Hauskrankheit benennt — und es ist die einzige Ursache hier, die der August
**namentlich vorhergesagt** hat, ohne sich daran zu halten.

**Was NICHT die Ursache war** (damit es nicht in der nächsten Session neu vorgeschlagen wird):
nicht der Entwurf (B.7 ist präzise und wurde umgesetzt), nicht die Bauqualität (die Self-Land-Tür
trägt 70,5 % aller Lands ohne einen einzigen gemeldeten Vorfall), nicht fehlende Isolation
(Worktrees und Per-Slot-Credentials funktionieren), und nicht die Same-uid-Eigenschaft — die ist
eine ehrlich deklarierte Nicht-Eigenschaft, kein Defekt.

---

## D. Konsolidierungsentwurf — weniger Mechanik, mit Zählung

**Zählgrundlage.** Gezählt wird nur *Berechtigungs*-Mechanik: Credentials, Vorhof-Türen,
Credential-Auflösungen, Provenienz-Vokabulare, gatende Grants und durchgesetzte Blocker. **Nicht**
gezählt werden Sinn-Verweigerungen (C3) und fachliche Guards (Fortschrittssperre, done-looking,
Cap) — die bleiben unverändert stehen.

| Größe | heute | Entwurf | Delta |
|---|---|---|---|
| Credentials mit einem Halter | 5 (Owner, Self, Steward†, Helper, Share) | **4** (Owner, Self, Helper, Share) | −1 |
| Credentials ohne Halter | 2 (Steward, Intake) | **0** | −2 |
| Gepinnte Vorhof-Listen | 3 (63 + 11 + 7) | **2** (63 + 7) | −1 Liste, **−11 Türen** |
| Inline-Credential-Auflösungen | **50** (+ 50 Inline-401) | **1** (`resolvePrincipal`) | −49 / −49 |
| Provenienz-Felder | 7 | **1** (`actor`) + 2 abgeleitet | −4 |
| Provenienz-Vokabulare | 4 | **1** | −3 |
| Gatende Grants/Bindungen | 5, davon 4 ohne Halter | **3** mit Halter | −2 |
| Rollen-Label, das nichts gewährt | 1 (`isOrchestratorLabel`) | **0** | −1 |
| Durchgesetzte Owner-Blocker | **0 von 5** | **2 durchgesetzt, 1 teilweise, 2 benannt-unmöglich** | +2 (+1) |
| Türen ohne jede Audit-Zeile | Owner-`POST /api/tasks`, `queue`, `archive`, `delete` (4) | **0** | −4 |

### D1. Ein Auflöser statt fünfzig (C3)

`resolvePrincipal(req): Principal` an genau einer Stelle, vor der Route-Auswahl. Ein geschlossenes
Union mit fünf Armen, jeder mit Slot und `openedAt`, wo es einen gibt:

```
| { kind: "owner";        via: "cookie" | "bearer" | "query" }
| { kind: "session";      slot: number; openedAt: number; role: Role }
| { kind: "device";       deviceId: string }      // Helper
| { kind: "guest";        shareId: string }
| { kind: "machine";      why: "tick" | "sensor" | "policy" | "boot" }
```

`role` wird aus dem abgeleitet, was der Server **schon weiß** — nicht aus einem neuen Feld:
`worktree` ⇒ `lane`, `boundProgramForMain` ⇒ `main`, sonst `generic`. Das deckt sich mit
`docs/overhaul-plan-2026-09-25.md` §2 S1, das `position.role` ohnehin baut: **S2 braucht dafür
keinen eigenen Bau, sondern denselben.**

Die 50 Kopien werden zu 50 Zeilen `if (p.kind !== "session") return ...`. `e2e/security.ts` §1
pinnt danach eine Funktion statt eines Quelltext-Extraktors über zwei erlaubte Schreibweisen.

### D2. Ein `actor`, geschrieben vom Audit-Helfer (C4)

`audit(event, actor, detail)` statt `audit(event, slot, detail)`. `actor` ist der Principal aus D1.
`LandActor` wird zu seinem Spezialfall (`suspect`/`bypassed` bleiben als Zusatzfelder am Land).
Abgeleitet statt gespeichert:

- `confirmedByHuman` := `actor.kind === "owner" && actor.via === "cookie"` — behebt die
  11-von-12-Falschaussage ohne ein neues Feld.
- `releasedBy` := `actor.kind === "owner" ? "owner" : "machine"` — bleibt als Sicht auf den Ledgern
  lesbar, hört auf, eine eigene Wahrheit zu sein.

`Task.source`, `Deploy.by`, `attention.answer.by`, `kindChanges.by` lesen dasselbe `actor.kind`.
`closeStallAttention` bekommt damit `{kind:"machine", why:"sensor"}` **ohne Sonderregel** (K3 F5
erledigt sich als Nebenwirkung). Wo kein Aktor vorliegt, wird `{kind:"machine", why:"boot"}` oder
der `unknown`-Arm geschrieben — nie `owner`.

**Und die vier unauditierten Türen aus C1 bekommen ihre Zeile**, weil sie durch denselben Helfer
gehen. Das ist der ganze Fix für die Inversion: nicht die starke Tür schließen, sondern sie
aufhören zu bevorzugen.

### D3. Rechte als eine Tabelle, Default frei (C3, Owner-Richtung `09b577e9`)

Eine owner-konfigurierbare Tabelle Rolle × Aktion. **Default für jede Zelle: frei.** Sie ist damit
kein neues Gate, sondern eine Liste von Ausnahmen — und das ist die Form, die `09b577e9` verlangt
(„Deckel nur gegen gemessenen Schaden"). Fünf Zeilen aus der Owner-Vorgabe, jede mit dem
Chokepoint, an dem sie durchsetzbar ist:

| Blocker | Chokepoint | Durchsetzbar? |
|---|---|---|
| Geld ausgeben | — | **nein, und das muss dastehen.** Fleet ruft keine API auf; Geld fließt über das Abo-Kontingent des CLI. Ein Deckel wäre ein Lane-/Tages-Ventil am Dispatch, kein Geld-Blocker. Ehrlich benennen statt vortäuschen |
| Nach außen veröffentlichen | `server.ts#pushLandToHub` — der **eine** Push-Aufrufer | ja: Remote-Allowlist statt einer freien `.env`-Zeile; `origin` steht nicht drauf |
| Secrets lesen/ausgeben | `ctl.sh#owner_token`, `ensureSlot`s Pane-Export | **teilweise.** Same-uid bleibt unsupported (`server.ts:22516`). Was geht: das Owner-Token aus `fleet.json` nehmen und nur noch als Cookie ausgeben, damit ein `sed` es nicht mehr findet — dann ist `via:"bearer"` ein Fund, kein Normalfall |
| Fremde Slots schließen | `killSlot`, hinter D1 | ja: `p.kind === "session" && p.slot !== target.id` ⇒ 409. Heute besteht diese Regel nur, weil die Self-Familie hart bindet, nicht weil sie irgendwo steht |
| Owner-Memory überschreiben | — | **nein: liegt außerhalb des Servers.** Gehört in die Regel-Ebene (`AGENTS.md`), nicht in die Tabelle — eine Tabellenzeile, die nichts gatet, wäre genau das Etikett aus C1 |

**Zwei** der fünf sind voll durchsetzbar (Veröffentlichen, fremde Slots), **einer teilweise** (Secrets),
und **zwei sind es nachweislich nicht** (Geld, Owner-Memory) — und das gehört in die Tabelle
geschrieben, sonst ist sie eine Zusicherung, die sie nicht halten kann.

### D4. Die Rolle, die den Fleet fährt — drei Kandidaten, keiner gesetzt

Der Plan nennt einen `orchestrator`-Prinzipal. Er ist **ein** Kandidat; die Messung erlaubt drei,
und die Entscheidung gehört dem Owner:

**(a) Eigener Prinzipal `orchestrator`** (Plan §2 S2). Self-Token des Slots mit `🎛`-Label **plus**
Owner-Grant (das Label allein gewährt nichts — dieselbe Konstruktion wie `memoryGrant`). Öffnet die
Task-Türen über alle Programs. *Dafür:* trennt Owner- und Agenten-Entscheid im Ledger sauber.
*Dagegen:* **C5** — vier von fünf Grants haben heute keinen Halter; ein fünfter Grant, den jemand
setzen muss, hat eine gemessene Erfolgsquote von 1 von 5.

**(b) Kein neuer Prinzipal — der Owner-Arm wird identifizierbar.** `resolvePrincipal` liest den
Bearer-Fall und **joint ihn auf den Slot, aus dem er kam** (der Self-Token ist in derselben Pane;
ein Request, der beide schickt, ist eindeutig zuordenbar). `via:"cookie"` bleibt der Mensch,
`via:"bearer" + slot` ist die Orchestratorin, `via:"bearer"` ohne Slot ist `unknown`. *Dafür:*
kostet keinen Grant, den jemand setzen muss, und wirkt sofort auf alle 182 Bearer-Lands. *Dagegen:*
ein Skript ohne Self-Token bleibt `unknown` — aber `unknown` ist die ehrliche Antwort, und sie ist
besser als das heutige `owner`.

**(c) Die Orchestratorin wird eine gebundene MAIN über alle Programs.** Die Bindung existiert
bereits (`boundProgramForMain`), ist gemessen benutzt (443 Lands) und trägt ihre Provenienz. Zu
bauen wäre nur ihre Aufweitung von *einem* Program auf *alle*. *Dafür:* **kein neuer Prinzipal,
kein neuer Grant, kein neues Vokabular** — die stärkste Variante gegen C5. *Dagegen:* die Bindung
heißt dann etwas anderes als sie heißt, und `programOccupancy` müsste einen zweiten Fall lernen.

**Gegen den Konsolidierungsmaßstab dieser Notiz** (weniger Mechanik als heute) ordnen sich die drei
so: (c) < (b) < (a). Variante (a) ist die einzige, die die Zahl der Grants **erhöht**.

### D5. Was subtrahiert wird, und warum das keine Vermutung ist

- **Steward-Prinzipal retten oder streichen.** 0 Zeilen im aktuellen Audit-Log, letzte je
  2026-09-13, 0 von 267 Deploys, kein Slot mit dem Label. Seine 11 Türen sind entweder Duplikate
  von Owner-Routen (`/api/deploy`, `/api/deploys`, `/api/dispositions`) oder Lesesichten, die D1s
  `role` ohnehin ausdrücken kann. **Streichen spart eine Credential, eine gepinnte Liste und 11
  Türen** — und ist rückholbar, weil `handleStewardRoute` eine Funktion ist, keine Architektur.
  *Bedingung:* der Owner bestätigt, dass die `⚙ steward`-Rolle nicht zurückkommt (sie ist ein
  Ritual, `docs/steward.md`, kein Server-Zwang).
- **Supervisor-Bindung: binden oder streichen.** Sie zeigt seit dem 09.09. auf einen ersetzten
  Occupant. Eine stale Bindung ist der teuerste Zustand, weil sie wie eine Absicht aussieht.
- **Intake:** die Route ist auf dieser Maschine tot (`FLEET_INTAKE_SECRET` unset → 404). Sie bleibt,
  weil Plan §2 den externen Eingang ausdrücklich will — aber sie zählt heute keinen Halter.

### D5a. Kandidat der Orchestratorin: Zustellkopf aus `actor` (geprüft, nicht gesetzt)

Vorschlag (MAIN Slot 5, 25.09., ausdrücklich als Kandidat): der Kopf wird aus `actor` abgeleitet
(„Owner · Board" bei Cookie, „Orchestratorin Slot 9" bei eigener Identität), die Chat-Ansicht
rendert ihn als Metadatum, und Text mit führendem `/` bekommt keinen Kopf.

Gegen den Maßstab dieser Notiz:

| Teil | Mechanik-Delta | Urteil |
|---|---|---|
| Kopf aus `actor` statt aus `DELIVERY_SOURCE[path]` | **0 neue Felder.** Er liest den Principal aus D1/D2, und die `path`→Quelltext-Tabelle schrumpft auf die Pfade ohne Aktor (Tick-Nudges, Events). Der Owner-Eintrag wird zur Ableitung | trägt, **aber nur nach D1/D2**. Heute kann der Server „Orchestratorin Slot 9" nicht sagen, sondern nur „Owner-Credential via bearer". Welcher Text dort steht, hängt an D4: mit (b) „Owner-Token aus Slot 9", mit (a)/(c) „Orchestratorin Slot 9", ohne Zuordnung ehrlich „Owner-Credential · Skript" |
| `/`-Text ohne Kopf | **+1 Regel**, ersetzt aber einen unauditierten Umweg (`tmux send-keys`) und macht aus einer Ausnahme-Route (`model-push`) den Normalfall | trägt. Die Regel gehört in `deliveryHeader` selbst, nicht an die Route, sonst wiederholt sie sich an jeder Sendetür. Nicht gemessen: ob ein Slash-Befehl ohne Kopf bei Fable 5.1 wieder abgelehnt wird. Der Kopf wurde gegen Ablehnungen von *Paste*-Text eingeführt, ein Slash-Befehl muss als erstes Zeichen im Composer stehen, also ist er ohnehin kein Paste |
| Chat-Ansicht rendert den Kopf als Metadatum | 0 Server-Mechanik, reine Client-Arbeit | **ungeprüft**: `src/client.ts` wurde nicht gelesen. Voraussetzung ist, dass der Kopf parsebar bleibt (fester Präfix `[fleet-zustellung · `, heute gegeben) |

**Ergebnis:** der Kandidat ist mit „weniger Mechanik" vereinbar, weil er keine eigene Provenienz
erfindet, sondern die aus D2 ausgibt. Eine Reihenfolge-Bedingung gilt: vor D2 umgesetzt würde er
nur „Board" gegen „Bearer" unterscheiden können. Das ist schon besser als heute, aber es wäre ein
achtes Vokabular. Der billigste Zwischenschritt ohne D2 ist, den Kanal aus `tokenChannel` in
Kopf und `send`-Zeile zu schreiben (1 gelesenes Feld, dieselbe Funktion wie beim Land) plus die
`/`-Regel.

### D6. Reihenfolge, und warum sie so ist

1. **D1 (`resolvePrincipal`)** — ohne ihn kostet jede weitere Regel 50 Edits. Er ändert kein
   Verhalten; die 50 Blöcke werden durch einen ersetzt, der dasselbe antwortet.
2. **D2 (`actor`)** — er ist der Fütterer, den A3 verlangt, und er schließt C1, C4 und K3 F5 in
   einem Zug. Ab hier ist „wer hat das getan" für jede Mutation beantwortbar.
3. **D5 (Subtraktion)** — sobald D1 die Rollen einheitlich benennt, ist die Streichung mechanisch.
4. **D4 (die Rolle)** — erst jetzt, weil (b) und (c) ohne D1/D2 gar nicht formulierbar sind und (a)
   sonst ein sechster Grant ohne Fütterer wird.
5. **D3 (die Tabelle)** — zuletzt und ausdrücklich zuletzt: `09b577e9` verlangt Reichweite vor
   Deckel, und eine Tabelle über einem System, das seine Aktoren noch nicht benennen kann, wäre
   eine Zusicherung ohne Messpunkt.

**Der Abbruchpunkt, in §11.2-Form.** Nach D2: über die nächsten 50 Lands muss der Anteil mit
`actor.kind === "owner" && via === "cookie"` gleich dem Anteil sein, den der Owner selbst für seine
Board-Klicks nennt. Weicht er ab, sitzt der Aktor an der falschen Stelle — reparieren, **bevor** D3
eine Tabelle darauf baut. Unter 5 Bearer-Lands ohne zuordenbaren Slot in diesen 50 ist D4(b)
ausreichend und (a) unnötig.

---

## Methode

Read-only. Code gegen `main` `ba1382d9` im Lane-Worktree gelesen, Register im Haupt-Checkout
(`~/claude-fleet`) gezählt. Die sieben August-Dateien aus `git show main:<pfad>`, nicht aus dem
Working Tree.

```sh
# A.1/A.2 — Credentials und Türen
grep -c 'slots.find((x) => x.cwd && x.selfToken && secretEq(given, x.selfToken))' server.ts   # 50
grep -c 'await Bun.sleep(400); return json({ error: "unauthorized" }, 401)' server.ts          # 50
awk '/^const PRE_AUTH_ROUTES/,/^\];/' e2e/security.ts | grep -cE "^\s*('= |String.raw\`~ )"    # 63
awk '/^const STEWARD_ROUTES/,/^\];/'  e2e/security.ts | grep -coE '"= [^"]+"|String\.raw`~ [^`]+`'
awk '/^const HELPER_ROUTES/,/^\];/'   e2e/security.ts | grep -coE '"= [^"]+"|String\.raw`~ [^`]+`'
grep -o '"not a lane — [^"]*"' server.ts | sort -u | wc -l                                     # 10

# A.3 — Grants und Bindungen (Haupt-Checkout)
jq -r '[.programs[]? | select(.promotion)] | length, (.programs|length)' fleet.json            # 43, 77
jq -r '(.slots//{})|to_entries|map(select(.value!=null))
       |"slots=\(length) grant=\(map(select(.value.memoryGrant!=null))|length) delegate=\(map(select(.value.reportDelegate!=null))|length)"' fleet.json
jq -c '.supervisor' fleet.json; jq -r '.slots["2"].openedAt' fleet.json   # 1788958257705 vs 1790184006767

# A.5 — wer benutzt was
jq -r 'select(.disposition=="landed" and .ts>=1788220800000)
       | (.landedBy.kind//"absent")+" "+(.landedBy.via//"-")' lane-outcomes.jsonl | sort | uniq -c
jq -r 'select(.disposition=="landed" and .ts>=1788220800000 and .landedBy.kind=="owner")
       | [(.landedBy.via),(.landedBy.suspect//"-"),(if .landedBy.bypassed then "bypassed:"+.landedBy.bypassed.report else "-" end)]|@tsv' \
       lane-outcomes.jsonl | sort | uniq -c
jq -r 'select(.disposition=="landed" and .ts>=1788220800000 and .confirmedByHuman==true) | .landedBy.via' \
       lane-outcomes.jsonl | sort | uniq -c                                                    # 11 bearer, 1 cookie
jq -r 'select(.event=="task_release")
       | (if (.slot|type)=="number" then "main-door" elif ((.detail//"")|test("by=policy")) then "policy" else "other" end)' \
       audit.jsonl | sort | uniq -c                                                            # 116 / 48 / 0
jq -r 'select(.event=="task_spawn") | (.slot|tostring)' audit.jsonl | sort | uniq -c           # 150 null
for f in audit.jsonl*; do printf '%-22s %s\n' "$f" "$(grep -c 'steward_' "$f")"; done          # 0 / 4 / 208
jq -r '.by' deploys.jsonl | sort | uniq -c                                                     # 265 owner, 2 unattributed

# A.6 — die fünf Blocker
grep -cE 'PER_DAY|perDay|dailyCap|MAX_AUTO|costUsd|spendUsd|budgetUsd' server.ts               # 0
grep -n 'pushLandToHub' server.ts ; git remote -v
jq -r 'select((.event//"")|test("hub")) | .event' audit.jsonl | sort | uniq -c                 # 52 hub_skip, 2 land_hub_only
```

## Was nicht gemessen wurde

- **`src/client.ts` wurde nicht gelesen.** Jede Aussage darüber, was das Board anzeigt oder welchen
  Kanal ein Klick benutzt, ist nicht aus dieser Untersuchung. Die 3 `via:"cookie"`-Lands sind der
  einzige Beleg für Board-Nutzung, den diese Notiz hat.
- **Keine Suite gefahren, keine Tür live geprobt.** Es wurde kein Code geändert. Ob eine Tür sich so
  verhält, wie ihr Code sagt, ist hier gelesen, nicht ausgeführt.
- **Die Zahl der Owner-Route-Freigaben ist erschlossen, nicht gezählt.** Sie hinterlässt keine
  Audit-Zeile; die ≥ 67 im 5-Tage-Fenster stammen aus `releasedBy:"owner"` auf Lane-Zeilen, also nur
  aus Freigaben, die auch eine Lane wurden. Genau diese Unmessbarkeit ist der Befund.
- **`audit.jsonl` reicht nur bis 2026-09-20 09:56Z zurück.** Jede 5-Tage-Zahl ist ein Fenster, keine
  Historie; `audit.jsonl.1` und `.archive` wurden nur für die Steward-Frage gelesen.
- **Nicht geprüft, ob die Orchestratorin ihr Owner-Token wirklich über `ctl.sh#owner_token` bezieht.**
  Der Weg existiert und ist der naheliegende; ein Beleg pro Request existiert nicht (und kann nicht
  existieren — `tokenChannel` kennt den Kanal, nicht die Session, `server.ts:22543`).
- **Die 154 von 289 agentischen „owner"-Zeilen** sind aus K2 Ä1 übernommen (Heuristik über den
  Zeilentext), nicht von dieser Notiz nachgerechnet.
- **Nicht bewertet, ob die drei Kandidaten in D4 gleich viel Bauarbeit kosten.** Die Rangfolge dort
  ist nach *Mechanik-Delta* gebildet, nicht nach Aufwand.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-25T16:50:00Z	bestand	Credentials am akzeptierenden Code zaehlen, nicht an der Doku	docs/self-api.md nennt Scopes, nicht Secrets	server/auth.ts + grep secretEq	6 im Code, 5 mit Halter
2026-09-25T17:00:00Z	bestand	Tueren aus e2e/security.ts statt aus einem eigenen grep	die Liste IST die gepinnte Entscheidung, ein grep waere eine zweite Wahrheit	e2e/security.ts §1	63/11/7
2026-09-25T17:05:00Z	messung	Land-Fenster ts>=1788220800000 (09-01 02:00 CEST)	K1 nennt 09-01; die 2-h-Differenz erklaert 185 statt 186	lane-outcomes.jsonl	443 main / 185 owner
2026-09-25T17:10:00Z	befund	August ist GEBAUT, nicht gescheitert-am-Entwurf — Praemisse der Frage korrigiert	promotion 43/77, Self-Land 443 Lands, LandActor live	server.ts#selfLandTaskForMain	C umformuliert auf fuenf Nicht-Entwurfs-Ursachen
2026-09-25T17:15:00Z	befund	Audit-Asymmetrie ist die schaerfste Messung, nicht der Bearer-Anteil	116 auditierte MAIN-Freigaben gegen 0 auditierte Owner-Freigaben	server.ts:13470 vs 42471	C1 auf Platz 1
2026-09-25T17:20:00Z	zaehlung	not-a-lane-409er NICHT als eingesparte Mechanik zaehlen	sie sind Sinn-, keine Rechteregeln; docs/self-api.md nennt sie ein Feature	C3	Zaehltabelle ohne sie
2026-09-25T17:25:00Z	entwurf	D4 mit drei Kandidaten statt des Plan-Vorschlags	VERBOTEN-Zeile des Briefs; und (a) erhoeht als einzige die Grant-Zahl	Brief + C5	Rangfolge (c) < (b) < (a)
2026-09-25T17:30:00Z	entwurf	zwei der fuenf Blocker als nicht durchsetzbar in die Tabelle schreiben	eine Zeile, die nichts gatet, waere das Etikett aus C1	D3	3 von 5 durchsetzbar, 2 benannt
2026-09-25T18:05:00Z	eingang	Zustellkopf-Befund der MAIN in A/C/D aufgenommen, am Code geprueft	deliveryHeader liest path, nicht tokenChannel; keine /-Ausnahme	server.ts#deliveryHeader, :42963; 399 owner-sends ohne Kanal-Feld	D5a: Kandidat vereinbar, nach D1/D2
```
