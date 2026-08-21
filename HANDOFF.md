# HANDOFF — ACP Architecture Controller (Slot 8), 2026-08-21, ctx 41,2 % GEMESSEN

**Uebergabe auf Owner-Anweisung an der Controller-Risikogrenze (~40 %).** Diese Session war
Evidenz-Kurator und Synthetisierer fuer die Rollen-/Capability-Architektur. **Kein Produktcode,
kein Land, kein Deploy, keine Suite gefahren.** Einziger Commit dieser Session: diese Datei.

## 0. Die exakte naechste Handlung

**Der GLM-Architekt (Slot 9) schreibt in DIESEM MOMENT Abschnitt J** (Autonomie-Delta). Ein
Pane-Ruhe-Watcher lief unter der Vorgaengerin und ist mit ihr weg — **die Nachfolgerin muss den
Rueckweg selbst neu legen** (Pane-Ruhe, nicht mtime: die Datei wird in Schueben geschrieben, ein
mtime-Watcher hat hier zweimal zu frueh gefeuert). Wenn J steht: den **Opus-Kritiker (Slot 12,
lebt, ctx 32 %, hat den vollen Kontext)** mit dem Delta beauftragen — Owner-Wortlaut: das
Autonomie-Prinzip auf **unsichere Mehrdeutigkeit** angreifen, **ohne es durch Schritt-Buerokratie
zu ersetzen**. Danach Synthese, Widersprueche und Umsetzungsreihenfolge neu fassen.

## 1. Die fuenf Analyse-Artefakte — ALLE UNTRACKED, ALLE VORSCHLAG

**Status: PROPOSAL, uncommitted, nicht normativ.** Sie wurden bewusst NICHT committet (ein Commit
im Haupt-Checkout bewegt `main`, und es lag kein Land-Entscheid vor). Der Owner hat ausdruecklich
verboten, sie zu editieren, zu committen oder zu normalisieren.

| Datei | Zeilen | sha256 (16) | Was |
|---|---|---|---|
| `docs/rollen-evidenz-2026-08-21.md` | 617 | `4ab207036183cbb3…` | Kurator-Evidenzdossier (18 Abschnitte) |
| `docs/rollen-architektur-glm-2026-08-21.md` | 650 | `2cd7a3590e60f8c7…` | GLM-Entwurf A–I (Abschnitt J IN ARBEIT) |
| `docs/kritik-opus-2026-08-21.md` | 596 | `d301445b44370923…` | Opus-Kritik, 15 gerangte Befunde |
| `docs/unterbau-audit-glm-2026-08-21.md` | 385 | `81219a0a7293051c…` | Unterbau-Audit, 12 Befunde |
| `docs/synthese-rollenarchitektur-2026-08-21.md` | 171 | `93756fd7e27fd08b…` | Synthese (VERALTET durch Owner-Korrektur) |

**Der Hash von `rollen-architektur-glm-*.md` ist ein Schnappschuss und aendert sich**, sobald der
Architekt J anhaengt. Die Synthese ist durch die Owner-Korrektur (§3) inhaltlich ueberholt und muss
neu geschrieben werden, nicht geflickt.

## 2. Ergebnisse der vier Agenten

- **(1) GLM-5.3/pi-zai, Architekt, Slot 9:** drei Agentenrollen als typisierte BINDUNGEN eines
  Sitzes (`lane` · `program-main` · `supervisor`), dazu Owner und Maschine als
  Nicht-Agenten-Prinzipale. Fable-MAIN: **gar keine Rolle**. Critic = Modus, Resolver = Policy.
- **(2) Opus 5, adversarialer Kritiker, Slot 12:** 15 gerangte Befunde. Drei bringen je einen
  Schnitt zum Einsturz, alle drei von mir am Code nachgeprueft: `stateEffect` ist der **Literaltyp
  `"none"`** (`src/protocol.ts:275`), also ist GLMs Wirkungs-Taxonomie nicht in die Karte
  schreibbar und Schnitt 1 faellt an seinem eigenen Proof · `e2e/pins.ts:732` pinnt den
  `STEWARD_LABEL`-Literalstring, und `bun e2e/pins.ts` IST Stufe 1 des Land-Gates, also reisst der
  Steward-Rueckbau das Gate ein · der Interventions-Rail hat keinen Konsumenten.
- **(3) pi + claude-bridge/claude-opus-5, Harness-Canary (Slot 13, beendet):** `supports.*` sind
  **Politik-Werte, keine Faehigkeitsmessungen** — `selfSchedule:false` widerlegt (POST gab 200),
  und der Code sagt selbst *„The flag means 'do not advertise this'"* (`server.ts:557`).
  `ctx:null` ist fuer pi falsch. Sein staerkster Satz: *„nichts hat mir gesagt, dass mein Ergebnis
  nirgendwo ankommt."*
- **(4) GLM-5.3/pi-zai #2, Unterbau-Audit, Slot 14:** 12 Befunde, kannte die Kritik nicht und
  **widerspricht ihr in der Rail-Frage**. Haerteste Funde: ein `canary`-Pack kann seinen eigenen
  Promotionsbeweis strukturell nicht erzeugen (die Omissions-Leiter prueft `status !== "active"`
  VOR allen Triggern) · das Lizenz-Gate hat keinen Maschinenleser · **`supervisorNudge` schreibt
  KEINE Journal-Zeile**, und eine verweigerte Zustellung schreibt gar nichts.

