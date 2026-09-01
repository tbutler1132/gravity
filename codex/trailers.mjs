// What a trailer block is. One definition, because two places read it.
//
// load.mjs parses the merge commit body to build the Change; check-pr.mjs
// parses the pull request description, which is that same text one merge
// earlier. When the two disagree the gate passes a description the loader
// then reads differently, and the bad record lands anyway — which is the
// one thing the gate exists to prevent. A looser check upstream of a
// stricter one is worse than no check: it fails after the merge, past the
// point where the record was still cheap to fix.
//
// No imports here, not even node: builtins. check-pr.mjs runs in a job
// with no npm ci, so everything it reaches has to stand alone.

export const TRAILER = /^[A-Za-z][A-Za-z-]*:\s.+$/;

// A description typed in the browser comes back CRLF — that is what HTML
// textareas submit — while the same text read back out of a merge commit
// has been normalized by git. Same record, two line endings, and a blank
// line spelled "\r\n\r\n" is not two newlines, so paragraphs have to be
// counted after this, never before.
const lines = (text) => text.replace(/\r\n?/g, "\n");

const parse = (block) =>
  Object.fromEntries(
    block.split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );

// The trailer block is the last paragraph, and only when every line in it
// is a trailer. That keeps prose ending in "Note: ..." out of the fields.
export const splitTrailers = (body) => {
  const paras = lines(body).trim().split(/\n{2,}/);
  const last = paras.at(-1);
  if (!last || !last.split("\n").every((l) => TRAILER.test(l))) {
    return { content: lines(body).trim(), trailers: {} };
  }
  return { content: paras.slice(0, -1).join("\n\n").trim(), trailers: parse(last) };
};

// Whether the body carries anything that was meant to be a trailer. Tells
// "no trailers at all" apart from "trailers written where they will not be
// read", which are different mistakes and need different advice.
export const looksLikeTrailer = (body) =>
  lines(body).split("\n").some((l) => TRAILER.test(l.trim()));
