---
frage: Welche zehn Schwachstellen der Pruefapparatur kosten am meisten und lassen sich einzeln schneiden?
urteil: Vorrang haben falsche Erfolgsbelege und ungeschuetzte Typgrenzen; zehn Repros zeigen konkrete Luecken, keine neue Flake-Rate.
bereich: [verify, e2e, types, tests, suite-kontention]
belege: [e2e/security.ts, e2e-stage.sh, server/persist.ts, watchdog.sh, e2e/pins.ts, e2e/review.ts, src/client.ts, e2e/history.ts]
nicht-gemessen: Keine neue Laufzeitsuite, keine vollstaendige semantische Negativ-Zwillingszaehlung, keine Live-Fehlerhaeufigkeit.
stand: 2026-09-14
---

# Zehn teure Luecken der Pruefapparatur

Quellstand: `754c37ed45a82c2e5094d9063fd8746bb0785bd6`. Vier native Threads lasen Checkqualitaet, Wrapper, Typgrenzen und Trail; die Hauptinstanz las die benannten Stellen und fuehrte alle zehn Repros selbst aus. Die gemeinsame Pruefapparatur sollte existieren, weil Instanzisolation, Belegqualitaet und dieselben Datenvertraege zentral geprueft werden muessen.
Rangfolge nach moeglichem Schaden und verdeckter Fehlmessung; keine empirische Schadenssumme. Repros R1–R10 stehen unten als kopierbare Shell-Funktionen. Sie lesen Quellen oder veraendern nur Speicher; R4 legt Compiler-Ausgabe kurz im System-Scratch ab. Ausgaben gelten fuer diesen Stand.

## 1. Top-10

1. **Befund:** `e2e/security.ts#pathAliases` (463–488, 608–627): `url["pathname"]` bleibt fuer alle drei Pre-auth-Extraktoren unsichtbar.
   **Kosten:** Ein zusaetzlicher unautorisierter Routingzweig kann den Allowlist-Pin gruen lassen; bewiesen ist die Blindheit, kein vorhandener unautorisierter Endpunkt.
   **Repro:** `R1` → `{"routes":[],"unrecognized":[],"aliases":[]}` trotz eingefuegtem `/api/back-door`-Zweig im Speicher.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e/security.ts#pathAliases samt Extraktor-Gegenproben. DONE Jede nicht erkannte Routingform wird abgewiesen, einschliesslich berechnetem Property-Zugriff. VERIFY Originalextraktoren gegen adversariale Formen pruefen, danach Security-Suite auf erlaubtem Host.

2. **Befund:** `e2e-stage.sh#_st_inherited` (218–227) und `server.ts#inheritedSuiteHolder` (21230–21241): geerbter Hold prueft PID, aber keine Prozessgeburt; normale Wartende pruefen beides.
   **Kosten:** Alter Export plus liegengebliebener Lock plus wiederverwendete PID kann die Queue umgehen und parallele Suiten zulassen; die Annahme des falschen Halters ist im Stub bewiesen, reale Kollision unbekannt.
   **Repro:** `R2` → `inherited=1 holder=4242 birth-check=absent` und `inheritance-block-mentions-birth=false` bei simulierter alter Geburt.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e-stage.sh#_st_inherited und server.ts#inheritedSuiteHolder mit Mutex-Proben. DONE Ein Hold mit abweichender oder unlesbarer Geburt autorisiert kein Erben. VERIFY Gleiche PID mit gleicher, anderer und unbekannter Geburt deterministisch pruefen.

3. **Befund:** `server/persist.ts#readLedger` (80–100) behauptet `JSON.parse(line) as T`; `server.ts#stewardRecentSends` (2776–2784) liest danach ungeprueft `e.event`.
   **Kosten:** Gueltiges JSON `null` kann Ledger-Auswertung und Sendepruefung abbrechen, waehrend `malformed=0` bleibt; keine solche Live-Zeile nachgewiesen.
   **Repro:** `R3` → `{"rows":[null,null],"total":2,"malformed":0}`; `TypeError: null is not an object (evaluating 'e.event')`. Zwei Zeilen entstehen durch die zwei gestubbten Rotationsgenerationen.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE server/persist.ts#readLedger und ausgesuchte Verbraucher samt reinen Reader-Proben. DONE Null, Primitive und falsche Datensatzformen erhalten einen expliziten Befund. VERIFY Gueltige, syntaktisch kaputte und strukturell falsche Ledger-Zeilen durch Originalreader und Verbraucher pruefen.

