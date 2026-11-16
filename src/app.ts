import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin'; // 1. Tambahkan import ini

const app: Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rute dasar untuk mengecek status server
app.get('/', (req: Request, res: Response) => {
    res.send('Server API Jasa Mahasiswa Berjalan dengan Baik 🚀');
});

// Pendaftaran Route
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter); // 2. Daftarkan rute admin di sini

// Global Error Handler (Pastikan ini selalu berada paling bawah!)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error:", err);
    res.status(500).json({ message: "Internal server error" });
});

export default app;