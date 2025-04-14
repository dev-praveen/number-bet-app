const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Handle both development and production paths
const isDev = !process?.pkg;
const dbFolder = isDev ? path.resolve(__dirname, 'db') : path.dirname(process.execPath);
const dbPath = path.join(dbFolder, 'bets.db');

// Ensure the database directory exists
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create the bets table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL CHECK(number >= 0 AND number <= 99),
            amount REAL NOT NULL CHECK(amount > 0),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log("Table 'bets' is ready.");
            }
        });
    }
});

// Function to save multiple bets in a transaction
const saveBets = (bets, callback) => {
    if (!bets || bets.length === 0) {
        return callback(null, { message: 'No bets to save.' });
    }

    // First, check which numbers already exist
    const numbers = bets.map(bet => bet.number);
    const placeholders = numbers.map(() => '?').join(',');
    
    db.all(`SELECT number FROM bets WHERE number IN (${placeholders})`, numbers, (err, existingNumbers) => {
        if (err) {
            console.error("Error checking existing numbers:", err.message);
            return callback(err);
        }

        // Filter out numbers that already exist
        const existingNums = new Set(existingNumbers.map(row => row.number));
        const newBets = bets.filter(bet => !existingNums.has(bet.number));

        if (newBets.length === 0) {
            return callback(null, { message: 'No new bets to save.' });
        }

        const insertPlaceholders = newBets.map(() => '(?, ?)').join(',');
        const sql = `INSERT INTO bets (number, amount) VALUES ${insertPlaceholders}`;

        // Flatten the bets array into [number1, amount1, number2, amount2, ...]
        const params = newBets.reduce((acc, bet) => {
            acc.push(bet.number, bet.amount);
            return acc;
        }, []);

        // Use a transaction for atomicity
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            const stmt = db.prepare(sql);
            stmt.run(params, function(err) {
                if (err) {
                    console.error("Error inserting bets:", err.message);
                    db.run('ROLLBACK;');
                    return callback(err);
                }
                console.log(`Inserted ${this.changes} rows with last ID ${this.lastID}`);
                db.run('COMMIT;', (commitErr) => {
                    if(commitErr) {
                        console.error("Error committing transaction:", commitErr.message);
                        return callback(commitErr);
                    }
                    callback(null, { 
                        message: `${this.changes} new bets saved successfully.`,
                        skippedCount: existingNums.size
                    });
                });
            });
            stmt.finalize();
        });
    });
};

module.exports = {
    db,
    saveBets
};