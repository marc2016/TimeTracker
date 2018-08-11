var moment = require('moment');
var _ = require('lodash');
var momentDurationFormatSetup = require("moment-duration-format");
var ko = require('knockout');

var Datastore = require('nedb')

var self = module.exports = {
    leftJobDescription: ko.observable('-'),
    leftJobDuration: ko.observable('-'),
    rightTimeSum: ko.observable('00:00:00/0.00'),
    monthChart: undefined,
    utils: undefined,
    leftFooterAction: undefined,
    db: undefined,

    onLoad: function(currentDate, database){
        self.db = database
        utils = require('./utils.js');
        $('#footerContainer').mouseenter(function() {$('#sidebarButton').toggleClass('show')})
        $('#footerContainer').mouseleave(function() {$('#sidebarButton').toggleClass('show')})
        $('#sidebarButton').click(function() {$('#footerContainer').toggleClass('chart');
        $('#buttonSymbol').toggleClass('down');
        self.initChart(currentDate)})
    },

    refreshStatusBarEntry: function (description, duration){
        var leftFooter = document.getElementById('footerLeftContent')
        if(duration == undefined){
            $.find('#currentTaskDescription')[0].textContent = "-"
            $.find('#currentTaskTime')[0].textContent = "-"
            leftFooter.removeEventListener('click', self.leftFooterAction)
        } else {
            if(description) {
            $.find('#currentTaskDescription')[0].textContent = description
            }
            $.find('#currentTaskTime')[0].textContent = utils.getTimeString(duration)
            leftFooter.addEventListener('click', self.leftFooterAction)
        }
    },

    initChart: function(currentDate){
        var regex =  new RegExp(currentDate.format('YYYY-MM') + '-(.*)');
        self.db.find({date: regex}).sort({ date: 1 }).exec(function (err, docs) {
      
          var lastDayOfMonth = currentDate.clone().endOf('month').format('D')
          var data = []
          var groups = _.groupBy(docs,'date')
          var result = _.transform(groups, function(result, value, key) {
            var seconds = _.sumBy(value,'elapsedSeconds')
            var sum = moment.duration(seconds, "seconds").format("h", 2)
            result[moment(key,'YYYY-MM-DD').format('D')] = sum;
            return true;
          }, []);
          for (var i = 0; i <= lastDayOfMonth; i++) {
            data[i] = result[i+1]
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
        });
      
      }
}