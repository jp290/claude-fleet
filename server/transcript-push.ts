// THE CHAT IS TOLD WHEN ITS TRANSCRIPT GREW (Neuaufbau K10 S2, docs/neuaufbau/befunde/08-chat-ansicht.md).
// The chat view asked GET /transcript once a second, so a line Claude Code had written waited up to that
// second, plus the read (measured 13.10. on a real Claude pane, 12 answers: in the chat p50 559 ms, p90 865 ms
// after their transcript line; with the push p50 80 ms, p90 102 ms — befunde/08, S2).
// Now the server counts the transcript of every slot an owner's pane socket is open on, on the stream's
// 100 ms tick, and sends that socket one text frame when the count of complete lines moved:
// {"t":"transcript","lines":N}. The chat fetches right then. Only a socket that asked on connect (`push=1`)
// hears it: every other reader of /ws — a guest's terminal, a tool, a check — takes each frame as terminal
// bytes. A socket gets the count once it is seeded (`ready`), so a fresh one hears where the file stands.
// A leaf like live-state.ts: server.ts hands in the slots and how to count.
export interface PushSocket { data: { ready: boolean; push?: boolean; pushed?: number }; send(message: string): unknown }
export interface PushSlot { id: number; clients: Iterable<PushSocket> }
export interface PushDeps {
  // the occupied slots whose transcript the chat reads
  slots(): Iterable<PushSlot>;
  // complete lines in the slot's transcript now; null = none (server/live-state.ts#createLiveReader count)
  count(slot: number): Promise<number | null>;
}
export const transcriptFrame = (lines: number): string => JSON.stringify({ t: "transcript", lines });

export function createTranscriptPush(deps: PushDeps) {
  let running = false;
  return {
    // one pass; a pass still reading when the next tick comes is not doubled
    async tick(): Promise<void> {
      if (running) return;
      running = true;
      try {
        await Promise.all([...deps.slots()].map(async (s) => {
          const owners = [...s.clients].filter((ws) => ws.data.ready && ws.data.push === true);
          if (!owners.length) return;
          let n: number | null;
          // a file that vanished between stat and open: the next tick reads again
          try { n = await deps.count(s.id); } catch { return; }
          if (n === null) return;
          for (const ws of owners) {
            if (ws.data.pushed === n) continue;
            ws.data.pushed = n;
            ws.send(transcriptFrame(n));
          }
        }));
      } finally { running = false; }
    },
  };
}
