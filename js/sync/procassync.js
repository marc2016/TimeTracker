var dataAccess = require('../dataaccess.js')
var Client = require('node-rest-client').Client;
var buildUrl = require('build-url');
var log = require('electron-log');
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

class ProcasSync {

    constructor(){
      if(ProcasSync.instance){
        return ProcasSync.instance
      }

      this.cookie = undefined
      ProcasSync.instance = this
    }


    getDataLogin(baseUrl, user, password){
        this.cookie = undefined
        
        var url = buildUrl(baseUrl, {
            path: 'auth/user',
            queryParams: {
                accountName: this._getBase64String(user),
                passwort: this._getBase64String(password)
            }
        });

        return url
    }

    handleResponseLogin(data,response){
        var responseData = {
            firstName: data.vorname,
            lastName: data.name,
            email: data.email
        }
        this.cookie = response.headers['set-cookie'][0].split(';')[0]
            
        return responseData;
    }
    
    checkLogin(){
        if(!this.cookie){
            return false;
        }
        return true;
    }

    getDataJobtypes(baseUrl){
        var url = buildUrl(baseUrl, {
            path: 'activity/list'
        });
        var args = {
            headers: { "Cookie" : this.cookie }
        }
        var data = {
            url: url,
            args: args
        }
        return data
    }
        
    handleResponseJobtypes(data,response){
        var responseData = []
        _.forEach(data, function(element) {
            var resultElement = {
                externalId: element.id,
                name:element.beschreibung,
                active: true
            }
            responseData.push(resultElement)
        })
        
        return responseData
    }

    getDataProjects(baseUrl){
        var now = new moment();
        var month = now.format('MM');
        var year = now.format('YYYY');
        
        var url = buildUrl(baseUrl, {
            path: 'project/list',
            queryParams: {
                month: month,
                year: year
            }
        });

        var args = {
            headers: { "Cookie" : this.cookie }
        }

        var requestData = {
            url: url,
            args: args
        }

        return requestData
    }
    
    handleResponseProjects(data, response){
        var responseData = []
        
        _.forEach(data, function(element) {
            var resultElement = {
                externalId: element.value,
                name:element.representation,
                active: true
            }
            responseData.push(resultElement)
        })

        return responseData
    }

    getDataSyncJob(baseUrl, job){
        var date = moment(job.date, "YYYY-MM-DD").format('D.M.YYYY');

        var duration =  job.duration
        duration = duration.replace('.',',')

        var billable = undefined
        if(job.billable){
            billable = 'T'
        } else {
            billable = 'F'
        }

        var url = buildUrl(baseUrl, {
            path: 'timesheet/save',
        });

        var syncJobParameter = {}
        _.set(syncJobParameter, "arbeitstag", date)
        _.set(syncJobParameter, "arbeitszeit", duration)
        _.set(syncJobParameter, "beschreibung", job.description)
        _.set(syncJobParameter, "projekt_id", job.externalProjectId)
        _.set(syncJobParameter, "taetigkeit_id", job.externalJobtypeId)
        _.set(syncJobParameter, "projektzusatz", job.jobNote)
        _.set(syncJobParameter, "abrechenbar", billable)
        
        var args = {
            data: JSON.stringify(syncJobParameter),
            headers: {
              "Cookie": this.cookie,
              "content-type": "application/json"
            }
          }

        var requestData = {
            url: url,
            args: args
        }

        return requestData
    }

    handleResponseSyncJob(data,response){
        return
    }

    _getBase64String(value) {
        var base64Value = window.btoa(value)
        return base64Value.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/, '');
    }
  }
  const instance = new ProcasSync();
  
  module.exports = instance;