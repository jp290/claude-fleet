---
frage: Welche der neun Gedächtnis-Techniken trägt Fleet mechanisch, und welche belegten Lücken lohnen einen eigenen Schnitt?
urteil: Eine Lücke beim Kaltstartnachweis, sechs teilweise umgesetzte Techniken und zwei Techniken außerhalb der Fleet-Schicht. Zuerst Watch-Ziele über den Rückzug retten, danach deren Rekonstruktion ohne Vorgängerprosa messen; keine allgemeine Gedächtnisschicht ableiten.
bereich: [kontext, nachfolge, lineage, verifikation]
belege: [server.ts#captureLineageObligations, server.ts#dropWatchesFor, server.ts#lineageSelfView, server.ts#captureProgramHandover, server/types.ts#LineageObligationRef, e2e/self-token.ts, context-plan.ts#planContext]
nicht-gemessen: Historischer Zustand nach dem Rückzug, rote Audit-Zeile, tatsächliche Handlungen der Nachfolgerin, Harness-Kompaktierung und Wirksamkeit der neun Thread-Techniken.
stand: 2026-09-15
---

# Neun Gedächtnis-Techniken gegen Fleets Nachfolge und Kontext

Gelesener Stand: `main` und Lane-HEAD waren zu Beginn identisch: `364cdca090dd1d388cd019a33f5da0f84e7a6665`. Alle Codezeilen unten beziehen sich auf diesen Stand. Quellpaket: `/Users/owner/claude-fleet-private/astra-inputs-2026-09-15/x-thread-memory-tricks.md` und `lineage-record-f54c5977.json` im selben Verzeichnis. Zur Herkunft gilt ausschließlich der Kopf der Eingabedatei: kein Repo genannt; Herkunftsbehauptungen unbelegt. Keine Webrecherche.

**Abstraktionsentscheid:** Fleet braucht rekonstruierbare Übergaben seiner eigenen Pflichten, weil es deren Lebensdauer steuert; eine allgemeine Gesprächsgedächtnisschicht ist aus diesem Material nicht begründet. Geprüft wurden die benannten Nachfolgefunktionen, Typen, Kontextauswahl, Kartenform und Regelbuchzusammensetzung sowie gezielte Nachfolgetests; Maßstab ist ein ausführbarer Mechanismus mit erkennbarer Grenze, nicht eine gleichlautende Regel.

## 1. Genau neun Techniken

„Teilweise“ bedeutet hier auch: Fleet trägt einen begrenzten Teilmechanismus, nicht das vollständige Versprechen. „Nicht-unsere-Schicht“ bezeichnet die Gesprächsverwaltung im Harness, nicht eine behauptete Umsetzung dort.

| Technik | Mechanismus in einem Satz | Fleet-Gegenstück als datei#symbol oder Doc-Abschnitt | Urteil | Beleg |
| --- | --- | --- | --- | --- |
| 1 · Memory Ledger | Eine kurze laufende Liste bewahrt Entscheidungen statt Gesprächsverlauf. | `server.ts#lineageDraft`, `server.ts#laneHandoffReportFor` | teilweise | `server.ts:6836–6840` speichert Pflichten und optionales `intent`; `server.ts:6981–6984` wählt den letzten Handoff-Report. Weder Funktion erzeugt oder aktualisiert ein Entscheidungsledger; die Prosa bleibt Agentenarbeit. |
| 2 · Relevance Cutoff | Nicht aufgabenwirksame Nachrichten werden zusammengefasst und aus dem Fenster entfernt. | `context-plan.ts#contextOmissionFor`, `rulebook.ts#FRAGMENTS_FOR` als angrenzende Startkontext-Auswahl | nicht-unsere-Schicht | `context-plan.ts:78–85` filtert Packs nach Quelle, Status, Harness, Modus, Trigger und Fähigkeit; `rulebook.ts:39–42` wählt Fragmente nach Publikum. Das ist keine Zusammenfassung oder Entfernung laufender Gesprächsnachrichten. |
| 3 · Anchor Reinjection | Das ursprüngliche Ziel wird während langer Arbeit regelmäßig erneut ins Fenster gestellt. | `wave-brief.ts#renderCardHead`, `server.ts#buildLaneSuccessionBrief` | teilweise | `wave-brief.ts:44–60` baut den Kartenkopf; `server.ts:6998–7019` liefert bei Nachfolge den Auftrag erneut. Ein Wiedereinspielen alle drei bis vier Turns ist damit nicht implementiert. |
| 4 · State Block | Vor einem komplexen Schritt werden Wissen, offene Fragen und nächste Handlung explizit gemacht. | `docs/controller.md` §Gebundene Program-MAIN; `server.ts#buildLaneSuccessionBrief` | teilweise | `docs/controller.md:38–41` beschreibt die abrufbare Lifecycle-Projektion; `server.ts:7003–7019` baut Auftrag, Commitstand, sauberen Baum und Übergabe. Das ist ein mechanischer Nachfolgezustand, kein selbstgeschriebener Wissensblock vor jedem Schritt. |
| 5 · Structured Over Prose | Entscheidungen, Grenzen und offene Fragen erhalten benannte Felder statt freier Absätze. | `server/types.ts#LineageObligationRef`, `server/types.ts#ProgramHandoverObligation`, `card-extract.ts#FORMAT_KEYS` | teilweise | `server/types.ts:2546–2562` strukturiert Identität und Pflichten, lässt Absicht als Text; `server/types.ts:2401–2414` trägt reichere Program-Pflichten. `card-extract.ts:407–409` strukturiert Auftragsköpfe, kein fortlaufendes Gedächtnis. Bei Linien-Watches fehlt das Ziel (Abschnitt 2). |
| 6 · Eviction Priority | Beim vollen Fenster werden unwichtige Inhalte vor alten Kernbedingungen entfernt. | `context-packs.ts#CONTEXT_PACKS`, `server.ts#writeLineageHandover` als angrenzende Priorisierung | nicht-unsere-Schicht | `context-packs.ts:91–100` markiert den Kern mit `always`/`hard`; `context-plan.ts:101–115` selektiert ohne Fenster-Eviction. `server.ts:6851–6857` entfernt überzählige abgelöste Records, keine Modellnachrichten. Das Priorisieren einer Harness-Kompaktierung liegt außerhalb dieses Mechanismus. |
| 7 · Handoff Summary | Eine feste Übergabeform überträgt Ziel, Entscheidungen, Blocker und nächsten Schritt ohne Volltranskript. | `server.ts#buildSuccessionBrief`, `server.ts#succeedLane`, `server.ts#captureProgramHandover` | teilweise | `server.ts:6754–6765` verweist auf den Record; `server.ts:7042–7050` baut die Lane-Übergabe; `server.ts:25027–25042` bewahrt Program-Watch-Details. Die generische Linie bewahrt nur IDs, die Lane akzeptiert auch fehlenden Handoff-Text (`server.ts:7000–7002`); kein allgemeines Vier-Felder-Gate. |
| 8 · Contradiction Check | Vor dem Handeln wird ein Widerspruch zu früheren Entscheidungen gesucht. | `server.ts#lineageChannelOf`; `AGENTS.md` §Loader boundary / §Hard invariants | teilweise | `server.ts:6799–6800` verweigert konkurrierende Übergabekanäle; `AGENTS.md:19–21` verlangt das Melden verbleibender Regelwidersprüche. Der Kanal-Ausschluss ist mechanisch; eine semantische Prüfung früherer Entscheidungen folgt daraus nicht. |
| 9 · Cold-Start Test | Eine frische Agentin muss allein aus dem übergebenen Zustand korrekt weiterarbeiten können. | `server.ts#lineageDraft`, `server.ts#lineageSelfView`; `e2e/self-token.ts` Nachfolgeblock | Luecke | `server.ts:6839–6840` prüft Loader-Rundlauf, `server.ts:6865–6873` Präsenz/Verlust. `e2e/self-token.ts:774–785` prüft Record-Inhalt und ausdrücklich fehlende Bodies, `:892–905` Neustart und beschädigten Record. Keine dieser Prüfungen misst eine richtige nächste Agentenhandlung. |

## 2. Saat-Befunde gegen die Quellen

### A · Bestätigt: die generische Watch-Pflicht verliert ihre Rekonstruktionsdaten

`server.ts#captureLineageObligations`, Zeilen 6818–6819:

```ts
...watches.filter((w) => w.armed && w.slot === pred.slot && w.slotOpenedAt === pred.openedAt)
  .map((w): LineageObligationRef => ({ kind: "watch", id: w.id, owedBy, reArm: "POST /api/self/watch" })),
```

`server/types.ts:2546–2551` enthält genau diese vier Felder. Das ist absichtlich geschlossen: `loadLineageHandover` akzeptiert nur die festgelegte Form (`server/types.ts:2579–2604`); der Test verweigert einen eingeschmuggelten Body (`e2e/self-token.ts:897–905`). Die ID ist deshalb nur dann ein brauchbarer Zeiger, wenn ihr Ziel lesbar weiterlebt.

Der Rückzug entfernt die ursprüngliche Watch: `server.ts:5518–5519` ruft `dropWatchesFor(s.id, why)` auf; dessen Zeile 8711 lautet:

```ts
watches = watches.filter((w) => w.slot !== slotId);
```

**Beobachtung am gelieferten Record:** `6c2548ec` und `b5d1acb8` tragen jeweils nur `kind/id/owedBy/reArm`. Die beiden Audit-SHAs stehen im `intent`: „Audits zu c483eefd und 5619800c ausstehend: ./ctl.sh watch audit <sha> neu legen.“ Die Zuordnung Watch-ID → einzelnes Audit-Ziel steht selbst dort nicht. **Codefolgerung:** Nach Entfernung der Original-Watches reicht dieser strukturierte Pflichtensatz nicht zur Rekonstruktion des Watch-Requests. Fehlt die SHA-Prosa, kann die Nachfolgerin die Audit-Beobachtung verlieren; ein rotes Ergebnis kann dadurch ungemeldet bleiben.

**Grenze der Bestätigung:** „Nirgends mehr im Zustand“, die tatsächlich ausgeführten Neuabonnements und „5619800c war rot“ sind historische Angaben des Briefs, hier nicht nachgemessen. Fleet-Events werden unabhängig vom Watch-Transport erhalten (`server.ts:8702–8704`); daher ist die umfassende Aussage über *jeden* möglichen Zustand aus der Watch-Löschung allein nicht bewiesen. Das rote Audit bleibt `unknown`, nicht widerlegt.

Das Gegenstück existiert bereits im anderen Nachfolgepfad: `captureProgramHandover` hält `kind`, Ziel-, Repo- und `mainAfter`-Felder sowie weitere Watch-Parameter in `detail` (`server.ts:25029–25036`). `ProgramHandoverObligation.detail` ist explizit typisiert (`server/types.ts:2401–2406`). Die beiden Records sind unterschiedliche Verträge; die Program-Lösung darf nicht stillschweigend als Eigenschaft der generischen Linie gezählt werden.

**Nebenbefund bestätigt:** `server.ts:6820` filtert Autos ausschließlich mit:

```ts
...autos.filter((a) => a.slot === pred.slot)
```

`Auto` hat tatsächlich kein `openedAt` (`server/types.ts:59–72`); auch `captureProgramHandover` verwendet den Slotfilter (`server.ts:25022`), und der Rückzug löscht alle Autos dieses Slots (`server.ts:5518`). Somit ist der fehlende Pin verifiziert, eine konkrete Fremdzuordnung bei Slot-Recycling aber nicht. Kein eigener Reparaturschnitt ohne belegten Gegenlauf.

### B · Bestätigt: kein Handlungsnachweis allein aus dem Record in der untersuchten Nachfolgekette

`server.ts#lineageDraft`, Zeilen 6839–6840:

```ts
const read = loadLineageHandover(JSON.parse(JSON.stringify(draft)) as unknown);
return read.ok ? draft : `succession handover could not be retained (${read.error}) — refusing rather than reporting a handover that would be lost`;
```

Der nächste Leser wird ebenfalls auf Zustandspräsenz geprüft, nicht auf Aufgabenrekonstruktion. `e2e/self-token.ts:774–778`:

```ts
check("the successor reads its line record at GET /api/self: from/to as the two occupations, lineageId, intent verbatim",
  lineB?.state === "present" && lineB.lineageId === sj.lineage?.lineageId && recB?.lineageId === lineB.lineageId
    && recB?.role === "generic" && recB.from?.slot === free && recB.from.openedAt === oldOpenedAt
    && recB.to?.slot === sj.slot && recB?.to?.openedAt === successor?.openedAt
    && recB.intent === INTENT && recB.pointer === null && recB.supersededBy === null,
```

Die Kurzform „nur lesbar“ wäre zu eng: Der Server misst auch Gründung/Zustellung (`server.ts:7296–7318`), die Tests prüfen zweite Nachfolge und Supersession (`e2e/self-token.ts:848–852`), Persistenz und expliziten Verlust (`:892–905`). Keines davon belegt, dass ein frischer Leser eine offene Pflicht richtig wiederaufnimmt. **Kosten:** Ein grüner Infrastrukturtest lässt einen semantisch unbrauchbaren Record durch; Befund A liefert den konkreten Verlustfall. Eine repo-weite Nichtexistenzaussage oder tatsächliche Erfolgsquote frischer Agentinnen wurde nicht bewiesen.

## 3. Kleinste Schnitte, nach Folgekosten geordnet

Zwei Vorschläge, keine Freigabe; die Schnittlinie liegt nach S2. Die Anzahl `Luecke` in der Tabelle ist **1**; die konkrete Datenlücke A steckt in den beiden `teilweise`-Zeilen 5/7 und wird nur einmal gezählt.

### S1 · Audit-Watch-Ziel über den Rückzug rekonstruierbar halten

- **Bezug/Kosten:** Techniken 5/7, Saat A. Eine bekannte Audit-Pflicht kann nach Rückzug nicht neu beobachtet werden; der nächste Leser muss Ziele aus Prosa oder fremden Ledgers erraten. Das hat Vorrang vor Komfort oder Tokenersparnis.
- **Kleinste Fläche:** `server.ts#captureLineageObligations/#lineageDraft/#lineageSelfView`, `server/types.ts#LineageObligationRef/#loadLineageHandover`, Nachfolgeblock in `e2e/self-token.ts`; Vertragsabschnitt Linien-Record in `docs/self-api.md`. Eng begrenzte, versionierte Referenz auf ein Audit-Ziel (Repo + SHA), kein beliebiger Body und kein allgemeines Memory-Objekt. Dies wäre eine bewusste Änderung des heutigen IDs-only-Vertrags und braucht dessen Promotion.
- **Done:** Für eine vor Rückzug bewaffnete Audit-Watch kann ein Nachfolger nach Rückzug und Neustart allein aus seiner lesbaren Übergabe den exakten `kind/repo/mainAfter`-Request bestimmen; keine Watch wird automatisch armiert. Altformat ohne Ziel bleibt lesbar und weist fehlende Rekonstruierbarkeit aus. Fremde Empfänger, ungültige Zielwerte und zusätzliche freie Payloads werden zurückgewiesen.
- **Verify:** Deterministische Fixture ohne `intent`-SHA; Original-Watch nach Rückzug nicht mehr vorhanden; erwarteten Request vollständig vergleichen. Negativfälle: Altformat, leere/malformed Ziele, falsches `openedAt`, unerlaubter Body. Ausführung über die bestehende isolierte Suite (`./e2e-isolated.sh`) plus vom Gate gewählte Kette; das Entfernen der Zielreferenz muss die Rekonstruktionsprüfung rot machen.
- **Grenze:** Andere Watch-Arten und Autos bleiben ausdrücklich ungelöst; ihre Parametersätze vor Erweiterung getrennt entscheiden. Keine automatische Neuarmierung, kein Kopieren beliebiger Gesprächsprosa. Die bestehende Program-Übergabe ist Referenz, nicht pauschal zu ersetzende Fläche.

### S2 · Record-only-Kaltstart für eine offene Audit-Pflicht messen

- **Bezug/Kosten:** Technik 9, Saat B. Ohne diese Messung bleibt unbekannt, ob S1 dem tatsächlichen Leser genügt; Infrastrukturgrün könnte erneut Handlungsfähigkeit suggerieren.
- **Kleinste Fläche:** Nachfolge-Fixture in `e2e/self-token.ts`; dokumentierter Messlauf in dieser Notiz. Erst den deterministischen Rekonstruktionsnachweis aus S1 verwenden, danach einen isolierten frischen Agentenlauf mit ausschließlich dem versiegelten Record und dem normalen API-Vertrag als Instruktion messen. Dieser Lauf ist vorgeschlagene spätere Arbeit, hier nicht ausgeführt.
- **Done:** Der frische Leser erzeugt für jede im Fixture offene Audit-Pflicht genau den erwarteten Request ohne Vorgängerhistorie oder SHA-Hinweis im Prompt; ein Fixture ohne rekonstruierbares Ziel liefert ausdrücklich `unknown` statt eines geratenen Requests. Festgehalten werden tatsächliche Eingabebytes, Modell/Harness, Antwort und exakter Soll/Ist-Vergleich. Ein fehlgeschlagener Start ist ein Probe-Fehler, kein Gedächtnisurteil.
- **Verify:** Zuerst deterministischer Request-Vergleich aus S1; anschließend versiegelter Positiv-/Negativlauf mit maschinenlesbarer Antwort und exakt geprüften Feldern. Modellverhalten bleibt eine Stichprobe, kein neues statistisches Land-Gate und kein Beweis für beliebige Aufgaben. Den echten Audit-Ausgang dafür nicht benötigen: ein isolierter Fixture-Ausgang reicht.
- **Grenze:** Nachweis nur für Audit-Pflichten; keine Behauptung über Zielverständnis, Planung oder allgemeine Aufgabenfortsetzung.

**Unterhalb der Schnittlinie:** Techniken 1/3/4/8 bleiben teilweise. Ihre möglichen Kosten sind jeweils erneute Entscheidungsrekonstruktion, Zielabweichung zwischen Starts, übersehene offene Fragen und unbemerkte Entscheidungsumkehr. Im untersuchten Material ist dafür kein eigenständiger kausaler Schadensfall gemessen; zusätzliche Ledger, Turn-Timer, Pflicht-State-Blöcke oder semantische Widerspruchsgates wären jetzt ungekostete Ausbauvorschläge. Kein dritter Schnitt. Die bei 5/7 belegten Kosten deckt S1, die Evidenzlücke S2. Techniken 2/6 bleiben Harness-Fragen; auch deren behaupteter Nutzen wurde nicht gemessen.

## 4. Ungeprüft und Nachweisgrenzen

- Kein Lesen von `fleet.json`, `.env`, privaten Regelbuchfragmenten oder Prozess-Kommandozeilen; keine externen Webabrufe. Insbesondere keine vollständige historische Zustands-/Auditforensik für die beiden Watch-IDs.
- Gelesen: die im Auftrag benannten Serverfunktionen und Typen, Kartenformat, relevante Kontextauswahl und Regelbuchzusammensetzung, Controller-Nachfolge, Tailored-Context-Prinzip und portable Regeln. Ergänzend gezielte Stellen in `wave-brief.ts` und `e2e/self-token.ts`; Suchtreffer in weiteren E2E-Familien sind keine vollständige Prüfung dieser Suiten. Graphify diente nur als Wegweiser; `rg -an` lieferte die Source auch bei der Binary-Erkennung von `server.ts`.
- Kein Harness-interner Kompaktierungsalgorithmus untersucht; keine Gegenüberstellung Claude/Codex/Pi zur Qualität ihrer Gesprächserinnerung. Fleet-Record-Serialisierung ist harnessneutral, Leserwirkung bleibt je Harness/Modell ungeprüft. Kein Clientumbau vorgeschlagen; Wire/Loader/Server/Docs/Probe sind für S1 relevant, Client und Reverse-State sind erst bei dessen Umsetzung auf tatsächliche Abhängigkeiten zu prüfen.
- `attentionSuccessorFor` bindet Attention über exakte Program-Nachfolge neu (`server.ts:10458–10466`); daraus folgt weder ein generisches Entscheidungsledger noch ein Watch-Replay. `migrateRailOf` und `laneMigrateMessage` wählen Übergaberail bzw. mahnen das Übergabeformat an (`server.ts:14793–14832`); sie prüfen kein Erinnerungsverständnis.
- Keine Wirkungsaussage aus dem Thread übernommen, insbesondere keine angebliche Halbierung von Drift. Die beiden Schnitte wurden nicht implementiert. Die Notiz ist die einzige Änderung; den Index ergänzt die Orchestratorin.
- Verifikation der Notiz: `bun e2e/pins.ts`; Ergebnis wird im Commit-/Fleet-Report mit dem tatsächlichen Tail festgehalten. Pins prüfen Repo-Verträge, nicht die semantische Richtigkeit dieser Bewertung.
