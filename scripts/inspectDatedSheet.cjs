// Script to inspect dated sheet columns
const XLSX = require('xlsx');
const path = require('path');

const excelFile = path.join(__dirname, '..', 'BSB 2025 - 2026 Check In .xlsx');
const workbook = XLSX.readFile(excelFile);

const fridaySheet = workbook.Sheets['Friday, Dec 26, 2025'];
if (fridaySheet) {
    const data = XLSX.utils.sheet_to_json(fridaySheet, { header: 1, defval: '' });

    console.log('Column headers (Row 1):');
    if (data[0]) {
        data[0].forEach((header, i) => {
            const colLetter = String.fromCharCode(65 + i);
            console.log(`  ${colLetter}: "${header}"`);
        });
    }

    console.log('\nSample data rows (columns A-F):');
    for (let i = 1; i <= 5 && i < data.length; i++) {
        const row = data[i];
        console.log(`Row ${i + 1}: A="${row[0]}" B="${row[1]}" C="${row[2]}" D="${row[3]}"`);
    }
}
