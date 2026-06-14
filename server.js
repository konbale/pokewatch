/**
 * PokéWatch v2.1 — Backend Server
 *
 * Features:
 * - Puppeteer-based stock detection (real headless Chrome)
 * - Web Push notifications (VAPID) → iPhone Safari PWA
 * - Built-in cron scheduler (no frontend needs to stay open)
 * - REST API for the PWA frontend
 * - In-memory store (persists during server session)
 *
 * Retailers: Pokémon Center, Target, Walmart, GameStop, Best Buy,
 *            Amazon, Barnes & Noble, Kohl's, + generic fallback.
 */

const express   = require('express');
const cors      = require('cors');
const webpush   = require('web-push');
const cron      = require('node-cron');
const path      = require('path');
const puppeteer = require('puppeteer');

const app  = express();
const PORT = process.env.PORT || 3742;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── VAPID setup ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'YOUR_PUBLIC_KEY_HERE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YOUR_PRIVATE_KEY_HERE';
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || 'mailto:pokewatch@example.com';

if (VAPID_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY_HERE') {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ─── In-memory store ──────────────────────────────────────────────────────────
let products      = [];
let subscriptions = [];
let prevStatuses  = {};
let totalChecks   = 0;
let totalAlerts   = 0;
let serverStart   = Date.now();

// ─── Retailer detection rules ─────────────────────────────────────────────────
const RETAILER_RULES = [
  {
    name: 'Pokémon Center',
    match: (url) => url.includes('pokemoncenter.com'),
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }],
    outOfStock: [{ type: 'text', value: 'Sold Out' }, { type: 'text', value: 'Notify Me' }],
    waitMs: 4000,
  },
  {
    name: 'Target',
    match: (url) => url.includes('target.com'),
    inStock:    [{ type: 'button-text', value: 'Add to cart' }],
    outOfStock: [{ type: 'text', value: 'Sold out' }, { type: 'text', value: 'Out of stock' }],
    waitForSelector: '[data-test="product-title"]',
    waitMs: 4000,
  },
  {
    name: 'Walmart',
    match: (url) => url.includes('walmart.com'),
    inStock:    [{ type: 'button-text', value: 'Add to cart' }],
    outOfStock: [{ type: 'text', value: 'Out of stock' }, { type: 'text', value: 'Sold Out' }],
    waitMs: 4000,
  },
  {
    name: 'GameStop',
    match: (url) => url.includes('gamestop.com'),
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }],
    outOfStock: [{ type: 'text', value: 'Not Available' }, { type: 'text', value: 'Out of Stock' }],
    waitMs: 3000,
  },
  {
    name: 'Best Buy',
    match: (url) => url.includes('bestbuy.com'),
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }],
    outOfStock: [{ type: 'text', value: 'Sold Out' }, { type: 'text', value: 'Coming Soon' }],
    waitMs: 3000,
  },
  {
    name: 'Amazon',
    match: (url) => url.includes('amazon.com'),
    inStock:    [{ type: 'selector', value: '#add-to-cart-button' }],
    outOfStock: [{ type: 'text', value: 'Currently unavailable' }],
    waitForSelector: '#productTitle',
    waitMs: 3000,
  },
  {
    name: 'Barnes & Noble',
    match: (url) => url.includes('barnesandnoble.com'),
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }, { type: 'button-text', value: 'Add to Bag' }],
    outOfStock: [{ type: 'text', value: 'Out of Stock' }, { type: 'text', value: 'Unavailable' }, { type: 'text', value: 'Notify Me' }],
    waitMs: 3500,
  },
  {
    name: "Kohl's",
    match: (url) => url.includes('kohls.com'),
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }, { type: 'button-text', value: 'Add to bag' }],
    outOfStock: [{ type: 'text', value: 'Out of Stock' }, { type: 'text', value: 'Sold Out' }],
    waitMs: 3500,
  },
  {
    name: 'Generic',
    match: () => true,
    inStock:    [{ type: 'button-text', value: 'Add to Cart' }, { type: 'button-text', value: 'Add to cart' }],
    outOfStock: [{ type: 'text', value: 'Out of Stock' }, { type: 'text', value: 'Sold Out' }],
    waitMs: 3000,
  },
];

// ─── Browser ──────────────────────────────────────────────────────────────────
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);
    console.log('🚀 Browser launched');
  }
  return browser;
}

