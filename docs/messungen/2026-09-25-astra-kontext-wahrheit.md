## 1. Was die Anreicherung tatsächlich tut

**Urteil:** Fleet kann einen Auftrag, ausgewählte Quellen und einen Rückweg zustellen. Es liefert noch kein durchgängig verlässliches Lagebild der handelnden Session. Der größte nächste Gewinn liegt bei **Position, bedienbaren Türen und widerspruchsfreier Zuständigkeit**. Ein größeres Gedächtnis oder frei wählbare Profile ersetzen diese drei Dinge nicht. Grundlage sind 50 geminte Sessions, die nachstehenden Quellprüfungen und der Kostenvergleich in Abschnitt 2; dies ist eine Empfehlung, keine Regelpromotion.

Codebasis: `4937d219d896`. Die Zustellzählung endet am 24.09.2026 um 20:09:29 UTC bei `context-receipts.jsonl:1206`. Sessionbelege verwenden ausschließlich acht Zeichen und `t` für einen Assistant-Turn; `c` bezeichnet zusätzlich den Tool-Aufruf. Zählweise, Stichprobe und Grenzen stehen in Abschnitt 6. **Zugestellt**, **sichtbar geöffnet**, **verstanden** und **wirksam** sind vier verschiedene Aussagen. Der letzte Schritt verlangt einen Vergleich, den diese Beobachtungsstudie nicht hat.

**Die Reihenfolge ist zweistufig.** Zuerst lädt der Harness seine Umgebung. Der portable Ladervertrag verlangt für Claude den privaten Render plus das Nachlesen des portablen Vertrags; Codex/Pi sollen `AGENTS.md` automatisch laden. Danach kommt die Fleet-Nachricht. Das ist der Vertrag in `AGENTS.md:10` und `rulebook/loader.md:3`; Claude-Instruktions-Attachments sind beispielsweise vor `4af5eae3:t1` sichtbar, Codex-Regelinjektionen vor `01a0cf25:t1`. Das beweist keine identische Startumgebung aller Harnesses.

| Rolle / Einstieg | Fleet-Zustellung in Reihenfolge | Gemessene erste Prompt-Bytes: n; Median; Spanne | Sichtbarer Gebrauch / Grenze |
|---|---|---|---|
| Worker | Gültiger Kartenkopf → Brief oder Rohauftrag → Kommentare/Gegenlese → zugeordnete Notizvorschauen → Quellenausschnitte → optionaler Studio-Lane-Block → Anker → Abschlussanweisung → Memory-Zeiger. Eine Welle bündelt mehrere Zeilen. | 18; 11.616; 6.269–21.225 | Konkrete Codeflächen werden geöffnet, etwa Lock-Code in `1458c892:t1`; bei drei Codex-Unterworkern ist der erste Prompt geerbter Elternkontext. Mechanik: `server.ts#briefAndSend:15164`, Verkettung `server.ts:15429`; Karten/Wellen: `wave-brief.ts#withCardHead:138`, `#renderWaveBrief:183`. |
| Clarify | Deterministischer Klärungsrahmen → Rohwunsch als Gegenstand → Anker. Der technische Clarify-Zweig lässt Notizen, Snippets, Abschlussfooter und Memory-Zeiger weg. Ein normal dispatchter Auftrag „CLARIFY FIRST“ kann dagegen das Worker-Paket tragen. | 7; 6.499; 4.239–11.406 | Kriterium statt sofortiger Implementierung ist sichtbar, etwa `01a0cd58:t6` und die Criterion-Einreichung `t9`. `clarify-prompt.ts#buildClarifyBrief:22`; Ausschlüsse `server.ts:15403`, `:15415`, `:15428`. |
| Program-MAIN | Rollenpräambel → Startschritte → bestätigter Program-Inhalt → Ausführungsschiene mit Rollen-/Türentrennung und Memory-Zeiger → Anker. Nachfolge trägt Program-Übergabe und weiterhin dieselbe Schiene. | 10; 11.993,5; 9.647–14.538 | `state.sh`, `register.sh`, Execution und Inbox werden tatsächlich gelesen; bei `2aa52f54:t4` scheitert die angenommene JSON-Form. `server.ts#buildProgramMainBrief:31681`, `#buildProgramMainSuccessionBrief:31942`, `#railBlockFor:31676`. |
| Orchestratorin | Rollenkarte → Startschritte → Portfolio-Memory-Zeiger → Anker; bei Nachfolge davor Verweis auf den Linien-Record und optionaler kurzer Carry. Ältere/manuelle Starts weichen ab. | 10; 3.238; 312–3.761 | `01a0cd2d:t12` liest `docs/controller.md`; andere Starts bleiben zunächst bei State/Register/Self. `server.ts#ORCHESTRATOR_ROLE_CARD:32050`, `#buildOrchestratorSpawnBrief:32066`, `#buildOrchestratorSuccessionBrief:32082`. |
| Supervisor | Rollenpräambel → Zuständigkeit, Verbote, Türen, Startschritte → Anker. Bindung einer schon laufenden Session liefert nur den Rollenrumpf, ohne neue Gründungsquittung. | 2; 2.304,5; 2.280–2.329 | Eigene Sicht und Nudge sind belegt; der Rückweg aus einer MAIN ist eine gesonderte Frage (`01a08638:t1`, Ausgangsmandat; weitere Auswertung Abschnitt 3). `server.ts#supervisorBriefBody:31990`, `#buildSupervisorBindBrief:32021`. |
| Steward | Konventioneller Auftrag beziehungsweise `/steward`-Ritual; kein gleichartiger universeller Rollenbrief. Das besondere Label kann beim Spawn zusätzlich ein Credential verleihen. | 1; 1.434 | `cc33526d:t1`: Advisor-Auftrag; Quellvertrag `docs/steward.md:95`; Credential-Zweig `server.ts:7496`. Rollenname und Berechtigung sind hier historisch gekoppelt. |
| Owner-Gespräch / gewöhnliche Session | Direkter Wunsch plus Harness-Umgebung; keine universelle ContextPlan-Zustellung aus dem bloßen Gespräch ableitbar. Generische Nachfolge verweist auf Lineage und Initialisierungsschritte. | 2; 1.472; 195–2.749 | Dialog mit dem Owner ist ein gültiger Rückweg (`27906641:t1`, `96fa7ada:t1`). Fehlende Fleet-Türen beweisen hier keinen Rollenfehler. Generische Nachfolge: `server.ts#buildSuccessionBrief:9827`. |

Die Bytewerte sind **erste Nutzer-Prompts der Stichprobe**, einschließlich vorhandener Zustellwrapper, ohne System-/Toolschema-Präfix. Sie sind keine isolierten Größen der genannten Builder und keine Rangliste effizienter Rollen.

**Was die einzelnen Schichten leisten:**

