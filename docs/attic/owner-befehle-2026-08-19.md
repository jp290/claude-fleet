# Offene Owner-Befehle — Stand 2026-08-19

> **Redigiert 2026-08-31 beim Tracken in das public Repo:** Tailscale-IP → `100.64.0.1`
> (der Platzhalter, den `watchdog.sh` und `SHARING.md` führen), `/Users/<account>/` → `~/`,
> die Leck-Guard-Muster durch ihre Beschreibung ersetzt. Der Inhalt ist sonst unverändert.

Alles hier ist geprueft. Zeilenweise kopierbar.


## 1. Der Entstauer (der wichtigste)

Was er tut: verlaengert nur die WARTESCHLANGE eines Land-Gates von 15 auf 45 Minuten.
Die Arbeitszeit bleibt bei 300 s. Ein Gate darf dann hinter einem Post-Land-Audit
stehenbleiben, statt unverrichtet aufzugeben.

Warum: 17 echte Audits in 24 h, Median 1013 s, Minimum 975 s, Maximum 1803 s.
KEINES unter 900 s. Das Wartebudget ist 900 s. Wer in einen laufenden Audit
hineinwirft, verliert also nicht mit Pech, sondern mit Sicherheit.
Heute zweimal bezahlt: 1106 s und 1147 s reines Warten, nichts gemessen.

Zum Vergleich, derselbe Gate auf leerer Schlange: 98 Sekunden, waitMs=0.

Die Zeichenkette steht genau einmal in watchdog.sh, Zeile 148.

    cd ~/claude-fleet
    sed -i '' 's/FLEET_VERIFY_WAIT_MS=900000/FLEET_VERIFY_WAIT_MS=2700000/' watchdog.sh
    grep -c 'FLEET_VERIFY_WAIT_MS=2700000' watchdog.sh

Die letzte Zeile muss 1 ausgeben. Erst dann:

    launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog

Der Watchdog-Neustart tastet die laufende srv-Session nicht an.


## 2. Spiel 3 — wer nimmt deine Idee auf

Kein Befehl. Ein Wort an mich, dann schreibe ich den Brief und du erzaehlst.

    a   Sol wie geplant       (codex/gpt-5.6-sol, Slot 6 laeuft schon, ABER unter 5 % Wochenkontingent)
    b   pi-zai / GLM-5.3      (eigener Schluessel, unberuehrtes Kontingent, fremder Blick bleibt)   <- Empfehlung
    c   Fable direkt          (kein fremder Blick, dafuer kein Kontingentrisiko)

Architektur auf claude-fable-5 und Bau auf claude-opus-5[1m] bleiben in allen drei Faellen gleich.
~/private-repo-u ist angelegt, die Reihenfolge steht im README.


## 3. Programm-Freigaben

Ansehen:

    cd ~/claude-fleet
    ./promote-program.sh

Die beiden, die den heutigen Aerger strukturell beheben:

    ./promote-program.sh bf01ef52 --go

Programm-Ansicht im Board plus der fehlende Bindungs-Zug. Ohne ihn bleiben fuenf
aktive Programme fuer immer an tote Slots gebunden (409, keine Aufloes-Route).

    ./promote-program.sh 83075480 --go

Macht "Studio-MAIN laeuft durch, Halt nur bei Geschmack" zum Gesetz statt zum
gesprochenen Satz.

    ./promote-program.sh b3d042ec --go

Suite-Contention: der Land-Gate hoert auf, hinter dem Post-Land-Audit zu warten.
Punkt 1 oben ist das Pflaster, dieses Programm ist die Behandlung.

Weitere Vorschlaege, ohne Eile: d5c6b6cb (Ratenlimit erkennen), d576186d (Private-repo-p),
e04cd5d8 (Supervisor-Attention-Kanal), 42736e1e (Kontextschicht-Arbeitskreis).


## 4. Zwei Kart-Geschmacksfragen

Kein Befehl, nur deine Antwort. Sie blockieren Ledger-Zeilen in ~/private-repo-d.

    Double Dash, zwei Fahrer je Kart — Kernmechanik oder Stilzitat?
    Bleibt "2000er PC-Grafik" die Aussehens-Richtung, obwohl zwei der drei Anker
    Konsolentitel sind?


## 5. Optional: Sicherheits-Kleinigkeit

.env.bak-1787083401 liegt untracked und NICHT gitignored im Haupt-Checkout eines
PUBLIC Repos und enthaelt FLEET_HOST/TOKEN/SHARE. .gitignore deckt nur .env ab.

    cd ~/claude-fleet
    grep -n '^\.env' .gitignore

