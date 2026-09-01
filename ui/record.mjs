// The generic record page: heading, declared fields, prose, backlinks.
//
// It never names a type. Everything it needs comes from that type's
// x-display block and from the $refs already in the grammar, which is
// why a type added to schema.yaml has a working page before anyone
// writes a template for it. Write a template in ui/<Type>.mjs only when
// this one is actually wrong for that type.

import { html, sections } from "./html.mjs";
import { prose } from "./prose.mjs";
import { display } from "./display.mjs";
import { meta, inbound } from "./fields.mjs";

export default (record, ctx, type) => {
  const body = display(ctx.schema, type).body;
  return sections(
    html`      <h1>${ctx.titleOf(type, record)}</h1>`,
    meta(ctx, type, record),
    body && record[body] ? prose(record[body]) : null,
    inbound(ctx, type, record),
  );
};
