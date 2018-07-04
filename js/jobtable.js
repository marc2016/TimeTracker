var remote = require('electron').remote;
var dt = require( 'datatables.net-bs4' )( $ );

var _ = require('lodash');
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");

var headers = { "date": "Datum","description" : "Aufgabe", "projectName":"Projekt","formattedTime": "Dauer", "formattedTimeDeciaml": "Dauer (d)" };

jQuery.fn.dataTable.Api.register( 'sum()', function ( ) {
    return this.flatten().reduce( function ( a, b ) {
        if ( typeof a === 'string' ) {
            a = a.replace(/[^\d.-]/g, '') * 1;
        }
        if ( typeof b === 'string' ) {
            b = b.replace(/[^\d.-]/g, '') * 1;
        }
 
        return a + b;
    }, 0 );
} );

var self = module.exports = {

    onLoad: function(){
        var Datastore = require('nedb')
        var db = new Datastore({ filename: 'db', autoload: true });
        var db_projects = new Datastore({ filename: 'db_projects', autoload: true });
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
    
                var htmlTable = new Table({'id': 'jobs', 'class': 'table table-striped table-bordered'})
                .setHeaders(headers) 
                .setData(jobDocs)
                .render()
                $('#table').html(htmlTable)
                $('#jobs').DataTable({
                    "language": {
                        "url": "resources/dataTables.german.lang"
                    },
                    drawCallback: function () {
                        var api = this.api();
                        $('#tableFooterLeft').html(
                          'Summe Dauer: '+api.column( 4,  {"filter": "applied"} ).data().sum() + ' h'
                        );
                      }
                });
            });
        });
    }
}