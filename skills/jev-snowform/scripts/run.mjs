import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadScenario, runAutomation, validateReplicaUrl } from './automation.mjs';
import { createModels, validateEndpoint } from './models.mjs';
import {
  connectExistingBrowser,
  disconnectExistingBrowser,
  openDemoTab,
  validateCdpUrl,
} from './browser.mjs';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    scenario: { type: 'string' },
    output: { type: 'string' },
    browser: { type: 'string' },
    cdp: { type: 'string' },
    'new-browser': { type: 'boolean', default: false },
    headless: { type: 'boolean', default: false },
    close: { type: 'boolean', default: false },
    submit: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(`Usage: npm run demo:jev -- [options]
  --check          Check keys, scenario, browser connection, and replica. No paid API calls.
  --url URL        Loopback replica URL. Default: SNOW_FORM_URL or http://127.0.0.1:5173.
  --scenario PATH  Synthetic release JSON. Default: the skill's release.json.
  --browser PATH   Chromium-compatible executable. Also accepts BROWSER_EXECUTABLE.
  --cdp URL        Existing browser debugging endpoint. Default: BROWSER_CDP_URL or localhost:9222.
  --new-browser    Launch a separate isolated browser instead of a tab in your open browser.
  --submit         Submit to Confirm Release after filling. Default: save a draft.
  --headless       Hide the browser and exit after verification.
  --close          Close only the demo tab when attached, or the separate browser when launched.
  --output PATH    Artifact directory. Default: artifacts/jev/<timestamp>.`);
  process.exit(0);
}

let browser;
let output;
let page;
let logQueue = Promise.resolve();
const controller = new AbortController();
let interrupted = false;
const useExisting = !values['new-browser'] && !values.headless;

function log(event) {
  const entry = { time: new Date().toISOString(), ...event };
  if (output) {
    logQueue = logQueue.then(() =>
      appendFile(resolve(output, 'trace.jsonl'), `${JSON.stringify(entry)}\n`),
    );
  }
  if (event.kind === 'jev') {
    console.log(
      `Jev  ${event.phase.padEnd(29)} ${String(event.latency_ms).padStart(5)} ms  ${Object.keys(event.answers).length} decisions`,
    );
  } else if (event.kind === 'text') {
    console.log(
      `Text ${String(event.fields.length).padStart(2)} narrative fields              ${String(event.latency_ms).padStart(5)} ms  ${event.model}`,
    );
  } else if (event.kind === 'action') {
    console.log(`     ${event.source.padEnd(10)} ${event.field}`);
  } else if (event.kind === 'retry') {
    console.log(`     ${event.provider} HTTP ${event.status}; retry ${event.attempt}/2`);
  }
}

async function close() {
  controller.abort();
  if (browser) {
    if (useExisting) await disconnectExistingBrowser(browser, page, values.close);
    else await browser.close().catch(() => {});
  }
  await logQueue;
}

process.once('SIGINT', () => {
  interrupted = true;
  process.exitCode = 130;
  void close();
});
process.once('SIGTERM', () => {
  interrupted = true;
  process.exitCode = 143;
  void close();
});

async function keepOpen() {
  if (useExisting) {
    if (page && !page.isClosed() && !values.close) {
      console.log(
        'Demo tab left open in your browser. Jev disconnects without closing your browser.',
      );
    }
    return;
  }
  if (!browser?.isConnected() || values.close || values.headless || interrupted) return;
  console.log(
    'Browser kept open. Inspect the completed form, then close the window or press Ctrl+C.',
  );
  await new Promise((done) => {
    browser.once('disconnected', done);
    page.once('close', done);
    if (!browser.isConnected() || page.isClosed()) done();
  });
}

