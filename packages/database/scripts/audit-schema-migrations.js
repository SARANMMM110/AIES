/**
 * Compare Prisma schema scalar/enum fields vs SQL migrations (handles multi-line ADD COLUMN).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migDir = path.join(root, "prisma/migrations");

let allSql = "";
for (const d of fs.readdirSync(migDir).sort()) {
  const p = path.join(migDir, d, "migration.sql");
  if (fs.existsSync(p)) allSql += fs.readFileSync(p, "utf8") + "\n";
}

const enums = new Set([...schema.matchAll(/^enum\s+(\w+)/gm)].map((m) => m[1]));
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm)].map((m) => {
  const name = m[1];
  const body = m[2];
  const map = (body.match(/@@map\("([^"]+)"\)/) || [])[1] || name;
  const fields = [];
  for (const line of body.split("\n")) {
    if (line.includes("@relation") || line.trim().startsWith("@@")) continue;
    const fm = line.match(/^\s+([a-zA-Z_][\w]*)\s+(\S+)/);
    if (!fm) continue;
    const type = fm[2].replace("?", "").replace(/\[\]$/, "").replace(/@.*/, "");
    if (fm[2].includes("[]")) continue;
    const base = type.split("(")[0];
    if (
      ["String", "Int", "Boolean", "DateTime", "Float", "Json", "BigInt", "Decimal"].includes(
        base
      ) ||
      enums.has(base)
    ) {
      fields.push(fm[1]);
    }
  }
  return { name, map, fields };
});

const tableCols = {};
function addCol(t, c) {
  tableCols[t] = tableCols[t] || new Set();
  tableCols[t].add(c);
}

for (const m of allSql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"([^"]+)"\s*\(([\s\S]*?)\)\s*;/g)) {
  const t = m[1];
  for (const c of m[2].matchAll(/^\s+"([^"]+)"/gm)) addCol(t, c[1]);
}

// Multi-line: ALTER TABLE "x" ADD COLUMN "a" ..., ADD COLUMN "b" ...
for (const m of allSql.matchAll(/ALTER TABLE\s+"([^"]+)"([\s\S]*?);/g)) {
  const t = m[1];
  const chunk = m[2];
  for (const c of chunk.matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+"([^"]+)"/g)) {
    addCol(t, c[1]);
  }
}

const report = [];
for (const model of models) {
  const cols = tableCols[model.map];
  if (!cols) {
    report.push({ type: "TABLE", table: model.map, model: model.name });
    continue;
  }
  for (const f of model.fields) {
    if (!cols.has(f)) report.push({ type: "COLUMN", table: model.map, column: f, model: model.name });
  }
}

console.log(JSON.stringify(report, null, 2));
console.log("Missing:", report.length);
fs.writeFileSync(path.join(__dirname, "audit-out.json"), JSON.stringify(report, null, 2));
