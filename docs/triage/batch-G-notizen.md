# Triage-Batch G-notizen — Notizen und Selbst-erklärte Nicht-Aufträge

**13 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**

---

## `05320523`  ·  kind=note  ·  angelegt 2026-08-05 13:15  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rundgang 08-05 13:15] Der Rundgang urteilt ueber Lanes, ohne ihren Bericht zu lesen — und ohne zu wissen, ob die Maschine gerade belegt ist. Beides heute live belegt.

BELEG 1, der ungelesene Bericht. Um 12:42 habe ich Slot 3 (Lane fleet/260805094317-835b) als done-looking gefiled (Task 3cab063f) und als Befund verkauft, dass sie nach steward-live landet statt nach main. Die Lane hatte um 11:11 — 90 Minuten frueher — ihren Schlussbericht abgegeben, der genau das selbst sagt ("landet in steward-live") und darueber hinaus vier Hand-Auftraege an dich enthaelt, von denen KEINER durch den Puls kam: (a) die drei Commits muessen auch auf main, sonst laufen kuenftige Filings gegen einen Server ohne ref-Dedup und Register-Writes 400en; (b) 26 Zeilen Alt-Register migrieren; (c) der Auto-Puls-Text nennt POST /api/tasks, das dem Steward-Token 403 antwortet — richtig ist /api/steward/tasks; (d) CLAUDE.md behauptet weiter "Dispatcher AUS", er ist seit Session 25 AN. Die Route, die das haette liefern koennen, existiert und ist im Skope: GET /api/steward/slots/:id/transcript. Das Ritual nennt sie nicht, und Transcript gilt dort als "untrusted display material, may only break ties" — was fuer eine ROTE Beurteilung richtig ist, aber verhindert, dass ein fertiger Schlussbericht ueberhaupt gelesen wird, bevor eine Entscheidung gefiled wird.

BELEG 2, die unsichtbare Maschine. Der digest liefert exakt diese Felder: bundleStale, continuity, deployGap, digest, digestAge/At, ledgers, model, now, prior, sinceLastLook, slotHealth, slots, waitMs. Ein gehaltenes /tmp/fleet-e2e.lock oder ein laufendes ./e2e-* kommt darin nicht vor. Genau jetzt faehrt pid 27516 seit 13:11 die volle Kette fuer Slot 6 (Session b3ec92ff, Haupt-Checkout) und haelt das Lock — der Puls kann das weder sehen noch melden, obwohl es zwei Dinge entscheidet, die er beurteilen soll: ob eine stille Pane fertig oder nur wartend ist, und ob ueberhaupt irgendetwas daneben gestartet werden darf (CLAUDE.md: zwei parallele Laeufe erzeugen auf dieser Maschine zuverlaessig Fehler auf BEIDEN Baeumen).

ENTSCHEIDUNG, die deine ist: ob der Puls (1) vor einem Filing ueber eine Lane deren letzte Nachricht ziehen muss, und (2) eine Maschinen-Belegt-Tatsache im digest bekommt. Beides sind Aenderungen an Ritual UND server.ts.

Bewusst kind:note und NICHT lane: die Lane 835b hat rundgang.md und den Steward-Pfad gerade umgeschrieben und ist noch nicht auf main — eine zweite Lane auf denselben Dateien wuerde mit ungelandeter Arbeit kollidieren.

