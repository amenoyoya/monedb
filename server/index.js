// process.env form ../.env
require('dotenv').config({path: `${__dirname}/../.env`});

(async () => {
  // fastify server
  const fastify = require('fastify')({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // payload limit => 50MB
  });
  
  fastify.register(require('./api/monedb'), {
    prefix: '/api/monedb/'
  });

  const port = process.env.NODE_PORT || 8080;
  fastify.listen(port, '0.0.0.0', () => {
    console.log(`Backend server\nListening on: http://localhost:${port}/`);
  });
})();