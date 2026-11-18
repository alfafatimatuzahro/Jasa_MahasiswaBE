import { Router } from "express";
import multer from "multer";
import { 
    getDashboardStats, 
    verifyKtm, 
    getAiLogs, 
    getUsers, 
    getTransactions, 
    getPendingServices,
    getSettingsAndLogs,
    updatePlatformSettings,
    updateAdminProfile,
    uploadAdminAvatar
} from "../controllers/adminController";

import { getAllServicesAdmin, moderateService } from "../controllers/adminController";
// import { verifyToken, isAdmin } from "../middlewares/authMiddleware"; 

export const adminRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // Maksimal 2MB
});

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

// Rute Pengaturan Sistem, Profil & Upload Avatar Admin
adminRouter.get("/settings", getSettingsAndLogs);
adminRouter.put("/settings", updatePlatformSettings);
adminRouter.put("/profile", updateAdminProfile);
adminRouter.post("/upload-avatar", upload.single("avatar"), uploadAdminAvatar);

adminRouter.get("/services", getAllServicesAdmin);
adminRouter.put("/services/:id/moderate", moderateService);