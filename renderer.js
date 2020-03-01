const electron = require('electron')
const remote = require('electron').remote;
const app = remote.app;
var vars = remote.getGlobal('vars')
var log = require('electron-log')

var $ = require("jquery");
require( 'jquery-ui')

require( 'datatables.net' )( window, $ );
require( 'datatables.net-bs4' )( window, $ );
require( './libs/dataTables.cellEdit')

const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
const { auditTime } = require('rxjs/operators');

var pjson = require('./package.json')

var format = require("string-template")

const Store = require('electron-store');
const store = new Store();
var sync = require('./js/sync.js')
sync.baseUrl = store.get('syncRestBaseUrl')

const path = require('path')

var autoUpdater = remote.getGlobal("autoUpdater")

var gravatar = require('gravatar');

var dataAccess = require('./js/dataaccess.js')
var utils = require('./js/utils.js')
var ko = require('knockout');
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var userDataPath = app.getPath('userData')+'/userdata/'
var toastr = require('toastr');
toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-bottom-right",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

var ProjectsSettings = require('./js/projectssettings.js')
var JobtypeSettings = require('./js/jobtypesettings.js')
var AppSettings = require('./js/appsettings.js')
var jobtable = require('./js/jobtable.js')
var TimerList = require('./js/timerlist.js')

var jobtimer = require('./js/jobtimer.js')
var footer = require('./js/footer.js')

this.projectsSettingViewModel = undefined
this.appSettingsViewModel = undefined
this.jobtableViewModel = undefined
this.jobtypeSettingsViewModel = undefined
this.timerlistViewModel = undefined

const WindowsToaster = require('node-notifier').WindowsToaster;
var windowsToaster = new WindowsToaster({
  withFallback: false,
  customPath: void 0 ,
  appID: "TimeTracker",
  wait: true
});
windowsToaster.on('click', function (notifierObject, options) {
  var window = require('electron').remote.getCurrentWindow()
    window.show()
    window.focus()
});

onload = function() {
  log.info("App started.")

  
  this.userEmail = ko.observable()
  this.avatar =  ko.computed(function() {
    return gravatar.url(this.userEmail(), {protocol: 'http', s: '25', d: 'retro'});
  }, this);
  this.accountName = ko.observable('nicht angemeldet')
  this.appVersion = ko.computed(function() {
    return ' '+pjson.version
  }, this);

  this.updateAvailable = ko.observable(false)
  autoUpdater.on('update-available', () => {
    log.info("Update is available.")
    this.updateAvailable(true)
  })
  autoUpdater.on('update-not-available', () => {
    log.info("Update is not available.")
    this.updateAvailable(false)
  })
  autoUpdater.on('update-downloaded', (ev, progressObj) => {
    log.info("Update is downloaded.")
    this.updateAvailable('ready')
  })
  this.downloadProgress = ko.observable()
  autoUpdater.on('download-progress', (info) => {
    if(info)
      this.downloadProgress(_.round(info.percent))
  })

  this.loginClick = loginClick
  this.syncLogin = syncLogin
  this.syncProjects = syncProjects
  this.syncJobtypes = syncJobTypes
  this.saveSyncRestUrl = saveSyncRestUrl
  this.checkForUpdatesClick = checkForUpdatesClick
  this.closeApp = closeApp
  this.openTimerList = openTimerList
  this.closeWindow = closeWindow
  this.minimizeWindow = minimizeWindow
  this.maximizeWindow = maximizeWindow

  jobtimer.timeSignal.pipe(auditTime(store.get('timerNotificationsInterval'), 600000)).subscribe(timerUpdateNotifier)
  
  $('#modals').load("pages/modals.html")
  
  Number.prototype.toHHMMSS = function () {
      var sec_num = parseInt(this, 10); // don't forget the second param
      var hours   = Math.floor(sec_num / 3600);
      var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
      var seconds = sec_num - (hours * 3600) - (minutes * 60);

      if (hours   < 10) {hours   = "0"+hours;}
      if (minutes < 10) {minutes = "0"+minutes;}
      if (seconds < 10) {seconds = "0"+seconds;}
      return hours+':'+minutes+':'+seconds;
  }

  var btnProjectsSettings = document.getElementById('btnProjectsSettings')
  btnProjectsSettings.addEventListener("click", openProjectsSettings.bind(this) )

  var btnJobtypeSettings = document.getElementById('btnJobtypeSettings')
  btnJobtypeSettings.addEventListener("click", openJobtypeSettings.bind(this))

  var btnJobTable = document.getElementById('btnJobTable')
  btnJobTable.addEventListener("click", openJobTable.bind(this) )
  
  var btnJobTimer = document.getElementById('btnJobTimer')
  btnJobTimer.addEventListener("click", openTimerList.bind(this) )

  var btnAppSettings = document.getElementById('btnAppSettings')
  btnAppSettings.addEventListener("click", openAppSettings.bind(this) )

  this.projectsSettingViewModel = new ProjectsSettings(['projectssettingsMainContent','modalAddNewProject'])
  this.jobtypeSettingsViewModel = new JobtypeSettings(['jobtypeSettingsMainContent','modalAddNewJobtype'])
  this.appSettingsViewModel = new AppSettings(['appsettingsMainContent'], store)
  this.timerlistViewModel = new TimerList(['timerlistMainContent','modalAddNote','modalChangeJobDuration','modalDeleteEntry','modalUploadEntryAgain'], jobtimer)
  this.jobtableViewModel = new jobtable(['jobtableMainContent', 'modalDelete'])

  this.pagemenu = ko.observableArray()
  this.menuClick = menuClick

  this.syncUsername = ko.pureComputed({
      read: function () {
          return store.get('syncUsername');
      },
      write: function (value) {
          store.set('syncUsername', value)
      },
      owner: this
  });

  this.syncPassword = ko.observable(store.get('syncPassword'))

  this.syncSaveLogin = ko.pureComputed({
      read: function () {
          return store.get('syncSaveLogin');
      },
      write: function (value) {
          store.set('syncSaveLogin', value)
      },
      owner: this
  });
  this.syncAutoLogin = ko.pureComputed({
    read: function () {
        return store.get('syncAutoLogin');
    },
    write: function (value) {
        store.set('syncAutoLogin', value)
    },
    owner: this
  });

  this.syncRestUrl = ko.observable()

  ko.applyBindings(this, document.getElementById('mainNavbar'))
  ko.applyBindings(this, document.getElementById('modalLogin'))
  ko.applyBindings(this, document.getElementById('modalAbout'))
  ko.applyBindings(this, document.getElementById('modalSetRestUrl'))

  if(store.get('syncAutoLogin') && store.get('syncPassword')){
    loginClick()
  }
  
  openTimerList()
};

