const electron = require('electron')

const { Observable, Subject, ReplaySubject, from, of, range } = require('rxjs');
const { auditTime } = require('rxjs/operators');

var dataAccess = require('./dataaccess.js')
var BaseViewModel = require('./base.js')
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
var utils = require('./utils.js')
var log = require('electron-log');
var sync = require('./sync.js')
sync.baseUrl = store.get('syncRestBaseUrl')

const path = require('path')

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

class TimerList extends BaseViewModel {

  constructor(views, jobtimer){
    super(views)
    this.jobtimer = jobtimer
  
    $('#timerList').load('pages/timerlist.html', function(){
      this.hide()

      this.currentDate = new moment()
      this.currentJob = ko.observable()
      this.itemToDelete = ko.observable()
      
      this.db = dataAccess.getDb('jobs')
      this.db_projects = dataAccess.getDb('projects')
      this.db_jobtypes = dataAccess.getDb('jobtypes')
      this.jobTimerList = ko.observableArray()
      this.projectList = ko.observableArray()
      this.jobtypeList = ko.observableArray()

      if(this.koWatcher){
        this.koWatcher.dispose()
      }
      this.koWatcher = ko.watch(this.jobTimerList, { depth: -1 }, function(parents, child, item) {
        log.info("Job timer changed: "+child())
        this.saveAll()
      }.bind(this));

      this.currentDate = new moment();
      $("#textCurrentDate").change(this.currentDateChanged)

      $.find('#textCurrentDate')[0].value = this.currentDate.format('DD.MM.YYYY')
      $('#textCurrentDate').datepicker({
        language: 'de',
        autoClose:true,
        todayButton: new Date(),
        onSelect:function onSelect(fd, date) {
          this.currentDate = moment(date)
          this.currentDateChanged()
        }.bind(this)
      })

    
      footer.onLoad(this.currentDate, this.db, jobtimer)
      footer.leftFooterAction = this.goToToday

      this.jobtimer.timeSignal.subscribe(this.timerStep.bind(this))

      this.handleModalChangeJobDuration()

      this.loaded = true
      if(this.callAfterLoad)
        this.callAfterLoad()
    }.bind(this))

    electron.ipcRenderer.on('newJob', function(event, jobDescription){
      this.addNewItem(jobDescription)
    }.bind(this))
    
  }

