# P4 Slice 5+6 — Fundament und auth, am Baum `46d29d8` neu vermessen

Diese Notiz **korrigiert** `p4-slice4-vorbereitung.md`, "Ergebnis B". Jene Messung stand auf
`c98b1ec` (server.ts 24313 Z.); hier ist der Baum nach Slice 4 (`46d29d8`, 23776 Z.). Drei ihrer
Aussagen halten nicht mehr, und eine vierte fehlte ganz.

## Die Messung

Sonde: der zusammenhängende auth-Bereich `server.ts:16283-16389` (107 Z., von der Kommentarzeile
über `tokenFrom` bis zur schließenden `}` von `guard`), probeweise in eine Datei gezogen, `tsc`
aus dem Repo-Root. **Setup-/Syntaxfehler 0** — das Ergebnis ist also lesbar und nicht die stille
Leermenge, vor der Ergebnis B warnt.

| freier Name | mal | Status heute |
| --- | ---: | --- |
| `json` | 5 | Kernhelfer → **Fundament** |
| `Share` | 3 | Typ, liegt in `server/types.ts` ✅ |
| `PORT` | 3 | Kernkonstante → **Fundament** |
| `audit` | 2 | **seit Slice 4 aus `server/audit-log.ts` importierbar** ✅ |
| `timingSafeEqual` | 1 | `node:crypto`, trivialer Import ✅ |
| `shares` | 1 | **NEU — stand nicht in Ergebnis B** |
| `Slot` | 1 | Typ, `server/types.ts` ✅ |
| `HOST` | 1 | Kernkonstante → **Fundament** |

## Was sich gegenüber Ergebnis B ändert

1. **`secretEq` ist KEIN Fundament-Kandidat.** Es liegt bei `:16294` mitten IM auth-Bereich und
   wandert mit ihm; Ergebnis B zählte es als vierte blockierende Bindung, weil seine engere
   67-Zeilen-Spanne oberhalb davon endete. Das Fundament schrumpft damit auf **drei** Namen:
   `json`, `HOST`, `PORT`.
2. **`audit` ist entblockt.** Ergebnis B sagte "wäre nach Slice A importierbar" — das ist jetzt
   eingetreten und am Compiler bestätigt.
3. **`shares` ist eine neue Bindung**, die Ergebnis B nicht sah. Sie kostet aber nichts: sie kommt
   aus GENAU EINER Zeile, `const shareBy = (id) => shares.find(…)` (`:16313`), einem
   Share-Nachschlager, der inhaltlich ohnehin nicht auth ist. **Bleibt im Kern, Bindung
   verschwindet.**

## Der Blocker, den keine der beiden Vormessungen hatte: `TOKEN`

`let TOKEN = ""` (`:16298`) liegt im Bereich und ist eine **modulweite `let`, die der Kern
zweimal beschreibt** — `:18826` und `:18829`, beides der Boot-Pfad. Ein Move machte daraus eine
Zuweisung an eine importierte Bindung: **Laufzeit-TypeError, den `tsc` nicht sieht**, und der erst
beim nächsten Serverstart zuschlägt — also nach dem Land, im Watchdog-Respawn.

Das ist exakt die Falle, die Ergebnis B allgemein benannte ("ESM-Bindings sind read-only … kein
tsc-Fehler") und für `authFails`/`ALLOWED_HOSTS` per Augenschein verneinte. Beide sind tatsächlich
`const`. **`TOKEN` ist es nicht**, und danach hatte niemand gesehen.

Folge für den Schnitt: `TOKEN` (`:16298`) samt seinen zwei Lesern `tokenOk` (`:16299`) und
`tokenGate` (`:16305-16310`) bleibt im Kern. Der auth-Move wird dadurch **zweiteilig**
(`16283-16297` und `16316-16389`) — dieselbe Form wie Slice 3, der vier Teilbereiche bewegte.

## Vorschlag: Slice 5 und 6 zu EINEM Slice zusammenziehen

Getrennt ergäbe Slice 5 (drei Deklarationen, ~6 Zeilen netto) einen fast leeren Land- und
Audit-Zyklus: ~110 s Gate, ~29 min Audit, plus die gemessene ~15-%-Wahrscheinlichkeit, dass dieses
Audit an einer Sonde rot wird, die nichts mit dem Schnitt zu tun hat (Queue-Zeile `04fdfc77`).
Zusammen sind es ~110 bewegte Zeilen — der Protokoll-Deckel liegt bei ~2000, die Prüfbarkeit
leidet nicht.

- **`server/http.ts`** (neu, Blattmodul): `json`, `HOST`, `PORT`. Warum diese Abstraktion existieren
  darf: die drei sind die Primitiven der HTTP-Fläche, sie binden nichts aus dem Kern, und jedes
  künftige `server/`-Modul, das eine `Response` zurückgibt, braucht `json` — ein Blattmodul ist
  genau das, was den Zyklus auflöst, den Regel 2 sonst erzwingt.
- **`server/auth.ts`**: `tokenFrom`, `secretEq`, `commentTimes`, `commentStrike`, `shareAuthed`,
  `authFails`, `failStrike`, `shareCookieOffered`, `shareGate`, `closeShareClients`,
  `ALLOWED_HOSTS`, `guard`. Importiert aus `server/{http,types,audit-log}.ts` und `node:crypto` —
  **nie aus `server.ts`**.

## Ertragsehrlichkeit

`json` wird im Kern **1039×** aufgerufen, `secretEq` 37×, `HOST` 16×, `PORT` 9× — **keine dieser
Aufrufstellen ändert sich**, es kommen nur Import-Zeilen dazu. Der Schnitt bringt rund **−110
Zeilen** aus `server.ts`. Gegen die Projektion des Controllers (275/Subsystem, Kern ~19.930 gegen
Ziel 8.000) ist das ein weiterer Slice UNTER Schnitt. Das ist ein Datum für den ausstehenden
Owner-Entscheid zu Erfolgsmaß 1, keine Rechtfertigung, den Schnitt anders zu schneiden.

## Methodennachtrag: eine eigene Sonde, die als etwas anderes scheiterte

Beim Suchen von `shares` im Bereich habe ich `awk '/\bshares\b/'` benutzt. **macOS-`awk` kennt `\b`
nicht** — dort ist es das Backspace-Zeichen, das Muster trifft nie, und die Ausgabe ist LEER. Das
las sich wie "`shares` kommt im Block nicht vor", also wie eine Antwort, und war "nie gemessen".
Gefunden nur, weil das `tsc`-Ergebnis widersprach. Regel, die daraus folgt und die dieses Repo
schon in anderer Form führt: **Wortgrenzen gehören zu `grep`/`rg`, nie zu `awk`** — und ein
Widerspruch zwischen zwei Sonden wird aufgelöst, bevor eine von beiden in einen Brief wandert.
