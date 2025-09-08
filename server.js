import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Strategy as LocalStrategy } from "passport-local";
import passport from "passport";
import crypto from "crypto";
import { promisify } from "util";
import { User, Driver, Route, Work } from "./db.js";

const pbkdf2Async = promisify(crypto.pbkdf2);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, "../transport/dist/prj-angular/browser");
const app = express();
const salt = process.env.SALT || "dev only";

passport.use(
  new LocalStrategy(async function verify(username, password, cb) {
    const user = await User.findOne({ username });
    if (!user) {
      return cb(null, false, { message: "Incorrect username or password." });
    }
    crypto.pbkdf2(
      password,
      salt,
      310000,
      32,
      "sha256",
      (err, hashedPassword) => {
        if (err) return cb(err);
        const dbBuffer = Buffer.isBuffer(user.hashedPassword)
          ? user.hashedPassword
          : Buffer.from(hashedPasswordFromDb.buffer);
        if (
          dbBuffer.length === hashedPassword.length &&
          crypto.timingSafeEqual(dbBuffer, hashedPassword)
        ) {
          return cb(null, user);
        }
        console.log("Password mismatch for user:", user);
        return cb(null, false, {
          message: "Incorrect username or password.",
        });
      }
    );
  })
);
app.use(express.json());

app.post("/api/login/password", express.json(), (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user)
      return res.status(401).json({ message: info?.message || "Login failed" });
    res.json({
      message: "Login successful",
      user: { username: user.username, email: user.email },
    });
  })(req, res, next);
});

app.post("/api/register", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }
  try {
    const hashedPassword = await pbkdf2Async(
      password,
      salt,
      310000,
      32,
      "sha256"
    );
    await new User({
      username,
      email,
      hashedPassword,
    }).save();
    res
      .status(201)
      .json({ message: "User registered", user: { username, email } });
  } catch (err) {
    res.status(500).json({ message: "Error hashing password or saving user" });
  }
});

app.post("/api/driver/create", async (req, res) => {
  await new Driver({
    lastName: req.body.lastName,
    firstName: req.body.firstName,
    middleName: req.body.middleName,
    experience: req.body.experience,
  }).save();
  res.status(201).json({ message: "Driver created" });
});
app.get("/api/drivers", async (req, res) => {
  const drivers = await Driver.find();
  res.json(drivers);
});

app.post("/api/routes/create", async (req, res) => {
  await new Route({
    name: req.body.name,
    distance: req.body.distance,
    days: req.body.days,
    payment: req.body.payment,
  }).save();
  res.status(201).json({ message: "Route created" });
});

app.get("/api/routes", async (req, res) => {
  const routes = await Route.find();
  res.json(routes);
});

app.get("/api/work", async (req, res) => {
  const work = await Work.find();
  res.json(work);
});

const COEFFICIENT_EXPERIENCE_BONUS = 0.05;
app.post("/api/work/create", async (req, res) => {
  const route = await Route.findOne({ name: req.body.name });
  if (!route) {
    res.status(400).json({ message: "Route not found" });
    return;
  }
  const pay = route.payment * req.body.drivers.length;
  let payBonus = 0;
  if (Number.isFinite(req.body.bonus)) {
    payBonus = req.body.bonus;
  }
  let experienceBonus = 0;
  if (req.body.experience) {
    for (const driverName of req.body.drivers) {
      const parts = driverName.split(" ");
      if (parts.length !== 3) {
        res.status(400).json({ message: "Driver name format incorrect" });
        return;
      }
      const driver = await Driver.findOne({
        lastName: parts[0],
        firstName: parts[1],
        middleName: parts[2],
      });
      if (!driver) {
        res.status(400).json({ message: "Driver not found" });
        return;
      }
      experienceBonus =
        driver.experience * COEFFICIENT_EXPERIENCE_BONUS * route.payment;
    }
  }
  await new Work({
    name: req.body.name,
    drivers: req.body.drivers,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    experienceBonus: experienceBonus,
    pay: pay,
    payBonus: payBonus,
    totalPay: pay + payBonus + experienceBonus,
  }).save();

  res.status(201).json({ message: "Work created" });
});

app.use(express.static(distDir));

app.get(/.*/, (req, res) => {
  res.sendFile(join(distDir, "index.html"));
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
