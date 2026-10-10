# JSentinel

[![CI](https://github.com/maly/JSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/maly/JSentinel/actions/workflows/ci.yml)

## Testy

```sh
npm ci
npm test
```

`npm test` spouští Node testy pravidel (`test/rules.test.mjs`) i Python testy serveru (`test/test_serve.py`). Vyžaduje **Node 22** a **Python 3** dostupný jako příkaz `python`.

## Build

`npm run build` generuje výstup Vite buildu do `docs/`. Složka **není verzovaná** (je v `.gitignore`):

```sh
npm run build
```

## Nasazení

GitHub Pages nasazuje workflow `pages` (`.github/workflows/pages.yml`) při každém pushi do `master` (nebo ručně přes *workflow_dispatch*). Workflow spustí testy, sestaví web a `docs/` publikuje jako Pages artefakt. V nastavení repa musí být Settings → Pages → Source nastavené na **GitHub Actions**.
