import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import patientsRouter from "./patients";
import therapistsRouter from "./therapists";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import evolutionsRouter from "./evolutions";
import financialRouter from "./financial";
import attestationsRouter from "./attestations";
import birthdaysRouter from "./birthdays";
import contentRouter from "./content";
import fiscalRouter from "./fiscal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(patientsRouter);
router.use(therapistsRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(evolutionsRouter);
router.use(financialRouter);
router.use(attestationsRouter);
router.use(birthdaysRouter);
router.use(contentRouter);
router.use(fiscalRouter);

export default router;
