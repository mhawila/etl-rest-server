module.exports = (function() {
    'use strict';
    
    var _ = require('lodash');
    var ejs = require('elastic.js');
    var concepts = require('./concept.ids');
    
    function pcpStartedQuery(params) { 
        var params = params || {};
        var aggregate = params.aggs || false;
        
        
        var req = ejs.Request();               

        var filterParam = ejs.BoolFilter()
                            .must(ejs.TermFilter('concept_id',1261))
                            .must(ejs.TermsFilter('value_coded',[1256,1850]));
        
        var _body = ejs.FilteredQuery(ejs.MatchAllQuery(), filterParam);
        
        if(aggregate) {
            
        }
        var queryObj = {
            index: 'amrs',
            type: 'indicator',
            body: _body
        };
        
        return queryObj;
    }
    
    return {
        getPcpStartedQuery: pcpStartedQuery
    }
})();
