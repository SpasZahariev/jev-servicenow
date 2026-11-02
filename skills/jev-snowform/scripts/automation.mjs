import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createPresentation } from './presentation.mjs';

export const defaultScenario = new URL('../assets/release.json', import.meta.url);

function localDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function loadScenario(path = defaultScenario, now = new Date()) {
  const scenario = JSON.parse(await readFile(path, 'utf8'));
  const { fields, schedule, lookup_queries: queries, evidence } = scenario;
  const stringFields = [
    'requested_by',
    'type',
    'category',
    'change_impact',
    'assignment_group',
    'release_manager',
    'release_manager_deputy',
    'lux_related',
    'lux_approval',
    'short_description',
    'release_version',
    'environment',
    'risk_level',
    'customer_impact',
    'outage_minutes',
    'security_reference',
  ];
  if (
    !scenario.title ||
    typeof scenario.brief !== 'string' ||
    !fields ||
    stringFields.some((key) => typeof fields[key] !== 'string' || !fields[key].trim()) ||
    ['components', 'repositories'].some(
      (key) =>
        !Array.isArray(fields[key]) ||
        !fields[key].length ||
        fields[key].some((name) => typeof name !== 'string' || !name.trim()) ||
        new Set(fields[key]).size !== fields[key].length,
    ) ||
    ['outage_required', 'security_review'].some((key) => typeof fields[key] !== 'boolean') ||
    !queries ||
    Object.values(queries).some((query) => typeof query !== 'string') ||
    !schedule ||
    !Number.isInteger(schedule.days_from_now) ||
    schedule.days_from_now < 1 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.start_time) ||
    !Number.isInteger(schedule.duration_minutes) ||
    schedule.duration_minutes < 1 ||
    schedule.duration_minutes > 1440 ||
    !evidence ||
    typeof evidence.name !== 'string' ||
    typeof evidence.text !== 'string'
  )
    throw new Error(
      'Scenario is invalid. Check the release fields, lookup queries, and future schedule.',
    );
  if (fields.release_manager === fields.release_manager_deputy) {
    throw new Error('The scenario must use different release and deputy managers.');
  }
  const start = new Date(now);
  start.setDate(start.getDate() + schedule.days_from_now);
  const [hours, minutes] = schedule.start_time.split(':').map(Number);
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + schedule.duration_minutes * 60000);
  scenario.fields = {
    ...fields,
    implementation_start: localDateTime(start),
    implementation_end: localDateTime(end),
  };
  scenario.schedule.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return scenario;
}

export function validateReplicaUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Replica URL is invalid.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('The automation only supports a loopback Service Now replica.');
  return url.href;
}

function indexed(items) {
  return Object.fromEntries(items.map((item, index) => [`r${index + 1}`, item]));
}

async function readSelects(page, keys) {
  const result = [];
  for (const id of keys) {
    const value = await page.locator(`#${id}`).evaluate((element) => ({
      id: element.id,
      label: element.getAttribute('data-field-label'),
      current_value: element.value,
      options: Array.from(element.options)
        .filter((option) => option.value && !option.disabled)
        .map((option) => ({
          value: option.value,
          label: option.label,
        })),
    }));
    if (!value.options.length) throw new Error(`No observed options for ${id}.`);
    result.push(value);
  }
  return result;
}

async function ensureUnchanged(before, read, label) {
  if (JSON.stringify(before) !== JSON.stringify(await read())) {
    throw new Error(`${label} changed during inference. No pending batch was applied.`);
  }
}

async function selectFields(page, keys, scenario, models, log, signal, act) {
  const observed = await readSelects(page, keys);
  const questions = Object.fromEntries(
    observed.map((field) => [
      field.id,
      {
        criteria: indexed(field.options),
        goal: `Choose ${field.label} for the requested release. Match release.fields.${field.id}.`,
      },
    ]),
  );
  const answers = await models.choose({
    phase: 'dropdowns',
    intent: scenario,
    observed,
    questions,
    signal,
  });
  await ensureUnchanged(observed, () => readSelects(page, keys), 'Dropdown state');
  for (const field of observed) {
    const option = questions[field.id].criteria[answers[field.id].choice];
    if (option.value !== scenario.fields[field.id])
      throw new Error(`Jev selected a value inconsistent with the brief for ${field.id}.`);
    const input = page.locator(`#${field.id}`);
    await act(input, () => input.selectOption(option.value));
    log({ kind: 'action', source: 'jev', field: field.id, value: option.value });
  }
}

async function readRows(dialog) {
  return dialog.locator('tbody tr[data-record-id]').evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.getAttribute('data-record-id'),
      name: row.getAttribute('data-record-name'),
      description: row.innerText.trim(),
      selected: row.querySelector('input[type="checkbox"]')?.checked ?? false,
    })),
  );
}

