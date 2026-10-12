import { resolve } from "node:path";

// FLEET_STATE_DIR: where the server keeps fleet.json, its lock, streams/ and every ledger. Unset (or
// empty), it is the directory of server.ts — the same absolute string as before the variable existed,
// so every path built on it is byte-identical. A relative value resolves against the working directory.
export const STATE_DIR = process.env.FLEET_STATE_DIR ? resolve(process.env.FLEET_STATE_DIR) : resolve(import.meta.dir, "..");
