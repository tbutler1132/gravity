// Checks the project against its own grammar.
//
// Two layers. The first is schema.yaml itself: every record must be a
// valid instance of its type. The second is the rules JSON Schema
// cannot express — that a major cites a Post that already existed,
// that a Week has exactly one Release, that no Week in the sequence
// was skipped. Those are the interesting ones, because they are the
// ones that catch drift rather than typos.
//
// Writes codex.json: every record, normalized, in one file. Generated,
// never hand-edited, rebuildable offline from a clone.
//
// codex.json is not committed. Its content depends on the merge commit
// that would contain it, so a checked-in copy is stale the moment any
// Change lands and cannot be made fresh in the PR that adds it. What
// matters for ownership is that it rebuilds offline from a clone, not
// that it sits in the tree.

import { writeFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import { load, loadSchema, GRAMMAR_EPOCH } from "./load.mjs";

const OUT = "codex.json";
const errors = [];
const notes = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const schema = loadSchema();
const codex = load();

// Fields the loader adds for its own use. They are not part of the
// grammar, so they are stripped before validating and before output.
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));

// --- layer 1: every record is a valid instance of its type ------------
const ajv = new Ajv({ strict: false, allErrors: true });
for (const [type, records] of Object.entries(codex)) {
  const validate = ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, $ref: `#/$defs/${type}` });
  for (const rec of records) {
    // Changes that predate the grammar are recorded, not judged.
    if (rec._pre_grammar) continue;
    if (!validate(strip(rec))) {
      const where = `${type} ${rec.id ?? rec._sha ?? "?"}`;
      for (const e of validate.errors) fail(where, `${e.instancePath || "/"} ${e.message}`);
    }
  }
}

// --- layer 2: the rules a schema cannot hold --------------------------
const posts = new Map(codex.Post.map((p) => [p.id, p]));
const weeks = new Set(codex.Week.map((w) => w.id));
const live = codex.Change.filter((c) => !c._pre_grammar);

// A major ships only after its Post is published. Not merely cited —
// published in the same Week or an earlier one. This is the gate from
// 0002, and it is the one rule that can be satisfied on paper and
// still violated in practice, so it is checked against the calendar.
for (const c of live) {
  if (c.magnitude !== "major") continue;
  const post = posts.get(c.post);
  if (!post) {
    fail(`Change ${c.id}`, `major cites Post ${c.post}, which does not exist`);
  } else if (post.week > c._week) {
    fail(`Change ${c.id}`, `major in ${c._week} cites Post ${c.post} from ${post.week} — the Post has to come first`);
  }
}

const seen = new Set();
for (const c of live) {
  if (seen.has(c.id)) fail(`Change ${c.id}`, "duplicate id");
  seen.add(c.id);
}

for (const r of codex.Release) {
  if (!weeks.has(r.id)) fail(`Release ${r.id}`, "no Week record for this Release");
  for (const id of r.changes) {
    if (!live.some((c) => c.id === id)) fail(`Release ${r.id}`, `lists Change ${id}, which does not exist`);
  }
}

// No gap in the sequence. An empty Release is drift you can see; a
// missing one is drift you cannot, which is the whole reason to check.
const isoWeeksIn = (year) => (new Date(Date.UTC(year, 11, 28)).getUTCDay() === 0 ? 52 : weeksByThursday(year));
const weeksByThursday = (year) => {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const d = new Date(dec28);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jan1) / 86400000 + 1) / 7);
};
const nextWeek = (id) => {
  const [y, w] = id.split("-W").map(Number);
  return w < isoWeeksIn(y) ? `${y}-W${String(w + 1).padStart(2, "0")}` : `${y + 1}-W01`;
};

if (codex.Release.length === 0) {
  notes.push("no Releases yet — the sequence check starts once the first one is tagged");
} else {
  const ids = codex.Release.map((r) => r.id);
  let cursor = ids[0];
  for (const id of ids.slice(1)) {
    cursor = nextWeek(cursor);
    while (cursor !== id) {
      fail("Release sequence", `${cursor} has no Release — a Week with nothing in it still gets one`);
      cursor = nextWeek(cursor);
    }
  }
}

// --- output -----------------------------------------------------------
const out =
  JSON.stringify(
    Object.fromEntries(Object.entries(codex).map(([t, rs]) => [t, rs.map(strip)])),
    null,
    2,
  ) + "\n";

writeFileSync(OUT, out);

// --- report -----------------------------------------------------------
const counts = Object.entries(codex).map(([t, rs]) => `${rs.length} ${t}`).join(", ");
console.log(`codex: ${counts}`);
const skipped = codex.Change.filter((c) => c._pre_grammar).length;
if (skipped) console.log(`  ${skipped} Change(s) predate the grammar (epoch ${GRAMMAR_EPOCH}) and were not judged`);
for (const n of notes) console.log(`  note: ${n}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("\nvalid");
