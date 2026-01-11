// ========================================
// Global State
// ========================================
let currentData = null;
let sitemapTreeData = null;
let currentPageDetail = null;
let currentScreenshot = null; // 當前頁面截圖 (base64)
let currentDomTree = null;    // 當前頁面 DOM tree 分析
let currentJsArchitecture = null; // 當前頁面 JS architecture 分析
let currentGa4TrackingData = null; // 當前頁面 GA4 追蹤元素分析
let analyzedPagesCollection = []; // 收集所有已分析頁面供整體報告使用

// ========================================
// DOM Elements
// ========================================
const analyzeForm = document.getElementById('analyzeForm');
const urlInput = document.getElementById('urlInput');
const submitBtn = document.getElementById('submitBtn');
const statusMessage = document.getElementById('statusMessage');
const resultsSection = document.getElementById('resultsSection');
const downloadJsonBtn = document.getElementById('downloadJson');
const durationInfo = document.getElementById('durationInfo');
const toggleSecondaryBtn = document.getElementById('toggleSecondary');
const secondaryViews = document.getElementById('secondaryViews');

// Event Listeners
// ========================================
analyzeForm.addEventListener('submit', handleSubmit);
downloadJsonBtn.addEventListener('click', downloadJson);

// ========================================
// URL History Management
// ========================================
const URL_HISTORY_KEY = 'sitelens_url_history';
const MAX_URL_HISTORY = 20; // 最多保存 20 筆記錄

function loadUrlHistory() {
  try {
    const history = localStorage.getItem(URL_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('讀取 URL 歷史記錄失敗:', e);
    return [];
  }
}

function saveUrlToHistory(url) {
  try {
    let history = loadUrlHistory();
    // 移除重複的 URL (如果存在)
    history = history.filter(item => item !== url);
    // 新 URL 加到最前面
    history.unshift(url);
    // 保持最大數量限制
    if (history.length > MAX_URL_HISTORY) {
      history = history.slice(0, MAX_URL_HISTORY);
    }
    localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(history));
    renderUrlHistoryDatalist();
  } catch (e) {
    console.error('儲存 URL 歷史記錄失敗:', e);
  }
}

function clearUrlHistory() {
  try {
    localStorage.removeItem(URL_HISTORY_KEY);
    renderUrlHistoryDatalist();
  } catch (e) {
    console.error('清除 URL 歷史記錄失敗:', e);
  }
}

function renderUrlHistoryDatalist() {
  const datalist = document.getElementById('urlHistoryList');
  const clearBtn = document.getElementById('clearUrlHistory');

  if (!datalist) return;

  const history = loadUrlHistory();
  datalist.innerHTML = history.map(url => `<option value="${url}">`).join('');

  // 顯示/隱藏清除按鈕
  if (clearBtn) {
    clearBtn.style.display = history.length > 0 ? 'block' : 'none';
  }
}

// 初始化 URL 歷史記錄
renderUrlHistoryDatalist();

// 清除歷史記錄按鈕事件
const clearUrlHistoryBtn = document.getElementById('clearUrlHistory');
if (clearUrlHistoryBtn) {
  clearUrlHistoryBtn.addEventListener('click', () => {
    if (confirm('確定要清除所有 URL 歷史記錄嗎？')) {
      clearUrlHistory();
    }
  });
}

// ========================================
// API Key Management (自動儲存)
// ========================================
const API_KEY_STORAGE_KEY = 'sitelens_gemini_api_key';
const geminiApiKeyInput = document.getElementById('geminiApiKey');

function loadApiKey() {
  try {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey && geminiApiKeyInput) {
      geminiApiKeyInput.value = savedKey;
      // 顯示清除按鈕
      const clearBtn = document.getElementById('clearApiKey');
      if (clearBtn) clearBtn.style.display = 'block';
    }
  } catch (e) {
    console.error('讀取 API Key 失敗:', e);
  }
}

function saveApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    }
  } catch (e) {
    console.error('儲存 API Key 失敗:', e);
  }
}

function clearSavedApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (e) {
    console.error('清除 API Key 失敗:', e);
  }
}

// 初始化載入已儲存的 API Key
loadApiKey();

// API Key 輸入時自動儲存
if (geminiApiKeyInput) {
  geminiApiKeyInput.addEventListener('blur', () => {
    saveApiKey(geminiApiKeyInput.value);
  });

  // 當輸入變化時，顯示/隱藏清除按鈕
  geminiApiKeyInput.addEventListener('input', () => {
    const clearBtn = document.getElementById('clearApiKey');
    if (clearBtn) {
      clearBtn.style.display = geminiApiKeyInput.value ? 'block' : 'none';
    }
  });
}

// 清除 API Key 按鈕事件
const clearApiKeyBtn = document.getElementById('clearApiKey');
if (clearApiKeyBtn) {
  clearApiKeyBtn.addEventListener('click', () => {
    if (geminiApiKeyInput) {
      geminiApiKeyInput.value = '';
      clearSavedApiKey();
      clearApiKeyBtn.style.display = 'none';
    }
  });
}

// ========================================
// Website Goals Management (網站目標選擇)
// ========================================
const GOALS_STORAGE_KEY = 'sitelens_website_goals';
const CUSTOM_GOAL_STORAGE_KEY = 'sitelens_custom_goal';
let selectedGoals = new Set();

// 目標對應的中文名稱
const GOAL_LABELS = {
  'lead-generation': '蒐集名單',
  'brand-awareness': '品牌知名度',
  'ecommerce': '電商銷售',
  'traffic-conversion': '導流轉換',
  'content-marketing': '內容行銷',
  'customer-service': '客戶服務'
};

function loadSavedGoals() {
  try {
    // 載入預設目標
    const savedGoals = localStorage.getItem(GOALS_STORAGE_KEY);
    if (savedGoals) {
      selectedGoals = new Set(JSON.parse(savedGoals));
    }

    // 載入自訂目標
    const customGoal = localStorage.getItem(CUSTOM_GOAL_STORAGE_KEY);
    const customGoalInput = document.getElementById('customGoal');
    if (customGoal && customGoalInput) {
      customGoalInput.value = customGoal;
    }

    // 更新 UI
    renderGoalsSelection();
  } catch (e) {
    console.error('讀取網站目標失敗:', e);
  }
}

function saveGoals() {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify([...selectedGoals]));

    const customGoalInput = document.getElementById('customGoal');
    if (customGoalInput && customGoalInput.value.trim()) {
      localStorage.setItem(CUSTOM_GOAL_STORAGE_KEY, customGoalInput.value.trim());
    } else {
      localStorage.removeItem(CUSTOM_GOAL_STORAGE_KEY);
    }
  } catch (e) {
    console.error('儲存網站目標失敗:', e);
  }
}

function renderGoalsSelection() {
  document.querySelectorAll('.goal-tag').forEach(tag => {
    const goal = tag.dataset.goal;
    if (selectedGoals.has(goal)) {
      tag.classList.add('selected');
    } else {
      tag.classList.remove('selected');
    }
  });
}

function getSelectedGoals() {
  const goals = [];

  // 取得預設選項
  selectedGoals.forEach(goalKey => {
    if (GOAL_LABELS[goalKey]) {
      goals.push(GOAL_LABELS[goalKey]);
    }
  });

  // 取得自訂目標
  const customGoalInput = document.getElementById('customGoal');
  if (customGoalInput && customGoalInput.value.trim()) {
    goals.push(customGoalInput.value.trim());
  }

  return goals;
}

function getSelectedGoalsText() {
  const goals = getSelectedGoals();
  return goals.length > 0 ? goals.join('、') : '未指定';
}

// 初始化目標選擇
loadSavedGoals();

// 標籤點擊事件
document.querySelectorAll('.goal-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const goal = tag.dataset.goal;

    if (selectedGoals.has(goal)) {
      selectedGoals.delete(goal);
      tag.classList.remove('selected');
    } else {
      selectedGoals.add(goal);
      tag.classList.add('selected');
    }

    saveGoals();
  });
});

// 自訂目標輸入事件
const customGoalInput = document.getElementById('customGoal');
if (customGoalInput) {
  customGoalInput.addEventListener('blur', () => {
    saveGoals();
  });
}

