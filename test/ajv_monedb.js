const Ajv = require('ajv');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const MoneDB = require('../server/lib/monedb/client');

(async () => {
  /**
   * MoneDB client
   */
  const client = new MoneDB(__dirname);
  await client.connect();

  const collection = client.db('test').collection('authors');
  await collection.delete({}); // clear data

  /**
   * Ajv validator
   */
  const ajv = new Ajv({allErrors: true, useDefaults: true});
  require('ajv-formats')(ajv);

  /**
   * Custom types for `updating` schema
   * [each function]
   * @param {object} data current processing data (current processing value => data[column])
   * @param {string} column current processing column (current processing value => data[column])
   * @param {object} arguments optional arguments {
   *   prevData {object}: previous saved data (empty object on MoneDB.Collection.insert event)
   *   collection {MoneDB.Collection}
   *   ...etc: designated arguments in `$schema.updating.$column` object
   * }
   */
  const types = {
    increment: async (data, column, {collection, prevData}) => {
      // increment the value only on inserted
      if (data[column] === undefined && Object.keys(prevData).length === 0) {
        const rows = await collection.find({sort: {field: column, order: 'DESC'}, pagination: {page: 1, perPage:  1}});
        const max = rows.length > 0? (parseInt(rows[0][column], 10) || 0): 0;
        data[column] = max + 1;
      }
    },
    unique: async (data, column, {collection, prevData}) => {
      const rows = await collection.find({filter: {[column]: data[column]}});
      if (rows.length > 0 && rows[0]._id !== prevData._id) {
        // validation error
        throw new Error(`must be a unique value "${column}"`);
      }
    },
    hash: (data, column, {salt}) => {
      if (data[column]) data[column] = bcrypt.hashSync(data[column], salt || 10);
    },
    timestamp_inserted: (data, column, {prevData, format}) => {
      // only set current date-time: on inserted (prevData is empty) and target value is empty
      if (!data[column] && Object.keys(prevData).length === 0) data[column] = dayjs().format(format || 'YYYY-MM-DD HH:mm:ss');
    },
    timestamp_updated: (data, column, {format}) => {
      if (!data[column]) data[column] = dayjs().format(format || 'YYYY-MM-DD HH:mm:ss');
    },
  };

  /**
   * Ajv keyword: `updating` {
   *   [$column]: {type: '$type_name', ...arguments}
   * }
   */
  async function processType(type, data, column, schema, parentSchema, errors) {
    try {
      const fn = types[type];
      await fn(data, column, {...schema[column], collection: parentSchema.collection, prevData: parentSchema.prevData});
    } catch (err) {
      errors.push({instancePath: `/${column}`, keyword: type, params: schema[column], message: err.message});
    }
  }
  ajv.addKeyword({
    keyword: 'updating',
    type: 'object',
    schemaType: 'object',
    implements: ['collection', 'prevData'], // use keywords: collection, prevData
    async: true,
    compile: (schema, parentSchema) => (
      async data => {
        const errors = [];
        for (const column of Object.keys(schema)) {
          const type = schema[column].type;
          if (typeof type === 'string') {
            await processType(type, data, column, schema, parentSchema, errors);
          } else if (Array.isArray(type)) {
            for (const t of type) await processType(t, data, column, schema, parentSchema, errors);
          }
        }
        if (errors.length > 0) throw new Ajv.ValidationError(errors);
        return true;
      }
    ),
  });

  /**
   * Schema definition for `authors`
   */
  const AuthorSchema = {
    $async: true,
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {type: 'string', minLength: 3, maxLength: 20},
      email: {type: 'string', format: 'email'},
      /**
       * password regex rule
       * (?=.*?[a-zA-Z]): 肯定的先読み／a-z,A-Zの前に何かある => アルファベットを1文字以上含む
       * (?=.*?\d): 肯定的先読み／数字の前に何かある => 数字を1文字以上含む
       * [ -/:-@\\[-~]: 半角記号すべて
       */
      password: {type: 'string', pattern: '^(?=.*?[a-zA-Z])(?=.*?\\d)[a-zA-Z\\d\ -/:-@\\[-~]+$', minLength: 4, maxLength: 16},
      created_at: {type: 'string', format: 'date-time'},
          updated_at: {type: 'string', format: 'date-time'},
    },
    required: ['name', 'email', 'password'],
    updating: {
      _id: {type: 'increment'},
      name: {type: 'unique'},
      email: {type: 'unique'},
      password: {type: 'hash', salt: 16}, // !cation: bcrypt.hashSync is too slow
      created_at: {type: 'timestamp_inserted', format: 'YYYY/MM/DD HH:mm:ss'},
      updated_at: {type: 'timestamp_updated', format: 'YYYY/MM/DD HH:mm:ss'},
    },
    // Collection handler for `updated` schema
    collection,
    // Previous saved data: only set on MoneDB.Collection.update event
    prevData: {},
  };

  /**
   * Main test
   */
  const insertData = [
    {name: 'Guy', email: 'guy@example.dev', password: 'j0hn', created_at: '2021-01-01 00:00:00'},
    {name: 'Alice', email: 'alice@example.dev', password: '@1ice'},
  ];
  
  let start = process.hrtime();
  // --- compile process ---
  const insertValidate = ajv.compile(AuthorSchema);
  // --- /compile process ---
  let end = process.hrtime(start);
  console.log('compile process: %f s', end[0] + (end[1] / 1000000000));
  
  start = process.hrtime();
  // --- validation process ---
  for (const data of insertData) {
    try {
      await insertValidate(data);
      console.log(
        await collection.insert(data)
      );
    } catch (err) {
      console.error(err);
    }
  }
  // --- /validation process ---
  end = process.hrtime(start);
  console.log('validation process: %f s', end[0] + (end[1] / 1000000000));
})();