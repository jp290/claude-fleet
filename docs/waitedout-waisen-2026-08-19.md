# Der `waitedOut`-Kill trifft den Prozess, nicht die Gruppe — und der Enkel haelt den Lauf offen — 2026-08-19

**Was diese Datei ist:** ein Befund mit Mechanismus, Messung und Folge. Kein Schnitt, kein Code
geändert.

**Wie er entstand, weil die Irrwege zum Befund gehören:** der ⚙ Supervisor sah einen
`e2e-clean-review.sh` mit `ppid=1`, deutete ihn als Waise und empfahl den Kill. Ich habe
gekillt. Er nahm die Deutung danach zurück („`ppid=1` heißt, der Server spawnt detached; du hast
einen lebenden Gate erschlagen"). **Die Rücknahme ist falsch, gemessen:** ein gesunder,
server-gespawnter Lauf trägt gerade jetzt echte Elternschaft — `40666` (Server) → `71736`
(`sh -c …`) → `71739` (`/bin/sh ./e2e-isolated.sh`). `Bun.spawn` spawnt hier nicht detached,
also war `ppid=1` sehr wohl das Zeichen eines weggestorbenen Trägers. Falsch war meine erste
FOLGERUNG (Mutex-Konkurrenz als Hauptwirkung), nicht die Beobachtung — und der Kill war das,
was den hängenden Lauf beendet hat, nicht das, was ihn zerstört hat.

**Warum er zählt:** er erklärt, warum ein Land-Gate 25 Minuten laufen kann, obwohl sein
Wartebudget 15 Minuten ist, und warum `running: true` stehenbleibt, nachdem der Gate längst
getötet wurde. Der Befund entstand aus einem Irrtum in beide Richtungen und ist deshalb unten
mit seiner Entstehung protokolliert — die Zwischenstände sind falsch und ausdrücklich als
zurückgezogen markiert.

## 1. Der Mechanismus, am Code

Das Verify-Kommando wird als **Shell** gespawnt (`server.ts:9300`):

```ts
const p = Bun.spawn(["sh", "-c", cmd], { cwd, stdout: "pipe", stderr: "pipe" });
```

`cmd` ist die Kette aus `watchdog.sh` (`VERIFY_CMD`) und endet auf
`./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh`. Der Suite-Wrapper ist damit
ein **Enkel** des Servers: Server → `sh` → `e2e-*.sh`.

Läuft die Wartezeit ab, feuert `fire("wait")` (`server.ts:9314-9331`) und tötet **`p`**:

```ts
try { p.kill(); } catch {}
killTimer = setTimeout(() => { try { p.kill(9); } catch {} }, VERIFY_KILL_GRACE_MS);
```

`p.kill()` trifft den Prozess, **nicht die Prozessgruppe**. Die `sh` stirbt, der Wrapper erbt
`ppid=1` und läuft weiter.

**Der Code kennt die Restschuld und benennt sie ausdrücklich** (`server.ts:9323-9325`):

> „Residual, stated rather than defined away: grandchildren can still outlive both signals, so a
> killed gate may leave its own scratch tmux socket or suite lock behind."

**Was dort NICHT steht, und das ist der Befund:** der überlebende Enkel liegt nicht herum, er
**wartet aktiv auf den Mutex**. `e2e-stage.sh` lässt ihn in einer `sleep`-Schleife kreisen, bis
der Lock frei wird — und dann fährt er eine volle Suite für einen Merge, dessen Verdikt der
Server längst als `verify.ok: null` abgeschrieben hat.

## 2. Die Messung

Waise meines eigenen Land-Gates von 17:06, gemessen um 17:31:

```
pid 47432   ppid=1   24:38 elapsed   /bin/sh ./e2e-clean-review.sh
  Kind: sleep 15                 → sitzt in der Mutex-Warteschleife
gestartet Wed Aug 19 17:06:56    → mein `interrupted`-Eintrag trägt 17:06:53
Lock hielt derweil pid 71739     → Post-Land-Audit, ein FREMDER Lauf
```

Das Wartebudget war um 17:22 abgelaufen (`FLEET_VERIFY_WAIT_MS=900000`, `watchdog.sh`;
Default identisch, `server.ts:9070`). Der Prozess wartete zum Messzeitpunkt **acht Minuten über
sein eigenes Budget hinaus**.

Die Gate-Buchhaltung nennt ihn selbst, ohne ihn als Problem zu erkennen — aus dem
terminalen Datensatz derselben Lane:

```
[suite mutex: at least 1455s of this 1503s run was spent waiting for /tmp/fleet-e2e.lock,
 not verifying (0 of 0 staged steps blocked, and one more was still queued after 1455s
 when the run ended)]
```

„one more was still queued … when the run ended" **ist** die Waise.

## 3. Die Folge: der Lauf haengt an einer Pipe, nicht am Mutex

Der Server liest die Ausgabe bis EOF, BEVOR er auf den Exit-Code wartet (`server.ts:9358-9359`):

```ts
const [out, err] = await Promise.all([drain(p.stdout, onLine), drain(p.stderr)]);
const code = await p.exited;
```

Der ueberlebende Enkel hat die SCHREIBENDEN dieser beiden Pipes geerbt. Solange er lebt, kommt
nie EOF — `drain()` loest nicht auf, der Lauf-Await bleibt offen. Beobachtbare Folgen, alle
gemessen:

- `/api/slots/2/merge` meldet weiter `running: true`, obwohl der Gate laengst getoetet wurde.
- Die Laufzeit-Uhr laeuft ueber das Budget hinaus: `waitMs 1.455.000` gegen `900.000`.
  **Das ist die Anomalie, die sonst unerklaerlich bleibt** — der Job hing nicht 25 Minuten in der
  Warteschlange, er hing an der Pipe.
- Der Datensatz wird erst final, wenn jemand den letzten fd-Halter schliesst. Hier: ein
  `kill <pid>` von Hand, um 17:31; der terminale Eintrag traegt 17:31:56.

**INFERRED, und als solches markiert:** die Pipe-Erklaerung ist meine Ableitung aus dem
Spawn-Muster (`stdout: "pipe", stderr: "pipe"`, `server.ts:9300`), der Drain-Reihenfolge und den
drei Beobachtungen oben. Ich habe die Vererbung der fds nicht direkt gemessen (`lsof` auf den
toten Prozess ist nachtraeglich nicht mehr moeglich). Die Gegenprobe fuer die naechste Instanz:
`lsof -p <waise>` auf die Pipes des Servers pruefen, BEVOR man killt.

**Sekundaer, und schwaecher belegt:** der Enkel sitzt zugleich in der Mutex-Warteschleife von
`e2e-stage.sh` (gemessenes Kind: `sleep 15`) und haette den Lock genommen, sobald der laufende
Audit fertig ist — dann eine volle Suite fuer einen Merge, dessen Verdikt schon abgeschrieben
war. Eine allgemeine Mitkopplungs-These („jedes waitedOut macht das naechste wahrscheinlicher")
laesst sich daraus NICHT belegen: beobachtet ist genau EIN Fall, und die anderen Suiten dieses
Nachmittags hatten alle echte Elternprozesse. **Diese These wurde aufgestellt und wieder
zurueckgezogen; sie steht hier nur, damit niemand sie ein zweites Mal aufstellt.**

## 4. Was daraus folgt — Vorschläge, nicht Änderungen

**1 · Den Kill auf die Prozessgruppe richten.** `Bun.spawn` mit eigener Gruppe starten und die
Gruppe signalisieren, statt nur `p`. Dann stirbt die Kette samt Enkeln. Kosten: eine Naht im
Gate-Pfad, plus eine Gegenprobe, die nach dem Kill auf `ppid=1`-Waisen prüft — sonst ist die
Reparatur nicht beweisbar. **Das ist der Schnitt, der die Klasse schliesst.**

**2 · Bis dahin: nie in eine belegte Maschine landen.** Vor jedem `POST /api/slots/:id/merge`
`ps -eo command | grep -c '^/bin/sh ./e2e-'` fahren und nur bei `0` ansetzen. Das Muster MUSS
verankert sein (`^/bin/sh ./e2e-`) — ein schlichtes `grep` zählt zsh-Wrapper mit.

**3 · Waisen erkennbar machen.** `./state.sh` zählt unter „machine hygiene" bereits geleakte
tmux-Sockets; eine Zeile „Suite-Wrapper mit `ppid=1`" kostet nichts und macht den Zustand
sichtbar, statt ihn erst beim nächsten verhungerten Land zu bemerken.

**Und die Betriebsregel, die schon gilt:** eine Waise wird **nur über ihre notierte PID**
beendet, nie über ein Namensmuster — unter `/bin/sh ./e2e-*` läuft auch der Post-Land-Audit des
Servers und der Land-Gate fremder Lanes. Vor dem `kill` prüfen, ob der Kandidat den Lock hält
(`/tmp/fleet-e2e.lock/pid`) und ob ein entkoppelter Runner unter ihm hängt (`bun fleet-e2e*`
mit `ppid=1`, die P5-Klasse) — beides war hier NICHT der Fall, deshalb reichte der Wrapper-Kill.

## 5. Nicht geprüft

- **Ob `timedOut` (das Arbeitsbudget) dieselbe Waise erzeugt.** Derselbe `fire()`-Pfad, dieselbe
  `p.kill()`-Zeile — strukturell also ja; beobachtet habe ich es nur für `waitedOut`. **INFERRED.**
- **Wie viele Waisen heute insgesamt entstanden sind.** Zum Messzeitpunkt gab es genau eine, und
  die war meine. Frühere sind entweder von selbst durchgelaufen oder beim Server-Neustart um
  16:50 gestorben — rekonstruierbar wäre das nur aus den Suite-Logs, die ich nicht gelesen habe.
  **NOT BUILT.**
- **Ob der Post-Land-Audit-Pfad dieselbe Lücke hat.** Er hat eine eigene Kill-Staffel
  (`POSTLAND_AUDIT_KILL_GRACE_MS`), auf die der Kommentar an `:9317` verweist; ob sie die Gruppe
  trifft, habe ich nicht nachgelesen. **NOT BUILT** — die Suche wäre `rg -n
  'POSTLAND_AUDIT_KILL_GRACE_MS' server.ts` und von dort die Kill-Stelle.
