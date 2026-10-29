import { Router } from "express";
import { login } from "../controllers/authController";
import { validate, loginSchema } from "../middlewares/validator";

export const authRouter = Router();

// Hanya menyediakan endpoint login untuk Admin
authRouter.post("/login", validate(loginSchema), login);