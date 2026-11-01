import { test, expect } from '@playwright/test';

test('phone conversation gives history most of the screen and repairs a legacy bad reply', async ({ page }, info) => {
  await page.setViewportSize({ width: 393, height: 690 });
  await page.addInitScript(() => localStorage.setItem('ngraos-preferences', JSON.stringify({ muted: true, reduced: true, locale: 'id' })));
  const turn = { id: '56500458-f9a0-4351-a3ba-35ee29be5ec9', playerText: 'Om swastiastu. Suksma. Tiang pamit.', reply: 'Rahajeng semeng. Jagi ngopi napi ng 茶?', translation: { id: 'Selamat pagi. Mau kopi atau teh?', en: 'Good morning. Coffee or tea?' }, corrections: [], objectiveIds: ['warung:greet', 'warung:thank', 'warung:farewell'], createdAt: '2026-11-01' };
  let session = { id: 'd3834bbf-82b1-4ef4-a310-5905bb666f83', levelId: 'warung', status: 'active', turns: [turn], completedObjectives: turn.objectiveIds, hintsUsed: 0 };
  let repairs = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/player') return route.fulfill({ json: { player: { id: 'phone-test', name: 'Ayu', locale: 'id', xp: 0, streak: 0, isDemo: true, isAdmin: false, stars: {}, albums: [] }, aiReady: true } });
    if (path.endsWith('/repair-reply')) {
      repairs++;
      expect(route.request().postDataJSON()).toEqual({ turnId: turn.id });
      if (repairs === 1) return route.fulfill({ status: 502, json: { error: 'Balasan belum dapat diperbaiki. Coba lagi.' } });
      session = { ...session, turns: [{ ...turn, reply: 'Rahajeng semeng. Jagi ngopi napi teh?' }] };
    }
    return route.fulfill({ json: { session } });
  });
  await page.goto('/desa');
  await page.getByRole('button', { name: 'Mulai ngobrol', exact: true }).click();
  await expect(page.locator('.scene-panel')).not.toBeVisible();
  await expect(page.locator('.conversation-identity')).toContainText('Men Sari');
  await expect(page.locator('.topbar .xp')).not.toBeVisible();
  await expect(page.locator('.mission-checklist')).not.toHaveAttribute('open', '');
  await expect(page.locator('.npc-message').filter({ hasText: '茶' })).toHaveCount(0);
  const history = await page.locator('.conversation-history').boundingBox();
  expect(history!.height).toBeGreaterThan(690 * .55);
  const targets = page.locator('.mission-checklist summary');
  await targets.click(); await expect(page.getByText('Ucapkan terima kasih', { exact: true })).toBeVisible();
  await targets.click();
  await page.getByRole('button', { name: 'Perbaiki balasan', exact: true }).click();
  await expect(page.locator('.composer [role="alert"]')).toContainText('Coba lagi');
  await expect(page.getByRole('button', { name: 'Perbaiki balasan', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Perbaiki balasan', exact: true }).click();
  await expect(page.getByText('Rahajeng semeng. Jagi ngopi napi teh?', { exact: true })).toBeVisible();
  expect(repairs).toBe(2);
  await expect(page.getByRole('button', { name: 'Buka kuis', exact: true })).toBeInViewport();
  await expect(page.locator('.mission-checklist summary')).toContainText('3/3');
  await page.screenshot({ path: info.outputPath('mobile-conversation.png'), fullPage: false });
});
