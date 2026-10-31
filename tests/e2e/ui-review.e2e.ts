import { test, expect } from '@playwright/test';

const session = { id: 'e81f6e1b-31b0-4bfa-b5a2-265eb1d49c65', levelId: 'warung', status: 'active', turns: [], completedObjectives: [], hintsUsed: 0 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ngraos-preferences', JSON.stringify({ muted: true, reduced: true, locale: 'id' })));
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/player') return route.fulfill({ json: { player: { id: 'ui-review', name: 'Ayu', locale: 'id', xp: 170, streak: 1, isDemo: true, isAdmin: false, stars: { warung: 3 }, albums: ['warung'] }, aiReady: true } });
    return route.fulfill({ json: { session } });
  });
});

test('mobile menu isolates the background, restores focus, and settings expose named states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/desa');
  const menu = page.getByRole('button', { name: 'Buka menu', exact: true });
  await menu.click();
  await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert', '');
  await menu.click();
  await page.getByRole('button', { name: 'Pengaturan', exact: true }).click();
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('switch', { name: 'Suara & suasana desa' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Kurangi animasi' })).toBeChecked();
  await page.getByRole('switch', { name: 'Suara & suasana desa' }).click();
  await expect(page.getByRole('switch', { name: 'Suara & suasana desa' })).toBeChecked();
  await page.getByRole('button', { name: 'Sumber & privasi', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cari kamus' }).fill('zzzz-no-match');
  await expect(page.getByText('Kata belum ditemukan', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('0 kata ditemukan');
  await page.getByRole('button', { name: 'Lihat semua kata' }).click();
  await expect(page.locator('.dictionary-entry').first()).toBeVisible();
});

test('conversation controls fit short phones and a reduced viewport for the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/desa');
  await page.getByRole('button', { name: 'Mulai ngobrol', exact: true }).click();
  await page.getByRole('button', { name: 'Ketik', exact: true }).click();
  for (const [width, height] of [[320, 568], [390, 667], [390, 844], [390, 380]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('.lesson-flow').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(height - 88);
    const bounds = await page.locator('.composer').evaluate(el => {
      const box = el.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth };
    });
    expect(bounds.top).toBeGreaterThan(64);
    const layout = await page.locator('.lesson-flow').evaluate(el => Object.fromEntries(['.topbar','.main-content','.lesson-flow','.lesson-heading','.play-grid','.scene-panel','.conversation-panel','.composer'].map(selector => { const node = document.querySelector(selector)!; const css = getComputedStyle(node); return [selector, {box: node.getBoundingClientRect().toJSON(), height: css.height, min: css.minHeight, margin: css.margin, flex: css.flex}]; })));
    expect(bounds.bottom, JSON.stringify(layout)).toBeLessThanOrEqual(height + 1);
    expect(bounds.width).toBeLessThanOrEqual(bounds.viewport + 1);
    await expect(page.getByRole('button', { name: 'Kirim ucapan', exact: true })).toBeInViewport();
    await expect(page.locator('.scene-npc')).toHaveCSS('transform', 'none');
  }
});
