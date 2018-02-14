// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
//require('jquery')
var moment = require('moment');

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
  $.find('#textCurrentDate')[0].textContent = currentDate.format('DD-MM-YYYY')

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
  });
};

function clearList(){
  var ul = document.getElementById("list");
  ul.innerHTML = "";
}

function nextDay(){
  clearList()

  currentDate.add(1,'days');
  $.find('#textCurrentDate')[0].textContent = currentDate.format('DD-MM-YYYY')

  db.find({date: currentDate.format('YYYY-MM-DD')}, function (err, docs) {
    createList(docs)
  });
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

  $(clone).find('#text-input-job')[0].value = dbEntry.description;
  clone.savedTime = dbEntry.elapsedSeconds
  $(clone).find('#textTimer')[0].textContent = dbEntry.elapsedSeconds ? dbEntry.elapsedSeconds.toHHMMSS():"00:00:00"

  document.getElementById("list").appendChild(clone);
}

function previousDay(){
  clearList()

  currentDate.subtract(1,'days');
  $.find('#textCurrentDate')[0].textContent = currentDate.format('DD-MM-YYYY')

  db.find({date: currentDate.format('YYYY-MM-DD')}, function (err, docs) {
    createList(docs)
  });
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
  $(entry).find('#textTimer')[0].textContent = elapsedTime.toHHMMSS()

  saveAll()

  db.find({date: currentDate.format('YYYY-MM-DD')}, function (err, docs) {
    var timeSum = 0
    for (var i = 0; i < docs.length; i++) {
      var dbEntry = docs[i];
      timeSum += dbEntry.elapsedSeconds
    }
    $.find('#textTimeSum')[0].textContent = timeSum.toHHMMSS()
  })
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
