const { chromium } = require('playwright');

async function safeClickByName(page, nameRegex) {
  const link = page.getByRole('link', { name: nameRegex }).first();
  if (await link.count()) {
    await link.click({ timeout: 5000 });
    return true;
  }
  const button = page.getByRole('button', { name: nameRegex }).first();
  if (await button.count()) {
    await button.click({ timeout: 5000 });
    return true;
  }
  return false;
}

async function run() {
  const baseUrl = 'http://127.0.0.1:4002';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const pageChecks = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      error: req.failure()?.errorText || 'unknown',
    });
  });
  page.on('response', async (res) => {
    const status = res.status();
    if (status >= 400) {
      failedRequests.push({
        url: res.url(),
        method: res.request().method(),
        error: `HTTP ${status}`,
      });
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  if (await emailInput.count()) await emailInput.fill('test@admin.com');
  if (await passwordInput.count()) await passwordInput.fill('pass123');

  const submit = page.getByRole('button', { name: /sign in|login|log in|continue/i }).first();
  if (await submit.count()) {
    await submit.click();
  }

  await page.waitForTimeout(3000);

  const navTargets = [
    /dashboard/i,
    /users|residents/i,
    /units/i,
    /communities/i,
    /gates/i,
    /complaints|violations/i,
    /billing/i,
    /notifications/i,
    /settings/i,
  ];

  for (const target of navTargets) {
    const startedAt = Date.now();
    let status = 'not-found';
    try {
      const clicked = await safeClickByName(page, target);
      if (clicked) {
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1200);
        status = 'ok';
      }
    } catch (e) {
      status = `error: ${e.message}`;
    }

    pageChecks.push({
      target: String(target),
      status,
      url: page.url(),
      elapsedMs: Date.now() - startedAt,
    });
  }

  await page.screenshot({ path: 'playwright-admin-smoke.png', fullPage: true });
  await browser.close();

  const uniqueConsoleErrors = Array.from(new Set(consoleErrors));
  const uniqueFailed = [];
  const seen = new Set();
  for (const item of failedRequests) {
    const key = `${item.method}|${item.url}|${item.error}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFailed.push(item);
  }

  const result = {
    baseUrl,
    finalUrl: pageChecks[pageChecks.length - 1]?.url || null,
    checks: pageChecks,
    consoleErrors: uniqueConsoleErrors,
    failedRequests: uniqueFailed,
  };

  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

