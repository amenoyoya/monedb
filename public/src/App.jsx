const App = () => {
  const [state, setState] = React.useState({message: ''});

  async function setupDatabase() {
    console.log(
      await axios.put('/api/monedb/@validators', {
        filter: {
          target: 'authors',
        },
        data: {
          schema: {
            properties: {
              name: {type: 'string', maxLength: 16, minLength: 4},
              email: {type: 'string', format: 'email'},
              password: {type: 'string', maxLength: 16, minLength: 4},
              created_at: {type: 'string', format: 'date-time'},
              updated_at: {type: 'string', format: 'date-time'},
            },
            required: ['name', 'email', 'password'],
          },
          onupsert: {
            name: 'unique:name',
            email: 'unique:email',
            password: 'password',
          },
          oninsert: {
            created_at: 'timestamp',
            updated_at: 'timestamp',
          },
          onupdate: {
            updated_at: 'timestamp',
          },
        }
      })
    );
    setState({
      ...state, 
      message: 'データベースの準備が完了しました',
    });
  }
  
  return (
    <div className="sidebar-mini layout-fixed layout-navbar-fixed">
      <div className="wrapper">
        <Header />
        <Sidebar />
        <div className="content-wrapper px-4 py-2" style={{minHeight: '823px'}}>
          <button className="btn btn-primary" onClick={setupDatabase}>データベースセットアップ</button>
          <div style={{transition: '1s', opacity: state.message? 1: 0, width: state.message? '100%': 0}}>
            <div className="alert alert-success" role="alert">
              <div>{state.message}</div>
              <div><a href="/">ページリロード</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};