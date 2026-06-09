import express, { Express } from "express";
import cors from 'cors';
import { config } from 'dotenv'

const app = express();
config();

const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    return res.json({
        status: "healthy",
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});