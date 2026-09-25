# Kern 4: Was ein Agent an Kontext bekommt (Befund, 2026-09-25, HEAD `07e998e9`)

**Soll diese Abstraktion existieren?** Ja. Eine Zustellschicht, die einem Agenten beim Start Auftrag, Quellen und Rückweg gibt, ist nötig. Die heutige Form löst aber ein anderes Problem als das gewollte. Sie sagt, **wo man lesen könnte**. Sie sagt nicht, **wer der Agent ist, wer auf ihn wartet und was offen ist**.

**Methode:** Code gelesen (Stellen unten zitiert), Dateigrößen gemessen, Ledger `context-receipts.jsonl` ausgewertet (die letzten 7 Tage, n=313) und Transkripte mechanisch nach Signaturstrings durchsucht: Claude-Lanes n=40/60, Main-Checkout n=30/100, Codex n=31, Pi n=30. Es wurden nur Treffer gezählt, keine Inhalte zitiert. Die Astra-Notiz `docs/messungen/2026-09-25-astra-kontext-wahrheit.md` habe ich als Behauptung gelesen. Wo ich sie nachgeprüft habe, steht das dabei.

---

## 1. Kontextkarte (Rolle × Quelle × Größe × automatisch geladen)

| Rolle / Harness | Quelle | Größe | Automatisch geladen? | Beleg |
|---|---|---|---|---|
| **Claude-Lane** | `~/.claude/CLAUDE.md` (global) | 8.090 B | **ja** | 15/15 Lane-Transkripte |
| | Worktree-`CLAUDE.md` = Lane-Render (3 von 7 Fragmenten + Rückverweis) | **21.456 B / 245 Z.** | **ja** | 40/40 Transkripte tragen „Du hast die LANE-Fassung“; `server.ts:6441-6446`, `rulebook.ts#FRAGMENTS_FOR` |
| | Fleet-`MEMORY.md` | 11.938 B / 50 Einträge | **ja** (auch in Worktrees) | 39/40 Lane-Transkripte, als `attachment/instructions` |
| | `AGENTS.md` (portabler Vertrag) | 31.496 B, davon §Portable 18.759 B | **nein** | 0/40 enthalten den Dateikopf; Pflichtlektüre laut Loader nur in **6/60** Lanes als Tool-Read belegt |
| | Brief (Auftrag + Notizen + Quellauszug + Studio + Anker + Footer + Memory-Zeiger) | Median **11.592 B**, max. 30.917 B | ja (Paste) | Ledger, 313 Zeilen |
| | – davon Ankerblock (4 Zeiger) | ~988 B | ja | nachgerendert aus `context-plan.ts#planContext` + `.fleet/context-packs.json` |
| | – davon Quellauszug | Median 6.879 B, wenn vorhanden (148/313) | ja | `receipt.snippet.bytes` |
| | – davon Notizvorschauen | in 125/238 Zeilen | ja | `receipt.notes` |
| | `~/.claude/knowledge/` | 65 Dateien, 397.550 B | nur ein Zeiger im globalen CLAUDE.md | Tool-Calls in 2/100 Fleet-Sessions |
| **Codex-Lane** | `~/.codex/AGENTS.md` | 4.699 B | **ja** | 22/22 |
| | `AGENTS.md` | 31.496 B | **ja** | 27/31 |
| | Worktree-`CLAUDE.md` | 21.456 B | geschrieben, **nicht geladen** | `~/.codex/AGENTS.md` sagt das selbst |
| | Fleet-`MEMORY.md` | – | **nein** | 0/31 |
| **Pi-Lane** | `AGENTS.md` | 31.496 B | laut Regelbuch ja (`b3c08e6`), **von mir nicht belegbar** | der Systemprompt steht nicht im Pi-Sessionlog; 12/30 lesen ihn per Tool |
| | Fleet-`MEMORY.md` | – | **nein** | 0/30 |
| **Claude-MAIN / Orchestratorin** | global + Voll-Render `CLAUDE.md` + `MEMORY.md` | 8.090 + **78.352 (841 Z.)** + 11.938 = **98.380 B** | ja | Render byte-gleich zu den 7 Fragmenten (gemessen) |
| | `AGENTS.md` §Portable | 18.759 B | nein; gelesen in **1/30** Main-Checkout-Sessions | Tool-Result-Probe |
| | Gründungsbrief | laut Astra 3,2–12 KB | ja | **nicht nachgemessen** |
| alle | `docs/` | 571 .md, 13,07 MB; `self-api.md` 333.753 B, `verify-tiering.md` 403.156 B, `messungen/INDEX.md` 129.438 B | nein, nur als Zeiger | `wc -c` |
| alle | `HANDOFF.md` / `state.sh` / `register.sh` | 56.929 / 40.361 / 22.222 B | nein; im MAIN-Brief als Schritt 1/2 genannt | `server.ts:31849-31850` |

