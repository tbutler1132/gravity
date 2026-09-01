// Checks a pull request's description before it can be merged.
//
// The description becomes the merge commit body, so this is the last
// moment the record can be fixed while it is still cheap. Everything
// checked here is checked again by validate.mjs afterwards; the point
// of doing it now is that a blocked merge leaves no bad record behind.
//
//   PR_BODY=... PR_NUMBER=4 node codex/check-pr.mjs

import { existsSync } from "node:fs";
import { looksLikeTrailer, splitTrailers } from "./trailers.mjs";

const body = process.env.PR_BODY ?? "";
const number = Number(process.env.PR_NUMBER);
const MAGNITUDES = ["major", "minor", "patch"];
const errors = [];

// Read the description exactly as load.mjs will read the merge commit it
// becomes. This check used to scan every line on its own, which accepted
// trailers the loader would not have found — a description that passed
// here and landed as a Change with no id and no magnitude, failing
// validation only after the merge, which is the one moment this check
// exists to come before.
const { content, trailers } = splitTrailers(body);

// Trailers that are present but written where they will not be read is a
// different mistake from having written none, and the fix is different
// too, so say which one it is rather than reporting both as missing.
const misplaced = !Object.keys(trailers).length && looksLikeTrailer(body);

if (misplaced) {
  errors.push(
    "the trailers are not the last paragraph of the description, so the loader " +
      "will not find them and this Change would land with none. Put them alone " +
      "in the final paragraph, with nothing after them — no sign-off, no footer",
  );
}

if (!body.trim()) {
  errors.push(
    "the description is empty, so this Change would land with no record at all — " +
      "the body becomes the merge commit message",
  );
} else if (!misplaced && !content) {
  errors.push(
    "the description is trailers and nothing else, so this Change would land " +
      "with no record of what it does — write what changed and why above them",
  );
}

// Only worth reading the fields once they are somewhere they will be
// read. Misplaced trailers have already been reported, and complaining
// that Magnitude is missing on top of that points at the wrong line.
if (!misplaced) {
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
}

if (errors.length) {
  console.error(`This Change is not grammatical yet:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nEdit the pull request description and push nothing; the check re-runs on edit.`);
  process.exit(1);
}

console.log(`Change ${number}: ${trailers.Magnitude}${trailers.Post ? `, Post ${trailers.Post}` : ""} — record is well formed`);
