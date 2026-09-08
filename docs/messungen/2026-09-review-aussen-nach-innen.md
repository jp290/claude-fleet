---
frage: Was ist vom Outside-in-Review belegt, disponiert und noch nicht abgeschlossen?
urteil: S2D ist angenommen, regulaer gelandet und gruen auditiert; das Gesamt-Review bleibt wegen offener GLM-Korrektur, Server-/Gate-Abdeckung und unvollstaendigem Briefnachweis offen.
bereich: [review, datenlayer, rollen, kontext, gates]
stand: 2026-09-08
nicht-gemessen: Keine neue Gesamtlesung des Codes, keine neue Live-Board-Probe, keine vollstaendige Rollenmatrix oder historische Brief-Receipt-Pruefung; kein Abschluss aller Program-Kriterien.
---

# Outside-in: rangiertes Arbeitsregister und Rueckweg

Program `eec695280b9ca5a84824eec0`, Astra Review-MAIN. Diese Synthese schliesst die fehlende Registerdatei aus Auflage `82ae9cc4`, NICHT das gesamte Program. Basis der heutigen Bestandsaufnahme: `1d83090d`; Queue-Zustaende sind Momentaufnahmen vom 2026-09-08. Historische Lane-Aussagen bleiben an deren Messbaum gebunden. Der Befundstatus ist nicht der Status des Dokuments, in dem er steht.

Diese Abstraktion soll existieren: ein kleines Register verbindet Problem, Kosten, Beweis und Traeger, damit Nachfolger nicht aus Pane-Prosa und alten Slotnummern einen Arbeitsstand erraten. Es ersetzt weder die Queue noch deren Projektion.

## Rangiertes Register

Zehn Zeilen, nach Entscheidungsrisiko und bezahlter Handarbeit rangiert. `vorgeschlagen an Owner` bedeutet Disposition/Umsetzung noch nicht als angenommen und gelandet bewiesen; bestehende Tasks bleiben die Traeger, keine Doppelauftraege. Ein gruener Docs-Test beweist nicht die Richtigkeit jeder Aussage.

