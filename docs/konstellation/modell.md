# Konstellation: Systemmodell

Stand 19.10.2026, Branch `bau/konstellation`. Auftrag der Orchestratorin nach dem Owner-Wort von 20:5x:
„[Zitat entfernt]“
 Vorarbeit: `~/local-notes/grok-auswertung/antwort-konstellation.md` und
`grok-auswertung.md`. Alle Code-Orte sind am Stand `053e19928` gelesen.

**In einem Satz:** Fleet hat fast alle Teile schon. Ein Agent ist heute das K15-Profil, aber eine Tür
nimmt beim Start nur einen Teil davon mit. Die Kanten sind fest im Server verdrahtet statt in der
Konstellation gespeichert. Und keine laufende Session weiß, auf welcher Position sie sitzt.

## 1 · Die Bausteine, die es gibt

| Baustein | Was er heute ist | Code-Ort |
|---|---|---|
| **Session / Slot** | ein Platz (1–16) mit einer Belegung: `cwd`, `label`, `openedAt`, Self-Token | `server/types.ts:2059` (`interface Slot`), geöffnet von `server.ts#openSlot` |
| **Harness** | welches Programm in der Pane läuft (Claude Code, Codex, pi …) | `server.ts:2073` (`HARNESSES`), `Slot.harness` (`server/types.ts:2085`) |
| **Modell / Effort** | Felder am Slot, beim Öffnen geprüft | `server.ts:2158` (`modelOf`), `:2192` (`effortOf`), `Slot.model`/`effort` |
| **Profil** | Agent mit Harness, Modell, Effort, Schwelle, Schaltern, Autonomie und Agent-MD, nur im Fenster „Neue Session“ und im K15-Speicher | `src/k15-entwurf-modell.ts:25` (`Profil`), Fleet-Profile `:59` (`PROFILE0`) |
| **Rechte** | eine Stufe (lesen/bauen/landen/deployen) und Befehle an/aus, als Claude-Code-Regeln beim Start | `session-rechte.ts:8-26`, `server/rechte.ts`, `Slot.rechte` (`server/types.ts:2120`). Laut `session-rechte.ts:24` ein „weicher Zaun“ |
| **Context Packs** | Wissensblöcke, die der Gründungsplan je Rolle liefert | `context-packs.ts:232` (`CONTEXT_PACKS`), Plan über `GET /api/founding-plan` (`server.ts:52277`), Bausteine in `session-blocks.ts:49` |
| **Agent-MD** | eigene .md eines Profils oder einer Position, im Fenster geschrieben | `src/k15-agentmd.ts`, Feld `Profil.datei` |
| **Postfach und seine Regeln** | adressierte Nachrichten; der Absender ergibt sich aus der Bindung | `server.ts:17015` (`messageSenderFor`), `:17191` (`sendMessageFor`), Route `/api/self/messages` (`:48536`) |
| **Branch und Öffner** | Board-Branch mit Ziel; wer ihn per Self-Token geöffnet hat, steht im Branch-Buch. Seit Stück 2 trägt jeder geöffnete Slot `openedBy` | `server/branches.ts:43` (`opener`), `server/opener.ts:9`, `Slot.openedBy` (`server/types.ts:2119`) |
| **Program / MAIN / Lane** | Program = Klammer um Aufgaben, MAIN = an ein Program gebundene Session, Lane = Slot mit eigenem Worktree | `server.ts:16612` (`mainBindingOf`), `Slot.worktree` (`server/types.ts:2080`) und `programId` (`:2140`) |
| **Rollen** | vom Server abgeleitet, nicht gespeichert: Orchestratorin am Label, MAIN an der Program-Bindung, Lane am Worktree, sonst `generic` | `server.ts:20130` (`positionRole`), `:42061` (`isOrchestratorLabel`) |
| **Testinstanz** | eigene Fleet je Worktree mit Fixtures | `testinstanz.sh`, `testinstanz-fixtures.js`, `docs/testinstanz.md` |
| **Export / Import (K15)** | JSON `format: 1` auf vier Ebenen, Import prüft alles; seit Stück 1 auch der Server-Speicher für Konstellationen | `src/k15-entwurf-modell.ts:540` (`exportObjekt`), `src/k15-import.ts:131` (`importKonst`), `src/k15-speicher.ts:9-13` |
| **Konstellation (Entwurf)** | Baum von Positionen, jede zeigt auf ein Profil; Fleet-Vorlagen | `src/k15-entwurf-modell.ts:39-47` (`Position`, `Konst`), `:76` (`KONST0`) |
| **Konstellation (laufend)** | Ansicht, aus Bindungen abgeleitet | `src/konstellation-model.ts:35` (`constellation`) |
| **Start-Türen** | fünf Routen, je nach Profil: `/api/slots/:id/open`, `/api/lanes`, `/open-worktree`, `bootstrap-main`, `/api/branches/open` | `src/start-tuer.ts:3-5`, Wahl in `src/k15-start.ts:36` (`tuerVon`) |

