// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
//require('jquery')
const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
var jobtimer = require('./js/jobtimer.js')

var moment = require('moment');

var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var projectssettings = require('./js/projectssettings.js')
var jobtable = require('./js/jobtable.js')

// var db = remote.getGlobal('db');
var Datastore = require('nedb')
var db = new Datastore({ filename: 'db', autoload: true });
var db_projects = remote.getGlobal('db_projects');
var monthChart = undefined;

onload = function() {

  

  $('#modals').load("pages/modals.html")
  $('#mainContent').hide()
  var tray = remote.getGlobal('tray');
  tray.setContextMenu(trayContextMenu)

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

  currentDate = new moment();
  $("#textCurrentDate").change(currentDateChanged)

  $.find('#textCurrentDate')[0].value = currentDate.format('DD.MM.YYYY')
  $('#textCurrentDate').datepicker({
    language: 'de',
    autoClose:true,
    todayButton: new Date(),
    onSelect:function onSelect(fd, date) {
      currentDate = moment(date)
      currentDateChanged()
    }
  })

  var btnPreviousDay = document.getElementById('btnPreviousDay')
  btnPreviousDay.addEventListener("click",previousDay )

  var btnNextDay = document.getElementById('btnNextDay')
  btnNextDay.addEventListener("click", nextDay )

  var btnAddNew = document.getElementById('btnAddNew')
  btnAddNew.addEventListener("click",addNewItem )

  var btnSave = document.getElementById('btnSave')
  btnSave.addEventListener("click",saveAll )

  var btnSortTime = document.getElementById('btnSortTime')
  btnSortTime.addEventListener("click", sortByTime )

  var btnSortTitle = document.getElementById('btnSortTitle')
  btnSortTitle.addEventListener("click", sortByTitle )

  var btnProjectsSettings = document.getElementById('btnProjectsSettings')
  btnProjectsSettings.addEventListener("click", openProjectsSettings )

  var btnJobTable = document.getElementById('btnJobTable')
  btnJobTable.addEventListener("click", openJobTable )

  var btnJobTimer = document.getElementById('btnJobTimer')
  btnJobTimer.addEventListener("click", openJobTimer )

  $('#footerContainer').mouseenter(function() {$('#sidebarButton').toggleClass('show')})
  $('#footerContainer').mouseleave(function() {$('#sidebarButton').toggleClass('show')})
  $('#sidebarButton').click(function() {$('#footerContainer').toggleClass('chart');$('#buttonSymbol').toggleClass('down');initChart(document)})

  jobtimer.timeSignal.subscribe(timerStep)

  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
    createList(docs)
    refreshTimeSum()
  });
  
};

function openJobTimer(){
  
    $('#list').show()
    $('#mainContent').hide()
    $('#navJobTable').removeClass("selected");
    currentDateChanged()
  
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

function initChart(document){
  var regex =  new RegExp(currentDate.format('YYYY-MM') + '-(.*)');
  db.find({date: regex}).sort({ date: 1 }).exec(function (err, docs) {

    var lastDayOfMonth = currentDate.clone().endOf('month').format('D')
    var data = []
    var groups = _.groupBy(docs,'date')
    var result = _.transform(groups, function(result, value, key) {
      var seconds = _.sumBy(value,'elapsedSeconds')
      var sum = moment.duration(seconds, "seconds").format("h", 2)
      result[moment(key,'YYYY-MM-DD').format('D')] = sum;
      return true;
    }, []);
    for (var i = 0; i <= lastDayOfMonth; i++) {
      data[i] = result[i+1]
    }

    var daysArray = _.range(1,parseInt(currentDate.clone().endOf('month').format('D'))+1)
    var ctx = document.getElementById("chart").getContext('2d');
    if(monthChart != undefined){
      monthChart.destroy()
    }
    monthChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: daysArray,
          datasets: [{
              data: data,
              backgroundColor: 'rgb(164, 36, 74)'
          }]
      },
      options: {
        legend : {
          display: false
        },
        tooltips:{
          mode: 'nearest',
          callbacks: {
            title: function(tooltipItem, data) {
              var day = tooltipItem.xLabel
              var momentObj = currentDate.clone()
              momentObj.date(day)
              momentObj.locale('de')
              return momentObj.format("dddd, DD.MM.YYYY");
            },
            label: function(tooltipItem, data) {
              return tooltipItem.yLabel + ' Stunden'
            }
        }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            yAxes: [{

                  ticks: {
                      suggestedMax: 12,
                      min: 0
                  }

            }]
        },
        annotation: {

      		drawTime: 'afterDatasetsDraw',

      		annotations: [{
      			drawTime: 'afterDraw', // overrides annotation.drawTime if set
      			id: 'a-line-1', // optional
      			type: 'line',
      			mode: 'horizontal',
      			scaleID: 'y-axis-0',
      			value: '8',
      			borderColor: 'rgb(29, 173, 75)',
      			borderWidth: 1,
            borderDash: [2, 2]
      		}]
      	}
      }
    });
  });

}



