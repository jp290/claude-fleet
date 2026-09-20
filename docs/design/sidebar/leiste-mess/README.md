# Messtreiber für die linke Leiste (Bau 1, Nacharbeit „Raumnutzung")

Vier Dateien, dieselbe Begründung wie eine Ebene höher in `mess/`: sie liegen im Baum und nicht im
Scratchpad, weil ein Scratchpad mit der Session stirbt und die Zahlen dann nicht nachfahrbar sind.
Anders als `mess/` messen sie nicht einen Prototypen, sondern die **laufende App** — zwei
Wegwerf-Instanzen, eine je Baum-Stand, damit Vorher/Nachher am selben Fixture hängt.

| Datei | was sie tut |
|---|---|
| `instanz-shot.sh` | stellt aus einem Quell-Checkout eine Wegwerf-Instanz her (eigener Port + tmux-Socket, `FLEET_CMD=true`), füllt sie mit drei Sessions und zwei Lanes, ruft die beiden Treiber und räumt ab |
| `cdp-shot.js` | fährt Headless-Chrome über das DevTools-Protokoll: laden, **Stack aufklappen**, neu laden, bei 900 und 1200 px fotografieren |
| `flaechenbudget.js` | zählt je Zeile die FLÄCHE in px² und teilt sie in Fakt / Chrome / Leerraum; die Klassifikation steht im Kopf der Datei |
| `auslegung-raumnutzung.md` | die Auslegung des Owner-Satzes, **vor** dem Bau notiert |

## Warum der Umweg über CDP
Ein blosses `--screenshot` reicht nicht: der Lane-Stack ist zugeklappt, und die Lane-Zeilen sind
genau das, was geprüft werden soll. Der Faltzustand liegt in `localStorage`, das nur eine Seite
**desselben Origin** setzen kann — und dieser Server liefert keine solche Seite aus (mit einer
`public/seed.html` probiert: `ERR_INVALID_RESPONSE`, er bedient nur bekannte Routen). Also wird der
Browser gesteuert statt angeschossen.

## Fallen, die schon Zeit gekostet haben
- **`nohup … > log` ist blockgepuffert.** Ein Suite-Lauf so gestartet lieferte `exit 0` und KEINE
  einzige `PASS`-Zeile. Das heisst „nie gemessen", nicht grün. Im Vordergrund wiederholen.
- **Die Instanz braucht ein echtes Git-Repo**, sonst scheitert `POST /api/lanes` stumm und die
  Leiste zeigt keine Lane — also `git init` + ein Commit im Quellbaum der Instanz.
- **Auth ist `authorization: Bearer <token>`**, nicht `x-fleet-token`.
- `instanz-shot.sh` zieht `e2e-stage.sh` herein und nimmt damit den **Suite-Mutex**: nicht parallel
  zu einem laufenden Suite-Lauf starten, sonst misst man die Last mit.

## Bezugsgrösse
`docs/messungen/INDEX.md` (Notiz `2026-09-20-session-marke-entwurf.md`) misst die ALTE Leiste mit
„45 von 9120 Pixeln einer Zeile" — 9120 = 228 px × 40 px. Die Zahlen hier sind in derselben
Einheit (px² je Zeile), damit sie vergleichbar bleiben.
