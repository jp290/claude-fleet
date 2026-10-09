# Native Trace: ausführbarer Quellenvertrag

`trace-native.ts#normalizeNative` projiziert explizit übergebene native JSONL-Bytes
in den bestehenden `TraceEvent`-/`TraceRefs`-/`TraceDetailRef`-Vertrag
(`trace-index.ts:45–60`). `GET /api/timeline` bindet seit C2 die serverseitig
aufgelösten nativen Quellen und die bestehende `buildTrace`-Ledgerprojektion in
einer seitenweisen Owner-Lesetür zusammen. `GET /api/trace?task=` bleibt erhalten.
Der Adapter selbst hat weiterhin weder Dateisuche noch Dateileser oder
Provideraufruf. Native Snapshots tragen `fleet.trace-native/v1`, die gemeinsame
Liste `fleet.timeline/v1`. Es entsteht kein zweites Ereignismodell.

## Eingabe und belegte Formatgrenze

`NativeInput` enthält `sourceHost`, einen opaken `sourceId`, Harness, Format,
Quellgeneration `version`, einen Byte-Snapshot ab `byteOffset: 0` oder einen zusammenhängenden Delta-Block,
`observedAt`, eine explizite Session-/cwd-Bindung und bekannte Redaktionsmarker.
Quelle und Version sind vom autorisierten Aufrufer zu liefern, keine aus Slot,
Dateiname, mtime oder ähnlichem cwd abgeleiteten Fakten. `inputHash` ist SHA-256
über die tatsächlich übergebenen Bytes, bei einem Delta also über diesen Block;
`inputHashOffset` benennt dessen Anfang, `inputBytes` das Ende des gesamten Standes.
Ein nachfolgender Vollsnapshot prüft jeden erhaltenen Blockhash gegen genau seinen
Bytebereich. Der Delta-Hash wird niemals als Hash des gesamten Präfixes verwendet.
Fehlt bei einem übertragenen Delta-Snapshot der interne Blockbeleg, bleibt die
Fortsetzung `source-prefix-unverified`, statt einen Rewrite zu behaupten.
Ein positiver Offset ist nur zusammen mit dem unmittelbar vorherigen Snapshot
und dessen prozessintern erhaltenem Parserzustand akzeptiert; er muss exakt
`previous.inputBytes` entsprechen und Host, Source-ID, Harness, Format, Generation
und vollständige Bindung sowie Redaktionsmarker müssen identisch sein. Ein gültiger
Delta konsumiert diesen Parserzustand einmal; ältere Snapshotwerte bleiben unverändert. Der Index prüft bei Wachstum zuerst alle
bereits gelesenen Präfixblöcke gegen ihre SHA-256-Werte. Der Parser hält
den belegten Header, Record-Eltern, Replay-/Call-/Resultat-Maps, Blockhashes und
inkrementelle Horizontzähler sowie maximal 8 MiB Teilzeile. Nur neue Zeilen werden
validiert und in den Elternindex eingetragen; alte Zeilen werden weder kopiert
noch erneut durchlaufen. Argumente und
Resultattexte werden nach dem Parsen verworfen. LF-/UTF-8-Splits bleiben erhalten.
Eine größere Recordzeile wird ausdrücklich `oversized-record`, ohne erfundene
Calls. Es gibt keinen stillen Dateinachladepfad.

| Format / Harness | Getrackter Quellenbeleg | Ausführbare Unterstützung / Grenze |
|---|---|---|
| `claude-jsonl` / `claude` | `server.ts#viewEntry`, `#transcriptCwd`, `#laneToolResultBytes`; Feldschema in `docs/messungen/2026-09-25-full-trace-quellen.md` §2/3/5 | `assistant.message.content[].tool_use` mit `id,name,input`; `user`-`tool_result` mit `tool_use_id,is_error`. Session-ID und cwd jedes User-/Assistant-Records müssen passen. `uuid,parentUuid,isSidechain` bleiben erhalten. Kein pauschaler Sidechain-Filter. Native Herstellerversion bleibt `unknown`. |
| `codex-rollout-jsonl` / `codex` | `server.ts#codexSessionMeta`, `#codexLaneMeasured`, `server/conversation-read.ts#readCodexRollout`; getracktes Feldschema §3 oben | Erster `session_meta.payload{id,cwd,timestamp,thread_source}`. `response_item.payload` mit `function_call`/`custom_tool_call`, `call_id,name,namespace` und passenden `*_output`. Nur der äußere `exec` ist ein Call; innere Aufrufe bleiben `unsupported`. Native Herstellerversion bleibt `unknown`. |
| `pi-session-jsonl` / `pi`, `pi-zai`, `pi-ox` | `server.ts#isolatedPiContextFile`; v3-Header in `e2e/security.ts`; `server/conversation-read.ts#readPiSession`; getracktes Feldschema §3 | `session{version:3,id,cwd}`; `message.content[].toolCall` mit `id,name,arguments`; `message.role:toolResult` mit `toolCallId,isError`; `id,parentId` bilden einen erhaltenen Baum. Andere Headerrevisionen sind `unsupported`. Die drei Harnessnamen teilen das Format, ihre Source-Identitäten bleiben getrennt. |

