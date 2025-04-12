const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'Order service running' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Order service on port ${PORT}`));