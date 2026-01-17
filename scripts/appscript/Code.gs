/**
 * Vibee Check-in: JotForm → Firebase Waiver Sync
 * 
 * This script runs automatically when a new JotForm submission arrives in Google Sheets.
 * It updates the corresponding guest's waiver status in Firebase.
 * 
 * SETUP:
 * 1. Open your JotForm response Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Paste this code in Code.gs
 * 4. Add your Firebase service account credentials to Script Properties:
 *    - Go to Project Settings (⚙️) → Script Properties
 *    - Add property: FIREBASE_SERVICE_ACCOUNT with the JSON contents
 * 5. Set up a trigger: Triggers (⏰) → Add Trigger → onFormSubmit → From spreadsheet → On form submit
 */

// ===== CONFIGURATION =====
// Adjust these values based on your Google Sheet structure

const CONFIG = {
  // Firebase Realtime Database URL (no trailing slash)
  FIREBASE_DB_URL: 'https://vibee-check-in-default-rtdb.firebaseio.com',
  
  // Column index for the Order Number field (1-based, A=1, B=2, etc.)
  // OR use the header name string like 'Order Number' or 'order'
  ORDER_NUMBER_COLUMN: 'order',
  
  // Row number where headers are located (usually 1)
  HEADER_ROW: 1,
  
  // Enable detailed logging
  DEBUG: true
};

// ===== MAIN TRIGGER FUNCTION =====

/**
 * Triggered when a new form submission is added to the sheet.
 * This is the function you should set as your trigger.
 */
function onFormSubmit(e) {
  try {
    log('🔔 New form submission detected');
    
    // Get the submitted row data
    const row = e.range.getRow();
    const sheet = e.range.getSheet();
    
    // Get order number from the submission
    const orderNumber = getOrderNumberFromRow(sheet, row);
    
    if (!orderNumber) {
      log('⚠️ No order number found in submission, skipping');
      return;
    }
    
    log(`📋 Order number: ${orderNumber}`);
    
    // Update Firebase
    const success = updateWaiverInFirebase(orderNumber);
    
    if (success) {
      log(`✅ Successfully updated waiver status for order ${orderNumber}`);
    } else {
      log(`❌ Failed to update waiver status for order ${orderNumber}`);
    }
    
  } catch (error) {
    log(`❌ Error in onFormSubmit: ${error.message}`);
    console.error(error);
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get the order number from a specific row in the sheet.
 */
function getOrderNumberFromRow(sheet, row) {
  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let columnIndex;
  
  // If ORDER_NUMBER_COLUMN is a string, find the column by header name
  if (typeof CONFIG.ORDER_NUMBER_COLUMN === 'string') {
    const searchTerm = CONFIG.ORDER_NUMBER_COLUMN.toLowerCase();
    columnIndex = headers.findIndex(header => 
      String(header).toLowerCase().includes(searchTerm)
    );
    
    if (columnIndex === -1) {
      log(`⚠️ Could not find column with header containing "${CONFIG.ORDER_NUMBER_COLUMN}"`);
      log(`Available headers: ${headers.join(', ')}`);
      return null;
    }
  } else {
    // It's a 1-based column number
    columnIndex = CONFIG.ORDER_NUMBER_COLUMN - 1;
  }
  
  const orderNumber = String(rowData[columnIndex] || '').trim();
  
  // Clean up order number (remove # prefix if present)
  return orderNumber.replace(/^#/, '');
}

/**
 * Update the jotformWaiver field in Firebase for a given order number.
 */
function updateWaiverInFirebase(orderNumber) {
  try {
    const accessToken = getFirebaseAccessToken();
    
    if (!accessToken) {
      log('❌ Failed to get Firebase access token');
      return false;
    }
    
    // Update the guest's jotformWaiver field
    const url = `${CONFIG.FIREBASE_DB_URL}/guests/${orderNumber}/jotformWaiver.json?access_token=${accessToken}`;
    
    const options = {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify(true),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      log(`✅ Firebase updated: guests/${orderNumber}/jotformWaiver = true`);
      return true;
    } else {
      log(`❌ Firebase error: ${responseCode} - ${response.getContentText()}`);
      return false;
    }
    
  } catch (error) {
    log(`❌ Error updating Firebase: ${error.message}`);
    return false;
  }
}

/**
 * Get an OAuth2 access token for Firebase using a service account.
 */
function getFirebaseAccessToken() {
  try {
    // Get service account from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    const serviceAccountJson = scriptProperties.getProperty('FIREBASE_SERVICE_ACCOUNT');
    
    if (!serviceAccountJson) {
      log('❌ FIREBASE_SERVICE_ACCOUNT not found in Script Properties');
      log('Please add your Firebase service account JSON to Script Properties');
      return null;
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour
    
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const payload = {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
      scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
    };
    
    // Encode JWT parts
    const base64Header = Utilities.base64EncodeWebSafe(JSON.stringify(header));
    const base64Payload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
    const signatureInput = `${base64Header}.${base64Payload}`;
    
    // Sign with private key
    const signatureBytes = Utilities.computeRsaSha256Signature(signatureInput, serviceAccount.private_key);
    const base64Signature = Utilities.base64EncodeWebSafe(signatureBytes);
    
    const jwt = `${signatureInput}.${base64Signature}`;
    
    // Exchange JWT for access token
    const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      },
      muteHttpExceptions: true
    });
    
    if (tokenResponse.getResponseCode() !== 200) {
      log(`❌ Token exchange failed: ${tokenResponse.getContentText()}`);
      return null;
    }
    
    const tokenData = JSON.parse(tokenResponse.getContentText());
    return tokenData.access_token;
    
  } catch (error) {
    log(`❌ Error getting access token: ${error.message}`);
    return null;
  }
}

/**
 * Log a message (to console and execution log).
 */
function log(message) {
  if (CONFIG.DEBUG) {
    console.log(message);
    Logger.log(message);
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Test function - manually run this to test the Firebase connection.
 * Set a test order number before running.
 */
function testFirebaseConnection() {
  const testOrderNumber = '12345'; // Replace with a real order number from your data
  
  log('🧪 Testing Firebase connection...');
  log(`Order number: ${testOrderNumber}`);
  
  const success = updateWaiverInFirebase(testOrderNumber);
  
  if (success) {
    log('✅ Test successful! Firebase connection is working.');
  } else {
    log('❌ Test failed. Check the logs above for details.');
  }
}

/**
 * List all headers in the active sheet.
 * Run this to find the correct column name for ORDER_NUMBER_COLUMN.
 */
function listSheetHeaders() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  log('📋 Sheet Headers:');
  headers.forEach((header, index) => {
    log(`  Column ${index + 1} (${columnToLetter(index + 1)}): "${header}"`);
  });
}

/**
 * Convert column number to letter (1 = A, 2 = B, etc.)
 */
function columnToLetter(column) {
  let letter = '';
  while (column > 0) {
    let temp = (column - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    column = Math.floor((column - temp) / 26);
  }
  return letter;
}

/**
 * Process all existing rows in the sheet (one-time sync).
 * Useful for syncing historical submissions.
 */
function syncAllExistingRows() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  log(`🔄 Syncing ${lastRow - CONFIG.HEADER_ROW} rows...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let row = CONFIG.HEADER_ROW + 1; row <= lastRow; row++) {
    const orderNumber = getOrderNumberFromRow(sheet, row);
    
    if (orderNumber) {
      const success = updateWaiverInFirebase(orderNumber);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      Utilities.sleep(100);
    }
  }
  
  log(`✅ Sync complete: ${successCount} successful, ${failCount} failed`);
}
