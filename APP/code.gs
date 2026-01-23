// ==========================
// Entry point: serve pages based on URL parameter
// ==========================
const webAppUrl = ScriptApp.getService().getUrl();
const url = "https://docs.google.com/spreadsheets/d/1VClSH5bguIh0g_TkbfGh6Qbt3KXrl4eBVg5yc2kwyuM/edit?gid=0#gid=0";

var Route = {};
Route.path = function(route, callback) {
  Route[route] = callback;
};

const MySheets = SpreadsheetApp.openByUrl(url);
let LoginSheet = MySheets.getSheetByName("user");

// ==========================
// Main GET handler
// ==========================
function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};

  const view = e.parameter.v || 'login';
  const loggedIn = PropertiesService.getUserProperties().getProperty('LOGGED_IN') === 'true';

  if (view === "login") {
    return loadlogin();
  }

  if (view === "dashboard") {
    if (!loggedIn) {
      return HtmlService.createHtmlOutput(
        '<h3>Unauthorized</h3><a href="?v=login">Login</a>'
      );
    }
    const username = PropertiesService.getUserProperties().getProperty('USERNAME');
    return loaddashboard(username);
  }

  // fallback
  return loadlogin();
}

// ==========================
// Utility functions
// ==========================
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function getUsername() {
  const loggedIn = PropertiesService.getUserProperties().getProperty('LOGGED_IN') === 'true';
  if (!loggedIn) return null;
  return PropertiesService.getUserProperties().getProperty('USERNAME') || "Unknown User";
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function parseDate(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  const parts = dateValue.toString().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${day}/${month}/${year}`;
  }

  return dateValue;
}

// ==========================
// Page loaders
// ==========================
function loadlogin() {
  const t = HtmlService.createTemplateFromFile("login");
  t.webAppUrl = ScriptApp.getService().getUrl();
  t.appName = "My App";
  return t.evaluate();
}

function loadabout() {
  const t = HtmlService.createTemplateFromFile("about");
  t.appName = "My App";
  return t.evaluate();
}

function loaddashboard(username) {
  const template = HtmlService.createTemplateFromFile('dashboard');
  template.username = username;
  return template.evaluate()
    .setTitle("Dashboard")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==========================
// Dashboard data
// ==========================
function getDashboardData() {
  const ss = SpreadsheetApp.openByUrl(url);
  const sheet = ss.getSheetByName("data");
  const values = sheet.getDataRange().getValues();
  const dataRows = values.slice(4);

  let totalRecords = dataRows.length;
  let categories = {};
  let verifiedCategory = {};
  let dateCounts = {};
  let table = [];

  dataRows.forEach(row => {
    const surname = row[2] || '';
    const givenName = row[3] || '';
    const contact = row[4] || '';
    const categoryStr = row[6] || '';
    const sentDate = row[7] || '';
    const verified = row[8] === true || row[8] === 'TRUE';

    if (categoryStr) {
      categoryStr.split(',').forEach(cat => {
        cat = cat.trim();
        categories[cat] = (categories[cat] || 0) + 1;

        if (!verifiedCategory[cat]) verifiedCategory[cat] = { verified: 0, notVerified: 0 };
        if (verified) verifiedCategory[cat].verified += 1;
        else verifiedCategory[cat].notVerified += 1;
      });
    }

    if (sentDate) {
      dateCounts[sentDate] = (dateCounts[sentDate] || 0) + 1;
    }

    table.push([
      sentDate,
      surname + ' ' + givenName,
      categoryStr,
      contact,
      verified ? 'Yes' : 'No'
    ]);
  });

  Logger.log(table);
  return { totalRecords, categories, verifiedCategory, dateCounts, table };
}







// ==========================
// Test data
// ==========================
function testData() {
  return [
    {
      applicantId: 'A001',
      surname: 'Doe',
      givenName: 'John',
      licenseNo: 'LIC123',
      sentDate: '2026-01-01',
      verified: true,
      dateOfVerification: '2026-01-02',
      receiverDetails: 'Office A',
      receiverContactInfo: '123456789',
      receivedDate: '2026-01-03',
      comments: 'Test comment'
    }
  ];
}





// ==========================
// Receiver Info Page
// ==========================
function saveReceiverInfo(data) {
  const sheet = MySheets.getSheetByName('data');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const idColIndex = headers.indexOf("applicant.ID.");
  const verifiedColIndex = headers.indexOf("VERIFIED");
  const receivedColIndex = headers.indexOf("recievedDATE");

  if (idColIndex === -1) throw new Error("Column 'applicant.ID.' not found");

  const rowIndex = values.findIndex(r => String(r[idColIndex]) === String(data.applicantID));
  if (rowIndex === -1) throw new Error("Applicant ID not found in database.");

  const rowNumber = rowIndex + 1;
  const currentRow = values[rowIndex];

  const isVerified = String(currentRow[verifiedColIndex]).toUpperCase() === "TRUE";
  if (!isVerified) throw new Error("Cannot save: This application has not been verified yet.");

  const existingReceivedDate = currentRow[receivedColIndex];
  if (existingReceivedDate && existingReceivedDate !== "") throw new Error("Cannot save: This record already has a Received Date.");

  const updates = {
    "Reciever details": data.receiverDetails,
    "reciever_contact_info": data.receiverContact,
    "recievedDate": data.received,
    "entered by": data.enteredBy
  };

  for (let key in updates) {
    let colIndex = headers.indexOf(key) + 1;
    if (colIndex > 0) {
      sheet.getRange(rowNumber, colIndex).setValue(updates[key]);
    }
  }

  return "Success";
}







// ==========================
// Reports & Verification
// ==========================
function getReportsData(searchTerm = '', searchBy = '') {
  const cache = CacheService.getScriptCache();
  const cacheKey = "reports_data_json";
  let cachedData = cache.get(cacheKey);
  let results;

  if (cachedData) {
    results = JSON.parse(cachedData);
  } else {
    const sheet = MySheets.getSheetByName("data");
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    const parseDateStr = d => {
      if (!d) return '';
      if (d instanceof Date && !isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      if (typeof d === 'string' && d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      return String(d);
    };

    results = rows.map(r => ({
      applicantId: String(r[1] || ''),
      surname: r[2] || '',
      givenName: r[3] || '',
      contactNo: r[4] || '',
      licenseNo: String(r[5] || ''),
      category: r[6] || '',
      sentDate: parseDateStr(r[7]),
      verified: r[8] === true || r[8] === 'TRUE',
      dateOfVerification: parseDateStr(r[9]),
      comments: r[10] || '',
      receiverDetails: r[11] || '',
      receiverContactInfo: r[12] || '',
      receivedDate: parseDateStr(r[13])
    }));

    try {
      cache.put(cacheKey, JSON.stringify(results), 1800);
    } catch (e) {
      console.warn("Data too large for cache, skipping cache step.");
    }
  }

  if (searchTerm && searchBy) {
    const term = searchTerm.toString().toLowerCase();
    return results.filter(r => {
      const field = searchBy === 'applicant' ? r.applicantId : r.licenseNo;
      return (field || "").toLowerCase().includes(term);
    });
  }

  return results;
}







// ==========================
// Excel Export
// ==========================

function getAllReportData(filters) {
  try {
    const ss = SpreadsheetApp.openByUrl(url);
    const sheet = ss.getSheetByName("data");
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues(); // read everything at once
    if (data.length < 2) return [];

    const headers = data[0].map(h => h.trim());
    const rows = data.slice(1); // exclude headers

    const safeDate = val => (val instanceof Date ? Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(val || ''));

    // Map rows to objects once
    let results = rows.map(row => {
      return {
        applicant_ID: String(row[headers.indexOf("applicant.ID.")] || ''),
        SURNAME: String(row[headers.indexOf("SURNAME")] || ''),
        GIVEN_NAME: String(row[headers.indexOf("GIVEN_NAME")] || ''),
        CONTACT_NO: String(row[headers.indexOf("CONTACT_NO")] || ''),
        DRIVING_LICENSE_NO: String(row[headers.indexOf("DRIVING_LICENSE_NO")] || ''),
        CATEGORY: String(row[headers.indexOf("CATEGORY")] || ''),
        SENT_DATE: safeDate(row[headers.indexOf("SENT DATE")]),
        VERIFIED: String(row[headers.indexOf("VERIFIED")]).toUpperCase() === 'TRUE',
        DATE_OF_VERIFICATION: safeDate(row[headers.indexOf("DATE OF VERIFICATION")]),
        comments: String(row[headers.indexOf("comments")] || ''),
        Reciever_details: String(row[headers.indexOf("Reciever details")] || ''),
        reciever_contact_info: String(row[headers.indexOf("reciever_contact_info")] || ''),
        recieved: safeDate(row[headers.indexOf("recieved")])
      };
    });

    // =============================== Filters ===============================
    if (filters) {
      const { fromDate, toDate, verifiedStatus, applicantId, licenseNo } = filters;

      if (verifiedStatus === 'true') results = results.filter(r => r.VERIFIED);
      else if (verifiedStatus === 'false') results = results.filter(r => !r.VERIFIED);

      if (fromDate || toDate) {
        const start = fromDate ? new Date(fromDate).setHours(0,0,0,0) : null;
        const end = toDate ? new Date(toDate).setHours(23,59,59,999) : null;

        results = results.filter(r => {
          const dateVal = verifiedStatus === 'true' ? r.DATE_OF_VERIFICATION : r.SENT_DATE;
          const time = new Date(dateVal).getTime();
          if (isNaN(time)) return false;
          if (start && time < start) return false;
          if (end && time > end) return false;
          return true;
        });
      }

      if (applicantId) results = results.filter(r => r.applicant_ID.toLowerCase().includes(applicantId.toLowerCase()));
      if (licenseNo) results = results.filter(r => r.DRIVING_LICENSE_NO.toLowerCase().includes(licenseNo.toLowerCase()));
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.SENT_DATE).getTime() - new Date(a.SENT_DATE).getTime());

    return results;
  } catch (err) {
    console.error("getAllReportData failed:", err);
    return [];
  }
}




function getAllReportDataold(filters) {
  try {
    const ss = SpreadsheetApp.openByUrl(url);
    const sheet = ss.getSheetByName("data");
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

    const safeDate = val => {
      if (!val || !(val instanceof Date) || isNaN(val.getTime())) return '';
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
    };

    let results = rows.map(row => ({
      applicant_ID: String(row[1] || ''),
      SURNAME: String(row[2] || ''),
      GIVEN_NAME: String(row[3] || ''),
      CONTACT_NO: String(row[4] || ''),
      DRIVING_LICENSE_NO: String(row[5] || ''),
      CATEGORY: String(row[6] || ''),
      SENT_DATE: safeDate(row[7]),
      VERIFIED: row[8] === true || String(row[8]).toUpperCase() === 'TRUE',
      DATE_OF_VERIFICATION: safeDate(row[9]),
      comments: String(row[10] || ''),
      Reciever_details: String(row[11] || ''),
      reciever_contact_info: String(row[12] || ''),
      recieved: String(row[13] || '')
    }));

    if (!filters) return results;

    const { fromDate, toDate, verifiedStatus, applicantId, licenseNo } = filters;

    if (verifiedStatus === 'true') results = results.filter(r => r.VERIFIED === true);
    else if (verifiedStatus === 'false') results = results.filter(r => r.VERIFIED === false);

    if (fromDate || toDate) {
      const start = fromDate ? new Date(fromDate).setHours(0,0,0,0) : null;
      const end = toDate ? new Date(toDate).setHours(23,59,59,999) : null;

      results = results.filter(r => {
        let dateValue = verifiedStatus === 'true' ? r.DATE_OF_VERIFICATION : r.SENT_DATE;
        if (!dateValue) return false;
        const time = new Date(dateValue).getTime();
        if (isNaN(time)) return false;
        if (start && time < start) return false;
        if (end && time > end) return false;
        return true;
      });
    }

    if (applicantId) results = results.filter(r => r.applicant_ID.toLowerCase().includes(applicantId.toLowerCase().trim()));
    if (licenseNo) results = results.filter(r => r.DRIVING_LICENSE_NO.toLowerCase().includes(licenseNo.toLowerCase().trim()));

    results.sort((a,b) => {
      const aTime = a.SENT_DATE ? new Date(a.SENT_DATE).getTime() : 0;
      const bTime = b.SENT_DATE ? new Date(b.SENT_DATE).getTime() : 0;
      return bTime - aTime;
    });

    Logger.log("Final filtered result count: " + results.length);
    return results;
  } catch(err) {
    console.error("getAllReportData failed:", err);
    return [];
  }
}









// ==========================
// Verification Page
// ==========================
function verifyApplication(data) {
  const sheet = MySheets.getSheetByName('data');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const idColIndex = headers.indexOf("applicant.ID.");
  const verifiedColIndex = headers.indexOf("VERIFIED");
  const verifiedByColIndex = headers.indexOf("VERIFIED BY");
  const dateVerifiedColIndex = headers.indexOf("DATE OF VERIFICATION");
  const timestampColIndex = headers.indexOf("VERIFICATION TIMESTAMP");
  const commentsColIndex = headers.indexOf("COMMENTS");

  if (idColIndex === -1) throw new Error("Critical Error: Column 'applicant.ID.' not found.");

  const rowIndex = values.findIndex(r => String(r[idColIndex]) === String(data.applicantID));
  if (rowIndex === -1) throw new Error("Record not found for Applicant ID: " + data.applicantID);

  const rowNumber = rowIndex + 1;
  const currentRow = values[rowIndex];

  const existingStatus = String(currentRow[verifiedColIndex]).toUpperCase();
  if (existingStatus === "TRUE") throw new Error("Access Denied: This application is already verified and cannot be modified.");

  const updates = {
    "VERIFIED": "TRUE",
    "verified by": data.verifiedBy,
    "DATE OF VERIFICATION": data.dateOfVerification,
    "COMMENTS": data.comments
  };

  for (let key in updates) {
    let colIndex = headers.indexOf(key) + 1;
    if (colIndex > 0) {
      sheet.getRange(rowNumber, colIndex).setValue(updates[key]);
    }
  }

  return "Verification Successful";
}





// ==========================
// Search for verification
// ==========================
function getReportsDataverify(term, by) {
  try {
    const sheet = MySheets.getSheetByName("data");
    if (!sheet) throw new Error("Sheet 'data' not found");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    const allData = dataRows.map(row => {
      const obj = {};
      headers.forEach((h,i) => obj[h.trim()] = row[i]);
      return {
        applicantId: String(obj["applicant.ID."] || ''),
        surname: obj["SURNAME"] || '',
        givenName: obj["GIVEN_NAME"] || '',
        contactNo: String(obj["CONTACT_NO"] || ''),
        licenseNo: String(obj["DRIVING_LICENSE_NO"] || ''),
        category: obj["CATEGORY"] || '',
        sentDate: obj["SENT DATE"] instanceof Date ? obj["SENT DATE"].toISOString().slice(0,10) : String(obj["SENT DATE"] || ''),
        verified: obj["VERIFIED"] === true || String(obj["VERIFIED"]).toUpperCase() === 'TRUE',
        dateOfVerification: obj["DATE OF VERIFICATION"] instanceof Date ? obj["DATE OF VERIFICATION"].toISOString().slice(0,10) : String(obj["DATE OF VERIFICATION"] || ''),
        comments: String(obj["comments"] || ''),
        verifiedBy: String(obj["VERIFIED BY"] || '')
      };
    });

    term = String(term || '').trim().toLowerCase();
    const filtered = allData.filter(r => {
      if (by === "applicant") return String(r.applicantId).trim().toLowerCase() === term;
      if (by === "license") return String(r.licenseNo).trim().toLowerCase() === term;
      return false;
    });

    Logger.log("Filtered results count: " + filtered.length);
    return filtered;

  } catch(e) {
    Logger.log("Error in getReportsDataverify: " + e.message);
    return [];
  }
}



function testVerifySearch() {
  const testApplicantId = '2872022';
  const testLicenseNo   = '01-01-00745893';

  Logger.log("=== Testing by Applicant ID ===");
  let results = getReportsDataverify(testApplicantId, 'applicant');
  Logger.log(results);

  Logger.log("=== Testing by License No ===");
  results = getReportsDataverify(testLicenseNo, 'license');
  Logger.log(results);
}


///FOR EDIT PAGE//


/**
 * Updates an existing record in the "data" sheet
 * based on applicant ID and provided form data.
 */
function saveEditedRecord(data) {
  const sheet = MySheets.getSheetByName('data'); // Your data sheet
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  // Find the row by applicant ID
  const idColIndex = headers.indexOf("applicant.ID.");
  if (idColIndex === -1) throw new Error("Column 'applicant.ID.' not found in sheet.");

  const rowIndex = values.findIndex(r => String(r[idColIndex]) === String(data.applicantID));
  if (rowIndex === -1) throw new Error("Applicant ID not found in database.");

  const rowNumber = rowIndex + 1;

  // Map your form fields to the sheet columns
  const fieldMapping = {
    "surname": "SURNAME",
    "givenName": "GIVEN_NAME",
    "contactNo": "CONTACT_NO",
    "licenseNo": "DRIVING_LICENSE_NO",
    "category": "CATEGORY",
    "sentDate": "SENT DATE",
    "verified": "VERIFIED",
    "dateOfVerification": "DATE OF VERIFICATION",
    "comments": "comments",
    "receiverDetails": "Reciever details",
    "receiverContact": "reciever_contact_info",
    "receivedDate": "recieved"
  };

  // Loop through each mapping and update the sheet
  for (let key in fieldMapping) {
    const colName = fieldMapping[key];
    const colIndex = headers.indexOf(colName);
    if (colIndex > -1) {
      let value = data[key];

      // Optional: convert verified to TRUE/FALSE
      if (key === "verified") {
        value = (String(value).toUpperCase() === 'TRUE');
      }

      sheet.getRange(rowNumber, colIndex + 1).setValue(value);
    }
  }

  return "Record updated successfully";
}





