const {
    app,
    BrowserWindow,
    Tray,
    Menu,
    globalShortcut,
    ipcMain,
    nativeImage,
    session,
    screen
} = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const http = require('http');
const Store = require('electron-store');

let uIOhook;
let UiohookKey;

try {
    const uio = require('uiohook-napi');
    uIOhook = uio.uIOhook;
    UiohookKey = uio.UiohookKey;
} catch (error) {
    console.error('Failed to load uiohook-napi. Global Alt detection will be disabled.', error);
}

const store = new Store();

let mainWindow = null;
let settingsWindow = null;
let aboutWindow = null;
let tray = null;
let activePort = 5999;
let isTranscribing = false;
let isMoveMode = false;
let isAltPressed = false;

const defaultSettings = {
    fontSize: 32,
    fontColor: '#f3f7ff',
    bgColor: 'rgba(6, 14, 32, 0.72)',
    fontFamily: 'Microsoft JhengHei',
    position: { x: 100, y: 48 }
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
}

app.on('second-instance', () => {
    if (!mainWindow) {
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
});

function getSettings() {
    return { ...defaultSettings, ...store.get('settings', {}) };
}

function getTrayIcon() {
    const iconPath = path.join(__dirname, 'pic', 'logo.png');
    return nativeImage.createFromPath(iconPath);
}

function notifyMoveMode() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const active = isMoveMode || isAltPressed;
    mainWindow.setIgnoreMouseEvents(!active, { forward: !active });
    mainWindow.webContents.send('alt-state', active);

    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('alt-state', active);
    }
}

function syncTranscriptionState() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('toggle-transcription', isTranscribing);
}

function sendSpeechEvent(type, payload = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('speech-event', { type, payload });
}


// 啟動 API 伺服器並嘗試不同 Port (80 -> 443 -> 5999)
function startApiServer(ports = [80, 443, 5999]) {
    if (ports.length === 0) {
        console.error('[ERROR] No available ports for API server.');
        return;
    }

    const port = ports[0];
    const server = http.createServer((req, res) => {
        // 設定所有回應的 CORS 標頭
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // 路由：GET /voice - 提供辨識網頁
        if (req.method === 'GET' && (req.url === '/voice' || req.url.startsWith('/voice?'))) {
            const filePath = path.join(__dirname, 'voice.html');
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading voice.html');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                }
            });
            return;
        }

        // 路由：POST /subtitle - 接收辨識文字
        if (req.method === 'POST' && req.url === '/subtitle') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.text && mainWindow && isTranscribing) {
                        sendSpeechEvent('transcript', { text: data.text });
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } catch (e) {
                    res.writeHead(400); res.end();
                }
            });
            return;
        }

        // 404 其他路徑
        res.writeHead(404);
        res.end();
    });

    server.on('error', (err) => {
        console.log(`[DEBUG] Port ${port} failed: ${err.code}`);
        server.close();
        if (ports.length > 1) {
            startApiServer(ports.slice(1));
        } else {
            console.error('[ERROR] All fallback ports failed.');
        }
    });

    try {
        server.listen(port, '127.0.0.1', () => {
            activePort = port;
            console.log(`[INFO] API Server running at http://127.0.0.1:${port}`);
            openVoicePage(port);
        });
    } catch (e) {
        console.error(`[ERROR] Unexpected error while starting server on port ${port}:`, e);
    }
}

// 開啟外部語音辨識網頁
function openVoicePage(port) {
    const url = `http://127.0.0.1:${port}/voice?port=${port}`;
    
    // 優先嘗試 Chrome
    exec(`start chrome "${url}"`, (err) => {
        if (err) {
            console.log('[INFO] Chrome 啟動失敗或未安裝，嘗試使用 Edge...');
            // 如果 Chrome 失敗，則嘗試 Edge
            exec(`start msedge "${url}"`, (edgeErr) => {
                if (edgeErr) {
                    console.error('[ERROR] 無法開啟任何支援的瀏覽器。');
                }
            });
        }
    });
}

function createMainWindow() {
    const settings = getSettings();
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const winWidth = Math.round(width * 0.8);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: 280, // 稍微增加高度以容納兩行大字
        x: settings.position.x,
        y: settings.position.y,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('subtitle.html');
    notifyMoveMode();

    mainWindow.on('move', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        const [x, y] = mainWindow.getPosition();
        store.set('settings.position', { x, y });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('settings-updated', getSettings());
        syncTranscriptionState();
        notifyMoveMode();
    });
}

