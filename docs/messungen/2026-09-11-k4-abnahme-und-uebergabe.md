# K4 (`288f6359`) — Abnahme, und der Stand, den die Nachfolgerin erbt

*Program-MAIN Fleet-Betrieb (Slot 1), Program `f170dc46`, 2026-09-11 ~13:4x, `ctx 30,4 %`.
Anschluss an `docs/messungen/2026-09-11-k1-abnahme.md`. Position 2 aus
`docs/arbeitsfolge-fleet-2026-09-11.md`.*

## K4: gelandet und angenommen

Kandidat `cf7280b4` → main `cf7280b4` (`mainBefore f1d47ef0`, fast-forward, kein Rebase — die Shas
der Lane gelten hier ausnahmsweise unverändert). Land-Note: volle Kette, alle sieben Schritte,
`exitCode 0`, `ms 141261`, `waitMs 0`, `hubPush ok`. `actor {kind: main, slot 1, program f170dc46,
task 288f6359, sessionIdMatch: exact}` — **kein `suspect`-Flag**, wie schon bei K1.

**Eine Falle, die fast ein grünes Land rot gemacht hätte.** `grep -cE '^(FAIL|[0-9]+ FAILURES)'`
auf `~/.local/state/claude-fleet/knackpunkte-k4-proof.log` liefert **7**. Alle sieben sind
Fixture-Nutzlast IM DETAIL eines Checks — `fleet/named-red-fixture`, `remote failure alpha`/`beta`,
`repo-worker verify: (parenthesised) name` —, also genau der Text, auf dem die Sonden ihre
Fail-Namen-Extraktion prüfen. Echter Tail: `ALL PASS`, Zeile 569; ein einziger Lauf (beide run-ids
sind Fixture-Literale mit festen Daten). **Regel für die Nachfolgerin: in einer Suite, die
Suite-AUSGABEN prüft, ist die Zählung anchored-FAIL wertlos — es zählt der Kontext.**

**N3, Zähler A und B getrennt.** A: das Verdict steht auf der QUELLNOTIZ `4aeeec19` (nicht auf der
Task-Zeile — mein erster Blick ging auf die falsche und wurde korrigiert): `taskId 288f6359`,
`branch fleet/260911104619-d21a`, `verdict erledigt`, mit Begründung statt Quittung. B, am Diff
nachvollzogen: die Notiz schlug den PING an die Program-MAIN vor; gebaut ist der Join
(`repo+branch+mainAfter` → `LaneOutcome.programId`, nicht über `taskId`, weil eine Task keinen
Branch trägt), die Zustellung aber als Inbox-Zeiger statt als Paste, weil die Stopplinie das Paste
verbietet. Abweichung vom Wortlaut der Quelle, begründet und protokolliert — das ist die Form, in
der N3 funktioniert.

**Die Stopplinie ist breiter gebaut als verlangt, und ich habe sie so angenommen.**
`server.ts#nudgeableUnread` schließt `audit-red` für JEDES Program vom Nudge aus, nicht nur für
`f9dc8e10`. Filter am TRIGGER, nie am Record: geschrieben, gezählt, ausgeliefert wie jedes andere
Kind, nur die Pane bleibt still — und der Nudge-Text sagt es, wenn er eines auslässt
(`audit-red nicht mitgezaehlt: es tippt nie in eine Pane`), damit die Zahl in der Pane nie als
Inbox-Gesamtzahl gelesen wird. **Die Konsequenz, ausdrücklich:** ein Program, das einen Pane-Anstoß
bei rotem Audit wollte, bekommt ihn nirgends mehr; die Inbox ist der einzige Kanal. Der Brief ließ
beide Formen zu; die allgemeine kommt ohne Sonderfall aus.

**Der mitgenommene Defekt war echt.** Auf main stand `JSON.parse(last) as PostLandAuditRow` — eine
Zeile, die parst, aber keine Audit-Zeile ist, wurde `lastPostLandAudit`, und der Leser warf dann bei
JEDEM `/api/sessions`-Poll: Board-Hauptroute dauerhaft 500. Die Lane lief beim Bauen ihrer eigenen
malformed-Gegenprobe hinein und hat `validAuditRow` plus eigenen Check nachgezogen. Reparatur im
Write-Set, wie freigegeben; ohne sie ist die verlangte Gegenprobe nicht fahrbar. Kein Rückbau.

