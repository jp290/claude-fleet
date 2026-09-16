---
frage: An welchen Stellen entscheidet Fleet je Repo, was gilt (Verify, Audit, Lane-Deckel, Sentinel, Regelbuch, Kontext-Packs, Browser-Profil, Trust, Worker), aus welcher Quelle, und wo ist die Frage doppelt oder gar nicht beantwortet?
urteil: Fünf der neun je-Repo-Fragen haben genau eine Lesestelle mit mitreisender Quelle (Verify-Kommando, Audit, Lane-Deckel, Worker, Kontext-Merge); die Repo-Identitätsfrage dahinter („ist das claude-fleet?") wird aber an vier Stellen einzeln ausgewertet (zwei Kommandostring-Guards, ein existsSync, ein Guard-Parser, dazu eine Pfadklassifikation ohne Repo-Frage), und die Regelbuch- wie Trust-Antwort sind nur Dateiexistenz bzw. Screen-Heuristik, als Fakt nirgends ablesbar.
bereich: [verify, repo-annahmen, harness]
belege: [server.ts#verifyCmdFor, server.ts#verifyEntryFor, server.ts#auditCmdFor, server.ts#repoLaneCap, server.ts#workerCmdFor, server.ts#repoRunsShortChain, server.ts#VERIFY_PROPORTIONAL_CMD, server.ts#auditCmdPreconditions, server.ts#readRulebookFragments, server.ts#laneRulebookFor, server.ts#createWorktree, server.ts#briefAndSend, server.ts#laneLocalProof, watchdog.sh#VERIFY_CMD, watchdog.sh#AUDIT_CMD, verify-proportion.ts#ruleFor, context-manifest.ts#CONTEXT_MANIFEST_PATH, e2e/pins.ts]
nicht-gemessen: Die Werte der .env-Liste FLEET_VERIFY_CMD_REPOS (nur Schlüsselnamen gelesen); die Spawn-Reihenfolge .env vor gebackenem Env-Default ist Textlektüre, nicht Neustart-Messung; kein Verhalten ausgeführt.
stand: 2026-09-16
---

# Wo entscheidet Fleet je Repo, was gilt — volle Inventur der Repo-Annahmen

2026-09-16, Lane fleet/260916072830-5ead. Frage: **An welchen Stellen entscheidet Fleet je Repo, was
gilt, aus welcher Quelle, und wo wird dieselbe Frage doppelt oder gar nicht beantwortet?** Nachfolge
der Stichprobe in `docs/messungen/2026-09-15-fremdrepo-annahmen-lanes.md` §3 (deren Tabelle war die
Startpunkte, diese Inventur vervollständigt sie auf die im Auftrag genannten neun Fragen).

## Ergebnis

### Tabelle: Frage · Quelle(n) · Stellen · doppelt/fehlt

Quellformen, wie der Auftrag sie nennt: **env** (Prozessumgebung, davon zwei Unterformen — .env/.env-Liste
und der vom watchdog.sh gebackene Spawn-Default), **fleet.json** (persistierter Owner-Zustand, Boot
revalidiert), **Dateiexistenz** (Baum des Repos), **Hardcode** (im Server oder watchdog eingebrannt).

| Frage | Quelle(n) | Stellen (datei#symbol) | doppelt/fehlt |
|---|---|---|---|
| Verify-Kommando (Land-Gate) | env-Liste (`FLEET_VERIFY_CMD_REPOS`, .env, JSON repo→cmd) schlägt env-Default (`FLEET_VERIFY_CMD`, vom watchdog gebacken); fehlt beides: unverifiziert | server.ts#verifyEntryFor (einziger Leser der Liste, gepinnt), server.ts#verifyCmdFor (Resolver) | **konsolidiert.** entry-beats-env an genau einer Stelle; ein Pin hält Single-Reader und Resolver-Form (e2e/pins.ts) |
| Audit (Post-Land, Stufe 2) | fleet.json (`repoWorkers[repo].audit`, Owner-Route) schlägt env-Default (`FLEET_POSTLAND_AUDIT_CMD`, vom watchdog gebacken) | server.ts#auditCmdFor (Resolver, `AuditCmdSource` reist auf die Ledger-Zeile), server.ts#workerCmdFor | **konsolidiert** als Frage „welches Kommando"; was das Kommando VOR dem Baum prüft, ist doppelt (Zeile Sentinel unten) |
| Lane-Deckel | fleet.json (`repoLaneCaps`) schlägt env (`FLEET_DISPATCH_MAX_LANES`, gebacken =1); Deckel `REPO_MAX_LANES_MAX`=MAX_SLOTS | server.ts#repoLaneCap (gibt `{max, source}` zurück, Clamps beim Ausgang) | **konsolidiert; Vorbildform.** Eine Lesestelle, Quelle reist mit |
| Worker (commitMsg) | fleet.json (`repoWorkers[repo].commitMsg`) schlägt env (`FLEET_COMMIT_CMD`) | server.ts#workerCmdFor, server.ts#REPO_WORKER_KEYS (geschlossene Menge), Commit-Aufrufstelle server.ts (runWorker-Zug) | **konsolidiert.** Ein Pin hält KEY-Menge ↔ Aufrufstellen als dieselbe Menge |
| „ist das claude-fleet?" (Sentinel) | Dateiexistenz `fleet-e2e.ts` am Repo-Toplevel | watchdog.sh#VERIFY_CMD, watchdog.sh#AUDIT_CMD (je als Kommandostring), server.ts#VERIFY_PROPORTIONAL_CMD (Kommandostring), server.ts#repoRunsShortChain (existsSync), server.ts#auditCmdPreconditions (parst den Guard aus dem Audit-Kommando und fährt existsSync dagegen); verwandt ohne Repo-Frage: verify-proportion.ts#ruleFor | **vierfach ausgewertet, einmal geparst, einmal ignoriert** — siehe Drift D1 |
| Regelbuch-Kopie | Dateiexistenz: vollständiges `rulebook/` im QUELL-Checkout; sonst Fallback-Kopie gitignorter Gerüste (`.env`, `CLAUDE.md`, `OWNER.md`, `.claude/settings.local.json`) aus demselben Repo | server.ts#readRulebookFragments (partiell = keins), server.ts#laneRulebookFor (rendert Lane-Sicht + Backref), server.ts#createWorktree (schreibt/kopiert) | **fehlt als Fakt:** die Antwort („dieses Repo hat kein Regelbuch erhalten") ist Verhalten, kein ablesbarer Zustand; driftprobe am Self-Gate liest dieselbe Funktion (server.ts#laneRulebookFor), das Paar ist gepinnt sauber |
| Kontext-Packs | drei bewusste Ebenen in EINEM Merge: Fleet-Saat (Hardcode-Liste), das Repo selbst (getracktes Manifest `.fleet/context-packs.json` am HEAD, 64-KB-Deckel), Programm (`Program.contextPacks`, fleet.json-Programmfeld) | context-manifest.ts#CONTEXT_MANIFEST_PATH, server.ts#repoManifestContextPlan, server.ts#briefAndSend (Merge-Stelle), context-packs.ts (Saat-Vokabular) | **konsolidiert am Merge** (Receipt stempelt Bytes); unausgesprochen bleibt die Aufteilung zwischen Manifest und dem Repo-eigenen AGENTS.md, das der Harness selbst lädt, ohne Fleet |
| Browser-Profil | Hardcode, je HARNESS nicht je Repo: claude=apply, pi/pi-zai/pi-ox/pi-unfenced=not-applicable, container=unsupported, codex=apply | server.ts (Harness-Adapterfeld `browserProfile`; Konsum an der Browser-Schalt- und Slot-Route) | **nicht doppelt, aber fehlt als Repo-Frage:** ein Repo mit Browser-Bedarf kann die Frage nicht stellen; die Zeile dokumentiert die Grenze des Inventurgegenstands |
| Trust-Einträge | je Harness ein anderer Wahrheitsort: codex schreibt Fleet selbst (Spawn-Prelude in `~/.codex/config.toml`, gekoppelt an eigene Spawn-Pfade); claude und pi bekommen nur Dialog-Autoantworten, den Eintrag schreibt der Harness selbst | server.ts (codex-Prelude), server.ts#CLAUDE_TRUST_DIALOG (claude), server.ts (pi-Block) | **dreifach, drei Wahrheitsorte, einer aktiv:** dieselbe Frage („darf der Agent dieses Verzeichnis öffnen") hat je Harness einen anderen Mechanismus; nur codex bekommt einen von Fleet geschriebenen Eintrag, claude/pi sind Screen-Heuristik |

Randfunde derselben Form (nicht im Auftrag, der Vollständigkeit halber je ein Halbsatz): `repoBases`
(Repo→Integrationsbranch, fleet.json, Boot-Laden in server.ts) und der Dispatcher-Schalter
(`FLEET_DISPATCH_REPO` env macht verfügbar, `dispatchOn` persistiert schaltet zu) folgen derselben
entry-beats-env-Form; beides hat genau eine Lesestelle.

### Rangliste der drei teuersten Drifts

**D1 — Die Sentinel-Frage wird viermal lokal beantwortet, einmal geparst, einmal nie gestellt.**
Stellen: watchdog.sh#VERIFY_CMD, watchdog.sh#AUDIT_CMD, server.ts#VERIFY_PROPORTIONAL_CMD (je
Kommandostring), server.ts#repoRunsShortChain (existsSync), server.ts#auditCmdPreconditions (extrahiert
die Guard-Dateien aus dem Audit-Kommando und prüft Existenz selbst); verify-proportion.ts#ruleFor
klassifiziert Inhalte, ohne je nach Repo zu fragen. Kosten, teils eingetreten: die Self-Route
(server.ts#laneLocalProof via verify-proportion.ts#localProofFor) empfahl docs-only Lanes in fremden
Repos die Fleet-Schritte install+pins, weil sie die Repo-Frage nie stellte (Stichprobe §3, Befund 5);
jeder Land in einem Repo ohne eigenen Audit-Eintrag endet `unknown exit 42`, weil der Guard des
gebackenen Env-Kommandos dort anschlägt (dokumentierter Standardfall, aber die Antwort steht im
Kommandotext statt an einer lesenden Stelle); der historische exit-0-Autoland hinter einem Gate, das
nichts ausführte (watchdog.sh-Kommentar zur Einführung des Guards) war derselbe Drift-Typ an
derselben Naht. Der Verlauf ist additiv: seit dem ersten Fehler kam das Audit-Kommando dazu, dann
die Kurz-Kette, dann das Guard-Parsing — jede Stelle einzeln korrekt, keine kennt die anderen.

**D2 — „Welche Kette gilt für diesen Baum" lebt in vier Formen ohne gemeinsame Lesestelle.**
Die .env-Liste, der gebackene Env-Default, die Prosa (AGENTS.md ## Verify) und der Kurz-Ketten-String
halten dieselbe Kette; die Zuordnung Inhalt→Kette (ruleFor) nimmt stillschweigend claude-fleets
Verzeichnislayout an. Kosten: Wartung und stille Kippgefahr. Eine Kettenschwerung muss vier Stellen
treffen; die Pins halten die watchdog↔server.ts-Paare und den Single-Reader der .env-Liste, aber
weder die Prosa noch ruleFor. Ein fremdes Repo mit einem docs-only Land wird korrekt als docs-only
klassifiziert und korrekt von der Kurz-Kette ausgeschlossen — die Korrektheit dieser Kombination
lebt jedoch nur in Prosa, nicht in einer ausgelesenen Quelle, und nichts pinnt sie.

**D3 — Regelbuch- und Trust-Antwort sind unsichtbare Dateiexistenz bzw. Screen-Heuristik.**
createWorktree kopiert nur, was das Quell-Repo an gitignorten Gerüsten trägt; ein partielles
`rulebook/` zählt als keines; Trust schreibt Fleet nur für codex aktiv. Kosten: das Verhalten einer
Lane unterscheidet sich je Repo (mit/ohne Regelbuch, mit/ohne Gerüstedateien, mit/ohne Trust-Eintrag),
ohne dass ein Fakt dies ausweist — keine Route, kein Ledger sagt „dieses Repo hat kein Regelbuch
erhalten". Die Drift wird vom globalen Harness-Regelwerk maskiert, das laut Stichprobe (Befund 2)
eine falsche, umgeschriebene Claude-Kopie ist: die Lücke wird gefüllt, nur am falschen Ort, und genau
das macht sie schwer auffindbar.

### Vorschlag: kleinster Schnitt (Vorlage, nicht gebaut)

Eine Lesefunktion, die die VORHANDENEN Quellen bündelt. Kein neues Format, keine neue Quelle; das
einzige neue ist, dass die Sentinel-Frage als Feld existiert, statt an jeder Stelle neu ausgewertet
zu werden. Form:

```
repoFactsFor(repo) → {
  isFleet           // existsSync(<repo>/fleet-e2e.ts) — die EINE Auswertung
  verify            // { cmd, source } — heutiges verifyEntryFor/verifyCmdFor unverändert
  audit             // { cmd, source } — heutiges auditCmdFor unverändert
  laneCap           // { max, source } — heutiges repoLaneCap unverändert
  worker.commitMsg  // { cmd, source } — heutiges workerCmdFor unverändert
  rulebook          // "fragments" | "monolith-fallback" | "none" — readRulebookFragments-Ergebnis
  contextManifest   // "declared" | "absent" — Manifest-Existenz am HEAD
}
```

Umstellung in drei Zügen: (1) server.ts#VERIFY_PROPORTIONAL_CMD und #repoRunsShortChain lesen
`isFleet` statt den Baum; auditCmdPreconditions parst weiterhin fremde Kommandos, bekommt aber
`isFleet` als Eingabe, wo es heute selbst existiert. (2) verify-proportion.ts#localProofFor bekommt
`isFleet` als Parameter; ruleFor klassifiziert weiter nach Inhalt, die Repo-Verweigerung der
Kurz-Kette wandert an die eine Stelle — das schließt die Fehlempfehlung der Self-Route (D1). (3) Ein
Pin hält: genau eine existsSync-Stelle auf fleet-e2e.ts in server.ts; die beiden watchdog.sh-Guards
bleiben Shell und bleiben vom bestehenden watchdog↔server.ts-Pin getragen. Ausdrücklich außerhalb:
browserProfile (Harness-Frage, nicht Repo-Frage) und Trust (drei harness-eigene Wahrheitsorte; Fleet
schreibt nur codex) — die Funktion dokumentiert diese Grenze, statt sie zu fälschen.

## Methode

Gelesen, nicht ausgeführt:

```sh
bun codex-quota.ts                      # Kontingent-Schwelle vor Start (s. u.)
rg -a -n 'fleet-e2e\.ts|repoRunsShortChain|FLEET_VERIFY_CMD_REPOS|repoLaneCaps|repoWorkers|laneRulebookFor|createWorktree' server.ts watchdog.sh verify-proportion.ts
rg -a -n 'verifyCmdFor|auditCmdFor|POSTLAND_AUDIT_CMD|contextPack|browserProfile|trust' server.ts
sed -n <Fenster um jede Trefferstelle>  # jede zitierte Stelle im Wortlaut gelesen
rg -a -n 'CONTEXT_MANIFEST_PATH' context-manifest.ts
rg -a -n 'watchdog.sh|VERIFY_CMD' e2e/pins.ts
grep -oE '^FLEET_[A-Z_]+' .env          # nur Schlüsselnamen, keine Werte
# dazu: docs/harness-adapter.md §Repo-Worker, docs/messungen/2026-09-15-fremdrepo-annahmen-lanes.md §3
```

Der Befund „die .env-Liste lebt" beruht auf dem Schlüsselnamen allein; die Spawn-Reihenfolge (.env
wird im Pane gesourced, der gebackene `FLEET_VERIFY_CMD='-…'`-Prefix steht im exec-Kommando danach
und gewinnt für genau diese Variable) ist aus watchdog.sh Textlektüre abgeleitet, nicht gemessen.

## Was nicht gemessen wurde

Die Werte der .env-Liste (ob die gelisteten Repos existieren und deren Bäume den Sentinel tragen),
ob die gebackenen Defaults nach einem watchdog-Neustart wirklich so ankommen (kein Neustart
ausgeführt), und jegliches Laufzeitverhalten: kein Probe-Land, kein Fremdrepo-Lauf. Die Aussage
„jeder fremde Land endet audit=unknown exit 42 ohne eigenen Audit-Eintrag" ist dokumentiertes
Verhalten (watchdog.sh-Kommentar, docs/harness-adapter.md §Repo-Worker), nicht hier ausgeführt.
