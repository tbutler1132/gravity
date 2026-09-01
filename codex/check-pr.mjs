// Checks a pull request's description before it can be merged.
//
// The description becomes the merge commit body, so this is the last
// moment the record can be fixed while it is still cheap. Everything
// checked here is checked again by validate.mjs afterwards; the point
// of doing it now is that a blocked merge leaves no bad record behind.
//
//   PR_BODY=... PR_NUMBER=4 node codex/check-pr.mjs

import { existsSync } from "node:fs";

const body = process.env.PR_BODY ?? "";
const number = Number(process.env.PR_NUMBER);
const MAGNITUDES = ["major", "minor", "patch"];
const errors = [];

const trailers = Object.fromEntries(
  body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z][A-Za-z-]*:\s.+$/.test(l))
    .map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

if (!body.trim()) {
  errors.push(
    "the description is empty, so this Change would land with no record at all — " +
      "the body becomes the merge commit message",
  );
}

if (!trailers.Change) {
  errors.push(`missing "Change: ${number}" trailer`);
} else if (Number(trailers.Change) !== number) {
  errors.push(`"Change: ${trailers.Change}" does not match this pull request, which is #${number}`);
}

if (!trailers.Magnitude) {
  errors.push(`missing "Magnitude:" trailer — one of ${MAGNITUDES.join(", ")}`);
} else if (!MAGNITUDES.includes(trailers.Magnitude)) {
  errors.push(`"Magnitude: ${trailers.Magnitude}" is not one of ${MAGNITUDES.join(", ")}`);
} else if (trailers.Magnitude === "major") {
  if (!trailers.Post) {
    errors.push('a major ships only after a Post — add "Post: NNNN" citing the writing that argued for it');
  } else if (!existsSync(`records/posts/${trailers.Post}.md`)) {
    errors.push(`"Post: ${trailers.Post}" does not exist — records/posts/${trailers.Post}.md is not in the tree`);
  }
}

if (errors.length) {
  console.error(`This Change is not grammatical yet:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nEdit the pull request description and push nothing; the check re-runs on edit.`);
  process.exit(1);
}

console.log(`Change ${number}: ${trailers.Magnitude}${trailers.Post ? `, Post ${trailers.Post}` : ""} — record is well formed`);
