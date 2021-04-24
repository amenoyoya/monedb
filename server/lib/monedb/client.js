/**
 * MongoDB + NeDB wrapper client
 */
const {MongoClient} = require('mongodb');
const NeDB = require('nedb-promises');
const fs = require('fs');
const path = require('path');
const omit = require('../omit');
const Validator = require('./validator');

/**
 * Check directory exists
 * @param {string} dirname 
 * @returns {boolean}
 */
function isDirectory(dirname) {
  try {
    return fs.statSync(dirname).isDirectory();
  } catch {
    return false;
  }
}

/**
 * MongoDB + NeDB wrapper Client
 */
class Client {
  /**
   * @param {string} url
   *   - MongoDB: 'mongodb://{user}:{password}@{host}:{port}'
   *   - NeDB: './' etc (FilePath: '{url}/{database}.db/{collection}.table')
   * @param {string} id_format = 'number'; Format of data._id
   *   - 'number': Format of _id like RDB such as MySQL (1, 2, 3, ...)
   *   - 'string': Default _id format of MongoDB and NeDB ('4W3JKyAaJNXGzo8b', ...)
   * @param {object} validation_option
   */
  constructor(url, id_format = 'number', validation_option = {}) {
    this.__format = id_format;
    this.ajv = new Validator(validation_option);

    if (url.match(/^mongodb[:\+]/)) {
      // MongoDB Client
      this.__type = 'mongodb';
      this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

      /**
       * Get a list of databases
       * @returns {object[]} {name: string, sizeOnDisk: number, empty: boolean}[]
       */
      this.client.databases = async () => (await this.client.db().admin().listDatabases()).databases;
    } else {
      // NeDB Client: provide API like MongoDB Client
      const collections = {};
      this.__type = 'nedb';
      this.client = {
        /**
         * Dummy method for MongoClient.connect()
         */
        connect: async () => {
          return true;
        },

        /**
         * Close NeDB Client
         */
        close: () => {
          Object.keys(collections).forEach(key => delete collections[key]);
        },

        /**
         * Get a list of databases
         * @returns {object[]} {name: string}[]
         */
        databases: async () => {
          try {
            const dirents = fs.readdirSync(url, {withFileTypes: true});
            return dirents.reduce((result, dirent) => {
              if (dirent.isDirectory() && dirent.name.match(/\.db$/)) {
                result.push({name: dirent.name.replace(/\.db$/, '')});
              }
              return result;
            }, []);
          } catch (err) {
            return [];
          }
        },
        
        /**
         * Get database instance
         * @param {string} database 
         * @returns {object} {__type: 'nedb', database_path: string, collections: {*}}
         */
        db: (database) => {
          if (!database.match(/[a-z0-9\-_#$@]+/i)) {
            throw new Error('NeDB database name allowed chars: [a-z][A-Z][1-9]-_')
          }
          // NeDB database structure: ${url}/${database}.db/${collection}.table
          const dir = path.join(url, `${database}.db`);
          if (!isDirectory(dir)) {
            fs.mkdirSync(dir, {recursive: true});
          }
          return {
            database_path: dir,
            collections,
          };
        },
      };
    }
  }

  /**
   * Connect to the MongoDB
   * @returns {*}
   */
  async connect() {
    return await this.client.connect();
  }

  /**
   * Get a database instance
   * @param {string} database_name
   * @returns {Database}
   */
  db(database_name) {
    return new Database(this, this.client.db(database_name));
  }

  /**
   * Get a list of databases
   * @returns {object[]} {name: string, ...}[]
   */
   async databases() {
    return await this.client.databases();
  }

  /**
   * Close connection
   */
  close() {
    this.client.close();
  }
}

/**
 * MongoDB + NeDB wrapper Database
 */
class Database {
  /**
   * @param {Client} client
   * @param {mongodb.Db} dbHandler
   */
  constructor(client, dbHandler) {
    this.client = client;
    this.db = dbHandler;
  }

  /**
   * Get a collection (table) object
   * @param {string} collection_name 
   * @param {object} validation_schema
   * @returns {Collection}
   */
  collection(collection_name, validation_schema = {}) {
    if (this.client.__type === 'nedb') {
      // NeDB
      if (!collection_name.match(/[a-z0-9\-_#$@]+/i)) {
        throw new Error('NeDB collection name allowed chars: [a-z][A-Z][1-9]-_')
      }
      const filename = path.join(this.db.database_path, `${collection_name}.table`);
      if (!this.db.collections[collection_name]) {
        this.db.collections[collection_name] = new NeDB({filename, autoload: true});
      }
      return new Collection(this, this.db.collections[collection_name], validation_schema);
    }
    // MongoDB
    return new Collection(this, this.db.collection(collection_name), validation_schema);
  }

  /**
   * Get a list of collections (tables)
   * @returns {object[]} {name: string, type: string, ...}[]
   */
  async collections() {
    if (this.client.__type === 'nedb') {
      // NeDB
      const dirents = fs.readdirSync(this.db.database_path, {withFileTypes: true});
      return dirents.reduce((result, dirent) => {
        if (dirent.isFile() && dirent.name.match(/\.table$/)) {
          result.push({name: dirent.name.replace(/\.table$/, ''), type: 'nedb'});
        }
        return result;
      }, []);
    }
    // MongoDB
    return await this.db.listCollections().toArray();
  }
}

/**
 * MongoDB + NeDB wrapper Collection
 */
class Collection {
  /**
   * @param {Database} database
   * @param {mongodb.Collection} handler
   */
  constructor(database, handler, validation_schema = {}) {
    this.database = database;
    this.handler = handler;
    if (typeof validation_schema.schema === 'object') {
      this.validator = this.database.client.ajv.compile(this, validation_schema);
    }
  }

  /**
   * Get validation errors 
   * @returns {object[]}
   */
  errors() {
    return this.validator? this.validator.errors(): [];
  }

  /**
   * Get count of data
   * @param {object} filter {_id: string|number, ...}
   * @returns {number}
   */
  async count(filter = {}) {
    return this.database.client.__type === 'nedb'? await this.handler.count(filter): await this.handler.find(filter).count();
  }

  /**
   * Search for resources
   * @param {object} params {pagination: {page: int, perPage: int}, sort: {field: string, order: 'ASC'|'DESC'}, filter: {*}}
   * @param {object} paginator set if you want to get pagination info; => return {page: number, count: number, skip: number, perPage: number, lastPage: number}
   * @returns {object[]}
   */
  async find(params, paginator = {}) {
    const cursor = this.handler.find(params.filter || {});
    if (params.sort && params.sort.field) {
      cursor.sort({[params.sort.field]: params.sort.order === 'DESC'? -1: 1});
    }
    if (params.pagination) {
      const page = typeof(params.pagination.page) === 'number'? (params.pagination.page < 1? 1: params.pagination.page): 1;
      const perPage = params.pagination.perPage || 50;
      const count = await this.count(params.filter || {});
      const skip = count > 0? (page - 1) * perPage: 0;
      
      cursor.limit(perPage).skip(skip);
      // set pagination info
      if (typeof(paginator) === 'object') {
        paginator.page = page;
        paginator.count = count;
        paginator.skip = skip;
        paginator.perPage = perPage;
        paginator.lastPage = Math.ceil(count / perPage);
      } else {
        // set count info
        if (typeof(paginator) === 'object') {
          paginator.page = 1;
          paginator.count = await this.count(params.filter || {});
          paginator.skip = 0;
          paginator.perPage = paginator.count;
          paginator.lastPage = 1;
        }
      }
    }
    return this.database.client.__type === 'nedb'? await cursor: await cursor.toArray();
  }

  /**
   * Insert data
   * @param {object|object[]} data 
   * @returns {object[]|boolean} inserted data (false: validation error has been occurred)
   */
  async insert(data) {
    const docs = [];
    
    // _id fixture & validation
    const maxIdData = await this.find({sort: {field: '_id', order: 'DESC'}, pagination: {page: 1, perPage:  1}});
    const maxId = maxIdData.length > 0? maxIdData[0]._id: 0;
    if (Array.isArray(data)) {
      let i = 0;
      for (const row of data) {
        if (typeof row === 'object' && Object.keys(row).length > 0) {
          const insert_data = this.validator? await this.validator.insert_check(row): row;
          if (insert_data === false) return false; // validation error
          // _id fixture: if __format is 'number', then increment the _id
          if (this.database.client.__format === 'number') docs.push({...insert_data, _id: maxId + (++i)});
          else docs.push(insert_data);
        }
      }
    } else if (typeof data === 'object' && Object.keys(data).length > 0) {
      const insert_data = this.validator? await this.validator.insert_check(data): data;
      if (insert_data === false) return false; // validation error
      // _id fixture: if __format is 'number', then increment the _id
      if (this.database.client.__format === 'number') docs.push({...insert_data, _id: maxId + 1});
      else docs.push(insert_data);
    }

    return this.database.client.__type === 'nedb'?
      await this.handler.insert(docs)
      : (await this.handler.insertMany(docs)).ops;
  }

  /**
   * Update data
   * @param {object} filter target data filter
   * @param {object} data for updating
   * @returns {number|boolean} updated count (false: validation error has been occurred)
   */
  async update(filter, data) {
    let count = 0;
    for (const row of await this.find({filter})) {
      const update_data = this.validator? await this.validator.update_check(row, data): data;
      if (update_data === false) return false; // validation error
      count += this.database.client.__type === 'nedb'?
        await this.handler.update({_id: row._id}, {$set: update_data})
        : (await this.handler.updateOne({_id: row._id}, {$set: update_data})).result.nModified;
    }
    return count;
  }

  /**
   * Update or Insert data
   * @param {object} filter target data filter
   * @param {object} data for updating
   * @returns {object[]|number} inserted data | updated count
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
    return this.database.client.__type === 'nedb'?
      await this.handler.remove(filter, {multi: true})
      : (await this.handler.deleteMany(filter)).result.n;
  }
}

module.exports = Client;