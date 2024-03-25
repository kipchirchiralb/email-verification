const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const mysql = require('mysql');
const path = require('path'); // Import the path module
const cookieParser = require("cookie-parser")

dotenv.config();

const app = express();
const port = 3000;

// MySQL credentials
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'trial'
};

// Create MySQL connection
const connection = mysql.createConnection(dbConfig);

// Connect to MySQL database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser())

// Define a route handler    for the root URL
app.get('/', (req, res) => {
    res.redirect('/signup');
});

// Sign-up route
app.post('/signup', (req, res) => {
    const { email } = req.body;

    // Check if the email is already registered
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        if (results.length > 0) {
            return res.status(400).send('Email is already registered');
        }

        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        // Store user data
        connection.query('INSERT INTO users (email, verificationCode) VALUES (?, ?)', [email, verificationCode], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }

            // Send verification email
            sendVerificationEmail(email, verificationCode);
            res.cookie('email', email, { maxAge: 60000, httpOnly: true });
            // Redirect to verification page
            res.redirect(`/verify?email=${email}`);
        });
    });
});

// Verification code endpoint
app.post('/verify', (req, res) => {
    const {  code } = req.body;
    const email = req.cookies.email
    // Retrieve user from the database
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        if (results.length === 0) {
            return res.status(400).send('User not found');
        }

        const user = results[0];

        // Check if verification code matches
        if (parseInt(code) === user.verificationCode) {
            // Update user as verified
            connection.query('UPDATE users SET verified = 1 WHERE email = ?', [email], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Database error');
                }
                // Redirect to main page
                res.redirect('/main');
            });
        } else {
            // Invalid verification code
            res.status(400).send('Invalid verification code');
        }
    });
});

// Function to send verification email
function sendVerificationEmail(email, code) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_EMAIL,
            pass: process.env.GMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_EMAIL,
        to: email,
        subject: 'Account Verification',
        html: `<p>Dear User,</p>
               <p>Thank you for signing up. Your verification code is: <strong>${code}</strong>.</p>
               <p>Please use this code to verify your account.</p>
               <p>Regards,<br>TechSharp Limited</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error occurred while sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

// Serve signup.html page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Serve verify.html page
app.get('/verify', (req, res) => {
    const email = req.query.email
    res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Serve main.html page
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
