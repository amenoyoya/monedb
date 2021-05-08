/**
 * MongoDB + NeDB wrapper database server
 * - MoneDB.client + MoneDB.validator wrapper
 */
const Client = require('./monedb/client');
const Validator = require('./monedb/validator');

/**
 * Connect to the MoneDB database
 * @param {string} url
 *   - MongoDB: 'mongodb://{user}:{password}@{host}:{port}'
 *   - NeDB: './' etc (FilePath: '{url}/{database}.db/{collection}.table')
 * @param {string} database 
 * @param {object} validationOption 
 * @returns {object} {
 *   close() => null,
 *   model(name: string, schema: object) => MoneDB.ValidatableCollection
 * }
 */
module.exports = async (url, database, validationOption = {}) => {
  const client = new Client(url);
  await client.connect();

  const db = client.db(database);
  const validator = new Validator(validationOption);

  return {
    /**
     * Close database connection
     */
    close() {
      return client.close();
    },

    /**
     * Get a database model (collection) by schema
     * @param {string} name
     * @param {object|string} schema
     *   if schema is string, get a schema from MoneDB.$database.$schema {name: string, schema: object}
     * @returns {MoneDB.ValidatableCollection}
     */
    async model(name, schema = {additionalProperties: true}) {
      if (typeof schema === 'string') {
        const schemes = await db.collection(schema).find({filter: {name}, pagination: {page: 1, perPage: 1}});
        return validator.compile(
          db.collection(name),
          schemes.length > 0 && typeof schemes[0].schema === 'object'? schemes[0].schema: {additionalProperties: true}
        );
      }
      return validator.compile(db.collection(name), schema);
    },
  };
}