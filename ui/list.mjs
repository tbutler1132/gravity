// The generic index page for a type: every record, as a link.

import { html } from "./html.mjs";
import { display } from "./display.mjs";

export default (records, ctx, type) => {
  const d = display(ctx.schema, type);
  return html`      <h1>${d.plural}</h1>
${
  records.length
    ? html`      <ul>
${records.map((r) => html`        <li>${ctx.linkTo(type, r.id)}</li>\n`)}      </ul>`
    : html`      <p>None yet.</p>`
}`;
};
