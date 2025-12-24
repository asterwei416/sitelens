const { chromium } = require('playwright');

// 隨機 User-Agent 池
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// 隨機延遲
const randomDelay = (min = 100, max = 500) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

/**
 * 爬取 Level 0 與 Level 1 頁面
 * @param {string} url - Target URL
 * @param {Array|null} cookies - Optional session cookies [{name, value, domain, path}, ...]
 */
async function crawlPage(url, cookies = null) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 }
    });

    // 注入 Session Cookies (如果有提供)
    if (cookies && Array.isArray(cookies) && cookies.length > 0) {
        // 清理 Cookie 格式以符合 Playwright 要求
        const sanitizedCookies = cookies.map(c => {
            const clean = {
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || '/'
            };
            // sameSite 必須是 Strict, Lax, 或 None (首字母大寫)
            if (c.sameSite) {
                const sameSiteMap = {
                    'strict': 'Strict',
                    'lax': 'Lax',
                    'none': 'None',
                    'no_restriction': 'None',
                    'unspecified': 'Lax'
                };
                clean.sameSite = sameSiteMap[c.sameSite.toLowerCase()] || 'Lax';
            }
            // 處理 secure 和 httpOnly
            if (c.secure !== undefined) clean.secure = Boolean(c.secure);
            if (c.httpOnly !== undefined) clean.httpOnly = Boolean(c.httpOnly);
            // 處理過期時間
            if (c.expirationDate) clean.expires = c.expirationDate;
            return clean;
        });
        await context.addCookies(sanitizedCookies);
        console.log(`[Crawler] 已注入 ${sanitizedCookies.length} 個 cookies`);
    }

    try {
        // Level 0: 主頁面
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await randomDelay();

        const level0Data = await extractPageData(page, url);

        // Level 0 截圖 (供視覺多模態 AI 分析)
        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 70,
            fullPage: false
        });
        level0Data.screenshot = screenshotBuffer.toString('base64');

        // 取得同網域連結
        const baseUrl = new URL(url);
        const internalLinks = await page.evaluate((origin) => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links
                .map(a => {
                    try {
                        const href = a.getAttribute('href');
                        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
                        const fullUrl = new URL(href, window.location.origin);
                        if (fullUrl.origin === origin) {
                            return { url: fullUrl.href, text: a.textContent?.trim() || '' };
                        }
                    } catch { }
                    return null;
                })
                .filter(Boolean);
        }, baseUrl.origin);

        // 去重
        const uniqueLinks = [...new Map(internalLinks.map(l => [l.url, l])).values()];

        // Level 1: 並行抓取前 10 個連結 (效能限制)
        const linksToFetch = uniqueLinks.slice(0, 10);
        console.log(`[Level 1] 抓取 ${linksToFetch.length} 個頁面...`);

        const level1Data = await Promise.all(
            linksToFetch.map(async (link) => {
                try {
                    const l1Page = await context.newPage();
                    await l1Page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    await randomDelay(50, 200);
                    const title = await l1Page.title();
                    await l1Page.close();
                    return { url: link.url, title, linkText: link.text };
                } catch (error) {
                    return { url: link.url, title: '載入失敗', linkText: link.text, error: error.message };
                }
            })
        );

        return {
            level0: level0Data,
            level1: level1Data,
            allLinks: uniqueLinks
        };
    } finally {
        await browser.close();
    }
}

/**
 * 提取頁面資料
 */
