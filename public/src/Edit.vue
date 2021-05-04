<template>
  <section>
    <h1><router-link :to="`/list/${resource}`">{{ resource }}</router-link></h1>
    <form class="card" @submit.prevent="saveData">
      <div class="card-header">
        <h2 class="card-title">{{ item._id? `編集：${item._id}`: '新規作成' }}</h2>
      </div>
      <div class="card-body">
        <div :style="`transition: 1s; opacity: ${errors.length > 0? 1: 0}; width: ${errors.length > 0? '100%': 0}`">
          <div class="alert alert-danger" role="alert">
            <div v-for="(error, index) in errors" :key="`error-${index}`">{{ error.message }}</div>
          </div>
        </div>
        <div class="form-group" v-for="key in Object.keys(schema.schema.properties)" :key="`form-group-${key}`">
          <label :for="key">{{ key }}</label>
          <input :id="key" class="form-control" v-model="inputs[key]" />
        </div>
      </div>
      <div class="card-footer">
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </section>
</template>

<script>
module.exports = {
  data() {
    return {
      resource: '',
      item: {},
      schema: {schema: {properties: {}}},
      inputs: {},
      errors: [],
    };
  },

  async mounted() {
    this.resource = this.$route.params.resource;
    if (this.$route.params.id) {
      try {
        this.item = (await axios.get(`/api/monedb/${this.resource}/${this.$route.params.id}`)).data;
      } catch (err) {
        this.item = {_id: null};
      }
    } else {
      this.item = {_id: null};
    }

    this.schema = (await axios.get(`/api/monedb/@schemes?query=(filter:(name:${this.resource}))`)).data[0];
    this.inputs = {};

    for (const key of Object.keys(this.schema.schema.properties)) {
      this.inputs[key] = this.item[key] || '';
    }
  },

  methods: {
    async saveData() {
      try {
        let res;
        // clear empty inputs
        Object.keys(this.inputs).map(key => this.inputs[key] === ''? delete this.inputs[key]: key);
        console.log(this.inputs);
        if (this.item._id) {
          // update
          res = await axios.put(`/api/monedb/${this.resource}/${this.item._id}`, {data: this.inputs});
        } else {
          // insert
          res = await axios.post(`/api/monedb/${this.resource}`, {data: this.inputs});
        }
        console.log(res);
        // validation error
        if (res.data[0].$errors) {
          this.errors = res.data[0].$errors;
        } else {
          // succeeded to update/insert => return to the list page
          this.$router.push({path: `/list/${this.resource}`});
        }
      } catch (err) {
        console.error(err);
        // this.errors = err.response.data;
      }
    },
  },
}
</script>