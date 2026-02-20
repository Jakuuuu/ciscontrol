require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory (frontend)
app.use(express.static(path.join(__dirname)));

// Setup SQLite Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            }
        });
    }
});

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// API Route for Contact Form
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
    }

    // 1. Save to Database
    const sql = `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`;
    db.run(sql, [name, email, message], function (err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ success: false, error: 'Error al guardar el mensaje en la base de datos.' });
        }

        console.log(`Mensaje guardado con ID: ${this.lastID}`);

        // 2. Send Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_RECEIVER || process.env.EMAIL_USER, // The admin email
            subject: `Nuevo mensaje de contacto: ${name}`,
            text: `Has recibido un nuevo mensaje desde el sitio web de CIS:\n\nNombre: ${name}\nEmail: ${email}\nMensaje:\n${message}`
        };

        transporter.sendMail(mailOptions, (mailErr, info) => {
            if (mailErr) {
                console.error('Email error:', mailErr);
                // Optionally handle email errors, but still return success for the database part.
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        // Respond to the client
        res.status(200).json({ success: true, message: 'Mensaje enviado y guardado con éxito.' });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
