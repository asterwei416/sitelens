const cheerio = require('cheerio');

// 保留的核心容器標籤
const CORE_TAGS = new Set([
    'html', 'head', 'body', 'header', 'footer', 'main', 'nav', 'aside',
    'section', 'article', 'div', 'form', 'table', 'ul', 'ol', 'dl'
]);

// 要過濾的噪音標籤
const NOISE_TAGS = new Set([
    'script', 'style', 'noscript', 'svg', 'path', 'circle', 'rect',
    'meta', 'link', 'br', 'hr', 'img', 'input', 'button', 'textarea',
    'option', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed',
    'param', 'iframe'
]);

/**
 * 分析 DOM Tree
 */
function analyzeDomTree(html) {
    const $ = cheerio.load(html);

    const buildTree = (element, depth = 0, maxDepth = 6) => {
        if (depth > maxDepth) return null;

        const tagName = element.tagName?.toLowerCase();
        if (!tagName || NOISE_TAGS.has(tagName)) return null;

        const node = {
            tag: tagName,
            id: $(element).attr('id') || null,
            class: $(element).attr('class')?.split(' ').filter(c => c.length < 30).slice(0, 3).join(' ') || null,
            children: []
        };

        // 只對核心容器展開子元素
        if (CORE_TAGS.has(tagName)) {
            const children = $(element).children().toArray();

            // 合併重複的 li/span/p 等
            const tagCounts = {};
            const processedChildren = [];

            for (const child of children) {
                const childTag = child.tagName?.toLowerCase();
                if (!childTag || NOISE_TAGS.has(childTag)) continue;

                // 對於 li, span, p, a 等重複標籤，只保留前 3 個
                if (['li', 'span', 'p', 'a', 'td', 'tr', 'th'].includes(childTag)) {
                    tagCounts[childTag] = (tagCounts[childTag] || 0) + 1;
                    if (tagCounts[childTag] > 3) {
                        if (tagCounts[childTag] === 4) {
                            processedChildren.push({
                                tag: `${childTag}`,
                                summary: `... 更多 ${childTag} 元素`,
                                children: []
                            });
                        }
                        continue;
                    }
                }

                const childNode = buildTree(child, depth + 1, maxDepth);
                if (childNode) {
                    processedChildren.push(childNode);
                }
            }

            node.children = processedChildren;
        }

        return node;
    };

    const htmlElement = $('html').get(0);
    const tree = buildTree(htmlElement);

    // 統計資訊
    const stats = {
        totalElements: $('*').length,
        uniqueTags: [...new Set($('*').toArray().map(e => e.tagName?.toLowerCase()).filter(Boolean))].length,
        depth: calculateDepth(tree)
    };

    return { tree, stats };
}

/**
 * 計算樹深度
 */
function calculateDepth(node) {
    if (!node || !node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(calculateDepth));
}

module.exports = { analyzeDomTree };
