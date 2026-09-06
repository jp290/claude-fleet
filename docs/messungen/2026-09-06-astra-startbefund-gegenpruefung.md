---
frage: Halten die pruefbaren Behauptungen der ASTRA-Startbefund-Notiz (Task 580cc453) gegen Code und Live-Zustand, und welche Datenquellen traegt Hub-Schnitt 1?
urteil: Das Program traegt kein repo-Feld, und die einzige beobachtete Ersatzquelle sind seine Task-Zeilen, die capTasks oberhalb von 200 Zeilen prunen kann; in einem Snapshot vom 2026-09-06 18:05:22Z ordnen sie 10 von 11 aktiven Programs eindeutig zu, eines bleibt unknown, womit die Repo-Achse eine Datenquellen-Hypothese ist und kein Program-Repo-Vertrag; offen bleiben der Architektur-Lesescope (Attention 2e01154e) und der Renderer, denn src/client.ts wurde nicht gelesen
bereich: [fleet-hub, programs, lesescope]
belege: [server.ts#programOccupancy, server.ts#capTasks, server.ts#taskDigest, server.ts#programDigest, server.ts#isBoundSupervisor, docs/fleet-hub-overlay-2026-09-06.md]
nicht-gemessen: src/client.ts und jede Browser-Canary; der Architektur-Lesescope ist eine Owner-Entscheidung und wurde hier nicht beurteilt; 5e3823c7 und 0544306f nicht gelesen
stand: 2026-09-06
---

# Gegenpruefung der ASTRA-Startbefund-Notiz (Task 580cc453)

2026-09-06, Lane `fleet/260906175114-c807`, Baum `793513f`. Frage: **halten die pruefbaren
Behauptungen der Notiz, und welche Datenquellen traegt der vorgeschlagene Hub-Schnitt 1?**

Die Lane wurde auf die Notiz selbst gegruendet (`580cc453`, `kind=auftrag`, `source=main`,
`programId=e3b3a064`, `releasedBy=owner`, erstellt 2026-09-06 17:02:33Z). Ihr Text ist ein Bericht
ohne Imperativ und sagt von sich „Beratung, kein Auftrag". Diese Notiz ist deshalb, was eine Lane
dazu beitragen kann: die Behauptungen mechanisch nachziehen und die eine Frage beantworten, die die
Notiz offen laesst („Produktcode und Antwortfelder hier nicht voll untersucht").

**Fassung 3, nach zwei Reviews von Astra (Program-MAIN e3b3a064) am 2026-09-06, 20:03 und
20:11 lokal.** Drei Aussagen der ersten Fassung gingen ueber ihren Beleg hinaus und stehen unten
korrigiert (§1, §3, §4); eine vierte Zahl war falsch gemessen und ist in §1 berichtigt. Fassung 2
fuehrte in §1 einen neuen Fehler ein — sie las aus 200 Zeilen einen stattgefundenen
`capTasks`-Schnitt und aus `terminal` bereits den Verlust der Zuordnung; der Absatz steht jetzt in
Astras Wortlaut aus der Korrekturnotiz `b2a90267`. Die Messungen selbst sind erhalten, mit dem
ausfuehrbaren Kommando und ihrem Messzeitpunkt.

## Ergebnis

**1 — Das Program traegt kein `repo`-Feld. Die einzige beobachtete Ersatzquelle sind seine
Task-Zeilen, und die sind retentionbegrenzt.** `programDigest` (server.ts:1581) sendet
`id status title createdAt`, `publicProgram` (server.ts:1593) sendet das Program-Objekt; dieses
Objekt hat 16 Schluessel, `repo` ist keiner, und 0 von 11 aktiven Programs tragen eins. Die beiden
anderen Achsen tragen es: die Slot-Zeile in `GET /api/sessions` sendet `repo` (server.ts:24222 ff.,
`s.worktree?.repo ?? repoInfo.get(s.id)`), und `taskDigest` (server.ts:2053) reicht `repo` zusammen
mit `programId` weiter.

Die Ableitung `repo(Program) = repo seiner Task-Zeilen` ist damit **abgeleitete Evidenz ueber die
im Snapshot ERHALTENEN Zeilen, kein Program-Repo-Vertrag**. `capTasks` (server.ts:1996) verwendet
`MAX_TASKS = 200` als Aufbewahrungsschwelle: bis einschliesslich 200 Zeilen bleibt die Liste
unveraendert. Oberhalb werden aeltere terminale Zeilen entfernt; nichtterminale bleiben erhalten,
auch wenn sie allein die Schwelle ueberschreiten. Die 200 Zeilen des Snapshots (24 terminal)
belegen deshalb keinen stattgefundenen Pruning-Schritt. Erst wenn spaeter alle repo-tragenden
Task-Zeilen eines Programs tatsaechlich entfernt sind, verliert diese Task-basierte Ableitung
dessen Repo-Zuordnung; terminal allein genuegt nicht.

Die Zahlen des Snapshots 2026-09-06 18:05:22Z (Quelle: `fleet.json`, mtime 18:05:21Z):

| Program | occupancy | MAIN-Slot | Task-Zeilen mit repo | Zuordnung | beobachtete Repos |
|---|---|---|---|---|---|
| f99e9354 | stale | 10 | 0 | **unknown** | — |
| cd110019 | stale | 8 | 9 | eindeutig | `~/claude-fleet` |
| 66499a03 | live | 8 | 13 | eindeutig | `~/claude-fleet` |
| 07ee8a6d | stale | 4 | 6 | eindeutig | `~/private-repo-p` |
| 2c073232 | stale | 7 | 2 | eindeutig | `~/private-repo-j.worktrees/game-maker-private-repo-j` |
| b2aa5b45 | stale | 9 | 7 | eindeutig | `~/claude-fleet` |
| f170dc46 | live | 2 | 25 | eindeutig | `~/claude-fleet` |
| 79036e9a | live | 6 | 6 | eindeutig | `~/claude-fleet` |
| eec69528 | live | 3 | 13 | eindeutig | `~/claude-fleet` |
| 233e1c2b | live | 4 | 8 | eindeutig | `~/claude-fleet` |
| e3b3a064 | live | 9 | 4 | eindeutig | `~/claude-fleet` |

Also 10 eindeutig, 0 mehrdeutig, 1 unknown; 140 der 200 Task-Zeilen tragen ueberhaupt ein `repo`.
**Korrektur gegenueber Fassung 1: dort stand „200 von 200", und das war eine Fehlmessung** — sie
zaehlte die Anwesenheit des Schluessels (`"repo" in t`), nicht einen Wert; 60 Zeilen tragen `null`.
Ebenfalls snapshot-gebunden ist der Satz, dass die lebende MAIN-Bindung 0 zusaetzliche Faelle loest:
er gilt fuer diese Zeile-am-2026-09-06-18:05:22Z und begruendet keine allgemeine Rangfolge der
beiden Quellen. Heute ruht **keine** der zehn Zuordnungen ausschliesslich auf terminalen — also
oberhalb der Schwelle ueberhaupt prunebaren — Zeilen (hoechster Terminal-Anteil: `eec69528` mit
4 von 13); auch das ist eine Snapshot-Eigenschaft.

Was daraus fuer den Hub folgt, ist eine **Datenquellen-Hypothese, keine Baubarkeitsaussage**:
`src/client.ts` wurde nicht gelesen und keine Browser-Canary gefahren. Die Regel, die ein
Implementierungsbrief tragen muesste, lautet: 0 beobachtete Repos → `unknown`; genau eines →
zuordnen und als abgeleitet kennzeichnen; mehr als eines → mehrdeutig, alle beobachteten Repos
zeigen, niemals eines willkuerlich waehlen. Die zugehoerige Verify-Anforderung (kein Code in dieser
Lane): Fixtures mit 0, 1 und mehreren Repos sowie mit fehlendem und `null`-`repo`.

**2 — 5 von 11 aktiven Programs haben eine MAIN-Bindung, die keinen lebenden Insassen mehr
benennt.** Kriterium ist das des Servers (`programOccupancy`, server.ts:6728: `live?.cwd &&
live.id === main.slot && live.openedAt === main.openedAt`). Stale: `f99e9354` (Slot 10, inzwischen
Controller), `cd110019` (Slot 8), `07ee8a6d` (Slot 4), `2c073232` (Slot 7, Slot leer),
`b2aa5b45` (Slot 9, inzwischen Astra). Das ist kein neuer Befund, sondern ein bereits modellierter:
`/api/sessions` sendet `programsStale` als Zahl.

**3 — Die Notiz schliesst eine Frage mit einem Beleg, der sie nicht tragen kann; einen
Einzigkeitsanspruch erhebt sie nicht.** Ihr Satz lautet woertlich: „Damit ist die offene Frage nach
einer zweiten Astra-Session beantwortet." Der Beleg davor ist die eigene Bindung
(`GET /api/self/program-execution`, `sessionIdMatch exact`). Diese Projektion bindet hart an den
eigenen Token-Slot und sagt ueber fremde Occupancy nichts — sie kann eine Frage nach einer ANDEREN
Session also weder mit ja noch mit nein schliessen. **Korrektur gegenueber Fassung 1: dort stand,
die Notiz beantworte die Frage „falsch", und das unterstellte ihr eine Antwort, die sie nicht
gibt.** Widerlegt ist kein Einzigkeitsanspruch; nicht getragen ist die Schliessung.

Als Evidenzergaenzung, unabhaengig davon: Slot 3 traegt `model: "astra"`, Label „Program-MAIN:
Codebase-Review von aussen", ist MAIN von `eec69528` (Occupancy `live`) und offen seit 2026-09-05
06:12:39Z, also 34 Stunden vor der Notiz. `1af3fa1f`, das die Notiz als naechsten gemeinsamen
Dispositions-Input nennt, traegt `programId=eec69528…`, gehoert also jenem Program; es steht
`queued`, `slot=null`.

**4 — Es gibt einen programuebergreifenden Lesescope, aber er ist der des Supervisors und ersetzt
keinen Architektur-Grant.** Im selben Filter, den die Notiz zitiert, steht als dritter Disjunkt
`isBoundSupervisor(s)` (server.ts:19101, benutzt 23366): der gebundene Supervisor liest den INHALT
jedes Programs. Gemessen: die Supervisor-Bindung zeigt auf Slot 5 mit `openedAt` 2026-08-23
15:08:46Z, Slot 5 traegt heute eine Lane mit `openedAt` 2026-09-06 15:54:03Z — `isBoundSupervisor`
ist damit aktuell fuer jeden false.

**Korrektur gegenueber Fassung 1: dort stand, die offene Frage laute „wer haelt ihn" und nicht „gibt
es ihn".** Das war ein Kategorienfehler. Eine bestehende Supervisor-Rolle ist ein
Vermittlungsweg, kein Nachweis, dass fuer einen Architektur-MAIN-Lesescope nur eine verwaiste
Bindung zu reparieren waere; ob ein solcher Scope entsteht, mit oder ohne Code, ist eine
Owner-Entscheidung und steht in Attention `2e01154e` offen. Aus dieser Notiz ist keine
Serverimplementierung abzuleiten.

**5 — Die zitierten Stellen und Zahlen der Notiz halten.** `server.ts:23356-23368` umfasst am Baum
`793513f` genau den `/api/self/programs`-Handler samt Filter. Die Zeilenzahlen der drei gepinnten
Dokumente stimmen exakt (SYSTEM.md 243, `2026-09-05-astra-s0-zielbild.md` 152,
`fleet-hub-overlay-2026-09-06.md` 112). Der Pin `e5f3596` ist Vorfahr von main, main steht zwei
Commits weiter (`c76ece2`, `793513f`); beide fassen nur `HANDOFF.md`, `docs/messungen/INDEX.md` und
eine neue Messnotiz an, keine der drei gepinnten Dateien — die Zielbild-Lesung ist also aktuell,
der Pin nur nominell veraltet.

**6 — Der Self-Token-Lesescope haengt am Prinzipal, nicht am Token.** Als Lane gemessen:
`/api/tasks`, `/api/programs`, `/api/sessions` je `401 {"error":"unauthorized"}`;
`/api/self/programs` und `/api/self/program-execution` je `409` („programs are brackets above lanes")
— eine Lane hat also nicht einmal Astras Rueckfallpfad. Der 200er der Notiz auf `/api/self/programs`
ist Nicht-Lane-Verhalten; dass er nur das eigene Program enthielt, folgt aus dem Filter, gemessen
habe ich das nicht.

**7 — Die Land-Takt-Zahl ist aus den drei Routen nicht ableitbar.** Die Ledger sind Dateien
(`LANE_OUTCOME_FILE` server.ts:131, `POSTLAND_AUDIT_FILE` server.ts:152); `/api/sessions` fuehrt an
Land-Fakten nur `postLandAudit` (juengster Audit) und `postLandAuditLive`, keine Kadenz je Repo.
Astras Fallback („unknown anzeigen und die Datenluecke benennen") ist damit nicht hypothetisch,
sondern der eintretende Fall.

## Methode

Zwei Teile: Zitat- und Routenpruefung am Baum `793513f` von Hand, die Zahlen ueber ein Skript, das
ausschliesslich den persistierten Server-Zustand liest und nichts schreibt.

```
git merge-base --is-ancestor e5f3596 main; git diff --name-only e5f3596..main
for f in SYSTEM.md docs/messungen/2026-09-05-astra-s0-zielbild.md \
         docs/fleet-hub-overlay-2026-09-06.md; do git show main:$f | wc -l; done
H=http://<fleet-host>:8790     # Host-Literal steht im Regelbuch, nicht in getrackten Dateien
for r in /api/tasks /api/programs /api/sessions /api/self/programs /api/self/program-execution; do
  curl -s -o /tmp/o -w '%{http_code}' -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "$H$r"; done
sed -n '23350,23372p' server.ts; grep -n 'isBoundSupervisor' server.ts
grep -n 'const programDigest' -A2 server.ts; grep -n 'function taskDigest' -A12 server.ts
sed -n '1991,2002p' server.ts   # capTasks
```

Das Auswertungsskript vollstaendig, `bun messung.ts [pfad-zu-fleet.json]` (Default ist der
Live-Zustand des Servers; die Ausgabe oben stammt aus dem Lauf um 18:05:22Z):

```ts
const path = process.argv[2] ?? "<repo>/fleet.json";
const stat = await Bun.file(path).stat();
const s = JSON.parse(await Bun.file(path).text());
const slots: Record<string, any> = s.slots;
const tasks: any[] = s.tasks ?? [];
const iso = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19) + "Z";
console.log(`# quelle=${path} mtime=${iso(stat.mtimeMs)} gelesen=${iso(Date.now())}`);
console.log(`# tasks=${tasks.length} terminal=${
  tasks.filter((t) => t.status === "done" || t.status === "archived").length
} mit-repo=${tasks.filter((t) => t.repo).length}`);

// Occupancy exakt nach server.ts#programOccupancy
const occupancy = (p: any) => {
  const m = p.main ?? null;
  if (!m) return "unbound";
  const live = slots[String(m.slot)];
  return live?.cwd && live.openedAt === m.openedAt ? "live" : "stale";
};
const active = (s.programs ?? []).filter((p: any) => p.status === "active");
for (const p of active) {
  const own = tasks.filter((t) => t.programId === p.id && t.repo);
  const repos = [...new Set(own.map((t) => t.repo))];
  const kind = repos.length === 1 ? "eindeutig" : repos.length > 1 ? "mehrdeutig" : "unknown";
  console.log([String(p.id).slice(0, 8), occupancy(p), p.main?.slot ?? "-", own.length, kind,
    repos.map((r) => String(r).replace(/^\/Users\/[^/]+\//, "~/")).join(" ") || "-"].join("\t"));
}
// Ruht eine Zuordnung nur auf terminalen Zeilen, ist sie der einzige Fall, den ein
// capTasks-Schnitt OBERHALB der Schwelle nach "unknown" kippen koennte:
const terminal = (t: any) => t.status === "done" || t.status === "archived";
for (const p of active) {
  const own = tasks.filter((t) => t.programId === p.id && t.repo);
  if (own.length) console.log(String(p.id).slice(0, 8), own.length, own.filter(terminal).length,
    own.every(terminal) ? "NUR-TERMINAL" : "gemischt");
}
```

Der Lauf um 17:5x Z hatte fuer dieselben Programs teils andere Task-Zahlen (`eec69528` 17 statt 13,
`f170dc46` 24 statt 25, `e3b3a064` 1 statt 4). Das ist kein Widerspruch, sondern die Eigenschaft,
um die es in §1 geht: das Register bewegt sich, und jede Zahl hier gilt fuer ihren Messzeitpunkt.

## Was nicht gemessen wurde

`src/client.ts` wurde nicht gelesen — ob der vorhandene Renderer die abgeleitete Repo-Achse ohne
Umbau traegt, ist offen, und ohne das ist dies kein freigabereifer Implementierungsbrief. Keine
Browser-Canary, keine Suite gefahren (die Lane aendert keinen Code). Ob ein programuebergreifender
Lesescope fuer eine Architektur-MAIN entstehen soll, ist eine Owner-Entscheidung und wurde hier
nicht beurteilt; die Messung sagt nur, dass der heute existierende Scope der des Supervisors ist
und aktuell von niemandem gehalten wird. Die Volltexte von `5e3823c7` und `0544306f` wurden nicht
gelesen; von `1af3fa1f` nur Status, Program-Zugehoerigkeit und die ersten 900 Zeichen. Ob
`f99e9354` inhaltlich noch aktiv sein SOLL, ist eine Owner-Frage und wurde nicht beurteilt.
