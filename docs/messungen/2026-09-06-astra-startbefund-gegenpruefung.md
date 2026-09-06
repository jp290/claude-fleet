---
frage: Halten die pruefbaren Behauptungen der ASTRA-Startbefund-Notiz (Task 580cc453) gegen Code und Live-Zustand, und ist Hub-Schnitt 1 aus den drei genannten Routen client-only baubar?
urteil: Baubar mit einer benannten Ableitungsregel (das Program hat kein repo-Feld, aber 10 von 11 aktiven Programs bekommen es eindeutig aus ihren Task-Zeilen, eines bleibt unknown); die Notiz irrt in einem Punkt, denn die zweite Astra-Session existiert (Slot 3, Program eec69528, seit 2026-09-05 06:12Z), und der programuebergreifende Lesepfad ist gebaut, aber gerade von niemandem gehalten
bereich: [fleet-hub, programs, lesescope]
belege: [server.ts#programOccupancy, server.ts#isBoundSupervisor, server.ts#programDigest, server.ts#taskDigest, docs/fleet-hub-overlay-2026-09-06.md, 793513fbfb04157c2232c5755c8accd9cae83148]
nicht-gemessen: src/client.ts (kein Blick auf den vorhandenen Renderer), keine Browser-Canary, keine Suite gefahren; die Volltexte von 5e3823c7 und 0544306f nicht gelesen
stand: 2026-09-06
---

# Gegenpruefung der ASTRA-Startbefund-Notiz (Task 580cc453)

2026-09-06, Lane `fleet/260906175114-c807`, Baum `793513f`. Frage: **halten die pruefbaren
Behauptungen der Notiz, und traegt die Datenlage den vorgeschlagenen Hub-Schnitt 1?**

Die Lane wurde auf die Notiz selbst gegruendet (`580cc453`, `kind=auftrag`, `source=main`,
`programId=e3b3a064`, `releasedBy=owner`, erstellt 2026-09-06 17:02:33Z). Ihr Text ist ein Bericht
ohne Imperativ und sagt von sich „Beratung, kein Auftrag". Diese Notiz ist deshalb, was eine Lane
dazu beitragen kann: die Behauptungen mechanisch nachziehen und die eine Frage beantworten, die die
Notiz offen laesst („Produktcode und Antwortfelder hier nicht voll untersucht").

## Ergebnis

**1 — Das Program traegt kein `repo`-Feld; die Repo-Achse des Hubs ist trotzdem client-only
ableitbar.** `programDigest` (server.ts:1581) sendet `id status title createdAt`, `publicProgram`
(server.ts:1593) sendet das Program-Objekt, und dieses Objekt hat 16 Schluessel, `repo` ist keiner:
0 von 11 aktiven Programs tragen eins. Die beiden anderen Achsen tragen es: die Slot-Zeile in
`GET /api/sessions` sendet `repo` (server.ts:24222 ff., `s.worktree?.repo ?? repoInfo.get(s.id)`),
und 200 von 200 Task-Zeilen haben `repo`, das `taskDigest` (server.ts:2053) zusammen mit
`programId` weiterreicht. Damit ist die Ableitungsregel `repo(Program) = repo seiner Task-Zeilen`:
sie loest 10 der 11 aktiven Programs eindeutig auf (je genau ein distinktes Repo, Task-Zahlen 1
bis 24, darunter zwei Nicht-Fleet-Repos: `private-repo-p` fuer `07ee8a6d`,
`private-repo-j.worktrees/game-maker-private-repo-j` fuer `2c073232`). Ein Program bleibt unbestimmt:
`f99e9354` („Private-repo-o") hat null Task-Zeilen und eine tote MAIN-Bindung — dort greift Astras
eigener Fallback, `unknown` anzeigen. Der Umweg ueber die lebende MAIN-Bindung loest genau 0
zusaetzliche Faelle, taugt also nicht als primaere Regel.

**2 — 5 von 11 aktiven Programs haben eine MAIN-Bindung, die keinen lebenden Insassen mehr
benennt.** Kriterium ist das des Servers (`programOccupancy`, server.ts:6728: `live?.cwd &&
live.id === main.slot && live.openedAt === main.openedAt`). Stale: `f99e9354` (Slot 10, inzwischen
Controller), `cd110019` (Slot 8), `07ee8a6d` (Slot 4), `2c073232` (Slot 7, Slot leer),
`b2aa5b45` (Slot 9, inzwischen Astra). Live: `66499a03`, `f170dc46`, `79036e9a`, `eec69528`,
`233e1c2b`, `e3b3a064`. Das ist kein neuer Befund, sondern ein bereits modellierter: `/api/sessions`
sendet `programsStale` als Zahl. Fuer den Hub heisst es, dass die Slot-Achse als Repo-Quelle fuer
Programs strukturell luecklig ist — siehe 1.

**3 — Die Notiz beantwortet die Frage nach einer zweiten Astra-Session falsch.** Slot 3 traegt
`model: "astra"`, Label „Program-MAIN: Codebase-Review von aussen", ist MAIN von `eec69528`
(Occupancy `live`) und offen seit 2026-09-05 06:12:39Z, also 34 Stunden vor der Notiz. Der
Mechanismus des Irrtums steht im Belegsatz der Notiz selbst: `GET /api/self/program-execution`
bindet hart an den eigenen Token-Slot und kann ueber einen fremden Slot strukturell nichts sagen —
aus „meine Bindung ist exakt" folgt nicht „ich bin die einzige". Praktische Folge: `1af3fa1f`, das
die Notiz als naechsten gemeinsamen Dispositions-Input nennt, traegt `programId=eec69528…`, gehoert
also der anderen Astra-Session; es steht `queued`, `slot=null`.

**4 — Der autorisierte programuebergreifende Lesepfad ist gebaut, aber gerade von niemandem
gehalten.** Im selben Filter, den die Notiz zitiert, steht als dritter Disjunkt `isBoundSupervisor(s)`
(server.ts:19101, benutzt 23366): der gebundene Supervisor liest den INHALT jedes Programs, nicht nur
den eigenen. Die Bindung zeigt auf Slot 5 mit `openedAt` 2026-08-23 15:08:46Z; Slot 5 traegt heute
eine Lane mit `openedAt` 2026-09-06 15:54:03Z. `isBoundSupervisor` ist damit fuer jeden aktuell
false. Die offene Frage der Notiz lautet also nicht „gibt es einen Lesepfad", sondern „wer haelt
ihn" — eine Owner-Entscheidung, kein Bauauftrag.

**5 — Die zitierten Stellen und Zahlen halten.** `server.ts:23356-23368` umfasst am Baum `793513f`
genau den `/api/self/programs`-Handler samt Filter. Die Zeilenzahlen der drei gepinnten Dokumente
stimmen exakt (SYSTEM.md 243, `2026-09-05-astra-s0-zielbild.md` 152,
`fleet-hub-overlay-2026-09-06.md` 112). Der Pin `e5f3596` ist Vorfahr von main, main steht zwei
Commits weiter (`c76ece2`, `793513f`); beide fassen nur `HANDOFF.md`, `docs/messungen/INDEX.md` und
eine neue Messnotiz an, keine der drei gepinnten Dateien — die Zielbild-Lesung ist also aktuell,
der Pin nur nominell veraltet.

**6 — Der Self-Token-Lesescope haengt am Prinzipal, nicht am Token.** Als Lane gemessen:
`/api/tasks`, `/api/programs`, `/api/sessions` je `401 {"error":"unauthorized"}`;
`/api/self/programs` und `/api/self/program-execution` je `409` („programs are brackets above lanes")
— eine Lane hat also nicht einmal Astras Rueckfallpfad. Der 200er der Notiz auf `/api/self/programs`
ist Nicht-Lane-Verhalten; dass er nur das eigene Program enthielt, folgt aus dem Filter (1./2.
Disjunkt greifen, der dritte ist nach 4. tot), gemessen habe ich das nicht.

**7 — Die Land-Takt-Zahl ist aus den drei Routen nicht ableitbar.** Die Ledger sind Dateien
(`LANE_OUTCOME_FILE` server.ts:131, `POSTLAND_AUDIT_FILE` server.ts:152); `/api/sessions` fuehrt an
Land-Fakten nur `postLandAudit` (juengster Audit) und `postLandAuditLive`, keine Kadenz je Repo.
Astras Fallback („unknown anzeigen und die Datenluecke benennen") ist damit nicht hypothetisch,
sondern der eintretende Fall.

## Methode

Alles gegen `main=793513fbfb04157c2232c5755c8accd9cae83148` und die Live-`fleet.json`
(mtime 2026-09-06 19:53:20+0200), ohne Schreibzugriff:

```
git merge-base --is-ancestor e5f3596 main; git diff --name-only e5f3596..main
for f in SYSTEM.md docs/messungen/2026-09-05-astra-s0-zielbild.md \
         docs/fleet-hub-overlay-2026-09-06.md; do git show main:$f | wc -l; done
for r in /api/tasks /api/programs /api/sessions /api/self/programs /api/self/program-execution; do
  curl -s -o /tmp/o -w '%{http_code}' -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
    http://100.64.0.1:8790$r; done
sed -n '23350,23372p' server.ts; grep -n 'isBoundSupervisor' server.ts
grep -n 'const programDigest' -A2 server.ts; grep -n 'function taskDigest' -A12 server.ts
```

Occupancy und Repo-Ableitung mit einem `bun -e`-Skript ueber `fleet.json`: je aktivem Program
`slots[main.slot].openedAt === main.openedAt` (Kriterium aus `programOccupancy`), und
`[...new Set(tasks.filter(t => t.programId === p.id && t.repo).map(t => t.repo))]`.

## Was nicht gemessen wurde

`src/client.ts` wurde nicht gelesen — ob der vorhandene Renderer die abgeleitete Repo-Achse ohne
Umbau traegt, ist offen, und ohne das ist auch dies noch kein freigabereifer Implementierungsbrief.
Keine Browser-Canary, keine Suite gefahren (die Lane aendert keinen Code). Die Volltexte von
`5e3823c7` und `0544306f` wurden nicht gelesen; von `1af3fa1f` nur Status, Program-Zugehoerigkeit
und die ersten 900 Zeichen. Ob `f99e9354` inhaltlich noch aktiv sein SOLL, ist eine Owner-Frage
und wurde nicht beurteilt.
