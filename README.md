# Kerbside – Smart Waste Management System (React + MySQL)
1. Install Node 18+ and MySQL 8.
2. Create the database:  `mysql -u root -p < database/schema.sql`
3. API:  `cd server && npm install && DB_USER=root DB_PASS=yourpassword npm start`   (runs on :5000)
4. Website (new terminal):  `cd client && npm install && npm run dev`   (open http://localhost:5173)
Logins (password pass123): resident@kerbside.test, admin@kerbside.test, worker@kerbside.test
Windows PowerShell: set vars first, e.g. `$env:DB_PASS="yourpassword"; npm start`
