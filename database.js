const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Handle both development and production paths
const isDev = !process?.pkg;
const dbFolder = isDev ? path.resolve(__dirname, 'db') : path.dirname(process.execPath);
const dbPath = path.join(dbFolder, 'bets.db');

// Game configurations
const gameConfig = {
    day: { table: 'day_bets', minNumber: 0, maxNumber: 99 },
    night: { table: 'night_bets', minNumber: 0, maxNumber: 99 },
    open: { table: 'open_bets', minNumber: 0, maxNumber: 9 }
};

// Ensure the database directory exists
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

let db;
try {
    db = new Database(dbPath);
    console.log('Connected to the SQLite database.');
    
    // Create tables for each game type
    Object.entries(gameConfig).forEach(([game, config]) => {
        const { table, minNumber, maxNumber } = config;
        db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL CHECK(number >= ${minNumber} AND number <= ${maxNumber}),
            amount REAL NOT NULL CHECK(amount > 0),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log(`Table '${table}' is ready.`);
    });
} catch (err) {
    console.error('Error opening database:', err.message);
}

// Helper function to get the table name for a game type
const getTableName = (gameType) => {
    const config = gameConfig[gameType];
    if (!config) {
        throw new Error(`Invalid game type: ${gameType}`);
    }
    return config.table;
};

// Function to validate bet numbers for a specific game
const validateBetNumber = (number, gameType) => {
    const config = gameConfig[gameType];
    if (!config) {
        throw new Error(`Invalid game type: ${gameType}`);
    }
    return number >= config.minNumber && number <= config.maxNumber;
};

// Function to save multiple bets in a transaction
const saveBets = (bets, gameType, callback) => {
    if (!bets || bets.length === 0) {
        callback(null, { message: 'No bets to save.' });
        return;
    }

    const tableName = getTableName(gameType);

    try {
        // Validate all numbers are within range for the game type
        const invalidBet = bets.some(bet => !validateBetNumber(bet.number, gameType));
        if (invalidBet) {
            throw new Error(`Invalid bet number for ${gameType} game`);
        }

        // First, check which numbers already exist
        const numbers = bets.map(bet => bet.number);
        const placeholders = numbers.map(() => '?').join(',');
        
        const existingBets = db.prepare(`SELECT number, amount FROM ${tableName} WHERE number IN (${placeholders})`).all(numbers);
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
                const updateStmt = db.prepare(`UPDATE ${tableName} SET amount = ? WHERE number = ?`);
                updateBets.forEach(bet => {
                    const result = updateStmt.run(bet.amount, bet.number);
                    totalChanges += result.changes;
                });
            }

            // Handle new insertions
            if (newBets.length > 0) {
                const insertPlaceholders = newBets.map(() => '(?, ?)').join(',');
                const insertStmt = db.prepare(`INSERT INTO ${tableName} (number, amount) VALUES ${insertPlaceholders}`);
                
                // Flatten the bets array into [number1, amount1, number2, amount2, ...]
                const params = newBets.reduce((acc, bet) => {
                    acc.push(bet.number, bet.amount);
                    return acc;
                }, []);

                const insertResult = insertStmt.run(...params);
                totalChanges += insertResult.changes;
            }

            return { 
                changes: totalChanges, 
                newCount: newBets.length,
                updatedCount: updateBets.length
            };
        })();

        // Create a clear message about what happened
        let message = '';
        if (result.newCount > 0 && result.updatedCount > 0) {
            message = `${result.newCount} new bets saved and ${result.updatedCount} bets updated`;
        } else if (result.newCount > 0) {
            message = `${result.newCount} new bets saved`;
        } else if (result.updatedCount > 0) {
            message = `${result.updatedCount} bets updated`;
        } else {
            message = 'No changes made';
        }

        callback(null, {
            message,
            newCount: result.newCount,
            updatedCount: result.updatedCount
        });
    } catch (err) {
        console.error("Error in saveBets:", err.message);
        callback(err);
    }
};

module.exports = {
    db,
    saveBets,
    getTableName
};