**Summe automatisch (Bytes, ohne Toolschema/Systemprompt):** Claude-Lane ≈ 41,5 KB + Brief, Codex-Lane ≈ 36,2 KB + Brief, Claude-MAIN ≈ 98,4 KB + Brief. **Die drei Harnesses bekommen verschiedene Grundlagen:** Claude bekommt Overlay und Memory, aber keinen Vertrag. Codex bekommt den Vertrag, aber kein Memory und kein Overlay.

---

## 2. Anreicherung: was sie tut und was gewollt ist

**Was sie tut** (`server.ts#briefAndSend`, Verkettung `server.ts:15478`):
`deliveredBrief = brief + notesBlock + snippetBlock + studioLaneBlock + anchorBlock + laneExitFooter + memoryPointer`. Danach schreibt sie eine Receipt-Zeile. Der Anteil, der sich je Aufgabe ändert, sind **Quellauszug** (`context-snippets.ts`, 148/313) und **Notizvorschauen** (125/238). Der Teil, der „Context“ im Namen trägt (ContextPlan, Packs, Manifest, Validator, zusammen ≈ 51 KB Code), liefert **fast immer denselben Block von ~988 B mit vier Zeigern**:
- 213/313 Zustellungen tragen genau `portable-core, verify-e2e, rulebook-generat, messnotiz-index`.
- 31/313 tragen zusätzlich das Program-Pack `grammatik` (ein einziges Program nutzt das Feature).
- 69/313 sind leer (Fremd-Repo).
- Die Dispatch-Trigger sind konstant `["always","verification"]` (`server.ts:15100`). Bootstrap nutzt dieselben (`server.ts:31192`).

**Gewollt** (Owner): Jeder Agent versteht das System und **seine Position darin**, und das Gedächtnis hält Wissen über Sitzungen und Harnesses hinweg.

**Wo das gegeneinander läuft:**
1. Die Anreicherung sagt, **wo gelesen werden könnte**. Wer der Agent ist, wer wartet und was offen ist, sagt sie nicht. Der Footer nennt „your coordinator“, ohne Namen oder Slot (`server.ts#laneExitFooter`).
2. Sie wirkt **pro Zustellung, nicht pro Session**. Eine Lane-Nachfolge bekommt keinen Anker-, Auszugs- oder Notizblock (`server.ts#buildLaneSuccessionBrief:10172-10260`, 0 Treffer; nur `memoryPointer`). Astra-Befund 7 ist bestätigt.
3. Sie sitzt **auf einer Grundlage, die je nach Harness verschieden ist** (Karte oben). Ihr einziges `hard/always`-Pack, `portable-core`, zeigt auf den Vertrag, den Claude nicht lädt.
4. Sie **quittiert Auswahl, nicht Wirkung**. Das Receipt belegt Zustellung (`readByAgent: unknown`, korrekt benannt). Das Receipt ist außerdem Berechtigungsbasis: Welche Notizen eine Lane lesen darf, wird aus den Receipts abgeleitet (`server.ts#laneNoteIds:6685`). Die Zeile ist also mehr als eine Quittung.

---

## 3. Befunde (gerankt nach Wirkung, max. 10)

