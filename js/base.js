var ko = require('knockout');

class BaseViewModel {

    constructor(views, database){
        this.views = views
        this.database = database
    }

    onLoad(){
        if(!this.isBound())
        {
            _.forEach(this.views, (value) => {
                ko.applyBindings(this, document.getElementById(value))
            })
            
        }
    }

    isBound() {
        if(this.views){
            return this.views.every((value => { return ko.dataFor(document.getElementById(value))}))
        }
        return false;
    }
}

module.exports = BaseViewModel;