- `ContextPlan` prüft Verfügbarkeit, Status, Harness, Modus, Trigger und Fähigkeiten. Er liest keinen Auftrag semantisch und führt keine Wissenssuche aus. Die Dispatch-Konstanten sind `mutating` und `always, verification`; die beiden Repo-Packs verlangen `always`. `context-plan.ts#contextOmissionFor:84`, `#planContext:102`; `server.ts:15058`; `.fleet/context-packs.json:7`, `:26`. Der Schalter ist präzise, sein Input bleibt grob.
- Repo-Manifeste werden am angegebenen Commit geprüft; beobachtete Blob-Hashes versionieren die Quellen. Program-Packs kommen für die Lane hinzu, höchstens fünf Packs mit je vier Zeigern; abgeschlossene Programs liefern sie nicht weiter. Das ist Quellenkontrolle und Lebenszeitverwaltung. `context-manifest.ts#planRepoContext:77`, `#observedSourceHash:166`; `context-plan.ts:131`, `#planProgramContext:254`.
- Ein Anker liefert Pfad, Abschnitt und Verwendungszweck, keinen Abschnittsinhalt. Snippets liefern dagegen echte Quellbytes vom Lane-Commit: bis 8.192 Bytes, benannte Kürzungen/Auslassungen, höchstens 120 Zeilen pro Treffer vor weiteren Budgetgrenzen. `server.ts#renderContextAnchorBlock:15519`, `#laneSnippetBlock:15482`; `context-snippets.ts:29`, `#buildSnippetPackage:362`. Die Auslassung ist ehrlich; der Agent muss für das fehlende Funktionsende trotzdem lesen.
- Notizen werden über explizite Zuordnung oder gemeinsame Dateien gewählt. Die großen Sammeldateien sind aus dem automatischen Flächenjoin ausgeschlossen; fünf Vorschauen mit gekürztem ersten Satz sind kein Volltext. Angehefteter Überlauf bleibt über die Notiz-Tür erreichbar. `task-notes.ts#NOTE_HUB_FILES:10`, `#laneNoteSources:148`, `#renderNotesBlock:205`. Das erklärt, warum „steht auf derselben Codefläche“ kein universeller Themenrouter ist.
- Eine Quittung hält Auswahl, Auslassungen, Versionen und zugestellte Briefgröße fest. `memory?sources` unterscheidet heutige Deklaration von damaliger Zustellung und setzt `readByAgent` ausdrücklich auf `unknown`. `server.ts:15440`, `#memorySourcesView:3050`. Diese Zurückhaltung ist eine Stärke des Systems.
- Fleet-Memory ist eine begrenzte, berechtigte Projektion aus vorhandenen Trägern: Arbeit, Quellen, Evidenz, Beobachtungen, Portfolio. Es speichert keine neue allgemeine Lernerinnerung. Lane-Scope, Program-Bindung und Portfolio-Grant sind verschieden; ein Orchestrator-Label erteilt keinen Grant. `server.ts#memoryScopeFor:2878`, `#memoryWorkView:2986`, `#memoryPortfolioScope:3516`, Route `server.ts:38097`.

**Die vorgegebenen Zahlen, nachgemessen:**

| Ausgangsbehauptung | Befund und Nenner |
|---|---|
| Rund 69k Tokens vor dem ersten Lesen | Für 280 Claude-Worktree-Starts mit Lane-Briefmarker vom 10.–24.09.: Median **64.590**, min 53.681, max 83.426. Erste Assistant-Usage: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`; sie enthält bereits den Auftrag. Beispiele `49839901:t1` = 73.084 und `c379eda0:t1` = 60.651. Die historische 69.314 in `docs/messungen/2026-09-14-lane-startkontext-fixkosten.md:17` bleibt eine ältere Messung, kein aktueller Universalwert. Die neue Reihe fällt im Tagesmedian zwischen 14. und 15.09.; eine Ursache ist daraus nicht bewiesen. |
| Briefmedian etwa 10 KB | In derselben 280er Reihe: **9.667,5 UTF-8-Bytes** des ersten Prompts. Im engeren Siebentages-Ledger für 184 Fleet-Taskzustellungen: **11.656,5 Bytes**. Verschiedene Zeitfenster und Messobjekte; die Größenordnung stimmt. Ledger `context-receipts.jsonl:910–1206`. |
| 251/251 Fleet-Lanes dieselben vier Anker | Das aktuelle Fenster enthält **248 Fleet-Zustellungen**, davon 64 mit `briefSource=founding` und 184 Taskzustellungen. **223** tragen genau vier Packs, **25** zusätzlich das Program-Pack `grammatik`. Alle 248 teilen den Vierer-Sockel. „251 Lanes“ ist weder der aktuelle Nenner noch eine saubere Gleichsetzung von Zustellung und Lane. Ledger `:910–1206`. |
| 44/44 Fremdrepo-Lanes ohne Anker | Jetzt **49 Fremdrepo-Zustellungen** ohne ausgewähltes Pack, davon **42 Taskzustellungen** und sieben Foundings. Das ist eine Ledgerzählung; fremde Sessions/Dateien wurden dafür nicht gelesen. Kein Beleg, dass fremde Repos grundsätzlich keine Packs bekommen können: `context-manifest.ts#planRepoContext`. |
| MAIN bekommt 78 KB Regelbuch | **78.352 Bytes** im privaten Vollrender, bytegleich zum Render aller sieben aktuellen Fragmente. Lane-Körper aus drei Fragmenten: **20.648 Bytes**, ohne dynamischen Rückverweis. Das lokale `AGENTS.md` hat zusätzlich **31.496 Bytes**. Dateimessung und `rulebook.ts#FRAGMENTS_FOR:39`, `#renderRulebook:66`; Bytes werden hier nicht in Tokens umetikettiert. |
| Claude-Memory-Korrekturen erreichen GLM/Pi nie | Ein universelles „nie“ ist unbewiesen. Belegt ist: Der untersuchte Fleet-Memory-Reader importiert keine Claude-Feedbackdateien; seine Views lesen operative Träger. Automatischer Transfer persönlicher Korrekturen über Harnessgrenzen ist damit **nicht gebaut**. Manueller Brieftransport bleibt möglich. `server.ts:2851`, `#memoryWorkView:2986`, `#memoryPointer:3883`; Owner-Memory-Arbeit sichtbar in `27906641:t1`. GLM-Sessionwirkung wurde hier nicht direkt gemint. |

**Behauptung daneben, wörtlich:** `docs/tailored-context.md:17` nennt das Ziel „first-pass output reliable enough that review is cheap“; dieselbe Datei `:128` verspricht „reviewable-at-a-glance patch“. Die Zustellmechanik und dieses Mining beweisen weder billige Reviews noch die Zuverlässigkeit des ersten Versuchs. Die spätere Einschränkung in `docs/tailored-context.md:144` ist sauberer: „A functional land is not an effect“. `docs/knowledge-currency.md:82` sagt: „Conclusions rot; observations do not.“ Beobachtungen behalten ihren historischen Wahrheitswert; ihre Verwendbarkeit für den heutigen Slot, Baum oder Principal verlangt weiterhin Identität und Stand. Genau diese Grenzen trägt der neue Memory-Reader.

