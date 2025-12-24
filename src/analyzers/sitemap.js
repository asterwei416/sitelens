/**
 * 分析 Sitemap 結構 - 扁平化一階
 */
async function analyzeSitemap(crawlResult, baseUrl) {
    const { level0, level1, allLinks } = crawlResult;
    const parsedBase = new URL(baseUrl);

    // 建立 URL 到 Title 的對應表
    const urlToTitle = new Map();
    urlToTitle.set(baseUrl, level0.title);
    for (const page of level1) {
        urlToTitle.set(page.url, page.title);
    }

    // 去重並建立扁平頁面列表
    const seenUrls = new Set();
    seenUrls.add(baseUrl); // 排除首頁

    const pages = allLinks
        .filter(link => {
            if (seenUrls.has(link.url)) return false;
            seenUrls.add(link.url);
            return true;
        })
        .slice(0, 20) // 限制數量
        .map(link => {
            const parsed = new URL(link.url);
            // 優先使用爬取的真實 title，其次使用 URL 路徑（更能區分頁面），
            // 只有在路徑為 "/" 時才使用連結文字
            const crawledTitle = urlToTitle.get(link.url);
            let pageTitle;
            if (crawledTitle) {
                pageTitle = crawledTitle;
            } else if (parsed.pathname && parsed.pathname !== '/') {
                // 使用 URL 路徑作為顯示名稱（去除開頭斜線，更易讀）
                pageTitle = decodeURIComponent(parsed.pathname.replace(/^\//, '') || link.text || 'Page');
            } else {
                pageTitle = link.text || parsed.hostname;
            }
            return {
                title: pageTitle,
                url: link.url,
                path: parsed.pathname,
                type: 'page'
            };
        });

    // 扁平樹狀結構：首頁 (Level 0) + 子頁面 (Level 1)
    const sitemapTree = {
        title: level0.title || parsedBase.hostname,
        url: baseUrl,
        type: 'root',
        children: pages
    };

    // Level 1 詳細資訊
    const level1Details = level1.map(page => ({
        url: page.url,
        title: page.title,
        linkText: page.linkText,
        status: page.error ? 'error' : 'ok'
    }));

    return {
        tree: sitemapTree,
        level1: level1Details,
        stats: {
            totalLinks: allLinks.length,
            level1Scanned: level1.length
        }
    };
}

module.exports = { analyzeSitemap };
