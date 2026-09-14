---
frage: Wie lange braucht der Helper-Daemon auf dem Second-host je Job fuer Klon und bun install, und lohnt ein node_modules-Cache je bun.lock-Hash?
urteil: Nein. bun install meldet in 24 von 24 Second-host-Logs 4–5 ms, und die ganze Vorbereitung vom Claim bis zum Runner-Start dauert 6–9 s (Median 8 s); ein Install-Cache spart hoechstens Millisekunden je Job, auch mit n Shards. Die ~75 s aus dem Brief liegen zwischen Runner-Start und Bericht, nicht in der Vorbereitung.
bereich: [helper-daemon, verify, multi-host]
belege: [helper-daemon/daemon.ts#work, e2e/trail-emit.ts#TRAIL_RUN, server.ts#HELPER_ARTIFACT_DIR, docs/messungen/2026-09-14-suite-wartezeit-phasen.md]
nicht-gemessen: Die Aufteilung der 6–9 s auf Bundle-Download, Klon, Install und Wrapper-Staging auf dem Second-host; wo genau die ~75 s zwischen Runner-Start und Bericht liegen (Second-host-Trail wird mit dem Klon geloescht).
stand: 2026-09-14
---

# Wie lange dauert die Job-Vorbereitung des Helper-Daemons auf dem Second-host?

2026-09-14, Lane `fleet/260914172738-3b69` (Brief „SUITE SCHNELLER (6): warmer Baum auf dem Helper").
Frage: **Kostet Klon + `bun install --frozen-lockfile` je Job ~75 s, so dass ein node_modules-Cache je
`bun.lock`-Hash die Vorbereitung spuerbar kuerzt?**

Der Brief stellte den Befund so: Audit-`ms` ~1 911 s gegen Runner-Spanne ~1 835 s, „rund 75 s je Job
fuer Klon + `bun install`". Die Messung unten widerlegt die Zuordnung. Darum wurde kein Cache gebaut:
er haette laut den Logs ~4 ms je Job gespart und dafuer einen neuen Fehlerweg eingefuehrt (veralteter
oder beschaedigter Cache).

## Ergebnis

**Die Install-Zeit.** Jede der 24 zuletzt vom Second-host hochgeladenen `suite.log` beginnt mit der
Ausgabe von `installCmd`. In allen 24 steht `9 packages installed [4.00ms]` (einmal `[5.00ms]`). Das
ist bun's eigene Zeitangabe, ohne Prozessstart. Abgeleitet, nicht gemessen: bun's Standard-Backend
auf Linux verlinkt per Hardlink aus seinem globalen Cache, ein zweiter Cache davor haette also nichts
mehr zu sparen.

**Die ganze Vorbereitung.** Definition: vom Anlegen des Run-Verzeichnisses (`run-<job>-<ms>`,
`Date.now()` in `helper-daemon/daemon.ts#work` direkt nach dem Claim) bis zum Modulstart des
Suite-Runners (Zeitstempel im Trail-Namen `isolated-<YYYYMMDDTHHMMSSZ>-<pid>`, gesetzt beim Laden von
`e2e/trail-emit.ts`, Sekundenaufloesung). Dazwischen liegen Bundle-Download, `git clone`, `installCmd`
und der Start von `./e2e-isolated.sh` bis zum Runner.

| Groesse | Wert (24 Laeufe, 2026-09-14 06:52Z–16:25Z) |
|---|---|
| Vorbereitung bis Runner-Start | min 6 s · Median 8 s · max 9 s |
| davon `bun install` laut bun | 4–5 ms |
| Claim (`remote.claimedAt`) bis Run-Verzeichnis | 20–93 ms (12 Ledger-Zeilen geprueft) |
| Claim bis Bericht (`ms`) | 1 914–2 014 s |

Mit Sekundenaufloesung des Trail-Stempels ist jeder Einzelwert ±1 s.

**Wo die ~75 s liegen.** `ms` ist exakt `reportedAt − claimedAt` (z. B. 1789405152161 − 1789403147821 =
2 004 340). Davon entfallen ~8 s auf die Vorbereitung. Der Rest der Differenz zur Runner-Spanne liegt
also zwischen Runner-Start und Bericht: Runner-Boot vor der ersten Check-Zeile, Wrapper-Nachlauf nach
der letzten, Log-Auswertung und Result-POST des Daemons. Die Phasen-Notiz desselben Tages
(`2026-09-14-suite-wartezeit-phasen.md`) bucht lokal 135 s `boot` und 88 s Rest; das ist die
wahrscheinlichere Adresse, hier aber nicht auf dem Second-host vermessen.

**Mit Shards.** Das Bundle wird einmal je Shard-Run gebaut (`server.ts#openAuditShardRun`), jeder Shard
klont und installiert selbst. Bei n Shards kostet die Vorbereitung also n × ~8 s, nicht n × 75 s; der
Install-Anteil darin bleibt n × ~5 ms.

**Lokale Gegenprobe (Mac, dieser Baum `e14e61d0`).** `git bundle create` 2,62 s (18,6 MB),
`git clone -q -b` aus dem Bundle 1,45 s, `bun install --frozen-lockfile` 0,067 s Wandzeit
(bun meldet 54 ms). Auch hier ist der Install der kleinste Posten.

## Methode

Rohdaten: die vom Second-host hochgeladenen Logs unter `streams/helper-artifacts/<job>/<rowAt>/suite.log`
im Haupt-Checkout (`server.ts#HELPER_ARTIFACT_DIR`) und die Ledger-Zeilen in `post-land-audits.jsonl`.

```sh
cd ~/claude-fleet/streams/helper-artifacts
# Install-Zeit je Log
for f in $(ls -t */*/suite.log | head -24); do
  printf "%s  " "$f"; head -12 "$f" | grep -E "installed|no changes" | tr '\n' ' '; echo; done
# Run-Verzeichnis (ms) gegen Trail-Stempel (s) je Log
for f in $(ls -t */*/suite.log | head -24); do
  rd=$(grep -ao 'run-[a-f0-9]\{12\}-[0-9]\{13\}' "$f" | head -1)
  tr=$(grep -ao 'isolated-[0-9]\{8\}T[0-9]\{6\}Z-[0-9]*' "$f" | grep -v 20260826 | head -1)
  at=$(echo "$f" | cut -d/ -f2); ms=${rd##*-}; ts=$(echo "$tr" | cut -d- -f2)
  ep=$(date -j -u -f %Y%m%dT%H%M%SZ "$ts" +%s)
  echo "$rd trail=$ts gap=$((ep - ms/1000))s span=$(( (at - ms)/1000 ))s"; done
```

`grep -v 20260826` filtert eine Fixture-Trail-ID aus `e2e/lane-suite.ts`, die im Log als Check-Detail
vorkommt. Ledger: `tail -40 post-land-audits.jsonl | grep '"remote"'`, je Zeile `at`, `ms`,
`remote.claimedAt`, `remote.reportedAt`.

Rohreihe (Run-Verzeichnis → Vorbereitung in s): 1789403147914 → 8 · 1789402802336 → 8 ·
1789401133340 → 8 · 1789400171377 → 7 · 1789399117986 → 9 · 1789398155936 → 9 · 1789397102681 → 9 ·
1789395087099 → 6 · 1789394500838 → 8 · 1789393072338 → 8 · 1789392005158 → 8 · 1789391057545 → 8 ·
1789386548574 → 7 · 1789386337955 → 9 · 1789382294737 → 8 · 1789382084396 → 7 · 1789380295082 → 8 ·
1789378147210 → 7 · 1789378025239 → 8 · 1789375860019 → 8 · 1789375393641 → 8 · 1789373770311 → 8 ·
1789373367407 → 9 · 1789368727672 → 8.

## Was nicht gemessen wurde

- Die Aufteilung der 6–9 s auf dem Second-host. `runCmd` schreibt keine Zeitstempel in `suite.log`; nur
  der Install hat eine eigene Zeitangabe. Nichts auf dem Second-host wurde angefasst (Brief: DO NOT).
- Wo die ~75 s zwischen Runner-Start und Bericht genau liegen. Der Second-host-Trail liegt im Klon und
  wird nach dem Bericht geloescht (`helper-daemon/daemon.ts#work`, `finally`).
- Die Herkunft der Brief-Zahl „Runner-Spanne ~1 835 s". Sie ist nicht nachgerechnet; die hier
  gelesenen Laeufe haben `ms` 1 914–2 014 s.
