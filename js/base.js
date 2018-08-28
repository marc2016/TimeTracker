var ko = require('knockout');

var self = module.exports = {
    viewId:undefined,
    isBound: function() {
        return !!ko.dataFor(document.getElementById(viewId));
    }
}