const Edit = props => {
  const [state, setState] = React.useState({
    item: {},
    schema: {schema: {properties: {}}},
    inputs: {},
    errors: [],
  });

  React.useEffect(() => {
    (async () => {
      let item = {};
      if (props.item) {
        try {
          item = (await axios.get(`/api/monedb/${props.target}/${props.item}`)).data;
        } catch (err) {
          item = {_id: null};
        }
      } else {
        item = {_id: null};
      }

      const schema = (await axios.get(`/api/monedb/@schemes?query=(filter:(name:${props.target}))`)).data[0];
      const inputs = {};

      for (const key of Object.keys(schema.schema.properties)) {
        inputs[key] = item[key] || '';
      }

      setState({
        ...state,
        item,
        schema,
        inputs,
      });
    })();
  }, []);

  async function saveData(event) {
    event.preventDefault();
    console.log(state.inputs);
    try {
      let res;
      if (state.item._id) {
        // update
        res = await axios.put(`/api/monedb/${props.target}/${state.item._id}`, {data: state.inputs});
      } else {
        // insert
        res = await axios.post(`/api/monedb/${props.target}`, {data: state.inputs});
      }
      // validation error
      if (res.data[0].$errors) {
        setState({...state, errors: res.data[0].$errors});
      } else {
        // succeeded to update/insert => return to the list page
        location.href = `/?page=list&target=${props.target}`;
      }
    } catch (err) {
      setState({...state, errors: err.response.data});
    }
  }

  return (
    <section>
      <h1><a href={`/?page=list&target=${props.target}`}>{props.target}</a></h1>
      <form className="card" onSubmit={saveData}>
        <div className="card-header">
          <h2 className="card-title">{state.item._id? `編集：${state.item._id}`: '新規作成'}</h2>
        </div>
        <div className="card-body">
          <div style={{transition: '1s', opacity: state.errors.length > 0? 1: 0, width: state.errors.length > 0? '100%': 0}}>
            <div className="alert alert-danger" role="alert">
              {state.errors.map((e, i) => <div key={`error-${i}`}>{e.message}</div>)}
            </div>
          </div>
          {
            Object.keys(state.schema.schema.properties).map(key => (
              <div className="form-group" key={`form-group-${key}`}>
                <label htmlFor={key}>{key}</label>
                {
                  Array.isArray(state.schema.schema.properties[key].enum)?
                    <select id={key} className="form-control" onChange={event => setState({...state, inputs: {...state.inputs, [key]: event.target.value}})}>
                      {state.schema.schema.properties[key].enum.map((e, i) => <option key={`enum-${key}-${i}`} value={e}>{e}</option>)}
                    </select>
                    :
                    <input id={key} className="form-control" onChange={event => setState({...state, inputs: {...state.inputs, [key]: event.target.value}})} />
                }
              </div>
            ))
          }
        </div>
        <div className="card-footer">
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </section>
  );
};