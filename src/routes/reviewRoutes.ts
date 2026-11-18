import { Router } from "express";
import { createReview, getServiceReviews } from "../controllers/reviewController";

const router = Router();

router.post("/", createReview);
router.get("/service/:serviceId", getServiceReviews);

export default router;
