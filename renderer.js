const remote = require('electron').remote;
const app = remote.app;
var log = require('electron-log');
const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
const { auditTime } = require('rxjs/operators');

var format = require("string-template")

var Client = require('node-rest-client').Client;

const Store = require('electron-store');
const store = new Store();

var gravatar = require('gravatar');

var utils = require('./js/utils.js')
var ko = require('knockout');
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var userDataPath = app.getPath('userData')+'/userdata/'

var ProjectsSettings = require('./js/projectssettings.js')
var JobtypeSettings = require('./js/jobtypesettings.js')
var AppSettings = require('./js/appsettings.js')
var jobtable = require('./js/jobtable.js')
var timerlist = require('./js/timerlist.js')

var jobtimer = require('./js/jobtimer.js')
var footer = require('./js/footer.js')

var timerlist = require('./js/timerlist.js')

var Datastore = require('nedb')
var dbJobs = new Datastore({ filename: userDataPath+'/jobs.db', autoload: true });
var dbProjects = new Datastore({ filename: userDataPath+'/projects.db', autoload: true });
var dbJobtypes = new Datastore({ filename: userDataPath+'/jobtypes.db', autoload: true });

var projectsSettingViewModel = undefined
var appSettingsViewModel = undefined
var jobtypeSettingsViewModel = undefined

const WindowsToaster = require('node-notifier').WindowsToaster;
var windowsToaster = new WindowsToaster({
  withFallback: false,
  customPath: void 0 
});

onload = function() {
  log.info("App started...")

  this.avatar =  ko.computed(function() {
    return gravatar.url(store.get('userEmail'), {protocol: 'http', s: '30', d: 'retro'});
  }, this);
  this.accountName = ko.observable('nicht angemeldet')

  this.login = login
  this.syncProjects = syncProjects

  ko.applyBindings(this, document.getElementById('mainNavbar'))

  jobtimer.timeSignal.pipe(auditTime(store.get('timerNotificationsInterval')*1000)).subscribe(timerUpdateNotifier)
  
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
  btnProjectsSettings.addEventListener("click", openProjectsSettings )

  var btnJobtypeSettings = document.getElementById('btnJobtypeSettings')
  btnJobtypeSettings.addEventListener("click", openJobtypeSettings )

  var btnJobTable = document.getElementById('btnJobTable')
  btnJobTable.addEventListener("click", openJobTable )
  
  var btnJobTimer = document.getElementById('btnJobTimer')
  btnJobTimer.addEventListener("click", openTimerList )

  var btnAppSettings = document.getElementById('btnAppSettings')
  btnAppSettings.addEventListener("click", openAppSettings )

  projectsSettingViewModel = new ProjectsSettings(['projectssettingsMainContent','modalAddNewProject'],dbProjects)
  jobtypeSettingsViewModel = new JobtypeSettings(['jobtypeSettingsMainContent','modalAddNewJobtype'], dbJobtypes)
  appSettingsViewModel = new AppSettings(['appsettingsMainContent'], store)

  openTimerList()
};

function timerUpdateNotifier(updateValue){
  windowsToaster.notify({
      title: "Aufgabe läuft...",
      message: "Dauer: "+utils.getTimeString(updateValue.duration),
      icon: "./icons/logo.png",
      sound: true, // true | false. 
      wait: false, // Wait for User Action against Notification 
  }, function(error, response) {
      console.log(response);
  });
}

function openTimerList(){
  $('#mainContent').show()
  appSettingsViewModel.hide()
    $('#mainContent').load('pages/timerlist.html', function(){
      timerlist.viewId = 'timerlistMainContent'
      timerlist.onLoad(dbJobs,dbProjects,jobtimer)
    })
    $('#navJobTimer').addClass("selected");
}

function openJobTable(){
  $('#mainContent').show()
  appSettingsViewModel.hide()
  $('#mainContent').load('pages/jobtable.html', function(){
    jobtable.viewId = 'jobtableMainContent'
    jobtable.onLoad(dbJobs)
  })
  $('#navJobTable').addClass("selected")
}

function openAppSettings(){
    $('#mainContent').hide()
    appSettingsViewModel.show()
    appSettingsViewModel.onLoad()
}

function openProjectsSettings(){
  appSettingsViewModel.hide()
  $('#mainContent').show()
  $('#mainContent').load('pages/projectssettings.html', function(){
    projectsSettingViewModel.onLoad()
  })
  $('#navProjectsSettings').addClass("selected");
}

function openJobtypeSettings(){
  appSettingsViewModel.hide()
  $('#mainContent').show()
  $('#mainContent').load('pages/jobtypesettings.html', function(){
    jobtypeSettingsViewModel.onLoad()
  })
  $('#navProjectsSettings').addClass("selected");
}

function changeView(newViewModel){
  currentViewModel.hide()
  newViewModel.show()
  currentViewModel = newViewModel
}

function login(){
  var client = new Client();
  var loginUrl = store.get('syncLoginUrl')
  var loginParameter = store.get('syncLoginParameter')
  var user = store.get('syncUsername')
  var password = store.get('syncPassword')

  loginParameter = format(loginParameter, [user, password])

  client.get(loginUrl+"?"+loginParameter, function (data, response) {
      this.accountName(data.vorname+" "+data.name)
      this.cookie = response.headers['set-cookie'][0].split(';')[0]
  });
}

function syncProjects(){
  var now = new moment();
  var month = now.format('MM');
  var year = now.format('YYYY');

  var client = new Client();
  var syncProjectUrl = store.get('syncProjectUrl')
  var syncProjectParameter = store.get('syncProjectParameter')

  syncProjectParameter = format(syncProjectParameter, [month, year])

  var args = {
    headers: { "Cookie" : this.cookie }
  }

  client.get(syncProjectUrl+"?"+syncProjectParameter,args, function (data, response) {
      console.log(data);
      _.forEach(data, function(element) {
        dbProjects.update({ externalId: element.value }, { externalId: element.value, name:element.representation, active: true }, { upsert: true }, function (err, numReplaced, upsert) {
          
        });
      })
      
  });
}