## 2 · Die Zielbegriffe des Owners

**Agent (frei einstellbar)**
- *Trägt heute:* das Profil (`k15-entwurf-modell.ts:25`). Harness, Modell, Effort und Rechte kommen über die Tür auch an.
- *Heißt nur anders:* „Profil“ im Fenster, „Rolle“ in der Liste („Rollen · Profile“, `k15-spalte1.ts`).
- *Fehlt:* Agent-MD, Autonomie, Werte und Übergabe-Schwelle nimmt keine Tür mit. Das Fenster sagt das selbst (`src/k15-start.ts:72-89`, `nichtMit`). Das Profil liegt außerdem nur im Fenster-Speicher. Der Server kennt es beim Start nicht.

**Konstellation (Agenten plus Kanten, locker bis streng)**
- *Trägt heute:* `Konst` mit Positionen; seit Stück 1 am Server gespeichert, exportier- und importierbar.
- *Anders zusammenstecken:* Der Entwurf (K15) und die laufende Ansicht (`konstellation-model.ts`) sind zwei getrennte Bäume. Der laufende wird geraten, aus Label, Program und Anker.
- *Fehlt:* die **Bindung**, also welcher Slot auf welcher Position sitzt (Lücke L4/L8 aus der Vorarbeit). Außerdem fehlt das **Starten als Einheit**: „mehrere Sessions als Einheit startet Fleet noch nicht“ (`src/k15-start.ts:145`). „Locker“ oder „streng“ ist heute keine Einstellung. Es ergibt sich aus den festen Regeln.

**Kante (Auftrag, meldet, liest)**
- *Trägt heute, verstreut:*
  - **Auftrag:** Program → Lane (`programId`), Session → Lane (`worktree.anchor`), Öffner → Branch-Session (Branch-Buch) und seit Stück 2 Öffner → Session (`openedBy`).
  - **meldet:** Lane → MAIN (fleet-report), freie Session → Orchestratorin (`server.ts:17225-17232`) und das Branch-Paar in beide Richtungen (`:17171`, `branchPeers`).
- *Anders zusammenstecken:* Das sind heute Regeln im Code von `sendMessageFor`, keine Daten. `Position.kids` legt Auftrag und Meldung in eine Kante zusammen (`k15-entwurf-modell.ts:39`). Querkanten gibt es nur als Freitext `quer` (`:44`).
- *Fehlt:* **liest** gibt es gar nicht. Eine Session darf das Ergebnis einer anderen nur über eine Datei oder über die MAIN bekommen.

**Vorlage**
- *Trägt heute:* `PROFILE0` und `KONST0`, gekennzeichnet mit „Fleet“; eine geänderte Vorlage wird beim Speichern eine eigene (Stück 1).
- *Heißt nur anders:* „Fleet-Vorlage“ und „mitgeliefert“.
- *Fehlt:* nichts Wesentliches. Die heutigen Server-Regeln wären die Vorlage „streng“, sobald es Kanten als Daten gibt.

**Teilen**
- *Trägt heute:* Export und Import als Datei oder ⌘V, mit Prüfung und Grenzen (`k15-import.ts:131`). Das Profil reist bei „vollständig“ mit.
- *Fehlt:* Vor dem Start muss man sehen, was eine fremde Konstellation erlaubt: Rechte, Agent-MDs und Befehle. Dazu kommt eine feste Grenze: Eine geteilte Konstellation darf Kanten setzen, aber keine Identität und kein Gate. Der Absender ergibt sich weiter nur aus der Bindung (`server.ts:17198`), Landen läuft nur über den Server-Job.

