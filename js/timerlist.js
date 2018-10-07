const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
const { auditTime } = require('rxjs/operators');

var dataAccess = require('./dataaccess.js')
var base = require('./base.js')
var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var remote = require('electron').remote;
var vars = remote.getGlobal('vars');
var Client = require('node-rest-client').Client;
const Store = require('electron-store');
const store = new Store();
var format = require("string-template")

var toastr = require('toastr');
toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-bottom-right",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

var footer = require('./footer.js')

var self = module.exports = {

  viewId:undefined,
  isBound: function() {
      return !!ko.dataFor(document.getElementById(self.viewId));
  },

  jobTimerList: undefined,
  projectList: undefined,
  jobtypeList: undefined,
  startTime: undefined,
  offsetSeconds: undefined,
  currentDate: new moment(),
  currentEntryId: undefined,
  currentJob: ko.observable(),
  db: undefined,
  db_projects: undefined,
  autocompleteOptions: undefined,

  onLoad: function(jobtimer){


    $('#background').css('background-image', 'url('+store.get('backgroundSrc')+')')

    self.jobtimer = jobtimer
    self.db = dataAccess.getDb('jobs')
    self.db_projects = dataAccess.getDb('projects')
    self.db_jobtypes = dataAccess.getDb('jobtypes')
    self.jobTimerList = ko.observableArray()
    self.projectList = ko.observableArray()
    self.jobtypeList = ko.observableArray()
    // self.currentJob = ko.observable()
    if(!self.isBound()){
      ko.applyBindings(self, document.getElementById('timerlistMainContent'))
    }
    if(!ko.dataFor(document.getElementById('modalAddNote'))){
      ko.applyBindings(self, document.getElementById('modalAddNote'))
    }

    
    self.refreshProjectList()
    self.refreshJobtypeList()
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
  
    // var btnSortTime = document.getElementById('btnSortTime')
    // btnSortTime.addEventListener("click", self.sortByTime )
  
    // var btnSortTitle = document.getElementById('btnSortTitle')
    // btnSortTitle.addEventListener("click", self.sortByTitle )

    var btnSaveDuration = document.getElementById('btnSaveDuration')
    btnSaveDuration.addEventListener("click",self.saveJobDuration )
  
    footer.onLoad(self.currentDate, self.db)
    footer.leftFooterAction = self.goToToday

    self.jobtimer.timeSignal.subscribe(self.timerStep)
  
    self.db.find({date: self.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
      self.refreshJobTimerList(docs)
      self.refreshTimeSum()
    });

    
    self.handleModalChangeJobDuration()
    
  },

  syncEntry: function(){
    if(!vars.authCookie){
      toastr.error('Sie sind nicht am externen System angemeldet.')
      return
    }

    var client = new Client();
    var syncJobUrl = store.get('syncJobUrl')
    var syncJobParameter = store.get('syncJobParameter')

    var date = moment(this.date(), "YYYY-MM-DD").format('D.M.YYYY');

    var that = this
    var projectMatch = ko.utils.arrayFirst(self.projectList(), function(item) {
      return item._id == that.projectId();
    });
    var projectExternalId = projectMatch.externalId
    var jobtypeMatch = ko.utils.arrayFirst(self.jobtypeList(), function(item) {
      return item._id == that.jobtypeId();
    });
    var jobTypeId = jobtypeMatch.externalId
    var duration =  moment.duration(this.elapsedSeconds(), "seconds").format("h", 2).replace('.',',')
    var description = this.description()
    var note = this.jobNote()

    syncJobParameter = format(syncJobParameter, [date,duration,description,projectExternalId,jobTypeId,note])

    var args = {
      data: syncJobParameter,
      headers: {
        "Cookie": vars.authCookie,
        "content-type": "application/json"
      }
    }
    var that = this
    client.post(syncJobUrl, args, function (data, response) {
        if(data.status == 500){
          toastr.error('Synchronisation der Aufgabe ist fehlgeschlagen.')  
          return
        }
        
        // this.lastSync(moment().format('DD.MM.YYYY, HH:mm:ss'))
        toastr.success('Aufgabe wurde erfolgreich synchronisiert.')
    });

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
    self.db_projects.find({active:true}).sort({ name: 1 }).exec( function (err, docs) {
      ko.utils.arrayPushAll(self.projectList, docs)
    })
  },

  refreshJobtypeList: function(){
    self.db_jobtypes.find({active:true}).sort({ name: 1 }).exec( function (err, docs) {
      ko.utils.arrayPushAll(self.jobtypeList, docs)
    })
  },

  refreshJobTimerList: function(docs){
    docs.forEach(function(item, index){
      if(!item.projectId){
        item.projectId = ""
      }
      if(!item.jobtypeId){
        item.jobtypeId = ""
      }
      if(!item.jobNote){
        item.jobNote = ""
      }
      if(!item.lastSync){
        item.lastSync = undefined
      }
      item.isRunning = false
      if(self.currentJob && self.currentJob() && self.currentJob()._id && self.currentJob()._id() == item._id){
        item.isRunning = true
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

  addNote: function(){

  },
  
  transferEntry: function(){
    self.currentDate = new moment();
    var newEntry = {jobNote:this.jobNote(), jobtypeId: this.jobtypeId(), projectId: this.projectId(),elapsedSeconds:0, description:this.description(), date:self.currentDate.format('YYYY-MM-DD'), lastSync: undefined}
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
      self.db.update({ _id:element._id() }, { $set: { jobNote: element.jobNote(), description: element.description(), elapsedSeconds: element.elapsedSeconds(), projectId: element.projectId(), jobtypeId: element.jobtypeId() } },{ multi: false }, function (err, numReplaced) {} )
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
    var newEntry = {jobNote:"", jobtypeId: "", projectId: "",elapsedSeconds:0, description:"", date:self.currentDate.format('YYYY-MM-DD'), lastSync: undefined}
    self.db.insert(newEntry, function (err, dbEntry) {
      dbEntry = ko.mapping.fromJS(dbEntry)
      dbEntry.isRunning = ko.observable()
      dbEntry.isRunning(false)
      self.jobTimerList.push(dbEntry)
      self.createAutoComplete()
      $('#text-input-job_'+dbEntry._id).focus()
    });
  },
  
  removeItem: function(){
    var that = this
    self.db.remove({ _id: this._id() }, {}, function (err, numRemoved) {});
    self.jobTimerList.remove(function (item) { return item._id() == that._id(); })
  },

  pauseTimer: function(){
    var elementId = self.jobtimer.currentJobId
    self.currentJob().isRunning(false)
    self.jobtimer.stop()
  
    self.lastEntryId = elementId
    self.currentEntryId = undefined
    footer.refreshStatusBarEntry()
    self.currentJob(undefined)
  },
  
  startTimer: function(){
    if(self.jobtimer.isRunning() && self.jobtimer.currentJobId == this._id()){
      self.pauseTimer()
      return;
    }
    if(self.jobtimer.isRunning()){
      self.pauseTimer()
    }
    self.currentJob(this)
    var elementId = this._id()
    self.currentEntryId = elementId;
    this.isRunning(true)
  
    self.jobtimer.start(elementId, this.elapsedSeconds())
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

  changeNoteClick: function(that,data){
    that.currentJob(data)
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
