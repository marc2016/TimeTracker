var remote = require('electron').remote;

module.exports = {

    db_projects: remote.getGlobal('db_projects'),
    selectedProject: undefined,

    onLoad: function(){
        this.clearProjectsList();
        this.createProjectList();
        var btnAddNewProject = document.getElementById('btnAddNewProject')
        var boundedAddNewProject =  this.addNewProject.bind(this)
        btnAddNewProject.addEventListener("click",boundedAddNewProject )

        var btnSaveProject = document.getElementById('btnSaveProject')
        var boundedSaveProject =  this.saveProject.bind(this)
        btnSaveProject.addEventListener("click",boundedSaveProject )
        
    },

    saveProject: function() {
        if(this.selectedProject == undefined){
            return
        }
        var that = this
        var inputProjectName = document.getElementById('inputProjectName')
        this.db_projects.update({_id:this.selectedProject}, {name:inputProjectName.value}, {}, function (err, numReplaced) {
            that.selectedProject = undefined
            that.clearProjectsList();
            that.createProjectList();
        })
    },

    addNewProject: function(){
        var newProjectName = document.getElementById('inputNewProjectName')
        
        var newProject = {name:newProjectName.value}
        var that = this
        this.db_projects.insert(newProject, function (err, dbEntry) {
            that.clearProjectsList()
            that.createProjectList()
            $('#modalAddNewProject').modal('toggle');
        });
    },

    createProjectList: function(){
        var that = this
        this.db_projects.find({}).sort({ name: 1 }).exec( function (err, docs) {
            var htmlString = ''
            for(var i = 0; i < docs.length;i++){
              var doc = docs[i]
              htmlString += '<a href="#" projectid='+doc._id+' class="list-group-item list-group-item-action">'+doc.name+'</a>'
            }
            $('#projectsList').append(htmlString);
            
            $('.list-group-item').on('click', function() {
                

                $('.active').removeClass('active');
                $(this).toggleClass('active')
            
                that.projectSelected(this.getAttribute('projectid'))
            })
        });
    },

    createEntry: function(){
        var element = '<a href="#" class="list-group-item list-group-item-action">Dapibus ac facilisis in</a>'
        document.getElementById("projectsList").appendChild(element);
        
    },

    clearProjectsList: function(){
        var ul = document.getElementById("projectsList");
        ul.innerHTML = "";
    },

    projectSelected: function(projectId){
        this.selectedProject = projectId
        this.db_projects.findOne({_id:projectId}).exec( function (err, doc) {
            var inputProjectName = document.getElementById('inputProjectName')
            inputProjectName.value = doc.name
        })
        
    }
}