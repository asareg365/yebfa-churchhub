/**
 * Standardizes Ghana phone numbers to 233XXXXXXXXX format
 * @param {string} phone 
 * @returns {string}
 */
function formatPhone(phone) {
  if (!phone) return "";
  
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, "");

  // Handle 024... format
  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.substring(1);
  }

  // Handle +233... format (already cleaned to 233...)
  // Ensure it starts with 233
  if (!cleaned.startsWith("233") && cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }

  return cleaned;
}

module.exports = { formatPhone };
