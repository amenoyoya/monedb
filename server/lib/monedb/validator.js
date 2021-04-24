/**
 * Validation plugin for MoneDB
 */
const Ajv = require('ajv');
const bcrypt = require('bcrypt');
const dayjs = require('dayjs');

/**
 * MoneDB Validator
 */
class MoneValidator {
  /**
   * @param {object} option 
   */
  constructor(option = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      ...option,
    });
    require('ajv-formats')(this.ajv);

    // default actions
    this.actions = {
      password: (key, prevData, data, [collection]) => data[key]? bcrypt.hashSync(data[key], 10): undefined,

      timestamp: (key, prevData, data, [collection]) => data[key] || dayjs().format('YYYY-MM-DD HH:mm:ss'),

      // action: `unique:column` validation
      unique: async (key, prevData, data, [collection, column]) => {
        const rows = await collection.find({filter: {[column]: data[key]}});
        if (rows.length > 0 && rows[0]._id !== prevData._id) {
          // validation error
          throw new Error(`must be a unique value "${key}"`);
        }
      }
    };
  }

  /**
   * Set actions plugin
   * @param {object} actions 
   */
  setActions(actions) {
    this.actions = {...this.actions, actions};
  }

  /**
   * @param {MoneDB.Collection} collection 
   * @param {object} validator {schema: object, onupsert: object, oninsert: object, onupdate: object}
   * @returns {object} validator
   */
  compile(collection, validator = {}) {
    const validates = {
      oninsert: this.ajv.compile({
        type: 'object',
        additionalProperties: false,
        properties: {},
        ...(validator.schema || {}),
      }),
      onupdate: this.ajv.compile({
        type: 'object',
        additionalProperties: false,
        properties: {},
        ...(validator.schema || {}),
        required: [], // no required input when updating
      }),
    }

    validator.oninsert = {
      ...(validator.onupsert || {}),
      ...(validator.oninsert || {}),
    };
    validator.onupdate = {
      ...(validator.onupsert || {}),
      ...(validator.onupdate || {}),
    };

    /**
     * Process oninsert/onupdate event
     * @param {object} event 'oninsert'|'onupdate'
     * @param {object} prevData
     * @param {object} data
     */
    const __process = async (event, prevData, data) => {
      // clear errors
      validates.oninsert.errors = [];
      validates.onupdate.errors = [];

      for (const key of Object.keys(validator[event])) {
        if (validator.schema.properties[key] === undefined) continue;
        
        // action name format: `${action_name}:${argv1},${argv2},...`
        const args = validator[event][key].split(':');
        const action = this.actions[args[0]];
        if (typeof action !== 'function') continue;

        try {
          // set default data value
          const value = await action(key, prevData, data, [collection, ...(args.length > 1? args[1].split(','): [])]);
          if (value !== undefined) data[key] = value;
        } catch (err) {
          // validation error
          validates[event].errors.push({
            instancePath: `/${key}`,
            schemaPath: `@/${event}/${key}`,
            keyword: event,
            message: err.message,
          });
        }
      }
    }

    return {
      /**
       * Get errors
       * @returns {object[]}
       */
      errors() {
        return [...(validates.oninsert.errors || []), ...(validates.onupdate.errors || [])];
      },

      /**
       * Check validation for inserting data
       * @param {object} data
       * @returns {object|boolean} data for inserting | false: validation error
       */
      async insert_check(data) {
        const insert_data = {...data};
        // validate by ajv
        if (!validates.oninsert(insert_data)) return false;
        // process oninsert event
        await __process('oninsert', {}, insert_data);
        return validates.oninsert.errors.length === 0? insert_data: false;
      },

      /**
       * Check validation for updating data
       * @param {object} prevData
       * @param {object} data
       * @returns {object|boolean} data for inserting | false: validation error
       */
      async update_check(prevData, data) {
        const update_data = {...data};
        // validate by ajv
        if (!validates.onupdate(update_data)) return false;
        // process onupdate event
        await __process('onupdate', prevData, update_data);
        return validates.onupdate.errors.length === 0? update_data: false;
      },
    };
  }
}

module.exports = MoneValidator;