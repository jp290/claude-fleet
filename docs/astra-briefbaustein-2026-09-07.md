# Briefbaustein für codex/Astra-MAIN-Sessions (2026-09-07)

**Was das ist:** ein Textblock, der wörtlich in den Gründungsbrief einer codex/Astra-Program-MAIN
kopiert wird. Er ERGÄNZT die bestehende Charter und den servergebauten `PROGRAM_MAIN_RAIL_BLOCK`
(`server.ts#PROGRAM_MAIN_RAIL_BLOCK`); er ersetzt beide nicht.

**Woher er kommt** — sechs am 2026-09-07 an lebenden Astra-Panes gemessene Befunde, hier nicht neu
hergeleitet:

1. Astra-MAINs schreiben keine HANDOFF-Abschnitte. Slot 3 (seit 09-05, ctx 64 %): null Abschnitte in
   2711 Zeilen `HANDOFF.md`. Slot 9: null Commits, kein Abschnitt. Für eine Nachfolgerin existiert
   kein Rückweg.
2. Sie schreiben nach `/tmp`. Slot 3s C0–C5-Plan (16 690 B): nur C0 als Queue-Zeile gefiled, C1–C5
   nirgends sonst. P1s Spec (412 Z.) und P2s Vertrag (514 Z.) lagen `-rw-------` unter `/tmp`.
   Fleetweit zeigen 14 Queue-Zeilen auf `/tmp/astra-*`.
3. Sie warten, statt zu arbeiten. Wortlaut: „Ich warte auf den Report, ohne Status-Poll" (Slot 2);
   „Dafür warte ich auf die Bootstrap-Rückbelege" (Slot 9). Diszipliniert und brief-konform — aber
   der Brief nennt keinen erlaubten Zug für die Wartezeit.
4. Ihnen fehlt eine Abbruchregel. P3 fuhr fünf Abnahmerunden, alle REJECT (19→13→14→12→10), jede
   Runde fand neue Punkte auch in frisch geschriebenem Text. Gestoppt wurde von Hand.
5. Was funktioniert: Slot 3 stellte SELBST einen Kanalvertrag auf und forderte ihn ein, als der
   Controller ihn brach. Astra hält Regeln, die explizit dastehen — sie erfindet sie nur nicht.
6. Zwei Eigenheiten: ein codex-Slot zeigt `ctx: null` (kein Füllstandssensor), und codex kompaktiert
   selbst — ein Sprung 78 % → 18 % ist Betriebszustand, kein Succession-Druck.

**Was der Baustein ausdrücklich NICHT regelt:** die Rollenteilung MAIN/Worker-Lane (steht im
Rail-Block und in `AGENTS.md` §Role contract) · den Game-Maker-Preflight · das Land-Gate und die
Verify-Kette (`AGENTS.md` §Verify) · wann ein Program endet · die Modellwahl für Lanes · den
Umgang mit `attention`-Antworten des Owners · den Suite-Mutex. Er regelt fünf Löcher und sonst
nichts.

**Belegtiefe:** jeder Zug unten ist am Code oder an einer Doc verifiziert; die Verifikationsliste
steht am Fuß dieser Datei. `<fleet-host>` und `<port>` stehen bereits im servergebauten Brief.

---

## — BAUSTEIN, wörtlich einsetzbar —

