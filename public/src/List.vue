<template>
  <section>
    <h1>{{ resource }}</h1>
    <div class="my-4">
      <router-link :to="`/create/${resource}`" class="btn btn-primary" role="button">新規追加</router-link>
    </div>
    <div id="spreadsheet"></div>
  </section>
</template>

<script>
module.exports = {
  data() {
    return {
      resource: '',
    };
  }, 
  async mounted() {
    this.resource = this.$route.params.resource;

    const items = (await axios.get(`/api/monedb/${this.resource}`)).data;
    const schema = (await axios.get(`/api/monedb/@schemes?query=(filter:(name:${this.resource}))`)).data[0];
    const sheet = {
      data: [],
      columns: [{
        title: 'id',
        type: 'numeric',
        width: 50,
        readOnly: true,
      }],
    };
    
    for (const item of items) {
      const row = [item._id];
      for (const property of Object.keys(schema.schema.properties)) {
        row.push(item[property]);
      }
      sheet.data.push(row);
    }
    for (const property of Object.keys(schema.schema.properties)) {
      sheet.columns.push({
        title: property,
        width: property.length * 15,
      });
    }
    
    const table = jspreadsheet(document.getElementById('spreadsheet'), {
      data: sheet.data,
      columns: sheet.columns,
    });
  }
}
</script>