import { test, expect, chromium } from '@playwright/test';
import {
  connectExistingBrowser,
  disconnectExistingBrowser,
  openDemoTab,
  validateCdpUrl,
} from '../skills/jev-snowform/scripts/browser.mjs';
// The production runner is plain Node ESM and is tested through its public functions.
import {
  loadScenario,
  runAutomation,
  validateReplicaUrl,
} from '../skills/jev-snowform/scripts/automation.mjs';
import {
  createModels,
  validateChoice,
  validateEndpoint,
} from '../skills/jev-snowform/scripts/models.mjs';

type Criteria = Record<string, { value?: unknown; name?: string; record_name?: string }>;
type Answer = { choice: string; confidence: number; probabilities: Record<string, number> };
type Question = { criteria: Criteria };
type Request = {
  model: string;
  state: { phase: string; release: { fields: Record<string, unknown> } };
  questions: Record<string, Question>;
  messages: { role: string; content: string }[];
};

function answer(choice: string, criteria: Criteria): Answer {
  return {
    choice,
    confidence: 1,
    probabilities: Object.fromEntries(
      Object.keys(criteria).map((key) => [key, key === choice ? 1 : 0]),
    ),
  };
}

function simulatedProvider({
  invalidChoice = false,
  wrongSelection = false,
  invalidText = false,
} = {}) {
  const requests: { url: string; body: Request }[] = [];
  const fetchImpl = async (url: string, options: RequestInit) => {
    const body: Request = JSON.parse(String(options.body));
    requests.push({ url, body });
    if (url.endsWith('/v1/systemone')) {
      const desired = body.state.release.fields;
      const lookupField = body.state.phase.split(':')[1];
      const answers = Object.fromEntries(
        Object.entries(body.questions).map(([key, question]) => {
          const { criteria } = question;
          let choice: string | undefined;
          if (key === 'record') {
            choice = Object.keys(criteria).find((id) => criteria[id].name === desired[lookupField]);
          } else if (key.startsWith('record_')) {
            const name = criteria.include.record_name;
            choice = (desired[lookupField] as string[]).includes(name!) ? 'include' : 'exclude';
          } else {
            choice = Object.keys(criteria).find((id) => criteria[id].value === desired[key]);
          }
          if (!choice) throw new Error(`Test fixture cannot resolve ${key}.`);
          if (wrongSelection) {
            choice = Object.keys(criteria).find((id) => id !== choice) || choice;
          }
          return [
            key,
            invalidChoice
              ? { ...answer(choice, criteria), choice: 'not-offered' }
              : answer(choice, criteria),
          ];
        }),
      );
      return Response.json({ model: 'simulated-jev', answers, usage: {} });
    }
    const context = JSON.parse(body.messages[1].content);
    const text = Object.fromEntries(
      context.requested_fields.map((field: { id: string }) => [
        field.id,
        `Synthetic demo ${field.id}: Release 2.4.1 isolates tenant caches. Alex Morgan and Data Platform deploy the signed build. Verify tenant separation and health checks. Restore 2.4.0 if checks fail. This is simulated evidence, not a real test result.`,
      ]),
    );
    return Response.json({
      choices: [
        { message: { content: JSON.stringify(invalidText ? { description: 'bad' } : text) } },
      ],
      usage: {},
    });
  };
  return { fetchImpl, requests };
}

const testConfig = {
  typesafeKey: 'test-only-not-a-real-secret',
  typesafeModel: 'jev-test',
  typesafeBase: 'https://api.typesafe.ai',
  textKey: 'test-only-not-a-real-secret',
  textBase: 'https://text.example.com/v1',
  textModel: 'text-test',
  reasoning: 'none',
};

test('existing-browser mode opens a new tab, preserves drafts, and disconnects safely', async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe('chromium');
  const port = 19400 + testInfo.workerIndex;
  const owner = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-sandbox', `--remote-debugging-port=${port}`],
  });
  let attached;
  try {
    attached = await connectExistingBrowser(`http://127.0.0.1:${port}`);
    const context = attached.contexts()[0];
    const original = await context.newPage();
    await original.goto('http://127.0.0.1:5173/');
    await original.locator('#short_description').fill('Keep my existing browser draft');
    await original.locator('#save-header').click();
    const before = await original.evaluate(() => localStorage.getItem('snow-release-demo:v1'));
    const originalUrl = original.url();
    const demo = await openDemoTab(attached, originalUrl);
    expect(demo.url()).toContain('demo_run=');
    await expect(demo.locator('#short_description')).toHaveValue('');
    const provider = simulatedProvider();
    const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
    expect(
      (await runAutomation({ page: demo, scenario: await loadScenario(), models })).verified,
    ).toBe(true);
    expect(await original.evaluate(() => localStorage.getItem('snow-release-demo:v1'))).toBe(
      before,
    );
    await disconnectExistingBrowser(attached, demo);
    expect(owner.isConnected()).toBe(true);
    attached = await connectExistingBrowser(`http://127.0.0.1:${port}`);
    const pages = attached.contexts()[0].pages();
    const keptOriginal = pages.find((page) => page.url() === originalUrl)!;
    const keptDemo = pages.find((page) => page.url().includes('demo_run='))!;
    await expect(keptOriginal.locator('#short_description')).toHaveValue(
      'Keep my existing browser draft',
    );
    await keptDemo.reload();
    await expect(keptDemo.locator('#release_version')).toHaveValue('2.4.1');
    await disconnectExistingBrowser(attached, keptDemo, true);
    expect(owner.isConnected()).toBe(true);
    attached = await connectExistingBrowser(`http://127.0.0.1:${port}`);
    expect(
      attached
        .contexts()[0]
        .pages()
        .some((page) => page.url().includes('demo_run=')),
    ).toBe(false);
    expect(
      attached
        .contexts()[0]
        .pages()
        .some((page) => page.url() === originalUrl),
    ).toBe(true);
  } finally {
    if (attached?.isConnected()) await attached.close();
    await owner.close();
  }
});

