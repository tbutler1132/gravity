// Rendering for the parts of a record that come from the schema rather
// than from a template: its declared fields, and the records elsewhere
// that point at it.
//
// Custom templates import these so that overriding a type's layout does
// not mean re-implementing its links.

import { html, raw, sections } from "./html.mjs";
import { prose, wrapped } from "./prose.mjs";
import { refType, backlinks, display } from "./display.mjs";

const join = (nodes, sep) => nodes.flatMap((n, i) => (i ? [raw(sep), n] : [n]));

const value = (ctx, type, prop, record) => {
  const ref = refType(ctx.schema.$defs[type].properties?.[prop]);
  const v = record[prop];
  if (ref && Array.isArray(v))
    return v.length ? join(v.map((x) => ctx.linkTo(ref.type, x)), ", ") : html`<em>none</em>`;
  if (ref) return ctx.linkTo(ref.type, v);
  if (Array.isArray(v)) return v.length ? html`${v.join(", ")}` : html`<em>none</em>`;
  return html`${v}`;
};

// What a type is, as the grammar states it: the type's description, and
// the descriptions of the properties that carry one. Read straight off
// the schema — description is JSON Schema's own keyword, not one of the
// x- annotations, and it is the only place a type says what it means.
//
// A type with no description renders nothing here, so this costs a type
// nothing until someone writes one.
export const about = (ctx, type) => {
  const def = ctx.schema.$defs[type];
  const props = Object.entries(def.properties ?? {}).filter(([, p]) => p.description);
  return sections(
    def.description ? prose(def.description) : null,
    props.length
      ? sections(
          html`      <dl>`,
          ...props.flatMap(([name, p]) => [
            html`        <dt>${name.replace(/_/g, " ")}</dt>`,
            html`        <dd>
${wrapped(p.description, 10)}
        </dd>`,
          ]),
          html`      </dl>`,
        )
      : null,
  );
};

export const meta = (ctx, type, record) => {
  // Only what the record actually carries. An optional field left out —
  // a patch with no Post — is absent, not empty.
  const props = display(ctx.schema, type).meta.filter((p) => record[p] !== undefined);
  if (!props.length) return null;
  return sections(
    html`      <dl>`,
    ...props.flatMap((p) => [
      html`        <dt>${p.replace(/_/g, " ")}</dt>`,
      html`        <dd>${value(ctx, type, p, record)}</dd>`,
    ]),
    html`      </dl>`,
  );
};

// Everything that points here, found by following $ref backwards. A Week
// lists the Posts published in it without the Week knowing Posts exist.
export const inbound = (ctx, type, record) => {
  const groups = [];
  for (const { type: from, prop, array } of backlinks(ctx.schema, type)) {
    const hits = ctx.records(from).filter((r) => {
      const v = r[prop];
      return array ? Array.isArray(v) && v.includes(record.id) : v === record.id;
    });
    if (hits.length) groups.push({ from, hits });
  }
  if (!groups.length) return null;
  return sections(
    ...groups.flatMap(({ from, hits }) => [
      html`      <h2>${display(ctx.schema, from).plural}</h2>`,
      html`      <ul>`,
      ...hits.map((r) => html`        <li>${ctx.linkTo(from, r.id)}</li>`),
      html`      </ul>`,
    ]),
  );
};
