# Software component release demo

React and TypeScript replica of the Change Request form in `snow-photos/`.
No animations, external integrations, or model API calls.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

```sh
npm run build
npm run lint
npm test
```

Tests need an installed Playwright Chromium browser, or an existing Chromium-compatible executable:

```sh
npx playwright install chromium
BROWSER_EXECUTABLE=/path/to/brave npm test
```

## Form behavior

- Native dropdowns, radio buttons, checkboxes, date/time inputs, reference inputs with native suggestions, search/filter modals, and multi-record selectors.
- Schedule and Planning, Risk and Impact, and Activities tabs.
- LUX approval appears for LUX-related releases. Emergency changes require a justification.
- Outage and security checkboxes reveal their dependent fields. High risk or customer impact reveals a communication plan.
- Validation checks required fields, catalog references, distinct release managers, date ordering, and outage duration. Error links open the relevant tab and focus the field.
- Save keeps the draft, workflow stage, notes, and attachment metadata in browser local storage under `snow-release-demo:v1`. Edits are not automatically saved.
- Submit advances the local workflow through Draft, Confirm Release, Approval, Implementing, Implemented, and Closed. These are simulated steps, not actual approvals or deployments. Editing a submitted release returns it to Draft.
- Export JSON downloads current form values, workflow status, notes, and attachment metadata.
- Attachments keep filename, MIME type, and size only. File contents are never uploaded or persisted. Files above 20 MB are rejected.
- Reset requires confirmation and clears the saved record.
- Reference catalogs contain fictional demo records. Names visible in the supplied screenshots are used as display labels with example email addresses.

## DOM automation contract

Use DOM queries and normal browser input events. No screenshots are necessary.

The form is `#software-component-release`, with `data-record-type`, `data-stage`, and `data-status`.

Editable fields have stable snake-case `id`, `name`, `data-field`, and `data-testid` values. Single-value fields also expose `data-field-label`, `data-section`, `aria-required`, and `aria-invalid`. Field wrappers use `#field-{field}` and `data-required`. Read-only system fields include `number`, `status`, and `stage`.

```js
document.querySelector('[data-field="short_description"]');
document.querySelector('textarea[data-input-kind="generated-text"]');
document.querySelector('#assignment_group-lookup');
```

### References

Single references: `requested_by`, `assignment_group`, `release_manager`, `release_manager_deputy`.

- Inputs have `data-input-kind="reference"` and `data-catalog`.
- Type an exact record name or ID and dispatch normal input events, or open the lookup.
- Lookup buttons: `#{field}-lookup`, `data-action="open-lookup"`.
- Dialog: `#lookup-{field}`.
- Search input: `#{field}-modal-search`.
- Filter: `#{field}-modal-filter`.
- Rows: `data-record-id` and `data-record-name`.
- Select button: `#select-{field}-{record-id}`.
- Reference containers expose the resolved `data-reference-id`.

Multiple references: `components`, `repositories`.

- Group: `#{field}`, `data-input-kind="multi-reference"`.
- Current IDs: JSON in `data-selected-ids`, also repeated hidden inputs named after the field.
- Search below the selected list filters selected records only. Use the lookup modal to search the full catalog.
- Checkbox: `#select-{field}-{record-id}`.
- Apply: `#{field}-lookup-apply`. Cancel does not apply pending choices.
- Remove: `#remove-{field}-{record-id}`.

### Text generation fields

All large text areas have `data-input-kind="generated-text"`:

`description`, `emergency_reason`, `change_plan`, `rollback_plan`, `test_plan`, `risk_analysis`, `communication_plan`, `work_notes`.

`work_notes` is a pending activity note, not part of the release fields. Post with `#post-work-note`, then save the draft.

### Tabs and conditional fields

- Tabs: `#tab-planning`, `#tab-risk`, `#tab-activities`.
- Panels: `#panel-planning`, `#panel-risk`, `#panel-activities`.
- Inactive panels stay mounted with native `hidden` attributes. Open the tab before interacting with its fields.
- Conditional fields are mounted only when their condition matches. Wrappers expose `data-visible-when`.
- Use DOM visibility and `aria-required` instead of assuming every field is currently required.
- Values entered into a conditional field remain in React state if it is hidden. Hidden conditional values are included in JSON exports but ignored by validation.

