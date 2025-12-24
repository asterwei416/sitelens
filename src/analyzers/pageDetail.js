const cheerio = require('cheerio');

/**
 * 頁面詳細分析器
 * 分析 SEO Tags、連結動線、麵包屑、語意區塊
 */
function analyzePageDetail(html, url) {
    const $ = cheerio.load(html);

    // ========== SEO Tags ==========
    const seoTags = {
        title: $('title').text().trim() || null,
        description: $('meta[name="description"]').attr('content') || null,
        keywords: $('meta[name="keywords"]').attr('content') || null,
        canonical: $('link[rel="canonical"]').attr('href') || null,
        ogTitle: $('meta[property="og:title"]').attr('content') || null,
        ogDescription: $('meta[property="og:description"]').attr('content') || null,
        ogImage: $('meta[property="og:image"]').attr('content') || null,
        robots: $('meta[name="robots"]').attr('content') || null
    };

    // ========== Heading 結構 ==========
    const headings = {
        h1: $('h1').map((_, el) => $(el).text().trim()).get(),
        h2: $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 10),
        h3: $('h3').map((_, el) => $(el).text().trim()).get().slice(0, 10)
    };

    // ========== 連結動線 ==========
    const baseUrl = new URL(url);
    const allLinks = $('a[href]').toArray();

    const navLinks = $('nav a[href], header a[href], [role="navigation"] a[href]').length;
    const footerLinks = $('footer a[href]').length;

    let internalCount = 0;
    let externalCount = 0;

    allLinks.forEach(link => {
        const href = $(link).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        try {
            const linkUrl = new URL(href, url);
            if (linkUrl.origin === baseUrl.origin) {
                internalCount++;
            } else {
                externalCount++;
            }
        } catch { }
    });

    const totalLinks = internalCount + externalCount;
    const flow = {
        navLinks,
        footerLinks,
        internalLinks: internalCount,
        externalLinks: externalCount,
        externalRatio: totalLinks > 0 ? ((externalCount / totalLinks) * 100).toFixed(1) + '%' : '0%'
    };

    // ========== 麵包屑偵測 ==========
    const breadcrumbs = detectBreadcrumbs($);

    // ========== 語意區塊偵測 ==========
    const blocks = detectSemanticBlocks($);

    return {
        url,
        seoTags,
        headings,
        flow,
        breadcrumbs,
        blocks
    };
}

/**
 * 偵測麵包屑
 */
function detectBreadcrumbs($) {
    // 常見麵包屑選擇器
    const selectors = [
        '[itemtype*="BreadcrumbList"]',
        '.breadcrumb',
        '.breadcrumbs',
        '[aria-label="breadcrumb"]',
        'nav.breadcrumb',
        '.bread-crumb'
    ];

    for (const selector of selectors) {
        const el = $(selector).first();
        if (el.length) {
            const items = el.find('a, span, li').map((_, item) => {
                const text = $(item).text().trim();
                const href = $(item).attr('href') || $(item).find('a').attr('href');
                return text ? { text, href: href || null } : null;
            }).get().filter(Boolean).slice(0, 10);

            if (items.length > 0) {
                return {
                    detected: true,
                    selector,
                    items
                };
            }
        }
    }

    return { detected: false, items: [] };
}

/**
 * 偵測語意化區塊
 */
function detectSemanticBlocks($) {
    const blocks = [];

    // Header
    const header = $('header').first();
    if (header.length) {
        blocks.push({
            type: 'Header',
            tag: 'header',
            hasLogo: header.find('img, svg, [class*="logo"]').length > 0,
            hasNav: header.find('nav').length > 0
        });
    }

    // Hero Section (常見 class 模式)
    const heroSelectors = ['.hero', '[class*="hero"]', '.banner', '[class*="banner"]', '.jumbotron', '.masthead'];
    for (const sel of heroSelectors) {
        const hero = $(sel).first();
        if (hero.length) {
            blocks.push({
                type: 'Hero Section',
                selector: sel,
                hasHeading: hero.find('h1, h2').length > 0,
                hasImage: hero.find('img').length > 0,
                hasCTA: hero.find('a, button').length > 0
            });
            break;
        }
    }

    // Main
    const main = $('main, [role="main"]').first();
    if (main.length) {
        blocks.push({
            type: 'Main Content',
            tag: main.prop('tagName')?.toLowerCase() || 'main',
            sections: main.find('section').length,
            articles: main.find('article').length
        });
    }

    // Aside / Sidebar
    const aside = $('aside, [role="complementary"], .sidebar').first();
    if (aside.length) {
        blocks.push({
            type: 'Sidebar',
            tag: aside.prop('tagName')?.toLowerCase() || 'aside'
        });
    }

    // Footer
    const footer = $('footer').first();
    if (footer.length) {
        blocks.push({
            type: 'Footer',
            tag: 'footer',
            linksCount: footer.find('a').length,
            hasSocial: footer.find('[class*="social"], [href*="facebook"], [href*="twitter"], [href*="instagram"]').length > 0
        });
    }

    // Nav
    const navCount = $('nav').length;
    if (navCount > 0) {
        blocks.push({
            type: 'Navigation',
            count: navCount
        });
    }

    return blocks;
}

module.exports = { analyzePageDetail };
