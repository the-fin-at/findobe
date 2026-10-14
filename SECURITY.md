# Security

Findobe is an early-stage local desktop tool. Keep backups and use the latest source or published release. PDF text correction is not a secure redaction tool.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/the-fin-at/findobe/security/advisories/new). Do not include vulnerabilities, private documents, tokens, or agent manifests in a public issue.

Include the affected version, platform, a minimal synthetic reproduction, and the expected impact. There is no guaranteed response time or security support for historical builds.

## Local agent access

The agent bridge listens on loopback and authenticates with a per-session token. Treat its manifest as a credential. Only give access to agents you trust: authenticated agents can read and modify documents and request local file operations. Do not expose or forward the bridge to a network.

## Dependency audit snapshot — 14 October 2026

`npm audit --omit=dev` reports three moderate advisories in the `mammoth → argparse → sprintf-js` command-line dependency chain (GHSA-hp3w-g68c-fv3c). `argparse` and `sprintf-js` are not inputs to the bundled document editor. Do not treat that as a clean audit of every installed dependency; avoid using the upstream CLI with untrusted format strings. The suggested automatic fix downgrades Mammoth across breaking versions and has not been applied.
