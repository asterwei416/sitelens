/**
 * 分析 JS Component Architecture
 */
async function analyzeJsArchitecture(level0Data) {
    const { scripts, frameworkHints, html } = level0Data;

    // 偵測框架
    const detectedFrameworks = [];

    if (frameworkHints.react || frameworkHints.nextjs) {
        detectedFrameworks.push({
            name: frameworkHints.nextjs ? 'Next.js (React)' : 'React',
            confidence: 'high',
            rootElement: frameworkHints.nextjs ? '#__next' : '#root'
        });
    }

    if (frameworkHints.vue || frameworkHints.nuxt) {
        detectedFrameworks.push({
            name: frameworkHints.nuxt ? 'Nuxt (Vue)' : 'Vue.js',
            confidence: 'high',
            rootElement: frameworkHints.nuxt ? '#__nuxt' : '#app'
        });
    }

    if (frameworkHints.angular) {
        detectedFrameworks.push({
            name: 'Angular',
            confidence: 'high',
            rootElement: 'app-root'
        });
    }

    // 從 scripts 推斷框架
    const scriptAnalysis = scripts.map(script => {
        const src = script.src || '';
        const info = {
            ...script,
            category: 'other',
            framework: null
        };

        // 分類 scripts
        if (src.includes('react') || src.includes('_next')) {
            info.category = 'framework';
            info.framework = 'React';
        } else if (src.includes('vue')) {
            info.category = 'framework';
            info.framework = 'Vue';
        } else if (src.includes('angular')) {
            info.category = 'framework';
            info.framework = 'Angular';
        } else if (src.includes('jquery')) {
            info.category = 'library';
            info.framework = 'jQuery';
        } else if (src.includes('analytics') || src.includes('gtag') || src.includes('gtm')) {
            info.category = 'analytics';
        } else if (src.includes('chunk') || src.includes('bundle')) {
            info.category = 'bundle';
        }

        return info;
    });

    // 如果沒有從 DOM 偵測到框架，從 scripts 推斷
    if (detectedFrameworks.length === 0) {
        const frameworkFromScripts = scriptAnalysis.find(s => s.framework && s.category === 'framework');
        if (frameworkFromScripts) {
            detectedFrameworks.push({
                name: frameworkFromScripts.framework,
                confidence: 'medium',
                rootElement: 'unknown'
            });
        }
    }

    // 無法偵測具體框架
    if (detectedFrameworks.length === 0) {
        detectedFrameworks.push({
            name: 'Vanilla JS / Unknown',
            confidence: 'low',
            rootElement: 'body'
        });
    }

    // 元件命名分析 (Production 環境通常被 minified)
    const componentAnalysis = {
        note: 'Production 環境下元件名稱通常被混淆，以下為 Scripts 依賴分析',
        canDetectComponents: false
    };

    // 建立依賴樹
    const dependencyTree = {
        name: 'Scripts',
        type: 'root',
        children: [
            {
                name: 'Framework',
                type: 'category',
                children: scriptAnalysis.filter(s => s.category === 'framework').map(s => ({
                    name: s.src?.split('/').pop() || 'inline',
                    type: 'script',
                    framework: s.framework
                }))
            },
            {
                name: 'Bundles',
                type: 'category',
                children: scriptAnalysis.filter(s => s.category === 'bundle').map(s => ({
                    name: s.src?.split('/').pop() || 'chunk',
                    type: 'script'
                }))
            },
            {
                name: 'Analytics',
                type: 'category',
                children: scriptAnalysis.filter(s => s.category === 'analytics').map(s => ({
                    name: s.src?.split('/').pop() || 'analytics',
                    type: 'script'
                }))
            },
            {
                name: 'Other',
                type: 'category',
                children: scriptAnalysis.filter(s => s.category === 'other').slice(0, 10).map(s => ({
                    name: s.src?.split('/').pop() || 'script',
                    type: 'script'
                }))
            }
        ].filter(cat => cat.children.length > 0)
    };

    return {
        frameworks: detectedFrameworks,
        componentAnalysis,
        dependencyTree,
        stats: {
            totalScripts: scripts.length,
            frameworkScripts: scriptAnalysis.filter(s => s.category === 'framework').length,
            bundleScripts: scriptAnalysis.filter(s => s.category === 'bundle').length
        }
    };
}

module.exports = { analyzeJsArchitecture };
