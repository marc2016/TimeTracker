var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')
var _ = require('lodash');
var dt = require( 'datatables.net' )();
var sync = require('./sync.js')

class AppSettings extends BaseViewModel {

    onLoad() {
        super.onLoad()
    }

    show(){
        this.onLoad()
        $('#appSettings').removeClass('invisible')
    }
    
    hide(){
        $('#appSettings').addClass('invisible')
    }

    backgroundChanged(that,data){
        _.forEach(that.backgrounds(), function(value) {value.selected(false)})
        data.selected(true)
        that.store.set('backgroundSrc', data.src)
        that.store.set('backgroundId', data.id)
    }

    loadBackgrounds(){
        this.backgrounds = ko.observableArray()
        this.backgrounds.push({ src: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', id:0, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/01.jpg', id:1, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/02.jpg', id:2, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/03.jpg', id:3, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/04.jpg', id:4, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/05.jpg', id:5, selected: ko.observable(false)})
        this.backgrounds.push({ src: './backgrounds/wood.png', id:6, selected: ko.observable(false)})
        if(this.store.get('backgroundId')){
            var that = this
            var element = ko.utils.arrayFirst(this.backgrounds(), function(item){ return item.id ==  that.store.get('backgroundId')})
            element.selected(true)
        }
    }

    constructor(views, store){
        super(views)
        
        $('#appSettings').load('pages/appsettings.html', function(){
            this.hide()
            this.store = store
            this.self = this

            $("#selectImage").imagepicker({
                hide_select: true
            });

            this.loadBackgrounds()

            this.roundDuration = ko.pureComputed({
                read: function () {
                    return this.store.get('roundDuration', 'round');
                },
                write: function (value) {
                    this.store.set('roundDuration', value)
                },
                owner: this
            });
            
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
                    return this.store.get('timerNotificationsInterval', 600)/60;
                },
                write: function (value) {
                    this.store.set('timerNotificationsInterval', value*60)
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
            
            this.syncRestBaseUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncRestBaseUrl');
                },
                write: function (value) {
                    this.store.set('syncRestBaseUrl', value)
                    sync.baseUrl = value
                },
                owner: this
            });

        }.bind(this))
        
    }

    roundDurationClick(value, data){
        this.roundDuration(value)
    }
}

module.exports = AppSettings;