toggleSecondaryBtn.addEventListener('click', () => {
  secondaryViews.hidden = !secondaryViews.hidden;
  toggleSecondaryBtn.textContent = secondaryViews.hidden
    ? '⬇️ 顯示 DOM Tree / JS Architecture'
    : '⬆️ 隱藏 DOM Tree / JS Architecture';
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Grounding Toggle Logic (舊邏輯保留，但優先使用全域 toggle)
['page', 'site'].forEach(prefix => {
  const toggle = document.getElementById(`${prefix}GroundingToggle`);
  const inputRow = document.getElementById(`${prefix}GroundingInputRow`);

  if (toggle && inputRow) {
    toggle.addEventListener('change', () => {
      inputRow.style.display = toggle.checked ? 'block' : 'none';
    });
  }
});

// Global Grounding Toggle (首頁輸入區) - 控制所有 context 輸入框的顯示
// Global Grounding Toggle (首頁輸入區) - 控制所有 context 輸入框的顯示
const globalGroundingToggle = document.getElementById('globalGroundingToggle');

if (globalGroundingToggle) {
  globalGroundingToggle.addEventListener('change', () => {
    const show = globalGroundingToggle.checked ? 'flex' : 'none';

    // Toggle Single Page Analysis Inputs
    document.querySelectorAll('.expert-context-input-wrapper').forEach(wrapper => {
      wrapper.style.display = show;
    });

    // Toggle Site Report Inputs (if they share the same class, which they do)
    // No extra code needed if class names are consistent
  });
}

// ========================================
// API Handlers
// ========================================
async function handleSubmit(e) {
  e.preventDefault();

  const url = urlInput.value.trim();
  if (!url) return;

  // 儲存 URL 到歷史記錄
  saveUrlToHistory(url);

  // 讀取 Session Cookies (如果有填寫)
  let cookies = null;
  const cookieInput = document.getElementById('sessionCookies');
  if (cookieInput && cookieInput.value.trim()) {
    try {
      cookies = JSON.parse(cookieInput.value.trim());
    } catch (e) {
      showStatus('Cookie 格式錯誤，請確認是有效的 JSON 陣列', 'error');
      return;
    }
  }

  setLoading(true);
  showStatus('');
  resultsSection.hidden = true;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookies })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '分析失敗');

    currentData = data;
    renderResults(data);
    resultsSection.hidden = false;
    showStatus('分析完成！點擊任意節點可向下探勘', 'success');

  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// 單頁深度分析 API
async function analyzePage(url) {
  // 讀取 Session Cookies
  let cookies = null;
  const cookieInput = document.getElementById('sessionCookies');
  if (cookieInput && cookieInput.value.trim()) {
    try {
      cookies = JSON.parse(cookieInput.value.trim());
    } catch (e) {
      console.error('Cookie 格式錯誤');
    }
  }

  try {
    const response = await fetch('/api/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookies })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '分析失敗');

    return data;
  } catch (error) {
    console.error('單頁分析失敗:', error);
    return null;
  }
}

// ========================================
// UI Helpers
// ========================================
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.querySelector('.btn-text').hidden = isLoading;
  submitBtn.querySelector('.btn-loading').hidden = !isLoading;
}

function showStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.hidden = !message;
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabId)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabId)
  );
}

// ========================================
// Render Results
// ========================================
function renderResults(data) {
  durationInfo.textContent = `分析耗時: ${data.duration}`;

  // 重置已分析頁面收集
  analyzedPagesCollection = [];

  // 加入 Level 0 頁面到收集
  addToAnalyzedCollection({
    url: data.url,
    level: 0,
    title: data.sitemap.tree.title || 'Homepage',
    pageDetail: data.level0PageDetail,
    domTree: data.domTree,
    jsArchitecture: data.jsArchitecture
  });

  // 初始化樹狀資料
  initSitemapTree(data);
  renderSitemapTree();

  renderDomTree(data.domTree);
  renderJsArchitecture(data.jsArchitecture);

  // 自動顯示 Level 0 詳情 (包含 DOM tree、JS architecture 和截圖)
  renderPageDetail(data.level0PageDetail, data.level0Screenshot, data.domTree, data.jsArchitecture);

  // 更新整體報告按鈕狀態
  updateSiteReportButton();

  // 顯示初始隱藏的區塊
  const secondarySection = document.getElementById('secondarySection');
  const siteReportSection = document.getElementById('siteReportSection');
  const siteReportTabContents = document.getElementById('siteReportTabContents');
  const actionsSection = document.getElementById('actionsSection');

  if (secondarySection) secondarySection.style.display = 'block';
  if (siteReportSection) siteReportSection.style.display = 'block';
  if (siteReportTabContents) siteReportTabContents.style.display = 'block';
  if (actionsSection) actionsSection.style.display = 'flex';

  // 根據全域 Grounding toggle 狀態決定 context inputs 顯示
  const globalToggle = document.getElementById('globalGroundingToggle');
  const showContext = globalToggle?.checked ? 'block' : 'none';
  const pageInput = document.getElementById('pageGroundingInputRow');
  const siteInput = document.getElementById('siteGroundingInputRow');
  if (pageInput) pageInput.style.display = showContext;
  if (siteInput) siteInput.style.display = showContext;

  // 自動呼叫網站概覽 AI 分析（如果有 API Key）
  fetchSiteOverview(data);
}

// ========================================
// Sitemap Tree (Expandable)
// ========================================
function initSitemapTree(data) {
  const tree = data.sitemap.tree;
  const level1 = data.sitemap.level1;

  // 將 level1 詳情對應到 children
  const level1Map = new Map();
  level1.forEach(p => level1Map.set(p.url, p));

  sitemapTreeData = {
    id: 'root',
    title: tree.title,
    url: data.url,
    type: 'root',
    level: 0,
    expanded: true,
    analyzed: true,
    pageDetail: data.level0PageDetail,
    screenshot: data.level0Screenshot,   // 儲存 L0 截圖
    domTree: data.domTree,           // 儲存 DOM tree
    jsArchitecture: data.jsArchitecture, // 儲存 JS architecture
    children: (tree.children || []).map((child, i) => ({
      id: `l1-${i}`,
      title: child.title || child.path,
      url: child.url,
      path: child.path,
      type: 'page',
      level: 1,
      expanded: false,
      analyzed: false,
      children: []
    }))
  };
}

function renderSitemapTree() {
  const stats = document.getElementById('sitemapStats');
  const totalNodes = countNodes(sitemapTreeData);
  stats.innerHTML = `
    <span>🌳 <strong>${totalNodes}</strong> 節點</span>
    <span>📊 可點擊展開</span>
  `;

  const container = document.getElementById('sitemapViz');
  container.innerHTML = '';

  const treeEl = document.createElement('div');
  treeEl.className = 'expandable-tree';
  treeEl.appendChild(renderTreeNode(sitemapTreeData));
  container.appendChild(treeEl);

  // 初始化縮放與拖曳功能
  initSitemapZoomDrag(container, treeEl);
}

// 縮放與拖曳功能
function initSitemapZoomDrag(container, treeEl) {
  let scale = 1;
  let isDragging = false;
  let startX, startY, scrollLeft, scrollTop;

  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const zoomLevelEl = document.getElementById('zoomLevel');

  function updateZoom() {
    treeEl.style.transform = `scale(${scale})`;
    treeEl.style.transformOrigin = 'top left';
    zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
  }

  // 按鈕縮放
  zoomInBtn?.addEventListener('click', () => {
    scale = Math.min(scale + 0.1, 2);
    updateZoom();
  });

  zoomOutBtn?.addEventListener('click', () => {
    scale = Math.max(scale - 0.1, 0.3);
    updateZoom();
  });

  zoomResetBtn?.addEventListener('click', () => {
    scale = 1;
    updateZoom();
    container.scrollLeft = 0;
    container.scrollTop = 0;
  });

  // 滾輪縮放 (Ctrl + 滾輪)
  container.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.max(0.3, Math.min(2, scale + delta));
      updateZoom();
    }
  }, { passive: false });

  // 拖曳平移
  container.addEventListener('mousedown', (e) => {
    // 只在空白區域或樹容器上拖曳，不影響節點點擊
    if (e.target === container || e.target === treeEl || e.target.classList.contains('expandable-tree')) {
      isDragging = true;
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    container.scrollLeft = scrollLeft - (x - startX);
    container.scrollTop = scrollTop - (y - startY);
  });

  container.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = '';
  });

  container.addEventListener('mouseleave', () => {
    isDragging = false;
    container.style.cursor = '';
  });
}

