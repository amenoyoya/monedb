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
  methods: {
    deleteData() {
      alert('delete');
    }
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
      row.push(`<button class="btn btn-info" id="editBtn" data-resource="${this.resource}" data-id="${item._id}">編集</button><button class="btn btn-danger" id="deleteBtn" data-resource="${this.resource}" data-id="${item._id}" @click.prevent="deleteData">削除</button>`);
      sheet.data.push(row);
    }
    for (const property of Object.keys(schema.schema.properties)) {
      sheet.columns.push({
        title: property,
        width: property.length * 15,
      });
    }
    sheet.columns.push({
      title: 'Action',
      type: 'html',
      width: 200,
      readOnly: true,
    });
    
    const table = jspreadsheet(document.getElementById('spreadsheet'), {
      data: sheet.data,
      columns: sheet.columns,
    });

    const router = this.$router;
    
    $('#editBtn').on('click', () => {
      const btn = window.$('#editBtn');
      router.push({path: `/edit/${btn.data('resource')}/${btn.data('id')}`});
    });

    $('#deleteBtn').on('click', async () => {
      const btn = window.$('#deleteBtn');
      const resource = btn.data('resource');
      const deleted = (await axios.delete(`/api/monedb/${resource}/${btn.data('id')}`)).data;
      window.alert(`${resource}: ${deleted._id} を削除しました`);
      router.push({path: `/list/${resource}`, force: true});
    });
  }
}
</script>