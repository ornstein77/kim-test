import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:4000/api';

type User = {
  id: number;
  login: string;
  role: 'user' | 'admin';
  full_name: string;
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
        <h2>Добро пожаловать, {user.full_name}</h2>
        <p>
          Авторизованный пользователь: {user.login}
        </p>
        <p>
          Роль: {user.role}
        </p>
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

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);