import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json())

app.get('/api/health',(_req,res) =>{
    res.json({
        message: 'сервер работает'
    });
});

app.get('/api/rooms', async(_req,res) =>{
    try {
        const result = await pool.query(
            'SELECT * FROM rooms ORDER BY id'
        );
        res.json(result.rows);
    }catch (error){
        console.error(error);

        res.status(500).json({
            message: 'Не удалось получить список помещений'
        });
    }
});

app.listen(port, () =>{
    console.log(`API запущен: http://localhost:${port}`)
});