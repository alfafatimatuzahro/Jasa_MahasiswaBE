import { Router } from "express";
import {
    getAllUsers,
    getUserProfile,
    updateUserProfile,
    verifyUserKtm,
    getPublicSellerProfile,
    getPublicSellerProfileByService
} from "../controllers/userController";

const router = Router();

router.get("/", getAllUsers);
router.get("/public-profile/by-service/:serviceId", getPublicSellerProfileByService);
router.get("/:id/public-profile", getPublicSellerProfile);
router.get("/:id/profile", getUserProfile);
router.put("/:id/profile", updateUserProfile);
router.patch("/:id/verify", verifyUserKtm);

export default router;