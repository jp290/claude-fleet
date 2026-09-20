#!/bin/zsh
# Ein Bild je Seite: Chrome headless, 1100x900 CSS bei dpr 2 = 2200x1800 — exakt die Masse von
# c16-marke-a.png, damit ein Vorher/Nachher-Vergleich Pixel gegen Pixel moeglich ist.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="$1"; OUT="$2"; shift 2
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1100,900 --virtual-time-budget=2500 --screenshot="$OUT" "$@" "$URL" 2>/dev/null
