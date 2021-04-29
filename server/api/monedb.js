const rison = require('rison');
const connectMoneDB = require('../lib/monedb');
const omit = require('../lib/omit');

module.exports = async (fastify, opts) => {
  // MoneDB database
  const db = await connectMoneDB(process.env.MONEDB_URL || __dirname, process.env.MONEDB_DATABASE || 'mone');

  // validatotion schemes collection name
  const validator_collection = '@schemes';

  /**
   * GET /api/monedb/${collection}?${rison_query}
   * @description Find a list of data
   * @param {string} collection data resource name
   * @param {string?} rison_query search query formatted by https://rison.io
   *    @example {pagination:{page:1, perPage:50}, sort:{field:'created_at', order:'DESC'}, filter:{$or:{created_at:{$gt:'1980-01-01'}, updated_at:{$exists:true}}}}
   *      => (pagination:(page:1, perPage:50), sort:(field:'created_at', order:'DESC'), filter:('$or':(created_at:('$gt':'1980-01-01'), updated_at:('$exists':!t))))
   * @returns {object[]}
   */
  fastify.get('/:collection', async (request, reply) => {
    try {
      let query = request.raw.url.split('?').slice(1).join('');
      query = rison.decode(query.length > 0? decodeURIComponent(query): '()');
      
      // find a list of data
      const paginator = {};
      const model = await db.model(request.params.collection, validator_collection);
      const data = await model.find(query, paginator);

      reply
        .header('Content-Range', `${request.params.collection} ${paginator.skip}-${paginator.skip + paginator.perPage - 1}/${paginator.count}`)
        .send(data);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * POST /api/monedb/${collection}
   * @description Create a single, or list of data
   * @param {object} payload {data: {object|object[]: data for create}}
   * @returns {object|object[]} created data {...data, $errors: object[] (if validation error has been occurred)}
   */
   fastify.post('/:collection', async (request, reply) => {
    try {
      if (!request.body || typeof request.body.data !== 'object') {
        return reply.code(400).send({error: 'payload.data must be a single, or list of object(s)'});
      }
      // insert data
      const model = await db.model(request.params.collection, validator_collection);
      reply.code(201).send(await model.insert(request.body.data)); // 201 CREATED
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * PUT /api/monedb/${collection}
   * @description Update a list of data
   * @param {object} payload {filter: {object: query for updating data}, data: {object: updating data}}
   * @returns {object|object[]} inserted data | previous data list [{...prevData, $errors: object[] (if validation error has been occurred)}]
   */
   fastify.put('/:collection', async (request, reply) => {
    try {
      if (!request.body || typeof request.body.filter !== 'object') {
        return reply.code(400).send({error: 'payload.filter must be a object'});
      }
      if (!request.body || typeof request.body.data !== 'object') {
        return reply.code(400).send({error: 'payload.data must be a object'});
      }
      const model = await db.model(request.params.collection, validator_collection);
      const prevData = await model.find({filter: request.body.filter});
      // insert data
      if (prevData.length === 0) {
        const insert_data = omit({...request.body.filter, ...request.body.data}, ['_id']);
        return reply.code(201).send(await model.insert(insert_data)); // 201 CREATED
      }
      // update data
      reply.send(await model.update(request.body.filter, request.body.data));
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * DELETE /api/monedb/${collection}
   * @description Delete a list of data
   * @param {object} payload {filter: {object: query for deleting data}}
   * @returns {object[]} previous data list
   */
   fastify.delete('/:collection', async (request, reply) => {
    try {
      const filter = (request.body && request.body.filter)? request.body.filter: {};
      // delete data
      const model = await db.model(request.params.collection, validator_collection);
      const prevData = await model.find({filter});
      const deleted = await model.delete(filter);
      if (deleted < prevData.length) {
        return reply.code(500).send({error: 'A part of data may not be deleted'});
      }
      reply.send(prevData);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * GET /api/monedb/${collection}/${id}
   * @description Find a single data by ID
   * @param {string} collection data resource name
   * @param {number|string} id target data id
   * @returns {object}
   */
  fastify.get('/:collection/:id', async (request, reply) => {
    try {
      // find a single data
      const model = await db.model(request.params.collection, validator_collection);
      const data = await model.find({
        pagination: {page: 1, perPage: 1}, filter: {_id: +request.params.id}
      });
      if (data.length === 0) {
        return reply.code(404).send({error: `Collection ID: ${request.params.id} not found`});
      }
      reply.send(data[0]);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * PUT /api/monedb/${collection}/${id}
   * @description Update or insert a single data by ID
   * @param {string} collection data resource name
   * @param {number|string} id target data id
   * @param {object} payload {data: {object: updating data}}
   * @returns {object} previous data {...prevData, $errors: object[] (if validation error has been occurred)}
   */
   fastify.put('/:collection/:id', async (request, reply) => {
    try {
      if (!request.body || typeof request.body.data !== 'object' || Array.isArray(request.body.data)) {
        return reply.code(400).send({error: 'payload.data must be a object'});
      }
      const model = await db.model(request.params.collection, validator_collection);
      const filter = {_id: +request.params.id};
      const prevData = await model.find({filter});
      if (prevData.length === 0) {
        return reply.code(404).send({error: `Collection ID: ${request.params.id} not found`});
      }
      reply.send((await model.update(filter, request.body.data))[0]);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * DELETE /api/monedb/${collection}/${id}
   * @description Delete a single data by ID
   * @param {string} collection data resource name
   * @param {number|string} id target data id
   * @returns {object} previous data
   */
   fastify.delete('/:collection/:id', async (request, reply) => {
    try {
      const model = await db.model(request.params.collection, validator_collection);
      const filter = {_id: +request.params.id};
      const prevData = await model.find({filter});
      if (prevData.length === 0) {
        return reply.code(404).send({error: `Collection ID: ${request.params.id} not found`});
      }

      const deleted = await model.delete(filter);
      if (deleted < prevData.length) {
        return reply.code(500).send({send: 'A part of data may not be deleted'});
      }
      reply.send(prevData[0]);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });
};