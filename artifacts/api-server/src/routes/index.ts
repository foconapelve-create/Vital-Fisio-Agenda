import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import patientsRouter from "./patients";
import therapistsRouter from "./therapists";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(patientsRouter);
router.use(therapistsRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);

export default router;
