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
        
        const existingBets = db.prepare(`SELECT number, amount FROM bets WHERE number IN (${placeholders})`).all(numbers);
        const existingNumsMap = new Map(existingBets.map(bet => [bet.number, bet.amount]));

        // Separate bets into new and updates
        const newBets = [];
        const updateBets = [];

        bets.forEach(bet => {
            if (existingNumsMap.has(bet.number)) {
                updateBets.push(bet);
            } else {
                newBets.push(bet);
            }
        });

        // Use a transaction for atomicity
        const result = db.transaction(() => {
            let totalChanges = 0;

            // Handle updates
            if (updateBets.length > 0) {
                const updateStmt = db.prepare('UPDATE bets SET amount = ? WHERE number = ?');
                updateBets.forEach(bet => {
                    const result = updateStmt.run(bet.amount, bet.number);
                    totalChanges += result.changes;
                });
            }

            // Handle new insertions
            if (newBets.length > 0) {
                const insertPlaceholders = newBets.map(() => '(?, ?)').join(',');
                const insertStmt = db.prepare(`INSERT INTO bets (number, amount) VALUES ${insertPlaceholders}`);
                
                // Flatten the bets array into [number1, amount1, number2, amount2, ...]
                const params = newBets.reduce((acc, bet) => {
                    acc.push(bet.number, bet.amount);
                    return acc;
                }, []);

                const insertResult = insertStmt.run(...params);
                totalChanges += insertResult.changes;
            }

            return { changes: totalChanges, updates: updateBets.length };
        })();

        callback(null, {
            message: `${result.changes} bets processed successfully (${result.updates} updated).`,
            updatedCount: result.updates,
            newCount: result.changes - result.updates
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