| Rang | Datei#Symbol / Abschnitt | Befund in einem Satz | Kosten | Verify-Weg | Status |
|---|---|---|---|---|---|
| 1 | `docs/messungen/2026-09-06-kontext-gesundheit-glm.md` §5/§6; Report `5aa233ab` | Die fachlich abgelehnte Fassung `d11235f` ist als `7539985d` unveraendert gelandet. | Falsche Kontextlast-/Provenienzaussagen werden trotz Review weiter als Entscheidungsgrundlage angeboten. | `git diff d11235f 7539985d -- docs/messungen/2026-09-06-kontext-gesundheit-glm.md` leer; Self-Projektion nennt rejected und landed; Korrektur muss drei Rueckgaben plus erhaltene sechs Vorarbeiten zeigen. | vorgeschlagen an Owner: bestehende Korrektur `6e1caad8`, bestehender Reject-Land-Guard `e219d486`; Ruecknotiz `b19d23b7`. |
| 2 | `server.ts#decideFleetReport`; Disposition F1 | Persistierte Ablehnung und deren Zustellung an den richtigen Worker sind verschiedene, noch nicht durchgehend belegte Schritte. | MAIN/Controller werden zu Relais; geschlossene oder recycelte Worker verlieren die Rueckgabe. | Bestehende `18e87e67`: reject mit Grund an exakten Occupant, Dedupe, kein Send an Nachfolger; Bericht und Empfang getrennt pruefen. | vorgeschlagen an Owner: Fleet-Betrieb `18e87e67`, keine zweite Inbox erfinden. |
| 3 | `server.ts#pruneFleetReports`; Disposition F1/R-P/R-B | Transport-Retention und fachliche Kandidatenannahme brauchen eine explizite Erhaltungs-/Artefaktrelation. | Fehlende Entscheidung kann wie nie vorhandener Report aussehen; Annahme von A darf B nicht freigeben. | Bestehende C5-Probe `eec64457`: rejected→pruned→land; A angenommen/B geaendert; alte Records unknown; aktuelle Reparaturen vor neuem Urteil lesen. | vorgeschlagen an Owner: C5/`e219d486`; historische Probe in Disposition, kein ungepruefter heutiger Defektclaim. |
| 4 | `server.ts#tickCodexRecovery`, Event-ACK; D2-Brief `e88884c8` | Ein isoliert gemeldeter Fall lieferte ein Event vor spaeter Session-ID-Bindung und verweigerte danach dessen eigenen ACK. | Ein zugestellter Hinweis bleibt unquittierbar und erzeugt weiteren Rueckkanalaufwand. | D2: frischer Codex-Occupant, Event vor/nach Bindung, eigene ACK positiv, recycelter Occupant negativ; alte Probe und aktuelle Implementierung zuerst abgleichen. | vorgeschlagen an Owner: vorhandener Task `e88884c8`, pending; kein blanket weakening der Identitaet. |
| 5 | `server.ts#capTasks`; C0 | Der historische Nullbudget-Fall `slice(-0)` behaelt terminale Zeilen statt null davon. | Retention erfuellt ihren Vertrag am Grenzwert nicht; keine Berechtigung, offene Arbeit zu loeschen. | Task `a42aa900`: 199/200/>200 offene Zeilen plus terminale, echte Route/Funktion und Negativmutation; heutige Write-Sets zuerst freigeben. | vorgeschlagen an Owner: C0 `a42aa900`, pending; kein aktueller Reproduktionslauf in dieser Synthese. |
| 6 | `docs/messungen/2026-09-06-astra-s2d-kontextkette.md` §3 | Die alte Spawn-Baum-Probe rekonstruierte ihren eigenen Eingang und belegte keinen Drift-Ausschluss. | Ein scheinbar gruener Join verdeckt ungepruefte Quellenaktualitaet. | Synthetische Historien A-D und recipe-check der Korrekturlane; falscher Spaet-Head besteht nach Rebase; Drift bleibt unknown. | gelandet als `f03745ec154a3123341c0ae6211e9ffcdc6e4642`: Korrektur angenommen, Note ALL PASS, Audit 458/0. |
| 7 | `context-plan.ts#contextOmissionFor`; S2D B2 | Die erste gueltige Ausschlussursache ist laut Vertrag korrekt, auch wenn weitere zutreffen. | Kein belegter heutiger Schaden; die fruehere Fehlerbehauptung haette einen unbegruendeten Umbau ausgeloest. | Ladder-Vertrag am Pin `15108892` gelesen; optionale Darstellung nicht mit Routingkorrektheit verwechseln. | verworfen mit Grund: ungekosteter Darstellungswunsch; Ruecknahme gelandet in `f03745ec`. |
| 8 | `server.ts#renderContextAnchorBlock` / Receipt; S2D B1 | Quittierte Briefbytes/Hash belegen den Bau, nicht automatisch Annahme oder Lesen durch einen Agenten. | Ein spaeterer Orchestrator kann fehlenden Kontext als zugestellt behandeln. | S2D B1: derselbe Briefhash plus tatsaechlicher Send-/Acceptance-Beleg; missing/unsupported unknown, niemals Lesen behaupten. | vorgeschlagen an Owner: C4/C5 im Umsetzungsplan; heutige Codeabdeckung erneut bestimmen, bevor ein Fix gefilet wird. |
| 9 | Studio-Renderer, Notiz-Join und Abschluss; Disposition F2–F5 | Deklarierte Studio-Gates, Critic-Inputs und offene Arbeit beim Programabschluss sind keine bereits ausgefuehrten Workflows. | Hub zeigt sonst Wirksamkeit ohne Verbraucher; Vorurteile koennen in Critic-Briefs gelangen; Arbeit verliert ihren Traeger. | Disposition beschreibt rev1/rev2, Critic ohne generische Vorurteile, bewusste Task-Disposition/Transfer, N2-Volltext und Verdikt; keine historische Kontamination behauptet. | vorgeschlagen an Owner: vorhandenes `f98facad` plus B-INPUT/S-STATUS/C-CLOSE-Entwuerfe, keine automatische Freigabe. |
| 10 | `docs/messungen/2026-09-05-astra-s1-vertrag-einstieg.md` F2 | SYSTEM.md ist weder voellig ungelesen noch insgesamt gepinnt: S1 wies fuer die Funktionsliste einen Leser nach. | Falsche Vollstaendigkeitsannahmen erzeugen unnoetige Gateschaeden oder unbemerkte Drift anderer Abschnitte. | S1-Mutationsberichte fuer Funktionsname/Ueberschrift vs Wissensordnung; neue Fassungen nicht durch alte Zeilennummern beurteilen. | verworfen mit Grund: pauschaler Claim „kein Leser/Pin“; restliche Rollen-/Leserabdeckung bleibt offen. |