function syncLogin(){
  var syncRestUrl = store.get('syncRestBaseUrl')
  if(!syncRestUrl){
    $('#modalSetRestUrl').modal('show')
  } else {
    $('#modalLogin').modal('show')
  }
}

function saveSyncRestUrl(that){
  store.set('syncRestBaseUrl',that.syncRestUrl())
  sync.baseUrl = that.syncRestUrl()
  $('#modalSetRestUrl').modal('hide')
  $('#modalLogin').modal('show')
}

function closeWindow(){
  const window = remote.getCurrentWindow();
  window.close();
}

function minimizeWindow(){
  const window = remote.getCurrentWindow();
  window.minimize();
}

function maximizeWindow(){
  const window = remote.getCurrentWindow();
  window.maximize();
}

async function closeApp(){
  log.info("App is closed for Update.")
  autoUpdater.quitAndInstall()
}

function checkForUpdatesClick(){
  this.updateAvailable('checking')
  this.downloadProgress(0)
  autoUpdater.checkForUpdates();
}

function timerUpdateNotifier(updateValue){
  var enabled = store.get('timerNotificationsEnabled', false)
  if(!enabled){
    return
  }

  var iconPath = path.join(__dirname, "icons/logonotification.png")
  var jobDescription = updateValue.jobDescription
  if(!jobDescription){
    jobDescription = "Unbenannte Aufgabe"
  }
    
  windowsToaster.notify({
      title: "Aufgabe läuft...",
      message: "Aufgabe: "+_.truncate(jobDescription,{'length': 25})+"\nDauer: "+utils.getTimeString(updateValue.duration),
      icon: iconPath,
      sound: true, 
      wait: true,
      appID: "TimeTracker"
  }, function(error, response) {
      console.log(response);
  });
}

function menuClick(that,data){
  that.method()
}

function openTimerList(){
  changeView(this.timerlistViewModel)
}

function openJobTable(){
  changeView(this.jobtableViewModel)
}

function openAppSettings(){
  changeView(this.appSettingsViewModel)
}

function openProjectsSettings(){
  changeView(undefined)
  $('#mainContent').show()
  $('#mainContent').load('pages/projectssettings.html', function(){
    this.projectsSettingViewModel.onLoad()
  }.bind(this))
  $('#navProjectsSettings').addClass("selected");
}

function openJobtypeSettings(){
  changeView(undefined)
  $('#mainContent').show()
  $('#mainContent').load('pages/jobtypesettings.html', function(){
    this.jobtypeSettingsViewModel.onLoad()
  }.bind(this))
  $('#navProjectsSettings').addClass("selected");
}

function changeView(newViewModel){
  if(this.currentViewModel && this.currentViewModel == newViewModel)
    return;
  $('#mainContent').hide()
  if(this.currentViewModel)
    this.currentViewModel.hide()
  pagemenu.removeAll()
  if(newViewModel){
    newViewModel.show()
    if(newViewModel.getMenu)
      ko.utils.arrayPushAll(pagemenu, newViewModel.getMenu())
  }
  this.currentViewModel = newViewModel
}

function loginClick(){
  if(this.syncSaveLogin()){
    store.set('syncPassword', this.syncPassword())
  } else {
    store.delete('syncPassword')
  }
  sync.login(this.syncPassword(),this.accountName, this.userEmail)
}

async function syncProjects(){
  try {
    await sync.syncProjects()
  } catch(error){
    toastr.error("Beim Synchronisieren der Projekte ist ein Fehler aufgetreten.")
  }
  
}

async function syncJobTypes(){
  try{
    await sync.syncJobtypes()
  } catch(error){
    toastr.error("Beim Synchronisieren der Aufgabenarten ist ein Fehler aufgetreten.")
  }
}

