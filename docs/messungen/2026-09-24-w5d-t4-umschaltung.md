# W5d T4 — Host-Umschaltung: beide Hosts landen über die Nabe (Messnotiz, 2026-09-24)

Kriterium: `29ad3230`, Teil T4 (bestätigt 2026-09-23). T4 ist ein Owner-/Deploy-Akt und lief nicht
in einer Lane; diese Notiz hält die drei Sensoren vorher/nachher fest. Gemessen 2026-09-24
05:15 CEST von der Orchestratorin Slot 9, Mac per `git`/`launchctl`, Second-host per `ssh`.

## Die drei Sensoren

| Sensor | vorher (Kriteriumstext, 2026-09-23) | nachher (2026-09-24 05:15) |
|---|---|---|
| 1 · Konfiguration zweiter Host | `FLEET_LANDS='0'`, kein `FLEET_HUB_REMOTE`, fleet-sync ohne Argument (gegen `canonical`) | `.env`: `FLEET_LANDS='1'`, `FLEET_HUB_REMOTE='hub'`; `fleet-sync.service`: `Environment=FLEET_SYNC_REMOTE=hub`, Timer 15 min, letzter Lauf exit 0 |
| 2 · Rückweg kanonischer Host | keiner (Mac holte nie; Second-host war Folger) | launchd `com.claude-fleet.sync`: `FLEET_SYNC_REMOTE=hub`, `FLEET_SYNC_BUILD_CMD=true`, `StartInterval 900` — **derzeit nicht geladen** (pausiert, s. u.) |
| 3 · Land über die Nabe, je Host einer | nur der Mac landete | Second-host-Land `3e343f40`: Note auf dem Second-host `hubPush.ok true`, `verify.ok true`. Folgender Mac-Land `39c69bfd`: `hubPush.ok true`, `verify.mainSha 3e343f40` — der Mac-Land lief auf dem Second-host-Land auf. Beide sind Vorfahren von Mac-`main`. |

Stand der Checkouts nachher: Nabe `af0aa345` = Mac `af0aa345`; Second-host `f97dbf10`, einen Commit
dahinter — `af0aa345` ist ein Direkt-Commit (HANDOFF), den der nächste Second-host-Sync-Lauf holt.

## Was offen bleibt

- **Mac-Sync pausiert**, bis `ab179938` (deployBlocker sieht Helfer-geshardete Audits nicht) gelandet
  und deployt ist; ohne ihn holt der Mac Second-host-Lands nur beim eigenen nächsten Land.
  Wieder an: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-fleet.sync.plist`.
- **Regression aus T1: `5857e934`** — ein Repo ohne Remote `hub` kann auf dem Mac nicht landen
  (verify ok, status error). Bis zum Fix Fremd-Repo-Lands nur von Hand.
- **`2a5ef2b6`** (W5d-T5, undo-land bei beidseitigem Landen) war nie Teil von W5d.
- Die Land-Note von `3e343f40` liegt nur auf dem Second-host; `refs/notes/fleet/land` wird nicht
  zwischen den Hosts gespiegelt, Mac-seitig liest `git notes show 3e343f40` nichts.
