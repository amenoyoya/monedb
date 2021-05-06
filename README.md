# MoneDB

⚡ MongoDB + NeDB Rest API Server, Validator

## Environment

- Shell: `bash`
- Docker: `19.03.12`
    - docker-compose: `1.26.0`

### Setup
```bash
# Add execution permission to the CLI tool
$ chmod +x ./x

# Build docker containers
$ ./x build

# Start docker containers
$ ./x up -d
```

### Docker containers
- networks:
    - **appnet**: `local`
        - All docker containers in this project will be belonged to this network
- services:
    - **node**: `node:14-slim`
        - Node.js service container
        - routes:
            - HTTP:
                - http://localhost:{$BACKEND_PORT:-8080} => http://node:{$BACKEND_PORT:-8080}
                - http://localhost:{$FRONTEND_PORT:-8000} => http://node:{$FRONTEND_PORT:-8000}
    - **mongodb**: `mongo:4.4`
        - MongoDB service container
        - routes:
            - TCP: mongodb://root:root@mongodb:27017
    - **express**: `mongo-express:latest`
        - MongoDB WebUI service container
        - routes:
            - HTTP: http://localhost:{$MONGODB_EXPRESS_PORT:-27080} => http://express:8081

### Environment variables
Set by [.env](./.env)

- `DEBUG`: boolean
    - Set `true` for debug mode
- `BACKEND_PORT`: number
    - MoneDB Rest API endpoint port
- `FRONTEND_PORT`: number
    - Frontend HTTP server port
- `MONGO_EXPRESS_PORT`: number
    - MongoDB WebUI http port
- `MONEDB_URL` string
    - MongoDB mode: `mongodb://${user}:${password}@${mongodb_host}:${mongodb_port}`
    - NeDB mode: directory path to save
        - NeDB data file will be saved to: `/path/to/${MONEDB_URL}/${MONEDB_DATABASE}.db/${collection_name}.table`
- `MONEDB_DATABASE`: string
    - MoneDB server database name

***

## REST API

### Swagger OpenAPI Documentation

See: http://localhost:8080/api/documentation

***

## Validation

Validation schema can be defined as the following format.

```javascript
{
    // name: Validation target collection (datasource) name
    name: 'authors',

    // schema: Validation schema
    // * This is a extended Ajv format
    // ** Basic format: @see https://ajv.js.org/guide/getting-started.html#basic-data-validation
    //                       https://github.com/ajv-validator/ajv-formats
    // ** Extended format: `updating` { `column`: {type: string, ...}, ... }
    schema: {
        properties: {
            name: {type: 'string', minLength: 3, maxLength: 25},
            sex: {type: 'string', enum: ['male', 'female', 'unknown']},
            created_at: {type: 'string', format: 'date-time'},
            updated_at: {type: 'string', format: 'date-time'}
        },
        required: ['name', 'sex'],
        
        // updating: @see #[updating types] for detail
        // * Validate a data following to MoneDB data sources
        // * Set a default value dynamically
        updating: {
            _id: {type: 'increment'},
            name: {type: 'unique'},
            created_at: {type: 'timestamp_inserted'},
            updated_at: {type: 'timestamp_updated'}
        }
    }
}
```

⚡ This schema must be inserted in MoneDB `@schemes` collection.

### updating types
In the extended Ajv format (`updating`), you can use the following types.

#### array
Process each value for the array

- Format: `{type: 'array', items: {type: string|string[], ...}}`
    - `items`: Updating schema for the each values

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'passwords')
 * {
 *   name: 'passwords',
 *   schema: {
 *     properties: {
 *       name: {type: 'string', minLength: 2, maxLength: 16},
 *       passwords: {type: 'array', items: {type: 'string'}},
 *     },
 *     required: ['name'],
 *     updating: {
 *       passwords: {type: 'array', items: {type: 'hash'}}
 *     }
 *   }
 * }
 */

(async () => {
    await axios.post('http://monedb/api/monedb/passwords', {
        data: {
            name: 'test',
            passwords: ['aaa', 'bbb']
        }
    });
})();
/**
 * => http://monedb/api/monedb/passwords
 * [
 *   {
 *     _id: 'nJkbiHenERenfXW3',
 *     name: 'test',
 *     passwords: [
 *       '$2b$10$thTVIpCI8tOxeA3gAntK.ehBkWgJiHZ16aEQqlTl6DovOlF9hqeIO',
 *       '$2b$10$cvc5AQQIeuF2U.wuKeEa.OoRsTog04LUgSkeDeC2EF8J3bGWv7wFK'
 *     ]
 *   }
 * ]
 */
```

#### increment
Format the value to auto-incremental value

- Format: `{type: 'increment'}`

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'users')
 * {
 *   name: 'users',
 *   schema: {
 *     properties: {
 *       name: {type: 'string', minLength: 2, maxLength: 16},
 *     },
 *     required: ['name'],
 *     updating: {
 *       _id: {type: 'increment'}
 *     }
 *   }
 * }
 */

(async () => {
    await axios.post('http://monedb/api/monedb/users', {
        data: [
            {name: 'John'},
            {name: 'Sara'},
            {name: 'Test'},
        ]
    });
})();
/**
 * => http://monedb/api/monedb/users
 * [
 *   {
 *     _id: 1,
 *     name: 'John'
 *   },
 *   {
 *     _id: 2,
 *     name: 'Sara'
 *   },
 *   {
 *     _id: 3,
 *     name: 'Test'
 *   }
 * ]
 */
```

#### unique
Validate the value is unique

