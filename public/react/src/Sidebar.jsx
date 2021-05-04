const Sidebar = props => {
  const [state, setState] = React.useState({menuItems: []});

  /**
   * Get menu items from MoneDB.@schemes[].target
   */
  React.useEffect(() => {
    (async () => {
      const data = (await axios.get('/api/monedb/@schemes')).data;
      setState({
        ...state,
        menuItems: data.map(e => e.name),
      });
    })();
  }, []);

  return (
    <aside className="main-sidebar sidebar-dark-primary elevation-4">
      <a href="/" className="brand-link logo-switch">
        <img src="https://adminlte.io/docs/3.1//assets/img/logo-xl.png" alt="AdminLTE Logo" className="brand-image-xs logo-xl" style={{left: '12px'}} />
      </a>

      <nav className="sidebar">
        <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
          {
            state.menuItems.map((item, index) => (
              <li className="nav-item" key={`menuitem-${index}`}>
                <a href={`/?page=list&target=${item}`} className={`nav-link ${item === props.active? 'active': ''}`}>{item}</a>
              </li>
            ))
          }
        </ul>
      </nav>
    </aside>
  );
};