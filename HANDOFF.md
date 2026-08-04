# HANDOFF — Session 20 (2026-08-04: die Gast-Karte wird eine Kontroll-Fläche) · 19/18/17/16/15/14/13 darunter

*Zustand ist ein KOMMANDO: `./state.sh`. Historie: `git log 01ba51f..HEAD` mit Bodies (das
Befund-Register — die Mechanismen stehen dort, nicht hier). Diese Datei trägt nur das
Residuum: Absicht, Entscheide, was in Flug ist, und die Reihenfolge der nächsten Schritte.*

---

## Session 20 (2026-08-04): die drei Plätze, und was daran hing

3 Commits, `647f4a7`..`a4be955`, alle deployed und live nachgeprüft. Die Mechanismen stehen in
den Bodies — hier nur, was git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Slot 2 ist eingerichtet und läuft, aber NICHT öffentlich — und die zwei fehlenden Schritte sind
beide Owner-Sache, weil sie nach draußen reichen:**

1. `cloudflared tunnel route dns <tunnel> containerTwo.<domain>` — der DNS-Record.
2. `./guest-ctl.sh renew 2` — öffnet Fenster und Tür.

Vorher: lokal erreichbar auf `127.0.0.1:8792` (antwortet 200), im Panel als `no hostname
configured`/`closed`. **Die Namensfrage des Owners ist NUR halb umgesetzt:** Slot 2 heißt
`containerTwo.<domain>`, Slot 1 heißt weiterhin `container.<domain>`. Ihn auf `containerOne.`
umzubenennen **bricht den bereits verteilten Invite-Link** (Hostname steckt in DNS, in
`FLEET_ALLOWED_HOSTS` des Containers und in dem, was jemand schon bekommen hat) — deshalb nicht
getan. Owner-Entscheid, nicht Versehen.

### Was live ist und wovon die nächste Session wissen muss

- **Die Gast-Sektion ist eine Kontroll-Fläche**: drei Zeilen (ein Platz je Zeile, ob er existiert
  oder nicht), darunter EIN Detailblock für den gewählten. Die Knöpfe folgen dem gewählten Slot,
  und jede Aktivierung ist die Vorbedingung von `guest-ctl.sh` selbst.
- **`start` hat drei Gesichter**: `▸ start` · `▸ re-open` · `↻ re-apply`. Wer daran etwas ändert,
  liest zuerst die Korrektur unten — die Ruhe-Beschriftung war das Problem, nicht die Quittung.
- **Slot 1 ist migriert**: `/home/fleet/.claude` liegt auf `fleet-guest-claude`. Damit überleben
  Credential und Transkripte einen `docker rm`. Backups der Migration liegen als
  `~/.claude-fleet-guest/1/claude-backup-*.tar` (zwei Stück, 0600) — sie können weg, wenn der Gast
  eine Weile gut läuft.
- **`guest-ctl.sh` hat drei neue Verben**: `provision <slot> [hostname]`, `export <slot>
  [work|all]`, `import <slot> <tar>`. `status` trägt zusätzlich `claudeVolume` (Boolean).
- **`guest-claude-volume.sh` ist für NEUE Slots unnötig** — `provision` legt `.claude` von Anfang
  an auf ein Volume. Das Skript bleibt für Altbestand und dokumentiert den Mechanismus.
- **Beide Gäste haben `claudeAuth: false`.** Owner-Entscheid dieser Session: sich selbst einloggen
  statt einen Token zu injizieren (Begründung unten).

### Was NICHT verifiziert ist — und niemand sollte es behaupten

1. **Ob eine echte Claude-Session in einer echten Pane im Container läuft.** Unverändert die größte
   Lücke des Strangs, steht seit Session 18 hier. Alles Grüne fährt Shell-Stubs.
2. **`export`/`import` gegen einen ECHTEN Gast.** Bewiesen ist ein Round-Trip gegen einen
   Wegwerf-Gast (Slot 99, eigene Volumes, danach restlos entfernt), 17/17.
3. **Der exponierte Pfad von `provision`.** Mit Hostname geschrieben und geprüft, aber DNS + `renew`
   sind nie durchlaufen — d. h. „Slot 2 ist wirklich öffentlich erreichbar" ist unbewiesen.
4. **Das Board ist weiterhin desktop-only** (`renderBoard` kehrt bei `isMobile()` sofort zurück).
   JEDE Kontrolle dieser Session ist auf dem Handy unsichtbar. Bewusst nicht angefasst.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`--user root` ist im Gast-Image WIRKUNGSLOS.** Der Entrypoint fällt auf uid 1000 zurück, auch
  wenn der Run root verlangt. Gemessen: `docker run --user root … id` → `uid=1000(fleet)`, mit
  `--entrypoint sh` → `0`. Wer dort einen Wegwerf-Container braucht, der schreiben oder chownen
  muss, MUSS den Entrypoint umgehen. Das hat die Migration beim ersten echten Lauf gekillt.
- **Ein grüner Round-Trip-Test kann aus dem falschen Grund grün sein.** Der erste bewies nichts,
  weil er nur in Volumes zurückspielte, die es schon gab und die `1000:1000` gehörten. Der Fall,
  der zählt, ist ein FRISCHES, root-eigenes Volume.
- **Die Quittung am Start-Knopf war NICHT das Problem.** Zwei mechanische Erklärungen geprüft und
  beide falsch: sie malt zuverlässig, auch in data-saver mit 10-s-Board-Tick, und eine persistente
  Notiz überlebt sie. Der Defekt war die Ruhe-Beschriftung, die auf einem laufenden Gast weiter
  „start" versprach.
- **Der alte Chip-Picker war kaputt, nicht nur eng.** `guestSel` wurde bei JEDEM Render auf einen
  existierenden Slot geklammert, also war ein Klick auf Platz 2/3 rückgängig, bevor er malte, und
  der Erklärtext war unerreichbarer toter Code. Bewiesen durch Bau des Vor-Änderungs-Bundles.
- **`.claude` lag NICHT auf einem Volume**, also warf `▸ give claude token` die Konversations-
  historie des Gastes weg. Der Text im Kasten sagte „its volumes … do not change" — wahr und
  irreführend. Für Slot 1 behoben, für neue Slots strukturell zu.
- **Das Image hat GNU tar 1.34, und sein Entrypoint-Banner geht auf STDERR.** Auf stdout hätte er
  jedes exportierte Archiv beschädigt. Beides gemessen, bevor darauf gebaut wurde.
- **`~/.claude/.credentials.json` ist NICHT die Credential, die man einem Container gibt.**
  `claudeAiOauth.accessToken` ist kurzlebig (der auf Platte war beim Messen bereits abgelaufen) und
  wird von Claude Code still erneuert; ein Container tut das nicht. Injiziert ergäbe das einen
  Gast, der nach Stunden in jeder Pane stirbt.
- **Prüfstand-Falle:** `labels.py` braucht einen Stub, der beim `start` die Welt WIRKLICH verändert
  (`AFTER=`), sonst bleibt die Beschriftung korrekt auf „start" und der Fehlschlag liest sich wie
  ein Regress. Einmal passiert; die Vorbedingung wird jetzt geprüft und als SKIP gemeldet.

### Key Decisions (mit Grund)

- **Ein leerer Platz bekommt dieselbe Karte mit toten Kontrollen, keinen anderen Bildschirm** — das
  ist, was die drei Plätze als EINE Fläche lesbar macht. Preis, den der Owner sofort gefunden hat:
  tote Knöpfe laden zum Drücken ein. Deshalb `provision`.
- **`✂ cut` bleibt sichtbar, wenn die Tür schon zu ist** (deaktiviert statt weg): ein Knopf, den man
  in Eile sucht, darf nicht wandern.
- **`re-apply` statt `repair`**, weil der Hook nichts repariert — colima und docker sind no-ops, und
  was wirklich passiert ist `resume`: Ingress-Regel neu schreiben, Ablauf-Timer neu installieren.
- **Verlaufs-/Quittungswörter werden beim PRESS festgehalten**, nicht beim Render: bis die Quittung
  malt, hat die Aktion den Zustand verändert, aus dem sie sonst abgeleitet würde.
- **`export` hat zwei Scopes**, und der Unterschied ist genau „darf ich diese Datei weitergeben":
  `work` ist das Projekt-Volume, `all` trägt Credential und Transkripte und ist ein Backup.
