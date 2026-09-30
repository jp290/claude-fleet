# Native Trace: ausführbarer Quellenvertrag

`trace-native.ts#normalizeNative` projiziert explizit übergebene native JSONL-Bytes
in den bestehenden `TraceEvent`-/`TraceRefs`-/`TraceDetailRef`-Vertrag
(`trace-index.ts:45–60`). Der Adapter ist Produktionscode ohne Dateisuche,
Dateileser, Provideraufruf, Registry, Backend oder Route. Der vorhandene
`buildTrace` und `GET /api/trace?task=` bleiben eigenständige Ledgerprojektionen;
sie liefern diese nativen Events noch nicht. Das Ergebnis ist
`fleet.trace-native/v1`, keine Behauptung einer laufenden nativen API.

## Eingabe und belegte Formatgrenze

`NativeInput` enthält `sourceHost`, einen opaken `sourceId`, Harness, Format,
Quellgeneration `version`, einen vollständigen Byte-Snapshot ab `byteOffset: 0`,
`observedAt`, eine explizite Session-/cwd-Bindung und bekannte Redaktionsmarker.
Quelle und Version sind vom autorisierten Aufrufer zu liefern, keine aus Slot,
Dateiname, mtime oder ähnlichem cwd abgeleiteten Fakten. `inputHash` ist SHA-256
über die tatsächlich übergebenen Bytes. Ein beliebiger Offset ohne Header ist
gegenwärtig abgewiesen; Fenster-/Cursor-Eingaben brauchen später einen belegten
Index samt Identität. Es gibt keinen stillen Dateinachladepfad.

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
| Claude | 1261 | 5528 | 643 | 4 |
| Codex | 973 | 5567 | 647 | 4 |
| Pi | 1411 | 5539 | 650 | 4 |
| Pi-zai | 1411 | 5583 | 650 | 4 |
| Pi-ox | 1411 | 5572 | 650 | 4 |
| Summe | 6467 | 27789 | 3240 | 20 |

Das sind deterministische Fixturekosten, keine Produktionsmessung, kein Tagesmittel
und kein gemessenes globales Budget. 64 KiB bleibt ein vorläufiger UI-Vorschlag.
C1 parst den übergebenen Snapshot erneut; es behauptet keine persistierte
inkrementelle Indexkostenmessung. C2 muss Index/Übersicht/Fenster/Detail/Cursor
mit synthetischer Skalierung separat bemessen und begrenzen.

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
| Client | `apply`: importierbare synthetische Events und redigierte Detailfixtures | U1: tatsächliche Visualisierung; U2: API-/UI-Abnahme |
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
