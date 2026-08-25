#!/usr/bin/env node
// Weekly discovery for awesome-cross-app-access.
//
// Polls the sources that actually move (oauth.net's implementation list, GitHub,
// the IETF draft) and prints a markdown report of anything not already in the
// README. Empty output means nothing new, and the workflow opens no issue.
//
// Curation stays human: this only ever proposes candidates.

import { readFile } from 'node:fs/promises';

const TOKEN = process.env.GITHUB_TOKEN;
const UA = 'awesome-cross-app-access-discovery';

// A candidate must look like it is actually about this topic. GitHub's search
// for "id-jag" happily returns jaguar-identification and Indonesian "jago"
// repos, so every hit is re-checked against this before being reported.
const RELEVANT =
  /id[-_ ]?jag|cross[-_ ]?app[-_ ]?access|\bxaa\b|identity assertion|enterprise[-_ ]managed[-_ ]auth/i;

const GITHUB_QUERIES = [
  'id-jag in:name,description,topics',
  '"cross app access" in:name,description,topics',
  '"identity assertion" oauth in:name,description,topics',
  'xaa oauth in:name,description,topics',
];

const OAUTH_NET = 'https://oauth.net/cross-app-access/';
const DRAFT_API =
  'https://datatracker.ietf.org/api/v1/doc/document/?name=draft-ietf-oauth-identity-assertion-authz-grant&format=json';

// Compare links by host + path, ignoring www, trailing slash, query and fragment,
// so the same page linked two ways is not reported as new.
function norm(url) {
  try {
    const u = new URL(url);
    return (
      u.host.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')
    ).toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json', ...headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function gh(url) {
  return getJSON(url, {
    accept: 'application/vnd.github+json',
    ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
  });
}

// Everything already linked from the list.
async function readmeLinks() {
  const md = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const urls = [...md.matchAll(/https?:\/\/[^\s)<>"']+/g)].map((m) => m[0]);
  return { set: new Set(urls.map(norm)), text: md };
}

// Everything a previous run already proposed, so candidates are reported once
// and a declined suggestion does not come back every week.
async function alreadyProposed(repo) {
  if (!repo || !TOKEN) return new Set();
  try {
    const issues = await gh(
      `https://api.github.com/repos/${repo}/issues?state=all&labels=discovery&per_page=100`,
    );
    const urls = issues.flatMap((i) =>
      [...String(i.body ?? '').matchAll(/https?:\/\/[^\s)<>"']+/g)].map((m) => m[0]),
    );
    return new Set(urls.map(norm));
  } catch {
    return new Set();
  }
}

async function fromGitHub(known) {
  const found = new Map();
  for (const q of GITHUB_QUERIES) {
    let items = [];
    try {
      const data = await gh(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=30`,
      );
      items = data.items ?? [];
    } catch {
      continue; // A rate-limited query should not fail the whole run.
    }
    for (const r of items) {
      if (r.fork || r.archived) continue;
      if (r.full_name === process.env.GITHUB_REPOSITORY) continue; // Don't suggest this list.
      // A token with private-repo access makes search return repos no reader can
      // open. Actions' GITHUB_TOKEN never sees them, a local run with a personal
      // token does, so filter explicitly rather than relying on the environment.
      if (r.private) continue;
      const haystack = `${r.full_name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`;
      if (!RELEVANT.test(haystack)) continue;
      if (known.has(norm(r.html_url))) continue;
      found.set(r.full_name, {
        url: r.html_url,
        name: r.full_name,
        desc: (r.description ?? '').replace(/\s+/g, ' ').trim(),
        stars: r.stargazers_count,
        updated: String(r.pushed_at ?? '').slice(0, 10),
      });
    }
  }
  return [...found.values()].sort((a, b) => b.stars - a.stars);
}

// oauth.net is maintained alongside the spec, so it is the highest-signal place
// to learn that a new vendor or tool shipped support.
async function fromOAuthNet(known) {
  let html;
  try {
    const res = await fetch(OAUTH_NET, { headers: { 'user-agent': UA } });
    html = await res.text();
  } catch {
    return [];
  }
  const body = html.slice(html.indexOf('Cross-App Access'));
  const out = new Map();
  for (const m of body.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text || known.has(norm(url))) continue;
    if (/oauth\.net|udemy\.com|shop\.oauth|github\.com\/aaronpk\/oauth\.net/.test(url)) continue;
    // A bare vendor homepage is a marketing link, not a resource. Hosts that are
    // themselves about the topic (xaa.dev, *.xaa.rocks) are the exception.
    try {
      const u = new URL(url);
      if (u.pathname.replace(/\/+$/, '') === '' && !/xaa/.test(u.host)) continue;
    } catch {
      continue;
    }
    out.set(norm(url), { url, text });
  }
  return [...out.values()];
}

async function draftRevision(readmeText) {
  try {
    const data = await getJSON(DRAFT_API);
    const rev = data.objects?.[0]?.rev;
    if (!rev) return null;
    const pinned = readmeText.match(/identity-assertion-authz-grant-(\d+)\.html/)?.[1];
    if (pinned && pinned !== rev) return { rev, pinned };
    return null;
  } catch {
    return null;
  }
}

const { set: readme, text } = await readmeLinks();
const proposed = await alreadyProposed(process.env.GITHUB_REPOSITORY);
const known = new Set([...readme, ...proposed]);

const [repos, links, draft] = await Promise.all([
  fromGitHub(known),
  fromOAuthNet(known),
  draftRevision(text),
]);

const sections = [];

if (draft) {
  sections.push(
    `### Spec revision\n\n` +
      `- [ ] The IETF draft is now **-${draft.rev}**, but the "Latest rendered draft" link still points at -${draft.pinned}. ` +
      `Update it to https://www.ietf.org/archive/id/draft-ietf-oauth-identity-assertion-authz-grant-${draft.rev}.html`,
  );
}

if (links.length) {
  sections.push(
    `### New on oauth.net\n\n` +
      links.map((l) => `- [ ] [${l.text}](${l.url})`).join('\n'),
  );
}

if (repos.length) {
  sections.push(
    `### New GitHub repositories\n\n` +
      repos
        .map(
          (r) =>
            `- [ ] [${r.name}](${r.url}) — ${r.desc || 'no description'} (${r.stars}star${r.stars === 1 ? '' : 's'}, pushed ${r.updated})`.replace(
              /(\d+)star/,
              '$1 star',
            ),
        )
        .join('\n'),
  );
}

if (!sections.length) process.exit(0);

const today = new Date().toISOString().slice(0, 10);
console.log(`Weekly discovery run for ${today}. Candidates below are **suggestions only** — they have not been vetted against the [contribution guidelines](../blob/main/contributing.md).

Tick what belongs, open a PR adding it, and close this issue when done. Anything left unticked will not be suggested again.

${sections.join('\n\n')}`);