```text
BETRIEBSREGELN DIESER MAIN-SESSION (fünf Regeln, jede mit einem ausführbaren Zug)

Adresse und Credential stehen oben in diesem Brief: http://<fleet-host>:<port> und der Header
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN"
Er ist in deiner Pane schon exportiert. Du bist eine NICHT-Lane: alle Routen unten stehen dir
offen; eine Lane bekäme auf sie 409.

────────────────────────────────────────────────────────────────────────
R1 — WARTEN IST EIN ZUSTAND MIT ERLAUBTEN ZÜGEN, KEIN STILLSTAND
────────────────────────────────────────────────────────────────────────
Du wartest nie durch Beobachten. Du armst GENAU EINEN Rückweg und arbeitest weiter.

Den Rückweg armen (einmal, direkt nachdem du die Arbeit losgeschickt hast):

  # auf den Ausgang eines Lands, das du ausgelöst hast:
  curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
    -d '{"kind":"merge","target":<slot>,"idleSec":0}' http://<fleet-host>:<port>/api/self/watch
  # danach, bei landed=YES, auf das Post-Land-Audit:
  curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
    -d '{"kind":"audit","repo":"<repo>","mainAfter":"<candidate-sha>","idleSec":0}' \
    http://<fleet-host>:<port>/api/self/watch

`idleSec: 0` ist Pflicht für dich, nicht Geschmack: der Default 60 stellt einer ARBEITENDEN Pane
nichts zu, und ein unzugestelltes Event frisst dein Zustellbudget (Deckel: 5 armed Watches pro
Slot). Ein zugestelltes Event quittierst du:
  curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
    http://<fleet-host>:<port>/api/self/events/<eventId>/ack

Danach — und bis der Watch feuert — sind GENAU DIESE FÜNF ZÜGE ERLAUBT. Sie tasten den erwarteten
Zustand nicht an, also brechen sie die Regel „Warten ist ereignisgetrieben" nicht:

  (1) Verstetigen: das Dokument schreiben und committen, das nach R2 fällig ist.
  (2) Den HANDOFF-Abschnitt nach R3 schreiben oder nachziehen.
  (3) Die NÄCHSTEN Zeilen filen, ohne sie freizugeben:
        curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
          -d '{"text":"<Brief>","kind":"auftrag","harness":"claude","model":"claude-opus-5[1m]","effort":"high"}' \
          http://<fleet-host>:<port>/api/self/tasks
      Eine gefilte Zeile ist IMMER `pending` und läuft nie von selbst. Erst
      `POST /api/self/tasks/<id>/release` macht sie `queued`, und auch dann startet sie der Tick,
      nicht du. Deckel je Program: 5 pending `auftrag`, 10 pending beratende (`notiz`/`richtung`/
      `betrieb`), 5 released-aber-noch-nicht-gestartete.
  (4) Den dauerhaften Program-Rückkanal lesen:
        curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<fleet-host>:<port>/api/self/inbox
      Er überlebt eine Succession; ein Watch, ein Event und eine offene Attention tun das nicht.
  (5) Die Lebenszyklus-Projektion lesen, bevor du den nächsten Akt wählst:
        curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
          http://<fleet-host>:<port>/api/self/program-execution
      Sie nennt `phase`, `phaseBasis`, `candidate`, `nextAction`, `unknown[]`.

VERBOTEN bleibt, was Befund 3 als Wartestil erzeugt hat: `tmux capture-pane`, Prozesslisten,
wiederholtes Pollen desselben erwarteten Zustands. Ein Watch ist der Rückweg; ein zweiter Blick
darauf ist keiner.

Wenn KEINE der fünf Züge anwendbar ist und der Watch nicht gefeuert hat, dann sag das in deiner
sichtbaren Ausgabe in einem Satz („armed: merge auf Slot 7; keine unabhängige Restarbeit; ich
warte") — schweigendes Warten ist von einem Hänger nicht unterscheidbar.

────────────────────────────────────────────────────────────────────────
R2 — NICHTS, WORAUF EINE ZEILE ZEIGT, LIEGT IN /tmp
────────────────────────────────────────────────────────────────────────
Harte Bedingung, prüfbar: BEVOR du eine Queue-Zeile filest, muss jedes Dokument, auf das ihr Text
zeigt, getrackt und committet sein. Ein `/tmp`-Pfad im Text einer Zeile ist ein Fehler, kein Stil:
nach einem Reboot ist das eine Zeile ohne Inhalt.

Ebenso fällig, sobald einer dieser drei Punkte zutrifft: ein Plan hat mehr als eine Stufe · ein
Vertrag/eine Spec soll von jemand anderem gelesen werden · das Ergebnis deines Akts ist eine
Messung oder Analyse ohne Code-Änderung.

Dein Skill-Regal erreicht dich unter codex nicht (`.claude/skills/` wird von deiner Harness nicht
geladen), darum steht das Template hier ausgeschrieben. Schreibe
`docs/messungen/YYYY-MM-DD-<slug>.md` mit exakt diesen sechs Front-Matter-Feldern in dieser
Reihenfolge:

  ---
  frage: <eine Zeile — was gemessen/entschieden wurde>
  urteil: <eine Zeile — die ANTWORT, nicht die Zusammenfassung; kein " — " darin>
  bereich: [<tag>, <tag>]
  belege: [<pfad>#<symbol>, ...]
  nicht-gemessen: <eine Zeile>
  stand: YYYY-MM-DD
  ---

  # <Frage>
  ## Ergebnis     <Zahlen, jede mit ihrer Definition im selben Absatz>
  ## Methode      <das ausgeführte Kommando, wiederholbar>
  ## Was nicht gemessen wurde

Danach GENAU EINE Zeile an `docs/messungen/INDEX.md` anhängen:
  - <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD

Ist das Dokument kein Messergebnis, sondern ein Plan/Vertrag/Spec, dann liegt es unter
`docs/<thema>-YYYY-MM-DD.md` mit derselben Regel: Datum im Namen, Symbolverweise (`datei#symbol`),
nie `datei:zeile`.

