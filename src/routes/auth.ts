import { Router } from "express";
import { login, loginAdmin } from "../controllers/authController";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/admin/login", loginAdmin);