---
frage: Bestehen Bestandsadapter und empfohlenes Pi-Zai-Startprofil die lokale Automations-Feuerprobe?
urteil: STOP. Pi 0.85.0 zeigt Update Available; Read, Write, Composer-Annahme und Resume funktionieren in den gemessenen Läufen, geben aber keinen Adapter-Flip frei.
bereich: [pi-zai, automation, trust, acceptance, resume, ram]
stand: 2026-09-15
---

# Pi-Zai: lokale Automations-Feuerprobe

## 1 · Entscheidung

**STOP — Schnitt B bleibt gesperrt.** In beiden Profilen erscheint der zuvor nicht freigegebene Startbanner `Update Available` für 0.85.1. Der Auftrag setzt bei einem unerwarteten Update-Screen ausdrücklich STOP. Der Banner ist in diesen Läufen **nicht modal**: Die sechs gesendeten Turns kommen jeweils genau einmal im Pi-Session-Log an. Das ist ein positiver Zustellbefund, keine Erlaubnis, die STOP-Bedingung umzudeuten.

**Gemessener Peak-RSS von Pi einschließlich beobachteter Nachkommen: 183456 KiB = 179,16 MiB.** Ein einzelner kurzer Read-/Write-Turn, kein Langkontext- oder Parallelitätsbudget. Die vollständigen Messdaten stehen in §7; die eigenen Pi-Prozesse und der eigene tmux-Server sind beendet.

| Arm | Bestandsadapter | Empfohlenes Startprofil | Bewertung |
|---|---|---|---|
| Fehlende Key-Fixture | Pfadspezifischer Fehler; nur Shell, kein Pi beobachtet; kein Enter | Identisch | Negativarm belegt; keine echte Key-Datei verändert |
| Leere Key-Fixture | Identischer Guard; nur Shell; kein Enter | Identisch | Negativarm belegt |
| Synthetisch ungültiger Key | Composer leer → vollständiger Text → leer; genau ein User-Turn; anschließend 401 | Identisch | **Annahme ist kein Auth-Erfolg**; Prozessleben nach dem Fehler **unknown** |
| Unbekanntes Projekt mit `.pi/settings.json` | `Trust project folder?`; Dialog nicht bestätigt, kein Brief gesendet | Keine Frage; Meldung über ignorierte Projektressourcen, Composer leer | Zielprofil überspringt diesen Trust-Dialog; Bestandsstart nicht unbeaufsichtigt freigeben |
| Ready | Composer beobachtbar; Startausgaben teilweise noch nicht fertig | `Model scope: glm-5.3 (Ctrl+P to cycle)` und leerer Composer | Gemessene Frames; frühester sicherer Zustellzeitpunkt **unknown** |
| Composer / tatsächlicher Eingang | Drei Sendungen: invalid, read, resume; jeweils `complete` vor Enter, leer danach und User-Log exakt | Ebenso drei | Sechs Annahmen beobachtet; keine bloß lebende Pane als Beleg |
| Read und Write mit freigegebenem Key | Echter `read`-Aufruf, passender Tool-Return, `write`, bytegleiche Kopie | Ebenso; unbekanntes Projekt, Ressourcen ignoriert | Beide bestanden; `CONTEXT_OK` belegt wirksamen AGENTS-Kontext |
| Resume | Derselbe Session-Pin; vorheriger Wert ohne Tools korrekt wiedergegeben | Ebenso | Beide bestanden |
| Prozessende | `/quit`, Resume-Hinweis, Shell-Prompt; Pi im Sensor verschwunden | Ebenso | Beendet; nach Socket-Abbau keine erfasste PID übrig |
| Update | `Update Available` / `New version 0.85.1 is available. Run pi update` | Ebenso, auch beim Resume | **STOP gemäß Auftrag**, kein Update ausgeführt |

