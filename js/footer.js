var ko = require('knockout');

var self = module.exports = {
    leftJobDescription: ko.observable('-'),
    leftJobDuration: ko.observable('-'),
    rightTimeSum: ko.observable('00:00:00/0.00')
}