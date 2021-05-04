<template>
  <aside class="main-sidebar sidebar-dark-primary elevation-4">
    <a href="/" class="brand-link logo-switch">
      <img src="https://adminlte.io/docs/3.1//assets/img/logo-xl.png" alt="AdminLTE Logo" class="brand-image-xs logo-xl" style="left: 12px" />
    </a>

    <nav class="sidebar">
      <ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
        <li class="nav-item" v-for="(item, index) in items" :key="`menu-item-${index}`">
          <router-link :to="`/list/${item}`" :class="`nav-link ${$route.params.resource === item? 'active': ''}`">{{ item }}</router-link>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script>
module.exports = {
  data() {
    return {
      items: [],
    };
  },

  async mounted() {
    const data = (await axios.get('/api/monedb/@schemes')).data;
    this.items = data.map(e => e.name);
  },
}
</script>
