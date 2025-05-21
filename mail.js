const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ensure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Endpoint to handle the form submission
app.post("/userRegister", upload.single("idProof"), async (req, res) => {
  try {
    const { address } = req.body;
    const file = req.file;

    if (!file || !address) {
      return res.status(400).json({ message: "Missing file or address" });
    }

    // Set up Nodemailer transport
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "surjabag428@gmail.com",            // 🔒 Your Gmail
        pass: "rqwj byhv zmmy dxle",  // 🔒 App password (NOT your actual Gmail password)
      },
    });

    // Compose the email
    const mailOptions = {
      from: '"ID Proof System" <surjabag428@gmail.com>',
      to: "sidhantdas716@gmail.com", // 📨 Admin or verification email
      subject: "New ID Proof Submission",
      text: `Address: ${address}`,
      attachments: [
        {
          filename: file.originalname,
          path: path.join(__dirname, file.path),
        },
      ],
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Optional: delete file after sending
    fs.unlinkSync(path.join(__dirname, file.path));

    res.json({ message: "Details submitted and email sent!" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
