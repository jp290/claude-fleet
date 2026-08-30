---
frage: Delta-Audit der Betriebsnahtstellen Task · Dispatch · Lane · Slot · Occupant · Session · Harness · Rückmeldung — wo zeigt Fleet einen plausiblen Zustand, obwohl kein eindeutig verantwortlicher Agent selbständig fortfahren kann?
urteil: Vier solcher Nahtstellen leben heute; die teuerste ist eine fertige, im Betrieb dunkle Succession-Automatik (tickMigrate existiert, läuft aber nie, weil MIGRATE_PCT ohne FLEET_MIGRATE_PCT auf 0 steht und die Zeile 20184 den Tick dann nicht plant), die zweitteuerste ein rotes Post-Land-Audit ohne bewaffnete Watch, das keinen Agenten erreicht, während die Task-Zeile done bleibt.
bereich: [lane-lifecycle, autoritaet, sensorik, helper-portal]
belege: [Live-Process-Env PID 91431 (19 FLEET_*-Schlüssel, kein FLEET_MIGRATE_PCT), fleet.json slots/helperDevices/watches, audit.jsonl 2026-08-30 06:31–09:53Z, post-land-audits.jsonl (5262ed08 rot, dbb2e094 rot), lane-outcomes.jsonl Z. 5262ed08, ~/.claude/projects/-Users-owner-claude-fleet/862bd20d….jsonl Tail, tmux list-sessions s12/s13, GET /api/sessions 12/13, docs/messungen/2026-08-30-private-repo-o-prozess-forensik-anhang.md:24, docs/messungen/2026-08-30-worktrail-audit-stufe2-kontext-modellmix.md]
nicht-gemessen: Kontext-Historie pro Slot (Beobachtung 2 bleibt deshalb im Drift-Teil unbestätigt); der 44,5-%-Wert der Beobachtung 1 (nicht auffindbar; belegt sind 35–38 % alte MAIN und 44,7 % B2-Worker); ob der Daemon auf secondhostlinux1 den Wunsch-Support überhaupt hat (läuft auf einer anderen Maschine); Pane-Inhalte und Suite-Mutex-Belegung im Detailfenster 06:31–09:23Z (per Auftrag ausgeschlossen bzw. nicht geführt).
stand: 2026-08-30
---

# Agent/Slot/Session-Nahtstellen — Delta-Audit (2026-08-30)

## Frage

Wo kann Fleet einen plausiblen Zustand zeigen — Slot alive, Task done, Device aktiv, MAIN gebunden —,
obwohl kein eindeutig verantwortlicher Agent selbständig fortfahren kann? Die Layer-Inventur von
2026-08-17 wird nicht wiederholt; vier Controller-Beobachtungen werden als Ausgangsbehauptungen geprüft.

## Ergebnis

Vier Nahtstellen mit genau dieser Signatur, nach Betriebskosten gerangt (F1 > F2 > F3 > F4). Der
gemeinsame Mechanismus ist immer derselbe: ein Sensor existiert (ctx %, Post-Land-Audit, pane-Agent,
Device-Mode), aber kein getippter Konsument ist angeschlossen — die Zustandsfläche bleibt grün, und
der nächste Schritt hängt an Owner-Hand oder an einem Agenten, den nichts erreicht.

## Vorgehen

Graphify-Query (Graph 2026-08-30, Haupt-Checkout) zur Leitfrage → Anker aliveInfo/ensureSlot/
teardownSlotOccupant/handleSelfSucceed; Pflichtlektüre server.ts 1953–2393, 5483–5937, 6335–6405,
7028–7235, 8786–9150; working-circle-analysis 48–210/264–330; system-capabilities.generated 71–126;
self-api.md (fleet-report/B4, succeed/retire, supervisor-watch); src/protocol.ts (Rückweg-
Vokabular). Live-Evidenz read-only: fleet.json (slots, helperDevices, watches, supervisor, tasks),
audit.jsonl Zeitfenster, post-land-audits.jsonl, lane-outcomes.jsonl, /api/sessions, tmux
list-sessions, Transcript-Tails, Prozess-Env des lebenden Servers (ps eww PID 91431). Keine Mutation,
keine Queue-/Session-/Modusänderung, keine Nachricht, kein Land.

## Ausgangsbehauptungen

