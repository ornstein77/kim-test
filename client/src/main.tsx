import React, {
  useEffect,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:4000/api';

type User = {
  id: number;
  login: string;
  role: 'user' | 'admin';
  full_name: string;
};

type Room = {
  id: number;
  name: string;
  description: string;
  capacity: number;
};

type RequestItem = {
  id: number;
  room_name: string;
  start_date: string;
  payment_method: string;
  status: string;
  rating?: number;
  comment?: string;
  full_name?: string;
  login?: string;
};

async function callApi(
  path: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem('token');

  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Произошла ошибка');
  }

  return data;
}

function App() {
  const [page, setPage] = useState<'requests' | 'new'>(
  'requests'
  );
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');

    if (!savedUser) {
      return null;
    }

    return JSON.parse(savedUser);
  });

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className="app">
      <header>
        <h1>Конференции.РФ</h1>

        <div>
          <span>{user.full_name}</span>
          <button onClick={logout}>Выйти</button>
        </div>
      </header>

      <main>
        <nav className="navigation">
          <button
            className={page === 'requests' ? 'active' : ''}
            onClick={() => setPage('requests')}
          >
            {user.role === 'admin'
              ? 'Все заявки'
              : 'Мои заявки'}
          </button>

          {user.role === 'user' && (
            <button
              className={page === 'new' ? 'active' : ''}
              onClick={() => setPage('new')}
            >
              Новая заявка
            </button>
          )}
        </nav>

        {page === 'new' && user.role === 'user' ? (
          <NewRequest
            onDone={() => setPage('requests')}
          />
        ) : (
          <Requests user={user} />
        )}
    </main>
    </div>
  );
}