## 2. Befunde

Die Rangfolge bewertet den Schaden einer falschen Handlung vor bloßen Lesebytes. Kosten sind beobachtete Zusatzschritte oder benannte Risiken; vermiedene Tokens werden ohne Vergleichslauf nicht erfunden.

| Rang | Befund, Urteil und Beleg | Kosten für den Agenten; wem die Schicht dient |
|---|---|---|
| 1 | **Der Agent bekommt häufiger einen Titel als eine vollständig bedienbare Position.** Eine MAIN soll die Queue lesen und versucht die breite Route mit dem Self-Credential: `01a08013:t8`, erkannte 401 in `t9`. Eine Orchestratorin setzt den falschen Auth-Header (`01a0cd34:t4`, korrigiert `t8`); eine andere probiert Header und sucht danach den vorhandenen Wrapper (`913fca49:t5–t9`). Die Rollenkarte kann das richtige Mandat enthalten und dennoch die nächste Handlung unklar lassen. | Gescheiterte Reads, Auth-Recherche und Versuchung zum breiteren Zugriff. Der Titel hilft dem Owner beim Zuordnen; dem Agenten helfen erst Principal, konkrete Tür, Antwortform und Rückweg. |
| 2 | **Das Regelbuch ist teilweise ein Archiv im Imperativ.** `rulebook/self-scheduling.md:28` fordert vor Idle einen Check-in; `server.ts#laneExitFooter:15124` verlangt nach dem Report Idle ohne Check-in. `rulebook/einstieg.md:31` behauptet fehlenden eingehenden Kanal; die Program-Schiene beschreibt automatische Reports und die durable Inbox (`server.ts:31540`, `:31576`). Die Vorrangregel löst die Autoritätsfrage, lässt aber beide Handlungsimpulse im Kontext stehen. | Der Agent muss Widersprüche selbst adjudizieren; falsche Wahl erzeugt Polling oder Warten am falschen Kanal. Diese alten Absicherungen dienen inzwischen auch dem Gewissen der Vorgänger-Session. Ihr Fortbestand ist keine zusätzliche Sicherheit. |
| 3 | **„Tailored“ bezeichnet überwiegend den Auftrag, kaum die Pack-Auswahl.** Gleiche Trigger an der Zustellnaht; gleicher Vierer-Sockel in 248/248 aktuellen Fleet-Zustellungen. Das zusätzliche Program-Pack in 25 Fällen ist eine reale Verbesserung. `server.ts:15058`, `context-receipts.jsonl:910–1206`. | Generische Hinweise beanspruchen Aufmerksamkeit, während Auth-/Schemaarbeit erneut anfällt. Die Quittierung dient der Nachweisbarkeit für Betreiber und Owner; sie wird zur Selbstbeschäftigung, sobald Auswahlzählung als Wirksamkeitsbeweis verkauft wird. |
| 4 | **Stabile Bedeutung fehlt gerade an den kleinen Nähten.** `aad2e865:t1` behandelt eine gelieferte Achtzeichen-ID als Commit; `t2` korrigiert zu vermutlich Queue-ID. `2aa52f54:t4` adressiert eine Array-Projektion wie ein Objekt; danach wird die tatsächliche Form gelesen. `01a08f94:t7` greift auf einen nicht vorhandenen Wissenspfad zu. | Zusätzliche Git-/Schema-/Pfadsuche vor Facharbeit. Ein typisierter Bezeichner und ein kleines gültiges Antwortbeispiel wären billiger als der nächste Grundlagenabsatz. Quellenumfang allein behebt keine falsche Referenzart. |
| 5 | **Konkrete Arbeitsquellen sind nützlicher belegt als allgemeine Anker.** Worker öffnen die genannten Implementierungs- und Prüfflächen, etwa `1458c892:t1` und `0e5fd7b1:t1–t3`. In der Orchestrator-Stichprobe stehen acht Starts mit dem Vierer-Sockel; die Initiallektüre konzentriert sich auf State/Register/Self. Ein tatsächlicher Gegenbeleg gegen „liest niemand“ ist `01a0cd2d:t12`, das die Rollenlangfassung öffnet. | Die Hypothese „präziser Zeiger spart Suche“ hat einen beobachteten Gebrauchspfad. Die Hypothese „mehr allgemeine Pflichtlektüre hilft“ hat hier keinen entsprechenden Wirksamkeitsnachweis. Nicht erneut geöffnete, schon injizierte Regeln dürfen dabei nicht als ungelesen gelten. |
| 6 | **Die größere Startlast liegt außerhalb des einzelnen Briefs.** 64.590 Input-Tokens Median gegenüber 9.667,5 Prompt-Bytes sind verschiedene Einheiten, aber schon die Trennung der Träger widerlegt die Gleichsetzung Brief = Startkontext. Der Vollrender umfasst 78.352 Bytes; der Worker-Render ist bereits erheblich kleiner (`rulebook.ts#FRAGMENTS_FOR:39`; Usage-Reihe in Abschnitt 1). | Nur den Auftrag zu kürzen kann die System-/Werkzeug-/Regellast nicht beseitigen. Blindes Kürzen entfernt womöglich die einzige genaue Fläche, während die allgemeinen Wiederholungen bleiben. Ein Profil braucht ein gemessenes Ladebudget je Harness. |
| 7 | **Die Nachfolge bewahrt Erzählung zuverlässiger als identische Kontextversorgung.** `server.ts#buildLaneSuccessionBrief:10159` trägt Auftrag, Commitliste, sauberen Baum, Report und Memory-Zeiger, aber keinen ContextPlan-Block. Der Pointer auf `sources` ist eine Lesemöglichkeit; er stellt die Anker nicht erneut zu. | Eine frische Session muss frühere Quellen wiederfinden. Blindes Kopieren des alten Pakets hätte dagegen Versionskosten. Benötigt wird eine frische Quellenentscheidung mit Herkunft, keine immer längere Übergabe. |
| 8 | **Es gibt mehrere Gedächtnisse und keinen gemeinsamen Begriff dafür.** Operativer Memory-Reader, Claude-Feedbackdateien, Program-/Rollen-Lineage und Dokumentationsnotizen haben verschiedene Writer und Leser. `server.ts#memoryWorkView:2988`, `#buildSuccessionBrief:9827`; `27906641:t1`; `docs/steward.md:117`. | Wer diese Speicher zusammen benennt, verspricht implizit Transfer und Lernen, die ein Zustandsreader nicht leistet. Eine weitere Synthesenotiz ohne abgeräumte Quelle dient vor allem ihrer eigenen Fortsetzung. Ein Index ist sinnvoll; eine unendliche Pflichtleseliste ist ein Ritual. |