function countNodes(node) {
  let count = 1;
  if (node.children) {
    node.children.forEach(c => count += countNodes(c));
  }
  return count;
}

function renderTreeNode(node, depth = 0) {
  const nodeEl = document.createElement('div');
  nodeEl.className = `tree-node level-${node.level}`;
  nodeEl.style.paddingLeft = `${depth * 20}px`;

  const hasChildren = node.children && node.children.length > 0;

  // Icon Logic
  let icon = '📄';
  if (node.type === 'root') icon = '🏠';
  else if (node.type === 'group') icon = '📁';
  else if (node.analyzed) icon = '📂';

  if (node.loading) {
    icon = '💫'; // Loading icon
  }

  const expandIcon = hasChildren ? (node.expanded ? '▼' : '▶') : '•';

  // URL Link Logic (Group nodes don't have URL)
  const urlLink = node.url
    ? `<a href="${node.url}" target="_blank" class="node-url" onclick="event.stopPropagation()">↗</a>`
    : '';

  // Badge Logic
  const badge = node.type === 'group'
    ? '<span class="node-badge group">Group</span>'
    : `<span class="node-badge level${node.level}">L${node.level}</span>`;

  // Drill Hint Logic
  let drillHint = '';
  if (node.loading) drillHint = '<span class="drill-hint">分析中...</span>';
  else if (!node.analyzed && node.type !== 'root' && node.type !== 'group') drillHint = '<span class="drill-hint">點擊探勘</span>';

  // 處理 URL 顯示文字
  let displayUrl = '';
  if (node.url) {
    try {
      // 一律顯示完整網址 (移除 Protocol 以節省空間，或者保留)
      // 使用者要求完整顯示，這裡顯示 hostname + path + search
      const urlObj = new URL(node.url);
      displayUrl = urlObj.hostname + urlObj.pathname + urlObj.search;
      // 若想連 https:// 都顯示，就直接用 node.url
      // 但通常 hostname 開頭比較好讀
    } catch (e) {
      displayUrl = node.url;
    }
  }

  nodeEl.innerHTML = `
    <div class="tree-node-content ${node.analyzed ? 'analyzed' : ''} ${node.loading ? 'loading' : ''} ${node.type === 'group' ? 'group-node' : ''}" data-url="${node.url || ''}">
      <span class="expand-icon">${expandIcon}</span>
      <span class="node-icon ${node.loading ? 'loading-icon' : ''}">${icon}</span>
      <div class="node-text-wrapper">
        <span class="node-title">${node.title}</span>
        ${node.url ? `<span class="node-url-display">${displayUrl}</span>` : ''}
      </div>
      ${urlLink}
      ${badge}
      ${drillHint}
    </div>
  `;

  const contentEl = nodeEl.querySelector('.tree-node-content');

  // 點擊事件
  contentEl.addEventListener('click', async (e) => {
    e.stopPropagation();

    // Group Node logic / Analyzed Node logic -> Toggle Expand
    if (node.type === 'group' || node.analyzed) {
      if (node.pageDetail && node.type !== 'group') {
        renderPageDetail(node.pageDetail, node.screenshot, node.domTree, node.jsArchitecture);
      }
      if (hasChildren) {
        node.expanded = !node.expanded;
        renderSitemapTree();
      }
    } else {
      // 未分析：向下探勘
      await drillDown(node);
    }
  });

  // 渲染子節點
  if (hasChildren && node.expanded) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    node.children.forEach(child => {
      childrenContainer.appendChild(renderTreeNode(child, depth + 1));
    });
    nodeEl.appendChild(childrenContainer);
  }

  return nodeEl;
}

// 向下探勘
async function drillDown(node) {
  // 設定讀取狀態
  node.loading = true;
  renderSitemapTree();
  showStatus(`正在分析 ${node.title}...`, '');

  const result = await analyzePage(node.url);

  // 清除讀取狀態
  node.loading = false;

  if (result) {
    node.analyzed = true;
    node.expanded = true;
    node.pageDetail = result.pageDetail;
    node.screenshot = result.screenshot;
    node.domTree = result.domTree;
    node.jsArchitecture = result.jsArchitecture;
    // 智慧分組邏輯
    const rawLinks = result.childLinks || [];
    node.children = groupChildren(rawLinks, node.id, node.level + 1);

    // 加入到已分析頁面收集
    addToAnalyzedCollection({
      url: node.url,
      level: node.level,
      title: node.title,
      pageDetail: result.pageDetail,
      domTree: result.domTree,
      jsArchitecture: result.jsArchitecture
    });

    renderSitemapTree();
    renderPageDetail(result.pageDetail, result.screenshot, result.domTree, result.jsArchitecture);
    showStatus(`探勘完成！找到 ${result.childLinks.length} 個子連結`, 'success');

    // 更新整體報告按鈕狀態
    updateSiteReportButton();
  } else {
    showStatus('探勘失敗', 'error');
  }
}

