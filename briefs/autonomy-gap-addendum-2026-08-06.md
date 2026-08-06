Fuehr die Autonomie-Analyse aus `briefs/autonomy-gap.md` durch. **Die Datei ist dein Auftrag** — lies sie zuerst und arbeite nach ihr, nicht nach diesem Prompt. Hier steht nur, was sie nicht wissen kann, weil sie am 2026-08-05 geschrieben wurde.

ZWEITE PFLICHTLEKTUERE: `briefs/autonomy-findings-2026-08-06.md`. Sie enthaelt vier Befunde vom Folgetag, die in KEINEM Ledger stehen — deine Arbeitsauflage "aus den Ledgern rechnen" kann sie also weder finden noch widerlegen. Sie traegt eine Verifikationstabelle; behandle "abgeleitet" und "unbewiesen" dort genauso streng wie die Zahlen im Hauptbrief.

WAS SICH SEIT DEM 2026-08-05 GEAENDERT HAT — nachrechnen, nicht uebernehmen:

- **Bereich 5 ist teilweise ueberholt.** Der Brief fuehrt als schaerfsten Befund "36 Tier-2-Audits, 23 gruen / 13 rot — keine einzige Adjudikation". Am 2026-08-06 gibt es das Feld (`POST /api/post-land-audits/adjudicate`), und der Stand ist ~39 Zeilen mit 12 von 14 Roten adjudiziert. Der Befund in seiner alten Form ist falsch — pruef den heutigen Stand und formulier ihn neu, statt ihn zu streichen ODER zu wiederholen.
- **Bereich 4 hat zwei Landungen bekommen:** der Perception-Fix (`lastOutput` wurde nach jedem Neustart als ~1.79e12 ms gelesen, zwei Verbraucher handelten darauf) und der `stalled`-Fakt. Die drei benannten Sensor-Defekte (Digest liefert nie, `sinceLastLook` schluesselt nach Branchname statt Repo, `transcriptFact.mtime` ist kein Aktivitaetssignal) sind meines Wissens weiter offen — pruef das.
- **Bereich 3 hat frische Evidenz:** eine Lane stand heute 4 Commits hinter main, ohne dass irgendjemand es sehen konnte (der Fakt existiert, liegt aber hinter dem Self-Token der Lane).
- **Bereich 1 auch:** vier Landungen an einem Tag, vier Neustarts von Hand. Und die Reihenfolge "erst den Tier-2-Audit zu Ende laufen lassen, dann srv neu starten" wurde zweimal manuell eingehalten, weil ein Restart den laufenden Audit killt. Das ist eine mechanisierbare Sequenz — bewerte sie.

EIN BEFUND, DER HEUTE ENTSTANDEN IST UND IN KEINE DER FUENF BEREICHE SAUBER PASST: der `stalled`-Fakt ging live und feuerte binnen Stunden — auf einer Lane, die der Owner als **Notiz-Worktree** absichtlich geparkt haelt. Das Praedikat erfuellte jede seiner Klauseln korrekt, das Ergebnis ist trotzdem ein Fehlalarm gegenueber der ABSICHT. `awaiting: "owner"` deckt nur Clarify-Lanes; fuer "absichtlich geparkt" gibt es kein Feld. Sein eigener Brief (`briefs/lane-stalled-fact.md`) setzt als Feuerprobe "10 Instanzen, hoechstens 2 Fehlalarme" — eine systematische Fehlalarm-Quelle bedroht diese Schwelle direkt. Ordne das ein: ist das ein Sensor-Defekt (Bereich 4), ein fehlender Rueckkanal (Bereich 5), oder etwas Eigenes?

DIE AUFLAGEN DES HAUPTBRIEFS GELTEN UNVERAENDERT, besonders diese drei:
1. Aus den Ledgern rechnen, nicht aus Prosa — auch die Zahlen in DIESEM Prompt.
2. Vor jedem Befund pruefen, ob er schon behoben ist. Der Hauptbrief nennt einen Fall, in dem das beinahe schiefging; heute waere es bei Bereich 5 passiert.
3. Read-only. Kein Code, kein Commit an Produktivdateien, kein Flip an einem Schalter.

EINE ABWEICHUNG VOM HAUPTBRIEF, ausdruecklich vom Owner: **dein Bericht MUSS als Datei committet werden** (`docs/` oder `briefs/`, du waehlst). Grund, an einem Tag zweimal passiert: eine Lane stirbt mit ihrem Worktree, und Analyse, die nur in einer Pane liegt, ist danach weg. Der Hauptbrief sagt "kein Commit" — das galt dem Produktivcode und gilt dort weiter. Dein Bericht ist die Ausnahme, und er ist der einzige Grund, warum diese Session laeuft.

Ausserdem, weil eine Session mit frischem Kontext deinen Bericht weiterverarbeiten wird: schreib ihn so, dass er OHNE dich lesbar ist. Jeder Befund nennt Datei/Zeile oder die Ledger-Zahl, aus der er stammt, und was er kostet, wenn er offen bleibt. Trenn sichtbar, was du verifiziert und was du abgeleitet hast.

UND DAS GEGENGEWICHT, das der Hauptbrief ausdruecklich verlangt und das der wertvollste Teil ist: was NICHT automatisiert werden soll und warum; welche Evidenz den naechsten Schritt rechtfertigen wuerde (welche Zahl, ueber wie viele Laeufe, mit welchem Stop-Kriterium); und die Reihenfolge. Ein Vorschlag ohne Schwelle ist eine Meinung.

MASCHINE: du bist read-only und faehrst keine Suite. Fahr auch keine — nebenan arbeitet eine Lane am Land-Gate, und zwei gleichzeitige Suiten erzeugen hier zuverlaessig Fehler auf beiden Baeumen.
