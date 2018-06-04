var remote = require('electron').remote;

var self = module.exports = {

    db_projects: remote.getGlobal('db_projects'),
    selectedProject: undefined,

    onLoad: function(){
        $('#projectForm *').prop('disabled', true);
        this.clearProjectsList();
        this.createProjectList();
        var btnAddNewProject = document.getElementById('btnAddNewProject')
        btnAddNewProject.addEventListener("click", self.addNewProject )

        var btnSaveProject = document.getElementById('btnSaveProject')
        btnSaveProject.addEventListener("click",self.saveProject )
        
    },

    saveProject: function() {
        if(self.selectedProject == undefined){
            return
        }
        var inputProjectName = document.getElementById('inputProjectName')
        var checkboxProjectActive = document.getElementById('checkboxProjectActive')
        self.db_projects.update({_id:self.selectedProject}, {name:inputProjectName.value, active:checkboxProjectActive.checked}, {}, function (err, numReplaced) {
            self.selectedProject = undefined
            self.clearProjectsList();
            self.createProjectList();
            self.clearForm();
        })
    },

    clearForm: function(){
        $('#inputProjectName').prop('value', "")
        $('#projectForm *').prop('disabled', true);
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
        $('#projectForm *').prop('disabled', false);
        this.selectedProject = projectId
        this.db_projects.findOne({_id:projectId}).exec( function (err, doc) {
            var inputProjectName = document.getElementById('inputProjectName')
            inputProjectName.value = doc.name
            var checkboxProjectActive = document.getElementById('checkboxProjectActive')
            checkboxProjectActive.checked = doc.active
        })
        
    }
}