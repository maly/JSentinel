# JSentinel

[![CI](https://github.com/maly/JSentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/maly/JSentinel/actions/workflows/ci.yml)

## Testy

```sh
npm ci
npm test
```

`npm test` spouští Node testy pravidel (`test/rules.test.mjs`) i Python testy serveru (`test/test_serve.py`). Vyžaduje **Node 22** a **Python 3** dostupný jako příkaz `python`.

## Build

`docs/` je generovaný výstup Vite buildu (GitHub Pages) a je verzovaný. Po změně zdrojů (`index.html`, `js/`, `public/`) spusť před commitem:

```sh
npm run build
```

CI kontroluje, že commitnutý `docs/` odpovídá výstupu `npm run build`.
