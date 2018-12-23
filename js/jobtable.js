var remote = require('electron').remote;
var BaseViewModel = require('./base.js')
var ko = require('knockout');
var dt = require( 'datatables.net-bs4' )( $ );

var _ = require('lodash');
var toastr = require('toastr');
//var moment = require('moment');
var moment = require('moment-business-days');
var Holidays = require('date-holidays')

var utils = require('./utils')
const Store = require('electron-store');


var dataAccess = require('./dataaccess.js')

var headers = { "date": "Datum","description" : "Aufgabe", "projectName":"Projekt", "jobType":"Art","formattedTime": "Dauer", "formattedTimeDeciaml": "Dauer (d)","lastSync":"Sync." };

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

class JobTable extends BaseViewModel {

    constructor(views){
        super(views)

        $('#jobtable').load('pages/jobtable.html', function(){
            this.hide()

            this.store = new Store();
            var country = this.store.get('selectedCountry','DE')
            var state = this.store.get('selectedState','NW')
            var hd = new Holidays(country,state)
            var holidays = _.map(hd.getHolidays(), function(value){ return value.date.split(" ")[0] })
            moment.updateLocale('de', {
                holidays: holidays,
                holidayFormat: 'YYYY-MM-DD'
             });

            this.currentMonth = ko.observable(moment())
            this.currentMonth.subscribe(this.refreshTable.bind(this));

            this.jobTable = undefined

            var that = this
            $('#table').on( 'click', 'tr', function () {
                var rowData = that.jobTable.row( this ).data()
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
            
            this.loaded = true
        }.bind(this))
    }

    show(){
        if(!this.loaded){
          this.callAfterLoad = this.show
          return
        }
        this.onLoad()
        $('#jobtable').removeClass('invisible')
    }
    
    hide(){
        $('#jobtable').addClass('invisible')
    }
    
    getMenu(){
        return [
            {
              icon: 'fas fa-sync-alt',
              name: 'Alle synchronisieren',
              method: this.syncAllFilteredJobs.bind(this)
            }
          ]
    }

    syncAllFilteredJobs(){
        console.log('Sync all')
    }

    async refreshTable(currentDate){
        this.db = dataAccess.getDb('jobs');
        this.db_projects = dataAccess.getDb('projects')
        this.db_jobtypes = dataAccess.getDb('jobtypes')
        var Table = require('table-builder');
        
        var regex =  new RegExp(currentDate.format('YYYY-MM') + '-(.*)');
        var jobDocs = await this.db.find({date: regex})
        var projectIds = _.map(jobDocs, 'projectId')
        var projectDocs = await this.db_projects.find({ _id: { $in: projectIds }})
        var jobtypeDocs = await this.db_jobtypes.find({})
            
        _.forEach(jobDocs, function(value){
            var formatted = moment.duration(value.elapsedSeconds, "seconds").format("hh:mm:ss",{trim: false})
            value.formattedTime = formatted
            
            var decimal = moment.duration(value.elapsedSeconds, "seconds").format("h", 2)
            decimal = utils.roundDuration(this.store.get('roundDuration','round'),parseFloat(decimal.replace(",",".")))
            value.formattedTimeDeciaml = decimal.replace('.',',')

            value.projectName = "-"   
            if(value.projectId != undefined) {
                var project = _.find(projectDocs, {'_id':value.projectId})
                if(project){
                    value.projectName = project.name
                }
            }
            value.jobType = "-"
            if(value.jobtypeId != undefined) {
                var jobType = _.find(jobtypeDocs, {'_id':value.jobtypeId})
                if(jobType){
                    value.jobType = jobType.name
                }
            }
        }.bind(this))
        
        var that = this
        var htmlTable = new Table({'id': 'jobs', 'class': 'table table-striped table-bordered'})
        .setPrism('lastSync', function (cellData) {
            if(cellData){
                return cellData+ '<i class="fas fa-check-circle"></i>'
            }
            return '<i class="fas fa-times-circle"></i>'
        })
        .setHeaders(headers) 
        .setData(jobDocs)
        .render()

        $('#table').html(htmlTable)
        $('#table thead tr').clone(true).appendTo( '#table thead' );
        $('#table thead tr:eq(1) th').each( function (i) {
            var title = $(this).text();
            $(this).html( '<input type="text" placeholder="Filtern nach '+title+'" />' );
    
            $( 'input', this ).on( 'keyup change', function () {
                if ( that.jobTable.column(i).search() !== this.value ) {
                    that.jobTable
                        .column(i)
                        .search( this.value )
                        .draw();
                }
            } );
        } );
        this.jobTable = $('#jobs').DataTable({
            orderCellsTop: true,
            "language": {
                "url": "resources/dataTables.german.lang"
            },
            responsive: true,
            "columnDefs": [
                { "width": "70px", "targets": 0 }
            ],
            drawCallback: function () {
                var api = this.api();
                var sum = _.sumBy(api.column( api.columns()[0].length-2,  {"filter": "applied"} ).data(), function(element){
                    return parseFloat(element.replace(",","."))
                })
                
                $('#tableFooterLeft').html(
                    'Summe Dauer: '+sum.toFixed(2).replace(".",",") + ' h ' + '('+moment().startOf('month').businessDiff(moment())*8+'/'+moment().endOf('month').businessDaysIntoMonth()*8+' h)'
                );
            }
        });
    }

    onLoad() {
        super.onLoad()

        $.find('#textCurrentMonth')[0].value = this.currentMonth().format('MMMM YYYY')
        $('#textCurrentMonth').datepicker({
            language: 'de',
            autoClose: true,
            todayButton: new Date(),
            onSelect:function onSelect(fd, date) {
                this.currentMonth(moment(date))
            }.bind(this)
        })

        this.refreshTable(this.currentMonth())


        
       
    }
}

module.exports = JobTable
