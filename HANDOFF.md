# HANDOFF — Program-MAIN „Linux-Work-Horse" (Slot 1, S4-Erstbetrieb), 2026-08-29 mittags

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgänger-Handoff: `0d4dca8`
(dessen S4-Fahrplan ist unten abgearbeitet; die dortige Stash-Warnung gilt WEITER).

## Rolle und Programm

Programm **fcf3fec9c9e88bd33749e7d5** „Linux-Work-Horse-Anbindung", Status active, Plan:
`docs/linux-second-host-programm-2026-08-28.md` (mit neuem Abschnitt „S4 — was der Erstbetrieb
geändert hat"). Stop-Linien unverändert: kein Auto-Dispatch, kein ssh-Runner (Mac←Linux), kein
Push, kein B2-Proxy. G0/G1/G2 alle erteilt. **Neu am 2026-08-29: der Owner hat Option B des
S4-Gates freigegeben** (der Grace-Knopf, siehe unten) — das ist eine Erweiterung über „Programm
endet mit S4" hinaus und steht als solche im Plan.

## S4 — Stand: (1)–(4) FERTIG, (5) fast

- **(1) Zugang**: `ssh` auf den second-host geht mit dem Key dieses Macs. Der Setup-Report behauptete
  das schon am 28.08., es stimmte NICHT — eine Peer-Session hatte mit ihrem eigenen Schlüsselpaar
  getestet. Erst nach Owner-Freigabe wurde unser Key wirklich eingetragen. Lehre: eine
  Zugangs-Behauptung gilt erst, wenn SIE von der Maschine aus geprüft wurde, die den Zugang braucht.
- **(2) Konnektivität**: vom second-host `http=200` gegen den Fleet, connect 11 ms, Tailscale-Direkt.
  Die im Setup-Report offene Tailnet-ACL-Frage ist damit beantwortet.
- **(3) Deploy (G2)**: Helper-Daemon läuft als systemd-Unit, Gerät `second-host` (`secondhostlinux1`)
  im Register, `mode active`. Token nur in `/etc/fleet-helper/config.json` (0600), nicht in der
  Unit — gegengeprüft. „Leiser gewinnt" live bewiesen (Owner-Wunsch `quiet` überstimmt
  lokal-aktiv). **Neustartfest**: nach einem Maschinen-Neustart kam der Daemon von allein zurück.
- **(4) Baseline**: `docs/messungen/second-host-baseline-2026-08-29.md`, committet. 3×
  `./e2e-isolated.sh`, deterministisch 1655 PASS / 67 FAIL, Abbruch bei `programs.ts:2250`,
  byte-identisch über alle drei Läufe. Das ist die Adjudikationsgrundlage: **diese Signatur ist
  Plattform, jede andere ein echter Befund.**
- **(5) Portal-Job remote im Ledger**: der Claim FUNKTIONIERT (Zeile mit `remote:{name:second-host}`
  im Ledger, 11:54), aber das Ergebnis war `unknown` — siehe „Der Fund" unten. Nach dem
  ausstehenden Deploy fehlt nur noch EIN Auslöser-Land für eine GEMESSENE Zeile.

## Was heute gelandet ist (Bodies lesen: `git log 0d4dca8..HEAD`)

- `d522200` PATH-Zeile ins Unit-Template (Direkt-Commit) · `a1216ab` Leak-Redaktion in HANDOFF.md
  (Direkt-Commit) — **beide von Hand vollverifiziert**: Gate-Kette grün + `./e2e-isolated.sh`
  ALL PASS 3393/0. Für die Land-Ledger sind sie unsichtbar; `./state.sh`s Zahlen untertreiben
  darum für heute.
- `050f96c` `FLEET_AUDIT_HELPER_GRACE_MS` (Lane) — Post-Land-Audit grün 3133/0, deployt `ef4cae9b`.
- `1395962` S4-Nachtrag in Plan + Baseline-Notiz (Lane).
- **In Flug beim Schreiben dieses Handoffs**: `baf2a3a` (Lane `fleet/260829095944-e9d1`), der
  Klon-Fix. Land war gestartet; Ergebnis in `git log` und `git notes --ref=fleet/land` nachsehen.

## DER FUND, der den Zweitrechner gerechtfertigt hat

`buildHelperBundle` erzeugt ein Bundle mit genau einer Ref (`refs/heads/main`) und **ohne HEAD**.
Ein einfacher Klon davon checkt nur aus, wenn git den einzigen Branch als HEAD raten kann. Steht
`init.defaultBranch` auf `master` (Debian-Default; auf dem second-host unset, auf diesem Mac
explizit `main`), scheitert das: leerer Baum → keine `package.json` → `bun install` exit 1 → der
Daemon meldet 127 ⇒ `unknown`. Auf dem Mac reproduziert, beide Richtungen:
`git -c init.defaultBranch=master clone -q <bundle> t` → 0 Dateien; mit `-b main` → 73.

