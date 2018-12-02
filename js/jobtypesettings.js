var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')
var dataAccess = require('./dataaccess.js')

class JobtypeSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
        this.refreshJobtypeList()
    }

    constructor(views){
        super(views,dataAccess.getDb('jobtypes'))
        this.jobtypeList = ko.observableArray()
        this.selectedJobtype = ko.observable()
        this.self = this
    }

    async saveJobtypes() {
        var that = this
        await _.forEach(this.jobtypeList(), async function (element) {
            await that.database.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ })
        })
        this.database.nedb.persistence.compactDatafile()
    }

    async addNewJobtype(){
        var newJobtypeName = document.getElementById('inputNewJobtypeName')
        
        var newJobtype = {name:newJobtypeName.value, active:true}
        var that = this
        var dbEntry = await this.database.insert(newJobtype)
        that.refreshJobtypeList()
        $('#modalAddNewJobtype').modal('toggle');
    }

    async refreshJobtypeList(){
        var that = this
        this.jobtypeList.removeAll()
        var docs = await this.database.find({})
        var observableDocs = ko.mapping.fromJS(docs,that.jobtypeList)
        _.forEach(observableDocs(), function(element){
            if(!element.externalId){
                element.externalId = ko.observable()
            }
        })
        ko.utils.arrayPushAll(that.jobtypeList, observableDocs())
    }

    clickSelectJobtype(that, data){
        that.selectedJobtype(data)
    }
}

module.exports = JobtypeSettings;