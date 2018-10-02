const electron = require('electron')
const app = electron.app

const log = require('electron-log');
const {autoUpdater} = require("electron-updater");

const splashScreen = require('@trodi/electron-splashscreen')

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

const {
  Menu,
  Tray
} = require('electron')

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

const mainOpts = {
  width: 680,
  height: 820,
  minWidth: 480,
  minHeight: 450,
  icon: path.join(__dirname, 'icons/stopwatch.ico'),
  show: false
}

// configure the splashscreen
const splashscreenConfig = {
  windowOpts: mainOpts,
  templateUrl: path.join(__dirname,"pages/splashscreen.html"),
  minVisible: 5000,
  splashScreenOpts: {
      width: 500,
      height: 500,
      transparent: true
  }
};

var shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (shouldQuit) {
  app.quit();
  return;
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 680,
    height: 820,
    minWidth: 480,
    minHeight: 450,
    icon: path.join(__dirname, 'icons/stopwatch.ico')
  })

  
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
  //createWindow()
  mainWindow = splashScreen.initSplashScreen(splashscreenConfig);
  mainWindow.setMenu(null);
  mainWindow.webContents.openDevTools()
  mainWindow.on('closed', function () {
    mainWindow = null
  })
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  autoUpdater.checkForUpdatesAndNotify();
})



// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
    
  }
})

let tray = null
app.on('ready', () => {
  
  tray = new Tray(path.join(__dirname, 'icons/stopwatch.ico'))
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
  mainWindow.on('show', () => {
    tray.setHighlightMode('always')
  })
  mainWindow.on('hide', () => {
    tray.setHighlightMode('never')
  })
  tray.setToolTip('TimeTracker')

  global.tray = tray

  global.menu = Menu

  global.vars = {}
})
