# HARVEST — 🧭 Controller-Lifecycle Audit (pi-zai/glm-5.3), 2026-08-21

Pane-Bericht von Slot 7, geerntet durch ACP Architecture Controller II. UNTRACKED, PROPOSAL,
nicht normativ. Tokenwerte bei der Ernte per sed redigiert; Host/IP zusaetzlich maskiert.


 ────────────────────────────────────────────────────────────────────────────────

 Urteil (ein Satz): Die Opus-Controller verlieren ihren Kontext nicht an Owner-Nachrichten oder Regeln, sondern zu 60–80 % an Werkzeugausgaben — ganze Datei-Lesevorgänge, cat/sed-Schleifen
 und Hook-Echo — auf einem gemessenen Grundrauschen von ~10–13 %; wer 25–30 % als START der Übergabe setzt, gewinnt Urteilskraft, muss aber zuerst die Sensor-Lücken schließen (Codex misst 27
 %, Fleet zeigt null) und die Lese-Disziplin der Controller ändern, nicht ihre Autonomie beschneiden.

 ────────────────────────────────────────────────────────────────────────────────

 Beweistabelle

 Bezeichnungen: MEASURED = direkt aus Live-API/Transkript/Pane gelesen · CODE-ONLY = aus server.ts/src gelesen · INFERRED = aus Messwerten abgeleitet · UNKNOWN = nicht beobachtbar.
 Transkripte = Claude-Session-JSONL, dedupliziert nach message-id (Streaming-Fragmente zusammengeführt), Analyse-Parser außerhalb des Repositorys.

 ┌─────────────────────────┬──────────────────────┬───────────────────────────────────────────────┬──────────────────────────────────┬────────────────────────────────────────────────────────┐
 │ Slot / Session          │ Rolle, Alter         │ Kontext-Fluss                                 │ Dominanter beobachteter Beitrag  │ Bemerkungen                                            │
 │                         │                      │                                               │ (Hauptkette, Zeichen)            │                                                        │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 12 462aec8e             │ 9 min, 1             │ Board 13,5 % / TUI 14 %                       │ Tool-Ergebnisse 87 k;            │ Der Grundpreis: ~135 k Token Resident vor echter       │
 │ Autonomie-Critic · Opus │ Benutzer-Prompt      │                                               │ Assistent-Text 56 k;             │ Arbeit (MESSBAR). Zerlegung: ~40 k Transkript + ~21 k  │
 │                         │                      │                                               │ Gründungs-Brief 6 k              │ Anhänge (LISTINGS/HOOKS/REMINDERS) + ~74 k             │
 │                         │                      │                                               │                                  │ System+Tools+CLAUDE.md/AGENTS.md-Render (INFERRED)     │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 2 cc038d18 ACP          │ 12 min,              │ Board 16,6 % / TUI 18 %                       │ Tool-Ergebnisse 163 k;           │ 130 Bash-Tool-Use-Blöcke / 60 Ergebnisse in 12 min;    │
 │ Controller II · Opus    │ Nachfolge-Neustart   │                                               │ Tool-Argumente 73 k;             │ server.ts 18× referenziert, Architektur-Doc 7×         │
 │                         │                      │                                               │ Hooks/Reminders ~199 k Anhänge;  │ (MESSBAR). Null Komprimierungen                        │
 │                         │                      │                                               │ 4 Prompts                        │                                                        │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 5 f05d84b6 Private-repo-e    │ 5,4 h, 12 Prompts    │ 22,3 %                                        │ Tool-Ergebnisse 1.143 k — davon  │ Größter einzelner Treiber messbar; src/render/index.ts │
 │ MAIN · Opus             │                      │                                               │ 1.050 k aus 8 Read-Aufrufen      │  + game.ts je 17× referenziert                         │
 │                         │                      │                                               │ ganzer Dateien; Tool-Argumente   │                                                        │
 │                         │                      │                                               │ 260 k; Hooks ~279 k              │                                                        │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 11 49a3b883 publish ·   │ 6,3 h, 2 Prompts     │ 23,2 %                                        │ Tool-Argumente 150 k             │ Nur 2 Owner-Nachrichten → Füllung ist Eigenproduktion  │
 │ Opus                    │                      │                                               │ (Write/Edit-Texte); Hooks 212 k; │                                                        │
 │                         │                      │                                               │ Ergebnisse 111 k                 │                                                        │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 3 84c8180e Studio Trail │ 6,9 h, Pane tot      │ 28,1 % bei letzter Nutzung; Board zeigt null, │ Tool-Ergebnisse 340 k            │ Beendete im vorgeschlagenen Band; Etikett „idle/done“  │
 │ Synthese · Opus         │                      │ Slot-Reihe leer, tmux-Sitzung weg,            │ (cat/sed-Schleifen über Docs,    │ war unzuverlässig, nur Pane-Lesung beweist Tod         │
 │ (archivierter           │                      │ persistierte Slot-Datei noch mit altem Label  │ größter Einzelausstoß 24 k)      │ (MESSBAR)                                              │
 │ Vorgänger)              │                      │                                               │                                  │                                                        │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 10 Codex 01a01da6 (sol) │ 32 h                 │ Board null; Rollout belegt 70.009 / 258.400 = │ 56 MB Rollout; kumulativ 204     │ Gründungs-Frische-Defekt: alte AGENTS.md („hard loader │
 │                         │                      │ 27,1 % (last_token_usage.total_tokens +       │ Mio. Input-Token (200 Mio.       │ requirement“) in Rollout-Zeile 6 injiziert;            │
 │                         │                      │ model_context_window, MESSBAR aus             │ gecacht), 407 k Output           │ reparierter „Loader boundary“-Text erscheint erst      │
 │                         │                      │ ~/.codex-Rollout)                             │                                  │ Zeile 10.547/14.985 (MESSBAR)                          │
 ├─────────────────────────┼──────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
 │ 14 pi+Opus-Brücke       │ frisch               │ null — Pi-Reader existiert, aber              │ —                                │ Nenner unbekannt ⇒ ganze Tatsache entfällt (korrekt    │
 │                         │                      │ contextWindowFor("claude-bridge/claude-opus-5 │                                  │ ehrenvoll, aber vermeidbar)                            │
 │                         │                      │ ") → null (CODE-ONLY src/protocol.ts:171)     │                                  │                                                        │
 └─────────────────────────┴──────────────────────┴───────────────────────────────────────────────┴──────────────────────────────────┴────────────────────────────────────────────────────────┘

 Träger-Ranking (A), nach Resident-Anteil: 1. Tool-Ergebnisse (Read-ganze-Datei, cat/sed, Kommando-Stdout) 40–83 % der Hauptkette in jeder Session (MESSBAR). 2. Ambient-Attachment-Steuer:
 Hook-Erfolgs-Stdout (129–230 k Zeichen; Hooks: block-no-verify, pre-edit-guard, config-protection, post-edit-format), Token-Reminders (29–49 k), Listings (~30 k einmalig) — wächst pro
 Tool-Aufruf (MESSBAR als Datei; Resident INFERRED). 3. Tool-Argumente (Write/Edit-Texte) 13–260 k. 4. Assistent-Text 12–56 k. 5. Assistent-Reasoning: auf Festplatte redigiert, 0 Zeichen —
 nur über kumulative Output-Token (61–271 k) begrenzt (UNKNOWN im Detail). 6. Owner-/Server-Text 2–11 k, Gründungs-Brief 4–6 k (MESSBAR). 7. Subagenten-Ernte: null Task-/Sidechain-Datensätze
 in allen fünf Transkripten; Orchestrierung läuft über Hintergrund-Bash + Scratchpad (MESSBAR). 8. Komprimierung: null Ereignisse; Übergabe-Muster ist Neustart des Nachfolgers + HANDOFF.md
 (2–4 %, CODE-ONLY CLAUDE.md). Resident ≠ kumulativ: Messwert = letzter Turn-Input (135–281 k); kumulative Abrechnung wird durch Cache-Reads dominiert (s10: 204 Mio / 200 Mio gecacht).

 B (Warum die Prozente differieren): Alter × Tool-Aufrufe (Hook-/Reminder-Steuer je Aufruf), Lese-Strategie (ganze Datei vs. Zeilenbereiche) und Schreibvolumen — nicht Owner-Frequenz. s12 =
 Grundpreis; s2 = Grundpreis + 12 min intensive Werkzeugarbeit; s5/s11 = Stunden mit einer schlechten Lesegewohnheit (Read-ganze-Datei) bzw. hohem Schreibvolumen; s3 = tote Synthese-Session,
 die im Band endete.

 Die 25–30-%-Lebenszyklus-Regel (Klartext)

 - 25 % = START der Übergabe, keine Decke (bestehende Formulierung aus CLAUDE.md behalten): Controller beginnt, HANDOFF.md inkrementell zu schreiben, plant Nachfolge, beginnt keine neue teure
   Grabung (Host-Graben, neue Langzeit-Recherche). Eine laufende kurze Kette darf natürlich enden — Landen/Deploy bleiben sowieso Owner-Akte. Messwert statt Schätzung: ctx am eigenen Slot;
   null heißt „unmessbar“ und zählt nicht als grün.
 - 30 % = Verbotszone für neue Großvorgänge: keine ganzen Dateien mehr neu in den Kontext, keine zweite Gründungs-Lektüre, keine neue Task-Welle. Weiter erlaubt: kurze beendende Ketten,
   Übergabe, Nudges.
 - HANDOFF (Neustart des Nachfolgers) ist der Normalfall — gemessen: alle fünf Opus-Sessions wurden per Übergabe übergeben, null Komprimierungen; Neustart kostet 2–4 % und setzt auf den
   Grundpreis zurück.
 - KOMPACTIEREN nur wenn: Sitzungs-/Bindungskontinuität mitten in einer Kette zwingend UND die Restkette kurz UND ctx gemessen. Unsicher: vor Land-/Verify-Grenzen (Beweisverlust), wenn
   Füllung aus Tool-Ergebnis-Masse besteht (die Beweise müssen nach der Komprimierung neu erbracht werden), bei ctx: null, und bei nachweislich überholtem Regelwerk (Komprimierung backt die
   alte Regel ein).
 - Kein blinder Prozent-/Zeit-Timer: Die Bandbreite wählt die ART der Restarbeit aus (bestehende Regel: Kosten hängen an der Art, nicht an der Menge). Mechanische Naht existiert bereits:
   tickMigrate + FLEET_MIGRATE_PCT (3 Anstups-Versuche, gaveUp, null wird nie als null gewertet) — als Experiment auf 25 für nicht-Lane-Controller setzen. Zusätzlich
   Mindestalter/Mindestprompts als Anti-Churn-Schutz.

 Empfehlungen (maximal fünf, rangiert)

 1. Codex-Kontext-Reader aus dem eigenen Rollout (Fenster E). Ersparnis: keine Token, aber die gesamte Lebenszyklus-Politik wird querschnitt-fähig — s10 läuft mit 27 % unsichtbar im Band.
    Urteilsrisiko: hoch, solange null. Fläche: CODEX_HARNESS.context (server.ts, bewusst null gelassen) — Tail-Reader der letzten token_count-Zeile: last_token_usage.total_tokens, Nenner aus
    model_context_window derselben Zeile (nicht raten). Fehlermodus: 56-MB-Rollout → nur Tail-Read (CTX_TAIL_BYTES-Muster existiert); gerissene/fehlende Zeile → null. Canary:
    e2e-Harness-Codex-Slot, ctx innerhalb ±2 Punkten der TUI-Selbstauskunft; live Gegenprobe s10 ≈ 27 %.
 2. Lese-Disziplin als beförderte, beratende Regel (kein Gateway): Bereiche statt ganze Dateien, Zeilenbereiche zitieren, Bulk-Ausgaben nach /tmp auslagern, Zweitlesen per Referenz statt
    erneutes Holen. Ersparnis: 30–50 % des Tool-Ergebnis-Anteils (s5 wäre ohne die 1,05 Mio.-Zeichen-Reads unter 15 % geblieben; s3 unter 20 %). Urteilsrisiko: weniger Stagnation durch
    Duplikate. Fläche: AGENTS.md portable Vertrag + Briefs (Owner-Akt, null Serveränderung). Fehlermodus: Über-Kürzung verpasst Beweis — daher Schmal-Beispiel-Pflicht. Canary:
    zweiwöchentliche Re-Audit mit demselben Parser: Tool-Ergebnis-Anteil pro Hauptkette, MB bei Übergabe.
 3. Ambient-Steuer senken: Hook-Erfolgs-Stdout (nur blockierende Ausprüche behalten, Erfolg-Echo kürzen) + Token-Erinnerungs-Frequenz prüfen. Ersparnis: 5–10 Band-Punkte pro
    Controller-Lebensdauer (129–230 k Zeichen Hooks je Session, wachsend je Aufruf). Fläche: Host-Hook-Skripte + Claude-Einstellungen (Owner-Akt). Fehlermodus: verlorene Warnung —
    blockierende Sprüche bleiben vollständig. Canary: Attachment-Zeichen je 100 Bash-Aufrufe im Re-Audit.
 4. Gründungs-Frische-Fingerprint über bestehende Naht: context-receipts.jsonl minted bereits {hash, head, slot, harness…} pro Auslieferung — dieselbe Zeile um rulebookSha (AGENTS.md-Blob,
    optional CLAUDE.md-Render) erweitern; Controller-Selbstprüfung ist ein Befehl (shasum + git log -1 -- AGENTS.md). Antwort-Treppe bei Abweichung: Delta lesen (git diff der Regeldatei),
    Program-MAIN benachrichtigen; Neugründung nur, wenn das Delta Loader-/Autoritätsvertrag berührt (der s10-Fall). Komprimieren/Übergabe allein heilt nicht. Ersparnis: verhindert die
    32-Stunden-Regel-Veraltungsklasse (gemessen: s10 trug alte Regel 10 541 Zeilen lang). Fehlermodus: Fingerprint ohne Delta-Pflicht wird Zeremonie. Canary: e2e-pin — AGENTS.md mutieren,
    Session meldet Abweichung mit benanntem Diff.
 5. 25–30 offiziell als START-Band (Owner-Entscheid), 44/36 fällt für MAINs, Lanes behalten 36-Anker. Fläche: CLAUDE.md-Abschnitt „Kontext-Schwelle“ + FLEET_MIGRATE_PCT=25 als begrenztes
    Experiment an EINEM Controller. Fehlermodus: vorzeitiges Zyklen zerstört Programm-Intuition → Mindestalter + Anstups-Budget 3 bleibt. Canary: eine Woche Lane-Outcomes/Übergabe-Zahlen
    vergleichen; Alarm bei „Zyklus ohne Fortschritt“.

 Explizit zurückgezogen (Zeremonie ohne belegten Nutzen): harter Prozent-Timer ohne Ketten-Klasse; jede neue Entscheidungstyp-Registrierung (H.2/H.4 fiel zu Recht); jede harnessSupport-Spalte
 auf supports.*-Flags (Politik, nicht Messung); Kontext-Packs als Gateway irgendeiner Art (bleiben, wie der Owner will, beratend); automatische Re-Injektion des Regelwerks bei jedem Prompt
 (Fingerprint + Delta-Pflicht ist billiger und ehrlicher).

 Offene UNKNOWNs

 - Assistent-Reasoning-Anteil am Resident-Kontext ist aus dem Transkript nicht messbar (redigiert); nur Output-Token-Summen begrenzen es. Ob Urteilsqualität bei 25–30 % wirklich messbar
   abfällt: UNKNOWN — das Band ist eine Owner-Prävention, kein gemessenes Kliff (das einzige dokumentierte Kliff ist die 83-%-Auto-Komprimierung, CODE-ONLY).
 - Ob Hook-Anhänge zu 100 % im residenten Kontext landen: INFERRED (Hook-Warnungen wurden in Panes befolgt), nicht direkt gemessen.
 - Systemprompt+Tools-Anteil (~74 k Token Differenz bei s12): INFERRED aus Rest; direkte Messung wäre nur über API-Debug-Ausgaben möglich.
 - Slot-3-artige Tote: ob persistierte Slot-Datei vs. In-Memory-Reihe auseinanderlaufen ist ein eigenständiger Sensor-Defekt — hier nur festgestellt, nicht geprüft.

 Widerspruch zur bisherigen Architektur

 1. Gegen die These „ctx: null bei Pi sei nur eine nicht gestellte Frage“ (Synthese §3): Nur halb richtig. Pi/pi-zai haben einen Reader (s4 und ich selbst melden Werte), aber die Brücke
    pi+Opus fällt am Nenner (Modell-Tabellen-Eintrag), und Codex hat gar keinen Reader — die Paritätsaussage muss in zwei verschiedene Defekte getrennt werden, sonst wird der falsche
    repariert.
 2. Gegen J.1 ohne Lebenszyklus-Kopplung: Die Autonomie-Hülle (10 offene Tasks, releaseTask("machine")) regelt, was eine MAIN darf — aber nichts, was sie im Fenster hält. Eine MAIN, die 10
    Tasks brieft, verbrennt genau das Band, in dem sie autonom sein soll. Die Hülle braucht die Übergabe-Band-Pflicht als Fähigkeit in derselben Tabelle, sonst werden genau die
    Session-Neugründungen mitten im Hüllen-Rollout passieren, die die Autonomie wieder begründen sollen.
 3. Gegen die naive 44→25/30-Verschiebung: CLAUDE.md selbst sagt, engere Zahlen waren zu eng (die 44 existiert, WEIL Zahlen zu eng waren). Ich unterstütze das Band als START-Punkt mit
    Ketten-Ausnahme — aber als harte Decke wäre es eine Mikro-Steuerung, die dem Owner-Intent („nicht mit Zeremonie antworten“) widerspricht. Grundpreis 10–13 % plus Übergabe-Reserve 2–4 %
    heißt: 25 % START lässt nur ~10 Punkte Spielraum — ohne Empfehlung 2 (Lese-Disziplin) wird das Band durch reine Werkzeug-Masse trivial ausgelöst und damit bedeutungslos.
 4. Klein, aber konkret: Der Mess-Schnipsel in CLAUDE.md nutzt eine hartcodierte IP — ein Frische-Defekt derselben Klasse, die diese Untersuchung misst; sollte auf Umgebungsvariable/Hostname
    umgestellt werden, wenn die Schwelle neu gefasst wird.

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
~/claude-fleet (main)
