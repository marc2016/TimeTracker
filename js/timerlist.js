const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');

var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var jobtimer = require('./jobtimer.js')
var footer = require('./footer.js')

var Datastore = require('nedb')
// var self.db = new Datastore({ filename: 'db', autoload: true });
var db_projects = remote.getGlobal('db_projects');


var self = module.exports = {

  jobTimerList: undefined,
  projectList: undefined,
  startTime: undefined,
  offsetSeconds: undefined,
  currentDate: new moment(),
  currentEntry: undefined,
  currentEntryId: undefined,
  timeSortDirection: -1,
  titleSortDirection: -1,
  db: undefined,
  autocompleteOptions: undefined,

  onLoad: function(database){
    self.jobTimerList = ko.observableArray()
    self.projectList = ko.observableArray()
    ko.applyBindings(self, document.getElementById('timerlistMainContent'))
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

    var btnSaveDuration = document.getElementById('btnSaveDuration')
    btnSaveDuration.addEventListener("click",self.saveJobDuration )
  
    self.db = database
    footer.onLoad(self.currentDate, database)
    footer.leftFooterAction = self.goToToday

    jobtimer.timeSignal.subscribe(self.timerStep)
  
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
    });

    self.refreshProjectList()
    self.handleModalChangeJobDuration()
    
  },

  saveJobDuration: function(){
    var jobId = $(this).attr('jobId')
    var match = ko.utils.arrayFirst(self.jobTimerList(), function(item) {
      return item._id() == jobId;
    });
    var newDuration = $('#inputJobDuration')[0].value
    var time = duration.parse(newDuration, "HH:mm:ss")/1000
    if(!time){
      time = duration.parse(newDuration, "HH:mm")/1000
    }
    if(!time){
      time = duration.parse(newDuration, "H:mm")/1000
    }
    if(!time && newDuration.match(/,/).length == 1 && parseFloat(newDuration)){
      time = parseFloat(newDuration.replace(',', '.'))*60*60
    }

    if(time){
      match.elapsedSeconds(time)
      $('#modalChangeJobDuration').modal('toggle');
    }
    self.refreshTimeSum()
  },

  handleModalChangeJobDuration: function(){
    $('#modalChangeJobDuration').on('show.bs.modal', function (event) {
      var button = $(event.relatedTarget)
      var duration = button.attr('duration')
      var jobId = button.attr('jobId')
      var modal = $(this)
      modal.find('.modal-body input').val(duration)
      $('#btnSaveDuration').attr('jobId', jobId)
      document.getElementById("inputJobDuration").focus();
    })
  },

  refreshProjectList: function(){
    db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
      ko.utils.arrayPushAll(self.projectList, docs)
    })
  },

  refreshJobTimerList: function(docs){
    docs.forEach(function(item, index){
      if(!item.projectId){
        item.projectId = ""
      }
    })
    self.jobTimerList.removeAll()
    var observableDocs = ko.mapping.fromJS(docs,self.jobTimerList);

    ko.utils.arrayPushAll(self.jobTimerList, observableDocs())
    self.createAutoComplete()
  },

  sortByTime: function(){
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ elapsedSeconds: self.timeSortDirection, description: -1 }).exec(function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
    });
    self.timeSortDirection *= -1
  },
  
  sortByTitle: function(){
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: self.titleSortDirection, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
    });
    self.titleSortDirection *= -1
  },
  
  currentDateChanged: function(){
    var lastEntryId = self.currentEntryId
    $.find('#textCurrentDate')[0].value = self.currentDate.format('DD.MM.YYYY')
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec( function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
      footer.initChart(self.currentDate)
    });
  },
  
  nextDay: function(){
    self.currentDate.add(1,'days');
    self.currentDateChanged()
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

  getDecimalDuration: function(seconds){
    if(!seconds)
      return "0.00"
    var decimal = moment.duration(seconds, "seconds").format("h", 2)
  
    return decimal
  },

  getFormatedDuration: function(seconds){
    if(!seconds)
      return "00:00:00"
  
    var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
  
    return formated
  },
  
  transferEntry: function(){
    self.currentDate = new moment();
    var newEntry = {projectId: this.projectId, elapsedSeconds:0, description: this.description, date:self.currentDate.format('YYYY-MM-DD')}
    self.db.insert(newEntry, function (err, dbEntry) {
      self.currentDateChanged()  
    });
  },
  
  previousDay: function(){
    self.currentDate.subtract(1,'days');
    self.currentDateChanged()
  },
  
  saveAll: function(){
    ko.utils.arrayForEach(self.jobTimerList(), function (element) {
      self.db.update({ _id:element._id() }, { $set: { description: element.description(), elapsedSeconds: element.elapsedSeconds(), projectId: element.projectId() } },{ multi: false }, function (err, numReplaced) {} )
    })
    
    self.db.persistence.compactDatafile()

    self.createAutoComplete()
  },
  
  createAutoComplete: function(){
    self.db.find({}).exec(function (err, docs) {
      var mappedDocs = _.map(docs,'description')
      self.autocompleteOptions = {
        data: mappedDocs,
        list: {
            match: {
                enabled: true
            }
        },
        theme: "bootstrap"
      }
      
      $('.text-input-job').parent().not('.easy-autocomplete').children('.text-input-job').easyAutocomplete(self.autocompleteOptions).css("height",'31px')
      $('.easy-autocomplete.eac-bootstrap').removeAttr( 'style' )
    })
  },

  addNewItem: function(){
    var newEntry = {projectId: "",elapsedSeconds:0, description:"", date:self.currentDate.format('YYYY-MM-DD')}
    self.db.insert(newEntry, function (err, dbEntry) {
      dbEntry = ko.mapping.fromJS(dbEntry)
      self.jobTimerList.push(dbEntry)
    });
  },
  
  removeItem: function(){
    var that = this
    self.db.remove({ _id: this._id() }, {}, function (err, numRemoved) {});
    self.jobTimerList.remove(function (item) { return item._id() == that._id(); })
  },

  pauseTimer: function(){
    var elementId = jobtimer.currentJobId
    $('#'+elementId).removeClass('currentEntry');
    $('#'+elementId).find('#btnPause').addClass('disabled');
    $('#'+elementId).find('#btnStart').removeClass('disabled')
  
    jobtimer.stop()
  
    self.lastEntryId = elementId
    self.currentEntryId = undefined
    footer.refreshStatusBarEntry()
  },
  
  startTimer: function(){
    if(jobtimer.isRunning()){
      self.pauseTimer()
    }
    var elementId = this._id()
    $('#'+elementId).closest('li').addClass('currentEntry');
    self.currentEntryId = elementId;
    $('#'+elementId).find('#btnStart').addClass('disabled');
    $('#'+elementId).find('#btnPause').removeClass('disabled')
    
    // self.offsetSeconds = self.currentEntry.savedTime
  
    jobtimer.start(elementId, this.elapsedSeconds())
  },
  
  goToToday: function(){
    self.currentDate = new moment()
    self.currentDateChanged()
  },
  
  timerStep: function(updateValue){
    
    var match = ko.utils.arrayFirst(self.jobTimerList(), function(item) {
      return updateValue.jobId === item._id();
    });
    
    if(match){
      match.elapsedSeconds(updateValue.duration)  
    }

    self.saveAll()
    self.refreshTimeSum()
    self.refreshTray(updateValue.duration)
    
    footer.refreshStatusBarEntry(match ? match.description(): undefined, updateValue.duration)
  },
  
  refreshTimeSum: function(){
    var timeSum = self.getTimeSum()
  
    $.find('#textTimeSum')[0].textContent = self.getTimeString(timeSum)
  },
  
  getTimeSum: function(){
    return _.sumBy(self.jobTimerList(), function(o) { return o.elapsedSeconds(); });
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