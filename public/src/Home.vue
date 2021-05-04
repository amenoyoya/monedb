<template>
  <section>
    <button class="btn btn-primary" @click.prevent="setupDatabase">データベースセットアップ</button>
    <div :style="`transition: 1s; opacity: ${message? 1: 0}; width: ${message? '100%': 0};`">
      <div class="alert alert-success" role="alert">
        <div>{{ message }}</div>
        <div><a href="/">ページリロード</a></div>
      </div>
    </div>
  </section>
</template>

<script>
module.exports = {
  data() {
    return {
      message: '',
    }
  },

  methods: {
    async setupDatabase() {
      console.log(
        await axios.put('/api/monedb/@schemes', {
          filter: {
            name: 'authors',
          },
          data: {
            schema: {
              properties: {
                name: {type: 'string', minLength: 3, maxLength: 25},
                sex: {type: 'string', enum: ['male', 'female', 'unknown']},
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
            form: {
              name: {
                label: '著者名',
                type: 'text',
                validation: 'required|min:3|max:25',
              },
              sex: {
                label: '性別',
                type: 'select',
                options: {
                  male: '男性',
                  female: '女性',
                  unknown: '不明',
                },
                validation: 'required',
              },
              created_at: {
                label: '登録日時',
                type: 'text',
                disabled: true,
              },
              updated_at: {
                label: '更新日時',
                type: 'text',
                disabled: true,
              },
            },
          }
        })
      );
      this.message = 'データベースの準備が完了しました';
    }
  }
}
</script>
