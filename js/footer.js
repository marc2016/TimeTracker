var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var ko = require('knockout');

var Datastore = require('nedb')

var self = module.exports = {
    leftJobDescription: ko.observable('keine laufende Aufgabe'),
    leftJobDuration: ko.observable(''),
    rightTimeSum: ko.observable('00:00:00/0.00'),
    monthChart: undefined,
    utils: undefined,
    leftFooterAction: undefined,
    db: undefined,
    jobtimer: undefined,

    isBound: function() {
        return !!ko.dataFor(document.getElementById('footerContainer'));
    },

    onLoad: function(currentDate, database, jobtimer){
        if(!self.isBound())
            ko.applyBindings(self, document.getElementById('footerContainer'))
        self.db = database
        self.jobtimer = jobtimer
        utils = require('./utils.js');
        $('#footerContainer').mouseenter(function() {$('#sidebarButton').toggleClass('show')})
        $('#footerContainer').mouseleave(function() {$('#sidebarButton').toggleClass('show')})
        $('#sidebarButton').click(function() {$('#footerContainer').toggleClass('chart');
        $('#buttonSymbol').toggleClass('down');
        self.initChart(currentDate)})

        self.jobtimer.timeSignal.subscribe(self.refreshStatusBarEntry)
        self.jobtimer.stopSignal.subscribe(self.timerStop)
    },


    timerStop: function (){
        self.leftJobDescription('keine laufende Aufgabe')
        self.leftJobDuration('')
        var leftFooter = document.getElementById('footerLeftContent')
        leftFooter.removeEventListener('click', self.leftFooterAction)
    },

    refreshStatusBarEntry: function (updatevalue){
        if(!updatevalue)
            return;
        var duration = updatevalue.duration
        var description = updatevalue.jobDescription
        var leftFooter = document.getElementById('footerLeftContent')
        
        if(!description) {
            description = 'Unbenannte Aufgabe'
        }
        self.leftJobDescription(description)
        self.leftJobDuration(utils.getTimeString(duration))
        leftFooter.addEventListener('click', self.leftFooterAction)
    },

    initChart: async function(currentDate){
        var regex =  new RegExp(currentDate.format('YYYY-MM') + '-(.*)');
        var docs = await self.db.find({date: regex})
      
        var lastDayOfMonth = currentDate.clone().endOf('month').format('D')
        var data = []
        var groups = _.groupBy(docs,'date')
        var result = _.transform(groups, function(result, value, key) {
            var seconds = _.sumBy(value,'elapsedSeconds')
            var sum = moment.duration(seconds, "seconds").format("h", 2)
            result[moment(key,'YYYY-MM-DD').format('D')] = sum;
            return true;
        }, []);
        for (var i = 0; i < lastDayOfMonth; i++) {
            var value = result[i+1] ? result[i+1].replace(',','.') : 0;
            data[i] = _.toNumber(value)
        }
    
        var daysArray = _.range(1,parseInt(currentDate.clone().endOf('month').format('D'))+1)
        var ctx = document.getElementById("chart").getContext('2d');
        if(self.monthChart != undefined){
            self.monthChart.destroy()
        }
        self.monthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: daysArray,
            datasets: [{
                data: data,
                backgroundColor: 'rgb(164, 36, 74)'
            }]
        },
        options: {
            legend : {
            display: false
            },
            tooltips:{
            mode: 'nearest',
            callbacks: {
                title: function(tooltipItem, data) {
                var day = tooltipItem.xLabel
                var momentObj = currentDate.clone()
                momentObj.date(day)
                momentObj.locale('de')
                return momentObj.format("dddd, DD.MM.YYYY");
                },
                label: function(tooltipItem, data) {
                return tooltipItem.yLabel + ' Stunden'
                }
            }
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                yAxes: [{
    
                    ticks: {
                        suggestedMax: 12,
                        min: 0
                    }
    
                }]
            },
            annotation: {
    
                drawTime: 'afterDatasetsDraw',
    
                annotations: [{
                    drawTime: 'afterDraw', // overrides annotation.drawTime if set
                    id: 'a-line-1', // optional
                    type: 'line',
                    mode: 'horizontal',
                    scaleID: 'y-axis-0',
                    value: '8',
                    borderColor: 'rgb(29, 173, 75)',
                    borderWidth: 1,
                borderDash: [2, 2]
                }]
            }
        }
        });
      
      }
}