NEBENBEI: Task 3cab063f ist durch Beleg 1 ueberholt und teilweise falsch (er praesentiert als Befund, was die Lane selbst berichtet hatte). Ich kann ihn nicht zurueckziehen — der Steward-Kanal kann nur POST. Loeschen oder stehenlassen ist dein Griff.
```

## `356333db`  ·  kind=note  ·  angelegt 2026-08-05 13:16  ·  source=steward

- Owner-Kommentare auf der Zeile:
  > [wert-review 08-07, MAIN] Diese Zeile und 9821035e sind EINE Entscheidung, nicht zwei: 356333db fragt 'welche Quelle zeigt die Zeit der letzten Ausgabe', 9821035e beantwortet die Haelfte davon negativ (transcriptFact.mtime rueckt stuendlich ohne ein geschriebenes Byte vor — gemessen ueber elf Snapshots, bytes ist das belastbare Signal). Zusammen gelesen ist die Antwort vorgezeichnet: lastOutput persistieren, mtime nur als Untergrenze, bytes als Begleiter. Es fehlt nur der Owner-Entscheid. Verwan
  > UEBERNAHME aus 9821035e (archiviert 08-07 auf Owner-Entscheid) — der Widerlegungs-Beleg zur Quellenwahl. transcriptFact.mtime ist KEIN Aktivitaetssignal. Gemessen ueber elf stuendliche Snapshots (statSync auf projDir/sessionId.jsonl, server.ts:6456): slot 8 bytes seit 09:47 unveraendert bei 586987 ueber zehn Stunden, mtime rueckt jede Stunde vor, IMMER auf :47:44; slot 10 bytes konstant 2128634, mtime stuendlich :20:35; slot 11 konstant 1313247, :43:2x; slot 16 konstant 1957956, :19:21. Sekunden

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[owner-Idee 08-05] Die Zeit der letzten Ausgabe einer Session sichtbar machen — in der Info-Karte UND fuer Agenten. Owner-Wortlaut: "das wir in der info karte und genauso fuer agenten ersichtlich, die Zeit des letzten gesendeten Datenbits/Nachricht anzeigen".

WARUM JETZT: heute (08-05) hat der Rundgang Slot 3 um 12:42 als frisch-fertig gefiled. Die Lane hatte ihren Schlussbericht um 11:11 abgegeben — 90 Minuten frueher. Aus den Signalen, die der Puls hat, war "gerade fertig geworden" nicht von "seit anderthalb Stunden fertig" zu unterscheiden. Genau diese eine Zahl haette es entschieden.

WAS ES HEUTE SCHON GIBT, und warum es nicht traegt (gemessen, nicht vermutet):
1. s.lastOutput existiert (server.ts:216), ist aber NUR IM SPEICHER: init 0 (server.ts:242), Reset auf 0 bei killSlot (server.ts:1474), und in fleet.json steht pro Slot kein einziges Zeit-Feld. Jeder srv-Neustart setzt die Uhr also auf 0.
2. laneSignalView rechnet ungeschuetzt idleMs = now - s.lastOutput (server.ts:6225). Nach einem Neustart liefert das fuer jede stille Pane eine Epochen-grosse Zahl, die wie "seit ewig untaetig" aussieht. Genau so ist es heute frueh passiert: nach dem srv-Restart um ~10:12 las idleMs fuer sechs Slots als "seit 1970", und ich musste die echte Aktivitaet aus transcriptFact.mtime rekonstruieren.
3. Die ehrliche Fassung existiert schon einmal im Code: der Sensor-Prompt gibt bei lastOutput === 0 "unbekannt" aus (server.ts:6052-6055). Dieselbe Tatsache wird also an einer Stelle ehrlich und an der anderen irrefuehrend gerendert.

DIE ENTSCHEIDUNG, die deine ist: welche Quelle die angezeigte Zeit sein soll. transcriptFact.mtime ueberlebt Neustarts (Datei auf Platte) und hat heute funktioniert, misst aber Transcript-Schreibvorgaenge; lastOutput misst den Pane-Stream, ist praeziser, aber fluechtig. Persistieren, umstellen, oder beide nebeneinander zeigen — das ist eine Produktentscheidung, keine Implementierungsfrage.

OFFEN GELASSEN, ehrlich: wo in src/client.ts die Info-Karte gebaut wird, habe ich NICHT gefunden (grep auf info/card/panel/box lieferte nichts Passendes) — die Client-Seite muss beim Bauen lokalisiert werden, ich zitiere sie hier bewusst nicht auf Verdacht.

kind:note und nicht lane, aus einem Grund: die Lane 835b hat server.ts und src/client.ts gerade angefasst und ist noch nicht auf main — eine zweite Lane auf denselben Dateien kollidiert mit ungelandeter Arbeit.
```

## `b759e8d9`  ·  kind=note  ·  angelegt 2026-08-05 17:58  ·  source=steward

- Owner-Kommentare auf der Zeile:
  > [wert-review 08-07, MAIN] Wert-Einordnung: das ist die einzige der fuenf Rundgang-Notizen mit einem gemessenen FALSCHALARM auf dem heikelsten Branchnamen, den es gibt ('main wurde rewritten', in Wahrheit private-repo-as main gegen claude-fleets main). Ein Fehlalarm dieser Sorte kostet die Glaubwuerdigkeit des ganzen Kanals. Vorschlag: von kind:note auf kind:lane heben und mit Done-Kriterium versehen (Schluessel = repo+branch; das repo-Feld wird pro Eintrag bereits gespeichert), plus die vom Own

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rundgang 08-05 17:56] sinceLastLook schluesselt Lanes nur nach BRANCHNAME, nicht nach Repo — und hat mir deshalb heute einen falschen Alarm geliefert: "main wurde rewritten".

