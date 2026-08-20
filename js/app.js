/**
 * Miqdaar — Main Application v1.1
 * Single-page Zakat & Warasat forms, Groq chatbot, responsive UI
 */
import en from './i18n/en.js';
import ur from './i18n/ur.js';
import romanUr from './i18n/roman-ur.js';
import { MADHHABS, MADHHAB_LABELS, DISCLAIMER, CURRENCIES, APP_VERSION, RULES_VERSION } from '../data/constants.js';
import { QURAN, HADITH } from '../data/evidence.js';
import { calculateZakat } from './calculators/zakat/engine.js';
import { calculateInheritance } from './calculators/inheritance/engine.js';
import { fetchLiveRates } from './services/market.js';

const state = {
  lang: localStorage.getItem('miqdaar_lang') || 'en',
  madhhab: localStorage.getItem('miqdaar_madhhab') || null,
  currency: localStorage.getItem('miqdaar_currency') || 'PKR',
  history: JSON.parse(localStorage.getItem('miqdaar_history') || '[]'),
  groqKey: localStorage.getItem('miqdaar_groq_key') || ''
};

const i18nMap = { en, ur, 'roman-ur': romanUr };

function t(key) {
  const parts = key.split('.');
  let obj = i18nMap[state.lang] || en;
  for (const p of parts) { obj = obj?.[p]; if (obj == null) return key; }
  return obj;
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem('miqdaar_lang', lang);
  document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  render();
}

const routes = {
  '/': renderHome,
  '/zakat': renderZakatPage,
  '/warasat': renderWarasatPage,
  '/learn': renderLearn,
  '/evidence': renderEvidence,
  '/glossary': renderGlossary,
  '/history': renderHistory,
  '/settings': renderSettings,
  '/disclaimer': renderDisclaimer,
  '/more': renderMore,
  '/madhhab': renderMadhhabSelect
};

function getRoute() { return (location.hash.slice(1) || '/').split('?')[0]; }
function navigate(path) { location.hash = path; }

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (!state.madhhab) navigate('/madhhab');
  render();
  setupUI();
});


