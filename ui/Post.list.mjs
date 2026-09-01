// The site root. The Posts are the front door and there are few enough
// to read in one scroll, so the index renders them in full rather than
// as a list of links — the generic list view would be a worse page.

import { html, raw } from "./html.mjs";
import { prose } from "./prose.mjs";

const article = (p, ctx) => html`      <article id="${p.id}">
        <h2><a href="${ctx.hrefTo("Post", p.id)}">${ctx.titleOf("Post", p)}</a></h2>
${prose(p.content, 4)}
      </article>`;

export default (posts, ctx) =>
  html`${posts.flatMap((p, i) => (i ? [raw("\n\n      <hr />\n\n"), article(p, ctx)] : [article(p, ctx)]))}`;