1. **Private-repo-o-MAIN brauchte bei 44,5 % Kontext einen manuellen Succession-Anstoß** —
   MECHANISMUS BESTÄTIGT, ZAHL UNBESTÄTIGT. Der manuelle Anstoß ist belegt (Anhang :24: HANDOFF
   22:09, Owner „mach^^“ 22:51, neue MAIN 22:56 — 42 min Wartezeit auf Owner-Hand), und er war
   strukturell notwendig, weil die einzige Kontext→Succession-Automatik im Betrieb dunkel ist (F1).
   44,5 % findet sich in keinem Dokument; belegt sind 35–38 % (alte MAIN, Stufe-2) und 44,7 % (B2-
   Worker, nicht MAIN).
2. **P0 9912a68a war terminal, während der Controller in Suite-Betreuung driftete** — TERMINAL
   BESTÄTIGT, DRIFT UNBESTÄTIGT. fleet.json: 9912a68a done, note „landed (fleet/260830063131-c091)“;
   audit.jsonl 09:23:22Z land_actor owner via=bearer, 09:23:23Z slot_kill 2 landed; Post-Land-Audit
   dazu ROT erst 09:48:31Z (F2). Suite-Betreuung im Fenster ist belegt (private-repo-o-Lands + Audits
   09:19/09:49), aber „Controller driftete“ hat keinen Sensor: es gibt keine Kontext-Historie pro
   Slot (Slot 6 zeigt JETZT 59,9 %, belegt nichts über 06:31–09:23Z).
3. **secondhostlinux1 meldete mode active bei desiredMode quiet und ohne Claims** — BESTÄTIGT.
   fleet.json helperDevices: mode „active“, load 0, desiredMode „quiet“, lastSeen 09:53:53Z (frisch,
   heartbeatet also), helperClaims {}. Mechanismus F4.
4. **Slots 12/13 lebten ohne Task/Mission, Slot 13 trotz geschlossener Agentensitzung** —
   BESTÄTIGT MIT LESARTEN-VORBEHALT. Beide Slots: cwd gesetzt, taskId/originId/programId/worktree/
   mission alle null, tmux s12/s13 vorhanden, /api/sessions agent „alive“ (12: 10 %, 13: 30,3 %
   ctx). Slot 13 offen seit 2026-08-29T20:10Z. „Geschlossene Agentensitzung“: im Lesart-Turn-Ende
   belegt (Transcript letzter Eintrag 08:55:35Z stop_hook_summary/turn_duration — Gespräch beendet,
   Fläche bleibt alive); im Lesart-Prozess-tot widerlegt (agentInfo meldet den Agentenprozess JETZT
   lebend). Mechanismus F3.

## Befunde

### F1 — Die Succession-Automatik ist fertig gebaut und im Betrieb dunkel: MAIN-Ablösung braucht Owner-Hand

**Mechanismuskette:** ctx % wird pro Slot aus dem Transcript gemessen (contextFill, server.ts:20621)
→ tickMigrate würde MAIN-Sessions ab einer Schwelle mit fertiger Übergabenachricht nudgen
(„HANDOFF committen, dann POST /api/self/succeed“, server.ts:11703–11760) → aber der Tick wird nur
geplant, wenn MIGRATE_PCT > 0 (server.ts:20184), und MIGRATE_PCT defaultet auf 0 ohne
FLEET_MIGRATE_PCT (server.ts:11399) → der lebende Server (PID 91431) führt 19 FLEET_*-Schlüssel,
aber keinen FLEET_MIGRATE_PCT; audit.jsonl enthält null migrate-Ereignisse → /api/self/succeed
erreichbar nur durch die Vorgängerin selbst (server.ts:7166) → einziges verbleibendes Steuerung:
Owner-Prosa in der Pane.

**Konkrete Kosten:** pro MAIN-Generation eine Owner-Berührung plus Stall, solange der Owner nicht
sieht: 42 min dokumentiert (22:09→22:51), anschließend Nacht-Stall 23:12→02:52 (Anhang :24, :20).
Bei mehreren aktiven Programmen skaliert das pro Programm.

