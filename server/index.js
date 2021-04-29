// process.env form ../.env
require('dotenv').config({path: `${__dirname}/../.env`});

(async () => {
  // fastify server
  const fastify = require('fastify')({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // payload limit => 50MB
  });

  /**
   * Swagger OpenAPI Documentation
   */
  fastify.register(require('fastify-swagger'), {
    routePrefix: '/api/documentation',
    swagger: {
      info: {
        title: 'MoneDB Documentation',
        description: 'Swagger documentation for MoneDB Rest API',
        version: '0.1.0'
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here'
      },
    },
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: header => header,
    exposeRoute: true
  });
  
  /**
   * MoneDB Rest API
   */
  fastify.register(require('./api/monedb'), {
    prefix: '/api/monedb/'
  });

  const port = process.env.NODE_PORT || 8080;
  fastify.listen(port, '0.0.0.0', () => {
    console.log(`Backend server\nListening on: http://localhost:${port}/`);
  });
})();