Der Befund vom 25.09. ist eine historische Messung und ein getrackter
Feldschema-Beleg, keine neue private Inventur und keine Garantie für jede heutige
Upstreamrevision. Unbekannte Harness-/Formatkombinationen liefern `unsupported`
mit dem konkreten unbedenklichen Format-/Harnessnamen. Unbekannte Codex-Calltypen
werden als `unsupported-codex-item` mit Bytebereich markiert. Andere Recordtypen
können Nicht-Toolrecords sein; der Adapter behauptet keine Vollabdeckung aller
nativen Recordtypen. Pi v99 wird ausdrücklich nicht als v3 gelesen.

## Identität, Ergebnisjoin und Referenzen

Identität ist ein Hash aus Host, Source-ID, Harness/Format, Quellversion, exakter
Session-ID, exaktem cwd und optionalem Occupationbeleg. Das Ergebnis enthält
Session-ID, cwd-Hash und eine separat ausgewiesene Occupation: `unknown` oder
`{slot,openedAt,proofHash}`. Ein Occupationreceipt muss explizit denselben Host,
dieselbe Session und denselben cwd nennen. Der Adapter prüft Konsistenz; er
attestiert weder Herkunft noch Autorisierung eines übergebenen Receipts.
Fehlt es, erscheinen keine geratenen `refs.slot`/`refs.openedAt`.

Header und später ausdrücklich genannte Identitätsfelder müssen passen, auch
Codex-`turn_context.payload.cwd`. UUID-/cwd-Mismatch, widersprüchliche Header,
fremde Receipts oder fehlende Bindung geben keine Events ab. Ein neuer Occupant
am selben Slot, ein anderer Host oder eine andere explizite Source-ID ergibt eine
andere Identität. Gleicher cwd beweist keine Sessiongleichheit oder Parentkante.

Calls und Resultate behalten ihre Original-IDs; Paarung ist auf dieselbe
Session/Source/Generation und Toolfamilie begrenzt. Codex-Subagents erhalten eine
Sessionkante ausschließlich aus
`session_meta.payload.source.subagent.thread_spawn.parent_thread_id` mit
konsistentem `thread_source:subagent`. Claude-Sidechains bleiben Records ihrer
belegten Session; aus Sidechain allein entsteht keine Subagent-Sessionkante.
Pi-Resultate dürfen nur einen passenden Call auf ihrem belegten Elternpfad
paaren. Verlassene und aktive Äste bleiben gleichwertig erhalten. Widersprüchliche
Call-Replays oder Recordparenten verwerfen die Projektion, statt eine erste
zufällig passende Identität zu fördern. Quellenübergreifende Zusammenführung
zweier eigenständiger Dateien ist kein Bestandteil dieses Adapters.

`detailRef` ist ein Source-kontrollierter Locator
`native:<identityHash>@<offset>+<recordBytes>#<block>` mit `fp` (erste 16 Hexzeichen
des SHA-256 über die Recordbytes ohne LF). Er enthält keinen lokalen Quellenpfad.
Identität/Version, Bytebereich, Block und Fingerprint sind zusammen zu prüfen;
ein Locator allein ist keine Resolverberechtigung. C1 löst keine echten privaten
Details auf. Die UI-Fixture enthält ausschließlich separat erzeugte synthetische,
redigierte Detailtexte, keinen echten Detailresolver.

## Append, Lücken, Status und Uhren

Der optionale vorherige Snapshot enthält Metadaten und Events, keine Rohbytes.
Identität plus SHA-256 des bisherigen Bytepräfixes beweisen Append. Die Antwort
ist ein ersetzender Snapshot der aktuellen Eingabe; `added`/`updated` sind IDs
für UI-Deltas, keine zweite appendbare Eventhistorie. Identische Snapshot- und
native Record-Replays erzeugen keine doppelten Calls/Resultate. Der ursprüngliche
Beobachtungszeitpunkt bereits erhaltener Events bleibt stabil.

Ein letzter Record ohne LF bleibt mit exaktem Bytebereich `partial-record`; erst
nach Vervollständigung wird er einmal verarbeitet. Ein unterbrochener Header
liefert `pending`, ohne belegte Identität und Events. Vollständige fehlerhafte
Records werden als `malformed-record` mit Bytebereich geführt. Shrink, Rewrite
oder Version-/Bindungswechsel invalidiert sämtliche vorherigen `detailRef`s;
alte und neue Events werden niemals verklebt. Gleich große Rewrites werden über
den Präfixhash erkannt. Bei Rewrite derselben deklarierten Version kann der
Locator gleich aussehen; ein anderer Fingerprint macht die alte Referenz stale.

| Feld | Aussage |
|---|---|
| `occurredAt` | Native ISO-Recordzeit oder `null`, nicht Pi-`message.timestamp` (andere Phase). |
| `observedAt` | Explizite Beobachterzeit des erstmalig erhaltenen Events. |
| `at` / `atClock` | Recordzeit samt benannter Harness-Record-Wallclock; bei fehlender Recordzeit die benannte Observer-Wallclock. |
| `clockUncertainty` | `unknown`; keine gemessene Hostsynchronisation. |
| `status` / `outcome` | `pending` bei beobachtetem Call ohne Ergebnis; `late` nur wenn ein früherer Snapshot diesen Call pending beobachtete. `outcome:ok/error` nur bei explizitem `is_error`/`isError` false/true, sonst `unknown`, insbesondere Codex-Textoutputs. |
| `pair` | Gegenseitige Event-ID bei belegtem Join; orphan bleibt erhalten mit `pair:null` und expliziter Lücke. |
| `separation` | Nichtnegativer Abstand zweier erhaltener Recordzeiten derselben benannten Uhr, ausdrücklich keine Tool-Laufzeit. |
| `duration` | `null`: Diese Formate belegen keine zwei Enden einer gemeinsamen Tool-Laufzeituhr. Timeout, Sleepargument und Pi-`details.executionTime` werden nicht als solche ausgegeben. |

