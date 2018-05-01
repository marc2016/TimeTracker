// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
//require('jquery')
var moment = require('moment');

var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var db = undefined;
var db_projects = undefined;
var monthChart = undefined;

onload = function() {

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

  var Datastore = require('nedb')
  db = new Datastore({ filename: 'db', autoload: true });
  db_projects = new Datastore({ filename: 'db_projects', autoload: true });

  var btnAddNew = document.getElementById('btnAddNew')
  btnAddNew.addEventListener("click",addNewItem )

  var btnSave = document.getElementById('btnSave')
  btnSave.addEventListener("click",saveAll )

  var btnSortTime = document.getElementById('btnSortTime')
  btnSortTime.addEventListener("click", sortByTime )

  var btnSortTitle = document.getElementById('btnSortTitle')
  btnSortTitle.addEventListener("click", sortByTitle )

  $('#footerContainer').mouseenter(function() {$('#sidebarButton').toggleClass('show')})
  $('#footerContainer').mouseleave(function() {$('#sidebarButton').toggleClass('show')})
  $('#sidebarButton').click(function() {$('#footerContainer').toggleClass('chart');$('#buttonSymbol').toggleClass('down');initChart(document)})

  db.find({date: currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
    createList(docs)
    refreshTimeSum()
  });

  

};

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

    var daysArray = _.range(1,currentDate.clone().endOf('month').format('D'))
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

  db_projects.find({}, function (err, docs) {
    var htmlString = ''
    for(var i = 0; i < docs.length;i++){
      var doc = docs[i]
      var selected = ''
      if(doc._id == dbEntry.projectId) {
        selected = 'selected'
      }
      htmlString += '<option '+selected+' projectid="'+doc._id+'">'+doc.name+'</option>'
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
  var savedTime = this.savedTime
  currentDate = new moment();
  currentDateChanged()
  var newEntry = {elapsedSeconds:0, description:description, date:currentDate.format('YYYY-MM-DD')}
  db.insert(newEntry, function (err, dbEntry) {
    createListEntry(dbEntry)
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
var currentEntry = undefined;
var currentEntryId = undefined;
var timeSortDirection = -1;
var titleSortDirection = -1;

function pauseTimer(){
  if(!timeRunning){
    return
  }
  $(currentEntry).removeClass('currentEntry');
  $(currentEntry).find('#btnPause').addClass('disabled');
  $(currentEntry).find('#btnStart').removeClass('disabled')
  currentEntry.savedTime = elapsedTime
  clearInterval(timer)
  timer = undefined
  timeRunning = false
  currentEntry = undefined
  lastEntryId = currentEntryId
  currentEntryId = undefined
  refreshStatusBarEntry(currentEntry)
}

function startTimer(){
  if(timeRunning){
    pauseTimer()
  }
  $(this).closest('li').addClass('currentEntry');
  currentEntry = $(this).closest('li')[0]
  currentEntryId = currentEntry.id;
  $(currentEntry).find('#btnStart').addClass('disabled');
  $(currentEntry).find('#btnPause').removeClass('disabled')
  startTime = performance.now()
  offsetSeconds = currentEntry.savedTime
  stopping = undefined;
  timeRunning = true;
  timer = setInterval(timerStep.bind(this), 1000);
}

function refreshStatusBarEntry(entry){
  var leftFooter = document.getElementById('footerLeftContent')
  if(entry == undefined){
    $.find('#currentTaskDescription')[0].textContent = "-"
    $.find('#currentTaskTime')[0].textContent = "-"
    leftFooter.removeEventListener('click', goToToday)
  } else {
    var description = $(entry).find('#text-input-job')[0].value
    $.find('#currentTaskDescription')[0].textContent = description
    $.find('#currentTaskTime')[0].textContent = getTimeString(entry.savedTime)
    leftFooter.addEventListener('click', goToToday)
  }
}

function goToToday(){
  currentDate = new moment()
  currentDateChanged()
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
  refreshStatusBarEntry(entry)
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

function refreshTray(){
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