**Offene Grenze:** Keine automatische Fleet-Zustellung, Requeue-Entscheidung oder Auth-Fehlerklassifikation wurde durch einen laufenden Server geprüft. Auch Capture-Ausfall, frühe Zustellung während Boot-Ausgaben, nur Whitespace im Key, Langkontext und konkurrierende Starts bleiben **unknown**. Daraus wird weder PASS noch ein gemessenes `bootSettleMs` abgeleitet.

## 2 · Basis und Abgrenzung

Baum: `50b58e54ea70c01e5cab82575e80a1431e852b82`; Vorlage über `git show main:docs/messungen/2026-09-15-glm-automatable-laufort-pi-setup.md`, §§1 und 3 gelesen. Die vorhandene Harness-Abstraktion passt: Sie trennt Agentenleben, Startzustand und Annahme; diese Messung liefert Fakten für diese bestehende Naht.

Gelesen wurden `server.ts:625` (`PI_ZAI_KEY_FILE`), `server.ts:751` (`PI_ZAI_HARNESS`), `server.ts:802` (`PI_OX_HARNESS`), `server.ts:6045` (`sendText`), `server.ts:6253` (`paneReadiness`), `e2e/security.ts:1341` (`keyGuardProbe`) und `composer.ts:40` / `composer.ts:68` / `composer.ts:166` (Residue, Buffer, Arrival). Die Prüfung verwendete die **echten exportierten Composer-Funktionen**, importierte aber niemals `server.ts` als laufendes Modul.

`paneReadiness` gibt ohne Adapter-Deklaration `null` zurück (`server.ts:6255`); die Gründungswartefunktion überspringt dann die Prüfung (`server.ts:6269`). `sendText` wartet nach Paste 150 ms, prüft Arrival und misst nach Enter den leeren Composer (`server.ts:6127` bis zur Rückgabe `observed`). Diese Reihenfolge wurde mit eigenen tmux-Kommandos nachgestellt. **Nicht ausgeführt:** Fleet-Occupant-Prüfungen, `canDeliver`, Slot-API oder der gesamte Serverpfad. Die protokollierte Annahme ist ein lokaler Messwert, keine behauptete Antwort des Fleet-Servers.

Installation: `pi --version` → `0.85.0`. Maßgeblich waren die installierte README §Project Trust und `docs/security.md` §Project Trust. Dort zählen `.pi/settings.json` und Projektressourcen als Trust-Auslöser; `--no-approve` ignoriert sie, AGENTS-Kontext bleibt davon unabhängig. Die [öffentliche Pi-Primärdokumentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md) bestätigt diese Trennung. `gh search code` lieferte keinen zusätzlichen Treffer; `npm view @earendil-works/pi-coding-agent version` lieferte `0.85.1`. **Keine Installation/Aktualisierung von Pi.**

### Isolierung und zwei Startvarianten

Ein privates Scratch-Verzeichnis mit Modus 0700, ein eigener tmux-Socket, seriell höchstens ein Pi. Jeder Arm hatte eigenes `work/` und frisches `agent/`; nur Resume verwendete denselben Ordner und UUID. Eigener tmux-Server mit `-f /dev/null`, 140 × 44 Zeichen, Statusleiste aus. Die Pane-Umgebung übernahm nur PATH, unverändertes HOME, LANG und TMPDIR; TERM war `xterm-256color`. Kein Fleet-Self-Token gelangte in die Kanarie. Kein globales Pi-Setting, keine echte Schlüsseldatei, kein Live-Slot wurde verändert; `fleet.json` und `.env` wurden nicht geöffnet.

**Bestand:** Der `spawnCmd`-Funktionskörper wurde aus dem gelesenen `PI_ZAI_HARNESS` extrahiert und mit Scratch-`PI_ZAI_AGENT_DIR`, UUID und `high` ausgewertet. Der Key-Pfad blieb für die echten Läufe der aus `PI_ZAI_KEY_FILE`; nur die Pane-Shell expandierte ihn über `ZAI_API_KEY="$(cat '<freigegebener Pfad>')"`. Keine Key-Bytes im Messskript, Protokoll, Commit oder Report. Missing/empty/invalid verwendeten getrennte synthetische Fixtures, keine anderen echten Credentials.

