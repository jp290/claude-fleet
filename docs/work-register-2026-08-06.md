# Das offene Register — alle Dokumente einmal durchgesehen, 2026-08-06

*Anlass: Owner-Auftrag „halt alle Fäden und trenn sie in sinnvolle Gruppen" und, unmittelbar
danach, „ich will wirklich, dass du alle Dokumente hierin abarbeitest". Dieses Dokument ist die
Antwort auf beides — und §5 ist die Antwort auf die Frage, die er im selben Atemzug gestellt hat:
ob wir dafür „einen robusten Context- + Handoff-Mechanismus für Main-Sessions" brauchen.*

**Warnung an den Leser, die dieses Dokument über sich selbst ausspricht:** es ist ein
**Schnappschuss vom 2026-08-06**. Genau die Sorte Artefakt, deren Verrottung §4 belegt. Wer es
in einer späteren Session liest, prüft zuerst §6 und dann die Zeilen, auf die er bauen will —
und baut, wenn es sich lohnt, §5 statt es fortzuschreiben.

## 1. Die Dokumentenlage — vier Klassen, nicht eine

Gezählt am Baum: **19 Docs** (ohne Attic), **55 Attic-Docs**, **32 Briefs**, `BACKLOG.md`
(1269 Z.), `HANDOFF.md` (30 Sessions), plus die **Live-Queue** (44 Zeilen, davon 14 offen).
Sie sind nicht gleichartig, und sie gleich zu behandeln ist der Fehler, der zu heute geführt hat:

| Klasse | Was drin ist | Wie man sie liest |
|---|---|---|
| **A · Lebendes Register** | Live-Queue · `docs/autonomy-map-2026-08-06.md` §11.3 · `docs/autonomy-verbs-2026-08-06.md` · `briefs/ui-next-level-2026-08-06.md` | Trägt offene Arbeit. Vor dem Planen lesen. |
| **B · Historischer Beleg** | die meisten `briefs/*` (ausgeführt, Ergebnis gelandet) · `docs/agent-visibility` · `briefs/stalled-clock-hooks-refuted.md` | Nicht Arbeit, sondern **Beweis**. Verhindert Wiederholung. Nie als offene Liste lesen. |
| **C · Überholt, aber nicht markiert** | `BACKLOG.md` Track A + Teile von Track B | Der gefährliche Fall: liest sich wie A, ist aber Juli-Stand. Siehe §4. |
| **D · Attic** | `docs/attic/*` (55) | Ausdrücklich stillgelegt. Nur als Quelle für „warum haben wir das verworfen". |

**Der Kern-Befund:** wir haben **zwei Register** — die Queue (live, maschinenlesbar) und die
Dokumente (Prosa, von Hand gepflegt) — und **keine Verbindung**. Dieselbe Arbeit steht unter
drei Namen (§4). Kein Prozess merkt es.

## 2. Methodik, damit die Klassifikation prüfbar ist

- **Queue:** `GET /api/tasks`, alle nicht-`done`/nicht-`archived` Zeilen (14).
- **Briefs:** Datum des letzten Commits je Datei + Gegenprobe, ob die beschriebene Arbeit im
  Baum steht. **Der naheliegende Test — „wird der Dateiname in einem Commit genannt?" — ist
  untauglich:** `briefs/phantom-park.md` wurde in **0** Commits genannt, seine Arbeit ist als
  `035c1a9` gelandet. Falsch-negativ-Rate zu hoch, deshalb wurde jeder August-Brief einzeln
  entschieden. **Nachtrag 2026-08-06, beim Bauen von `register.sh` gemessen:** der Zähler steht
  inzwischen auf **1**, und der eine Commit ist `adcd4ee` — dieser Absatz. Der Test zählt Prosa
  ÜBER einen Brief, nicht seine Arbeit, und ist damit auch falsch-POSITIV. Das Skript druckt ihn
  als Lesezeiger und schreibt als Urteil wörtlich „ungeprüft".
