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
            this.syncLoginParameter = ko.pureComputed({
                read: function () {
                    return this.store.get('syncLoginParameter');
                },
                write: function (value) {
                    this.store.set('syncLoginParameter', value)
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
            this.syncProjectUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncProjectUrl');
                },
                write: function (value) {
                    this.store.set('syncProjectUrl', value)
                },
                owner: this
            });
            this.syncProjectParameter = ko.pureComputed({
                read: function () {
                    return this.store.get('syncProjectParameter');
                },
                write: function (value) {
                    this.store.set('syncProjectParameter', value)
                },
                owner: this
            });
            this.syncJobUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobUrl');
                },
                write: function (value) {
                    this.store.set('syncJobUrl', value)
                },
                owner: this
            });
            this.syncJobParameter = ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameter');
                },
                write: function (value) {
                    this.store.set('syncJobParameter', value)
                },
                owner: this
            });
            
        }.bind(this))
        
    }
}

module.exports = AppSettings;