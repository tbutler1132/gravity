// Renders the site from codex.json and the x-display blocks in
// schema.yaml.
//
// The input is codex.json, not the sources. Storage diverges — files,
// merge commits, tags — and access does not: the loader has already
// normalized all of it, so nothing here knows or cares where a record
// came from. It also means the site cannot be built without validating
// first, which is the right order: an invalid codex should not publish.
//
// Output goes to site/ and is not committed, for the same reason
// codex.json is not. A rendered Change page depends on the merge commit
// that would contain it, so a checked-in copy is stale the moment any
// Change lands and cannot be made fresh in the pull request that adds
// it. The site is built where the history is, and deployed from there.
//
// No type is named in this file. Which pages exist, where they are
// written and what they are called all come from the grammar.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { html, render as toHtml } from "../ui/html.mjs";
import { layout } from "../ui/layout.mjs";
import { display, fill, relative, types } from "../ui/display.mjs";
import { loadSchema } from "./load.mjs";

const OUT = "site";
const CODEX = "codex.json";

if (!existsSync(CODEX)) {
  console.error(`${CODEX} is missing. Run \`npm run validate\` first — the site
is rendered from the validated codex, not from the sources.`);
  process.exit(1);
}

const schema = loadSchema();
const codex = JSON.parse(readFileSync(CODEX, "utf8"));

// A hand-written template if the type has one, the generic renderer if
// not. ui/<Type>.mjs for one record, ui/<Type>.list.mjs for the index.
const template = async (type, kind) => {
  const name = kind === "list" ? `${type}.list.mjs` : `${type}.mjs`;
  const file = existsSync(join("ui", name)) ? name : `${kind}.mjs`;
  return (await import(`../ui/${file}`)).default;
};

// Where a record's page goes, or null if it has no address. A Change
// merged before the grammar carries no id, so it is in the codex — the
// record is kept — but there is nothing to name a page after.
const pathOf = (type, record) => fill(display(schema, type).path, record);

const titleOf = (type, record) =>
  fill(display(schema, type).title, record) ?? String(record.id ?? "");

// Everything a template is given. Built per page, because every href is
// relative to the page it appears on.
const context = (here) => ({
  schema,
  records: (type) => codex[type] ?? [],
  href: (to) => relative(here, to),
  hrefTo: (type, id) => {
    const rec = (codex[type] ?? []).find((r) => r.id === id);
    const to = rec && pathOf(type, rec);
    return to ? relative(here, to) : null;
  },
  titleOf,
  // A link if the record exists, its bare id if it does not. A Release
  // listing a Change with no page still says which Change.
  linkTo(type, id) {
    const rec = (codex[type] ?? []).find((r) => r.id === id);
    const href = this.hrefTo(type, id);
    if (!rec || !href) return html`${id}`;
    return html`<a href="${href}">${titleOf(type, rec)}</a>`;
  },
});

const write = (path, node) => {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, toHtml(node));
};

rmSync(OUT, { recursive: true, force: true });

let pages = 0;
const counts = [];

for (const type of types(schema)) {
  const d = display(schema, type);
  const records = codex[type] ?? [];

  const one = await template(type, "record");
  let written = 0;
  for (const record of records) {
    const path = pathOf(type, record);
    if (!path) continue; // no address, no page — the record still stands
    const ctx = context(path);
    write(path, layout(ctx, titleOf(type, record), one(record, ctx, type)));
    written++;
  }

  const list = await template(type, "list");
  const ctx = context(d.index);
  const addressable = records.filter((r) => pathOf(type, r));
  write(
    d.index,
    layout(
      ctx,
      d.index === "index.html" ? "Gravity" : d.plural,
      list(addressable, ctx, type),
    ),
  );

  pages += written + 1;
  counts.push(`${written} ${d.plural}${written === records.length ? "" : ` (${records.length - written} unaddressable)`}`);
}

console.log(`site: ${counts.join(", ")}`);
console.log(`${pages} pages -> ${OUT}/`);