**Gezielte Messabweichungen:** Der PATH war bereits in der bereinigten Umgebung, daher entfiel der zusätzliche PATH-Export. Fallback war `/bin/sh`, um persönliche Shell-Startskripte auszuschließen. Kein bestehendes gemeinsames Adapter-Home wurde kopiert: Verhalten bei dessen gespeicherten Trust-/Quiet-/Extension-Einstellungen ist **unknown**. Der Bestand entdeckte trotz frischem Pi-Home einen global angebotenen Skill `graphify`; im Profil erschien keine Skills-Liste. Das ist ein gelesener Startbefund, keine Vermessung aller Discovery-Pfade.

**Profil:** gleicher Provider, Katalog und Key-Guard, zusätzlich exakt:

```text
--models glm-5.3 --no-approve --no-extensions --no-skills
--no-prompt-templates --no-themes --tools read,grep,find,ls,bash,write,edit
```

Der Katalog wurde nach dem Pi-Ox-Prinzip mit `mktemp` → `printf` → `mv -f` ersetzt. Kein `--verbose`, `--offline`, `PI_SKIP_VERSION_CHECK` oder künstliches `quietStartup` im Agent-Home: Das getestete Profil folgt der Vorlage. Die Trust-Fixture enthielt `.pi/settings.json` mit `{"quietStartup":true}`; im erfolgreichen Profil-Read-Lauf lag dieselbe Fixture. Ihre Ignorierung ist durch sichtbaren Header, Trust-Hinweis und wirksamen AGENTS-Kontext belegt. Die atomare Datei war gültiges JSON; konkurrierende Schreiber wurden nicht gestartet.

Beim frischen Agent-Home lud Pi außerdem `fd` in dessen eigenes `agent/bin/`; ein `bsdtar`-Kind wurde dabei erfasst. Keine Discovery- oder Trust-Sperre wurde als Betriebssystem-Sandbox bezeichnet. Tools erhielten nur den Auftrag, die harmlose lokale Fixture zu lesen und zu kopieren.

## 3 · Zustellprotokoll und Frames

`t` bezeichnet Sekunden seit Beginn des Messskripts, kein angenommener Wandzeitstempel. Boot-Capture alle 250 ms zuzüglich Kommandolaufzeit, höchstens 15 s; nach erstem Composer weitere 1 s Beobachtungsabstand. Vor jeder Zustellung: `tmux capture-pane -p -e`, echter `composerBuffer({kind:"rules"}, frame)` muss `""` ergeben. Danach `load-buffer` → `paste-buffer -p` → 150 ms → `composerArrival` muss `complete` ergeben → **genau ein Enter** → Capture/Composer-Prüfung mit 3-s-Budget. Der erste Read nach Enter war jeweils schon leer. Endliche Session-Log-Beobachtung alle 250 ms, höchstens 100 s; keine Prompt-Wiederholung.

| Arm | Enter t | Leerer Composer t | User-Text exakt im Session-Log | Terminaler Ausgang |
|---|---:|---:|---:|---|
| bestand-invalid | 2,998 | 3,032 | 1× | `stopReason=error`, 401 |
| bestand-valid/read | 7,147 | 7,180 | 1× | `stopReason=stop`, Read/Write |
| bestand-valid/resume | 18,540 | 18,574 | 1× | `stopReason=stop`, RESUME_OK |
| profil-invalid | 27,009 | 27,048 | 1× | `stopReason=error`, 401 |
| profil-valid/read | 31,817 | 31,855 | 1× | `stopReason=stop`, Read/Write |
| profil-valid/resume | 51,059 | 51,095 | 1× | `stopReason=stop`, RESUME_OK |

Die 34–39 ms sind **erste positive Stichproben nach Enter**, keine gemessene interne Annahmelatenz. Die Timer enthalten tmux und Parser-Prozessstart. Der gewählte Abstand vor Zustellung beweist keinen minimal sicheren Boot-Wert.

