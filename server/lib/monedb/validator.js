/**
 * Validation plugin for MoneDB
 */
const Ajv = require('ajv');
const ajvFormats = require('ajv-formats');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');

/**
 * MoneDB Validator
 */
class Validator {
  /**
   * Custom types for `updating` schema
   * [each function]
   * @param {object} data current processing data (current processing value => data[column])
   * @param {string} column current processing column (current processing value => data[column])
   * @param {object} arguments optional arguments {
   *   $validator {MoneDB.Validator}: this
   *   $collection {MoneDB.Collection}
   *   $prevData {object}: previous saved data (empty object on MoneDB.Collection.insert event)
   *   ...etc: designated arguments in `$schema.updating.$column` object
   * }
   */
  static TYPES = {
    /**
     * process each value for the array
     * {type: 'array', items: {type: string|string[], ...}}
     */
    array: async (data, column, {$validator, $collection, $prevData, items}) => {
      for (let i = 0; i < data[column].length; ++i) {
        try {
          await $validator.__validate(items.type, data[column], i, {...items, $validator, $collection, $prevData});
        } catch (err) {
          throw new Error(err.errors.map(e => e.message).join('\n'));
        }
      }
    },

    /**
     * format to auto-increment the value
     * {type: 'increment'}
     */
    increment: async (data, column, {$collection, $prevData}) => {
      // increment the value only on inserted
      if (data[column] === undefined && Object.keys($prevData).length === 0) {
        const rows = await $collection.find({sort: {field: column, order: 'DESC'}, pagination: {page: 1, perPage:  1}});
        const max = rows.length > 0? (parseInt(rows[0][column], 10) || 0): 0;
        data[column] = max + 1;
      }
    },

    /**
     * validate the value is unique
     * {type: 'unique'}
     */
    unique: async (data, column, {$collection, $prevData}) => {
      const rows = await $collection.find({filter: {[column]: data[column]}});
      if (rows.length > 0 && rows[0]._id !== $prevData._id) {
        // validation error
        throw new Error(`must be a unique value "${column}"`);
      }
    },

    /**
     * validate if the value exists in database
     * {type: 'exists', collection: {string} = undefined, key: {string} = '_id'}
     */
    exists: async (data, column, {$collection, collection, key}) => {
      const col = typeof collection === 'string'? $collection.database.collection(collection): $collection;
      if ((await col.find({filter: {[key || '_id']: data[column]}, pagination: {page: 1, perPage: 1}})).length === 0) {
        throw new Error(`a value of "${column}": ${data[column]} must exist in ${collection || '#'}.${key || '_id'}`);
      }
    },

    /**
     * password hashing formatter
     * {type: 'hash', salt: {int} = 10}
     */
    hash: (data, column, {salt}) => {
      if (data[column]) data[column] = bcrypt.hashSync(data[column], salt || 10);
    },

    /**
     * set current datetime to the value formatter on only inserted
     * {type: 'timestamp_inserted', format: {string} = 'YYYY-MM-DD HH:mm:ss'}
     */
    timestamp_inserted: (data, column, {$prevData, format}) => {
      // only set current date-time: on inserted (prevData is empty) and target value is empty
      if (!data[column] && Object.keys($prevData).length === 0) data[column] = dayjs().format(format || 'YYYY-MM-DD HH:mm:ss');
    },

    /**
     * set current datetime to the value formatter
     * {type: 'timestamp_updated', format: {string} = 'YYYY-MM-DD HH:mm:ss'}
     */
    timestamp_updated: (data, column, {format}) => {
      if (!data[column]) data[column] = dayjs().format(format || 'YYYY-MM-DD HH:mm:ss');
    },
  };

  /**
   * Add types plugin
   * @param {object} types
   */
  static AddTypes(types) {
    Validator.TYPES = {...Validator.TYPES, ...types};
  }

  /**
   * @param {object} option
   */
  constructor(option) {
    this.ajv = new Ajv({allErrors: true, useDefaults: true, ...option});
    ajvFormats(this.ajv);

    /**
     * Ajv keyword: `updating` {
     *   [$column]: {type: string|string[], ...arguments}
     * }
     */
    this.ajv.addKeyword({
      keyword: 'updating',
      type: 'object',
      schemaType: 'object',
      implements: ['collection', 'prevData'], // use keywords: collection, prevData
      async: true,
      compile: (schema, parentSchema) => (
        async data => {
          for (const column of Object.keys(schema)) {
            await this.__validate(
              schema[column].type,
              data,
              column,
              {...schema[column], $validator: this, $collection: parentSchema.collection, $prevData: parentSchema.prevData}
            );
          }
          return true;
        }
      ),
    });
  }