- **`provision` hört beim DNS-Record auf.** Ein Skript, das öffentliche Namen erzeugen kann, erzeugt
  sie irgendwann versehentlich.
- **Die Rezeptur wird aus einem bestehenden Slot ABGELEITET**, nicht aufgeschrieben — Image, Caps,
  Memory, Tunnel-Config sind Deployment-Tatsachen und diese Datei ist öffentlich.
- **„Use my own token" wurde VERWORFEN** (Begründung oben). Stattdessen: selbst einloggen — das
  erneuert sich selbst und überlebt seit der Migration einen Recreate.
- **opencode als Gast-Option: vertagt, nicht verworfen.** `FLEET_CMD` ist bereits eine Variable, ein
  Gast mit `FLEET_CMD=opencode` liefe heute. Aber alles Transkript-Abgeleitete hängt an
  `~/.claude/projects` (`server.ts`, grep `projDir`) und würde STILL degradieren — leere Outline,
  „no transcript" — was wie kaputt aussieht statt wie „nicht zutreffend". Fehlt: ein Begriff „welcher
  Agent läuft hier" in der Status-Schicht.

### RAM, weil die Frage kam und die Antwort nicht offensichtlich ist

**Nichts ist reserviert.** `--memory 1g` ist eine Decke, `MemoryReservation=0`, und die VM-RAM wird
demand-paged. Die bindende Grenze ist NICHT der Container, sondern die VM: **1,91 GiB**, davon
gemessen 526 MB benutzt. Drei Gäste à 1 GiB Limit sind darin **1,6× überbucht** — sie können ihre
Limits nicht alle einlösen. Wer Slot 3 wirklich will, dreht zuerst an der VM-Größe, nicht am
Container-Limit.

### Offene Owner-Entscheide

1. DNS-Record + `renew 2` für Slot 2 (siehe oben).
2. Slot 1 auf `containerOne.` umbenennen? Bricht den verteilten Invite-Link.
3. Slot 3 — braucht erst die VM-Größe.
4. opencode.
5. `export`/`import` einmal gegen einen echten Gast fahren, bevor sich jemand darauf verlässt.

---

## Session 19 (2026-08-03): der Gast bekommt eine Konsole

4 Commits, `b6639c2`..`d67c819`, **alle deployed und live nachgeprüft** (`bootHead == HEAD`,
`bundleStale:false`, Site 200, 8 Sessions haben die Restarts überlebt). Die Mechanismen stehen
in den Bodies — hier nur, was git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Der Owner hat den nächsten Auftrag schon benannt: die Kontroll-Fläche rechts in der Info-Karte
ordnen.** Der Brief liegt fertig unter `briefs/info-card-controls.md` — er ist gemessen, nicht
geraten (84 Buttons, 7 Sektionen, 5886 Zeilen `src/client.ts`), und er nennt die drei Fallen, an
denen ein Umbau dort sonst stirbt. **Nicht neu entwerfen — lesen.** Die eine offene Owner-Frage
steht am Ende des Briefs und ist blockierend, weil sie die Form entscheidet.

### Was live ist und wovon die nächste Session wissen muss

- **`FLEET_GUEST_CMD` ist seit dieser Session in `watchdog.sh`** und zeigt auf `guest-ctl.sh`.
  Damit existiert die Gast-Sektion in der Info-Karte. Variable weg = Feature weg (Routen 404,
  keine Knöpfe). Aktiv wurde sie durch `launchctl kickstart` **vor** dem srv-Restart — die
  umgekehrte Reihenfolge respawnt srv mit der alten Zeile, und dann fehlt die Variable.
- **Gäste sind SLOTS**, ein Verzeichnis je Gast unter `~/.claude-fleet-guest/<n>/`. Der bestehende
  Gast wurde nach `1/` migriert (gleiche Deadline, gleicher Token, Container unberührt). Slot 2
  und 3 existieren NICHT: sie brauchen je einen Hostnamen mit DNS-Record. **Der DNS-Record ist
  bewusst kein Knopf** — er reicht nach außen, also Owner-Entscheid.
- **Der Live-Gast hat weiterhin KEINE Claude-Credential** (`claudeAuth:false`, live geprüft). Sein
  Dashboard öffnet, Sessions starten, `claude` stirbt in jeder Pane. Der Knopf dafür existiert
  jetzt (`▸ give claude token`), benutzt wurde er nie.
- **Ein Ingress-Marker in zwei Formen.** Die Ein-Gast-Version schrieb einen Marker ohne Slot;
  `del_rule` erkennt beide. Wer das je vereinfacht, baut einen Panikknopf, der „already cut"
  meldet, während die Tür offen steht.

### Was NICHT verifiziert ist — und niemand sollte es behaupten

1. **Ob eine echte Claude-Session in einer echten Pane im Container läuft.** Unverändert die
   größte Lücke des Strangs (steht seit Session 18 hier). Alles, was grün ist, fährt Shell-Stubs.
   Der Token-Knopf ist genau der Weg, das endlich zu testen.
2. **Der Recreate-Pfad gegen einen ECHTEN Container.** `claude-token` ist nur gegen den
   Stand-in-Hook gelaufen. Was er tut, ist `docker rm -f` + `run` aus der eigenen Inspect-Config —
   die Volumes überleben, aber bewiesen ist das hier nicht.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **Der Steward-Send-Zweier ist KEIN Regress und keine offene Adjudikation mehr.** Vier Läufe
  entscheiden es: derselbe Baum einmal grün, zweimal rot, und **clean HEAD `9d7b2cb` ohne eine
  Zeile dieser Session fällt identisch**. Ein Check, der auf einem Baum passt UND fällt, und ohne
  unseren Code fällt, ist ein Rennen. Mechanismus auf Zeilen festgenagelt: `server.ts:5300`
  (Idle-Gate, 409) läuft VOR dem Episoden-Cap `:5314` (429), und `e2e/steward-core.ts:243` sendet
  direkt nach dem Paste — der Check muss das pipe-pane-Echo schlagen. Der Geschwister-Check
  `:261` settelt deshalb neu und sagt es im Kommentar. Test-seitige Fragilität, Fix kostet ~60 s
  pro Lauf, **Owner-Entscheid, nicht genommen.** Damit ist auch Session 18s roter Tier-2-Audit auf
  `6081449` erklärt: dieselbe Signatur.
- **Eine Falle im Harness, die 12 fremde Checks rot machte und meine war:** `restart.ts` pflanzte
  `FLEET_REPO_DIR` nur in die SERVER-Spawn-Zeile, `harness.restartSrv()` baut diese Zeile aber aus
  `process.env` neu. Jedes Modul, das danach srv neu startet, verlor die Variable — und
  deploy-gap/bundle-staleness lasen `null`, was wie echte Fehler aussieht. Behoben an der Quelle
  (`restart.ts` pflanzt jetzt zusätzlich in `process.env`), Falle bei `restartSrv` dokumentiert.
- **Zweimal habe ich „der Knopf ist gefixt" behauptet, ohne ihn zu drücken.** Beim dritten Mal
  habe ich ihn in einem echten Browser gegen eine Wegwerf-Instanz geklickt und die Label-Folge
  abgetastet: `… starting → ✓ started → ▸ start`. **Und die Harness hat zuerst selbst gelogen** —
  2,5 s Wartezeit gegen ein Panel, das auf dem 3-s-Board-Tick malt. Sie pollt jetzt.
- **`no-store` rettet keinen offenen Tab.** `/` und `/app.js` liefern `Cache-Control: no-store`,
  ein Reload holt also immer frischen Code — ein Tab, der nie neu geladen wurde, fährt den alten
  Bundle ewig weiter. Genau das war der erste „der Knopf tut nichts"-Report.

### Key Decisions (mit Grund)

