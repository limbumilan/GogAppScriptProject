function LoginCheck(uid, password) {
  const matches = LoginSheet
    .getRange("A:A")
    .createTextFinder(uid)
    .matchEntireCell(true)
    .findAll();

  if (!matches.length) return false;

  const row = matches[0].getRow();
  const savedPass = LoginSheet.getRange(row, 2).getValue();

  if (savedPass === password) {
    PropertiesService.getUserProperties().setProperty('LOGGED_IN', 'true');
    return true;
  }
  return false;
}

//======================================================================================================






function logout() {
  PropertiesService.getUserProperties().deleteProperty('LOGGED_IN');
  // return login page URL for redirection
  return ScriptApp.getService().getUrl() + "?v=login";
}


// Load dashboard data
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

// Logout function
function logout() {
  PropertiesService.getUserProperties().deleteProperty('LOGGED_IN');
  return ScriptApp.getService().getUrl() + '?v=login';
}

function testGetData() {
  const ss = SpreadsheetApp.openByUrl(url);
  const sheet = ss.getSheetByName("data");
  const values = sheet.getDataRange().getValues();
  Logger.log(values);  // Check if rows are loaded
  return values.slice(0,5); // Return first 5 rows to test
}



// Example JS for nav buttons



function toggleEntrySubmenu() {
  const submenu = document.getElementById('entrySubmenu');

  if(submenu.style.display === 'none' || submenu.style.display === '') {
    // Show submenu
    submenu.style.display = 'flex';
    submenu.style.flexDirection = 'column';

    // Switch main content to Entry tab
    showTab('entryTab');

    // Show default sub-tab content
    showEntrySubTab('addNew');
  } else {
    // Collapse submenu
    submenu.style.display = 'none';
  }
}