Sortierung nach `at`, dann Byteoffset und Block ist eine deterministische Anzeige.
Zeitgleichheit bleibt Zeitgleichheit; kein Kausalitätsrang wird daraus abgeleitet.
`SourceHorizon` benennt Record-Wallclock, älteste/neuste erhaltene Recordzeit,
Zeilenzahl, malformed-Zahl und die gelieferte Generation. Er beweist keine
Vollständigkeit vor dem Beginn dieser expliziten Eingabe.

`files[]` enthält ausschließlich erhaltene direkte strukturierte relative
Dateikandidaten (`Edit`/`Write.input.file_path`, Pi `edit.arguments.path`). Absolute,
traversierende oder markerhaltige Pfade werden nicht ausgeliefert. Das bedeutet
weder erfolgreiche Ausführung noch erfolgreiches Schreiben. Ein fehlerhaftes
Edit darf seinen beobachteten Kandidaten behalten, sein Fehlerstatus bleibt
sichtbar. Shelltexte, Codex-`exec` und Patchstrings werden nicht zu inneren Tools
oder ausgeführten Files umgedeutet. Die Übersicht enthält keine Argument-,
Resultat- oder Fehlertexte; Diagnosen sind feste Codes mit Bytebereichen. Bekannte
Redaktionsmarker und Credentialmuster sind auch in Identifikatoren verboten.
Das ist keine allgemeine Garantie für unerkannte Geheimnisse in beliebigen
Metadaten; eine spätere autorisierte Resolvergrenze braucht eigene Redaktion.

## Ausführbare Fixtures und Byte-Messung

`e2e/trace-native-fixtures.ts` exportiert die rohen synthetischen Recordfolgen
`NATIVE_FIXTURES` samt expliziter Bindung, Sourceversion, Offset und Erwartungen.
Die Call-/Resultattexte enthalten einen Redaktionscanary. Rohfixtures sind
Testeingabe, kein auszulieferndes Detail. `loadNativeUiFixtures()` liefert exakt
normalisierte Snapshots plus separate synthetische redigierte Details; sie ist
mit WebCrypto im Browser importierbar. `e2e/trace.ts#run` ruft dieselben
`runNativeProbes(check)` neben den vorhandenen S5-Proben auf.

```sh
bun e2e/trace-native-fixtures.ts
bun build e2e/trace-native-fixtures.ts --target browser --outfile /tmp/native-ui-fixtures.js
```

```ts
import { loadNativeUiFixtures } from "./e2e/trace-native-fixtures";
const fixtures = await loadNativeUiFixtures();
// fixtures[i].snapshot.events und fixtures[i].details: dieselben synthetischen Events.
```

Messverfahren: UTF-8 ohne Kompression. Input ist die komplette native JSONL-Eingabe
inklusive LF. Metadaten sind `TextEncoder().encode(JSON.stringify(snapshot))`
inklusive Events, Deltas, Identität, Hashes, Horizont und Lücken. Details sind
`TextEncoder().encode(JSON.stringify(details))`, inklusive Locator und
Redaktionsflag, ohne Raw-Payload. Die unabhängige feste Erwartungstabelle in den
Proben verlangt diese Zahlen und je vier Events, kein Pass durch leere Mengen.

| Synthetische Quelle | Input B | Metadaten B | Detail B | Events |
|---|---:|---:|---:|---:|
| Claude | 1261 | 5548 | 643 | 4 |
| Codex | 973 | 5587 | 647 | 4 |
| Pi | 1411 | 5559 | 650 | 4 |
| Pi-zai | 1411 | 5603 | 650 | 4 |
| Pi-ox | 1411 | 5592 | 650 | 4 |
| Summe | 6467 | 27889 | 3240 | 20 |

Das sind deterministische Fixturekosten, keine Produktionsmessung, kein Tagesmittel
und kein gemessenes globales Budget. 64 KiB bleibt ein vorläufiger UI-Vorschlag.
C1 parst volle Snapshots; C2 ergänzt zusammenhängende Deltas, ohne einen
persistierten Index oder eine neue Retentionpolicy einzuführen. Die tatsächlichen
C2-Messungen und Grenzen stehen unten.

Die Proben unterscheiden UUID, cwd (auch spätere Records), fremde Occupation,
Recycle, Host-/Sourcewechsel, unbekanntes Format/Harness/Pi-Revision, vollständige
Malformed-Zeile, Teilzeile, Shrink/Rewrite/Version, orphan/missing/late, Replay,
Toolfamilie, Pi-Geschwisteräste, Claude-Sidechain und belegte Subagentkante.
Mutationsnachweis: In einer Scratchkopie von `trace-native.ts` alle
`p.id !== binding.sessionId`, `r.sessionId !== binding.sessionId`,
`r.id !== binding.sessionId` durch `false` ersetzen, unveränderte Fixtures daneben
unter `e2e/` ausführen: `native UUID fence codex` muss spezifisch FAIL liefern.
Analog alle `p.cwd !== binding.cwd`, `r.cwd !== binding.cwd` durch `false`
ersetzen: `native cwd fence codex` muss spezifisch FAIL liefern. Der unveränderte
Adapter muss beide Gegenbeispiele zurückweisen und mit `ALL PASS` schließen.

