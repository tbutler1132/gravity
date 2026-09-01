// The smallest thing that can build HTML without getting it wrong.
//
// html`` escapes every value interpolated into it. The only way to put
// markup in is raw(), which is what the templates return, so a nested
// template passes through and a record's own text never can. That is
// the whole safety story: escaping is the default and bypassing it is
// a word you have to type.

const RAW = Symbol("raw");

export const raw = (s) => ({ [RAW]: String(s) });

export const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// null, undefined and false render as nothing, so `cond && html``` works.
// Arrays concatenate, so `records.map(...)` interpolates directly.
const fmt = (v) => {
  if (v === null || v === undefined || v === false || v === true) return "";
  if (Array.isArray(v)) return v.map(fmt).join("");
  if (typeof v === "object" && RAW in v) return v[RAW];
  return esc(v);
};

export const html = (strings, ...values) =>
  raw(strings.reduce((out, s, i) => out + fmt(values[i - 1]) + s));

// Turn a node into the string that gets written to disk.
export const render = fmt;

// Join nodes with a newline, dropping the ones that rendered to nothing,
// so a record with no fields or no backlinks leaves no blank gap behind.
export const sections = (...nodes) =>
  raw(nodes.map(fmt).filter((s) => s !== "").join("\n"));
