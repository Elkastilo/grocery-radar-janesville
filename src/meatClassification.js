"use strict";

const BEEF_CUTS = [
  [/\bbottom round\b/i, "Bottom Round"],
  [/\btop round\b/i, "Top Round"],
  [/\beye of round\b/i, "Eye of Round"],
  [/\bsirloin tip\b/i, "Sirloin Tip"],
  [/\btop sirloin\b/i, "Top Sirloin"],
  [/\bpetite sirloin\b/i, "Petite Sirloin"],
  [/\b(?:chuck|blade) (?:roast|steak)\b/i, "Chuck"],
  [/\brump\b/i, "Rump"],
  [/\brib[ -]?eye\b/i, "Ribeye"],
  [/\b(?:new york strip|strip steak)\b/i, "New York Strip"],
  [/\bfilet mignon\b/i, "Filet Mignon"],
  [/\bbrisket\b/i, "Brisket"],
  [/\bshort ribs?\b/i, "Short Ribs"],
  [/\bflank steak\b/i, "Flank"],
  [/\bskirt steak\b/i, "Skirt"]
];

const POULTRY_CUTS = [
  [/\bbreasts?\b/i, "Breast"],
  [/\bthighs?\b/i, "Thigh"],
  [/\bdrumsticks?\b/i, "Drumstick"],
  [/\bwings?\b/i, "Wing"],
  [/\b(?:leg quarters?|quarters?)\b/i, "Leg Quarter"],
  [/\bsplit legs?\b|\blegs?\b/i, "Leg"],
  [/\btenderloins?\b|\btenders?\b/i, "Tenderloin"]
];

const LOIN_CUTS = [
  [/\btenderloins?\b/i, "Tenderloin"],
  [/\bloins?\b/i, "Loin"]
];

const CUTS_BY_ANIMAL = {
  Beef: [...BEEF_CUTS, ...LOIN_CUTS],
  Bison: [...BEEF_CUTS, ...LOIN_CUTS],
  Veal: [...LOIN_CUTS, [/\bshanks?\b/i, "Shank"], [/\bcutlets?\b/i, "Cutlet"]],
  Pork: [
    ...LOIN_CUTS,
    [/\b(?:boston|pork) butt\b/i, "Boston Butt"],
    [/\bshoulder\b/i, "Shoulder"],
    [/\b(?:pork )?belly\b/i, "Belly"],
    [/\bbaby back ribs?\b/i, "Baby Back Ribs"],
    [/\b(?:spare ribs?|spareribs?)\b/i, "Spare Ribs"],
    [/\b(?:st\.? louis)\b.*\bribs?\b/i, "St. Louis Ribs"],
    [/\bham\b/i, "Ham"]
  ],
  Chicken: POULTRY_CUTS,
  Turkey: POULTRY_CUTS,
  Duck: POULTRY_CUTS,
  Lamb: [
    ...LOIN_CUTS,
    [/\brack\b/i, "Rack"],
    [/\bshanks?\b/i, "Shank"],
    [/\bshoulder\b/i, "Shoulder"],
    [/\bleg\b/i, "Leg"],
    [/\brib chops?\b/i, "Rib"]
  ]
};

const LIVESTOCK = [
  [/\b(?:beef|angus)\b/i, "Beef"], [/\bbison\b/i, "Bison"], [/\bveal\b/i, "Veal"],
  [/\bpork\b/i, "Pork"], [/\bchicken\b/i, "Chicken"],
  [/\bturkey\b/i, "Turkey"], [/\blamb\b/i, "Lamb"], [/\bduck\b/i, "Duck"]
];

const SEAFOOD = [
  [/\bsalmon\b/i, "Salmon"], [/\btuna\b/i, "Tuna"], [/\bcod\b/i, "Cod"],
  [/\btilapia\b/i, "Tilapia"], [/\btrout\b/i, "Trout"], [/\bhalibut\b/i, "Halibut"],
  [/\bmahi[ -]mahi\b/i, "Mahi Mahi"], [/\bcatfish\b/i, "Catfish"], [/\bshrimp\b/i, "Shrimp"],
  [/\bcrab\b/i, "Crab"], [/\blobster\b/i, "Lobster"], [/\bscallops?\b/i, "Scallops"],
  [/\bmussels?\b/i, "Mussels"], [/\bclams?\b/i, "Clams"], [/\boysters?\b/i, "Oysters"]
];

const SEAFOOD_CUTS = [
  [/\b(?:center|centre)[ -]cut\b/i, "Center Cut"],
  [/\btails?\b/i, "Tail"],
  [/\bclaws?\b/i, "Claw"],
  [/\blegs?\b/i, "Leg"],
  [/\b(?:peeled(?:\s+and)?[ ,]+deveined)\b/i, "Peeled & Deveined"],
  [/\bshell[ -]on\b/i, "Shell-On"]
];

function matchingLabel(rules, title) {
  return rules.find(([pattern]) => pattern.test(title))?.[1] || "";
}

function classifyMeat(name) {
  const title = String(name || "");
  if (/\b(?:plant[ -]based|vegan|vegetarian|seasoning|sauce|gravy|soup|dinner|pizza|sandwich|imitation)\b/i.test(title)) return null;

  const animals = [...LIVESTOCK, ...SEAFOOD].filter(([pattern]) => pattern.test(title));
  if (animals.length > 1) return null;

  let animal = animals[0]?.[1] || "";
  const isSeafood = SEAFOOD.some(([, label]) => label === animal) || (!animal && /\bseafood\b/i.test(title));
  if (!animal && isSeafood) animal = "Seafood";
  if (!animal && /\b(?:bacon|ham)\b/i.test(title)) animal = "Pork";
  if (!animal && matchingLabel(BEEF_CUTS, title)) animal = "Beef";
  if (!animal) return null;

  const cut = matchingLabel(isSeafood ? SEAFOOD_CUTS : CUTS_BY_ANIMAL[animal] || [], title);
  const type = matchingLabel([
    [/\b(?:deli|sliced)\b.*\broast beef\b|\broast beef\b.*\b(?:deli|sliced)\b/i, "Deli Roast Beef"],
    [/\bground beef\b/i, "Ground Beef"],
    [/\bground\b/i, "Ground Meat"],
    [/\bsteaks?\b/i, "Steaks"],
    [/\broasts?\b/i, "Roasts"],
    [/\bchops?\b/i, "Chops"],
    [/\b(?:fillets?|filets?)\b/i, "Fillets"],
    [/\bsausages?\b/i, "Sausages"],
    [/\bribs?\b/i, "Ribs"],
    [/\bbacon\b/i, "Bacon"],
    [/\bwhole\b/i, "Whole"],
    [/\bcutlets?\b/i, "Cutlets"],
    [/\b(?:wings?|breasts?|thighs?|drumsticks?|leg quarters?|tenders?|tenderloins?)\b/i, "Cuts"]
  ], title);
  return { animal, type: type || (cut ? "Cuts" : ""), cut };
}

module.exports = { classifyMeat };
