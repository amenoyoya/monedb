const Sidebar = props => {
  const [menuItems, setMenuItems] = React.useState([]);

  /**
   * Get menu items from MoneDB.@validators[].target
   */
  React.useEffect(() => {
    (async () => {
      const data = (await axios.get('/api/monedb/@validators')).data;
      setMenuItems(data.map(e => e.target));
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
            menuItems.map((item, index) => (
              <li className="nav-item" key={`menuitem-${index}`}>
                <a href="#" className="nav-link active">{item}</a>
              </li>
            ))
          }
        </ul>
      </nav>
    </aside>
  );
};