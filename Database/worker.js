// db.js
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
let cachedDB = {};
let isDirty = false;

// Ensure db.json exists and is valid
function loadInitialDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}, null, 2), 'utf-8');
  }

  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    cachedDB = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse db.json, initializing empty DB:', e);
    cachedDB = {};
  }
}

// Write cachedDB to disk
function flushToDisk() {
  if (!isDirty) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(cachedDB, null, 2), 'utf-8');
    isDirty = false;
  } catch (e) {
    console.error('Failed to write to db.json:', e);
  }
}

// Initialize DB on startup
loadInitialDB();

// Auto-save every 5 seconds
setInterval(flushToDisk, 5000);

/**
 * Reads the in-memory cached DB
 * @returns {Object} The cached database object
 */
function readDB() {
  return cachedDB;
}

/**
 * Updates the in-memory DB and marks it as dirty
 * @param {Object} data - The new database object
 */
function writeDB(data) {
  cachedDB = data;
  isDirty = true;
}

module.exports = {
  readDB,
  writeDB
};