4. **Befund:** `watchdog.sh#VERIFY_CMD` (91), `e2e/pins.ts#tscArgs` (989–996): transitive Gate-Abdeckung fehlt fuer sieben von 122 getrackten TS-Dateien; der Entry-Pin behauptet Vollstaendigkeit mit einer handgepflegten Teilmenge.
   **Kosten:** Typregressionen im gebauten Hub-Client und sechs Werkzeug-/Probe-Einstiegen erreichen keinen Compiler im Gate; ein gruener Build ersetzt diese Pruefung nicht. Der aktuelle Zusatzlauf ueber die sieben Dateien ist fehlerfrei.
   **Repro:** `R4` → `tracked=122 covered=115 missing=7`: `acceptance-probe.ts`, `drills/drill-3-clean-review.ts`, `graph-coverage.ts`, `land-collision-stats.ts`, `land-quality.ts`, `lane-context-cost.ts`, `src/hub.ts`.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE watchdog.sh#VERIFY_CMD und e2e/pins.ts#tscArgs samt Verify-Dokumentation. DONE Alle aktiven TS-Einstiege sind erfasst, Ausnahmen explizit benannt. VERIFY Compiler-Dateimenge gegen getrackte Quellen vergleichen und Typfehler-Mutation im bisher fehlenden Hub-Einstieg nachweisen.

5. **Befund:** `e2e/pins.ts#noRunner` (419) akzeptiert einen kommentierten Runner; `e2e/pins.ts#RULE_SHARD` (8073–8095) zaehlt Imports statt ausgefuehrter Familien.
   **Kosten:** Ein Wrapper beziehungsweise eine komplette Checkfamilie kann seine Ausfuehrung verlieren, waehrend genau die Vollstaendigkeits-Pins gruen bleiben; das ist kein Nachweis eines gruenen Gesamt-Audits ohne Runner.
   **Repro:** `R5` → `runner-line-disabled=True; noRunner-pin-accepts=True; exit-pin-accepts=True`, `active-runner-lines=0`; zweite Original-Pin-Probe: `{"removedInvocation":true,"pins":[true,true,true]}`.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e/pins.ts#noRunner und e2e/pins.ts#RULE_SHARD. DONE Kommentar-Runner und entfernter run-Aufruf machen die passenden Pins rot. VERIFY Beide Mutationen im Speicher gegen die Originalpins ausfuehren, danach bun e2e/pins.ts.

6. **Befund:** `e2e-clean-review.sh#wait_bound` (115–127) sowie vier weitere Wrapper enthalten zusammen sieben Boot-curl-Ausdruecke ohne Request-Deadline.
   **Kosten:** Ein angenommener HTTP-Request ohne Antwort kann den Mutex bis zum aeusseren Timeout halten; 60 Schleifen mit 0,5 s Schlaf begrenzen die Dauer des curl selbst nicht. Kein Netzhaenger erzeugt.
   **Repro:** `R6` → `e2e-claude-gate.sh:3 (201,238,263); e2e-clean-review.sh:1 (119); e2e-isolated.sh:1 (843); e2e-postland-audit.sh:1 (208); e2e-security.sh:1 (83)`.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE Boot-Proben dieser fuenf Wrapper und e2e/pins.ts. DONE Jede einzelne HTTP-Probe hat eine begrenzte Gesamtdauer. VERIFY Isoliert einen annehmenden, nie antwortenden HTTP-Responder pruefen und die Deadline-Anforderung pinnen.

7. **Befund:** `e2e/security.ts#run` (714–719): Die Owner-Positivkontrolle schliesst nur 401/403/404 aus und akzeptiert deshalb Serverfehler als Zulassung.
   **Kosten:** Ein kaputter Owner-Pfad liefert der Auth-Matrix einen vermeintlichen positiven Existenzbeleg; die Negativmatrix kann dabei gruen bleiben.
   **Repro:** `R7` → `ownerStatus=500 admissionCheck=true`, ebenso 502/503; Kontrolle 404 ergibt false, 200/400/409 true.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e/security.ts#run und ownerSafe-Fallbeschreibung. DONE Jeder positive Kontrollaufruf prueft seinen erwarteten Status und Fehlertext. VERIFY Eingespeiste 500/502/503 muessen die Kontrolle rot machen, danach Security-Suite auf erlaubtem Host.

