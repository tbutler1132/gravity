// Renders posts/*.md into index.html.
//
// posts/ is the source. index.html is a build output and is never
// hand-edited; edit the Post and re-run this.
//
// The markdown understood here is the subset the Posts actually use:
// paragraphs and ordered lists. Anything more (links, emphasis,
// headings inside a Post) renders literally and is the signal to
// reach for a real markdown library.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const POSTS = "posts";
const OUT = "index.html";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrap = (text, width, indent) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > width) { lines.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join("\n");
};

const readPost = (file) => {
  const raw = readFileSync(join(POSTS, file), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  const fields = Object.fromEntries(
    m[1].split("\n").filter(Boolean).map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
  );
  for (const k of ["id", "title", "week"]) {
    if (!fields[k]) throw new Error(`${file}: missing ${k}`);
  }
  return { ...fields, content: m[2].trim() };
};

const renderBlock = (block) => {
  if (/^\d+\.\s/.test(block)) {
    const items = block.split("\n").map((l) => `          <li>${esc(l.replace(/^\d+\.\s*/, ""))}</li>`);
    return ["        <ol>", ...items, "        </ol>"].join("\n");
  }
  const text = block.split("\n").join(" ");
  return `        <p>\n${wrap(esc(text), 72, "          ")}\n        </p>`;
};

const renderPost = (p) =>
  [
    `      <article id="${p.id}">`,
    `        <h2>${p.id}: ${esc(p.title)}</h2>`,
    ...p.content.split(/\n{2,}/).map(renderBlock),
    "      </article>",
  ].join("\n");

const posts = readdirSync(POSTS)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map(readPost);

writeFileSync(
  OUT,
  `<!doctype html>
<!-- Generated from posts/*.md by codex/render.mjs. Do not edit. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gravity</title>
  </head>
  <body>
    <header>
      <h1>Gravity</h1>
    </header>

    <main>
${posts.map(renderPost).join("\n\n      <hr />\n\n")}
    </main>
  </body>
</html>
`,
);
console.log(`rendered ${posts.length} posts -> ${OUT}`);
