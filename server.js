require('dotenv').config();
const express = require('express');
const path = require('path');
const { crawlPage, crawlSinglePage } = require('./src/crawler');
const { analyzeDomTree } = require('./src/analyzers/domTree');
const { analyzeSitemap } = require('./src/analyzers/sitemap');
const { analyzeJsArchitecture } = require('./src/analyzers/jsArchitecture');
const { analyzePageDetail } = require('./src/analyzers/pageDetail');
const { analyzeWithExpert, getExpertList } = require('./src/analyzers/aiExpert');
const { analyzeGA4TrackingElements } = require('./src/analyzers/gaTrackingAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 支援 - 允許 localhost 與 127.0.0.1 互通
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API: 分析網頁結構 (Level 0 + Level 1)
app.post('/api/analyze', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url) {
    return res.status(400).json({ error: '請提供有效的 URL' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL 格式無效，請包含 http:// 或 https://' });
  }

  try {
    console.log(`[分析開始] ${url}${cookies ? ' (with cookies)' : ''}`);
    const startTime = Date.now();

    const crawlResult = await crawlPage(url, cookies);

    const [domTree, sitemap, jsArchitecture, level0PageDetail] = await Promise.all([
      analyzeDomTree(crawlResult.level0.html),
      analyzeSitemap(crawlResult, url),
      analyzeJsArchitecture(crawlResult.level0),
      analyzePageDetail(crawlResult.level0.html, url)
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[分析完成] 耗時 ${duration} 秒`);

    res.json({
      url,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      domTree,
      sitemap,
      jsArchitecture,
      level0PageDetail,
      level0Screenshot: crawlResult.level0.screenshot
    });
  } catch (error) {
    console.error('[分析錯誤]', error);
    res.status(500).json({ error: `分析失敗: ${error.message}` });
  }
});

// API: 網站概覽分析 (架構 + 商業目標)
app.post('/api/ai-site-overview', async (req, res) => {
  const { siteData, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: '請提供 Gemini API Key' });
  }

  try {
    console.log('[網站概覽] AI 分析中...');
    const startTime = Date.now();

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `# [SYSTEM_START]

# System Instruction
<system_protocol>
## 0. 元規則 (Meta-Protocols)
1.  **全息推演 (Holographic Inference)**：將輸入的網站資料視為微弱的「數位訊號」。你必須透過這些訊號，反推並重構出該品牌完整的「市場策略」與「品牌靈魂」，絕不僅是描述網站功能。
2.  **拒絕廢話 (No Fluff)**：輸出必須高密度、具戰略性且專業。禁止出現「這是一個很好的網站」這類籠統的廢話。
3.  **專家語氣 (Tone)**：你是一位正在向 CEO 進行簡報的外部品牌審計員 (Brand Auditor)。語氣需犀利、客觀、一針見血。
4.  **使用全形標點符號**：輸出必須使用繁體中文與全形標點符號（，、。：；！？「」）。
</system_protocol>

<role_definition>
## 1. 角色定義
你是一位 **首席品牌情報分析師 (Chief Brand Intelligence Analyst)**。
你的任務是根據有限的數位足跡（網站資料），進行一場深度的 **「全網品牌調查 (Whole-Network Brand Audit)」**。

**你的超能力**：
你能透過一個導覽列選單 (Nav Menu) 或標題標籤 (Title Tag)，看透程式碼背後的「企業文化」、「受眾心理」以及「市場野心」。你讀的不是網頁，是人心。
</role_definition>

<theoretical_framework>
## 2. 分析框架
請運用以下思維模型處理輸入資料：
* **品牌原型 (Brand Archetypes - Jungian)**：定義品牌的靈魂本質（例如：顛覆規則的「反叛者」、追求完美的「創作者」）。
* **心理圖譜分析 (Psychographic Profiling)**：不只看人口統計，更要洞察受眾內心的恐懼、渴望與價值觀。
* **STP 行銷模型**：分析其 市場區隔 (Segmentation)、目標對象 (Targeting) 與 定位 (Positioning)。
</theoretical_framework>

<input_data>
## 網站資料
- URL: ${siteData.url}
- Title: ${siteData.title}
- Description: ${siteData.description}
- 首頁連結數: ${siteData.linksCount}
- 主要導覽項目: ${siteData.navItems?.join('、') || '未知'}
- 語意區塊: ${siteData.blocks?.map(b => b.type).join('、') || '未知'}
</input_data>

<output_schema>
## 3. 輸出規範 (Output Contract)
**請嚴格遵守以下 Markdown 格式輸出繁體中文報告：**

### 🧬 品牌核心與人格 (Brand Identity & DNA)
* **品牌原型 (Archetype)**：[定義核心原型，例如：**智者 (The Sage)** - 強調專業知識與真理]
* **性格關鍵詞**：[列出 3 個形容詞，如：前衛的 (Edgy)、極簡的 (Minimalist)、挑釁的 (Provocative)]
* **語氣與調性 (Tone of Voice)**：[分析其溝通方式。例如：像是一位嚴厲的教練，或者是溫柔的鄰家朋友？是用數據說話，還是用情感渲染？]

### 🎯 市場定位與受眾畫像 (STP Analysis)
* **市場生態定位**：[判斷其戰場。例如：小眾精品 (Niche Luxury) / 大眾普惠 (Mass Market) / B2B 垂直解決方案]
* **核心受眾心理 (Psychographics)**：[描述受眾的**痛點**與**渴望**。**不要**只寫「年輕人」，要寫「渴望被同儕認可、同時追求極致 CP 值的 Z 世代焦慮族群」]

### ⚔️ 全網策略推演 (Omni-Channel Strategy)
*(透過網站結構，反推該品牌在整個網路世界的佈局)*
* **推測商業模式**：[例如：以免費乾貨內容吸引流量 -> 建立私域名單 -> 銷售高單價顧問服務]
* **社群/內容策略預判**：[根據網站風格，推測他們在社群媒體 (IG/FB/LinkedIn) 會講什麼故事？例如：會大量展示幕後花絮，還是只發布專業白皮書？]

### ⚖️ 品牌競爭力診斷 (Strategic Verdict)
* **品牌強項 (Superpower)**：[這個品牌最致命的吸引力在哪裡？是價格？是美學？還是權威感？]
* **潛在盲點 (Blind Spot)**：[作為審計員，你看到了什麼風險？例如：過度強調技術規格，卻缺乏人味，難以建立情感連結。]

</output_schema>

請直接輸出報告，不需要任何開場白或結尾廢話。
# [SYSTEM_END]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[網站概覽完成] 耗時 ${duration} 秒`);

    res.json({
      overview: text,
      duration: `${duration}s`
    });
  } catch (error) {
    console.error('[網站概覽錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 頁面功能物種分析
app.post('/api/ai-page-classify', async (req, res) => {
  const { pageData, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: '請提供 Gemini API Key' });
  }

  try {
    console.log('[頁面分類] AI 分析中...');
    const startTime = Date.now();

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `你是一位資深網頁體驗架構師。請分析以下頁面資料，判斷它屬於哪一種「功能性物種」。

## 頁面資料
- URL: ${pageData.url}
- Title: ${pageData.title}
- Description: ${pageData.description}
- H1: ${pageData.h1}
- 連結數: ${pageData.linksCount}
- 頁面摘要: ${pageData.text?.substring(0, 500) || '無內容'}

## 判斷依據 (五大物種)
1. **Hook (導流與登陸頁)**: 首頁、文章頁、Landing Page。任務：吸引注意力、建立印象。
2. **Router (導覽與分流頁)**: 列表頁、搜尋結果、分類頁。任務：分配流量、幫助篩選。
3. **Pitch (詳情與說服頁)**: 產品詳情頁(PDP)、服務介紹、定價頁。任務：消除疑慮、觸發行動。
4. **Tunnel (轉化與流程頁)**: 購物車、結帳、登入/註冊。任務：低摩擦完成任務。
5. **Backstage (信任與支撐頁)**: 隱私條款、FAQ、會員中心。任務：合規、安撫、支援。

## 請分析並以 JSON 格式輸出：
{
  "species": "Hook" | "Router" | "Pitch" | "Tunnel" | "Backstage",
  "species_zh": "中文物種名 (例如：導流與登陸頁)",
  "mission": "核心任務與用戶意圖 (一句話概括此頁面的目的與用戶期望行為)",
  "kpis": ["建議追蹤的關鍵指標1", "關鍵指標2", "關鍵指標3"]
}

KPIs 範例：
- Hook: 跳出率、平均停留時間、CTA 點擊率
- Router: 點擊分佈、篩選使用率、翻頁率
- Pitch: 加購率、詢問轉化率、詳情瀏覽深度
- Tunnel: 完成率、棄車率、表單放棄率
- Backstage: 搜尋使用率、客服聯繫率

請直接輸出 JSON，不要有 Markdown code block 標記。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    const analysis = cleanAndParseJSON(text);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[頁面分類完成] ${analysis.species} - ${duration} 秒`);

    res.json({
      ...analysis,
      duration: `${duration}s`
    });
  } catch (error) {
    console.error('[頁面分類錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 單頁深度分析 (向下探勘)
app.post('/api/analyze-page', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url) {
    return res.status(400).json({ error: '請提供有效的 URL' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL 格式無效' });
  }

  try {
    console.log(`[單頁分析] ${url}${cookies ? ' (with cookies)' : ''}`);
    const startTime = Date.now();

    const pageData = await crawlSinglePage(url, cookies);

    // 並行執行所有分析
    const [pageDetail, domTree, jsArchitecture] = await Promise.all([
      analyzePageDetail(pageData.html, url),
      analyzeDomTree(pageData.html),
      analyzeJsArchitecture({
        scripts: pageData.scripts,
        frameworkHints: pageData.frameworkHints,
        html: pageData.html
      })
    ]);

    const baseUrl = new URL(url);
    const childLinks = pageData.links
      .filter(link => {
        try {
          const linkUrl = new URL(link.url);
          return linkUrl.origin === baseUrl.origin;
        } catch {
          return false;
        }
      })
      .slice(0, 100)
      .map(link => ({
        url: link.url,
        title: link.text || new URL(link.url).pathname,
        path: new URL(link.url).pathname
      }));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[單頁分析完成] 耗時 ${duration} 秒，找到 ${childLinks.length} 個子連結`);

    res.json({
      url,
      title: pageData.title,
      pageDetail,
      domTree,        // 新增：DOM tree 分析結果
      jsArchitecture, // 新增：JS architecture 分析結果
      childLinks,
      screenshot: pageData.screenshot,
      duration: `${duration}s`
    });
  } catch (error) {
    console.error('[單頁分析錯誤]', error);
    res.status(500).json({ error: `分析失敗: ${error.message}` });
  }
});

// API: 取得專家列表
app.get('/api/experts', (req, res) => {
  res.json(getExpertList());
});

// API: GA4 追蹤元素分析
app.post('/api/analyze-ga4', async (req, res) => {
  const { url, html } = req.body;

  if (!html) {
    return res.status(400).json({ error: '請提供頁面 HTML' });
  }

  try {
    console.log(`[GA4 分析] ${url}`);
    const startTime = Date.now();

    const ga4Data = analyzeGA4TrackingElements(html, url);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[GA4 分析完成] 耗時 ${duration} 秒`);

    res.json({
      ...ga4Data,
      duration: `${duration}s`
    });
  } catch (error) {
    console.error('[GA4 分析錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: AI 專家分析 (含視覺多模態分析)
app.post('/api/ai-expert', async (req, res) => {
  const { expertType, pageDetail, apiKey, screenshot, domTree, jsArchitecture, ga4TrackingData, useGrounding, groundingContext } = req.body;

  if (!expertType || !pageDetail) {
    return res.status(400).json({ error: '請提供專家類型與頁面資料' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: '請輸入 Gemini API Key' });
  }

  try {
    const visionMode = screenshot ? '+ Vision' : '';
    const groundingMode = useGrounding ? '+ Grounding' : '';
    console.log(`[AI 專家分析] ${expertType} ${visionMode} ${groundingMode} 分析中...`);
    const startTime = Date.now();

    const result = await analyzeWithExpert(expertType, pageDetail, apiKey, screenshot, domTree, jsArchitecture, ga4TrackingData, useGrounding, groundingContext);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[AI 專家分析完成] ${expertType} 耗時 ${duration} 秒`);

    res.json({
      ...result,
      duration: `${duration}s`
    });
  } catch (error) {
    console.error('[AI 專家分析錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: AI 專家追問 (對話繼續) - 支援多模態附件
app.post('/api/ai-followup', async (req, res) => {
  const { expertType, question, previousAnalysis, pageDetail, apiKey, useGrounding, attachments } = req.body;

  if (!question || !previousAnalysis) {
    return res.status(400).json({ error: '請提供問題和先前分析結果' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: '請輸入 Gemini API Key' });
  }

  try {
    const groundingMode = useGrounding ? '+ Grounding' : '';
    const attachmentMode = attachments && attachments.length > 0 ? `+ ${attachments.length} 附件` : '';
    console.log(`[AI 追問] ${expertType} ${groundingMode} ${attachmentMode}: ${question.substring(0, 50)}...`);
    const startTime = Date.now();

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // 取得完整專家人格 Prompt
    const { EXPERT_PROMPTS } = require('./src/analyzers/aiExpert');
    const expertConfig = EXPERT_PROMPTS[expertType];

    if (!expertConfig) {
      return res.status(400).json({ error: `無效的專家類型: ${expertType}` });
    }

    // 清理 Grounding 佔位符 (追問時不需要重複這些區塊)
    let systemPrompt = expertConfig.prompt
      .replace('{{GROUNDING_INSTRUCTION}}', useGrounding
        ? '** STATUS: ACTIVE (連網模式已開啟) ** 你擁有 Google 搜尋工具，可用於搜尋最新資訊。'
        : '** STATUS: INACTIVE (離線模式) **')
      .replace('{{GROUNDING_OUTPUT_SECTION}}', '');

    // 使用 systemInstruction 載入完整專家人格
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt
    });

    // 設定搜尋工具
    const tools = useGrounding ? [{ googleSearch: {} }] : [];

    // 建構追問 Prompt (使用對話歷史格式)
    let followupPrompt = `## 先前分析結果 (Context)
以下是你剛剛對這個網頁完成的分析報告：
---
${previousAnalysis}
---

## 用戶追問
「${question}」`;

    // 若有附件，在 prompt 中說明
    if (attachments && attachments.length > 0) {
      followupPrompt += `\n\n## 附加檔案\n用戶一併提供了 ${attachments.length} 個附件 (圖片/文件)，請同時分析這些附件內容來回答問題。`;
    }

    followupPrompt += `\n\n## 回答指引
1. 請以你的專家身份，基於先前的分析給出詳細、專業的回答
2. 若問題涉及報告中提到的內容，請明確引用 (例如："如前述分析中提到...")
3. 若有附件，請詳細分析附件內容並結合問題回答
4. 維持你的專業語調與分析深度
5. 回答請使用繁體中文`;

    // 建構多模態 parts
    const parts = [{ text: followupPrompt }];

    // 加入附件 (圖片/PDF)
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.base64
          }
        });
        console.log(`  - 附件: ${attachment.name} (${attachment.mimeType})`);
      }
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      tools: tools
    });
    const response = await result.response;
    const text = response.text();
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[AI 追問完成] 耗時 ${duration} 秒`);

    res.json({
      answer: text,
      duration: `${duration}s`,
      groundingMetadata
    });
  } catch (error) {
    console.error('[AI 追問錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 整站報告 - 使用統一的專家模組
app.post('/api/ai-site-report', async (req, res) => {
  const { expertType, pages, totalPages, apiKey, useGrounding, groundingContext } = req.body;

  if (!pages || pages.length < 1) {
    return res.status(400).json({ error: '請至少分析一個頁面' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: '請輸入 Gemini API Key' });
  }

  try {
    const groundingMode = useGrounding ? '+ Grounding' : '';
    console.log(`[整站報告] ${expertType} ${groundingMode} - 分析 ${totalPages} 個頁面...`);
    const startTime = Date.now();

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // 取得整站專家人格 Prompt
    const { SITE_EXPERT_PROMPTS } = require('./src/analyzers/aiExpert');
    const expertConfig = SITE_EXPERT_PROMPTS[expertType];

    if (!expertConfig) {
      return res.status(400).json({ error: `無效的專家類型: ${expertType}` });
    }

    // 設定搜尋工具
    const tools = useGrounding ? [{ googleSearch: {} }] : [];

    // 動態連網指令
    let groundingInstruction = useGrounding ? `
** STATUS: ACTIVE (連網模式已開啟) **
你擁有 Google 搜尋工具。在分析前，你必須執行以下搜尋行動：
1. **Domain Authority Check**: 搜尋該網域，評估其外部權重與品牌聲量。
2. **Competitor Movement**: 搜尋該領域的領導者，比較其網站架構策略。
3. **Industry Trends**: 搜尋該行業 2025 的最新數位體驗趨勢。`
      : '** STATUS: INACTIVE (離線模式) **';

    if (useGrounding && groundingContext) {
      groundingInstruction += `\n\n**🎯 USER OVERRIDE (使用者指定焦點) **\n請優先針對以下指示進行搜尋與情報收集：\n「${groundingContext}」`;
    }

    // 替換佔位符並建立 System Prompt
    let systemPrompt = expertConfig.prompt
      .replace('{{GROUNDING_INSTRUCTION}}', groundingInstruction)
      .replace('{{TOTAL_PAGES}}', totalPages)
      .replace('{{Current_Time}}', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }));

    // 使用 systemInstruction 載入完整專家人格
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt
    });

    // 建構用戶訊息 (頁面資料)
    const pagesDataStr = JSON.stringify(pages, null, 2);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: pagesDataStr }] }],
      tools: tools
    });
    const response = await result.response;
    const text = response.text();

    // 標點符號後處理：將半形轉換為全形（中文語境）
    const normalizedText = text
      .replace(/:\s/g, '：')      // 半形冒號後有空格 -> 全形冒號
      .replace(/;/g, '；')         // 半形分號 -> 全形分號
      .replace(/\?/g, '？')        // 半形問號 -> 全形問號
      .replace(/!/g, '！')         // 半形驚嘆號 -> 全形驚嘆號
      .replace(/,\s(?=[^\d])/g, '，'); // 半形逗號後非數字 -> 全形逗號

    // 提取 Grounding Metadata
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[整站報告完成] ${expertType} 耗時 ${duration} 秒`);

    res.json({
      report: normalizedText,
      expert: expertConfig.name,
      icon: expertConfig.icon,
      expertType: expertType,
      pagesCount: totalPages,
      duration: `${duration}s`,
      groundingMetadata // 新增引用資料
    });
  } catch (error) {
    console.error('[整站報告錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 整站報告追問 (戰略諮詢) - 支援多模態附件
app.post('/api/ai-site-followup', async (req, res) => {
  const { expertType, question, reportContext, apiKey, useGrounding, groundingContext, attachments } = req.body;

  if (!question || !reportContext) {
    return res.status(400).json({ error: '請提供問題和報告上下文' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: '請輸入 Gemini API Key' });
  }

  try {
    const groundingMode = useGrounding ? '+ Grounding' : '';
    const attachmentMode = attachments && attachments.length > 0 ? `+ ${attachments.length} 附件` : '';
    console.log(`[整站報告追問] ${expertType} ${groundingMode} ${attachmentMode}: ${question.substring(0, 50)}...`);
    const startTime = Date.now();

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // 取得整站專家人格 Prompt (整站追問用整站版)
    const { SITE_EXPERT_PROMPTS } = require('./src/analyzers/aiExpert');
    const expertConfig = SITE_EXPERT_PROMPTS[expertType];

    if (!expertConfig) {
      return res.status(400).json({ error: `無效的專家類型: ${expertType}` });
    }

    // 清理 Grounding 佔位符
    let groundingInstruction = useGrounding ? `
** STATUS: ACTIVE (連網模式已開啟) **
你擁有 Google 搜尋工具。若用戶問題涉及外部市場趨勢、競爭對手或最新標準，請務必執行搜尋。`
      : '** STATUS: INACTIVE (離線模式) **';

    if (useGrounding && groundingContext) {
      groundingInstruction += `\n\n**🎯 USER OVERRIDE (使用者指定焦點) **\n請優先針對以下指示進行搜尋：\n「${groundingContext}」`;
    }

    let systemPrompt = expertConfig.prompt
      .replace('{{GROUNDING_INSTRUCTION}}', groundingInstruction)
      .replace('{{GROUNDING_OUTPUT_SECTION}}', '');

    // 使用 systemInstruction 載入完整專家人格
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt
    });

    // 設定搜尋工具
    const tools = useGrounding ? [{ googleSearch: {} }] : [];

    // 建構追問 Prompt
    let followupPrompt = `## 整站分析報告 (Context)
以下是你剛剛完成的「整站分析報告」內容：
---
${reportContext.substring(0, 25000)}
---
${reportContext.length > 25000 ? '(報告內容過長，已截斷，請基於已知脈絡回答)' : ''}

## 用戶戰略追問
「${question}」`;

    // 若有附件，在 prompt 中說明
    if (attachments && attachments.length > 0) {
      followupPrompt += `\n\n## 附加檔案\n用戶一併提供了 ${attachments.length} 個附件 (圖片/文件)，請同時分析這些附件內容來回答問題。`;
    }

    followupPrompt += `\n\n## 回答指引
1. **保持戰略高度**：不要陷入微小的代碼細節，除非用戶具體詢問。回答應聚焦於「系統性影響」、「商業價值」與「優先級」
2. **引用報告**：回答時請明確引用報告中的發現（例如：\"如報告中提到...\"）
3. **若有附件**：請詳細分析附件內容並結合問題回答
4. **維持專家深度**：以你的專業視角給出有見地的分析
5. **繁體中文輸出**：除非引用代碼，否則全篇使用繁體中文`;

    // 建構多模態 parts
    const parts = [{ text: followupPrompt }];

    // 加入附件 (圖片/PDF)
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.base64
          }
        });
        console.log(`  - 附件: ${attachment.name} (${attachment.mimeType})`);
      }
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      tools: tools
    });

    const response = await result.response;
    const text = response.text();
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[整站追問完成] 耗時 ${duration} 秒`);

    // 標點符號後處理：將半形轉換為全形（中文語境）
    const normalizedText = text
      .replace(/:\s/g, '：')      // 半形冒號後有空格 -> 全形冒號
      .replace(/;/g, '；')         // 半形分號 -> 全形分號
      .replace(/\?/g, '？')        // 半形問號 -> 全形問號
      .replace(/!/g, '！')         // 半形驚嘆號 -> 全形驚嘆號
      .replace(/,\s(?=[^\d])/g, '，'); // 半形逗號後非數字 -> 全形逗號

    res.json({
      answer: normalizedText,
      duration: `${duration}s`,
      groundingMetadata
    });

  } catch (error) {
    console.error('[整站追問錯誤]', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 網頁結構探測器運行於 http://localhost:${PORT}`);
});

// JSON 清理與解析助手
function cleanAndParseJSON(text) {
  try {
    // 1. 嘗試直接解析
    return JSON.parse(text);
  } catch (e1) {
    try {
      // 2. 嘗試提取 Markdown code block 中的內容
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
      }

      // 3. 嘗試提取第一個 { ... } 區塊
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }

      throw new Error('無法從 AI 回應中提取有效的 JSON');
    } catch (e2) {
      console.error('JSON Parse Error:', e2.message);
      console.error('Raw Text:', text);
      throw new Error('伺服器回傳非 JSON 格式: ' + text.substring(0, 50) + '...');
    }
  }
}