8. **Befund:** `e2e/review.ts#idlAfter` (205–223): Review-Promise verworfen, nach Recycle 8000 ms Schlaf, dann nur `cached===false`; Abschluss des alten Reviews unbeobachtet, obwohl `server.ts#reviewResponse` (12917–12922) POST erst nach `job.p` beantwortet.
   **Kosten:** Ein spaetes Review kann vor seiner gefaehrlichen Schreibstelle gruen geprueft werden; zugleich mindestens 8 s feste Wartezeit je erreichter Sonde. Die gemessenen Intervalle enthalten Reopen/HTTP-Arbeit und sind keine Checkdauer.
   **Repro:** `R8` → Trails `isolated-20260913T224812Z-32907` / `isolated-20260914T043130Z-27323`: je `rows=4419 failures=0`, `interval_ms=8537` / `8547`, `ok=True`; Quelle zeigt `void post` und `Bun.sleep(8000)`.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e/review.ts#idlAfter. DONE Die Sonde beobachtet erfolgreichen Abschluss des alten Reviews und prueft danach den neuen Cache. VERIFY Abschluss auf erlaubtem Suite-Host ueber 8 s verzoegern und die echte Abschlussbarriere nachweisen.

9. **Befund:** `src/client.ts#qTaskSummary` (7193–7195), `src/client.ts#TaskInfo` (260): Server erlaubt und liefert Quelle `main`, Clientunion laesst sie aus und beide Queue-Darstellungen fallen auf `owner` zurueck.
   **Kosten:** Agentengeschriebene Aufgaben erscheinen als Owner-Auftraege; der Netzcast in refresh (5416) verbirgt den auseinanderlaufenden Datenvertrag vor tsc.
   **Repro:** `R9` → `main task source label: owner`; Serverunion `owner | intake | steward | main`, Clientunion `owner | intake | steward`.
   **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE src/client.ts#TaskInfo, qTaskSummary, renderQueueDetail und gemeinsamer Source-Typ. DONE Alle vier Quellen werden korrekt dargestellt; neuer Serverwert erzwingt Anpassung. VERIFY Typpruefung und reine Darstellungssonde fuer jede erlaubte Quelle.

10. **Befund:** `e2e/history.ts#run` (133–151): einziger inkrementeller Transcriptabruf ohne Fixture-Append; steigendes total mit leerem entries besteht den Check.
    **Kosten:** Ein nach dem ersten Poll eingefrorener Live-Verlauf kann unentdeckt bleiben; bewiesen ist die zu schwache Sonde, kein eingefrorener Produkt-Reader.
    **Repro:** `R10` → `{"previousTotal":2,"serverTotal":4,"newEntries":0,"incrementalCheck":true}`.
    **Schnitt:** ROLLE codex/gpt-6-astra/high. FLAECHE e2e/history.ts#run. DONE Nach Fixture-Append erscheinen exakt die neuen Eintraege; ohne Append bleibt total gleich. VERIFY Rollen, Texte und total beider inkrementeller Faelle auf erlaubtem Suite-Host pruefen.

## 2. Zaehltabelle und Reichweite

AST-Zaehleinheit: syntaktische Aufrufstellen von `check(...)`, in pins.ts von `pin(...)`; keine Laufzeit-Checkanzahl. Schleifen vervielfachen, Zweige ueberspringen Aufrufe; die 6 Harness- und 1 Lane-Helper-Aufrufstellen sind mitgezaehlt. Casts = `AsExpression`/`TypeAssertionExpression`, einschliesslich `as const`. Feste sleeps = `Bun.sleep` mit numerischem Literal, auch innerhalb von Pollschleifen; keine behauptete Einsparsumme. 7 dieser 529 Stellen haben Literale >5000 ms.
Negativ-Zwilling ist eine semantische Szenariozuordnung, kein Wort im Checknamen. `unknown` bedeutet nicht vollstaendig zugeordnet, keinesfalls null Luecken. `—` bedeutet keine Check-Aufrufstelle. Eine exakte moduleweite Negativzahl wurde nicht erhoben; die Kostenprioritaet wurde zugunsten der ausgefuehrten Gegenbeispiele entschieden.