function setupChatbot() {
  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close');
  const sendBtn = document.getElementById('chat-send');
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  if (!fab || !panel) return;

  fab.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn?.addEventListener('click', () => panel.classList.add('hidden'));

  async function sendMessage() {
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';
    messages.innerHTML += `<div class="chat-bubble-user">${escapeHtml(text)}</div>`;
    messages.scrollTop = messages.scrollHeight;
    const typing = document.createElement('div');
    typing.className = 'chat-bubble-bot';
    typing.textContent = 'Thinking...';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const reply = await askGroq(text);
      typing.remove();
      messages.innerHTML += `<div class="chat-bubble-bot">${escapeHtml(reply)}</div>`;
    } catch (e) {
      typing.remove();
      messages.innerHTML += `<div class="chat-bubble-bot">Sorry, I could not answer right now. Please set your Groq API key in Settings, or try again later. For rulings, consult a qualified scholar.</div>`;
    }
    messages.scrollTop = messages.scrollHeight;
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const GROQ_SYSTEM = `You are the Miqdaar educational assistant for an Islamic Zakat and Faraid (inheritance) calculator.
STRICT RULES:
1. You NEVER invent Quran verses, Hadith, or fiqh rulings.
2. You NEVER perform inheritance or Zakat calculations yourself — those are done by deterministic engines.
3. You NEVER issue a fatwa. Always say this is educational and users should consult a qualified scholar for personal rulings.
4. You may explain concepts: Nisab, Hawl, fixed shares (furud), asabah, hajb, awl, radd, wasiyyah, Zakat recipients from Quran 9:60.
5. You may explain the user's already-calculated result in simple language if they paste it.
6. If asked for a personal ruling or complex case, recommend a qualified scholar.
7. Prefer citing: Quran 4:11, 4:12, 4:176, 9:60 and Sahih al-Bukhari 6732 / 1447 when relevant.
8. Be respectful of all madhhabs. Do not say one school is wrong.
9. Keep answers concise and clear for ordinary Muslims.
10. Reply in the same language the user used (English, Urdu, or Roman Urdu).`;

async function askGroq(userMessage) {
  const key = localStorage.getItem('miqdaar_groq_key') || '';
  if (!key) {
    return 'Please add your Groq API key in Settings to enable the assistant. Meanwhile: Zakat is generally 2.5% of zakatable wealth above Nisab after one lunar year (Hawl). Inheritance fixed shares come from Quran 4:11 and 4:12. This is educational — not a fatwa.';
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: GROQ_SYSTEM },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 600
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Groq error');
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response.';
}

function setupUI() {
  document.getElementById('menu-btn')?.addEventListener('click', () => document.getElementById('side-menu').classList.remove('hidden'));
  document.getElementById('menu-close')?.addEventListener('click', closeMenu);
  document.getElementById('menu-backdrop')?.addEventListener('click', closeMenu);
  document.getElementById('lang-btn')?.addEventListener('click', cycleLang);
  document.querySelectorAll('.menu-link').forEach(a => a.addEventListener('click', closeMenu));
  // Chat
  document.getElementById('chat-btn')?.addEventListener('click', openChat);
  document.getElementById('chat-close')?.addEventListener('click', closeChat);
  document.getElementById('chat-backdrop')?.addEventListener('click', closeChat);
  document.getElementById('chat-send')?.addEventListener('click', sendChat);
  document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function closeMenu() { document.getElementById('side-menu')?.classList.add('hidden'); }
function openChat() { document.getElementById('chat-panel')?.classList.remove('hidden'); document.getElementById('chat-input')?.focus(); }
function closeChat() { document.getElementById('chat-panel')?.classList.add('hidden'); }

function cycleLang() {
  const order = ['en', 'ur', 'roman-ur'];
  setLang(order[(order.indexOf(state.lang) + 1) % order.length]);
}

function render() {
  const route = getRoute();
  const main = document.getElementById('main');
  if (!main) return;
  // Nav active states
  document.querySelectorAll('.nav-item, .side-nav-link').forEach(el => {
    const nav = el.getAttribute('data-nav');
    const active = (route === '/' && nav === 'home') ||
      (route.startsWith('/zakat') && nav === 'zakat') ||
      (route.startsWith('/warasat') && nav === 'warasat') ||
      (route.startsWith('/evidence') && nav === 'evidence') ||
      (route.startsWith('/learn') && nav === 'learn') ||
      (['/more','/settings','/history','/glossary','/disclaimer'].includes(route) && (nav === 'more' || nav === route.slice(1)));
    el.classList.toggle('text-primary-700', !!active);
    el.classList.toggle('text-slate-500', !active && el.classList.contains('nav-item'));
    if (el.classList.contains('side-nav-link')) el.classList.toggle('bg-primary-50', !!active);
  });
  const renderer = routes[route] || (() => { main.innerHTML = '<div class="text-center py-12"><p>Page not found</p><a href="#/" class="text-primary-700 underline">Home</a></div>'; });
  main.innerHTML = '';
  renderer(main);
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = state.lang === 'en' ? 'EN' : state.lang === 'ur' ? 'اردو' : 'RU';
}

// ——— HOME ———
function renderHome(el) {
  el.innerHTML = `
    <div class="space-y-6 lg:space-y-8">
      <div class="text-center pt-2">
        <img src="/icons/logo.png" alt="Miqdaar Logo" class="logo-hero mb-4" />
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">${t('home.hero')}</h1>
        <p class="mt-2 text-slate-600 text-sm sm:text-base max-w-md mx-auto">${t('home.subtitle')}</p>
        <p class="mt-1 text-xs text-primary-600 font-medium">Simple calculations. Clear evidence. Respect for every madhhab.</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <a href="#/zakat" class="card-interactive p-5 sm:p-6 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3">
          <div class="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-3xl shrink-0">💰</div>
          <div class="flex-1">
            <div class="font-semibold text-lg text-slate-900">${t('home.zakat')}</div>
            <div class="text-sm text-slate-500 mt-0.5">${t('home.zakatDesc')}</div>
          </div>
        </a>
        <a href="#/warasat" class="card-interactive p-5 sm:p-6 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3">
          <div class="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl shrink-0">📜</div>
          <div class="flex-1">
            <div class="font-semibold text-lg text-slate-900">${t('home.warasat')}</div>
            <div class="text-sm text-slate-500 mt-0.5">${t('home.warasatDesc')}</div>
          </div>
        </a>
      </div>

      <div class="ayah-card">
        <div class="text-xs font-medium text-primary-600 mb-1">Quran 4:11</div>
        <p class="font-arabic text-lg text-slate-800 mb-2" dir="rtl">${(QURAN['4:11']?.arabic || '').slice(0, 140)}...</p>
        <p class="text-sm text-slate-600">${(QURAN['4:11']?.translation_en || '').slice(0, 160)}...</p>
        <a href="#/evidence" class="inline-block mt-3 text-sm font-medium text-primary-700">Read full verse →</a>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <a href="#/evidence" class="card-interactive p-4 text-center"><div class="text-2xl mb-1">📖</div><div class="text-xs sm:text-sm font-medium">Quran & Hadith</div></a>
        <a href="#/learn" class="card-interactive p-4 text-center"><div class="text-2xl mb-1">🎓</div><div class="text-xs sm:text-sm font-medium">Learn</div></a>
        <a href="#/glossary" class="card-interactive p-4 text-center"><div class="text-2xl mb-1">📚</div><div class="text-xs sm:text-sm font-medium">Glossary</div></a>
        <a href="#/history" class="card-interactive p-4 text-center"><div class="text-2xl mb-1">📋</div><div class="text-xs sm:text-sm font-medium">History</div></a>
      </div>

      <p class="text-xs text-center text-slate-400">${t('disclaimer.short')}</p>
    </div>`;
}

// ——— MADHHAB ———
function renderMadhhabSelect(el) {
  const groups = [
    { group: t('madhhab.sunni'), items: ['hanafi','shafii','maliki','hanbali'] },
    { group: t('madhhab.shia'), items: ['jafari'] },
    { group: t('madhhab.other'), items: ['other','unknown'] }
  ];
  el.innerHTML = `
    <div class="space-y-6 max-w-lg mx-auto">
      <div class="text-center">
        <img src="/icons/logo.png" alt="" class="w-16 h-16 mx-auto rounded-full object-cover mb-3" />
        <h1 class="text-xl font-bold">${t('madhhab.title')}</h1>
        <p class="mt-2 text-sm text-slate-600">${t('madhhab.explain')}</p>
      </div>
      ${groups.map(g => `
        <div>
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">${g.group}</div>
          <div class="space-y-2">${g.items.map(m => `
            <button data-madhhab="${m}" class="madhhab-btn w-full text-left card-interactive p-4 flex items-center justify-between">
              <span class="font-medium">${MADHHAB_LABELS[m]?.en || m}</span>
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="card p-4 bg-amber-50 border-amber-200">
        <p class="text-sm text-amber-900">${t('madhhab.generalNote')}</p>
        <button data-madhhab="general" class="madhhab-btn mt-3 btn-secondary text-sm py-2.5">${t('madhhab.continueGeneral')}</button>
      </div>
    </div>`;
  el.querySelectorAll('.madhhab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.madhhab = btn.getAttribute('data-madhhab');
      localStorage.setItem('miqdaar_madhhab', state.madhhab);
      navigate('/');
    });
  });
}

// ——— ZAKAT (single page) ———
function renderZakatPage(el) {
  const m = MADHHAB_LABELS[state.madhhab]?.en || state.madhhab || 'General';
  el.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl">💰</div>
        <div>
          <h1 class="text-xl font-bold">Zakat Calculator</h1>
          <p class="text-xs text-slate-500">Methodology: <strong>${m}</strong> · <a href="#/madhhab" class="text-primary-700 underline">Change</a></p>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">💵 Cash & Liquidity</h3>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Cash at home</label><input type="number" id="z-cash-home" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Bank / savings</label><input type="number" id="z-bank" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Mobile wallets</label><input type="number" id="z-wallets" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Foreign currency (converted)</label><input type="number" id="z-fx" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div class="calc-full"><label class="text-xs text-slate-500">Receivables (good loans)</label><input type="number" id="z-recv" class="input-field" min="0" step="any" placeholder="0" /></div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">🥇 Gold</h3>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Weight (grams)</label><input type="number" id="z-gold-w" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Purity</label>
            <select id="z-gold-p" class="select-field"><option value="24K">24K</option><option value="22K" selected>22K</option><option value="21K">21K</option><option value="20K">20K</option><option value="18K">18K</option></select>
          </div>
          <div class="calc-full"><label class="text-xs text-slate-500">Price per gram (${state.currency})</label>
            <div class="flex gap-2"><input type="number" id="z-gold-price" class="input-field flex-1" min="0" step="any" placeholder="Market price" />
            <button type="button" id="z-fetch-gold" class="btn-ghost border text-xs px-3 shrink-0">Live</button></div>
          </div>
          <div class="calc-full"><label class="text-xs text-slate-500">Jewelry purpose</label>
            <select id="z-jewelry-usage" class="select-field">
              <option value="PERSONAL_USE_ONLY">Personal use only</option>
              <option value="INVESTMENT_OR_SAVINGS">Held as investment / savings</option>
              <option value="MIXED">Mixed (personal + savings)</option>
            </select>
            <p class="text-xs text-amber-700 mt-1">Hanafi/Jaʿfarī often include personal jewelry; Shafiʿi/Maliki/Hanbali often exempt.</p>
          </div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">🥈 Silver</h3>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Weight (grams)</label><input type="number" id="z-silver-w" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Price per gram</label>
            <div class="flex gap-2"><input type="number" id="z-silver-price" class="input-field flex-1" min="0" step="any" placeholder="0" />
            <button type="button" id="z-fetch-silver" class="btn-ghost border text-xs px-3 shrink-0">Live</button></div>
          </div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">🏪 Business (trade assets only)</h3>
        <p class="text-xs text-slate-500">Inventory for sale, business cash & receivables. Shop/building/machinery excluded.</p>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Inventory for sale</label><input type="number" id="z-biz-inv" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Business cash/bank</label><input type="number" id="z-biz-cash" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div class="calc-full"><label class="text-xs text-slate-500">Business receivables</label><input type="number" id="z-biz-recv" class="input-field" min="0" step="any" placeholder="0" /></div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">📈 Investments (zakatable portion)</h3>
        <p class="text-xs text-slate-500">Trading positions & resale assets. Personal home / long-term rental usually not like inventory.</p>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Shares (trading)</label><input type="number" id="z-shares-t" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Shares (zakatable if dividends)</label><input type="number" id="z-shares-d" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Mutual funds (portion)</label><input type="number" id="z-mf" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Property for resale</label><input type="number" id="z-prop" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div class="calc-full"><label class="text-xs text-slate-500">Crypto (trading)</label><input type="number" id="z-crypto" class="input-field" min="0" step="any" placeholder="0" /></div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">📉 Liabilities</h3>
        <div class="calc-grid">
          <div><label class="text-xs text-slate-500">Immediately due debts</label><input type="number" id="z-debts" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Short-term liabilities</label><input type="number" id="z-stliab" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div class="calc-full"><label class="text-xs text-slate-500">Pending bills & salaries</label><input type="number" id="z-bills" class="input-field" min="0" step="any" placeholder="0" /></div>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="z-use-silver-nisab" checked /> Prefer silver Nisab (classical for cash; benefits the poor)</label>
      </div>

      <button id="z-calc" class="btn-primary">Calculate Zakat</button>
      <div id="z-result" class="hidden"></div>
      <p class="text-xs text-center text-slate-400">Educational calculation — not a fatwa. Rules v1.1</p>
    </div>`;

  const num = (id) => parseFloat(document.getElementById(id)?.value) || 0;

  document.getElementById('z-fetch-gold')?.addEventListener('click', async () => {
    const btn = document.getElementById('z-fetch-gold');
    btn.textContent = '...';
    const rates = await fetchLiveRates(state.currency);
    if (rates.success && rates.goldPerGram != null) {
      document.getElementById('z-gold-price').value = rates.goldPerGram.toFixed(2);
      btn.textContent = 'Live';
      btn.title = `${rates.currency} · ${rates.timestamp} · ~$${rates.goldUsdPerOz?.toFixed(0)}/oz`;
    } else {
      btn.textContent = 'N/A';
      alert(rates.message || 'Live gold price unavailable. Enter price per gram manually.');
    }
  });
  document.getElementById('z-fetch-silver')?.addEventListener('click', async () => {
    const btn = document.getElementById('z-fetch-silver');
    btn.textContent = '...';
    const rates = await fetchLiveRates(state.currency);
    if (rates.success && rates.silverPerGram != null) {
      document.getElementById('z-silver-price').value = rates.silverPerGram.toFixed(2);
      btn.textContent = 'Live';
      btn.title = `${rates.currency} · ${rates.timestamp}`;
    } else {
      btn.textContent = 'N/A';
      alert(rates.message || 'Live silver price unavailable. Enter price per gram manually.');
    }
  });

  document.getElementById('z-calc')?.addEventListener('click', () => {
    const jewelryUsage = document.getElementById('z-jewelry-usage')?.value || 'PERSONAL_USE_ONLY';
    const input = {
      methodology: state.madhhab || 'general',
      currency: state.currency,
      cashAtHome: num('z-cash-home'), bankAccounts: num('z-bank'), mobileWallets: num('z-wallets'),
      foreignCurrency: num('z-fx'), receivables: num('z-recv'),
      gold: {
        weightGrams: num('z-gold-w'), purity: document.getElementById('z-gold-p')?.value || '22K',
        pricePerGram: num('z-gold-price'),
        isJewelry: jewelryUsage !== 'INVESTMENT_OR_SAVINGS',
        jewelryPersonalUse: jewelryUsage === 'PERSONAL_USE_ONLY'
      },
      jewelryUsage,
      silver: { weightGrams: num('z-silver-w'), purity: 1, pricePerGram: num('z-silver-price') },
      businessInventory: num('z-biz-inv'), businessCash: num('z-biz-cash'), businessReceivables: num('z-biz-recv'),
      sharesTrading: num('z-shares-t'), sharesDividendsPortion: num('z-shares-d'),
      mutualFundsPortion: num('z-mf'), propertyForResale: num('z-prop'), cryptoTrading: num('z-crypto'),
      debtsDue: num('z-debts'), shortTermLiabilities: num('z-stliab'), pendingBills: num('z-bills'),
      goldPricePerGram: num('z-gold-price'), silverPricePerGram: num('z-silver-price'),
      useSilverNisab: document.getElementById('z-use-silver-nisab')?.checked !== false
    };
    const result = calculateZakat(input);
    const box = document.getElementById('z-result');
    box.classList.remove('hidden');
    if (!result.success) {
      box.innerHTML = `<div class="card p-5 text-center space-y-3"><div class="badge-scholar mx-auto">${t('common.scholarRequired')}</div>
        <p class="text-sm">${result.message || result.error}</p></div>`;
      return;
    }
    const b = result.breakdown;
    const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    box.innerHTML = `
      <div class="card p-5 space-y-3 border-primary-200">
        <h2 class="font-bold text-lg text-center">Estimated Zakat</h2>
        <div class="flex justify-between text-sm"><span class="text-slate-500">Eligible assets</span><span>${fmt(b.gross)} ${result.currency}</span></div>
        <div class="flex justify-between text-sm"><span class="text-slate-500">Deductions</span><span>${fmt(b.debtsDeducted)} ${result.currency}</span></div>
        <div class="flex justify-between font-medium"><span>Net zakatable</span><span>${fmt(b.netZakatable)} ${result.currency}</span></div>
        <hr class="border-slate-100">
        <div class="flex justify-between text-sm"><span class="text-slate-500">Gold Nisab</span><span>${fmt(b.goldNisabValue)}</span></div>
        <div class="flex justify-between text-sm"><span class="text-slate-500">Silver Nisab</span><span>${fmt(b.silverNisabValue)}</span></div>
        <div class="flex justify-between text-sm"><span class="text-slate-500">Above Nisab?</span><span class="${b.aboveNisab?'text-emerald-700 font-medium':'text-slate-600'}">${b.aboveNisab?'Yes':'No'}</span></div>
        <hr class="border-slate-100">
        <div class="flex justify-between items-baseline"><span class="font-semibold text-lg">Zakat Due</span>
          <span class="font-bold text-2xl text-primary-700">${fmt(b.zakatDue)} ${result.currency}</span></div>
        <div class="text-xs text-slate-500">Rate 2.5% (1/40) · ${MADHHAB_LABELS[result.methodology]?.en || result.methodology} · Rules v${result.rulesVersion}</div>
        ${(result.warnings||[]).map(w => `<div class="badge-warning text-left">${w.message}</div>`).join('')}
        ${(result.assumptions||[]).map(a => `<p class="text-xs text-slate-500">• ${a}</p>`).join('')}
        <div class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">${DISCLAIMER.en}</div>
      </div>`;
    saveHistory({ type: 'zakat', result, input });
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function renderWarasatPage(el) {
  const m = MADHHAB_LABELS[state.madhhab]?.en || state.madhhab || 'General';
  el.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">📜</div>
        <div>
          <h1 class="text-xl font-bold">Islamic Inheritance (Faraid)</h1>
          <p class="text-xs text-slate-500">Methodology: <strong>${m}</strong> · <a href="#/madhhab" class="text-primary-700 underline">Change</a></p>
        </div>
      </div>
      <p class="text-sm text-slate-600">${t('warasat.intro')}</p>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">👤 Report name (optional)</h3>
        <p class="text-xs text-slate-500">Used on the PDF you download or share.</p>
        <div class="calc-grid">
          <div>
            <label class="text-xs text-slate-500">Title</label>
            <select id="w-title" class="select-field">
              <option value="">—</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="Sir">Sir</option>
              <option value="Qari">Qari</option>
              <option value="Hafiz">Hafiz</option>
              <option value="Dr">Dr</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-slate-500">Full name</label>
            <input type="text" id="w-name" class="input-field" placeholder="Optional" />
          </div>
        </div>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">💵 Estate</h3>
        <p class="text-xs text-slate-500">Net estate after funeral, debts and valid wasiyyah (max 1/3 to non-heirs).</p>
        <div class="calc-grid">
          <div class="calc-full"><label class="text-xs text-slate-500">Gross estate (${state.currency})</label>
            <input type="number" id="w-gross" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Funeral / burial</label>
            <input type="number" id="w-funeral" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div><label class="text-xs text-slate-500">Debts to settle</label>
            <input type="number" id="w-debts" class="input-field" min="0" step="any" placeholder="0" /></div>
          <div class="calc-full"><label class="text-xs text-slate-500">Wasiyyah (bequest, ≤ 1/3 of remaining)</label>
            <input type="number" id="w-wasiyyah" class="input-field" min="0" step="any" placeholder="0" /></div>
        </div>
        <p class="text-xs text-slate-500" id="w-net-hint">Net distributable will be calculated automatically.</p>
      </div>

      <div class="card p-4 space-y-3">
        <h3 class="font-semibold text-primary-800">🌳 Heirs — family tree</h3>
        <p class="text-xs text-slate-500 mb-2">Select who survived the deceased. Tree updates as you type.</p>
        <div id="w-tree" class="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center text-sm"></div>
        <div class="calc-grid mt-3">
          <div><label class="text-xs text-slate-500">Husband alive?</label>
            <select id="w-husband" class="select-field"><option value="0">No</option><option value="1">Yes</option></select></div>
          <div><label class="text-xs text-slate-500">Wives (0–4)</label>
            <input type="number" id="w-wives" class="input-field" min="0" max="4" value="0" /></div>
          <div><label class="text-xs text-slate-500">Sons</label>
            <input type="number" id="w-sons" class="input-field" min="0" value="0" /></div>
          <div><label class="text-xs text-slate-500">Daughters</label>
            <input type="number" id="w-daughters" class="input-field" min="0" value="0" /></div>
          <div><label class="text-xs text-slate-500">Father alive?</label>
            <select id="w-father" class="select-field"><option value="false">No</option><option value="true">Yes</option></select></div>
          <div><label class="text-xs text-slate-500">Mother alive?</label>
            <select id="w-mother" class="select-field"><option value="false">No</option><option value="true">Yes</option></select></div>
        </div>
        <details class="mt-2">
          <summary class="cursor-pointer text-sm font-medium text-primary-700">Siblings & more (optional)</summary>
          <div class="calc-grid mt-3">
            <div><label class="text-xs">Full brothers</label><input type="number" id="w-fb" class="input-field" min="0" value="0" /></div>
            <div><label class="text-xs">Full sisters</label><input type="number" id="w-fs" class="input-field" min="0" value="0" /></div>
            <div><label class="text-xs">Paternal brothers</label><input type="number" id="w-pb" class="input-field" min="0" value="0" /></div>
            <div><label class="text-xs">Paternal sisters</label><input type="number" id="w-ps" class="input-field" min="0" value="0" /></div>
            <div><label class="text-xs">Maternal brothers</label><input type="number" id="w-mb" class="input-field" min="0" value="0" /></div>
            <div><label class="text-xs">Maternal sisters</label><input type="number" id="w-ms" class="input-field" min="0" value="0" /></div>
          </div>
        </details>
      </div>

      <button id="w-calc" class="btn-primary">Calculate Inheritance</button>
      <div id="w-result" class="hidden space-y-3"></div>
    </div>`;

  const num = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const intv = (id) => parseInt(document.getElementById(id)?.value, 10) || 0;

  function computeNet() {
    const gross = num('w-gross');
    const funeral = num('w-funeral');
    const debts = num('w-debts');
    let after = Math.max(0, gross - funeral - debts);
    let wasi = num('w-wasiyyah');
    const maxWasi = after / 3;
    if (wasi > maxWasi) wasi = maxWasi;
    const net = Math.max(0, after - wasi);
    const hint = document.getElementById('w-net-hint');
    if (hint) {
      hint.textContent = `Net distributable: ${net.toLocaleString(undefined,{maximumFractionDigits:2})} ${state.currency}` +
        (num('w-wasiyyah') > maxWasi ? ` (wasiyyah capped at 1/3 = ${maxWasi.toLocaleString(undefined,{maximumFractionDigits:2})})` : '');
    }
    return net;
  }

  function updateTree() {
    const nodes = [];
    if (intv('w-husband') === 1) nodes.push('👨 Husband');
    const wives = intv('w-wives');
    if (wives > 0) nodes.push(wives === 1 ? '👩 Wife' : `👩 Wives ×${wives}`);
    if (document.getElementById('w-father')?.value === 'true') nodes.push('👴 Father');
    if (document.getElementById('w-mother')?.value === 'true') nodes.push('👵 Mother');
    const sons = intv('w-sons'), daughters = intv('w-daughters');
    if (sons) nodes.push(sons === 1 ? '👦 Son' : `👦 Sons ×${sons}`);
    if (daughters) nodes.push(daughters === 1 ? '👧 Daughter' : `👧 Daughters ×${daughters}`);
    const fb = intv('w-fb'), fs = intv('w-fs'), mb = intv('w-mb'), ms = intv('w-ms');
    if (fb) nodes.push(`Brothers ×${fb}`);
    if (fs) nodes.push(`Sisters ×${fs}`);
    if (mb + ms) nodes.push(`Maternal siblings ×${mb+ms}`);
    const tree = document.getElementById('w-tree');
    if (!tree) return;
    tree.innerHTML = nodes.length
      ? `<div class="font-medium text-slate-700 mb-2">Deceased</div>
         <div class="flex flex-wrap justify-center gap-2">${nodes.map(n =>
           `<span class="inline-block px-3 py-1.5 rounded-lg bg-white border border-primary-200 text-primary-800 text-xs font-medium">${n}</span>`
         ).join('')}</div>`
      : '<span class="text-slate-400">Add heirs below — tree will appear here</span>';
  }

  ['w-gross','w-funeral','w-debts','w-wasiyyah'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', computeNet);
  });
  ['w-husband','w-wives','w-sons','w-daughters','w-father','w-mother','w-fb','w-fs','w-pb','w-ps','w-mb','w-ms'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateTree);
    document.getElementById(id)?.addEventListener('change', updateTree);
  });
  updateTree();
  computeNet();

  document.getElementById('w-calc')?.addEventListener('click', () => {
    const net = computeNet();
    const input = {
      methodology: state.madhhab || 'general',
      netEstate: net,
      reportTitle: document.getElementById('w-title')?.value || '',
      reportName: document.getElementById('w-name')?.value?.trim() || '',
      gross: num('w-gross'),
      funeral: num('w-funeral'),
      debts: num('w-debts'),
      wasiyyah: num('w-wasiyyah'),
      heirs: {
        husbands: intv('w-husband'),
        wives: intv('w-wives'),
        sons: intv('w-sons'),
        daughters: intv('w-daughters'),
        father: document.getElementById('w-father')?.value === 'true',
        mother: document.getElementById('w-mother')?.value === 'true',
        fullBrothers: intv('w-fb'),
        fullSisters: intv('w-fs'),
        paternalBrothers: intv('w-pb'),
        paternalSisters: intv('w-ps'),
        maternalBrothers: intv('w-mb'),
        maternalSisters: intv('w-ms')
      }
    };
    const result = calculateInheritance(input);
    const box = document.getElementById('w-result');
    box.classList.remove('hidden');
    if (!result.success) {
      box.innerHTML = `<div class="card p-5 text-center space-y-3"><div class="badge-scholar mx-auto">${t('common.scholarRequired')}</div>
        <p class="text-sm">${result.message}</p>
        <button type="button" id="w-new" class="btn-secondary">New calculation</button></div>`;
      document.getElementById('w-new')?.addEventListener('click', () => renderWarasatPage(el));
      return;
    }
    const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const fracStr = f => {
      if (f == null) return 'Residuary (ʿaṣabah)';
      if (Math.abs(f - 0.5) < 0.001) return '1/2';
      if (Math.abs(f - 0.25) < 0.001) return '1/4';
      if (Math.abs(f - 0.125) < 0.001) return '1/8';
      if (Math.abs(f - 1/3) < 0.001) return '1/3';
      if (Math.abs(f - 2/3) < 0.001) return '2/3';
      if (Math.abs(f - 1/6) < 0.001) return '1/6';
      return (f * 100).toFixed(1) + '%';
    };
    const displayName = [input.reportTitle, input.reportName].filter(Boolean).join(' ');
    box.innerHTML = `
      <div id="w-report" class="space-y-3">
        <div class="text-center">
          <div class="text-xs text-primary-700 font-semibold">miqdaar.online · Miqdaar Faraid Report</div>
          ${displayName ? `<div class="font-medium mt-1">Prepared for: ${displayName}</div>` : ''}
          <div class="text-sm text-slate-500 mt-1">Net Estate: <strong>${fmt(result.netEstate)} ${state.currency}</strong> · ${MADHHAB_LABELS[result.methodology]?.en || result.methodology}</div>
        </div>
        ${result.shares.map(s => `
          <div class="card p-4">
            <div class="flex justify-between items-start gap-2">
              <div>
                <div class="font-semibold">${s.heir}</div>
                <div class="text-sm text-primary-700 font-medium">${fracStr(s.fraction)}${s.percentage != null ? ' · ' + s.percentage + '%' : ''}</div>
              </div>
              <div class="text-right font-bold text-lg shrink-0">${fmt(s.amount)} ${state.currency}</div>
            </div>
            <details class="mt-2">
              <summary class="cursor-pointer text-xs font-medium text-primary-700">Why this share?</summary>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">${s.reason || ''}${s.evidence ? ' · Evidence: ' + s.evidence : ''}</p>
            </details>
          </div>`).join('')}
        ${(result.excluded||[]).length ? `<div class="card p-4"><div class="text-sm font-medium mb-1">Excluded (ḥajb)</div>
          ${result.excluded.map(e => `<p class="text-xs text-slate-600">• ${e.heir}: ${e.reason}</p>`).join('')}</div>` : ''}
        ${(result.notes||[]).map(n => `<p class="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">${n}</p>`).join('')}
        <div class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">${DISCLAIMER.en}</div>
        <p class="text-xs text-center text-slate-400">Rules v${result.rulesVersion} · Educational — not a fatwa · miqdaar.online</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 no-print">
        <button type="button" id="w-pdf" class="btn-primary">Download / Print PDF</button>
        <button type="button" id="w-new" class="btn-secondary">New calculation</button>
      </div>`;

    document.getElementById('w-new')?.addEventListener('click', () => {
      renderWarasatPage(el);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('w-pdf')?.addEventListener('click', () => {
      openWarasatPdf(result, input, state.currency);
    });

    saveHistory({ type: 'warasat', result, input });
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function openWarasatPdf(result, input, currency) {
  const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const fracStr = f => {
    if (f == null) return 'Residuary';
    if (Math.abs(f - 0.5) < 0.001) return '1/2';
    if (Math.abs(f - 0.25) < 0.001) return '1/4';
    if (Math.abs(f - 0.125) < 0.001) return '1/8';
    if (Math.abs(f - 1/3) < 0.001) return '1/3';
    if (Math.abs(f - 2/3) < 0.001) return '2/3';
    if (Math.abs(f - 1/6) < 0.001) return '1/6';
    return (f * 100).toFixed(1) + '%';
  };
  const displayName = [input.reportTitle, input.reportName].filter(Boolean).join(' ') || '—';
  const rows = (result.shares || []).map(s => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${s.heir}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${fracStr(s.fraction)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${fmt(s.amount)} ${currency}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px;color:#475569;">${s.reason || ''}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Miqdaar Faraid — ${displayName}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#0f172a;max-width:800px;margin:24px auto;padding:0 16px;}
      .brand{position:fixed;top:12px;right:16px;font-size:11px;color:#0f766e;font-weight:600;}
      .footer{position:fixed;bottom:12px;left:16px;right:16px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;}
      h1{color:#0f766e;font-size:1.35rem;margin:0 0 4px;}
      table{width:100%;border-collapse:collapse;margin:16px 0;}
      th{background:#f0fdfa;text-align:left;padding:8px;border:1px solid #e2e8f0;font-size:12px;}
      .disc{font-size:11px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;}
      @media print{.no-print{display:none;} body{margin:0;}}
    </style></head><body>
    <div class="brand">miqdaar.online</div>
    <h1>Miqdaar — Faraid Report</h1>
    <p style="margin:0;color:#64748b;font-size:13px;">Islamic inheritance calculation · Educational tool — not a fatwa</p>
    <p style="margin:12px 0 0;"><strong>Prepared for:</strong> ${displayName}<br>
    <strong>Net estate:</strong> ${fmt(result.netEstate)} ${currency}<br>
    <strong>Methodology:</strong> ${result.methodology}<br>
    <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <table>
      <thead><tr><th>Heir</th><th>Share</th><th>Amount</th><th>Why (evidence / rule)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${(result.notes||[]).map(n => `<p style="font-size:12px;color:#92400e;">${n}</p>`).join('')}
    <div class="disc">${DISCLAIMER.en}<br><br>Rules v${result.rulesVersion} · Generated by Miqdaar · https://miqdaar.online</div>
    <div class="footer"><span>Miqdaar — Faraid & Zakat</span><span>miqdaar.online</span></div>
    <p class="no-print" style="margin-top:24px;"><button onclick="window.print()" style="padding:10px 20px;background:#0f766e;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Print / Save as PDF</button></p>
    <script>setTimeout(()=>window.print(),400)</script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to download the PDF report.'); return; }
  w.document.write(html);
  w.document.close();
}

// ——— OTHER PAGES (compact) ———
function renderLearn(el) {
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">Learning Center</h1>
    <div class="space-y-2">${['What is Zakat?','Who must pay Zakat?','What is Nisab?','What is Hawl?','Gold & Silver Zakat','Zakat recipients (9:60)','Common Zakat mistakes','What is Faraid?','Fixed shares (Ashab al-Furud)','Residuary heirs (Asabah)','Hajb (blocking)','Common Warasat mistakes'].map(title => `
      <a href="#/evidence" class="card-interactive p-4 block"><div class="font-medium">${title}</div>
      <div class="text-xs text-slate-500">Quran, Hadith & fiqh notes</div></a>`).join('')}</div></div>`;
}

function renderEvidence(el) {
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">Quran & Hadith Evidence</h1>
    <p class="text-sm text-slate-600">Only verified references.</p>
    <h2 class="font-semibold text-primary-700">Inheritance</h2>
    ${['4:7','4:11','4:12','4:176'].map(ref => { const v = QURAN[ref]; return v ? `
      <div class="ayah-card"><div class="text-xs font-medium text-primary-600">Quran ${ref}</div>
      <p class="font-arabic text-lg my-2" dir="rtl">${v.arabic}</p>
      <p class="text-sm text-slate-700">${v.translation_en}</p></div>` : ''; }).join('')}
    <h2 class="font-semibold text-primary-700">Zakat</h2>
    ${['9:60','2:267','9:103'].map(ref => { const v = QURAN[ref]; return v ? `
      <div class="ayah-card"><div class="text-xs font-medium text-primary-600">Quran ${ref}</div>
      <p class="font-arabic text-lg my-2" dir="rtl">${v.arabic}</p>
      <p class="text-sm text-slate-700">${v.translation_en}</p></div>` : ''; }).join('')}
    <h2 class="font-semibold text-amber-700">Hadith</h2>
    ${Object.entries(HADITH).map(([,h]) => `
      <div class="hadith-card"><div class="text-xs font-medium text-amber-700">${h.collection} ${h.hadith_number}</div>
      <p class="text-sm mt-1">${h.translation_en}</p>
      <p class="text-xs text-slate-500 mt-2">Grade: ${h.grade}</p></div>`).join('')}
  </div>`;
}

function renderGlossary(el) {
  const terms = [
    { term: 'Zakat', ar: 'زكاة', def: 'Obligatory charity on qualifying wealth above Nisab after Hawl.' },
    { term: 'Nisab', ar: 'نصاب', def: 'Minimum threshold of wealth that makes Zakat due.' },
    { term: 'Hawl', ar: 'حول', def: 'One lunar year for many Zakat categories.' },
    { term: 'Faraid', ar: 'فرائض', def: 'Fixed shares of inheritance in the Quran.' },
    { term: 'Asabah', ar: 'عصبة', def: 'Residuary heirs after fixed shares.' },
    { term: 'Hajb', ar: 'حجب', def: 'Blocking of one heir by another.' },
    { term: 'Radd', ar: 'رد', def: 'Return of surplus to fixed-share heirs.' },
    { term: 'Awl', ar: 'عول', def: 'Proportional reduction when shares exceed estate.' },
    { term: 'Wasiyyah', ar: 'وصية', def: 'Bequest, generally limited to one-third.' },
    { term: 'Madhhab', ar: 'مذهب', def: 'School of Islamic jurisprudence.' }
  ];
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">Islamic Glossary</h1>
    ${terms.map(t => `<div class="card p-4"><div class="font-semibold">${t.term} <span class="font-arabic text-primary-700">(${t.ar})</span></div>
    <p class="text-sm text-slate-600 mt-1">${t.def}</p></div>`).join('')}</div>`;
}

function renderHistory(el) {
  const items = state.history.slice().reverse();
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">History</h1>
    <p class="text-sm text-slate-500">Stored locally only.</p>
    ${items.length === 0 ? '<p class="text-slate-500">No calculations yet.</p>' : items.map(h => `
      <div class="card p-4"><div class="flex justify-between"><span class="font-medium capitalize">${h.type}</span>
      <span class="text-xs text-slate-400">${new Date(h.at).toLocaleString()}</span></div>
      <div class="text-sm text-slate-600 mt-1">${h.type === 'zakat' ? `Zakat: ${h.result?.breakdown?.zakatDue ?? '—'} ${h.result?.currency || ''}` : `Estate: ${h.input?.netEstate ?? '—'}`}</div></div>`).join('')}</div>`;
}

function renderSettings(el) {
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">Settings</h1>
    <div class="card p-4 space-y-4">
      <div><label class="text-sm font-medium">Currency</label>
        <select id="set-currency" class="select-field mt-1">${CURRENCIES.map(c => `<option value="${c.code}" ${state.currency===c.code?'selected':''}>${c.code} — ${c.name}</option>`).join('')}</select></div>
      <div><label class="text-sm font-medium">Methodology</label>
        <a href="#/madhhab" class="block mt-1 text-primary-700 underline">${MADHHAB_LABELS[state.madhhab]?.en || 'Select'}</a></div>
      <div><label class="text-sm font-medium">Language</label>
        <div class="flex gap-2 mt-1">
          <button class="btn-ghost border ${state.lang==='en'?'border-primary-500':''}" data-lang="en">English</button>
          <button class="btn-ghost border ${state.lang==='ur'?'border-primary-500':''}" data-lang="ur">اردو</button>
          <button class="btn-ghost border ${state.lang==='roman-ur'?'border-primary-500':''}" data-lang="roman-ur">Roman</button>
        </div></div>
      <div><label class="text-sm font-medium">Groq API Key (for chatbot)</label>
        <input type="password" id="set-groq" class="input-field mt-1" placeholder="gsk_..." value="${state.groqKey}" />
        <p class="text-xs text-slate-500 mt-1">Stored only in your browser. Get a key at console.groq.com</p>
      </div>
    </div>
    <p class="text-xs text-slate-500">App v${APP_VERSION} · Rules v${RULES_VERSION}</p></div>`;
  document.getElementById('set-currency')?.addEventListener('change', e => {
    state.currency = e.target.value;
    localStorage.setItem('miqdaar_currency', state.currency);
  });
  document.getElementById('set-groq')?.addEventListener('change', e => {
    state.groqKey = e.target.value.trim();
    localStorage.setItem('miqdaar_groq_key', state.groqKey);
  });
  el.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang'))));
}

function renderDisclaimer(el) {
  el.innerHTML = `<div class="space-y-4 max-w-xl mx-auto"><h1 class="text-xl font-bold">Disclaimer</h1>
    <div class="card p-5 text-sm text-slate-700 space-y-3"><p>${DISCLAIMER.en}</p>
    <p>This is an educational calculator. It does not issue fatwas. Calculations are deterministic. Always verify important matters with a qualified scholar.</p></div></div>`;
}

function renderMore(el) {
  el.innerHTML = `<div class="space-y-2 max-w-xl mx-auto"><h1 class="text-xl font-bold mb-4">More</h1>
    <a href="#/glossary" class="card-interactive p-4 block">📚 Glossary</a>
    <a href="#/history" class="card-interactive p-4 block">📋 History</a>
    <a href="#/settings" class="card-interactive p-4 block">⚙️ Settings</a>
    <a href="#/disclaimer" class="card-interactive p-4 block">⚠️ Disclaimer</a>
    <a href="#/madhhab" class="card-interactive p-4 block">🕌 Change Methodology</a></div>`;
}

function saveHistory(entry) {
  state.history.push({ ...entry, at: Date.now() });
  if (state.history.length > 50) state.history.shift();
  localStorage.setItem('miqdaar_history', JSON.stringify(state.history));
}

// ——— GROQ CHATBOT ———
async function sendChat() {
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const text = (input?.value || '').trim();
  if (!text) return;
  input.value = '';
  messages.innerHTML += `<div class="chat-user">${escapeHtml(text)}</div>`;
  messages.scrollTop = messages.scrollHeight;

  if (!state.groqKey) {
    messages.innerHTML += `<div class="chat-bot">Please add your Groq API key in <a href="#/settings" class="underline text-primary-700">Settings</a> to use the assistant. Get a free key at console.groq.com</div>`;
    messages.scrollTop = messages.scrollHeight;
    return;
  }

  const thinking = document.createElement('div');
  thinking.className = 'chat-bot text-slate-400';
  thinking.textContent = 'Thinking...';
  messages.appendChild(thinking);
  messages.scrollTop = messages.scrollHeight;

  const systemPrompt = `You are the educational assistant for Miqdaar, an Islamic Zakat and Faraid (inheritance) calculator.
STRICT RULES:
- You explain concepts, calculated results, and verified evidence only.
- You NEVER invent Quran verses, Hadith, or fiqh rulings.
- You NEVER issue a fatwa or personal religious ruling.
- You NEVER perform inheritance or Zakat mathematics yourself — the app engines do that.
- If asked for a ruling on a complex case, recommend consulting a qualified scholar.
- Be respectful, clear, and concise. Use simple language for ordinary Muslims.
- When relevant, cite Quran 4:11, 4:12, 4:176, 9:60 or Sahih Bukhari 6732 / 1447.
- User methodology context: ${state.madhhab || 'not set'}.
- Answer in the same language the user writes in when possible.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
    });
    thinking.remove();
    if (!res.ok) {
      const err = await res.text();
      messages.innerHTML += `<div class="chat-bot text-red-600">Error: ${res.status}. Check your API key in Settings.</div>`;
    } else {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'No response.';
      messages.innerHTML += `<div class="chat-bot">${escapeHtml(reply).replace(/\\n/g, '<br>')}</div>`;
    }
  } catch (e) {
    thinking.remove();
    messages.innerHTML += `<div class="chat-bot text-red-600">Network error. Please try again.</div>`;
  }
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
