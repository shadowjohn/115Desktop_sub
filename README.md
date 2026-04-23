# 桌面字幕系統 (Desktop Subtitle HUD)

這是一個為實況主、視訊會議、錄影教學設計的極速桌面字幕工具。它利用瀏覽器原生的 **Web Speech API** 進行語音辨識，並透過本地 API Server 將結果即時投射到一個透明且精美的桌面 HUD 上。

## 🌟 特色功能

- **極速辨識**：使用瀏覽器內建 Web Speech API，無需安裝大型 AI 模型。
- **夜城美學**：精美的透明懸浮視窗，支援自訂字體、色彩與背景。
- **自動斷句與標點**：自動感應停頓並加上「，」或「？」，閱讀更流暢。
- **智慧退場機制**：靜默 2-3 秒自動淡出與清空，保持畫面整潔。
- **全局快捷鍵**：`Shift + F2` 快速切換啟動/關閉，`Alt` 鍵拖曳位置。
- **輕量化**：完全移除 ffmpeg/whisper 依賴，大幅降低 CPU 與記憶體佔用。

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動程式
```bash
npm start
```

### 3. 開始辨識
1. 程式啟動後會自動開啟 Chrome 或 Edge。
2. 在網頁中點擊 **「開始語音辨識」** 並授權麥克風。
3. 回到任何視窗，按下 `Shift + F2` 啟動字幕顯示，開始說話！

## ⌨️ 快速鍵說明

- **Shift + F2**：切換字幕顯示開關。
- **按住 Alt**：進入「移動模式」，此時可以用滑鼠拖動字幕或設定視窗。

## 🛠️ 技術架構

- **Frontend**: Electron, HTML5, CSS3 (Vanilla).
- **Recognition**: Web Speech API (Chrome/Edge backend).
- **Communication**: Local HTTP API Bridge (CORS enabled).
- **Keyboard Hook**: `uiohook-napi` (Global key detection).

## 👨‍💻 作者

**羽山秋人 (Akira Hayama)**
- Website: [https://3wa.tw](https://3wa.tw)

## 📄 版本
V0.0.1 (Stable Beta)