function sortByTime(){
  var lastEntryId = currentEntryId
  pauseTimer()
  clearList()

  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ elapsedSeconds: timeSortDirection, description: -1 }).exec(function (err, docs) {
    createList(docs)
    refreshTimeSum()
    if(lastEntryId){
      var lastEntry = $('#'+lastEntryId)[0]
      var tmpMethod = startTimer.bind(lastEntry)
      tmpMethod()
    }
  });
  timeSortDirection *= -1
}

function sortByTitle(){
  var lastEntryId = currentEntryId
  pauseTimer()
  clearList()

  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ description: titleSortDirection, elapsedSeconds: -1 }).exec(function (err, docs) {
    createList(docs)
    refreshTimeSum()
    if(lastEntryId){
      var lastEntry = $('#'+lastEntryId)[0]
      var tmpMethod = startTimer.bind(lastEntry)
      tmpMethod()
    }
  });
  titleSortDirection *= -1
}

function clearList(){
  var ul = document.getElementById("list");
  ul.innerHTML = "";
}

function currentDateChanged(){
  var lastEntryId = currentEntryId
  $.find('#textCurrentDate')[0].value = currentDate.format('DD.MM.YYYY')
  clearList()
  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec( function (err, docs) {
    createList(docs)
    refreshTimeSum()
    initChart(document)
  });
}

function nextDay(){

  currentDate.add(1,'days');
  currentDateChanged()
}

function createList(entries){
  db.find({}).exec(function (err, docs) {
    var mappedDocs = _.map(docs,'description')
    for (var i = 0; i < entries.length; i++) {
      var dbEntry = entries[i];
      createListEntry(dbEntry, mappedDocs)
      if(currentEntryId != undefined && dbEntry._id == currentEntryId){
        var current = $('#'+currentEntryId)[0]
        var tmpMethod = startTimer.bind(current)
        tmpMethod()
      }
    }
  })
}