// ========================================
// Page Detail Panel
// ========================================
function renderPageDetail(detail, screenshot = null, domTree = null, jsArchitecture = null) {
  const urlEl = document.getElementById('detailPageUrl');
  const contentEl = document.getElementById('detailContent');

  // 儲存當前頁面詳情與截圖供 AI 分析用
  currentPageDetail = detail;
  currentScreenshot = screenshot;
  currentDomTree = domTree;
  currentJsArchitecture = jsArchitecture;

  // API Key 區塊
  const apiKeySection = document.getElementById('apiKeySection');

  if (!detail) {
    if (apiKeySection) apiKeySection.style.display = 'none';
    currentScreenshot = null;
    currentDomTree = null;
    currentJsArchitecture = null;
    contentEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📄</span>
        <p>點擊左側節點查看詳情</p>
      </div>
    `;
    // 重置所有專家分析結果
    ['seoExpertResult', 'uxExpertResult', 'growthExpertResult', 'ga4ExpertResult'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<p class="expert-hint">點擊「執行分析」開始 AI 專家深度分析</p>';
        delete el.dataset.analysis; // 清除快取
      }
    });
    return;
  }

  // 顯示 API Key 區塊
  if (apiKeySection) apiKeySection.style.display = 'block';

  // 重置所有專家分析結果（切換頁面時清空）
  ['seoExpertResult', 'uxExpertResult', 'growthExpertResult', 'ga4ExpertResult'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<p class="expert-hint">點擊「執行分析」開始 AI 專家深度分析</p>';
      delete el.dataset.analysis;
    }
  });

  // 重置 GA4 追蹤資料
  currentGa4TrackingData = null;

  // 隱藏追問區塊
  document.querySelectorAll('.followup-section').forEach(section => {
    section.style.display = 'none';
  });

  // 顯示截圖預覽
  const screenshotPreview = document.getElementById('screenshotPreview');
  const screenshotImg = document.getElementById('screenshotImg');
  if (screenshot) {
    screenshotPreview.style.display = 'block';
    screenshotImg.src = `data:image/jpeg;base64,${screenshot}`;
    screenshotImg.onclick = () => window.open(screenshotImg.src, '_blank');
  } else {
    screenshotPreview.style.display = 'none';
  }

  setupAiExpertButtons();

  urlEl.textContent = detail.url;

  contentEl.innerHTML = `
    <div class="detail-section">
      <h3>🏷️ SEO Meta Tags</h3>
      <div class="detail-grid">
        ${renderDetailItem('Title', detail.seoTags.title, 60)}
        ${renderDetailItem('Description', detail.seoTags.description, 160)}
        ${renderDetailItem('Keywords', detail.seoTags.keywords)}
        ${renderDetailItem('Canonical', detail.seoTags.canonical)}
        ${renderDetailItem('OG:Title', detail.seoTags.ogTitle)}
        ${renderDetailItem('Robots', detail.seoTags.robots)}
      </div>
    </div>

    <div class="detail-section">
      <h3>📑 Heading 結構</h3>
      <div class="detail-grid">
        ${renderHeadings(detail.headings)}
      </div>
    </div>

    <div class="detail-section">
      <h3>🔗 連結動線</h3>
      <div class="detail-grid">
        ${renderDetailItem('導覽列連結', detail.flow.navLinks + ' 個')}
        ${renderDetailItem('頁尾連結', detail.flow.footerLinks + ' 個')}
        ${renderDetailItem('內部連結', detail.flow.internalLinks + ' 個')}
        ${renderDetailItem('外部連結', detail.flow.externalLinks + ' 個')}
        ${renderDetailItem('外部佔比', detail.flow.externalRatio, null,
    parseFloat(detail.flow.externalRatio) > 30 ? 'warning' : 'success')}
      </div>
    </div>

    <div class="detail-section">
      <h3>🍞 麵包屑</h3>
      ${renderBreadcrumbs(detail.breadcrumbs)}
    </div>

    <div class="detail-section">
      <h3>🧱 語意區塊</h3>
      ${renderBlocks(detail.blocks)}
    </div>

    ${renderDomTreeSection(domTree)}
    ${renderJsArchitectureSection(jsArchitecture)}
  `;

  // 自動觸發頁面功能物種分析
  fetchPageSpecies(detail);
}

function renderDetailItem(label, value, maxLen = null, status = null) {
  if (!value) {
    return `<div class="detail-item"><span class="label">${label}</span><span class="value" style="color: var(--text-muted);">未設定</span></div>`;
  }
  let displayValue = value;
  let statusClass = status || '';
  if (maxLen && value.length > maxLen) {
    statusClass = 'warning';
    displayValue = `${value} (${value.length}字，建議 < ${maxLen})`;
  } else if (maxLen) {
    statusClass = 'success';
  }
  return `<div class="detail-item"><span class="label">${label}</span><span class="value ${statusClass}">${displayValue}</span></div>`;
}

function renderHeadings(headings) {
  let html = '';
  if (headings.h1.length === 0) {
    html += `<div class="detail-item"><span class="label">H1</span><span class="value error">⚠️ 無 H1</span></div>`;
  } else if (headings.h1.length > 1) {
    html += `<div class="detail-item"><span class="label">H1</span><span class="value warning">⚠️ ${headings.h1.length} 個 H1</span></div>`;
  } else {
    html += `<div class="detail-item"><span class="label">H1</span><span class="value success">✓ ${headings.h1[0]}</span></div>`;
  }
  if (headings.h2.length > 0) {
    html += `<div class="detail-item"><span class="label">H2 (${headings.h2.length})</span><span class="value">${headings.h2.slice(0, 3).join(', ')}...</span></div>`;
  }
  return html;
}

function renderBreadcrumbs(breadcrumbs) {
  if (!breadcrumbs.detected) {
    return `<div class="detail-item"><span class="value" style="color: var(--text-muted);">未偵測到</span></div>`;
  }
  return `<div class="tags-list">${breadcrumbs.items.map(i => `<span class="tag">${i.text}</span>`).join(' → ')}</div>`;
}

function renderBlocks(blocks) {
  if (blocks.length === 0) {
    return `<div class="detail-item"><span class="value" style="color: var(--text-muted);">未偵測到</span></div>`;
  }
  const icons = {
    'Header': '🔝',
    'Hero Section': '🎯',
    'Main Content': '📖',
    'Footer': '🔚',
    'Navigation': '🧭',
    'Sidebar': '📌'
  };

  return blocks.map(b => {
    // 組裝詳細資訊
    let meta = [];
    if (b.hasLogo) meta.push('有 Logo');
    if (b.hasNav) meta.push('有導覽');
    if (b.hasHeading) meta.push('有標題');
    if (b.hasImage) meta.push('有圖片');
    if (b.hasCTA) meta.push('有 CTA');
    if (b.sections) meta.push(`${b.sections} sections`);
    if (b.articles) meta.push(`${b.articles} articles`);
    if (b.linksCount) meta.push(`${b.linksCount} 連結`);
    if (b.hasSocial) meta.push('有社群連結');
    if (b.count) meta.push(`${b.count} 個`);
    if (b.tag) meta.push(`<${b.tag}>`);
    if (b.selector) meta.push(b.selector);

    const metaStr = meta.length > 0 ? meta.join(' • ') : '';

    return `
      <div class="block-item">
        <span class="block-icon">${icons[b.type] || '📦'}</span>
        <div class="block-info">
          <div class="block-type">${b.type}</div>
          ${metaStr ? `<div class="block-meta">${metaStr}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ========================================
// DOM Tree Section (頁面詳情)
// ========================================
function renderDomTreeSection(domTree) {
  if (!domTree) return '';

  const stats = domTree.stats || {};
  const depthStatus = stats.depth > 10 ? 'warning' : 'success';
  const elementStatus = stats.totalElements > 2000 ? 'warning' : 'success';

  return `
    <div class="detail-section">
      <h3>🌳 DOM 結構分析</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">總元素數</span>
          <span class="value ${elementStatus}">${stats.totalElements || 0}${stats.totalElements > 2000 ? ' ⚠️ 過多' : ''}</span>
        </div>
        <div class="detail-item">
          <span class="label">不重複標籤</span>
          <span class="value">${stats.uniqueTags || 0} 種</span>
        </div>
        <div class="detail-item">
          <span class="label">嵌套深度</span>
          <span class="value ${depthStatus}">${stats.depth || 0} 層${stats.depth > 10 ? ' ⚠️ 過深' : ''}</span>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// JS Architecture Section (頁面詳情)
// ========================================
function renderJsArchitectureSection(jsArch) {
  if (!jsArch) return '';

  const frameworks = jsArch.frameworks || [];
  const stats = jsArch.stats || {};

  const frameworksHtml = frameworks.map(fw => {
    const confidenceIcon = fw.confidence === 'high' ? '✅' : fw.confidence === 'medium' ? '🟡' : '❓';
    return `<span class="tag">${confidenceIcon} ${fw.name}</span>`;
  }).join(' ');

  return `
    <div class="detail-section">
      <h3>⚙️ JS 架構分析</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">偵測框架</span>
          <span class="value">${frameworksHtml || '無'}</span>
        </div>
        <div class="detail-item">
          <span class="label">Scripts 總數</span>
          <span class="value">${stats.totalScripts || 0} 個</span>
        </div>
        <div class="detail-item">
          <span class="label">框架 Scripts</span>
          <span class="value">${stats.frameworkScripts || 0} 個</span>
        </div>
        <div class="detail-item">
          <span class="label">Bundle Scripts</span>
          <span class="value">${stats.bundleScripts || 0} 個</span>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// DOM Tree Visualization
// ========================================
function renderDomTree(domData) {
  const stats = document.getElementById('domStats');
  stats.innerHTML = `
    <span>📊 總元素: <strong>${domData.stats.totalElements}</strong></span>
    <span>🏷️ 標籤: <strong>${domData.stats.uniqueTags}</strong></span>
  `;
  const container = document.getElementById('domTreeViz');
  renderD3Tree(container, convertToD3Tree(domData.tree, 'dom'));
}

// ========================================
// JS Architecture
// ========================================
function renderJsArchitecture(jsData) {
  const stats = document.getElementById('jsStats');
  stats.innerHTML = `<span>📜 Scripts: <strong>${jsData.stats.totalScripts}</strong></span>`;

  const frameworkInfo = document.getElementById('frameworkInfo');
  frameworkInfo.innerHTML = jsData.frameworks.map(fw => `
    <div class="framework-card">
      <h3>${fw.name}</h3>
      <span class="confidence ${fw.confidence}">${fw.confidence}</span>
    </div>
  `).join('');

  const container = document.getElementById('jsArchViz');
  renderD3Tree(container, convertToD3Tree(jsData.dependencyTree, 'js'));
}

// ========================================
// D3 Tree (Generic)
// ========================================
function convertToD3Tree(node, type) {
  if (!node) return null;
  let name = '';
  if (type === 'dom') {
    name = node.tag || 'unknown';
    if (node.id) name += `#${node.id}`;
    if (node.summary) name = node.summary;
  } else if (type === 'js') {
    name = node.name || 'unknown';
  }
  return {
    name,
    children: (node.children || []).map(c => convertToD3Tree(c, type)).filter(Boolean)
  };
}

function renderD3Tree(container, data) {
  container.innerHTML = '';
  if (!data) return;

  const width = container.clientWidth || 600;
  const root = d3.hierarchy(data);
  const treeHeight = Math.max(300, root.descendants().length * 20);

  const treeLayout = d3.tree().size([treeHeight, width - 150]);
  treeLayout(root);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', treeHeight + 40)
    .append('g')
    .attr('transform', 'translate(70, 20)');

  svg.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x));

  const nodes = svg.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.y}, ${d.x})`);

  nodes.append('circle').attr('r', 4);
  nodes.append('text')
    .attr('dy', 4)
    .attr('x', d => d.children ? -8 : 8)
    .attr('text-anchor', d => d.children ? 'end' : 'start')
    .text(d => d.data.name.length > 25 ? d.data.name.substring(0, 22) + '...' : d.data.name);
}

// ========================================
// JSON Download
// ========================================
function downloadJson() {
  if (!currentData) return;
  const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `web-structure-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ========================================
