// Quoten-Pruefung deaktiviert – keine Einschraenkungen
async function checkQuota(userId, fishSpecies, kept) {
  return { exceeded: false };
}

module.exports = { checkQuota };
