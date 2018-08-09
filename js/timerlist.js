const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');

var ko = require('knockout');
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var jobtimer = require('./jobtimer.js')
var footer = require('./footer.js')

var Datastore = require('nedb')
var db = new Datastore({ filename: 'db', autoload: true });
var db_projects = remote.getGlobal('db_projects');

var self = module.exports = {

  startTime: undefined,
  offsetSeconds: undefined,
  currentDate: new moment(),
  currentEntry: undefined,
  currentEntryId: undefined,
  timeSortDirection: -1,
  titleSortDirection: -1,

  onLoad: function(){
    var tray = remote.getGlobal('tray');
    tray.setContextMenu(self.trayContextMenu)

    self.currentDate = new moment();
    $("#textCurrentDate").change(self.currentDateChanged)

    $.find('#textCurrentDate')[0].value = self.currentDate.format('DD.MM.YYYY')
    $('#textCurrentDate').datepicker({
      language: 'de',
      autoClose:true,
      todayButton: new Date(),
      onSelect:function onSelect(fd, date) {
        self.currentDate = moment(date)
        self.currentDateChanged()
      }
    })

    var btnPreviousDay = document.getElementById('btnPreviousDay')
    btnPreviousDay.addEventListener("click", self.previousDay )
  
    var btnNextDay = document.getElementById('btnNextDay')
    btnNextDay.addEventListener("click", self.nextDay )
  
    var btnAddNew = document.getElementById('btnAddNew')
    btnAddNew.addEventListener("click", self.addNewItem )
  
    var btnSave = document.getElementById('btnSave')
    btnSave.addEventListener("click", self.saveAll )
  
    var btnSortTime = document.getElementById('btnSortTime')
    btnSortTime.addEventListener("click", self.sortByTime )
  
    var btnSortTitle = document.getElementById('btnSortTitle')
    btnSortTitle.addEventListener("click", self.sortByTitle )
  
    footer.onLoad(self.currentDate)
    footer.leftFooterAction = self.goToToday

    jobtimer.timeSignal.subscribe(self.timerStep)
  
    db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.createList(docs)
      self.refreshTimeSum()
    });
  
  },

  sortByTime: function(){
    self.clearList()
  
    db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ elapsedSeconds: self.timeSortDirection, description: -1 }).exec(function (err, docs) {
      self.createList(docs)
      self.refreshTimeSum()
    });
    self.timeSortDirection *= -1
  },
  
  sortByTitle: function(){
    self.clearList()
  
    db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: self.titleSortDirection, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.createList(docs)
      self.refreshTimeSum()
    });
    self.titleSortDirection *= -1
  },

  clearList: function(){
    var ul = document.getElementById("list");
    ul.innerHTML = "";
  },
  
  currentDateChanged: function(){
    var lastEntryId = self.currentEntryId
    $.find('#textCurrentDate')[0].value = self.currentDate.format('DD.MM.YYYY')
    self.clearList()
    db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec( function (err, docs) {
      self.createList(docs)
      self.refreshTimeSum()
      footer.initChart(self.currentDate)
    });
  },
  
  nextDay: function(){
  
    self.currentDate.add(1,'days');
    self.currentDateChanged()
  },
  
  createList: function(entries){
    db.find({}).exec(function (err, docs) {
      var mappedDocs = _.map(docs,'description')
      for (var i = 0; i < entries.length; i++) {
        var dbEntry = entries[i];
        self.createListEntry(dbEntry, mappedDocs)
        self.refreshTimeSum()
      }
    })
  },
  
  createListEntry: function(dbEntry, autocompleteList){
    var item = document.getElementById("first-element");
    var clone = item.cloneNode(true);
    clone.style = ""
    clone.id = dbEntry._id
    var btnRemove = $(clone).find('#btnRemoveEntry')[0]
    btnRemove.addEventListener("click", self.removeItem)
    var btnStart = $(clone).find('#btnStart')[0]
    btnStart.addEventListener("click", self.startTimer)
    var btnPause = $(clone).find('#btnPause')[0]
    btnPause.addEventListener("click", self.pauseTimer)
    var btnTransfer = $(clone).find('#btnTransfer')[0]
    btnTransfer.addEventListener("click", self.transferEntry)
    if((new moment()).isSame(self.currentDate, 'day')){
      $(clone).find('#btnTransfer').addClass('disabled')
    }
  
    $(clone).find('#text-input-job')[0].value = dbEntry.description;
    clone.savedTime = dbEntry.elapsedSeconds
    $(clone).find('#textTimer')[0].textContent = self.getTimeString(dbEntry.elapsedSeconds)
  
    document.getElementById("list").appendChild(clone);
    $(clone).find('#timerCell')[0].addEventListener("click", self.showTooltip)
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
  
  },
  showTooltip: function(){
    var that = this
    $(".tooltip").remove();
    $(this).tooltip("toggle");
    var element = $(this).closest('li')[0]
    var savedTime = element.savedTime
    $('#inputTime').val(moment.duration(savedTime, "seconds").format("hh:mm:ss",{trim: false}))
    $('#btnSaveTime').on('click', function(){
      var time = duration.parse($('#inputTime')[0].value, "HH:mm:ss")
      element.savedTime = time/1000
      $(element).find('#textTimer')[0].textContent = self.getTimeString(time/1000)
      self.saveAll()
      self.refreshTimeSum()
      $(that).tooltip('hide')
    })
  },
  
  getTimeString: function(seconds){
    if(!seconds)
      return "00:00:00/0.00"
  
    var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
    var decimal = moment.duration(seconds, "seconds").format("h", 2)
  
    return formated + "/" + decimal
  },
  
  transferEntry: function(){
    var entry = $(this).closest('li').addClass('currentEntry');
    var description = $(entry).find('#text-input-job-'+entry[0].id)[0].value
    var attribute = $(entry).find('.projectSelect')[0].selectedOptions[0].attributes.projectid;
    if(attribute != undefined){
      var projectId = attribute.nodeValue
    }
  
    self.currentDate = new moment();
    self.currentDateChanged()
    var newEntry = {projectId: projectId, elapsedSeconds:0, description:description, date:self.currentDate.format('YYYY-MM-DD')}
    db.insert(newEntry, function (err, dbEntry) {
      db.find({}).exec(function (err, docs) {
        var mappedDocs = _.map(docs,'description')
        self.createListEntry(dbEntry, mappedDocs)
      })
    });
  },
  
  previousDay: function(){
  
    self.currentDate.subtract(1,'days');
    self.currentDateChanged()
  },
  
  saveAll: function(){
    $('#list').children('li').each(function(){
      if(this.id != 'first-element')
      {
        var attribute = $(this).find('.projectSelect')[0].selectedOptions[0].attributes.projectid;
        if(attribute != undefined){
          var projectId = attribute.nodeValue
        }
        var description = $(this).find('#text-input-job-'+this.id)[0]
        var savedTime = this.savedTime
        db.update({ _id:this.id }, { $set: { projectId: projectId, description: description.value, elapsedSeconds:savedTime } },{ multi: false }, function (err, numReplaced) {} )
      }
    })
    db.persistence.compactDatafile()
  },
  
  addNewItem: function(){
    var item = document.getElementById("first-element");
    var clone = item.cloneNode(true);
    clone.style = ""
    var newEntry = {elapsedSeconds:0, description:"", date:self.currentDate.format('YYYY-MM-DD')}
    db.insert(newEntry, function (err, dbEntry) {
      db.find({}).exec(function (err, docs) {
        var mappedDocs = _.map(docs,'description')
        self.createListEntry(dbEntry, mappedDocs)
      })
      
    });
  },
  
  removeItem: function(){
    var entry = $(this).closest('li')[0]
    db.remove({ _id: entry.id }, {}, function (err, numRemoved) {
    // numRemoved = 1
    });
    $(this).closest('li').remove()
  },
  pauseTimer: function(){
  
    $(self.currentEntry).removeClass('currentEntry');
    $(self.currentEntry).find('#btnPause').addClass('disabled');
    $(self.currentEntry).find('#btnStart').removeClass('disabled')
  
    jobtimer.stop()
  
    self.lastEntryId = self.currentEntryId
    self.currentEntryId = undefined
    footer.refreshStatusBarEntry()
  },
  
  startTimer: function(){
    if(jobtimer.isRunning()){
      self.pauseTimer()
    }
    $(this).closest('li').addClass('currentEntry');
    self.currentEntry = $(this).closest('li')[0]
    self.currentEntryId = self.currentEntry.id;
    $(self.currentEntry).find('#btnStart').addClass('disabled');
    $(self.currentEntry).find('#btnPause').removeClass('disabled')
    
    self.offsetSeconds = self.currentEntry.savedTime
  
    jobtimer.start(self.currentEntryId, self.offsetSeconds)
  },
  
  goToToday: function(){
    self.currentDate = new moment()
    self.currentDateChanged()
  },
  
  timerStep: function(updateValue){
    var entry = document.getElementById(updateValue.jobId)
    
    if(entry){
      entry.savedTime = updateValue.duration
      $(entry).find('#textTimer')[0].textContent = self.getTimeString(updateValue.duration)  
      var description = $(self.currentEntry).find('#text-input-job-'+entry.id)[0].value
    }
    
    self.saveAll()
    self.refreshTimeSum()
    self.refreshTray(updateValue.duration)
    
    footer.refreshStatusBarEntry(description, updateValue.duration)
  },
  
  refreshTimeSum: function(){
    var timeSum = self.getTimeSum()
  
    $.find('#textTimeSum')[0].textContent = self.getTimeString(timeSum)
  },
  
  getTimeSum: function(){
    var timeSum = 0
    $('#list').children('li').each(function(){
      if(this.id != 'first-element' && this.savedTime)
      {
        timeSum += this.savedTime
      }
    })
  
    return timeSum
  },
  
  refreshTray: function(elapsedTime){
    var tray = remote.getGlobal('tray');
    var timeSum = self.getTimeSum()
    tray.setToolTip("Ʃ "+self.getTimeString(timeSum)+", Aufgabe: "+ self.getTimeString(elapsedTime))
  },
  
  trayContextMenu: remote.getGlobal('menu').buildFromTemplate([
      {id: 0, label: 'Weiter', click() {
        if(lastEntryId){
          var lastEntry = $('#'+lastEntryId)[0]
          var tmpMethod = startTimer.bind(lastEntry)
          tmpMethod()
        }
      }},
      {id: 1, label: 'Stopp', click() {
        self.pauseTimer()
      }},
      {type: 'separator'},
      {id: 2, label: 'Beenden', click() {
        let w = remote.getCurrentWindow()
        w.close()
      }}
  
    ])

}