| e2e-Modul (.ts) | Checks gesamt (Aufrufstellen) | Checks ohne Negativ-Zwilling | feste sleeps | Casts |
|---|---:|---|---:|---:|
| attention | 38 | unknown | 9 | 27 |
| auth | 25 | unknown | 0 | 2 |
| autos | 32 | unknown | 1 | 23 |
| briefstats | 30 | unknown | 0 | 6 |
| concurrency | 13 | unknown | 1 | 11 |
| context-packs | 20 | unknown | 0 | 8 |
| context-plan | 59 | unknown | 0 | 4 |
| ctl | 50 | unknown | 4 | 42 |
| ctx | 0 | — | 0 | 0 |
| deploy-facts | 45 | unknown | 6 | 11 |
| dirs-pins | 20 | unknown | 0 | 14 |
| drops | 21 | unknown | 0 | 1 |
| errors | 19 | unknown | 7 | 3 |
| explorer | 38 | unknown | 1 | 15 |
| harness | 6 | unknown | 6 | 4 |
| helper-daemon | 91 | unknown | 20 | 32 |
| helper-portal | 157 | unknown | 33 | 35 |
| history | 37 | unknown | 5 | 18 |
| intake | 22 | unknown | 0 | 4 |
| land-durability | 88 | unknown | 12 | 55 |
| land-provenance | 97 | unknown | 5 | 60 |
| lane-helpers | 1 | unknown | 4 | 4 |
| lane-risk | 11 | unknown | 0 | 9 |
| lane-suite | 80 | unknown | 3 | 4 |
| lanes-basic | 64 | unknown | 3 | 33 |
| lanes-lifecycle | 103 | unknown | 9 | 59 |
| merge | 228 | unknown | 19 | 111 |
| outcomes | 148 | unknown | 3 | 47 |
| pins | 585 | unknown | 0 | 23 |
| programs | 558 | unknown | 80 | 330 |
| prompts | 146 | unknown | 0 | 7 |
| ref-advance | 4 | unknown | 0 | 2 |
| repo-worker-audit | 70 | unknown | 13 | 25 |
| restart | 121 | unknown | 30 | 53 |
| review | 53 | unknown | 12 | 39 |
| security | 167 | unknown | 11 | 33 |
| self-token | 96 | unknown | 7 | 37 |
| share | 51 | unknown | 3 | 20 |
| slots | 192 | unknown | 31 | 47 |
| steward-core | 117 | unknown | 11 | 45 |
| steward-outcomes | 100 | unknown | 15 | 61 |
| summary | 51 | unknown | 0 | 22 |
| supervisor | 103 | unknown | 2 | 50 |
| sweep | 29 | unknown | 0 | 6 |
| tasks | 643 | unknown | 87 | 316 |
| trail-emit | 0 | — | 0 | 1 |
| trail | 12 | unknown | 0 | 1 |
| trailstats | 29 | unknown | 0 | 6 |
| transport | 24 | unknown | 2 | 5 |
| verify-queue | 100 | unknown | 9 | 12 |
| watch | 416 | unknown | 65 | 264 |
| **Summe (51 Dateien)** | **5210** | **unknown** | **529** | **2047** |

Zusaetzlich manuell verifiziert: explorer.ts:114–132 hat fuer `/api/commits` und `/api/commit-diff` keine 400-Gegenprobe: **2 Route×Status-Luecken, 3 Eingabefaelle** (je fremdes Repo, zusaetzlich malformed hash). Repro ausgefuehrt: `rg -n '/api/commit-diff|/api/commits' e2e/*.ts fleet-e2e*.ts` → nur explorer 114/117/119/123/130 und security-Kommentar 414; `sed -n '31036,31043p;31206,31214p' server.ts` → Guards `not a repo Fleet has open` zweimal, `bad hash` einmal. Vorhandener 404-Zwilling prueft einen anderen Guard. Diese Routenzaehlung ist keine Check-Zwillingszahl und keine Inventur aller Serverrouten.