GEMESSEN. Der Puls bekam:
  sinceLastLook.rewritten = [{"branch":"main","priorHead":"ae7160f1a58…","head":"74d8c08e671…"}]
Ein rewritten main ist eine ernste Signatur, also nachgeprueft:
  git -C ~/claude-fleet cat-file -t ae7160f  -> unbekannt (existiert dort NICHT)
  git -C ~/private-repo-a cat-file -t ae7160f -> commit, und private-repo-as main steht genau darauf
  74d8c08 ist claude-fleets main.
Die Route hat also private-repo-as main-Head gegen claude-fleets main-Head verglichen und daraus einen Rewrite abgeleitet. Es wurde nichts umgeschrieben; beide Repos haben schlicht einen Branch namens main.

DIE ZWEITE HAELFTE, gleicher Grund: in meinem Journal-Record von 13:49 traegt die lanes-Map genau EINEN Eintrag "main", und der zeigt auf private-repo-a (repo-Feld ist dort mitgespeichert!). Claude-fleets main hat also im Gedaechtnis dieses Pulses gar keinen Platz — der eine Schluessel wird vom jeweils zuletzt gesehenen Repo ueberschrieben. Solange nur ein Repo Lanes hat, faellt das nie auf; heute laufen Lanes in claude-fleet UND private-repo-a.

KOSTEN, konkret: (a) ein erfundener rewritten-Alarm auf dem heikelsten Branchnamen, den es gibt — genau die Sorte Fehlalarm, die den Puls unglaubwuerdig macht; (b) fuer den ueberschriebenen Branch geht die echte Delta-Erkennung verloren: advanced/landed/vanishedUnlanded koennen fuer ihn nicht mehr stimmen.

DEINE ENTSCHEIDUNG: der Fix ist offensichtlich (Schluessel = repo + branch statt branch; das repo-Feld wird bereits pro Eintrag gespeichert), aber er aendert das Format der gespeicherten lanes-Map, also brauchen die vorhandenen Journal-Records eine Migrations- oder Toleranz-Entscheidung — alte Records tragen nackte Branchnamen. Deshalb liegt es bei dir und nicht bei mir. Ich habe nichts angefasst.

Nicht blockierend. Verwandt, aber NICHT dasselbe: der Architekten-Kandidat der 835b-Lane ("sinceLastLook liest null-head als unveraendert") betrifft dieselbe Funktion, ist aber ein anderer Fall.
```

## `56be77a3`  ·  kind=note  ·  angelegt 2026-08-07 00:30  ·  source=steward

- Owner-Kommentare auf der Zeile:
  > [wert-review 08-07, MAIN] Nach diesem Review die dringendste offene Zeile des ganzen Registers — und die einzige, die KEINE Bauarbeit ist: sie braucht einen Owner-Griff (cwd umhaengen oder den Share von Slot 6 widerrufen), sonst steht sie wie ihr Vorgaenger drei Wochen. Sie kann per Definition nie dispatcht werden (kind:note), also faellt sie durch jede Automatik. Gehoert nach oben in die Owner-Fragen, nicht in eine Welle.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — Beobachtung, kein Arbeitsauftrag. LIVE-BEFUND 2026-08-07, gemessen an fleet.json auf Platte: die Slots 3, 4, 6 und 13 haben cwd = das Fleet-Install-Verzeichnis, in dem fleet.json mit dem Klartext-Owner-Token und jedem Share-Secret liegt. Slot 6 ist gleichzeitig AKTIV GETEILT (mode "interact"). Wer in dieser Session sitzt oder sie als Gast bedient, kann fleet.json lesen und ist damit Owner, von ueberall im Tailnet.
Das ist exakt das Muster, das BACKLOG Hardening #1 am 2026-07-18 fuer Slot 11 fand und in derselben Session widerrief. Fuer den Confused-Deputy selbst gibt es keinen billigen Code-Fix — die Gegenmassnahme ist, den cwd nicht dorthin zu zeigen (oder den Share zu widerrufen).
Kein Kriterium, weil es keine Bau-Arbeit ist: die Zeile existiert, damit die Messung nicht wieder drei Wochen unbemerkt steht. Herkunft: BACKLOG-Abgleich, Commit 593cbf2.
```

