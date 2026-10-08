// Deletes the e2e SQLite database (and its WAL/SHM side files) so each
// Playwright run starts from an empty store. Usage: node e2e/reset-db.mjs <path>
import { rmSync } from "node:fs";

const path = process.argv[2];
if (!path || path === ":memory:") process.exit(0);
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  rmSync(`${path}${suffix}`, { force: true });
}
