# Working in few calls

Read this before you search, read or wait in this repo. It is for every seat that builds, checks or orchestrates.

Every call re-reads your whole context, so one call costs about the same whether it prints one line or fifty. What
you write is cheap. What makes work expensive is the number of calls and the size of what each one leaves behind,
because a result stays in your context and is read again by every later call. Ask the question in one call, and ask
for an answer small enough to keep.

## Searching

- **Find with `rg -n -C3 '<name>'` over every file you need, in one call.** The context lines often answer the
  question, so the follow-up read never happens.
- **For structure, use `ast-grep --pattern '<pattern>' --lang ts <file>`.** It finds every call of a function or
  every handler of a shape, where a text search also finds comments and strings. On server.ts it answers in well
  under a second.
- **Routes are often regex alternations.** `rg '"/kill"'` finds nothing in server.ts, because the route is one word
  in `/^\/api\/slots\/(\d+)\/(open|…|kill|…)$/` (`server.ts#slotMatch`). Search for the handler's variable or for
  one path segment.

## Reading

- **Read every span you already know in one call.** After a `grep -n` hands you five line numbers, join five
  `sed -n a,bp` in one command instead of five calls.
- **Read a window the size of the function, not of the file.** A wide window stays in your context for the rest of
  your session. Whole files only when they are small. server.ts has over 55 000 lines: find the line first.
- **A result that says "Output too large … Full output saved to: <file>": `grep` or `tail` that file, never read it
  whole.** The whole read puts back exactly what the cut kept out.
- **Screenshot the element (`target`) or the viewport.** Use `fullPage` only when the layout is the question.

## Handing work off

- **Hand a long question to a subagent.** When you see more than a handful of reading calls coming without an edit
  (an unknown area, checking a claim against the code, an analysis over logs or transcripts), start a subagent
  (Explore, or a smaller model) and ask for the findings with `file:line`. It starts small and you keep only the
  answer.
- **Keep the reading for the code you will edit.** The detail you need for a change has to be in your own context,
  and a summary of that code costs a second read.

## Waiting

- **Wait on the signal, not by asking again.** Use the Monitor tool or a bounded `until` loop on the line that
  decides (a ledger entry, a file, an exit code), with a timeout. An answer of "still running" costs a full call and
  tells you nothing.
- **Send suite and test output to a log file and read the tail or the FAIL lines.**

## Reporting

- **Your report carries its evidence:** `file:line`, a short excerpt, and the command with its result, for each
  claim. Then the reader judges without searching again.
