import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import carsRouter from "./cars";
import postsRouter from "./posts";
import feedRouter from "./feed";
import homeRouter from "./home";
import eventsRouter from "./events";
import searchRouter from "./search";
import aiRouter from "./ai";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(carsRouter);
router.use(postsRouter);
router.use(feedRouter);
router.use(homeRouter);
router.use(eventsRouter);
router.use(searchRouter);
router.use(aiRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
