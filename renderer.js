// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
//require('jquery')
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var db = undefined;

onload = function() {

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
  $('#textCurrentDate').datepicker({language: 'de',autoClose:true,todayButton: true,onSelect:function onSelect(fd, date) {
    currentDate = moment(date)
    currentDateChanged()
  }})

  var btnPreviousDay = document.getElementById('btnPreviousDay')
  btnPreviousDay.addEventListener("click",previousDay )

  var btnNextDay = document.getElementById('btnNextDay')
  btnNextDay.addEventListener("click", nextDay )

  var Datastore = require('nedb')
  db = new Datastore({ filename: 'db', autoload: true });

  var btnAddNew = document.getElementById('btnAddNew')
  btnAddNew.addEventListener("click",addNewItem )

  var btnSave = document.getElementById('btnSave')
  btnSave.addEventListener("click",saveAll )

  db.find({date: currentDate.format('YYYY-MM-DD')}, function (err, docs) {
    createList(docs)
    refreshTimeSum()
  });
};

function clearList(){
  var ul = document.getElementById("list");
  ul.innerHTML = "";
}

function currentDateChanged(){
  $.find('#textCurrentDate')[0].value = currentDate.format('DD.MM.YYYY')
  clearList()
  db.find({date: currentDate.format('YYYY-MM-DD')}, function (err, docs) {
    createList(docs)
    refreshTimeSum()
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
  // var btnTime = $(clone).find('#textTime')[0]
  // btnTime.addEventListener("click", changeTime)

  $(clone).find('#text-input-job')[0].value = dbEntry.description;
  clone.savedTime = dbEntry.elapsedSeconds
  $(clone).find('#textTimer')[0].textContent = getTimeString(dbEntry.elapsedSeconds)

  document.getElementById("list").appendChild(clone);
  $(clone).find('#timerCell').tooltip();
  $(clone).find('#timerCell').on('shown.bs.tooltip', function () {
    var element = $(this).closest('li')[0]
    var savedTime = element.savedTime
    $('#inputTime').val(moment.duration(savedTime, "seconds").format("hh:mm:ss",{trim: false}))
    $('#btnSaveTime').on('click', function(){
      var time = duration.parse($('#inputTime')[0].value, "HH:mm:ss")
      element.savedTime = time/1000
      $(element).find('#textTimer')[0].textContent = getTimeString(time/1000)
      saveAll()
      refreshTimeSum()
      $('#timerCell').tooltip('hide')
    })
  })

}

function getTimeString(seconds){
  if(!seconds)
    return "00:00:00/0.00"

  var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
  var decimal = moment.duration(seconds, "seconds").format("h", 2)

  return formated + "/" + decimal
}


function previousDay(){
  currentDate.subtract(1,'days');
  currentDateChanged()
}

function saveAll(){
  $('#list').children('li').each(function(){
    if(this.id != 'first-element')
    {
      var description = $(this).find('#text-input-job')[0]
      var savedTime = this.savedTime
      db.update({ _id:this.id }, { $set: { description: description.value, elapsedSeconds:savedTime } },{ multi: false }, function (err, numReplaced) {} )
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

var stopping = undefined;
var timeRunning = undefined;
var startTime = undefined;
var offsetSeconds = undefined;
var timer = undefined;
var elapsedTime = undefined;
var currentDate = new moment();

function pauseTimer(){
  if(!timeRunning){
    return
  }
  $(this).addClass('disabled');
  var entry = $(this).closest('li')[0]
  entry.savedTime = elapsedTime
  $(entry).find('#btnStart').removeClass('disabled')
  clearInterval(timer)
  timer = undefined
  timeRunning = false
}

function startTimer(){
  if(timeRunning){
    return
  }
  $(this).addClass('disabled');
  var entry = $(this).closest('li')[0]
  $(entry).find('#btnPause').removeClass('disabled')
  startTime = performance.now()
  offsetSeconds = entry.savedTime
  stopping = undefined;
  timeRunning = true;
  timer = setInterval(timerStep.bind(this), 1000);
}

function timerStep(){
  elapsedTime =  Math.floor((performance.now()- startTime) / 1000)
  var entry = $(this).closest('li')[0]
  elapsedTime += offsetSeconds

  entry.savedTime = elapsedTime
  $(entry).find('#textTimer')[0].textContent = getTimeString(elapsedTime)

  saveAll()
  refreshTimeSum()
  refreshTray()
}

function refreshTimeSum(){
  var timeSum = getTimeSum()

  $.find('#textTimeSum')[0].textContent = getTimeString(timeSum)
}

function getTimeSum(){
  var timeSum = 0
  $('#list').children('li').each(function(){
    if(this.id != 'first-element')
    {
      timeSum += this.savedTime
    }
  })

  return timeSum
}

function refreshTray(){
  var tray = remote.getGlobal('tray');
  var timeSum = getTimeSum()
  tray.setToolTip("Ʃ "+getTimeString(timeSum)+", Aufgabe: "+getTimeString(elapsedTime))
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
