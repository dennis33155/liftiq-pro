import { Router, type IRouter } from "express";
import healthRouter from "./health";
import workoutSuggestionRouter from "./workout-suggestion";
import coachRouter from "./coach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workoutSuggestionRouter);
router.use(coachRouter);

export default router;