// ─── Stock checker ────────────────────────────────────────────────────────────
async function checkStock(url) {
  const rule = RETAILER_RULES.find(r => r.match(url));
  const result = {
    url, retailer: rule.name, status: 'unknown',
    reason: '', title: '', checkedAt: new Date().toISOString(), responseMs: 0,
  };
  const t0 = Date.now();
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image','media','font','stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (rule.waitForSelector) {
      try { await page.waitForSelector(rule.waitForSelector, { timeout: rule.waitMs }); }
      catch (_) {}
    } else {
      await new Promise(r => setTimeout(r, rule.waitMs));
    }
    const bodyText = await page.evaluate(() => document.body.innerText);
    result.title = (await page.title()).slice(0, 100);

    if (bodyText.includes('Just a moment') || bodyText.includes('Enable JavaScript and cookies')) {
      result.status = 'blocked'; result.reason = 'Cloudflare protection';
      return result;
    }

    for (const s of rule.outOfStock) {
      if (s.type === 'text' && bodyText.toLowerCase().includes(s.value.toLowerCase())) {
        result.status = 'out-of-stock'; result.reason = `Found: "${s.value}"`; return result;
      }
    }
    for (const s of rule.inStock) {
      if (s.type === 'text' && bodyText.toLowerCase().includes(s.value.toLowerCase())) {
        result.status = 'in-stock'; result.reason = `Found: "${s.value}"`; return result;
      }
      if (s.type === 'button-text') {
        const found = await page.evaluate(txt => {
          return Array.from(document.querySelectorAll('button,[role="button"]'))
            .some(b => b.innerText?.toLowerCase().includes(txt.toLowerCase()) && !b.disabled);
        }, s.value);
        if (found) { result.status = 'in-stock'; result.reason = `Button: "${s.value}"`; return result; }
      }
      if (s.type === 'selector') {
        const el = await page.$(s.value);
        if (el && !(await page.evaluate(e => e.disabled, el))) {
          result.status = 'in-stock'; result.reason = `Selector: ${s.value}`; return result;
        }
      }
    }
    result.status = 'unknown'; result.reason = 'Could not determine stock status';
  } catch (err) {
    result.status = 'error'; result.reason = err.message;
    console.error(`❌ ${url}: ${err.message}`);
  } finally {
    if (page) await page.close();
    result.responseMs = Date.now() - t0;
  }
  return result;
}

// ─── Push notifications ───────────────────────────────────────────────────────
async function sendPushToAll(title, body, url) {
  if (VAPID_PUBLIC_KEY === 'YOUR_PUBLIC_KEY_HERE') {
    console.log('⚠️  Push skipped: VAPID keys not configured');
    return;
  }
  const payload = JSON.stringify({ title, body, url, icon: '/icons/icon-192.png' });
  const dead = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub);
      else console.error('Push error:', err.message);
    }
  }
  subscriptions = subscriptions.filter(s => !dead.includes(s));
}

// ─── Scheduled monitoring ─────────────────────────────────────────────────────
let checkIntervalMinutes = 3;
let scheduledJob = null;

function startScheduler() {
  if (scheduledJob) scheduledJob.destroy();
  const cronExpr = `*/${checkIntervalMinutes} * * * *`;
  scheduledJob = cron.schedule(cronExpr, runAllChecks);
  console.log(`⏰ Scheduler: every ${checkIntervalMinutes} min`);
}

async function runAllChecks() {
  if (products.length === 0) return;
  console.log(`\n🔍 Running checks on ${products.length} products...`);
  for (const product of products) {
    try {
      const result = await checkStock(product.url);
      totalChecks++;
      product.status      = result.status;
      product.lastChecked = new Date().toISOString();
      product.title       = result.title;

      const wasInStock = prevStatuses[product.id] === 'in-stock';
      const nowInStock  = result.status === 'in-stock';
      prevStatuses[product.id] = result.status;

      console.log(`  ${result.status.padEnd(12)} ${product.name} (${result.responseMs}ms)`);

      if (nowInStock && !wasInStock) {
        totalAlerts++;
        console.log(`  🚨 ALERT: ${product.name} is IN STOCK!`);
        await sendPushToAll(
          `🚨 IN STOCK: ${product.name}`,
          `Available at ${product.retailer} — tap to buy now!`,
          product.url
        );
      }
    } catch (err) {
      console.error(`  ❌ Check failed for ${product.name}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const uptimeSec = Math.floor((Date.now() - serverStart) / 1000);
  res.json({
    ok: true, version: '2.1.0',
    browserReady: browser?.isConnected() ?? false,
    products: products.length,
    subscriptions: subscriptions.length,
    totalChecks, totalAlerts,
    checkIntervalMinutes,
    uptimeSec,
  });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const exists = subscriptions.some(s => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);
  console.log(`📱 Push subscription registered (total: ${subscriptions.length})`);
  res.json({ ok: true, total: subscriptions.length });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  res.json({ ok: true });
});

app.get('/api/products', (req, res) => {
  res.json({ products, totalChecks, totalAlerts });
});

app.post('/api/products', (req, res) => {
  const { name, retailer, url, emoji } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const product = {
    id: Date.now().toString(),
    name, retailer: retailer || 'Other',
    url, emoji: emoji || '🎴',
    status: 'watching',
    lastChecked: null, title: '',
  };
  products.push(product);
  console.log(`➕ Added: ${name}`);
  res.json({ ok: true, product });
});

app.delete('/api/products/:id', (req, res) => {
  products = products.filter(p => p.id !== req.params.id);
  delete prevStatuses[req.params.id];
  res.json({ ok: true });
});

app.post('/api/check-now', async (req, res) => {
  res.json({ ok: true, message: 'Check started' });
  runAllChecks();
});

app.post('/api/interval', (req, res) => {
  const { minutes } = req.body;
  if (!minutes || minutes < 1 || minutes > 60) return res.status(400).json({ error: 'minutes must be 1-60' });
  checkIntervalMinutes = minutes;
  startScheduler();
  res.json({ ok: true, checkIntervalMinutes });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log('  🎮 PokéWatch v2.1 — iPhone PWA Edition');
  console.log(`  🟢 Server: http://localhost:${PORT}`);
  console.log(`  🔔 Push: ${VAPID_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY_HERE' ? 'Configured ✓' : 'Not configured (run generate-keys.js)'}`);
  console.log('');
  try { await getBrowser(); } catch (e) { console.error('⚠️  Browser error:', e.message); }
  startScheduler();
});

process.on('SIGINT', async () => {
  if (scheduledJob) scheduledJob.destroy();
  if (browser) await browser.close();
  process.exit(0);
});
