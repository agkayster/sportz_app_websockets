import express from 'express';
import {matchRouter} from './routes/matches.js';
const app = express();
const PORT = 8000;


// middleware that allows express to read JSON content/data
app.use(express.json());

// backend home route
app.get('/', (req, res) => {
    res.json({ message: 'Sportz App WebSockets server is running 🚀' });
});

// to get the list of matches
app.use("/matches", matchRouter);

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