**Offener Rest, von der Lane benannt, von mir als Rest getragen:** Slot-Recycle während Await und
leere Covers sind nur am Code belegt, nicht geprobt.

## Was die Nachfolgerin übernimmt

**1 · K2 `92ffd17c` ist FREIGEGEBEN und läuft an** (`queued`, `claude-opus-5[1m]`/high, Pin
`ba7df947`). Bei der Abnahme drei Dinge: die Quelle nur **bezüglich F4** beurteilen, die übrigen
Punkte des Bündels bleiben offen · der Done-Test braucht **State-Injektion** (101 Programs in die
Zustandsdatei + Restart, Muster `e2e/programs.ts`), nicht 101 Route-Aufrufe, weil `MAX_PROGRAMS`
eine harte Konstante ohne Env-Tür ist · die Probe muss ROT werden, wenn die Referenzprüfung entfernt
oder erst nach `capPrograms(loaded)` läuft. Ein Brief-Nachtrag ist NICHT nötig: der Kompiler schreibt
die Verdict-Tür selbst in jeden Gründungsbrief (`task-notes.ts:218/224`).

**2 · Zwei Audits laufen, und ihre Watches sterben mit mir.** Das Audit zu K1 (`bb28cc42`) ist
bereits grün eingetroffen und geprüft: 37,1 min, `ran 4107 / failed 0`, nicht proportional, ein
einziger Cover — ein echter Lauf, kein leeres Grün. Das Audit zu **K4 (`cf7280b4`)** war beim
Schreiben dieser Zeile noch unterwegs; mein Watch `8cd36d01` wird nicht vererbt. **Neu abonnieren:**
`POST /api/self/watch {"kind":"audit","repo":"/Users/owner/claude-fleet","mainAfter":"cf7280b4e952845c66d2880705a4ddb563ec2e12","idleSec":0}`.
Eine fehlende Ledger-Zeile heißt bis ~35 min nach dem Land „läuft noch", nie „verloren".

**3 · `idleSec:0` ist für eine arbeitende MAIN Pflicht, nicht Geschmack.** Mit dem Default 60
kommt die Zustellung nie, weil die Lane landet und schließt, bevor diese Pane 60 s idle wird.
Zugestellte Events quittieren, sonst frisst der eigene Rückkanal seinen Deckel.

**4 · K1 ist gelandet, grün auditiert — und ohne Wirkung.** `codeBehind: true`, und der Trail trägt
NULL Zeilen mit dem neuen `phase`-Feld. Dasselbe gilt jetzt für K4. Deploy ist Owner-Akt
(`4872457b`); die von Position 1 verlangte Vorher/Nachher-Rate ist bis dahin nicht messbar.
Baseline steht: 14 188 `composer`-Holds am 09-11.

**5 · Der Owner-Fall ist offen und gehört NICHT zu K1.** `SendNotAccepted` auf dem Codex-Pfad,
Slot 10 — Fleet hat getippt, der Enter kam nicht an; dritte Instanz um 11:31:53. Rollback-Race und
Glyph-Fehlblick sind widerlegt, der Sender als Variable ausgeschlossen. Kleinster Folgeschritt
(read-only Messlane, drei Variablen einzeln, Wahrheitsquelle ist die Codex-Rollout-Datei) steht in
`docs/messungen/2026-09-11-sendnotaccepted-codex-slot10.md`. **Wartet auf das Wort des Owners**, weil
er die Sonde freigeben muss — nicht auf Arbeit.

**6 · Zwei kleine Fallen, die sonst neu entdeckt werden.** Die gespeicherte `spawn`-Zeile von
`288f6359` steht weiter auf `codex/gpt-5.6-sol`, obwohl die Lane als Opus lief — ein **Requeue**
würde sie als Codex neu gründen. Und `/Users/owner/claude-fleet/.hub-prototype` ist ein
Waisen-Worktree (detached `45622dbf`, untracked `prototype/` darin); er blockiert kein Land, weil
keine Überlappung entsteht, ist aber ungelandete Arbeit ohne Slot.

**Nicht anfassen:** keine zweite Lane auf `server.ts`, solange K2 läuft. Kein Wiederaufbau des
Wellenmotors. Audit-Inbox für `f9dc8e10` ja, Audit-Nudge nein (jetzt allgemein gebaut).
