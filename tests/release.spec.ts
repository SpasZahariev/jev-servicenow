import { test, expect, type Page } from '@playwright/test';

async function selectRecord(page: Page, field: string, name: string) {
  await page.locator(`#${field}-lookup`).click();
  const dialog = page.locator(`#lookup-${field}`);
  await expect(dialog).toBeVisible();
  await page.locator(`#${field}-modal-search`).fill(name);
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function selectMultiple(page: Page, field: string, names: string[]) {
  await page.locator(`#${field}-lookup`).click();
  for (const name of names)
    await page.getByRole('checkbox', { name: `Select ${name}`, exact: true }).check();
  await page.locator(`#${field}-lookup-apply`).click();
}

async function fillRelease(page: Page) {
  await page.locator('#change_impact').selectOption('Low');
  await selectRecord(page, 'assignment_group', 'Data Platform');
  await selectRecord(page, 'release_manager_deputy', 'Sarah Chen');
  await page.locator('#lux_related').selectOption('No');
  await selectMultiple(page, 'components', ['Clients Pillar AI Incubator']);
  await selectMultiple(page, 'repositories', ['clients/ai-incubator']);
  await page.locator('#short_description').fill('Release Clients Pillar AI Incubator 2.4.0');
  await page
    .locator('#description')
    .fill('Deploy the client intelligence update requested by the engineering team.');
  await page.locator('#release_version').fill('2.4.0');
  await page.locator('#implementation_start').fill('2026-11-05T20:00');
  await page.locator('#implementation_end').fill('2026-11-05T21:00');
  await page.locator('#change_plan').fill('Deploy the signed build and verify health checks.');
  await page.locator('#rollback_plan').fill('Restore the previous build if health checks fail.');
  await page
    .locator('#test_plan')
    .fill('Unit and integration tests pass. Run a smoke test after deployment.');
  await page.getByRole('tab', { name: 'Risk and Impact', exact: true }).click();
  await page.locator('#risk_level').selectOption('Low');
  await page
    .locator('#risk_analysis')
    .fill('Low risk. Deployment is reversible and introduces no schema changes.');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('replica exposes stable DOM fields and no animation', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'New software component release' })).toBeVisible();
  await expect(page.locator('#requested_by')).toHaveValue('Spas Zahariev');
  await expect(page.getByRole('link', { name: 'Service Now Change Management' })).toHaveText(
    'service now',
  );
  await expect(page.locator('#release_manager')).toHaveValue('Taylor Reed');
  await expect(page.locator('#stage')).toHaveValue('Draft');
  await expect(page.locator('#panel-risk')).toBeHidden();
  await expect(page.locator('#description')).toHaveAttribute('data-input-kind', 'generated-text');
  const animated = await page.evaluate(
    () =>
      [...document.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        return (
          style.animationName !== 'none' ||
          style.transitionDuration.split(',').some((value) => parseFloat(value) > 0)
        );
      }).length,
  );
  expect(animated).toBe(0);
});

test('saved drafts replace retired release-manager records', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'snow-release-demo:v1',
      JSON.stringify({
        form: {
          release_manager: 'retired-manager',
          release_manager_deputy: 'retired-deputy',
          short_description: 'Keep this release draft',
        },
        stage: 2,
        activities: [],
        attachments: [],
      }),
    ),
  );
  await page.reload();
  await expect(page.locator('#release_manager')).toHaveValue('Taylor Reed');
  await expect(page.locator('#release_manager_deputy')).toHaveValue('');
  await expect(page.locator('#short_description')).toHaveValue('Keep this release draft');
  await expect(page.locator('#stage')).toHaveValue('Draft');
});

