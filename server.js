const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1);
const PORT = 3000;
require('dotenv').config({ path: '/etc/secrets/.env' });

const dataDir = path.join(__dirname, 'private/data');
const uploadsDir = path.join(__dirname, 'private/uploads');
const submissionsFile = path.join(dataDir, 'submissions.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(submissionsFile)) fs.writeFileSync(submissionsFile, '[]');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 75 * 1024 * 1024 }, // 75MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.mp4', '.mov', '.avi'].includes(ext)) {
            return cb(new Error('Само видео файлове са позволени!'));
        }
        cb(null, true);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/submit', upload.single('video'), (req, res) => {
    const { fname, lname, email, age, location, message, agree } = req.body;

    if (!agree) {
        return res.status(400).send("Трябва да се съгласите с условията.");
    }

    const newEntry = {
        fname,
        lname,
        email,
        age,
        location,
        message,
        video: req.file ? req.file.filename : null,
        agree,
        timestamp: new Date().toISOString()
    };

    const db = JSON.parse(fs.readFileSync(submissionsFile));
    db.push(newEntry);
    fs.writeFileSync(submissionsFile, JSON.stringify(db, null, 2));

    res.send(`
        <h2 style="text-align:center;">Благодарим ти, ${fname}!</h2>
        <p style="text-align:center;">Посланието ти е получено успешно. Ще се опитам да сглобя красиво клипче и да го покажа на СЛАВИ!</p>
        <a href="/" style="display:block;text-align:center;">⬅ Обратно</a>
    `);
});

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Authentication required.');
    }

    const base64 = authHeader.split(' ')[1];
    const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');

    if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
        return next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).send('Invalid credentials.');
    }
};

const adminLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: "Твърде много опити. Моля, опитайте по-късно.",
    standardHeaders: true,
    legacyHeaders: false,
});

app.get('/admin', adminLimiter, auth, (req, res) => {
    console.log("Client IP:", req.ip);
    const data = JSON.parse(fs.readFileSync(submissionsFile));
    let submissionsTotal = 0;
    let submissionVideos = 0;

    let html = '<h1>Подадени заявки</h1>';

    let listHTML = '<ul>';

    data.forEach(entry => {
        listHTML += `<li>
            <strong>${entry.fname} ${entry.lname}</strong> (${entry.email}, ${entry.age}, ${entry.location})<br>
            <em>${entry.message}</em><br>`;
        if (entry.video) {
            listHTML += `Видео: <a href="/admin/video/${entry.video}" target="_blank">Гледай</a><br>`;
            submissionVideos += 1;
        } else {
            listHTML += `Без видео.<br>`;
        }
        submissionsTotal += 1;
        listHTML += `<br></li>`;
    });

    listHTML += '</ul>';

    // Add the summary at the top
    html += `<p><strong>Общ брой заявки:</strong> ${submissionsTotal}<br>`;
    html += `<strong>С видеа:</strong> ${submissionVideos}</p>`;

    // Append the list
    html += listHTML;

    res.send(html);
});


app.get('/admin/video/:filename', adminLimiter, auth, (req, res) => {
    const videoPath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(videoPath)) {
        res.sendFile(videoPath);
    } else {
        res.status(404).send("Видео не е намерено.");
    }
});

app.get('/video', (req, res) => {
    const videoPath = path.join(__dirname, 'private', 'final.mp4');
    res.sendFile(videoPath);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

