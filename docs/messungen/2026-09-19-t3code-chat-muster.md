# t3code chat UI: how it is built, and what transfers to claude-fleet

Source: `git clone --depth 1 https://github.com/pingdotgg/t3code` at commit `82cd1d1a` (2026-09-18 14:23 -0700).
Paths below are relative to `apps/web/src/` in that clone unless they say otherwise.
Line numbers point at that commit.

## 1. License (verified, LICENSE read in full, 21 lines)

**MIT License, "Copyright (c) 2026 T3 Tools Inc."** Standard MIT text: permission "to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies", provided that "the above copyright notice and this
permission notice shall be included in all copies or substantial portions of the Software."
=> Copying or adapting code is allowed. Keep the copyright and permission notice in any file that holds
substantial copied code, for example as a header comment plus a `THIRD_PARTY_LICENSES` entry. claude-fleet is MIT too
(`package.json` "license": "MIT"), so the licenses are compatible.

## 2. Architecture map (verified unless marked)

Stack: React 19 + Tailwind v4 + Base UI primitives (shadcn-style wrappers in `components/ui/`) + react-markdown/unified
+ Shiki (through `@pierre/diffs`) + LegendList virtualization + Tiptap composer. It is an Electron/web app. The chat is
a single route view.

| Concern | Where | What it does |
|---|---|---|
| Page shell | `components/ChatView.tsx` (10 458 lines) | Owns scroll mode, the composer overlay and the "Scroll to end" pill (`ChatView.tsx:9949-9970`: a centered glass `rounded-full` button shown when the user has left the live edge) |
| Row model | `components/chat/MessagesTimeline.logic.ts:941` `deriveMessagesTimelineRows` | Flattens messages and work entries into a typed union of row kinds: `message`, `work`, `work-live`, `work-toggle`, `activity-group`, `turn-fold`, `context-compaction`, `assistant-meta`, `proposed-plan`, `working`, `thinking`, `worktree-setup`, `queued-message` (`:317-436`). This is pure TS with no React |
| Timeline list | `components/chat/MessagesTimeline.tsx:1276-1325` | `<LegendList>` virtualized list with `estimatedItemSize={90}`, `initialScrollAtEnd`, and `maintainScrollAtEnd` (instant, or smooth while streaming, `:374-393`), which turns off when the user reads history (`liveFollowEnabled`). Uses `[overflow-anchor:none]`, `scrollbar-gutter-both` and a top `topbar-scroll-fade` mask |
| Column width | `MessagesTimeline.tsx:1241` | Every row is `mx-auto w-full max-w-3xl`. The composer uses the same width (`chat/ComposerSurface.tsx:18`) |
| Row dispatch | `MessagesTimeline.tsx:1660-1728` `TimelineRowContent` | One wrapper per row with `data-timeline-row-kind` / `data-message-role`. Spacing depends on kind (`pb-2` for tool rows, `pb-4` for messages) |
| User message | `MessagesTimeline.tsx:2088-2090` | Right-aligned bubble: `max-w-[80%] rounded-2xl bg-message p-3`. The meta row (timestamp and copy) is `opacity-0 group-hover:opacity-100`, and always visible on touch (`pointer-coarse:opacity-100`) (`:2202`). Long messages collapse after 8 lines or 600 chars with a fade mask (`:3953-3969`) |
| Assistant message | `MessagesTimeline.tsx:2357-2400` | **No bubble**: plain full-width prose at `px-1`. The author heading is `sr-only` (`:1927`). The meta row (copy and timestamp) appears on `group-hover/assistant` (`:2438-2440`) |
| Markdown | `components/ChatMarkdown.tsx` (3 363 lines). Root at `:3299-3361` | `react-markdown` with remark `gfm`, github-alerts, list-indent normalizer, code-meta, and link/inline-code tagging (`:488-495`), plus rehype `raw` and `sanitize` (`:507-511`). The root class is `chat-markdown text-sm leading-relaxed text-foreground/80 [overflow-wrap:anywhere]` |
| Streaming parse | `markdown-incremental.ts` (107 lines) | Caches the parsed prefix up to the last *closed* fence followed by a blank line. Only the tail is re-parsed per token |
| Streaming fade | `index.css:1899-1912` | `.chat-markdown[data-streaming] > *` gets `transition: opacity 600ms` with `@starting-style{opacity:0}`, so new blocks fade in. It runs one time only, and not when an already-finished thread is opened |
| Code blocks | `ChatMarkdown.tsx:915-1028` `MarkdownCodeBlock` | A header shows the language or fence title plus icon buttons for **wrap toggle** and **copy** (check icon for 1.2 s). The block is `rounded-[var(--radius)]`, and in dark mode `bg-input/32` with no border. The wrap state goes to `data-wrap` |
| Highlighting | `ChatMarkdown.tsx:1036-1160`, `lib/syntaxHighlighting.ts` | Shiki (WASM Oniguruma, because "the JS regex engine can backtrack catastrophically", `syntaxHighlighting.ts:10-16`). One highlighter promise per language, with fallback to `text`. An LRU caches the HTML of finished blocks. While streaming it highlights incrementally to hast lines (`lib/incrementalHighlighting.ts`). A hidden plain `<pre>` holds the height until colors arrive (`:3278-3284`) |
| Inline code / file refs | `ChatMarkdown.tsx:3097-3118`, `1877-2222` | Inline code that looks like a file path becomes a **file chip**: icon plus basename, a tooltip with the full path in mono (`:2210-2219`), click to open, and a context menu |
| Inline chips | `components/composerInlineChip.ts:1-60` | Chips are sized in `em` so they scale with the surrounding text. Each kind has its own hue at equal OKLCH lightness via `--context-chip-accent` (`oklch(0.62 0.11-0.16 <hue>)`) |
| Tool calls | `MessagesTimeline.tsx:2887-2940` (group), `4781-4985` (`PlainWorkEntryRow`), `4467-4513` (`buildToolCallExpandedBody`) | One compact line per tool: 16px icon, a truncated `text-sm` label in `text-secondary-label`, a timestamp, and a chevron that rotates 90°. Clicking or pressing Enter/Space expands it to a `<pre>` (`max-h-64 font-mono text-[var(--font-size-code)] bg-muted/40 rounded-md ms-7`) that holds the command, detail, changed files and MCP JSON, with duplicates removed. The row is `role=button` with `aria-expanded`. Failures get a red icon, and only severe failures get destructive text |
| Live activity | `MessagesTimeline.tsx:3085-3099`, `index.css:466-530` | A shimmer: a masked, translated copy of the label text moves across the label (2.2 s linear). Its `animation-play-state` is tied to `--visible-animation-state` (paused unless visible), and it turns off under `prefers-reduced-motion` |
| Timeline minimap | `MessagesTimeline.tsx:1381-1610` | A strip at the right edge with one tick per turn. Clicking a tick calls `scrollToIndex` (read only in outline) |
| Composer | `components/chat/ChatComposer.tsx` (7 011 lines), `ComposerPromptEditorTiptap.tsx`, `chat/ComposerSurface.tsx` | A Tiptap rich-text editor inside a glass shell (`rounded-[22px]`, `backdrop-blur`, 1px outline in `after:`, `max-w-3xl`) that floats over the timeline. The timeline footer reserves `composerInset` px (`MessagesTimeline.tsx:365-372`) |
| Copy of a selection | `markdown-clipboard.ts` (409 lines), hooked at `MessagesTimeline.tsx:2025-2034` | An `onCopy` handler serializes the selected **rendered DOM back to Markdown** (headings, lists, fences with language, tables, links, emphasis) for `text/plain`, plus sanitized HTML for `text/html`. Chips carry `data-markdown-copy="<source>"` so they copy as their source text (`:202-203`) |
| Tooltips / hover cards | `components/ui/tooltip.tsx`, `components/ui/preview-card.tsx` | Base UI `Tooltip` and `PreviewCard` portals that open with scale 0.98 plus an opacity fade (`data-starting-style` / `data-ending-style`) |
| Theme tokens | `index.css:969-1060` (stock), `:1135-1200` (theme-id mapping), `themePalette.ts:396-440` (stock dark palette) | Semantic CSS variables (`--background`, `--card`, `--message-surface`, `--code-background`, `--muted-foreground`, `--border` …) that Tailwind maps as `--color-*` (`index.css:158-213`). Dark mode is a `.dark` custom variant. User themes and imported VS Code themes are written to `--app-theme-*` |
| Fonts / size | `appearanceFonts.ts:94-128`, `routes/__root.tsx:287-315`, `packages/contracts/src/settings.ts:121-146` | Settings write `html.style.fontSize` (interface size 12–20 px, default 16; all rem values scale with it) plus `--font-size-prompt` (12–20, default 14) and `--font-size-code` (10–18, default 13). Font families go to `--font-sans`, `--font-mono` and `--font-composer`. Includes a `-webkit-font-smoothing` toggle |

