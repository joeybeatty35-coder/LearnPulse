# LearnPulse

Educational, discovery-focused learning. LearnPulse is a small static site that helps users explore skills, languages, tutorials, and ideas in a calm, privacy-first way.

## Files

- `index.html` — Home page
- `privacy.html` — Privacy Policy (effective date: 2026-01-13)
- `support.html` — Support information
- `vercel.json` — Vercel configuration (cleanUrls and rewrites)

## Deployment

This repository is configured to deploy on Vercel. The `vercel.json` includes:

- `cleanUrls: true`
- Rewrites mapping `/privacy` → `/privacy.html` and `/support` → `/support.html`

## Customize

- Edit the HTML files in the repo to update content and styles.
- Replace the placeholder support email `ADD-YOUR-EMAIL-HERE` in `privacy.html` and `support.html` with your support address if desired.
- Update `vercel.json` if you need additional rewrites or routing rules.

## Contributing

Contributions and improvements are welcome. For small edits you can commit directly to `main`; for larger changes, open a pull request.

## License

Add a `LICENSE` file to apply a specific license to this project.

---

(End of file)