## Anschluss- und Ersatzmatrix

| Oberfläche | C1-Entscheidung | Offene Teilabnahme |
|---|---|---|
| Wire/API | `not-applicable`: keine neue Route; typed pure Input/Output ist ausgeführt | C2: autorisierte Sourceübergabe, kleine Sichten, Detailresolver, Cursor/Index |
| Server | `not-applicable`: vorhandene Ledger-Trace bleibt erhalten | C2: native API-Einbindung und Frische/Version/unknown |
| Client | `apply`: importierbare synthetische Events und redigierte Detailfixtures | U1: tatsächliche Visualisierung ([Scratch-Entwurf](design/zeitleiste-entwurf.html)); U2: API-/UI-Abnahme |
| Reverse-state | `not-applicable`: keine neue Bindung, Registrierung oder Retention geschrieben | Belegreceipts müssen später autorisiert bereitgestellt werden |
| Quellen/Docs | `apply`: Formatvertrag, Lücken, konkrete unsupported-Grenzen und Fixturebytes | Heutige repräsentative Produktionskosten und Sourceabdeckung ungemessen |
| Probes | `apply`: reine Produktionsproben im vorhandenen Trace-Modul | Weitere C2/U1/U2-Proben sind noch nicht erbracht |

| Bestehender Einstieg | Erforderliche Gleichwertigkeit vor Ersatz |
|---|---|
| Auditliste (`src/client.ts#openActivity`) | Dieselben Auditereignisse, Filter und Originalreferenzen |
| Outcomes/Lands (`src/client.ts#openActivity`) | Land, Kandidat/Gate, Quelle und Audit getrennt erreichbar |
| Post-Land-Audit/Alarm (`src/plaudit.ts`, `src/board.ts`) | red/unknown, Original-log-Link, Bytes/Hash erhalten; ack bleibt Sichtzustand |
| Checks-Panel (`src/board.ts#gateSection`) | Vor-Land-Gate, laufende Prüfung, Release-/Hold-Gründe und Post-Land-Audit getrennt |
| Info-Tab (`src/board.ts`) | Fokus, Scroll und Draft erhalten; Navigation darf diese nicht stehlen |

Diese Ersatzanforderungen stammen aus dem S5-Zielbild und den getrackten Quellen;
C1 verändert keinen dieser Einstiege und erbringt keine Gleichwertigkeitsabnahme.
C2/API, U1/U2 und der spätere Ersatz bleiben nachgelagerte, offene Produktarbeit.

## C2: Owner-Drahtvertrag und Seiten

`GET /api/timeline?from=<ms>&to=<ms>[&project=<key>&program=<id>&session=<uuid>&harness=<name>&limit=<1..100>&cursor=<opaque>]`
liegt hinter dem vorhandenen Owner-Token-Gate. Zeitraumgrenzen sind inklusive,
endliche sichere Ganzzahlen ab Unix-Epoch; `from <= to`. Beide sind erforderlich.
Filter sind UND-verknüpft. `project` ist der vorhandene `projectKeyOf`-Hash des
belegten Repo-Pfads, bei einer Session ohne Repo-Beleg der ihres cwd. Ein
Task-/Program-/Projektjoin wird nur aus erhaltenen Belegen gemacht; unbekannte
Programzugehörigkeit besteht einen benannten Programfilter nicht.

Unbekannte Queryparameter, Dateipfade, ungültige UUIDs, Grenzen und Limits geben
400; ohne Ownercredential 401. Unbekannte/abgelaufene Cursor, Filterwechsel oder
eine inzwischen geänderte Indexrevision geben 409 `cursor-stale`; dann ohne
Cursor neu anfangen. Eine einzelne zu große Metadatenzeile gibt 413. Antwort ist
JSON mit `cache-control: no-store`; es gibt keinen neuen Share-/Grant-Pfad.

| Feld | Vertrag |
|---|---|
| `schema`, `host`, `revision`, `window` | `fleet.timeline/v1`; lokaler OS-Hostname, opake Indexrevision, angefragte Grenzen |
| `sessions[]` | Nur die auf dieser Seite referenzierten Sessionheader; `key = SHA256([host,session,slot,openedAt])`, nicht Slotnummer allein |
| `occupation` | `slot`, exaktes `openedAt`, kanonischer Hash des konsistenten Host-/UUID-/cwd-/Belegungsbelegs; kein behaupteter Signaturbeweis |
| `harness`, `project`, `program`, `task`, `branch` | belegte Zuordnung oder `unknown`/null; cwd und Dateipfad fehlen im Header |
| `source` | opake Source-ID, Generation, Adapterzustand, gelesene/verfügbare/vollständige Bytes und nativer Horizont |
| `gaps[]` am Header | Native und Resolver-Lücken; maximal 16 native Diagnosen plus `additional-source-gaps` mit Zahl der weiteren Diagnosen |
| `entries[]` | `{id,at,sessionKey,event}`; Sessionanker hat `event:null`, echte Ereignisse sind bestehende `TraceEvent`s / `NativeEvent`s |
| `at` des Sessionankers | Beginn der Belegung, auf die linke Fenstergrenze begrenzt; das echte `openedAt` bleibt im Header |
| `sessionKey:null` am Ledgerereignis | Task ist belegt, konkrete Sessionbelegung ist nicht belegt; keine Attribution nur aus wiederverwendetem Slot oder Branch |
| `ledger[]` | Horizonte von `buildTrace` für Tasks mit Ledgerereignissen auf dieser Seite; bei Byteüberlauf ausdrückliche Horizontlücke |
| `nextCursor` | opaker, serverseitiger Fortsetzungsbeleg; null nach der letzten Seite dieser Indexrevision |
| `pending`, `coverage`, globale `gaps` | Hintergrundlesung noch nicht fertig / Fehler; Abdeckung bleibt `incomplete`, verlorene Historie wird nicht rekonstruiert |
| `budget`, `work` | Grenzen sowie gemessene Byte-/Readarbeit des letzten Indexschritts; kein Toolpayload und kein Kontextinhalt |