**Belege:** server.ts:11399, 20184, 11711–11760; ps eww 91431 (Env, heute); audit.jsonl (0 Treffer
„migrate“); Anhang :24; Stufe-2-Urteil (alte MAIN 35–38 % fuhr die Runde neun Stunden nicht).
**Status:** VERIFIED (Code + Env + Audit-Abwesenheit + dokumentierter manueller Anstoß); die
44,5-%-Zahl bleibt UNCONFIRMED.

**Fehlende Validierung/Test/Fehlerbehandlung:** kein e2e deckt die Planungsbedingung
`MIGRATE_PCT > 0 ⟺ tickMigrate läuft`; nichts fällt auf, wenn ein Betriebsparameter ein ganzes
Feature stilllegt (stilles Dark-Feature — derselbe Defekt wie der alte Watchdog-VERIFY_CMD-Befund,
Stichprobe 2026-08-26). Kein gave-up-Fallback an den Owner, falls die Vorgängerin drei Nudges
ignoriert (audit „migrate_gave_up“ existiert als Codepfad, feuerte nie).

**Gegenbeobachtung, die F1 widerlegte:** ein einziger migration-Nudge oder migrate_gave_up in
audit.jsonl, oder FLEET_MIGRATE_PCT > 0 im Prozess-Env — beides habe ich negativ geprüft.

### F2 — Rotes Post-Land-Audit ohne bewaffnete Audit-Watch erreicht keinen Agenten; die Task-Fläche bleibt done

**Mechanismuskette:** Land setzt die Task auf done (note „landed“) und tötet die Lane
(slot_kill … landed, audit.jsonl 09:23:23Z) → das Post-Land-Audit läuft asynchron (25 min später)
und wird rot (post-land-audits.jsonl: main@5262ed08, exit 1, 09:48:31Z) → mintAuditEvents
(server.ts:6984) liefert NUR an bewaffnete `{kind:"audit"}`-Watches → die einzige Audit-Watch in
fleet.json zielt auf das private-repo-o-Repo (armed:false) → kein FleetEvent, keine Attention, kein
Empfänger; es bleiben console.log (server.ts:13973), der Trail und die Board-Poll-Spalte → „this
audit gates nothing; ↩ undo-land is the rollback“ ist ein Owner-Akt.

**Konkrete Kosten:** ein roter main-Zustand auf dem Produktionsrepo bleibt liegen, solange niemand
die Audit-Spalte liest; im selben Fenster ein zweiter Fall (main@dbb2e094, 07:50:47Z, rot, gleiche
Klasse). Beide Tasks stehen bis heute done. Für eine Programm-lose, Owner-dispatchte Lane (hier:
programId null) existiert begrifflich niemand, der eine Watch bewaffnet — die Lane ist tot, bevor
ihr Audit läuft.

**Belege:** post-land-audits.jsonl (zwei rote Zeilen, Zeitpunkte); fleet.json watches (4 Zeilen,
keine für claude-fleet); server.ts:6984–7009, 13973–13976; audit.jsonl 09:23:22→09:48:31.
**Status:** VERIFIED (Ledger + Code); die Controller-Drift-Komponente von Behauptung 2 bleibt
UNKNOWN (kein Sensor).

**Fehlende Validierung/Test/Fehlerbehandlung:** der Negative-Fall „rote Zeile, keine Watch bewaffnet“
ist ungetestet (e2e/watch.ts deckt B4/fleet-report und bewaffnete Watches); kein Reconcile zwischen
done-Task-Zeile und späterem roten Audit ihrer main; die 25-min-Lücke Land→Audit ist unsichtbar auf
der Task-Fläche.

**Gegenbeobachtung, die F2 widerlegte:** eine bewaffnete claude-fleet-Audit-Watch in fleet.json oder
ein offenes FleetEvent kind „post-land-audit“ mit receiver ≠ null im Zeitraum — beides negativ
geprüft.

### F3 — „alive“ ist Prozess-Fakt: Plain-Slots ohne Task/Mission zeigen lebendige Oberfläche, aber ihr Intent lebt nur im Scrollback

