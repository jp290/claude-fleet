---
frage: Lassen sich Astra und Sol in Codex 0.153.4 mit getrennten Kontextprofilen betreiben, ohne Owner-Sessions mitzuaendern?
urteil: Vorerst nichts aendern; 258400 ist lokal beobachtet, 1M wird im gebuendelten Clientkatalog auf 872000 begrenzt, und ein spaeterer Versuch braucht explizite Lane-Isolation statt globaler Profile.
bereich: [codex, kontext, harness, kosten]
stand: 2026-09-15
nicht-gemessen: Keine geaenderte Codex-Session, kein Grenzlastversuch, keine modellgenaue Rollout-Zuordnung, keine aktuelle serverseitige Experimentfreigabe und keine Abrechnungsmessung.
---

# Codex-Kontextfenster: Profile oder Lane-Overrides

## 1. Claim-Tabelle und Primaerquellen

Ein getrennt waehlbares Kontextbudget ist sinnvoll, weil ein grosser Task mehr Verlauf halten kann und kurze Tasks dessen Folgekosten nicht tragen muessen; ein neuer globaler Modellstandard ist daraus nicht begruendet. Untersucht wurden CLI-Hilfe, gebuendelter Modellkatalog, der zur Version gehoerende Quelltext, die benannten Fleet-Stellen, der bereitgestellte Config-Auszug und ausschliesslich Nutzungsereignisse aus Rollouts. Massstab: effektive Werte und begrenzte Wirkung muessen messbar sein; eine parsebare Einstellung allein beweist beides nicht.

**Stand:** Fleet-Baum `e8469c88b1e98572a4c0a5c34a66ca576b02d732`, lokal `codex-cli 0.153.4`, Abruf am 2026-09-15. Der Upstream-Tag `rust-v0.153.4` zeigt ueber das Tagobjekt `042fb41b7c813ac7999105e886b2b7aa715b5081` auf Commit `3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`. Das ist der untersuchte Versionsquelltext, kein selbst reproduzierter Binaerbuild.

Quellenschluessel:

