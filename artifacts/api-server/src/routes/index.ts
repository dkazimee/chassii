import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import carsRouter from "./cars";
import postsRouter from "./posts";
import feedRouter from "./feed";
import eventsRouter from "./events";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(carsRouter);
router.use(postsRouter);
router.use(feedRouter);
router.use(eventsRouter);
router.use(searchRouter);

export default router;