function createListEntry(dbEntry, autocompleteList){
  var item = document.getElementById("first-element");
  var clone = item.cloneNode(true);
  clone.style = ""
  clone.id = dbEntry._id
  var btnRemove = $(clone).find('#btnRemoveEntry')[0]
  btnRemove.addEventListener("click", removeItem)
  var btnStart = $(clone).find('#btnStart')[0]
  btnStart.addEventListener("click", startTimer)
  var btnPause = $(clone).find('#btnPause')[0]
  btnPause.addEventListener("click", pauseTimer)
  var btnTransfer = $(clone).find('#btnTransfer')[0]
  btnTransfer.addEventListener("click", transferEntry)
  if((new moment()).isSame(currentDate, 'day')){
    $(clone).find('#btnTransfer').addClass('disabled')
  }

  $(clone).find('#text-input-job')[0].value = dbEntry.description;
  clone.savedTime = dbEntry.elapsedSeconds
  $(clone).find('#textTimer')[0].textContent = getTimeString(dbEntry.elapsedSeconds)

  document.getElementById("list").appendChild(clone);
  $(clone).find('#timerCell')[0].addEventListener("click", showTooltip)
  $(clone).find('#timerCell').tooltip();

  
    var options = {
      data: autocompleteList,
  
      list: {
          match: {
              enabled: true
          }
      },
  
      theme: "bootstrap"
    };
  
    var textInputNewId = 'text-input-job-'+dbEntry._id
    $(clone).find('#text-input-job').attr('id',textInputNewId)
    $(clone).find('#'+textInputNewId).easyAutocomplete(options)
    $(clone).find('.easy-autocomplete.eac-bootstrap').removeAttr( 'style' )
    $(clone).find('#'+textInputNewId).css("height",'31px')

  db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
    var htmlString = ''
    for(var i = 0; i < docs.length;i++){
      var doc = docs[i]
      var selected = ''
      if(doc._id == dbEntry.projectId) {
        selected = 'selected disabled'
      }

      if(doc._id == dbEntry.projectId || doc.active) {
        htmlString += '<option '+selected+' projectid="'+doc._id+'">'+doc.name+'</option>'
      }
    }
    $(clone).find(".projectSelect")
       .append(htmlString);
  });

}

function showTooltip(){
  var that = this
  $(".tooltip").remove();
  $(this).tooltip("toggle");
  var element = $(this).closest('li')[0]
  var savedTime = element.savedTime
  $('#inputTime').val(moment.duration(savedTime, "seconds").format("hh:mm:ss",{trim: false}))
  $('#btnSaveTime').on('click', function(){
    var time = duration.parse($('#inputTime')[0].value, "HH:mm:ss")
    element.savedTime = time/1000
    $(element).find('#textTimer')[0].textContent = getTimeString(time/1000)
    saveAll()
    refreshTimeSum()
    $(that).tooltip('hide')
  })
}

function getTimeString(seconds){
  if(!seconds)
    return "00:00:00/0.00"

  var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
  var decimal = moment.duration(seconds, "seconds").format("h", 2)

  return formated + "/" + decimal
}

function transferEntry(){
  var entry = $(this).closest('li').addClass('currentEntry');
  var description = $(entry).find('#text-input-job')[0].value
  var attribute = $(entry).find('.projectSelect')[0].selectedOptions[0].attributes.projectid;
  if(attribute != undefined){
    var projectId = attribute.nodeValue
  }

  currentDate = new moment();
  currentDateChanged()
  var newEntry = {projectId: projectId, elapsedSeconds:0, description:description, date:currentDate.format('YYYY-MM-DD')}
  db.insert(newEntry, function (err, dbEntry) {
    db.find({}).exec(function (err, docs) {
      var mappedDocs = _.map(docs,'description')
      createListEntry(dbEntry, mappedDocs)
    })
  });
}

function previousDay(){

  currentDate.subtract(1,'days');
  currentDateChanged()
}

function saveAll(){
  $('#list').children('li').each(function(){
    if(this.id != 'first-element')
    {
      var attribute = $(this).find('.projectSelect')[0].selectedOptions[0].attributes.projectid;
      if(attribute != undefined){
        var projectId = attribute.nodeValue
      }
      var description = $(this).find('#text-input-job')[0]
      var savedTime = this.savedTime
      db.update({ _id:this.id }, { $set: { projectId: projectId, description: description.value, elapsedSeconds:savedTime } },{ multi: false }, function (err, numReplaced) {} )
    }
  })
  db.persistence.compactDatafile()
}