- Format: `{type: 'unique'}`

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'users')
 * {
 *   name: 'users',
 *   schema: {
 *     properties: {
 *       name: {type: 'string', minLength: 2, maxLength: 16},
 *     },
 *     required: ['name'],
 *     updating: {
 *       name: {type: 'unique'}
 *     }
 *   }
 * }
 */

(async () => {
    console.log(
        await axios.post('http://monedb/api/monedb/users', {
            data: [
                {name: 'John'},
                {name: 'John'}, // <-- This `name` is duplicated
            ]
        })
    );
    /**
     * => {
     *   ...,
     *   data: [
     *     { name: 'John', _id: 'p0VwPWNpsda1TPXy' },
     *     {
     *       name: 'John',
     *       '$errors': [
     *         {
     *           instancePath: '/name',
     *           keyword: 'unique',
     *           params: { type: 'unique' },
     *           message: 'must be a unique value "name"'
     *         }
     *       ]
     *     }
     *   ]
     * }
     */
})();
```

#### exists
Validate the value exists in database

- Format: `{type: 'exists', collection: string = undefined, key: string = '_id'}`
    - `collection`: Target datasource (default: current datasource)
    - `key`: Target value of key (column) (default: `_id`)

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'users')
 * {
 *   name: 'users',
 *   schema: {
 *     properties: {
 *       name: {type: 'string', minLength: 2, maxLength: 16},
 *       friends: {type: 'array', items: {type: 'number'}}
 *     },
 *     required: ['name'],
 *     updating: {
 *       _id: {type: 'increment'},
 *       name: {type: 'unique'},
 *       friends: {type: 'array', items: {type: 'exists', collection: 'users', key: '_id'}}
 *     }
 *   }
 * }
 */

(async () => {
    console.log(
        await axios.post('http://monedb/api/monedb/users', {
            data: [
                {name: 'John', friends: []}, // => users._id: 1
                {name: 'Sara', friends: [1]}, // => friends[1] = users[_id=1] exists: OK, users._id: 2
                {name: 'Test', friends: [2, 3]} // friends[3] = users[_id=3] not exists: Error
            ]
        })
    );
    /**
     * => {
     *   ...,
     *   data: [
     *     { name: 'John', [], _id: 1 },
     *     { name: 'Sara', friends: [1], _id: 2},
     *     {
     *       name: 'Test',
     *       '$errors': [
     *         {
     *           instancePath: '/friends',
     *           keyword: 'exists',
     *           params: { type: 'exists', collection: 'users', key: '_id' },
     *           message: 'a value of "[1]": 3 must exist in users._id'
     *         }
     *       ]
     *     }
     *   ]
     * }
     */
})();
```

#### hash
Format the value to hashed value

- Format: `{type: 'hash', salt: int = 10}`
    - `salt`: Random data for password hashing

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'administrators')
 * {
 *   name: 'administrators',
 *   schema: {
 *     properties: {
 *       name: {type: 'string', minLength: 2, maxLength: 16},
 *       password: {type: 'string', minLength: 4, maxLength: 16},
 *     },
 *     required: ['name', 'password'],
 *     updating: {
 *       password: {type: 'hash', salt: 10}
 *     }
 *   }
 * }
 */

(async () => {
    await axios.post('http://monedb/api/monedb/administrators', {
        data: {
            name: 'test',
            password: 'pa$$wd'
        }
    });
})();
/**
 * => http://monedb/api/monedb/administrators
 * [
 *   {
 *     _id: 'nJkbiHenERenfXW3',
 *     name: 'test',
 *     password: '$2b$10$nGmZuYZ1APC7OfzQeHX15.xb/1TV3LX/jGxasoarDEGnppq2nQE4.'
 *   }
 * ]
 */
```

#### timestamp_[inserted|updated]
Set the current date-time to the value

- Format: `{type: 'timestamp_updated', format: string = 'YYYY-MM-DD HH:mm:ss'}`
    - `format`: Dayjs output format
- `timestamp_inserted`:
    - Only set the current date-time when inserting and the value is not set
- `timestamp_updated`:
    - Only set the current date-time when the value is not set

```javascript
/**
 * http://monedb/api/monedb/@schemes?query=(name:'logs')
 * {
 *   name: 'logs',
 *   schema: {
 *     properties: {
 *       title: {type: 'string'},
 *       log: {type: 'string'},
 *       created_at: {type: 'string', format: 'date-time'},
 *       updated_at: {type: 'string', format: 'date-time'}
 *     },
 *     required: ['title', 'log'],
 *     updating: {
 *       created_at: {type: 'timestamp_inserted', format: 'YYYY/MM/DD HH:mm:ss'},
 *       updated_at: {type: 'timestamp_updated', format: 'YYYY/MM/DD HH:mm:ss'},
 *     }
 *   }
 * }
 */

(async () => {
    await axios.post('http://monedb/api/monedb/logs', {
        data: { title: 'test', log: 'created'}
    });
    /**
     * => http://monodb/api/monedb/logs
     * [
     *   {
     *     title: 'test',
     *     log: 'created',
     *     created_at: '2021/05/07 8:44:32',
     *     updated_at: '2021/05/07 8:44:32',
     *   }
     * ]
     */

    await axios.put('http://monedb/api/monedb/logs', {
        filter: { title: 'test' },
        data: { log: 'updated'}
    });
    /**
     * => http://monodb/api/monedb/logs
     * [
     *   {
     *     title: 'test',
     *     log: 'updated',
     *     created_at: '2021/05/07 8:44:32',
     *     updated_at: '2021/05/08 0:45:28',
     *   }
     * ]
     */
})();
```