## 3. The owner's five wishes (a)–(e)

| Wish | Exists? | What t3code does | Where |
|---|---|---|---|
| (a) Clean, copyable, well-formatted text | **Yes, strongly** | (1) An assistant message is bubble-less prose, `text-sm leading-relaxed`, `text-foreground/80`, with `overflow-wrap:anywhere` and a tight markdown stylesheet: 0.65rem block rhythm, h1 1.25rem, and inline code as a bordered pill at 0.75rem. (2) Code blocks have copy and wrap buttons. (3) A per-message copy button appears on hover. (4) **Selecting and copying yields Markdown source, not flattened text.** (5) Tables can be copied as MD or CSV (`serializeTableElementToCsv`) | `index.css:1656-1957`; `ChatMarkdown.tsx:915-1028`; `MessagesTimeline.tsx:2421-2485`; `markdown-clipboard.ts:337-409` |
| (b) Pure black background | **Partly.** The stock chat canvas is `#0a0a0a`, not `#000` | Stock dark: `--background: neutral-950` (`index.css:1037`). The theme palette canvas is `#0a0a0a`, surfaces `#111111`, border `#191919`, message bubble `#141414` (`themePalette.ts:396-440`). **Only the sidebar is `#000`** (`index.css:1082`, `themePalette.ts:~440` `sidebar: "#000000"`). A user theme can set the canvas to `#000` (`themePalette.ts:1050-1051`: setting `canvas` also sets `chrome` and `toolbar`). There is a subtle SVG grain overlay on `body` (`index.css:1573-1591`). Surfaces are built as `color-mix(bg 97%, white)`, so black gets tinted instead of gray-filled |
| (c) Hoverable inline IDs/entities with a summary popover | **Yes, for PR links. Tooltip only for file paths** | `PullRequestLinkPreview`: a Base UI `PreviewCard` with 350 ms open delay and 120 ms close delay. **The data is fetched only when the card opens** (`useEnvironmentQuery(open ? … : null)`). The card is `w-80 p-3` and shows repo #num · state icon, the title, and avatar · author · "opened 3d ago". Inline-code file paths become chips with a full-path mono tooltip. Citation chips (`AssistantCitationChip.tsx`) use Tooltip and Popover | `components/pullRequest/PullRequestLinkPreview.tsx:20-119`; `components/ui/preview-card.tsx`; `ChatMarkdown.tsx:2161-2220`, `:3056` |
| (d) Adjustable text size | **Yes**, as three independent sliders in Settings → Appearance | Interface size sets the root `font-size`, so all rem values scale. Prompt and code sizes are absolute px CSS variables so they do not scale twice. The values are clamped. **No Cmd +/- zoom for the chat was found**; the only zoom in the code is the embedded browser preview (`packages/contracts/src/preview.ts:131`) | `appearanceFonts.ts:94-150`; `index.css:1597-1605`; `SettingsPanels.tsx:1537-1563` |
| (e) Modern "GUI coding agent" look | **Yes** | A centered `max-w-3xl` column. User turns in right-aligned `rounded-2xl` bubbles, the agent as plain prose. Tool calls as quiet one-line rows with icon, label and chevron that expand to mono detail, grouped per turn with a fold toggle. A shimmer on the live row. A floating glass composer (`rounded-[22px]`, blur). Hover-revealed meta rows. A minimap. Stepped status animations to limit compositor work (`index.css:212-257`) | sections above |