## `09572f62`  ·  kind=note  ·  angelegt 2026-08-07 00:30  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ / OWNER-ENTSCHEID, kein Arbeitsauftrag. BACKLOG P-6 "Program board" (Lane-DAG, orchestrierter abhaengiger Rebase, Stack-Cleanup): `programBoard`/`laneDag` kommen 0x im Baum vor, der Entscheid "bauen oder nicht" steht seit Juli offen, und die Evidenzbasis ist unveraendert EIN handgefahrener Stack. Kein Done-Kriterium, weil es noch keine Arbeit ist, sondern eine Entscheidung. Herkunft: docs/attic/backlog-2026-07.md Track A P-6 (Abgleich 593cbf2).
```

## `cd85c924`  ·  kind=note  ·  angelegt 2026-08-07 00:30  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ / OWNER-ENTSCHEID, kein Arbeitsauftrag. BACKLOG Item 17, die Retrieval-/Wissensschicht: unveraendert geparkt, nichts gebaut (0 Treffer fuer FTS5, sqlite-vec, api/knowledge). Die Empfehlung des Items war Option A — "dream mode v1 zuerst, indexlos" — und die ist gelaufen. Phase 2 haengt weiter an einer ungeloesten Frage: woher kommen die Embeddings, ohne die Ein-Server-Regel oder die Netz-Allowlist zu brechen. Nebenbefund, der noch gilt: die Arena hat nie eine Episode gefahren (docs/arena-episodes.md existiert nicht), obwohl steward-arena.sh da ist. Herkunft: docs/attic/backlog-2026-07.md Item 17 (Abgleich 593cbf2).
```

## `97f529b1`  ·  kind=note  ·  angelegt 2026-08-07 00:30  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag, und das Item verbietet sich selbst als erstes gebaut zu werden. BACKLOG Item 14 Phase 3 "smart auto": ein Klassifikator, der vor dem Feuern eines Autos den Nachrichten-TYP waehlt. Nicht gebaut (kein Klassifikator im Baum). Die Begruendung des Items ist der eigentliche Inhalt dieser Zeile: eine falsche Auto-Klassifikation injiziert eine unaufgeforderte Nachricht, die ADAPTIV AUSSIEHT und deshalb mehr Vertrauen zieht als eine schlecht getimte Cron-Nachricht. Voraussetzung war, die Phase-1-Signale erst eine Weile von Hand zu benutzen; die sind seit Juli da — die offene Frage ist, ob sie jemand benutzt hat. Herkunft: docs/attic/backlog-2026-07.md Item 14 (Abgleich 593cbf2).
```

## `7366e599`  ·  kind=note  ·  angelegt 2026-08-07 00:30  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag. BACKLOG Item 10 Phase 1.5, Lane-Runtime-Env: gebacken werden heute nur FLEET_SELF_TOKEN und FLEET_SELF_SLOT (server.ts:1507). FLEET_LANE_SLOT, ein Port aus einem Band pro Slot und sichere FLEET_SOCK/FLEET_PORT-Overrides fuer Fleet-auf-Fleet-Lanes gibt es nicht. Die Kollisionsklasse, die das killen sollte (zwei Lanes, ein Dev-Server-Port), hat sich seither nie gemeldet — deshalb Notiz und nicht Auftrag: bauen, wenn sie sich meldet. Herkunft: docs/attic/backlog-2026-07.md Item 10 (Abgleich 593cbf2).
```

