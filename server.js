import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static("public"));
app.get("/", (req, res) => res.sendFile(process.cwd() + "/public/index.html"));

await mongoose.connect(process.env.MONGODB_URI);

const studentSchema = new mongoose.Schema(
  {
    rollNo: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true },

    branch: { type: String, trim: true, default: "" },
    semester: { type: Number, default: null }
  },
  { timestamps: true }
);

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);
const Admin = mongoose.model("Admin", adminSchema);

async function seedAdmin() {
  const username = "admin";
  const passwordHash = await bcrypt.hash("admin", 10);

  await Admin.findOneAndUpdate(
    { username },
    { username, passwordHash },
    { upsert: true }
  );

  console.log("Admin ensured: admin/admin");
}
await seedAdmin();



app.post("/api/login", async (req, res) => {
  try {
    const { role, rollNo, password } = req.body;

    if (!role || !rollNo || !password) {
      return res.status(400).json({ message: "role, rollNo, password are required" });
    }


    if (role === "student") {
      if (String(password) !== String(rollNo)) {
        return res.status(401).json({ message: "Student login failed (password must equal rollNo)" });
      }

      let student = await Student.findOne({ rollNo: String(rollNo) });


      if (!student) {
        const passwordHash = await bcrypt.hash(String(rollNo), 10);
        student = await Student.create({ rollNo: String(rollNo), passwordHash });
      }

      const detailsSubmitted = Boolean(
        student.branch && student.branch.trim() !== "" && student.semester !== null
      );

      return res.json({
        message: "Student login success",
        user: { role: "student", rollNo: student.rollNo, detailsSubmitted }
      });
    }

   
    if (role === "admin") {
      const admin = await Admin.findOne({ username: String(rollNo).toLowerCase() });
      if (!admin) return res.status(401).json({ message: "Admin login failed" });

      const ok = await bcrypt.compare(String(password), admin.passwordHash);
      if (!ok) return res.status(401).json({ message: "Admin login failed" });

      return res.json({
        message: "Admin login success",
        user: { role: "admin", username: admin.username }
      });
    }

    return res.status(400).json({ message: "Invalid role" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));


app.post("/api/student/details", async (req, res) => {
  try {
    const { rollNo, branch, semester } = req.body;

    if (!rollNo || !branch || semester === undefined || semester === null) {
      return res.status(400).json({ message: "rollNo, branch, semester are required" });
    }

    const student = await Student.findOne({ rollNo: String(rollNo) });
    if (!student) return res.status(404).json({ message: "Student not found" });

  
    const alreadySubmitted =
      student.branch && student.branch.trim() !== "" && student.semester !== null;

    if (alreadySubmitted) {
      return res.status(409).json({ message: "Details already submitted" });
    }

    student.branch = String(branch).trim();
    student.semester = Number(semester);
    await student.save();

    res.json({
      message: "Student details saved",
      student: { rollNo: student.rollNo, branch: student.branch, semester: student.semester }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/api/admin/students", async (req, res) => {
  try {
    const { semester, branch } = req.query;

    if (!semester) {
      return res.status(400).json({ message: "semester query param is required" });
    }

    const semNo = Number(semester);
    if (!Number.isFinite(semNo)) {
      return res.status(400).json({ message: "semester must be a number" });
    }

    const filter = { semester: semNo };

   
    if (branch && String(branch).trim() !== "") {
      filter.branch = String(branch).trim();
      
    }

    const students = await Student.find(filter)
      .select("rollNo branch semester createdAt updatedAt")
      .sort({ rollNo: 1 })
      .lean();

    return res.json({
      semester: semNo,
      branch: branch ? String(branch).trim() : "",
      count: students.length,
      students
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));