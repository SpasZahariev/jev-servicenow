---
name: jev-snowform
description: Run the local Service Now release-form demo with Jev decisions and text-model narratives, independently of the React server. Use for demonstrating DOM-based form filling or adapting the synthetic release scenario.
---

# Jev release-form demo

Run from the repository root. This skill's deterministic helper is
`skills/jev-snowform/scripts/run.mjs`.

1. Start the replica separately with `npm start`. Leave that terminal running.
2. Check prerequisites with `npm run demo:jev -- --check`. Read `.env.example` for settings; never print `.env` or credentials.
3. Launch `npm run demo:jev`. It opens a separate visible browser, fills the release with live model calls, saves a draft, and keeps the browser open for inspection. Close the window or press Ctrl+C to finish.

The run makes paid TypeSafe and OpenAI-compatible text-model requests. It reads controls from the live DOM, never screenshots. Jev chooses dropdown values, reference records, multi-record membership, radio values, and checkboxes. The executor uses observed record IDs and stable form attributes. Exact release facts, searches, navigation, dates, attachments, and save operations are deterministic. The text model writes the large narrative fields in one request. No mock provider or canned narrative fallback exists in the demo command.

The default synthetic hotfix exercises every conditional field: Emergency justification, LUX approval, planned outage, security review, and customer communication. Read or edit [assets/release.json](assets/release.json) to change the story. All lookup selections must exist in the local demo catalog. Deployment dates are calculated at launch, not hardcoded in the past.

## Options

```sh
npm run demo:jev -- --url http://127.0.0.1:5173
npm run demo:jev -- --scenario /path/to/release.json
npm run demo:jev -- --submit
npm run demo:jev -- --headless --close
```

`--submit` submits only to Confirm Release. It never approves, starts, or closes the change. The default only saves a draft.

An isolated browser context prevents overwriting a user's existing draft. Results and credential-free decision logs are written under `artifacts/jev/`. Browser-local saves disappear when the isolated browser closes; the exported result file remains. Attachments contain synthetic evidence and the replica stores metadata only.

Only loopback replica URLs are allowed. API overrides must use HTTPS; local HTTP endpoints are allowed for provider testing. API calls, timeouts, and retry counts are bounded. A missing key, malformed model response, stale control, mismatched selection, or failed outcome verification stops the run. Keep the visible failed form for diagnosis; do not repeatedly restart paid runs or weaken verification to make a demo appear successful.

## Validate changes

```sh
npm run lint
npm run build
BROWSER_EXECUTABLE=/path/to/brave npm run test:jev
```

The tests use explicitly simulated model responses and real browser interaction, including API-response and outcome-validation failures. They do not establish live model performance. A live run is required before claiming the configured providers work.
