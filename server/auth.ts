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
import rateLimit from "express-rate-limit";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

// Enhanced registration validation schema
const registrationSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  organizationName: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name cannot exceed 100 characters")
    .regex(/^[a-zA-Z0-9\s-_&]+$/, "Organization name can only contain letters, numbers, spaces, hyphens, underscores, and ampersands"),
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
      console.error("Invalid stored password format");
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

// Use a persistent session secret from environment variable or generate one on first run
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

export function setupAuth(app: Express) {
  console.log("Setting up authentication...");

  // Rate limiting for login attempts
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    message: { message: "Too many login attempts, please try again later" }
  });

  const sessionStore = new PostgresSessionStore({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
  });

  // Session middleware configuration
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/'
    },
    name: 'sessionId', // Change from default 'connect.sid'
  }));

  // Initialize passport after session middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Debug middleware to log session and authentication status
  app.use((req, res, next) => {
    console.log("Request path:", req.path);
    console.log("Session ID:", req.sessionID);
    console.log("Is authenticated:", req.isAuthenticated());
    console.log("Session user:", req.session?.passport?.user);
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for:", username);
        // Case-insensitive username/email lookup
        let user = await storage.getUserByUsername(username.toLowerCase());

        if (!user) {
          user = await storage.getUserByEmail(username.toLowerCase());
        }

        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.active) {
          return done(null, false, { message: "Account is inactive. Please contact your administrator." });
        }

        const isValidPassword = await comparePasswords(password, user.password);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log("Login successful for user:", user.id);
        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("User not found during deserialization:", id);
        return done(null, false);
      }
      console.log("User deserialized successfully:", user.id);
      done(null, user);
    } catch (err) {
      console.error("Deserialization error:", err);
      done(err);
    }
  });

  // Registration endpoint with enhanced validation
  app.post("/api/register", async (req, res) => {
    try {
      console.log("Registration attempt:", req.body.username);
      const data = registrationSchema.parse(req.body);

      // Case-insensitive username check
      const existingUser = await storage.getUserByUsername(data.username.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Case-insensitive email check
      const existingEmail = await storage.getUserByEmail(data.email.toLowerCase());
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const organization = await storage.createOrganization({
        name: data.organizationName.trim(),
      });

      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
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
          console.error("Login error after registration:", err);
          return res.status(500).json({ message: "Error logging in after registration" });
        }
        console.log("Registration and login successful for user:", user.id);
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint with rate limiting
  app.post("/api/login", loginLimiter, (req, res, next) => {
    console.log("Login attempt:", req.body.username);
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        console.log("Login successful, session created for user:", user.id);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    console.log("Logout request for user:", req.user?.id);
    if (!req.session) {
      return res.status(200).json({ message: "Already logged out" });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('sessionId');
      console.log("Logout successful");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("User info request");
    console.log("Session:", req.session);
    console.log("Is authenticated:", req.isAuthenticated());
    console.log("User:", req.user);

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}