/**
 * Test: No schema data
 */
const dayjs = require('dayjs');
const MoneDB = require('../server/lib/monedb/client');

(async() => {
  // connect to MoneDB
  const client = new MoneDB('mongodb://root:root@mongodb:27017');
  await client.connect();

  const collection = await client.db('test').collection('authors');

  // delete authors
  console.log('delete', await collection.delete({}));

  // insert author
  let result = await collection.insert([
    {name: 'John', email: 'john@example.dev', password: 'pa$$wd', created_at: dayjs().subtract(1, 'year').format('YYYY-MM-DD HH:mm:ss')},
    {name: 'Sara', email: 'sara@example.dev', password: '123'},
  ]);
  if (result === false) {
    console.error(collection.errors());
  } else {
    console.log(result);
  }

  // update author
  result = await collection.update({name: 'John'}, {email: 'john@test.localhost'});
  if (result === false) {
    console.error(collection.errors());
  } else {
    console.log(result);
  }

  client.close();
})();