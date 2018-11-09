var dataAccess = require('./dataaccess.js')
var procas = require('./sync/procassync.js')
var Client = require('node-rest-client').Client;
var ko = require('knockout')
ko.mapping = require('knockout-mapping')
var log = require('electron-log');
var toastr = require('toastr')
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
  "extendedTimeOut": "5000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}
const Store = require('electron-store');
const store = new Store();

class Sync {

    constructor(){
      if(Sync.instance){
        return Sync.instance
      }

      
      Sync.instance = this
      this.syncSystem = procas
      this.client = new Client()
    }

    login(password, accountName, userEmail){
        if(!this.baseUrl){
            toastr.error('Die Basis URL des Rest Service wurde nicht gesetzt.')
            return;  
        }
        var user = store.get('syncUsername')
        var url = this.syncSystem.getDataLogin(this.baseUrl,user,password)

        this.client.get(url, function (data, response) {
            if(data.status == 500){
                toastr.error('Anmeldung fehlgeschlagen. Bitte Daten prüfen.')  
                return
            }            
            var syncResponse = this.syncSystem.handleResponseLogin(data,response)

            accountName(syncResponse.firstName+" "+syncResponse.lastName)
            userEmail(syncResponse.email)

            toastr.success('Anmeldung erfolgreich als '+accountName()+'.')
        }.bind(this));
    }
    
    checkLogin(){
        return this.syncSystem.checkLogin()
    }
        
    syncJobtypes(){
        if(!this.baseUrl){
            toastr.error('Die Basis URL des Rest Service wurde nicht gesetzt.')
            return;  
        }
        if(!this.checkLogin()){
            toastr.error('Sie sind nicht am externen System angemeldet.')
            return
        }

        var requestData = this.syncSystem.getDataJobtypes(this.baseUrl)
        this.client.get(requestData.url,requestData.args, function (data, response) {
            if(data.status == 500){
                toastr.error('Aufgaben Arten wurden nicht synchronisiert.')
                return
            }
            
            var responseData = this.syncSystem.handleResponseJobtypes

            var countOfUpdates = 0;
            _.forEach(responseData, function(element) {
                dataAccess.getDb('jobtypes').update({ externalId: element.externalId }, { externalId: element.externalId, name:element.name, active: element.active }, { upsert: true }, function (err, numReplaced, upsert) {
                    countOfUpdates += numReplaced
                });
                dataAccess.getDb('jobtypes').persistence.compactDatafile()
            })
            
            toastr.success('Aufgaben Arten wurden synchronisiert.')
        }.bind(this));
    }
    
    syncProjects(){
        if(!this.baseUrl){
            toastr.error('Die Basis URL des Rest Service wurde nicht gesetzt.')
            return;  
        }
        if(!this.checkLogin()){
            toastr.error('Sie sind nicht am externen System angemeldet.')
          return
        }

        var requestData = this.syncSystem.getDataProjects(this.baseUrl)

        log.info("Project sync URL: "+requestData.url)
        
        this.client.get(requestData.url,requestData.args, function (data, response) {
            if(data.status == 500){
                toastr.error('Projekte wurden nicht synchronisiert.')
                return
            }

            var responseData = this.syncSystem.handleResponseProjects(data,response)

            var countOfUpdates = 0;
            _.forEach(responseData, function(element) {
            dataAccess.getDb('projects').update({ externalId: element.externalId }, { externalId: element.externalId, name:element.name, active: element.active }, { upsert: true }, function (err, numReplaced, upsert) {
                countOfUpdates += numReplaced
            });
            dataAccess.getDb('projects').persistence.compactDatafile()
            })
            
            toastr.success('Projekte wurden synchronisiert.')
        }.bind(this))
        
    }

    syncJob(job,projectList,jobtypeList){
        if(!this.baseUrl){
            toastr.error('Die Basis URL des Rest Service wurde nicht gesetzt.')
            return;  
        }
        if(!this.checkLogin()){
            toastr.error('Sie sind nicht am externen System angemeldet.')
            return
        }

        var projectMatch = ko.utils.arrayFirst(projectList(), function(item) {
            return item._id == job.projectId();
        });
        var projectExternalId = projectMatch.externalId
        if(!projectExternalId) {
            toastr.warning("Externe ID des Projektes ist nicht gesetzt.")
        }
        var jobtypeMatch = ko.utils.arrayFirst(jobtypeList(), function(item) {
            return item._id == job.jobtypeId();
        });
        var jobTypeId = jobtypeMatch.externalId
        if(!jobTypeId) {
            toastr.warning("Externe ID der Aufgaben Art ist nicht gesetzt.")
        }

        var jobToSync = ko.mapping.toJS(job);

        jobToSync.externalJobtypeId = jobTypeId
        jobToSync.externalProjectId = projectExternalId
          
        var requestData = this.syncSystem.getDataSyncJob(this.baseUrl, jobToSync)
    
        log.info("Job sync url: "+requestData.url)
        log.info("Job syn body: "+requestData.args.data)
        
        this.client.post(requestData.url, requestData.args, function (postData, response) {
            if(postData.status == 500){
              toastr.error('Synchronisation der Aufgabe ist fehlgeschlagen.')  
              return
            }

            this.syncSystem.handleResponseSyncJob()
            
            job.lastSync(moment().format('DD.MM.YYYY, HH:mm:ss'))
            toastr.success('Aufgabe wurde erfolgreich synchronisiert.')
        }.bind(this));

    }
  
}

const instance = new Sync();

module.exports = instance;