Wenn dort nur ".env" steht, ist der Fix eine Zeile:

    printf '.env*\n' >> .gitignore

Die Datei selbst fasse ich nicht an — das ist deine Entscheidung.


## 6. NACHTRAG: dein WAIT_MS-Zug ist noch nicht scharf — aber du musst nichts mehr tun

Gemessen mit `ps eww` am laufenden Server:

    watchdog.sh (Datei):  FLEET_VERIFY_WAIT_MS=2700000
    laufender srv (live): FLEET_VERIFY_WAIT_MS=900000

Grund: launchctl kickstart startet den WATCHDOG neu. Der spawnt srv aber nur, wenn
`has-session` fehlschlaegt — die laufende srv-Session ueberlebt mit dem ALTEN Env.
Das Env wird beim Spawn der Pane eingebacken und nie neu gelesen.

ERLEDIGT SICH VON SELBST: Slot 4 wirft nach seinem Post-Land-Audit einen Sammel-Deploy.
Der Deploy-Neustart ist per Default genau der srv-Kill (server.ts:15172,
`tmux -L <sock> kill-session -t srv`, und im Live-Env ist kein FLEET_DEPLOY_* gesetzt),
also spawnt der Watchdog srv aus der GEAENDERTEN watchdog.sh neu. Slot 4 hat den Auftrag,
den Wert danach zu verifizieren und mir zu melden.

Du musst also nichts tun. Falls du es doch selbst pruefen willst:

    ps eww -p $(pgrep -f 'bun server.ts' | tail -1) | tr ' ' '\n' | grep FLEET_VERIFY_WAIT_MS

Muss 2700000 sagen. Nur falls der Deploy ausbleibt, ist der Handweg: erst pruefen, dass
die Maschine ruhig ist (`cat /tmp/fleet-e2e.lock/pid | xargs -r ps -p` gibt nichts zurueck),
dann `tmux -L claudefleet kill-session -t srv`. NIE waehrend eines laufenden Audits —
das erzeugt ein falsches Rot.

## 7. Spiel 3 heisst Private-repo-g — Freigabe

Sol hat geliefert: Konzept, Name, Studio-Vertrag, Programm-Vorschlag (Commit b39a4d2 in
~/private-repo-u). Der Vorschlag liegt als Fleet-Programm.

    cd ~/claude-fleet
    ./promote-program.sh d565f710

    ./promote-program.sh d565f710 --go

Nach der Freigabe bootstrappe ich die Architektur-MAIN auf claude-fable-5 in ~/private-repo-u.
Die beauftragt danach Bau-Lanes auf claude-opus-5[1m].


## 8. Links zu den laufenden Spielen (Tailscale)

    private-repo-d — das Spiel, immer der aktuelle main   http://100.64.0.1:4410
    private-repo-c (der aeltere, Slice 1)                http://100.64.0.1:4321
    Arcade-Uebersicht                                http://100.64.0.1:8101
      Private-spiel-b (private-task-06)                         http://100.64.0.1:8101/private-task-06/index.html
      Private-spiel-a (private-repo-l)                        http://100.64.0.1:8101/private-repo-l/index.html
    Arbeitskreis-Atlas                               http://100.64.0.1:8099
    Lerntisch                                        http://100.64.0.1:8100

KORREKTUR: die zwei Lane-Links, die hier vorher standen (:4399 und :4402), sind ENTFERNT.
Sie lieferten hinter einem gesunden HTTP 200 alte Buendel aus — :4399 zeigte 5d56f38
(Stand build/lane1), :4402 zeigte 331cc8e (Stand build/lane2), beide laengst in main
aufgegangen. Die neue Kart-MAIN hat dieselbe Falle unabhaengig gefunden und als harte
Regel in private-repo-ds AGENTS.md geschrieben: eine gesunde 200 sagt nichts darueber, WELCHEN
Build ein Server ausliefert.

:4410 baut pro Anfrage neu aus dem Arbeitsbaum und stempelt den Commit in die Seite —
dort steht immer, welchen Stand du gerade fährst.

Die Bruecke ueberlebt keinen Maschinen-Neustart.

## 9. Prompt fuer die GLM-5.3-Doku-Session

Liegt fertig als eigene Datei:

    briefs/glm-doku-2026-08-19.md   (damals: ~/claude-fleet/PROMPT-GLM-DOKU.md)

Alles ab der Trennlinie ist der Prompt zum Kopieren.