- **CLI:** lokal ausgefuehrt: `codex --version`, `codex --help`, `codex features list`, `codex --profile astra --help`, `codex debug models --bundled`. Kein Modellturn gestartet. Die Profilhilfe nennt eine Datei `$CODEX_HOME/<name>.config.toml`. `codex --profile --help` ohne Wert scheitert mit Exit 2: `a value is required for '--profile <CONFIG_PROFILE_V2>' but none was supplied`; es gibt keine eigene Profil-Unterhilfe.
- **M:** offizielle Modellseiten fuer [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) und [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol): jeweils 1.050.000 Kontext, 128.000 maximale Ausgabe. Das sind Modell-/API-Angaben, keine Messung der angemeldeten Codex-Session.
- **K:** [Config-Referenz](https://learn.chatgpt.com/docs/config-file/config-reference): Kontextfenster, Compaction-Limit und dessen Zaehlscope sind getrennte Einstellungen. Der Experiment-Schalter heisst `features.context_management.experimental_mode`. Die [Modelldokumentation](https://learn.chatgpt.com/docs/models?surface=app#experimental-context-management) beschreibt Astras Notizen und Verlaufssuche ueber Fenster hinweg, Opt-in und den Start einer neuen Aufgabe. Dokumentation ist kein Beweis einer aktuellen Backend-Freischaltung.
- **S1:** Versionsquelle [models-manager/src/model_info.rs:25](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/models-manager/src/model_info.rs#L25): `with_config_overrides` begrenzt `model_context_window` per Minimum auf `max_context_window`; das Compaction-Limit wird separat uebernommen.
- **S2:** [protocol/src/openai_models.rs:488](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/protocol/src/openai_models.rs#L488): nutzbares Fenster = aufgeloestes Fenster × effektiver Prozentsatz; normale Auto-Compaction maximal bei 90 % des aufgeloesten Fensters. [core/src/session/context_window.rs:52](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/src/session/context_window.rs#L52) unterscheidet `total` und `body_after_prefix` und behaelt eine volle Kontextgrenze. Die Rechnungen unten gelten fuer `total`.
- **S3:** [config/src/loader/mod.rs:314](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/config/src/loader/mod.rs#L314): Basisdatei und gewaehlte Profildatei bilden getrennte Schichten. Eine gleichnamige Legacy-Tabelle `[profiles.astra]` beziehungsweise ein Legacy-Selektor kollidiert mit `--profile astra` und wird abgewiesen. [Schichtreihenfolge:110](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/config/src/loader/mod.rs#L110): Projekt- und Runtime-Overrides liegen oberhalb des Benutzerprofils.
- **S4:** [features/src/feature_configs.rs:296](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/features/src/feature_configs.rs#L296) und [features/src/lib.rs:1556](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/features/src/lib.rs#L1556): strukturierter Experiment-Schalter, `UnderDevelopment`, Default false. [Config-Schema derselben Version](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/core/config.schema.json) bestaetigt die Typen der vorgeschlagenen Schluessel. Die Legacy-`ConfigProfile`-Definition enthaelt die beiden numerischen Kontext-/Compaction-Schluessel nicht.
- **R:** eigene, unten beschriebene Rollout-Messung. Keine Gespraechsinhalte, Session-Metadaten oder `turn_context`-Zeilen gelesen.

| Behauptung des Anlasses | Urteil | Beleg und Grenze |
|---|---|---|
| Codex startet mit etwa 258k–272k. | **belegt** | CLI-Katalog: fuer Astra und Sol je 272.000 roh und 95 % effektiv; R: 258.400. Zwei Bedeutungen, kein schwankender einheitlicher Grenzwert. Gilt fuer diese Version/Stichprobe, nicht jeden Client. |
| Astra und Sol koennen etwa 1,05 Mio. | **belegt** | M belegt die Modellkapazitaet; daraus folgt keine entsprechende Codex-Freigabe. |
| Grosse Fenster helfen bei grossen Refactors. | **unpruefbar** | Mehr speicherbarer Verlauf folgt aus S2; ein besseres Refactor-Ergebnis wurde nicht verglichen. Nutzen bleibt eine Aufgabenhypothese. |
| Ohne Headroom steigen Kosten. | **unpruefbar** | Keine lokale Kostenvergleichsmessung. Mehr tatsaechlich gesendeter Verlauf kann Kosten erhoehen; eine kleinere Reserve allein ist keine Abrechnungsregel. M nennt tokenbasierte Preise. |
| Ohne Headroom steigt die Compaction-Frequenz. | **unpruefbar** | S2 belegt Schwellen, keine solche allgemeine Kausalitaet. Eine spaetere Schwelle kann bei gleichem Wachstum sogar weniger Wechsel ausloesen; zu spaetes Verdichten kann dagegen einen Turn scheitern lassen. |
| Ohne Headroom steigen Fehler in der Kontextmitte. | **unpruefbar** | Kein Recall-/Qualitaetstest fuer diese Modelle und diese Aufgaben vorhanden. Ein Fensterwert ist kein Qualitaetssensor. |
| Experimental Context Management ist zwangsläufig global. | **widerlegt** | S3/S4 und CLI: Konfigurationsschichten und `-c` erlauben aufrufbezogene Auswahl. Ein Eintrag in der gemeinsamen Basisdatei hat allerdings breite Vererbungswirkung. |
| Das Experiment hilft Astra bei langen Tasks. | **unpruefbar** | K belegt den vorgesehenen Mechanismus, keinen hier gemessenen Netto-Nutzen oder aktuellen Betrieb. |
| Es schadet Sol-/Terra-/Luna-Subagents. | **unpruefbar** | Kein kontrollierter Modellvergleich. [Issue 42693](https://github.com/openai/codex/issues/42693) berichtet Sol-Abbrueche; [Issue 43194](https://github.com/openai/codex/issues/43194) berichtet fehlgeschlagene Notiz-/Verlaufsaufrufe mit Astra und einen Luna-Zustandsverlust unter Sonderkonfiguration. Das sind direkte Nutzerberichte, kein Nachweis einer universellen Subagent-Regression, insbesondere keiner fuer Terra. |
| Ein Maintainer deaktivierte Mitte September das Experiment wegen Early-Stops und Antworten auf alte Nachrichten. | **unpruefbar** | Der [Originalpost](https://x.com/thsottiaux/status/2098612714704891959) war beim Abruf mit HTTP 403 gesperrt. Ein [Kommentar vom 14. September](https://github.com/openai/codex/issues/44873#issuecomment-5661095003) verweist darauf und beschreibt diese Aussage fuer den 12. September; `author_association=NONE`, also keine Maintainer-Bestaetigung. Nicht als widerlegt behandeln. |
| Zwei Tabellen `[profiles.astra]`/`[profiles.sol]` in `config.toml` lassen sich hier mit `--profile` auswaehlen. | **widerlegt** | CLI und S3: `--profile` ist in 0.153.4 Datei-basiert; gleichnamige Legacy-Tabellen erzeugen einen Fehler. |
| 1.000.000 statt 1,05 Mio. stellt ein hartes nutzbares 1M-Fenster mit Reserve her. | **widerlegt** | CLI-Katalog + S1/S2: roh wird auf 872.000 geklemmt, effektiv verbleiben rechnerisch 828.400. Selbst ohne diesen Clamp waeren 1.000.000 roh bei 95 % nur 950.000 nutzbar. Keine Serverkapazitaet wird dadurch erhoeht. |
| 922.000 beziehungsweise 700.000 sind bewaehrte Rueckfallwerte. | **unpruefbar** | Keine Betriebsmessung. 922.000 wird im gebuendelten Katalog genauso wie 1M geklemmt, ist dort also keine Absenkung. 700.000 ist ein plausibler kleinerer Versuch, keine validierte Reserve. |
| Experimental laesst sich nur fuer ein Profil einschalten. | **belegt** | Die Profildatei kann den Schalter enthalten (S3/S4). Das isoliert CLI-Aufrufe mit anderer Auswahl, beweist aber keine modellselektive Isolation innerhalb eines Subagent-Baums. |
| Compaction nie abschalten. | **belegt** | Als Randbedingung dieses Vorschlags: alle Varianten behalten eine endliche Schwelle. S2 liefert den bestehenden Mechanismus; eine allgemeine Qualitaetsgarantie folgt nicht daraus. |
| Keine Limits oder Quota-Resets anfassen. | **belegt** | Als Arbeitsgrenze eingehalten. Kontextkonfiguration ist keine Quota-Erweiterung; aus `rate_limits` wird weder Preis noch Reset-Autoritaet abgeleitet. |

## 2. Ist-Zustand

### Config, CLI und Fenster

Gelesen wurde nur der bereitgestellte private Auszug `astra-inputs-2026-09-15/codex-config-excerpt.toml`, nicht die volle Benutzerkonfiguration. Er setzt Astra, Effort `high` und Service-Tier `default`; keine `[profiles]`, kein Kontextfenster, kein Compaction-Limit und kein Context-Management-Schalter. Unter `[features]` steht nur `js_repl = false`. Lokale Pfade, Trust-Tabellen und Hookwerte werden hier nicht veroeffentlicht. Der Auszug beweist nicht die Abwesenheit separater Profildateien oder hoeherer Konfigurationsschichten.

Die gefilterte Ausgabe von `codex features list`:

```text
compaction_image_budget                  stable             true
context_management                       under development  false
remote_compaction_v2                     stable             true
```

`codex debug models --bundled`, auf numerische Felder und Modellkennung reduziert:

| Modell | context_window | max_context_window | effective_context_window_percent |
|---|---:|---:|---:|
| gpt-6-astra | 272000 | 872000 | 95 |
| gpt-5.6-sol | 272000 | 872000 | 95 |

Der Befehl nutzt ausdruecklich den gebuendelten Katalog ohne Refresh. Ein aktualisierter Serverkatalog kann andere Grenzen liefern; er wurde hier nicht angefordert. Unter diesen Katalogwerten ergeben sich aus S1/S2, **berechnet und nicht als geaenderte Session gemessen**:

| Gewuenschtes Rohfenster | Nach Clamp | Nutzbares Fenster (95 %) | Normale Compaction ohne kleineren Override (90 %) |
|---|---:|---:|---:|
| Default 272000 | 272000 | 258400 | 244800 |
| 1050000 | 872000 | 828400 | 784800 |
| 1000000 | 872000 | 828400 | 784800 |
| 922000 | 872000 | 828400 | 784800 |
| 700000 | 700000 | 665000 | 630000 |

Die Differenz 1.050.000 minus 128.000 ergibt zwar 922.000. M begruendet damit aber weder diesen Codex-Eingabewert noch das Umgehen von dessen Katalogmaximum. Die Bedeutung von `max_context_window=872000` wurde nicht als Ableitung aus API-Outputlimits nachgewiesen.

### Rollout-Messung und fehlende Modellzuordnung

Stichprobe am 2026-09-15, vor 10:47:49 UTC: Dateien unter `~/.codex/sessions/2026/09/{14,15}/`, nur echte `event_msg`-Ereignisse vom Typ `token_count`, vorgefiltert auf `token_count`/`rate_limits`. **17 Dateien, 454 Token-Ereignisse mit Info, alle mit `model_context_window=258400`; null Info: 0.** Die gelesenen Ereignisobjekte und ihre `payload`-, `info`- und `rate_limits`-Objekte enthalten keine Felder `model`, `model_slug` oder `model_name`. Rate-Limit-Pools sind kein Modellbeweis.

Vier konkrete letzte Ereignisse aus den Tagesdateien; Zeit ist UTC, Zaehler sind `last_token_usage`, nicht die kumulierten Sessionzaehler:

| Rollout-Suffix / Zeile | Zeit | Input | davon Cache | Output | Gesamt | Fenster |
|---|---|---:|---:|---:|---:|---:|
| 01a0a486-dfaa-7a62-8501-e9962b64962e / 118 | 10:09:59.063 | 85136 | 84352 | 96 | 85232 | 258400 |
| 01a0a4a0-2577-71b0-bb35-e242ed715dcb / 219 | 10:42:37.118 | 140377 | 139904 | 116 | 140493 | 258400 |
| 01a0a4a0-4252-7b60-a58c-b8a93b6d150b / 205 | 10:44:16.150 | 126286 | 125184 | 100 | 126386 | 258400 |
| 01a0a4aa-87b3-7b93-8c24-f75a8de8f404 / 90 | 10:46:17.785 | 85105 | 79360 | 429 | 85534 | 258400 |

**Modellgenaue Ist-Zahlen:** Astra: Rollout-Zuordnung `unknown`; Sol: Rollout-Zuordnung `unknown`. Beide haben den oben direkt gemessenen CLI-Katalogeintrag. Aus den erlaubten Logzeilen allein laesst sich keine getrennte Astra-/Sol-Messreihe herstellen. Nicht nach Dateireihenfolge, Briefmodell oder globalem Config-Default zuordnen. Fuer einen spaeteren Versuch wird eine exakte Spawn-Quittung Modell ↔ Session-ID benoetigt; `turn_context` blieb aufgrund des Auftrags ungelesen.

### Fleet-Start und Anzeige

- `server.ts:1146` (`CODEX_HARNESS#spawnCmd`) baut frische und Resume-Aufrufe mit `-c check_for_update_on_startup=false`; `server.ts:1157` ergaenzt `--model`, `server.ts:1158` den `model_reasoning_effort`-Override. `server.ts:1160` setzt gegebenenfalls das MCP-Profil. Es gibt dort keinen Fenster-/Compaction-/Experiment-Override und keine `--profile`-Auswahl.
- `server.ts:1161` enthaelt bereits einen Trust-Eintrag-Schreiber in der gemeinsamen Konfiguration. Deshalb wurde zur Untersuchung kein Fleet-Spawn ausgeloest. Dieser bestehende Mechanismus ist kein neuer Aenderungsvorschlag.
- `server.ts:377` (`Harness#spawnCmd`) bekommt keine explizite Lane-Bindung; `server.ts:5170` (`ensureSlot`) verwendet denselben Adapter fuer Sessions und Lanes. `browserMcp` darf nicht zur Lane-Erkennung umgedeutet werden: Browser-Lanes und normale Sessions koennen beide true tragen.
- Der im Brief genannte `server.ts#contextWindowFor` ist ein Import (`server.ts:80`). Die Definition steht in `src/protocol.ts:320`: GPT-Namen erhalten `CONTEXT_WINDOW_GPT=258400` (`src/protocol.ts:274`). Die Kommentare, wonach dort kein Codex-Modell benannt sei, sind in diesem Baum veraltet. Fuer Codex entscheidet trotzdem der reale Ausfuehrungspfad: `windowFromFile:true` (`server.ts:1177`) umgeht diese Tabelle in `contextFill` (`server.ts:28649`). `readCodexContext` (`server.ts:28896`) nimmt Zaehler und Fenster aus derselben letzten brauchbaren Token-Zeile; ein fehlendes Fenster wird null statt geraten.
- `docs/harness-adapter.md:219` beschreibt den Harness-Einstieg; fuer die konkrete Codex-Kontextbehandlung ist obiger Code die staerkere Quelle. Nur der angeforderte Abschnitt der privaten MAIN-`CLAUDE.md` wurde gelesen: Zeilen 222–246 nennen 258.400 = 272.000 × 95 % als Briefbudget. Die Zahl passt zum Katalog und zur Stichprobe; die Bezeichnung als allgemeines Abo-Fenster ist damit nicht fuer alle Modelle/Clients/Overrides bewiesen. Der Abschnitt fehlt in der lokalen Lane-Fassung. Keine private Regeldatei geaendert.

## 3. Optionen mit Kosten

| Option | Fenster, Compaction und Kosten | Wirkung auf Owner-Sessions | Testbarkeit und Ruecknahme |
|---|---|---|---|
| **A: Globale Profile astra/sol in config.toml** | In der vorgeschlagenen Legacy-Form mit `--profile` fuer diese CLI abgewiesen (S3). Gueltige Alternative: getrennte Dateien `astra.config.toml`/`sol.config.toml`. Sie waehlen Werte, schaffen aber keine Kapazitaet oberhalb des Katalogmaximums. Groesserer Verlauf kann mehr wiederholten Input und hoehere Latenz erzeugen. | Aufrufe ohne Profilauswahl laden die zusaetzliche Datei nicht. Owner-Aufrufe mit demselben Profil werden mitgetroffen. Ein globaler Default oder Kontext-Key in der Basisdatei waere eine breite Aenderung. Profile sind nicht automatisch modellgebunden; `--model` kann das Profilmodell uebersteuern. | Parser + Schema + frische Session je Profil, Gegenprobe ohne Profil. Ruecknahme: Auswahl entfernen und frische Session beginnen; keine laufende Session als automatisch zurueckgesetzt betrachten. Zwei globale Dateien erhoehen Pflege-/Driftrisiko. |
| **B: Lane-Overrides im Fleet-Adapter** | Bestehendes `-c` reicht. Feste Zahlen pro erlaubtem Modell, unabhaengige Compaction-Schwelle, Experiment aus. Katalog-Clamp bleibt wirksam. Keine zusaetzliche globale Konfigurationsdatei noetig. | Ein blosser Modellzweig in `CODEX_HARNESS` trifft auch normale Fleet-Sessions. Erforderlich ist eine ausdrueckliche Lane-/Versuchsauswahl an der Spawn-Grenze; direkte Owner-CLI-Aufrufe bleiben dann unberuehrt. | Spawn-Argumenttests fuer Lane/Owner, frisch/resume, Modelle; echte neue Pane mit exakter ID und Token-Sonde. Ruecknahme: Versuchsauswahl/Overrides entfernen, frischen Lauf messen. Mehr Implementierungs- und Integrationsaufwand als C. |
| **C: Nichts aendern — jetzt empfohlen** | Beobachtet 258.400; normale Schwelle rechnerisch 244.800 unter dem gebuendelten Katalog. Keine neue Kontextkosten-Exposition. Grosse Tasks muessen weiter mit begrenztem Verlauf, gezielten Reads und Uebergaben auskommen. | Kein neuer Eingriff. Kuenftige Client-/Katalogaenderungen bleiben externe Variablen. | Bestehende Token-Sonde weiter als Faktenquelle verwenden. Kein Rollback noetig. Verzichtet vorerst auf einen ungemessenen moeglichen Nutzen grosser Fenster. |

**Kosten nicht mit Fensterzahl verwechseln:** Das Setzen eines groesseren Limits berechnet nicht sofort dessen volle Tokenzahl. Teurer werden tatsaechliche Requests mit mehr Verlauf; Cacheanteile und Compaction-Requests zaehlen mit. Die [Astra-API-Modellseite](https://developers.openai.com/api/docs/models/gpt-6-astra) nennt oberhalb 272k Input einen Zuschlag fuer den gesamten Request (2× Input-/Cache-Raten, 1,5× Output). Das ist keine Preisformel fuer das hier genutzte Codex-Abo und wird nicht auf Sol uebertragen. Fuer den Versuch sind Gesamtinput, gecachter Input, Output, Laufzeit und erfolgreiche Task-Erfuellung gemeinsam zu vergleichen; kumulierte `total_token_usage`-Staende nicht aufsummieren.

## 4. Konkreter Vorschlag, Rueckfall und Verify

**Jetzt C. Spaeter, nach gesonderter Beauftragung, ein begrenzter B-Versuch mit Astra; Sol bleibt Kontrollgruppe.** Experiment und Fenstergroesse nicht gleichzeitig veraendern. Die folgenden zwei TOML-Bloecke dokumentieren Kandidaten fuer Datei-Profile oder dieselben `-c`-Werte; es wurden keine solchen Dateien installiert und keine Einstellungen aktiviert.

Astra-Kandidat: 700.000 roh, Compaction bei 600.000 insgesamt. Unter dem gelesenen Katalog ergibt das 665.000 nutzbar und 65.000 Abstand zwischen der gewaehlten Schwelle und diesem Nutzfenster. Das ist ein Versuchswert, keine Garantie fuer beliebig grosse Toolantworten. Als Profildatei waere der Ort `$CODEX_HOME/astra.config.toml`, ohne `[profiles.astra]`-Huelle:

```toml
model = "gpt-6-astra"
model_context_window = 700000
model_auto_compact_token_limit = 600000
model_auto_compact_token_limit_scope = "total"

[features.context_management]
experimental_mode = false
```

Sol-Kontrolle beziehungsweise kleiner Rueckfall, als Profildatei `$CODEX_HOME/sol.config.toml`:

```toml
model = "gpt-5.6-sol"
model_context_window = 272000
model_auto_compact_token_limit = 244800
model_auto_compact_token_limit_scope = "total"

[features.context_management]
experimental_mode = false
```

Beim Astra-Rueckfall bleibt das Modell Astra; nur Fenster und Schwelle wechseln auf 272.000/244.800. Eine Ablehnung darf niemals einen stillen Modellwechsel ausloesen.

**Adapter-Schnitt als Text, nicht implementiert:**

- **FLAECHE:** `server.ts#Harness.spawnCmd`, `server.ts#ensureSlot`, `server.ts#CODEX_HARNESS.spawnCmd`; passende Harness-Proben und `docs/harness-adapter.md`. Eine ausdrueckliche, an den exakten Occupant gebundene Lane-Versuchsauswahl bis zum Adapter reichen. Keine Ableitung aus `browserMcp`, Dateinamen oder bloss dem Modell. Gewaehlte Versuchs-Lane + exakt `gpt-6-astra` erhaelt die drei Kontext-Overrides und Experiment=false; Sol und alle anderen Modelle erhalten keinen vergroessernden Override. Keine freie TOML-Eingabe ueber die Queue einfuehren.
- **DONE:** Neue Astra-Versuchs-Pane meldet den vorher aus ihrem aktuellen Katalog abgeleiteten Nenner, Kontroll-Pane ihren unveraenderten Nenner; normale Owner-Session bekommt keine neuen Argumente; frischer und Resume-Start waehlen denselben begrenzten Satz. Fehlende/abweichende Evidenz ist ein gescheiterter Versuch, kein pass.
- **Oberflaechenentscheidung:** Codex-CLI und Fleet-Server `apply`; Reverse-State `apply` als Gegenprobe des vorhandenen Rollout-Lesers; Docs/Proben `apply`; neue oeffentliche Client-/Wire-Einstellung fuer diesen engen Versuch `not-applicable`. Claude-, Pi- und Container-Adapter `not-applicable`; interne Codex-Subagent-Isolation `unsupported` durch diesen Fleet-Schnitt, solange keine gesonderte Vererbungsprobe vorliegt. Keine pauschale Fenstererhoehung in `contextWindowFor`.
- **VERIFY:** Zuerst gate-gewaehlte lokale Kette; Argumentproben muessen bei versehentlich fehlender Lane-Bedingung rot werden und leeres/unbekanntes Modell, Owner-Session, Browser-Lane, frischen Start und Resume unterscheiden. Bei relevanter Lifecycle-Aenderung die im Projektvertrag geforderte isolierte Vorschau. Danach eine autorisierte frische Pane pro Variante, genau ein harmloser Testturn, eine terminale Fertigmeldung, dann die untenstehende Sonde gegen genau deren Rollout. Keine Vollprozessliste und kein `--last` als Identitaetsersatz. Diesen Live-Versuch hat diese Notiz ausdruecklich nicht ausgefuehrt.

Beispiel fuer die spaetere **lesende** Sonde nach dem Testturn. `rollout_path` kommt aus der exakten Spawn-/Session-Quittung, `expected_window` aus dem fuer diesen Start festgehaltenen Katalog. Beim hier gelesenen Astra-Kandidaten waere der Erwartungswert 665000; fuer die Kontrolle 258400. Die Modellbindung steht in der Quittung, nicht in der Token-Zeile:

```sh
python3 - "$rollout_path" "$expected_window" <<'PY'
import json, sys
last = None
with open(sys.argv[1]) as stream:
    for n, line in enumerate(stream, 1):
        if '"token_count"' not in line:
            continue
        row = json.loads(line)
        p = row.get("payload", {})
        if row.get("type") == "event_msg" and p.get("type") == "token_count":
            last = (n, p.get("info"))
assert last is not None, "FAIL probe: no token_count"
n, info = last
assert isinstance(info, dict), "FAIL probe: missing info"
window = info.get("model_context_window")
usage = info.get("last_token_usage")
assert isinstance(usage, dict), "FAIL probe: missing last_token_usage"
used = usage.get("total_tokens")
assert isinstance(used, int) and used >= 0, "FAIL probe: invalid usage"
assert window == int(sys.argv[2]), f"FAIL window: {window}"
print(f"PASS window={window} used={used} line={n}")
PY
```

Die Sonde beweist den gemeldeten Nenner nach einem Turn, **nicht** die Verarbeitung eines 665k-Prompts oder korrektes Langzeit-Recall. Vor breiter Nutzung braucht es zusaetzlich einen synthetischen Task mit bekannten Fakten vor/in/nach der Kontextmitte, festem Ziel, einer ueberschrittenen Compaction-Schwelle und erfolgreicher Fortsetzung. Early-Stop, alte Antwort, Faktenverlust oder Kontextfehler ist ein Abbruchkriterium. Compaction-Ereignisse und Input-/Outputzaehler dafuer gesondert erfassen; ein fallender Tokenstand allein beweist keine Compaction. Diese erweiterten Ereignisse gehoeren zu einem neuen Messauftrag.

**Rueckfallplan:**

1. Client lehnt einen Schluessel/Wert ab oder die Sonde sieht weiter 258400 statt des erwarteten groesseren Fensters: Versuch stoppen, Overrides entfernen und mit unveraenderter Basiskonfiguration neu messen; alternativ explizit 272000/244800 verwenden. Keine Custom-Katalog-Manipulation zum Umgehen eines Caps.
2. Compaction kommt zu spaet/Turn passt nicht mehr: bei 700000 roh zuerst auf 500000 Compaction-Schwelle senken; erneuter Fehler fuehrt zur kleinen Baseline. Kein unendlich hohes Limit, keine Abschaltung.
3. Compaction kommt zu frueh: erst Zaehlscope, Katalog-Clamp, tatsaechliche Tokenereignisse und separate Ausloeser pruefen. Nur in einem neuen kontrollierten Versuch von 600000 auf hoechstens 630000 bei 700000 roh gehen; das verringert die Reserve. 922000 ist unter dem gelesenen Cap kein hilfreicher Zwischenrueckfall.
4. Experiment bleibt false. Profilbezogenes Opt-in waere ein eigener Versuch nach bestaetigter aktueller Unterstuetzung einschliesslich Kindmodellen; eine alte CLI als Umgehung einer moeglichen serverseitigen Abschaltung wird nicht vorgeschlagen.

### Tatsaechlich ausgefuehrte Verifikation dieser Notiz

TOML-Pruefung mit Python 3.14.3 `tomllib`; der Befehl liest **alle** TOML-Codebloecke dieser Notiz, nicht handkopierte Nebenfassungen:

```sh
python3 - <<'PY'
import pathlib, re, tomllib
p = pathlib.Path('docs/messungen/2026-09-15-codex-kontextfenster-profile.md')
blocks = re.findall(r'^```toml\n(.*?)^```', p.read_text(), re.M | re.S)
assert len(blocks) == 2
for i, block in enumerate(blocks, 1):
    obj = tomllib.loads(block)
    assert obj['model_context_window'] > obj['model_auto_compact_token_limit'] > 0
    assert obj['features']['context_management']['experimental_mode'] is False
    print(f"TOML {i}: PASS {obj['model']}")
print('ALL TOML PASS (2 blocks)')
PY
```

Gemessene Ausgabe, Exit 0:

```text
TOML 1: PASS gpt-6-astra
TOML 2: PASS gpt-5.6-sol
ALL TOML PASS (2 blocks)
```

Parsererfolg beweist TOML-Syntax und die expliziten Assertions, nicht CLI-Laden, Backendfreigabe oder Livewirkung. Die Typen wurden ausserdem gegen S4 gelesen; kein geaenderter Codex-Start zur Schema-/Runtime-Erprobung.

Docs-Kurzkette ausgefuehrt, beide Befehle Exit 0:

```text
$ bun install --frozen-lockfile
9 packages installed [37.00ms]

$ bun e2e/pins.ts
PASS  land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT  (land-log says 42)

ALL PASS
```

`GET /api/self/gate` wurde vor der Pruefung gelesen, lieferte vor dem Commit aber `classifiedAs: {}` und die volle Standardliste. `server.ts:3469` (`laneLocalProof`) klassifiziert ausschliesslich den committed Diff `base...HEAD`; die neue, auch gestagte Notiz war dort noch unsichtbar. Die ausgefuehrte kurze Kette folgt dem ausdruecklichen Docs-only-Auftrag. Nach dem Commit erneut gelesen: das Gate bestaetigt die einzige Datei als `docs-or-prose`, `steps=["install","pins"]`, `isolatedPreview=false`. Keine Aussage, die volle Suite sei gelaufen.

## 5. Ungeprueftes

- Die Modellzuordnung der Rollout-Stichprobe bleibt offen: der Auftrag erlaubt nur Token-/Rate-Limit-Zeilen, diese tragen hier kein Modell. Ein separater modellgenauer Messauftrag braucht eine exakte Session-Quittung oder erlaubte, eng projizierte Modellmetadaten.
- Aktueller Remote-Katalog, serverseitige Experimentfreigabe, erfolgreiche Notiz-/History-Werkzeuge und der Originalwortlaut des gesperrten Posts sind nicht bewiesen. [Issue 44873](https://github.com/openai/codex/issues/44873) dokumentiert Nutzerbeobachtungen unterschiedlicher Clientversionen; keine allgemeine sichere Downgrade-Empfehlung daraus ableiten.
- Keine kausale Messung zu Refactor-Qualitaet, Fehlern in der Kontextmitte, Subagent-Vererbung, Compaction-Frequenz, Zeitgewinn oder Abo-Kosten. Kein 700k-/1M-Lauf und keine Behandlung einer realen Wertablehnung getestet.
- Private Vollkonfiguration, separate bestehende Profildateien und uebergeordnete Config-Schichten wurden nicht inventarisiert. Der bereitgestellte Auszug ist ein datierter Ausschnitt, kein kryptografisch belegter Snapshot aller wirksamen Einstellungen.
- Nur diese Notiz wird geaendert. INDEX-Ernte liegt bei der Orchestratorin; keine Konfiguration, Quota, Featurefreigabe, Queue-Zeile oder Laufzeitumstellung wurde vorgenommen. Der abschliessende Fleet-Report ist die ausdruecklich beauftragte einzige API-Schreibausnahme.