## 3 · Wie die Teile neu zusammenhängen

```
          Vorlage (Fleet) ──kopieren──┐
                                      ▼
   Profil = Agent ───────────► Konstellation ◄──── Import / Export = Teilen
   Harness · Modell · Effort     Positionen → Profil
   Rechte · Packs · Agent-MD     Kanten {von, nach, art}
   Autonomie · Schwelle          art = auftrag | meldet | liest
            │                    Stil = locker … streng (welche Kanten erlaubt)
            │                           │
            │      Start (eine Tür)     │ Bindung
            ▼                           ▼
        Slot / Session ◄────── position {konst, pos} + openedBy
            │
            ▼
   Server-Regeln lesen die Kanten der Bindung:
   Postfach (wer wem schreibt) · Rückfrage-Kette · Kontext-Zeiger (liest)
   fest bleiben: Absender aus Bindung · Landen über Server-Job · Owner-Schlüssel
```

Die Änderungen, je ein Satz:

1. **Ein Profil liegt am Server, und die Tür nimmt es ganz:** `POST /api/slots/:id/open` bekommt eine Profil-Kennung, und Agent-MD, Autonomie, Werte und Schwelle kommen damit an, statt im Fenster als „käme nicht an“ zu stehen.
2. **Der Slot weiß, wo er sitzt:** Neben `openedBy` trägt er `position {konstId, posId}`, gesetzt von der Tür, die ihn für eine Konstellation öffnet.
3. **Kanten werden Daten:** `Konst` bekommt eine Liste `{von, nach, art}`, und `kids` bleibt nur noch die Kurzform für „auftrag und meldet“.
4. **Die Nachrichtenregeln fragen die Kanten:** `sendMessageFor` erlaubt, was eine `meldet`-Kante der gebundenen Konstellation erlaubt. Eine Session ohne Bindung bleibt bei den heutigen Regeln, die als Vorlage „streng“ gespeichert sind.
5. **Öffner und Branch-Paar werden eine Kante:** `openedBy` ist die Laufzeitform von „auftrag“. Damit wird das Branch-Paar (K13, `branchPeers`) zum Sonderfall einer Kante „Öffner ↔ Geöffnete“, statt eine eigene Regel zu sein.
6. **„liest“ ist ein Zeiger, keine Nachricht:** Eine `liest`-Kante gibt der Session einen Kontext-Zeiger auf Berichte oder Dateien der anderen. Dafür braucht es weder Zustellbudget noch Autorität.
7. **Rolle wird eine Eigenschaft des Profils:** Das Profil sagt Orchestratorin, MAIN, Lane oder frei. Der Server leitet die Rolle dann nicht mehr aus dem Label ab (`isOrchestratorLabel`). Program-Bindung und Worktree bleiben die Belege dafür.
8. **Starten als Einheit:** Startet eine Position, öffnet sie ihre Kinder über dieselbe Tür mit ihrem Self-Token. Jedes Kind bekommt dabei `openedBy` und `position`.
9. **Die laufende Ansicht liest die Bindung:** `konstellation-model.ts` zeichnet den gespeicherten Aufbau mit den Slots, die darauf sitzen, und rät nur noch für Sessions ohne Bindung.
10. **Teilen zeigt vor dem Start, was erlaubt wird:** Ein Import listet Rechte, Befehle und Agent-MDs je Position auf, bevor etwas startet.

## 4 · Produktbild (Owner 19.10., nach dem Modell)

Der Maßstab des Owners: wie ein Experte bauen, also vorhandene Mechanismen erweitern statt anlagern, mit
sauberen Modulen und Prüfungen mit Gegenprobe. Die Attrappe der Teile 1 und 2 läuft auf der Testinstanz
unter `#attrappe` (`src/attrappe.ts`, ohne Backend, zum Wegwerfen).

**1 · Eine gute Ansicht „Neue Session“.** Agent-MD und Einstellungen an einer Stelle, am Ende auf Wunsch
„als Profil speichern“, dazu eine Historie gestarteter Sessions, aus der man neu startet oder ein Profil macht.
- Braucht Änderung **1**: das Profil am Server, die Tür nimmt es ganz. Ohne das wäre „als Profil speichern“
  ein Profil, von dem beim Start die Hälfte nicht ankommt.
