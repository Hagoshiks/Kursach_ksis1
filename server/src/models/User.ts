import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const db = new sqlite3.Database('poker-game.db');

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
    } else {
      console.log('Users table ready');
    }
  });
});

export interface IUser {
  id: number;
  username: string;
  password: string;
  chips: number;
}

export class UserModel {
  static findOne(where: { username?: string; id?: number }, callback: (err: Error | null, user: IUser | null) => void): void {
    let query = '';
    let params: any[] = [];

    if (where.username) {
      query = 'SELECT * FROM users WHERE username = ?';
      params = [where.username];
    } else if (where.id) {
      query = 'SELECT * FROM users WHERE id = ?';
      params = [where.id];
    }

    console.log('Executing query:', query, 'with params:', params);

    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Database error in findOne:', err);
        callback(err, null);
      } else {
        console.log('Query result:', row);
        callback(null, row as IUser || null);
      }
    });
  }

  static create({ username, password, chips }: { username: string; password: string; chips: number }, callback: (err: Error | null, user: IUser | null) => void): void {
    console.log('Creating user:', username);
    
    bcrypt.hash(password, 10, (err, hashed) => {
      if (err) {
        console.error('Error hashing password:', err);
        callback(err, null);
        return;
      }

      console.log('Password hashed, inserting user');

      db.run(
        'INSERT INTO users (username, password, chips) VALUES (?, ?, ?)',
        [username, hashed, chips],
        function(err) {
          if (err) {
            console.error('Error inserting user:', err);
            callback(err, null);
          } else {
            console.log('User inserted with ID:', this.lastID);
            callback(null, {
              id: this.lastID,
              username,
              password: hashed,
              chips
            });
          }
        }
      );
    });
  }

  static comparePassword(user: IUser, candidate: string, callback: (err: Error | null, isMatch: boolean) => void): void {
    console.log('Comparing password for user:', user.username);
    bcrypt.compare(candidate, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error comparing passwords:', err);
      } else {
        console.log('Password match result:', isMatch);
      }
      callback(err, isMatch);
    });
  }
} 