function createChildWindow({ width, height, title, file }) {
    return new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        title,
        backgroundColor: '#090d18',
        autoHideMenuBar: true,
        resizable: false,
        frame: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    const { height } = screen.getPrimaryDisplay().workAreaSize;
    const winHeight = Math.round(height * 0.85);

    settingsWindow = createChildWindow({
        width: 620, // 稍微加寬讓比例更好看
        height: winHeight,
        title: '字幕設定',
        file: 'settings.html'
    });

    settingsWindow.loadFile('settings.html');
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    const { height } = screen.getPrimaryDisplay().workAreaSize;
    const winHeight = Math.round(height * 0.85);

    aboutWindow = createChildWindow({
        width: 620, // 跟設定視窗一樣寬
        height: winHeight,
        title: '關於',
        file: 'about.html'
    });

    aboutWindow.loadFile('about.html');
    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}

function getAppInfo() {
    return {
        name: app.getName(),
        version: app.getVersion(),
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node
    };
}

async function toggleTranscription(nextState) {
    const shouldStart = typeof nextState === 'boolean' ? nextState : !isTranscribing;
    isTranscribing = shouldStart;

    syncTranscriptionState();
    updateTray();
}

function updateTray() {
    if (!tray) {
        return;
    }

    const moveModeActive = isMoveMode || isAltPressed;
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `啟動 / 關閉 (${isTranscribing ? '正在運行' : '已停止'})`,
            click: () => toggleTranscription()
        },
        { type: 'separator' },
        {
            label: '手動切換移動模式',
            type: 'checkbox',
            checked: moveModeActive,
            click: (item) => {
                isMoveMode = item.checked;
                notifyMoveMode();
                updateTray();
            }
        },
        { label: '字幕調整', click: createSettingsWindow },
        { label: '關於 (About)', click: createAboutWindow },
        { type: 'separator' },
        { label: '離開 (Exit)', click: () => app.quit() }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(`桌面字幕 - ${isTranscribing ? '運行中' : '停止'}`);
}

function setupTray() {
    tray = new Tray(getTrayIcon());
    tray.on('double-click', () => toggleTranscription());
    updateTray();
}

function setupHooks() {
    if (!uIOhook) {
        console.warn('[INFO] Skipping uIOhook setup (not loaded).');
        return;
    }

    try {
        uIOhook.on('keydown', (event) => {
            if (event.keycode === UiohookKey.Alt || event.keycode === UiohookKey.AltRight) {
                isAltPressed = true;
                notifyMoveMode();
                updateTray();
            }
        });

        uIOhook.on('keyup', (event) => {
            if (event.keycode === UiohookKey.Alt || event.keycode === UiohookKey.AltRight) {
                isAltPressed = false;
                notifyMoveMode();
                updateTray();
            }
        });

        uIOhook.start();
        console.log('[INFO] uIOhook started successfully.');
    } catch (e) {
        console.error('[ERROR] Failed to start uIOhook:', e);
    }
}

function setupPermissions() {
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(permission === 'media');
    });
}

app.commandLine.appendSwitch('enable-speech-input');

app.whenReady().then(() => {
    setupPermissions();
    createMainWindow();
    setupTray();
    setupHooks();
    startApiServer();

    const shortcutRegistered = globalShortcut.register('Shift+F2', () => {
        toggleTranscription().catch((error) => {
            console.error('Failed to toggle transcription.', error);
        });
    });

    if (!shortcutRegistered) {
        console.error('Failed to register global shortcut: Shift+F2');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();

    if (uIOhook) {
        try {
            uIOhook.stop();
        } catch (error) {
            console.error('Failed to stop uiohook.', error);
        }
    }
});

ipcMain.on('get-settings', (event) => {
    event.returnValue = getSettings();
});

ipcMain.on('save-settings', (_event, newSettings) => {
    const settings = { ...getSettings(), ...newSettings };
    store.set('settings', settings);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('settings-updated', settings);
    }
});

ipcMain.on('get-app-info', (event) => {
    event.returnValue = getAppInfo();
});

ipcMain.on('quit-app', () => {
    app.quit();
});

ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.close();
    }
});
