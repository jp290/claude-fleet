# Queue auf Sammelzeilen umstellen — das Verfahren

Wann: Die Queue hat viele kleine `auftrag`-Zeilen, die sich auf denselben Dateien gegenseitig
serialisieren, und der Owner sieht „abarbeiten ohne Resultat". Das Ziel ist eine Queue aus wenigen
Zeilen mit je einem Ergebnis, das der Owner nach dem Land spuert. Ein weiteres Dokument ueber die
Queue ist nicht das Ziel.

Erstmals gefahren am 2026-09-18: 40 Zeilen wurden 7. Ablauf, Belege und Panne stehen in
`docs/messungen/2026-09-18-queue-umstellung-sammelzeilen.md`, das Urteil je Zeile in
`docs/messungen/2026-09-18-queue-sichtung-40-auftraege.md`.

## Die drei Regeln, die das Verfahren begruenden

1. **Eine Sichtung endet in der Queue.** Das Ergebnis sind angelegte Sammelzeilen und archivierte
   Quellzeilen, kein neuer Plan als Kommentar oder Notiz. Am 2026-09-18 lief die dritte Sichtung in
   24 Stunden, und jede vorige hatte nur ein Dokument hinterlassen.
2. **Vorher die laufende Sichtung einbeziehen.** Pruefen: Gibt es eine Lane mit „Wellenplan" oder
   „Sichtung" im Brief, oder eine Notiz vom selben Tag unter `docs/messungen/`? Dann auf ihr
   aufbauen und nicht neu ableiten.
3. **Rollen:** Die MAIN gibt frei und landet, der Tick startet, die Orchestratorin plant nur den
   Inhalt der Queue. Ein Hand-Dispatch braucht einen benannten Grund.

## Schritte

### 1 · Sichten, nur lesend

Je offener `auftrag`-Zeile ein Urteil: `ueberholt`, `erledigt`, `lebendig` oder `unklar`.
- `ueberholt` und `erledigt` gelten nur mit Beleg. Belege sind eine Owner-Entscheid-Id, ein
  Program-`nonGoal` oder ein Commit, fuer den `git merge-base --is-ancestor <sha> main` gilt. Ohne
  Beleg heisst das Urteil `unklar`.
- Pflichtquellen:
  - `fleet.json` → `tasks[]`. Die Datei ist gitignored, `rg` sieht sie nicht; lesen mit `python3`
    und `json`.
  - Die offenen `richtung`- und `notiz`-Zeilen. Dort stehen die Owner-Entscheide, die Auftraege
    ueberholen.
  - `programs[]` mit ihren `nonGoals`.
  - `git log` mit Bodies.
  - `./register.sh` Abschnitt 2, die Kollisionsflaeche.
- `server.ts` traegt ein NUL-Byte. `rg` meldet dort „binary file matches"; fuer Symbolsuche darum
  `grep -a`.
- Ein Subagent darf das machen. Seine Ueberholt-Urteile sind trotzdem Claims: mindestens die, die
  zum Archivieren fuehren, selbst nachpruefen. Ein nur abgeleitetes Ueberholt-Urteil, gegen das kein
  Owner-Entscheid spricht, fuehrt nicht zum Archivieren.

### 2 · Buendeln

Lebendige Zeilen zu hoechstens etwa sieben Themen. Je Thema:
- ein Ergebnis-Satz, den der Owner spuert (Verhalten, nicht Mechanik),
- ein hartes `DONE` je Teil,
- `VERIFY` aus der Kette (`AGENTS.md` §Verify),
- `ROLLE` nach der Modellpolitik, Opus nur mit benanntem Urteilsanteil,
- `FLAECHE`.

Themen, die dieselbe Datei tragen (heute fast immer `server.ts`), bekommen eine Reihenfolge.

### 3 · Karten schreiben

Format nach `card-extract.ts#parseFormattedCard`:
- `[TITEL]`-Zeile, direkt darunter nur die Schluessel aus `card-extract.ts#FORMAT_KEYS` (`ROLLE
  GROESSE FLAECHE NEU NACH VERIFY DONE VERBOTEN`), ohne Leerzeile dazwischen.
- Jeder andere Schluessel im Kopf (`FILES:`, `QUELLEN:`) beendet den Kopfblock. Fehlen dann
  Pflichtschluessel, wird die Zeile als Prosa gelesen.
