/**
 * GA4 追蹤元素分析器
 * 分析網頁中可追蹤的互動元素，提供 GA4 事件追蹤建議
 */
const cheerio = require('cheerio');

/**
 * 從 HTML 字串分析 GA4 可追蹤元素
 * @param {string} html - 頁面 HTML 字串
 * @param {string} baseUrl - 網站基礎 URL
 * @returns {object} GA4 追蹤分析結果
 */
function analyzeGA4TrackingElements(html, baseUrl) {
    const $ = cheerio.load(html);
    let baseDomain = '';
    try {
        baseDomain = new URL(baseUrl).hostname;
    } catch (e) {
        baseDomain = '';
    }

    const result = {
        cta: [],
        forms: [],
        videos: [],
        downloads: [],
        outboundLinks: [],
        ecommerce: [],
        search: [],
        social: [],
        auth: [],
        scrollSections: []
    };

    // 1. CTA 按鈕分析
    $('button:not([type="submit"]), [role="button"], a.btn, a.button, [class*="btn-"], [class*="cta"]').each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim().substring(0, 50);
        if (text && !result.cta.find(c => c.text === text)) {
            result.cta.push({
                text,
                tag: el.tagName.toLowerCase(),
                classes: ($el.attr('class') || '').split(' ').slice(0, 3).join(' '),
                id: $el.attr('id') || null
            });
        }
    });

    // 2. 表單分析
    $('form').each((i, el) => {
        const $form = $(el);
        const $inputs = $form.find('input, select, textarea');
        result.forms.push({
            id: $form.attr('id') || null,
            action: $form.attr('action') || null,
            inputCount: $inputs.length,
            hasEmail: $form.find('[type="email"]').length > 0,
            hasPassword: $form.find('[type="password"]').length > 0
        });
    });

    // 3. 影片分析
    $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').each((i, el) => {
        const $el = $(el);
        const src = $el.attr('src') || '';
        result.videos.push({
            type: el.tagName.toLowerCase() === 'video' ? 'native' : 'embed',
            platform: src.includes('youtube') ? 'YouTube' : src.includes('vimeo') ? 'Vimeo' : 'Other'
        });
    });

    // 4. 下載連結分析
    const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.mp3', '.mp4'];
    $('a[href]').each((i, el) => {
        const $a = $(el);
        const href = ($a.attr('href') || '').toLowerCase();
        if (downloadExtensions.some(ext => href.endsWith(ext))) {
            result.downloads.push({
                text: $a.text().trim().substring(0, 50) || '下載',
                extension: downloadExtensions.find(ext => href.endsWith(ext))?.replace('.', '') || 'unknown'
            });
        }
    });

    // 5. 外部連結分析
    $('a[href^="http"]').each((i, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        try {
            const linkDomain = new URL(href).hostname;
            if (baseDomain && linkDomain !== baseDomain) {
                result.outboundLinks.push({
                    text: $a.text().trim().substring(0, 50) || linkDomain,
                    domain: linkDomain
                });
            }
        } catch (e) { }
    });

    // 6. 電商元素
    $('[class*="cart"], [class*="buy"], [class*="checkout"]').each((i, el) => {
        const $el = $(el);
        result.ecommerce.push({
            text: $el.text().trim().substring(0, 50),
            type: ($el.attr('class') || '').includes('cart') ? 'cart' : 'buy'
        });
    });

    // 7. 搜尋框
    $('input[type="search"], [class*="search"] input').each((i, el) => {
        result.search.push({ id: $(el).attr('id') || null });
    });

    // 8. 社群按鈕
    $('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="youtube"], [class*="share"]').each((i, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        result.social.push({
            platform: href.includes('facebook') ? 'Facebook' :
                href.includes('twitter') ? 'Twitter' :
                    href.includes('instagram') ? 'Instagram' :
                        href.includes('youtube') ? 'YouTube' : 'Other',
            type: ($el.attr('class') || '').includes('share') ? 'share' : 'follow'
        });
    });

    // 9. 登入/註冊
    $('a, button').each((i, el) => {
        const text = $(el).text().toLowerCase();
        if (text.includes('login') || text.includes('登入')) {
            if (!result.auth.find(a => a.type === 'login')) {
                result.auth.push({ type: 'login', text: $(el).text().trim() });
            }
        }
        if (text.includes('register') || text.includes('signup') || text.includes('註冊')) {
            if (!result.auth.find(a => a.type === 'register')) {
                result.auth.push({ type: 'register', text: $(el).text().trim() });
            }
        }
    });

    // 10. 滾動區塊
    $('section, article').slice(0, 10).each((i, el) => {
        const $el = $(el);
        result.scrollSections.push({
            id: $el.attr('id') || null,
            heading: $el.find('h1, h2, h3').first().text().trim().substring(0, 50) || null
        });
    });

    // 統計摘要
    const summary = {
        totalCTA: result.cta.length,
        totalForms: result.forms.length,
        totalVideos: result.videos.length,
        totalDownloads: result.downloads.length,
        totalOutboundLinks: result.outboundLinks.length,
        hasEcommerce: result.ecommerce.length > 0,
        hasSearch: result.search.length > 0,
        hasSocial: result.social.length > 0,
        hasAuth: result.auth.length > 0,
        scrollSections: result.scrollSections.length
    };

    // 生成推薦事件
    const recommendedEvents = [];

    if (summary.totalCTA > 0) {
        recommendedEvents.push({ name: 'cta_click', priority: 'high', description: '追蹤 CTA 按鈕點擊', count: summary.totalCTA });
    }
    if (summary.totalForms > 0) {
        recommendedEvents.push({ name: 'form_submit', priority: 'high', description: '追蹤表單提交', count: summary.totalForms });
    }
    if (summary.totalVideos > 0) {
        recommendedEvents.push({ name: 'video_start', priority: 'medium', description: '追蹤影片觀看', count: summary.totalVideos });
    }
    if (summary.totalDownloads > 0) {
        recommendedEvents.push({ name: 'file_download', priority: 'medium', description: '追蹤檔案下載', count: summary.totalDownloads });
    }
    if (summary.hasEcommerce) {
        recommendedEvents.push({ name: 'add_to_cart', priority: 'high', description: '追蹤電商行為', count: result.ecommerce.length });
    }
    if (summary.hasSearch) {
        recommendedEvents.push({ name: 'search', priority: 'medium', description: '追蹤站內搜尋', count: result.search.length });
    }
    if (summary.hasSocial) {
        recommendedEvents.push({ name: 'share', priority: 'low', description: '追蹤社群互動', count: result.social.length });
    }

    return { elements: result, summary, recommendedEvents };
}

module.exports = { analyzeGA4TrackingElements };
