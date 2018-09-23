var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')

class AppSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
        
    }

    show(){
        $('#appSettings').removeClass('invisible')
    }
    
    hide(){
        $('#appSettings').addClass('invisible')
    }

    constructor(views, store){
        super(views)
        
        $('#appSettings').load('pages/appsettings.html', function(){
            this.hide()
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
            this.syncLoginUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncLoginUrl');
                },
                write: function (value) {
                    this.store.set('syncLoginUrl', value)
                },
                owner: this
            });

            this.syncUsername = ko.pureComputed({
                read: function () {
                    return this.store.get('syncUsername');
                },
                write: function (value) {
                    this.store.set('syncUsername', value)
                },
                owner: this
            });

            this.syncPassword = ko.pureComputed({
                read: function () {
                    return this.store.get('syncPassword');
                },
                write: function (value) {
                    this.store.set('syncPassword', value)
                },
                owner: this
            });
            this.userEmail = ko.pureComputed({
                read: function () {
                    return this.store.get('userEmail');
                },
                write: function (value) {
                    this.store.set('userEmail', value)
                },
                owner: this
            });
        }.bind(this))
        
    }
}

module.exports = AppSettings;