| # | Befund (verifiziert, wenn nicht anders markiert) | Kosten |
|---|---|---|
| **1** | **Der portable Vertrag erreicht den häufigsten Harness nicht.** Claude lädt `AGENTS.md` nicht (0/40 Lanes). Die Loader-Pflicht „einmal §Portable lesen“ (`rulebook/loader.md`, `AGENTS.md:8-14`) ist in 6/60 Lanes und 1/30 Main-Sessions erfüllt. Claude stellt 185/313 Zustellungen (Ledger `harness:null` = Default). Genau dieser Abschnitt trägt Rollen-Ebenen, Rückkanäle und harte Invarianten (`AGENTS.md:22-245`). | Die Mehrheit der Agenten arbeitet ohne den Text, der ihre Position beschreibt. *Gefolgert:* Das passt zu Astra-Befund 1 (falsche Türen/Header). Kausal ist das nicht bewiesen. |
| **2** | **Positionsfakten existieren, werden aber nicht ausgeliefert.** `GET /api/self` (`server.ts:38347-38368`) liefert slot, label, cwd, mission, awaiting, lane{repo,branch}, autos, watches, events und lineage. Es fehlen **taskId, programId, Rollenbindung, Empfänger bzw. MAIN-Slot, harness/model**, obwohl der Slot `taskId`/`programId` trägt (`server.ts:15380`, `free.programId`). | „Wer bin ich / wer wartet auf mich“ muss der Agent sich zusammensuchen oder raten. Jeder Fehlversuch kostet Turns. Mehr Pflichtlektüre hilft da nicht. |
| **3** | **Die Anreicherung ist statisch, und die Maschinerie ist teils Regalware.** 3 von 6 Triggern haben seit dem Entscheid vom 19.08. keine Aufrufstelle, die sie erreicht (`task-queue`, `harness-selection`, `deployment`; `grep` zeigt nur `always`, `verification`, `landing` bei `server.ts:28545`). Damit sind die Packs `task-queue`, `harness-adapter` und `private-deploy-overlay` nie wählbar (0/313). Den offenen Owner-Punkt dazu nennt `docs/attic/entscheid-kontext-anreicherung-2026-08-19.md` §3. | ≈ 51 KB Planungscode und ein 2,35-MB-Ledger für einen konstanten 988-B-Block. Der Name „tailored“ verspricht Maßanfertigung, die an dieser Stelle nicht passiert. |
| **4** | **Zeiger mit falscher Größe und zu alten Zielen.** `estimatedBytes` wird nur auf `≥0` geprüft (`context-pack-validator.ts:213`). Deklariert gegen gemessen: portable-core **3.800 → 18.759** (×4,9), messnotiz-index **11.700 → 129.438** (×11), verify-e2e **6.313 → ~27.957**. `rulebook-generat` zeigt auf ein Inventar mit Stand 2026-08-18. `rulebook-generat` und `messnotiz-index` haben `triggers:["always"]`, ihr `useWhen` sagt aber „Bevor du änderst/misst“ (`.fleet/context-packs.json:4-7,23-26`). | Wer allen vier Zeigern folgt, liest ~205 KB. *Gefolgert:* bei ~4 B/Token etwa 50k Token, also ~20 % eines GPT-Fensters von 258.400. Die Größenangabe verleitet zum Folgen. |
| **5** | **Das Regelbuch widerspricht sich und dem Code.** (a) `rulebook/self-scheduling.md:28` „terminiere einen Check-in, bevor du wartend idle gehst“ gegen den Footer „Do not poll … and do not schedule a check-in“ (`server.ts#laneExitFooter`). Beides steht in jeder Claude-Lane. (b) `rulebook/einstieg.md:31` „keinen eingehenden Kanal“ gegen den Footer „any answer arrives in this pane on its own“. (c) `rulebook/supervisor.md` enthält „KORRIGIERT: der mechanische Schnitt EXISTIERT“ und in Z. 25 „bis der mechanische Schnitt existiert“. (d) Kommentar `server.ts:6436` „~29 KB instead of ~62“, tatsächlich 21.456 / 78.352. *Heuristik:* 64 % der Voll-Render-Bytes stehen in Absätzen mit Datum, 44 % in Absätzen mit Wörtern wie „bezahlt/gemessen/überholt“. | Laut Loader-Vertrag stoppt jeder echte Widerspruch die Arbeit. Praktisch muss der Agent selbst entscheiden, welche Regel gilt. MAINs zahlen ~78 KB, großteils Messgeschichte. |
| **6** | **Globale Claude-Regeln stehen gegen Fleet-Regeln, und die globalen gewinnen den Ladeweg.** `~/.claude/CLAUDE.md` (in 15/15 Lanes) sagt: „/handoff bei ~60 %“ und „Auto-compaction at ~83%“. Das Fleet-Regelbuch sagt: Band 25/30, „83-%-Klippe ist kein Zielband“, HANDOFF nur bei echter Nachfolge (Regel A). Global steht außerdem „Co-Authored-By: Claude Opus 4.6“ und „Prompts über sharpen.md kompilieren“. Der Vorrang (portabler Vertrag > globale Defaults) steht in `AGENTS.md`, und das lädt Claude nicht (Befund 1). | Die Regel, die verliert, ist im Kontext. Die Regel, die gewinnt, ist es nicht. |
| **7** | **Memory weiß nichts von Rolle, ist an einen Harness gebunden und hat keinen Ablösungsmechanismus.** `MEMORY.md` (11.938 B) geht an jede Claude-Session, Lanes eingeschlossen. Mindestens 23 von 50 Zeilen sprechen Orchestratorin/MAIN/Queue/Deploy an (Stichwortzählung). Codex bekommt 0/31, Pi 0/30. Es gibt zeitliche Widersprüche ohne `superseded`-Feld: MEMORY „Worker auf GLM-5.3-Flash“ (24.09.) und „alles auf Sol bis 30.09.“ (25.09.) gegen `rulebook/einstieg.md:162` „Opus 5 für jede LANE“ (22.09.). | Lanes tragen Orchestrator-Präferenzen als Ballast. GPT-/GLM-Worker sehen keine Owner-Korrektur. Welche Modellpolitik gilt, muss der Agent selbst entscheiden. |
| **8** | **Das Gedächtnis ist über Speicher ohne gemeinsamen Ort verstreut.** 14 Projekt-Memories. Das Home-Projekt `-Users-owner` hat **388 Dateien** (167 project / 167 feedback / 53 reference), `MEMORY.md` 17.540 B, 21 Dateien erwähnen Fleet, und nichts davon erreicht Fleet-Sessions (0/20). Maschinenfakten (Second-host/Codex/Astra/Tailscale) liegen in 10 Home- **und** 21 Fleet-Dateien. `~/.claude/knowledge` (397 KB) wird in 2/100 Fleet-Sessions benutzt. Fleet-Memory hat 24 Projekt- und 2 Referenzdateien in `attic/` ausgelagert (Disziplin vom 25.08.). | Projektübergreifende Fakten haben zwei Heimaten, die auseinanderlaufen. Was im Home-Projekt korrigiert wird, sieht Fleet nie. |
| **9** | **Nachfolge verliert die Quellenentscheidung** (Astra 7, am Code bestätigt, siehe §2.2). | Die Nachfolgerin sucht die Quellen erneut oder arbeitet ohne Auszug. |
| **10** | **Referenzdokumente sind zu groß, um sie zu lesen.** `docs/self-api.md` (die Tür-Referenz) 333.753 B, `docs/verify-tiering.md` 403.156 B, `HANDOFF.md` 56.929 B, obwohl nur der oberste Abschnitt gelten soll. | Ein Verweis „siehe self-api.md“ lässt sich für einen 258k-Harness praktisch nicht befolgen. Die Tür-Fehler aus Befund 2 lassen sich damit nicht billig beheben. |

