# Lane-Suiten im Remote-Helper-Portal — Entwurf für Lane B

2026-08-26. Anlass, wörtlich vom Owner: er wollte die laufende Suite der Lane auf Slot 5 über das
Audit-Helper-Portal annehmen, „aber es tauchte nicht auf". Dieses Dokument klärt warum, beantwortet
die sieben Fragen des Auftrags und liefert den Schnittplan, nach dem eine zweite Lane baut.

**Lesart der Belege:** was hier ohne Marke steht, ist am Code oder an einer Live-Sonde GEMESSEN
(Messungen mit Kommando und Ergebnis in §1 und §3). Was ich nicht messen konnte, trägt
**ABGELEITET** davor. Verweise in Gegenwarts-Prosa sind `datei#symbol`, nie `datei:zeile`.

---

## 0. Die Antwort in zwei Sätzen

Das Portal listet als Jobs ausschließlich die Einträge der Post-Land-Audit-Queue —
`server.ts#helperJobsView` iteriert `for (const [repo, q] of auditQueue)` und kennt keine andere
Quelle; ein Vorschau-Lauf einer Lane wird nirgends angemeldet und steht deshalb in keiner Queue,
aus der etwas beansprucht werden könnte. Die Seite sagt das selbst: `src/helper.ts#refresh` setzt
die Unterzeile auf „post-land audits this fleet has queued" und die Leer-Karte auf „no audit is
waiting. Land something and this page fills up."

---

## 1. Der Ausgangsbefund, geprüft

**Bestätigt, mit einer Präzisierung.** Die Hypothese des Auftrags trifft zu; drei Stellen tragen sie,
und die dritte ist die, die den Umbau bemisst.

| Behauptung | Befund |
| --- | --- |
| `helperJobsView` iteriert nur `auditQueue` | **bestätigt** — `server.ts#helperJobsView`, einzige Schleife über `auditQueue`; `HelperJobView` hat kein Feld, das eine zweite Quelle unterscheiden könnte |
| Die Portal-Seite sagt es selbst | **bestätigt** — `src/helper.ts#refresh` (Unterzeile + Leer-Karte) |
| Ein Lane-Vorschau-Lauf kann nie geclaimt werden | **bestätigt und stärker**: es gibt keinen Anmeldeweg. `helperClaim` sucht `[...auditQueue.entries()].find(([r,q]) => helperJobId(r) === jobId && q.covers.length)` — ein Job ohne Queue-Eintrag ist 404, unabhängig vom Portal |
| „ein Lauf belegt den Suite-Mutex ~11 min" | **Größenordnung bestätigt, Zahl zu klein** — siehe unten |

### 1.1 Was der Mutex wirklich kostet (gemessen)

313 Zeilen in `post-land-audits.jsonl` (Haupt-Checkout, gitignored — mit `bun` gelesen, nicht mit
`rg`), davon 271 mit gemessener Laufzeit (`green`/`red`; `unknown`-Zeilen tragen eine
Timeout-Decke statt einer Messung und sind ausgeschlossen, dieselbe Regel wie `auditCounts`):

```
min 2  p25 563  p50 800  p75 1064  p90 1426  max 1606   (Sekunden)
green 216 · red 55 · unknown 42 · remote 0
```

**p50 = 13,3 min, p90 = 23,8 min** — nicht 11. Und dieselbe Suite ist der Vorschau-Lauf einer Lane:
`FLEET_POSTLAND_AUDIT_CMD` ist in `watchdog.sh` (`AUDIT_CMD`/`AUDIT_Q`) gesetzt, der lokale Drain
fährt sie über `server.ts#runPostLandAudit`, und `src/helper.ts#bootstrapText` nennt dem Helfer
wörtlich `./e2e-isolated.sh`.

`remote: 0` — das Portal ist heute gelandet, es hat noch keine einzige Zeile produziert. Jede Aussage
über sein Verhalten in Betrieb ist damit ABGELEITET aus dem Code und aus `e2e/helper-portal.ts`,
nicht aus Betriebserfahrung.

### 1.2 Die Live-Messung, die den Anlass trägt

Zweimal während dieser Lane abgefragt (`GET /api/self/gate`, Feld `suiteLock`, gespeist von
`server.ts#suiteLockView`):

```
18:37Z  {"pid":86245,"alive":true,"heldMs":929485,"state":"held"}
18:45Z  {"pid":86245,"alive":true,"heldMs":1145600,"state":"held"}
ps -o command= -p 86245  →  /bin/sh ./e2e-isolated.sh
```

Der eine Suite-Mutex dieser Maschine war während der gesamten Untersuchung von genau dem Lauf
gehalten, um den es geht — 19 min und laufend. Der Gewinn, den das Portal für Lane-Suiten brächte,
ist keine Rechnung, sondern der Zustand der Maschine, während dieser Text entstand.

### 1.3 Ein Betriebsbefund nebenbei (gehört nicht zum Entwurf, trifft aber Lane B)

`watchdog.sh:91` führt `src/helper.ts` in der tsc-Liste. Der **laufende** Server tut es nicht:

```
grep -c "src/helper.ts" watchdog.sh                      → 1
GET /api/self/gate | grep -c "src/helper.ts"             → 0
```

Der srv-Pane backt `FLEET_VERIFY_CMD` beim Spawn ein; er läuft seit vor diesem Land. **Folge für
Lane B:** die Datei, die sie am meisten anfasst, hat im Live-Land-Gate derzeit NULL Typabdeckung.

Und die naheliegende Abhilfe ist die falsche: `watchdog.sh:102-104` sagt ausdrücklich, dass die
Spawn-Zeile **nur** über `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` neu
gelesen wird — „a plain srv restart keeps the old spawn line, exactly as with VERIFY_CMD". Das
übliche Deploy-Ritual (land, dann `kill-session -t srv`) schließt die Lücke also **nicht**. Bis zu
einem Watchdog-Kickstart ist `bunx tsc` von Hand über `src/helper.ts` zu fahren. Kein Teil dieses
Entwurfs — nur eine Falle, die sonst als „grün" gelesen wird.

