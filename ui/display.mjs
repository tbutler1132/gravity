// Reads the x-display block and answers every question the renderers
// have about a type, so no renderer ever names one.
//
// x-source says where instances come from on the way in. x-display says
// how they read on the way out. Both are annotations: JSON Schema
// ignores unknown keywords, so neither affects validation.
//
//   plural  label for this type in the navigation
//   path    where one record is written, and the href that points at it
//   index   where the list of them is written (defaults beside path)
//   title   heading, interpolated from the record's own fields
//   body    the property holding prose, if the type has one
//   meta    properties to list under the heading
//
// A type with no x-display still renders: id as the heading, every
// property in schema order. A type gets a page the day it enters the
// grammar, before anyone writes a template for it.

import path from "node:path/posix";

const REF = /^#\/\$defs\/([^/]+)\/properties\//;

export const display = (schema, type) => {
  const def = schema.$defs[type];
  const d = def["x-display"] ?? {};
  const file = d.path ?? `${type.toLowerCase()}s/{id}.html`;
  // Every type in the grammar names its prose `content`, so an
  // undeclared type still renders its writing rather than hiding it in
  // a field list. Declaring `body: null` opts out, which is what Week
  // does: its content is a private log.
  const body = d.body === undefined ? (def.properties?.content ? "content" : null) : d.body;
  return {
    plural: d.plural ?? `${type}s`,
    path: file,
    index: d.index ?? path.join(path.dirname(file), "index.html"),
    title: d.title ?? "{id}",
    body,
    // No meta declared means show everything the heading and body did
    // not already use — the fallback view, and the reason a new type is
    // legible before it is styled.
    meta:
      d.meta ??
      Object.keys(def.properties ?? {}).filter((k) => k !== "id" && k !== body),
  };
};

// Types the site publishes, in the order the grammar declares them.
export const types = (schema) => Object.keys(schema.$defs);

// "{id}: {title}" against a record. Returns null if any field is
// missing, which is how a record that cannot be addressed — a Change
// from before the grammar, carrying no id — ends up with no page
// instead of a page at posts/undefined.html.
export const fill = (tmpl, record) => {
  let missing = false;
  const out = tmpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (record[k] === undefined || record[k] === null) missing = true;
    return String(record[k]);
  });
  return missing ? null : out;
};

// The $ref on a property is the link graph, already declared. A property
// whose ref points at Week/properties/id holds a Week's id, so it can be
// rendered as a link to that Week without anyone saying so.
export const refType = (prop) => {
  if (!prop) return null;
  const direct = prop.$ref?.match(REF);
  if (direct) return { type: direct[1], array: false };
  const item = prop.items?.$ref?.match(REF);
  if (item) return { type: item[1], array: true };
  return null;
};

// Which properties, on which other types, point back at this one. Also
// derived from $ref, so a Week lists the Posts published in it without
// the Week knowing Posts exist.
export const backlinks = (schema, target) => {
  const out = [];
  for (const [type, def] of Object.entries(schema.$defs)) {
    for (const [prop, sub] of Object.entries(def.properties ?? {})) {
      const ref = refType(sub);
      if (ref?.type === target) out.push({ type, prop, array: ref.array });
    }
  }
  return out;
};

// Every href is relative, so the site works under a project path on
// Pages and from a file:// URL on disk without knowing which.
export const relative = (from, to) => {
  const rel = path.relative(path.dirname(from), to);
  return rel === "" ? "." : rel;
};
