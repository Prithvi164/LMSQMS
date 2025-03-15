import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, permissionEnum } from "@shared/schema";
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
  // Generate a strong session secret
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

  // Configure session store
  const sessionStore = new PostgresSessionStore({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  });

  // Enhanced session configuration
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/',
    },
    name: 'sessionId', // Custom session cookie name
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Debug middleware to log authentication state
  app.use((req, res, next) => {
    console.log(`[Auth Debug] ${new Date().toISOString()} - Request path: ${req.path}`);
    console.log(`[Auth Debug] User authenticated: ${req.isAuthenticated()}`);
    if (req.user) {
      console.log(`[Auth Debug] User details: ID=${req.user.id}, Role=${req.user.role}`);
    }
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("[Auth Debug] Login attempt for:", username);
        let user = await storage.getUserByUsername(username);

        if (!user) {
          console.log("[Auth Debug] User not found by username, trying email...");
          user = await storage.getUserByEmail(username);
        }

        if (!user) {
          console.log("[Auth Debug] User not found");
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.active) {
          console.log("[Auth Debug] User account is inactive");
          return done(null, false, { message: "Account is inactive. Please contact your administrator." });
        }

        console.log("[Auth Debug] Found user:", user.username, "role:", user.role);

        const isValidPassword = await comparePasswords(password, user.password);
        console.log("[Auth Debug] Password validation result:", isValidPassword);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (err) {
        console.error("[Auth Debug] Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log("[Auth Debug] Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("[Auth Debug] Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("[Auth Debug] User not found during deserialization");
        return done(null, false);
      }
      console.log("[Auth Debug] User deserialized successfully");
      done(null, user);
    } catch (err) {
      console.error("[Auth Debug] Deserialization error:", err);
      done(err);
    }
  });

  // Add registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const data = registrationSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const organization = await storage.createOrganization({
        name: data.organizationName,
      });

      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        organizationId: organization.id,
        role: "owner" as const,
        fullName: data.username,
        employeeId: `EMP${Date.now()}`,
        phoneNumber: "",
        active: true,
        category: "active" as const
      });

      await storage.updateRolePermissions(
        organization.id,
        'owner',
        permissionEnum.enumValues
      );

      req.login(user, (err) => {
        if (err) {
          console.error("[Auth Debug] Login error after registration:", err);
          return res.status(500).json({ message: "Error logging in after registration" });
        }
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error("[Auth Debug] Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("[Auth Debug] Login request received");
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("[Auth Debug] Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        console.log("[Auth Debug] Authentication failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("[Auth Debug] Login session error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        console.log("[Auth Debug] User logged in successfully:", user.id);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    console.log("[Auth Debug] Logout request received");
    if (!req.session) {
      return res.status(200).json({ message: "Already logged out" });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("[Auth Debug] Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('sessionId');
      console.log("[Auth Debug] User logged out successfully");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("[Auth Debug] User info request");
    console.log("[Auth Debug] Authentication state:", req.isAuthenticated());
    console.log("[Auth Debug] Session:", req.session);
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}