// AI Expert Analysis (Tab 介面版)
// ========================================
function setupAiExpertButtons() {
  // Detail Tab 切換
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.detailTab;
      switchDetailTab(targetTab);
    });
  });

  // 執行分析按鈕 - 使用 cloneNode 清除舊監聽器避免累積
  document.querySelectorAll('.run-expert-btn').forEach(btn => {
    // 複製按鈕以清除所有舊的事件監聽器
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // 在新按鈕上綁定事件
    newBtn.addEventListener('click', async () => {
      const expertType = newBtn.dataset.type;
      await runAiExpertAnalysis(expertType, newBtn);
    });
  });

  // API Key 顯示/隱藏切換
  const toggleBtn = document.getElementById('toggleKeyVisibility');
  const keyInput = document.getElementById('geminiApiKey');
  if (toggleBtn && keyInput) {
    toggleBtn.onclick = () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = keyInput.type === 'password' ? '👁️' : '🙈';
    };
  }
}

function switchDetailTab(tabId) {
  // 切換 Tab 按鈕
  document.querySelectorAll('.detail-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.detailTab === tabId)
  );

  // 切換 Tab 內容
  const tabIdMap = {
    'info': 'detailTabInfo',
    'seo': 'detailTabSeo',
    'ux': 'detailTabUx',
    'growth': 'detailTabGrowth',
    'ga4': 'detailTabGa4'
  };

  document.querySelectorAll('.detail-tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabIdMap[tabId])
  );
}

async function runAiExpertAnalysis(expertType, btn) {
  if (!currentPageDetail) {
    alert('請先選擇一個頁面');
    return;
  }

  const apiKey = document.getElementById('geminiApiKey').value.trim();
  if (!apiKey) {
    alert('請輸入 Gemini API Key');
    document.getElementById('geminiApiKey').focus();
    return;
  }

  // 取得對應的結果容器
  const resultElId = {
    'seo': 'seoExpertResult',
    'ux': 'uxExpertResult',
    'growth': 'growthExpertResult',
    'ga4': 'ga4ExpertResult'
  };
  const resultEl = document.getElementById(resultElId[expertType]);

  // 顯示載入中
  resultEl.innerHTML = `
    <div class="loading">
      <span class="spinner"></span>
      <span>AI 專家分析中，請稍等...</span>
    </div>
  `;

  btn.disabled = true;

  try {
    // 如果是 GA4 專家，先呼叫 GA4 分析 API 取得追蹤元素資料
    if (expertType === 'ga4' && !currentGa4TrackingData) {
      resultEl.innerHTML = `
        <div class="loading">
          <span class="spinner"></span>
          <span>分析頁面可追蹤元素中...</span>
        </div>
      `;

      // 需要從後端取得 HTML，這裡使用 pageDetail 中的資料
      // 由於沒有 HTML，我們直接傳 pageDetail 給後端讓 AI 從現有資料判斷
      // 或者簡化：直接讓 AI 從 pageDetail 判斷
    }

    // 檢查是否開啟 Grounding (使用全域 toggle，但 context 從該專家的 input 取得)
    const useGrounding = document.getElementById('globalGroundingToggle')?.checked || false;

    let groundingContext = '';
    if (useGrounding && btn) {
      // 從按鈕的父容器 (.expert-controls) 尋找 input
      const input = btn.parentElement.querySelector('.expert-context-input');
      if (input) {
        groundingContext = input.value.trim();
      }
    }

    const response = await fetch('/api/ai-expert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertType,
        pageDetail: currentPageDetail,
        apiKey,
        screenshot: currentScreenshot,
        domTree: currentDomTree,
        jsArchitecture: currentJsArchitecture,
        ga4TrackingData: currentGa4TrackingData,
        useGrounding,
        groundingContext
      })
    });

    // 檢查回應類型
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`伺服器回傳非 JSON 格式: ${text.substring(0, 100)}...`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI 分析失敗');
    }

    // 渲染分析結果
    renderExpertResult(resultEl, data);

  } catch (error) {
    resultEl.innerHTML = `
      <div class="error">
        ❌ ${error.message}
      </div>
    `;
  } finally {
    btn.disabled = false;
  }
}

// 使用 marked.js 進行 Markdown 解析
function parseMarkdown(text) {
  if (!text) return '';

  // 預處理：移除 AI 可能包裹的 ```markdown 區塊
  text = text.replace(/^```markdown\s*\n/i, '').replace(/\n```\s*$/i, '');
  text = text.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');

  // 移除 Google Grounding 引用標記 (例如：[cite: 0.2] 或 [cite: -] 或 [cite：0.2])
  text = text.replace(/\[cite[：:]\s*[\d.\-]+\]/gi, '');

  // 使用 marked.js
  if (typeof marked !== 'undefined') {
    try {
      marked.use({
        breaks: true,
        gfm: true
      });

      // 預處理：修復冒號後接 * 符號的列表格式問題
      // 將 "：* 內容" 或 ": * 內容" 轉換為正確的列表換行格式
      text = text.replace(/：\s*\*\s+/g, '：\n  * ');
      text = text.replace(/:\s*\*\s+/g, ':\n  * ');

      return marked.parse(text);
    } catch (e) {
      console.error('marked.js 解析錯誤:', e);
    }
  }

  // Fallback: 基本解析（如果 marked 未載入或出錯）
  return text
    .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^-\s+(.*)$/gm, '<li>$1</li>')
    .replace(/^\*\s+(.*)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}

function renderExpertResult(resultEl, data) {
  // 使用通用 Markdown 解析器
  let html = parseMarkdown(data.analysis);

  // 準備引用來源 HTML
  const citationsHtml = renderGroundingSources(data.groundingMetadata);

  resultEl.innerHTML = `
    <div class="analysis-header">
      <div class="analysis-actions">
        <button class="copy-report-btn" title="複製報告 Markdown">📋 複製報告</button>
        <span class="duration">耗時 ${data.duration}</span>
      </div>
    </div>
    <div class="analysis-content">
      ${html}
    </div>
    ${citationsHtml}
  `;

  // 儲存原始分析結果供追問使用
  resultEl.dataset.analysis = data.analysis;

  // 綁定複製按鈕事件 (複製渲染後的 HTML，可貼到 Google Docs)
  const copyBtn = resultEl.querySelector('.copy-report-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        const contentEl = resultEl.querySelector('.analysis-content');
        const htmlContent = contentEl.innerHTML;

        // 使用 Clipboard API 複製 HTML 格式
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const clipboardItem = new ClipboardItem({ 'text/html': blob });
        await navigator.clipboard.write([clipboardItem]);

        copyBtn.textContent = '✅ 已複製';
        setTimeout(() => { copyBtn.textContent = '📋 複製報告'; }, 2000);
      } catch (err) {
        console.error('複製失敗:', err);
        // Fallback: 複製純文字
        const textContent = resultEl.querySelector('.analysis-content').innerText;
        navigator.clipboard.writeText(textContent).then(() => {
          copyBtn.textContent = '✅ 已複製 (文字)';
          setTimeout(() => { copyBtn.textContent = '📋 複製報告'; }, 2000);
        }).catch(() => {
          alert('複製失敗，請手動選取複製');
        });
      }
    });
  }

  // 顯示追問區塊
  const expertType = resultEl.id.replace('ExpertResult', '').toLowerCase();
  const followupSection = document.querySelector(`.followup-section[data-expert="${expertType}"]`);
  if (followupSection) {
    followupSection.style.display = 'block';
    setupFollowupHandler(followupSection, expertType, resultEl);
  }
}

