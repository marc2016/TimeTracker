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

    saveProjects() {
        var that = this
        ko.utils.arrayForEach(this.projectList(), function (element) {
            that.database.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ }, function (err, numReplaced) {} )
        })
        this.database.persistence.compactDatafile()
    }

    addNewProject(){
        var newProjectName = document.getElementById('inputNewProjectName')
        
        var newProject = {name:newProjectName.value, active:true}
        var that = this
        this.database.insert(newProject, function (err, dbEntry) {
            that.refreshProjectList()
            $('#modalAddNewProject').modal('toggle');
        });
    }

    refreshProjectList(){
        var that = this
        this.projectList.removeAll()
        this.database.find({}).sort({ name: 1 }).exec( function (err, docs) {
            var observableDocs = ko.mapping.fromJS(docs,that.projectList)
            _.forEach(observableDocs(), function(element){
                if(!element.externalId){
                    element.externalId = ko.observable()
                }
            })
            ko.utils.arrayPushAll(that.projectList, observableDocs())
        })
    }

    clickSelectProject(that, data){
        that.selectedProject(data)
    }
}

module.exports = ProjectsSettings;