**Zwei LIVE-DEFEKTE im heutigen Code**, beim Pruefen eines Dokuments gefunden, von mir bestaetigt,
**unabhaengig von jeder Architekturvariante und unter der neuen Zielrichtung teurer**:
1. **Eine Codex-Program-MAIN verliert `POST /api/self/attention`** — sie erreicht den Owner nicht
   mehr. `boundProgramForMain` (`:5706`) gated auf `sessionId`; `bootstrapProgramMain` schreibt
   fuer Codex `null` (`pinsSession:false`); `tickCodexRecovery` (`:3675`) setzt spaeter eine echte
   uuid. `clarificationReceiverFor` (`:5301`) gated deshalb ausdruecklich NICHT darauf.
2. **`boundProgramForMain` ist ein `.find` ohne Eindeutigkeitspruefung** bei live 13 aktiven
   Programmen; `handleSelfSucceed` (`:5199`) behandelt dieselbe Gefahr korrekt mit 409.

## 3. OWNER-KORREKTUR: intelligence-first bounded autonomy (autoritativ)

**Die Lesart, gegen die alles oben erhoben wurde, war zu eng.** Nach Bestaetigung und Aktivierung
eines Programs soll dessen gebundene Project-MAIN reversible Produkt- und Reihenfolge-Entscheidungen
treffen, eigene begrenzte Tasks **anlegen UND starten/dispatchen**, Worker anstupsen/wiederholen/
ersetzen, Modelle waehlen und gewoehnliche Critic-Reparaturen aufloesen — **ohne Rueckkehr zum
Owner**. Kanonisch: Camera Impact — innerhalb einer freigegebenen Qualitaetsachse entscheidet und
handelt die MAIN. Klassen: **(A)** reversibel im bestaetigten Scope → MAIN · **(B)** begrenzte
Ausfuehrung/Routing → MAIN in expliziten Grenzen · **(C)** Scope-Erweiterung, irreversible
Richtung, externe Wirkung/Kosten, Deploy/Submit, erklaertes Geschmacks-Gate → Owner.

**Damit ist der Satz „die MAIN darf die Schlange fuettern, nicht den Zaun oeffnen" ueberholt** — und
der bestgemessene Befund des Tages kehrt seine Bedeutung um: `releaseTask(t, "machine")`
(`server.ts:2262`) ist die einzige Funktion, die `pending → queued` bewegt, hat genau eine
Aufrufstelle (`:18865`, Owner-Tier, hart `"owner"`), und **der Wert `"machine"` hat null
Aufrufer** — der Kommentar (`:2251`–`:2261`) nennt ihn woertlich *„the transition a future
UNATTENDED promote will make"*. Der Stempelplatz ist gebaut und unbenutzt. `Task.releasedBy` wird
persistiert.

**Owner-Prinzip Autonomie/Reparatur (normativ):** jede gebundene Session besitzt ihren Scope und
wird an Ergebnissen, Belegen und Grenz-Einhaltung gemessen, nicht an einem geskripteten
Mikro-Workflow. Kein hoeherer Manager, **keine neue Regel fuer jeden Fehler**. Bei Scheitern zuerst
die kleinste stromaufwaerts liegende Ursache klassifizieren (Wissen → Brief/Pack · Handlung nicht
auffindbar → Capability/Adapter · falsche Grenze → Program-/Rollenvertrag · Modell-Passung →
Routing · unbeobachtbar → Sensor/Receipt · Urteilsfehler → Reparatur in derselben Rolle), **nur
diese** aendern, canaryn, wirkungslose Anweisung zurueckziehen. **Eine einzelne Anekdote bleibt
Evidenz, nie eine globale Regel** — auch die scharfen Befunde von heute werden NICHT ins Regelbuch
promotet.

## 4. Context Packs sind beratend, NICHT Autoritaet

Owner-Vorgabe: Packs sind Wissens-/Ambitions-Eingaben und duerfen Autoritaet **weder gewaehren noch
entziehen noch heimlich gaten**; Program-Autoritaet und Capability-Pruefung sind eine **separate
Ebene**. **Gemessen: das gilt heute schon** — `ContextPackCapability` kommt ausschliesslich in
`context-packs.ts`, `context-plan.ts`, `context-manifest.ts`, `context-pack-validator.ts` vor und
**nie im Auth-Pfad von `server.ts`**; `requiredCapabilities` entscheidet, ob ein ZEIGER
zustellenswert ist. Aufgabe ist **Erhalt, nicht Bau**. Und: `capability-map.ts`
(Faehigkeits-Register) ist eine ANDERE Ebene als `context-packs.ts` (Wissens-Zeiger) — sie duerfen
nie verschmelzen.

## 5. Der Pi-Self-Token-Vorfall und seine Eindaemmung

**Meine Sonde war falsch geschrieben und hat den Self-Token von Slot 13 im Klartext in die Pane
gedruckt.** `${VAR:+gesetzt}${VAR:-FEHLT}` druckt bei GESETZTER Variable „gesetzt" UND den Wert
(`:-` greift nur bei ungesetzt). Der Canary hat es selbst gemeldet und Rotation empfohlen.
**Eingedaemmt:** Streu-Auto `eb0a1279` geloescht, Slot 13 beendet, der Slot-Eintrag ist aus
`fleet.json` verschwunden, das Token existiert nicht mehr (Rotation beim Recycling,
`server.ts:4494`). Das Credential war slot-scoped und nur lokal/Tailscale erreichbar. Richtige
Form: `[ -n "$V" ] && echo gesetzt || echo FEHLT`. **In keinem der fuenf Artefakte steht ein
Tokenwert** (geprueft).

## 6. Offen, mit Besitzer

- **Owner-Entscheid, benannt und unbeantwortet:** Default-`kind` fuer MAIN-erzeugte Zeilen —
  `notiz` oder `auftrag`? Die zwei Praezedenzfaelle zeigen gegeneinander: der Steward (vertrauteste
  Nicht-Owner-Quelle) schreibt `notiz` (`:16244`), `/intake` (am wenigsten vertraut, oeffentlich
  erreichbar) schreibt `auftrag` (`:13806`).