**Schnittlinie:** 1, 2 und 5–7 bestimmen, ob ein Agent seine Position kennt. 3, 4 und 8–10 bestimmen Ballast und Budget.

---

## 4. BLEIBT

- **Quellauszug** (`context-snippets.ts#buildSnippetPackage`): aufgabenspezifisch, versionsgebunden, benennt seine Auslassungen. Das ist der Teil, der tatsächlich anreichert (148/313, Median 6.879 B).
- **Notiz-Join** mit expliziter Pinnung (`task-notes.ts`, `server.ts` N3).
- **Receipt als Provenienz- und Join-Schlüssel** (`briefHash` gegen LaneOutcome; `laneNoteIds`). Dazu die Ehrlichkeit `readByAgent: unknown`.
- **`/api/self/memory` als Zustandsleser mit explizitem `unknown`.** Er wird genutzt: Tool-Calls in 19/100 Sessions, der Zeiger kostet ≤ 512 B.
- **Lane-Render** (21 KB statt 78 KB) mit benanntem Rückverweis (`rulebook.ts#renderBackref`).
- **Lebensdauer der Program-Packs** am Program (`context-plan.ts#planProgramContext`).
- **Die drei Akte im `laneExitFooter`** (commit → report → idle): eindeutig, im Brief enthalten.

