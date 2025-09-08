# Server Transport

Цей проект — серверна частина для транспортної системи, написана на Node.js з використанням Express, MongoDB (Mongoose) та Passport для аутентифікації.

## Встановлення та запуск

1. Встановіть залежності:
   ```sh
   npm install
   ```
2. Запустіть MongoDB за адресою localhost:27017 (наприклад, через mongod):
   ```sh
   mongod --dbpath=./mongo-data
   ```
3. Зробіть клон репозиторію https://github.com/KaterynaKviten/transport.git у папку transport на тому ж рівні, що і цей репозиторій.

4. Перейдіть в папку transport і виконайте `npm install`, `npm run build`.

5. Запустіть сервер:
   ```sh
   node server.js
   ```
6. Сервер буде доступний на http://localhost:3000 (або порт із змінної середовища `PORT`)

## Вимоги

- Node.js >= 16
- MongoDB >= 4

## Автор

Kateryna Lyman
