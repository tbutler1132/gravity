// Reads every record in the project and returns them in one shape.
//
// Storage diverges on purpose — Weeks, Cycles, and Posts are files,
// Changes are merge commits, Releases are tags — because a record
// belongs wherever it is already authoritative. Access does not
// diverge: everything downstream reads the object this returns, or
// the codex.json built from it, and never a source directly.
//
// Each type's source is declared in its x-source block in schema.yaml.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const NUL = "\u0000";
const REC = "\u0001";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 }).trim();

const isAncestor = (a, b) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

export const loadSchema = () => parseYaml(readFileSync("schema.yaml", "utf8"));

// Changes merged at or before this commit predate the grammar and are
// not held to it. Only #1 does: it landed before any of these types
// existed, and rewriting it would mean rewriting everything after it.
// #2 introduced the grammar and is held to it like everything since.
export const GRAMMAR_EPOCH = "6cf441a";

const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

// --- kind: files ------------------------------------------------------
const loadFiles = (glob) => {
  const dir = glob.split("/")[0];
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const raw = readFileSync(join(dir, f), "utf8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error(`${join(dir, f)}: no frontmatter`);
      const fields = Object.fromEntries(
        m[1]
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => {
            const i = l.indexOf(":");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
          }),
      );
      return { ...fields, content: m[2].trim(), _source: join(dir, f) };
    });
};

// --- kind: git-merge-commits ------------------------------------------
const TRAILER = /^[A-Za-z][A-Za-z-]*:\s.+$/;

// A trailer block is the last paragraph, and only when every line in it
// is a trailer. That keeps prose ending in "Note: ..." out of the fields.
const splitTrailers = (body) => {
  const paras = body.trim().split(/\n{2,}/);
  const last = paras.at(-1);
  if (!last || !last.split("\n").every((l) => TRAILER.test(l))) {
    return { content: body.trim(), trailers: {} };
  }
  const trailers = Object.fromEntries(
    last.split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  return { content: paras.slice(0, -1).join("\n\n").trim(), trailers };
};

const loadChanges = () => {
  const fmt = ["%H", "%s", "%cI", "%b"].join("%x00");
  const raw = git("log", "--merges", `--format=${fmt}%x01`, "HEAD");
  if (!raw) return [];
  return raw
    .split(REC)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, subject, date, body = ""] = rec.split(NUL);
      const { content, trailers } = splitTrailers(body);
      return {
        ...(trailers.Change !== undefined ? { id: Number(trailers.Change) } : {}),
        ...(trailers.Magnitude ? { magnitude: trailers.Magnitude } : {}),
        ...(trailers.Post ? { post: trailers.Post } : {}),
        content,
        _sha: sha.slice(0, 7),
        _subject: subject,
        _week: isoWeek(new Date(date)),
        _pre_grammar: isAncestor(sha, GRAMMAR_EPOCH),
      };
    })
    .reverse();
};

// --- kind: git-tags ---------------------------------------------------
const loadReleases = (changes) => {
  const fmt = ["%(refname:short)", "%(contents)"].join("%00") + "%01";
  const raw = git("for-each-ref", "refs/tags", `--format=${fmt}`);
  if (!raw) return [];
  return raw
    .split(REC)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((rec) => {
      const [name, contents = ""] = rec.split(NUL);
      return { id: name, content: contents.trim() };
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => ({
      // changes is derived, never declared: the Changes merged that Week.
      ...t,
      changes: changes.filter((c) => c._week === t.id && c.id !== undefined).map((c) => c.id),
    }));
};

// A shallow clone has no merge history and no tags, so the loader would
// return a codex with no Changes and no Releases and nothing would look
// wrong. Refuse, rather than validate or publish a record that is
// quietly missing most of itself.
const assertFullHistory = () => {
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    throw new Error(
      "shallow clone: Changes are merge commits and Releases are tags, so " +
        "neither is visible here. Fetch the full history (fetch-depth: 0).",
    );
  }
};

export const load = () => {
  assertFullHistory();
  const schema = loadSchema();
  const glob = (type) => schema.$defs[type]["x-source"].glob;
  const changes = loadChanges();
  return {
    Week: loadFiles(glob("Week")),
    Cycle: loadFiles(glob("Cycle")),
    Post: loadFiles(glob("Post")),
    Change: changes,
    Release: loadReleases(changes),
  };
};