async function lookupField(page, field, multiple, scenario, models, log, signal, act) {
  const opener = page.locator(`#${field}-lookup`);
  await act(opener, () => opener.click(), 'scenario');
  const dialog = page.locator(`#lookup-${field}`);
  await dialog.waitFor({ state: 'visible' });
  const query = scenario.lookup_queries[field] || '';
  const search = page.locator(`#${field}-modal-search`);
  await act(search, () => search.fill(query), 'scenario');
  log({ kind: 'action', source: 'scenario', field: `${field}_search`, value: query });
  const observed = await readRows(dialog);
  if (!observed.length) throw new Error(`No lookup results for ${field}.`);
  const requested = scenario.fields[field];
  const names = multiple ? requested : [requested];
  if (names.some((name) => !observed.some((record) => record.name === name))) {
    throw new Error(`A requested ${field} record is absent from the live lookup results.`);
  }
  const questions = multiple
    ? Object.fromEntries(
        observed.map((record, index) => [
          `record_${index + 1}`,
          {
            criteria: {
              include: { record_name: record.name, selected: true },
              exclude: { record_name: record.name, selected: false },
            },
            goal: `Should ${record.name} be included in release.fields.${field}? Include exactly the requested records.`,
          },
        ]),
      )
    : {
        record: {
          criteria: indexed(observed),
          goal: `Choose the record whose name matches release.fields.${field}.`,
        },
      };
  const answers = await models.choose({
    phase: `lookup:${field}`,
    intent: scenario,
    observed,
    questions,
    signal,
  });
  await ensureUnchanged(observed, () => readRows(dialog), `${field} records`);
  if (multiple) {
    const selected = observed.filter(
      (_, index) => answers[`record_${index + 1}`].choice === 'include',
    );
    if (
      selected.length !== names.length ||
      selected.some((record) => !names.includes(record.name))
    ) {
      throw new Error(`Jev ${field} membership does not match the release brief.`);
    }
    // Apply all membership decisions, including deselection, before committing the modal.
    for (const [index, record] of observed.entries()) {
      const checkbox = dialog.getByRole('checkbox', { name: `Select ${record.name}`, exact: true });
      await act(checkbox, () =>
        checkbox.setChecked(answers[`record_${index + 1}`].choice === 'include'),
      );
    }
    const apply = page.locator(`#${field}-lookup-apply`);
    await act(apply, () => apply.click());
    log({
      kind: 'action',
      source: 'jev',
      field,
      value: selected.map((record) => ({ id: record.id, name: record.name })),
    });
  } else {
    const selected = questions.record.criteria[answers.record.choice];
    if (selected.name !== requested)
      throw new Error(`Jev ${field} record does not match the release brief.`);
    const button = dialog.getByRole('button', { name: selected.name, exact: true });
    await act(button, () => button.click());
    log({ kind: 'action', source: 'jev', field, value: { id: selected.id, name: selected.name } });
  }
  await dialog.waitFor({ state: 'hidden' });
}

async function chooseRiskControls(page, scenario, models, log, signal, act) {
  const read = () =>
    page.evaluate(() => {
      const radioInputs = [...document.querySelectorAll('input[name="customer_impact"]')];
      return [
        {
          id: 'customer_impact',
          current_value: radioInputs.find((input) => input.checked)?.value,
          options: radioInputs.map((input) => ({ value: input.value, label: input.value })),
        },
        ...['outage_required', 'security_review'].map((id) => {
          const element = document.getElementById(id);
          if (!(element instanceof HTMLInputElement) || element.type !== 'checkbox')
            throw new Error('Checkbox not found');
          return {
            id,
            current_value: element.checked,
            options: [
              { value: true, label: `Yes: ${element.getAttribute('data-field-label')}` },
              { value: false, label: `No: ${element.getAttribute('data-field-label')}` },
            ],
          };
        }),
      ];
    });
  const observed = await read();
  const questions = Object.fromEntries(
    observed.map((field) => [
      field.id,
      {
        criteria: indexed(field.options),
        goal: `Set ${field.id} to match the release brief and release.fields.${field.id}.`,
      },
    ]),
  );
  const answers = await models.choose({
    phase: 'risk-controls',
    intent: scenario,
    observed,
    questions,
    signal,
  });
  await ensureUnchanged(observed, read, 'Risk controls');
  for (const field of observed) {
    const selected = questions[field.id].criteria[answers[field.id].choice];
    if (selected.value !== scenario.fields[field.id])
      throw new Error(`Jev ${field.id} choice does not match the release brief.`);
    if (typeof selected.value === 'boolean') {
      const input = page.locator(`#${field.id}`);
      await act(input, () => input.setChecked(selected.value));
    } else {
      const input = page.getByRole('radio', { name: selected.value, exact: true });
      await act(input, () => input.check());
    }
    log({ kind: 'action', source: 'jev', field: field.id, value: selected.value });
  }
}

