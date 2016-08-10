'use strict';
var Hapi = require('hapi');
var mysql = require('mysql');
var Good = require('good');
var requestConfig = require('./request-config');
var Basic = require('hapi-auth-basic');
var https = require('http');
var config = require('./conf/config');
var requestConfig = require('./request-config');
var corsHeaders = require('hapi-cors-headers');
var _ = require('underscore');
var moment = require('moment');
var tls = require('tls');
var fs = require('fs');
var routes = require('./etl-routes');
var elasticRoutes = require('./elastic/routes/care.treatment.routes');
var Inert = require('inert');
var Vision = require('vision');
var HapiSwagger = require('hapi-swagger');
var Pack = require('./package');
var hapiAuthorization = require('hapi-authorization');
var authorizer = require('./authorization/etl-authorizer');
var user = '';
var cluster = require('cluster');
var os = require('os');

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

var numCPUs = os.cpus().length;
var server = new Hapi.Server({
  connections: {
    //routes: {cors:{origin:["https://amrs.ampath.or.ke:8443"]}}
    routes: {
      cors: {
        additionalHeaders: ['JSNLog-RequestId']
      }
    }
  }
});

const cache = server.cache({
  segment: 'userSessions',
  expiresIn: SESSION_TTL
})

var tls_config = false;
if (config.etl.tls) {
  tls_config = tls.createServer({
    key: fs.readFileSync(config.etl.key),
    cert: fs.readFileSync(config.etl.cert)
  });
}

server.connection({
  port: config.etl.port,
  host: config.etl.host,
  tls: tls_config
}).state('sessionId', {
  ttl: SESSION_TTL,
  isSecure: false,
  isHttpOnly: true,
  path: '/etl/'
});

var pool = mysql.createPool(config.mysql);

var validate = function (request, username, password, callback) {
  console.log('Date ' + (new Date()).toString() + ', Request state object:', request.state);
  let sessionId = request.state.sessionId;
  let openmrsAuthenticate = function() {
    let openmrsAppName = config.openmrs.applicationName || 'amrs';
    let options = {
      hostname: config.openmrs.host,
      port: config.openmrs.port,
      path: '/' + openmrsAppName + '/ws/rest/v1/session',
      headers: {
        'Authorization': "Basic " + new Buffer(username + ":" + password).toString("base64")
      }
    };
    if (config.openmrs.https) {
      https = require('https');
    }
    https.get(options, function (res) {
      var body = '';
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        var result = JSON.parse(body);
        user = result.user.username;
        authorizer.setUser(result.user);
        var currentUser = {
          username: username,
          role: authorizer.isSuperUser() ?
            authorizer.getAllPrivilegesArray() :
            authorizer.getCurrentUserPreviliges()
        };
        currentUser.authenticated = result.authenticated;
        //console.log('Logged in user:', currentUser);
        cache.set('username', currentUser);
        callback(null, result.authenticated, currentUser);

      });
    }).on('error', function (error) {
      //console.log(error);
      callback(null, false);
    });
  };
  
  if(sessionId) {
    cache.get(username, (err, value, cached, log) => {
      if(!value) {
        // authenticate with openmrs
        openmrsAuthenticate();
      } else {
        callback(null, value.authenticated, value);
      }
    });
  }
};

var HapiSwaggerOptions = {
  info: {
    'title': 'REST API Documentation',
    'version': Pack.version,
  },
  tags: [{
    'name': 'patient'
  }, {
      'name': 'location'
    }],
  sortEndpoints: 'path'
};

server.ext('onRequest', function (request, reply) {
  requestConfig.setAuthorization(request.headers.authorization);
  return reply.continue();

});

server.ext('onPostHandler', function(request, reply) {
  let credos = request.auth.credentials || {};
  if(credos.sessionId) {
    request.response.state('sessionId', credos.sessionId);
  }
  reply.continue();
});

server.register([
  Inert,
  Vision, {
    'register': HapiSwagger,
    'options': HapiSwaggerOptions
  }, {
    register: Basic,
    options: {}
  }, {
    register: hapiAuthorization,
    options: {
      roles: authorizer.getAllPrivilegesArray()
    }
  },
  {
    register: Good,
    options: {
      reporters: []
    }
  }
],

  function (err) {
    if (err) {
      throw err; // something bad happened loading the plugin
    }
    server.auth.strategy('simple', 'basic', {
      validateFunc: validate
    });

    //Adding routes
    for (var route in routes) {
      server.route(routes[route]);
    }

    for (var route in elasticRoutes) {
      server.route(elasticRoutes[route]);
    }

    server.on('response', function (request) {
      if (request.response === undefined || request.response === null) {
        console.log("No response");
      } else {
        console.log(
          'Username:',
          user + '\n' +
          moment().local().format("YYYY-MM-DD HH:mm:ss") + ': ' + server.info.uri + ': '
          + request.method.toUpperCase() + ' '
          + request.url.path + ' \n '
          + request.response.statusCode
        );

      }

    })


    server.ext('onPreResponse', corsHeaders);

    if (config.clusteringEnabled === true && cluster.isMaster) {

      for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      cluster.on('exit', function (worker, code, signal) {
        //refork the cluster
        //cluster.fork(); 
      });

      

    } else {
      //TODO start HAPI server here
      server.start(function () {
        console.log('info', 'Server running at: ' + server.info.uri);
        server.log('info', 'Server running at: ' + server.info.uri);
      });

    }

  });
  
module.exports = server;