Sortierung ist `at`, dann stabile Ereignis-ID; gleiche Zeit bedeutet keine
Kausalfolge. Clock-Uncertainty bleibt `unknown`, Toolruntime bleibt null.
Original-IDs, Parent-/Sidechain-/Pi-Branchbelege und late/missing/orphan bleiben
wie im nativen Vertrag erhalten. Innere Codex-exec-Aufrufe sind unsupported.
Argumente, Resultattexte, Reporttext und Prüflogbytes fehlen in der Liste.
`detailRef` ist nur der vorhandene Locator/Fingerprint, keine Leseberechtigung;
die autorisierte Detailtür ist `GET /api/timeline/detail` (Abschnitt C3 unten), und
sie öffnet über die Eintrags-ID, nie über den Locator. Der bestehende Exportredaktor
reinigt zusätzlich die serialisierte Antwort mit den bekannten Credentialwerten.

## C2: Quellen-, Lücken- und Oberflächenmatrix

| Träger / Quelle | Auflösung / Evidenz | Lücke / Grenze |
|---|---|---|
| Live-Slots | UUID, cwd, Harness, Slot+openedAt und Task/Program aus servereigenem Zustand | Ungepinnte oder leere Slots liefern keinen erfundenen UUID-Beleg |
| Erhaltene Fleet-Reports | `worker{sessionId,cwd,slot,openedAt,branch}` plus Provenienz im bestehenden Serverzustand | Der Reportledger allein enthält keinen Worker-UUID/cwd-Beleg; eviktierte Worker können nur andere Träger belegen |
| `streams/prompts.jsonl` | erhaltene Empfangs-UUID, cwd und Belegung; Text sofort verworfen | Legacy ohne UUID/cwd/openedAt = `unbound-prompt-record`; Text-/Labelinterpretation ist kein Join |
| `state-snapshots.jsonl` .archive/.1/aktiv | exakte UUID+Slot+openedAt verbindet Task/Program/Branch/Projekt mit einem bereits belegten cwd | Legacy = `unbound-snapshot-record`; Snapshot ohne passenden cwd-Beleg erzeugt keine Quelle |
| Taskarchiv / Outcomes | erhaltene Task-/Repo-/Program-/Branchfelder; cwd nur über vorhandenes `worktreePathFor` | Keine Taskidentität aus Brieftext oder Branchslug; fehlende Belege bleiben null |
| Claude | gepinnter `projDir(cwd)/UUID.jsonl`, bestehendes `transcriptCwd` und `sameCwd`; alle Records nochmals im Adapter geprüft | Slug ist kein Identitätsbeweis; falsche UUID/cwd liefert keine fremden Events |
| Codex | `codexContextFile` und `codexSessionMeta`, exakte UUID/cwd, danach Adapterprüfung | Kein fremder Rollout aus bloßer Dateireihenfolge; verlorene Quelle bleibt Sessionlücke |
| Pi / pi-zai / pi-ox | vorhandene jeweiligen Context-Resolver samt UUID-/Header-/cwd-Prüfung | Mehrdeutigkeit oder fehlende Quelle bleibt Lücke; andere v3-Revision unsupported |
| Unbekannter Harness | expliziter Name aus Beleg | `unsupported-source`, keine Claude-Fallbackdatei |
| Fehlende Harnesszuordnung | genau ein Treffer unter den fünf vorhandenen Resolvern darf den Harness belegen | null/mehrere Treffer = `source-missing`; nicht als ruhige oder vollständige Session darstellen |
| Wachstum / Rewrite | Bytecursor und Blockhash-Präfixprüfung; inode/shrink/gleichgroße Änderung setzt neue Generation | Während Prüfung `source-change-unverified`; Rewrite invalidiert alte Generation, Teilzeile bleibt pending |
| Mehrere Belegungen derselben UUID | Header bleiben nach Host+UUID+Belegung getrennt; jeder erhaltene Quellenrecord erscheint einmal | `occupation-source-ambiguous`, `sessionKey:null`, keine geratenen Slot-/openedAt-Refs am Call |
| Gelöschte Quelle | Beleg bleibt, native Events werden entfernt | `source-missing`; kein Weiterreichen alter Calls als aktuelle Quellenbytes |
| Ledgerereignisse | ausschließlich `buildTrace`, dessen Generationen und bestehende Quellenref-/Horizontsemantik | Exakte Sessionkante nur mit UUID+Slot+openedAt im Ereignis; sonst unzugeordnet |
| Vor dem erhaltenen Horizont | kein rekonstruierender Quellenzugriff | `history-before-retained-sources-unknown`, niemals vollständige Maschinenhistorie behaupten |

