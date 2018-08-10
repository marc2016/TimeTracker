// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
//require('jquery')
const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');

var ko = require('knockout');
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var projectssettings = require('./js/projectssettings.js')
var jobtable = require('./js/jobtable.js')
var timerlist = require('./js/timerlist.js')

var jobtimer = require('./js/jobtimer.js')
var footer = require('./js/footer.js')

var timerlist = require('./js/timerlist.js')

var Datastore = require('nedb')
// var db = new Datastore({ filename: 'db', autoload: true });
// var db_projects = remote.getGlobal('db_projects');

var monthChart = undefined;

onload = function() {
  ko.applyBindings(footer, document.getElementById('footerContainer'))

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

  var btnJobTable = document.getElementById('btnJobTable')
  btnJobTable.addEventListener("click", openJobTable )
  
  var btnJobTimer = document.getElementById('btnJobTimer')
  btnJobTimer.addEventListener("click", openJobTimer )
  
  

  openJobTimer()
};

function openJobTimer(){
  
  
    $('#mainContent').show()
    $('#mainContent').load('pages/timerlist.html', function(){
      timerlist.onLoad()
    })
    $('#navJobTimer').addClass("selected");
  
  
}

function openJobTable(){
  if($('#mainContent').is(":visible")) {
    $('#list').show()
    $('#mainContent').hide()
    $('#navJobTable').removeClass("selected");
    currentDateChanged()
  } else {
    $('#list').hide()
    $('#mainContent').show()
    $('#mainContent').load('pages/jobtable.html', function(){
      jobtable.onLoad()
    })
    $('#navJobTable').addClass("selected");
  }
}

function openProjectsSettings(){
  if($('#mainContent').is(":visible")) {
    $('#list').show()
    $('#mainContent').hide()
    $('#navProjectsSettings').removeClass("selected");
    currentDateChanged()
  } else {
    $('#list').hide()
    $('#mainContent').show()
    $('#mainContent').load('pages/projectssettings.html', function(){
      projectssettings.onLoad()
    })
    $('#navProjectsSettings').addClass("selected");
  }
}


function calculate(timestamp) {
        var diff = timestamp - this.time;
        // Hundredths of a second are 100 ms
        this.times[2] += diff / 10;
        // Seconds are 100 hundredths of a second
        if (this.times[2] >= 100) {
            this.times[1] += 1;
            this.times[2] -= 100;
        }
        // Minutes are 60 seconds
        if (this.times[1] >= 60) {
            this.times[0] += 1;
            this.times[1] -= 60;
        }
    }
