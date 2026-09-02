// The generic index page for a type: what the type is, then every
// record as a link.

import { html, sections } from "./html.mjs";
import { display } from "./display.mjs";
import { about } from "./fields.mjs";

export default (records, ctx, type) => {
  const d = display(ctx.schema, type);
  return sections(
    html`      <h1>${d.plural}</h1>`,
    about(ctx, type),
    html`${
  records.length
    ? html`      <ul>
${records.map((r) => html`        <li>${ctx.linkTo(type, r.id)}</li>\n`)}      </ul>`
    : html`      <p>None yet.</p>`
}`,
  );
};