try {
  const url = validateReplicaUrl(
    values.url || process.env.SNOW_FORM_URL || 'http://127.0.0.1:5173',
  );
  const scenario = await loadScenario(values.scenario ? resolve(values.scenario) : undefined);
  const config = {
    typesafeKey: process.env.TYPESAFE_API_KEY,
    typesafeModel: process.env.TYPESAFE_MODEL || 'jev-1.14.0',
    typesafeBase: process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai',
    textKey: process.env.TEXT_MODEL_API_KEY,
    textBase: process.env.TEXT_MODEL_BASE_URL || 'https://openrouter.ai/api/v1',
    textModel: process.env.TEXT_MODEL || 'inception/mercury-2.5',
    reasoning: process.env.TEXT_MODEL_REASONING || 'none',
  };
  const missing = ['TYPESAFE_API_KEY', 'TEXT_MODEL_API_KEY'].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length)
    throw new Error(`Missing ${missing.join(', ')}. Add these to .env. Values are never printed.`);
  validateEndpoint(config.typesafeBase, 'TypeSafe');
  validateEndpoint(config.textBase, 'Text model');
  const executable =
    values.browser ||
    process.env.BROWSER_EXECUTABLE ||
    (existsSync(chromium.executablePath())
      ? chromium.executablePath()
      : [
          '/run/current-system/sw/bin/brave',
          '/usr/bin/brave-browser',
          '/usr/bin/chromium',
          '/usr/bin/google-chrome',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ].find(existsSync));
  if (!useExisting && (!executable || !existsSync(executable))) {
    throw new Error(
      'Browser executable not found. Set BROWSER_EXECUTABLE or run npx playwright install chromium.',
    );
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  } catch {
    throw new Error('Replica is not reachable. Run npm start in a separate terminal first.');
  }
  if (!response.ok || !(await response.text()).includes('/src/main.tsx')) {
    throw new Error('URL is not the running Vite replica. Check SNOW_FORM_URL and npm start.');
  }
  const cdpUrl = useExisting
    ? validateCdpUrl(
        values.cdp ||
          process.env.BROWSER_CDP_URL ||
          process.env.BU_CDP_URL ||
          'http://127.0.0.1:9222',
      )
    : undefined;
  if (useExisting) browser = await connectExistingBrowser(cdpUrl);
  if (values.check) {
    console.log(
      `Ready. Replica: ${url}\nBrowser: ${useExisting ? `existing browser at ${cdpUrl}` : executable}\nScenario: ${scenario.title}\nModel keys are present. No API requests were made.`,
    );
  } else {
    output = resolve(
      values.output || `artifacts/jev/${new Date().toISOString().replace(/[:.]/g, '-')}`,
    );
    await mkdir(output, { recursive: true, mode: 0o700 });
    if (useExisting) {
      page = await openDemoTab(browser, url);
    } else {
      browser = await chromium.launch({
        executablePath: executable,
        headless: values.headless,
        args: ['--no-sandbox'],
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        timezoneId: scenario.schedule.timezone,
      });
      page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
    }
    page.setDefaultTimeout(10000);
    const models = createModels(config, { log });
    console.log(
      `Release: ${scenario.title}\nReplica: ${url}\nModels: ${config.typesafeModel} + ${config.textModel}\nDOM only. Starting live model calls.`,
    );
    const result = await runAutomation({
      page,
      scenario,
      models,
      log,
      submit: values.submit,
      signal: controller.signal,
    });
    await writeFile(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, {
      mode: 0o600,
    });
    await logQueue;
    console.log(
      `Verified ${result.mode} in ${(result.elapsed_ms / 1000).toFixed(2)} s. ${models.statistics.jev_calls} Jev calls, ${models.statistics.text_calls} text call.\nResult: ${resolve(output, 'result.json')}\nDecisions: ${resolve(output, 'trace.jsonl')}`,
    );
    await keepOpen();
  }
} catch (error) {
  process.exitCode = interrupted ? process.exitCode : 1;
  const message = error instanceof Error ? error.message : 'Automation failed.';
  // Never include provider bodies, request headers, or environment values in artifacts.
  console.error(`Stopped: ${message}`);
  if (output) {
    await writeFile(
      resolve(output, 'failure.json'),
      JSON.stringify({ verified: false, error: message }, null, 2),
      { mode: 0o600 },
    );
  }
  await keepOpen();
} finally {
  await close();
}
