# Portfolio-Plan 2026-09-02 — alle Programs ambitioniert, neben der Sanierung

Owner-Auftrag 2026-09-02 (~03:45, Fleet Controller Slot 2): *„scope das aus und dann lass uns
einen plan neben dem sanierungsplan aufsetzen mit dem wir alle projekte nochmal ambitioniert
verfolgen."* Dieses Dokument ist der Plan NEBEN `docs/sanierung-2026-09/plan-2026-08-31.md`, nicht
dessen Ersatz. Jede Zahl unten ist am Baum `67b2265` und an `fleet.json` gemessen (Kommandos in
§1); wer sie später liest, misst neu.

## 0. Die Antwort in fünf Sätzen

1. Es laufen **sechs aktive Programs plus ein vorgeschlagenes**, jedes mit eigener MAIN-Session,
   und keines davon ist fertig — aber nur zwei (Sanierung, Task Workbench) haben heute eine
   Queue, die eine MAIN ohne Owner weiterbringt. Die übrigen vier stehen an je EINEM Owner-Tor.
2. **Ambitioniert heißt hier nicht mehr Lanes, sondern kürzere Wege zum nächsten sichtbaren
   Ergebnis:** je Program EIN benanntes Artefakt in dieser Woche, das der Owner anfassen kann
   (ein Remote-Grün, eine Simulator-App, ein spielbarer Slice, eine leere Work-Ansicht).
3. Die **Kapazität ist der Land-Takt, nicht das Kontingent:** ein Suite-Mutex, ~2 min Gate plus
   ~25 min Audit je Land, zwei Lane-Deckel im Fleet-Repo. Alles, was in fremden Repos baut
   (private-repo-p, private-repo-o), kostet diesen Takt NICHT — dort liegt der freie Hebel.
4. **Vorfahrt:** die Sanierung besitzt `server.ts`/`src/client.ts`-Umbauten (Freeze); jedes andere
   Program im Fleet-Repo baut client-only oder additiv (neue Routen, neue Module, neue Pins) und
   rebased auf den Split, nie umgekehrt. Fremde Repos sind freezefrei.
5. **Zwei Programs gehören geschlossen oder umgeschnitten, nicht weitergeführt:** Private-repo-o (drei
   Owner-Türen refused, MAIN bittet seit dem 31.08. um Ablösung) und Dual-Host in seiner heutigen
   Fassung (Erfolgsmaß „Agenten auf Linux", Owner-Ziel heute „Jobs auslagern").

## 1. Messbasis

```
python3 -c "import json;f=json.load(open('fleet.json'));print([(p['id'][:8],p['status'],(p.get('main') or {}).get('slot')) for p in f['programs'] if p['status'] in ('active','proposed')])"
python3 -c "import json,collections;f=json.load(open('fleet.json'));[print(p['id'][:8],dict(collections.Counter(t['status'] for t in f['tasks'] if t.get('programId')==p['id']))) for p in f['programs'] if p['status'] in ('active','proposed')]"
./state.sh | sed -n '/land health/,/gate WAIT/p'
```

| Program | MAIN | Repo | Queue (offen) | steht an |
|---|---|---|---|---|
| `b2a14b54` Generalsanierung | Slot 1 | claude-fleet | 9 pending, 1 sent (`41a4c42f` P3a) | nichts — läuft |
| `b9c1e0d9` Task Workbench | Slot 7 | claude-fleet (client) | 1 sent (`ff535524`, im Land), 4 pending | Freeze-Kollision auf `src/client.ts` |
| `66499a03` Fleet ohne Owner-Routing | Slot 4 | claude-fleet | 1 queued (`b0c15ca5`) | Release durch MAIN |
| `07ee8a6d` Private-repo-y | Slot 3 | private-repo-p | 1 sent (`b78fe350` Brief 2), 2 pending | nichts — läuft |
| `cd110019` Dual-Host / Second-host | Slot 9 | claude-fleet + Gerät | 0 | **`db2d6c85`** (Kanal a/b) |
| `f99e9354` Private-repo-o | Slot 6 | private-repo-o | 0 | Owner-Hold, Ablöse-Bitte refused |
| `4785b33b` Private-repo-z | keine | private-repo-p | 0 | Program-Bestätigung |

