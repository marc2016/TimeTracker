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

  $('#footerContainer').mouseenter(function() {$('#sidebarButton').toggleClass('show')})
  $('#footerContainer').mouseleave(function() {$('#sidebarButton').toggleClass('show')})
  $('#sidebarButton').click(function() {$('#footerContainer').toggleClass('chart');$('#buttonSymbol').toggleClass('down');initChart(document)})

  jobtimer.timeSignal.subscribe(timerStep)

  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
    createList(docs)
    refreshTimeSum()
  });
};


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

function createList(docs){
  for (var i = 0; i < docs.length; i++) {
    var dbEntry = docs[i];
    createListEntry(dbEntry)
    if(currentEntryId != undefined && dbEntry._id == currentEntryId){
      var current = $('#'+currentEntryId)[0]
      var tmpMethod = startTimer.bind(current)
      tmpMethod()
    }
  }
}

function createListEntry(dbEntry){
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
    createListEntry(dbEntry)
  });
}

function previousDay(){

  currentDate.subtract(1,'days');
  currentDateChanged()
}


function addNewItem(){
  var item = document.getElementById("first-element");
  var clone = item.cloneNode(true);
  clone.style = ""
  var newEntry = {elapsedSeconds:0, description:"", date:currentDate.format('YYYY-MM-DD')}
  db.insert(newEntry, function (err, dbEntry) {
    createListEntry(dbEntry)
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
}