- Der erste Absatz nach dem Kopf ist das Ziel. Jedes Symbol aus `FLAECHE` muss dort als
  Aenderungsziel stehen.
- `QUELLEN` (die aufgefangenen Ids) ist ein Absatz danach.
- Reihenfolge ueber `NACH: <id>`. Die Kante wartet auf Status `done` des Vorgaengers, also auf sein
  Land (`start-plan.ts`, Zweig `after`).

### 4 · Karten pruefen, bevor gepostet wird

Lokal gegen `card-extract.ts#validateCard` mit dem Kontext des Servers:
- `trackedPaths` aus `git ls-files`,
- `rowKnown` aus den Ids in `fleet.json`,
- `symbolIndex: null`.

**Grenze:** ohne Graph-Index prueft `validateCard` ein Symbol nur ueber die Existenz seiner Datei.
Darum jedes `datei#symbol` aus `FLAECHE` zusaetzlich gegen `task-metadata.ts#declaresSymbol`
pruefen.

Beide Proben einmal mutieren (ein erfundenes Symbol, ein `NACH: deadbeef`). Eine Probe, die die
Mutation nicht faengt, beweist nichts.

### 5 · Kanten gegen das Archivieren pruefen

Fuer jede Zeile, die archiviert werden soll: Traegt eine verbleibende Zeile eine `card.after`-Kante
auf sie? Dann bleibt diese stehen („keine Queue-Zeile mehr — MAIN oder Owner entscheidet"). Eine
erledigte Zeile mit eingehender Kante bekommt `POST /api/tasks/:id/done` statt `archive`.

### 6 · Anhalten, was nicht starten soll

**Mit einem Hold, nicht mit `unqueue`.** Unter der Program-Politik `card-valid` gibt der Server jede
`pending`-Zeile mit gueltiger Karte und ohne Hold selbst wieder frei (Audit `task_release … by=policy
card-valid`), zum Beispiel direkt nach einem Boot. Einen Hold setzt die gebundene MAIN mit
`POST /api/self/tasks/:id/hold`; eine Owner-Route dafuer gibt es nicht.

Lesung, welche Zeilen die Politik treffen kann: `pending`, im Program, **kein** `hold`, Karte
gueltig.

### 7 · Posten, archivieren

- `POST /api/tasks {text, kind: "auftrag", programId, queue: true}` in Kettenreihenfolge, damit
  jede `NACH`-Id beim Posten schon existiert. `queue: true` ist eine Freigabe durch den Poster.
- Danach die Server-Karte lesen: `task.card` wird asynchron vom Karten-Tick geschrieben (Takt
  `FLEET_CARD_MS`). Pruefen: `valid`, `gaps`, `after`, `rolle`.
- `POST /api/tasks/:id/archive {grund, beleg}` je Quellzeile. `grund` nennt die Sammelzeile und den
  Owner-Entscheid, `beleg` die neue Id.
- Rueckweg: `POST /api/tasks/:id/unarchive` und `./register.sh --archived <muster>`.

### 8 · Deploy und Deckel, falls noetig

- Deploy nur ueber `POST /api/deploy`, nach `./ctl.sh merges` mit exit 0.
- `server.ts#deployBlocker` zaehlt laufende Lands und laufende Audits. Eine wartende Audit-Zeile
  liegt in `post-land-audit-queue.json` und ueberlebt den Neustart.
- Das Verdikt steht nach dem Boot in `GET /api/deploys` (`ok`, `hitTarget`). Danach
  `deployGap.codeBehind` und `bundleStale` auf `/api/sessions` lesen.
- Deckel: `POST /api/repo-lane-cap {repo, maxLanes}`. Ihn erst heben, wenn die Queue nur noch
  enthaelt, was starten soll. Sonst startet der Tick die alten Zeilen.

### 9 · Festhalten, wo die Nachfolgerin sucht

- Die Reihenfolge und den ausgefuehrten Stand als Kommentar an die Richtungszeile der Reihenfolge
  (2026-09-18: `0f2024dc`).
- Die MAIN des Programs mit einer gebuendelten Nachricht informieren: `./ctl.sh send --main
  <programId> <datei>` loest den gebundenen Slot zur Sendezeit auf. MAINs wechseln den Slot bei einer
  Nachfolge.