- Braucht Änderung **7**: die Rolle als Teil des Profils, damit die Ansicht keine Rolle aus dem Label errät.
- Die Historie ist keine neue Ablage: Sie ist die Liste der Start-Quittungen (`Slot.plan`,
  `server.ts:41223` `writePlanReceipt`), erweitert um das Profil und seine Fassung.

**2 · Eine Systemansicht.** Was gerade läuft, in welcher Konstellation; beim Konfigurieren wählt man fertige
Profile, und ein leerer Kasten mit Plus fügt ein Profil als Session ein.
- Braucht Änderung **2** (Bindung Slot ↔ Position) und **9**: Die Ansicht liest die Bindung statt zu raten.
- Braucht Änderung **3** (Kanten als Daten), damit der Plus-Kasten weiß, unter wem die Session hängt und an wen sie meldet.
- Braucht Änderung **8** (Start als Einheit), damit „hinzufügen“ in einer laufenden Konstellation wirklich eine Session öffnet.
- Braucht Änderung **5**: `openedBy` gibt es schon (Stück 2). Es wird die Kante, die eine hinzugefügte Session bekommt.
- Das Objekt Konstellation gibt es schon am Server (Stück 1). Die Ansicht „Konstellation“ und das Fenster
  „Neue Session“ werden dabei eine Ansicht, nicht zwei.

**3 · Auswertung als Standard.** Jede Konstellation endet mit einem Agenten, der den Lauf unter Fleet-Gesichtspunkten
auswertet: Nachrichtenprotokolle, Anweisungen, Ergebnisse. Dazu kommt ein Context Pack, das einem Agenten erklärt,
wie er sein Layout ausbaut. Der Owner nennt das „[Zitat entfernt]“.
- Braucht Änderung **6**: Die Auswerterin bekommt `liest`-Kanten auf die Protokolle aller Positionen, also Zeiger und keine Nachrichten.
- Braucht Änderung **4**: Ihr Bericht geht über eine `meldet`-Kante an die Position, die mit dem Owner spricht.
- Braucht Änderung **10**: Ein Vorschlag der Auswerterin („[Zitat entfernt]“) ist ein Export und geht durch denselben Import mit Vorschau.
- Das Context Pack ist ein Eintrag in `context-packs.ts:232` mit dem Modell aus diesem Dokument als Inhalt.
  Die Auswerterin ist eine Position in den Fleet-Vorlagen (`KONST0`), keine eigene Mechanik.

**Reihenfolge.** Erst 1, denn ein Profil, das ganz ankommt, ist die Grundlage der anderen beiden. Dann 2,
denn Bindung und Kanten braucht 3. Zuletzt 3. Innerhalb der Teile:
1 → Änderung 1, 7, Historie; 2 → Änderung 2, 9, 5, 3, 8; 3 → Änderung 6, 4, Context Pack, 10.

## Was schon gebaut ist und wo es hinpasst

- **Stück 1** (Konstellationen am Server, `e7b9b45b8`, `053e19928`): das Objekt „Konstellation“ aus Abschnitt 3, noch ohne Kanten-Liste und Bindung.
- **Stück 2** (`Slot.openedBy`): die erste Laufzeit-Kante, Änderung 5. Auf der Testinstanz `:8935` zeigt die Konstellation
  „Orchestrator → Grok-Auswertung“ (Slot 1 → Slot 13).
- Beides ist committet und nicht gelandet. Weitergebaut wird erst nach dem Blick des Owners.

## Geprüft und nicht geprüft

- **Gelesen:** die Code-Orte der Tabelle, die Nachrichtenregeln `server.ts:17010-17260` und die Start-Türen `src/k15-start.ts` und `src/start-tuer.ts`.
- **Nur übernommen:** dass MAIN an MAIN über die Program-Adresse schreiben kann (Vorarbeit, dort selbst nur abgeleitet).
- **Nicht geprüft:** wie Rückfrage-Kette und Zustellbudget mit Kanten zusammenspielen. Und ob Änderung 7 die Rollenkarten-Zustellung (`deliverOrchestratorSpawnCard`) bricht, die heute am Label hängt.
