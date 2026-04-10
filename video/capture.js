const puppeteer = require('puppeteer');
const path = require('path');

const SHOTS = path.join(__dirname, 'public', 'screenshots');
const BASE = 'https://moxie-ai-insights.netlify.app';
const CLIENT = '1602401';
const CODE = '8675';

async function capture() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  // Set auth in localStorage so gates don't block
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.setItem('moxie_auth', 'ODY3NQ=='));

  // Scene 1: Login page (reload to show clean login)
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: `${SHOTS}/01_login_empty.png` });
  console.log('1. Login page (empty)');

  // Scene 2: Login filled
  await page.type('#client-input', CLIENT);
  await page.type('#code-input', CODE);
  await page.screenshot({ path: `${SHOTS}/02_login_filled.png` });
  console.log('2. Login page (filled)');

  // Scene 3: Click login -> Dashboard
  await page.click('#go-btn');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${SHOTS}/03_dashboard.png` });
  console.log('3. Dashboard');

  // Scene 4: Scroll to report cards
  await page.evaluate(() => {
    const el = document.querySelector('.reports-grid');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/04_report_cards.png` });
  console.log('4. Report cards');

  // Scene 5: Navigate directly to March report
  await page.goto(`${BASE}/clients/${CLIENT}/march-2026.html`, { waitUntil: 'networkidle2' });
  // Set localStorage to skip gate
  await page.evaluate(() => localStorage.setItem('moxie_auth', 'ODY3NQ=='));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SHOTS}/05_report_top.png` });
  console.log('5. Report top (Analysis)');

  // Scene 6: Scroll to Performance Overview
  await page.evaluate(() => {
    const el = document.querySelector('.perf-grid');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/06_performance.png` });
  console.log('6. Performance Overview');

  // Scene 7: Scroll to Platform Breakdown
  await page.evaluate(() => {
    const el = document.querySelector('.platforms-grid');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/07_platforms_top.png` });
  console.log('7. Platform Breakdown (top)');

  // Scene 8: Scroll to more platforms
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/08_platforms_mid.png` });
  console.log('8. Platform Breakdown (mid)');

  // Scene 9: Scroll to TikTok/Email/Social
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/09_platforms_bottom.png` });
  console.log('9. Platform Breakdown (bottom)');

  // Scene 10: Activities
  await page.evaluate(() => {
    const el = document.querySelector('.activity-list');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/10_activities.png` });
  console.log('10. Activities');

  // Scene 11: Services + MOXIE Recommends
  await page.evaluate(() => {
    const el = document.querySelector('.services-grid');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${SHOTS}/11_services_recommends.png` });
  console.log('11. Services + Recommends');

  // Scene 12: Open Ask MOXIE chat
  await page.evaluate(() => {
    const btn = document.querySelector('.moxie-chat-btn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SHOTS}/12_chat_open.png` });
  console.log('12. Chat open');

  // Scene 13: Type a question
  await page.type('#moxie-chat-input', 'How are we doing?');
  await page.click('#moxie-chat-send');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${SHOTS}/13_chat_answer.png` });
  console.log('13. Chat with answer');

  await browser.close();
  console.log('\nAll screenshots captured!');
}

capture().catch(console.error);
