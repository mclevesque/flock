const { app, BrowserWindow, session, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

const FLOCK_URL = 'https://flock-two.vercel.app';
const isMac = process.platform === 'darwin';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'Flock',
    backgroundColor: '#0d0f14',

    // Remove the grey title bar — Discord-style
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? false : {
      color: '#0d0f14',       // matches Flock's dark background
      symbolColor: '#8890a4', // soft grey icons
      height: 36,
    },

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Required in Electron 32+ for setDisplayMediaRequestHandler to intercept
      // navigator.mediaDevices.getDisplayMedia() calls from loaded web pages
      exposeDisplayMediaRequestHandler: true,
    },
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
  });

  // Start maximized like Discord
  win.maximize();

  // Allow mic, camera, screen capture for Flock features
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'microphone', 'camera', 'display-capture'];
    callback(allowed.includes(permission));
  });

  // Custom screen-share picker — shows a window-chooser dialog (like Discord)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    // Gather all screens + windows with thumbnails
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });

    // Open the picker UI
    const picker = new BrowserWindow({
      width: 660,
      height: 520,
      title: 'Share your screen',
      parent: win,
      modal: true,
      resizable: false,
      backgroundColor: '#0d0f14',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'picker-preload.js'),
      },
      autoHideMenuBar: true,
    });

    picker.loadFile(path.join(__dirname, 'picker.html'));

    // Guard: callback must only be called once — Electron 32+ throws if called with
    // no video source, so we use null (= cancel) instead of {} and wrap in try/catch
    let callbackFired = false;
    function safeCallback(arg) {
      if (callbackFired) return;
      callbackFired = true;
      try { callback(arg); } catch { /* cancelled or already handled */ }
    }

    // Send sources once the picker page is ready
    picker.webContents.once('dom-ready', () => {
      picker.webContents.send('picker-sources', sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      })));
    });

    // User picked a source
    ipcMain.once('picker-source-selected', (event, { id, audio }) => {
      if (!picker.isDestroyed()) picker.destroy();
      const source = sources.find(s => s.id === id);
      if (source) {
        // Try with loopback audio (system audio on Windows), fall back to no audio
        try {
          safeCallback({ video: source, audio: audio ? 'loopback' : false });
        } catch {
          safeCallback({ video: source, audio: false });
        }
      } else {
        safeCallback(null); // source not found → cancel cleanly
      }
    });

    // User clicked Cancel in picker
    ipcMain.once('picker-cancelled', () => {
      if (!picker.isDestroyed()) picker.destroy();
      safeCallback(null); // null = reject in Electron 32+, no crash
    });

    // User closed the picker window via the X button
    picker.on('closed', () => {
      ipcMain.removeAllListeners('picker-source-selected');
      ipcMain.removeAllListeners('picker-cancelled');
      safeCallback(null); // null = reject cleanly
    });
  });

  win.loadURL(FLOCK_URL);

  // Push Flock's sticky navbar down so it doesn't sit behind the titlebar overlay
  // Also patch requestFullscreen for Electron (video fullscreen button workaround)
  win.webContents.on('dom-ready', () => {
    win.webContents.insertCSS(`
      /* On Windows the titleBarOverlay occupies the top 36px — push navbar down */
      header { margin-top: ${isMac ? 0 : 36}px !important; }
    `).catch(() => {});

    // Patch video element fullscreen for Electron — native <video controls> fullscreen
    // button calls requestFullscreen() which can silently fail in the overlay mode.
    // We intercept it and delegate to win.setFullScreen() via IPC instead.
    win.webContents.executeJavaScript(`
      (function() {
        if (!window.electronAPI) return;
        const orig = Element.prototype.requestFullscreen;
        Element.prototype.requestFullscreen = function(opts) {
          const el = this;
          const result = orig ? orig.call(el, opts) : Promise.reject(new Error('unsupported'));
          if (result && typeof result.catch === 'function') {
            result.catch(() => {
              // Native fullscreen failed — ask Electron to go OS-level fullscreen
              window.electronAPI.setFullScreen(true);
            });
          }
          return result || Promise.resolve();
        };
        // Escape key exits OS fullscreen
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && window.electronAPI) {
            window.electronAPI.setFullScreen(false);
          }
        }, true);
      })();
    `).catch(() => {});
  });

  // IPC: window controls
  ipcMain.on('win-minimize', () => win.minimize());
  ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('win-close', () => win.close());

  // IPC: fullscreen toggle (for video fullscreen workaround)
  ipcMain.on('win-setfullscreen', (event, flag) => {
    win.setFullScreen(!!flag);
  });

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(FLOCK_URL)) return { action: 'allow' };
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
