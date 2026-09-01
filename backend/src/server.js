const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Base health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nwis-backend' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NWIS Backend running on port ${PORT}`);
  });
}

module.exports = app;