**Mechanismenkette:** aliveInfo/agentInfo sind Pane-Prozess-Sonden (server.ts:4577, 4584, tickGit)
→ ein Plain-Slot (cwd gesetzt, worktree null) hat per Konstruktion keinen tragenden Intent:
Slot.mission gilt „per SESSION, not per slot“, und für Plain-Slots steht der Kommentar wörtlich,
dass ihr Intent „in pane scrollback [lebt] and dies at /clear“ (server.ts:2122 ff.) → drift/gate
antworten 409 „not a lane“ → der 2-s-Heal-Loop (ensureSlot, server.ts:5505) hält die Fläche mit
Resume sogar unbegrenzt aufrecht → keine Uhr, kein Stakeholder, kein Label (beide null).

**Konkrete Kosten:** Slot-Budget (8 von 16 belegt, zwei davon zombie-artig), rotierte selfTokens
bleiben im Umlauf, Board-Rauschen mit unbenennbaren Reihen — und die Leitfrage-Antwort im Kern:
kein Agent kann begründet fortfahren, weil nichts sagt, wofür die Session läuft. Slot 13 hält das
seit über 14 Stunden, sein letzter Gesprächs-Turn endete 08:55Z.

**Belege:** fleet.json slots 12/13 (alle Intent-Felder null, sessionId gepinnt);
~/.claude/…/862bd20d….jsonl Tail (stop_hook_summary 08:55:35Z); /api/sessions (agent alive, ctx
30,3 %); tmux s12/s13 vorhanden; server.ts:2122, 5505.
**Status:** VERIFIED (Behauptung 4 ohne-Task/Mission-Teil und Turn-Ende-Lesart).

**Fehlende Validierung/Test/Fehlerbehandlung:** kein Sensor für „Konversation seit X beendet,
mission null“ (lastOutput wird nur für quietUntil bereinigt, kein Verbraucher); kein Test, dass ein
Plain-Slot ohne Mission als eigene Klasse sichtbar wird.

**Gegenbeobachtung, die F3 widerlegte:** mission/taskId/label gesetzt auf 12/13, oder ein
Steward-/Supervisor-Pulse, der Plain-Slots triiert — beides negativ geprüft (supervisorView deckt
Programs, der Drift-Puls Lanes).

### F4 — Device-Wunsch ist stumm: mode active bei desiredMode quiet hat keine Anwendungs-Quittung

**Mechanismenkette:** mode ist Geräteselbstbericht aus dem Heartbeat, desiredMode die Owner-Wunsch
(server.ts:13421–13445, getrennte Faktenlagen) → der Daemon zieht den Wunsch im Heartbeat-Reply
(Pull; README „the quieter of the two modes wins“) → die Job-Ableitung fragt beide korrekt ab
(helperClaimCandidateExists, server.ts:13465–13470: Wunsch oder Selbstbericht ≠ active ⇒ kein
Kandidat) → aber nichts quittiert die Anwendung des Wunschs und nichts alarmiert bei Dauer-Divergenz:
desiredSet sagt „Owner hat gesagt“, nicht „Gericht hat angewendet“.

**Konkrete Kosten:** Board zeigt ein „aktives“ Gerät mit Frische-Herzschlag (lastSeen 09:53:53Z),
das strukturell keine Jobs bekommt (Claims {}); der Owner kann „Daemon ignoriert Wunsch“ nicht von
„alter Daemon ohne Wunsch-Support“ unterscheiden — die Divergenz kann monatelang plausibel stehen.

**Belege:** fleet.json helperDevices secondhostlinux1 (mode active, desiredMode quiet, load 0);
helperClaims {}; server.ts:13465; helper-daemon/README.md:38.
**Status:** VERIFIED.

**Fehlende Validierung/Test/Fehlerbehandlung:** kein appliedAt/ack im Heartbeat-Protokoll; kein
e2e-Fall für Dauer-Divergenz (e2e/helper-portal.ts testet Übergänge, nicht Verharren).

**Gegenbeobachtung, die F4 widerlegte:** ein Claim des Geräts nach der Wunschsetzung, oder der
nächste Heartbeat meldet mode quiet — beides negativ geprüft (mode blieb active bei frischem
lastSeen).

## Surface-Matrix (apply / unsupported / not-applicable je Befund)

