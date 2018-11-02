var ko = require('knockout');
ko.mapping = require('knockout-mapping')
var BaseViewModel = require('./base.js')
var _ = require('lodash');
var dt = require( 'datatables.net' )();

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
            this.syncLoginUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncLoginUrl');
                },
                write: function (value) {
                    this.store.set('syncLoginUrl', value)
                },
                owner: this
            });

            this.syncLoginParameterUser = ko.pureComputed({
                read: function () {
                    return this.store.get('syncLoginParameterUser');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncLoginParameterUser', value)
                    } else {
                        this.store.delete('syncLoginParameterUser')
                    }
                },
                owner: this
            });
            this.syncLoginParameterPassword = ko.pureComputed({
                read: function () {
                    return this.store.get('syncLoginParameterPassword');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncLoginParameterPassword', value)
                    } else {
                        this.store.delete('syncLoginParameterPassword')
                    }
                },
                owner: this
            });
            this.syncProjectParameterYear = ko.pureComputed({
                read: function () {
                    return this.store.get('syncProjectParameterYear');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncProjectParameterYear', value)
                    } else {
                        this.store.delete('syncProjectParameterYear')
                    }
                },
                owner: this
            });
            this.syncProjectParameterMonth= ko.pureComputed({
                read: function () {
                    return this.store.get('syncProjectParameterMonth');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncProjectParameterMonth', value)
                    } else {
                        this.store.delete('syncProjectParameterMonth')
                    }
                },
                owner: this
            });
            this.syncJobParameterDay= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterDay');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterDay', value)
                    } else {
                        this.store.delete('syncJobParameterDay')
                    }
                },
                owner: this
            });
            this.syncJobParameterDuration= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterDuration');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterDuration', value)
                    } else {
                        this.store.delete('syncJobParameterDuration')
                    }
                },
                owner: this
            });
            this.syncJobParameterDescription= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterDescription');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterDescription', value)
                    } else {
                        this.store.delete('syncJobParameterDescription')
                    }
                },
                owner: this
            });
            this.syncJobParameterProject= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterProject');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterProject', value)
                    } else {
                        this.store.delete('syncJobParameterProject')
                    }
                },
                owner: this
            });
            this.syncJobParameterJobtype= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterJobtype');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterJobtype', value)
                    } else {
                        this.store.delete('syncJobParameterJobtype')
                    }
                },
                owner: this
            });
            this.syncJobParameterNote= ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobParameterNote');
                },
                write: function (value) {
                    if(value){
                        this.store.set('syncJobParameterNote', value)
                    } else {
                        this.store.delete('syncJobParameterNote')
                    }
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
            this.syncJobtypeUrl = ko.pureComputed({
                read: function () {
                    return this.store.get('syncJobtypeUrl');
                },
                write: function (value) {
                    this.store.set('syncJobtypeUrl', value)
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