## `10ac2528`  ·  kind=lane  ·  angelegt 2026-08-07 00:30  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — It says so itself — 'kein Arbeitsauftrag' — and the one thing it carries is an open question for you ('ab welcher Zeilenzahl in lane-outcomes.jsonl ist es genug?'), which no verification in this repo can settle. Its facts are accurate: lane-outcomes.jsonl exists at the repo root, 07dafa0 is the landed outcome feed, 593cbf2 is the BACKLOG reconciliation, and docs/attic/backlog-2026-07.md is present
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > [wert-review 08-07, MAIN] Formfehler, mechanisch: kind=lane, aber Text beginnt 'NOTIZ — kein Arbeitsauftrag'. Der Dispatcher wuerde sie bei einem Promote starten. Gehoert kind:note. Gleiche Fehlform: 63626cdb und 0be58694.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag, sondern eine Zeile, damit "spaeter" ein Datum bekommen kann. BACKLOG Item 18(a), der Outcome-ANALYZER: der Recorder laeuft, der Viewer ist als 07dafa0 gelandet, der Analyzer, der die Spur LIEST, nicht. Das war Absicht — Analyse braucht Volumen, und das Item nennt sich selbst ausdruecklich "a RECORDER, not an analyzer". Die Frage, die diese Zeile offen haelt: ab welcher Zeilenzahl in lane-outcomes.jsonl ist es genug? Herkunft: docs/attic/backlog-2026-07.md Item 18 (Abgleich 593cbf2).
```

## `63626cdb`  ·  kind=lane  ·  angelegt 2026-08-07 00:30  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — A note by its own first words ('kein Arbeitsauftrag') — it records three deliberately deferred audit-log rests and asks nothing of a session, so there is no finished state to judge. The claims hold: af93ce0 is the landed audit trail with owner overlay, appendEvent/AUDIT_ROTATE_BYTES is the single 5-MB rotation (server.ts:1383, 1401), and CF-Connecting-IP appears nowhere in the code — only in docs/
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.
- Owner-Kommentare auf der Zeile:
  > [wert-review 08-07, MAIN] Formfehler, mechanisch: kind=lane, aber Text beginnt 'NOTIZ — kein Arbeitsauftrag'. Gehoert kind:note. Gleiche Fehlform: 10ac2528 und 0be58694.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag. BACKLOG Item 9, die drei bewusst zurueckgestellten Reste des Audit-Logs: (a) Gast-Identitaet am WS-Pfad (CF-Connecting-IP / Host — 0 Treffer im Baum), (b) Aggregation der guard()/404-Ablehnungen, (c) Retention ueber die eine 5-MB-Rotation hinaus. Der Audit-Log selbst inkl. Owner-Overlay ist gelandet (af93ce0). Keiner der drei Reste ist seit Juli wieder aufgekommen — die Zeile fuehrt sie, damit "zurueckgestellt" nicht dasselbe wird wie "vergessen". Herkunft: docs/attic/backlog-2026-07.md Item 9 (Abgleich 593cbf2).
```

## `b8716d0e`  ·  kind=note  ·  angelegt 2026-08-07 01:43  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
BEFUND (mechanisch, Verfallsform b — Beleg-Verfall). Neun offene Zeilen zitieren `docs/attic/autonomy-map-2026-08-06.md` bzw. `docs/attic/autonomy-verbs-2026-08-06.md` mit Zeilennummern, die gegen den heutigen Baum (dc2940e) 1-3 Zeilen danebenliegen.

URSACHE, benannt statt vermutet: nach dem Pin `@1e46b8b`, den alle neun tragen, hat genau ein Commit beide Dateien angefasst — `d139698` ("die 0/12-Basisrate ist seit heute 1/15"). Hunks: map +2 ab Zeile 313, +1 ab 487; verbs +1 ab 11. Verschiebung also map +2 ab 313 und +3 ab 487, verbs +1 ab 11.

BEWEIS an drei unabhaengigen Zitaten (`git show 1e46b8b:<datei>` gegen den Arbeitsbaum):
- map:506 gepinnt = "| **B. Drift-Hinweis in den Gruendungsbrief** | ..." — heute map:509. Auf map:506 steht heute die Tabellenkopfzeile "| Schritt | Zahl | ueber | Stop-Kriterium |".
- map:520-521 gepinnt = "1. **A** (Audit-Event auf Drift). Eine Zeile, ..." — heute map:523-524.
- verbs:23-24 gepinnt = "Der Dispatcher startet ausschliesslich `status:\"queued\"` ..." — heute verbs:24-25.

BETROFFEN (Zitat -> heutige Zeile): caaf8b16 map:506->509 · 7ba4bd9d map:520-521->523-524 UND verbs:23-24->24-25 · bbf2eea1 map:524-525->527-528 · 2c92a467 map:530-533->533-536 · 989cccf7 verbs:55-73->56-74 · f0a710db verbs:75-92->76-93 · 08f44054 verbs:94-111->95-112 · acb5839d verbs:113-159->114-160.
NICHT betroffen, weil vor der ersten Einfuegung: 9e0fdc3b map:183-195 · 785ce63d map:71-78. Andere zitierte Dokumente (`docs/attic/agent-visibility-2026-08-06.md`, `briefs/ui-next-level-2026-08-06.md`, `docs/autonomy-bausteine-2026-08-06.md`) haben sich seit dem Pin nicht bewegt — `git diff --stat 1e46b8b..HEAD` fuehrt sie nicht.