| Surface | F1 Succession | F2 Rot-Audit | F3 Plain-Slot | F4 Device-Wunsch |
|---|---|---|---|---|
| Protocol/Wire (src/protocol.ts) | not-applicable (kein neuer Statuswert nötig) | apply (Owner-Inbox-Fall ist Muster, kein Protokollneuling) | apply (Intent-Klasse als Sichtfeld) | apply (appliedMode im Heartbeat-Reply) |
| Server (server.ts) | apply (Planungsbedingung 20184 / Env) | apply (mintAuditEvents-Fallback) | apply (Sichtfeld-Projektion) | apply (Divergenz-Markierung) |
| Client/Board (src/client.ts) | not-applicable (nudge ist Pane-Text) | apply (rote Zeile prominent zur Task) | apply (Klasse rendern) | apply (Divergenz-Chip) |
| Reverse-State (fleet.json) | unsupported (Tick ist bewusst prozess-lokal) | not-applicable (Event, kein State) | unsupported (Intent existiert nicht als Feld) | apply (firstDivergedAt) |
| Docs (self-api/AGENTS) | apply (Dark-Feature dokumentieren ODER beleuchten) | apply (Rückfall dokumentieren) | apply | apply |
| Probes (e2e/pins.ts) | apply (Pin MIGRATE_PCT>0 ⟺ Tick geplant) | apply (Negativ-Fall ohne Watch) | apply | apply (Divergenz-Fall) |

## Folgebriefs (queue-fertig)

1. **B1 — Migrate-Tick beleuchten oder stilllegen (Owner-Entscheid).** Scope:
   FLEET_MIGRATE_PCT mit Schwelle (Band 25/30 %) setzen und `bun e2e/pins.ts`-Regel
   „MIGRATE_PCT > 0 ⟺ tickMigrate geplant (server.ts:20184)“ pinnen — oder Feature stilllegen und
   in AGENTS.md als bewusst dunkel dokumentieren. Done: eine der beiden Wahrheiten steht im Baum,
   nicht nur im Env. Verify: `bun e2e/pins.ts` grün bzw. AGENTS.md-Zeile im Diff.
2. **B2 — Rotes Post-Land-Audit bekommt einen Default-Kanal.** Scope: mintAuditEvents-Fallback auf
   die Owner-Inbox (Muster fleet-report B4, eigener Budget-Deckel), wenn keine Watch bewaffnet ist;
   Reconcile-Hinweis auf der done-Task-Zeile. Done: eine rote Zeile ohne Watch erzeugt genau eine
   owner-inbox-Zeile. Verify: Negativ-Fall-e2e in e2e/watch.ts neben der B4-Familie.
3. **B3 — Plain-Slots werden als scrollback-only sichtbar.** Scope: /api/sessions projiziert
   `intent:"scrollback-only"` für cwd gesetzt ∧ mission null ∧ taskId null ∧ worktree null;
   Board rendert die Klasse; kein Verhalten, kein Auto-Kill. Done: Slots wie 12/13 sind als Klasse
   erkennbar, ohne Pane zu lesen. Verify: e2e-Check neben der sessions-Familie plus Client-Render.
4. **B4 — Device-Wunsch-Ack.** Scope: Heartbeat-Reply/DeviceView um firstDivergedAt (mode ≠
   desiredMode seit X) ergänzen; angewandt wird nichts. Done: die secondhostlinux1-Klasse ist im
   Board als Dauer-Divergenz lesbar. Verify: e2e/helper-portal.ts-Fall „mode bleibt active nach
   Wunsch, firstDivergedAt gesetzt“.
5. **B5 — Kontext-Historie pro Slot.** Scope: Ring-Puffer (ts, pct) je belegtem Slot in einer
   Datei neben lane-outcomes.jsonl, vom ctx-Tick geschrieben. Done: Fragen der Form „wo war Slot 6
   um 09:00“ sind aus dem Ledger beantwortbar. Verify: Sensor schreibt eine Zeile pro Tick;
   pins-Regel gegen Feldform.

## Nicht gemessen

Kontext-Historie pro Slot (Behauptung 2, Drift-Teil — deshalb B5); der 44,5-%-Wert (Behauptung 1);
Daemon-Fähigkeiten auf secondhostlinux1 (fremde Maschine); Pane-Inhalte aller Formen und die
Suite-Mutex-Belegung im Detailfenster 06:31–09:23Z (per Auftrag ausgeschlossen); ob die zweite
Succession heute 09:15Z ebenfalls einen Owner-Anstoß brauchte (Audit-Lage zeigt die Sequenz, nicht
den Auslöser).
