const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`CampusVoiceBox API listening on http://localhost:${PORT}`);
  console.log(`Try it: curl http://localhost:${PORT}/api/health`);
});
