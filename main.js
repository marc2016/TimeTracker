const electron = require('electron')
const app = electron.app
const protocol = electron.protocol

const log = require('electron-log');
const {autoUpdater} = require("electron-updater");

const splashScreen = require('@trodi/electron-splashscreen')
const electronLocalshortcut = require('electron-localshortcut');

const _ = require('lodash')

var userDataPath = app.getPath('userData')+'/userdata/'

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

let deeplinkingUrl
let tray = null
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
      transparent: true,
      icon: path.join(__dirname, 'icons/stopwatch.ico')
  }
};

app.setAsDefaultProtocolClient('tt')

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (process.platform == 'win32') {
      deeplinkingUrl = commandLine.slice(1)
    }

    log.info("External protocol call: "+deeplinkingUrl)

    var urlList = _.split(deeplinkingUrl,'/')
    log.info("urlList: "+urlList)
    if(_.includes(urlList,'newjob')){
      log.info('External URL "newJob" found.')
      var jobDescription = urlList[urlList.length-1]
      mainWindow.webContents.send('newJob', jobDescription)
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) myWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('open-url', function (event, url) {
    event.preventDefault()
    deeplinkingUrl = url
    log("open-url# " + deeplinkingUrl)
  })
  app.on('ready', function(){
    mainWindow = splashScreen.initSplashScreen(splashscreenConfig);
    mainWindow.setMenu(null);
    
    mainWindow.on('closed', function () {
      mainWindow = null
    })
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    }))
  
    electronLocalshortcut.register(mainWindow, 'F12', () => {mainWindow.webContents.toggleDevTools()});  
  })
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  app.on('activate', function () {
    if (mainWindow === null) {
      createWindow()
      
    }
  })
  app.on('ready', () => {
    protocol.registerFileProtocol('tt', (request, callback) => {
      const url = request.url.substr(7)
    }, (error) => {
      if (error) console.error('Failed to register protocol')
    })
    
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
  
    global.autoUpdater = autoUpdater
  
    global.vars = {
      
    }
  })
}

function createWindow() {
  
  log.info("Create window.")

  mainWindow = new BrowserWindow({
    width: 680,
    height: 820,
    minWidth: 480,
    minHeight: 450,
    icon: path.join(__dirname, 'icons/stopwatch.ico')
  })

  if (process.platform == 'win32') {
    deeplinkingUrl = process.argv.slice(1)
  }
  log.info("External protocol call: "+deeplinkingUrl)

}
