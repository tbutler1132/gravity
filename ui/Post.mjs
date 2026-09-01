// Posts are the writing, so their page is the prose and almost nothing
// else: no field list above the text, and the Week it was published in
// moved to a line underneath.
//
// This is the one type the generic renderer is wrong for. Every other
// type still renders from ui/record.mjs.

import { html, sections } from "./html.mjs";
import { prose } from "./prose.mjs";
import { inbound } from "./fields.mjs";

export default (post, ctx, type) =>
  sections(
    html`      <article id="${post.id}">`,
    html`        <h1>${ctx.titleOf(type, post)}</h1>`,
    prose(post.content, 4),
    html`        <p><small>Published in ${ctx.linkTo("Week", post.week)}.</small></p>`,
    html`      </article>`,
    inbound(ctx, type, post),
  );
