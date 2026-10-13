import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT);
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});
function auth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.replace('Bearer ', '');
        const secret = process.env.JWT_SECRET || 'local_secret';
        const user = jwt.verify(token, secret);
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({
            message: 'Требуется авторизация'
        });
    }
}
app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => {
    res.json({
        message: 'сервер работает'
    });
});
app.post('/api/auth/register', async (req, res) => {
    const { login, password, fullName, phone, email, } = req.body;
    const errors = [];
    if (!/^[A-Za-z0-9]{6,50}$/.test(login || '')) {
        errors.push('Логин должен содержать минимум 6 латинских букв или цифр');
    }
    if (typeof password !== 'string' || password.length < 8) {
        errors.push('Пароль должен содержать минимум 8 символов');
    }
    if (!/^[А-Яа-яЁё ]+$/.test(fullName || '')) {
        errors.push('ФИО должно содержать только кириллицу и пробелы');
    }
    if (!/^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(phone || '')) {
        errors.push('Телефон должен иметь формат 8(XXX)XXX-XX-XX');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
        errors.push('Введите корректный email');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            message: errors.join(';')
        });
    }
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const query = `
        INSERT INTO users
            (login,password_hash,full_name,phone,email)
        VALUES ($1,$2,$3,$4,$5)
    `;
        await pool.query(query, [
            login,
            passwordHash,
            fullName,
            phone,
            email
        ]);
        res.status(201).json({
            message: 'user created'
        });
    }
    catch (error) {
        console.error(error);
        res.status(409).json({
            message: 'Логин или email уже заняты'
        });
    }
    ;
});
app.post('/api/auth/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const query = `
            SELECT id,login, password_hash,full_name,role
            FROM users
            WHERE login = $1
        `;
        const result = await pool.query(query, [login]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({
                message: "Неверный логин или пароль"
            });
        }
        const passwordIsCorrect = await bcrypt.compare(password, user.password_hash);
        if (!passwordIsCorrect) {
            return res.status(401).json({
                message: "Неверный логин или пароль"
            });
        }
        const secret = process.env.JWT_SECRET || 'local_secret';
        const token = jwt.sign({
            id: user.id,
            login: user.login,
            role: user.role
        }, secret, {
            expiresIn: "8h"
        });
        res.json({
            token,
            user: {
                id: user.id,
                login: user.login,
                role: user.role,
                full_name: user.full_name
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Ошибка подключения к базе данных'
        });
    }
});
app.get('/api/profile', auth, (req, res) => {
    res.json({
        message: 'Авторизация прошла успешно',
        user: req.user
    });
});
app.get('/api/rooms', async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rooms ORDER BY id');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Не удалось получить список помещений'
        });
    }
});
app.listen(port, () => {
    console.log(`API запущен: http://localhost:${port}`);
});
