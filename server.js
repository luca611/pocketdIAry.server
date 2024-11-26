const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello from Render!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