**Der eigentliche Befund ist nicht die fehlende `-b`-Option, sondern dass die Fixture den Fehler
strukturell nicht sehen konnte** — `e2e/helper-daemon.ts` lief nur auf einer Maschine, deren
`init.defaultBranch` ihn verdeckt. Genau dafür war der Zweitrechner da.

`baf2a3a` repariert es (`ref = j.branch ?? j.main`, plus ein Gurt: ein leerer Klon scheitert als
ER SELBST statt sich als Install-Fehler zu tarnen) und macht die Fixture fähig, es zu sehen
(`GIT_CONFIG_*` auf den Daemon-Prozess, NICHT auf `~/.gitconfig`). Die Lane hat die Mutation
gefahren: zurückgedreht → 6 FAILs mit exakt der Live-Signatur.

## OFFEN — das Nächste, in dieser Reihenfolge

1. **Land von `baf2a3a` prüfen**, dann **Verb-2-Deploy** (`POST /api/deploy`; 409 heißt „ein
   Post-Land-Audit läuft" und ist richtig — dann Audit-Watch armieren und warten).
2. **Den second-host-Checkout auf den neuen Stand bringen** — er hängt auf `0d4dca8` und der Daemon
   fährt von dort. Weg: `git bundle create` hier, `scp`, im Remote-Checkout fetchen/resetten,
   `sudo systemctl restart fleet-helper`. **Nicht vergessen**, sonst läuft dort weiter der Code
   mit dem Klon-Fehler.
3. **Ein Auslöser-Land** (jede echte Lane) → der Audit queued, die Grace (60 s) gibt dem second-host
   vier Poll-Versuche → **gemessene** Ledger-Zeile mit `remote`. **Erwartung vorab, damit sie
   nicht umgedeutet wird: sie wird ROT sein**, mit den 67 bekannten Linux-Signaturen. Genau das
   ist der bestandene Beweis für S4-(5), nicht sein Fehlschlag. Danach Programm auf `complete`.
4. **Owner-Entscheidung, von der Lane sauber liegengelassen**: der MENSCHLICHE Pfad hat dasselbe
   Loch. `src/helper.ts#bootstrapText` gibt für einen Audit-Job `git clone <file> fleet-audit`
   ohne `-b` aus, und `e2e/pins.ts` RULE_CLONE pinnt das AKTIV fest („the AUDIT arm must NOT grow
   a `-b`"). Der Pin kodiert einen heute widerlegten Satz. Ein-Zeilen-Fix plus Umdrehen des Pins —
   aber ein Pin umzudrehen ist eine Regeländerung und gehört dem Owner.

## Fakten, die nur hier stehen

- **Setup-Report privat**: `~/claude-fleet-private/docs/second-host-setup-report-2026-08-28.md`
  (IPs, User, MAC, WoL). Nie ins public Repo. Sein Satz „SSH-Key … in authorized_keys" war falsch.
- **`0d4dca8` trägt Fleet-IP und second-host-Adresse in der HISTORIE** — `a1216ab` hat nur den
  Arbeitsbaum redigiert. Vor einem Push von der Hauptmaschine gilt die Umschreib-Disziplin.
- **Stash@{0} im Haupt-Checkout** (unverändert aus `0d4dca8`): verwaiste Slot-16-Sol-Arbeit vom
  27.08. NICHT droppen, Owner hat nie entschieden.
- **`FLEET_AUDIT_HELPER_GRACE_MS='60000'` steht in `.env`** (Backup der Vorfassung lag im
  Scratchpad der Session und ist mit ihr weg — die Zeile ist die einzige Änderung, sie zu
  entfernen ist der Rückweg). Bekannte Kopplung: `HELPER_FRESH_MS = 3 × HELPER_SWEEP_MS` — wer den
  Sweep sehr klein setzt, macht die Grace still wirkungslos.
- **`suiteCmd` auf dem second-host spiegelt den `AUDIT_CMD` des Watchdogs** (Skip-Wache + install +
  Suite), damit remote-Verdikt und lokales dasselbe bedeuten. S5-Kandidat: `daemon.ts` fährt EINEN
  `suiteCmd` für BEIDE Job-Arten (`kind` wird nur geloggt) — für eine lane-suite-Vorschau aus
  einem echt fremden Repo würde die Fleet-Repo-Wache still zu `unknown`.
- **Watch-Naht**: `{kind:"merge"}` immer auf `armed:true` prüfen. Und ein Land direkt nach einem
  Lane-Report wird mit „the session is actively working" abgelehnt — kurz warten, wiederholen.
