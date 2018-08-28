var ko = require('knockout');
ko.mapping = require('knockout-mapping')

var self = module.exports = {

    viewId:undefined,
    isBound: function() {
        return !!ko.dataFor(document.getElementById(self.viewId));
    },

    db_projects: undefined,
    selectedProject: undefined,
    projectList: undefined,
    selectedProject: undefined,

    onLoad: function(projectDatabase){
        self.db_projects = projectDatabase
        self.projectList = ko.observableArray()
        self.selectedProject = ko.observable()
        
        if(!self.isBound())
            ko.applyBindings(self, document.getElementById('projectssettingsMainContent'))
        $('#projectForm *').prop('disabled', true);
        
        self.refreshProjectList()
    },

    saveProjects: function() {
        ko.utils.arrayForEach(self.projectList(), function (element) {
            self.db_projects.update({ _id:element._id() }, {  name: element.name(), externalId: element.externalId(), active: element.active() },{ }, function (err, numReplaced) {} )
        })
        self.db_projects.persistence.compactDatafile()
    },

    addNewProject: function(){
        var newProjectName = document.getElementById('inputNewProjectName')
        
        var newProject = {name:newProjectName.value, active:true}
        
        self.db_projects.insert(newProject, function (err, dbEntry) {
            self.clearProjectsList()
            self.createProjectList()
            $('#modalAddNewProject').modal('toggle');
        });
    },

    refreshProjectList: function(){
        var that = this
        self.projectList.removeAll()
        self.db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
            var observableDocs = ko.mapping.fromJS(docs,self.projectList)
            _.forEach(observableDocs(), function(element){
                if(!element.externalId){
                    element.externalId = ko.observable()
                }
            })
            ko.utils.arrayPushAll(self.projectList, observableDocs())
        })
    },

    clickSelectProject: function(){
        self.selectedProject(this)
    }
}