const List = props => {
  React.useEffect(() => {
    (async () => {
      const items = (await axios.get(`/api/monedb/${props.target}`)).data;
      const schema = (await axios.get(`/api/monedb/@schemes?query=(filter:(name:${props.target}))`)).data[0];
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
    })();
  }, []);
  return <div id="spreadsheet"></div>;
};