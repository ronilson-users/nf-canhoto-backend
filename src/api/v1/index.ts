// src/api/v1/index.ts
import { Router } from "express";
import invoicesRouter from './invoices/invoice.router';
import userRouter from "./users/user.router";


const router = Router();

// Health check
router.get("/health", (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		version: "v1"
	});
});

// ✅  Rotas
router.use("/users", userRouter);
router.use('/invoices', invoicesRouter);



export default router;
