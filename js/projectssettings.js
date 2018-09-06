var ko = require('knockout');
ko.mapping = require('knockout-mapping')

class ListSettings  {

    
    isBound() {
        return !!ko.dataFor(document.getElementById(this.viewId));
    }

    onLoad() {
        if(!this.isBound())
        {
            ko.applyBindings(this, document.getElementById('projectssettingsMainContent'))
            ko.applyBindings(this, document.getElementById('modalAddNewProject'))
        }
        this.refreshProjectList()
    }

    constructor(projectDatabase, viewId){
        this.viewId = viewId
        this.db_projects = projectDatabase
        this.projectList = ko.observableArray()
        this.selectedProject = ko.observable()
        this.self = this
    }

    saveProjects() {
        ko.utils.arrayForEach(this.projectList(), function (element) {
            this.db_projects.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ }, function (err, numReplaced) {} )
        })
        this.db_projects.persistence.compactDatafile()
    }

    addNewProject(){
        var newProjectName = document.getElementById('inputNewProjectName')
        
        var newProject = {name:newProjectName.value, active:true}
        var that = this
        this.db_projects.insert(newProject, function (err, dbEntry) {
            that.refreshProjectList()
            $('#modalAddNewProject').modal('toggle');
        });
    }

    refreshProjectList(){
        var that = this
        this.projectList.removeAll()
        this.db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
            var observableDocs = ko.mapping.fromJS(docs,that.projectList)
            _.forEach(observableDocs(), function(element){
                if(!element.externalId){
                    element.externalId = ko.observable()
                }
            })
            ko.utils.arrayPushAll(that.projectList, observableDocs())
        })
    }

    clickSelectProject(){
        that.selectedProject(this)
    }
}

module.exports = ListSettings;