// 設定追問事件處理
function setupFollowupHandler(section, expertType, resultEl) {
  const input = section.querySelector('.followup-input');
  const btn = section.querySelector('.followup-btn');
  const fileInput = section.querySelector('.followup-file');
  const uploadPreview = section.querySelector('.upload-preview');

  // 移除舊事件
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // 綁定新事件 (只綁定按鈕點擊，不綁定 Enter 鍵)
  newBtn.addEventListener('click', () => sendFollowup(input, newBtn, expertType, resultEl, fileInput));

  // 預覽上傳檔案
  if (fileInput && uploadPreview) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      if (files.length === 0) {
        uploadPreview.textContent = '';
      } else {
        const names = files.map(f => f.name).join(', ');
        uploadPreview.textContent = `📁 ${files.length} 個檔案: ${names}`;
      }
    });
  }
}

// 處理上傳附件 (轉換 base64)
async function processAttachments(files) {
  if (!files || files.length === 0) return [];

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const attachments = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      alert(`檔案 "${file.name}" 超過 10MB 限制，將跳過此檔案`);
      continue;
    }

    const base64 = await readFileAsBase64(file);
    attachments.push({
      type: file.type.startsWith('image/') ? 'image' : 'document',
      mimeType: file.type,
      name: file.name,
      base64: base64
    });
  }

  return attachments;
}

// 讀取檔案為 base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 移除 data:xxx;base64, 前綴
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 發送追問 (支援多模態)
async function sendFollowup(input, btn, expertType, resultEl, fileInput = null) {
  const question = input.value.trim();
  if (!question) return;

  const apiKey = document.getElementById('geminiApiKey').value.trim();
  if (!apiKey) {
    alert('請輸入 Gemini API Key');
    return;
  }

  const previousAnalysis = resultEl.dataset.analysis;
  if (!previousAnalysis) {
    alert('請先執行分析');
    return;
  }

  // 處理附件
  let attachments = [];
  if (fileInput && fileInput.files.length > 0) {
    attachments = await processAttachments(fileInput.files);
  }

  // 顯示用戶問題 (含附件提示)
  const contentEl = resultEl.querySelector('.analysis-content');
  const attachmentNote = attachments.length > 0
    ? ` <span class="attachment-badge">📎 ${attachments.length} 個附件</span>`
    : '';
  contentEl.innerHTML += `
    <div class="followup-message user">
      <strong>追問：</strong>${question}${attachmentNote}
    </div>
    <div class="followup-message ai loading">
      <span class="spinner"></span> 回答中...
    </div>
  `;

  input.value = '';
  if (fileInput) {
    fileInput.value = '';
    const preview = fileInput.closest('.followup-upload-row')?.querySelector('.upload-preview');
    if (preview) preview.textContent = '';
  }
  btn.disabled = true;

  try {
    // 檢查是否開啟 Grounding (使用全域 toggle)
    const useGrounding = document.getElementById('globalGroundingToggle')?.checked || false;

    const response = await fetch('/api/ai-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertType,
        question,
        previousAnalysis,
        pageDetail: currentPageDetail,
        apiKey,
        useGrounding,
        attachments  // 新增附件
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '追問失敗');
    }

    // 移除 loading，顯示回答
    const loadingEl = contentEl.querySelector('.followup-message.loading');
    if (loadingEl) {
      const citationsHtml = renderGroundingSources(data.groundingMetadata);
      loadingEl.classList.remove('loading');
      loadingEl.innerHTML = parseMarkdown(data.answer) + citationsHtml;
    }

    // 更新完整對話記錄供下次追問
    resultEl.dataset.analysis += `\n\n用戶追問：${question}\n回答：${data.answer}`;

  } catch (error) {
    const loadingEl = contentEl.querySelector('.followup-message.loading');
    if (loadingEl) {
      loadingEl.classList.remove('loading');
      loadingEl.innerHTML = `❌ ${error.message}`;
    }
  } finally {
    btn.disabled = false;
  }
}

// ========================================
// Site Report (整體報告功能)
// ========================================

// 加入頁面到收集陣列（避免重複）
function addToAnalyzedCollection(pageData) {
  const exists = analyzedPagesCollection.find(p => p.url === pageData.url);
  if (!exists) {
    analyzedPagesCollection.push(pageData);
    console.log(`[收集] 已分析 ${analyzedPagesCollection.length} 頁: ${pageData.title}`);
  }
}

// 更新整體報告按鈕狀態
function updateSiteReportButton() {
  const countEl = document.getElementById('analyzedPagesCount');
  const count = analyzedPagesCollection.length;

  if (countEl) {
    countEl.textContent = count;
  }

  // 更新所有生成報告按鈕的狀態
  document.querySelectorAll('.run-site-report-btn').forEach(btn => {
    btn.disabled = count < 1;
  });
}

// 設定整體報告按鈕事件
function setupSiteReportButtons() {
  document.querySelectorAll('.site-report-tab').forEach(tab => {
    // 清除舊監聽器
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);

    newTab.addEventListener('click', () => {
      const type = newTab.dataset.reportType;
      switchSiteReportTab(type);
    });
  });

  document.querySelectorAll('.run-site-report-btn').forEach(btn => {
    // 清除舊監聽器
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
      const type = newBtn.dataset.type;
      await generateSiteReport(type, newBtn);
    });
  });
}

// 切換整體報告 Tab
function switchSiteReportTab(tabId) {
  document.querySelectorAll('.site-report-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.reportType === tabId)
  );

  const tabIdMap = {
    'seo': 'siteReportTabSeo',
    'ux': 'siteReportTabUx',
    'growth': 'siteReportTabGrowth',
    'ga4': 'siteReportTabGa4'
  };

  document.querySelectorAll('.site-report-tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabIdMap[tabId])
  );
}

// 生成整體報告
async function generateSiteReport(expertType, btn) {
  if (analyzedPagesCollection.length < 1) {
    alert('請至少分析一個頁面');
    return;
  }

  const apiKey = document.getElementById('geminiApiKey').value.trim();
  if (!apiKey) {
    alert('請先在上方輸入 Gemini API Key');
    return;
  }

  const resultElId = {
    'seo': 'siteReportSeoResult',
    'ux': 'siteReportUxResult',
    'growth': 'siteReportGrowthResult',
    'ga4': 'siteReportGa4Result'
  };
  const resultEl = document.getElementById(resultElId[expertType]);

  resultEl.innerHTML = `
    <div class="loading">
      <span class="spinner"></span>
      <span>正在生成整站 ${expertType.toUpperCase()} 報告，分析 ${analyzedPagesCollection.length} 個頁面...</span>
    </div>
  `;

  btn.disabled = true;

  try {
    // 準備頁面摘要資料（精簡版避免過長）
    const pagesSummary = analyzedPagesCollection.map(p => ({
      url: p.url,
      level: p.level,
      title: p.title,
      seoTags: p.pageDetail?.seoTags || {},
      headingsCount: p.pageDetail?.headings?.length || 0,
      internalLinks: p.pageDetail?.flow?.internalLinks || 0,
      externalLinks: p.pageDetail?.flow?.externalLinks || 0,
      domElements: p.domTree?.stats?.totalElements || 0,
      frameworks: p.jsArchitecture?.frameworks?.map(f => f.name) || []
    }));

    // 檢查是否開啟 Grounding (使用全域 toggle，但 context 從該專家的 input 取得)
    const useGrounding = document.getElementById('globalGroundingToggle')?.checked || false;

    let groundingContext = '';
    if (useGrounding && btn) {
      // 從按鈕的父容器 (.expert-controls) 尋找 input
      const input = btn.parentElement.querySelector('.expert-context-input');
      if (input) {
        groundingContext = input.value.trim();
      }
    }

    const response = await fetch('/api/ai-site-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertType,
        pages: pagesSummary,
        totalPages: analyzedPagesCollection.length,
        apiKey,
        useGrounding,
        groundingContext
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '生成報告失敗');
    }

    // 渲染報告
    renderSiteReportResult(resultEl, data);

  } catch (error) {
    resultEl.innerHTML = `
      <div class="error">
        ❌ ${error.message}
      </div>
    `;
  } finally {
    btn.disabled = false;
  }
}

