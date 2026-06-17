const express = require('express');
const mysql = require('mysql2');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Koneksi Database (Konfigurasinya di Azure Portal nanti)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// Koneksi Blob Storage
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

// Endpoint untuk submit tugas
app.post('/submit-task', upload.single('file_tugas'), async (req, res) => {
    const { nim, name, class_name, course } = req.body;
    const blobName = `${nim}_${req.file.originalname}`;

    // 1. Upload ke Azure Blob Storage
    const containerClient = blobServiceClient.getContainerClient('tugas-praktikum');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer);
    const fileUrl = blockBlobClient.url;

    // 2. Simpan Metadata ke MySQL
    const sql = "INSERT INTO submissions (nim, name, class_name, course, file_url) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [nim, name, class_name, course, fileUrl], (err) => {
        if (err) return res.status(500).send(err);
        res.send("<h1>Tugas Berhasil Dikirim!</h1><a href='/'>Kembali</a>");
    });
});

app.listen(process.env.PORT || 3000);
