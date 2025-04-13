const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'db/bets.db');
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

    const placeholders = bets.map(() => '(?, ?)').join(',');
    const sql = `INSERT INTO bets (number, amount) VALUES ${placeholders}`;

    // Flatten the bets array into [number1, amount1, number2, amount2, ...]
    const params = bets.reduce((acc, bet) => {
        acc.push(bet.number, bet.amount);
        return acc;
    }, []);

    // Use a transaction for atomicity
    db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        const stmt = db.prepare(sql);
        stmt.run(params, function(err) { // Use function() to access 'this'
            if (err) {
                console.error("Error inserting bets:", err.message);
                db.run('ROLLBACK;');
                return callback(err);
            }
            console.log(`Inserted ${this.changes} rows with last ID ${this.lastID}`);
            db.run('COMMIT;', (commitErr) => {
                if(commitErr){
                    console.error("Error committing transaction:", commitErr.message);
                    return callback(commitErr);
                }
                callback(null, { message: `${this.changes} bets saved successfully.` });
            });
        });
        stmt.finalize();
    });
};

module.exports = {
    db,
    saveBets
};