function addNewItem(){
  var item = document.getElementById("first-element");
  var clone = item.cloneNode(true);
  clone.style = ""
  var newEntry = {elapsedSeconds:0, description:"", date:currentDate.format('YYYY-MM-DD')}
  db.insert(newEntry, function (err, dbEntry) {
    db.find({}).exec(function (err, docs) {
      var mappedDocs = _.map(docs,'description')
      createListEntry(dbEntry, mappedDocs)
    })
    
  });
}

function removeItem(){
  var entry = $(this).closest('li')[0]
  db.remove({ _id: entry.id }, {}, function (err, numRemoved) {
  // numRemoved = 1
  });
  $(this).closest('li').remove()
}


var startTime = undefined;
var offsetSeconds = undefined;


var currentDate = new moment();
var currentEntry = undefined;
var currentEntryId = undefined;
var timeSortDirection = -1;
var titleSortDirection = -1;

function pauseTimer(){
  
  $(currentEntry).removeClass('currentEntry');
  $(currentEntry).find('#btnPause').addClass('disabled');
  $(currentEntry).find('#btnStart').removeClass('disabled')

  jobtimer.stop()

  lastEntryId = currentEntryId
  currentEntryId = undefined
  refreshStatusBarEntry()
}

function startTimer(){
  if(jobtimer.isRunning()){
    pauseTimer()
  }
  $(this).closest('li').addClass('currentEntry');
  currentEntry = $(this).closest('li')[0]
  currentEntryId = currentEntry.id;
  $(currentEntry).find('#btnStart').addClass('disabled');
  $(currentEntry).find('#btnPause').removeClass('disabled')
  
  offsetSeconds = currentEntry.savedTime

  jobtimer.start(currentEntryId, offsetSeconds)
}

function refreshStatusBarEntry(description, duration){
  var leftFooter = document.getElementById('footerLeftContent')
  if(duration == undefined){
    $.find('#currentTaskDescription')[0].textContent = "-"
    $.find('#currentTaskTime')[0].textContent = "-"
    leftFooter.removeEventListener('click', goToToday)
  } else {
    
    $.find('#currentTaskDescription')[0].textContent = description
    $.find('#currentTaskTime')[0].textContent = getTimeString(duration)
    leftFooter.addEventListener('click', goToToday)
  }
}

function goToToday(){
  currentDate = new moment()
  currentDateChanged()
}

function timerStep(updateValue){
  var entry = document.getElementById(updateValue.jobId)
  
  if(entry){
    entry.savedTime = updateValue.duration
    $(entry).find('#textTimer')[0].textContent = getTimeString(updateValue.duration)  
  }
  
  saveAll()
  refreshTimeSum()
  refreshTray(updateValue.duration)
  var description = $(currentEntry).find('#text-input-job')[0].value
  refreshStatusBarEntry(description, updateValue.duration)
}

function refreshTimeSum(){
  var timeSum = getTimeSum()

  $.find('#textTimeSum')[0].textContent = getTimeString(timeSum)
}

function getTimeSum(){
  var timeSum = 0
  $('#list').children('li').each(function(){
    if(this.id != 'first-element' && this.savedTime)
    {
      timeSum += this.savedTime
    }
  })

  return timeSum
}

function refreshTray(elapsedTime){
  var tray = remote.getGlobal('tray');
  var timeSum = getTimeSum()
  tray.setToolTip("Ʃ "+getTimeString(timeSum)+", Aufgabe: "+getTimeString(elapsedTime))
}

const trayContextMenu = remote.getGlobal('menu').buildFromTemplate([
    {id: 0, label: 'Weiter', click() {
      if(lastEntryId){
        var lastEntry = $('#'+lastEntryId)[0]
        var tmpMethod = startTimer.bind(lastEntry)
        tmpMethod()
      }
    }},
    {id: 1, label: 'Stopp', click() {
      pauseTimer()
    }},
    {type: 'separator'},
    {id: 2, label: 'Beenden', click() {
      let w = remote.getCurrentWindow()
      w.close()
    }}

  ])

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
