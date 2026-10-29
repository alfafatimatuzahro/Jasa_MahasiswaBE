import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// Middleware penangkap error zod
export const validate = (schema: ZodSchema) => 
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ 
                    message: "Validasi gagal", 
                    errors: error.issues 
                });
            }
            next(error);
        }
    };

// Skema validasi Login Admin
export const loginSchema = z.object({
    email: z.string().email("Format email tidak valid"),
    password: z.string().min(1, "Password wajib diisi")
});