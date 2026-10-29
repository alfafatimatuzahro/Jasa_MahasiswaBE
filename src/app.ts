import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pendaftaran Route Auth
app.use('/api/auth', authRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error:", err);
    res.status(500).json({ message: "Internal server error" });
});

export default app;