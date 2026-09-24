import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { FORGE_AGENT_STEP_STATUSES, FORGE_AGENT_STEP_TYPES, FORGE_AGENT_TOOL_NAMES } from "../lib/forge/step-contract";

function migrationSql() {
  return fs.readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => fs.readFileSync(path.join("supabase/migrations", name), "utf8"))
    .join("\n");
}

function latestAllowedValues(sql: string, column: "type" | "status" | "tool") {
  const createTable = sql.match(
    /create table if not exists public\.forge_agent_steps\s*\(([\s\S]*?)\n\);/i,
  )?.[1];
  if (!createTable) throw new Error("forge_agent_steps creation contract was not found in ordered migrations.");
  const contractSql = column === "tool" ? sql : createTable;
  const expressions = [...contractSql.matchAll(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]+)\\)`, "gis"))];
  const latest = expressions.at(-1)?.[1];
  if (!latest) throw new Error(`Effective CHECK for ${column} was not found in ordered migrations.`);
  return [...latest.matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

test("effective Forge step migrations persist every canonical type, status and tool", async () => {
  const sql = migrationSql();
  const types = latestAllowedValues(sql, "type");
  const statuses = latestAllowedValues(sql, "status");
  const tools = latestAllowedValues(sql, "tool");
  assert.deepEqual([...types].sort(), [...FORGE_AGENT_STEP_TYPES].sort());
  assert.deepEqual([...statuses].sort(), [...FORGE_AGENT_STEP_STATUSES].sort());
  assert.deepEqual([...tools].sort(), [...FORGE_AGENT_TOOL_NAMES].sort());

  const quoted = (values: readonly string[]) => values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",");
  const db = new PGlite();
  await db.exec(`create table forge_agent_steps_contract (
    step_number integer not null check (step_number between 1 and 60),
    type text not null check (type in (${quoted(types)})),
    summary text not null check (length(summary) <= 1000),
    tool text check (tool is null or tool in (${quoted(tools)})),
    input jsonb not null check (jsonb_typeof(input) = 'object'),
    result_summary text check (result_summary is null or length(result_summary) <= 20000),
    status text not null check (status in (${quoted(statuses)}))
  )`);

  let step = 1;
  for (const type of FORGE_AGENT_STEP_TYPES) {
    await db.query("insert into forge_agent_steps_contract values ($1,$2,$3,$4,$5,$6,$7)", [step++, type, `type:${type}`, null, {}, null, "COMPLETED"]);
  }
  for (const status of FORGE_AGENT_STEP_STATUSES) {
    await db.query("insert into forge_agent_steps_contract values ($1,$2,$3,$4,$5,$6,$7)", [step++, "TOOL_CALL", `status:${status}`, "read_file", {}, null, status]);
  }
  for (const tool of FORGE_AGENT_TOOL_NAMES) {
    await db.query("insert into forge_agent_steps_contract values ($1,$2,$3,$4,$5,$6,$7)", [step++, "TOOL_CALL", `tool:${tool}`, tool, {}, null, "RUNNING"]);
  }
  const count = await db.query<{ count: string }>("select count(*)::text as count from forge_agent_steps_contract");
  assert.equal(Number(count.rows[0]?.count), FORGE_AGENT_STEP_TYPES.length + FORGE_AGENT_STEP_STATUSES.length + FORGE_AGENT_TOOL_NAMES.length);
  await assert.rejects(() => db.query("insert into forge_agent_steps_contract values (60,'TOOL_CALL','bad','unknown_tool','{}',null,'RUNNING')"), /check constraint/i);
  await db.close();
});
