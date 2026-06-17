const express = require('express');
const mysql = require('mysql2');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Koneksi Database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// Validasi Koneksi Blob Storage agar tidak bikin aplikasi crash saat startup
let blobServiceClient;
try {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    } else {
        console.error("Koneksi Azure Storage kosong di App Settings!");
    }
} catch (e) {
    console.error("Gagal inisialisasi Blob Service Client:", e.message);
}

// Endpoint untuk submit tugas
app.post('/submit-task', upload.single('file_tugas'), async (req, res) => {
    try {
        const { nim, name, class, course } = req.body;

        if (!req.file) {
            return res.status(400).send("<h1>Error: Tidak ada file yang diunggah!</h1><a href='/'>Kembali</a>");
        }

        if (!blobServiceClient) {
            return res.status(500).send("<h1>Error: Konfigurasi Azure Blob Storage rusak!</h1><a href='/'>Kembali</a>");
        }

        const blobName = `${nim}_${req.file.originalname}`;

        // 1. Upload ke Azure Blob Storage
        const containerClient = blobServiceClient.getContainerClient('tugas-praktikum');
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(req.file.buffer);
        const fileUrl = blockBlobClient.url;

        // 2. Simpan Metadata ke MySQL (Menggunakan kolom class_name yang sudah di-ALTER)
        const sql = "INSERT INTO submissions (nim, name, class, course, file_url) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [nim, name, class_name, course, fileUrl], (err) => {
            if (err) {
                console.error("Gagal simpan ke MySQL:", err.message);
                return res.status(500).send(`<h1>Gagal menyimpan data ke database!</h1><p>${err.message}</p><a href='/'>Kembali</a>`);
            }
            res.send("<h1>Tugas Berhasil Dikirim!</h1><a href='/'>Kembali</a>");
        });

    } catch (error) {
        console.error("Fatal Error pada endpoint /submit-task:", error.message);
        res.status(500).send(`<h1>Terjadi kesalahan pada server!</h1><p>${error.message}</p><a href='/'>Kembali</a>`);
    }
});

// Menangani error unhandled rejection agar server Azure tidak mati mendadak
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