- **`cut` behält die Deadline, `renew` verschiebt sie** (Owner, wörtlich: *„I think it should keep
  the deadline, but some button to reset the deadline would also be very good"*). Ein Panikknopf,
  der die Exposition still verlängert, wenn man ihn zurücknimmt, ist die falsche Form. `resume`
  verweigert ein abgelaufenes Fenster — sonst wäre es ein stilles `up` und die Schranke Beiwerk.
- **Die Credential geht auf STDIN, nie in argv.** argv ist für die Laufzeit des Aufrufs in `ps`
  weltlesbar. Als Messung geprüft, nicht als Behauptung: der Stub schreibt argv UND stdin mit.
- **Der Invite ist eine eigene Route mit eigenem Verb.** `status` wird bei jedem Kartenöffnen und
  nach jeder Aktion gelesen; ein Token, das dort mitreist, ist ein Token in jedem Log.
- **`claudeAuth` ist ein BOOLEAN in `status`, nie der Wert** — die Frage „hat der Gast überhaupt
  eine Credential" ist Betriebszustand, der Wert ist es nicht.
- **Ein Timer für alle Slots** (`enforce-all`) statt N launchd-Labels: ein Fenster, dessen
  Enforcer nie installiert wurde, ist genau der Fehler, gegen den das Skript existiert.
- **Status bleibt aus dem 2-s-Poll draußen** (jeder Aufruf spawnt Subprozesse), und das Panel sagt
  deshalb `checked HH:MM:SS — not polled`, statt Aktualität zu suggerieren.

---

## Session 18 (2026-08-03): der Container-Strang

4 Commits, `1bbc9ee`..`d2d4910`. **Alle Mechanismen stehen in den Bodies** — hier nur, was
git nicht trägt.

### Das Erste, was die nächste Session tun sollte

**Zwei Dinge, die live offen sind, in dieser Reihenfolge:**

1. **`bundleStale: true`, srv ist 3 Commits zurück** (gemessen 14:15). Der Picker-Land
   `6081449` fasst `src/client.ts` + `public/index.html` an — der Client-Teil davon ist
   **unsichtbar**, bis jemand `bun run build` im Haupt-Checkout fährt. Der Server-Restart
   (`tmux -L claudefleet kill-session -t srv`) ist die zweite Hälfte und Owner-Entscheid.
2. **Der Tier-2-Audit auf `6081449` ist ROT** — Signatur aus Session 16, siehe unten.
   Adjudikation steht aus.

### Die zweite Instanz einer benannten Nicht-Determiniertheit

Session 16 notierte einen Zweier-Fail im Steward-Send-Episoden-Limiter und schrieb dazu
ausdrücklich: *„Eine Beobachtung, keine sechste Flake-Familie — dafür braucht es mehr als
eine Instanz."* **Die zweite Instanz ist da**, byte-identisch:

    FAIL  a second send of the same kind×slot within the episode window is 429  (409)
    FAIL  a capped send is audited (steward_send_capped)

Was sie belastet: der auslösende Diff ist **43 Zeilen Picker/Client** (`public/index.html`,
`src/client.ts`) und kann den Steward-Send-Pfad nicht erreichen — dieselbe Konstellation wie bei
der fünften Familie am 2026-08-01. Der Land-Gate war grün (`verified: true`), nur Tier 2 ist rot.

**Die Hausregel gilt trotzdem: erst denselben Baum seriell wiederholen**
(`docs/verify-tiering.md` §11.7), Maschine ruhig. Grün → bewiesen, und es gehört als **sechste
Familie** nach §11, nicht in CLAUDE.md, damit die Zahl nicht an zwei Stellen altert. Identisch
rot → echter Regress im Limiter, keine Flake.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **„Die Lane ist beim Landen gescheitert" — nein.** `fleet/260803082354-3ec9` ist sauber
  gelandet (`disposition: landed`, `verified: true`, `mainAfter: 6081449`). Rot ist der
  Tier-2-Audit **danach**. Zwei verschiedene Dinge; die Outcome-Row sagt es eindeutig.
- **Mein „≥ 4 GB RAM für eine Gast-Flotte" war deutlich zu hoch.** Es kam aus „25 Prozesse,
  1,2 GB" — davon ~20 winzige Hilfsprozesse. Echte Sessions kosten im Schnitt **110 MB**;
  Fleet-Boden im Container **23,6 MB**, pro Slot **~8 MB**, vier Slots 55 MB.
- **Eine colima-VM reserviert ihre Zuteilung NICHT.** Die 2-GiB-VM, die die volle Suite fuhr,
  kostet den Host im Leerlauf **~213 MB**, nicht 2 GB. Darauf stand mein „diese Maschine ist zu
  knapp" — es war falsch, und deshalb läuft der Gast jetzt hier statt auf einem VPS.
- **SIGHUP lädt cloudflared NICHT neu, es beendet es.** launchd startet neu; ~30 s lang
  antworten **alle** Hostnames des Tunnels 502, die Website eingeschlossen. Erkennbar an der
  wechselnden PID. Mein Skript-Kommentar behauptete das Gegenteil, korrigiert in `d2d4910`.
- **`--memory 1g` war nicht die Ursache eines gestorbenen Containers.** Ein Testlauf starb mit
  `ExitCode=137`, `OOMKilled=false`, bei 55 MB Verbrauch, ohne OOM-Zeile im VM-Kernel. In vier
  Folgeversuchen mit identischen Flags nicht reproduziert. **Unerklärt**, praktisch aufgefangen
  durch `--restart unless-stopped`.
- **Der Crash um 12:08 war nicht Hitze.** Panic-Log: `userspace watchdog timeout … WindowServer
  … in 120 seconds`. Begleitend 18 Swapfiles und `kernel_task` als CPU-stärkster Thread
  (= Drosselung lief). Ein echter Hitze-Abschalter hinterlässt **gar keinen** Panic-Log. Nichts
  ging verloren: Ledger 0 kaputte Zeilen, 7 von 8 Slots per `--resume` zurück.
- **Der Session-Scratchpad in `/private/tmp` überlebt keinen Reboot.** Der Gast-Token lag dort
  und war weg. Liegt jetzt in `~/.claude-fleet-guest/token` (0600).

### Was live ist und wovon die nächste Session wissen muss

- **Gast-Flotte öffentlich** unter dem `container.*`-Hostnamen, **befristet bis 10.08. 13:51**,
  erzwungen durch einen stündlichen launchd-Job (`guest-expose.sh`; mit zurückdatiertem Ablauf
  getestet). Owner-Entscheid: **kein Cloudflare Access**, Fenster statt Identität.
- **VM `fleetguest` läuft**, Container `fleet-guest` mit Egress-Firewall (`--user root
  --cap-add NET_ADMIN --cap-add NET_RAW -e FLEET_FIREWALL=1`), 1 GB Limit, 24–31 MB Verbrauch.
- **Zweite VM `fleetbuild`** (gestoppt) ist die Bau-/Prüf-VM. Nicht löschen, sonst dauert der
  nächste `./docker-verify.sh` wieder eine Viertelstunde.
- **`~/.cloudflared/config-logic-extraction.yml` wurde bearbeitet** (Markerblock, verwaltet von
  `guest-expose.sh`) — außerhalb des Repos, Sicherung als `.bak-container-*` daneben.
- **`~/.claude-fleet-guest/`** trägt `token`, `expose.env`, `expose-until`. Alles 0600 und
  außerhalb des Repos, weil dieses öffentlich ist.
- **Nach einem Mac-Neustart ist die Gast-Flotte weg**, bis `colima start -p fleetguest` läuft.
  Die Live-Flotte kommt über launchd zurück, die Gast-VM hat kein Äquivalent — bewusst, siehe
  den Brief unten (auto-start kostet RAM an jedem Tag, an dem niemand arbeitet).

### Was der Owner selbst tun muss

Node-Sharing/URL-Weitergabe und das `claude setup-token` seines Freundes in den Container —
**bis dahin ist ungetestet, ob eine echte Claude-Session in einer echten Pane im Container läuft.**
Der gesamte Suite-Beweis fährt Shell-Stubs; das ist die größte offene Lücke dieses Strangs.

### Der nächste Bauauftrag liegt fertig da

`briefs/guest-ops-panel.md` — Knöpfe in der Info-Karte (`start` · `cut` · `stop`) plus die
Auth-Fehler-Zahlen aus dem Audit-Log des Gastes. Der Entwurf ist entschieden, inklusive der
abgelehnten Alternativen (kein automatischer Lockout: Selbst-DoS) und **einer offenen Owner-Frage**
am Ende. Nicht neu entwerfen — lesen.

### Key Decisions (mit Grund)

- **Ganze App im Container, niemals einzelne Slots.** Der Transkriptpfad wird aus dem `$HOME` des
  Servers und dem cwd-String gebildet (`projDir`, server.ts:361) — eine Grenze quer durchs Bündel
  blendet Konversationsansicht, `laneDoneLooking`, Digest und auto-③ gleichzeitig aus und lässt
  Fleets eigene Worker trotzdem draußen.
- **Denylist statt Allowlist in der Firewall.** Eine Allowlist ist stärker gegen Exfiltration und
  bricht den Zweck („er nimmt sein git-Projekt mit" heißt Push auf ein Remote, das niemand vorher
  gelistet hat). Gemessen war das Risiko *Erreichbarkeit ins Tailnet*; RFC1918 + CGNAT +
  link-local entfernt genau das, wartungsfrei.
- **Die Ingress-Regel ist der Schalter, nicht DNS.** `cloudflared` legt Records an und löscht
  keine; ohne Regel fällt der Hostname auf den 404-Catch-All.
- **Der Zustand liegt im Named Volume über dem App-Verzeichnis.** Alle 25 Zustands-Pfade hängen
  an `import.meta.dir`, ohne Env-Override. Preis: ein neu gebautes Image erreicht die Instanz
  nicht mehr. Für einen Versuch richtig, dauerhaft falsch — `FLEET_STATE_DIR` wäre die Lösung.
- **Der Transkript-Check bleibt im Container rot** (`e2e/history.ts:52` braucht echte
  `.jsonl`-Historie). Bewusst nicht angefasst: ihn hermetisch zu machen ändert, was eine
  Gate-Suite behauptet, und das ist ein Owner-Entscheid, kein Nebeneffekt.

---

## Session 17 (2026-08-01/02): der Picker, und danach die Liste abgearbeitet

7 Commits, `ff0c8fb`..`0ac753e`, alle deployed. srv läuft seit 02.08. 17:00 als pid 13497,
17 tmux-Sessions haben den Neustart überlebt, `bootHead == HEAD`, `bundleStale:false`.

### Das Erste, was die nächste Session tun sollte

**Die Entscheidung über die UI-Checks ist fällig und wurde zum dritten Mal vertagt** (Session 15
Punkt 3, Session 16 Punkt 1, jetzt hier). Owner-Vorgabe wörtlich, 2026-08-02: *„vertagen, minimale
Lösung jetzt und in nächster Session angehen."* Die minimale Lösung ist getan: **100 Playwright-Checks
liegen lauffähig in `~/claude-fleet-private/ui-checks-2026-08-02/`** (41 Picker-Geometrie · 24
Ordner-Baum · 25 Contents-Baum · 10 Stale-Client), mit README, parametrisierter `ui-harness.sh` und
leerem Privacy-Grep — ich habe sie von dort gegen eine frische Instanz laufen lassen, 100/0.
Die Entscheidung selbst steht: **opt-in Suite im Repo** (muss `exit 42` überspringen, wenn Playwright
fehlt — es ist eine Homebrew-*Python*-Installation und KEIN Repo-Dependency, ein Gate-Eintrag bricht
jede Lane) **oder ausdrücklich festhalten, dass diese Fenster handgeprüft bleiben.** Der Status quo
bleibt die schlechteste Variante: die Suiten sind grün und sehen abgedeckt aus.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **Ich habe zweimal die falsche Fläche gebaut.** Der Owner meinte durchgehend das *rechte
  Detail-Panel* (Contents), ich habe Icons und Klick-zum-Aufklappen in den *linken Ordner-Baum*
  gebaut. Der Hinweis stand in seinem ersten Satz — „die dateien sind jetzt zwar anklickbar", und
  Dateien gibt es nur in Contents. Danach habe ich zwei Runden lang Caches, Tunnel und Bundles
  verdächtigt, statt seine Worte nochmal zu lesen. Lehre gespeichert.
- **Die 11 roten Tier-2-Audits sind NICHT offen.** Das Inspektions-Register hat sie am 29.07. alle
  nachverfolgt, jeder ist erklärt (`journal-cap 07e5969` war ein echter Bug und ist behoben).
  `state.sh` zeigt nur den Zähler, nicht diesen Kontext — ich hatte sie im Catchup als
  unadjudiziert bezeichnet, das war falsch.
- **`codeBehind` hat KEINEN Leser im Client** (grep über `src/*.ts`, `docs/`, `commands/` ist leer).
  Es ist eine Zahl in der Steward-Fakten-Schicht, kein Abzeichen auf dem Dashboard. Ich hatte beim
  Vorschlagen das Gegenteil behauptet.
- **`/api/dirinfo` ist pro Aufklappen NICHT teuer** — `statSync(pfad/.git)` wirft für gewöhnliche
  Unterordner, die Funktion kehrt nach einem `readdir` zurück. Nur echte Repo-Roots zahlen die
  fünf git-Aufrufe. Ich hatte das als Kostenproblem vermutet; Lesen hat die Frage erledigt.
- **`task/delete` schreibt bei steward-Tasks ein `dismissed` ins Steward-Journal**, `done` nicht.
  Fünf erledigte Tasks gehören also auf `done` abgeräumt, nie auf `delete` — sonst misst der
  Propose-Outcome-Kanal Ablehnungen, die nie stattfanden.

### Was offen bleibt (meine Liste, nicht die des Owners)

1. **Die UI-Test-Entscheidung** — siehe oben.
2. **Zwei pending Tasks, beide echte Entscheidungen:** `d76e791e` (der Steward kann „Rotes ohne
   Nachspiel" strukturell nicht prüfen — sein Ledger-Fenster hängt am letzten rundgang-Record) und
   `411dd13a` (Entscheidung zum getakteten Rundgang). Von 7 auf 2 runter; die anderen fünf waren
   im Code erledigt und sind jetzt als `done` markiert.
3. **Drei ungegrabene Inspektions-Kandidaten** (30.07., alle in der Puls-Fakten-Schicht):
   `sinceLastLook` klassifiziert inkonsistent und meldete danach drei Pulse in Folge leer, obwohl
   main drei Commits vorrückte; `self_heal_recreate` 196× created vs 1× resumed; `dispositions.jsonl`
   eine Zeile seit 25.07. bei weiter existierender Route.
4. **Contents-Zeilen sind auf dem Handy ~26px hoch** — und seit dieser Session sitzt dort eine
   Tipp-Geste (Ordner aufklappen). Unter Fingergröße; kein Overflow, aber eng.
5. **Mobile-Durchgang für Queue- und Activity-Fenster** ist weiter nie gemacht worden
   (Session 15, Punkt 2).
6. Unverändert offen aus 15/16: zwei Overlay-Idiome nebeneinander, `src/client.ts` wächst weiter,
   der Picker-Filter expandiert nicht, der Kinder-Cache lebt so lange wie das Fenster,
   `showDirDetail` feuert pro Pfeiltaste, `/api/commits` deckelt bei 200 ohne Paging.
7. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.

### Key Decisions (mit Grund)

- **`codeBehind` bekam eine ALLOWLIST, keine Denylist.** Der Kommentar über der Funktion verlangt
  „ein unbekannter Pfad muss eine Lücke melden, nicht verstecken" — eine Allowlist erhält genau
  das: eine neue `src/`-Datei ist Code, bis jemand sie einträgt. `src/protocol.ts` fehlt dort
  bewusst, weil server.ts es importiert.
- **`mainAfter` reitet über `LandFacts` vom Land-Site mit, statt in `buildLaneOutcome` gelesen zu
  werden.** Zur Aufzeichnungszeit ist main schon vorgerückt — aber WELCHER Branch der
  Integrationsbranch ist, ist die Tatsache des Aufrufers, nicht die der Funktion. Dasselbe Muster,
  das `baseSha` dort schon nutzt.
- **`suite-contention.md` §3 wurde als überholt MARKIERT, nicht umgeschrieben.** Es ist eine
  datierte Analyse vom 27.07.; die Prämisse zu fälschen würde das Argument darüber unlesbar machen.
- **Der Intake-Lockout-Test feuert seine 50 Fehlversuche PARALLEL.** Der Strike wird nach dem
  400-ms-Delay gepusht, also passieren alle den Vorabcheck und landen exakt `FAIL_LOCK` Strikes —
  ein Roundtrip statt 20 Sekunden. Die Schranke wird per Regex aus `server.ts` gelesen, nicht
  zweimal geschrieben.
- **Maschinenhygiene: 179 tote e2e-Sockets gereapt**, der lebende `claudefleet` explizit
  ausgeschlossen und danach nachgeprüft. Von 164+ auf 1.

---

## Session 16 (2026-08-01): Picker und Activity werden benutzbar, und Dateien lassen sich öffnen

5 Commits, `c85f1a0`..`08bdcfb`, alle deployed und gegen den Live-Server nachgeprüft
(`08bdcfb` = bootHead = HEAD, `bundleStale:false`, 6 Sessions haben die Restarts überlebt).

### Das Erste, was die nächste Session tun sollte

**Der einzige benannte, noch offene Punkt aus dem Gespräch: `recordLand` schreibt `repo` und
`mainAfter` NICHT auf die Outcome-Row — und hat beide in der Hand** (`server.ts`, grep
`async function recordLand(repo, main, branch, mainBefore, mainAfter, prov)`). Zwei Felder mehr
auf der Row lösen ZWEI Dinge auf einmal:

1. die Dateiliste in der Lands-Linse wird klickbar (heute ist sie als einzige der vier
   Dateilisten tot, weil eine Row einen PFAD kennt, aber weder Repo noch Revision), und
2. der Commits↔Lands-Join hört auf, ein ±1-h-Zeittreffer zu sein — das ist wörtlich Punkt 7
   der Session-15-Liste („Ein echter Join bräuchte, dass recordLand den resultierenden
   Commit-SHA schreibt").

Gilt nur für NEUE Rows; alte sagen ehrlich „kein Repository auf der Row". Genau dasselbe
Muster wie `recent`/`last` in `/api/dirinfo`.

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`mdInto` rendert KEIN Markdown.** Es gibt ``` ```-Fences Struktur und sonst nichts —
  absichtlich, weil es feindlichen Transcript-Text rendert (`src/md.ts`, Kopfkommentar). Ich
  hatte schon „`.md` rendert als Markdown" gebaut und den Kommentar dazu geschrieben, BEVOR
  ich die Datei gelesen habe; der Check hat es gefangen. Wer eine Markdown-Ansicht will,
  braucht einen echten Renderer und muss die XSS-Entscheidung neu treffen.
- **`git()` und `gitRead()` TRIMMEN ihre Ausgabe.** Für Hashes egal, für Dateiinhalt falsch:
  führende/abschließende Leerzeichen verschwinden. `/api/file` spawnt darum sein eigenes git —
  dieselbe Begründung, die schon über `statusLines` steht.
- **Die Info-Karte (`#board`) hat ZWEI Dateilisten, nicht eine**: `brief.uncommittedFiles`
  (dirty, das was man normalerweise sieht) und `brief.files` (committed footprint). Ich hatte
  zuerst nur die zweite verdrahtet und es im Browser gemerkt — die sichtbare war die andere.
- **`.shellsect` ist `text-transform: uppercase`.** Playwright `inner_text()` liefert damit
  „CONTENTS", nicht „Contents". Drei meiner Checks sind daran gescheitert und haben KORREKTEN
  Code angeklagt. Bei Text-Assertions gegen dieses UI: `.upper()` vergleichen.
- **Die Suiten-Wrapper und `bun run build` sind cwd-empfindlich.** Ein `cd` in ein
  Scratch-Verzeichnis früher in derselben Bash-Zeile lässt `bun run build` dort laufen, es
  meldet Erfolg, und der Test misst danach ALTEN Code. Zweimal passiert. Build und `cp` immer
  mit absoluten Pfaden aus dem Repo heraus.
- **`pkill -f "bun server.ts"` killt den LIVEN Server.** Ich habe es getan (10:53). Der
  Watchdog hat ihn nach ~2 s neu gestartet, der Audit-Trail zeigt danach kein einziges
  Slot-Event, es ging nichts verloren — aber das war Glück im Sinne von „der Watchdog
  funktioniert", nicht Vorsicht. Eine Wegwerf-Instanz beendet man über ihren PORT:
  `kill $(lsof -ti tcp:23462)`.
- **`./e2e-isolated.sh` fiel einmal mit 2 Checks im Steward-Send-Episoden-Limiter**
  („a second send of the same kind×slot within the episode window is 429 (409)" +
  „a capped send is audited"). Derselbe Baum, direkt danach: 993 PASS. Damit ist die
  Nicht-Determiniertheit nach der Hausregel bewiesen; der Diff fasst diesen Pfad nirgends an.
  Eine Beobachtung, keine sechste Flake-Familie — dafür braucht es mehr als eine Instanz.

### Was ich als offen kenne (meine Liste, nicht die des Owners)

1. **Die vier Fenster haben WEITER null e2e-Abdeckung — und die Lücke ist jetzt GRÖSSER, nicht
   kleiner.** Ich habe diese Session vier Playwright-Harnesses geschrieben, zusammen **72
   Checks** (24 Picker · 17 Activity · 13 Mobile · 18 Datei-Viewer): der Picker-Baum inklusive
   aller Guide-Arrays gegen ein Fixture bekannter Form, Mobile mit Touch-Emulation, die drei
   Activity-Linsen gegen die LIVEN Ledger, der Datei-Viewer über alle vier Aufrufstellen. Sie liegen in `$SCRATCH/{pick,act,mob,fileview}.py` und **sterben mit dieser
   Session** — sie sind bewusst NICHT eingecheckt worden, und der Grund ist wichtig: sie tragen
   absolute Pfade mit dem Maschinen-Accountnamen (8 Vorkommen über die vier Dateien), und dieses
   Repo ist öffentlich. Wer sie einchecken will, muss die Pfade vorher parametrisieren (env /
   argv) und danach den Privacy-Grep aus `CLAUDE.md` (Abschnitt Deploy) leer sehen — der
   Owner-Entscheid aus Session 14 gilt weiter. Der Entscheid aus Session 15 (Punkt 3) ist damit fällig und schärfer geworden:
   entweder die Harnesses werden ein echter, opt-in Suite-Ordner im Repo — **Achtung: sie
   brauchen Playwright, das eine Homebrew-*Python*-Installation ist und KEINE Repo-Abhängigkeit;
   ein Gate-Eintrag würde jede Lane brechen, die es nicht hat** — oder es wird ausdrücklich
   festgehalten, dass diese Fenster handgeprüft bleiben. Der Status quo ist weiterhin die
   schlechteste Variante.
2. **Mobile: nur der Picker ist geprüft.** Queue- und Activity-Fenster sind auf dem Handy
   unverändert UNGEPRÜFT (Session 15, Punkt 2 — der Picker-Teil davon ist erledigt).
3. **Der Datei-Viewer kann keine Datei aus der Lands-Linse öffnen** — siehe „Das Erste" oben.
4. Unverändert offen aus Session 15: zwei Overlay-Idiome nebeneinander (Punkt 3), `src/client.ts`
   ist jetzt 5394 Zeilen (Punkt 4), der Picker-Filter expandiert nicht (5), der Kinder-Cache
   lebt so lange wie das Fenster (6), `showDirDetail` feuert pro Pfeiltaste (8), `/api/commits`
   deckelt bei 200 ohne Paging (9).

### Aus 15/13 unverändert offen

- **Beide Pulse sind jetzt still**, nicht nur einer: `/inspektion` UND beide `/rundgang`-Autos
  stehen auf `runsLeft: 0` (live nachgezählt). Die fällige Entscheidung aus Session 13 gilt
  damit für alle drei.
- **7 pending Tasks** (live: 8 Rows, 7 pending) — unverändert, zwei davon laut Session 13
  längst erledigt und nur nicht abgeräumt.
- **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.
- **Maschinenhygiene steigt weiter: 146 geleakte e2e-tmux-Sockets, 17 MB TMPDIR-Scratch.**
  Nichts reapt sie. Ein Teil davon ist diese Session (ich habe ~10 Suite-Läufe gefahren).
- Die zwei Messreihen aus Session 13 brauchen weiter Lanes, bevor sie etwas sagen.

### Key Decisions (mit Grund)

- **Ein Viewer, vier Aufrufstellen, jede benennt ihre Revision.** Der Entwurfsfehler wäre „einen
  Datei-Viewer bauen": eine Datei hat mehr als eine Version, und jede Liste meint eine andere.
  Darum liefert jeder Aufrufer WELCHE Revision er meint und wohin `‹ zurück` führt — und die
  Kopfzeile sagt es immer laut.
- **Markdown wird NICHT gerendert** (siehe Korrektur oben) — ein Viewer zeigt die Quelle.
- **Untracked bekam eine eigene Pick-Art** im Review-Fenster. Als `file`-Pick behandelt rendert
  es „no longer in this diff": wahr und nutzlos. Die Datei selbst IST das Neue an ihr.
- **`/api/file` ist owner-only durch POSITION** (hinter tokenGate, unter dem Share-Gate) — genau
  die Eigenschaft, die ein späteres Verschieben eines Blocks lautlos bricht. Deshalb prüft
  `fleet-e2e-security.ts` §8 jetzt beide Hälften gegen `fleet.json`: ohne Token 401 und keine
  Bytes im Body, auf dem Share-Host 404 **auch MIT** Owner-Token.
- **Klick öffnet, Doppelklick startet** (Picker). Und: ein Klick klappt nur AUF, nie zu — sonst
  springt die Zeile unter dem Cursor weg.

### Womit man sofort weiterarbeitet

`./state.sh`, dann `git log 8f4565b..HEAD` MIT Bodies — die fünf Bodies sind das Befund-Register
dieser Session. Neue Einstiege: `showFileView`/`loadFile`/`renderFileBody` und `appendDirContents`
in `src/client.ts`, `dirEntries`/`fileBody` und die Routen `/api/file` + `/api/commit-diff` in
`server.ts`, `auditProjects` (die abgeleitete Slot→Projekt-Zuordnung) ebenfalls in `client.ts`.

---

## Session 15 (2026-07-31/08-01): vier Overlays wurden Fenster, und das Land-Gate ist wieder grün

8 Commits, `0ea14e8`..`41c1733`, alle deployed (srv läuft seit 08-01 09:57 als pid 39482, alle 19
tmux-Sessions haben den Restart überlebt) und live nachgeprüft.

### Das Erste, was die nächste Session tun muss

**Der Owner hat gesagt: „but there are still some things left to fix on this work" — und NICHT
gesagt, was.** Nicht raten. Die Liste unter „Was ich selbst als offen kenne" ist MEINE Liste, nicht
seine; sie kann sich mit seiner überschneiden oder gar nicht. Erste Handlung: fragen.

### Absicht dieser Session

Zwei Runden, beide „eins nach dem anderen" auf Owner-Vorgabe. Runde 1: die vier Flächen, die er als
Brain-Dump nannte — Diff/Commit-Review, Projektauswahl, Task-Queue, Outcome-Feed — waren alle
dieselbe `.overlay > .panel`-Box (520–900 px, eine scrollende Spalte) und mussten deshalb alle
abschneiden, was sie zeigen. Runde 2: Polish — der Picker lud endlos, ein Ordnerbaum wurde gewünscht,
der Outcome-Feed sollte auch Commits zeigen, der Audit-Trail „vielleicht als View-Option".

### Korrekturen an Behauptungen, die sonst in die Irre führen

- **`bun run build` IST ein halber Deploy.** Der Server liefert `public/app.js` von Platte — der
  Client ist also sofort live, neue ROUTEN erst nach srv-Restart. Genau das hat der Owner als
  „lädt endlos" gesehen: gemessen `/api/dirs` → 200, `/api/dirinfo` → 404 gegen die laufende
  Instanz. Wer hier Client UND Server anfasst, muss beide Hälften deployen, sonst baut er dem
  Owner eine kaputte Oberfläche. Der Client sagt das jetzt selbst (`SKEW_NOTE`) statt zu drehen.
- **Ein Kommentar, der die Landmarken zitiert, an denen `e2e/outcomes.ts` die Datei zerschneidet,
  macht die Checks LEER.** Passiert in Schritt 4: `indexOf()` traf den Kommentar statt den Code,
  vier Ehrlichkeits-Checks waren vakuum und meldeten trotzdem grün. Gefunden, weil ich alle 14
  Source-Assertions lokal nachgebaut habe, BEVOR ich eine Suite dafür bezahlt habe. Diese
  Nachbau-Prüfung ist billig und gehört vor jede Änderung am Outcome-Renderer.
- **Das Land-Gate war seit dem 07-28-Flip rot und niemand hat es gefahren.** `bun e2e/pins.ts` ist
  sein erster Schritt, also war ALLES dahinter (tsc + drei Suiten) vier Tage lang unerreichbar.
  Kein Land in dem Fenster — nur deshalb ist es nicht als kaputter Auto-Land aufgefallen.

### Was ich selbst als offen kenne (meine Liste, nicht die des Owners)

1. **Die vier Fenster haben NULL e2e-Abdeckung.** `grep` über `e2e/*.ts` + `fleet-e2e*.ts` nach
   `openShell`/`shell-review`/`shell-picker`/`shell-queue`/`shell-outcomes` ist leer. Die einzigen
   Client-Checks sind die Source-Text-Assertions über den Outcome-Renderer-WORTLAUT. Jede
   Regression in Layout, Auswahl, Tastatur oder Datenfluss dieser vier Fenster ist für JEDES Gate
   unsichtbar. Alles, was ich geprüft habe, war Playwright von Hand gegen eine Wegwerf-Instanz.
   Das ist die größte Qualitätslücke dieser Arbeit.
2. **Mobile nur für das Review-Fenster geprüft** (390 px, Liste↔Detail-Push und Zurück-Knopf).
   Picker-Baum, Queue und Activity-Fenster sind auf dem Handy UNGEPRÜFT — und das Handy ist hier
   eine echte Fläche (`docs/screenshot-mobile.png`).
3. **Zwei Overlay-Idiome koexistieren.** Vier Shell-Fenster, und weiter als `.panel`:
   `#hist` (Prompt-History), `#autodlg` (Zeitpläne), `#sharedlg` (Share), `#gate` (Token). Kein
   Fehler, aber inkonsistentes Vokabular; wer das angleicht, sollte es bewusst tun.
4. **`src/client.ts` ist 4938 Zeilen.** Die Renderer wurden bewusst NICHT ausgelagert (Begründung
   unter Entscheide) — die Spannung bleibt und wächst.
5. **Der Filter im Picker expandiert nicht.** Ein Treffer in einem eingeklappten Ordner bleibt
   unsichtbar. Absichtlich (ehrlich: er filtert, was da ist), aber eine echte Grenze.
6. **Der Kinder-Cache des Baums lebt so lange wie das Fenster.** Ein Ordner, der während des
   Offenseins angelegt wird, erscheint erst nach Re-Root/Neuöffnen.
7. **Der Commits↔Lands-Join ist ein ZEIT-Treffer (±1 h), kein Beweis.** Ein echter Join bräuchte,
   dass `recordLand` den resultierenden Commit-SHA schreibt — das wäre die saubere Server-Änderung.
8. **`showDirDetail` feuert pro Pfeiltaste** (latest-wins, aber N Requests beim Durchscrollen).
   Ein Debounce wäre billig.
9. `/api/commits` liefert max. `MAX_COMMIT_ROWS` (200) ohne Paging; die Audit-Timeline ist auf ±8
   Ereignisse begrenzt. Beides bewusst gedeckelt, beides sagt es im UI.

### Aus Session 13 unverändert offen — ich habe nichts davon angefasst

- **`/inspektion` hat `runsLeft 0`** und ist still. Die fällige Entscheidung (neu aufsetzen oder
  ruhen lassen) steht weiter aus.
- **7 pending Tasks** — live nachgezählt, immer noch exakt 7. Zwei davon waren laut Session 13
  bereits erledigt und nur nicht abgeräumt.
- **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt weiter ohne Slot auf Platte.
- **Maschinenhygiene:** 127 geleakte e2e-tmux-Sockets. Meine eigenen sieben habe ich gereapt; die
  127 sind Altbestand, und nichts reapt sie.
- Die zwei Messreihen aus Session 13 brauchen weiter ~15 Lanes, bevor sie etwas sagen.

### Key Decisions (mit Grund, weil der Grund das Wiederaufrollen entscheidet)

- **Die Renderer bleiben in `src/client.ts`; nur neue Chrome ging nach `src/shell.ts`.**
  `e2e/outcomes.ts` und `fleet-e2e-security.ts` lesen diese Datei als SOURCE TEXT, und ein Check
  schneidet einen Bereich per Index heraus, transpiliert und FÜHRT IHN AUS. Ein Umzug bricht die
  Test-Maschinerie, nicht den Test — das ist teurer als die Dateigröße.
- **Ein Klick wählt aus, statt zu navigieren (Picker).** Plattform-Standard (Finder/Explorer/VS
  Code) und die Vorbedingung dafür, dass ein Detail-Panel überhaupt erreichbar ist. Nebeneffekt:
  der 250-ms-Timer, der nur Einzel- von Doppelklick trennte, ist weg.
- **Audit als LENS, nicht als viertes Fenster.** Owner war unsicher („maybe just as a view option");
  die drei Linsen beantworten eine Frage aus drei Winkeln, und die Lücken dazwischen waren das
  Problem — der Ledger sieht einen von Hand getippten Commit nicht.
- **`off` wurde ein benannter Wert, statt den Pin zu lockern.** Ein Pin, der aufhört zu fallen, ist
  schlechter als ein roter: er schweigt dann für immer über echte Tippfehler. Mutation beweist
  beide Richtungen (`off` → PASS, `offf` → FAIL exit 1).
- **Verifikation dieser Session:** tsc + `bun run build` + der Demo-Checkout (`~/claude-fleet-demo`,
  eigenes `typecheck`/`build`, KEIN Gate hier fängt einen Bruch) + Land-Gate + `./e2e-isolated.sh`
  für alles, was den Outcome-Renderer berührt. Plus Playwright von Hand — siehe Lücke 1.

### Reihenfolge der nächsten Schritte, und warum diese Reihenfolge

1. **Owner fragen, was noch offen ist.** Blockierend: er weiß es, ich nicht, und jede Minute an
   meiner Liste kann an seiner vorbeigehen.
2. **Mobile-Durchgang für Picker/Queue/Activity.** Billig, und das Handy ist eine echte Fläche.
   Vor jeder weiteren Feature-Arbeit, weil Layout-Fehler dort strukturell sind, nicht kosmetisch.
3. **Entscheiden, ob die vier Fenster e2e-Abdeckung bekommen** — oder ausdrücklich festhalten, dass
   sie handgeprüft bleiben. Der Status quo ist die schlechteste Variante: er sieht abgedeckt aus
   (die Suiten sind grün) und ist es für diese Fenster nicht.
4. Erst danach die Punkte 5–9 meiner Liste, falls der Owner sie überhaupt will.

### Womit man sofort weiterarbeitet

`./state.sh`, dann `git log 99a9c0f..HEAD` MIT Bodies — die acht Commit-Bodies sind das
Befund-Register dieser Session (Messungen, Mechanismen, was gemessen vs. nur gelesen wurde).
Die Dateien, die man dafür kennen muss:

- `src/shell.ts` (190 Z.) — das Fenster, das alle vier Flächen teilen. Nur Chrome: Layout,
  Auswahl, Tastatur, Mobile-Push, Escape in der CAPTURE-Phase. Generalisiert bewusst keine Rows.
- `src/client.ts` — alle vier Renderer. Einstiege: `openReview` · `openPicker`/`paintPicker`/
  `dirRow` · `openQueue`/`renderQueue` · `openActivity`/`renderActivity` (+ `renderOutcomes`,
  `renderCommits`, `renderAudit`). `SKEW_NOTE` erklärt die Deploy-Falle.
- `e2e/outcomes.ts` §(9d)–(9i) — die Source-Text-Assertions über den Outcome-Renderer. VOR jeder
  Änderung dort lokal nachbauen; sie schneiden die Datei zwischen Landmarken-Statements.
- `e2e/pins.ts` (Block `FLEET_CLEAN_REVIEW`) — leitet die erkannten Werte aus den Regexen in
  `server.ts` ab, damit die Menge nicht zweimal geschrieben wird.
- `server.ts` — neu: `slotCommits`/`commitRows`, `dirInfo`, `knownRepos` und die Routen
  `/api/slots/:id/commits`, `/commit-diff`, `/api/dirinfo`, `/api/commits`.

Nicht-offensichtlicher Zustand: die Wegwerf-Instanz zum Anschauen steht in
`$SCRATCH/ui-harness.sh` (eigener Socket/Port 23450, `FLEET_CMD=true`, `FLEET_AUTO_REVIEW_MS=0`) —
sie ist NICHT im Repo und muss ggf. neu geschrieben werden; Muster ist `e2e-isolated.sh`.
Deploy bleibt `tmux -L claudefleet kill-session -t srv`, danach IMMER `bundleStale` prüfen
(`/api/steward/sessions`, Bearer = `stewardToken` aus `fleet.json`, nicht der Owner-Token —
der gibt dort 404).

---

## Session 14 (2026-07-30): Teil A der öffentlichen Demo ist aufgenommen

Zwei Commits, `d638c63` + `214f630`, **nicht gepusht**. Vier echte Claude-Code-Sessions auf
einer Wegwerf-Instanz (Port 8877, eigener Socket, Scratch-Kopie — die Live-Instanz auf 8790
wurde nicht berührt), ihre Roh-Streams liegen in `demo/fixtures/`. Neues Bild in
`docs/screenshot.png`, dazu erstmals ein Handy-Bild. **Das operative Wissen dazu steht in
`docs/demo-fixtures.md`** — vier Fallen, die aus den Bytes nicht ableitbar sind; wer den
Replay-Player baut (Session B) oder das Bild neu schießt, liest das zuerst.

**Der Owner-Entscheid dieser Session, und er gilt weiter: der Maschinen-Accountname darf
nirgends sichtbar sein.** Er stand 80× in den Aufnahmen und im Screenshot. Konsequenzen, die
über diese Session hinausreichen:

1. **Redaktion in einem Terminal-Stream muss längentreu sein** (8 Bytes für 8), sonst
   verschiebt sich jede Cursor-Adresse danach. Kein Text-Ersetzen ohne diese Eigenschaft.
2. **Ein Grep über die Bytes reicht nicht.** Ein Vorkommen lag als die ersten sieben Zeichen
   des Namens + Cursor-Sprung im Stream, das achte hatte ein früherer Redraw gemalt — der Grep
   war sauber, der *gerenderte Frame* zeigte den Namen. Gefunden über alle Fragmente ≥ 3
   Zeichen, bewiesen durch Rendern des Frames vor/nach dem Patch. Für Terminal-Aufnahmen gilt:
   prüfen, was **malt**, nicht was greppt.
3. **Die Regel gilt auch für die Prosa.** Der erste Anlauf dieser Dokumentation nannte das
   Fragment wörtlich und hätte sieben Achtel des Namens in ein öffentliches Repo geschrieben —
   in derselben Datei, die vor genau diesem Fehler warnt. Beschreiben, nicht zitieren.
4. **Die Commits wurden vor jedem Push umgeschrieben**, damit kein Blob den Namen je trug. Ein
   Nachbesserungs-Commit hätte ihn dauerhaft in der Historie gelassen — das ist das Leck, nicht
   der Working Tree. Prüfung: `git log -p 4b8fec4..HEAD` gegen den Namen und gegen jedes seiner
   Fragmente ≥ 3 Zeichen = 0.

**Was als Nächstes ansteht (Demo-Strang):** Session B baut den Replay-Modus, Session C bettet
ein. Beide brauchen `docs/demo-fixtures.md`; der Geometrie-Vertrag (76×28) und „vor dem ersten
Byte den Terminal löschen" sind harte Vorgaben, keine Vorschläge.

**Offen, klein:** Das Board-Bild rendert die Fixtures, nicht eine lebende Flotte (vier fertige
Live-Sessions sind nachträglich nicht mehr fotografierbar) — steht im Commit-Body und in der
Doc. Wer es je wieder live schießen will, muss die Aufnahme neu fahren.

**Nicht im Repo, aber erhalten:** die vier echten Diffs der Sessions und die Aufnahme-Skripte
liegen in `~/claude-fleet-private/demo-2026-07-30/`. Der `claude-deck`-Patch (500 → 400 an der
Boundary) ist ein echter Fix für dieses öffentliche Repo und wartet dort auf Übernahme; die
Scratch-Klone sind weg.

---

## Session 13 (2026-07-29/30): der zweite Puls, und ein Datenlayer für Slots

### Was diese Session getan hat

Der Owner wollte zweierlei: den Steward autonom nach Fehlern/Verbesserungen schauen lassen,
und den Datenlayer über Sessions/Slots/Lanes ausbauen. Beides steht: 10 Commits, `c1f4ad5`
bis `fd982e9`, alle deployed und verifiziert. (`fc24499..HEAD` sind 13 — die drei ältesten
darin, Privacy-Scrub und `.env`-Umzug, stammen noch aus der Vor-Session.)

**Der Inspektor (`/inspektion`) ist der zweite Puls.** Der Rundgang schaut auf den *Betrieb*,
der Inspektor auf die *Substanz* — ein Revier pro Lauf aus fünf, rotierend über sein eigenes
Register, read-only, filed höchstens 1–2 `pending`. Konzept in `docs/steward.md` §Die zwei
Pulse; Register ist `inspektion-register.jsonl` im Steward-Worktree (untracked, 23 Zeilen).

**Er hat sich in zwei Läufen bezahlt gemacht.** Puls 1: eine verifizierte latente Auth-Lücke
und ein verwaistes Mess-Subsystem. Puls 2: **einen echten Bug in Code, der zwei Stunden vorher
gelandet und auf Owner-Nachfrage kritisch nachgeprüft worden war** (`b7d449a0` → `ba4b24f`).
Das ist der stärkste Beleg, den es für den Puls gibt.

**Der Slot-Datenlayer** (`slotstats.ts`, `GET /api/slot-stats`, `slotHealth` im Digest) misst,
was ein Slot verspricht: behält er seine Identität über einen Crash. Reine Ableitung aus
Events, die längst geschrieben wurden — plus zwei Erfassungszeilen dort, wo die Ableitung an
eine Wand lief (Heal-Grund, Kill-Grund).

**Der ③-Reviewer bekommt Kontext statt Werkzeug** (`b50c233`): die vollen Inhalte der
meistberührten vorbestehenden Dateien reiten im DATA-Block mit. Werkzeuglos und one-shot
bleibt er — die Ablehnungsgründe für die Alternativen stehen an den Konstanten in `server.ts`
und sind die Checkliste für die Eskalation, falls die Messreihe sie fordert.

### Zwei Messreihen laufen — beide brauchen ~15 Lanes, bevor sie etwas sagen

Nicht vorher interpretieren. Beide lesen sich aus vorhandenen Ledgern, ohne neue Erfassung:

1. **Wirkt der ③-Kontext?** Basis vor der Änderung: 46 % der Findings `basis:"inferred"`
   (36/78), und 32 von 66 Notes sagen „did not check code outside the diff". Beides muss
   fallen. Quelle: `review.findings[].basis` und `review.notes` in `lane-outcomes.jsonl`.
2. **Hält der Slot sein Versprechen?** Die Serie startet bei `ba4b24f` neu — Rows davor können
   die Frage nicht beantworten, weil die Klassifikation kaputt war. Zu lesen an `healReasons`
   in `/api/slot-stats`: `no-session` = die harmlose openSlot-Race, `no-transcript` = die echte
   Verletzung. Vorher war Letzteres unerreichbar.

### Was als Nächstes ansteht — in dieser Reihenfolge

1. **Die Pulse laufen aus, und das ist Absicht.** `/rundgang` (`ad14fc62`, alle 3 h) hat noch 3
   von 8 Läufen; `/inspektion` (`cf216970`, alle 6 h) hat **runsLeft 0** und ist damit still.
   Endliche Run-Caps sind der Mechanismus, der „weiterlaufen" zu einer Entscheidung macht statt
   zu einem Default — genau daran ist der alte Rundgang-Auto im Juli unbemerkt gestorben.
   **Fällige Entscheidung: Inspektor neu aufsetzen (dann ggf. `perpetual: true`, owner-only)
   oder ruhen lassen.** Entscheidungsgrundlage: zwei Läufe, zwei verwertbare Befunde, einer
   davon ein echter Bug.
2. **7 pending Tasks.** Zwei davon sind diese Session verifiziert UND erledigt (`0b21cc94`
   gelöscht in `59eccbb`, `d8efc50f` gehärtet in `d495607`) — die Rows stehen aber noch auf
   `pending` und gehören abgeräumt, sonst zählen sie beim nächsten Blick doppelt. Der Rest ist
   ungeprüft. Vor einem Dispatch-Einschalten ohnehin durchzusehen (Steward-Benachrichtigungen
   landen in derselben Queue und würden als Brief gespawnt).
3. **Maschinenhygiene wird laut:** 88 geleakte e2e-tmux-Sockets, 60 MB TMPDIR-Scratch. Nichts
   reapt die. Kein Betriebsrisiko heute, aber monoton steigend.
4. **Orphan-Worktree `fleet-260728184459-9e73`** (5523d1f) liegt ohne Slot auf Platte — landen
   oder verwerfen.

### Korrekturen an früheren Behauptungen (diese Session gemessen)

- **„Der Steward-Ladepfad funktioniert" war falsch.** `/steward` Schritt 0 (`git merge main`)
  hätte **418 fremde Commits** gezogen (History-Rewrite beim Public-Release), und 11 von 13
  Doc-Referenzen der drei Steward-Commands zeigten ins Attic. Beides behoben: Branch auf main
  zurückgesetzt (Rückweg als Tag `steward-pre-reset-2026-07-29`; 13 Unikate gerettet nach
  `~/claude-fleet-private/steward-rescue/`), Pfade korrigiert.
- **Der Doc-Index war zu 84 % falsch** — 10 von 61 Pointern lösten auf. Neu geschrieben auf die
  10 operativen Docs, mit dem Pointer-Check als ausführbarer Zeile darin. Der Check fand beim
  ersten Lauf einen Fehler in seiner eigenen Neufassung und danach fünf weitere in
  `steward.md` — das ist der Grund, ihn zu behalten.
- **`self_heal_recreate` feuert bei JEDEM `ensureSlot`-Spawn**, nicht nur bei Heilungen. Das
  erklärt `opens ≈ heals` in den Live-Zahlen; die 196:1-Zahl der ersten Messung war deshalb nie
  „196 Heilungen". Die Trennung leistet jetzt die Reason-Spalte.
- **Zwei Protokoll-Abweichungen des ersten Pulses** waren im Pane-Output unsichtbar und nur im
  Audit-Trail zu sehen (zwei Reviere in einem Lauf; erfundene Register-Zeitstempel), beide im
  Command geschlossen (`41e8313`). Die Lehre: die Puls-Ausgabe ist kein Compliance-Beleg.

### Key Decisions

- **„Deliver context, not tools" statt Snapshot-Worktree für ③.** Gemessen, nicht geraten: das
  Defizit war Kontext (46 % inferred, 32 „did not check"-Notes), nicht Werkzeug (Truncation nur
  3×). Ein Reviewer mit Tools im *lebenden* Lane-Baum wurde verworfen — er rennt gegen die
  index.lock-Klasse, liest die kopierte `.env` und bricht die patchId-Ehrlichkeit. Der
  Snapshot-Worktree bleibt die Eskalationsstufe, falls die Messreihe sie fordert.
- **Die A2-Nullkontrollgruppe gelöscht, nicht repariert.** Keine der zwei Entscheidungen, die
  sie verwaisen ließen, war falsch — erst ihre Konjunktion ließ eine Messung ohne Frage laufen.
  Zusätzliches Argument, das die Sache entschied: die Baseline war in-memory und starb bei jedem
  Deploy, akkumulierte also nie über ein Boot-Fenster — genau der Fehler, den
  `graduation-criteria.md` selbst benannt hatte.
- **Endliche Run-Caps für beide Pulse.** `perpetual` existiert (owner-only) und wurde bewusst
  nicht genommen: ein Puls, der nie ausläuft, wird nie wieder bewertet.
- **Der Datenlayer ist Ableitung, nicht Erfassung.** Kriterium des Owners, wörtlich: „aufpassen
  das wir nicht irgendwelche Daten erfassen und mitgeben die unbrauchbar sind". Es hat sofort
  gegriffen — der Realdaten-Lauf fand `malformed: 468` auf einer Datei ohne eine einzige kaputte
  Zeile (Scope-Prüfung stand hinter der Feldvalidierung). Jede Zahl beantwortet eine benannte
  Frage, sonst fliegt sie raus.

### Womit man sofort fortsetzen kann

`./state.sh`, dann `git log fc24499..HEAD` mit Bodies. Die zwei Messreihen brauchen keine
Erklärung, nur Geduld und einen Ledger-Query; die eine fällige Entscheidung ist Punkt 1.
