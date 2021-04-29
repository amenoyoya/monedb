/**
 * Test: No schema data
 */
const fs = require('fs');
const dayjs = require('dayjs');
const MoneDB = require('../server/lib/monedb/client');
const Validator = require('../server/lib/monedb/validator');

(async() => {
  // connect to MoneDB
  const client = new MoneDB(__dirname);
  await client.connect();

  /**
   * Author model (validation schema)
   */
  const Author = {
    properties: {
      name: {type: 'string', minLength: 3, maxLength: 20},
      email: {type: 'string', format: 'email'},
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
  };

  // Validator
  const validator = new Validator();
  const collection = validator.compile(client.db('test').collection('authors'), Author);
  await collection.delete({}); // clear data

  // insert author
  try {
    console.log(
      await collection.insert([
        {name: 'John', email: 'john@example.dev', password: 'pa33wd'},
        {name: 'Sara', email: 'sara@example.dev', password: '@123A'},
        {name: 'Alice'}, // this author will not be inserted
      ])
    );
  } catch (err) {
    console.error(err);
  }

  // update author
  try {
    console.log(
      await collection.update({name: 'John'}, {name: 'John', email: 'john@test.localhost'})
    );
  } catch (err) {
    console.error(err);
  }

  try {
    console.log(
      await collection.update({name: 'Sara'}, {email: 'john@test.localhost'}) // email unique validation error will be occurred
    );
  } catch (err) {
    console.error(err);
  }

  client.close();
})();