## 4. Dependencies the chat UI relies on (`apps/web/package.json`, versions resolved from `pnpm-lock.yaml`)

- `react` / `react-dom` 19.2.6, with `babel-plugin-react-compiler` 1.0.0
- `tailwindcss` / `@tailwindcss/vite` 4.3.3, `tailwind-merge` 3.6.0, `class-variance-authority` 0.7.1
- `@base-ui/react` 1.5.0 (Tooltip, PreviewCard, Popover, Menu, Collapsible, ScrollArea)
- `react-markdown` 10.1.0, `remark-gfm` 4.0.1, `remark-breaks` ^4.0.0, `rehype-raw` 7.0.0, `rehype-sanitize` 6.0.0, `hast-util-to-html` ^9.0.5, `hast-util-to-jsx-runtime` ^2.3.6, `unified` ^11 (dev)
- Shiki 4.2.0, pulled in through `@pierre/diffs` 1.3.0-beta.10 (`getSharedHighlighter`, WASM engine), plus `@shikijs/transformers` 4.2.0
- `@legendapp/list` 3.3.5, patched locally (`patches/`) — virtualized timeline
- `@tiptap/*` 3.31.3 (composer), `lucide-react` 0.564.0 (icons), `zustand` 5.0.14, `@formkit/auto-animate` 0.9.0, `effect` 4.0.0-rc.115 (state/RPC)
- `culori` ^4.0.2 (theme color math)

