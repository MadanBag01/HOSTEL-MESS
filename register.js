require('dotenv').config();
console.log('Starting server...');

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

//for password security
const bcrypt = require("bcrypt");
//for email
const nodemailer = require("nodemailer");
const uploadUser = multer({ dest: "uploads/" });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//setting session
const session = require("express-session");

app.use(session({
    secret: "Madan1254&",   
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  
}));



app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hostel_mess'
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed: ", err);
    return;
  }
  console.log("✅ Connected to MySQL Database");
});



const upload = multer({ dest: "uploads/" });

// ================= REGISTER USER =================
app.post("/newUserRegister", upload.single("id_proof"), async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      flat_no,
      area,
      nearby_landmark,
      city,
      state,
      pincode,
      password
    } = req.body;

    const idProofPath = req.file ? req.file.path : null;

    if (!idProofPath) {
      return res.status(400).json({ message: "ID proof PDF/JPG is required." });
    }

    if (!full_name || !email || !phone || !area || !city || !state || !pincode || !password) {
      return res.status(400).json({ error: "All required fields must be filled!" });
    }

    //  Check if email OR phone already exists
    const checkSql = `SELECT * FROM user_register_data WHERE email = ? OR phone = ?`;
    db.query(checkSql, [email, phone], async (err, results) => {
      if (err) {
        console.error("❌ Error checking duplicates:", err);
        return res.status(500).json({ error: "Database error while checking duplicates" });
      }

      if (results.length > 0) {
      return res.status(400).json({ message: "User with this email or phone already exists!" });
    }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const insertSql = `
        INSERT INTO user_register_data 
        (full_name, email, phone, flat_no, area, nearby_landmark, city, state, pincode, id_proof_filename, password, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `;

      db.query(
        insertSql,
        [full_name, email, phone, flat_no || null, area, nearby_landmark || null, city, state, pincode, idProofPath, hashedPassword],
        (err, result) => {
          if (err) {
            console.error("❌ Error inserting data:", err);
            return res.status(500).json({ error: "Database error" });
          }

          const userId = result.insertId;

          // Send verification email
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "surjabag428@gmail.com",
              pass: "rqwj byhv zmmy dxle", // Gmail app password
            },
          });

          const verifyLink = `http://localhost:3001/verify/${userId}`;
          const rejectLink = `http://localhost:3001/reject/${userId}`;

          const mailOptions = {
            from: '"ID Proof System" <surjabag428@gmail.com>',
            to: "surjabag429@gmail.com", // Admin email
            subject: "New User Verification Needed",
            html: `
              <h3>New User Registered</h3>
              <p>Name: ${full_name}</p>
              <p>Email: ${email}</p>
              <p>Phone: ${phone}</p>
              <p>Address: ${flat_no || ""}, ${area}, ${city}, ${state}, ${pincode}</p>
              <a href="${verifyLink}">✅ Verify</a> |
              <a href="${rejectLink}">❌ Reject</a>
            `,
            attachments: [{ filename: req.file.originalname, path: idProofPath }],
          };

          transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.error("❌ Error sending email:", err);
            else console.log("✅ Verification email sent:", info.response);
          });

          res.status(200).json({
            message: "✅ User registered successfully!",
            user_id: userId,
          });
        }
      );
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ================= VERIFY USER =================
app.get("/verify/:id", (req, res) => {
  const userId = req.params.id;

  db.query("UPDATE user_register_data SET status='verified' WHERE user_id=?", [userId], (err) => {
    if (err) {
      console.error("❌ Error updating user:", err);
      return res.send("Error updating user");
    }

    // Get user email for notification
    db.query("SELECT email FROM user_register_data WHERE user_id=?", [userId], (err, result) => {
      if (err || result.length === 0) return res.send("User not found");

      const userEmail = result[0].email;
      sendUserMail(userEmail, "verified");

      res.send("✅ User verified successfully!");
    });
  });
});


// ================= REJECT USER =================
app.get("/reject/:id", (req, res) => {
  const userId = req.params.id;

  db.query("SELECT email FROM user_register_data WHERE user_id=?", [userId], (err, result) => {
    if (err || result.length === 0) return res.send("User not found");

    const userEmail = result[0].email;

    // Send rejection email
    sendUserMail(userEmail, "rejected");

    // Delete user
    db.query("DELETE FROM user_register_data WHERE user_id=?", [userId], () => {
      res.send("❌ User rejected and removed.");
    });
  });
});