Land-Takt (Ledger, 656 Lanes): Gate p50 102 s, Audit ~25–29 min, ein Mutex. Heute Nacht wurden
sechs Lands seriell gefahren; mehr als ~15 Lands/Tag gibt der Takt nicht her, und der Post-Land-
Audit auf dem Second-host ist offline (Heartbeat >4 h alt).

## 2. Je Program: Ziel, Stand, Ambition, drei Schnitte, Tor

### 2.1 Generalsanierung `b2a14b54` (Slot 1)
- **Ziel:** `server.ts`-Kern ≤ 8 000 Zeilen, Module in `server/`, Client in `src/`-Module,
  Kommentaranteil < 20 %, alle Suiten grün (Plan §Zielbild).
- **Stand:** P0–P2 komplett (P2a `e319388`, P2b `cc391b7` gelandet, deployt). P3a `41a4c42f`
  gefilet und released. 9 P6-Notizen pending.
- **Ambition:** P3 in zwei Tagen, P4 (Server-Split) bis Ende der Woche — mit stillen Fenstern,
  die die MAIN je Split-Slice erbittet (Plan-Entscheid 2, 2026-09-01).
- **Nächste drei:** P3a → P3b → P4 Slice 1 (Slot-Lifecycle als Modul).
- **Tor:** keines. Owner-Delegation vom 01.09. gilt.

### 2.2 Task Workbench `b9c1e0d9` (Slot 7)
- **Ziel:** Work/Programs/History getrennt; jede offene Task genau einmal sichtbar; Detail ohne
  Scrollen bei 1440×900.
- **Stand:** zwei Slices gelandet, `ff535524` (Lane an der Task-Zeile) im Land, 4 pending
  (`1b677e58` Spawn-Optionen, `15a3e38b` Detail, `07c061fa` Review, `56056efe`).
- **Ambition:** die Work-Ansicht ist in drei Tagen das, was der Owner morgens öffnet — statt der
  Slot-Karten. Messbar: der Owner dispatcht eine Woche lang nur noch aus Work heraus.
- **Nächste drei:** `1b677e58` → `15a3e38b` → `07c061fa` (unabhängiger Review), streng seriell,
  weil alle drei `src/client.ts` halten.
- **Tor:** Freeze-Kollision. Regel (unten §3): client-only-Slices rebasen auf den P5-Client-Split;
  bevor P5 startet, wird die Workbench-Queue geleert oder pausiert — Slot 1 und Slot 7 einigen
  sich über eine Attention, nicht über den Controller.

### 2.3 Fleet ohne Owner-Routing `66499a03` (Slot 4)
- **Ziel:** ein Programlauf ohne Owner-Queue/Pane/Mutex/Land-Handarbeit, elf Schritte belegt.
- **Stand:** Phase 1–3 gelandet (Result-Transport, Mutex-Identität, Fleet-Report-Recovery
  `67b2265`); `b0c15ca5` (Program-MAIN-Lineage) queued.
- **Ambition:** die elf Schritte einmal am Stück durchspielen — mit `b0c15ca5` als Beweislauf,
  der Controller greift nicht ein. Dann ist dieses Program FERTIG und wird geschlossen; sein
  Ergebnis ist die Betriebsform aller anderen.
- **Nächste drei:** `b0c15ca5` → Beweislauf ohne Controller-Eingriff (Messnotiz) → Abschluss.
- **Tor:** keines außer dem eigenen Release.

### 2.4 Private-repo-y `07ee8a6d` (Slot 3, private-repo-p)
- **Ziel:** SwiftUI-App mit kostenloser Orientierung, WorkflowPack-JSON, Renderer-Regel,
  Simulator-Beweis.
- **Stand:** Brief 1 gelandet (`91e6a77`, Contract + Validator + Gate), Brief 2 in Flug
  (`b78fe350`, Slot 10), zwei Briefs pending.
