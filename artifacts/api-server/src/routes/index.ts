import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bodyAnalysisRouter from "./body-analysis";
import workoutSuggestionRouter from "./workout-suggestion";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bodyAnalysisRouter);
router.use(workoutSuggestionRouter);

export default router;
