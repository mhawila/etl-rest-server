module.exports = (function(){
    'use strict';
    var elasticAccess = require('../elastic.access.js');
    
    function pcpProphylaxisHandler(request, reply) {
        var params = request.query || {};
        params.mode = request.params.mode || '_default';
        elasticAccess.getPcpProphylaxisPatients(params, function(data) {
            reply(data);
        });
    }
    
    return [{
        method: 'GET',
        path: '/etl/pcp-prophylaxis/{mode}',
        handler: pcpProphylaxisHandler
    }];
})();