- **Ambition:** eine App im Simulator, die die fünf Golden Cases fährt — bis Wochenende. Dieses
  Program kostet den Fleet-Land-Takt nicht (eigenes Repo, eigener Verify `scripts/verify.sh`),
  also darf es PARALLEL zu allem laufen; der Deckel ist die Xcode-Maschine.
- **Nächste drei:** Brief 2 → Brief 3 → Brief 4, je ein Land pro Tag, MAIN landet selbst.
- **Tor:** Provider/Modell-Messung vor Preiszusage (Program-OpenQ) — Owner-Entscheid erst, wenn
  die Messung vorliegt; bis dahin kein Tor.

### 2.5 Dual-Host / Second-host `cd110019` (Slot 9)
- **Ziel heute (Program):** Program-MAIN samt Worker auf second-host gründen und zurückführen.
  **Ziel des Owners (02.09.):** *Arbeit von dieser Maschine oder einer Session nach dort
  auslagern; die Maschine ist per Netzwerkkarte startbar.*
- **Stand:** Daemon läuft auf dem Gerät, aber veraltet (alle Remote-Ledgerzeilen ohne
  `fails/trail/clonedSha`, obwohl `server.ts#helperResult` sie seit `3974883` aufnimmt);
  Gerät offline seit ~23:00; 0 Task-Zeilen; MAIN wartet seit 22:10 an `db2d6c85`.
- **Umschnitt (an Slot 9 beauftragt 03:50):** Phase 1 = Job-Auslagerung in vier Schnitten —
  S1 `daemon-update`-Job · S2 Job v1 „command" mit `POST /api/self/jobs` und Watch `job` ·
  S3 Wake-on-LAN (Owner-Knopf + Auto-Wake, als benannte Ausnahme der Pull-Doktrin) · S4 Helfer-
  Presence + `suite.log`-Artefakt. Phase 2 = das heutige Erfolgsmaß, hinter Phase 1 und einem
  eigenen Entscheid. Analyse: `docs/ideen/2026-09-01-second-host-job-vertrag-instanz-freunde.md`
  plus die Korrekturen vom 02.09. (R2 serverseitig gebaut, R4-Locale gelandet).
- **Ambition:** das erste Remote-Grün überhaupt, und eine Lane hier, die `bun run build` dort
  laufen lässt und geweckt wird — in dieser Woche.
- **Tor:** `db2d6c85` auf (a) · MAC-Adresse in `.env` · LAN-Frage (gleiches L2-Segment?) ·
  EIN Handgriff auf dem Gerät nach dem S1-Land.

### 2.6 Private-repo-o `f99e9354` (Slot 6)
- **Ziel:** Browser-Private-Repo-C mit Rollentausch, erster spielbarer Slice über den echten
  Inputpfad.
- **Stand:** Referenz `62ef02a`, :5173/:5180 laufen; MAIN hält Owner-Hold; drei Türen refused
  (`df255c77` GLM-Reviewer, `4d6f9341` Ablösung, `9fe110f7` Succession bereit); Slot 6 bei
  36 % ctx, Opus-Slot-Datensatz.
- **Ambition, falls weitergeführt:** das Taste-Gate (`e98c0c91`, answered) mit deinen Händen
  einlösen und danach GENAU einen Slice freigeben. Falls nicht: Program `complete` mit
  Referenz-Commit, Slot 6 retire, Kontext frei.
- **Tor:** deine Wahl zwischen Weiterspielen und Schließen. Empfehlung: schließen oder auf eine
  frische Fable-MAIN mit einem Satz Auftrag neu gründen; die heutige Session ist seit 31.08.
  ohne Zug.

### 2.7 Private-repo-z `4785b33b` (proposed, private-repo-p)
- **Ziel:** Chief-of-Staff + Producer, erster Simulator-Slice.
- **Stand:** vorgeschlagen, 8 Entscheide, keine MAIN, teilt das Repo mit Private-repo-y.
- **Ambition:** erst gründen, wenn Private-repo-y Brief 3 gelandet hat — zwei Programs im selben
  Repo mit je eigener MAIN kollidieren am Package.swift. Dann eine Woche, ein Slice.