Wire, Server, Docs und Probes: `apply`. Client: `not-applicable` in dieser Karte;
kein Clientfile wurde geändert. Reverse-state/Persistenz: `not-applicable`; Index,
Parserzustand, Cache und Cursor leben ausschließlich im Serverprozess. Host- und
Grantpolicy sowie Retention bleiben beim bestehenden System. Externe/entfernte
Hostquellen sind `unsupported` in dieser lokalen Maschinenliste.

Die vorhandenen Audit-/Outcomes-/Post-Land-/Checks-/Info-Einstiege der obigen
Ersatzmatrix bleiben bestehen. Ihre Routeanker sind `/api/audit`, `/api/lane`,
`/api/trace`, `/api/lane-outcomes`, `/api/post-land-audits` samt `/artifact`,
die Mergezustände in `/api/sessions` und `/api/deploys`. C2 migriert keine Navigation und beweist keine
Gleichwertigkeit dieser Einstiege; rote/unknown Urteile und Originalprüflogs
bleiben an ihren vorhandenen Türen erreichbar.

## C2: Vorher gemessene Größen und festgelegte Ladegrenzen

Read-only-Inventur am 08.10.2026 auf dieser Maschine **vor dem Indexbau**:
Dateistatistik plus maximal 65.536 Header-/Recordbytes pro Datei in den
vorhandenen Harnesswurzeln. Die Tabelle zählt Dateien mit UUID/cwd im gelesenen
Bereich, nicht bestätigte Fleet-Sessions. Keine Argumente, Inhalte, Pfade oder
UUIDs sind Bestandteil dieses Messergebnisses. p90 ist nearest-rank;
Claude-Sidechainunterverzeichnisse sind nicht Teil der Inventur.

| Harness | Rohdateien / UUID+cwd-Kandidaten | Summe B | Median B | p90 B | Maximum B | Inventur ms |
|---|---:|---:|---:|---:|---:|---:|
| Claude | 2152 / 1673 | 2903127305 | 757405 | 4216019 | 33936647 | 1670,09 |
| Codex | 1192 / 1192 | 4286831221 | 1811113,5 | 6181395 | 419372296 | 937,40 |
| Pi | 80 / 80 | 56156325 | 612440,5 | 1281839 | 4684351 | 619,96 |
| pi-zai | 213 / 213 | 106902880 | 408636 | 1023091 | 1702118 | 282,70 |
| pi-ox | 18 / 18 | 7208331 | 287817,5 | 1400600 | 1901363 | 23,81 |

Erhaltene lokale Trägergrößen: Promptjournal 60106321 B, Reportledger 4054187 B,
Snapshots 31146113 B über drei Generationen, Taskarchiv 16524905 B, Outcomes
2700126 B, Audit 22313072 B über drei Generationen, Post-Land-Audits 5802297 B.
Das sind einzelne Messzeitpunkte laufender Dateien, keine Retentionsgarantie.

Vor Implementierung festgelegt: native/Bindungsträger **1 MiB pro Indexschritt**,
Seite **64 KiB UTF-8 und höchstens 100 Einträge**, Teilzeile **8 MiB**,
native Sessionquellen **20000 pro Prozess**, Cursor **10 min / 300**,
**0 native Byte-Reads bei unveränderten Quellen**. Bei größerem Bestand bleiben
Sessionheader mit `session-budget` sichtbar. Das bestehende `buildTrace` arbeitet
separat: Timeline setzt maximal **64 MiB pro Ledger über alle drei Generationen**;
ein größerer Ledger wird ausdrücklich unmeasured. Erstlesen ist damit höchstens
320 MiB über fünf Ledger, nicht das native 1-MiB-Budget. Unveränderte Ledger
verwenden den bestehenden Projektionspfad mit einem Stat-gebundenen Readcache.
Pro Schritt wird höchstens eine Taskprojektion aktualisiert; veränderte Träger
werden fair über Tasks verteilt. Git liest `buildTrace` über den bestehenden
Serverleser, keine eigene Gitprojektion. Resolver-Metadaten und Gitarbeit sind
nicht in `work.readBytes` enthalten.

Verarbeitung startet bedarfsgesteuert und läuft bei Rückstand seriell in
100-ms-Schritten im Hintergrund weiter. Seiten bei `pending:true` sind ein
Teilstand, Cursor binden genau diese Revision. Unveränderte gefilterte/sortierte
Projektionen werden für höchstens acht Querys wiederverwendet. Budgets begrenzen
Leseschritte und Antwortbytes, keine neue Quellenaufbewahrung. Die gesamte
Historie wird nicht bei jedem Poll erneut aus Dateien gelesen.

Je Harness wurde die mittlere nach Bytegröße sortierte echte Kandidatendatei
normalisiert. Vor dem Bau: Claude 37,79 ms/62 Events, Codex 26,96 ms/56,
Pi 11,98 ms/0 plus `invalid-tool-metadata`, pi-zai 17,64 ms/126,
pi-ox 13,31 ms/92. Die Pi-Probe zeigte erhaltene zusammengesetzte Provider-IDs
mit `|`; C2 akzeptiert und paart deren exakten Identifier, ohne ihn zu kürzen.
Danach liefert dieselbe Pi-Quelle 142 Events ohne diese Lücke; eine synthetische
Probe sichert die exakte Paarung. Native Herstellerrevisionen bleiben unknown.

Messung des fertigen Index auf denselben Dateien, ohne Git-/Ledgerarbeit, ohne
Kompression; ein Lauf je Quelle, keine statistische Latenzgarantie:

