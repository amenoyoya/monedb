const { stringify } = require('ajv');
const rison = require('rison');
const connectMoneDB = require('../lib/monedb');
const omit = require('../lib/omit');

module.exports = async (fastify, opts) => {
  // MoneDB database
  const db = await connectMoneDB(process.env.MONEDB_URL || __dirname, process.env.MONEDB_DATABASE || 'mone');

  // validatotion schemes collection name
  const validator_collection = '@schemes';

  /**
   * GET /api/monedb/${collection}?query=${rison_query}
   */
  fastify.get('/:collection', {
    schema: {
      description: 'Find a list of data: search query must be formatted by https://rison.io',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          }
        }
      },
      querystring: {
        query: {
          type: 'string',
          description: "example: (pagination:(page:1,perPage:50),sort:(field:'created_at',order:'DESC'),filter:('$or':(created_at:('$gt':'1980-01-01'),updated_at:('$exists':!t))))",
        }
      },
      response: {
        200: {
          description: 'Succeeded to get a list of data',
          type: 'array',
          items: {
            example: {_id: 1, created_at: '1999-09-09', updated_at: '2000-01-01'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = rison.decode(request.query.query? decodeURIComponent(request.query.query): '()');
      console.log(query);
      
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
   */
  fastify.post('/:collection', {
    schema: {
      description: 'Create a single, or a list of data',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          data: {
            example: [
              {language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
            ]
          }
        }
      },
      response: {
        201: {
          description: 'Succeeded to create a single, or a list of data (If data.$errors property exists, validation error has been occurred.)',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        400: {
          description: 'Request body parameter is invalid',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.body || typeof request.body.data !== 'object') {
        return reply.code(400).send({error: 'payload.data must be a single, or list of object(s)'});
      }
      // insert data
      const model = await db.model(request.params.collection, validator_collection);
      reply.code(201).send(
        await model.insert(Array.isArray(request.body.data)? request.body.data: [request.body.data])
      ); // 201 CREATED
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * PUT /api/monedb/${collection}
   */
  fastify.put('/:collection', {
    schema: {
      description: 'Update a list of data',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          filter: {
            example: {language: 'JavaScript'},
          },
          data: {
            example: {updated_at: '2021-04-30 03:34:00'}
          }
        }
      },
      response: {
        200: {
          description: 'Succeeded to update a list of data: Return the previous saved data (If data.$errors property exists, validation error has been occurred.)',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        201: {
          description: 'Succeeded to create a single data: The filtered data is not found (If data.$errors property exists, validation error has been occurred.)',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', updated_at: '2021-04-30 03:34:00'}
          ]
        },
        400: {
          description: 'Request body parameter is invalid',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
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
        return reply.code(201).send([await model.insert(insert_data)]); // 201 CREATED
      }
      // update data
      reply.send(await model.update(request.body.filter, request.body.data));
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });

  /**
   * DELETE /api/monedb/${collection}
   */
  fastify.delete('/:collection', {
    schema: {
      description: 'Delete a list of data',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          filter: {
            example: {language: 'JavaScript'},
          }
        }
      },
      response: {
        200: {
          description: 'Succeeded to delete a list of data: Return the previous saved data',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
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
   */
  fastify.get('/:collection/:id', {
    schema: {
      description: 'Find a single data by ID',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          },
          id: {
            type: 'string',
            description: 'Target data ID',
          }
        }
      },
      response: {
        200: {
          description: 'Succeeded to get a single data',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        404: {
          description: 'The target data is not found',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // find a single data
      const model = await db.model(request.params.collection, validator_collection);
      const data = await model.find({
        pagination: {page: 1, perPage: 1}, filter: {_id: +request.params.id}
      });
      if (data.length === 0) {
        return reply.code(404).send({error: `Collection ID: ${request.params.id} not found`});
      }
      reply.send(data);
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
  fastify.put('/:collection/:id', {
    schema: {
      description: 'Update a single data by ID',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          },
          id: {
            type: 'string',
            description: 'Target data ID',
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          data: {
            example: {updated_at: '2021-04-30 03:59:00'}
          }
        }
      },
      response: {
        200: {
          description: 'Succeeded to update a single data: Return the previous saved data (If data.$errors property exists, validation error has been occurred.)',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        404: {
          description: 'The target data is not found',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
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
      reply.send(await model.update(filter, request.body.data));
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
  fastify.delete('/:collection/:id', {
    schema: {
      description: 'Delete a single data by ID',
      params: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Data resource name',
          },
          id: {
            type: 'string',
            description: 'Target data ID',
          }
        }
      },
      response: {
        200: {
          description: 'Succeeded to delete a single data: Return the previous saved data',
          type: 'array',
          example: [
            {_id: 'Nm79zWhjCmHNUoIY', language: 'JavaScript', framework: 'Fastify', created_at: '2021-04-30 03:14:00'}
          ]
        },
        404: {
          description: 'The target data is not found',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        },
        500: {
          description: 'Internal error',
          type: 'object',
          properties: {
            error: {type: 'string', example: 'Error message'}
          }
        }
      }
    }
  }, async (request, reply) => {
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
      reply.send(prevData);
    } catch (err) {
      reply.code(500).send({error: process.env.DEBUG === 'true'? err.stack: err.toString()});
    }
  });
};