test('lookup supports search, filters, multiselect, cancel, and removal', async ({ page }) => {
  await page.locator('#assignment_group-lookup').click();
  await page.locator('#assignment_group-modal-search').fill('does not exist');
  await expect(page.getByText('No matching records')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#assignment_group-lookup')).toBeFocused();
  await selectRecord(page, 'assignment_group', 'Data Platform');
  await expect(page.locator('#assignment_group')).toHaveValue('Data Platform');
  await page.locator('#components-lookup').click();
  await page.getByRole('checkbox', { name: 'Select Client Portal', exact: true }).check();
  await page.locator('#components-lookup-cancel').click();
  await expect(page.locator('#components')).toHaveAttribute('data-selected-ids', '[]');
  await selectMultiple(page, 'components', ['Client Portal', 'Identity Service']);
  await expect(page.locator('#components')).toHaveAttribute(
    'data-selected-ids',
    '["client-portal","identity-service"]',
  );
  await page.locator('#components-search').fill('identity');
  await expect(
    page.locator('#components').getByText('Client Portal', { exact: true }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Remove Identity Service', exact: true }).click();
  await page.locator('#components-search').fill('');
  await expect(page.locator('#components')).toHaveAttribute(
    'data-selected-ids',
    '["client-portal"]',
  );
});

test('dependent fields appear and validation can navigate across tabs', async ({ page }) => {
  await page.locator('#submit-header').click();
  await expect(page.locator('.error-summary')).toBeVisible();
  await page.locator('#lux_related').selectOption('Yes');
  await expect(page.locator('#lux_approval')).toBeVisible();
  await page.locator('#submit-header').click();
  await expect(page.locator('#lux_approval-error')).toBeVisible();
  await page.locator('#lux_related').selectOption('No');
  await expect(page.locator('#lux_approval')).toHaveCount(0);
  await expect(
    page.locator('.error-summary').getByRole('button', { name: 'LUX approval reference' }),
  ).toHaveCount(0);
  await page.locator('#type').selectOption('Emergency');
  await expect(page.locator('#emergency_reason')).toBeVisible();
  await page.locator('#type').selectOption('Standard');
  await page
    .locator('.error-summary')
    .getByRole('button', { name: 'Risk and impact analysis', exact: true })
    .click();
  await expect(page.locator('#panel-risk')).toBeVisible();
  await expect(page.locator('#risk_analysis')).toBeFocused();
  await page.locator('#outage_required').check();
  await expect(page.locator('#outage_minutes')).toBeVisible();
  await page.locator('#security_review').check();
  await expect(page.locator('#security_reference')).toBeVisible();
  await page.locator('#risk_level').selectOption('High');
  await expect(page.locator('#communication_plan')).toBeVisible();
  await page.locator('#risk_level').selectOption('Low');
  await page.locator('#customer_impact-yes').check();
  await expect(page.locator('#communication_plan')).toBeVisible();
  await page.locator('#customer_impact-no').check();
  await expect(page.locator('#communication_plan')).toHaveCount(0);
});

test('full release flow saves, reloads, exports JSON, and resets', async ({ page }) => {
  await fillRelease(page);
  await page.locator('#submit-header').click();
  await expect(page.locator('#stage')).toHaveValue('Confirm Release');
  await page.reload();
  await expect(page.locator('#stage')).toHaveValue('Confirm Release');
  await expect(page.locator('#short_description')).toHaveValue(
    'Release Clients Pillar AI Incubator 2.4.0',
  );
  await page.locator('#submit-header').click();
  await expect(page.locator('#stage')).toHaveValue('Approval');
  await page.locator('#submit-header').click();
  await expect(page.locator('#stage')).toHaveValue('Implementing');
  await page.locator('#submit-header').click();
  await expect(page.locator('#stage')).toHaveValue('Implemented');
  await page.locator('#submit-header').click();
  await expect(page.locator('#stage')).toHaveValue('Closed');
  await expect(page.locator('#submit-header')).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('CHG014334.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const payload = JSON.parse(Buffer.concat(chunks).toString());
  expect(payload.form.components).toEqual(['clients-pillar-ai']);
  expect(payload.stage).toBe('Closed');
  await page.locator('#short_description').fill('Updated release');
  await expect(page.locator('#stage')).toHaveValue('Draft');
  await page.locator('#reset-form').click();
  await page.locator('#confirm-reset').click();
  await expect(page.locator('#short_description')).toHaveValue('');
  await expect(page.locator('#components')).toHaveAttribute('data-selected-ids', '[]');
  await page.reload();
  await expect(page.locator('#short_description')).toHaveValue('');
});

test('rejects unknown references, duplicate managers, and reversed dates', async ({ page }) => {
  await fillRelease(page);
  await page.getByRole('tab', { name: 'Schedule and Planning' }).click();
  await page.locator('#implementation_end').fill('2026-11-05T19:00');
  await page.locator('#assignment_group').fill('Unknown Group');
  await page.locator('#release_manager_deputy').fill('Taylor Reed');
  await page.locator('#submit-header').click();
  await expect(page.locator('#assignment_group-error')).toContainText('Select a valid record');
  await expect(page.locator('#release_manager_deputy-error')).toContainText('different');
  await expect(page.locator('#implementation_end-error')).toContainText('after');
  await expect(page.locator('#stage')).toHaveValue('Draft');
});

test('activity notes and attachment metadata persist with the draft', async ({ page }) => {
  await page.getByRole('tab', { name: 'Activities', exact: true }).click();
  await page.locator('#work_notes').fill('Release candidate passed smoke tests.');
  await page.locator('#post-work-note').click();
  await expect(page.locator('.activity-entry')).toContainText(
    'Release candidate passed smoke tests.',
  );
  await page.locator('#attachments').setInputFiles({
    name: 'test-evidence.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Passed'),
  });
  await expect(page.locator('.attachment-list')).toContainText('test-evidence.txt');
  await page.locator('#save-header').click();
  await page.reload();
  await expect(page.locator('.attachment-list')).toContainText('test-evidence.txt');
  await page.getByRole('tab', { name: /Activities/ }).click();
  await expect(page.locator('.activity-list')).toContainText(
    'Release candidate passed smoke tests.',
  );
});

test('keyboard tabs and mobile layout are usable', async ({ page }) => {
  await page.locator('#tab-planning').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-risk')).toBeFocused();
  await expect(page.locator('#panel-risk')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-activities')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await selectRecord(page, 'assignment_group', 'Data Platform');
  await expect(page.locator('#assignment_group')).toHaveValue('Data Platform');
});

test('corrupted saved drafts do not prevent the form from loading', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'snow-release-demo:v1',
      JSON.stringify({
        form: { components: null, repositories: 'invalid', short_description: 42 },
        stage: 0,
        attachments: [null],
        activities: [null],
      }),
    ),
  );
  await page.reload();
  await expect(page.locator('#short_description')).toHaveValue('');
  await expect(page.locator('#components')).toHaveAttribute('data-selected-ids', '[]');
});
