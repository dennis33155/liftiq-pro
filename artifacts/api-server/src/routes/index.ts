import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bodyAnalysisRouter from "./body-analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bodyAnalysisRouter);

export default router;
