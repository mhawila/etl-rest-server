module.exports = {
  openmrs: {
    host: process.env.OPENMRS_HOST_ADDR || 'localhost',
    applicationName: process.env.OPENMRS_NAME || 'openmrs',
    port: process.env.OPENMRS_PORT || 8080
  },
  etl: {
    host: 'localhost',
    port: 8002,
    tls: false,
    key: '/keys/server.key',  // Server Key
    cert: '/keys/server.crt'    // Certificate to allow TLS access to the server
  },
  mysql: {
    connectionLimit: 10,
    host: process.env.DB_PORT_3306_TCP_ADDR,
    port: process.env.DB_PORT_3306_TCP_PORT || 3306,
    user: process.env.DB_ENV_MYSQL_USER || 'etl_user',
    password: process.env.DB_ENV_MYSQL_PASSWORD || 'etl_password',
    multipleStatements: true
  }
};
