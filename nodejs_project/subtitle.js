const { ipcRenderer } = require('electron');

const textElement = document.getElementById('text');
const dragOverlay = document.getElementById('drag-overlay');
const statusPanel = document.getElementById('status-panel');
const statusLabel = document.getElementById('status-label');

let shouldTranscribe = false;
let recognitionState = 'idle';
let currentTranscript = '等待語音輸入… 按 Shift + F2 啟動';
let autoHideTimer = null;
let autoClearTimer = null;

const statusTextMap = {
    idle: '待機中',
    starting: '啟動中',
    listening: '正在聽取',
    stopped: '已停止',
    error: '異常'
};

const errorMessages = {
    'api-error': 'API 服務通訊異常',
    'browser-error': '瀏覽器辨識元件未啟動'
};

applySettings(ipcRenderer.sendSync('get-settings'));
setStatus('idle', '待機中');
setSystemMessage(currentTranscript);

function applySettings(settings) {
    textElement.style.fontSize = `${settings.fontSize}px`;
    textElement.style.color = settings.fontColor;
    textElement.style.backgroundColor = 'transparent';
    textElement.style.fontFamily = settings.fontFamily;
    textElement.style.transition = 'opacity 0.8s ease-in-out'; // 加入平滑淡出效果
    
    // 如果背景透明度很高，自動加強文字陰影以維持辨識度
    textElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0px rgba(0,0,0,0.5)';

    document.getElementById('text-panel').style.background =
        `linear-gradient(135deg, rgba(83, 249, 255, 0.14), rgba(255, 228, 92, 0.06)), ${settings.bgColor}`;
    document.getElementById('text-panel').style.transition = 'opacity 0.8s ease-in-out';
}

function setStatus(state, label) {
    recognitionState = state;
    statusPanel.className = `status-${state}`;
    statusLabel.innerText = label || statusTextMap[state] || '狀態未知';
}

function setSystemMessage(message) {
    currentTranscript = message;
    textElement.innerText = message;
    textElement.classList.add('is-system-message');
}

function setTranscript(text, isInterim = false) {
    textElement.classList.remove('is-system-message');
    textElement.innerText = text || '...';
    
    // 如果字數太多導致超過 2 行 (scrollHeight > offsetHeight)，則刪除最前面的文字
    // 注意：這裡假設 2 行的高度已經在 CSS 中透過 max-height 限制
    while (textElement.scrollHeight > textElement.clientHeight && text.length > 0) {
        text = text.substring(1);
        textElement.innerText = '...' + text;
    }

    currentTranscript = text;

    // 只要有新字，就確保顯示
    textElement.style.opacity = '1';
    document.getElementById('text-panel').style.opacity = '1';

    // 清除舊的計時器
    if (autoHideTimer) clearTimeout(autoHideTimer);
    if (autoClearTimer) clearTimeout(autoClearTimer);

    // 2 秒後淡出
    autoHideTimer = setTimeout(() => {
        textElement.style.opacity = '0';
        document.getElementById('text-panel').style.opacity = '0';
    }, 2000);

    // 3 秒後徹底清空
    autoClearTimer = setTimeout(() => {
        textElement.innerText = '';
        currentTranscript = '';
    }, 3000);

    if (isInterim) {
        textElement.style.opacity = '0.88';
    }
}

function startTranscription() {
    shouldTranscribe = true;
    setStatus('starting', '啟動中');
    setSystemMessage('正在開啟語音辨識服務…');
}

function stopTranscription() {
    shouldTranscribe = false;
    textElement.style.opacity = '1';
    setStatus('stopped', '已停止');
    setSystemMessage('語音辨識已關閉');
}

ipcRenderer.on('toggle-transcription', (_event, state) => {
    if (state) {
        startTranscription();
    } else {
        stopTranscription();
    }
});

ipcRenderer.on('settings-updated', (_event, settings) => {
    applySettings(settings);
});


ipcRenderer.on('speech-event', (_event, event) => {
    const { type, payload } = event;

    if (type === 'ready') {
        return;
    }

    if (type === 'ready') {
        return;
    }

    if (type === 'status') {
        if (payload.state === 'listening') {
            setStatus('listening', '正在聽取');
            return;
        }

        if (payload.state === 'stopped') {
            setStatus('stopped', '已停止');
            return;
        }

        setStatus(payload.state || 'idle', payload.message || statusTextMap[payload.state] || '待機中');
        return;
    }

    if (type === 'mode-info') {
        if (payload && payload.message) {
            setStatus(payload.isFallback ? 'idle' : 'starting', payload.resolved || '模式');
            setSystemMessage(payload.message);
        }
        return;
    }

    if (type === 'hypothesis') {
        if (payload.text && shouldTranscribe) {
            setStatus('listening', '正在聽取');
            setTranscript(payload.text, true);
        }
        return;
    }

    if (type === 'transcript') {
        if (payload.text) {
            setStatus('listening', '正在聽取');
            setTranscript(payload.text);
        }
        return;
    }

    if (type === 'error') {
        shouldTranscribe = false;
        textElement.style.opacity = '1';
        setStatus('error', '異常');
        setSystemMessage(errorMessages[payload.code] || payload.message || '本地語音辨識失敗');
        return;
    }

    if (type === 'helper-exit') {
        if (shouldTranscribe) {
            shouldTranscribe = false;
            textElement.style.opacity = '1';
            setStatus('error', '服務中止');
            setSystemMessage('語音服務已結束，請重啟網頁或按 Shift + F2 重試');
        }
    }
});

ipcRenderer.on('alt-state', (_event, isPressed) => {
    if (isPressed) {
        document.body.classList.add('alt-active');
        dragOverlay.classList.remove('hidden');
    } else {
        document.body.classList.remove('alt-active');
        dragOverlay.classList.add('hidden');
    }
});
