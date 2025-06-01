"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db = new sqlite3_1.default.Database('poker-game.db');
console.log('Initializing database...');
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      chips INTEGER DEFAULT 1000
    )
  `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        }
        else {
            console.log('Users table ready');
        }
    });
});
class UserModel {
    static findOne(where, callback) {
        let query = '';
        let params = [];
        if (where.username) {
            query = 'SELECT * FROM users WHERE username = ?';
            params = [where.username];
        }
        else if (where.id) {
            query = 'SELECT * FROM users WHERE id = ?';
            params = [where.id];
        }
        console.log('Executing query:', query, 'with params:', params);
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Database error in findOne:', err);
                callback(err, null);
            }
            else {
                console.log('Query result:', row);
                callback(null, row || null);
            }
        });
    }
    static create({ username, password, chips }, callback) {
        console.log('Creating user:', username);
        bcryptjs_1.default.hash(password, 10, (err, hashed) => {
            if (err) {
                console.error('Error hashing password:', err);
                callback(err, null);
                return;
            }
            console.log('Password hashed, inserting user');
            db.run('INSERT INTO users (username, password, chips) VALUES (?, ?, ?)', [username, hashed, chips], function (err) {
                if (err) {
                    console.error('Error inserting user:', err);
                    callback(err, null);
                }
                else {
                    console.log('User inserted with ID:', this.lastID);
                    callback(null, {
                        id: this.lastID,
                        username,
                        password: hashed,
                        chips
                    });
                }
            });
        });
    }
    static comparePassword(user, candidate, callback) {
        console.log('Comparing password for user:', user.username);
        bcryptjs_1.default.compare(candidate, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
            }
            else {
                console.log('Password match result:', isMatch);
            }
            callback(err, isMatch);
        });
    }
}
exports.UserModel = UserModel;
