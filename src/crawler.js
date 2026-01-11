const { chromium } = require('playwright');

// 截圖設定
const SCREENSHOT_CONFIG = {
    maxHeight: 16384,  // 提高截圖高度限制 (Playwright 最大支援約 16384px)
    quality: 70,       // JPEG 品質
    type: 'jpeg'
};

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
 * 自動捲動至頁面底部，觸發所有 Lazy Loading 內容
 * 包含安全機制防止無限捲動頁面造成無限迴圈
 * @param {Page} page - Playwright page 物件
 */
async function scrollToBottom(page) {
    const MAX_SCROLL_ITERATIONS = 30;  // 最大捲動次數
    const MAX_SCROLL_HEIGHT = SCREENSHOT_CONFIG.maxHeight + 1000; // 最大捲動高度（略高於截圖限制）

    await page.evaluate(async ({ maxIterations, maxHeight }) => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const scrollStep = window.innerHeight * 0.8; // 每次捲動 80% 視窗高度
        let lastScrollTop = -1;
        let currentScrollTop = 0;
        let iterations = 0;

        // 持續捲動直到：無法再捲動 / 達到次數上限 / 超過高度限制
        while (lastScrollTop !== currentScrollTop && iterations < maxIterations) {
            lastScrollTop = currentScrollTop;
            window.scrollBy(0, scrollStep);
            await delay(150); // 等待 Lazy Loading 觸發
            currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            iterations++;

            // 超過最大高度則提前停止
            if (currentScrollTop > maxHeight) {
                break;
            }
        }

        // 捲動回頂部（確保截圖從頂部開始）
        window.scrollTo(0, 0);
        await delay(500);  // 增加等待時間確保動畫完成
    }, { maxIterations: MAX_SCROLL_ITERATIONS, maxHeight: MAX_SCROLL_HEIGHT });

    console.log('[Crawler] 已完成頁面捲動，觸發 Lazy Loading');
}

/**
 * 截取頁面快照（帶高度限制，防止無限捲動頁面過長）
 * @param {Page} page - Playwright page 物件
 * @returns {Promise<Buffer>} 截圖 Buffer
 */
async function capturePageScreenshot(page) {
    // 先捲動至底部觸發 Lazy Loading，再捲回頂部
    await scrollToBottom(page);

    // 注入 CSS 停用所有動畫（防止 React/CSS 動畫導致元素不可見）
    await page.addStyleTag({
        content: `
            *, *::before, *::after {
                animation: none !important;
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition: none !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
            }
        `
    });

    // 確保所有動畫完成渲染後再截圖
    await page.waitForTimeout(500);

    // 取得頁面實際高度（供記錄用）
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    // 記錄頁面高度（若超過限制只是警告，仍使用 fullPage 截圖）
    if (pageHeight > SCREENSHOT_CONFIG.maxHeight) {
        console.log(`[Screenshot] 頁面高度 ${pageHeight}px 超過建議限制 ${SCREENSHOT_CONFIG.maxHeight}px，可能影響效能`);
    } else {
        console.log(`[Screenshot] 頁面高度 ${pageHeight}px，執行全頁截圖`);
    }

    // 始終使用 fullPage 截圖（確保捕捉完整內容）
    return await page.screenshot({
        type: SCREENSHOT_CONFIG.type,
        quality: SCREENSHOT_CONFIG.quality,
        fullPage: true
    });
}

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

        // Level 0 截圖 (供視覺多模態 AI 分析) - 帶高度限制
        // 注意：capturePageScreenshot 內部會執行捲動以觸發 Lazy Loading
        const screenshotBuffer = await capturePageScreenshot(page);

        // 截圖後再提取資料，確保 Lazy Loading 內容已被載入
        const level0Data = await extractPageData(page, url);
        level0Data.screenshot = screenshotBuffer.toString('base64');

        // 取得同網域連結 (允許同 Root Domain 的子網域)
        const baseUrl = new URL(url);
        const internalLinks = await page.evaluate((baseUrlStr) => {
            const currentUrl = new URL(baseUrlStr);

            // 輔助函式：取得 Root Domain (例如: esim.djbcard.com -> djbcard.com)
            const getRootDomain = (hostname) => {
                const parts = hostname.split('.');
                if (parts.length <= 2) return hostname;
                // 簡單處理常見的 .com.tw, .co.jp 等情況或直接取後兩段
                // 這裡採用簡單策略：取最後兩段 (針對 djbcard.com 這種 case)
                return parts.slice(-2).join('.');
            };

            const rootDomain = getRootDomain(currentUrl.hostname);

            const links = Array.from(document.querySelectorAll('a[href]'));
            return links
                .map(a => {
                    try {
                        const href = a.getAttribute('href');
                        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;

                        const fullUrl = new URL(href, window.location.origin);

                        // 檢查是否為主網域相同
                        const linkRootDomain = getRootDomain(fullUrl.hostname);

                        // 允許爬取條件：
                        // 1. 完全同源 (Origin 相同)
                        // 2. 或者是同一個 Root Domain (例如 sub.example.com -> example.com)
                        if (fullUrl.origin === currentUrl.origin || linkRootDomain === rootDomain) {
                            return { url: fullUrl.href, text: a.textContent?.trim() || '' };
                        }
                    } catch { }
                    return null;
                })
                .filter(Boolean);
        }, url);

        // 去重
        const uniqueLinks = [...new Map(internalLinks.map(l => [l.url, l])).values()];

        // 智慧排序：優先保留重要頁面 (Blog, About, Contact)，避免被大量商品頁淹沒
        uniqueLinks.sort((a, b) => {
            const getScore = (link) => {
                let score = 0;
                const urlLower = link.url.toLowerCase();
                const textLower = link.text ? link.text.toLowerCase() : '';

                // 1. 高價值關鍵字 (結構性頁面)
                const highValueKeywords = ['blog', 'news', 'about', 'contact', 'faq', 'support', 'pricing', 'features', 'service', 'teach'];
                if (highValueKeywords.some(k => urlLower.includes(k) || textLower.includes(k))) {
                    score += 10;
                }

                // 2. 避免商品頁/雜項頁霸榜 (降低權重)
                const lowValueKeywords = ['product', 'item', 'category', 'cart', 'login', 'register', 'signin', 'signup', 'account'];
                if (lowValueKeywords.some(k => urlLower.includes(k))) {
                    score -= 5;
                }

                // 3. URL 長度權重 (越短通常層級越高，作為次要排序依據)
                // 減少長度對分數的影響，避免蓋過關鍵字權重
                score -= urlLower.length * 0.05;

                return score;
            };

            return getScore(b) - getScore(a); // 降序排列 (分數高的排前面)
        });

        // Level 1: 並行抓取前 20 個連結 (效能限制)
        const linksToFetch = uniqueLinks.slice(0, 20);
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

        // 截取頁面快照 (base64) - 帶高度限制
        const screenshotBuffer = await capturePageScreenshot(page);
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

