# Welche der 71 offenen Queue-Zeilen sind heute noch wahr?

2026-08-18/19, Session `taskCleanUP` (Slot 11, Haupt-Checkout, kein Branch).
Frage: **Welche offene Queue-Zeile beschreibt einen Zustand, den es am HEAD noch gibt?**

Anlass: Owner-Auftrag „lass uns die geschedulten Tasks aufräumen — ich glaube gerade brauchen wir
davon gar nichts", nach Rückfrage präzisiert zu „einmal durchgucken, ob irgendwas davon noch
aktuell ist".

## Ergebnis

71 offene Zeilen am Baum `a317fc0` (68 pending, 1 queued, 2 sent). Alle 69 nicht-laufenden Texte
gelesen, jede Kernbehauptung mechanisch gegen den Baum geprüft. Dreiteilung:

**4 Zeilen sind erledigt oder widerlegt.**
`0ae22c2d` — verlangt `FLEET_AUDIT_PING_MS` einzuschalten; steht auf 60000 in `watchdog.sh:148`,
Vorbedingung `4455adca` ist `done`, `fleet.json.auditPings` führt 7 gefeuerte Pings.
`fedab7ae` — „old dead lanes … saying 'detached'"; behoben von `41e7f80`, in HEAD.
`f5834dfc` — Duplikat von `d72823a7` (derselbe `contextWindowFor`-Befund).
`d9b9b4c4` (die einzige `queued`) — Kernsatz „kein Ledger sagt, WELCHER Harness" ist falsch:
`harness` ist Feld auf `LaneOutcome` (`server.ts:10341`), 73 Zeilen in `lane-outcomes.jsonl` tragen
es. Teilfragen (b) Land-Zettel und (c) `state.sh` sind offen — beide 0 Treffer.

