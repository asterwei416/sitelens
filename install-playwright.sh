#!/bin/bash
# Zeabur 部署前置腳本 - 安裝 Playwright 瀏覽器

echo "🔧 Installing Playwright browsers..."

# 安裝 Playwright Chromium 瀏覽器
npx playwright install chromium

# 安裝系統依賴（如果需要）
npx playwright install-deps chromium

echo "✅ Playwright browsers installed successfully"
