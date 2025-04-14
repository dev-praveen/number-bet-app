const Database = require('better-sqlite3');
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

let db;
try {
    db = new Database(dbPath);
    console.log('Connected to the SQLite database.');
    
    // Create the bets table if it doesn't exist
    db.exec(`CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL CHECK(number >= 0 AND number <= 99),
        amount REAL NOT NULL CHECK(amount > 0),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("Table 'bets' is ready.");
} catch (err) {
    console.error('Error opening database:', err.message);
}

// Function to save multiple bets in a transaction
const saveBets = (bets, callback) => {
    if (!bets || bets.length === 0) {
        callback(null, { message: 'No bets to save.' });
        return;
    }

    try {
        // First, check which numbers already exist
        const numbers = bets.map(bet => bet.number);
        const placeholders = numbers.map(() => '?').join(',');
        
        const existingNumbers = db.prepare(`SELECT number FROM bets WHERE number IN (${placeholders})`).all(numbers);
        
        // Filter out numbers that already exist
        const existingNums = new Set(existingNumbers.map(row => row.number));
        const newBets = bets.filter(bet => !existingNums.has(bet.number));

        if (newBets.length === 0) {
            callback(null, { message: 'No new bets to save.' });
            return;
        }

        const insertPlaceholders = newBets.map(() => '(?, ?)').join(',');
        const insertStmt = db.prepare(`INSERT INTO bets (number, amount) VALUES ${insertPlaceholders}`);

        // Flatten the bets array into [number1, amount1, number2, amount2, ...]
        const params = newBets.reduce((acc, bet) => {
            acc.push(bet.number, bet.amount);
            return acc;
        }, []);

        // Use a transaction for atomicity
        const result = db.transaction(() => {
            const info = insertStmt.run(...params);
            return info;
        })();

        callback(null, {
            message: `${result.changes} new bets saved successfully.`,
            skippedCount: existingNums.size
        });
    } catch (err) {
        console.error("Error in saveBets:", err.message);
        callback(err);
    }
};

module.exports = {
    db,
    saveBets
};