Exakte gesendete Texte, ohne den zufälligen Dateiinhalt vorwegzunehmen:

```text
Reply exactly AUTH_CANARY.
Use read on fixture.txt. Then write its exact content to copy.txt. Reply READ_OK followed by the value you read and the context marker. Do not use any other files or tools.
Without tools, repeat the exact CANARY value from the previous read, then RESUME_OK.
```

Charakteristische Frame-Zeilen (SGR-Farbsequenzen hier entfernt; **alle 59 vollständigen ANSI-Frames unverändert bis auf Scratch-Pfad-Pseudonymisierung in §7**):

```text
bestand-trust-boot-30.ansi, t=4.936, Zeilen 4–15:
 Trust project folder?
 $SCRATCH/bestand-trust/work

 This allows pi to load .pi settings and resources, install missing project packages, and execute project extensions.

 → Trust
   Trust parent folder ($SCRATCH/bestand-trust)
   Trust (this session only)
   Do not trust
   Do not trust (this session only)

 ↑↓ navigate  enter select  escape/ctrl+c cancel
```

Der Trust-Dialog besitzt selbst zwei horizontale Regeln: Diese Geometrie allein ist **kein Ready-Beweis**. **Der echte `composerBuffer` liefert für den Trust-Frame sogar `""`**, obwohl der Dialog sichtbar ist. Der ANSI-Frame und der Parserlauf belegen damit eine falsche Gleichsetzung von „leerem Composer“ mit Eingabebereitschaft. Dieser Gegenbefund wurde erst durch Ausführen des Parsers sichtbar; eine anfängliche Erwartung „Dialogtext als Inhalt“ war falsch. Kein Enter wurde in diesen Dialog geschickt; ob er einen Gründungsbrief verschlucken würde, bleibt **unknown**.

```text
profil-trust-ready-95.ansi:
Model scope: glm-5.3 (Ctrl+P to cycle)
 This project is not trusted. Project .pi resources and packages are ignored. Use /trust to save a trust decision, then restart pi.
 Update Available
 New version 0.85.1 is available. Run pi update

profil-invalid-auth-result-88.ansi:
 Error: 401: {"code":"401","message":"token expired or incorrect"}
```

Das ist eine **erwartete Auth-Ablehnung des Negativarms**, kein Fehler des freigegebenen Keys. Sie entsteht erst nach tatsächlichem User-Turn. Ein leerer Composer bei der Annahme reicht folglich nicht als Auth-Readiness. Nach dem 401-Endframe wurde die eigene Session unmittelbar geräumt; ein zusätzliches positives PID-Sample **nach** diesem Fehler fehlt. Das Weiterleben nach 401 ist deshalb **unknown**. Eine erste Belegprüfung scheiterte genau an dieser überzogenen Behauptung (`AssertionError: false == true` beim Post-401-PID-Check); die Behauptung wurde zurückgenommen, keine Messdaten geändert. Der Update-Banner wurde im vollständigen Frame-Gegencheck identifiziert; die begrenzte Messserie erhob danach keinen PASS und änderte keinen Adapter.

## 4 · Read-Roundtrip, Kontext, Resume, Ende

| Profil | Session-UUID | Unbekannter Inhalt von `fixture.txt` und bytegleicher `copy.txt` |
|---|---|---|
| Bestand | `614c1577-97f5-4b16-a941-26f83ff12d55` | `CANARY_aa96a8209cdc4883aad8e19a825d7ab2` plus LF |
| Profil | `83e577bf-1783-40f7-bfa2-3eb03ebf0ce3` | `CANARY_fa687c9bacf44ee5953a66c7b480ebde` plus LF |