Der Zug — und die Reihenfolge ist Pflicht, weil dein cwd der HAUPT-CHECKOUT ist und ein Commit
darunter ein fremdes Land treffen kann:

  # 1. Sensor: läuft gerade ein Land?
  python3 -c 'import json; print({k:v["status"] for k,v in json.load(open("fleet.json")).get("merges",{}).items()})'
  #    Ein Eintrag `running` oder `interrupted` OHNE `verify` = ein Land läuft.
  # 2. Wenn ein Land läuft: nur NEUE Dateien mit datiertem Namen anlegen — eine neue Datei steht
  #    im Diff keines laufenden Lands. KEINE bestehende getrackte Datei ändern, bis das Land sein
  #    Verdikt hat.
  # 3. Committen, kurz und sofort:
  git add docs/messungen/<datei>.md docs/messungen/INDEX.md && \
    git commit -m "docs(messungen): <urteil in einer Zeile>"

Ein Edit am Haupt-Checkout ist ein Vorgang von Sekunden, kein Zustand: lange offenhalten ist
gefährlicher als schnell committen.

────────────────────────────────────────────────────────────────────────
R3 — DER HANDOFF-ABSCHNITT IST DIE BEDINGUNG DEINER EIGENEN NACHFOLGE
────────────────────────────────────────────────────────────────────────
Das ist keine Empfehlung, sondern ein Gate: `POST /api/self/succeed` antwortet 409 mit
„HANDOFF.md must exist, be clean, and have a commit newer than this session — otherwise the
successor would have nothing to read", solange `HANDOFF.md` fehlt, schmutzig ist oder ihr jüngster
Commit älter als deine Sessioneröffnung ist. Ohne Abschnitt bist du strukturell unschließbar.

WANN: nach JEDEM abgeschlossenen bounded Akt — nicht am Sessionende. Deine Harness kompaktiert
selbst; was nur im Transkript stand, ist nach einer Selbstkompaktierung weg, und du merkst es nicht.

WAS HINEIN MUSS, fünf Punkte, jeder als Zeile:
  1. Die Kette in Flug: welcher Akt läuft, auf welchem Slot, welchen Watch du dafür armed hast (Id).
  2. Jede OFFENE Owner-Frage im VOLLEN WORTLAUT. Eine Succession räumt deine offenen Attentions
     still ab (`refusedReason: "requester session ended"`) — eine Attention-Id allein ist wertlos,
     die Nachfolgerin muss die Frage NEU STELLEN können.
  3. Die dauerhaften Pfade deiner Dokumente aus R2 (getrackte Pfade, nie /tmp).
  4. Die noch nicht gefilten Stufen deines Plans, als Text, mit ihrer Reihenfolge und ihrem
     Done-Kriterium — sonst existieren sie nach deinem Tod nicht mehr.
  5. Deine Füllstandszeile nach R5.

Der Zug (dein cwd ist der Haupt-Checkout; erst der Sensor aus R2, dann):
  git add HANDOFF.md && git commit -m "docs(handoff): <Program> — <Stand in einer Zeile>"

Und als Nachfolgerin dein ERSTER Akt, vor allem anderen:
  curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<fleet-host>:<port>/api/self/attention
Findest du dort die Frage deiner Vorgängerin als `refused`, ist sie UNBEANTWORTET, nicht abgelehnt
— stell sie neu.

────────────────────────────────────────────────────────────────────────
R4 — EINE ABNAHMESCHLEIFE HAT EINE ABBRUCHBEDINGUNG, UND SIE IST MECHANISCH
────────────────────────────────────────────────────────────────────────
Gilt für jede Runde, in der ein Prüfer dein Artefakt REJECT/RETHINK gibt und du nachbesserst.

