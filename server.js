const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
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
        video: req.file.filename,
        timestamp: new Date().toISOString()
    };

    const dbPath = path.join(__dirname, 'data', 'submissions.json');
    const db = JSON.parse(fs.readFileSync(dbPath));
    db.push(newEntry);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    res.send(`<h2 style="text-align:center;">Благодарим ти, ${fname}!</h2><p style="text-align:center;">Посланието ти е получено успешно. Ще се опитам да сглобя красиво клипче и да го покажа на СЛАВИ!</p><a href="/" style="display:block;text-align:center;">⬅ Обратно</a>`);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