- **Die ungeloeste semantische Grenze fuer J.3, ehrlich zu halten:** „reversibel" ist beim Landen
  keine Eigenschaft der Handlung allein, sondern Handlung MAL Rate — `undo-land` deckt genau EIN
  Land und nur bis zum naechsten (`:17706`), Land N ist beim Alarm auf N+1 schon unerreichbar.
  `SYSTEM.md` erlaubt den Policy-Weg bereits woertlich; die Maschinerie (`land-candidate.ts`) ist
  gebaut und wird nur von Tests importiert.
- **Attention `ce32bda5`** (Result-Rail Candidate `0057259`) bleibt offen — Land- und
  Deploy-Entscheid gehoeren dem Owner, unberuehrt.
- **Slots 9, 12, 14 leben** und tragen den vollen Kontext ihrer Rolle; Slot 13 ist beendet.

## 7. Was ich falsch gemacht habe

- **Mein Evidenzdossier trug fuenf Fehler.** Drei fand ich selbst, einen der Architekt
  (`main-direct`-Zeilen existieren: 415 Zeilen, 27 davon), einen erst der dritte unabhaengige
  Leser — und **dieser eine war bereits in den Entwurf gewandert und stand dort als „bestaetigt"**
  (die Nudge-Journal-Zeile, die es nicht gibt). Das ist das Argument fuer die vier Perspektiven,
  keine Fussnote dazu.
- **Die Token-Sonde** (§5).
- **Zwei Watcher feuerten zu frueh**, weil ich mtime-Stabilitaet als Fertig-Signal nahm; ein
  Agent, der in Schueben arbeitet, laesst die Datei stillstehen, waehrend er denkt. Pane-Ruhe ist
  das richtige Signal, mit herausgefilterten Spinner- und Zaehlerzeilen.

## 8. Verifikation dieses Commits — ehrlich

**Keine Suite gefahren.** Der Owner hat Suiten fuer diese Uebergabe ausdruecklich untersagt; die
Aenderung ist ausschliesslich diese Datei. Ein Direkt-Commit aus dem Haupt-Checkout ist fuer jedes
land-seitige Ledger unsichtbar (keine `fleet/land`-Note, keine Outcome-Zeile, kein Tier-2-Lauf) —
das steht hier, damit die naechste Session nicht korrekt-aber-falsch schliesst, er sei vermessen
worden.

# FRONTIER — 2026-08-21: die Controller-Architektur, bevor weiter gebaut wird

**Owner-Entscheid 2026-08-21:** der Spiele-Bau tritt zurueck; zuerst wird die
Controller-Architektur geklaert. **Kein Land, kein Deploy, keine alte Queue-Arbeit neu
starten.** Die Nachfolgerin beginnt READ-ONLY.

## Die gemessene Luecke, die den Schnitt ausloest