async function fillFact(page, scenario, key, log, act) {
  const input = page.locator(`#${key}`);
  if (!(await input.count())) return;
  await act(input, () => input.fill(scenario.fields[key]), 'scenario');
  log({ kind: 'action', source: 'scenario', field: key, value: scenario.fields[key] });
}

async function verify(page, scenario, narratives, submitted) {
  // Independent DOM inspection, without reading React state or importing its validator.
  const actual = await page.evaluate(() => {
    const values = {};
    const references = {};
    const selectedNames = {};
    for (const element of document.querySelectorAll('[data-field]')) {
      const id = element.getAttribute('data-field');
      if (element instanceof HTMLInputElement) {
        values[id] = element.type === 'checkbox' ? element.checked : element.value;
        if (element.getAttribute('data-input-kind') === 'reference') {
          references[id] = element
            .closest('[data-reference-id]')
            ?.getAttribute('data-reference-id');
        }
      } else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        values[id] = element.value;
      } else if (element.getAttribute('data-input-kind') === 'multi-reference') {
        values[id] = JSON.parse(element.getAttribute('data-selected-ids'));
        selectedNames[id] = [...element.querySelectorAll('.selected-record strong')].map(
          (name) => name.textContent,
        );
      } else if (element.getAttribute('role') === 'radiogroup') {
        values[id] = element.querySelector('input:checked')?.value;
      }
    }
    const required = [...document.querySelectorAll('[data-required="true"]')].map((element) =>
      element.id.replace(/^field-/, ''),
    );
    const errors = [...document.querySelectorAll('.field-error')].map(
      (element) => element.textContent,
    );
    const notes = [...document.querySelectorAll('.activity-entry p')].map(
      (element) => element.textContent,
    );
    const attachmentNames = [...document.querySelectorAll('.attachment-list li>span')].map(
      (element) => element.textContent,
    );
    return { values, references, selectedNames, required, errors, notes, attachmentNames };
  });
  const failed = [];
  for (const [key, expected] of Object.entries(scenario.fields)) {
    // A custom scenario can intentionally hide a dependent field.
    if (
      !(key in actual.values) &&
      ['lux_approval', 'security_reference', 'outage_minutes'].includes(key)
    )
      continue;
    if (Array.isArray(expected)) {
      const names = actual.selectedNames[key] || [];
      if (names.length !== expected.length || expected.some((name) => !names.includes(name)))
        failed.push(key);
    } else if (actual.values[key] !== expected) failed.push(key);
  }
  for (const [key, expected] of Object.entries(narratives)) {
    if (key === 'work_notes') {
      if (!actual.notes.includes(expected) || actual.values.work_notes !== '') failed.push(key);
    } else if (actual.values[key] !== expected) failed.push(key);
  }
  for (const key of actual.required) {
    const value = actual.values[key];
    if (Array.isArray(value) ? !value.length : !String(value ?? '').trim())
      failed.push(`required:${key}`);
  }
  for (const [key, id] of Object.entries(actual.references))
    if (!id) failed.push(`reference:${key}`);
  if (actual.values.implementation_end <= actual.values.implementation_start)
    failed.push('date-order');
  if (actual.values.stage !== (submitted ? 'Confirm Release' : 'Draft')) failed.push('stage');
  if (!actual.attachmentNames.includes(scenario.evidence.name)) failed.push('attachment');
  if (actual.errors.length) failed.push('form-validation');
  if (failed.length)
    throw new Error(`Independent form verification failed: ${[...new Set(failed)].join(', ')}.`);
  return actual;
}

