# Contributing to Findobe

Thank you for helping make Findobe useful. Open an issue for bugs or larger feature ideas before a substantial change, and keep pull requests focused.

## Report a bug

Include the operating system, Findobe version, steps to reproduce, expected behavior, and actual behavior. Use a small synthetic document. Never attach private documents, agent connection manifests, tokens, or credentials. Security issues belong in the private reporting channel described in [SECURITY.md](SECURITY.md).

## Make a change

1. Fork the repository and create a branch.
2. Follow the setup in [README.md](README.md#build-from-source).
3. Keep document processing local and preserve source content, undo history, and save conflict checks.
4. Run `npm run build:editor` and `npm test` for application changes. Run the relevant browser checks when editing the UI. State which platforms you actually tested.
5. For website changes, check desktop and mobile layouts and links under `/findobe/`. Keep fonts and assets self-hosted and retain THE-FIN's upright typography.
6. Open a pull request describing the change and verification.

By contributing, you agree to license your original contribution under the project's MIT license. Preserve third-party license notices. Be respectful, clear, and constructive in issues and reviews.
