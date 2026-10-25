# Checking practice

Source of the context pack `pruefpraxis` (`.fleet/context-packs.json`). A branch session with a goal gets the
section below at its start; a lane or MAIN can borrow it. Origin: the owner, 2026-10-13 18:5x: „[Zitat entfernt]“
 and "I also meant
test instances, not only tests." Finding and cut plan: `docs/neuaufbau/befunde/15-pruefpraxis.md`.

## Checking practice — a report is a claim until it is backed

Applies to every build and check session: to your own report and to every report you read.

1. **Read the evidence, don't recall it.** A report is a claim until you have read the merge-check line and the rc
   of the hand run. The line is in `.git/merge-checks.jsonl` of the checkout where the check ran
   (`git rev-parse --path-format=absolute --git-common-dir`): tip, candidate, tree, `mergeable`. The rc is on the
   workhorse in `~/ci/hand/<run>/rc`. Quote both verbatim; a number from memory is no evidence.
2. **Read your own diff yourself.** Before the report, read `git diff main <candidate>` in full, which is exactly
   what would go to main: what doesn't belong in it, what is missing?
3. **Look at your own test instance before the owner does.** Open it and click through the flow the way the owner
   will, on a phone (390 px) and on the desktop. Finish what is half done. Only then does a link go to the owner.
4. **No report, not done.** The way back is the report at your branch's tip: `POST /api/self/branch-report` with
   your self token, kind `done` or `question`. The answer says what is stored and what the board shows on your row.
   Without that report nothing is done, even when everything is green.
5. **A test instance only through `./testinstanz.sh up` in your own worktree.** No clone in the scratchpad, and
   never `bun server.ts` with the default environment: it points at the live socket and port 8790, and a second
   server there takes over the real sessions.
6. **Never a token in the chat.** `./testinstanz.sh status` prints the URL with its token, and `ps` the tokens of
   other sessions. `./testinstanz.sh list` gives the token-free link. If the owner needs a link with login, write a
   redirect file and give its path to the build lead; it serves the file through its link server and deletes it
   after the owner has looked.
