

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ⬇️ Adjust path to where YOUR model file is (example shown)
const User = require("./src/models/User"); // <-- change if needed

const {
  MONGO_URI = "mongodb+srv://flexideskproject_db_user:CYaa4RMhrW8cOYY8@flexidesk.iux9xeh.mongodb.net/flexidesk?retryWrites=true&w=majority&appName=Flexidesk",
  ADMIN_EMAIL = "admin@example.com",
  ADMIN_PASSWORD = "changeme",
  ADMIN_FULLNAME = "Administrator",
  SALT_ROUNDS = "12",
} = process.env;

const saltRounds = parseInt(SALT_ROUNDS, 10) || 12;

async function connect() {
  try {
    // Mongoose v7+ no longer needs useNewUrlParser/useUnifiedTopology
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

async function seedAdmin() {
  try {
    await connect();
    await User.init(); // ensure indexes (e.g., unique email)

    const email = ADMIN_EMAIL.toLowerCase().trim();
    const existing = await User.findOne({ email });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

    if (existing) {
      console.log(`Admin "${email}" already exists. Updating details...`);
      existing.fullName = ADMIN_FULLNAME || existing.fullName;
      existing.role = "admin";
      existing.passwordHash = passwordHash; // rotate/reset to the provided one
      await existing.save();

      console.log("Admin updated successfully.");
      console.log(`Email: ${email}`);
    } else {
      await User.create({
        fullName: ADMIN_FULLNAME,
        email,
        passwordHash,
        role: "admin",
      });

      console.log("Admin user created successfully.");
      console.log(`Email: ${email}`);
      console.log("Password: (taken from ADMIN_PASSWORD env var)");
    }
  } catch (err) {
    console.error("Seeder error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

seedAdmin();