Typen-Census (14 Dateien: server.ts, server/*.ts, src/client.ts): **953 Assertions, 13 direkte Doppelcasts, 0 AnyKeyword, 205 Non-null-Assertions**. Davon 106 Assertion-Ausdruecke mit `.json(`/`JSON.parse` im Ausdruck; keine reine Netzcast-Zahl. Topstellen: server.ts 484 Casts/169 Non-null; server/types.ts 176/4; src/client.ts 284/26. Nicht alle Casts sind Fehler; R3/R9 zeigen konkrete Kosten.
Lint-Dry-run: Gate-tsc mit `--noUnusedLocals --noUnusedParameters` → **33 Diagnosen in 18 Dateien**, 31×TS6133, 2×TS6192, Exit 1. Beispiele: `e2e/land-provenance.ts:688` pcBefore, `e2e/supervisor.ts:679` plogBeforeNudge, `server.ts:55` SymbolIndex. Kein belegter Schaden allein aus ungenutztem Namen. Aufruf: Gate-tsc-Argumente wie R4, `--listFilesOnly` durch beide noUnused-Flags ersetzen. Ohne diese Flags ergeben die sieben zusaetzlichen Einstiege Exit 0. Der erste Dry-run vor Installation scheiterte als Messung mit TS2688 (Bun-Typen fehlten); nach `bun install --frozen-lockfile` entstanden die genannten 33 noUnused-Diagnosen. Verwendetes `bunx tsc --version`: `Version 7.0.2`; AST-Census separat mit lokalem TypeScript 6.0.3.
`package.json:12–15` hat nur start/build, keinen lint/test-Script. **„Keine Unit-Tests“ ist als Bestandsaussage falsch:** fleet-e2e.ts:96–104 ruft reine Familien auf, e2e/context-packs.ts:2 bietet sogar einen direkten serverfreien Einstieg; Pins pruefen ebenfalls reine Funktionen. Es fehlt ein einheitlich benannter schneller Testlauf, kein Nachweis voellig fehlender Unit-Proben. Der geforderte Aufruf `bun e2e/trailstats.ts` wurde nicht benutzt: Das ist ein Checkmodul mit Harness-Import, kein lesender Trail-CLI.

## Repro-Funktionen (im Repository-Root)

```sh
R1() { bun -e 'const s=await Bun.file("e2e/security.ts").text(); const a=s.indexOf("const LITERAL ="), b=s.indexOf("// --- §2 fixtures",a); const f=new Function(new Bun.Transpiler({loader:"ts"}).transformSync(s.slice(a,b))+";return {routeSet,unrecognized,pathAliases}")(); const probe="if (url[\"pathname\"] === \"/api/back-door\") return json({ok:true});"; console.log(JSON.stringify({routes:f.routeSet(probe),unrecognized:f.unrecognized(probe),aliases:f.pathAliases(probe)}));'; }
R2() { python3 - <<'PY'
from pathlib import Path
import subprocess
s=Path('e2e-stage.sh').read_text(); a=s.index('_st_held_by="'); b=s.index('if [ "$_st_inherited" = 0 ]; then',a); block=s[a:b]
stub='FLEET_SUITE_LOCK=/unread-fixture; FLEET_SUITE_LOCK_HELD_BY=4242\ncat() { case "$1" in */pid) echo 4242 ;; */birth) echo "Mon Jan 1 00:00:00 2001";; esac; }; kill() { return 0; };\n'
r=subprocess.run(['/bin/sh','-c',stub+block+'printf "inherited=%s holder=%s birth-check=%s\\n" "$_st_inherited" "$_st_lock_pid" absent'],capture_output=True,text=True); print(r.stdout.strip()); print('inheritance-block-mentions-birth='+str('birth' in block).lower())
PY
}
R3() { bun - <<'TS'
const s=await Bun.file('server/persist.ts').text();
const source=s.slice(s.indexOf('export async function readLedger<'),s.indexOf('// same rotation-safe read')).replace('export ','');
const js=new Bun.Transpiler({loader:'ts'}).transformSync(source);
const readLedger=new Function('existsSync','Bun',`${js}; return readLedger;`)(()=>true,{file:()=>({text:async()=> 'null\n'})});
const result=await readLedger('memory-only');console.log(JSON.stringify(result));
try {result.rows.filter(e=>e.event==='steward_send')} catch(e){console.log(e.name+': '+e.message)}
TS
}
R4() { python3 - <<'PY'
from pathlib import Path
import re,shlex,subprocess,tempfile
root=Path.cwd(); s=Path('watchdog.sh').read_text(); cmd=shlex.split(re.search(r'bunx tsc [^&]+',s)[0])
with tempfile.TemporaryFile(mode='w+') as f:
 subprocess.run(cmd+['--listFilesOnly'],stdout=f,check=True); f.seek(0); seen={Path(p.strip()).resolve() for p in f if p.strip()}
tracked=[p for p in subprocess.check_output(['git','ls-files','*.ts'],text=True).splitlines() if (root/p).is_file()]
missing=[p for p in tracked if (root/p).resolve() not in seen]
print(f'tracked={len(tracked)} covered={len(tracked)-len(missing)} missing={len(missing)}'); print('\n'.join(missing))
PY
}
R5() { python3 - <<'PY'
from pathlib import Path
import re
s=Path('e2e-isolated.sh').read_text(); m=re.sub(r'(?m)^(eval .*bun fleet-e2e\.ts.*)$',r'# \1',s); runner=bool(re.search(r'\bbun\s+fleet-e2e[a-z-]*\.ts\b',m)); lines=[l.strip() for l in m.splitlines() if l.strip() and not l.strip().startswith('#')]
print(f'runner-line-disabled={s!=m}; noRunner-pin-accepts={runner}; exit-pin-accepts={lines[-1]=="exit $code"}'); print('active-runner-lines='+str(len([l for l in lines if re.search(r'\bbun\s+fleet-e2e[a-z-]*\.ts\b',l)])))
PY
bun -e 'import {SHARD_UNITS} from "./e2e/ctx"; const p=await Bun.file("e2e/pins.ts").text(); const a=p.indexOf("  const RULE_SHARD ="), b=p.indexOf("\n}\n",a); const code=new Bun.Transpiler({loader:"ts"}).transformSync(p.slice(a,b)); const original=await Bun.file("fleet-e2e.ts").text(); const mutated=original.replace("    await contextPacks.run(check);", ""); const seen=[]; new Function("read","SHARD_UNITS","pin",code)(()=>mutated,SHARD_UNITS,(name,ok)=>seen.push(ok)); console.log(JSON.stringify({removedInvocation:!mutated.includes("await contextPacks.run(check)"),pins:seen}));'
}
R6() { python3 - <<'PY'
from pathlib import Path
import re
for p in sorted(Path('.').glob('e2e-*.sh')):
 lines=[str(n) for n,l in enumerate(p.read_text().splitlines(),1) if '$(curl ' in l and 'http://127.0.0.1:$PORT/' in l and not re.search(r'--max-time|--connect-timeout| -m ',l)]
 if lines: print(f'{p}: curl-without-deadline={len(lines)} lines={",".join(lines)}')
PY
}
R7() { bun -e 'const s=await Bun.file("e2e/security.ts").text(); const line=s.split("\n").find(l=>l.includes("const denied = ownerRes.filter")); if(!line) throw Error("anchor missing"); const check=new Function("ownerRes",line+"; return denied.length === 0;"); for (const status of [200,400,409,404,500,502,503]) console.log(`ownerStatus=${status} admissionCheck=${check([{status}])}`);'; }
R8() { python3 - <<'PY'
from pathlib import Path
import json,subprocess
s=Path('e2e/review.ts').read_text().splitlines()
for i in (205,210,211,220,221,222,223): print(f'e2e/review.ts:{i}: {s[i-1].strip()}')
root=Path(subprocess.check_output(['git','rev-parse','--git-common-dir'],text=True).strip()).parent
for run in ('isolated-20260913T224812Z-32907','isolated-20260914T043130Z-27323'):
 rows=[json.loads(x) for x in (root/'e2e-trail'/f'{run}.jsonl').read_text().splitlines()]
 row=next(x for x in rows if x['check']=='a review completing after a slot recycle is NOT filed under the new lane')
 print(run,'rows='+str(len(rows)),'failures='+str(sum(not r['ok'] for r in rows)),'last='+rows[-1]['check'],'interval_ms='+str(row['msSincePrev']),'ok='+str(row['ok']))
PY
}
R9() { bun -e 'const s=await Bun.file("src/client.ts").text(); const expr=s.match(/function qTaskSummary[\s\S]*?const source = ([\s\S]*?);/)[1]; console.log("main task source label:",new Function("t",`return ${expr}`)({source:"main"})); console.log("server source union:",(await Bun.file("server/types.ts").text()).match(/source: "owner" \| "intake" \| "steward" \| "main"/)[0]); console.log("client source union:",s.match(/interface TaskInfo \{[^\n]+/)[0]);'; }
R10() { bun -e 'const s=await Bun.file("e2e/history.ts").text(); const m=/tr2\.ok && tr2j\.entries\.length === 0 && tr2j\.total >= tr1j\.total/.exec(s); if(!m) throw Error("anchor missing"); const f=new Function("tr2","tr2j","tr1j",`return ${m[0]}`); console.log(JSON.stringify({previousTotal:2,serverTotal:4,newEntries:0,incrementalCheck:f({ok:true},{entries:[],total:4},{total:2})}));'; }
# Einzeln aufrufen: R1, R2, ... R10. Keine Funktion startet eine Suite oder den Server.
```

Census-Repro (lokaler AST-Parser; kein Import der geprueften Module):

```sh
bun - <<'TS'
import ts from '/Users/owner/.bun/install/cache/typescript@6.0.3@@@1/lib/typescript.js';
const files=Bun.spawnSync(['git','ls-files','e2e/*.ts']).stdout.toString().trim().split('\n');
let total={checks:0,sleeps:0,long:0,casts:0};
for(const file of files){const ast=ts.createSourceFile(file,await Bun.file(file).text(),ts.ScriptTarget.Latest,true);const n={checks:0,sleeps:0,long:0,casts:0};
 function walk(x){if(ts.isAsExpression(x)||ts.isTypeAssertionExpression(x))n.casts++;
  if(ts.isCallExpression(x)){const e=x.expression.getText(ast);if(e==='check'||(file==='e2e/pins.ts'&&e==='pin'))n.checks++;
   if(e==='Bun.sleep'&&x.arguments[0]&&ts.isNumericLiteral(x.arguments[0])){n.sleeps++;if(Number(x.arguments[0].text)>5000)n.long++;}}
  ts.forEachChild(x,walk);}walk(ast);for(const k of Object.keys(total))total[k]+=n[k];console.log(file,JSON.stringify(n));}
