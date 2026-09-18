---
frage: Verschluckt `pi --provider zai` beim Start einen unbeaufsichtigten Paste, so dass `pi-zai` vor einer möglichen Automatisierung eine Codex-artige Readiness-Naht braucht?
urteil: Nein, nicht belegt. Ein frischer, prozesslokaler Pi-Z.ai-Start zeigte nur einen nicht-modalen Update-Hinweis; ein ungesendeter Sentinel blieb sichtbar im Composer. Der Adapter bleibt ohne `readiness` und mit `automatable: false`.
bereich: [pi-zai, harness, zustellung, readiness]
belege: [server.ts#PI_ZAI_HARNESS, server.ts#paneReadiness, server.ts#canDeliver, /tmp/fleet-pi-zai-readiness.WqoEUG, /tmp/fleet-pi-zai-readiness.Bt6X8E]
nicht-gemessen: Verhalten einer künftigen Pi-Version; eine lokale `.pi`-Trust-Abfrage in einem Projekt, das solche Ressourcen enthält; eine ungültige oder zurückgezogene Z.ai-Coding-Plan-Berechtigung nach dem Start.
stand: 2026-09-18
---

# Pi-Z.ai-Start-Readiness: Negativprobe

## Ergebnis

`PI_ZAI_HARNESS` darf derzeit keine Codex-artige Readiness-Naht behaupten. Seine Startzeile
beendet bei fehlender Schlüsseldatei oder fehlendem Katalogaufbau den Pi-Prozess und öffnet die
Shell; `canDeliver()` meldet dann über die bestehende Prozessprobe `not-alive`, nicht einen
unsichtbaren Pi-Dialog. Mit vorhandenem Schlüssel und einem frischen, prozesslokalen
`PI_CODING_AGENT_DIR` erschien kein Auth-, Key-, Katalog- oder Erstlauf-Bestätigungsdialog.

Die einzige sichtbare Startmeldung war wörtlich:

```
Update Available
New version 0.85.1 is available. Run pi update
Changelog: https://pi.dev/changelog
```

Sie ist kein Auswahl-Screen: Ohne Enter in den Pane eingespeist blieb der Sentinel wörtlich
sichtbar:

```
FLEET_PASTE_PROBE_91d0
```

Damit ist für den beobachteten Zustand die relevante Gegenprobe erbracht: Der Hinweis verschluckt
den Brief nicht. Eine `readiness.accept`-Marke oder `blocks`-Liste würde ein nicht gemessenes
Risiko als Tatsache ausgeben und könnte bei künftiger Aktivierung von `automatable` einen gesunden
Pane unnötig requeueen.

## Methode und Grenze

Die Probe startete Pi 0.85.0 in einem neuen tmux-Pane mit `--provider zai --model glm-5.3-flash`,
einem frischen Verzeichnis unter `/tmp` als `PI_CODING_AGENT_DIR` und dem vorhandenen Schlüssel
als nur im Pane expandierter Umgebungswert. Sie setzte keine `.env`-Variable und sendete keinen
Enter; es gab keinen Modellaufruf. Die beiden temporären Agent-Verzeichnisse enthalten nur
Probe-Zustand außerhalb des Repos.

Die vorhandene pi-ox-Naht ist kein Gegenbeweis: sie erklärt einen Trust-Selector bei lokalen
`.pi`-Ressourcen und unterdrückt ihn mit `--no-approve`. Die pi-zai-Spawnzeile nutzt diese Flags
nicht. Dieser spezifische lokale-Ressourcen-Fall blieb hier ungemessen und ist daher ein
Voraussetzungstest vor einer Owner-Entscheidung, nicht ein Grund für eine erfundene Block-Regel.

## Vorschlag an die Owner-/MAIN-Entscheidung

`automatable: false` bleibt unverändert. Das bewahrt die aktuelle Policy, bis eine Entscheidung
für unbeaufsichtigte Z.ai-Arbeit getroffen ist. Falls sie später auf `true` wechseln soll, ist
zuerst eine frische Probe derselben Pi-Version nötig, einschließlich eines kontrollierten Projekts
mit lokalen `.pi`-Ressourcen. Erst ein dort belegter Eingabe-Dialog rechtfertigt eine
`readiness`-Naht samt Pin; ohne ihn wäre die Naht eine falsche Sperre.

## Nachtrag 2026-09-18 — die verlangte Probe mit lokalen `.pi`-Ressourcen

Gefahren mit derselben Pi-Version (0.85.0), der Bestands-Startzeile von `PI_ZAI_HARNESS`, frischem
Agent-Home und einem Projekt mit `.pi/settings.json` (`{"quietStartup":true}`), 140×44, eigener
tmux-Socket. Ergebnis: `Trust project folder?` ab dem dritten Boot-Frame, nie ein Composer davor;
der unbeaufsichtigte Paste war **nicht** auf dem Schirm, und das folgende Enter wählte das
vorausgewählte `→ Trust` — der Sentinel erreichte das Session-Log nicht (0 Dateien), und das
Agent-Home trug danach `trust.json` mit dem Projektpfad. Gegenarm ohne `.pi`: Sentinel sichtbar
im Composer und genau einmal im Session-Log. Damit ist der Eingabe-Dialog belegt, den §Vorschlag
als Voraussetzung einer `readiness`-Naht nannte; sie steht jetzt in `server.ts#PI_ZAI_HARNESS`
(Block: der Dialog am Bildschirmende, Accept: die Footer-Anzeige `…%/1.0M`), und `automatable` ist
mit ihr gekoppelt `true` (`docs/harness-adapter.md`, pi-zai-Absatz).
