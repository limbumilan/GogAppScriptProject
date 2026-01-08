// Entry point: serve pages based on URL parameter
webAppUrl = ScriptApp.getService().getUrl();

var url="https://docs.google.com/spreadsheets/d/1VClSH5bguIh0g_TkbfGh6Qbt3KXrl4eBVg5yc2kwyuM/edit?gid=0#gid=0";
var Route= {};

Route.path= function(route,callback){
  Route[route]= callback;

}


let MySheets  = SpreadsheetApp.openByUrl(url);
let LoginSheet  = MySheets.getSheetByName("user"); 



function doGet(e) {
  
  const loggedIn = PropertiesService.getUserProperties().getProperty('LOGGED_IN') === 'true';
  
  if(e.parameter.v == "login"){
    return loadlogin();
  }
  if (e.parameter.v=="dashboard"){
    if (!loggedIn) {
      return HtmlService.createHtmlOutput('<h3>Unauthorized</h3><a href="?v=login">Login</a>');
    }
    return loaddashboard (); } 

  else {
    return loadabout();

  }
//page loader function==================================================================================   

  function loadPage(pageName) {
  return HtmlService.createHtmlOutputFromFile(pageName).getContent();
}
function loadPage(page, event) {
  event.stopPropagation();

  google.script.run
    .withSuccessHandler(function(html) {
      document.getElementById('main-content').innerHTML = html;
    })
    .loadPage(page);
}

function loadPage(page) {
  return HtmlService.createHtmlOutputFromFile(page).getContent();
}


//==================================================================================

}
function getDashboardData() {
  const ss = SpreadsheetApp.openByUrl(url);
  const sheet = ss.getSheetByName("data");
  const values = sheet.getDataRange().getValues();

  const dataRows = values.slice(4); // skip headers

  let totalRecords = dataRows.length;
  let categories = {};              // Category counts
  let verifiedCategory = {};        // Verified vs Not Verified per category
  let dateCounts = {};              // Applications over time
  let table = [];                   // Table rows

  dataRows.forEach(row => {
    const surname = row[2] || '';
    const givenName = row[3] || '';
    const contact = row[4] || '';
    const categoryStr = row[6] || '';
    const sentDate = row[7] || '';
    const verified = row[8] === true || row[8] === 'TRUE';

    // --- Categories ---
    if (categoryStr) {
      categoryStr.split(',').forEach(cat => {
        cat = cat.trim();
        // Count per category
        categories[cat] = (categories[cat] || 0) + 1;

        // Verified vs Not Verified per category
        if (!verifiedCategory[cat]) verifiedCategory[cat] = {verified:0, notVerified:0};
        if (verified) verifiedCategory[cat].verified += 1;
        else verifiedCategory[cat].notVerified += 1;
      });
    }

    // --- Applications over time ---
    if (sentDate) {
      dateCounts[sentDate] = (dateCounts[sentDate] || 0) + 1;
    }

    // --- Table ---
    table.push([
      sentDate,
      surname + ' ' + givenName,
      categoryStr,
      contact,
      verified ? 'Yes' : 'No'
    ]);
  });
  Logger.log( table);
  return {
    totalRecords,
    categories,
    verifiedCategory,
    dateCounts,
    table
  };

}



function loadlogin (){
  const t = HtmlService.createTemplateFromFile("login");
  t.webAppUrl = ScriptApp.getService().getUrl();
  t.appName = "My App";
  return t.evaluate();
  
//return HtmlService.createTemplateFromFile("login").evaluate();

}


function loadabout()
{
   const t = HtmlService.createTemplateFromFile("about");
  t.appName = "My App";
  return t.evaluate();
  
}

function loaddashboard(){
  const d = HtmlService.createTemplateFromFile("dashboard");
  d.appName = "My dash";
  
  d.webAppUrl = ScriptApp.getService().getUrl();

  return d
    .evaluate()
    .setTitle("Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}





function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


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



function parseDate(dateValue) {
  if (!dateValue) return '';
  
  // If it’s already a Date object
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  // If it’s a string like "26/11/2025"
  const parts = dateValue.toString().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${day}/${month}/${year}`;
  }

  return dateValue; // fallback: return as-is
}






function getReportsData(searchTerm = '', searchBy = '') {
  try {
    const sheet = MySheets.getSheetByName("data");
    if (!sheet) throw new Error('Sheet "data" not found');

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; // only header exists

    const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    let results = rows.map(r => ({
      applicantId: r[1] || '',
      surname: r[2] || '',
      givenName: r[3] || '',
      contactNo: r[4] || '',
      licenseNo: r[5] || '',
      category: r[6] || '',
      sentDate: parseDate(r[7]),
      verified: r[8] === true || r[8] === 'TRUE',
      dateOfVerification: parseDate(r[9]),
      comments: r[10] || '',
      receiverDetails: r[11] || '',
      receiverContactInfo: r[12] || '',
      receivedDate: parseDate(r[13])
    }));

    if (searchTerm && searchBy) {
      const term = searchTerm.toString().toLowerCase();
      if (searchBy === 'applicant') {
        results = results.filter(r => r.applicantId.toString().toLowerCase().includes(term));
      }
      if (searchBy === 'license') {
        results = results.filter(r => r.licenseNo.toString().toLowerCase().includes(term));
      }
    }

    return results;
  } catch (err) {
    Logger.log('Error in getReportsData: ' + err.message);
    return [];
  }
}