**Schnittlinie:** Befunde 1–5 begründen den nächsten Eingriff. Befunde 6–8 bestimmen dessen Budget und Grenzen; sie rechtfertigen jetzt weder eine globale Gedächtnisplattform noch einen Komplettumbau aller Rollen.

## 3. Was ein Agent in Claude Fleet wirklich braucht

**Das minimale Lagebild ist ein Arbeitsvertrag in Gegenwartsform.** Meine Ableitung aus den Türfehlern (`01a08013:t8`, `01a0cd34:t4`), der funktionierenden konkreten Quellenarbeit (`1458c892:t1`) und den bereits gebauten Bindungen (`AGENTS.md:44`, `server.ts#memoryScopeFor:2878`): Beim Start müssen Aufgabe, ausführbare Befugnis und Ergebnisempfänger zusammen sichtbar sein. Das ist kein auswendig zu lernendes Organigramm.

| Rolle | Minimaler Inhalt bei Start und Nachfolge |
|---|---|
| Worker | Eigene Task-/Program-/Repo-Bindung und Schreibfläche; beauftragende MAIN oder ausdrücklich anderer Empfänger; Nachbararbeit nur bei gemeinsamer Fläche/Abhängigkeit; zulässige Self-Türen samt Auth; Verify und Stopplinie; Report-Empfänger und belegter Empfangsweg; Land/Deploy bleiben gesonderte Akte. |
| Clarify | „Ich kläre einen vorgeschlagenen Auftrag“; welche Fakten selbst zu ermitteln sind; Criterion-Tür; wer bestätigen darf; wo Rückfragen und Antwort ankommen; bis zur Bestätigung kein Implementierungsmandat. |
| Program-MAIN | Genau welches bestätigte Program gehört mir; Owner-Grenzen; eigene reversible Akte versus isolierte Worker; Task-Filing/Release/Execution/Inbox; aktive Nachbarn mit gemeinsamer Fläche; Integrationsrecht mit Voraussetzung; was nach dem letzten Report noch geschuldet ist. |
| Orchestratorin | Portfolio-Mandat, erreichbare Programs und tatsächlicher Read-Grant; benannte MAINs als Eigentümer ihrer Programs; eigene Filing-/Klärungsrechte; Owner als Entscheidungsadressat; kein aus dem Label erfundenes Land- oder Attention-Recht. |
| Supervisor | Beobachtungsauftrag mit Endereignis; Scope seiner Sicht; adressierbare MAIN und Nudge-Tür; Empfänger der Beobachtung; fehlender Owner-Sendekanal ausdrücklich; keine Umdeutung von Schweigen in Erfolg. |
| Steward | Beratungsauftrag und Empfänger; ob nur Gesprächskonvention oder tatsächlicher Steward-Principal; welche Wissenspflege autorisiert ist; keine angenommene Oberaufsicht über MAINs. |
| Owner-Gespräch | Gegenstand und gewünschter Modus; unmittelbarer Dialog als Rückweg; nur bei tatsächlicher Fleet-Bedienung die betreffende Bindung und Tür ergänzen. Eine ungebundene Unterhaltung braucht keine erfundene Hierarchie. |

Das Server-Lagebild sollte vorhandene Quellen zusammenführen: Identität aus `GET /api/self`, Arbeit aus `memory?view=work`, Befugnis aus der vorhandenen Rolle/Execution-Projektion, offene Pflichten aus Inbox/Lineage. Es soll Quelle und Unbekanntes nennen. **Kein Startquiz und kein zusätzlicher Bericht vor der Arbeit.** Die dazu nötigen Reader existieren teilweise bereits (`server.ts#memoryWorkView:2988`, `#supervisorBriefBody:31990`, `#RAIL_HEAD:31388`); die vorgeschlagene Zusammenführung ist ein Entwurf.

**Pack-Kandidaten aus beobachteter Nachfrage.** „Belegzahl“ zählt die unten ausdrücklich benannten Sessions als Untergrenze, keine globale Häufigkeit. Ersparnis heißt jeweils vermeidbare Sucharbeit; eine kausale Tokenersparnis ist unbekannt.

| Kandidat / Auslöser | Inhalt als Zeiger | Belegzahl und Beispiele | Was er gespart hätte |
|---|---|---|---|
| Rolle + erste funktionierende Tür; jeder rollenbezogene Start | `AGENTS.md` Rollenvertrag; `docs/self-api.md` passender Principal; vorhandener Wrapper oder ein korrektes Minimalbeispiel | ≥4: `01a08013:t8`, `01a0cd34:t4`, `d181d654:t3`, `913fca49:t5` | Falsche Route, Header und Wrapper-Aufrufe; keine neue breite Credential-Suche. |
| Form der zu lesenden Projektion; erste Execution-/Inbox-Abfrage | `server.ts#programExecutionView`, `#memoryWorkView`, konkrete Schemafelder und Version | ≥1 direkt geprüfter Fehler: `2aa52f54:t4` | Array-/Objekt-Raten und anschließende Schemaerkundung; der Fehlgriff verlangt ein kurzes Beispiel, keine Voll-API-Lektüre. |
| Wirkliche Änderungsnaht; Karte nennt Dateien/Symbole | `context-snippets.ts#planSnippets`, plus exakte Funktion und zugehöriger Check am Arbeitscommit | ≥3: `1458c892:t1`, `0e5fd7b1:t3`, `01a0cf25:t11` | Symbolsuche und Suche nach dem passenden Beweis; abgeschnittene Funktionen weiterhin explizit nachlesen. |
| Verify-/Suite-Betrieb; Suite-, Lock- oder Land-Änderung | `AGENTS.md` Verify; `docs/verify-tiering.md`; konkrete Fixture-/Lock-/Offer-Symbole | ≥3: `1458c892`, `d8282135`, `477b39b4`, jeweils erste 20 Calls | Suche nach Prüflauf-Eigentümer, Fixture-Erzeugung und Sperrmechanik. Das ist ein aufgabenbezogener Ausschnitt des vorhandenen Verify-Packs. |
| Nachfolgepflichten; tatsächliche Nachfolge | `GET /api/self` Lineage, Program-Inbox, referenzierte Entscheidung und lebende Quellen | ≥3: `748c2980`, `38960693`, `01a0cd34`, jeweils erste 20 Calls | Rekonstruktion von Absicht und offenem Rückweg; historische Zustandskopien können entfallen. |
| Quellenort und Bezeichnertyp; erster Zugriff auf lokale Hilfen oder historische IDs | Wissensindex-Verweis im portablen Vertrag; ID als `task`, `report` oder `commit`; aktuelle Host-Hilfe nur bei Bedarf | ≥2 direkt geprüft: `01a08f94:t7`, `aad2e865:t1` | Toter Wissenspfad und Commit-Suche nach einer Queue-ID. |
| Promovierte Arbeitspräferenz; taskrelevante Owner-Korrektur | Kuratierter, harnessunabhängig lesbarer Entscheidungszeiger mit Scope, Herkunft und ersetzter Fassung | ≥1 Bedarfsspur: `27906641:t1`; kein beobachteter Cross-Harness-Effekt | Könnte Wiederholung schon entschiedener Arbeitspräferenzen sparen. **Experiment**, kein aus einem Memory-Dateinamen abgeleiteter Automatismus. |

