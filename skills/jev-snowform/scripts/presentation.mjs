import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

export function parseSpeed(value = '1') {
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0.05 || speed > 1) {
    throw new Error('--speed must be between 0.05 and 1. Use --speed 0.25 for quarter speed.');
  }
  return speed;
}

export function createPresentation({
  page,
  speed = 1,
  inspector = false,
  pace = 'scaled',
  signal = undefined,
  log = (event) => {
    void event;
  },
  now = () => performance.now(),
  sleep = (ms) => delay(ms, undefined, { signal }),
}) {
  const multiplier = 1 / parseSpeed(speed);
  if (!['realistic', 'scaled'].includes(pace))
    throw new Error('--pace must be realistic or scaled.');
  let addedDelay = 0;
  let acting = false;

  async function pause(ms) {
    if (ms <= 0) return;
    await sleep(ms);
    addedDelay += ms;
  }

  async function clear() {
    if (!inspector || page.isClosed()) return;
    await page.evaluate(() => {
      document.querySelectorAll('[data-jev-focused]').forEach((element) => {
        element.removeAttribute('data-jev-focused');
        element.removeAttribute('data-jev-source');
      });
      document.querySelectorAll('[data-jev-inspector]').forEach((element) => element.remove());
      document.querySelectorAll('[data-jev-highlight]').forEach((element) => element.remove());
    });
  }

  async function highlight(locator, source) {
    if (!inspector) return;
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((element) => {
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    });
    await locator.evaluate((element, source) => {
      document.querySelectorAll('[data-jev-focused]').forEach((node) => {
        node.removeAttribute('data-jev-focused');
        node.removeAttribute('data-jev-source');
      });
      document.querySelectorAll('[data-jev-inspector]').forEach((node) => node.remove());
      document.querySelectorAll('[data-jev-highlight]').forEach((node) => node.remove());
      if (!document.getElementById('jev-inspector-style')) {
        const style = document.createElement('style');
        style.id = 'jev-inspector-style';
        style.textContent = `
          [data-jev-focused] {
            outline: none !important;
            box-shadow: none !important;
          }
          [data-jev-highlight] {
            position: fixed; z-index: 2147483646; pointer-events: none;
            border: 4px solid #14b8a6; border-radius: 6px; box-sizing: border-box;
            box-shadow: none; margin: 0; padding: 0;
          }
          [data-jev-inspector] {
            position: fixed; top: 8px; right: 14px; z-index: 2147483647;
            padding: 10px 16px; border: 3px solid #14b8a6; border-radius: 4px;
            background: #142647; color: #fff; font: 600 14px/1.5 system-ui, sans-serif;
            pointer-events: none; max-width: min(420px, 85vw);
          }`;
        document.head.append(style);
      }
      element.setAttribute('data-jev-focused', 'true');
      element.setAttribute('data-jev-source', source);
      const label =
        element.getAttribute('data-field-label') ||
        element.getAttribute('aria-label') ||
        document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent ||
        element.textContent?.trim() ||
        element.id;
      const badge = document.createElement('div');
      badge.setAttribute('data-jev-inspector', 'true');
      badge.setAttribute('aria-hidden', 'true');
      const color = source === 'text-model' ? '#a855f7' : '#14b8a6';
      const rect = element.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.setAttribute('data-jev-highlight', source);
      ring.setAttribute('aria-hidden', 'true');
      Object.assign(ring.style, {
        top: `${rect.top - 5}px`,
        left: `${rect.left - 5}px`,
        width: `${rect.width + 10}px`,
        height: `${rect.height + 10}px`,
        borderColor: color,
      });
      badge.style.borderColor = color;
      const owner =
        source === 'text-model'
          ? 'Text model input'
          : source === 'jev'
            ? 'Jev focus'
            : 'Demo script';
      badge.textContent = `${owner}: ${label}`;
      // A dialog is in the browser's top layer. Its badge must live there too.
      (element.closest('dialog[open]') || document.body).append(ring, badge);
    }, source);
  }

  return {
    async infer(operation) {
      const started = now();
      const result = await operation();
      // Model inference is not slowed server-side. Hold its result before applying it.
      if (pace === 'scaled') await pause((multiplier - 1) * (now() - started));
      return result;
    },
    async act(locator, operation, source = 'jev') {
      if (acting) throw new Error('Demo inputs must run one at a time.');
      acting = true;
      try {
        await highlight(locator, source);
        // Show the next target before input. No animation or typing effect is used.
        const before =
          pace === 'realistic'
            ? 650 / speed
            : inspector && multiplier > 1
              ? 100 * (multiplier - 1)
              : 0;
        await pause(before);
        const started = now();
        const result = await operation();
        const naturalMs = now() - started;
        const extraMs =
          pace === 'realistic'
            ? (source === 'text-model' ? 2200 : 850) / speed
            : Math.max(0, (multiplier - 1) * Math.max(naturalMs, 150) - before);
        await pause(extraMs);
        log({
          kind: 'presentation',
          source,
          speed,
          pace,
          action_ms: Math.round(naturalMs),
          delay_ms: Math.round(before + extraMs),
        });
        return result;
      } finally {
        acting = false;
      }
    },
    clear,
    statistics: () => ({ speed, pace, inspector, added_delay_ms: Math.round(addedDelay) }),
  };
}
