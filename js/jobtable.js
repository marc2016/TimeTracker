var remote = require('electron').remote;
var dt = require( 'datatables.net-bs4' )( $ );

var _ = require('lodash');
var toastr = require('toastr');
var moment = require('moment');
var momentDurationFormatSetup = require("moment-duration-format");

var headers = { "date": "Datum","description" : "Aufgabe", "projectName":"Projekt","formattedTime": "Dauer", "formattedTimeDeciaml": "Dauer (d)" };

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

    viewId:undefined,
    isBound: function() {
        return !!ko.dataFor(document.getElementById(viewId));
    },
    db: undefined,
    onLoad: function(database,databaseProjects){
        var Datastore = require('nedb')
        self.db = database;
        self.db_projects = databaseProjects
        var Table = require('table-builder');
        
        self.db.find({}, function (err, jobDocs) {
            var projectIds = _.map(jobDocs, 'projectId')
            self.db_projects.find({ _id: { $in: projectIds }}, function (err, projectDocs) {
                
                _.forEach(jobDocs, function(value){
                    var formatted = moment.duration(value.elapsedSeconds, "seconds").format("hh:mm:ss",{trim: false})
                    value.formattedTime = formatted
                    var decimal = moment.duration(value.elapsedSeconds, "seconds").format("h", 2)
                    value.formattedTimeDeciaml = decimal.replace('.',',')

                    value.projectName = "-"   
                    if(value.projectId != undefined) {
                        var project = _.find(projectDocs, {'_id':value.projectId})
                        if(project){
                            value.projectName = project.name
                        }
                    }
                })
    
                var htmlTable = new Table({'id': 'jobs', 'class': 'table table-striped table-bordered'})
                .setHeaders(headers) 
                .setData(jobDocs)
                .render()
                $('#table').html(htmlTable)
                var jobTable = $('#jobs').DataTable({
                    "language": {
                        "url": "resources/dataTables.german.lang"
                    },
                    drawCallback: function () {
                        var api = this.api();
                        var sum = _.sumBy(api.column( 4,  {"filter": "applied"} ).data(), function(element){
                            return parseFloat(element.replace(",","."))
                        })
                        $('#tableFooterLeft').html(
                          'Summe Dauer: '+sum.toFixed(2).replace(".",",") + ' h'
                        );
                      }
                });
                $('#table').on( 'click', 'tr', function () {
                    var rowData = jobTable.row( this ).data()
                    var dataObj = {
                        "date":rowData[0],
                        "description":rowData[1],
                        "project":rowData[2],
                        "duration":rowData[4]
                    }
                    navigator.clipboard.writeText(JSON.stringify(dataObj))
                    .then(() => {
                        toastr.info('In Zwischenablage kopiert...')
                    })
                    .catch(err => {
                        // This can happen if the user denies clipboard permissions:
                        console.error('Could not copy text: ', err);
                    });
                } );
            });
        });
    }
}