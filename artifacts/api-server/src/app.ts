import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Body parsers are intentionally NOT registered here.
// Each route applies its own body parser as route-level middleware, AFTER
// the per-IP rate limit check runs. This prevents unauthenticated clients
// from forcing body-parsing work (and triggering the large 8 MB window on
// the photo-analysis path) before ever hitting the rate limiter.
app.use("/api", router);

export default app;