Beide Session-Logs enthalten in dieser Reihenfolge: exakter User-Text → Assistant-`toolCall read` mit `path:fixture.txt` → `toolResult` mit genau dem oben genannten Inhalt → `toolCall write` nach `copy.txt` → erfolgreicher Tool-Return → `READ_OK <Wert> CONTEXT_OK`. Tool-Call-IDs und ihre passenden Result-IDs sind im Belegpaket erhalten. Das Skript prüfte zusätzlich die Dateien byteweise. Der Brief verriet den zufälligen Wert nicht; das Schlusswort `CONTEXT_OK` stand ausschließlich in Scratch-`AGENTS.md`.

Nach `/quit` zeigte Pi jeweils `To resume this session: pi --session <UUID>` und `sh-3.2$`; die RSS-Sonde beobachtete keine Pi-PID mehr vor der Session-Räumung. Ein neuer Prozess startete mit **demselben `--session-id`**, Agent-Home und cwd. Er zeigte den vorherigen Verlauf und antwortete auf den neuen Turn ohne Tool-Aufruf exakt:

```text
CANARY_aa96a8209cdc4883aad8e19a825d7ab2 RESUME_OK
CANARY_fa687c9bacf44ee5953a66c7b480ebde RESUME_OK
```

Auch die Resume-Prozesse wurden über `/quit` beendet. Absichtlich blockierte oder negativ authentisierte Arme wurden nur über ihre eigene tmux-Session beendet. Abschließend `tmux -L <eigener Socket> kill-server`: Exit 0; bei t=57,780 s Schnittmenge aller erfassten eigenen PIDs mit lebenden PIDs **leer**. Kein Beenden nach Namensmuster. Die private Rohmessung wurde nach Einbettung des öffentlichen Belegpakets gezielt entfernt.

## 5 · RSS und Hostdruck

Sensor: `ps -axo pid=,ppid=,rss=,comm=`; **keine Prozessargumente**. Ausgehend von der eigenen Pane-PID wurden Nachkommen transitiv ermittelt, dann alle `pi`-Wurzeln und deren Nachkommen summiert. Die Pane-Shell ist separat erfasst, nicht in Pi-RSS eingerechnet. Nominaler Abstand 100 ms nach Sensorlauf; tatsächlich maximal 307 ms zwischen Samples desselben Arms. Insgesamt 233 Samples. Kurze Spitzen und Kinder zwischen Samples bleiben **unknown**; RSS kann gemeinsame Seiten mehrfach zählen und ist kein physischer Gesamt-Footprint.

| Arm | Max. Pi + Kinder, KiB | Bedeutung |
|---|---:|---|
| bestand-invalid | 167344 | Abgewiesener Provider-Turn |
| bestand-trust | 131696 | Nicht beantworteter Dialog |
| bestand-valid | 169984 | Start, Read/Write, Ende |
| bestand-valid-resume | 150848 | Verlauf laden und Folgeturn |
| profil-invalid | 165648 | Abgewiesener Provider-Turn |
| profil-trust | 164096 | Start mit ignorierter `.pi`-Fixture |
| profil-valid | **183456** | Höchstes beobachtetes Sample, t=46,299 s |
| profil-valid-resume | 170752 | Verlauf laden und Folgeturn |

Missing/empty: jeweils zwei Samples ohne Pi; kein Pi-Verbrauch daraus geschätzt. Ein beobachtetes Kind `(bsdtar)` mit 3360 KiB bei t=29,085 s ist in der Summe von `profil-trust` enthalten. Beim Gesamtmaximum war kein Kind vorhanden; Pi 183456 KiB plus separat 2016 KiB Pane-Shell = 185472 KiB. Modellgewichte liefen beim Provider; diese Zahl beschreibt den lokalen Prozessbaum.

`sysctl -n hw.memsize`: 8589934592 Bytes = 8 GiB. `memory_pressure` meldete in 16 Stichproben 46–49 % freie/zurückholbare Kapazität; vorher 48 %, nachher 48 %. Vor/nach dem Bestands-Read-Turn: 49/47 %, vor/nach dem Profil-Read-Turn: 48/49 %. `sysctl -n vm.swapusage` blieb in allen Stichproben bei `used = 2810.00M`; vollständige Ausgabe und `vm_stat` je Stichprobe stehen im Belegpaket.