- **Docs:** Suche nach offenen Markern (`offen`, `ungebaut`, `TODO`, `unbeantwortet`) und
  Lektüre der Trefferzeilen.
- **BACKLOG:** das Register (Track A/B) gelesen, sechs P-Items und fünf B-Items per grep gegen
  den Baum gegengeprüft. **Ein grep-Treffer beweist Anwesenheit, nicht Funktion** — wo unten
  „vorhanden" steht, ist das die Aussage, nicht „funktioniert".

## 3. Das offene Register — jede Zeile genau einmal

Gruppen nach **Kollisionsfläche**, nicht nach Thema (Begründung: `HANDOFF.md` Session 31).

### G1 · Land-/Merge-Maschinerie
| Herkunft | Item | Fläche |
|---|---|---|
| Queue `25b79c23` | Repair-Worker darf nicht committen (`git commit` 0× in `MERGE_TOOLS`, `merge-prompt.ts:187` verlangt es). Latent: `repairRounds` = 0 in allen 104 Ledger-Zeilen | `server.ts` Profile, `merge-prompt.ts`, `e2e/prompts.ts` |
| BACKLOG P-7c | `FLEET_VERIFY_CMD` pro Repo — `verifyCmdFor`/`repoVerify` kommen **0×** vor | `server.ts` Verify-Pfad |

### G2 · Queue-Wahrheit (die eine Funktion `otherOpenLanes`)
| Herkunft | Item | Fläche |
|---|---|---|
| Queue `05ba5609` | Rebaste Lane meldet 37 Dateien statt 1 (Vergleich gegen den unveränderlichen Fork-Commit) | `otherOpenLanes` |
| Queue `db02104d` | Leere Lane hält eine Zeile fest — Fehlalarm der neuen Kollisionsprüfung, live gemessen | dieselbe Funktion |
| Queue `cabf3c88` | Eine startende Zeile sieht man ihr nicht an | `src/client.ts` Row |
| Map 5.3 | `files` als Feld am Refine-Kind statt Prosa | `refine-prompt.ts`, Confirm |

**Diese vier gehören in EINE Lane.** Zwei der Items sind zwei Fehlerrichtungen derselben Funktion.

### G3 · Sensoren + die ungelesenen Notizen
| Herkunft | Item |
|---|---|
| Map 6.2 | `sinceLastLook` schlüsselt nach Branchname statt nach Repo |
| Map 6.3 | `transcriptFact.mtime` ist kein Aktivitätssignal und warnt nicht vor sich selbst |
| Map 9.2 | Requeueter Dispatch lässt seine Lane stehen — ein Leck |
| Map E | Digest-TTL (`DIGEST_TTL` ist im Code **vorhanden** — ob es der Map-Punkt ist: ungeprüft) |
| Queue-Notizen | `05320523`, `94565a55`, `b759e8d9`, `9821035e` — füttern genau diese vier |
| Brief `stalled-parked-and-ledger.md` | Parkungs-Markierung (Teil 1) vor Instanz-Ledger (Teil 2). **Nie gespawnt.** |