**Anti-Packs:** Der automatische `rulebook-generat`-Hinweis bei jeder gewöhnlichen Lese-/Schreibaufgabe und der automatische Messnotiz-Index bei jeder solchen Aufgabe passen nicht zu ihren eigenen „Bevor du …“-Auslösern (`.fleet/context-packs.json:4`, `:7`, `:23`, `:26`). In den acht Orchestrator-Starts mit Vierer-Sockel ist in den ersten 20 Calls kein Öffnen von `rulebook.ts` oder `docs/messungen/INDEX.md` belegt (`748c2980`, `da90e4cc`, `7e09d1e3`, `38960693`, `d181d654`, `913fca49`, `01a0cd34`, `01a0cd2d`). Das ist „geliefert, im Fenster nicht geöffnet“, kein Beweis für lebenslange Nichtnutzung. `portable-core` ist wegen automatischer Regelinjektion ausdrücklich **kein** auf diese Weise bewiesenes Anti-Pack. Notizvorschauen ohne Volltextöffnung sind ebenfalls kein Nullnutzen-Beweis: bereits die Vorschau kann genügen (`task-notes.ts#renderNotesBlock:205`).

**Agentische Diskussionen brauchen einen gemeinsamen Gegenstand und verschiedene Aufgaben.** Der folgende Entwurf folgt aus dem Rollenvertrag und der tatsächlich sichtbaren Unterworker-Zusammenarbeit (`01a09f16:t12`, `01a09c0f:t12`), nicht aus dem Glauben, dass mehr Agenten automatisch gründlicher denken:

1. Die zuständige MAIN oder beauftragte Synthese-Session hält **eine Entscheidungsfrage**, den betroffenen Stand, Optionen und die Abnahme. Der Owner entscheidet Scope-/Promotion-/Geschmacksgrenzen; technische Feststellungen bleiben prüfbar. Kein zweiter Koordinator aus einem Modellnamen.
2. Alle Beteiligten erhalten denselben schmalen Faktkern: Frage, Begriffe, Grenzen, Quelle/Version und Endsignal. Fachleser erhalten ihren disjunkten Ausschnitt; ein unabhängiger Kritiker erhält Beweisgegenstand und Kriterien. Er braucht die Lieblingsantwort des Produzenten nicht. Ein sensorischer Kritiker bleibt gemäß `AGENTS.md:105` strikt bei seinem gesonderten Beweispaket.
3. Ein Worker diskutiert über den Rückweg seines tatsächlichen Mandats: gebundene Lane → Clarification/Report zur MAIN; Harness-Unterworker → Elternsession; Supervisor → Nudge. Das sind verschiedene Kanäle. Die Lane besitzt keinen allgemeinen Peer-Diskussionsbus (`AGENTS.md:56`; `server.ts#supervisorBriefBody:31990`). Wo kein adressierter Rückweg besteht, muss der Auftraggeber einen Vermittler benennen.
4. Eine Gegenlese liefert Behauptung, Gegenbeleg und Entscheidungsfolge; eine Antwort löst den Widerspruch oder nennt die fehlende Beobachtung. Ein Prüfkommando entscheidet, was es messen kann. Ein Modellkonsens ist keine weitere Prüfstufe.
5. Haltbar bleibt eine Entscheidung mit Eigentümer, Gründen, verworfener Alternative, Geltungsbereich und Quellenstand. Offene Frage/Empfänger leben in der bestehenden Aufgabe oder Inbox; der nächste Brief zeigt darauf. Status wird aus dem Reader geholt. Kein Protokoll aller Wortwechsel im Startkontext.

So dient Diskussion der Entscheidung. Drei lange Stellungnahmen plus eine vierte Zusammenfassung ohne veränderte Entscheidung sind Selbstbeschäftigung; dieser Entwurf verlangt deshalb ein Ende und einen Eigentümer.

## 4. Namen

Die rechte Spalte ist ein Benennungsvorschlag. Sie verleiht keine neue Befugnis und verlangt keine API-Massenumbenennung.

| Heutiger Name | Was es wirklich ist | Wie es heißen müsste | Warum / Beleg |
|---|---|---|---|
| Brief | Auftragsprosa und eine darüber hinaus angereicherte Zustellung | **Arbeitsauftrag** / **Startzustellung** getrennt | `server.ts#briefAndSend:15164` verarbeitet verschiedene Byte-Träger. |
| Karte | Validierte Felder für Fläche, Ergebnis und Prüfung | **Auftragsvertrag** | `card-extract.ts#FORMAT_KEYS:474`; formal gültig bedeutet noch keine gute Absicht oder richtige Lösung. |
| Rollenkarte | Text über Zuständigkeit, Grenzen und Türen | **Rollenmandat** | `server.ts#ORCHESTRATOR_ROLE_CARD:32050`; Text und technische Bindung sind verschieden. |
| Schiene / Rail | Verfahrensbeschreibung vorhandener Türen | **Bedienfolge** | `server.ts#RAIL_TAIL:31526`; der Text führt nichts aus. |
| ContextPlan | Deterministisches Auswahl-/Auslassungsergebnis | **Quellenauswahl** | `context-plan.ts#planContext:100`; kein semantischer Arbeitsplan. |
| Anker | Pfad plus Abschnitt/Symbol | **Quellenzeiger** | `server.ts#renderContextAnchorBlock:15519`; keine Quelle im Volltext. |
| Pack | Benannte Gruppe von Zeigern und Auswahlmetadaten | **Quellenprofil** | `context-packs.ts:48`; unterscheidbar vom folgenden echten Textpaket. |
| Quellpaket / Snippet | Versionsgebundene, begrenzte Quellenausschnitte | **Quellenauszug** | `context-snippets.ts#buildSnippetPackage:362`; hat Inhaltsbytes und Kürzungsgrenzen. |
| portable-core | Zeiger auf den bindenden portablen Betriebsvertrag | **Betriebsvertrag** | `context-packs.ts:91`, `AGENTS.md:24`; „core“ benennt weder Pflichten noch Ladeweg. |
| Datenschicht | Je nach Fall Writer, Ledger, Projektion oder UI-Aggregation | **Quellvertrag**, jeweils mit Writer und Leser | `server.ts#memoryWorkView:2988`; gleiche Tabellenoptik bedeutet keine gleiche Herkunft. |
| Receipt | Protokollierte Zustellauswahl mit Provenienz | **Zustellquittung** | `server.ts:15440`; kein Lesebeleg und kein Verstehensbeleg. |
| Memory / Gedächtnis | Hier: aktuelle Arbeit plus abrufbare Beleggeschichte; andernorts: persönliche Korrekturen | **Arbeitsstand**, **Belegarchiv**, **Arbeitspräferenzen** | `server.ts:2851`, `27906641:t1`; drei verschiedene Pflege- und Autoritätsprobleme. |
| Lineage / Übergabe | Identitätsgebundene Nachfolge mit offenen Pflichten und knapper Absicht | **Nachfolgerecord** | `server.ts#buildSuccessionBrief:9827`; besitzt Lebenszeit und Empfänger. |
| Regelbuch | Privater, zielgruppenabhängiger Render aus Regel- und Betriebsgeschichte | **Betriebsanweisungen + Archiv** | `rulebook.ts#FRAGMENTS_FOR:39`; die beiden Teile sollten verschiedene Ladewege haben. |
| Orchestratorin / Controller | Portfolio-Funktion, teils über Label erkannt, ohne eigene Program-Bindung | **Portfolio-Koordination** | `server.ts#isOrchestratorLabel:32063`, `docs/controller.md:20`; Label erteilt keine Owner-Rechte. |
| Steward | Beratungskonvention mit historisch besonderem Credential | **Beratung**, Principal gesondert benennen | `docs/steward.md:6`, `server.ts:7496`; Funktion und Credential auseinanderhalten. |