## Abdeckung und Grenzen je Schicht

| Schicht | Vorliegende Arbeit | Nicht geprueft / noch zu liefern |
|---|---|---|
| Vertrag/Einstieg | S0/S0R Zielbild; S1 `535fa051`, Bericht §§4–7; AGENTS, README und SYSTEM dort einzeln gelesen. | S1 hatte keine Live-UI. Heutige Board-Ansicht und spaetere Vertragsaenderungen nicht erneut vollstaendig geprueft. |
| Rollen-/System-Dokumente | Fable-Kontextbericht; GLM-Kontextnotiz samt offener Korrektur; S2D-Quellenkette. | Vollstaendige Datei×Widerspruch×toter Verweis×undefinierte Rolle×Definition-ohne-Leser-Matrix nicht abgenommen. GLM-Land trotz Reject ist kein Ersatz. |
| Server-Naht | D0/D1-Zustellfall, S2D, Inbox-Vorabvertrag und F1–F5 punktuell. | `server.ts` plus alle zehn Blattmodule noch nicht als Schicht abgeschlossen; Importinvariante und Contract-/Security-Gegenfaelle brauchen einen begrenzten Lane-Schnitt. |
| Gates/Suiten | Originalbeweise und Land-/Audit-Joins der eigenen Korrekturen; Second-host-Fakten aus Controller-Berichten. | Kein eigener abgeschlossener S4-Review. Fremde Produkt-Lands und gruene Audits ersetzen nicht die Review-Abdeckung; Flake-Arbeit bleibt bei Audit-Determiniertheit. |

Einzeldateistatus fuer K3: `AGENTS.md`, `README.md`, `SYSTEM.md` haben S1-Abdeckung, aber keine heutige Vollmatrix. `docs/controller.md`, `docs/steward.md`, `docs/lane-brief-template.md` und alle sieben `rulebook/`-Fragmente haben Teilberichte, keine von mir abgenommene vollstaendige Matrix. Fragmentnamen und aktuelle Zeilenbereiche muss die Nachfolge am Inventar ermitteln, nicht aus Erinnerung auffuellen. Regelbuch-Befunde bleiben Vorschlagstext; kein privater Fragment-Edit durch diese MAIN.

## C0–C5: dauerhafte Planung, keine neue Wahrheitsdatenbank

Der vollstaendige Plan steht in `docs/messungen/2026-09-07-datenvertraege-umsetzungsplan.md`, aus dem bereits getaggten Commit `25fa60a2` uebernommen. Slot-16-Abgleich: `docs/messungen/2026-09-07-studio-hub-disposition-astra.md`, Quelle `bf3dd138`, integriert als `9d09cb6b`. Historische Slots sind keine Adressen.

- C0: Nullbudget reparieren, offene Tasks erhalten; vorhandener `a42aa900`.
- C1: adressierter Rueckweg und Succession; bestehende `c464af30`, `417d2be5`, `c62aa3e9`, `18e87e67` zuerst, kein Parallel-Ledger. Empfang, Lesen, Entscheidung und Antwort getrennt.
- C2: Befund-/Notiz-Lebenszyklus; N2 `f98facad` arbeitet laut aktuellem Taskstand bereits. Retention nicht als unbemerktes Verwerfen.
- C3: Outcomes/Audits/Trails ueber stabile Gegenstaende und Baum/Host/Lauf verbinden. Fehlende Join-Partner unknown, nicht null Treffer als Entlastung.
- C4a/C4b: Rollen-/Nachfolgebrief und aufgaben-/harnessbezogene Kontextauswahl. Gemessene Quellgroesse, abgeleitete Ladung, echte Zustellung und Verbrauch nicht verwechseln. Bestehende Renderer/Receipts nutzen.
- C5: Agenten-/Hub-Sicht auf dieselben Relationen; `eec64457` ist vorhandener Traeger. Modell-je-Rolle und Studios folgen einem wirksamen Vertrag, nicht umgekehrt.