async function extractPageData(page, url) {
    const html = await page.content();
    const title = await page.title();

    // 取得載入的 scripts
    const scripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script[src]')).map(s => ({
            src: s.getAttribute('src'),
            type: s.getAttribute('type') || 'text/javascript',
            async: s.hasAttribute('async'),
            defer: s.hasAttribute('defer')
        }));
    });

    // 偵測框架相關元素
    const frameworkHints = await page.evaluate(() => {
        const hints = {};

        // React
        if (document.querySelector('[data-reactroot]') || document.querySelector('#root')?._reactRootContainer) {
            hints.react = true;
        }

        // Vue
        if (document.querySelector('[data-v-]') || window.__VUE__) {
            hints.vue = true;
        }

        // Angular
        if (document.querySelector('[ng-version]') || document.querySelector('[_ngcontent]')) {
            hints.angular = true;
        }

        // Next.js
        if (document.querySelector('#__next')) {
            hints.nextjs = true;
        }

        // Nuxt
        if (document.querySelector('#__nuxt')) {
            hints.nuxt = true;
        }

        return hints;
    });

    return { url, title, html, scripts, frameworkHints };
}

/**
 * 爬取單一頁面及其連結 (用於向下探勘) - 含截圖
 * @param {string} url - Target URL
 * @param {Array|null} cookies - Optional session cookies [{name, value, domain, path}, ...]
 */
async function crawlSinglePage(url, cookies = null) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
        viewport: { width: 1440, height: 900 }
    });

    // 注入 Session Cookies (如果有提供)
    if (cookies && Array.isArray(cookies) && cookies.length > 0) {
        // 清理 Cookie 格式以符合 Playwright 要求
        const sanitizedCookies = cookies.map(c => {
            const clean = {
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || '/'
            };
            if (c.sameSite) {
                const sameSiteMap = {
                    'strict': 'Strict',
                    'lax': 'Lax',
                    'none': 'None',
                    'no_restriction': 'None',
                    'unspecified': 'Lax'
                };
                clean.sameSite = sameSiteMap[c.sameSite.toLowerCase()] || 'Lax';
            }
            if (c.secure !== undefined) clean.secure = Boolean(c.secure);
            if (c.httpOnly !== undefined) clean.httpOnly = Boolean(c.httpOnly);
            if (c.expirationDate) clean.expires = c.expirationDate;
            return clean;
        });
        await context.addCookies(sanitizedCookies);
        console.log(`[Crawler] 已注入 ${sanitizedCookies.length} 個 cookies`);
    }

    try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await randomDelay();

        const html = await page.content();
        const title = await page.title();

        // 取得載入的 scripts
        const scripts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('script[src]')).map(s => ({
                src: s.getAttribute('src'),
                type: s.getAttribute('type') || 'text/javascript',
                async: s.hasAttribute('async'),
                defer: s.hasAttribute('defer')
            }));
        });

        // 偵測框架相關元素
        const frameworkHints = await page.evaluate(() => {
            const hints = {};
            if (document.querySelector('[data-reactroot]') || document.querySelector('#root')?._reactRootContainer) {
                hints.react = true;
            }
            if (document.querySelector('[data-v-]') || window.__VUE__) {
                hints.vue = true;
            }
            if (document.querySelector('[ng-version]') || document.querySelector('[_ngcontent]')) {
                hints.angular = true;
            }
            if (document.querySelector('#__next')) {
                hints.nextjs = true;
            }
            if (document.querySelector('#__nuxt')) {
                hints.nuxt = true;
            }
            return hints;
        });

        // 截取頁面快照 (base64)
        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 70,
            fullPage: false // 僅視窗範圍，避免過大
        });
        const screenshot = screenshotBuffer.toString('base64');

        // 取得頁面中的所有連結
        const baseUrl = new URL(url);
        const links = await page.evaluate((origin) => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors
                .map(a => {
                    try {
                        const href = a.getAttribute('href');
                        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
                        const fullUrl = new URL(href, window.location.origin);
                        return { url: fullUrl.href, text: a.textContent?.trim() || '' };
                    } catch { }
                    return null;
                })
                .filter(Boolean);
        }, baseUrl.origin);

        const uniqueLinks = [...new Map(links.map(l => [l.url, l])).values()];

        return { url, title, html, links: uniqueLinks, screenshot, scripts, frameworkHints };
    } finally {
        await browser.close();
    }
}

module.exports = { crawlPage, crawlSinglePage };