## 5. ÄNDERN (gerankt)

1. **Den Vertrag auch an Claude liefern.** Entweder `@AGENTS.md`-Import im Render oder §Portable in den Lane-Render aufnehmen. Danach die Loader-Pflicht streichen, weil der Vertrag dann automatisch da ist. Abnahme: 40/40 Claude-Lanes enthalten den Vertrag ohne Tool-Read.
2. **Das Positionsfeld in `GET /api/self` ergänzen und in den Brief rendern:** taskId, programId, Rolle, Empfänger-Slot/-Rolle, harness/model und eine „erste funktionierende Tür“ als Beispiel.
3. **Widersprüche auflösen:** für Warten/Check-in genau eine Regel je Rolle. `supervisor.md` bereinigen. Geschichte aus dem Pflicht-Render in `docs/attic/` verschieben.
4. **Globales `~/.claude/CLAUDE.md` bereinigen:** Handoff-/Kompaktierungs-Schwellen und die Attributionszeile auf „Projekt entscheidet“ zurücknehmen.
5. **Packs ehrlich machen:** die drei toten Trigger streichen oder verdrahten. `rulebook-generat` und `messnotiz-index` an Akt-Trigger binden statt an `always`. `estimatedBytes` aus dem Blob messen statt deklarieren.
6. **Memory nach Rolle und Harness trennen:** Owner-Korrekturen mit `scope` (Rolle/Harness/Projekt), `supersedes` und Datum. Rollen-Einträge nicht in Lane-Sessions laden.
7. **Nachfolge plant die Quellen neu** (derselbe Plan-Aufruf wie beim Dispatch).

## 6. FEHLT

- **Ein Lagebild „wer bin ich, wem antworte ich, was ist offen“**, harness-neutral und beim Start ausgeliefert (Befund 2).
- **Parität der Basisschicht** zwischen Claude, Codex und Pi (Befund 1/7).
- **Ein harness-neutraler Speicher für promovierte Owner-Korrekturen** (heute nur Claude-Dateien, nur für dieses Projekt).
- **Ein Zuhause für projektübergreifende Fakten** (Maschinen, Accounts, Modelle, Kontingente). Heute liegen sie in Home- und Fleet-Memory doppelt.
- **Ein Wirkungssensor:** Ob ein Zeiger gelesen wurde, ließe sich mechanisch aus Transkripten ableiten (wie in diesem Bericht). Das Receipt kennt es nicht.
- **Ein Ablösemechanismus** für Regeln und Memory (`supersedes`, Gültigkeit „bis“).

## 7. Memory-Inventar und Lücken

| Art | Wo | Umfang | Wer liest | Lücke |
|---|---|---|---|---|
| Owner-Feedback (Korrekturen, Präferenzen) | `~/.claude/projects/-Users-owner-claude-fleet/memory/feedback-*` | 43 Dateien | nur Claude-Sessions im Repo (auch Lanes) | kein Scope, kein `supersedes`, nicht für Codex/Pi |
| Referenz (Maschinen, Modelle, Pakete) | ebenda `reference-*` | 7 (+2 im attic) | wie oben | teils doppelt im Home-Memory |
| Projektzustand | Fleet: ausgelagert nach `attic/` (24) → `docs/`, Commit-Bodies, `state.sh` | – | per Tool | ok nach der Disziplin vom 25.08. |
| Home-Memory | `-Users-owner/memory` | 388 Dateien, `MEMORY.md` 17,5 KB | nur Sessions mit cwd `$HOME` | 21 Fleet-bezogene Dateien, die Fleet nie sieht |
| Andere Projekte | 12 weitere Verzeichnisse | 2–15 Dateien je Projekt (Themen: [privates Owner-Repo], private-repo-o, content-pipeline, private-repo-p, private-repo-ad, Spiele …) | nur das jeweilige Projekt | Fleet-Betriebswissen (Präfix `fleet-*`) liegt in ≥ 6 fremden Projekt-Memories |
| Regeln | `AGENTS.md`, `rulebook/` → `CLAUDE.md`, `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | 31,5 + 78,4 + 8,1 + 4,7 KB | je Harness verschieden | Widersprüche zwischen den Schichten (Befunde 5/6) |
| Arbeitsstand | `/api/self/memory` (`server.ts#memoryWorkView`) | Projektion | alle Harnesses per HTTP | heißt „Memory“, ist aber ein Zustandsleser |
| Handwerkswissen | `~/.claude/knowledge/` | 65 Dateien, 397 KB | Claude, per Zeiger | in 2/100 Sessions benutzt |

