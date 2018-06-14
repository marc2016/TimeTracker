var remote = require('electron').remote;
var dt = require( 'datatables.net' )();
var db = remote.getGlobal('db');
var db_projects = remote.getGlobal('db_projects');
var _ = require('lodash');
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");

var headers = { "date": "Datum","description" : "Aufgabe", "projectName":"Projekt","formattedTime": "Dauer", "formattedTimeDeciaml": "Dauer (d)" };

var self = module.exports = {

    onLoad: function(){
        var Table = require('table-builder');
        db.find({}, function (err, jobDocs) {
            var projectIds = _.map(jobDocs, 'projectId')
            db_projects.find({ _id: { $in: projectIds }}, function (err, projectDocs) {
                
                _.forEach(jobDocs, function(value){
                    var formatted = moment.duration(value.elapsedSeconds, "seconds").format("hh:mm:ss",{trim: false})
                    value.formattedTime = formatted
                    var decimal = moment.duration(value.elapsedSeconds, "seconds").format("h", 2)
                    value.formattedTimeDeciaml = decimal

                    value.projectName = "-"   
                    if(value.projectId != undefined) {
                        var project = _.find(projectDocs, {'_id':value.projectId})
                        value.projectName = project.name   
                    }
                })
    
                var htmlTable = new Table({'id': 'jobs'})
                .setHeaders(headers) 
                .setData(jobDocs)
                .render()
                $('#table').html(htmlTable)
                $('#jobs').DataTable();
            });
        });
    }
}