// 渲染整體報告結果
function renderSiteReportResult(resultEl, data) {
  let html = parseMarkdown(data.report);

  // 準備引用來源 HTML
  const citationsHtml = renderGroundingSources(data.groundingMetadata);

  resultEl.innerHTML = `
    <div class="analysis-header">
      <span class="expert-badge">${data.icon} ${data.expert} - 整站報告</span>
      <span class="duration">分析 ${data.pagesCount} 頁 | 耗時 ${data.duration}</span>
      <button class="copy-btn" onclick="copySiteReportToClipboard(this)" data-report="${encodeURIComponent(data.report)}">
        📋 複製報告
      </button>
    </div>
    <div class="analysis-content">
      ${html}
    </div>
    ${citationsHtml}
    
    <!-- 戰略追問區塊 -->
    <div class="followup-section" id="siteFollowup-${data.timestamp}">
      <h3>💬 戰略追問</h3>
      <div class="followup-history" id="siteHistory-${data.timestamp}"></div>
      <div class="followup-input-wrapper">
        <textarea 
          class="followup-input" 
          placeholder="針對這份整站報告，您想進一步了解什麼戰略細節？..."
          rows="3"
        ></textarea>
        <div class="followup-upload">
          <label class="upload-label">
            📎 附加檔案
            <input type="file" class="followup-file" accept="image/*,.pdf" multiple>
          </label>
          <span class="upload-preview"></span>
        </div>
        <button class="followup-btn" onclick="runSiteReportFollowUp(this, '${data.expertType}')">
          送出追問
        </button>
      </div>
    </div>
  `;

  // 儲存報告上下文供追問使用 (掛載在 DOM 上)
  const reportContainer = resultEl.querySelector('.followup-section');
  if (reportContainer) {
    reportContainer.dataset.reportContext = data.report;
  }
}

// 渲染 Grounding 引用來源
function renderGroundingSources(metadata) {
  if (!metadata || !metadata.groundingChunks || metadata.groundingChunks.length === 0) {
    return '';
  }

  // 提取唯一來源
  const uniqueSources = new Map();
  metadata.groundingChunks.forEach(chunk => {
    if (chunk.web && chunk.web.uri && chunk.web.title) {
      uniqueSources.set(chunk.web.uri, chunk.web.title);
    }
  });

  if (uniqueSources.size === 0) return '';

  const sourcesList = Array.from(uniqueSources.entries()).map(([uri, title]) => `
    <li>
      <a href="${uri}" target="_blank" rel="noopener noreferrer" class="source-link">
        ${title}
      </a>
    </li>
  `).join('');

  return `
    <div class="grounding-sources">
      <h4>📚 參考來源 (Google Search)</h4>
      <ul>${sourcesList}</ul>
    </div>
  `;
}

// 頁面載入時設定事件
document.addEventListener('DOMContentLoaded', () => {
  setupSiteReportButtons();
  setupApiKeyToggle();
});

// 設定頂部 API Key 顯示/隱藏
function setupApiKeyToggle() {
  const toggleBtn = document.getElementById('toggleKeyVisibility');
  const keyInput = document.getElementById('geminiApiKey');
  const clearBtn = document.getElementById('clearApiKey');

  if (toggleBtn && keyInput) {
    // 顯示/隱藏切換
    toggleBtn.onclick = () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = keyInput.type === 'password' ? '👁️' : '🙈';
    };

    // 清除按鈕功能
    if (clearBtn) {
      clearBtn.onclick = () => {
        keyInput.value = '';
        clearBtn.style.display = 'none';
        keyInput.focus();
      };

      // 根據輸入內容控制清除按鈕顯示
      keyInput.addEventListener('input', () => {
        clearBtn.style.display = keyInput.value ? 'flex' : 'none';
      });

      // 初始化顯示狀態
      clearBtn.style.display = keyInput.value ? 'flex' : 'none';
    }
  }
}

// 網站概覽 AI 分析
async function fetchSiteOverview(data) {
  const apiKey = document.getElementById('geminiApiKey').value.trim();
  const overviewSection = document.getElementById('siteOverviewSection');
  const overviewContent = document.getElementById('siteOverviewContent');

  // 如果沒有 API Key，隱藏概覽區塊
  if (!apiKey) {
    overviewSection.hidden = true;
    return;
  }

  // 顯示概覽區塊
  overviewSection.hidden = false;
  overviewContent.innerHTML = `
    <div class="loading">
      <span class="spinner"></span>
      <span>AI 正在解讀網站架構與商業目標...</span>
    </div>
  `;

  try {
    // 準備網站資料
    const siteData = {
      url: data.url,
      title: data.level0PageDetail?.seoTags?.title || '',
      description: data.level0PageDetail?.seoTags?.description || '',
      linksCount: data.level0PageDetail?.flow?.internal?.length || 0,
      navItems: data.level0PageDetail?.flow?.nav?.map(n => n.text) || [],
      blocks: data.level0PageDetail?.blocks || [],
      goals: getSelectedGoals() // 新增：使用者指定的網站目標
    };

    let response;
    try {
      response = await fetch('/api/ai-site-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteData, apiKey })
      });
    } catch (networkError) {
      // 網路層面的錯誤（無法連接伺服器）
      console.error('網站概覽網路錯誤:', networkError);
      throw new Error('無法連接伺服器，請確認伺服器正在運行中');
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '分析失敗');
    }

    // 解析 AI 回傳的 Markdown
    // 我們假設 AI 回傳格式包含特定的標題，我們利用這些標題來拆分內容
    const sections = result.overview.split('###').filter(s => s.trim());

    // 預設卡片標題對應（新版品牌情報分析師格式）
    const cardMap = {
      '品牌核心與人格': { icon: '🧬', content: '' },
      '市場定位與受眾畫像': { icon: '🎯', content: '' },
      '全網策略推演': { icon: '⚔️', content: '' },
      '品牌競爭力診斷': { icon: '⚖️', content: '' }
    };

    sections.forEach(section => {
      const lines = section.trim().split('\n');
      const title = lines[0].trim().replace(/\*\*/g, ''); // 移除可能的粗體標記
      const content = lines.slice(1).join('\n').trim();

      // 模糊匹配標題
      Object.keys(cardMap).forEach(key => {
        if (title.includes(key)) {
          // 處理內容：先轉換粗體，然後處理列表項
          let processedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

          // 檢查是否有列表項，如果有則用 <ul> 包裹
          if (/^- /m.test(processedContent)) {
            // 將列表項轉換為 <li>，並用 <ul> 包裹
            const listItems = processedContent
              .split('\n')
              .map(line => {
                if (line.trim().startsWith('- ')) {
                  return `<li>${line.trim().substring(2)}</li>`;
                }
                // 非列表項的文字保留為段落
                return line.trim() ? `<p>${line.trim()}</p>` : '';
              })
              .join('');
            processedContent = `<ul>${listItems}</ul>`;
          } else {
            // 沒有列表項，直接保留段落格式
            processedContent = processedContent
              .split('\n')
              .filter(line => line.trim())
              .map(line => `<p>${line.trim()}</p>`)
              .join('');
          }

          cardMap[key].content = processedContent;
        }
      });
    });

    // 生成卡片 HTML
    let cardsHtml = '';
    Object.entries(cardMap).forEach(([key, data]) => {
      if (data.content) {
        cardsHtml += `
          <div class="overview-card">
            <h3>${data.icon} ${key}</h3>
            <div class="card-body">${data.content}</div>
          </div>
        `;
      }
    });

    // 如果解析失敗（沒有匹配到預期標題），則回退到顯示原始 HTML
    if (!cardsHtml) {
      cardsHtml = `<div class="raw-content">${result.overview.replace(/\n/g, '<br>')}</div>`;
    }

    overviewContent.innerHTML = `
      <div class="overview-cards">
        ${cardsHtml}
      </div>
      <p class="duration-hint">AI 分析耗時 ${result.duration}</p>
    `;


  } catch (error) {
    overviewContent.innerHTML = `
      <div class="error">
        ❌ 網站概覽分析失敗: ${error.message}
      </div>
    `;
  }
}

