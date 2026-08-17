const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  })
);
app.use(express.json());

app.use('/api', apiRoutes);

// Anything outside /api/* is not a route this server knows about.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(errorHandler);

module.exports = app;
