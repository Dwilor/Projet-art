import { DatabaseSync, backup } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const data = resolve(process.env.DATA_DIR || ".data");
await mkdir(resolve(data, "backups"), { recursive: true });
const db = new DatabaseSync(resolve(data, "sirius.sqlite"));
const target = resolve(
  data,
  "backups",
  `sirius-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
await backup(db, target);
db.close();
const check = new DatabaseSync(target, { readOnly: true });
if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw new Error("La sauvegarde est invalide.");
check.close();
console.log("Sauvegarde SQLite créée et intégrité vérifiée.");
