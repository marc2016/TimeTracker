var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')
var dataAccess = require('./dataaccess.js')

class ProjectsSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
        this.refreshProjectList()
    }

    constructor(views){
        super(views,dataAccess.getDb('projects'))
        this.projectList = ko.observableArray()
        this.selectedProject = ko.observable()
        this.self = this
    }

    async saveProjects() {
        var that = this
        await _.forEach(this.projectList(), async function (element) {
            await that.database.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ })
        })
        this.database.nedb.persistence.compactDatafile()
    }

    async addNewProject(){
        var newProjectName = document.getElementById('inputNewProjectName')
        
        var newProject = {name:newProjectName.value, active:true}
        var that = this
        var dbEntry = await this.database.insert(newProject)
        that.refreshProjectList()
        $('#modalAddNewProject').modal('toggle');
    }

    async refreshProjectList(){
        var that = this
        this.projectList.removeAll()
        var docs = await this.database.find({})
        docs = _.sortBy(docs, [function(o) { return o.name? o.name.toUpperCase() : undefined }])
        var observableDocs = ko.mapping.fromJS(docs,that.projectList)
        _.forEach(observableDocs(), function(element){
            if(!element.externalId){
                element.externalId = ko.observable()
            }
        })
        ko.utils.arrayPushAll(that.projectList, observableDocs())
    }

    clickSelectProject(that, data){
        that.selectedProject(data)
    }
}

module.exports = ProjectsSettings;