const { Observable, Subject, ReplaySubject, from, of, range, timer, interval } = require('rxjs');
const { map, takeWhile } = require('rxjs/operators');

var moment = require('moment');

var self = module.exports = {

    

    currentJobId: undefined,

    timeSignal: undefined,

    _offsetSeconds: undefined,
    _startDate: undefined,

    start: function(seconds, jobId) {
        if(self.isRunning)
            return false
        self.currentJobId = jobId
        self._offsetSeconds = seconds
        self._startDate = moment()
        self.timeSignal = interval(1000).pipe(takeWhile(() => self.currentJobId), map(self._timeUpdate))
    },

    isRunning: function(){
        return self._startDate != undefined
    },

    _timeUpdate: function(x, idx, obs) {
        return self._calculateDiff()
    },

    _calculateDiff: function() {
        var currentMoment = moment()
        var diff = moment.duration(currentMoment.diff(self._startDate)).asSeconds()
        if(self._offsetSeconds) {
            diff = diff + self._offsetSeconds
        }
        return diff
    },

    stop: function() {
        var returnValue = self._calculateDiff()
        self.currentJobId = undefined
        self._offsetSeconds = undefined
        self._startDate = undefined

        return returnValue
    }
}

