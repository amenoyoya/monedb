const rison = require('rison');
const MoneDB = require('../lib/monedb/client');
const omit = require('../lib/omit');

module.exports = async (fastify, opts) => {
  const id_format = process.env.MONEDB_ID_FORMAT || 'number';
  const client = new MoneDB(process.env.MONEDB_URL || __dirname, id_format);
  await client.connect();

  // main datasource
  const datasource = client.db(process.env.MONEDB_DATABASE || 'mone');

  // validators collection name
  const validator_collection = '@validators';

  /**
   * Convert Object ID type, according to the `ID Format`
   * @param {number|string} id
   * @returns {number|string}
   */
  function objectId(id) {
    if (id_format === 'number') {
      return parseInt(id, 10);
    }
    return id.toString();
  }

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
      query = rison.decode(query || '()');
      
      // validation data
      const validator = (await datasource.collection(validator_collection).find({target: request.params.collection}))[0];
      // find a list of data
      const paginator = {};
      let data = await datasource.collection(request.params.collection, validator).find(query, paginator);

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
   * @returns {object[]} created data list
   */
   fastify.post('/:collection', async (request, reply) => {
    try {
      if (typeof(request.body.data) !== 'object') {
        return reply.code(400).send({error: 'payload.data must be a single, or list of object(s)'});
      }
      // validation data
      const validator = (await datasource.collection(validator_collection).find({target: request.params.collection}))[0];
      // insert data
      const collection = datasource.collection(request.params.collection, validator);
      const result = await collection.insert(request.body.data);
      if (result === false) {
        // validation error
        return reply.code(400).send(collection.errors());
      }
      reply.code(201).send(result); // 201 CREATED
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * PUT /api/monedb/${collection}
   * @description Update a list of data
   * @param {object} payload {filter: {object: query for updating data}, data: {object: updating data}}
   * @returns {object[]} previous data list
   */
   fastify.put('/:collection', async (request, reply) => {
    try {
      if (typeof(request.body.filter) !== 'object') {
        return reply.code(400).send({error: 'payload.filter must be a object'});
      }
      if (typeof(request.body.data) !== 'object') {
        return reply.code(400).send({error: 'payload.data must be a object'});
      }
      // validation data
      const validator = (await datasource.collection(validator_collection).find({target: request.params.collection}))[0];
      // update data
      const collection = datasource.collection(request.params.collection, validator);
      const prevData = await collection.find({filter: request.body.filter});
      const updated = await collection.update(request.body.filter, {$set: request.body.data});
      if (updated === false) {
        // validation error
        return reply.code(400).send(collection.errors());
      }
      if (updated < prevData.length) {
        throw new Error('A part of data may not be updated');
      }
      reply.send(prevData);
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
      if (typeof(request.body.filter) !== 'object') {
        return reply.code(400).send({error: 'payload.filter must be a object'});
      }
      const collection = datasource.collection(request.params.collection);
      const prevData = await collection.find({filter: request.body.filter});
      const deleted = await collection.delete(request.body.filter);
      if (deleted < prevData) {
        throw new Error('A part of data may not be deleted');
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
      // validation data
      const validator = (await datasource.collection(validator_collection).find({target: request.params.collection}))[0];
      // find a single data
      const data = await datasource.collection(request.params.collection, validator).find({
        pagination: {page: 1, perPage: 1}, filter: {_id: objectId(request.params.id)}
      });
      if (data.length === 0) {
        return reply.code(404).send({error: `Resource ID: ${request.params.id} not found`});
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
   * @returns {object} previous data
   */
   fastify.put('/:collection/:id', async (request, reply) => {
    try {
      if (typeof(request.body.data) !== 'object' || Array.isArray(request.body.data)) {
        return reply.code(400).send({error: 'payload.data must be a object'});
      }
      // validation data
      const validator = (await datasource.collection(validator_collection).find({target: request.params.collection}))[0];
      // find data
      const collection = datasource.collection(request.params.collection, validator);
      const filter = {_id: objectId(request.params.id)};
      const prevData = await collection.find({filter});
      if (prevData.length === 0) {
        await collection.insert(request.body.data);
        return reply.code(201).send(request.body.data); // 201 CREATED
      }
      // update data
      const updated = await collection.update(filter, {$set: request.body.data});
      if (updated === false) {
        // validation error
        return reply.code(400).send(collection.errors());
      }
      if (updated < prevData.length) {
        throw new Error('A part of data may not be updated');
      }
      reply.send(prevData[0]);
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
      const collection = datasource.collection(request.params.collection);
      const filter = {_id: objectId(request.params.id)};
      const prevData = await collection.find({filter});
      if (prevData.length === 0) {
        return reply.code(404).send({error: `Resource ID: ${request.params.id} not found`});
      }

      const deleted = await collection.delete(filter);
      if (deleted < prevData.length) {
        throw new Error('A part of data may not be deleted');
      }
      reply.send(prevData[0]);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });
};