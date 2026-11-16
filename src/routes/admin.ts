import { Router } from "express";
import { 
    getDashboardStats, 
    verifyKtm, 
    getAiLogs, 
    getUsers, 
    getTransactions, 
    getPendingServices,
    getSettingsAndLogs,
    updatePlatformSettings,
    updateAdminProfile
} from "../controllers/adminController";

// import { verifyToken, isAdmin } from "../middlewares/authMiddleware"; 

export const adminRouter = Router();

// adminRouter.use(verifyToken, isAdmin); 

// Rute Statistik Dashboard
adminRouter.get("/stats", getDashboardStats);

// Rute Verifikasi KTM
adminRouter.put("/verify-ktm/:id", verifyKtm);

// Rute Pemantauan AI
adminRouter.get("/ai-logs", getAiLogs);

// Rute Manajemen User, Transaksi & Moderasi Jasa
adminRouter.get("/users", getUsers);
adminRouter.get("/transactions", getTransactions);
adminRouter.get("/services/pending", getPendingServices);

// Rute Pengaturan Sistem & Profil Admin
adminRouter.get("/settings", getSettingsAndLogs);
adminRouter.put("/settings", updatePlatformSettings);
adminRouter.put("/profile", updateAdminProfile);