**Keine Druckkurve innerhalb der Tools:** Hostdruck wurde an Phasengrenzen erhoben; nur RSS lief während der Turns kontinuierlich als Stichprobenserie. Zwischen den Hostdruck-Samples und zwischen den RSS-Samples ist der Zustand **unknown**. Parallel laufende fremde Arbeit wurde nicht kontrolliert; die kleinen Schwankungen werden nicht Pi zugerechnet. Die frühere Reservierungsannahme 0,25–0,50 GiB ist damit weder als Mindestbedarf bestätigt noch als Obergrenze bewiesen.

## 6 · Konsequenz und Verifikation

Für Schnitt B fehlen weiterhin eine ausdrücklich akzeptierte Update-Policy und der dazu passende erneute Startnachweis. `--verbose` für einen festen Header sowie `PI_SKIP_VERSION_CHECK=1` sind **ungetestete Kandidaten**, keine hier freigegebene Lösung. Ein unterdrückter Versionscheck wäre außerdem keine gemessene Auth-Prüfung. Die Freigabebedingung für B bleibt unerfüllt; Messauftrag A ist mit dem belegten STOP abgeschlossen.

Adapter/Server/Lifecycle-Projektion: **apply als gelesene Messfläche**, unverändert. Pi-Prozess, Composer und Session-Datei: **apply, gemessen**. Wire/Client: **not-applicable** für diesen Dokumentationsschnitt. Fleet-Transkriptintegration, Remote-Host und Container: **unsupported bzw. nicht vermessen**. Kein Adapter-Flip, Land oder Deploy.

Verifikation: Die vor dem Commit erneut abgefragte Gate-Projektion enthielt noch keine klassifizierten Dateien; `laneLocalProof` betrachtet ausschließlich den committed Footprint (`server.ts:3556`). Ausgeführt wurden Install, Pins und die unten stehende Belegprüfung. Die abschließende Orchestratorinnen-Vorgabe begrenzt die weitere Prüfung ausdrücklich auf Pins; keine Suite und keine weiteren Proben. Eine erneute Gate-Klassifikation nach Commit und die übrige Kette wurden nicht ausgeführt. Die Belegprüfung dekodiert §7, prüft Frame-Hashes, echte Composer-Funktionen, die negativen Key-Arme, Tool-Call/Result-Zuordnung, bytegleiche Kopien, exakte Resume-Antworten, Prozessende und RSS-Maximum. Sie bestätigt die Messdaten und den STOP-Grund, **keinen Automations-PASS**.

Bereits erhobene wörtliche Tails:

```text
bun install --frozen-lockfile:
9 packages installed [8.00ms]

bun e2e/pins.ts:
ALL PASS

Belegprüfung:
Frames + Composer + negative keys + exact turns + tools + resume + exit + RSS: ALL PASS
Automation verdict: STOP (Update Available); peak Pi + children: 183456 KiB
ALL PASS
```

Die finale Pins-Wiederholung und der Commit werden im Fleet-Report genannt. Offene Messarme stehen in §1 und §5; sie werden auf ausdrückliche Schlussvorgabe nicht weiter untersucht.

Die vollständige semantische Belegprüfung lässt sich aus Repo-cwd als privates Scratch-`verify.mjs` mit `bun <Scratch>/verify.mjs` ausführen:

