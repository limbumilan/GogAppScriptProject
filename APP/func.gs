// Global Variables





// LOGIN LOGIC
function LoginCheck(uid, password) {
  if (!LoginSheet) return { success: false, message: "USER sheet not found" };
  const data = LoginSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const sheetUser = String(data[i][0]).trim();
    const sheetPass = String(data[i][1]).trim();
    const sheetRole = String(data[i][2]).trim().toUpperCase();

    if (sheetUser === String(uid).trim() && sheetPass === String(password).trim()) {
      const props = PropertiesService.getUserProperties();
      props.setProperty('USERNAME', sheetUser);
      props.setProperty('USER_ROLE', sheetRole);
      return { success: true, role: sheetRole };
    }
  }
  return { success: false };
}

// SESSION LOGIC
function getUserSession() {
  const props = PropertiesService.getUserProperties();
  return {
    username: props.getProperty('USERNAME') || "Unknown",
    role: (props.getProperty('USER_ROLE') || "GUEST").toUpperCase()
  };
}

// PASSWORD LOGIC
function updateUserPassword(newPass) {
  const uid = PropertiesService.getUserProperties().getProperty('USERNAME');
  if (!uid) throw new Error("No active session");

  const data = LoginSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === uid) {
      LoginSheet.getRange(i + 1, 2).setValue(newPass); // Column B
      return true;
    }
  }
  throw new Error("User not found in database");
}