function Auth({
  onLogin
}: {
  onLogin: (user: User) => void;
}) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    login: '',
    password: '',
    fullName: '',
    phone: '',
    email: ''
  });

  function updateField(
    field: string,
    value: string
  ) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    try {
      const path = register
        ? '/auth/register'
        : '/auth/login';

      const data = await callApi(path, {
        method: 'POST',
        body: JSON.stringify(form)
      });

      if (register) {
        setRegister(false);
        setError('Пользователь создан. Теперь войдите.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      onLogin(data.user);
    } catch (error) {
      setError((error as Error).message);
    }
  }

  return (
    <div className="auth">
      <form className="auth-form" onSubmit={submit}>
        <h1>Конференции.РФ</h1>

        <h2>
          {register ? 'Регистрация' : 'Авторизация'}
        </h2>

        <label>
          Логин
          <input
            value={form.login}
            onChange={event =>
              updateField('login', event.target.value)
            }
            required
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={event =>
              updateField('password', event.target.value)
            }
            required
          />
        </label>

        {register && (
          <>
            <label>
              ФИО
              <input
                value={form.fullName}
                onChange={event =>
                  updateField(
                    'fullName',
                    event.target.value
                  )
                }
                placeholder="Иванов Иван Иванович"
                required
              />
            </label>

            <label>
              Телефон
              <input
                value={form.phone}
                onChange={event =>
                  updateField(
                    'phone',
                    event.target.value
                  )
                }
                placeholder="8(900)123-45-67"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={event =>
                  updateField(
                    'email',
                    event.target.value
                  )
                }
                required
              />
            </label>
          </>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <button type="submit">
          {register
            ? 'Создать пользователя'
            : 'Войти'}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register
            ? 'Уже зарегистрированы? Войти'
            : 'Еще не зарегистрированы? Регистрация'}
        </button>
      </form>
    </div>
  );
}

function Requests({ user }: { user: User }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [error, setError] = useState('');

  async function loadRequests() {
    try {
      const data = await callApi('/requests');
      setItems(data);
    } catch (error) {
      setError((error as Error).message);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function updateStatus(
    id: number,
    status: string
  ) {
    try {
      await callApi(`/requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await loadRequests();
    } catch (error) {
      setError((error as Error).message);
    }
  }

  async function addReview(id: number) {
    const rating = Number(
      prompt('Оценка от 1 до 5:')
    );

    const comment = prompt('Ваш отзыв:') || '';

    if (!rating || !comment.trim()) {
      return;
    }

    try {
      await callApi(`/requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          rating,
          comment
        })
      });

      await loadRequests();
    } catch (error) {
      setError((error as Error).message);
    }
  }

  const isAdmin = user.role === 'admin';

  return (
    <section>
      <h2>
        {isAdmin ? 'Все заявки' : 'Мои заявки'}
      </h2>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {items.length === 0 && !error && (
        <p>Заявок пока нет.</p>
      )}

      <div className="request-list">
        {items.map(item => (
          <article
            className="request-card"
            key={item.id}
          >
            <div className="request-header">
              <h3>{item.room_name}</h3>

              <span className="status">
                {item.status}
              </span>
            </div>

            <p>
              Номер заявки: {item.id}
            </p>

            {isAdmin && (
              <p>
                Пользователь: {item.full_name}
                {' '}
                ({item.login})
              </p>
            )}

            <p>
              Дата конференции:{' '}
              {new Date(item.start_date)
                .toLocaleDateString('ru-RU')}
            </p>

            <p>
              Способ оплаты:{' '}
              {item.payment_method === 'sbp'
                ? 'Перевод по СБП'
                : 'При очном посещении'}
            </p>

            {isAdmin &&
              item.status === 'Новая' && (
                <div className="actions">
                  <button
                    onClick={() =>
                      updateStatus(
                        item.id,
                        'Мероприятие назначено'
                      )
                    }
                  >
                    Назначить мероприятие
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(
                        item.id,
                        'Завершено'
                      )
                    }
                  >
                    Завершить
                  </button>
                </div>
              )}

            {!isAdmin &&
              item.status === 'Завершено' &&
              !item.rating && (
                <button
                  onClick={() => addReview(item.id)}
                >
                  Оставить отзыв
                </button>
              )}

            {item.rating && (
              <div className="review">
                <p>
                  Оценка:{' '}
                  {'★'.repeat(item.rating)}
                </p>

                <p>
                  Отзыв: {item.comment}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}


function NewRequest({
  onDone
}: {
  onDone: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    roomId: '',
    startDate: '',
    paymentMethod: 'onsite'
  });

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const data = await callApi('/rooms');
      setRooms(data);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      const data = await callApi('/requests', {
        method: 'POST',
        body: JSON.stringify({
          roomId: Number(form.roomId),
          startDate: form.startDate,
          paymentMethod: form.paymentMethod
        })
      });

      setMessage(data.message);

      setTimeout(() => {
        onDone();
      }, 700);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section>
      <h2>Новая заявка</h2>

      <form
        className="request-form"
        onSubmit={submit}
      >
        <label>
          Помещение

          <select
            required
            value={form.roomId}
            onChange={event =>
              setForm({
                ...form,
                roomId: event.target.value
              })
            }
          >
            <option value="">
              Выберите помещение
            </option>

            {rooms.map(room => (
              <option
                key={room.id}
                value={room.id}
              >
                {room.name}
                {' — до '}
                {room.capacity}
                {' человек'}
              </option>
            ))}
          </select>
        </label>

        <label>
          Дата начала конференции

          <input
            required
            type="date"
            min={
              new Date()
                .toISOString()
                .slice(0, 10)
            }
            value={form.startDate}
            onChange={event =>
              setForm({
                ...form,
                startDate: event.target.value
              })
            }
          />
        </label>

        <fieldset>
          <legend>Способ оплаты</legend>

          <label>
            <input
              type="radio"
              checked={
                form.paymentMethod === 'onsite'
              }
              onChange={() =>
                setForm({
                  ...form,
                  paymentMethod: 'onsite'
                })
              }
            />
            При очном посещении
          </label>

          <label>
            <input
              type="radio"
              checked={
                form.paymentMethod === 'sbp'
              }
              onChange={() =>
                setForm({
                  ...form,
                  paymentMethod: 'sbp'
                })
              }
            />
            Переводом по СБП
          </label>
        </fieldset>

        {message && (
          <div className="message">
            {message}
          </div>
        )}

        <button type="submit">
          Отправить заявку
        </button>
      </form>
    </section>
  );
}

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);