| Harness | Cold ms / Schritte | Events | Seiten | größte Seite B | Warm ms / native Reads |
|---|---:|---:|---:|---:|---:|
| Claude | 35,91 / 1 | 62 | 2 | 65240 | 2,09 / 0 |
| Codex | 23,00 / 2 | 56 | 2 | 64609 | 1,42 / 0 |
| Pi | 54,82 / 1 | 142 | 4 | 64168 | 1,00 / 0 |
| pi-zai | 10,06 / 1 | 126 | 3 | 64975 | 1,33 / 0 |
| pi-ox | 8,35 / 1 | 92 | 3 | 64980 | 1,30 / 0 |

Dies beweist die gemessenen mittleren Quellen und den unveränderten Poll,
keine komplette Warm-Latenz über den mehrgigabytegroßen Maschinenbestand.
419-MB-Quellen und Änderungen während des Lesens bleiben inkrementell/pending,
verlorene Abschnitte bleiben unknown. Der ausführbare Trace-Test prüft fünf
Harnesses, parallele Sessions plus Lücke, UUID/cwd, Recycle, Rewrite einschließlich
Wachstum, Teilzeile, late/missing, unsupported, Cursor und Payloadfreiheit.
Jeder neue Timeline-Check hat eine spezifisch rot machende Scratchmutation.


### Kosten einzelner Deltas bei langen Quellen

Synthetische Codex-Fixtures: jeweils **50.001 vollständige Records**, danach
**20 zusammenhängende Deltas mit je 149 B / einem neuen Kontextrecord**. Messung
mit `performance.now()` um ausschließlich `normalizeNative`, ohne Datei-I/O,
HTTP oder Index-Präfixprüfung; gleicher Prozess, ein Kaltaufbau je Fixture und
Version, keine Warm-up-Abzüge. Median = Mittel der Positionen 10/11, p95 =
Position 19 der 20 sortierten Messwerte. Die Vorher-Version verarbeitet erneut
alle erhaltenen Zeilen; die Danach-Version hält die Record-/Paarungszustände
inkrementell.

| Fixture | Eingabe B | erhaltene Events | Vorher Median / p95 / Max ms | Danach Median / p95 / Max ms |
|---|---:|---:|---:|---:|
| Kontextrecords mit eigenem Record-/Parent-ID | 7427975 | 0 | 29,66 / 45,87 / 45,89 | 0,17 / 0,23 / 0,81 |
| 25.000 eindeutige Calls samt Resultaten | 7127985 | 50000 | 2570,66 / 2913,52 / 4194,59 | 4,60 / 8,72 / 11,21 |

Die vollständige Metadatenausgabe wird weiterhin aus den erhaltenen Events
kopiert und sortiert: O(Events) Speicher/Kopie und höchstens O(Events log Events)
Sortierung. Paarung überprüft die betroffenen Call-ID-Buckets und bei neuen
Pi-Eltern mögliche erhaltene Orphans. Diese Kosten sind kein O(1)-Versprechen.
Ein unveränderter Timeline-Poll verwendet hingegen die gecachte Projektion und
liest keine Quellenbytes. Ein wachsender Dateipräfix muss für Rewrite-Erkennung
weiterhin blockweise geprüft werden; dafür gilt das bestehende 1-MiB-Schrittbudget.

Die Probe `timeline native full delta full` verlangt nach Vollstand → Delta →
gleichem Vollstand null Lücken/Invalidierungen und identische Eventwerte; ein
geänderter Vollstand muss alle vier Refs invalidieren. Gegenmutation: die
Blockprüfung wieder durch `hash(bytes[0..previous.inputBytes]) ===
previous.inputHash` ersetzen. Die unveränderte Probe wird damit gezielt rot.

## C3: Detail-Tür für einen Call

`GET /api/timeline/detail?ref=<entry.id>` liegt hinter demselben Owner-Token-Gate wie die
Liste (`trace-timeline.ts#TimelineIndex.detail`, Route in `server.ts`). `ref` ist die
`id` eines nativen Eintrags aus `GET /api/timeline` (64 Hexzeichen, die Event-ID des
Adapters) — der Call- oder der Resultat-Eintrag öffnen denselben Call. Andere
Parameter, ein zweites `ref`, ein Locator (`native:…`) oder ein Pfad geben 400; ohne
Ownercredential 401. Die Tür nimmt keinen Pfad und keinen Bytebereich vom Aufrufer:
Datei und Bereich kommen ausschließlich aus dem Indexzustand, der das Event ausgegeben hat.

**Ablauf.** Erst ein Indexschritt wie bei der Liste (`update`), dann der Lookup der ID
in den gehaltenen Snapshots. Eine ID, die der Index nie ausgegeben hat, ist **404
`unknown-reference`, bevor irgendeine Datei gelesen wird** (`work.sourceReads: 0`).
Gefunden, liest die Tür genau die Bereiche `record.offset+record.bytes` des Calls und
seines gepaarten Resultats (höchstens zwei Reads), prüft Länge, inode und den
Fingerprint `fp` und dekodiert erst dann den Block `record.block`
(`trace-native.ts#nativeDetailOf`). Passt einer davon nicht, hat der Stempel
(`trace-timeline.ts#timelineStamp`: dev, inode, Größe, mtime, ctime) eine Umschreibung
verpasst — gleich lang und im selben Zeitstempel-Tick, was ein grober Kernel-Takt (Linux)
zulässt. Die Tür verwirft dann die ganze Quelle wie der Indexschritt (Grabsteine
`source-rewritten`, nächste Generation beim nächsten Schritt) und antwortet als Grabstein,
ohne den schon gelesenen Bereich. Ein Ledger-Eintrag (`buildTrace`) ist kein nativer
Call und bleibt 404; seine Originalreferenz bleibt an `/api/trace`.

