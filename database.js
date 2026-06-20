const { Pool } = require("pg");

// 🔥 ВСТАВЬТЕ СЮДА ВАШУ ССЫЛКУ External Database URL (Ту же, что у салонного бота)
// Она у вас: postgresql://salon_db_rzxb_user:9lSYdR5r8w2Ja9kbCayfjKAMjcFqF59S@dpg-d8qii3lckfvc73e98mg0-a/salon_db_rzxb
const DATABASE_URL = "postgresql://salon_db_rzxb_user:9lSYdR5r8w2Ja9kbCayfjKAMjcFqF59S@dpg-d8qii3lckfvc73e98mg0-a/salon_db_rzxb";

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    const client = await pool.connect();
    try {
        // Таблица вакансий (с приставкой job_)
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_jobs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                company VARCHAR(200),
                description TEXT,
                salary VARCHAR(100),
                city VARCHAR(100),
                category VARCHAR(100),
                contact VARCHAR(100),
                is_published BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Таблица резюме (с приставкой job_)
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_resumes (
                user_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100),
                experience TEXT,
                skills TEXT,
                phone VARCHAR(20)
            );
        `);

        // Таблица подписок (с приставкой job_)
        await client.query(`
            CREATE TABLE IF NOT EXISTS job_subscriptions (
                user_id VARCHAR(50) PRIMARY KEY,
                categories TEXT,
                max_salary VARCHAR(20)
            );
        `);

        console.log("✅ Таблицы для вакансий созданы успешно в общей БД");
    } catch (err) {
        console.error("❌ Ошибка создания таблиц:", err);
    } finally {
        client.release();
    }
}

// --- ВАКАНСИИ ---
async function addJob(jobData) {
    const { title, company, description, salary, city, category, contact } = jobData;
    const res = await pool.query(
        "INSERT INTO job_jobs (title, company, description, salary, city, category, contact, is_published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [title, company, description, salary, city, category, contact, false]
    );
    return res.rows[0];
}

async function getUnpublishedJobs() {
    const res = await pool.query("SELECT * FROM job_jobs WHERE is_published = false ORDER BY created_at DESC");
    return res.rows;
}

async function publishJob(jobId) {
    await pool.query("UPDATE job_jobs SET is_published = true WHERE id = $1", [jobId]);
}

async function deleteJob(jobId) {
    await pool.query("DELETE FROM job_jobs WHERE id = $1", [jobId]);
}

async function getPublishedJobs(limit = 20) {
    const res = await pool.query("SELECT * FROM job_jobs WHERE is_published = true ORDER BY created_at DESC LIMIT $1", [limit]);
    return res.rows;
}

// --- РЕЗЮМЕ ---
async function getResume(userId) {
    const res = await pool.query("SELECT * FROM job_resumes WHERE user_id = $1", [userId.toString()]);
    return res.rows[0] || null;
}

async function saveResume(userId, data) {
    const { name, experience, skills, phone } = data;
    await pool.query(
        "INSERT INTO job_resumes (user_id, name, experience, skills, phone) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO UPDATE SET name = $2, experience = $3, skills = $4, phone = $5",
        [userId.toString(), name, experience, skills, phone]
    );
}

// --- ПОДПИСКИ ---
async function getSubscriptions() {
    const res = await pool.query("SELECT user_id FROM job_subscriptions");
    return res.rows;
}

async function addSubscription(userId, categories, maxSalary) {
    await pool.query(
        "INSERT INTO job_subscriptions (user_id, categories, max_salary) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET categories = $2, max_salary = $3",
        [userId.toString(), categories, maxSalary]
    );
}

async function removeSubscription(userId) {
    await pool.query("DELETE FROM job_subscriptions WHERE user_id = $1", [userId.toString()]);
}

module.exports = {
    initDB,
    addJob,
    getUnpublishedJobs,
    publishJob,
    deleteJob,
    getPublishedJobs,
    getResume,
    saveResume,
    getSubscriptions,
    addSubscription,
    removeSubscription
};