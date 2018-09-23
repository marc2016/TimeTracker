var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')

class AppSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
        
    }

    constructor(views, store){
        super(views)
        this.store = store
        this.self = this

        this.timerNotificationsEnabled = ko.pureComputed({
            read: function () {
                return this.store.get('timerNotificationsEnabled', false);
            },
            write: function (value) {
                this.store.set('timerNotificationsEnabled', value)
            },
            owner: this
        });

        this.timerNotificationsInterval = ko.pureComputed({
            read: function () {
                return this.store.get('timerNotificationsInterval', 1);
            },
            write: function (value) {
                this.store.set('timerNotificationsInterval', value)
            },
            owner: this
        });
    }
}

module.exports = AppSettings;