---

## 2. Anmeldung — wie ein Lane-Suite-Lauf in die Job-Liste kommt

**Empfehlung: die Lane meldet ihn selbst an, über eine neue lane-only Self-Route
`POST /api/self/suite-offer`.**

### 2.1 Warum die Lane und nicht der Server

Der Server hat keinen Auslöser. Ein Post-Land-Audit entsteht, weil `recordLand` am Ende
`schedulePostLandAudit` ruft — es gibt ein Ereignis, das ihn erzeugt. Für einen Vorschau-Lauf gibt
es dieses Ereignis nicht: er ist eine ENTSCHEIDUNG der Lane, die aus dem Regelbuch folgt
(„fahre `./e2e-isolated.sh`, wenn du `e2e/`, einen Suite-Wrapper oder den Merge-/Land-Pfad angefasst
hast — oder wenn du eine Aussage änderst, über die irgendwo eine Behauptung steht"). Ob eine Lane
diese Bedingung für sich als erfüllt ansieht, weiß nur sie.

**Der nächstbeste andere Weg, und warum er schlechter ist:** der Server könnte aus
`verify-proportion.ts#localProofFor` ableiten, welche Lane eine Vorschau schuldet — die Klassifikation
existiert bereits und `server.ts#laneLocalProof` rechnet sie je Lane aus (`isolatedPreview: true`
für `e2e-or-merge-land`). Drei Gründe, es nicht zu tun:

1. **Das Prädikat ist advisory, nicht bindend.** `isolatedPreview` kennt drei Werte, und zwei davon
   (`"self-assess"`, der konservative Default bei leerem/gemischtem Diff) sagen ausdrücklich „die
   Lane entscheidet". Ein Server, der daraus einen Job baut, macht aus einer Empfehlung eine
   Verpflichtung — und zwar für JEDE Lane mit passendem Diff, auch die, die gerade nichts fertig hat.
2. **Der Zeitpunkt wäre falsch.** Der Diff einer Lane wandert; ein Job, den der Server bei jeder
   Änderung neu bewertet, hat kein stabiles Bundle. Die Lane weiß, wann ihr Baum den Zustand hat,
   den sie geprüft haben will.
3. **`verify-intent` als Trigger wäre eine Zweckentfremdung.** `server.ts#recordVerifyIntent` ist
   ausdrücklich eine Sicht ohne Fähigkeit („It grants no capability at all: nothing is started,
   stopped or queued"). Ein Bericht, der etwas auslöst, ist kein Bericht mehr — und er käme
   ohnehin zu spät, weil er einen bereits GESTARTETEN Lauf meldet.

### 2.2 Darf eine Lane das? — die Scope-Regeln, aufgelöst

Die Regel in `CLAUDE.md` ist nicht offensichtlich, weil zwei entgegengesetzte Mengen existieren.
Gelesen am Code (`server.ts`, die Wachen der `/api/self/*`-Routen):

- **Lane-only (409 für Nicht-Lanes), vier Routen:** `drift`, `gate`, `criterion`, `verify-intent`.
  Begründung im Code jeweils gleichförmig: *„not a lane — … a lane's …"*. Der gemeinsame Nenner:
  **die Antwort ist nur für eine Lane definiert.**
- **Nicht-Lane-only (409 für Lanes), vier Routen:** `watch`, `tasks/:id/release`, `succeed`,
  `retire`. Begründung jeweils eine KOPPLUNG, die eine Lane nicht eingehen darf — bei `watch`
  wörtlich: *„lane-waits-on-lane is a coupling only the owner can make visible"*, und das Prädikat
  ist ausdrücklich dasselbe, nach dem done-looking klassifiziert: **wer beobachtet WERDEN kann,
  darf nicht beobachten.**

Ein Suite-Angebot fällt eindeutig in die erste Menge: es ist eine Aussage über den eigenen Baum
einer Lane, für eine Nicht-Lane bedeutungslos, und es koppelt die Lane an keine andere Lane —
sondern an ein fremdes Gerät, das keinen Slot hat. Also: **`POST /api/self/suite-offer` ist die
fünfte lane-only Route**, mit derselben `if (!s.worktree) return json({error: "not a lane — …"}, 409)`
-Wache und derselben Flat-Cost-Auth (`Bun.sleep(400)` + 401) wie ihre vier Geschwister.

### 2.3 Die Türform

```
POST /api/self/suite-offer     Body: {}   (geschlossen — siehe unten)
GET  /api/self/suite-offer                → Zustand + Verdikt (§4)
POST /api/self/suite-offer/withdraw       → nimmt das Angebot zurück (§5)
```

Der Body ist LEER, und das ist die tragende Entscheidung: Repo, Branch, cwd und Slot kommen aus
`s.worktree` bzw. `s.cwd`, das Kommando ist `./e2e-isolated.sh` fest, der Baum wird serverseitig
aufgenommen (§3). Damit kann kein Body-Feld nominieren, WELCHER Baum gebündelt wird — dieselbe
Bauart wie `POST /api/self/tasks/:id/release`, das ausdrücklich keinen Body liest.

Deckel: **ein offenes Angebot pro Slot** (ein zweites gibt das bestehende zurück, `existing:true`,
das Muster von `createWatchForSlot`), und ein fleet-weiter Deckel analog zu
`HELPER_DEVICE_KEEP`/`HELPER_LAPSE_KEEP`.

---

## 3. Das Bundle — was ein Helfer bekommt, und was mit uncommitteter Arbeit passiert

Der Unterschied zum Audit ist real: `buildHelperBundle` bündelt `main`, einen gelandeten Tip in
einem normalen Checkout. Eine Lane hat einen ungelandeten Branch in einem **Worktree** — und
typischerweise uncommittete Arbeit. Ich habe jeden Schritt gemessen statt ihn anzunehmen.

### 3.1 Die Messungen

Alle im Scratchpad, nichts im Baum verändert. Kommandos und Ergebnisse:

| # | Kommando | Ergebnis |
| --- | --- | --- |
| M1 | `git bundle create <f> HEAD` aus **diesem Worktree** | **exit 0**, 9 880 885 B; Header `4b4cfbb… HEAD` |
| M2 | `git bundle create <f> main..HEAD` (Lane ohne eigene Commits) | `fatal: Refusing to create empty bundle.` |
| M3 | `git stash create` in Fixtur-Repo mit dirty Baum | liefert Commit-Sha; **Stash-Stack 0 vorher / 0 nachher**; Baum bleibt dirty; `git show <sha>:f.txt` trägt den uncommitteten Inhalt |
| M4 | `git bundle create <f> <bare stash-sha>` | `fatal: Refusing to create empty bundle.` — ein Sha ist kein Ref |
| M5 | `git update-ref refs/fleet/suite/test <sha>` + bundle + `git clone` | Bundle 576 B, Clone meldet **„You appear to have cloned an empty repository"** |
| M6 | `git update-ref refs/heads/<tmp> <sha>` + bundle + `git clone` (ohne `-b`) | **„remote HEAD refers to nonexistent ref, unable to checkout"** — kein Arbeitsbaum |
| M7 | `git clone -b <tmp> <bundle> <dir>` | **exit 0**, Branch ausgecheckt, `cat f.txt` → `a\nDIRTY` — die uncommittete Arbeit ist da |
| M8 | `git stash create` 2× mit 1 s Abstand | **Commit-Sha verschieden** (Zeitstempel), **Tree-Sha identisch**; nach Änderung Tree-Sha anders |
| M9 | `git archive --format=tar <bare stash-sha>` | **exit 0** — `git archive` braucht KEIN Ref (Gegensatz zu M4) |
| M10 | `git archive HEAD` (dieses Repo) vs. M1 | tar **11 571 200 B** > bundle **9 880 885 B** |

### 3.2 Was daraus folgt

**Der Transport bleibt das `git bundle`.** M10 ist das Argument, und es ist das umgekehrte zu dem,
das man erwartet: ein Tarball des reinen Baums ist auf diesem Repo **größer** als ein Bundle der
GESAMTEN Historie, weil git packt. Ein zweiter Transport neben dem Bundle wäre also nicht einmal
billiger — er wäre nur eine zweite Route (`/api/helper/bundle/:id` müsste ein zweites
Content-Type-Verhalten tragen oder ein Geschwister bekommen), ein zweiter Bootstrap-Text und ein
zweiter Eintrag in `e2e/security.ts#HELPER_ROUTES`. Dagegen §7.

**Der Baum wird über `git stash create` aufgenommen, nicht über `HEAD`.** M3 ist der Grund, dass das
überhaupt zulässig ist: `git stash create` schreibt ein Commit-Objekt und **rührt den Stash-Stack
nicht an** (0 → 0 gemessen). Das ist in diesem Repo keine Feinheit — `CLAUDE.md` verbietet bare
`git stash`/`git stash pop` ausdrücklich, weil der Stack zwischen Haupt-Checkout und allen Worktrees
geteilt ist. `git stash create` fällt nicht unter das Verbot, und die Messung zeigt warum.

Sonderfall, benannt statt übergangen: **bei sauberem Baum liefert `git stash create` einen leeren
String.** Dann ist der aufzunehmende Baum `HEAD`. Beide Fälle müssen dieselbe Identität liefern
(§3.3).

Was `git stash create` NICHT mitnimmt: untracked Dateien. Das ist hier kein Verlust — die
Lane-Disziplin verlangt ohnehin „NO untracked files in the worktree (they block `land`)". Falls die
Lane doch welche hat, wird der Helfer einen Baum ohne sie prüfen; **das muss der Job-Datensatz
festhalten** (`untracked: <n>`), damit ein grünes Remote-Verdikt nicht über einen anderen Baum
spricht als der, den die Lane meint.

**Das Ref ist transient und liegt unter `refs/heads/`.** M4/M5/M6 zusammen schneiden die Alternativen
weg: ein Bare-Sha geht nicht (M4), ein Ref außerhalb `refs/heads/` klont leer (M5), und ein
`refs/heads/`-Ref ohne passendes HEAD klont ohne Arbeitsbaum (M6). Erst M7 — `git clone -b <branch>`
— liefert einen Baum, auf dem `./e2e-isolated.sh` laufen kann.

Residuum, ausdrücklich benannt: `refs/heads/*` liegt im **gemeinsamen** git-Dir
(`git rev-parse --git-common-dir` aus diesem Worktree → `/Users/owner/claude-fleet/.git`), das
Ref ist also für die Dauer des Bundle-Baus im Haupt-Checkout als Branch sichtbar. Der Bau dauert
Sekunden (M1: ~10 MB). Deshalb: Ref anlegen → bündeln → Ref löschen, das Löschen in einem `finally`,
und der Name unverwechselbar fleet-eigen (`refs/heads/fleet-suite/<jobId>`). Wer das Residuum
ganz vermeiden will, hat M9 als Rückfalltür — `git archive` braucht kein Ref —, zahlt dann aber
M10 und den zweiten Transport.

### 3.3 Woran der Helfer läuft, konkret

Der Helfer bekommt genau das, was der Audit-Helfer bekommt, mit **einem** geänderten Wort im
Bootstrap (`src/helper.ts#bootstrapText`):

```
git clone -b <branch> <jobid>-<sha8>.bundle fleet-suite && cd fleet-suite
bun install --frozen-lockfile
./e2e-isolated.sh > log 2>&1; echo "exit=$?"
```

Das `-b` ist nicht kosmetisch: **ohne es entsteht kein Arbeitsbaum** (M6), und der Helfer sieht ein
leeres Verzeichnis statt einer Fehlermeldung, die ihm sagt warum.

Dass die Suite auf so einem Baum überhaupt läuft, ist nicht abgeleitet: `server.ts#runPostLandAudit`
fährt sie über `snapshotIntegrationTree`, das ein `git archive | tar -x` in ein Scratch-Verzeichnis
macht — **kein git-Repo**. 216 grüne Zeilen im Ledger sind der Beweis, dass `./e2e-isolated.sh`
keine Historie unter sich braucht: `e2e-stage.sh#stage_instance` kopiert Dateien, und
`e2e-isolated.sh` macht in der Kopie sein **eigenes** `git init -q -b main`.

Der einzige Unterschied zum lokalen Audit ist `node_modules`: `watchdog.sh`s `AUDIT_CMD` fährt
`bun install --frozen-lockfile` ebenfalls, aber `snapshotIntegrationTree` hat vorher den
`node_modules`-Symlink aus dem Repo gelegt, sodass der Install ein No-op ist. Der Helfer hat nichts
zu verlinken und zahlt den Install wirklich — er steht im Bootstrap-Text bereits so, und er ist der
Grund, dass die Wanduhr eines Remote-Laufs über der lokalen p50 liegen wird.

### 3.4 Die Identität des Baums

`buildHelperBundle` hält eine Regel, die hier übernommen werden muss: der Sha, den der Claim
festhält, wird **aus dem Bundle-Header gelesen**, nicht separat aufgelöst — „a second resolution
would be a second moment". Für einen Lane-Job ist die Lage sogar besser: `git stash create` GIBT
den Sha zurück, es gibt also nur einen Moment.

Dazu — und das ist neu gegenüber dem Audit — der **Tree-Sha**:
`git rev-parse "<commit>^{tree}"`. M8 zeigt, dass der Commit-Sha bei identischem Inhalt wandert
(Zeitstempel), der Tree-Sha aber inhaltsadressiert stabil bleibt. Damit kann die Lane bei Eintreffen
des Verdikts EINE Frage exakt beantworten: *hat sich mein Baum bewegt, seit ich ihn weggegeben habe?*
Sie rechnet den Tree-Sha neu und vergleicht. Ohne das ist jedes Remote-Verdikt über einen
weiterarbeitenden Baum stumm falsch — dieselbe Unterscheidung, die `docs/e2e-trail.md` §2 mit
`dirty` benennt („two runs on the same sha with different uncommitted work are different code").

---

## 4. Der Rückweg — wohin das Ergebnis geht und wie die Lane davon erfährt

### 4.1 Nicht auf das Audit-Ledger

`server.ts#helperResult` schreibt heute eine `PostLandAuditRow` nach `POSTLAND_AUDIT_FILE`. Ein
Lane-Suite-Ergebnis darf dort **nicht** hin, und zwar aus der Begründung, die im Code neben der
Ledger-Zeile steht: die Fragen, für die Tier 2 existiert, sind Joins über EINE Datei („welches Land
war das letzte grüne Audit"). Eine Zeile ohne `covers`, ohne gelandeten Tip, über einen Branch, der
nie gelandet ist, macht genau diese Joins still falsch — `newestAuditFor` und `auditRowMatches`
joinen über `mainSha`/`covers[].mainAfter`, die ein Lane-Job beide nicht hat.

**Das Ergebnis lebt im Job-Datensatz selbst** (`laneSuiteJobs`, neben `helperClaims` in `fleet.json`
persistiert, aus demselben Grund wie die Claims: das Deploy-Ritual hier ist land-dann-`kill-session
-t srv`, ~10×/Tag). Es trägt: `exitCode`, `tail` (gedeckelt auf `HELPER_TAIL_CAP`, dieselben 4096 B),
`trail`, `remote {name, claimedAt, reportedAt}`, `treeSha`, `untracked`. Kein zweites Ledger, keine
Datei — ABGELEITET, aber mit Grund: ein Vorschau-Verdikt ist an EINE Lane adressiert, und eine Lane
ist eine Stunde alt. Wer die Historie später doch will, hat mit `e2e-trail/` bereits das Regal, in
das sie gehört (`docs/e2e-trail.md` §3), und Remote-Trails sind dort ausdrücklich noch nicht drin.

### 4.2 Wie die Lane davon erfährt — Polling, nicht Weckruf

**Empfehlung: die Lane pollt `GET /api/self/suite-offer` in ihrer eigenen Vordergrund-Schleife.**

Der Reflex ist `POST /api/self/watch` — und er ist hier falsch, aus zwei Gründen, von denen der
zweite der wichtigere ist:

1. **Die Route verweigert Lanes** (409, `server.ts`, Wache vor `createWatchForSlot`). Das ließe sich
   erweitern, und der Kommentar dort sagt selbst „Widening this later costs an `if`". Es ist also
   ein Hindernis, kein Verbot.
2. **Der FleetEvent-Transport weckt eine RUHENDE Pane.** Jedes `Watch` trägt `idleSec`, und die
   Zustellung wartet, bis die Pane still ist. Eine Lane, die auf ihre eigene Verifikation wartet,
   ist aber nicht ruhend — sie ist BLOCKIERT, genauso wie heute, wenn sie `./e2e-isolated.sh` im
   Vordergrund fährt. Ein Weckruf löst ein Problem, das die Lane nicht hat, und schafft eines, das
   sie hätte: sie müsste die Kontrolle abgeben und darauf hoffen, zurückgerufen zu werden.

Eine `curl`-Schleife mit Deadline hat exakt die Form, die sie heute hat: **ein Vordergrund-Kommando,
das nach N Minuten mit einem Exit-Code zurückkommt.** Nichts an der Lane-Disziplin ändert sich, kein
Transport wird angefasst, und das Zurückfallen auf lokal (§5) fällt aus derselben Schleife heraus,
statt ein zweiter Mechanismus zu sein.

**Was ich damit nicht behaupte:** dass ein Watch nie richtig wäre. Wenn Lane B misst, dass Lanes
tatsächlich lieber schlafen, ist die Erweiterung ein `if` in der Wache plus ein `kind:"suite"` nach
dem **Deploy**-Muster (`server.ts`, `DeployWatch` — die einzige Watch-Art, die an einer opaken ID
statt an einem Slot hängt, und damit die richtige Vorlage). Das ist Stufe 2, nicht Stufe 1.

---

## 5. Der Mutex — dass nicht doppelt gefahren wird, und der Fallback

### 5.1 Das Angebot IST der Ausschluss

Die harte Invariante des Portals in den Worten des Owners — „es muss nur so aufgebaut sein dass wir
am Ende wirklich Arbeit abnehmen, nicht dass irgendwas doppelt läuft" — gilt hier unverändert, mit
einem Unterschied: beim Audit hält der SERVER beide Seiten (Claim ⇄ `auditRunningRepo`). Bei einer
Lane-Suite hält der Server nur eine; die andere ist die Lane selbst.

Also wird sie zur Regel gemacht statt zur Bitte: **solange das eigene Angebot `open` oder `claimed`
ist, fährt die Lane nicht lokal.** Lokal fahren darf sie erst, nachdem
`POST /api/self/suite-offer/withdraw` mit `200` geantwortet hat — und dieser Ruf ist **409, wenn
bereits geclaimt**, mit derselben Begründungsform wie `helperClaim`s 409s. Damit ist „ich fahre
lokal" ein Zustandsübergang, den der Server bezeugt, nicht eine Absicht in einer Pane.

Gegenrichtung, aus `helperClaimOf` übernommen: **abgelaufen zählt überall sofort als abwesend.** Ein
Claim, dessen `expiresAt` verstrichen ist, blockiert den Withdraw nicht — sonst könnte ein Helfer,
der sein Laptop zuklappt, eine Lane für 45 Minuten festhalten.

Und die Fehlerrichtung ist die umgekehrte zum Audit, absichtlich: beim Audit ist „lieber einmal
lokal zu viel als ein Baum, den niemand geprüft hat". Hier gilt „lieber einmal gar nicht geprüft als
zweimal" — denn Tier 2 gated nichts (§6 von `docs/verify-tiering.md`), und der Post-Land-Audit
prüft denselben Code ~9 min nach dem Land ohnehin. Das ist eine ENTSCHEIDUNG, keine Ableitung; sie
gehört so in den Code-Kommentar.

### 5.2 Wenn niemand claimt: die Wartezeit, und wer sie misst

**Die Lane misst.** Der Server misst nur die Verfallszeit eines erteilten Claims; die Geduld ist
eine Eigenschaft der wartenden Arbeit, nicht des Portals.

Und die Wartezeit ist nicht konstant, weil ihre Kosten nicht konstant sind. `GET /api/self/gate`
liefert bereits `suiteLock` (`server.ts#suiteLockView`) — genau die Zahl, die fehlt:

- **`suiteLock: null` (frei).** Ein lokaler Lauf könnte sofort starten; jede Wartesekunde ist reiner
  Verlust. → **180 s warten**, dann withdraw + lokal. Die Kosten offen hingeschrieben, weil sie
  nicht klein sind: claimt niemand, hat die Lane 180 s auf einen p50-Lauf von 800 s aufgeschlagen,
  also **22,5 %**. Dafür bekommt sie ~18 Auffrischungen der Portal-Seite (die pollt alle 10 s,
  `src/helper.ts` Schlusszeile) — Zeit genug, dass ein Mensch am anderen Gerät den Job sieht.
  Größenordnung ABGELEITET; wer sie senken will, senkt sie: 120 s sind 15 %, und die einzige Zahl,
  die diesen Aufschlag auf null bringt, ist 0 s, also gar kein Angebot.
- **`suiteLock.state === "held"` (belegt).** Ein lokaler Lauf würde ohnehin in der Schlange stehen —
  Warten kostet nichts. → **weiterwarten, solange gehalten**, gedeckelt bei 800 s (dem gemessenen
  p50: länger zu warten, als der Lauf selbst dauert, ist nie richtig).
- **`state === "parked"`** (Lock-Dir ohne pid-Datei = ein Mensch hat die Maschine absichtlich
  angehalten). Ein lokaler Lauf würde **nie** starten. → warten bis zum Deckel, dann melden statt
  lokal zu fahren.
- **`state === "stale"`** heißt „nichts läuft, der nächste Anwärter reapt" — wie `null` behandeln.

Der Fallback hängt nie: die Schleife hat immer eine Deadline, und ihr Ausgang ist entweder ein
Verdikt, ein lokaler Lauf oder ein Bericht. Drei Ausgänge, kein vierter.

### 5.3 Wenn geclaimt wurde und dann nichts kommt

Der Claim verfällt (`HELPER_CLAIM_TIMEOUT_MS`, Default 45 min). Für einen Audit-Job fällt er danach
an den lokalen Drain zurück — **für einen Lane-Job gibt es keinen Drain**. Die Lane ist der einzige
Interessent, und sie kann längst gelandet oder tot sein. Deshalb:

- Ein verfallener Lane-Job wird **gereapt, nicht zurückgegeben** — wie eine `HelperLapse` gebucht
  (damit ein Helfer, der Jobs nimmt und nicht liefert, sichtbar bleibt), aber nicht requeuet.
- Ein Job, dessen Lane-Slot nicht mehr existiert oder recycelt wurde, wird ebenfalls gereapt. Die
  Identitätsprüfung ist die bestehende: `slot + openedAt`, wie `WatchBase.slotOpenedAt` und
  `isBoundSupervisor` sie führen — eine Slot-ID allein ist keine Identität, IDs werden recycelt.
- Und die Lane muss aufhören dürfen zu warten, auch nach einem Claim: `withdraw` bleibt zulässig,
  wird dann aber nicht 409, sondern markiert den Job `abandoned`; ein später eintreffendes Verdikt
  wird abgelehnt (409, wörtlich die Form von `helperResult`s Lapsed-Ablehnung). Kosten: die Zeit
  des Helfers. Das ist ehrlicher als ein Deadlock und ist **keine** Korrektheitsverletzung, weil
  nichts gegated wird.

---

## 6. Vertrauen, ehrlich benannt

**Darf ein fremdes Gerät die Pflicht-Vorschau ersetzen? — Ja, mit Etikett.** Die Begründung ist
nicht Großzügigkeit, sondern die Rangordnung, die `docs/verify-tiering.md` §6 ohnehin aufstellt:
die Vorschau gated nichts, und die Alternative, die `CLAUDE.md` heute ausdrücklich einräumt, ist
*„du fährst die Vorschau oder rechnest mit dem Audit ~9 min nach dem Land"*. Ein remote gefahrener
Lauf ist strikt mehr als „gar nicht", und er ist auf demselben Kommando gefahren.

Was daran aber **nicht** verhandelbar ist, ist die Etikettierung, und der Grund steht in
`src/helper.ts#doReport`: **der Exit-Code wird von einem Menschen in ein Eingabefeld getippt.** Die
Fleet beobachtet keinen Prozess, sie nimmt eine Zahl entgegen. Das ist kein Vorwurf an das Design —
Stufe 1 hat ausdrücklich keinen ssh-Runner —, aber es entscheidet, welcher Satz in einem Lane-Report
stehen darf.

**Woran man glauben darf** (Fakten dieser Maschine):

| Fakt | Warum belastbar |
| --- | --- |
| **Welcher Baum weggegeben wurde** | der Sha kommt aus dem Bundle bzw. aus `git stash create` selbst — ein Moment, keine zweite Auflösung (`server.ts#buildHelperBundle`s Regel) |
| **Ob mein Baum sich seither bewegt hat** | Tree-Sha-Vergleich, M8 — inhaltsadressiert, kein Fehlalarm |
| **Wer geclaimt hat und wann** | `name` liegt SERVERSEITIG (`server.ts#setHelperDevice`), nicht im Browser des Helfers; `claimedAt`/`expiresAt` stempelt der Server |
| **Dass hier nichts parallel lief** | die Claim-/Withdraw-Übergänge sind Server-Zustand (§5.1) |

**Was als „remote, ungeprüft" gehört** (Behauptungen des Geräts):

| Behauptung | Warum nicht belastbar |
| --- | --- |
| **der Exit-Code** | von Hand eingetippt (`src/helper.ts#doReport` prüft nur `/^-?\d+$/`) |
| **der Tail** | eingefügter Text, auf 4096 B gedeckelt; `postLandAuditChecks` zählt daraus PASS/FAIL — eine Zählung über eingefügten Text, nicht über einen Lauf |
| **die trail-id** | ebenso eingetippt; sie ist heute nur ein Etikett, kein Beweis |
| **dass überhaupt `./e2e-isolated.sh` lief** | nichts prüft es |

**Die Formulierungsregel für den Lane-Report** — ein Satz, der beides trägt:

> Vorschau grün — REMOTE auf „<Gerätename>", exit 0 vom Helfer GEMELDET (nicht von dieser Maschine
> gemessen), Baum `<tree-sha8>`, unverändert seit der Übergabe, trail `<id>`, Tail 40 Zeilen.

Und was **nie** dasteht: „`./e2e-isolated.sh` grün" ohne Zusatz. Ein Remote-Grün und ein
Lokal-Grün sind nicht dasselbe Faktum, und der Unterschied verschwindet nicht dadurch, dass er
unbequem ist. `server.ts#helperResult` hält für die Audit-Seite bereits genau diese Linie — die
Ledger-Zeile nennt `cmd: "remote helper (<name>): ./e2e-isolated.sh"` statt das lokale Kommando zu
zitieren, „a row quoting FLEET_POSTLAND_AUDIT_CMD would be claiming otherwise". Dieselbe Regel,
dieselben Worte, für den Lane-Job.

**Der eine Fakt, der das falsifizierbar machen WÜRDE, und der bewusst nicht gebaut wird:** die Suite
schreibt pro `check()` eine Zeile nach `e2e-trail/` (~887 Zeilen, ~220 KB/Lauf,
`docs/e2e-trail.md` §2). Käme diese Datei statt eines 4-KB-Tails zurück, könnte die Fleet die
`ok:false`-Zeilen SELBST zählen und gegen den gemeldeten Exit-Code halten. Das ist die richtige
Stufe 2 dieser Vertrauensfrage — und es ist Stufe 2, nicht Stufe 1: es braucht einen Upload-Pfad,
eine Größenbegrenzung und eine Aufbewahrungsregel, und keins davon gehört in den ersten Schnitt.

---

## 7. Was NICHT gebaut wird — die Linie

- **Kein zweiter Job-Typ im Portal.** EINE Job-Liste, EIN Claim-Weg, EIN Ergebnis-Weg. Der
  Unterschied ist ein Feld (`kind: "audit" | "lane-suite"`) auf `HelperJobView`, nicht eine zweite
  Oberfläche. Der Helfer klickt denselben Knopf.
- **Keine zweite Queue neben `auditQueue`.** `laneSuiteJobs` ist keine Queue — es gibt keinen Drain,
  keine Koaleszenz, keine Reihenfolge; es ist eine Menge offener Angebote. `helperJobsView` liest
  beide Quellen und mischt sie in EINE Liste.
- **Kein zweites Ledger.** §4.1: das Verdikt lebt im Job, nicht in `post-land-audits.jsonl` und
  nicht in einer neuen Datei.
- **Kein zweiter Transport.** §3.2: das Bundle bleibt, gemessen auch als das kleinere.
- **Kein Gate.** Weder verzögert das Angebot einen Land, noch darf ein rotes Remote-Verdikt einen
  Land blockieren. Der Land-Gate ist `watchdog.sh`s `VERIFY_CMD` und bleibt es; die Vorschau ist
  Tier 2 und Tier 2 gated nichts.
- **Kein Auto-Dispatch.** Owner-Nicht-Ziel für Stufe 1, unverändert: der Server weist nichts zu, ein
  Mensch klickt.
- **Kein Watch-Kind in Schnitt 1.** §4.2 — erst messen, ob eine Lane überhaupt schlafen will.
- **Kein Trail-Upload.** §6 — Stufe 2.

---

## 8. Schnittplan für Lane B

In dieser Reihenfolge. Jeder Schnitt nennt Datei + Symbol, die Sonde, die ihn beweist, und die
MUTATION, die diese Sonde rot macht (Norm seit heute: ein Verifier ohne vorgeführten Breaker ist ein
Struktur-Test).

**Wo die Sonden hingehören.** `e2e/helper-portal.ts` liegt im Postland-Harness, weil die
Audit-Queue ohne `FLEET_POSTLAND_AUDIT_CMD` unerreichbar ist. **Ein Lane-Suite-Job braucht dieses
Env nicht** — die Lane meldet ihn an. Also: neue Familie **`e2e/lane-suite.ts` im HAUPT-Runner**
(`fleet-e2e.ts` bootet `e2e/*.ts` der Reihe nach). Das ist keine Stilfrage: der Post-Land-Audit
fährt `./e2e-isolated.sh` automatisch ~9 min nach jedem Land, Checks dort werden also tatsächlich
gefahren — Checks in `./e2e-postland-audit.sh` fährt niemand, wenn niemand die Suite von Hand
startet („kein Gate fährt sie, also rottet sie unbemerkt", einmal monatelang passiert). Fixtures,
die den Abschnitt überleben, gehen durch `e2e/ctx.ts`; geteiltes Werkzeug ist `e2e/harness.ts`.

---

**S1 — Der Job bekommt eine zweite Quelle und ein `kind`.**
- Datei/Symbol: `server.ts#HelperJobView` (Feld `kind`), `server.ts#helperJobsView` (zweite
  Schleife über `laneSuiteJobs`), `server.ts#LaneSuiteJob` (neu, neben `HelperClaim`),
  Persistenz in `saveStateNow`s Body + der Restore-Zweig neben `persistedClaims`.
- Sonde: `e2e/lane-suite.ts` — „ein Lane-Suite-Angebot erscheint in `/api/helper/jobs` mit
  `kind:"lane-suite"`, und ein Audit-Job daneben behält `kind:"audit"`".
- **Breaker:** `helperJobsView` auf die alte Einzelschleife über `auditQueue` zurückdrehen → die
  Job-Liste bleibt leer, Check rot. (Das ist buchstäblich der heutige Zustand — der Breaker ist der
  Befund aus §0.)

**S2 — Die Angebots-Tür, lane-only.**
- Datei/Symbol: `server.ts`, neue Wachen für `/api/self/suite-offer` (+ `/withdraw`), gebaut nach
  dem Muster der vier bestehenden lane-only Routen (`…#/api/self/gate`s Wache als Vorlage:
  Token → 401 flat-cost → `if (!s.worktree)` 409). Body geschlossen wie bei
  `POST /api/self/tasks/:id/release`.
- Sonde: drei Checks — Lane-Token → 200 mit Job-ID · Nicht-Lane-Token (Haupt-Checkout-Session) →
  **409 mit „not a lane"** · fremdes/fehlendes Token → 401.
- **Breaker:** die Zeile `if (!s.worktree) …` entfernen → der 409-Check wird 200, rot.

**S3 — Das Bundle einer Lane.**
- Datei/Symbol: `server.ts#buildLaneSuiteBundle` (Geschwister von `buildHelperBundle`):
  `git stash create` → leer? dann `HEAD` → `git update-ref refs/heads/fleet-suite/<jobId>` →
  `git bundle create` → **`finally { git update-ref -d }`** → Tree-Sha via
  `git rev-parse "<sha>^{tree}"` → `untracked`-Zählung.
- Sonde: die Fixtur-Lane schreibt eine Datei und **committet sie NICHT**; nach Claim + Download
  `git clone -b <branch> <bundle>` und prüfen, dass die uncommittete Datei **im Klon liegt**.
  Zweiter Check: `git stash list` im Fixtur-Repo ist vorher und nachher gleich lang. Dritter:
  `git show-ref` kennt `refs/heads/fleet-suite/…` nach dem Bau **nicht** mehr.
- **Breaker:** das Bundle aus `HEAD` statt aus dem Stash-Commit bauen → die uncommittete Datei fehlt
  im Klon, Check rot. **Das ist der wichtigste Breaker des Plans**, weil `HEAD` die plausible
  falsche Implementierung ist und der Fehler sich als „grün" tarnt: die Suite läuft, sie prüft nur
  den falschen Baum.

**S4 — Claim, für beide Job-Arten.**
- Datei/Symbol: `server.ts#helperClaim` — der `find` über `auditQueue` wird eine Auflösung über
  beide Quellen; die vier bestehenden 409-Zweige bleiben, dazu die Lane-eigenen: zurückgezogen ·
  Lane-Slot weg oder recycelt (`slot + openedAt`) · schon geclaimt.
- Sonde: zweiter Claim auf denselben Job → 409 · Claim nach `withdraw` → 404 · Claim, nachdem der
  Fixtur-Lane-Slot geschlossen wurde → 409/404 · und die Gegenprobe, dass ein Audit-Job daneben
  weiterhin normal claimbar ist.
- **Breaker:** die Withdraw-Prüfung im `find` weglassen → „Claim nach withdraw" liefert 200, rot.

**S5 — Das Ergebnis, getrennt geführt.**
- Datei/Symbol: `server.ts#helperResult` verzweigt nach Job-Art: Audit → unverändert
  `appendEvent(POSTLAND_AUDIT_FILE, …)` + `mintAuditEvents`; Lane-Suite → in den Job-Datensatz,
  **kein** Ledger-Append, **kein** `recordAuditDuration`, **kein** `kickAuditDrain`.
- Sonde: Zeilenzahl von `post-land-audits.jsonl` vor und nach einem Lane-Suite-Report ist
  **identisch** — und daneben der positive Check, dass ein Audit-Report sie um genau 1 erhöht.
- **Breaker:** den Lane-Suite-Zweig ebenfalls durch `appendEvent(POSTLAND_AUDIT_FILE, …)` schicken →
  die Zeilenzahl steigt, Check rot.

**S6 — Der Rückweg zur Lane.**
- Datei/Symbol: `server.ts`, `GET /api/self/suite-offer` — liefert `state`
  (`open|claimed|reported|withdrawn|lapsed`), bei `claimed` auch `expiresAt`, bei `reported` das
  Verdikt **samt `remote{name,claimedAt,reportedAt}` und `treeSha`**.
- Sonde: nach dem Helfer-Report liefert das GET der Lane `state:"reported"`, den Exit-Code, den
  Gerätenamen und den Tree-Sha; ein zweiter Check vergleicht diesen Tree-Sha mit dem, den die Lane
  aus ihrem eigenen Baum rechnet, und beide sind gleich.
- **Breaker:** den `remote`-Block aus der Antwort nehmen und nur den Exit-Code liefern → der
  Etikett-Check (§6) wird rot. Ein Verdikt ohne Herkunft ist genau der Satz, den §6 verbietet.

**S7 — Die Perimeter-Naht.**
- Datei/Symbol: `server.ts#handleHelperRoute` (die EINE Regex, die die ganze Vor-Auth-Fläche nennt)
  und `e2e/security.ts#HELPER_ROUTES`. **Wenn Schnitt 1 ohne neue Helfer-Route auskommt** — und er
  sollte: Claim, Result und Bundle tragen beide Job-Arten —, ändert sich hier NICHTS, und das ist
  das Ziel.
- Sonde: **existiert bereits** — `e2e/security.ts` §1, „the pre-auth route set equals the reviewed
  allowlist". Läuft in `./e2e-isolated.sh`.
- **Breaker:** eine Route zu `handleHelperRoute`s Regex hinzufügen, ohne `HELPER_ROUTES` zu
  ergänzen → §1 rot. Der Breaker ist hier schon vorgeführt worden, als das Portal landete; Lane B
  muss ihn nur nicht übersehen. **Und die Falle daneben:** ein `startsWith`-Präfix statt
  Gleichheit/Regex ist eine funktionierende Route, die der Pin STRUKTURELL nicht sieht — der
  Kommentar an der Regex sagt das ausdrücklich.

**S8 — Die Portal-Seite.**
- Datei/Symbol: `src/helper.ts#bootstrapText` (`git clone -b <branch>` — M6/M7!),
  `src/helper.ts#jobCard` (Karte nennt Branch statt „N land(s)"), `src/helper.ts#refresh`
  (die Unterzeile aus §0 stimmt dann nicht mehr), `src/helper.ts#Job` (Feld `kind`).
  `public/helper.html` braucht ABGELEITET keine Änderung — die Seite baut jeden Knoten in `helper.ts`.
- Sonde: ein Pin in `e2e/pins.ts` — für einen Lane-Suite-Job enthält der Bootstrap-Text
  `clone -b`; und die Leer-Karte spricht nicht mehr ausschließlich von Audits.
- **Breaker:** das `-b` streichen → Pin rot. Der Pin ist billig und er kauft genau das, was M6
  gemessen hat: ohne `-b` bekommt der Helfer ein leeres Verzeichnis und keinen Hinweis warum.
- **Achtung:** `src/helper.ts` steht in `watchdog.sh`s tsc-Liste, aber **nicht in der des laufenden
  Servers** (§1.3). Bis zum srv-Neustart deckt der Land-Gate diese Datei nicht ab — von Hand
  `bunx tsc` darüber, sonst ist „Gate grün" hier ohne Aussage.

**S9 — Die Regel für die Lane.**
- Datei/Symbol: **`CLAUDE.md` ist ein GENERAT** — nicht die Datei ändern, sondern das Fragment.
  Quelle: `rulebook.ts#RULEBOOK_FRAGMENTS` + die Fragmentdateien unter
  `/Users/owner/claude-fleet/rulebook/` (untracked, im Worktree **nicht** vorhanden,
  `git show main:rulebook/…` findet sie nie). Betroffen ist das Lane-Disziplin-Fragment, an der
  `./e2e-isolated.sh`-Zeile: Angebot → warten nach `suiteLock` (§5.2) → withdraw → lokal.
- Sonde: `e2e/pins.ts` — dieselbe Bauart wie `RULE_VERIFY`, das die Schrittkette über drei Quellen
  vergleicht: die Wartezahlen (180 s / p50-Deckel) dürfen nicht zwischen Regelbuch und Code
  auseinanderlaufen.
- **Breaker:** die Zahl im Fragment ändern, ohne die Konstante im Code zu ändern → Pin rot.
- **Und die Übergabe-Regel:** eine Lane, die `CLAUDE.md` anfasst, sieht ihre Änderung nie in
  `git status` (gitignored, beim Spawn nur KOPIERT) und sie stirbt mit dem Worktree. Lane B meldet
  die Regelbuch-Änderung deshalb **als Text im Report**, damit sie im Haupt-Checkout am Fragment
  nachgezogen wird.

---

### Verifikationsweg für Lane B selbst

`GET /api/self/gate` fragen und `localProof.steps` fahren. Ein Diff, der `server.ts` anfasst,
klassifiziert nach `verify-proportion.ts#ruleFor` als `server-or-host-runtime`: volle lokale Kette,
`isolatedPreview: "self-assess"`. Ein Diff, der zusätzlich `e2e/` anfasst — und dieser Plan tut das
in fast jedem Schnitt —, ist `e2e-or-merge-land`: volle Kette **und `isolatedPreview: true`**, die
Vorschau ist Pflicht. Genau darum ist Lane B der erste echte Kunde des eigenen Features; sie sollte
es aber **nicht** auf sich selbst anwenden, bevor S1–S6 grün sind.
