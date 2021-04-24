/**
 * Test: authors data
 */
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const MoneDB = require('../server/lib/monedb');

(async() => {
  // connect to MoneDB
  const client = new MoneDB(__dirname, 'string');
  await client.connect();

  /**
   * Author model (validation)
   */
  const Author = {
    schema: {
      properties: {
        name: {type: 'string', maxLength: 16, minLength: 4},
        email: {type: 'string', format: 'email'},
        password: {type: 'string', maxLength: 16, minLength: 4},
        created_at: {type: 'string', format: 'date-time'},
        updated_at: {type: 'string', format: 'date-time'},
      },
      required: ['name', 'email', 'password'],
    },
    onupsert: {
      name: 'unique:name',
      email: 'unique:email',
      password: 'password',
    },
    oninsert: {
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
    onupdate: {
      updated_at: 'timestamp',
    },
  };

  // insert author
  const collection = await client.db('test').collection('authors', Author);
  let result = await collection.insert([
    {name: 'John', email: 'john@example.dev', password: 'pa$$wd', created_at: dayjs().subtract(1, 'year').format('YYYY-MM-DD HH:mm:ss')},
    {name: 'Sara', email: 'sara@example.dev', password: '1234'},
  ]);
  if (result === false) {
    console.error(collection.errors());
  } else {
    console.log(result);
  }

  result = await collection.update({name: 'John'}, {email: 'john@test.localhost'});
  if (result === false) {
    console.error(collection.errors());
  } else {
    console.log(result);
  }
})();