## 5. The most transferable patterns for claude-fleet's vanilla TS client, ranked by value

Constraint (verified in `claude-fleet/src/md.ts:1-21`): fleet's renderer promises **no innerHTML, only createElement and textContent**,
and `fleet-e2e-security.ts §7` asserts this. Every item below is judged against that rule.

1. **Copy-as-Markdown selection serializer.** Copy `markdown-clipboard.ts` (409 lines, pure DOM, no React). Hook `copy` on the
   chat container, call `serializeRenderedMarkdownFragment`, and write `text/plain`. Add `data-markdown-copy` to chips and code headers.
   Note: `sanitizedHtmlFrom` uses `container.innerHTML` to build the `text/html` flavor. Put the serializer outside
   `md.ts`, or drop the HTML flavor, to keep the §7 invariant. Effort: **S (2–4 h)**. Serves (a).
2. **Semantic dark token set, with pure black as a one-line override.** Adapt `index.css:969-1060` plus `themePalette.ts:396-440`
   into ~25 `:root` variables (`--background`, `--card`, `--message-surface`, `--code-background`, `--border`,
   `--muted-foreground` …). For (b), set `--background:#000` and derive surfaces with `color-mix(in srgb, var(--background) 97%, white)`,
   as t3code does. Effort: **S (2–3 h)**. Serves (b) and (e).
3. **Three-variable text-size model.** Adapt `appearanceFonts.ts:94-150` and `index.css:1597-1605`: root `font-size` for UI
   scale, plus `--font-size-code` / `--font-size-prompt` in px, clamped (12–20 / 10–18), persisted in localStorage. Adding a
   Cmd/Ctrl +/- handler would go beyond what t3code has. Effort: **S (1–2 h)**. Serves (d).
4. **Markdown stylesheet for `.chat-markdown`.** Take `index.css:1656-1957` nearly verbatim: block rhythm, heading scale,
   pill inline code, dotted-underline links, compact tables with truncate/expand, and the `@starting-style` streaming fade.
   Pure CSS that works with fleet's existing `mdInto` if class names are mapped. Effort: **S (1–3 h)**. Serves (a) and (e).
5. **Code-block chrome.** Build `ChatMarkdown.tsx:915-1028` again as plain DOM: a header with language plus wrap and copy icon buttons,
   `data-wrap` toggling `white-space:pre-wrap`, and a check icon for 1.2 s. Effort: **S (2 h)**. Serves (a).
6. **Hover summary card for inline IDs** (task ids, slot ids, SHAs, branches). Pattern from `PullRequestLinkPreview.tsx:20-119`
   plus `ui/preview-card.tsx`: a 350 ms open delay, 120 ms close delay, **a fetch only when the card opens**, a `w-80 p-3` card
   (meta line, title, footer), and a scale 0.98 plus opacity transition. In vanilla TS: one shared portal element positioned
   with `getBoundingClientRect`, delegated `pointerover` on `[data-entity]`, an AbortController per open, and a small LRU.
   Detecting IDs means a text-node pass in `md.ts` that emits `<span data-entity=…>` via createElement. Effort: **M (1–2 days)**. Serves (c).
7. **Tool-call row pattern.** Adapt `MessagesTimeline.tsx:4781-4985` and `buildToolCallExpandedBody` `:4467-4513`. Each row is one line
   (icon, truncated label, timestamp, rotating chevron) with role=button and aria-expanded, and expands to a mono `<pre>`
   with `max-h-64 overflow-auto` and duplicate content removed. Group per turn with a fold toggle. Effort: **M (1 day)**, depending on
   how fleet parses tool calls from pane or transcript data. Serves (e).
