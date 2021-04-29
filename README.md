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
