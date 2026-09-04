# Falsifikator Option A — `./e2e-isolated.sh` auf second-host, 2026-09-04 (Baum `8567a41`)

urteil: Empfehlung A STEHT. Die beiden Familien, deren Rot A umwerfen wuerde (`e2e/programs.ts`:
Succession/Program-MAIN/ACP-16 und `e2e/slots.ts`: Spawn/Delivery), sind auf Linux vollstaendig
gruen; der Lauf hatte genau EIN FAIL, und es liegt in `e2e/watch.ts` (D2-Lane-Autoclose). Die
Asymmetrie der Vorlage gilt unveraendert: dieses Gruen beweist die Lebenszyklus-MASCHINERIE unter
Stand-ins (`FLEET_CMD=true`) — es beweist NICHT, dass eine echte claude-Session auf Linux gruendet.

Schnitt 1 des Programs „Dual-Host Fleet — Second-host Session Runtime" (`cd110019`), gefahren von
der Program-MAIN Slot 11 nach dem Owner-Entscheid Gate 1 = A (Attention `b0f54823`, ueber
Controller Slot 5). Vorlage: `docs/attic/dual-host-session-runtime-phase0-2026-08-30.md` §Erste
Schnitte.

## 1. Wie gemessen wurde — und warum ohne Geraete-Akt

Kein Shell-Zugang, kein Schreibakt auf dem Geraet. Der Lauf ging als **Remote-Command-Job** ueber
`POST /api/self/jobs` (`60cb2b1a5dcc`), die Tuer, die S2 dieses Programs selbst gelandet hat:
`./e2e-isolated.sh` ist ein Schluessel in `HELPER_CMD_ALLOW` (`server/types.ts#helperCmdCheck`).
ssh bleibt zu — am selben Tag geprobt, `owner`/`fleet`/`helper` je
`Permission denied (publickey,password)` — und wurde nicht gebraucht.

Was den Lauf bis zu diesem Tag blockierte, war nicht der fehlende Shell-Zugang, sondern ein
Daemon auf einem Baum VOR S2: `daemonSha f62b1f5` (09-02 12:37) gegen S2 `d4bb687a` (09-02 18:12).
`git show f62b1f58:helper-daemon/daemon.ts` kennt `kind:"command"` nicht. Das `daemon-update` (S1,
Owner-Akt, `ac03728d4f02`, exitCode 0) hat das geschlossen; der Daemon steht seither auf `40a55e4`,
das S2 UND S4 enthaelt (beides mit `git merge-base --is-ancestor` nachgeprueft).

Baum unter Test: `8567a41` — der Bundle-Commit des Jobs ueber `main` bei `566cbae`, `untracked: 0`,
die Trail-Zeilen melden `dirty: false`. Dauer `ms 1 516 824` (25,3 min), `exitCode 1`.

## 2. Dass der Lauf VOLLSTAENDIG war, ist gemessen — nicht angenommen

Ein Command-Job traegt **kein** `checks{ran,failed}`, und die Remote-Audit-Zeilen vor dem Deploy
von `52673b6` (10:32) waren tail-only mit erfundenen `ran`-Zahlen um 22-26. Beide Sensoren scheiden
hier also aus. Stattdessen die Artefakt-Quittung: der Job forderte `e2e-trail/*.jsonl` an und bekam
genau eine Zeile —

    e2e-trail/isolated-20260904T155501Z-2993914.jsonl   973 273 bytes
    sha256 af3faf3eb816efaafee90a6673b40772fdce6d0fd8cb25c22449870d4cb89883

Zum Vergleich, lokale Laeufe desselben Tages: ein VOLLSTAENDIGER Lauf schreibt 960 636 bzw.
960 507 bytes bei je 3 602 Zeilen; ein ABGEBROCHENER schrieb 210 334 bytes bei 829 Zeilen. Die
973 273 bytes liegen in der Groessenordnung des vollstaendigen Laufs (leicht darueber, was zu einer
zusaetzlichen Fail-Detail-Zeile bis `TRAIL_DETAIL_MAX` passt). Der Tail endet mit `1 FAILURES`.

## 3. Das eine FAIL, und warum es die Frage dieses Schnitts nicht beruehrt

    e2e/watch.ts#"D2 setup: both closing lanes reached the spent shape, and every refusing lane
    differs from them in exactly one fact"

Es liegt in KEINER der beiden benannten Familien. Der Check ist eine **Vorbedingungs-Sonde** und
faellt korrekt als SIE SELBST — sein eigener Kommentar sagt das woertlich („a lane that does not
reach this shape fails as a SETUP problem instead of making the close look broken"). Er pollt bis
zu 60 s (60 x `Bun.sleep(1000)`) darauf, dass zwei Lanes die Form `stalled === true &&
git.dirty === 0` erreichen; `stalled` haengt an `FLEET_STALLED_IDLE_MS` (in der isolierten Harness
auf 3 s verkuerzt) und daran, dass der git-Tick die Lanes gesehen hat. Das ist eine last- und
zeitabhaengige Marge, dieselbe Bauform wie §11.2l und §11.2m in `docs/verify-tiering.md`.

Das Trail-Register dieser Maschine kennt den Check erst seit heute (D2 ist heute gelandet,
`b1186d8`, und `566cbae` hat `FLEET_LANE_AUTOCLOSE=1` um 17:54:33 in die srv-Spawn-Umgebung
gelegt): **zwei lokale Sichtungen, beide gruen** — 09:09:25 auf Baum `4393fbee` und 18:01:46 in
einem Lauf, dessen Trail-Zeilen `tree: null` tragen. Der zweite lief zeitgleich mit dem
Second-host-Lauf.

**Das ist ein Hinweis, kein Beweis, und es wird hier ausdruecklich nicht adjudiziert.** Keine der
drei Sichtungen liegt auf demselben Baum wie die andere, es gibt also keinen
Gleicher-Baum-Vergleich — die Beweisordnung aus `docs/verify-tiering.md` §11.7 ist NICHT gefahren.
Zwei Lesarten bleiben offen: eine zu enge Fixture-Marge (auf jedem Host moeglich, auf dem
langsameren zuerst sichtbar) oder ein echter Host-Unterschied. Das FAIL gehoert der Program-Zeile,
die D2 besitzt, nicht dieser hier.

## 4. Was NICHT gemessen werden konnte

Das `detail` des FAILs — welche Lane welche `stalled`/`git`-Werte trug — steht in der Trail-Datei
auf second-host und ist von hier **nicht lesbar**. Der `suite.log`-Upload haengt an `auditAt` und ist
damit audit-only; ein Command-Job bekommt Artefakt-QUITTUNGEN (Pfad, sha256, Bytes), nie die Bytes.
Das ist eine benannte Luecke der Artefakt-Schiene, kein Fehler dieses Laufs. Wer die Ursache des
D2-FAILs will, braucht entweder einen Audit-Job auf demselben Baum oder eine Erweiterung der
Schiene auf Command-Jobs.

Ebenfalls nicht gemessen und ausdruecklich offen: ob `claude` auf second-host ueberhaupt installiert
ist. Von hier ist das strukturell nicht feststellbar — `HELPER_CMD_FORBIDDEN = ["claude","codex","pi"]`
verbietet der Kommando-Tuer, je einen Agenten zu nennen, und die `capabilities` im Heartbeat
(`bun`, `tmux`, `git`, `zsh`) kommen aus der Geraete-Konfiguration (`cfg.capabilities`), sind also
eine Selbstauskunft und keine Probe. Genau diese Luecke ist der Grund, warum ein Gruen hier nur die
Maschinerie beweist.