// 頁面功能物種分析
async function fetchPageSpecies(pageData) {
  const apiKey = document.getElementById('geminiApiKey').value.trim();
  const section = document.getElementById('pageSpeciesSection');

  // 如果沒有 API Key，隱藏區塊
  if (!apiKey) {
    section.style.display = 'none';
    return;
  }

  // 顯示 Loading
  section.style.display = 'block';
  section.innerHTML = `
    <div class="loading" style="padding: 0.5rem; justify-content: flex-start;">
      <span class="spinner" style="width: 1rem; height: 1rem;"></span>
      <span style="font-size: 0.9rem;">AI 正在分析頁面功能物種...</span>
    </div>
  `;

  try {
    const requestData = {
      url: pageData.url,
      title: pageData.seoTags?.title || '',
      description: pageData.seoTags?.description || '',
      h1: Array.isArray(pageData.headings) ? (pageData.headings.find(h => h.tagName === 'H1')?.text || '') : '',
      linksCount: Array.isArray(pageData.flow?.internal) ? pageData.flow.internal.length : 0,
      text: pageData.text || ''
    };

    const response = await fetch('/api/ai-page-classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageData: requestData, apiKey })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '分析失敗');
    }

    // Icon Mapping
    const iconMap = {
      'Hook': '🪝',
      'Router': '🚦',
      'Pitch': '✨',
      'Tunnel': '🛒',
      'Backstage': '🛡️'
    };

    // Render Result
    const kpisHtml = result.kpis?.map(kpi => `<span class="kpi-tag">${kpi}</span>`).join('') || '';

    section.innerHTML = `
      <div class="species-card species-${result.species}">
        <div class="species-icon">${iconMap[result.species] || '📄'}</div>
        <div class="species-info">
          <div class="species-name">
            ${result.species_zh}
            <span class="species-eng">(${result.species})</span>
          </div>
          <div class="species-desc">
            <strong>核心任務：</strong>${result.mission}
          </div>
          <div class="species-kpis">
            <span class="kpi-label">📊 關鍵指標：</span>
            ${kpisHtml}
          </div>
          <div class="species-meta">
            <span class="meta-item">⏱️ ${result.duration}</span>
          </div>
        </div>
      </div>
    `;

  } catch (error) {
    section.innerHTML = `
      <div class="error" style="padding: 0.5rem;">
        ⚠️ 無法分析頁面物種: ${error.message}
      </div>
    `;
  }
}

// ========================================
// Sitemap Grouping Logic
// ========================================
function groupChildren(links, parentId, level) {
  const groups = {};
  const ungrouped = [];
  const THRESHOLD = 5; // 超過 5 個同類路徑就分組

  // 1. 初步分類
  links.forEach(link => {
    // 取得路徑部分，忽略空字串
    const pathParts = link.path.split('/').filter(Boolean);

    // 定義分組鍵值：取前兩個路徑段 (例如: movie/genre)
    // 如果只有一層 (例如: /about)，則視為該層級
    const key = pathParts.length >= 2
      ? pathParts.slice(0, 2).join('/')
      : pathParts[0];

    if (key) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(link);
    } else {
      ungrouped.push(link);
    }
  });

  const groupNodes = [];
  const fileNodes = []; // Renamed from nodes to distinguish

  // 2. 處理分組
  Object.entries(groups).forEach(([key, groupLinks]) => {
    if (groupLinks.length >= THRESHOLD) {
      // 建立分組節點 (Virtual Node)
      const groupNodeId = `${parentId}-g-${key.replace(/\//g, '-')}`;
      groupNodes.push({
        id: groupNodeId,
        title: `📂 ${key} (${groupLinks.length})`,
        url: null, // Virtual node has no URL
        type: 'group', // 新增 group 類型
        level: level,
        expanded: false,
        analyzed: true, // 視為已分析，避免點擊觸發 crawl
        children: groupLinks.map((link, i) => ({
          id: `${groupNodeId}-${i}`,
          title: link.title,
          url: link.url,
          path: link.path,
          type: 'page',
          level: level + 1,
          expanded: false,
          analyzed: false,
          children: []
        }))
      });
    } else {
      // 數量不足不分組，歸回一般連結
      ungrouped.push(...groupLinks);
    }
  });

  // 3. 處理未分組連結
  ungrouped.forEach((link, i) => {
    fileNodes.push({
      id: `${parentId}-${i}`,
      title: link.title,
      url: link.url,
      path: link.path,
      type: 'page',
      level: level,
      expanded: false,
      analyzed: false,
      children: []
    });
  });

  // 4. 排序邏輯: 資料夾優先 (A-Z) -> 檔案 (A-Z)
  groupNodes.sort((a, b) => a.title.localeCompare(b.title));
  // 檔案按 Path 排序比較直觀，或者按 Title
  fileNodes.sort((a, b) => {
    const textA = a.path || a.title;
    const textB = b.path || b.title;
    return textA.localeCompare(textB);
  });

  return [...groupNodes, ...fileNodes];
}

// ========================================
// Site Report Follow-up Logic
// ========================================

// 複製整站報告到剪貼簿
async function copySiteReportToClipboard(btn) {
  try {
    const report = decodeURIComponent(btn.dataset.report);
    const contentEl = btn.closest('.expert-result').querySelector('.analysis-content');
    const htmlContent = contentEl.innerHTML;

    // 使用 Clipboard API 複製 HTML 格式
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    await navigator.clipboard.write([clipboardItem]);

    btn.textContent = '✅ 已複製';
    setTimeout(() => { btn.textContent = '📋 複製報告'; }, 2000);
  } catch (err) {
    console.error('複製失敗:', err);
    // Fallback: 複製純文字
    const textContent = btn.closest('.expert-result').querySelector('.analysis-content').innerText;
    navigator.clipboard.writeText(textContent).then(() => {
      btn.textContent = '✅ 已複製 (文字)';
      setTimeout(() => { btn.textContent = '📋 複製報告'; }, 2000);
    }).catch(() => {
      alert('複製失敗，請手動選取複製');
    });
  }
}

async function runSiteReportFollowUp(btn, expertType) {
  const container = btn.closest('.followup-section');
  const input = container.querySelector('.followup-input');
  const history = container.querySelector('.followup-history');
  const fileInput = container.querySelector('.followup-file');

  const question = input.value.trim();
  const reportContext = container.dataset.reportContext; // 從 dataset 取得報告上下文

  if (!question) {
    alert('請輸入您的戰略追問內容');
    return;
  }

  // 處理附件
  let attachments = [];
  if (fileInput && fileInput.files.length > 0) {
    attachments = await processAttachments(fileInput.files);
  }

  // 顯示用戶提問（含附件提示）
  const attachmentNote = attachments.length > 0 ? ` <span class="attachment-badge">📎 ${attachments.length} 個附件</span>` : '';
  const userMsg = document.createElement('div');
  userMsg.className = 'msg user-msg';
  userMsg.innerHTML = `<strong>You:</strong> ${question}${attachmentNote}`;
  history.appendChild(userMsg);

  // 清空輸入並鎖定按鈕
  input.value = '';
  if (fileInput) {
    fileInput.value = '';
    const preview = container.querySelector('.upload-preview');
    if (preview) preview.textContent = '';
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 戰略思考中...';

  const apiKey = document.getElementById('geminiApiKey').value.trim();
  const useGrounding = document.getElementById('globalGroundingToggle')?.checked || false;

  // 嘗試取得 Grounding Context (如果有的話)
  const expertBtn = document.querySelector(`.run-site-report-btn[data-type="${expertType}"]`);
  let groundingContext = '';
  if (expertBtn) {
    const contextInput = expertBtn.parentElement.querySelector('.expert-context-input');
    if (contextInput) groundingContext = contextInput.value.trim();
  }

  try {
    const response = await fetch('/api/ai-site-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expertType,
        question,
        reportContext,
        apiKey,
        useGrounding,
        groundingContext,
        attachments // 新增附件支援
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '追問失敗');
    }

    // 渲染 AI 回答
    const aiMsg = document.createElement('div');
    aiMsg.className = 'msg ai-msg';

    let answerHtml = parseMarkdown(data.answer);
    const citationHtml = renderGroundingSources(data.groundingMetadata);

    aiMsg.innerHTML = `
      <strong>${expertNames[expertType] || 'AI'}:</strong>
      <div class="ai-content">${answerHtml}</div>
      ${citationHtml}
    `;

    history.appendChild(aiMsg);

  } catch (error) {
    const errorMsg = document.createElement('div');
    errorMsg.className = 'msg error-msg';
    errorMsg.textContent = `❌ ${error.message}`;
    history.appendChild(errorMsg);
  } finally {
    btn.disabled = false;
    btn.textContent = '送出追問';
    // 滾動到底部
    history.scrollTop = history.scrollHeight;
  }
}