  /**
   * @private Process `updating` schema
   * @param {string|string[]} type
   * @param {object} data
   * @param {string|int} column
   * @param {object} args
   * @throws {Ajv.ValidationError}
   */
  async __validate(type, data, column, args) {
    // process the type function
    const process = async (type, errors) => {
      try {
        const fn = Validator.TYPES[type];
        await fn(data, column, args);
      } catch (err) {
        errors.push({instancePath: `/${column}`, keyword: type, params: args, message: err.message});
      }
    };

    // process the each types
    const errors = [];

    if (typeof type === 'string') {
      await process(type, errors)
    } else if (Array.isArray(type)) {
      for (const t of type) await process(t, errors);
    }

    if (errors.length > 0) throw new Ajv.ValidationError(errors);
  }

  /**
   * Generate validatable collection
   * @param {MoneDB.Collection} collection
   * @param {object} schema
   * @returns {ValidatableCollection}
   */
  compile(collection, schema) {
    return new ValidatableCollection(collection, this.ajv, schema);
  }
}

/**
 * Validatable MoneDB.Collection
 */
class ValidatableCollection {
  constructor(collection, ajv, schema) {
    this.schema = {
      additionalProperties: false,
      updating: {},
      ...schema,
      $async: true,
      type: 'object',
      collection, // Collection handler for `updated` schema
      prevData: {}, // Previous saved data: only set on MoneDB.Collection.update event
    };
    this.insertValidate = ajv.compile(this.schema);
    this.updateValidate = ajv.compile(this.updateSchema = {
      ...this.schema,
      required: [], // no required columns on updated
    });
  }

  /**
   * Get count of data
   * @param {object} filter {_id: string|number, ...}
   * @returns {number}
   */
   async count(filter = {}) {
    return await this.schema.collection.count(filter);
  }

  /**
   * Search for resources
   * @param {object} params {pagination: {page: int, perPage: int}, sort: {field: string, order: 'ASC'|'DESC'}, filter: {*}}
   * @param {object} paginator set if you want to get pagination info; => return {page: number, count: number, skip: number, perPage: number, lastPage: number}
   * @returns {object[]}
   */
  async find(params, paginator = {}) {
    return await this.schema.collection.find(params, paginator);
  }

  /**
   * Insert data
   * @param {object|object[]} data 
   * @returns {object[]|object} inserted_data
   * @throws {object[]} validation errors
   */
  async insert(data) {
    if (Array.isArray(data)) {
      const inserted = [];
      for (const row of data) {
        inserted.push(
          await this.schema.collection.insert(await this.validate(row))
        );
      }
      return inserted;
    }
    return await this.schema.collection.insert(await this.validate(data));
  }

  /**
   * Update data
   * @param {object} filter target data filter
   * @param {object} data for updating
   * @returns {number} updated count
   * @throws {object[]} validation errors
   */
  async update(filter, data) {
    let updated = 0;
    for (const prevData of await this.schema.collection.find({filter})) {
      updated += await this.schema.collection.update(
        {_id: prevData._id},
        await this.validate(data, prevData)
      );
    }
    return updated;
  }

  /**
   * Update or Insert data
   * @param {object} filter target data filter
   * @param {object} data for updating
   * @returns {object|number} inserted data | updated count
   * @throws {object[]} validation errors
   */
  async upsert(filter, data) {
    if ((await this.find({filter})).length === 0) return await this.insert({...filter, ...data});
    return await this.update(filter, data);
  }

  /**
   * Delete data 
   * @param {object} filter target data filter
   * @returns {*}
   */
  async delete(filter) {
    return await this.schema.collection.delete(filter);
  }

  /**
   * Validate data
   * @param {object} data
   * @param {object} prevData
   * @returns {object} validated data
   * @throws {object[]} validation errors
   */
  async validate(data, prevData = {}) {
    if (Object.keys(prevData).length > 0) {
      this.updateSchema.prevData = prevData; // set the previous saved data
      return await this.updateValidate({...data}); // validate the copied data
    }
    return await this.insertValidate({...data}); // validate the copied data
  }
}

module.exports = Validator;