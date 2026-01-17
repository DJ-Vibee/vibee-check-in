# JotForm → Firebase Apps Script Setup

This folder contains the Google Apps Script code to automatically sync JotForm waiver submissions to Firebase.

## Quick Setup

### 1. Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/project/vibee-check-in/settings/serviceaccounts/adminsdk)
2. Click **Generate new private key**
3. Download the JSON file

### 2. Add Script to Google Sheets

1. Open your JotForm response Google Sheet
2. **Extensions** → **Apps Script**
3. Delete any existing code
4. Copy and paste the contents of `Code.gs`

### 3. Add Service Account Credentials

1. In Apps Script, click **⚙️ Project Settings** (left sidebar)
2. Scroll to **Script Properties**
3. Click **Add script property**
   - Property: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste the entire contents of your downloaded JSON file

### 4. Configure Column Mapping

In `Code.gs`, find the `CONFIG` section and update:

```javascript
ORDER_NUMBER_COLUMN: 'order',  // Change to your column header name
```

Run `listSheetHeaders()` to see all available column names.

### 5. Set Up Trigger

1. Click **⏰ Triggers** (left sidebar)
2. Click **+ Add Trigger**
3. Configure:
   - Function: `onFormSubmit`
   - Event source: **From spreadsheet**
   - Event type: **On form submit**
4. Click **Save**
5. Grant permissions when prompted

## Testing

1. Run `listSheetHeaders()` to verify column detection
2. Run `testFirebaseConnection()` with a real order number
3. Submit a test waiver through JotForm
4. Check Firebase console for the update

## One-Time Sync

To sync all existing submissions:

```javascript
syncAllExistingRows()
```

⚠️ This will update ALL rows in your sheet. Use for initial migration only.
