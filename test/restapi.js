const axios = require('axios');
const rison = require('rison');

require('dotenv').config({path: `${__dirname}/../.env`});

(async () => {
  const endpoint = `http://localhost:${process.env.BACKEND_PORT}`;

  /**
   * Author schema definition
   */
  console.log((
    await axios.put(`${endpoint}/api/monedb/@schemes`, {
      filter: {name: 'authors'},
      data: {
        schema: {
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
        },
      }
    })
  ).data);
  
  /**
   * Books schema definition
   */
  console.log((
    await axios.put(`${endpoint}/api/monedb/@schemes`, {
      filter: {name: 'books'},
      data: {
        schema: {
          properties: {
            title: {type: 'string', minLength: 3, maxLength: 225},
            authors: {type: 'array', items: {type: 'number'}},
            published_at: {type: 'string', format: 'date'},
            created_at: {type: 'string', format: 'date-time'},
            updated_at: {type: 'string', format: 'date-time'},
          },
          required: ['title', 'published_at'],
          updating: {
            _id: {type: 'increment'},
            title: {type: 'unique'},
            authors: {type: 'array', items: {type: 'exists', collection: 'authors', key: '_id'}},
            created_at: {type: 'timestamp_inserted'},
            updated_at: {type: 'timestamp_updated'},
          },
        }
      }
    })
  ).data);

  // authors
  await axios.delete(`${endpoint}/api/monedb/authors`, {data: {filter: {}}}); // clear all authors
  console.log((
    await axios.post(`${endpoint}/api/monedb/authors`, {data: [
      {name: 'Wiki Pedia', sex: 'unknown'},
      {name: 'Dandy Dandan', sex: 'male'},
      {name: 'Wife Wiseman', sex: 'female'},
      {name: 'Phantom Lord', sex: null}, // this will not be inserted
    ]})
  ).data);

  // books
  await axios.delete(`${endpoint}/api/monedb/books`, {data: {filter: {}}}); // clear all books
  console.log((
    await axios.post(`${endpoint}/api/monedb/books`, {data: [
      {title: 'The Big Dictionaty of the World', published_at: '1900-09-08', authors: [1, 2]},
      {title: 'This book does not exists', published_at: '2121-12-24', authors: [3]},
      {title: 'I am a Phantom, You are a Human', published_at: '2011-01-01', authors: [4]}, // this will not be inserted
    ]})
  ).data);

  /**
   * Get authors data where the book[_id=1]'s authors
   */
  try {
    const book = (await axios.get(`${endpoint}/api/monedb/books?query=(filter:(_id:1))`)).data[0];
    const uri = `${endpoint}/api/monedb/authors?query=${rison.encode({
      filter: {
        _id: {$in: book.authors}
      }
    })}`;
    const authors = (await axios.get(uri)).data;
    console.log(authors);
  } catch (err) {
    console.error(err.response.data);
  }

  /**
   * Update the book[_id=1] title
   */
  console.log((
    await axios.put(`${endpoint}/api/monedb/books/1`, {data: {published_at: '1999-09-09'}})
  ).data);
  console.log((
    await axios.get(`${endpoint}/api/monedb/books/1`)
  ).data);
})();