Wellen nur bei gemeinsamer Ursache/Proof und exklusiven Schreibflaechen; programId plus Dateinaehe allein ist keine fachliche Zusammengehoerigkeit. Je Task Urteil/Kandidat, Selbst-Split und Audit-/Undo-Spur erhalten. Keine Einsparungszahlen ohne gemessenen Nenner.

## Disposition der zwei Inbox-Altzeilen

**82ae9cc4:** jetzt gelesen, keine konkrete Uhrzeitfrist im Text; ctx64%-Angabe ist historische Controller-Messung, keine heutige Selbstmessung. Register wird hier geliefert; Plan war bereits als Git-Commit/Tag gesichert und kommt nun auf main; Rueckweg steht im neuen HANDOFF-Kopf. Die damaligen Pauschalclaims „einziger Beitrag“ und „C1–C5 nirgends sonst“ sind durch spaetere Artefakte ueberholt. Die Erfolgsbedingungen K2–K5 bleiben offen und werden nicht fuer eine Frist passend erklaert. Succession folgt erst nach Commit/Pruefbeleg; kein Retire und kein Program-complete.

**4fc45ae2:** S2D-Wahl durch `56e4427d` ausgefuehrt, ACCEPT→`f03745ec`→Audit gruen. Erstes GLM-Filing `1d0f4ca4` ausgefuehrt, aber dessen spaeterer Land `7539985d` trotz rejected erledigt nicht die Rueckgabe; Resttraeger `6e1caad8`. D2 bleibt `e88884c8`. Inbox-Folgetasks bleiben ihren bestehenden Programs zugeordnet. Historische Second-host-Zahlen vom 07.09. 09:12 sind keine aktuelle Prioritaet; M2 `64860da8` steht inzwischen done, N2 sent. Keine neue Suite/kein Re-Dispatch aus der alten Notiz. Koordinationsfrage damit disponiert, technische Restarbeiten nicht archiviert.

## Nachweise und naechster begrenzter Zug

Selbst gelesen: Self-Projektion, die beiden vollen Queue-Zeilen, S1-Reportabschnitte, eigene korrigierte Lane-Diffs/Originaltails, `fleet/land`-Notes zu `f03745ec` und `7539985d`, Audit-Ledger. Graphify zuerst, danach gezielte Suchen. Keine neue Statistik aus den gesamten Ledgern behauptet.

- S2D: Report `14602e0efcd8f32223a696d7` accepted, Kandidat `3839e47`, Land `f03745ec`, Audit at `1788825029179`, mainSha gleich, 458/0, `ALL PASS`. Events quittiert.
- GLM: Report `5aa233ab9ce28ec95989a57a` rejected; Datei `d11235f`→`7539985d` diffleer. Belegt ist das gelesene Ereignis `6f8ed06a3bd3d41d38e26889`, green 458/0, kein fachlicher ACCEPT. Task `6e1caad8` bleibt offen.
- Disposition: Direktintegration `9d09cb6b`, keine eigene Land-Note. Audit at `1788821145946` misst genau diesen mainSha, green 457/0, `ALL PASS`; covers nennt das andere Land `75939cf4`. Messung des Baums und Land-Provenienz sind getrennte Fakten.

K5 bleibt offen: aktuelle Brieftexte und historische ausgelieferte Receipts sind nicht gleich. Jede weitere Lane muss genaue Lesebereiche, Werkzeuge, Commit-Bodies/Landnotes/drei Ledger/beide Trails, Verbote, Done/Verify und Fuellstandssatz tragen; nachtraeglicher Briefedit beweist keine historische Zustellung.

Naechste MAIN: zuerst GLM-Report gegen exakten Kandidaten pruefen, nicht erneut beauftragen. Danach S3-Contract-/Security-Schnitt an aktuellen Inbox-/Report-Naehten mit exklusivem Write-Set und bestehender C5-Arbeit koordinieren; verbleibende Blattmodule und S4 als echte Abdeckung ergaenzen. `d2b69d3d` bleibt bis zur Synthese pending. Dieses Register fortschreiben, keine zweite Gesamtreview starten.
