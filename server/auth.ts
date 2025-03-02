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

// Registration validation schema
const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    if (!stored || !stored.includes(".")) {
      console.error("Invalid stored password format:", stored);
      return false;
    }
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = randomBytes(32).toString("hex");
  const sessionStore = new PostgresSessionStore({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  });

  // Add session middleware with debug logging
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false, // Set to false to work with HTTP in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // Add this for better cookie handling
      path: '/' // Ensure cookie is available for all paths
    },
  }));

  // Initialize passport BEFORE adding debug middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Debug middleware to log session and authentication state
  app.use((req, res, next) => {
    console.log('[Auth Debug] Request path:', req.path);
    console.log('[Auth Debug] Session ID:', req.sessionID);
    console.log('[Auth Debug] Is Authenticated:', req.isAuthenticated());
    console.log('[Auth Debug] Session:', req.session);
    console.log('[Auth Debug] Cookies:', req.headers.cookie);
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("[Auth] Attempting login for:", username);
        let user = await storage.getUserByUsername(username);

        if (!user) {
          console.log("[Auth] User not found by username, trying email...");
          user = await storage.getUserByEmail(username);
        }

        if (!user) {
          console.log("[Auth] User not found");
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log("[Auth] Found user:", user.username, "role:", user.role);

        const isValidPassword = await comparePasswords(password, user.password);
        console.log("[Auth] Password validation result:", isValidPassword);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (err) {
        console.error("[Auth] Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log("[Auth] Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("[Auth] Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("[Auth] User not found during deserialization");
        return done(null, false);
      }
      console.log("[Auth] Successfully deserialized user:", user.username);
      done(null, user);
    } catch (err) {
      console.error("[Auth] Deserialization error:", err);
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("[Auth] Login attempt for:", req.body.username);
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("[Auth] Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        console.log("[Auth] Login failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("[Auth] Login session error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        console.log("[Auth] Login successful for user:", user.username);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    console.log("[Auth] Logout request received");
    if (!req.session) {
      return res.status(200).json({ message: "Already logged out" });
    }
    const username = req.user?.username;
    req.session.destroy((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      console.log("[Auth] Successfully logged out user:", username);
      res.clearCookie('connect.sid');
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("[Auth] User info request");
    console.log("[Auth] Is authenticated:", req.isAuthenticated());
    console.log("[Auth] Current user:", req.user);
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}