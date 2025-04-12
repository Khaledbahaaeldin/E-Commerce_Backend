const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'Auth service running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Auth service on port ${PORT}`));