# Contribution guidelines

Thanks for helping keep this list useful.

## What belongs here

An entry should be *about* Cross-App Access, ID-JAG, or MCP Enterprise-Managed Authorization, not merely mention them. Good candidates:

- Spec drafts and directly related standards.
- Identity providers that issue or validate ID-JAG, with a link to real documentation.
- Applications that let an enterprise IdP govern access to their API or MCP server.
- Libraries that implement either side of the flow.
- Runnable samples, demos, and sandboxes.
- Articles, talks, and podcasts that explain the protocol or a real deployment.

## What does not

- Marketing pages with no technical content.
- Products that mention XAA on a roadmap but ship nothing you can read or run.
- Generic OAuth or MCP material with no ID-JAG angle.
- Link-shortened, paywalled, or dead URLs.

## Format

One item per line:

```
- [Name](https://example.com) - Description.
```

- Descriptions start with a capital letter and end with a period.
- Keep them to one line, factual, and free of superlatives.
- The **Resource apps and MCP servers** section is a bare link list with no descriptions, since every entry does the same thing. Keep it alphabetical.
- Every other section is ordered roughly by usefulness to a newcomer, so put foundational entries near the top.

## Where suggestions come from

A workflow runs every Monday and opens an issue labelled `discovery` with anything new it spots on [oauth.net](https://oauth.net/cross-app-access/), on GitHub, or in the IETF draft. Those are unvetted candidates, not accepted entries. Picking one up and opening a PR for it is a genuinely useful contribution.

## Pull requests

- One logical change per pull request.
- Say in the description why the entry belongs, especially for a project you authored. Self-submissions are welcome; just disclose them.
- Check the link works and points at the canonical page.
- If an entry is superseded or goes dead, a PR removing it is just as valuable as one adding a link.

By contributing you agree to release your contribution under [CC0-1.0](LICENSE).