  onLoad() {
    super.onLoad()

    $('#background').css('background-image', 'url('+store.get('backgroundSrc')+')')
    
    // jobTimerList: undefined,
    // projectList: undefined,
    // jobtypeList: undefined,
    // startTime: undefined,
    // offsetSeconds: undefined,

    // currentEntryId: undefined,

    // db: undefined,
    // db_projects: undefined,
    // autocompleteOptions: undefined,

    this.refreshProjectList()
    this.refreshJobtypeList()
    // var tray = remote.getGlobal('tray');
    // tray.setContextMenu(self.trayContextMenu)
  
    this.db.find({date: this.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec(function (err, docs) {
      this.refreshJobTimerList(docs)
      this.refreshTimeSum()
    }.bind(this));

  }

  show(){
    if(!this.loaded){
      this.callAfterLoad = this.show
      return
    }
    this.onLoad()
    $('#timerList').removeClass('invisible')
  }

  hide(){
    $('#timerList').addClass('invisible')
  }

  getMenu(){
    return [
      {
        icon: 'fa fa-plus-circle',
        name: 'Neuer Eintrag',
        method: this.addNewItem.bind(this)
      }
    ]
  }

  syncEntry(that,data){
    sync.syncJob(data,that.projectList,that.jobtypeList)
  }

  saveJobDuration(data, that){
    var jobId = $(data).attr('jobId')
    var match = ko.utils.arrayFirst(that.jobTimerList(), function(item) {
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
    that.refreshTimeSum()
  }

  handleModalChangeJobDuration(){
    $('#modalChangeJobDuration').on('show.bs.modal', function (event) {
      var button = $(event.relatedTarget)
      var duration = button.attr('duration')
      var jobId = button.attr('jobId')
      var modal = $(this)
      modal.find('.modal-body input').val(duration)
      $('#btnSaveDuration').attr('jobId', jobId)
      document.getElementById("inputJobDuration").focus();
    })
  }
  refreshProjectList(){
    this.db_projects.find({active:true}).sort({ name: 1 }).exec( function (err, docs) {
      ko.utils.arrayPushAll(this.projectList, docs)
    }.bind(this))
  }
  refreshJobtypeList(){
    this.db_jobtypes.find({active:true}).sort({ name: 1 }).exec( function (err, docs) {
      ko.utils.arrayPushAll(this.jobtypeList, docs)
    }.bind(this))
  }

  refreshJobTimerList(docs){
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
        item.lastSync = ""
      }
      if(!item.billable){
        item.billable = false
      }
      item.isRunning = false
      if(this.currentJob && this.currentJob() && this.currentJob()._id && this.currentJob()._id() == item._id){
        item.isRunning = true
      }
      
    }.bind(this))
    this.jobTimerList.removeAll()
    var observableDocs = ko.mapping.fromJS(docs,this.jobTimerList);

    ko.utils.arrayPushAll(this.jobTimerList, observableDocs())
    if(this.currentJob && this.currentJob()){
      var newCurrentJob = ko.utils.arrayFirst(this.jobTimerList(), function(value){
        return value._id() == this.currentJob()._id();
      }.bind(this))
      if(newCurrentJob){
        this.currentJob(newCurrentJob)
      }
    }

    this.createAutoComplete()
  }
  
  currentDateChanged(){
    this.saveAll()
    var lastEntryId = this.currentEntryId
    $.find('#textCurrentDate')[0].value = this.currentDate.format('DD.MM.YYYY')
    this.db.find({date: this.currentDate.format('YYYY-MM-DD')}).sort({ description: 1, elapsedSeconds: -1 }).exec( function (err, docs) {
      this.refreshJobTimerList(docs)
      this.refreshTimeSum()
      footer.initChart(this.currentDate)
    }.bind(this));
  }
  
  nextDay(){
    this.currentDate.add(1,'days');
    this.currentDateChanged()
  }
  
  getTimeString(seconds){
    if(!seconds)
      return "00:00:00/0.00"
  
    var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
    var decimal = moment.duration(seconds, "seconds").format("h", 2)
  
    return formated + "/" + decimal
  }

  getDecimalDuration(seconds){
    if(!seconds)
      return "0.00"
    var decimal = moment.duration(seconds, "seconds").format("h", 2)
  
    return decimal
  }

  getFormatedDuration(seconds){
    if(!seconds)
      return "00:00:00"
  
    var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
  
    return formated
  }

  
  transferEntry(that,data){
    that.currentDate = new moment();
    var newEntry = {jobNote:data.jobNote(), jobtypeId: data.jobtypeId(), projectId: data.projectId(),elapsedSeconds:0, description:data.description(), date:that.currentDate.format('YYYY-MM-DD'), billable:that.billable(), lastSync: ""}
    that.db.insert(newEntry, function (err, dbEntry) {
      that.currentDateChanged()  
    });
  }
  
  previousDay(){
    this.currentDate.subtract(1,'days');
    this.currentDateChanged()
  }
  
  saveAll(){
    log.info("Save all method is called.")
    ko.utils.arrayForEach(this.jobTimerList(), function (element) {
      this.db.update({ _id:element._id() }, { $set: { billable: element.billable(), lastSync: element.lastSync(), jobNote: element.jobNote(), description: element.description(), elapsedSeconds: element.elapsedSeconds(), projectId: element.projectId(), jobtypeId: element.jobtypeId() } },{ multi: false }, function (err, numReplaced) {} )
    }.bind(this))
    
    this.db.persistence.compactDatafile()

    this.createAutoComplete()
  }
  
  createAutoComplete(entryId){
    this.db.find({}).exec(function (err, docs) {
      var mappedDocs = _.map(docs,'description')
      var uniqDocs = _.uniq(mappedDocs)
      this.autocompleteOptions = {
        data: uniqDocs,
        list: {
            match: {
                enabled: true
            }
        },
        theme: "bootstrap"
      }
      
      $('.text-input-job').parent().not('.easy-autocomplete').children('.text-input-job').easyAutocomplete(this.autocompleteOptions).css("height",'31px')
      $('.easy-autocomplete.eac-bootstrap').removeAttr( 'style' )
      if(entryId)
        $('#text-input-job_'+entryId).focus()
    }.bind(this))
  }

  addNewItem(jobDescription){
    if(!jobDescription){
      jobDescription = ""
    }
    var newEntry = {jobNote:"", jobtypeId: "", projectId: "",elapsedSeconds:0, description:jobDescription, date:this.currentDate.format('YYYY-MM-DD'), lastSync: "", billable: false}
    this.db.insert(newEntry, function (err, dbEntry) {
      dbEntry = ko.mapping.fromJS(dbEntry)
      dbEntry.isRunning = ko.observable()
      dbEntry.isRunning(false)
      this.jobTimerList.push(dbEntry)
      this.createAutoComplete(dbEntry._id())
      this.saveAll()
    }.bind(this));
  }
  
  removeItemModal(that,data){
    $('#modalDelete').modal('show');
    that.itemToDelete(data)
  }

  removeItem(that,data){
    that.db.remove({ _id: data._id() }, {}, function (err, numRemoved) {});
    that.jobTimerList.remove(function (item) { return item._id() == data._id(); })
    $('#modalDelete').modal('hide');
  }

  pauseTimer(){
    var elementId = this.jobtimer.currentJobId
    this.currentJob().isRunning(false)
    this.jobtimer.stop()
  
    this.lastEntryId = elementId
    this.currentEntryId = undefined
    footer.refreshStatusBarEntry()
    this.currentJob(undefined)
    remote.getCurrentWindow().setOverlayIcon(null, "TimeTracker")
  }
  
  startTimer(that,data){
    if(that.jobtimer.isRunning() && that.jobtimer.currentJobId == data._id()){
      that.pauseTimer()
      return;
    }
    if(that.jobtimer.isRunning()){
      that.pauseTimer()
    }
    that.currentJob(data)
    var elementId = data._id()
    that.currentEntryId = elementId;
    data.isRunning(true)
  
    that.jobtimer.start(elementId, data.elapsedSeconds(), data.description())
    var overlayPath = path.join(__dirname,"../icons/overlay.png")
    remote.getCurrentWindow().setOverlayIcon(overlayPath, 'Aufgabe läuft...')
  }
  
  goToToday(){
    this.currentDate = new moment()
    this.currentDateChanged()
  }
  
  timerStep(updateValue){
    
    var match = ko.utils.arrayFirst(this.jobTimerList(), function(item) {
      return updateValue.jobId === item._id();
    });

    if(match){
      match.elapsedSeconds(updateValue.duration)  
      this.jobtimer.currentJobDescription = match.description()
    }

    this.saveAll()
    this.refreshTimeSum()
    this.refreshTray(updateValue.duration)
  }
  
  refreshTimeSum(){
    var timeSum = this.getTimeSum()
  
    $.find('#textTimeSum')[0].textContent = this.getTimeString(timeSum)
  }
  
  getTimeSum(){
    return _.sumBy(this.jobTimerList(), function(o) { return o.elapsedSeconds(); });
  }

  changeNoteClick(that,data){
    that.currentJob(data)
    $('#modalAddNote').modal('show')
  }
  
  refreshTray(elapsedTime){
    var tray = remote.getGlobal('tray');
    var timeSum = this.getTimeSum()
    tray.setToolTip("Ʃ "+this.getTimeString(timeSum)+", Aufgabe: "+ this.getTimeString(elapsedTime))
  }
  
  // trayContextMenu: remote.getGlobal('menu').buildFromTemplate([
  //     {id: 0, label: 'Weiter', click() {
  //       if(lastEntryId){
  //         var lastEntry = $('#'+lastEntryId)[0]
  //         var tmpMethod = startTimer.bind(lastEntry)
  //         tmpMethod()
  //       }
  //     }},
  //     {id: 1, label: 'Stopp', click() {
  //       self.pauseTimer()
  //     }},
  //     {type: 'separator'},
  //     {id: 2, label: 'Beenden', click() {
  //       let w = remote.getCurrentWindow()
  //       w.close()
  //     }}
  
  //   ])


}

module.exports = TimerList