test('browser debugging connections reject non-local endpoints', () => {
  expect(() => validateCdpUrl('http://remote.example.com:9222')).toThrow('loopback');
  expect(() => validateCdpUrl('ws://user:password@localhost:9222')).toThrow();
  expect(validateCdpUrl('http://127.0.0.1:9222')).toBe('http://127.0.0.1:9222/');
});

test('Jev demo fills every active field with live DOM choices and simulated providers', async ({
  page,
}) => {
  await page.goto('/');
  const scenario = await loadScenario(undefined, new Date('2026-11-02T12:00:00'));
  const provider = simulatedProvider();
  const events: { kind: string; [key: string]: unknown }[] = [];
  const models = createModels(testConfig, {
    fetchImpl: provider.fetchImpl,
    log: (event: (typeof events)[number]) => events.push(event),
  });
  const result = await runAutomation({
    page,
    scenario,
    models,
    log: (event: (typeof events)[number]) => events.push(event),
  });
  expect(result.verified).toBe(true);
  expect(result.mode).toBe('saved-draft');
  expect(models.statistics.jev_calls).toBe(10);
  expect(models.statistics.text_calls).toBe(1);
  expect(provider.requests).toHaveLength(11);
  expect(result.form.lux_approval).toBe('LUX-DEMO-018');
  expect(result.form.outage_minutes).toBe('10');
  expect(result.form.security_reference).toBe('SEC-DEMO-041');
  expect(result.form.environment).toBe('Production');
  expect(result.form.risk_level).toBe('High');
  expect(result.form.customer_impact).toBe('Yes');
  expect(result.form.emergency_reason).toContain('Synthetic demo');
  expect(result.form.communication_plan).toContain('Synthetic demo');
  expect(result.selected_names.components).toEqual([
    'Clients Pillar AI Incubator',
    'Client Portal',
  ]);
  expect(
    result.saved_record.activities.some((entry: { kind: string }) => entry.kind === 'note'),
  ).toBe(true);
  expect(result.saved_record.attachments[0].name).toBe(scenario.evidence.name);
  expect(JSON.stringify(events)).not.toContain(testConfig.typesafeKey);
  await page.reload();
  await expect(page.locator('#release_version')).toHaveValue('2.4.1');
  await expect(page.locator('#stage')).toHaveValue('Draft');
});

test('optional submit stops at Confirm Release without approval or deployment', async ({
  page,
}) => {
  await page.goto('/');
  const scenario = await loadScenario();
  const provider = simulatedProvider();
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  const result = await runAutomation({ page, scenario, models, submit: true });
  expect(result.verified).toBe(true);
  expect(result.form.stage).toBe('Confirm Release');
  expect(result.saved_record.stage).toBe(1);
  await expect(page.locator('#stage')).toHaveValue('Confirm Release');
});

test('non-emergency scenario does not invent hidden dependent fields', async ({ page }) => {
  await page.goto('/');
  const scenario = await loadScenario();
  Object.assign(scenario.fields, {
    type: 'Normal',
    lux_related: 'No',
    risk_level: 'Low',
    customer_impact: 'No',
    outage_required: false,
    security_review: false,
  });
  const provider = simulatedProvider();
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  const result = await runAutomation({ page, scenario, models });
  expect(result.verified).toBe(true);
  for (const key of [
    'emergency_reason',
    'lux_approval',
    'outage_minutes',
    'security_reference',
    'communication_plan',
  ]) {
    expect(result.form).not.toHaveProperty(key);
  }
  const textRequest = provider.requests.find((request) =>
    request.url.endsWith('/chat/completions'),
  )!;
  expect(textRequest.body.messages[1].content).not.toContain('"id":"emergency_reason"');
});