## 5. Konsequenz

Die drei Folgeprogramme sollten denselben kleinen Vertrag konsumieren: **Rolle/Befugnis**, **gewählter Arbeitskontext**, **lesbarer Zustand** sind unabhängig. Ein Session-Profil darf diese Achsen konfigurieren; ein Modellwechsel darf keine Zuständigkeit ändern. Gedächtnis liefert Fakten und promovierte Korrekturen mit Herkunft; der Brief nennt, welche davon für den aktuellen Akt gelten. Ableitung aus Abschnitt 2, insbesondere den Auth-Fehlern und `server.ts#memoryPortfolioScope:3520`.

| Rang | Schnitt | Konkrete Abnahme | Kosten, wenn er unterbleibt |
|---|---|---|---|
| 1 | **Bauen:** ein kurzes gegenwärtiges Lagebild an der Start-/Nachfolgenaht, aus vorhandenen Bindungen | Worker, Clarify, MAIN, Portfolio und Supervisor können eigene Fläche, Entscheider, erste Tür, Empfänger und Endsignal aus genau einer konsistenten Zustellung bestimmen; fehlende Bindung bleibt `unknown`. | Titel statt bedienbarer Position; fortgesetzte Routen- und Empfängersuche. Belege: Abschnitt 2, Rang 1. |
| 2 | **Streichen:** widersprechende Warte-/Check-in-Imperative und erledigte Reparaturgeschichte aus Pflichtlektüre | Pro Rolle genau eine gültige Regel für Warten und Rückkehr; ältere Begründung bleibt auffindbar außerhalb des Startkerns. | Agent muss eigene Betriebsanweisungen gegeneinander auslegen. Beleg: `rulebook/self-scheduling.md:28` gegen `server.ts#laneExitFooter:15124`. |
| 3 | **Behalten und zuspitzen:** technische Bedienhilfe je benötigter Tür | Ein korrekt authentifizierter Beispielread samt kleiner Antwortform; falscher Principal hat eine benannte Alternative oder echte Grenze. | Wiederholte 401-, Header- und Schemafehler. Belege: `01a08013:t8`, `01a0cd34:t4`, `2aa52f54:t4`. |
| 4 | **Bauen / streichen:** Pack-Auswahl am Akt ausrichten, konkrete Quellenauszüge erhalten | `rulebook-generat` nur bei Regelbucharbeit; Index nur bei Recherche/Messung; klar benannte Datei-/Rollen-/Akt-Auslöser mit Negativfall. Pilot misst Suchcalls bis Arbeit und Fehler, nicht bloß Auswahlquote. | Vierer-Sockel bleibt Beschäftigung mit Kontext statt gezielter Hilfe. Belege: `.fleet/context-packs.json:7`, `:26`; Ledger `:910–1206`. |
| 5 | **Bauen:** Nachfolge erneuert die Quellenentscheidung und nennt offenen Rückweg | Neuer Stand, weiterhin relevante Quellen, erledigte Pflichten entfernt; keine Kopie alter Statussummen. Nachfolge ohne Pack wird ausdrücklich sichtbar. | Wiederfinden oder Weitertragen veralteter Quellen; Fall `server.ts#buildLaneSuccessionBrief:10159`. |
| 6 | **Behalten:** Memory als begrenzte Faktenprojektion; Arbeitspräferenzen separat entwerfen | Kein Autoimport ungeprüfter Claude-Erinnerungen; jede übertragene Korrektur hat Scope, Entscheider, Version und Leser. | Entweder wiederholte Owner-Korrektur oder unbeabsichtigte Verallgemeinerung persönlicher Erinnerungen. `server.ts:2851`, `27906641:t1`. |
| 7 | **Bauen, nach dem Pilot:** Session-Profil als Kombination aus Executor, Ladebudget und Quellenwahl | Dieselbe Rollenbefugnis auf mindestens zwei Harnesses; anderes Modell verändert keine Tür; beobachtete Startlast und unbekannte Posten sichtbar. | Klassenmetaphern überdecken das eigentliche Kompatibilitätsproblem. Belege: Usage-Reihe, `rulebook.ts#FRAGMENTS_FOR:39`, `memoryPortfolioScope`. |
| 8 | **Streichen:** weitere Bestandsnotiz ohne benannten ersetzten Text oder entschiedenen nächsten Akt | Neue Kontextarbeit benennt, welche Pflichtlektüre, Kopie oder offene Entscheidung danach entfällt. | Die Nachfolger lesen Messgeschichte, um dieselbe Frage wieder zu stellen. Historischer Anspruch gegen heutigen Code: `docs/tailored-context.md:103`, `server.ts#briefAndSend:15164`. |

**Schnittlinie nach Rang 5.** Das ist die erste umsetzbare Welle. Darunter bleiben Entwurf beziehungsweise anschließender Pilot; kein neues RAG, keine universelle Rollen-Registry und keine verdeckte automatische Promotion. Ein ergebnisloser Pilot streicht die Auswahlregel, statt eine weitere Metadatenschicht zu verlangen.

**Urteil über die acht offenen Zeilen.** Gelesen wurden die aktuellen Zeilentexte in `fleet.json`, dann die jeweils genannte Codefläche; diese Tabelle ist Empfehlung, keine Statusänderung.

