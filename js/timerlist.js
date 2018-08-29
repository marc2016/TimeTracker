const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');

var base = require('./base.js')
var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;

var jobtimer = require('./jobtimer.js')
var footer = require('./footer.js')

var self = module.exports = {

  viewId:undefined,
  isBound: function() {
      return !!ko.dataFor(document.getElementById(self.viewId));
  },

  jobTimerList: undefined,
  projectList: undefined,
  startTime: undefined,
  offsetSeconds: undefined,
  currentDate: new moment(),
  currentEntry: undefined,
  currentEntryId: undefined,
  db: undefined,
  db_projects: undefined,
  autocompleteOptions: undefined,

  onLoad: function(databaseJobs, databaseProjects){
    self.db = databaseJobs
    self.db_projects = databaseProjects
    self.jobTimerList = ko.observableArray()
    self.projectList = ko.observableArray()
    if(!self.isBound())
      ko.applyBindings(self, document.getElementById('timerlistMainContent'))
    
      self.refreshProjectList()
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
  
    footer.onLoad(self.currentDate, databaseJobs)
    footer.leftFooterAction = self.goToToday

    jobtimer.timeSignal.subscribe(self.timerStep)
  
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
    });

    
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
    self.db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
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
    self.jobTimerList.sort(function (left, right) { return left.elapsedSeconds == right.elapsedSeconds ? 0 : (left.elapsedSeconds < right.elapsedSeconds ? -1 : 1) })
  },
  
  sortByTitle: function(){
    self.jobTimerList.sort(function (left, right) { return left.description == right.description ? 0 : (left.description < right.description ? -1 : 1) })
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
      var uniqDocs = _.uniq(mappedDocs)
      self.autocompleteOptions = {
        data: uniqDocs,
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
