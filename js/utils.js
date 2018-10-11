var moment = require('moment');

var self = module.exports = {
    getTimeString: function(seconds){
        if(!seconds)
          return "00:00:00/0.00"
      
        var formated = moment.duration(seconds, "seconds").format("hh:mm:ss",{trim: false})
        var decimal = moment.duration(seconds, "seconds").format("h", 2)
      
        return formated + "/" + decimal
    },

    roundDuration: function(value){
        return (Math.round(value * 4) / 4).toFixed(2)
    }
}