8. **Layout grammar.** A `max-w-3xl` centered column (`MessagesTimeline.tsx:1241`). User messages in a right-aligned `rounded-2xl` bubble
   with `max-w-[80%]`. The assistant as plain prose. Meta rows at `opacity-0` that appear on hover or `pointer: coarse`. Collapse user messages over 8 lines
   with a fade mask (`:3953-3969`). Effort: **S (2–3 h)**. Serves (e).
9. **Scroll behavior without a virtualizer.** Stick to the bottom only while the user is at the end (a threshold of about 1px),
   show a "Scroll to end" pill otherwise (`ChatView.tsx:9949-9970`), and add a composer-height footer spacer. LegendList
   is React-only. For fleet transcript sizes, `content-visibility:auto` on rows is a cheaper stand-in
   (this is my inference, not something t3code does). Effort: **S–M (0.5 day)**.
10. **Shiki highlighting.** `lib/syntaxHighlighting.ts` is small, but Shiki's `codeToHtml` output conflicts with the
    no-innerHTML rule. The compatible route is `codeToTokens` and building a span per token with createElement. It adds a WASM
    dependency of about 1 MB or more to the bundle (inferred, not measured). Effort: **M (1 day)**. Lowest value per cost.

Not transferable as-is: Tiptap composer, Base UI primitives, react-markdown pipeline, LegendList, react-compiler. All are
React-bound. Rebuild their behavior; do not port them.

## 6. Verified vs inferred

- **Verified (read):** LICENSE; `apps/web/package.json`; `pnpm-workspace.yaml:30-60`; lockfile version lines; `index.css`
  1-420, 460-530, 960-1200, 1334-1380, 1531-1957, 2045-2075; `themePalette.ts:325-440, 1035-1060`; `appearanceFonts.ts:1-160`;
  `packages/contracts/src/settings.ts:115-150`; `routes/__root.tsx:285-315`; `markdown-incremental.ts` (full);
  `markdown-clipboard.ts` 1-120, 181-270, 327-409; `lib/syntaxHighlighting.ts` 1-39; `ChatMarkdown.tsx` outline, 488-511,
  915-1160, 2130-2222, 3090-3140, 3250-3363; `MessagesTimeline.tsx` outline, 334-475, 1239-1350, 1660-1728, 1925-1931,
  2088-2215 (classes via grep), 2357-2510, 2887-2940, 3085-3100, 4457-4520, 4752-4985; `MessageCopyButton.tsx`,
  `FileTagChip.tsx`, `ui/tooltip.tsx`, `ui/preview-card.tsx`, `PullRequestLinkPreview.tsx` (full); `composerInlineChip.ts:1-60`;
  `ComposerSurface.tsx:1-80`; `ChatView.tsx:9945-9975`; `SettingsPanels.tsx:1530-1563`; `MessagesTimeline.logic.ts` 175-182, 317-436 (kinds via grep), 492-505, 941-960.
- **Inferred (not checked by reading):** that the minimap works as the summary says (read only its signature); the effect of Shiki
  WASM on bundle size; `content-visibility` as a replacement for LegendList; the effort estimates.

## 7. What I did not read

- `ChatView.tsx` apart from lines 9945-9975 (10k lines: scroll-mode state machine, thread switching, composer overlay math).
- `ChatComposer.tsx` (7k lines) and `ComposerPromptEditorTiptap.tsx` apart from one grep hit. Composer behavior (slash menu,
  mentions, stash, history) is not mapped.
- `ChatMarkdown.tsx` `useChatMarkdownState` (2250-2727), link renderer body (2734-3090), images and media (1297-1700), tables
  component (701-830), GitHub alerts rendering.
- `MessagesTimeline.tsx` minimap body, reasoning/thinking rows (2680-2843), agent spawn rows, user-message context chips
  (3412-3950), `ExpandedWorkGroupEntries`.
- `lib/incrementalHighlighting.ts`, `hooks/useCopyToClipboard.ts` (except grep), `ui/anchoredCopyToast.ts`,
  `pageScrollController.ts` beyond line 40, `AssistantCitationChip.tsx` beyond line 50, `AssistantSelectionToolbar.tsx`.
- The theme editor and VS Code theme import (`components/settings/Theme*`, `vscodeThemeImport.ts`, `openVsxThemes.ts`).
- `apps/mobile`, `apps/desktop` (beyond one zoom grep), `apps/server`, `packages/client-runtime` (work-log label logic that feeds tool rows).
- I did not run the app, so no rendered screenshots. Everything visual above comes from class names and CSS, not from pixels.
