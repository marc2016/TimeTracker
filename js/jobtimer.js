const { Observable, Subject, ReplaySubject, from, of, range, timer, interval, never } = require('rxjs');
const { map, switchMap } = require('rxjs/operators');

var moment = require('moment');

var self = module.exports = {   

    currentJobId: undefined,
    currentJobDescription: undefined,

    timeSignal: undefined,
    _timeSignalSource: undefined,

    startSignal: new Subject(),
    stopSignal: new Subject(),

    _offsetSeconds: undefined,
    _startDate: undefined,
    _pauser: new Subject(),

    start: function(jobId, seconds, jobDescription) {
        if(self.isRunning())
            return false
        self.currentJobId = jobId
        self.currentJobDescription = jobDescription
        self._offsetSeconds = seconds
        self._startDate = moment()
        self._pauser.next(false)
        self.startSignal.next(self._currentData())
    },

    isRunning: function(){
        return self._startDate != undefined
    },

    _timeUpdate: function(x, idx, obs) {
        return self._currentData()
    },

    _calculateDiff: function() {
        var currentMoment = moment()
        var diff = moment.duration(currentMoment.diff(self._startDate)).asSeconds()
        if(self._offsetSeconds) {
            diff = diff + self._offsetSeconds
        }
        return diff
    },

    _currentData: function(){
        return { "duration": self._calculateDiff(), "jobId": self.currentJobId, "jobDescription": self.currentJobDescription }
    },

    stop: function() {
        self._pauser.next(true)
        var returnValue = self._calculateDiff()
        self.currentJobId = undefined
        self.currentJobDescription = undefined
        self._offsetSeconds = undefined
        self._startDate = undefined

        self.stopSignal.next(self._currentData())
        
        return returnValue
    }
}

self._timeSignalSource = interval(1000).pipe(map(self._timeUpdate))
self.timeSignal = self._pauser.pipe(switchMap(paused => paused ? never() : self._timeSignalSource))