```javascript
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root=process.cwd();
const {composerBuffer,composerRows,composerArrival}=await import(`${root}/composer.ts`);
const note=await Bun.file(`${root}/docs/messungen/2026-09-15-pi-zai-automation-feuerprobe.md`).text();
const encoded=note.match(/```pi-evidence-gzip-base64\n([\s\S]*?)\n```/)[1];
const raw=Bun.gunzipSync(Buffer.from(encoded.replace(/\s/g,''),'base64'));
const data=JSON.parse(new TextDecoder().decode(raw));
assert.equal(createHash('sha256').update(raw).digest('hex'),'e09723f50dff0778ead6e972615069809e264bfd42b56dfcfaf2be71f30b3efd');
const {frames,events,rss,fixtures}=data;
const form={kind:'rules'};
for (const e of events.filter(e=>e.kind==='frame')) assert.equal(createHash('sha256').update(frames[e.file]).digest('hex'),e.sha256);
assert.equal(Object.keys(frames).length,59); assert.equal(rss.length,233);
assert(!new TextDecoder().decode(raw).match(/\/Users\/|\b(?:\d{1,3}\.){3}\d{1,3}\b/));
for(const profile of ['bestand','profil']) {
 for(const kind of ['missing','empty']) {
  const name=`${profile}-${kind}`; const b=events.find(e=>e.kind==='boot-result'&&e.name===name);
  assert.equal(b.state,'key-guard'); assert(frames[b.frame].includes('pi-zai: missing or empty Z.ai Coding Plan key file:'));
  assert.equal(events.filter(e=>e.kind==='enter'&&e.name===name).length,0);
  const rows=rss.filter(e=>e.name===name); assert(rows.length>=2); assert(rows.every(e=>e.pi_pids.length===0&&e.pi_rss_kib===0));
 }
 const auth=events.find(e=>e.kind==='turn'&&e.name===`${profile}-invalid`);
 assert.equal(auth.exact_user_matches,1); assert.equal(auth.messages.at(-1).stopReason,'error'); assert(auth.messages.at(-1).errorMessage.startsWith('401:'));
 const read=events.find(e=>e.kind==='turn'&&e.name===`${profile}-valid`&&e.label==='read');
 const fixture=fixtures[read.name]; assert.equal(fixture.input,fixture.copy);
 const calls=read.messages.flatMap(m=>m.content.filter(c=>c.type==='toolCall'));
 assert.deepEqual(calls.map(c=>c.name),['read','write']);
 for(const call of calls) {
  const result=read.messages.find(m=>m.role==='toolResult'&&m.toolCallId===call.id);
  assert.equal(result.isError,false); assert.equal(result.toolName,call.name);
  if(call.name==='read') assert.equal(result.content[0].text,fixture.input);
 }
 assert.equal(calls[0].arguments.path,'fixture.txt'); assert.equal(calls[1].arguments.path,'copy.txt'); assert.equal(calls[1].arguments.content,fixture.input);
 assert(read.messages.at(-1).content.some(c=>c.text?.includes(`READ_OK ${fixture.input.trim()} CONTEXT_OK`)));
 const resume=events.find(e=>e.kind==='turn'&&e.name===`${profile}-valid-resume`);
 assert.equal(resume.messages.at(-1).content.find(c=>c.type==='text').text,`${fixture.input.trim()} RESUME_OK`);
 assert.equal(resume.messages.flatMap(m=>m.content.filter(c=>c.type==='toolCall')).length,0);
 const spawn=events.find(e=>e.kind==='spawn'&&e.name===read.name), again=events.find(e=>e.kind==='spawn'&&e.name===resume.name);
 assert.equal(spawn.sid,again.sid); assert.notEqual(spawn.pid,again.pid);
 for(const name of [read.name,resume.name]) {
  const quit=events.find(e=>e.kind==='frame'&&e.name===name&&e.label==='quit');
  const plain=frames[quit.file].replace(/\x1b\[[0-9;?]*[A-Za-z]/g,''); assert(plain.includes('To resume this session: pi --session '+spawn.sid)); assert(plain.includes('sh-3.2$'));
  assert(rss.some(e=>e.name===name&&e.t<quit.t&&e.t>quit.t-1&&e.pi_pids.length===0));
 }
}
const deliveries=events.filter(e=>e.kind==='delivery'); assert.equal(deliveries.length,6);
for(const d of deliveries) {
 const f=label=>events.find(e=>e.kind==='frame'&&e.name===d.name&&e.label===`${d.label}-${label}`);
 const turn=events.find(e=>e.kind==='turn'&&e.name===d.name&&e.label===d.label);
 const user=turn.messages[0].content[0].text;
 assert.equal(turn.exact_user_matches,1); assert.equal(composerBuffer(form,frames[f('before').file]),'');
 assert.equal(composerArrival(composerRows(form,frames[f('pasted').file]),user),'complete');
 assert.equal(composerBuffer(form,frames[f('accept').file]),'');
 assert.equal(events.filter(e=>e.kind==='enter'&&e.name===d.name&&e.label===d.label).length,1);
}
const trust=events.find(e=>e.kind==='boot-result'&&e.name==='bestand-trust');
assert.equal(trust.state,'trust'); assert(frames[trust.frame].includes('Trust project folder?')); assert.equal(composerBuffer(form,frames[trust.frame]),'');
assert.equal(events.filter(e=>e.kind==='enter'&&e.name==='bestand-trust').length,0);
const profileTrust=events.find(e=>e.kind==='boot-result'&&e.name==='profil-trust');
assert.equal(composerBuffer(form,frames[profileTrust.frame]),''); assert(!frames[profileTrust.frame].includes('Trust project folder?'));
assert(frames[profileTrust.frame].includes('This project is not trusted.'));
assert(Object.values(frames).some(f=>f.includes('Update Available')));
assert.equal(composerBuffer(form,''),null); assert.equal(composerArrival(['wrong'],'expected'),'differs');
assert.equal(Math.max(...rss.map(x=>x.pi_rss_kib)),183456);
for(const s of rss) assert.equal(s.pi_rss_kib,s.procs.filter(p=>s.pi_pids.includes(p.pid)||s.child_pids.includes(p.pid)).reduce((sum,p)=>sum+p.rss,0));
assert(rss.some(s=>s.child_pids.length>0));
assert.equal(events.at(-2).kind,'cleanup-socket'); assert.equal(events.at(-2).exit,0); assert.deepEqual(events.at(-1).surviving,[]);
process.stdout.write('Frames + Composer + negative keys + exact turns + tools + resume + exit + RSS: ALL PASS\nAutomation verdict: STOP (Update Available); peak Pi + children: 183456 KiB\nALL PASS\n');
```

