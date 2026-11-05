CREATE DATABASE IF NOT EXISTS kerbside; USE kerbside;
DROP TABLE IF EXISTS notifications,reminders,task_bins,tasks,schedules,complaints,bins,areas,users;
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(80),email VARCHAR(120) UNIQUE,password_hash CHAR(64),role ENUM('resident','admin','worker'));
CREATE TABLE areas(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(80));
CREATE TABLE bins(id INT AUTO_INCREMENT PRIMARY KEY,area_id INT,location VARCHAR(160),capacity_l INT DEFAULT 240,status ENUM('ok','overflowing') DEFAULT 'ok',FOREIGN KEY(area_id) REFERENCES areas(id));
CREATE TABLE complaints(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,bin_id INT,description TEXT,status ENUM('pending','in_progress','resolved') DEFAULT 'pending',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(bin_id) REFERENCES bins(id) ON DELETE CASCADE);
CREATE TABLE schedules(id INT AUTO_INCREMENT PRIMARY KEY,area_id INT,collection_date DATE,waste_type VARCHAR(40),FOREIGN KEY(area_id) REFERENCES areas(id));
CREATE TABLE reminders(user_id INT,area_id INT,PRIMARY KEY(user_id,area_id));
CREATE TABLE tasks(id INT AUTO_INCREMENT PRIMARY KEY,worker_id INT,route VARCHAR(160),status ENUM('assigned','accepted','completed') DEFAULT 'assigned',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(worker_id) REFERENCES users(id));
CREATE TABLE task_bins(id INT AUTO_INCREMENT PRIMARY KEY,task_id INT,bin_id INT,status ENUM('pending','collected','failed') DEFAULT 'pending',reason VARCHAR(200),FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,FOREIGN KEY(bin_id) REFERENCES bins(id) ON DELETE CASCADE);
CREATE TABLE notifications(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,message VARCHAR(200),is_read BOOL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
-- demo logins: password for all is pass123
INSERT INTO users(name,email,password_hash,role) VALUES
('Asha Resident','resident@kerbside.test',SHA2('pass123',256),'resident'),
('Dev Admin','admin@kerbside.test',SHA2('pass123',256),'admin'),
('Ravi Worker','worker@kerbside.test',SHA2('pass123',256),'worker');
INSERT INTO areas(name) VALUES('Market Road'),('Lake View'),('Station Colony');
INSERT INTO bins(area_id,location,capacity_l) VALUES(1,'Opposite the bus stop',240),(1,'Fish market gate',360),(2,'Park entrance',240),(2,'Boat jetty',120),(3,'Platform 1 exit',360),(3,'Corner of 4th Cross',240);
INSERT INTO schedules(area_id,collection_date,waste_type) VALUES
(1,CURDATE()+INTERVAL 1 DAY,'Wet waste'),(1,CURDATE()+INTERVAL 4 DAY,'Dry waste'),
(2,CURDATE()+INTERVAL 2 DAY,'Wet waste'),(2,CURDATE()+INTERVAL 5 DAY,'Recyclables'),
(3,CURDATE()+INTERVAL 3 DAY,'Wet waste'),(3,CURDATE()+INTERVAL 6 DAY,'Dry waste');
