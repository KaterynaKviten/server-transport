import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Strategy as LocalStrategy } from 'passport-local';
import passport from 'passport';
import crypto from 'crypto';
import { promisify } from 'util';
import { getDb } from './db.js';
import { booleanAttribute } from '@angular/core';
import mongoose from 'mongoose';

const pbkdf2Async = promisify(crypto.pbkdf2);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '../dist/prj-angular/browser');
const app = express();
const salt = process.env.SALT || 'dev only';
let userDb;

mongoose.connect('mongodb://localhost:27017/prj-angular', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

getDb().then((db) => {
  userDb = db.collection('users');
});

passport.use(
  new LocalStrategy(async function verify(username, password, cb) {
    const user = await userDb.findOne({ username });
    if (!user) {
      return cb(null, false, { message: 'Incorrect username or password.' });
    }
    crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, hashedPassword) => {
      if (err) return cb(err);
      let dbPassword;
      if (user.hashedPassword?.buffer) {
        dbPassword = user.hashedPassword.buffer;
      } else if (Buffer.isBuffer(user.hashedPassword)) {
        dbPassword = user.hashedPassword;
      } else if (user.hashedPassword?.data) {
        dbPassword = Buffer.from(user.hashedPassword.data);
      } else {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      if (!crypto.timingSafeEqual(dbPassword, hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, user);
    });
  })
);
app.use(express.json());

app.post('/api/login/password', express.json(), (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Login failed' });
    res.json({ message: 'Login successful', user: { username: user.username, email: user.email } });
  })(req, res, next);
});

app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const existing = await userDb.findOne({ username });
  if (existing) {
    return res.status(409).json({ message: 'User already exists' });
  }
  try {
    const hashedPassword = await pbkdf2Async(password, salt, 310000, 32, 'sha256');
    await userDb.insertOne({
      username,
      email,
      hashedPassword,
    });
    res.status(201).json({ message: 'User registered', user: { username, email } });
  } catch (err) {
    res.status(500).json({ message: 'Error hashing password or saving user' });
  }
});

app.post('/api/driver/create', async (req, res) => {
  const db = await getDb();
  const driversCollection = db.collection('drivers');
  await driversCollection.insertOne({
    lastName: req.body.lastName,
    firstName: req.body.firstName,
    middleName: req.body.middleName,
    experience: req.body.experience,
  });
  res.status(201).json({ message: 'Driver created' });
});
app.get('/api/drivers', async (req, res) => {
  const db = await getDb();
  const driversCollection = db.collection('drivers');
  const drivers = await driversCollection.find().toArray();
  res.json(drivers);
});

// Driver schema
const driverSchema = new mongoose.Schema({
  lastName: String,
  firstName: String,
  middleName: String,
  experience: Number,
});
const Driver = mongoose.model('Driver', driverSchema);

app.post('/api/routes/create', async (req, res) => {
  const db = await getDb();
  const routesCollection = db.collection('routes');
  await routesCollection.insertOne({
    name: req.body.name,
    distance: req.body.distance,
    days: req.body.days,
    payment: req.body.payment,
  });
  res.status(201).json({ message: 'Route created' });
});

app.get('/api/routes', async (req, res) => {
  const db = await getDb();
  const routesCollection = db.collection('routes');
  const routes = await routesCollection.find().toArray();
  res.json(routes);
});

// Route schema
const routeSchema = new mongoose.Schema({
  name: String,
  distance: Number,
  days: Number,
  payment: Number,
});

// Work schema
const workSchema = new mongoose.Schema({
  name: String,
  drivers: [String],
  startDate: String,
  endDate: String,
  experienceBonus: Number,
  pay: Number,
  payBonus: Number,
  totalPay: Number,
});
const Work = mongoose.model('Work', workSchema);

app.get('/api/work', async (req, res) => {
  const db = await getDb();
  const worksCollection = db.collection('work');
  const work = await worksCollection.find().toArray();
  res.json(work);
});
const Route = mongoose.model('Route', routeSchema);

const COEFFICIENT_EXPERIENCE_BONUS = 0.05;
app.post('/api/work/create', async (req, res) => {
  const db = await getDb();
  const workCollection = db.collection('work');

  const route = await db.collection('routes').find({ name: req.body.name }).limit(1).toArray();
  if (route.length === 0) {
    res.status(400).json({ message: 'Route not found' });
    return;
  }
  const pay = route[0].payment * req.body.drivers.length;
  let payBonus = 0;
  if (Number.isFinite(req.body.bonus)) {
    payBonus = req.body.bonus;
  }
  let experienceBonus = 0;
  if (req.body.experience) {
    for (const driverName of req.body.drivers) {
      const parts = driverName.split(' ');
      if (parts.length !== 3) {
        res.status(400).json({ message: 'Driver name format incorrect' });
        return;
      }
      const driver = await db
        .collection('drivers')
        .find({
          lastName: parts[0],
          firstName: parts[1],
          middleName: parts[2],
        })
        .limit(1)
        .toArray();
      if (driver.length === 0) {
        res.status(400).json({ message: 'Driver not found' });
        return;
      }
      experienceBonus = driver[0].experience * COEFFICIENT_EXPERIENCE_BONUS * route[0].payment;
    }
  }
  await workCollection.insertOne({
    name: req.body.name,
    drivers: req.body.drivers,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    experienceBonus: experienceBonus,
    pay: pay,
    payBonus: payBonus,
    totalPay: pay + payBonus + experienceBonus,
  });

  res.status(201).json({ message: 'Work created' });
});

app.use(express.static(distDir));

app.get(/.*/, (req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
