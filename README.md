# Software component release demo

React and TypeScript replica of the Change Request form in `snow-photos/`.
The form has no animations or external ServiceNow integration. The separate
automation runner calls Jev and a text-generation model.

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

For a presentation-paced run with an inspector outline:

```sh
npm run demo:jev
```

The demo defaults to `--pace realistic` with the inspector enabled.
Each control is highlighted before input, filled individually, and held visible
after input before the next control starts. Controls are never filled concurrently.

Realistic pacing pauses 650 ms before each input and 850 ms after it. Generated
narrative fields get a 2.2-second review pause after insertion. Model calls keep
their actual latency, without artificial inference delays. Text is inserted
as a complete generated field, not fake character-by-character human typing.
The default scenario takes roughly 1-2 minutes, plus provider latency.
This is a presentation of real automation, not a claim that a human fills a
release form at this speed.

For multiplier-based playback, use `--speed 0.05 --inspector`. An explicit speed
without `--pace` selects scaled mode. To slow realistic pacing further, use
`--pace realistic --speed 0.5`.
`--inspector` draws a teal outline for selections, buttons, and deterministic
demo steps, and a purple outline while text-model output is entered.
Its badge identifies the actual source and shows the current control's
DOM label. It works inside lookup dialogs and scrolls offscreen targets into
view. It adds no animations and does not intercept input. The outline clears
after successful completion. The inspector uses exactly one thick border overlay,
without an additional input outline or inset border. To restore the
fast run, use `npm run demo:jev -- --speed 1 --no-inspector`.

The runner reads `.env` in Node, not the browser. Configure `TYPESAFE_API_KEY`,
`TYPESAFE_MODEL`, `TEXT_MODEL_API_KEY`, `TEXT_MODEL_BASE_URL`, and `TEXT_MODEL` as
shown in `.env.example`. `TYPESAFE_BASE_URL` is an optional API root override.
Node 22.9 or later is required.

The automation opens a new foreground tab in your currently open Chromium-compatible browser and fills a
fictional client-facing security hotfix. The default story exercises all
conditional fields, searchable reference modals, multiple applications and
repositories, schedules, risk controls, work notes, and attachment metadata.

Jev makes eighteen real requests in the default run. Dropdown questions and
multi-record membership decisions are batched in a single request per group.
Choices come from the live DOM. Each of the eight narrative fields gets a
separate Jev delegation decision followed by its own text-model request.
The field is teal while Jev decides, then purple during generation and insertion.
Previously, narrative generation was scheduled directly by the script. It is now
explicitly gated by Jev. Text generation is for open-ended fields, not a fallback
that silently replaces failed finite-choice decisions. Exact version, dates, reference numbers,
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

## Build a Jev skill for another ServiceNow form

Use this demo as a pattern, not a generic production ServiceNow connector.
The runner currently accepts only local replica URLs.

### Write the skill

Keep `SKILL.md` short: when to use it, prerequisites, the launch command,
permitted actions, success criteria, and when to stop. Put executable browser
logic in scripts and release facts in a separate JSON file.

```text
skills/my-servicenow-form/
  SKILL.md
  assets/request.json
  scripts/run.mjs
```

```markdown
---
name: my-servicenow-form
description: Fill the approved ServiceNow request form using Jev choices and delegated narrative generation.
---

Read assets/request.json. Check browser access and model configuration.
Run the helper from the repository root.
Use observed DOM controls and record IDs, never model-generated selectors.
Fill one field at a time. Verify references and conditional requirements.
Save a draft by default; require explicit authorization before submitting.
Stop on missing facts, invalid choices, changed controls, or validation errors.
Never print credentials or invent approvals and test evidence.
```

### Implement the browser loop

1. **Observe.** Read field labels, types, current values, required state, visible
   options, and lookup results. Prefer stable IDs or accessible labels. Handle
   the target form's frames and custom controls explicitly.
2. **Ask Jev.** Send the request facts and observed state to
   `/v1/systemone`. Use `type: "choice"` questions with criteria keyed by
   observed option or record IDs. Batch independent choices if useful.
3. **Execute.** Validate the returned choice and probabilities, recheck the
   control, then apply the selected value through normal browser input.
   Keep selectors and execution in trusted code.
4. **Delegate narratives.** Offer Jev `use_text_model` or `blocked`. On delegation,
   send the field label, request facts, and writing requirements to the text
   model. Validate its JSON and length before inserting. Do not use generation
   to silently recover from an invalid finite-choice decision.
5. **Reobserve and verify.** Open relevant tabs and lookup dialogs, select actual
   records rather than just typing display names, and fill newly required fields.
   Check the final values, resolved references, schedule, errors, and saved state.

### Reuse this implementation

- `assets/release.json`: fictional request facts, lookup queries, schedule, evidence.
- `scripts/automation.mjs`: DOM observations, Jev questions, field execution, verification.
- `scripts/models.mjs`: provider requests, budgets, retries, response validation.
- `scripts/browser.mjs`: attach to the open browser and create an owned tab.
- `scripts/presentation.mjs`: sequential pacing and teal-to-purple handoff.

These paths are relative to `skills/jev-snowform/`. The skill guides the agent;
the helper performs the actual automation. Editing `SKILL.md` alone does not
change the helper's selectors or routing.

For a real ServiceNow instance, replace the replica selectors and local-storage
checks, authenticate through the authorized browser session, restrict navigation
to approved instance hosts, and verify the saved record in ServiceNow itself.
Confirm that request data may be sent to the configured model providers.
Keep secrets outside browser code and logs. Test against a non-production
instance, including invalid references, hidden fields, stale DOM, provider errors,
and failed saves. Mock-provider tests prove execution behavior; only a live
provider run verifies the model integration.
