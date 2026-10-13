import 'dotenv/config';
import express, {
  NextFunction,
  Request,
  Response
} from 'express';
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
type User = {
    id: number;
    login: string;
    role: 'user' | 'admin';
    full_name: string;
}
type AuthRequest = Request & {
    user?: User;
};

function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');

    const secret = process.env.JWT_SECRET || 'local_secret';

    const user = jwt.verify(token, secret) as User;

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      message: 'Требуется авторизация'
    });
  }
}
function adminOnly(
    req: AuthRequest,
    res: Response,
    next: NextFunction
){
    if (req.user?.role !== 'admin'){
        return res.status(403).json({
            message: 'Доступ только для администратора'
        });
    }
    next();
}




app.use(cors());
app.use(express.json())

app.get('/api/health',(_req,res) =>{
    res.json({
        message: 'сервер работает'
    });
});

app.post('/api/auth/register', async(req,res) => {
    const {
        login,
        password,
        fullName,
        phone,
        email,
    } = req.body;

    const errors: string[] =[];

    if (!/^[A-Za-z0-9]{6,50}$/.test(login || '')) {
    errors.push(
      'Логин должен содержать минимум 6 латинских букв или цифр'
    );
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

    if (errors.length >0){
        return res.status(400).json({
            message: errors.join(';')
        });
    }

  try {
    const passwordHash = await bcrypt.hash(password,10);

    const query = `
        INSERT INTO users
            (login,password_hash,full_name,phone,email)
        VALUES ($1,$2,$3,$4,$5)
    `;
    await pool.query(query,[
        login,
        passwordHash,
        fullName,
        phone,
        email
    ]);
    res.status(201).json({
        message: 'user created'
    });
   } catch (error){
    console.error(error);
    res.status(409).json({
        message:'Логин или email уже заняты'
    });
   };

});
app.post('/api/auth/login', async(req,res) => {
    const {login,password} = req.body;

    try {
        const query = `
            SELECT id,login, password_hash,full_name,role
            FROM users
            WHERE login = $1
        `;
        const result = await pool.query(query,[login]);
        const user =  result.rows[0];

        if (!user){
            return res.status(401).json({
                message: "Неверный логин или пароль"
            });
        }
        const passwordIsCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );
        if (!passwordIsCorrect){
            return res.status(401).json({
                message: "Неверный логин или пароль" 
            });
        }

        const secret = process.env.JWT_SECRET || 'local_secret';

        const token = jwt.sign(
            {
                id: user.id,
                login: user.login,
                role: user.role
            },
            secret,
            {
                expiresIn: "8h"
            }
        );
        res.json({
            token,
            user:{
                id:user.id,
                login:user.login,
                role:user.role,
                full_name: user.full_name
            }
        });


    }catch (error){
        console.error(error);

        res.status(500).json({
        message:  'Ошибка подключения к базе данных'
        });

    }

    
    
});


app.get('/api/rooms',auth, async(_req,res) =>{
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

app.post('/api/requests',auth,async(req:AuthRequest,res) =>{
    const {
        roomId,
        startDate,
        paymentMethod
    } = req.body;
    const allowedPayments = ['onsite',"sbp"];

    if (
        !roomId ||
        !startDate ||
        !allowedPayments.includes(paymentMethod)
    ){
        return res.status(400).json({
            message: 'Заполните все поля заявки'
        });
    }

    try {
     const query = `
      INSERT INTO requests
        (user_id, room_id, start_date, payment_method)
      VALUES ($1, $2, $3, $4)
      RETURNING id
        `;
        const result = await pool.query(query, [
        req.user!.id,
        roomId,
        startDate,
        paymentMethod
        ]);

        res.status(201).json({
        id: result.rows[0].id,
        message: 'Заявка отправлена администратору'
        });

    } catch(error){
        console.error(error);

        res.status(500).json({
            message: 'Не удалось создать заявку'
        });
    }
});

app.get('/api/requests', auth, async (
  req: AuthRequest,
  res
) => {
  const isAdmin = req.user?.role === 'admin';

  try {
    let query: string;
    let values: number[];

    if (isAdmin) {
      query = `
         SELECT
            r.id,
            r.start_date,
            r.payment_method,
            r.status,
            r.created_at,
            u.full_name,
            u.login,
            rm.name AS room_name,
            rv.rating,
            rv.comment
        FROM requests r
        JOIN users u
            ON u.id = r.user_id
        JOIN rooms rm
            ON rm.id = r.room_id
        LEFT JOIN reviews rv
            ON rv.request_id = r.id
        ORDER BY r.created_at DESC
      `;

      values = [];
    } else {
      query = `
        SELECT
            r.id,
            r.start_date,
            r.payment_method,
            r.status,
            r.created_at,
            rm.name AS room_name,
            rv.rating,
            rv.comment
        FROM requests r
        JOIN rooms rm
            ON rm.id = r.room_id
        LEFT JOIN reviews rv
            ON rv.request_id = r.id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
      `;

      values = [req.user!.id];
    }

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Не удалось получить заявки'
    });
  }
});

app.patch(
  '/api/requests/:id/status',
  auth,
  adminOnly,
  async (req, res) => {
    const { status } = req.body;

    const allowedStatuses = [
      'Мероприятие назначено',
      'Завершено'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Недопустимый статус'
      });
    }

    try {
      await pool.query(
        `
          UPDATE requests
          SET status = $1
          WHERE id = $2
        `,
        [status, req.params.id]
      );

      res.json({
        message: 'Статус изменён'
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Не удалось изменить статус'
      });
    }
  }
);

app.post(
  '/api/requests/:id/review',
  auth,
  async (req: AuthRequest, res) => {
    const { rating, comment } = req.body;

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !comment ||
      !comment.trim()
    ) {
      return res.status(400).json({
        message: 'Укажите оценку от 1 до 5 и текст отзыва'
      });
    }

    try {
      const query = `
        SELECT id
        FROM requests
        WHERE id = $1
          AND user_id = $2
          AND status = 'Завершено'
      `;

      const result = await pool.query(query, [
        req.params.id,
        req.user!.id
      ]);

      if (result.rowCount === 0) {
        return res.status(400).json({
          message: 'Отзыв можно оставить только после завершения мероприятия'
        });
      }

      const insertQuery = `
        INSERT INTO reviews
          (request_id, user_id, rating, comment)
        VALUES ($1, $2, $3, $4)
      `;

      await pool.query(insertQuery, [
        req.params.id,
        req.user!.id,
        rating,
        comment.trim()
      ]);

      res.status(201).json({
        message: 'Отзыв сохранён'
      });
    } catch (error) {
      console.error(error);

      res.status(409).json({
        message: 'Для этой заявки отзыв уже существует'
      });
    }
  }
);




app.listen(port, () =>{
    console.log(`API запущен: http://localhost:${port}`)
});