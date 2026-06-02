import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET ?? "vitalfisio-secret-key-change-in-production";
const isProduction = process.env.NODE_ENV === "production";
// Replit serves everything over HTTPS even in dev mode
const isHttps = isProduction || !!process.env.REPL_ID;

const sessionStore = new PgSession({
  pool,
  tableName: "user_sessions",
  createTableIfMissing: true,
});

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isHttps,
      httpOnly: true,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Fallback: support Bearer token (session ID) for environments where cookies are blocked (e.g. iframe previews)
app.use(async (req, _res, next) => {
  if (!(req.session as any).userId) {
    const auth = req.headers["authorization"];
    const sessionId = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (sessionId) {
      await new Promise<void>((resolve) => {
        sessionStore.get(sessionId, (err: any, sessionData: any) => {
          if (!err && sessionData && (sessionData as any).userId) {
            Object.assign(req.session, sessionData);
          }
          resolve();
        });
      });
    }
  }
  next();
});

app.use("/api", router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: err?.message || "Erro interno do servidor" });
});

export default app;
