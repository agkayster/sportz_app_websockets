import express from 'express';
const app = express();
const PORT = 8000;

// middleware to read JSON content
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Sportz App WebSockets server is running 🚀' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
