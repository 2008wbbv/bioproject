# OpenFoldUI — marketing site

A self-contained, dependency-free landing page that shows off **OpenFoldUI**
(the app itself lives in `../src`). Plain HTML + CSS — no build step.

## Preview locally

```bash
# from the repo root
npx serve website        # or: python3 -m http.server -d website 8080
```

Then open the printed URL.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole page (hero, features, science, how-it-works, metrics, CTA). |
| `styles.css` | Brand styling (navy → electric-blue → red, matching the app banner). |
| `assets/banner.svg` | Social/OG image (copied from `docs/banner.svg`). |

## Deploying

It's static, so any host works (GitHub Pages, Netlify, Cloudflare Pages, S3…).
The "Launch the app" buttons point at the hosted PWA
(`https://2008wbbv.github.io/bioproject/`); update those links if the app is
hosted elsewhere.