| Zeile | Urteil | Begründung |
|---|---|---|
| `6bd2e49c` | **ändern** | Den breiten Rollen-/Brief-Neuentwurf auf den Lagebildvertrag und zwei unabhängige Gegenentwürfe begrenzen; Zustelltexte erst nach der Entscheidung vereinheitlichen, statt alle MDs gleichzeitig umzuschreiben (`AGENTS.md:44`, `server.ts#ORCHESTRATOR_ROLE_CARD:32050`). |
| `8b2baf60` | **ändern** | `VERBOTEN` ist in `card-extract.ts#FORMAT_KEYS:474` bereits vorhanden, `DELEGATION` fehlt; den überholten Parserteil entfernen und Delegationsmessung mit explizitem Unknown für nicht instrumentierte Harnesses verlangen. |
| `fa07734f` | **obsolet in dieser Form** | Ein Schattenregister „kopf/hand/urteil/form“ ohne geänderten Spawn beantwortet keinen beobachteten Positionsfehler; das kommende Session-Profil soll Executor-Eigenschaften ausdrücklich führen, ohne eine zusätzliche Rollenmetapher zu promovieren (`card-extract.ts:474`, Auth-Fälle in Abschnitt 2). |
| `3d5ee33f` | **ändern** | Eine frei kombinierbare Owner-Workbench ist ein eigener UI-Wunsch; für Agenten zuerst bestehende Program-/Memory-Projektionen und den Repo-Verlust reparieren, statt dieselben Fakten nochmals in einer neuen Route zusammenzuführen (`server.ts#programStatusView:12409`, `#memoryWorkView:2986`). |
| `6ec7ab69` | **ändern** | Aufgabenbezogene Auswahl bleibt sinnvoll, aber zuerst wenige beobachtbare Auslöser statt Tag-/RAG-Allgemeinbau; „Karte passt zum Program“ bleibt ein belegtes Urteil und darf aus einem Pack-Treffer keine Befugnis ableiten (`context-plan.ts#contextOmissionFor:84`, `#planProgramContext:254`). |
| `bc093267` | **bleibt** | `programStatusView` reduziert die Program-Lands noch auf einen jüngsten Eintrag über Repos hinweg und gibt bei fehlendem Deploy-Sensor `null`; der benannte Repo-Split behebt einen konkreten Informationsverlust (`server.ts:12429`, `:12470`). |
| `8292e2f7` | **bleibt** | Das Repo-Blatt hat einen klaren Owner-Leser und kann vorhandene Quellen mit Herkunft zusammenführen; es bleibt nach dem Repo-Split ein UI-Schnitt, kein Ersatz für den Rollenstart oder eine neue Primärtabelle (`server.ts#programStatusView:12409`; Zeilentext `8292e2f7`). |
| `c0d7d068` | **bleibt** | Der aktuelle Lane-Nachfolge-Builder enthält weiterhin keinen Ankerblock; die inzwischen vorhandene Sources-Lesetür mindert den Verlust, erledigt die Zustelllücke aber nicht (`server.ts#buildLaneSuccessionBrief:10159`). |

## 6. Nicht geprüft, dazu die Abdeckungstabelle des Minings

**Abdeckung:** fünf voneinander getrennte Zehnerlisten, fünf Miner desselben beauftragten Modells, 50 verschiedene Sessiondateien, sieben Rollenkategorien und drei Harnesses. Rollen wurden aus dem anfänglichen Mandat klassifiziert: spätere Umsetzung macht einen Clarify-Start nicht rückwirkend zum Worker; Delegation macht einen Forschungsworker nicht zur Orchestratorin. Die Tabelle zählt die Anfänge.

| Rolle | Claude | Codex | Pi | Gesamt |
|---|---:|---:|---:|---:|
| worker-lane | 9 | 9 | 0 | 18 |
| clarify-lane | 4 | 1 | 2 | 7 |
| program-main | 7 | 3 | 0 | 10 |
| orchestratorin | 8 | 2 | 0 | 10 |
| steward | 1 | 0 | 0 | 1 |
| supervisor | 1 | 1 | 0 | 2 |
| owner-gespraech | 2 | 0 | 0 | 2 |
| **Gesamt** | **32** | **16** | **2** | **50** |

Drei Codex-Worker sind Unterworker mit geerbtem Elternverlauf (`01a0b004`, `01a09f16`, `01a09c0f`, jeweils Session-Metadaten vor `t1`). Die Stichprobe enthält deshalb **47 Top-Level-Sessions plus drei ergänzende Unterworker**, keine 50 unabhängigen Fleet-Gründungen. Die 280er Usage-Reihe ist eine zusätzliche mechanische Messung, kein Ersatz für semantisch geminte Sessions. 42 Sessions beginnen im Fenster 10.–24.09., acht früher. Die zwei Pi-Clarify-Sessions stammen vom 11.08.; weitere seltene Rollen und Codex-MAINs sind ebenfalls älter als das bevorzugte Zweiwochenfenster. Eine aktuelle Pi-/GLM-Paritätsquote wäre daraus unzulässig.

**Nachprüfbare Sessionliste:**

| Teilkorpus | Sessionpräfixe |
|---|---|
| Claude-Arbeit | `4af5eae3`, `aad2e865`, `10002a91`, `0e5fd7b1`, `477b39b4`, `d8282135`, `fa53bf63`, `1458c892`, `05768abd`, `4dc372ad` |
| Codex-Arbeit | `01a0cf25`, `01a0cd58`, `01a0ca5a`, `01a0b004`, `01a0a6e6`, `01a0a5f9`, `01a0a18e`, `01a09f16`, `01a09c0f`, `01a08f94` |
| MAIN | `2aa52f54`, `92fb7e8a`, `96d8404f`, `4be713ae`, `ac3036a1`, `0b112219`, `40f32a97`, `01a08013`, `01a07b09`, `01a0535e` |
| Portfolio | `748c2980`, `da90e4cc`, `7e09d1e3`, `28b04658`, `38960693`, `d181d654`, `913fca49`, `6038868f`, `01a0cd34`, `01a0cd2d` |
| Seltene Rollen / Dialog | `bb49be0b`, `a7474c2b`, `22aa6ba3`, `fc0b8d56`, `f67c348c`, `01a08638`, `15f90eb4`, `cc33526d`, `27906641`, `96fa7ada` |

Pro Session wurden die ersten bis zu 20 Tool-Aufrufe untersucht: Ziele und Briefnennung, gelieferte/geöffnete Quellen, sichtbare Fehlgriffe, vermeidbare Rückfragen, Position und Orientierung. Ein gebündelter Tool-Aufruf kann mehrere Dateien/Routes lesen. Insgesamt umfasst dieses Fenster **975 äußere Tool-Aufrufe**, keine 975 Dateilesungen. Claude-Turns zählen unterschiedliche Assistant-Message-IDs, Codex-Turns emittierte Assistant-Items einschließlich Tool-Calls, Pi-Turns Assistant-Nachrichten. Diese Turns sind präzise Fundstellen innerhalb eines Harnesses, aber keine faire harnessübergreifende Geschwindigkeitsmetrik.

