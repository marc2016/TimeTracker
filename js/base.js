var ko = require('knockout');

class BaseViewModel {

    constructor(views){
        this.views = views
    }

    isBound() {
        if(this.views){
            return this.views.every((value => { return ko.dataFor(document.getElementById(value))}))
        }
        return false;
    }
}

module.exports = BaseViewModel;