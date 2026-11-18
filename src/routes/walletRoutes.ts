import { Router } from "express";
import {
    getSellerWallet,
    withdrawFunds,
    getAllWithdrawals,
    updateWithdrawalStatus
} from "../controllers/walletController";

const router = Router();

router.get("/seller/:sellerId", getSellerWallet);
router.post("/withdraw", withdrawFunds);
router.get("/withdrawals", getAllWithdrawals);
router.patch("/withdrawals/:id/status", updateWithdrawalStatus);

export default router;