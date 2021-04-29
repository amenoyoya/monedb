const Ajv = require("ajv");
const dayjs = require('dayjs');

const ajv = new Ajv({useDefaults: true});

ajv.addKeyword({
  keyword: 'timestamps',
  type: 'object',
  schemaType: 'array',
  // async: true,
  compile: (args, parentSchema) => {
    return function (data) {
      // console.log('<args>', args); // => ['created_at']
      // console.log('<parentSchema>', parentSchema); // => {$async: true, type: 'object', properties: {object}, ...}
      // console.log('<data>', data); // => {foo: 1}
      
      // modify current date-time value
      for (const key of args) {
        if (!data[key]) data[key] = dayjs().format('YYYY-MM-DD HH:mm:ss');
      }
      return true; // validation: ok
    }
  },
});

const schema = {
  // $async: true,
  type: 'object',
  properties: {
    created_at: {type: 'string'}
  },
  timestamps: ['created_at'],
  // required: ['created_at'],
};

(async () => {
  const data = {foo: 1};
  const validate = ajv.compile(schema);

  console.log(validate(data));
  console.log(data);
})();