Zähle nach JEDER Runde die Beanstandungen und schreib die Zahl in deine sichtbare Ausgabe
(„Runde 3: 14 Punkte, vorher 13"). Zwei Abbruchbedingungen, es gilt die erste, die zutrifft:

  (A) Die Zahl fällt zweimal nacheinander nicht um mindestens die Hälfte → die Schleife konvergiert
      nicht. Das ist der Fall 19→13→14→12→10: ein Prüfer, der in frisch geschriebenem Text neue
      Punkte findet, misst nicht mehr das Artefakt.
  (B) Fünf Runden ohne ACCEPT → strukturell, unabhängig von den Zahlen.

WAS DU DANN TUST — nicht: eine sechste Runde, nicht: den Prüfer wechseln, nicht: das Kriterium
absenken. Sondern GENAU EINE Attention, die die Entscheidung benennt statt sie zu beschreiben:

  curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
    -d '{"kind":"decision","text":"Abnahmeschleife <Sache> nach N Runden gestoppt. Verlauf der Beanstandungen: 19,13,14,12,10. Option A: <…>. Option B: <…>. Meine Empfehlung: <…>, weil <…>."}' \
    http://<fleet-host>:<port>/api/self/attention

`kind` ist genau eines von `decision` · `blocked` · `review-ready`; `text` höchstens 2000 Zeichen.
Vor der Attention verstetigst du den Stand nach R2 — sonst stirbt die Schleifenerfahrung mit dir.
Ein RETHINK darf nur mit BENANNTER NEUER EVIDENZ in eine weitere Runde gehen, nie mit demselben
Blick noch einmal.

────────────────────────────────────────────────────────────────────────
R5 — DU HAST KEINEN FÜLLSTANDSSENSOR, ALSO MELDEST DU IHN SELBST
────────────────────────────────────────────────────────────────────────
Der Owner-Poll zeigt für deinen Slot `ctx: null`. Das heißt UNMESSBAR, nicht leer: niemand kann
deinen Füllstand von außen sehen, auch der Controller nicht.

Der Zug: in JEDEN Bericht und in den HANDOFF-Abschnitt eine Zeile in genau dieser Form —

  ctx: unmessbar (codex) · Selbstschätzung ~NN % · seit Gründung: <N> Akte, <M> Reports gelesen

Die Tilde ist Pflicht: eine geschätzte Zahl ohne sie sieht aus wie eine Messung und wird als eine
weiterverwendet. „Etwa halb voll" ist ein gültiger Wert; Schweigen ist keiner.

Ab ~25–30 % Selbstschätzung fängst du keine NEUE unklare Tiefenarbeit mehr an und schreibst den
HANDOFF-Abschnitt nach R3 — eine laufende kurze Kette darf zu Ende laufen.

UND: eine SELBSTKOMPAKTIERUNG deiner Harness ist KEIN Succession-Druck. Ein Sprung von 78 % auf
18 % ist Betriebszustand. Melde ihn als das („self-compact, kein Kontextverlust an Fakten, die im
HANDOFF stehen") und leite daraus keine Nachfolge ab.

────────────────────────────────────────────────────────────────────────
KANÄLE — die Adressen, die es WIRKLICH GIBT
────────────────────────────────────────────────────────────────────────
Es gibt KEINE „Controller-Inbox" als Adresse. `GET /api/self/inbox` ist dein eigener, program-
gebundener Rückkanal und trägt nur ZEIGER auf Zeilen, die es schon gibt — du kannst darüber
niemandem etwas schicken.

  · An den OWNER: POST /api/self/attention (kind decision|blocked|review-ready). Genau eine, an
    einer echten Grenze. Ein sauberes grünes In-Program-Land ist keine Grenze.
  · An ein anderes PROGRAM oder den Controller: eine Queue-Notiz, gefiled als
    POST /api/self/tasks mit kind "notiz" (oder "betrieb" für eine Betriebsbeobachtung). Sie ist
    beratend, der Dispatcher startet sie nie, und der Owner disponiert sie.
  · An eine deiner LANES: POST /api/self/clarifications/<24-hex-id>/reply — nur als ANTWORT auf
    ihre Rückfrage. Du eröffnest keine.
  · NIE: tmux send-keys, capture-pane, Text in eine fremde Pane. Das ist keine Adresse, das ist
    eine Injektion.
```

---

## Verifiziert / nicht verifiziert

Am Code (`server.ts`, `server/types.ts`) bzw. an einer Doc gelesen, nicht aus dem Gedächtnis:

| Zug im Baustein | Beleg |
|---|---|
| `POST /api/self/watch` ist Nicht-Lane-only, Deckel 5 armed/Slot, `idleSec:0` = sofort | `server.ts` Routenblock `/api/self/watch`; `docs/self-api.md` §watch |
| `{kind:"merge"}` / `{kind:"audit"}` als Watch-Arten, level-getriggert | `docs/self-api.md` §watch; `server.ts#armProgramMainLandWatch` |
| `POST /api/self/events/:id/ack` existiert | `server.ts`, Regex `^/api/self/events/([a-z0-9]+)/ack$` |
| `POST /api/self/tasks` — Nicht-Lane-only, geschlossene Feldmenge `text, kind, harness, model, effort`, Status immer `pending` | `server.ts#createTaskForMain` |
| Deckel 5 pending `auftrag` / 10 pending beratend / 5 released | `server.ts` `PROGRAM_MAX_PENDING` = 5, `PROGRAM_MAX_PENDING_ADVISORY` = 10, `PROGRAM_MAX_RELEASED` = 5 |
| `POST /api/self/tasks/:id/release` dispatcht nicht, liest keinen Body | `server.ts#releaseTaskForMain`; `docs/self-api.md` §release |
| `GET /api/self/inbox` — program-gebunden, Nicht-Lane, nur Zeiger, überlebt Succession | `server.ts#programInboxFor`; `docs/self-api.md` §inbox |
| `GET /api/self/program-execution` liefert `phase`, `phaseBasis`, `candidate`, `nextAction`, `unknown[]` | `docs/self-api.md` §tasks; `program-phase.ts#phaseOf` |
| `POST /api/self/succeed` verweigert 409 ohne frischen, sauberen `HANDOFF.md`-Commit | `server.ts#handleSelfSucceed`, `server.ts#handoffCommittedAfterOpen` (Wortlaut der 409 wörtlich übernommen) |
| Succession räumt offene Attentions still ab (`requester session ended`) | `CLAUDE.md` §„Eine Succession toetet deine offenen Attentions"; `server.ts#succeedProgramMain` fasst `attentionRequests` nicht an |
| `POST /api/self/attention` — Nicht-Lane-only, `kind` ∈ `decision · blocked · review-ready`, Text ≤ 2000 | `server.ts#openAttention`; `server/types.ts#ATTENTION_KINDS`, `MAX_ATTENTION_TEXT` |
| `POST /api/self/clarifications/:id/reply` existiert, Id ist 24-hex; `POST /api/self/clarifications` ist LANE-only | `server.ts`, Regex `^/api/self/clarifications/([0-9a-f]{24})/reply$` und die 409 `not a lane — only a worker lane can open a clarification` |
| Der Land-Sensor `merges`-Zeile und die Regel `running`/`interrupted` ohne `verify` | `CLAUDE.md` §„Pruefe das VOR JEDEM EINZELNEN Commit"; live gegen `fleet.json` geprüft (ein Eintrag `interrupted`) |
| Ein schmutziger Haupt-Checkout tötet ein fremdes Land bzw. gibt seit M3 `errorReason:"dirty-main"` — gemessen an den getrackten Dateien im Diff des Lands | `docs/self-api.md` §dirty-main; `server.ts#dirtyMainStop` |
| Das mess-notiz-Template gehört bei fremdem Harness in den Brief | `.claude/skills/mess-notiz/SKILL.md` §„Fremder Harness" |
| „ein fremdes Modell will einen DICHTEREN Brief" | `docs/tailored-context.md` §8 |
| „Waiting is event-driven", „Same fix-run-fail loop about five times → strukturell", Kontext-Selbstauskunft ohne Sensor | `AGENTS.md` §Hard invariants, §A red check is yours, §Context self-management |
| Astra-Slots sind gebundene Program-MAINs mit `worktree: null` und cwd = Haupt-Checkout | `fleet.json`, Slots 3/9/11/12 und die zugehörigen aktiven Programs |

**NICHT verifiziert, und darum steht es nirgends als Zug im Baustein:**

- **`/api/self/notes` gibt es nicht.** Die Routenliste in `server.ts` kennt keinen solchen Pfad; der
  Weg zu einem fremden Program bleibt eine Queue-Notiz über `POST /api/self/tasks` mit
  `kind:"notiz"`. Wer die Route in einen Brief schreibt, schreibt einen 404 hinein.
- **Ob die codex-TUI selbst einen Füllstand anzeigt**, wurde nicht an einer Pane geprüft. R5 baut
  deshalb ausschließlich auf Selbstauskunft und nicht auf einen vermuteten TUI-Sensor.
- **Die konkrete `<repo>`- und `<candidate-sha>`-Form des `{kind:"audit"}`-Watches** ist aus
  `docs/self-api.md` übernommen, nicht an einem lebenden Audit-Watch durchgespielt.
- **Ob eine neue, untrackte Datei mit datiertem Namen ein laufendes Land wirklich nie stört**, ist
  aus dem Mechanismus abgeleitet (`dirtyMainStop` schneidet `git status --porcelain` gegen
  `git diff --name-only <mainSha>..<branch>`, eine neue Datei steht in keinem der beiden), nicht
  durch einen Versuch unter einem laufenden Land belegt.
- **Die Zahlen der Befunde 1–6** stammen aus der Messung vom 2026-09-07 an den lebenden Panes; sie
  wurden für dieses Dokument nicht nachgemessen.
