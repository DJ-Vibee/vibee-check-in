// Script to inspect Excel columns
const XLSX = require('xlsx');
const path = require('path');

const excelFile = path.join(__dirname, '..', 'BSB 2025 - 2026 Check In .xlsx');

// Read workbook
const workbook = XLSX.readFile(excelFile);

// Read RAW sheet
const rawSheet = workbook.Sheets['RAW'];
const rawData = XLSX.utils.sheet_to_json(rawSheet, { defval: '' });

console.log('Sample row from RAW sheet:');
if (rawData[0]) {
    console.log(JSON.stringify(rawData[0], null, 2));
}

// Check a dated sheet too
const fridaySheet = workbook.Sheets['Friday, Dec 26, 2025'];
if (fridaySheet) {
    const fridayData = XLSX.utils.sheet_to_json(fridaySheet, { defval: '' });
    console.log('\nSample row from Friday Dec 26 sheet:');
    if (fridayData[0]) {
        console.log(JSON.stringify(fridayData[0], null, 2));
    }
}