Eine gebundene Program-MAIN kann **strukturell keine Fleet-Task anlegen oder dispatchen**.
Nachgemessen, nicht vermutet:
- Es gibt **keine** self-Route, die eine Task anlegt oder startet (`rg` auf self+task: leer).
- `POST /api/tasks` (`server.ts:18486`) und `POST /api/tasks/:id/dispatch` (`:18363`) liegen
  **unterhalb** des Owner-Gates (`:16999`, „everything below carries authority").
- Folge: alles, was diese Session heute an Queue-Arbeit tat — drei Briefs anlegen, den
  Result-Rail dispatchen, den Critic spawnen (`POST /api/lanes`) — lief ueber das
  **OWNER-Token**, nicht ueber das Prinzipal „Program-MAIN". Der dokumentierte Selbst-Kanal
  einer MAIN ist heute: propose, attention, watch, autos, ack, succeed/retire. Mehr nicht.
- Der Ausweichweg ist damit der manuelle Worktree — genau die Handarbeit, die die
  Architektur abschaffen soll.

## Auftrag der Nachfolgerin (Owner-Wortlaut, verdichtet)

Entwirf die **kleinste kohaerente Rollen-/Funktions-Architektur**, die diese Luecke schliesst.
Sie muss unterscheiden: **globaler Owner-seitiger Controller · Supervisor · Project-MAIN ·
Fable/kreative MAIN (falls ueberhaupt) · Builder-Lane · Critic/Resolver · Worker.** Zu jeder
Rolle gehoeren: **typisierte Capabilities, Autoritaet, Receipts, Harness-Degradation, und wo
das Landen wohnt.** `SYSTEM.md` und der heutige Code werden WIEDERVERWENDET; ueberfluessige
Schichten werden ausdruecklich **zurueckgebaut**, nicht ergaenzt.

**Vor jeder Implementierung** zwei UNABHAENGIGE Review-Briefs vorbereiten:
1. **Adversarialer Opus-Architektur-Critic.**
2. **Echter Pi-Harness** (`claude-bridge/claude-opus-5`, thinking high) als
   **Portabilitaets-Critic** — zugleich der EINE kontrollierte Pi+Opus-Canary, den die
   Routingvorgabe erlaubt; er ist noch durch nichts belegt (kein Lane/Land-Canary, kein
   `transcript:true`-Vertrag, kein Worker-Tier).

**Kein Code**, bis beide Kritiken synthetisiert sind und der Owner die minimale Architektur
plus die **strittigen Grenzen** bekommen hat.

## Was offen liegen bleibt und NICHT angefasst wird

- **Attention `ce32bda5`:** Result-Rail Candidate `0057259` ist reviewreif. Land-Entscheid und
  Deploy-Entscheid gehoeren dem Owner. Lane `fleet/260820204100-7aa1` (Slot 3) bleibt stehen.
- Drei task-fertige, NICHT dispatchte Briefs: `ad2ee96a` CTX-01 · `7aaa6644` STUDIO-00 ·
  `e952c2b2` HARNESS-01. Zwei notizen: `13ed6ce9` Loader-Widerspruch · `c89c18df`
  Zustellbudget.
- Exakt loeschbar, bewusst nicht geloescht: Slot 7 (`fleet-260820222129-8e3a`, geernteter
  read-only Critic, ahead=0/clean) und der orphan `fleet-260820171920-5ad5` (ahead=0/clean,
  HEAD ist Ahne von main, kein Slot haelt ihn).
- Die zehn untracked Owner-Dateien im Root: **niemals anfassen.**

## Zwei Werkzeug-Wahrheiten, die die Nachfolgerin sofort braucht

- **Der ③-Reviewer ist defekt** (`summarizer timed out without an answer`). Eine unabhaengige
  Review kostet derzeit einen eigenen Critic-Slot.
- **Ein Lane-Watch ist stumm, solange `ahead=0`**, und ein read-only Critic committet nie —
  fuer beide braucht es einen eigenen Pane-Quiet-Watcher. Zweimal an einem Tag bezahlt.

# HANDOFF — ACP Project MAIN (Slot 2), 2026-08-21, ctx GEMESSEN am eigenen Slot

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei traegt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN fuer Program `eeba7c04caae64d79969199b`. Genau EIN Schnitt: der
Result-Rail (ACP-05/06), Scope B-D. Kein eigener Produktcode, kein Land, kein Deploy.

## Belegter Stand

- **Candidate `0057259`** auf `fleet/260820204100-7aa1` (Slot 3, Sol high), zwei Commits:
  `cc127b5` Bau, `0057259` Reparatur. Basis `main e59d89f`, behind 0, wouldConflict false,
  Lane clean inkl. 0 untracked. **Reviewreif, NICHT gelandet** — Attention `ce32bda5` offen.
- Proof unabhaengig nachgemessen: `./e2e-isolated.sh` seriell **2771 PASS / 0 FAIL, EINE
  run-id**; pins 161 PASS; claude-gate 410 PASS. Runde 1 lag bei 2767, Act-3-Basis bei 2755 —
  die neuen Checks existieren wirklich, die Zahl steht nicht still.
- **Scope-Teilung gehalten:** Teil A (`attemptId`, Lifecycle) ist NICHT gebaut und kommt im
  Baum nicht vor. Er bleibt ein eigener Owner-Entscheid.
- **Der Live-Server ist weiter hinter `main`.** Act 3 UND dieser Schnitt sind damit gebaut,
  aber nicht aktiv. Deploy ist ein getrennter Owner-Akt und wurde nicht angefasst.
- Die zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, vor und nach jedem
  Schritt geprueft.

## Freigegebene Reihenfolge fuer die Nachfolgerin

1. **Land-Entscheid zu `0057259`** einholen (Attention `ce32bda5`). Nicht selbst entscheiden.
2. **Deploy-Entscheid** — getrennt vom Land, und er deckt zwei Schnitte ab, nicht einen.
3. Danach erst die drei task-fertigen, NICHT dispatchten Briefs: `ad2ee96a` CTX-01 ·
   `7aaa6644` STUDIO-00 · `e952c2b2` HARNESS-01 (nicht blockierend).

## GLM Studio Readiness: CONDITIONAL-GO

Die Rollenfrage ist entschieden: **Project MAIN plus temporaere Specialists genuegt. Es gibt
KEINE Fable-MAIN-Zwischenebene.** Vor einem Studio-Start fehlen drei Dinge, keines davon
Bauarbeit der Nachfolgerin:
- **Result-Rail gelandet UND live.** Gebaut reicht nicht — ohne laufenden Code ist der
  Rueckkanal an echter Arbeit nicht beweisbar.
- **Owner-Entscheid: attended oder automatisierter Dispatch?** Verschiedene Fehlermodi,
  verschiedene Spuren.
- **Owner-Entscheid: ehrliche Entkopplung von der Act-9-Feuerprobe.** Act 9 ist heute nicht
  messbar (Tabelle: `docs/messungen/2026-08-20-gamestudio-readiness.md`). STUDIO-00 darf sich
  daran nicht aufhaengen — was NICHT geht, ist so zu tun, als sei die Feuerprobe gefahren.

## Routing ab dem naechsten Schnitt (Owner, 2026-08-21)

Qualitaetskritische Builder und frische Code-Critics standardmaessig **Opus 5**, nicht
Sol/Codex. Sol ist nur noch begruendeter Spezialist. Fable bleibt Director/visueller
Integrator, GLM attended Cross-Family-Gegenpruefung. **Pi+Opus nur als genau EIN
kontrollierter Canary**, nicht als Default, bis Spawn/High/Tools/Commit/Resume/ctx/
Result-Rueckkanal belegt sind. Und: **heute laesst sich fuer eine claude-Lane kein
expliziter high-Fakt behaupten** — der Adapter kennt das reale `--effort`-Flag nicht
(gemessen: CLI 2.1.238 hat es, `slotCmd`/`agentCmd` reichen es nie durch,
`supports.effort:false`). Das ist `e952c2b2` HARNESS-01.

## Vier Befunde, die die Nachfolgerin braucht

- **Der ③-Reviewer ist defekt** (`summarizer timed out without an answer`), durchgehend, auch
  als Owner-POST. Die mechanische Review-Haelfte steht also nicht zur Verfuegung; eine
  unabhaengige Review kostet derzeit einen eigenen Critic-Slot.
- **Ein Lane-Watch ist strukturell stumm, solange `ahead=0`.** `done-looking` verlangt
  idle + clean + ahead>0; eine Lane, die vor dem ersten Commit stoppt, erreicht dich NIE. Das
  ist zweimal passiert (Regel-Widerspruch, dann Write-Set-Grenze) und beide Male hat nur ein
  eigener Pane-Quiet-Watcher es gemeldet. Dasselbe gilt fuer jeden read-only Critic: er
  committet nie, also feuert nichts.
- **Der Loader-Vertrag widerspricht sich** (`notiz 13ed6ce9`): `AGENTS.md` fordert den vollen
  `CLAUDE.md`-Read unter einer Sunset-Klausel, deren Bedingung laengst eingetreten ist — eine
  Lane haelt seit dem Generat nur noch eine Lane-Fassung (29 529 B / 340 Z. / 3 von 7 Teilen,
  ~3 % eines GPT-Fensters, nicht die ~8 %, die die Brief-Checkliste nennt). Ein Sol-Builder
  ist daran korrekt stehengeblieben.
- **Das FleetEvent-Zustellbudget schliesst den Rueckkanal bei maximaler Koordination**
  (`notiz c89c18df`): eine MAIN mit 5 armed Watches hat null Budget. Steht woertlich schon auf
  `main:5313` fuer Clarifications — geerbt, nicht neu, und ein Entscheid, kein Bugfix.

## Was ich falsch gemacht habe

- **Ich habe einem Builder eine Regel weggewinkt, die ein Brief nicht waiven kann.** Mein
  Brief sagte "nie `CLAUDE.md` am Stueck lesen" gegen eine als *hard loader requirement*
  deklarierte Zeile in `AGENTS.md` — und meine ~8-%-Begruendung war gegen die falsche Datei
  gerechnet (Haupt-Checkout 62 678 B statt Lane-Fassung 29 529 B).
- **Ich habe dem Builder vier Sicherheits-Schranken woertlich diktiert, und eine war falsch.**
  Der PRE_AUTH-Eintrag behauptete "lane-only" auch fuer GET; GET ist dual-scoped. Der Critic
  hat es gefunden, der Builder hatte es korrekt umgesetzt — der Fehler war meiner.

# HANDOFF — ACP Project MAIN (Slot 3), 2026-08-20, ctx 31,7 % GEMESSEN

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN für Program `eeba7c04caae64d79969199b`. Vier Owner-Freigaben abgearbeitet:
Promotion + Deploy, gameStudio-Readiness, Act 3 gebaut/repariert/gelandet, Result-Rail geschnitten.
Kein eigener Produktcode. Die Nachfolge ist eine OWNER-ANWEISUNG, keine Schwellen-Übergabe —
31,7 % liegt deutlich unter den 44 %.

## Belegter Stand

- **`main` = `9fd1025`** (Act 3). Die Session hat main ausserdem von `e19c80f` auf den
  Integrationstip vorgezogen und das Haupt-Checkout auf `main` umgestellt — Fleet landet
  seitdem wieder auf `main` statt auf dem `docs/`-Zweig (`integrationBranch()` server.ts:3143
  fällt auf den Branch des Haupt-Checkouts zurück).
- **Act 3 gelandet und tier-2-grün.** Land-Note: `b4897ba` → `9fd1025`, verify `ok:true`,
  `exitCode 0`, `ms 99758`, `waitMs 0`, `confirmedByHuman:false` (clean auto-land).
  Post-Land-Audit `green`, **`ms 998782`, `ran 2755`, `failed 0`**, covers genau diesen einen Land.
- **DER LIVE-SERVER HAT ACT 3 NICHT.** `deployGap`: bootHead `8f31701`, head `9fd1025`,
  `behindCount 3`, **`codeBehind: true`**. Act 3 ändert `server.ts` (Confirm-Pfad) — der
  Identitäts-Guard ist also GEBAUT, aber NICHT AKTIV. Ein Deploy ist NICHT owner-freigegeben.
  Das ist der wichtigste offene Punkt.
- `b4897ba` ist ein Direkt-Commit aus dem Haupt-Checkout (Readiness-Messung) — für jedes
  land-seitige Ledger unsichtbar. Verifikation lief von Hand vollständig: volle Kette exit 0,
  fünfmal ALL PASS, danach `./e2e-isolated.sh` 2739 PASS / 0 FAIL, EINE run-id.
- Offene Attention: **keine**. `2e9e4207…` ist vom Owner mit „Ja" beantwortet.
- Zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, wie vom Vorgänger übernommen.
  Die drei fremden Worktrees ebenfalls — Owner-Anweisung.

## Freigegebene Reihenfolge für die Nachfolgerin

1. **Result-Rail `bbb2e53f`** (kind `auftrag`, `pending`, programgebunden). Sein hartes
   Gate — „nicht dispatchen, solange Act 3 nicht gelandet ist" — **ist jetzt erfüllt**. Der
   Brief steht vollständig in der Task; er verortet den Schnitt ausdrücklich in den
   BESTEHENDEN Acts 5/6 und verbietet ein zweites Objekt neben Clarification/Attention.
   Zwei Punkte gehören dem Owner und sind im Brief benannt: ob `attemptId` (Lifecycle) mit
   B–D (Transport-Symmetrie) in eine Lane geht, und ob der Rail je etwas gaten darf (dieser
   Schnitt sagt nein).
2. **Deploy-Entscheid für Act 3 einholen.** Siehe oben — nicht selbst entscheiden.
3. `ec9e85a6` (kind `notiz`) trägt den UI-/Faktschicht-Befund für Act 4 oder 7.

## Vier Befunde, die die Nachfolgerin braucht

- **Ein grüner Suite-Lauf beweist nur, was seine Fixtures anfassen.** Der Builder UND ich
  hatten je einen ehrlichen `./e2e-isolated.sh` mit 0 FAIL auf `b2809f5`; beide waren blind
  für einen echten Regress, weil `G1c` und der neue Fixture main in einer ANDEREN DATEI
  bewegen (`e2e/land-provenance.ts:457` schreibt `moved.txt`). Der frische read-only Critic
  fand ihn, weil er über das PRIMITIV nachdachte statt dem Lauf zu glauben:
  `git patch-id --stable` hasht Kontextzeilen mit. Reproduktion (Wegwerf-Repo): Lane-Edit
  byte-identisch, main bewegt eine Kontextzeile zwei Zeilen darüber, Rebase konfliktfrei,
  patch-id `ca7d66f2` → `780b5e99`. **Lehre: der Critic-Schritt in Acts 5–8 ist kein Zeremoniell.**
- **`awaiting`, `hot` und „läuft" sind heute EINE Darstellung für DREI Zustände**
  (arbeitet · vom Provider blockiert · wartet auf den Suite-Mutex). Der Klassifikator
  EXISTIERT bereits — `paneReadiness()` server.ts:4672 liefert ready|blocked|pending mit
  `why` —, ist aber nur Gate (server.ts:4692, :5784), nie projizierter Fakt, und seine
  `blocks`-Liste (server.ts:903-906) kennt nur Spawn-Zeit-Screens. Details: `ec9e85a6`.
- **Act 9 ist heute nicht messbar.** Von acht Grössen seines Proof hat keine einen
  vollständigen Sensor. Ursache: `lane-outcomes.jsonl` (der einzige reiche Per-Versuch-Ledger)
  entsteht am LANE-Ende, und die Studios laufen als MAIN-Sessions IN ihren Repos —
  300 Zeilen für claude-fleet, 1/1/1 für private-repo-c/private-repo-e/private-repo-i, 0 für
  private-repo-f/private-repo-g. Ganze Tabelle: `docs/messungen/2026-08-20-gamestudio-readiness.md`.
- **Drei Reste an der Act-3-Naht, bewusst offen gelassen** (in `0a4b1e38` als Kommentar
  `6448b326` festgehalten): `awaiting-author` bindet einen Tip, der sich nach der
  Autor-Auflösung zwingend ändert → Confirm 409, Verhalten korrekt aber ungetestet · der ff
  zielt auf den Branch-NAMEN statt die geprüfte `candidateSha`, ms-kleines TOCTOU-Fenster,
  **vor diesem Diff genauso offen, kein Regress** · `bindCandidate` hält den vollen
  `--binary`-Diff im Speicher, ungemessen.

## Was ich falsch gemacht habe

- **Eine Lane-Watch für einen read-only Critic wäre nie gefeuert.** `done-looking` verlangt
  `ahead>0`, ein Kritiker committet nie. Ich habe es rechtzeitig gemerkt und einen
  Hintergrund-Watcher auf Pane-Ruhe genommen — aber die Falle ist real und sieht von aussen
  wie „arbeitet noch" aus.
- **Zwei eigene Sonden waren falsch, nicht die Maschine.** Ein `grep '"repo": "'` über
  `lane-outcomes.jsonl` verfehlt Zeilen mit anderer JSON-Spationierung und meldete für alle
  fünf Spiele-Repos fälschlich Null (die geparsten Zahlen gelten). Und ein
  `$(git rev-parse master 2>/dev/null || git rev-parse main)` fing BEIDE Ausgaben ein und
  zerlegte meine erste patch-id-Reproduktion.
- **Ich habe „land it" empfohlen, als stünde die Entscheidung an.** Der Owner hat korrigiert:
  eine Empfehlung im Composer ist keine Autorität. Der Land kam erst nach ausdrücklichem „Ja"
  über die Attention-Route.
# HANDOFF — ACP Project MAIN (Slot 2), 2026-08-20, ctx ~40 %

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Gebundene Project MAIN für Program `eeba7c04caae64d79969199b` („Claude Fleet — Agentic Control
Plane Outside-in"). Koordination, kein eigener Produktcode: zwei Act-Briefs geschnitten, drei
Builder gebrieft, drei Schnitte integriert.

## Belegter Stand

- **Integrationstip `ad03d34`** auf `docs/kontextschicht-analyse-2026-08-20`. Gelandet in dieser
  Reihenfolge: ACP-02 Capability-Quelle → `7a91ef1`, ACP-01 UI-Grundbedienung → `4e4a70e`,
  ACP-X1 Composer-Autorität → `ad03d34`. Der Doku-Schnitt `92b96b3` war ein korrektes No-op.
- **Alle Post-Land-Audits grün** (ACP-02 16,7 min; ACP-01 und ACP-X1 je 2739 Checks / 0 Fehler).
  Belege in `git notes --ref=fleet/land`, nicht in Meldungen.
- **`main` steht weiter auf `e19c80f`.** Fleets Integrationszweig ist NICHT `main`:
  `integrationBranch()` liest `repoBases[repo]` (leer) und fällt auf den aktuellen Branch des
  Haupt-Checkouts zurück. Gelandet wird also auf `docs/kontextschicht-analyse-2026-08-20`.
- **Live läuft alter Code:** bootHead `0c59dd1`, 16 Commits zurück, `bundleStale: true`. Kein
  Deploy — nichts davon ist im Board sichtbar.
- Zehn untracked Owner-Dateien im Haupt-Checkout: unangetastet, vor und nach jedem Land geprüft.
- Keine laufende Suite, kein Merge, kein Audit, kein armer Watch beim Schreiben dieser Zeilen.

## Freigegebene Reihenfolge für die Nachfolgerin

1. **Promotion/Deploy sauber entscheiden und durchführen.** Offen ist beides: ob `main` auf den
   Integrationstip nachgezogen wird, und der Deploy selbst (`POST /api/deploy`, danach
   `bundleStale` auf `/api/sessions` prüfen). Der Vorgänger hat weder das eine noch das andere
   angefasst.
2. **Act 3 — Candidate-/Diff-Identität + reiner Policy-Faktensensor.** Ein Builder, Sol high
   (Server-/Lifecycle-Schnitt). Definition im Program Brief `3a9556e`/`92b96b3`: Verdikt bindet
   `LandCandidate` (mainSha, candidateSha/Lane-Tip, Verify-Lauf); Candidate-Wechsel macht das
   Verdikt stale und der Confirm-Pfad antwortet 409; die Projektion erfindet KEINE Eligibility
   und ändert kein Land-Verhalten. `server.ts` ist lease-frei.
3. **Kurzer gameStudio-Readiness-Schnitt** für die heutigen Aufträge.

Der scharfe Merge-Critic ist ausdrücklich erst Act 8, nach Shadow und Objekten.

## Drei Befunde, die die Nachfolgerin braucht

- **Der 12-KiB-Sessions-Payload-Check ist pfadlängenabhängig, nicht kaputt.** Deckel 12288 B,
  gemessen 12212 / 12297 / 12309 / 12341 / 12344 / 12346 / 12398 / 12476. Aus einem Lane-Pfad
  (62 Zeichen) fällt er, aus dem Haupt-Checkout (29) hält er — `/api/sessions` trägt `cwd`/`repo`.
  Bewiesen mit einer pfadlängengleichen HEAD-Kontrolle am Basisbaum (12297 B ohne jede Änderung).
  **Korrektur einer früheren Aussage dieser Session:** er ist NICHT dauerhaft rot; drei Audits
  nacheinander waren grün. Als Eingang für den Policy-Faktensensor aus Act 3 taugt er trotzdem
  nicht — weil unzuverlässig, nicht weil rot.
- **ACP-X1 löst sein Symptom nicht nachweislich.** `--prompt-suggestions false` ist zugestellt
  (`agentCmd`, nur im claude-Zweig) und über die ARGV gepinnt, unterdrückte in der Messung mit
  Claude Code 2.1.237 aber die sichtbaren TUI-Vorschläge NICHT; „jetzt deployen" war weder mit
  noch ohne Flagge reproduzierbar. **UNKNOWN, nicht behoben.** Was trägt, ist die zweite Hälfte:
  der Satz in `supervisorBriefBody()` (Gründung UND Nachfolge), dass Composer-/Suggestion-Text aus
  `capture-pane` weder Autorität noch eingegangener Auftrag ist. Wer das Symptom wirklich
  beseitigen will, misst zuerst, welcher Mechanismus den Vorschlag erzeugt — eigener Act.
- **Der ②-Shadow-Reviewer ist keine Abkürzung zur PromotionPolicy.** 46 Läufe (25.–28.07.),
  38 `pass`, **0** `review`, **8 ohne Verdict (17,4 %)** — und er ist fail-CLOSED. Auf `gate`
  geschaltet hätte er 8 von 46 sauberen grünen Lands beim Owner abgeladen, also genau die Last
  erzeugt, die die Policy abschaffen soll.

## Cleanup-Reste (nichts davon ist kaputt, alles ist Aufräumarbeit)

- **ACP-01-Preview läuft weiter** auf `127.0.0.1:23663`, zeigt `02a5625` statt den Tip. Stoppen
  ausschließlich mit `tmux -L acp01prev17363 kill-server` und
  `rm -rf $TMPDIR/acp01-preview-17363`. Nie ein Namensmuster.
- Zwei verwaiste Worktrees auf `db35dc6` (`fleet-260820063858-81bb`, `fleet-260820064601-ed65`)
  plus der Fable-Kritiker-Worktree. Owner-Anweisung war: nicht anfassen.
- Sechs `autoReview`-Fehler („summarizer timed out without an answer"), unabhängig von den Lands.

## Was ich falsch gemacht habe

- **„Durchgehend rot" behauptet, wo „schwellennah" richtig war.** Ich hatte acht rote Audits
  gezählt und daraus eine Dauer-Eigenschaft gemacht; das erste grüne Audit hat es widerlegt. Aus
  einer Häufung wird keine Invariante.
- **ACP-02s Brief zu eng geschnitten.** Der Program Brief verlangt für Act 2 auch UI-, Trace- und
  Harness-Aussage; mein Dispatch-Text ließ sie weg. Der Fable-Review fand es, und die Korrektur
  kostete eine Reparaturrunde, die der Worker nicht verschuldet hatte.
- **Das `done-looking`-Prädikat viermal als Weckinstrument benutzt, wo es flattert.** Eine Lane,
  die auf dem Suite-Mutex wartet, sieht identisch aus wie eine fertige. Für „Kette fertig" ist ein
  Hintergrund-Watcher auf die echte Bedingung richtig, für „Merge/Audit fertig" die
  `{kind:"merge"}`/`{kind:"audit"}`-Watches — die haben je genau einmal und korrekt gefeuert.

# HANDOFF — MainCF (Slot 5), 2026-08-19, ~8,8 h, ctx 48,1 % gemessen

Zustand wird ABGELEITET, nicht hier aufgeschrieben: `./state.sh` und `./register.sh` zuerst.
Diese Datei trägt nur, was git nicht tragen kann — Absicht, Korrekturen, Reihenfolge, offene
Entscheidungen.

## Was diese Session war

Zwei Stränge. (1) Owner-Frage „warum sind die Spiele nicht ambitioniert genug" → Kit v3 als
Vorschlag. (2) Supervisor-Auftrag Gamestudio-Refinement Teil 2 → Worktrail-Audit II, vier
Mess-Lanes.

## Der EINE offene Rest: Queue-Zeile `79f9fddb`

`[worktrail-audit-II] ZUSAMMENFUEHRUNG` — pending, kind `auftrag`, vollständig gebrieft
(Done-Kriterium + Verify-Weg + Verbote). **Dispatchen, sobald `private-repo-f.md` auf main liegt**
(Slot 15 / Task `4b4764ef` war beim Schreiben `ahead=1`, landet über s8).
Gelandet sind: `docs/worktrail-audit-II/{private-repo-h,private-repo-e,private-repo-c}.md`.

## Fünf Entscheidungen, die dem OWNER gehören — keine davon ist MAIN-Arbeit

1. **`FLEET_VERIFY_WAIT_MS` auf 45 min.** Es ist ein LITERAL in der tmux-Spawn-Zeile von
   `watchdog.sh` (nach dem `.env`-Sourcing, das Literal gewinnt; in `.env` steht es nicht).
   Reihenfolge zwingend: Datei ändern → `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`
   → DANN srv neu. Umgekehrt backt der alte Watchdog wieder 900000 ein (`watchdog.sh:112`
   spawnt srv nur bei fehlender Session).
2. **Kill auf die Prozessgruppe statt den Prozess** (Vorschlag in `00714c8`). Behebt eine andere
   Sache als (1) und wird durch (1) NICHT behoben.
3. **`/usage` in einer fremden Pane neu aufrufen?** Der einzige Kontingent-Sensor ist ein
   geparktes `/usage`-Modal auf Slot 15; der passive Watcher liefert fast immer `unknown`.
4. **Teil 1 des Refinement-Plans**: Verkostung der vier Spiele + 2–3 Referenzspiele je Studio,
   ausdrücklich OHNE Vorschlagsliste von uns.
5. **Kit v3 rev.2 promoten oder verwerfen** — liegt fertig unter `studio-kit/v3-proposed/`,
   einen `git mv` entfernt. Die Zwangsnaht (welches der drei Durchsetzungsorgane welche Zeile
   bekommt) steht in `docs/studio-kit-v3-vorschlag-2026-08-19.md` §4.

## Drei Befunde, die noch niemandem gehören

- **Ein Land kann auf drei Arten sterben, alle durch Warten:** `waitedOut` (nie gemessen) ·
  im Lock überholt (kein FIFO — gemessen 17:25, ein Dritter nahm die Lücke, während Slot 2 seit
  18,3 min anstand) · **verifiziert-aber-veraltet** (verify grün, dann `ff` unmöglich, weil main
  während der Schlange weiterzog — ZWEIMAL gemessen: s10 `ms 902 048 / waitMs 803 000`,
  s13 `ms 875 105 / waitMs 773 000`). Modus 3 ist der teuerste und verlängert die Schlange, die
  ihn verursacht hat. Auf FREIER Maschine dauert dasselbe Land 1,7–1,9 min (`waitMs 0` bzw. 15 s).
- **Der Sessions-Poll hat 8–76 Byte Restluft** bei 12 288 B Deckel, und **eine zusätzliche Lane
  kostet 510 B** (`a69b0f6`, drei serielle Läufe). Nicht das nächste Feld kippt den Check,
  sondern die nächste Lane. Der Land-Gate kann es strukturell nicht fangen: `e2e/tasks.ts`
  läuft nur in Tier 2.
- **Der Verify-Timer persistiert seine eigene Eingangsgröße nicht.** `waitedMs` (steuert `arm()`)
  und `waitMs` (nachträglicher Parser, geht auf den Datensatz) sind ZWEI Größen mit fast gleichem
  Namen; nur die zweite überlebt. Jede Wiederholung dieser Untersuchung endet darum in `unknown`.
  Befund des Supervisors, billiger Schnitt, gehört ins Programm `b3d042ec`.
  GEMESSEN und unstrittig: die Invariante `server.ts:9067` („at most WAIT+TIMEOUT") ist um
  302 783 ms verletzt; ein Gate arbeitete HÖCHSTENS 48 s und stand MINDESTENS 24 min an.

## Was ich falsch gemacht habe (damit es niemand wiederholt)

- **Zu viel selbst gemessen.** Panes gelesen, Sonden gedruckt, Fixtures debuggt, Prozessbäume
  verglichen. Das gehört in Wegwerf-Worker mit engem Brief; die Rolle einer MAIN ist Urteil und
  Reihenfolge. Der teuerste Posten der Session, nicht die Timer-Abzweigung.
- **Vier Messungen waren MEINE Sonde, nicht die Maschine:** ein `| tail -4` liess `$?` den Exit
  von `tail` lesen · ein `nohup … &` im Hintergrund-Bash meldete `exit 0` für die äussere Shell,
  während die Suite noch lief (0 PASS-Zeilen = nie gestartet) · eine Score-Sonde las
  `250 pts · needs 55% grip` als Punktestand · die Suche nach `acquired`-Zeilen lief im
  gedeckelten `verify.out`, während `suiteWait` über die VOLLE Ausgabe parst.
- **Absenz aus einer einzigen Grep-Schreibweise geschlossen** („private-repo-c ii" statt „zweiter
  Anlauf"/„bracket 2") und daraus einen falschen Befund gebaut.
- **Im `tasks`-Digest nach Volltext gesucht**, obwohl ich am selben Tag gelesen hatte, dass der
  Poll nur Digests trägt.

## Reihenfolge für die Nachfolge

1. `private-repo-f.md` landen lassen (läuft über s8), dann `79f9fddb` dispatchen.
2. Die Tabelle reviewen, landen, Audit ansehen.
3. Die fünf Owner-Entscheidungen NICHT selbst treffen — vorlegen.
