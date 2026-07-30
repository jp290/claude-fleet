// src/demo.ts — the public replay demo's bundle entry.
//
// Two side-effect imports, and the ORDER IS THE WHOLE DESIGN: ES module bodies execute in import
// order, so the transport stubs are installed before the first line of the real client runs, and
// the client then finds fixtures where it expects a server. Nothing else is different — this
// bundle contains the same src/client.ts the dashboard ships, unmodified.
//
// The order is not taken on trust: the Playwright pass in demo/README.md asserts that the loaded
// page issues NO request other than the fixture loads. If these imports were ever reordered, the
// client would reach for the real /api/sessions and that assertion is what would fail.
import "./demo-transport";
import "./client";
