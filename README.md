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
            - HTTP: http://localhost:{$NODE_PORT:-8080} => http://node:{$NODE_PORT:-8080}
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
- `NODE_PORT`: number
    - MoneDB Rest API endpoint port
- `MONGO_EXPRESS_PORT`: number
    - MongoDB WebUI http port
- `MONEDB_URL` string
    - MongoDB mode: `mongodb://${user}:${password}@${mongodb_host}:${mongodb_port}`
    - NeDB mode: save directory path
        - NeDB data file will be saved to: `/path/to/${MONEDB_URL}/${MONEDB_DATABASE}.db/${collection_name}.table`
- `MONEDB_DATABASE`: string
    - MoneDB server database name
- `MONEDB_ID_FORMAT`: string (`string`|`number`)
    - `string`: MoneDB.data._id is random string: default format for MongoDB, NeDB
    - `number`: MoneDB.data._id is integer like RDBMS (1, 2, 3, ... auto increment)
