# Miqdaar — Faraid & Zakat Islamic Calculator

**https://miqdaar.online**

> Simple calculations. Clear evidence. Respect for every madhhab.

Educational Islamic calculator for **Zakat** and **Warasat / Faraid** (Islamic inheritance).

This is **not** an AI fatwa application. It is an educational + calculation + evidence tool.

## Principles

- Deterministic calculation engines (no LLM does the math)
- Quran and authentic Hadith only from verified database
- Madhhab-aware (Hanafi, Shafi'i, Maliki, Hanbali, Ja'fari)
- Explicit "Scholar verification required" when a case is not safely supported
- Local-first privacy (calculations stored in browser by default)
- Offline-capable PWA after first load

## Features (V1)

### Zakat
- Cash & money
- Gold (with personal-use jewelry methodology difference)
- Silver
- Business inventory (goods for sale only)
- Short-term debts
- Nisab (gold & silver benchmarks)
- 2.5% rate with evidence reference

### Inheritance (Faraid)
- Spouse, parents, sons, daughters
- Basic siblings
- Fixed shares (furud)
- Residuary (asabah)
- Basic hajb, awl, radd
- Exact fractions + amounts
- Madhhab routing with conservative fallbacks

### Evidence
- Quran 4:7, 4:11, 4:12, 4:176, 9:60, etc.
- Sahih al-Bukhari 6732, 1447; Sahih Muslim 1615a

### Other
- English / Urdu / Roman Urdu
- RTL support
- Glossary
- Local history
- Methodology selection on first launch

## Tech

- Static PWA (HTML + ES modules + Tailwind CDN)
- No build step required for deployment
- Live metal/currency rates via [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api)
- Service Worker for offline app shell

## Deploy to GitHub Pages

1. Create repo `miqdaar` (or your name)
2. Push contents of this folder to `main` (or `gh-pages`)
3. Enable GitHub Pages → Deploy from branch
4. Point custom domain `miqdaar.online` to GitHub Pages

```bash
# Example
git init
git add .
git commit -m "Miqdaar V1 — Faraid & Zakat calculator"
git branch -M main
git remote add origin https://github.com/YOUR_USER/miqdaar.git
git push -u origin main
```

## Ads strategy (ethical)

- **Never** interrupt Zakat calculation, inheritance result, Quran, or Hadith reading
- Place ads only on: Home (below fold), Learn list, Glossary, History, Settings
- Prefer non-intrusive formats (display, not interstitial)
- Clear labeling
- Optional later: voluntary donation / "support the project" instead of aggressive ads

## Groq Chatbot (optional)

For the "Ask Islamic Calculator" assistant:

- Use Groq API **only** for explanation of already-calculated results and retrieval from the verified evidence base
- System prompt must forbid inventing rulings, Quran, or Hadith
- Never let the model perform inheritance math
- Keep API key on a serverless proxy if possible (do not expose in client for production)

## Roadmap

- V1.1: More sibling edge cases, better live currency conversion
- V2: Grandfather + siblings, advanced Ja'fari, full compare mode, scholar review panel
- Admin rule versioning

## Disclaimer

This application provides educational calculations based on the selected Islamic jurisprudential methodology. It is not a fatwa and does not replace a qualified mufti, Islamic scholar, lawyer, accountant or estate professional.

## License

Educational use. Rules and evidence should be reviewed by qualified scholars before relying on them for real distributions.
