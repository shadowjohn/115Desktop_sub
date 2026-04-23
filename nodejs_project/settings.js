const { ipcRenderer } = require('electron');

const fontSizeInput = document.getElementById('fontSize');
const fontColorInput = document.getElementById('fontColor');
const bgColorInput = document.getElementById('bgColor');
const bgColorPicker = document.getElementById('bgColorPicker');
const bgOpacity = document.getElementById('bgOpacity');
const opacityValue = document.getElementById('opacityValue');
const fontFamilyInput = document.getElementById('fontFamily');
const saveBtn = document.getElementById('saveBtn');
const statusText = document.getElementById('statusText');
const previewText = document.querySelector('.preview-text');
const previewPanel = document.querySelector('.preview');
const stylePreset = document.getElementById('stylePreset');

const presets = {
    cyberpunk: {
        fontSize: 32,
        fontColor: '#f3f7ff',
        bgColor: 'rgba(6, 14, 32, 0.72)',
        fontFamily: 'Microsoft JhengHei'
    },
    classic: {
        fontSize: 36,
        fontColor: '#ffffff',
        bgColor: 'rgba(0, 0, 0, 0.85)',
        fontFamily: 'Microsoft JhengHei'
    },
    light: {
        fontSize: 32,
        fontColor: '#1a1a1a',
        bgColor: 'rgba(245, 245, 245, 0.9)',
        fontFamily: 'Segoe UI'
    },
    anime: {
        fontSize: 48,
        fontColor: '#ffffff',
        bgColor: 'rgba(0, 0, 0, 0)',
        fontFamily: 'Microsoft JhengHei'
    }
};

stylePreset.addEventListener('change', () => {
    const preset = presets[stylePreset.value];
    if (preset) {
        fontSizeInput.value = preset.fontSize;
        fontColorInput.value = preset.fontColor;
        bgColorInput.value = preset.bgColor;
        fontFamilyInput.value = preset.fontFamily;
        
        // 同步色盤與透明度拉桿
        const p = parseRgba(preset.bgColor);
        bgColorPicker.value = p.hex;
        bgOpacity.value = p.alpha * 100;
        opacityValue.innerText = Math.round(p.alpha * 100);

        updatePreview();
    }
});

// 小工具：HEX 轉 RGBA
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 小工具：解析 RGBA 字串
function parseRgba(rgba) {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        return { hex, alpha: a };
    }
    if (rgba.startsWith('#')) return { hex: rgba.slice(0, 7), alpha: 1 };
    return { hex: '#060e20', alpha: 0.72 };
}

const currentSettings = ipcRenderer.sendSync('get-settings');

// 初始化背景選取器
function initBgPickers() {
    const initialBg = parseRgba(currentSettings.bgColor);
    bgColorPicker.value = initialBg.hex;
    bgOpacity.value = initialBg.alpha * 100;
    opacityValue.innerText = Math.round(initialBg.alpha * 100);
}

function syncBgFromPicker() {
    const hex = bgColorPicker.value;
    const alpha = bgOpacity.value / 100;
    const rgba = hexToRgba(hex, alpha);
    bgColorInput.value = rgba;
    opacityValue.innerText = bgOpacity.value;
    updatePreview();
}

bgColorPicker.addEventListener('input', syncBgFromPicker);
bgOpacity.addEventListener('input', syncBgFromPicker);

fontSizeInput.value = currentSettings.fontSize;
fontColorInput.value = currentSettings.fontColor;
bgColorInput.value = currentSettings.bgColor;
fontFamilyInput.value = currentSettings.fontFamily;

initBgPickers();
updatePreview();

function isValidCssColor(value) {
    const option = new Option();
    option.style.color = '';
    option.style.color = value;
    return option.style.color !== '';
}

function setStatus(message, isError = false) {
    statusText.innerText = message;
    statusText.dataset.state = isError ? 'error' : 'ok';
}

function updatePreview() {
    const fontSize = Number.parseInt(fontSizeInput.value, 10) || currentSettings.fontSize;
    const fontColor = fontColorInput.value || currentSettings.fontColor;
    const bgColor = bgColorInput.value.trim() || currentSettings.bgColor;
    const fontFamily = fontFamilyInput.value.trim() || currentSettings.fontFamily;

    previewText.style.fontSize = `${fontSize}px`;
    previewText.style.color = fontColor;
    previewText.style.fontFamily = fontFamily;
    previewText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0px rgba(0,0,0,0.5)';
    previewPanel.style.background = bgColor;
}

fontSizeInput.addEventListener('input', updatePreview);
fontColorInput.addEventListener('input', updatePreview);
bgColorInput.addEventListener('input', updatePreview);
fontFamilyInput.addEventListener('input', updatePreview);

saveBtn.addEventListener('click', () => {
    const fontSize = Number.parseInt(fontSizeInput.value, 10);
    const bgColor = bgColorInput.value.trim();

    if (!Number.isFinite(fontSize) || fontSize <= 0) {
        setStatus('字體大小必須是大於 0 的數字', true);
        fontSizeInput.focus();
        return;
    }

    if (!isValidCssColor(bgColor)) {
        setStatus('背景色格式無效，請輸入合法的 CSS 顏色', true);
        bgColorInput.focus();
        return;
    }

    const newSettings = {
        fontSize,
        fontColor: fontColorInput.value,
        bgColor,
        fontFamily: fontFamilyInput.value.trim() || currentSettings.fontFamily,
        position: currentSettings.position
    };

    ipcRenderer.send('save-settings', newSettings);
    Object.assign(currentSettings, newSettings);
    updatePreview();
    setStatus('設定已儲存，字幕視窗已同步更新');
});

// 關閉按鈕邏輯
const closeBtn = document.getElementById('closeBtn');
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        ipcRenderer.send('close-window');
    });
}

// 監聽 Alt 鍵狀態來啟用/停用拖動模式
ipcRenderer.on('alt-state', (event, active) => {
    if (active) {
        document.body.classList.add('alt-pressed');
    } else {
        document.body.classList.remove('alt-pressed');
    }
});

