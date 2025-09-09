import mongoose from "mongoose";

mongoose.connect("mongodb://localhost:27017/prj-angular", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});
mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

const driverSchema = new mongoose.Schema({
  lastName: String,
  firstName: String,
  middleName: String,
  experience: Number,
});
export const Driver = mongoose.model("Driver", driverSchema);

const routeSchema = new mongoose.Schema({
  name: String,
  distance: Number,
  days: Number,
  payment: Number,
});

export const Route = mongoose.model("Route", routeSchema);

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  hashedPassword: Buffer,
});
export const User = mongoose.model("User", userSchema);

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
export const Work = mongoose.model("Work", workSchema);
