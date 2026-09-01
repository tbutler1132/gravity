// The markdown subset the records actually use: paragraphs and ordered
// lists, separated by blank lines.
//
// This is deliberately not a markdown library. Anything more — links,
// emphasis, headings inside a record — renders literally, and seeing it
// render literally is the signal to reach for a real one.
//
// Lines are wrapped at 72 columns because the output is committed and
// read as a file, not only served.

import { esc, raw } from "./html.mjs";

const wrap = (text, width, indent) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > width) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join("\n");
};

const block = (b, pad) => {
  if (/^\d+\.\s/.test(b)) {
    const items = b
      .split("\n")
      .map((l) => `${pad}  <li>${esc(l.replace(/^\d+\.\s*/, ""))}</li>`);
    return [`${pad}<ol>`, ...items, `${pad}</ol>`].join("\n");
  }
  return `${pad}<p>\n${wrap(esc(b.split("\n").join(" ")), 72, pad + "  ")}\n${pad}</p>`;
};

// depth is how many levels deep the prose sits in the document, so the
// generated file stays indented like something a person wrote.
export const prose = (content, depth = 3) => {
  const pad = " ".repeat(depth * 2);
  return raw(
    content
      .trim()
      .split(/\n{2,}/)
      .map((b) => block(b, pad))
      .join("\n"),
  );
};
