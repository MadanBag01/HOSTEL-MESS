require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON data

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "your_password",
    database: "your_database_name",
    authPlugins: {
      mysql_native_password: () => () => Buffer.from('your_password')
    }
  });
  

db.connect(err => {
  if (err) {
    console.error("Database connection failed: " + err.stack);
    return;
  }
  console.log("Connected to MySQL database.");
});

// API Route to Fetch Menu Data
app.get("/menu", (req, res) => {
  db.query("SELECT * FROM menu", (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(results);
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