**8 Zeilen hatten eine veraltete Prämisse** — Neuschreiben, nicht starten:
`ad8e77d0` (der Seitenleisten-Umbau wurde gefahren und zweimal zurückgerollt: `2ec3b15`, `b29d2c7`)
· `ed4a318c` (Teil A gelandet als `41e7f80`; offen nur Teil B) · `1cb6778e` (die vorgeschlagene
Route `/api/attention` existiert inzwischen als etwas anderes) · `29829dac` (ein
`{kind:"deploy"}`-Watch existiert) · `94ab77dd` (für merge/audit/deploy behoben; für lane-Watches
steht im Code jetzt ein ausdrückliches „Preserve the legacy lane-watch boot rule exactly") ·
`577b26fa` (Vorbedingung F6 ist ungebaut, ihre Zeile gelöscht) · `65af341f` (der Kind `lane`
existiert nicht mehr; der Mangel — `adopt` ist Einbahnstraße — steht, die zwei Beispielzeilen sind
gelöscht) · `d2a0d45e` (einer ihrer zwei Belege ist selbst verfallen).

**Zwei Vorbedingungen sind still erfüllt worden**, ohne Nachtrag in ihrer Zeile:
`f0a710db` (Verb 3) — `releasedBy` ist gelandet. `acb5839d` (Verb 5) — `git commit` steht in
`MERGE_TOOLS` (`server.ts:9388`), der Repair-Pfad ist nicht mehr wirkungslos. Der Drill selbst ist
nie gefahren: in 361 Zeilen `lane-outcomes.jsonl` kommt `repairRounds > 0` **0×** vor.

### Die Dreiteilung als Id-Listen

**BAU (8)** — vom Owner freigegeben, gebaut von der Sanierungs-MAIN auf Slot 5 (Brief:
`docs/sanierungswelle-*`, Handoff `cf5f37e`). Stand 2026-08-19 08:30: fünf `done`
(`8e64409e` `ca630f68` `17068154` `95bf15cc` `95f893b7`), drei noch offen gebucht, obwohl der Baum
die Arbeit trägt — **nachprüfen, nicht annehmen**:

```
d72823a7 f5834dfc 8e64409e ca630f68 911bdb73 17068154 95bf15cc 95f893b7
```

**ZWEITER BLICK (21)** — bleiben pending. Kern: vier brauchen eine Owner-Entscheidung
(`58d03512`/`fc47f1e1` Busy-Gate · `c845a392` Respawn ohne Boot-Settle · `d45898cb` grünes Audit,
das nichts gemessen hat · `844915ff` Supervisor-Modell nicht durchsetzbar); `48e4f0d7` wartet auf
eine propose/promote-Entscheidung; `c5c34b7f` ist ein Negativbefund, dessen Zweck („nicht nochmal
fahren") ein Archiv verfehlen würde — er gehört eher in ein Doc als in die Queue:

```
c845a392 58d03512 fc47f1e1 d45898cb 844915ff 48e4f0d7 dda45856 a694edad 65af341f
609744d8 a0ea3b11 516d4d46 bed46685 6b7f72fb 5cc87746 84eda746 af5016bb 89b48243
d9b9b4c4 e4f87152 c5c34b7f
```

**ARCHIV-VORSCHLAG (40)** — **nicht ausgeführt, Entscheidung liegt beim Owner.** Vorlage mit je
einer Idee-Zusammenfassung und Begründung: Artefakt
`https://claude.ai/code/artifact/5c63be82-6ef1-4bbc-8e39-eff6043c25b4`.

```
08230c93 08f44054 0ae22c2d 16d5e973 190e5705 1cb6778e 29829dac 29cd2610 34205199 3a622ea1
3d707a1d 4d7aba33 54560617 54af57d6 55264c21 577b26fa 5aafbee4 5d55bcfc 5ff7233f 6440c392
6f58fc37 785ce63d 94ab77dd 9b565be8 9bf62ae6 acb5839d ad8e77d0 b3a81fd0 b634236c d2a0d45e
d375c581 df5b74ba e17a19b0 e7d61b59 ed4a318c f0a710db f551f930 f5cf00dd f6e085d5 fedab7ae
```

Der größte Block darin sind 12 Scout-UI-Zeilen vom 2026-08-07. **Ihre Prämissen stimmen alle noch**
— nachgemessen. Sie liegen sämtlich in `src/client.ts`, kollidieren laut Analyst untereinander, und
in genau dieser Datei wurden seitdem zwei Umbauten per Owner-Entscheid zurückgerollt. Der Schnitt
ist ein Kollisions- und Richtungsargument, kein Qualitätsurteil.

## Methode

Texte und Status aus `fleet.json` (nie über die API — sie ist gitignored, `rg` liefert dort leer):

```sh
python3 -c "import json;d=json.load(open('fleet.json'));
print([t['id'][:8] for t in d['tasks'] if t.get('status') in ('pending','queued','sent')])"
```

Je Zeile die Kernbehauptung als grep-Gegenprobe gegen HEAD, z. B.:

```sh
grep -c 'slot-stats' src/client.ts              # 3a622ea1-Familie: Leser vorhanden?
grep -n 'MERGE_TOOLS = ' server.ts              # acb5839d: Repair-Pfad wirksam?
grep -c '"harness"' lane-outcomes.jsonl         # d9b9b4c4: trägt das Ledger es?
git merge-base --is-ancestor 41e7f80 HEAD       # ed4a318c/fedab7ae: gelandet?
git log -1 --format='%s%n%b' b29d2c7            # ad8e77d0: warum zurückgerollt?
```

Vorbedingungs-Ids gegen `fleet.json` aufgelöst (`done` / `archived` / gelöscht), nicht gegen den
Text der zitierenden Zeile.

## Was nicht gemessen wurde

- **Die 49 `briefs/`-Dateien.** Kein verlässlicher „ist das gelandet"-Test ist bekannt; `register.sh`
  §3 schreibt sie aus gutem Grund wörtlich als `ungeprüft` aus.
- **Ob eine Zeile noch GEWOLLT ist.** Geprüft wurde nur, ob ihre Behauptung am Baum noch stimmt.
  Das ist die kleinere Frage, und sie ersetzt die Owner-Entscheidung nicht.
- **Die 3 Zeilen, die nach der Triage entstanden** (`4b4764ef` `79f9fddb` `9207a127`).
- **Der Archivschnitt selbst** — vorgeschlagen, nicht ausgeführt.
