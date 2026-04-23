// Preload script if needed for secure communication
// Currently we are using nodeIntegration for simplicity as requested by the task
// but we can add specific APIs here later.
window.electron = require('electron');