console.log('TOTAL',files.length,JSON.stringify(total));
TS
```

## 3. Nicht gemessen und Abschlussgrenze

- Keine neue lokale oder remote Suite: Auftrag verbietet die Mac-Suite; die Repros messen Predikate, Compiler-Dateimengen und vorhandene Trail-Zeilen. Runtime-Wirkung der vorgeschlagenen Reparaturen bleibt offen. Die beiden Trail-Dateien sind vollstaendig gelesen, das Gesamtregister nicht.
- §11-Familienindex und relevante Mechanismen wurden gegengelesen; keine bekannte Familie wird als neu ausgegeben. Sharding-Kopplung/core-Gewichte aus der vorhandenen Messung sind keine neuen Top-10. Keine neue Flake-Rate, keine Parallelitaets-/RAM-Messung.
- Alle 51 e2e-Dateien wurden fuer den AST-Census gelesen; semantisch fokussierte Familien und die Top-10-Stellen, nicht jeder Check und nicht jede Route. Daher bleiben moduleweite Negativ-Zwillingszahlen unknown. Kein Nullwert ersetzt diese Luecke.
- CLAUDE.md blieb unangetastet und wurde nicht wholesale geladen. Portable Verify-Claims wurden mit Gate und einschlaegigen Pins verglichen; keine vollstaendige Inventur aller privaten Fragment-Behauptungen. Weitere ungemessene Lintklassen: Floating Promises, Exhaustiveness, Browser-DOM-Verhalten.
- Graphify lieferte ein gekuerztes Architekturergebnis; alle Befunde beruhen danach auf Quellen oder Ausfuehrung. Die im Brief genannten ~/.Codex-Hilfsdateien fehlten; die vorhandenen ~/.claude-Pendants wurden gelesen. Keine Regeldatei ausserhalb der Schreibflaeche geaendert.
- Verifikation dieser Dokumentationsaenderung: `bun install --frozen-lockfile` → `Checked 9 installs across 10 packages (no changes)`; `bun e2e/pins.ts` → `ALL PASS`; R1–R10 aus diesem Dokument ausgefuehrt (Exit 0); 16/16 datei#symbol-Verweise per rg aufgeloest, Top-10 damit 10/10; Drift → `wouldConflict:false`. Keine Codeaenderung.
