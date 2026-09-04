/* PM_REGISTRY — feature discovery over PM_DATA. */
var PM_REGISTRY = (function (data, manifest) {
  'use strict';
  var definitions = {};
  var active = [];

  data.categories.forEach(function (category) {
    category.cards.forEach(function (card) {
      definitions[card.id] = card;
    });
  });

  manifest.forEach(function (feature) {
    if (definitions[feature.id]) {
      active.push({
        id: feature.id,
        category: feature.category,
        kind: feature.kind,
        instrumentFamily: feature.instrumentFamily,
        definition: definitions[feature.id]
      });
    }
  });

  function get(id) {
    var hit = null;
    active.some(function (feature) {
      if (feature.id !== id) return false;
      hit = feature;
      return true;
    });
    return hit;
  }

  function familyForCategory(id) {
    var family = 'control-room';
    active.some(function (feature) {
      if (feature.category !== id) return false;
      family = feature.instrumentFamily;
      return true;
    });
    return family;
  }

  return {
    data: function () { return data; },
    get: get,
    list: function () { return active.slice(); },
    familyForCategory: familyForCategory
  };
}(PM_DATA, __FEATURE_MANIFEST__));
if (typeof window !== 'undefined') window.PM_REGISTRY = PM_REGISTRY;
if (typeof module !== 'undefined' && module.exports) module.exports = PM_REGISTRY;
