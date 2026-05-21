/**
 * Simple template parser for SMS personalization.
 * Replaces {{key}} with values from the variables object.
 */
function parseTemplate(template, variables) {
  if (!template) return "";
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const value = variables[key.trim()];
    return value !== undefined ? value : "";
  });
}

module.exports = { parseTemplate };