| Feld | Vertrag |
|---|---|
| `schema`, `host`, `revision`, `ref` | `fleet.timeline-detail/v1`, wie die Liste; `revision` ist die Indexrevision beim Lesen |
| `state` | `read`, oder `gap`, sobald eine Quelle fehlt, umgeschrieben ist oder der Block nicht mehr passt |
| `call`, `result` | je `{id, kind, call, occurredAt, observedAt, atClock, status, outcome, range}`; `range = {offset, bytes, block, recordId, parent, sidechain, locator, fp}` ist der Bytebereich der Originalquelle |
| `source` | `{id, harness, format, version, name, availableBytes}`: opake Source-ID, Generation, Dateiname (Basename, nie Verzeichnis oder cwd) und aktuelle Dateigröße |
| `arguments`, `resultText`, `error` | je ein `DetailField` `{value, bytes, truncated:false}` oder `{value:null, preview, bytes, truncated:true}`; Fehler heißt explizites `is_error`/`isError: true`, Codex-Outputs bleiben `resultText` mit `outcome:unknown` |
| `status`, `outcome`, `separation` | wie im nativen Vertrag; `separation` ist Recordzeit-Abstand, keine Laufzeit |
| `duration`, `durationBasis` | `null` mit benanntem Grund: keine der drei Formate belegt zwei Enden einer gemeinsamen Tool-Laufzeituhr |
| `gaps[]` | `missing-result`, `orphan-result`, `source-missing`, `malformed-record`, `record-block-mismatch`, jeweils mit Bytebereich, wo einer belegt ist; `source-rewritten` nur als Grabstein ohne Bereich |
| `work` | Reads und Bytes dieses Aufrufs, auch an jeder 400/404 |

**Lücke statt Fehler.** Eine Quelle, die nach dem Ausgeben gelöscht, umgeschrieben,
geschrumpft oder neu gebunden wurde, antwortet 200 mit `state:"gap"` und benanntem
Code, nie mit alten Bytes und nie als leerer Erfolg. Hat ein Indexschritt den Snapshot
schon verworfen, hält der Index die ID in einer Grabstein-Map
(`TIMELINE_RETIRED_REFS = 20000`, älteste zuerst verdrängt; nur ID und Grund, kein Event,
kein Pfad): `source-missing`, `source-rewritten`, `source-binding-changed`,
`source-not-indexed`, `source-changed-during-read`. Eine aus dem Deckel gefallene ID ist
wieder 404. Die Map ist Prozesszustand wie Cursor und Parserzustand; keine neue Retention.

**Redaktion.** Jeder Wert läuft vor dem Ausliefern durch `trace-native.ts#redactDetail`:
die Redaktionsmarker des Index (dieselben, die `normalizeNative` bekommt), die
Credentialmuster aus `hasSecret` (`sk-…`, `Bearer …`, `x-fleet-self-token`,
Private-Key-Blöcke), und — der Gegenfall, den diese Marker nicht kannten — Zuweisungen an
geheimnisbenannte Variablen (`DB_PASSWORD=…`, `"api_key": …`), `Basic`-Credentials,
URL-Logins, GitHub-/AWS-Schlüsselformen sowie String-Werte geheimnisbenannter JSON-Schlüssel.
Danach reinigt der bestehende Exportredaktor die serialisierte Antwort ein zweites Mal.
Redigiert wird vor dem Kürzen: jedes Feld ist auf `DETAIL_FIELD_BYTES = 65536` B
serialisiertes UTF-8 begrenzt, darüber `truncated:true` mit Vorschau und Originalgröße.
Das ist keine Garantie für unbekannte Geheimnisformen in beliebigem Freitext.

**Checks und ihre Mutationen** (`e2e/trace.ts#timelineDetailProbes`, Route in
`#timelineRouteProbes`, Matrix in `e2e/security.ts` §2):

| Check | Gegenmutation, die ihn rot macht |
|---|---|
| öffnet genau einen Call mit Argumenten, Resultat, Zeiten und Bereich; Fehler als `error` | Paarlookup in `detail` streichen (nur das eigene Event lesen) |
| redigiert die Marker von `normalizeNative` (Canary, Bearer) | `redactText` ohne Marker und `SECRET_SPANS` |
| redigiert unbekannte Geheimnisse (Zuweisung, geheimnisbenannter Schlüssel) | nur die `hasSecret`-Muster behalten; so lief der Check vor dem Fix rot |
| unbekannte ID 404 ohne Read; Pfad, Locator, zweites `ref` 400 (Einheit, Route, `security.ts`) | `if (!code) return … 404` streichen: die gefälschte ID liest 200 |
| umgeschriebene / gelöschte Quelle ist benannte Lücke | `retire` beim Rewrite bzw. beim Verschwinden streichen: alte ID wird 404 |
| Grabsteine gedeckelt, älteste zuerst verdrängt | Verdrängungsschleife in `retire` streichen |

Client: `not-applicable` in dieser Karte; die Zeitleisten-UI ruft die Tür noch nicht auf.
Wire, Server, Docs und Probes: `apply`. Keine Share-, Grant-, Host- oder Retentionsänderung.