export async function runAutomation({
  page,
  scenario,
  models,
  log = (event) => {
    void event;
  },
  submit = false,
  speed = 1,
  pace = 'scaled',
  inspector = false,
  signal = undefined,
}) {
  const started = performance.now();
  const presentation = createPresentation({ page, speed, pace, inspector, signal, log });
  const act = presentation.act;
  const realModels = models;
  models = {
    ...realModels,
    choose: (args) => presentation.infer(() => realModels.choose(args)),
    narratives: (args) => presentation.infer(() => realModels.narratives(args)),
  };
  const click = async (id) => {
    const input = page.locator(`#${id}`);
    await act(input, () => input.click(), 'scenario');
  };
  await page.locator('#software-component-release').waitFor();
  if ((await page.locator('#stage').inputValue()) !== 'Draft') {
    throw new Error(
      'Open a fresh demo Draft. The automation will not reset an existing submitted record.',
    );
  }
  await selectFields(
    page,
    ['type', 'category', 'change_impact', 'lux_related'],
    scenario,
    models,
    log,
    signal,
    act,
  );
  for (const key of [
    'requested_by',
    'assignment_group',
    'release_manager',
    'release_manager_deputy',
  ]) {
    await lookupField(page, key, false, scenario, models, log, signal, act);
  }
  for (const key of ['components', 'repositories']) {
    await lookupField(page, key, true, scenario, models, log, signal, act);
  }
  for (const key of ['lux_approval', 'short_description'])
    await fillFact(page, scenario, key, log, act);
  await click('tab-planning');
  await selectFields(page, ['environment'], scenario, models, log, signal, act);
  for (const key of ['release_version', 'implementation_start', 'implementation_end'])
    await fillFact(page, scenario, key, log, act);
  await click('tab-risk');
  await selectFields(page, ['risk_level'], scenario, models, log, signal, act);
  await chooseRiskControls(page, scenario, models, log, signal, act);
  for (const key of ['outage_minutes', 'security_reference'])
    await fillFact(page, scenario, key, log, act);

  const fields = await page
    .locator('textarea[data-input-kind="generated-text"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.id,
        label: element.getAttribute('data-field-label') || 'Work notes',
        section: element.getAttribute('data-section') || 'activities',
        hint: element.placeholder,
        current_value: element.value,
      })),
    );
  const narratives = {};
  await ensureUnchanged(
    fields,
    () =>
      page.locator('textarea[data-input-kind="generated-text"]').evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.id,
          label: element.getAttribute('data-field-label') || 'Work notes',
          section: element.getAttribute('data-section') || 'activities',
          hint: element.placeholder,
          current_value: element.value,
        })),
      ),
    'Narrative fields',
  );
  for (const section of ['details', 'planning', 'risk', 'activities']) {
    if (section !== 'details') await click(`tab-${section}`);
    for (const field of fields.filter((field) => field.section === section)) {
      const input = page.locator(`#${field.id}`);
      const current = await input.inputValue();
      const routing = await act(
        input,
        () =>
          models.choose({
            phase: `delegate:${field.id}`,
            intent: scenario,
            observed: [field],
            questions: {
              operation: {
                criteria: {
                  use_text_model:
                    'Delegate this open-ended narrative to the text-generation model.',
                  blocked:
                    'Stop because this narrative cannot be safely produced from the fictional release brief.',
                },
                goal: `Choose how to complete ${field.label}. This is an open-ended narrative, not a finite-choice input. Use the text model when the synthetic release brief provides enough facts. Never invent real test evidence.`,
              },
            },
            signal,
          }),
        'jev',
      );
      if (routing.operation.choice !== 'use_text_model') {
        throw new Error(`Jev declined text-model delegation for ${field.id}.`);
      }
      log({ kind: 'delegation', source: 'jev', field: field.id, decision: 'use_text_model' });
      await act(
        input,
        async () => {
          const generated = await models.narratives({ scenario, fields: [field], signal });
          if ((await input.inputValue()) !== current) {
            throw new Error(`${field.id} changed during text generation. Nothing typed.`);
          }
          narratives[field.id] = generated[field.id];
          await input.fill(generated[field.id]);
        },
        'text-model',
      );
      log({
        kind: 'action',
        source: 'text-model',
        field: field.id,
        characters: narratives[field.id].length,
      });
    }
  }
  await click('post-work-note');
  await act(
    page.locator('#add-attachment-bottom'),
    () =>
      page.locator('#attachments').setInputFiles({
        name: scenario.evidence.name,
        mimeType: 'text/plain',
        buffer: Buffer.from(scenario.evidence.text),
      }),
    'scenario',
  );
  // Fail before saving/submitting if a field did not receive its requested value.
  await verify(page, scenario, narratives, false);
  await click('save-header');
  if (submit) {
    await click('submit-header');
    await page.locator('#software-component-release[data-stage="Confirm Release"]').waitFor();
  }
  const actual = await verify(page, scenario, narratives, submit);
  const saved = await page.evaluate(() => {
    const demoRun = new URLSearchParams(location.search).get('demo_run');
    const key =
      demoRun && /^[a-zA-Z0-9-]{1,64}$/.test(demoRun)
        ? `snow-release-demo:v1:demo:${demoRun}`
        : 'snow-release-demo:v1';
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  });
  if (!saved || saved.form.short_description !== scenario.fields.short_description) {
    throw new Error('The browser did not persist the completed draft.');
  }
  await presentation.clear();
  await page.locator('#tab-planning').click();
  await page
    .locator('#main-content')
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  return {
    verified: true,
    mode: submit ? 'submitted' : 'saved-draft',
    elapsed_ms: Math.round(performance.now() - started),
    model_statistics: { ...models.statistics },
    presentation: presentation.statistics(),
    scenario,
    form: actual.values,
    reference_ids: actual.references,
    selected_names: actual.selectedNames,
    saved_record: saved,
  };
}