test('invalid Jev probabilities stop before dropdown mutation', async ({ page }) => {
  await page.goto('/');
  const scenario = await loadScenario();
  const provider = simulatedProvider({ invalidChoice: true });
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  await expect(runAutomation({ page, scenario, models })).rejects.toThrow('Invalid Jev choice');
  await expect(page.locator('#type')).toHaveValue('Standard');
  expect(models.statistics.text_calls).toBe(0);
});

test('valid but wrong Jev choice is not silently replaced with a scripted answer', async ({
  page,
}) => {
  await page.goto('/');
  const provider = simulatedProvider({ wrongSelection: true });
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  await expect(runAutomation({ page, scenario: await loadScenario(), models })).rejects.toThrow(
    'inconsistent',
  );
  await expect(page.locator('#type')).toHaveValue('Standard');
});

test('malformed generated text is rejected without typing fallback narratives', async ({
  page,
}) => {
  await page.goto('/');
  const provider = simulatedProvider({ invalidText: true });
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  await expect(runAutomation({ page, scenario: await loadScenario(), models })).rejects.toThrow(
    'invalid narrative',
  );
  await expect(page.locator('#description')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('snow-release-demo:v1'))).toBeNull();
});

test('DOM changes during inference stop the pending batch', async ({ page }) => {
  await page.goto('/');
  const provider = simulatedProvider();
  let changed = false;
  const originalFetch = provider.fetchImpl;
  provider.fetchImpl = async (url, options) => {
    const response = await originalFetch(url, options);
    if (!changed) {
      changed = true;
      await page.locator('#change_impact').selectOption('Low');
    }
    return response;
  };
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  await expect(runAutomation({ page, scenario: await loadScenario(), models })).rejects.toThrow(
    'changed during inference',
  );
  await expect(page.locator('#type')).toHaveValue('Standard');
});

test('outcome verification catches missing form values before saving', async ({ page }) => {
  await page.goto('/');
  const provider = simulatedProvider();
  const originalFetch = provider.fetchImpl;
  provider.fetchImpl = async (url, options) => {
    const response = await originalFetch(url, options);
    if (url.endsWith('/chat/completions')) {
      await page.locator('#tab-planning').click();
      await page.locator('#release_version').fill('wrong-version');
      await page.locator('#tab-risk').click();
    }
    return response;
  };
  const models = createModels(testConfig, { fetchImpl: provider.fetchImpl });
  await expect(runAutomation({ page, scenario: await loadScenario(), models })).rejects.toThrow(
    'verification failed: release_version',
  );
  expect(await page.evaluate(() => localStorage.getItem('snow-release-demo:v1'))).toBeNull();
});

test('provider failures expose only status, not credentials or error bodies', async () => {
  const models = createModels(testConfig, {
    fetchImpl: async () => new Response('secret provider error body', { status: 401 }),
  });
  await expect(
    models.choose({
      phase: 'test',
      intent: {},
      observed: [],
      questions: { field: { criteria: { yes: 'Yes', no: 'No' }, goal: 'Choose yes' } },
    }),
  ).rejects.toThrow('TypeSafe returned HTTP 401');
  expect(models.statistics.requests).toBe(1);
});

test('choice validation checks confidence, normalization, and maximum-probability winner', async () => {
  const choices = { yes: 'Yes', no: 'No' };
  expect(() =>
    validateChoice({ choice: 'yes', confidence: NaN, probabilities: { yes: 1, no: 0 } }, choices),
  ).toThrow();
  expect(() =>
    validateChoice({ choice: 'yes', confidence: 1, probabilities: { yes: 0.1, no: 0.9 } }, choices),
  ).toThrow();
  expect(() =>
    validateChoice({ choice: 'yes', confidence: 1, probabilities: { yes: 0.8, no: 0.8 } }, choices),
  ).toThrow();
  expect(() =>
    validateChoice({ choice: 'yes', confidence: 1, probabilities: { yes: 1, no: 0 } }, choices),
  ).not.toThrow();
});

test('replica targets stay local and credentials cannot be embedded in provider roots', async () => {
  expect(() => validateReplicaUrl('https://production.example.com')).toThrow('loopback');
  expect(() => validateReplicaUrl('http://user:password@localhost:5173')).toThrow();
  expect(validateReplicaUrl('http://localhost:5173')).toBe('http://localhost:5173/');
  expect(() => validateEndpoint('http://api.typesafe.ai', 'TypeSafe')).toThrow();
  expect(() => validateEndpoint('https://user:password@api.typesafe.ai', 'TypeSafe')).toThrow();
  expect(validateEndpoint('http://127.0.0.1:8765', 'Test')).toBe('http://127.0.0.1:8765');
});

test('deployment windows are computed in the future at launch', async () => {
  const now = new Date('2030-12-30T12:00:00');
  const scenario = await loadScenario(undefined, now);
  expect(scenario.fields.implementation_start).toMatch(/^2031-01-02T20:00$/);
  expect(scenario.fields.implementation_end).toMatch(/^2031-01-02T21:00$/);
  expect(scenario.schedule.timezone).toBeTruthy();
});
