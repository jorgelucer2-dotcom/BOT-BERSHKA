// --- DESPACHADOR PRINCIPAL (INDEX AUTOMATIZADO) ---
async function main() {
  const isDirectRun = process.argv.includes('--recorrido') || process.argv.includes('--run');

  if (isDirectRun || !process.env.BOT_TOKEN) {
    console.log('[Runner] Ejecución directa activada por CLI o ausencia de BOT_TOKEN.');
    let browser;
    try {
      const launchArgs = ['--start-maximized', '--disable-blink-features=AutomationControlled'];
      const launchOptions = {
        headless: CONFIG.headless,
        args: launchArgs
      };

      try {
        browser = await chromium.launch(launchOptions);
      } catch (_) {
        browser = await chromium.launch(launchOptions);
      }

      const steps = [];
      const ubicacion = elegirUbicacionAleatoriaMexico();
      steps.push(`📍 ${ubicacion.nombre}`);
      const context = await browser.newContext({
        timezoneId: 'America/Mexico_City',
        locale: 'es-MX',
        viewport: null,
        geolocation: { latitude: ubicacion.latitude, longitude: ubicacion.longitude, accuracy: ubicacion.accuracy },
        permissions: ['geolocation']
      });
      await context.grantPermissions(['geolocation'], { origin: 'https://www.bershka.com' }).catch(() => {});
      const page = await context.newPage();
      page.setDefaultTimeout(CONFIG.timeout);

      await page.goto(productUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(5550);
      await cerrarBannerCookies(page);
      await waitForHydrationAndVisuals(page);
      const size = await selectAvailableSize(page);
      steps.push(`Talla ${size}`);
      await addToCartAndProceedToCheckout(page, steps, ubicacion);
      console.log('[Resultado]', steps.join(' -> '));
    } catch (err) {
      logDiagnostico('MAIN_DIRECT_RUN_ERROR');
      console.error('[Fallo de ejecución]:', err);
      if (browser) {
        await browser.close().catch(() => {});
      }
      process.exit(1);
    } finally {
      if (browser) {
        await browser.close().catch(() => logDiagnostico('BROWSER_CLOSE_ERROR'));
      }
    }
  } else {
    console.log('[Runner] Iniciando en modo Daemon Telegram...');
    const bot = crearBotTelegram(process.env.BOT_TOKEN);
    await bot.launch({ dropPendingUpdates: true });
    console.log('[Runner] Bot conectado y escuchando comandos.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}