### G4 · Board-Rest
| Herkunft | Item |
|---|---|
| Queue `2784427e` | F6 Uploads (Owner-Entscheid „lane-lokal" steht wörtlich im Brief) |
| UI-Brief §F7 | Drag&Drop im Explorer — **keine Queue-Zeile** |
| Queue `356333db` | Zeit der letzten Ausgabe sichtbar machen |
| BACKLOG B-4/B-5/B-6 | UI-Verdichtung · Print/PDF · Per-Device-Streams — alle unverändert offen |

### G5 · Harness-Öffnung + Pi
`0d39cc94` (drei harness-blinde Stellen, `ready`, ohne Owner baubar) · `944281c5` (**braucht den
Login des Owners**) · Brief `pi-adapter-2026-08-06.md` ist der Beleg dazu, keine offene Arbeit.

### G6 · Autonomie: Verben 2–5 + Rückkanal
Verb 2 Deploy (**`api/deploy` kommt 0× vor** — ungebaut) · Verb 3 Auto-Promote · Verb 4 Steward
auf neuen Schienen (Steward ist **unbesetzt**) · Verb 5 Auto-Land · Map **G** (Inbox, bewusst
zuletzt) · Queue `1981be9a` (Autonomie-Bausteine, in Flug beim Owner) · `0be58694`
(Entscheidungsnotiz, kein Auftrag).

### G7 · Plan-Hygiene — neu, und Voraussetzung für alles Weitere
BACKLOG-Reconciliation (§4) · ~~**P-10 L1-Rot-Detektor**~~ und ~~`register.sh`~~ **beide gebaut am
2026-08-06** (§5 trägt die Fassung, die daraus wurde) · BACKLOG P-6 Program-Board (`0` Treffer,
ungebaut, Owner-Entscheid „bauen oder nicht" steht seit Juli offen).

**Nicht in einer Gruppe, weil erledigt:** BACKLOG P-5 (Lane-Pfad) ist durch die Platzierung im
Schwesterverzeichnis faktisch gelöst · P-7a/P-7b (Digest-Cache, SIGKILL) sind vorhanden ·
B-1 Esc (16 Treffer), B-15 Lane-Vokabular, B-16 Orphan-Reap, B-18 Recorder, B-9 Audit-Log,
B-10 Worktree-Spawn, **B-13 = F5 = heute gelandet**.

## 4. Was an `BACKLOG.md` nachweislich veraltet ist

Nicht als Vorwurf, sondern als Beleg für §5 — jede Zeile ist eine Messung:

1. **Item 13 „Right sideboard: project file tree" IST F5** und ist heute als `ed5c352` gelandet.
   Das BACKLOG weiß es nicht.
2. **Item 12 „File / screenshot drop" IST F6 IST Queue-Zeile `2784427e`.** Drei Namen, eine Sache.
3. **P-4 sagt „Client rendering still open"** — `deployGap` steht **5×** in `src/client.ts`.
4. **Zwei Zeilen tragen „SHIPPED, NOT yet deployed"** (P-1a, P-4) für Arbeit vom 24. Juli.
5. Track A ist auf den Stand **2026-07-23/24** verankert (Ladder, `promotionEligible`,
   Steward-Outcomes). Das Programm ist seither zweimal umgebaut worden (Analyse statt
   Eval-Gate, `500ff63`; die fünf Verben; die Landkarte). Track A beschreibt eine Welt, die es
   nicht mehr gibt.

## 5. Der Mechanismus — warum ein besserer Handoff das falsche Ziel wäre

Die Frage war: brauchen wir einen robusten Context-/Handoff-Mechanismus für Main-Sessions?
**Die Diagnose sagt: nicht Handoff. Register.** Drei Beobachtungen tragen das:

- **Was heute gefehlt hat, war nie Erinnerung.** Der Handoff war da und gut. Was fehlte, war ein
  Ort, an dem „Item 13 = F5" steht — eine **Verbindung**, kein Text.
- **`state.sh` hat den Beweis schon erbracht.** Von Session 8s Handoff wurde genau ein Teil
  benutzt, und der war ein Skript. Prosa-Zustand ist beim Lesen veraltet; abgeleiteter Zustand
  nicht. Genau dieselbe Kur braucht die **Arbeitsliste**, nicht nur der Maschinenzustand.
- **Mehr Dokumente machen es schlimmer, nicht besser.** Der Owner fragt „vielleicht sogar noch
  mehr dazupacken" — bei zwei unverbundenen Registern skaliert jedes weitere Dokument die
  Drift, nicht die Übersicht.

**Vorschlag, in dieser Reihenfolge:**

1. **`register.sh` — GEBAUT 2026-08-06.** Das Gegenstück zu `state.sh`, aber für Arbeit. Fünf
   Abschnitte statt der drei vorgeschlagenen: die offenen Queue-Zeilen (aus `fleet.json` **auf
   Platte**, nie über die API — deshalb läuft es aus einer Lane und stört keinen Land-Takt), die
   Kollisionsflächen, die Briefs, die Doc-Marker, die Index-Drift. Zwei Dinge, die beim Bauen
   anders kamen als hier vorgeschlagen, und beide sind Befunde:
   - **Die Briefs bleiben `ungeprüft`, als Spalte.** §2 hatte den naheliegenden Test schon
     widerlegt; ein besserer wurde nicht gefunden, also druckt der Abschnitt Fakten und ein
     Urteil, das wörtlich „ungeprüft" heißt. Eine Absenz darf nicht wie eine Null aussehen —
     dieselbe Regel gilt für die Queue, wenn `fleet.json` nicht lesbar ist.
   - **Kollisionen werden pro DATEI berichtet, nicht als Gruppen.** Transitives Gruppieren über
     eine Datei, die fast jede Zeile nennt, faltet die ganze Queue zu einer Komponente und
     beantwortet nichts: `server.ts` steht bei **6 von 11** offenen Lane-Zeilen. Die Ausgabe
     nennt darum die Datei mit ihren Zeilen und markiert eine so breite Fläche als schwaches
     Indiz — daneben den Kollisionsgraphen des Analysten, der die Arbeit beurteilt hat und
     nicht die Dateinamen. Die beiden stimmen **nicht** überein, und das ist die Information.
2. **Der L1-Rot-Detektor (BACKLOG P-10) — GEBAUT 2026-08-06**, in `e2e/pins.ts` §5, also im
   Millisekunden-Gate ohne Server-Boot. Check 1 wie vorgeschlagen. Check 2 bindet das Subjekt an
   die **Klausel**, nicht an die Zeile: Zeile 52 dieses Dokuments nennt `FLEET_VERIFY_CMD` (in
   `server.ts` vorhanden) und behauptet die Absenz von `verifyCmdFor`/`repoVerify` im selben
   Satz — ein zeilenweiter Scan wäre an einer **wahren** Aussage rot geworden, und ein Pin, der
   bei der Wahrheit schreit, wird abgeschaltet. Preis dafür ist bewusste Unterdeckung: ein
   Subjekt in Prosa statt in Backticks („Client rendering still open") ist nicht prüfbar, ein
   über zwei Zeilen umbrochener Satz auch nicht. Heute greifen **3** prüfbare Aussagen.
   Gegenprobe beim Bauen: umbenanntes Doc **und** eine falsche `mergeJob`-Absenz → beide rot,
   eine danebengestellte *wahre* Absenz derselben Form blieb grün.
3. **Ein-Register-Regel.** Die Queue ist das Register. Dokumente sind Erzählung und zeigen auf
   Task-IDs, führen aber nie eine zweite Liste. `BACKLOG.md` wird danach zu Klasse D
   (`docs/attic/`), **nachdem** seine lebenden Zeilen als Queue-Zeilen existieren.
4. **Der Handoff schrumpft weiter**, statt zu wachsen: er behält Absicht, Entscheide,
   Reihenfolge — alles Ableitbare gehört in `state.sh`/`register.sh`.

**Und für Context in Main-Sessions:** der Hebel ist **weniger lesen**, nicht mehr behalten. Eine
Main-Session soll das *Register* halten, nicht den *Korpus*; das Lesen der Dokumente ist Lane-
Arbeit, deren Ergebnis als Zeile zurückkommt. Diese Session ist der Beleg: der teuerste Teil war
nicht das Entscheiden, sondern das Wieder-Ableiten von Zustand, den kein Artefakt hielt.

## 6. Was NICHT geprüft wurde

- **`BACKLOG.md` ist nicht Zeile für Zeile abgeglichen** — gelesen wurden das Register (Track A/B)
  und die Abschnittsköpfe, gegengeprüft sechs P-Items und fünf B-Items. Die Drift ist damit
  **belegt**, ihr **Umfang nicht vermessen**. Das ist die Arbeit, die G7 beauftragt.
- **Die 55 Attic-Docs wurden nicht gelesen** — die Klassifikation stützt sich auf ihre Ablage.
- **Die 27 Juli-Briefs wurden nicht einzeln entschieden**, nur die August-Briefs.
- **Die fünf Rundgang-Notizen sind nach Titel eingeordnet, nicht nach Inhalt.**
- **grep-Treffer sind Anwesenheit, nicht Funktion** — gilt für jede „vorhanden"-Aussage in §3.
- Ob **Map E** wirklich offen ist, und ob **F7** noch gewollt ist (steht nur im Brief).

## 7. Was beerdigt ist — nicht wieder aufmachen

Eine frische Session hat den Reiz, Naheliegendes neu vorzuschlagen. Diese sechs sind
**entschieden**, jeweils mit dem Beleg, der sie entschieden hat. Wer eines davon wieder
aufmacht, muss zuerst den Beleg widerlegen — nicht das Gegenteil behaupten.

| Idee | Warum sie beerdigt ist | Beleg |
|---|---|---|
| **Auto-Rollback auf ein rotes Tier-2-Audit** | **1 von 15** adjudizierten roten Audits war `real` (Korrektur 2026-08-06, vorher 0/12) — ein Auto-Rollback hätte in 14 von 15 Fällen grundlos ausgelöst | `docs/autonomy-bausteine-2026-08-06.md` §1.1; die Basisrate ist im Register nachrechenbar |
| **`rerere` + ein hartes Pre-Land-Gate** | im Härtungs-Programm geprüft und verworfen; die volle Suite ist nicht-deterministisch genug, um zu gaten — deshalb Stufe 2 NACH dem Land | `docs/verify-tiering.md`, Memory `project-fleet-land-hardening` |
| **Hook-Pflege / `graphify watch` / Cron auf `.git/hooks`** | gemessen: der Server bewegt main mit `--ff-only`/`branch -f`, **kein** `post-commit`/`post-merge` feuert, und `.git/hooks` ist nicht getrackt. Der Server baut den Graphen stattdessen aus `git archive <sha>` | Session 26, Body von `b297aad` |
| **`Stop`-Hooks als Nullpunkt der idle-Uhr** | `Stop` markiert das **Ende eines Turns**, nicht Aktivität: 92/104 Lanes haben ≤1 Owner-Prompt, Median-Session 67,8 min → die Klausel hätte die *gesunde* Median-Lane als `stalled` markiert | `briefs/stalled-clock-hooks-refuted.md` (`72da914`), Zahlen unabhängig reproduziert |
| **Der K2-Shadow-Richter (`FLEET_CLEAN_REVIEW`)** | 45 Zeilen, 37 valide, **alle** „pass", 0 Widerspruch — der Richter hat nie Information geliefert. Code bleibt, Wiedereinschalten braucht erst eine bestandene Feuerprobe | `CLAUDE.md` Deploy-Abschnitt, `docs/attic/judge-calibration.md` |
| **Das Eval-Gate** | in seiner Lebenszeit **genau ein** Verdict erzeugt; seine einzige Macht war, Owner-Entwürfe hinter dessen Rücken zu starten. Ersetzt durch die *advisory* Analyse | Body von `500ff63` |

**Nicht auf dieser Liste, obwohl es so aussieht:** echte Parallelität zwischen Suiten. Die
Messung, die sie verbietet, stammt von **vor** den Race-Fixes vom 28.07. — sie ist damit nicht
widerlegt, sondern **ungeprüft**. Der ehrliche Weg ist eine Messung nach den beiden
Suite-Hebeln, nicht eine Meinung (`HANDOFF.md` Session 30).
