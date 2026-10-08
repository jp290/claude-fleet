// THE INFO COLUMN'S OWN STYLE (card 8b90d2fe, Live-Runde 2 "rechter Tab", 2026-10-08): the lanes'
// land lines, the diamond of a running check, the opened lane as one unit with its timeline, and the
// wider column. It lives here, bundled into app.js and hung into <head> once by
// src/board.ts#initBoard, while public/index.html belongs to the sidebar's row 43913fd6 — after that
// land it may move back. Tokens only (grammatik G0.1): every colour is a --chat-*/state token of the
// board's :root, no literal.
export const INFOSTIL = `
  /* a little wider (owner 2026-10-08: „[Zitat entfernt]“
     ) — a lane's name, its git stand, its square and its flag fit one row */
  body #board { width: 400px; }
  /* the Ranke's rail: a level step wide enough that the bend from the target branch to a lane is a
     line one can read as dashed or solid, and a diamond fits on it */
  #board .ranke { --rk-lvl: 22px; --rk-rail: 52px; --rk-ret: 24px; }
  /* THE WAY BACK (owner 2026-10-08 ~21:4x): a margin right of the rows for the rails — each lane runs on
     past its row's end into it and joins its target's rail, which climbs to the target's row */
  #board .ranke .rk { padding-right: var(--rk-ret); }
  /* the lines lie over a row's ground (an opened or focused row has one) and under its node */
  #board .ranke .rk > svg { z-index: 1; }
  #board .ranke .zr > .nd { z-index: 2; }
  #board .ranke .rk > svg path.t { stroke: var(--c-edge-hi); }
  #board .ranke .rk > svg path.wait { stroke: var(--chat-mute); stroke-dasharray: 3 2.5; }
  #board .ranke .rk > svg path.land { stroke: var(--chat-mute); }
  #board .ranke .rk > svg path.fork { stroke: var(--chat-mute); }
  #board .ranke .rk > svg path.wait.i, #board .ranke .rk > svg path.land.i, #board .ranke .rk > svg path.t.i,
  #board .ranke .rk > svg path.fork.i { stroke: var(--chat-ink); }
  /* THE NEXT HEAD of a target: the dot its rail hangs from, at the end of the target's own line — a ring
     while lanes wait to land there, filled ink once all have (G0.2: a node, like the lanes') */
  #board .zr > .zhead { position: absolute; z-index: 2; width: 7px; height: 7px; border-radius: 50%; transform: translate(-50%, -50%);
    background: var(--chat-mute); }
  #board .zr > .zhead.next { background: var(--chat-void); box-shadow: inset 0 0 0 1.25px var(--chat-mute); }
  /* THE DIAMOND on a lane's way back while one of its checks runs (owner 2026-10-08, ~14:0x: „[Zitat entfernt]“
     , ~21:4x: on the right, the line back to main behind it):
     filled ink runs, an ink ring waits (G0.2) — centred between the row's end and the rail */
  #board .zr > .lgate { position: absolute; z-index: 2; width: 26px; height: 26px; padding: 0; border: 0; background: none;
    left: 0; top: 50%; transform: translate(-50%, -50%); display: grid; place-items: center; cursor: pointer; border-radius: var(--r1); }
  /* until drawRankeLines has measured the line it belongs on, a diamond is not shown */
  #board .zr > .lgate:not([data-placed]) { visibility: hidden; }
  #board .zr > .lgate > i { display: block; width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg);
    background: var(--chat-void); box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board .zr > .lgate[data-gate="run"] > i { background: var(--chat-ink); box-shadow: none; }
  #board .zr > .lgate[aria-expanded="true"] > i { outline: 1px solid var(--chat-ink); outline-offset: 2px; }
  #board .zr > .lgate:focus-visible { outline: 1px solid var(--chat-mute); outline-offset: -2px; }
  /* the check after the land at its repo's main: the same diamond at the stem's end */
  #board .zr.base .rt .mgate { display: inline-grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; background: none;
    cursor: pointer; border-radius: var(--r1); }
  #board .zr.base .rt .mgate > i { display: block; width: 8px; height: 8px; border-radius: 1px; transform: rotate(45deg);
    box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board .zr.base .rt .mgate[data-gate="run"] > i { background: var(--chat-ink); box-shadow: none; }
  #board .zr.base .rt .mgate[aria-expanded="true"] > i { outline: 1px solid var(--chat-ink); outline-offset: 2px; }
  /* the test instance's line inside the unit: the unit's dot is its square */
  #board .zu .zd.ti { padding-left: 0; min-height: 0; }
  #board .zu .zd.ti > .tx > .sq { display: none; }
  /* the lane that is trying to land right now: its name in ink — its bend is drawn in ink too */
  #board .zr.zw.landing .nm { color: var(--chat-ink); }
  /* what the diamond says when tapped: where the check stands and on which machine */
  #board .zd.gate { display: block; min-height: 0; margin: 2px 0 6px calc(var(--rk-rail) + var(--rk-ref) + 8px); padding: 7px 10px;
    border-radius: var(--r2); background: var(--chat-raised); border: 1px solid var(--chat-edge); color: var(--chat-prose);
    font-size: var(--chat-ui-fs); line-height: 1.5; white-space: normal; }
  #board .zd.gate .gl { display: grid; grid-template-columns: 13px minmax(0, 1fr); align-items: baseline; }
  #board .zd.gate .gl > .gx { min-width: 0; }
  #board .zd.gate .gl .gx > * + * { margin-left: 6px; }
  #board .zd.gate .gl + .gl { margin-top: 2px; }
  #board .zd.gate .gd { align-self: start; margin-top: 6px; width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg);
    box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board .zd.gate .gl[data-gate="run"] .gd { background: var(--chat-ink); box-shadow: none; }
  #board .zd.gate b { color: var(--chat-ink); font-weight: 500; }
  #board .zd.gate .w { font-variant-numeric: tabular-nums; }
  #board .zd.gate .dv { display: inline-flex; align-items: center; gap: 4px; color: var(--chat-ink); }
  #board .zd.gate .dv .ico { width: 12px; height: 12px; }
  #board .zd.gate .mono { font: 10.5px var(--chat-mono); color: var(--chat-mute); }
  #board .zd.gate .q { color: var(--chat-faint); }
  /* the flag says a RESULT only now — that a check runs is the diamond's */
  /* THE OPENED LANE AS ONE UNIT (owner-Ja plan step 2 of lane 4A): one timeline from its start to
     its land, a thin rule through dots; the step still ahead is a ring, its rule dashed like the
     lane's bend while it waits */
  #board .zu { position: relative; margin: 2px 0 8px calc(var(--rk-rail) + var(--rk-ref) + 8px); padding-left: 16px; }
  #board .zu > .ev { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; align-items: baseline;
    padding: 3px 0; font-size: var(--chat-ui-fs); line-height: 1.4; color: var(--chat-prose); }
  #board .zu > .ev::before { content: ""; position: absolute; left: -13px; top: 0; bottom: 0; width: 1px; background: var(--c-edge-hi); }
  #board .zu > .ev:first-child::before { top: 9px; }
  #board .zu > .ev:last-child::before { bottom: auto; height: 9px; }
  #board .zu > .ev.next::before { background: none; border-left: 1px dashed var(--chat-mute); }
  #board .zu > .ev:last-child.next::before { height: 9px; }
  #board .zu > .ev > .dot { position: absolute; left: -16px; top: 7px; width: 7px; height: 7px; border-radius: 50%; z-index: 1;
    background: var(--chat-void); box-shadow: inset 0 0 0 1.25px var(--chat-mute); }
  #board .zu > .ev[data-st="ok"] > .dot { background: var(--q-live); box-shadow: none; }
  #board .zu > .ev[data-st="bad"] > .dot { background: var(--danger); box-shadow: none; }
  #board .zu > .ev[data-st="run"] > .dot { border-radius: 1px; transform: rotate(45deg) scale(.9); background: var(--chat-ink); box-shadow: none; }
  #board .zu > .ev[data-st="queue"] > .dot { border-radius: 1px; transform: rotate(45deg) scale(.9); box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board .zu > .ev[data-st="old"] > .dot { box-shadow: inset 0 0 0 1.25px var(--chat-faint); }
  #board .zu > .ev[data-st="unk"] > .dot { box-shadow: inset 0 0 0 1.25px var(--amber); }
  #board .zu > .ev[data-st="ti"] > .dot { border-radius: 2px; background: var(--q-live); box-shadow: none; }
  #board .zu > .ev[data-st="tioff"] > .dot { border-radius: 2px; }
  #board .zu > .ev.next { color: var(--chat-mute); }
  #board .zu > .ev > .x { min-width: 0; overflow-wrap: anywhere; }
  #board .zu > .ev > .t { font: 10.5px var(--chat-mono); color: var(--chat-faint); white-space: nowrap; font-variant-numeric: tabular-nums; }
  #board .zu > .ev .sub { display: block; color: var(--chat-mute); }
  #board .zu > .ev .sub .mono, #board .zu > .ev .mono { font: 10.5px var(--chat-mono); }
  #board .zu > .ev .bad { color: var(--danger); }
  #board .zu > .ev .dv { display: inline-flex; align-items: center; gap: 3px; vertical-align: -2px; margin-left: 4px; color: var(--chat-mute); }
  #board .zu > .ev .dv .ico { width: 11px; height: 11px; }
  #board .zu > .ev > .more { grid-column: 1 / -1; min-width: 0; }
  #board .zu > .ev .acts { display: flex; gap: 6px; flex-wrap: wrap; margin: 5px 0 2px; }
  #board .zu > .ev .err { display: block; color: var(--danger); }
  /* the moved Changes and History inside the unit: no section frame of their own */
  #board .zu .bsec.inlane { margin: 2px 0 0; padding: 0; border: 0; }
  #board .zu .bsec.inlane .bbtnrow { margin-top: 4px; }
  /* the rows' hover bleed (6 px either side) would run past the column's edge inside the unit */
  #board .zu .brow, #board .zu .bfile, #board .zu .buncf { width: 100%; margin: 0; }
  /* …and nothing in the Arbeitsorte runs out under an ellipsis: a commit's subject, a file's path wrap */
  #board .zu .brow .bsub, #board .zu .buncf .p { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
  /* the fold of quiet branches, open: its chevron points down */
  #board .zr.zf.auf .fc .ico { transform: none; }
  /* a mirrored worktree: read only — a step quieter, and every write button stands greyed */
  #board .zr.zw.mirror .ref { color: var(--chat-faint); }
  #board .zu.mirror .rk-btn, #board .zu.mirror .bbtn { opacity: .45; }
  /* the land lines and the diamond, explained on demand (behind the ? of the Projekte head) */
  #board .rklegend .lgl .lgk { display: inline-flex; align-items: center; gap: 6px; color: var(--chat-prose); }
  #board .rklegend .lgk svg { width: 22px; height: 8px; overflow: visible; }
  #board .rklegend .lgk svg path { fill: none; stroke: var(--chat-mute); stroke-width: 1; }
  #board .rklegend .lgk svg path.wait { stroke-dasharray: 3 2.5; }
  #board .rklegend .lgk i { width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg); display: inline-block;
    box-shadow: inset 0 0 0 1.5px var(--chat-ink); margin: 0 7px; }
  #board .rklegend .lgk i.run { background: var(--chat-ink); box-shadow: none; }
  /* a lane the board does not draw, whose check runs: a pale row, its way back and diamond like any lane's */
  #board .zr.zw.ghost .nm, #board .zr.zw.ghost .ref { color: var(--chat-faint); }
  /* a check that found no lane: one quiet line under Geräte, never a block */
  #board .zd.loose { display: block; min-height: 0; margin: 4px 0 0; padding-left: calc(var(--rk-rail) + 14px); text-indent: -14px;
    color: var(--chat-mute); font-size: var(--chat-ui-fs); line-height: 1.45; white-space: normal; }
  #board .zd.loose > * + * { margin-left: 6px; }
  #board .zd.loose .who { color: var(--chat-prose); }
  #board .zd.loose > .gd { display: inline-block; text-indent: 0; width: 7px; height: 7px; margin-right: 1px; border-radius: 1px;
    transform: rotate(45deg); background: var(--chat-ink); }
  #board .zd.loose[data-gate="queue"] > .gd { background: none; box-shadow: inset 0 0 0 1.5px var(--chat-ink); }
  #board .zd.loose .dv { display: inline-flex; align-items: center; gap: 3px; text-indent: 0; }
  #board .zd.loose .dv .ico { flex: none; width: 11px; height: 11px; }
  @media (max-width: 700px), ((pointer: coarse) and (max-height: 500px)) {
    #board .ranke { --rk-ret: 34px; }
    #board .zr > .lgate { width: 40px; height: 40px; }
    #board .zd.gate, #board .zu { margin-left: calc(var(--rk-rail) + 4px); }
    #board .zu > .ev { padding: 6px 0; }
    #board .zu > .ev > .dot { top: 10px; }
  }
`;
