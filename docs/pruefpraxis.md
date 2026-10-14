# Prüfpraxis

Quelle des ContextPacks `pruefpraxis` (`.fleet/context-packs.json`). Eine Branch-Session mit Ziel bekommt den
Abschnitt unten beim Start, eine Lane oder MAIN kann ihn ausleihen. Herkunft: Owner 13.10.2026 18:5x, „[Zitat entfernt]“

 und „Ich habe mich auch auf Testinstanzen bezogen, nicht nur auf Tests.“
Befund und Schnittplan: `docs/neuaufbau/befunde/15-pruefpraxis.md`.

## Prüfpraxis — ein Bericht ist eine Behauptung, bis er belegt ist

Gilt für jede Bau- und Prüf-Session: für deinen eigenen Bericht und für jeden Bericht, den du liest.

1. **Belege lesen, nicht erinnern.** Ein Bericht ist eine Behauptung, bis die Zeile des Merge-Checks und der rc
   des Handlaufs gelesen sind. Die Zeile steht in `.git/merge-checks.jsonl` des Checkouts, in dem der Check lief
   (`git rev-parse --path-format=absolute --git-common-dir`): Spitze, Kandidat, Baum, `mergeable`. Der rc steht am
   Workhorse in `~/ci/hand/<lauf>/rc`. Beides zitierst du wörtlich; eine Zahl aus dem Gedächtnis ist kein Beleg.
2. **Den eigenen Diff selbst lesen.** Vor dem Bericht liest du `git diff main <Kandidat>` ganz, also genau das,
   was nach main ginge: Was gehört nicht hinein, was fehlt?
3. **Die eigene Testinstanz selbst ansehen, bevor der Owner sie sieht.** Öffne sie und klick den Ablauf so durch,
   wie der Owner es tun wird, am Handy (390 px) und am Desktop. Was halb ist, baust du fertig. Erst danach geht ein
   Link an ihn.
4. **Kein Bericht, kein Fertig.** Der Rückweg ist der Bericht an der Spitze deines Branches:
   `POST /api/self/branch-report` mit deinem Self-Token, Art `done` oder `question`. Die Antwort sagt, was
   gespeichert ist und was das Board an deiner Zeile zeigt. Ohne diesen Bericht ist nichts fertig, auch wenn alles
   grün ist.
5. **Testinstanz nur per `./testinstanz.sh up` im eigenen Worktree.** Kein Klon im Scratchpad und nie
   `bun server.ts` mit der Standard-Umgebung: Die zeigt auf den Live-Socket und Port 8790, und ein zweiter Server
   dort übernimmt die echten Sessions.
6. **Token nie im Chat.** `./testinstanz.sh status` druckt die URL samt Token, `ps` die Tokens fremder Sessions.
   Den token-freien Link liefert `./testinstanz.sh list`. Braucht der Owner einen Link mit Anmeldung, schreibst du
   eine Weiterleitungsdatei und gibst ihren Pfad an die Bauleitung; sie zeigt die Datei über ihren Link-Server und
   löscht sie nach seinem Blick.
