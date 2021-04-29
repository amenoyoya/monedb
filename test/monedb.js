const connectMoneDB = require('../server/lib/monedb');
const dayjs = require('dayjs');

(async () => {
  const db = await connectMoneDB(__dirname, 'test');

  /**
   * Log: no schema model
   */
  const logs = await db.model('logs');
  console.log(await logs.delete());

  const inserted = await logs.insert({log: 'no schema model', created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')});
  console.log(inserted);

  console.log(await logs.update({_id: inserted._id}, {log: 'schema updated', updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')}));

  /**
   * Schema definition save into `@schemes`
   */
  const schemes = await db.model('@schemes');
  await schemes.upsert({name: 'authors'}, {schema: {
    properties: {
      name: {type: 'string', minLength: 3, maxLength: 225},
      sex: {enum: ['male', 'female', 'unknown']},
      created_at: {type: 'string', format: 'date-time'},
      updated_at: {type: 'string', format: 'date-time'},
    },
    required: ['name', 'sex'],
    updating: {
      _id: {type: 'increment'},
      name: {type: 'unique'},
      created_at: {type: 'timestamp_inserted'},
      updated_at: {type: 'timestamp_updated'},
    },
  }});
  await schemes.upsert({name: 'books'}, {schema: {
    properties: {
      title: {type: 'string', minLength: 3, maxLength: 225},
      authors: {type: 'array', items: {type: 'number'}},
      published_at: {type: 'string', format: 'date'},
      created_at: {type: 'string', format: 'date-time'},
      updated_at: {type: 'string', format: 'date-time'},
    },
    required: ['title', 'authors', 'published_at'],
    updating: {
      _id: {type: 'increment'},
      title: {type: 'unique'},
      authors: {type: 'array', items: {type: 'exists', collection: 'authors', key: '_id'}},
      created_at: {type: 'timestamp_inserted'},
      updated_at: {type: 'timestamp_updated'},
    },
  }});

  // authors
  const authors = await db.model('authors', '@schemes');
  await authors.delete(); // clear all authors
  try {
    console.log(
      await authors.insert([
        {name: 'Wiki Pedia', sex: 'unknown'},
        {name: 'Dandy Dandan', sex: 'male'},
        {name: 'Wife Wiseman', sex: 'female'},
        {name: 'Phantom Lord', sex: null}, // this will not be inserted
      ])
    );
  } catch (err) {
    console.error(err);
  }

  try {
    console.log(
      await authors.upsert({name: 'Phantom Lord'}, {sex: 'unknown'})
    );
  } catch (err) {
    console.error(err);
  }

  // books
  const books = await db.model('books', '@schemes');
  await books.delete(); // clear all books
  try {
    console.log(
      await books.insert([
        {title: 'The Big Dictionaty of the World', published_at: '1900-09-08', authors: [1, 2]},
        {title: 'This book does not exists', published_at: '2121-12-24', authors: [3]},
        {title: 'I am a Phantom, You are a Human', published_at: '2011-01-01', authors: 4}, // this will not be inserted
      ])
    );
  } catch (err) {
    console.error(err);
  }

  try {
    console.log(
      await books.upsert(
        {title: 'Difference between the Phantom and Ghost'},
        {title: 'Difference between the Phantom and Ghost', published_at: '2017-04-30', authors: [4, 5]} // this will not be inserted
      )
    );
  } catch (err) {
    console.error(err);
  }
})();