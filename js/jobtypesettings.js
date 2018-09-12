var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')

class JobtypeSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
        this.refreshJobtypeList()
    }

    constructor(views, jobtypeDatabase){
        super(views,jobtypeDatabase)
        this.jobtypeList = ko.observableArray()
        this.selectedJobtype = ko.observable()
        this.self = this
    }

    saveJobtypes() {
        
        ko.utils.arrayForEach(this.jobtypeList(), function (element) {
            this.database.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ }, function (err, numReplaced) {} )
        })
        this.database.persistence.compactDatafile()
    }

    addNewJobtype(){
        var newJobtypeName = document.getElementById('inputNewJobtypeName')
        
        var newJobtype = {name:newJobtypeName.value, active:true}
        var that = this
        this.database.insert(newJobtype, function (err, dbEntry) {
            that.refreshJobtypeList()
            $('#modalAddNewJobtype').modal('toggle');
        });
    }

    refreshJobtypeList(){
        var that = this
        this.jobtypeList.removeAll()
        this.database.find({}).sort({ name: 1 }).exec( function (err, docs) {
            var observableDocs = ko.mapping.fromJS(docs,that.jobtypeList)
            _.forEach(observableDocs(), function(element){
                if(!element.externalId){
                    element.externalId = ko.observable()
                }
            })
            ko.utils.arrayPushAll(that.jobtypeList, observableDocs())
        })
    }

    clickSelectJobtype(that, data){
        that.selectedJobtype(data)
    }
}

module.exports = JobtypeSettings;