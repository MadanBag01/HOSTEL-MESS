require('dotenv').config();
console.log('Starting server...');

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

//for email
const nodemailer = require("nodemailer");
const uploadUser = multer({ dest: "uploads/" });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hostel_mess'
});

db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
    process.exit(1);
  } else {
    console.log('✅ Connected to MySQL database');
  }
});

// ✅ Set up Multer for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `id_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'), false);
  }
});


//for user 
app.post("/userRegister", uploadUser.single("idProof"), (req, res) => {
  const address = req.body.address;
  const file = req.file;

  if (!file || !address) {
      return res.status(400).json({ message: "All fields are required!" });
  }

  // 1. Store address and file name in the DB
  const insertQuery = `INSERT INTO user_register_data (address, id_proof_filename) VALUES (?, ?)`;
  db.query(insertQuery, [address, file.originalname], (err) => {
      if (err) {
          console.error("❌ Error saving to DB:", err);
          return res.status(500).json({ message: "Database error" });
      }

      // 2. Send the file to an email
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.EMAIL_USER, // set in .env
              pass: process.env.EMAIL_PASS  // set in .env
          }
      });

      const mailOptions = {
          from: process.env.EMAIL_USER,
          to: "admin@example.com", // your receiving email
          subject: "New ID Proof Uploaded",
          text: `Address: ${address}`,
          attachments: [
              {
                  filename: file.originalname,
                  path: file.path
              }
          ]
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error("❌ Error sending email:", error);
              return res.status(500).json({ message: "Email failed" });
          }

          console.log("📧 Email sent:", info.response);

          // Optionally delete the file after sending
          fs.unlink(file.path, () => {});

          res.status(200).json({ message: "Details saved and email sent!" });
      });
  });
});

// ✅ Admin registration route
app.post('/adminRegister', upload.single('idProof'), (req, res) => {
  try {
    const {
      kitchenName,
      address,
      addCancelLunchTime,
      addCancelDinnerTime,
      deliveryLunchTime,
      deliveryDinnerTime,
      lunchPrice,
      dinnerPrice,
      bothPrice
    } = req.body;

    const idProofPath = req.file?.path || null;
    const menuData = JSON.parse(req.body.menuData); // Parse menuData JSON string

    if (!idProofPath) {
      return res.status(400).json({ message: 'ID proof PDF is required.' });
    }

    // ✅ Insert into kitchen_details
    const kitchenInsertQuery = `
      INSERT INTO kitchen_details (
        kitchen_name, address, add_cancel_lunch_time, add_cancel_dinner_time,
        delivery_lunch_time, delivery_dinner_time,
        lunch_price, dinner_price, both_price, id_proof_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const kitchenValues = [
      kitchenName,
      address,
      addCancelLunchTime,
      addCancelDinnerTime,
      deliveryLunchTime,
      deliveryDinnerTime,
      lunchPrice,
      dinnerPrice,
      bothPrice,
      idProofPath
    ];

    db.query(kitchenInsertQuery, kitchenValues, (err, result) => {
      if (err) {
        console.error('❌ Error inserting kitchen details:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      const kitchenId = result.insertId;

      const insertMenuQuery = `
        INSERT INTO weekly_menu (kitchen_id, day_of_week, meal_type, menu_items, price)
        VALUES ?
      `;

      const menuValues = [];
      for (const day in menuData) {
        for (const meal in menuData[day]) {
          const item = menuData[day][meal];
          menuValues.push([kitchenId, day, meal, item.menu, item.price]);
        }
      }

      db.query(insertMenuQuery, [menuValues], (err2) => {
        if (err2) {
          console.error('❌ Error inserting weekly menu:', err2);
          return res.status(500).json({ message: 'Menu insert error' });
        }

        res.status(200).json({ message: 'Kitchen and menu saved successfully!' });
      });
    });
  } catch (err) {
    console.error('❌ Server error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//adding kitchen in menu
app.get("/kitchenlist", (req, res) => {
    db.query("SELECT id, kitchen_name FROM kitchen_details", (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to fetch kitchens" });
        }
        res.json(results);
    });
});

// ROUTE: Get kitchen details by ID
// app.get("/kitchenDetails/:id", (req, res) => {
//     const id = req.params.id;
//     db.query("SELECT * FROM kitchen_details WHERE id = ?", [id], (err, results) => {
//         if (err || results.length === 0) {
//             return res.status(404).json({ error: "Kitchen not found" });
//         }
//         res.json(results[0]);
//     });
// });

//done

//api key for fetching kitchen details
app.get('/kitchenDetails/:kitchenId', (req, res) => {
  const kitchenId = req.params.kitchenId;

  const detailsQuery = `
    SELECT * FROM kitchen_details WHERE id = ?
  `;
  const menuQuery = `
    SELECT day_of_week, meal_type, menu_items, price
    FROM weekly_menu
    WHERE kitchen_id = ?
  `;

  db.query(detailsQuery, [kitchenId], (err, kitchenResult) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (kitchenResult.length === 0) return res.status(404).json({ error: 'Kitchen not found' });

      db.query(menuQuery, [kitchenId], (err2, menuResult) => {
          if (err2) return res.status(500).json({ error: 'Menu fetch error' });

          res.json({
              kitchen: kitchenResult[0],
              menu: menuResult
          });
      });
  });
});


// ✅ Start the server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server failed to start:', err);
});
