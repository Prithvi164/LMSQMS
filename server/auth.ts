import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { z } from "zod";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Registration validation schema
const registrationSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  organizationName: z.string().min(2),
});

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const data = registrationSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create organization and admin user
      const organization = await storage.createOrganization({
        name: data.organizationName,
      });

      const user = await storage.createUser({
        username: data.username,
        password: await hashPassword(data.password),
        organizationId: organization.id,
        role: "admin",
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Admin-only route to create new users (managers/trainers/trainees)
  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { username, password, role, managerId } = req.body;
      const user = req.user;

      // Validate role-based permissions
      if (role === "admin") {
        return res.status(400).json({ message: "Cannot create additional admin users" });
      }

      if (user.role === "admin") {
        // Admin can create any role except admin
        if (!["manager", "trainer", "trainee"].includes(role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
      } else if (["manager", "trainer"].includes(user.role)) {
        // Managers and Trainers can only create trainees
        if (role !== "trainee") {
          return res.status(403).json({ message: "You can only create trainee accounts" });
        }
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate manager assignment
      if (role === "trainee" && !managerId) {
        return res.status(400).json({ message: "Trainee must be assigned to a manager or trainer" });
      }

      const newUser = await storage.createUser({
        username,
        password: await hashPassword(password),
        organizationId: user.organizationId,
        role,
        managerId: ["trainee", "trainer"].includes(role) ? managerId : null,
      });

      res.status(201).json(newUser);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
}