### Actions

Header and footer buttons use `#save-header`, `#save-footer`, `#submit-header`, `#submit-footer`, `#start-change-header`, and `#start-change-footer`.

Actions also expose `data-action="save-draft"`, `"submit-release"`, `"start-change"`, or `"export-json"`. `#export-json` downloads the current record without requiring submission.

Validation errors use `#{field}-error` and `role="alert"`. Notifications use `role="status"`. Workflow steps expose `data-stage` and `data-stage-status`.

## Jev automation demo

Start the form and the automation independently in two terminals:

```sh
# Terminal 1
npm start

# Terminal 2
npm run demo:jev -- --check
npm run demo:jev
```

The runner reads `.env` in Node, not the browser. Configure `TYPESAFE_API_KEY`,
`TYPESAFE_MODEL`, `TEXT_MODEL_API_KEY`, `TEXT_MODEL_BASE_URL`, and `TEXT_MODEL` as
shown in `.env.example`. `TYPESAFE_BASE_URL` is an optional API root override.
Node 22.9 or later is required.

The automation opens a new foreground tab in your currently open Chromium-compatible browser and fills a
fictional client-facing security hotfix. The default story exercises all
conditional fields, searchable reference modals, multiple applications and
repositories, schedules, risk controls, work notes, and attachment metadata.

Jev makes ten real requests in the default run. Dropdown questions and
multi-record membership decisions are batched in a single request per group.
Choices come from the live DOM. A separate text-model request generates all
eight narrative fields together. Exact version, dates, reference numbers,
short description, and outage duration come from the scenario; deterministic
browser code performs navigation, searches, input, posting notes, and saving.
No screenshots, agent swarm, prewritten narrative fallback, or model-generated
selectors are used.

The runner validates every model response, rechecks observed controls before
applying decisions, and independently verifies the final form before saving.
Missing keys, unavailable providers, incorrect choices, and invalid generated
text stop the demo instead of silently using fake model output.

```sh
# Optional override for your open browser's local debugging endpoint
npm run demo:jev -- --cdp http://127.0.0.1:9222

# Explicitly launch a separate isolated browser instead
BROWSER_EXECUTABLE=/path/to/brave npm run demo:jev -- --new-browser

# Submit only to Confirm Release, never approve or deploy
npm run demo:jev -- --submit

# Unattended validation; close the browser after the run
npm run demo:jev -- --headless --close

# Alternative local replica or synthetic scenario
npm run demo:jev -- --url http://127.0.0.1:5173
npm run demo:jev -- --scenario /path/to/release.json

# Offline model fixtures with real browser interactions
BROWSER_EXECUTABLE=/path/to/brave npm run test:jev
```

Successful runs save `result.json` and credential-free `trace.jsonl` under
`artifacts/jev/<timestamp>/`. The terminal prints model latency and applied fields.
By default the runner disconnects after completion and leaves the new tab open.
It never closes your existing browser or touches other tabs. `--close` closes only
the demo tab. Ctrl+C disconnects without closing it.

Your browser must expose a local CDP debugging endpoint. The default is
`http://127.0.0.1:9222`; set `BROWSER_CDP_URL` or pass `--cdp` to change it.
The current local Brave setup already exposes this endpoint. If attachment fails,
the runner stops instead of silently launching another browser. Enabling remote
debugging in a different browser may require restarting it with its debugging
settings enabled. The runner will not restart your browser.

Each demo tab receives a unique `demo_run` URL parameter and a separate
local-storage draft key. Existing drafts remain untouched, and reloading the
same demo tab restores its filled release. `--new-browser` and `--headless`
use the previous isolated-browser behavior.

The repo-local agent skill is
[`skills/jev-snowform/SKILL.md`](skills/jev-snowform/SKILL.md). Tell an agent to use
that skill when running or adapting this demo. It is not installed into global
agent configuration. Its synthetic story is in
[`skills/jev-snowform/assets/release.json`](skills/jev-snowform/assets/release.json).
The design follows the decision/text split in the local `jev-ultrafast`
reference project without depending on its Python installation or browser
daemon.
