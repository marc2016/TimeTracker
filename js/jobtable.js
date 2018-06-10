var remote = require('electron').remote;
var dt = require( 'datatables.net' )();
var db = remote.getGlobal('db');
var db_projects = remote.getGlobal('db_projects');
var _ = require('lodash');
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");

var headers = { "description" : "Aufgabe", "formattedTime": "Dauer", "formattedTimeDeciaml": "Dauer (d)" };

var self = module.exports = {

    onLoad: function(){
        var Table = require('table-builder');
        db.find({}, function (err, docs) {
            var projectIds = _.map(docs, 'projectId')
            var jobDocs = docs
            db_projects.find({ _id: { $in: projectIds }}, function (err, docs) {
                _.forEach(docs, function(value){
                    var formatted = moment.duration(value.elapsedSeconds, "seconds").format("hh:mm:ss",{trim: false})
                    value.formattedTime = formatted
                    var decimal = moment.duration(value.elapsedSeconds, "seconds").format("h", 2)
                    value.formattedTimeDeciaml = decimal
                })
    
                var htmlTable = new Table({'id': 'jobs'})
                .setHeaders(headers) 
                .setData(docs)
                .render()
                $('#table').html(htmlTable)
                $('#jobs').DataTable();
            });
        });
    }
}