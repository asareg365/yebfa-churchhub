/**
 * Standardizes Ghana phone numbers to 233XXXXXXXXX format required by mNotify
 * @param {string} phone 
 * @returns {string}
 */
function formatPhone(phone) {
  if (!phone) return "";
  
  // Remove all non-digits (including +)
  let cleaned = phone.replace(/\D/g, "");

  // Handle local format (024...)
  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.substring(1);
  }

  // Ensure it starts with 233 if it's 9 digits (244XXXXXX -> 233244XXXXXX)
  if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }

  return cleaned;
}

module.exports = { formatPhone };
