var remote = require('electron').remote;
var BaseViewModel = require('./base.js')
var ko = require('knockout');

var _ = require('lodash');
var toastr = require('toastr');
//var moment = require('moment');
var Moment = require('moment-business-days');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
var Holidays = require('date-holidays')

var utils = require('./utils')
const Store = require('electron-store');

var log = require('electron-log');

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

        this.columns = [
            { title:"Datum", data: 'date()', filter: true},
            { title:"Aufgabe", data: 'description()', "width": "80%", filter: true},
            { title:"Projekt", data: 'projectId()', filter: true},
            { title:"Art", data: 'jobtypeId()', filter: true},
            { title:"Dauer", data: 'formattedTime()'},
            { title:"Dauer (d)", data: 'formattedTimeDeciaml()', name:'durationDecimal'},
            { title:"Sync", data: 'lastSync()'},
            { title:"Aktion", data: null, defaultContent: '<a class="btn btn-default btn-sm table-btn" ><i class="fas fa-sync-alt" title="Synchronisieren"></i></a>'}
        ]

        this.db = dataAccess.getDb('jobs');
        this.db_projects = dataAccess.getDb('projects')
        this.db_jobtypes = dataAccess.getDb('jobtypes')

        this.jobList = ko.observableArray()
        this.currentRange = ko.observable(moment().startOf('month').range('month'))

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

            if(this.koWatcher){
                this.koWatcher.dispose()
            }
            this.koWatcher = ko.watch(this.jobList, { depth: -1 }, function(parents, child, item) {
                log.info("Job changed: "+child())
                if(!item){
                    this.save(parents[0])
                }
            }.bind(this));
            
            this.currentRange.subscribe(this.refreshTable.bind(this));

            this.jobTable = undefined

            // var that = this
            // $('#table').on( 'click', 'tr', function () {
            //     var rowData = that.jobTable.row( this ).data()
            //     var dataObj = {
            //         "date":rowData[0],
            //         "description":rowData[1],
            //         "project":rowData[2],
            //         "duration":rowData[4]
            //     }
            //     navigator.clipboard.writeText(JSON.stringify(dataObj))
            //     .then(() => {
            //         toastr.info('In Zwischenablage kopiert...')
            //     })
            //     .catch(err => {
            //         // This can happen if the user denies clipboard permissions:
            //         console.error('Could not copy text: ', err);
            //     });
            // } );
            
            this.initTable()

            this.loaded = true
        }.bind(this))
    }

    tableCellChanged (updatedCell, updatedRow, oldValue) {
        console.log("The new value for the cell is: " + updatedCell.data());
        console.log("The values for each cell in that row are: " + updatedRow.data());
    }

    async save(job){
        log.info("Save method is called.")
        await this.db.update({ _id:job._id() }, { $set: { billable: job.billable(), lastSync: job.lastSync(), jobNote: job.jobNote(), description: job.description(), elapsedSeconds: job.elapsedSeconds(), projectId: job.projectId(), jobtypeId: job.jobtypeId() } },{ multi: false })
        this.db.nedb.persistence.compactDatafile()
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

    async refreshTable(currentRange){
        this.projectDocs = await this.db_projects.find({})
        this.jobtypeDocs = await this.db_jobtypes.find({})

        var days = Array.from(currentRange.by('day'));
        var dates = days.map(m => m.format('YYYY-MM-DD'))
        var jobDocs = await this.db.find({date: { $in: dates}})
        var projectIds = _.map(jobDocs, 'projectId')
            
        _.forEach(jobDocs, function(value){
            var formatted = moment.duration(value.elapsedSeconds, "seconds").format("hh:mm:ss",{trim: false})
            value.formattedTime = formatted
            
            var decimal = moment.duration(value.elapsedSeconds, "seconds").format("h", 2)
            decimal = utils.roundDuration(this.store.get('roundDuration','round'),parseFloat(decimal.replace(",",".")))
            value.formattedTimeDeciaml = decimal.replace('.',',')
        }.bind(this))
        
        this.jobList.removeAll()
        var tmpJobList = ko.mapping.fromJS(jobDocs)
        ko.utils.arrayPushAll(this.jobList, tmpJobList())
    }

    async initTable(){

        this.projectDocs = await this.db_projects.find({})
        this.jobtypeDocs = await this.db_jobtypes.find({})

        var that = this
        this.jobTable = $('#jobs').DataTable({
            rowId: '_id()',
            columns: this.columns,
            columnDefs:[
                {
                    "data": null,
                    "defaultContent": "-",
                    "targets": "_all"
                },
                {
                    targets:0,
                    render: function(data){
                        return moment(data, 'YYYY-MM-DD').format('DD.MM.YYYY');
                    }
                },
                {
                    targets: 2,
                    render: function(data){
                        var project = _.find(that.projectDocs, {'_id':data})
                        if(project){
                            return project.name
                        }
                    }
                },
                {
                    targets: 3,
                    render: function(data){
                        var jobtype = _.find(that.jobtypeDocs, {'_id':data})
                        if(jobtype){
                            return jobtype.name
                        }
                    }
                }
            ],
            orderCellsTop: true,
            "language": {
                "url": "resources/dataTables.german.lang"
            },
            responsive: true,
            drawCallback: function () {
                var api = this.api();
                var sum = _.sumBy(api.column( 'durationDecimal:name',  {"filter": "applied"} ).data(), function(element){
                    return parseFloat(element.replace(",","."))
                })
                
                $('#tableFooterLeft').html(
                    'Summe Dauer: '+sum.toFixed(2).replace(".",",") + ' h ' + '('+moment().startOf('month').businessDiff(moment())*8+'/'+moment().endOf('month').businessDaysIntoMonth()*8+' h)'
                );
            }
        });
        
        this.jobList.subscribe(function(changes) {
            _.forEach(changes, function(element){
                switch(element.status) {
                    case "added":
                        var node = this.jobTable.row.add( element.value ).draw().node()
                        ko.applyBindings(this,node)
                        break
                    case "deleted":
                        var row = this.jobTable.row('#'+element.value._id())
                        var node = row.node()
                        ko.cleanNode(node)
                        row.remove().draw();
                        break
                }
            }.bind(this))
            

        }.bind(this), null, "arrayChange")

        var projectValues = _.map(this.projectDocs, function(value){
            return {
                "value": value._id,
                "display": value.name
            }
        })
        projectValues = _.sortBy(projectValues, ['display'])

        var jobtypeValues = _.map(this.jobtypeDocs, function(value){
            return {
                "value": value._id,
                "display": value.name
            }
        })
        jobtypeValues = _.sortBy(jobtypeValues, ['display'])

        this.jobTable.MakeCellsEditable({
            "inputCss": "form-control table-input",
            "selectCss": "form-control selectpicker table-select",
            "onUpdate": this.tableCellChanged,
            "inputTypes": [
                {
                    "column": 0,
                    "type": "datepicker",
                },
                {
                    "column":2, 
                    "type": "list",
                    "options":projectValues
                },
                {
                    "column":3, 
                    "type": "list",
                    "options":jobtypeValues
                }
            ]
        });
    }

    onLoad() {
        super.onLoad()

        $.find('#textCurrentMonth')[0].value = this.currentRange().start.format('DD.MM.YY') + "-" + this.currentRange().end.format('DD.MM.YY')
        $('#textCurrentMonth').datepicker({
            range: true,
            language: 'de',
            autoClose: true,
            todayButton: false,
            dateFormat: 'dd.mm.yy',
            onSelect:function onSelect(fd, date) {
                if(date && date.length == 2){
                    this.currentRange(moment.range(date[0],date[1]))
                }
            }.bind(this)
        })

        var that = this
        if(!this.onlyOnce){
            $('#table thead tr').clone(true).appendTo( '#table thead' );
            $('#table thead tr:eq(1) th').each( function (i) {
                var title = $(this).text();
                var column = _.find(that.columns, value => value.title == title)
                if(column.filter){
                    $(this).html( '<input type="text" class="form-control" placeholder="Filtern nach '+title+'" />' );
        
                    $( 'input', this ).on( 'keyup change', function () {
                        if ( that.jobTable.column(i).search() !== this.value ) {
                            that.jobTable
                                .column(i)
                                .search( this.value )
                                .draw();
                        }
                    } );    
                } else {
                    $(this).html( '' );
                }
                
            } );
            this.onlyOnce = true
        }
        
        this.refreshTable(this.currentRange())
    }
}

module.exports = JobTable
