import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export function validateCdpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Browser debugging URL is invalid.');
  }
  if (
    !['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Browser debugging must use a loopback HTTP or WebSocket endpoint.');
  return url.href;
}

export async function connectExistingBrowser(endpoint) {
  try {
    const browser = await chromium.connectOverCDP(validateCdpUrl(endpoint), {
      timeout: 5000,
      noDefaults: true,
    });
    if (!browser.contexts()[0]) {
      await browser.close();
      throw new Error('No default browser context.');
    }
    return browser;
  } catch {
    throw new Error(
      'Cannot attach to your open browser. Enable remote debugging on localhost:9222 ' +
        'or set BROWSER_CDP_URL. Use --new-browser only if you want a separate browser.',
    );
  }
}

export async function openDemoTab(browser, url) {
  const context = browser.contexts()[0];
  if (!context) throw new Error('The connected browser has no default context.');
  const target = new URL(url);
  target.searchParams.set('demo_run', randomUUID());
  const page = await context.newPage();
  try {
    await page.goto(target.href, { waitUntil: 'networkidle' });
    await page.bringToFront();
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}

export async function disconnectExistingBrowser(browser, page, closeTab = false) {
  if (closeTab && page && !page.isClosed()) await page.close().catch(() => {});
  // connectOverCDP close disconnects the transport, not the user's browser.
  await browser.close().catch(() => {});
}