**Orientierung bis zur Arbeit:** Über das 20-Call-Suchfenster hinaus wurde ein konkreter produktiver Akt beziehungsweise eine fachliche Antwort gesucht. Ein vorgeschriebener State-Read zählt dafür nicht. 49 Sessions haben einen annotierten Arbeitspunkt; `01a07b09` bleibt als kurzer Verlauf ohne belegtes Ergebnis unbekannt. 48 Werte stammen aus Provider-Usage am beziehungsweise unmittelbar nach dem betreffenden Assistant-Turn. Bei Claude ist es die Summe aus Input und beiden Cache-Inputarten; bei Codex der Inputwert des nächsten Usage-Ereignisses, bei Pi Input plus Cache-Read/-Write. Sie messen **Kontext am Arbeitspunkt einschließlich Startlast**, keinen inkrementellen Verbrauch und keine ausschließlich unproduktive Zeit. Fachliche Zwischenbefunde können früher liegen; die Aktgrenze ist eine manuelle Annotation, kein automatisch bewiesenes Minimum.

| Belegter Arbeitspunkt | Turn | Ungefährer Kontextumfang in Tokens | Was sichtbar ist |
|---|---:|---:|---|
| `1458c892` | 12 | 118.962 | Erster annotierter Server-Edit nach Lock-/Prüfpfadlektüre |
| `01a0cf25` | 11 | 91.204 | Repo-Patch nach Quellen-/Gate-Arbeit |
| `10002a91` | 51 | 213.198 | Schreiben der geforderten Messnotiz |
| `01a0cd58` | 6 | 63.241 | Konkreter Clarify-Befund; Criterion-Einreichung danach |
| `bb49be0b` | 31 | 144.233 | Kriteriumsbericht vor späterer Implementierung |
| `fc0b8d56` | 9 | 133.838 | Pi meldet die gespeicherte Criterion-Proposal |
| `40f32a97` | 11 | 160.557 | MAIN-Release im Arbeitsablauf |
| `748c2980` | 18 | 128.419 | Portfolio-Session filet eine Aufgabe |
| `15f90eb4` | 11 | 107.454 | Supervisor formuliert sein begrenztes Lageurteil |
| `cc33526d` | 25 | 203.411 | Steward liefert die beauftragte Bewertung |
| `27906641` | 10 | 107.003 | Inventar als erste ausgewertete Owner-Antwort |

Für `01a08638:t42` liegt nur ein **5.755-Token-Textproxy** vor: 23.017 Bytes sichtbarer Assistant-Texte und Tool-Argumente geteilt durch vier, ohne Tool-Ergebnisse und Systempräfix. Er ist mit der Tabelle nicht vergleichbar. Keine rollenübergreifende Median- oder Einsparzahl wird daraus gebildet. Das Ergebnis ist trotzdem relevant: Ein relativ kleiner Gründungsbrief kann vor dem ersten belastbaren Artefakt in einen sehr großen Kontext münden; welches Lesen vermeidbar war, muss der vorgeschlagene Pilot entscheiden.

**Gegenprüfung der Miner:** Je Teilkorpus wurden zwei Bytewerte erneut direkt aus dem ersten inhaltlichen Nutzerprompt der Quelldatei berechnet. Alle zehn stimmen; System-/AGENTS-Injektion ist ausgeschlossen, Zustellwrapper bleibt enthalten.

| Teilkorpus | Erster Quellwert | Zweiter Quellwert | Urteil |
|---|---|---|---|
| 1 | `4af5eae3` = 15.389 B | `aad2e865` = 7.245 B | beide gleich |
| 2 | `01a0cf25` = 15.768 B | `01a0ca5a` = 21.225 B | beide gleich |
| 3 | `2aa52f54` = 13.942 B | `01a0535e` = 9.647 B | beide gleich |
| 4 | `748c2980` = 3.761 B | `01a0cd34` = 3.243 B | beide gleich |
| 5 | `bb49be0b` = 5.351 B | `fc0b8d56` = 5.084 B | beide gleich |

Zusätzlich wurden zentrale Fehlgriffe am Originalereignis gegengeprüft: Queue-ID als Commit (`aad2e865:t1–t2`), toter Wissenspfad (`01a08f94:t7`), falsche Projektion (`2aa52f54:t4`), falsche Queue-Tür (`01a08013:t8–t9`) und Auth-Header (`01a0cd34:t4`, `t8`). Das ist keine unabhängige Zweitannotation aller 50 Sessions. Die JSONL-Auswertungen liegen absichtlich außerhalb des öffentlichen Repos; diese Notiz trägt nur scrubbare Quellenpräfixe und Befunde.

**Nicht geprüft / Grenzen:**

- Kein randomisierter Vergleich mit/ohne Packs, kein Beweis vermiedener Fehler, kein Reviewzeit- oder Kostenexperiment. Eine Suchhandlung kann notwendige Aktualisierung sein. Fehlerursache bleibt unbekannt, wenn nur ein Fehler sichtbar ist.
- Sichtbare Dateiöffnung beweist kein Verständnis. Ein fehlender Tool-Read beweist weder fehlende automatische Injektion noch fehlende Nutzung eines schon zugestellten Snippets. Eine Rückfrage nach echter Owner-Promotion ist kein Orientierungsfehler.
- Keine fremden Projekttranskripte; Codex/Pi wurden auf Fleet-CWD beziehungsweise Fleet-Worktrees begrenzt. Fleet-MAINs können andere Programs erwähnen: deren Produktinhalte werden hier nicht ausgewertet. Fremdrepo-Zahlen stammen ausschließlich aus Zustellmetadaten.
- Keine Live-Loader-Experimente für sämtliche Harness-/Provider-Kombinationen, keine aktuellen GLM-Sessionverläufe, kein Nachweis, dass eine bestimmte persönliche Korrektur jeden Worker erreicht oder nie erreicht. Vertragslektüre ersetzt diese Beobachtungen nicht.
- Die früheren Kontextnotizen wurden gezielt als Behauptungen gelesen. Keine Vollprüfung ihrer rund 35 behaupteten Vertreter und keine Übernahme ihrer historischen Kennzahlen. Beispielsweise sind die ältere Fixkostenzerlegung und eine universelle Zahl „69k“ hier gerade nicht reproduziert.
- Kein flächendeckender Mentalmodell-Test: Aus regelkonformer Facharbeit folgt nicht, dass der Agent Vorgesetzte, Nachbarn und Ergebnisempfänger kennt. Daher keine scheinpräzise Quote „x Prozent verstehen ihre Position“.

Kontext-Füllstand der Auswertung: zuletzt am eigenen Codex-Usage-Sensor gemessen 206.260 Input-Tokens bei 258.400 Fenstergröße, also 79,8 %; Messpunkt vor den Abschlussakten. Die vorherige Schätzung unterhalb der Hälfte war falsch.
