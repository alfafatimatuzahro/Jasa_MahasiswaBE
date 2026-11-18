import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { serviceRouter } from './routes/serviceRoutes';
import orderRoutes from "./routes/orderRoutes";
import chatRoutes from "./routes/chatRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import walletRoutes from "./routes/walletRoutes";
import userRoutes from "./routes/userRoutes";
import { adminRouter } from './routes/admin'; // <-- Gunakan kurung kurawal { adminRouter }

const app: Application = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Akses publik untuk folder foto sampul jasa
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Pendaftaran Route Admin
app.use('/api/admin', adminRouter); // <-- Daftarkan endpoint Web Admin

// Pendaftaran Route Service
app.use('/api/services', serviceRouter);

// Pendaftaran Route Auth
app.use('/api/auth', authRouter);

// Pendaftaran Route Order
app.use("/api/orders", orderRoutes);

// Pendaftaran Route Chat
app.use("/api/chats", chatRoutes);

// Pendaftaran Route Review
app.use("/api/reviews", reviewRoutes);

// Pendaftaran Route Wallet
app.use("/api/wallets", walletRoutes);

// Pendaftaran Route User
app.use("/api/users", userRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error:", err);
    res.status(500).json({ message: "Internal server error" });
});

export default app;