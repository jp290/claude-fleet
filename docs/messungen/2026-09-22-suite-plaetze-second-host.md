---
frage: Traegt der Second-host 5 parallele Suite-Plaetze, was passiert bei mehr als 2 gleichzeitigen Laeufen mit Laufzeit und Rot-Rate, und welche Umschaltung (welche Datei, welches Feld, welcher Server-Wert) waere dafuer noetig?
urteil: Ja zur Maschine, nein zu 5 als naechstem Schritt — die erste Zahl ist 2, nicht der Daemon-Deckel. Der Server bietet pro Audit-Lauf nur FLEET_AUDIT_SHARDS=2 Jobs (Deckel 8), und 96 % aller Second-host-Audits sind ein Repo, also bleiben Platz 3–5 bei heutiger Angebotzahl leer, egal was der Daemon erlaubt. Die Maschine selbst traegt 5 mit grosser Reserve (RAM-Bedarf ~16 Suite-Plaetze bei 25 % Reserve, Last ~14 % von 16 Threads), aber die Rot-Raten-Belegung endet bei 2 sauber (n=256 Shard-Laeufe seit 17.09., ko-laufend 6,9 % rot gegen allein 13,4 % — keine Parallelitaets-Strafe) plus EINEM 3-Suiten-Fenster (n=1, 2026-09-06, ein Fail darin, Korrelation). Der Live-Deckel steht bereits auf 3 (Heartbeat 22.09. 19:45, running 1, load 0.56). Empfehlung: 3 wirksam machen und ueber die coResident-Fenster im Ledger beobachten; 4/5 erst nach einem Beobachtungsfenster und nur zusammen mit FLEET_AUDIT_SHARDS.
bereich: [multi-host, helper-daemon, verify, kapazitaet, suite-kontention]
belege: [helper-daemon/daemon.ts#loadConfig, helper-daemon/daemon.ts#freeSuiteSlots, helper-daemon/daemon.ts#work, server.ts#parseAuditShards, server.ts#helperClaim, e2e/pins.ts#RULE_PAR, docs/messungen/2026-09-06-second-host-parallel-suiten.md, docs/messungen/2026-09-14-ram-optimierung-astra.md, '~/fleet-extract/2026-09-22-datenschichten/post-land-audits.jsonl', '~/fleet-extract/2026-09-22-datenschichten/fleet.json (helperDevices, nur ungefaehrdende Felder gelesen)']
nicht-gemessen: Alles Live-Messbare am Geraet — ssh von dieser Lane blockiert (Sandbox darf ~/.ssh nicht lesen, Agent ohne Identitaet), darum keine frischen Kerne-/RAM-/df-/Last-Werte und kein Prozessbaum eines laufenden Laufs; die Maschinenzahlen stammen aus den Notizen vom 06.09. und 13./14.09. Vier oder fuenf gleichzeitige Suiten wurden NIE gemessen; ob die k/3-Laeufe vom 15.09. really drei Slots belegten ist unklar (das coResident-Feld existiert erst seit 17.09., die row-Spannweiten passen zu beidem); FLEET_AUDIT_SHARDS im .env nur aus dem Brief bzw. der state.sh-Ausgabe zitiert, nie geoeffnet.
stand: 2026-09-22
---

# 5 Suite-Plaetze auf dem Second-host?

2026-09-22, Lane `fleet/260922184103-35bd`. Owner-Frage woertlich: „ob wir vllt mehr
suite-plaetze auf dem second-host, vllt 5, anbieten koennen — wird wieder langsam eng“.
Gemessen wurde am Ledger-Auszug (`~/fleet-extract/2026-09-22-datenschichten/`, Stand 22.09. 19:45)
und am Code dieses Baums; das Geraet selbst ist `secondhostlinux1` (Name „second-host“), dieselbe
Debian-Kiste wie in der Messung vom 06.09.

**Vorweg, ehrlich: das Geraet ist von dieser Lane aus nicht live messbar.** Der ssh-Aufruf
scheitert zweifach — diese Sandbox darf `~/.ssh` nicht lesen (`hostkeys_foreach failed:
Operation not permitted`), und der ssh-Agent traegt keine Identitaet (`ssh-add -l`: „The agent has
no identities“). Beide Usernummern aus dem Brief (`second-hostowner@`, `owner@` antworteten
`Permission denied (publickey,password)`). Alle Maschinenzahlen unten stammen daher aus den
Messnotizen vom 06.09. und 13./14.09. plus einem Heartbeat-Schnappschuss im Auszug — nicht aus
einer heutigen Messung. Das ist die groesste Luecke dieser Notiz.

## 1. Wo der Deckel lebt — die erste Zahl ist 2, und sie steht am Server

Der Daemon-Deckel ist **nicht** die bindende Groesse. Drei Fakten aus dem Code:

- **Daemon:** `maxParallelSuites` lebt in der Geraete-Config
  (`helper-daemon/daemon.ts#loadConfig`, Default 1, Tiefstelle `Math.max(1, Math.floor(..))`, keine
  Obergrenze im Daemon), gelesen von `#freeSuiteSlots` = `max(0, cap − running)` — der Zaehler ist
  die ganze Tuer (`e2e/pins.ts#RULE_PAR`). Ueber 1 bekommt jeder Lauf seinen eigenen
  `FLEET_SUITE_LOCK` unter seinem Run-Verzeichnis (`daemon.ts#work`), der Heartbeat meldet
  `running`/`maxParallelSuites` (`daemon.ts:914`), das Board zeigt „n/m suite slots“
  (`src/client.ts:2731`).
- **Server-Seite: KEIN zweiter Deckel auf die Slot-Zahl.** `helperClaim` weist ein Geraet nur ab,
  wenn es sich im EIGENEN letzten Heartbeat fuer voll gemeldet hat (`server.ts#helperClaim`,
  „nothing here is refusing the machine, it said so itself“); `DEVICE_SLOTS_MAX = 64`
  (`server.ts:21295`) ist nur die Validierungsgrenze des Heartbeat-Felds. 5 ist dort problemlos
  lesbar.
- **Der zweite Deckel ist die Angebotzahl:** `FLEET_AUDIT_SHARDS` (Server-.env, gelesen von
  `server.ts#parseAuditShards`, max `AUDIT_SHARDS_MAX = 8`, ungültiger Wert faellt auf 1 mit
  Logzeile). Ein offerierbarer Audit-Eintrag wird als n Jobs gelistet; **ohne Anhebung dort bringt
  5 am Daemon nichts** — bei shards=2 und Ein-Repo-Last gibt es schlicht keinen dritten Job zum
  Claimen. **Das ist die erste Zahl dieser Notiz: 2.** (Stand laut Brief/state.sh-Ausgabe 2; im
  Ledger sichtbar als cmd-Mix: 117 Läufe `k/2`, 9 Läufe `k/3` — die k/3 nur am Vormittag des
  15.09., dann zurueck auf 2.)

Und die Nachfrage ist Ein-Repo: **266 von 276 Second-host-Audits im Auszug (96 %) sind
claude-fleet**; je Repo gibt es hoechstens EIN offenes Shard-Run (`auditShardRuns` ist
repo-schluesselig), und im ganzen Auszug liegen null Zeilenpaare verschiedener Audits zeitlich
ueber. Mehr-Slots-Nachfrage kann also nur aus mehr Shards pro Lauf kommen.

## 2. Last heute: der Deckel 2 ist fast immer voll belegt — und kostet nichts

`post-land-audits.jsonl`, 276 Second-host-Zeilen (29.08.–22.09. 16:59), Shard-Ebene seit
`coResident`-Verfolgung (erster Eintrag 17.09. 15:53):

| Sichtung | n | p50 | p90 | max | rot |
|---|---:|---:|---:|---:|---:|
| Shard LIEF ALLEIN | 112 | 818 s | 1 122 s | 1 131 s | 15 (13,4 %) |
| Shard LIEF KO-LAUFEND (≥1 Geschwister) | 144 | 874 s | 1 038 s | 1 091 s | 10 (6,9 %) |

- **91,2 % der Shard-Wandzeit seit dem 17.09. war Ko-Laufzeit** (2 012 von 2 206 min) — der
  Second-host ist mit seinen 2 Plaetzen praktisch immer parallel ausgelastet, wenn er Arbeit hat.
  **Die Nachfrage ist da; der Deckel, nicht der Mangel an Arbeit, begrenzt.**
- **Nie mehr als 2 gleichzeitig** (max ko-residente Geschwister: 1) — der Live-Deckel hat immer
  gehalten. Das 5-Suiten-Szenario hat also im Ledger null Beobachtungen.
- **Langsamer bei running=2? Nein.** Je Shard-Groesse: k=2 allein p50 1 001 s (n=41) gegen
  ko-laufend 999 s (n=72); k=1 allein 1 106 s gegen ko 865 s — die k=1-Differenz zeigt in die
  FALSCHE Richtung fuer Kontention und ist Epochen-Rauschen (der Baum wuchs; die Shard-Plaene
  aenderten sich). **Ein gleicher-Baum-A/B ist aus dem Ledger unmoeglich:** kein einziger
  (sha, Shard-Groesse)-Gruppe lief in beiden Armen — jeder Baum wird genau einmal auditiert. Die
  eine kontrollierte Messung bleibt die vom 06.09.: volle Suite 2 101 s seriell gegen 2 106/2 107 s
  parallel (**+0,25 %**), kein Fail ueber die Baseline hinaus im sauberen Zwei-Suiten-Fenster.
- **Röter bei running=2? Nein — die Roete folgt der Epoche, nicht der Parallelitaet.** ko-laufend
  6,9 % rot gegen allein 13,4 % (Shard-Ebene); Zeilenebene max-2-parallel 9/72 (12,5 %) gegen
  max-1 16/54 (29,6 %). Beide Differenzen zugunsten der ko-laufenden Gruppe stammen aus der
  rot-reichen Fruehphase; sie sind kein Parallelitaets-Bonus, aber sie widerlegen jede sichtbare
  Strafe. Das 3-Suiten-Fenster vom 06.09. (n=1, 8 min) trug genau einen Fail, dessen Basisrate
  (0,15 %) einen Zufallstreffer nicht ausschliesst — Korrelation, kein Kausalbeweis.
- **Wartezeit vor dem Mutex:** gate WAIT p50 0 s / **p90 1 167 s** (state.sh-Ausgabe vom 22.09., aus
  dem Brief uebernommen — im Auszug nicht nachpruefbar). Die p90 von ~1 170 s ist genau eine
  Shard-Dauer: der naechste Landende wartet auf das Ende des laufenden. **Mehr wirksame Plaetze
  kuerzen genau diese p90** — aber der grosse Broker ist Sharding (kleinere Shards pro Lauf), nicht
  nur die Slot-Zahl.

## 3. Die Maschine — nicht live gemessen, aber eng begrenzt aus zwei Notizen

Alle Zahlen aus `docs/messungen/2026-09-06-second-host-parallel-suiten.md` (Debian 13, 16 Threads,
7 858 MB RAM, Leerlauf ~1 013 MB belegt, Swap 0 in allen Fenstern) und
`2026-09-14-ram-optimierung-astra.md` §F7:

- **RAM je Suite:** Marginalkosten 224 MB (2. Suite) / 281 MB (3.); Peak belegt 1 319 / 1 543 /
  1 824 MB bei 1/2/3 Suiten; eine E2E-Instanzgruppe 102–163 MiB PSS (§F7). Mit 25 % Reserve
  (nutzbar ~5 894 MB, minus Leerlauf ~1 013 → ~4 880 MB fuer Suiten) passen **bei ~300 MB je Suite
  rund 16** — selbst bei verdoppeltem Fussabdruck noch 8. **RAM bindet 5 nicht.**
- **Last:** 3 Suiten kamen auf Peak-Load1 1,32 von 16 Threads (Mittel je Suite 0,21); linear
  fortgeschrieben liegt 5 bei ~2,2 — **~14 % der Maschine.** Die Suite wartet, sie rechnet nicht.
- **Die alte Falle war tmpfs, und sie ist geschlossen:** am 13./14.09. war `/tmp` (3 929 MiB tmpfs)
  zu 98 % voll und Swap bei 1 914 MiB; der Fix (je-Run-Scratch unter `${runDir}/tmp` auf
  ext2/ext3, `daemon.ts#work`, zitiert §F7 als Grund) ist im heutigen Daemon. `keepRuns=10` haelt
  die Run-Verzeichnisse auf der Platte — **freier Plattenplatz ist die eine Groesse, die niemand
  je gemessen hat** (mit ssh blockiert auch hier nicht nachholbar).
- `suiteTimeoutSec: 3600` (Geraete-Config): 2 107 s Parallel-Vollauf lassen 24 min Luft; bei
  5 Shards wird je Shard kleiner, nicht groesser — unveraendert tragfaehig.

**Rechnung „wie viele Laeufe passen mit 25 % Reserve“: ~16 nach RAM, >20 nach Last. Die Antwort
liegt UEBER 5 — die Empfehlung aus der Messlage ist trotzdem nicht 5, denn die Rot-Raten-Belegung
endet bei 2 sauber (n=256) plus 3 als n=1-Fenster.**

## 4. Der Stand am Geraet: 3 ist bereits gesetzt

Heartbeat-Schnappschuss im Auszug (22.09. 19:45:16): `secondhostlinux1` meldet
**`maxParallelSuites: 3`, `running: 1`, `mode active`, load 0.56**, daemonSha `48c09050`. Die
Angabe „am Geraet abgelesen 2“ (10.09.) ist ueberholt — §F7 mass schon am 13.09. Datei-Stand 4,
live 3 (kein Neustart durchgefuehrt). **Was heute fehlt, ist nicht der dritte Platz, sondern der
dritte Job:** bei shards=2 bleibt Platz 3 leer (seit dem 17.09. nie 3 ko-resident). Der einzige
Beobachtungszeitraum mit k/3 (15.09., 9 Audits) traegt keine Ko-Residenz-Angabe — ob dort 3
gleichzeitig liefen, ist unklar, die row-Spannweiten (808–1 300 s gegen Shard-Dauern 560–820 s)
passen zu beidem.

## 5. Die Umschaltung — kopierbarer Block (Owner-Akt per ssh, nie diese Lane)

```sh
# === Suite-Plaetze Second-host: 3 -> 5 (zwei Knaeufe, zwei Hosts) ===

# (A) GERAET: Deckel erhoehen. Datei: /etc/fleet-helper/config.json
#      (Pfad aus helper-daemon/fleet-helper.service#ExecStart; Datei MUSS 0600 bleiben,
#      der Daemon refusing sonst den Start, helper-daemon/daemon.ts#loadConfig)
ssh <second-host> 'grep maxParallelSuites /etc/fleet-helper/config.json'   # Stand lesen (erwartet: 3)
ssh <second-host> $EDITOR /etc/fleet-helper/config.json     # "maxParallelSuites": 5
ssh <second-host> 'stat -c %a /etc/fleet-helper/config.json' # -> 600 pruefen
# NEUSTART IST PFLICHT: die Config wird genau einmal beim Start gelesen
# (helper-daemon/daemon.ts:976-980, kein Re-Read im Tick). Nur bei running=0 neustarten
# (Board/Geraetezeile), sonst laeuft das aktive Audit in ein lapsed Claim:
ssh <second-host> 'systemctl restart fleet-helper'

# (B) SERVER (Haupt-Mac): Angebot nachziehen. FLEET_AUDIT_SHARDS in der Server-.env
#      (gelesen von server.ts#parseAuditShards beim Server-BOOT, max 8; Aenderung = Server-Neustart).
#      Ohne diesen Schritt bleiben Platz 3-5 bei der heutigen Ein-Repo-Last ungenutzt.
#      FLEET_AUDIT_SHARDS=2  ->  FLEET_AUDIT_SHARDS=5, dann Server neu starten.

# === Wirksamkeit pruefen ===
#   1. Board/Geraetezeile zeigt "0/5 suite slots" (src/client.ts:2731, Feld aus
#      server.ts#helperDevicesView; nur Werte 1..64 werden uebernommen, server.ts:31657)
#   2. Daemon-Log auf dem Geraet: "claimed audit ... (slot 1 of 5)" (helper-daemon/daemon.ts:532)
#   3. Zwei Land-Gates gleichzeitig: die naechste Post-Land-Zeile muss 5 Shards tragen,
#      davon ≥2 mit coResident-Fenstern (post-land-audits.jsonl#shards[].coResident)

# === Rueckfalltuer ===
#   Wert in config.json zurueck auf 2 (oder 3) + erneuter Daemon-Neustart. Der Server braucht
#   KEINE Aenderung (er kappen nur ueber die Selbstmeldung des Geraets, server.ts#helperClaim).
#   Ein Neustart VERGISST running (in-memory, nie persistiert) und BEHALT den Cap aus der Datei;
#   FLEET_AUDIT_SHARDS ruecksetzen braucht ebenso den Server-Neustart (env wird nur beim Boot
#   gelesen).
```

Stufenfolge, die die Messlage ernst nimmt: **(1)** shards auf 3 heben und einige Tage laufen
lassen — Platz 3 ist schon gesetzt, die coResident-Fenster im Ledger messen gratis, ob 3 sauber
ist; **(2)** erst dann 4/5 + shards=5. Der Schritt (1) ist rein serverseitig, einzeilig und
beliebig ruecksetzbar.

## Was nicht gemessen wurde

- **Das Geraet live.** ssh von dieser Lane unmoeglich (Sandbox blockiert `~/.ssh`, Agent leer):
  keine frischen Kerne-/RAM-/Platten-/Last-Werte, kein Prozessbaum eines laufenden Laufs. Alle
  Maschinenzahlen sind Zitate aus Notizen vom 06.09./13.–14.09. bzw. der Heartbeat-Zeile im Auszug.
- **Freier Plattenplatz** — nie Gegenstand einer Messung, mit ssh nicht nachholbar; bei 5
  parallelen Klonen plus `keepRuns=10` die einzige ungedeckte physische Groesse.
- **4 oder 5 gleichzeitige Suiten**: null Beobachtungen im Ledger, null kontrollierte Laeufe. Die
  Kurve endet bei 2 (sauber, n=256) und 3 (n=1-Fenster vom 06.09.).
- **Ob die k/3-Audits vom 15.09. drei Slots belegten** — coResident existierte noch nicht; die
  row-Spannweiten erlauben beide Lesarten.
- **FLEET_AUDIT_SHARDS im .env**: nur aus dem Brief bzw. der state.sh-Ausgabe zitiert (2), nie
  geoeffnet; im Ledger durch 117 `k/2`-Laeufe bestaetigt.
- **Der Mac**: dass zwei Suiten dort auf beiden Baeumen Fehler erzeugen, ist Regelbuch-Basis und
  wurde nicht angezweifelt; der Second-host-Befund vom 06.09. („gilt dort nicht“) bleibt Mac-spezifisch
  ungetestet gegenueber.