KOSTEN, klein und ehrlich benannt: der Pin macht jedes Zitat aufloesbar, also ist es UNVERIFIZIERT, nicht falsch — und jede der neun nennt zusaetzlich ihren Abschnitt (§5.4, §11.1.1, Schwelle B ...), was der belastbarere Anker ist. Der Schaden trifft nur den, der gegen HEAD aufloest: bei Tabellenzeilen landet er auf der Nachbarzeile, bei caaf8b16 auf dem Tabellenkopf. KEIN Ausfuehrungsschaden fuer die gerade laufende Lane caaf8b16 — ihr Fliesstext nennt §12 namentlich, nur die QUELLE-Zeile driftet.

DEIN GRIFF (ich entscheide das nicht): die neun QUELLE-Zeilen einmal nachziehen — oder die Regel setzen, dass eine QUELLE den Abschnitt nennt und die Zeilennummer nur mit Pin fuehrt. Nur die zweite Variante verhindert die Wiederkehr; die naechste Doc-Einfuegung erzeugt denselben Befund erneut.

NICHT GEPRUEFT: nur diese beiden Dokumente auf Zeilenwanderung. Die uebrigen Doc-Zitate der 65 offenen Zeilen sind auf Existenz und EOF geprueft (zweite Meldung), nicht auf Wanderung gegen ihren jeweiligen Pin.
```

## `d2a0d45e`  ·  kind=note  ·  angelegt 2026-08-07 01:43  ·  source=steward

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
BEFUND (mechanisch, Verfallsform a — der Beleg zeigt ins Leere). Zwei tote Belege in offenen Zeilen, beide erst heute entstanden.

(1) `d375c581` (Scout-B, "Der Reaper") zitiert in seinem GEPRUEFT-Block `BACKLOG.md:773` fuer die Abgrenzung gegen BACKLOG B-16 "Orphan-reap on lane kill". `BACKLOG.md` existiert nicht mehr: `c366c66` (2026-08-07) hat sie nach `docs/attic/backlog-2026-07.md` stillgelegt. Der zitierte Posten steht heute auf `docs/attic/backlog-2026-07.md:818` ("## 16. Orphan-reap on lane kill"). KOSTEN: die Abgrenzung — der Grund, warum diese Zeile NICHT B-16 ist — ist fuer einen Pruefer nicht mehr nachvollziehbar. Die Arbeit der Zeile selbst bleibt gueltig; es ist der Beleg, der stirbt, nicht der Befund.

(2) `bbf2eea1` (`DIGEST_TTL_MS` heben) sagt woertlich "Loest Queue-Notiz `94565a55` auf, statt neben ihr zu stehen". `94565a55` ist `archived` — die aufzuloesende Zeile steht nicht mehr. KOSTEN: die halbe Begruendung der Zeile laeuft leer; die Arbeit (TTL ueber das Puls-Intervall heben, Worker-Fehler von `null` unterscheidbar machen) ist davon unberuehrt.

GEGENPROBE, damit die Absenz nicht wie Nicht-Geprueft aussieht — alle 65 offenen Zeilen mechanisch durchgezogen:
- Jedes `` `Symbol` `` aus jedem Text gegen den getrackten Baum (`git ls-files`, .ts/.sh/.html/.md/.json/.js). Genau drei ohne Entsprechung, und alle drei sind VORSCHLAEGE, keine Zitate: `archiveSlot` (df5b74ba, sagt selbst "kommt 0x in server.ts vor"), `programBoard`/`laneDag` (09572f62, ebenso). Kein einziges Symbol-Zitat ist verfallen.
- Jeder `datei:zeile`-Beleg auf Existenz und EOF: ausser `BACKLOG.md:773` zeigt keiner ins Leere.
- Stichprobe der Code-Zitate gegen den Baum, alle exakt: `confirmMidRun` src/client.ts:976 (Aufruf :947) · commit-Route server.ts:9131 · `MERGE_IDLE_MS`-Gate server.ts:8881 · createWorktree-Kopierliste server.ts:1256 · `wip:` server.ts:3732 · `p.kill()` in runVerify server.ts:4025 · `interface Task` server.ts:167 · refine-confirm server.ts:9455 · `refineChildText` server.ts:2240 · `DIGEST_TTL_MS` server.ts:7493 · `cyc` src/client.ts:7193 · die drei Requeue-Pfade in briefAndSend server.ts:2008-2029.

NICHT GEPRUEFT: Verfallsform c (Vorbedingung fehlt) habe ich nur ueber Zeilen-IDs aufgeloest, nicht ueber prosaisch benannte Vorbedingungen. Und `prompts.jsonl` (ba18d3c8) sowie `archive.jsonl` (df5b74ba) existieren nicht — beide sind aber das, was ihre Zeile bauen WILL, kein totes Zitat.
```

