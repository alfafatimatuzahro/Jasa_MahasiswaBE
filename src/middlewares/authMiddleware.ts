// Contoh src/middlewares/authMiddleware.ts
export const isAdmin = (req, res, next) => {
    // Asumsi req.user diisi oleh middleware pembaca JWT sebelumnya
    if (req.user && req.user.role === 'admin') {
        next(); // Lolos, silakan masuk ke controller admin
    } else {
        res.status(403).json({ error: 'Akses ditolak. Khusus Admin.' });
    }
};