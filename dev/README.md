# Dev pipeline for hotel-sheet-sync.html

The shipped tool is built from `tool-template.html` (the `//__SHEETJS_HERE__`
marker is replaced with `package/dist/xlsx.full.min.js`).

Full check, from this directory (needs Node + `npm i --no-save playwright-core`):

    node extract-core.js     # pull the core-logic block out for Node
    node unit-tests.js       # pure-logic assertions
    node gen-fixture-real1.js
    node golden.js           # REAL-DATA fixtures: proposals must match expected.json exactly
    node gen-testdata.js
    node build.js built.html
    node e2e.js              # drives the built tool in Chromium

`fixtures/` holds golden pairs built from real (fake-data) spreadsheets supplied
by the user. Every wrong suggestion reported from the field should become a new
fixture pair + expected.json here before it is fixed.

Build the shippable file into the repo root with:

    node build.js ../hotel-sheet-sync.html