## `efc98cfa`  ·  kind=lane  ·  angelegt 2026-08-07 10:59  ·  source=owner

- Analyst (Opus-5, 08-08): **needs-you** — The brief opens by declaring itself not work — "NOTIZ — kein Arbeitsauftrag ... gehoert nicht gestartet" — and carries no DONE, no files and no verification, only a sequencing argument and two open questions (a cost number, a paste guard) that are the owner's to settle; it is filed as kind:lane purely because the lane→note route is missing (the very gap 65af341f describes). Its facts otherwise che
- Analyst-Blocker: ["criterion"]
- Ein Brief existiert (model=claude-sonnet-5[1m], edited=False) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
NOTIZ — kein Arbeitsauftrag. Periodischer Groupchat zwischen den Mitarbeitern.

(Formhinweis: der Owner-POST kann heute nur `kind:"lane"` erzeugen — eine Route lane→note fehlt, das ist Queue-Zeile `65af341f`. Diese Zeile ist trotz des Kinds eine NOTIZ und gehoert nicht gestartet.)

OWNER-IDEE vom 2026-08-07, woertlich: „Die spaetere Idee waere irgendwann wahrscheinlich mal ein periodischer groupchat zwischen unseren Mitarbeitern". Bewusst aus Zeile `33673475` (Steward kritisch + Rundgang als Absender) HERAUSGESCHNITTEN, damit die dortige Klaerung nicht am Endbild haengt.

Was am Baum 6b8965e dafuer schon existiert — gemessen von Session 35, und der Grund, warum die Idee naeher liegt als sie klingt:
- EIN gecappter, auditierter Sendeweg in eine Pane: `POST /api/steward/send` (vier Arten; freier Text wird per 400 abgewiesen, der Server rendert die Nachricht selbst). Plus `POST /api/slots/:id/autos` (Owner) und `/api/self/autos` (Lane) als zweiter, zeitgesteuerter Weg.
- EIN bereits vorgeschriebenes Antwortformat: `kind:"pulse"` endet zwingend mit einer `[pulse-reply]`-Zeile (hilfreich | unnoetig | falsch, plus halber Satz Begruendung).
- Was FEHLT, ist genau eins: den Reply liest niemand. Der Marker kommt ausserhalb von `server.ts` nur in `e2e/steward-outcomes.ts` vor. Ohne Ernte gibt es keinen zweiten Gespraechszug — und ohne zweiten Zug keinen Chat, sondern einen Broadcast.

Die Reihenfolge ist damit bestimmt und sollte nicht uebersprungen werden: (1) ein Absender mit nachpruefbarem Ausloeser (Zeile `33673475`), (2) ein Leser fuer die Antwort, (3) erst dann Mehr-Parteien-Verkehr.

Zwei Dinge, die vor (3) entschieden sein muessen, damit die Notiz spaeter nicht neu gedacht werden muss:
- **Die paste-Gefahr skaliert mit der Teilnehmerzahl.** `sendText` ist paste-buffer + Enter, ohne die Eingabezeile zu leeren: jede Nachricht in eine Pane mit ungesendetem Entwurf verschmilzt mit ihm und wird als EIN Prompt abgeschickt. Bei N Teilnehmern sind das N Chancen pro Runde. Das Ritual (`.claude/commands/rundgang.md`) haelt dazu woertlich fest: „Nothing guards this today."
- **Kosten.** Jeder Zug ist ein echter Modellaufruf in einer echten Session. Ein „periodischer" Chat mit vier Teilnehmern ist ein Dauerverbraucher, kein Feature-Flag. Vor dem Bau eine gerechnete Zahl, keine Schaetzung.

QUELLE: Owner-Idee 2026-08-07 an Session 35 (main, Slot 2)
```
