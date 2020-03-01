const electron = require('electron')
const app = require('electron').remote.app

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

    dataAccess.projectsChanged.subscribe(value => this.refreshProjectList())
    dataAccess.jobtypesChanged.subscribe(value => this.refreshJobtypeList())
  
    $('#timerList').load('pages/timerlist.html', function(){
      this.hide()

      this.currentDate = ko.observable(new moment())
      this.today = ko.observable(new moment())
      this.currentJob = ko.observable()
      this.currentJobForNote = ko.observable()
      this.currentJobForDuration = ko.observable()
      this.lastJobBeforeJobDurationChange = ko.observable()
      this.itemToDelete = ko.observable()
      this.itemToSync = ko.observable()
      
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
        // log.info("Job timer changed: "+child())
        this.saveAll()
      }.bind(this));

      this.currentDate.subscribe(this.currentDateChanged.bind(this))

      $('#textCurrentDate').datepicker({
        language: 'de',
        autoClose:true,
        todayButton: new Date(),
        maxDate: new Date(),
        onSelect:function onSelect(fd, date) {
          this.currentDate(moment(date))
        }.bind(this)
      })

    
      footer.onLoad(this.currentDate(), this.db, jobtimer)
      footer.leftFooterAction = this.goToToday

      app.on('browser-window-focus', function (event, win) {
        this.today(new moment())
      }.bind(this))

      this.jobtimer.timeSignal.subscribe(this.timerStep.bind(this))
      this.jobtimer.stopSignal.subscribe(this.timerStop.bind(this))
      this.jobtimer.startSignal.subscribe(this.timerStart.bind(this))

      this.handleModalChangeJobDuration()

      this.loaded = true
      if(this.callAfterLoad)
        this.callAfterLoad()
    }.bind(this))

    electron.ipcRenderer.on('newJob', function(event, jobDescription){
      this.addNewItem(jobDescription)
    }.bind(this))
    
  }

  async onLoad() {
    super.onLoad()

    $('#background').css('background-image', 'url('+store.get('backgroundSrc')+')')

    this.refreshProjectList()
    this.refreshJobtypeList()
    // var tray = remote.getGlobal('tray');
    // tray.setContextMenu(self.trayContextMenu)
  
    this.db.ensureIndex({ fieldName: '_id', unique: true }, function (err) {});
    this.db.ensureIndex({ fieldName: 'date' }, function (err) {});

    var docs = await this.db.find({date: this.currentDate().format('YYYY-MM-DD')})
    this.refreshJobTimerList(docs)
    this.refreshTimeSum()
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

  addNoneWorkingDayToday(){
    this.addNoneWorkingDay(new moment(),new moment())
  }

  addNoneWorkingDay(start, end){

  }

  syncEntryWithCheck(that,data){
    if(data.lastSync()) {
      $('#modalUploadEntryAgain').modal('show')
      that.itemToSync(data)
    } else {
      that.syncEntry(that, data)
    }
  }

  syncEntry(that,data){
    $('#modalUploadEntryAgain').modal('hide')
    try{
      sync.syncJob(data,that.projectList,that.jobtypeList)
    } catch(error){
      toastr.error("Beim Synchronisieren der Aufgabe ist ein Fehler aufgetreten.")
    }
  }

  saveJobDurationInput(data, that){
    if(event.keyCode === 13) {
      var jobId = $(data).attr('jobId')
      that.saveJobDuration(jobId, that)
    }
    
  }

  saveJobDurationButton(data, that){
    var jobId = $(data).attr('jobId')
    that.saveJobDuration(jobId, that)
  }

  saveJobDuration(jobId, that){
    var match = ko.utils.arrayFirst(that.jobTimerList(), function(item) {
      return item._id() == jobId;
    });
    var newDuration = $('#inputJobDuration')[0].value
    
    var time = utils.durationConvertBack(newDuration)

    if(time || time === 0){
      match.elapsedSeconds(time)
      $('#modalChangeJobDuration').modal('toggle');
    }

    if(!that.jobtimer.isRunning() && that.lastJobBeforeJobDurationChange()){
      var job = that.lastJobBeforeJobDurationChange()
      that.jobtimer.start(job._id(), job.elapsedSeconds(), job.description())
    }

    that.refreshTimeSum()
  }

  handleModalChangeJobDuration(){
    var that = this
    $('#modalChangeJobDuration').on('shown.bs.modal', function (event) {
      var button = $(event.relatedTarget)
      var duration = button.attr('duration')
      var jobId = button.attr('jobId')
      if(that.currentJob() && that.currentJob()._id() == jobId){
        that.lastJobBeforeJobDurationChange(that.currentJob())
        that.jobtimer.stop()
      }
      var modal = $(this)
      modal.find('.modal-body input').val(duration)
      $('#btnSaveDuration').attr('jobId', jobId)
      $('#inputJobDuration').attr('jobId', jobId)
      modal.find("#inputJobDuration").focus()
      modal.find("#inputJobDuration").select()
    })
  }
  async refreshProjectList(){
    var docs = await this.db_projects.find({active:true})
    docs = _.sortBy(docs, 'name')
    this.projectList.removeAll()
    ko.utils.arrayPushAll(this.projectList, docs)
  }
  async refreshJobtypeList(){
    var docs = await this.db_jobtypes.find({active:true})
    docs = _.sortBy(docs, 'name')
    this.jobtypeList.removeAll()
    ko.utils.arrayPushAll(this.jobtypeList, docs)
  }

  applySelectize() {
    $('select.projectSelect').not('.selectized').selectize({
      placeholder: 'Projekt auswählen...'
    })
    $('select.jobtypeSelect').not('.selectized').selectize({
      placeholder: 'Art der Aufgabe auswählen...'
    })
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
    this.applySelectize()
  }
  
  async currentDateChanged(value){
    this.saveAll()
    var lastEntryId = this.currentEntryId
    // $.find('#textCurrentDate')[0].value = this.currentDate().format('DD.MM.YYYY')
    var docs = await this.db.find({date: value.format('YYYY-MM-DD')})
    this.refreshJobTimerList(docs)
    this.refreshTimeSum()
    footer.initChart(value)
  }
  
  nextDay(){
    this.currentDate(this.currentDate().add(1,'days'))
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

  
  async transferEntry(that,data){
    var newDate = new moment()
    var newEntry = {jobNote:data.jobNote(), jobtypeId: data.jobtypeId(), projectId: data.projectId(),elapsedSeconds:0, description:data.description(), date:newDate.format('YYYY-MM-DD'), billable:that.billable(), lastSync: ""}
    await that.db.insert(newEntry)
    that.currentDate(newDate)
  }
  
  previousDay(){
    this.currentDate(this.currentDate().subtract(1,'days'))
  }
  
  async saveAll(){
    await _.forEach(this.jobTimerList(), async function (element) {
      await this.db.update({ _id:element._id() }, { $set: { billable: element.billable(), lastSync: element.lastSync(), jobNote: element.jobNote(), description: element.description(), elapsedSeconds: element.elapsedSeconds(), projectId: element.projectId(), jobtypeId: element.jobtypeId() } },{ multi: false })
    }.bind(this))
    
    this.db.nedb.persistence.compactDatafile()

    this.createAutoComplete()
  }
  
  async createAutoComplete(entryId){
    var docs = await this.db.find({})
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
    
  }

  async addNewItem(jobDescription){
    if(!jobDescription){
      jobDescription = ""
    }
    var newEntry = {jobNote:"", jobtypeId: "", projectId: "",elapsedSeconds:0, description:jobDescription, date:this.currentDate().format('YYYY-MM-DD'), lastSync: "", billable: false}
    var dbEntry = await this.db.insert(newEntry)
    dbEntry = ko.mapping.fromJS(dbEntry)
    dbEntry.isRunning = ko.observable()
    dbEntry.isRunning(false)
    this.jobTimerList.push(dbEntry)
    this.createAutoComplete(dbEntry._id())
    this.applySelectize()
    await this.saveAll()
  }
  
  removeItemModal(that,data){
    that.itemToDelete(data)
    $('#modalDeleteEntry').modal('show');
  }

  async removeItem(that,data){
    await that.db.remove({ _id: data._id() }, {})
    that.jobTimerList.remove(function (item) { return item._id() == data._id(); })
    $('#modalDeleteEntry').modal('hide');
  }

  pauseTimer(){
    this.jobtimer.stop()
  }

  timerStop(currentData){
    var elementId = this.jobtimer.currentJobId
    this.currentJob().isRunning(false)
    this.lastEntryId = elementId
    this.currentEntryId = undefined
    footer.refreshStatusBarEntry()
    this.currentJob(undefined)
    remote.getCurrentWindow().setOverlayIcon(null, "TimeTracker")
  }

  timerStart(currentData){
    var match = ko.utils.arrayFirst(this.jobTimerList(), function(item) {
      return currentData.jobId === item._id();
    });
    match.isRunning(true)
    this.currentEntryId = match._id();
    this.currentJob(match)
    var overlayPath = path.join(__dirname,"../icons/overlay.png")
    remote.getCurrentWindow().setOverlayIcon(overlayPath, 'Aufgabe läuft...')
  }

  
  startTimer(that,data){
    if(that.jobtimer.isRunning() && that.jobtimer.currentJobId == data._id()){
      that.pauseTimer()
      return;
    }
    if(that.jobtimer.isRunning()){
      that.pauseTimer()
    }
    
    that.jobtimer.start(data._id(), data.elapsedSeconds(), data.description())
    
  }
  
  goToToday(){
    this.currentDate(new moment())
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
    that.currentJobForNote(data)
    $('#modalAddNote').modal('show')
  }

  changeDurationClick(that,data){
    that.currentJobForDuration(data)
    var button = $(event.relatedTarget)
    var duration = button.attr('duration')
    var jobId = button.attr('jobId')
    var modal = $(this)
    modal.find('.modal-body input').val(duration)
    $('#btnSaveDuration').attr('jobId', jobId)
    document.getElementById("inputJobDuration").focus();
    $('#modalChangeJobDuration').modal('show')
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