## 8. Benennungsvorschläge

| Heute | Was der Code tut | Vorschlag |
|---|---|---|
| Kontext-Anreicherung | Brief plus angehängte Blöcke plus Protokoll (`briefAndSend`) | **Startzustellung** |
| ContextPlan / „ContextPlan v2 anchors“ (so steht es im Agententext) | eine faktisch konstante Zeigerauswahl nach Filterleiter | **Zeigerauswahl**; die Kopfzeile für den Agenten: „Weiterlesen, falls nötig:“ |
| ContextPack | benannte Zeigergruppe mit Metadaten | **Zeigerprofil** |
| `estimatedBytes` | ungeprüfte Behauptung | **declaredBytes**, oder gemessen als `sourceBytes` |
| Quellpaket / snippet | echter, versionsgebundener Code-Auszug, die eigentliche Anreicherung | **Quellauszug** |
| Receipt | Zustellprotokoll **und** Berechtigungs-/Join-Basis | **Zustellprotokoll** |
| „YOUR MEMORY“ / `/api/self/memory` | Zustandsleser über Task, Program und Belege | **Arbeitsstand** (`/api/self/state`) |
| `MEMORY.md` (Claude) | Owner-Korrekturen, nur für einen Harness | **Owner-Korrekturen**, mit Scope |
| Regelbuch / `CLAUDE.md` | Betriebsregeln + Messgeschichte + Host-Fakten | **Betriebshandbuch** (Regeln) + **Archiv** |
| AGENTS.md „the short rulebook that travels“ | 31,5 KB, reist nicht zu Claude | **Betriebsvertrag** (dann auch für Claude laden) |
| portable-core | Zeiger auf den Vertrag | **Betriebsvertrag** |
| Brief | Auftragsprosa oder das ganze zugestellte Paket, je nach Stelle | **Auftrag** (Prosa) vs. **Startzustellung** (Paket) |
| „your coordinator“ | unbenannter Empfänger | **Empfänger: <Rolle> Slot <n>** |

## 9. Nicht geprüft

- **Pi-Autoload von `AGENTS.md`:** Der Systemprompt steht nicht im Pi-Sessionlog. Die Behauptung aus dem Regelbuch bleibt unbelegt.
- **Laden von `.claude/CLAUDE.md` (226 B)** durch Claude: nicht per Transkript geprüft.
- **Größen der Gründungsbriefe** für MAIN, Orchestratorin und Supervisor: Astra-Zahlen übernommen, nicht nachgemessen. Die sessionbezogenen Fehlgriffe aus Astra (`01a08013:t8` usw.) wurden nicht erneut ausgewertet.
- **Ausgabegröße von `state.sh`/`register.sh`:** nicht ausgeführt, weil `register.sh` eine Schreibumleitung enthält.
- **Toolschema und Systemprompt:** nicht gemessen. Alle Angaben sind Bytes, keine Tokens. Die Tokenzahl in Befund 4 ist gefolgert.
- **Geschichtsanteil des Regelbuchs (64/44 %):** Heuristik über Datum und Stichworte, keine Absatzklassifikation.
- **Nicht gelesen:** `context-snippets.ts` (nur Commit-Bodies) sowie `context-manifest.ts` und `context-pack-validator.ts` (nur per grep). `wave-brief.ts` nur teilweise. Inhalte fremder Projekt-Memories nicht gelesen, nur gezählt.
- **Transkript-Proben sind Stichproben:** die jeweils neuesten 40/60/100 Dateien. Die Treffer „liest AGENTS.md“ zählen Tool-Results mit einem Signaturstring. Ein Read mit Offset hinter der Signatur würde nicht erkannt.
