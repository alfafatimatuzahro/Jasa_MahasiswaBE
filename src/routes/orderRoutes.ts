import { Router } from "express";
import {
    createOrder,
    getBuyerOrders,
    getSellerOrders,
    updateOrderStatus,
    deliverOrderResult
} from "../controllers/orderController";

const router = Router();

router.post("/", createOrder);
router.get("/buyer/:buyerId", getBuyerOrders);
router.get("/seller/:sellerId", getSellerOrders);
router.patch("/:id/status", updateOrderStatus);
router.post("/:id/deliver", deliverOrderResult);

export default router;