// ================= HELPER: Send user email =================
function sendUserMail(toEmail, status) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "surjabag428@gmail.com",
      pass: "rqwj byhv zmmy dxle", // Gmail app password
    },
  });

  const subject =
    status === "verified" ? "Your account has been verified ✅" : "Your account was rejected ❌";

  const text =
    status === "verified"
      ? "Congratulations! Your account has been verified successfully."
      : "Sorry, your account has been rejected. Please contact support.";

  transporter.sendMail(
    {
      from: '"ID Proof System" <surjabag428@gmail.com>',
      to: toEmail,
      subject,
      text,
    },
    (err) => {
      if (err) console.error("❌ Error sending user email:", err);
      else console.log(`📩 ${status} email sent to ${toEmail}`);
    }
  );
}

//login 
// Login API
// Login route
app.post("/user_login", (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  // whether identifier is email or mobile
  let query = "";
  if (/^\d{10}$/.test(identifier)) {
    query = "SELECT * FROM user_register_data WHERE mobile = ?";
  } else {
    query = "SELECT * FROM user_register_data WHERE email = ?";
  }

  db.query(query, [identifier], async (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email/mobile or password" });
    }

    const user = results[0];

    // Check status
    if (user.status !== "verified") {
      return res.status(403).json({ success: false, message: "Your account is not verified yet." });
    }

    // If password is plain text (not hashed)
    if (await bcrypt.compare(password, user.password)) {
      req.session.userId = user.user_id; // Save session
      return res.json({ success: true, message: "Login successful!" });
    } 
    
    // If password is hashed (bcrypt)
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: "Error verifying password" });
      if (!isMatch) return res.status(401).json({ success: false, message: "Invalid password" });

      req.session.userId = user.user_id;
      return res.json({ success: true, message: "Login successful!" });
    });
  });
});

// For the provider
// Route: Admin Registration
app.post("/newProviderRegister", upload.single("idProof"), async (req, res) => {
  try {
    const {
      fullName,
      mobile,
      email,
      password,
      kitchenName,
      address,
      addCancelLunchTime,
      addCancelDinnerTime,
      deliveryLunchTime,
      deliveryDinnerTime,
      lunchPrice,
      dinnerPrice,
      bothPrice,
      menuData
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "ID Proof (PDF) is required" });
    }

    // ✅ Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into admin table
    const insertAdmin = `INSERT INTO admin (fullName, mobile, email, password) VALUES (?, ?, ?, ?)`;
    db.query(insertAdmin, [fullName, mobile, email, hashedPassword], (err, adminResult) => {
      if (err) {
        console.error("Error inserting admin:", err);
        return res.status(500).json({ message: "Admin registration failed" });
      }

      const adminId = adminResult.insertId;

      // Insert into admin_details table
      const insertDetails = `
        INSERT INTO admin_details 
        (admin_id, kitchenName, address, addCancelLunchTime, addCancelDinnerTime, deliveryLunchTime, deliveryDinnerTime, idProofPath, lunchPrice, dinnerPrice, bothPrice) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertDetails,
        [
          adminId,
          kitchenName,
          address,
          addCancelLunchTime,
          addCancelDinnerTime,
          deliveryLunchTime,
          deliveryDinnerTime,
          req.file.path,
          lunchPrice,
          dinnerPrice,
          bothPrice,
        ],
        (err, detailsResult) => {
          if (err) {
            console.error("Error inserting details:", err);
            return res.status(500).json({ message: "Failed to save dashboard details" });
          }

          const detailsId = detailsResult.insertId;
          let menuJson;

          try {
            menuJson = JSON.parse(menuData);
          } catch (e) {
            console.error("Menu parsing error:", e);
            return res.status(400).json({ message: "Invalid menu data format" });
          }

          // Prepare weekly menu insertion
          const insertMenu = `INSERT INTO weekly_menu2 (admin_details_id, dayOfWeek, mealType, menuItems, price) VALUES ?`;
          const values = [];

          for (const day in menuJson) {
            for (const meal in menuJson[day]) {
              values.push([
                detailsId,
                day,
                meal,
                menuJson[day][meal].menu,
                menuJson[day][meal].price,
              ]);
            }
          }

          if (values.length === 0) {
            return res.status(400).json({ message: "Weekly menu data is empty" });
          }

          db.query(insertMenu, [values], (err) => {
            if (err) {
              console.error("Error inserting menu:", err);
              return res.status(500).json({ message: "Failed to save weekly menu" });
            }

            return res.json({
              message: "✅ Admin registration and details saved successfully!",
              adminId,
              detailsId,
            });
          });
        }
      );
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

//login admin
const bcrypt = require("bcrypt");

// POST login route
app.post("/admin_login", (req, res) => {
  const { identifier, password } = req.body;

  // Step 1: Fetch admin row by email or mobile
  const sql = `SELECT * FROM admin WHERE email = ? OR mobile = ? LIMIT 1`;

  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = results[0];

    // Step 2: Compare hash
    const match = await bcrypt.compare(password, admin.password);

    if (match) {
      res.json({ message: "Login successful", admin });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });
});





// ✅ Start the server
const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server failed to start:', err);
});