- **Tor:** Program-Bestätigung (`confirm`) und die OpenQ (kann eine Fleet-Session den Simulator
  sehen? „Nein" stoppt vor Implementierung).

### 2.8 Ideen ohne Program (bewusst nicht gefilet)
- Auftragsmarkt-Endkunden-App (26.08., Owner-Entscheid 28.08.: Vier-Tage-Experiment zuerst) —
  bleibt liegen, bis Phase 1 des Second-host die Quittungs-Form liefert; sie ist dort die
  Requester-Seite.
- Freunde-Jobs (C1) — nach dem ersten Remote-Grün, eigener Entscheid.
- Second-host-Anzeige prominenter (`d07646bc`) — client-only, gehört in die Workbench-Queue.

## 3. Regeln, die den Plan tragen

1. **Ein Land nach dem anderen, fleetweit.** Der Controller serialisiert; ein zweites Land ist
   Schlange, kein Gewinn. Deploy nur bei geschlossenem Fenster (ppid-Probe: kein
   `e2e-*`-Wrapper mit `bun server.ts` in der Elternkette).
2. **Vorfahrt der Sanierung auf `server.ts` und `src/client.ts`-Struktur.** Andere Programs
   bauen im Fleet-Repo nur additiv (neue Route, neues Modul, neuer Pin) oder client-only, und sie
   rebasen auf den Split. Vor P4/P5 bittet Slot 1 per Attention um das stille Fenster; die
   betroffene MAIN pausiert ihre Queue, der Controller landet nichts Kollidierendes.
3. **Fremde Repos sind freezefrei und takt-frei:** private-repo-p und private-repo-o laufen parallel,
   ihr Deckel ist die Maschine (Xcode, Browser), nicht der Mutex.
4. **Fable 5.1 high überall**, Owner-Vorgabe 01.09.; Opus-Slot-Datensätze (6, 9) werden bei der
   nächsten Nachfolge korrigiert, nicht per Restart.
5. **Ein Program endet:** wenn sein Erfolgsmaß NACHGEMESSEN ist (Messnotiz), wird es `complete`
   und seine MAIN retired. Offene Programs ohne Zug seit >48 h kommen auf diese Liste.
6. **Der Advisor (`⚙ steward`, Slot 11) evaluiert jede Session einzeln** und liefert je Session
   den einen Anstoß; der Controller setzt um. Anstöße sind Mechanismen (Watch, Auto, Release),
   nie Vorsätze.

## 4. Reihenfolge der nächsten 48 Stunden

1. `ff535524` landen → `1b677e58` (Workbench) dispatchen. `b0c15ca5` nach Slot 4s Release.
2. Slot 9 filet die vier Second-host-Schnitte; nach (a) S1 dispatchen.
3. Brief 2 landet (Slot 3 selbst); Brief 3 dispatchen.
4. P3a landet (Slot 1 selbst); P3b.
5. Advisor-Evaluation lesen, Anstöße setzen; Private-repo-o-Entscheid einholen.
6. Nach dem S1-Land: Handgriff auf dem Gerät; Baseline-Läufe; erstes Remote-Grün.

## 5. Offene Owner-Entscheidungen, nummeriert

1. **`db2d6c85`** → (a) Daemon-Verzweigung (Empfehlung) oder (b) beschnittener ssh-Key.
2. **MAC-Adresse des Second-host** in `.env` (`FLEET_HELPER_MAC_second-host`) und: hängt der Mac
   im selben LAN-Segment?
3. **Termin für den einen Handgriff** auf dem Gerät (nach dem S1-Land).
4. **Private-repo-o:** schließen, neu gründen oder Taste-Gate selbst einlösen?
5. **Private-repo-z:** bestätigen jetzt (kollidiert mit Private-repo-y im Repo) oder nach Brief 3?
6. **Freunde-Jobs (C1):** ja/nein — erst relevant nach dem ersten Remote-Grün.

## 6. Nicht geprüft

Der tatsächliche Daemon-Stand auf dem Gerät (kein Kanal). Ob die Xcode-Maschine zwei
private-repo-p-Programs parallel trägt. Die Advisor-Evaluation lag bei Redaktionsschluss noch nicht
vor. Wachstum der Slot-Kontexte über den Tag (Band 25/30 gilt je Session).
