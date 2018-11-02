const remote = require('electron').remote;
const app = remote.app;
var vars = remote.getGlobal('vars');
var log = require('electron-log');
const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
const { auditTime } = require('rxjs/operators');

var pjson = require('./package.json')

var format = require("string-template")

var Client = require('node-rest-client').Client;

const Store = require('electron-store');
const store = new Store();

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
this.jobtypeSettingsViewModel = undefined
this.timerlistViewModel = undefined

const WindowsToaster = require('node-notifier').WindowsToaster;
var windowsToaster = new WindowsToaster({
  withFallback: false,
  customPath: void 0 ,
  appID: "TimeTracker"
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
    this.updateAvailable(true)
  })
  autoUpdater.on('update-not-available', () => {
    this.updateAvailable(false)
  })
  autoUpdater.on('download-downloaded', (ev, progressObj) => {
    this.updateAvailable('ready')
  })
  this.downloadProgress = ko.observable()
  autoUpdater.on('download-progress', (ev, progressObj) => {
    this.downloadProgress(progressObj.percent)
  })

  this.login = login
  this.loginClick = loginClick
  this.syncProjects = syncProjects
  this.syncJobtypes = syncJobtypes
  this.checkForUpdatesClick = checkForUpdatesClick
  this.closeApp = closeApp

  jobtimer.timeSignal.pipe(auditTime(store.get('timerNotificationsInterval')*1000, 10*1000*60)).subscribe(timerUpdateNotifier)
  
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
  this.timerlistViewModel = new TimerList(['timerlistMainContent','modalAddNote','modalChangeJobDuration','modalDelete'], jobtimer)

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

  ko.applyBindings(this, document.getElementById('mainNavbar'))
  ko.applyBindings(this, document.getElementById('modalLogin'))
  ko.applyBindings(this, document.getElementById('modalAbout'))

  if(store.get('syncAutoLogin') && store.get('syncPassword')){
    login()
  }
  this.currentViewModel = this.timerlistViewModel
  openTimerList()
};

function closeApp(){
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

  var iconPath = path.join(__dirname, "../icons/logonotification.png")
  var jobDescription = updateValue.jobDescription
  if(!jobDescription){
    jobDescription = "Unbenannte Aufgabe"
  }
    
  windowsToaster.notify({
      title: "Aufgabe läuft...",
      message: "Aufgabe: "+_.truncate(jobDescription,{'length': 25})+"\nDauer: "+utils.getTimeString(updateValue.duration),
      icon: iconPath,
      sound: true, 
      wait: false,
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
  changeView(undefined)
  $('#mainContent').show()
  $('#mainContent').load('pages/jobtable.html', function(){
    jobtable.viewId = 'jobtableMainContent'
    jobtable.onLoad()
  }.bind(this))
  $('#navJobTable').addClass("selected")
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
  login()
}

function login(){
  this.cookie = undefined
  var client = new Client();
  var loginUrl = store.get('syncLoginUrl')
  var syncLoginParameterUser = store.get('syncLoginParameterUser', "accountName")
  var syncLoginParameterPassword = store.get('syncLoginParameterPassword', "passwort")
  
  var user = store.get('syncUsername')
  var password = this.syncPassword()

  loginParameter = syncLoginParameterUser+"="+user+"&"+syncLoginParameterPassword+"="+password

  var url = loginUrl+"?"+loginParameter

  client.get(url, function (data, response) {
      if(data.status == 500){
        toastr.error('Anmeldung fehlgeschlagen. Bitte Daten prüfen.')  
        return
      }
      this.accountName(data.vorname+" "+data.name)
      this.userEmail(data.email)
      this.cookie = response.headers['set-cookie'][0].split(';')[0]
      vars.authCookie = this.cookie
      toastr.success('Anmeldung erfolgreich als '+this.accountName()+'.')
  });
}

function checkLogin(){
  if(!this.cookie){
    toastr.error('Sie sind nicht am externen System angemeldet.')
    return false;
  }
  return true;
}

function syncJobtypes(){
  if(!checkLogin()){
    return
  }
  var client = new Client();
  var syncJobtypeUrl = store.get('syncJobtypeUrl')

  var args = {
    headers: { "Cookie" : this.cookie }
  }

  client.get(syncJobtypeUrl,args, function (data, response) {
    if(data.status == 500){
      toastr.error('Aufgaben Arten wurden nicht synchronisiert.')
      return
    }
    var countOfUpdates = 0;
    _.forEach(data, function(element) {
      dataAccess.getDb('jobtypes').update({ externalId: element.id }, { externalId: element.id, name:element.beschreibung, active: true }, { upsert: true }, function (err, numReplaced, upsert) {
        countOfUpdates += numReplaced
      });
      dataAccess.getDb('jobtypes').persistence.compactDatafile()
    })
    
    toastr.success('Aufgaben Arten wurden synchronisiert.')
      
  });

}

function syncProjects(){

  if(!checkLogin()){
    return
  }

  var now = new moment();
  var month = now.format('MM');
  var year = now.format('YYYY');

  var client = new Client();
  var syncProjectUrl = store.get('syncProjectUrl')
  var syncProjectParameterMonth = store.get('syncProjectParameterMonth', "month")
  var syncProjectParameterYear = store.get('syncProjectParameterYear', "year")

  var syncProjectParameter = syncProjectParameterMonth+"="+month+"&"+syncProjectParameterYear+"="+year

  var args = {
    headers: { "Cookie" : this.cookie }
  }

  var url = syncProjectUrl+"?"+syncProjectParameter
  log.info("Project sync URL: "+url)

  client.get(url,args, function (data, response) {
    if(data.status == 500){
      toastr.error('Projekte wurden nicht synchronisiert.')
      return
    }
    var countOfUpdates = 0;
    _.forEach(data, function(element) {
      dataAccess.getDb('projects').update({ externalId: element.value }, { externalId: element.value, name:element.representation, active: true }, { upsert: true }, function (err, numReplaced, upsert) {
        countOfUpdates += numReplaced
      });
      dataAccess.getDb('projects').persistence.compactDatafile()
    })
    
    toastr.success('Projekte wurden synchronisiert.')
      
  });
}