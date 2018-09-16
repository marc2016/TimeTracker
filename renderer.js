const remote = require('electron').remote;
const app = remote.app;
var log = require('electron-log');
const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');

var ko = require('knockout');
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var userDataPath = app.getPath('userData')+'/userdata/'

var ProjectsSettings = require('./js/projectssettings.js')
var JobtypeSettings = require('./js/jobtypesettings.js')
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

onload = function() {
  log.info("Test")
  $('#modals').load("pages/modals.html")
  $('#mainContent').hide()
  // var tray = remote.getGlobal('tray');
  // tray.setContextMenu(trayContextMenu)

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
  
  projectsSettingViewModel = new ProjectsSettings(['projectssettingsMainContent','modalAddNewProject'],dbProjects)
  jobtypeSettingsViewModel = new JobtypeSettings(['jobtypeSettingsMainContent','modalAddNewJobtype'], dbJobtypes)

  openTimerList()
};

function openTimerList(){
    $('#mainContent').show()
    $('#mainContent').load('pages/timerlist.html', function(){
      timerlist.viewId = 'timerlistMainContent'
      timerlist.onLoad(dbJobs,dbProjects)
    })
    $('#navJobTimer').addClass("selected");
}

function openJobTable(){
  $('#mainContent').show()
  $('#mainContent').load('pages/jobtable.html', function(){
    jobtable.viewId = 'jobtableMainContent'
    jobtable.onLoad(dbJobs)
  })
  $('#navJobTable').addClass("selected")
}

function openProjectsSettings(){
  $('#mainContent').show()
  $('#mainContent').load('pages/projectssettings.html', function(){
    projectsSettingViewModel.onLoad()
  })
  $('#navProjectsSettings').addClass("selected");
}

function openJobtypeSettings(){
  $('#mainContent').show()
  $('#mainContent').load('pages/jobtypesettings.html', function(){
    jobtypeSettingsViewModel.onLoad()
  })
  $('#navProjectsSettings').addClass("selected");
}