## 7 · Vollständige öffentliche Messbelege

Das folgende gzip/Base64-Paket enthält 59 vollständige ANSI-Captures, 134 zeitgestempelte Ereignisse, 233 RSS-Samples, Session-IDs, Fixture/Kopie und Zusammenfassung. Nur der private Scratch-Präfix wurde überall durch `$SCRATCH` ersetzt; in Session-Message-Projektionen wurden Thinking-Blöcke weggelassen. Captures behalten sämtliche Zeilen, Leerzeilen und Farbsequenzen. `raw_sha256` identifiziert das private Original, `sha256` den enthaltenen pseudonymisierten Frame. Hashes allein behaupten keine externe Beglaubigung.

Dekodieren aus dieser Notiz, ohne neue Datei im Repo:

```sh
python3 - <<'PY'
import base64, gzip, hashlib, json, pathlib, re
p = pathlib.Path('docs/messungen/2026-09-15-pi-zai-automation-feuerprobe.md')
b = re.search(r'```pi-evidence-gzip-base64\n(.*?)\n```', p.read_text(), re.S)[1]
raw = gzip.decompress(base64.b64decode(b))
e = json.loads(raw)
assert hashlib.sha256(raw).hexdigest() == 'e09723f50dff0778ead6e972615069809e264bfd42b56dfcfaf2be71f30b3efd'
for event in e['events']:
    if event['kind'] == 'frame':
        assert hashlib.sha256(e['frames'][event['file']].encode()).hexdigest() == event['sha256']
assert max(x['pi_rss_kib'] for x in e['rss']) == 183456
assert e['events'][-1]['surviving'] == []
print('Evidence archive: hashes, peak and cleanup ALL PASS')
# Einzelnen vollständigen Frame bei Bedarf über print(e['frames'][dateiname]) lesen.
PY
```

```pi-evidence-gzip-base64
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
```
