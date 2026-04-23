const { ipcRenderer } = require('electron');

const appInfo = ipcRenderer.sendSync('get-app-info');

document.getElementById('appVersion').innerText = `v${appInfo.version}`;
document.getElementById('appVersionValue').innerText = appInfo.version;
document.getElementById('electronVersion').innerText = appInfo.electronVersion;
document.getElementById('chromeVersion').innerText = appInfo.chromeVersion;
document.getElementById('nodeVersion').innerText = appInfo.nodeVersion;

// 關閉視窗功能
document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// 監聽 Alt 鍵狀態來啟用/停用拖動模式
ipcRenderer.on('alt-state', (event, active) => {
    if (active) {
        document.body.classList.add('alt-pressed');
    } else {
        document.body.classList.remove('alt-pressed');
    }
});
