// Script to convert Excel data to JSON for the check-in app
// Run with: node --experimental-default-type=commonjs scripts/parseExcel.cjs

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelFile = path.join(__dirname, '..', 'BSB 2025 - 2026 Check In .xlsx');
const outputFile = path.join(__dirname, '..', 'src', 'utils', 'guestData.json');

// Read workbook
const workbook = XLSX.readFile(excelFile);

// Get all sheet names
console.log('Available sheets:', workbook.SheetNames);

// Read RAW sheet for all guest data
const rawSheet = workbook.Sheets['RAW'];
const rawData = XLSX.utils.sheet_to_json(rawSheet, { defval: '' });

console.log(`RAW sheet has ${rawData.length} rows`);
if (rawData[0]) {
    console.log('Sample row keys:', Object.keys(rawData[0]).join(', '));
}

// Convert Excel date serial to readable date
function excelDateToJS(serial) {
    if (!serial) return '';
    if (typeof serial === 'string') return serial;
    if (typeof serial !== 'number') return String(serial);
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toLocaleDateString('en-US');
}

// Map RAW data to our guest format
const guests = rawData.map((row, i) => {
    return {
        id: `guest-${i + 1}`,
        orderNumber: String(row['Order'] || row['Order #'] || row['Order Number'] || '').replace('#', ''),
        status: row['Status'] || 'pending',
        event: row['Event'] || 'BSB Into The Millennium',
        email: row['Email'] || row['Billing Email'] || '',
        billingFirst: row['Billing First'] || row['First Name'] || '',
        billingLast: row['Billing Last'] || row['Last Name'] || '',
        billingPhone: String(row['Billing Phone'] || row['Phone'] || ''),
        hotel: row['Hotel'] || '',
        checkInDate: excelDateToJS(row['Check In Date']),
        ticketTierName: row['Ticket Tier #1 Name'] || row['Ticket Tier'] || '',
        quantity: parseInt(row['Ticket Tier #1 Quantity']) || parseInt(row['Quantity']) || 1,
        eventDate: excelDateToJS(row['Event Date']),
        ticketType: row['Ticket Type'] || 'Signature',
        idChecked: false,
        checked: false,
        laminatePickUp: false,
        gondola: false,
        wellnessPU: false,
        wellness: row['Wellness'] || '',
        gondolaAddon: row['Gondola Addon'] || row['Gondola'] || '',
        jotformWaiver: row['Jotform Waiver'] || ''
    };
});

// Read dated sheets to find checked-in guests
const datedSheets = workbook.SheetNames.filter(name =>
    name.includes('Dec') || name.includes('Jan') || name.includes('Feb') ||
    name.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || name.match(/day,/)
);

console.log('Dated sheets found:', datedSheets);

// Create a set of checked-in order numbers from dated sheets
const checkedInOrders = new Set();
const laminatePickedUp = new Set();
const idVerified = new Set();
const gondolaPickedUp = new Set();
const wellnessPickedUp = new Set();

datedSheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`Sheet "${sheetName}" has ${data.length} rows`);

    data.forEach(row => {
        const orderNum = String(row['Order'] || row['Order #'] || row['Order Number'] || '').replace('#', '');
        if (!orderNum) return;

        // Column A "Select" = checked in, Column B "Laminate Pick Up", C "Gondola PU", D "Wellness PU"
        if (row['Select'] === true || row['Select'] === 'true' || row['Select'] === 'TRUE') {
            checkedInOrders.add(orderNum);
        }
        if (row['Laminate Pick Up'] === true || row['Laminate Pick Up'] === 'true' || row['Laminate Pick Up'] === 'TRUE') {
            laminatePickedUp.add(orderNum);
        }
        if (row['Gondola PU'] === true || row['Gondola PU'] === 'true' || row['Gondola PU'] === 'TRUE') {
            gondolaPickedUp.add(orderNum);
        }
        if (row['Wellness PU'] === true || row['Wellness PU'] === 'true' || row['Wellness PU'] === 'TRUE') {
            wellnessPickedUp.add(orderNum);
        }
    });
});

console.log(`Found ${checkedInOrders.size} checked-in orders from dated sheets`);

// Update guests with check-in status from dated sheets
guests.forEach(guest => {
    if (checkedInOrders.has(guest.orderNumber)) {
        guest.checked = true;
        guest.status = 'checked';
    }
    if (laminatePickedUp.has(guest.orderNumber)) {
        guest.laminatePickUp = true;
    }
    if (idVerified.has(guest.orderNumber)) {
        guest.idChecked = true;
    }
    if (gondolaPickedUp.has(guest.orderNumber)) {
        guest.gondola = true;
    }
    if (wellnessPickedUp.has(guest.orderNumber)) {
        guest.wellnessPU = true;
    }
});

// Write to JSON file
fs.writeFileSync(outputFile, JSON.stringify(guests, null, 2));
console.log(`\nExported ${guests.length} guests to ${outputFile}`);

// Print summary
const checkedCount = guests.filter(g => g.checked).length;
const waiverCount = guests.filter(g => g.jotformWaiver).length;
console.log(`\nSummary:`);
console.log(`- Total guests: ${guests.length}`);
console.log(`- Checked in: ${checkedCount}`);
console.log(`- Waivers signed: ${waiverCount}`);
