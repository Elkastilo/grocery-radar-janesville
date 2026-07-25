const categories = [
  "meat",
  "dairy",
  "produce",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "bakery",
  "household",
  "personal care",
  "baby",
  "pet",
  "other"
];

const proofLabels = {
  receipt: "Receipt",
  shelf_tag: "Shelf tag",
  store_page: "Store page / source link",
  shelf_tag_photo: "Shelf tag photo",
  receipt_photo: "Receipt photo",
  weekly_ad: "Weekly ad",
  no_photo: "No photo"
};

const actionLabels = {
  submit_typed_price: "Submitted typed price",
  submit_shelf_tag_photo: "Submitted shelf tag proof",
  submit_receipt_photo: "Submitted receipt proof",
  submit_weekly_ad: "Submitted weekly ad deal",
  verify_another_price: "Verified another price",
  submitted_price_verified_bonus: "Submitted price verified",
  high_confidence_bonus: "High confidence bonus",
  wrong_fake_report_penalty: "Wrong/fake report penalty",
  proof_accepted_reviewable: "Proof accepted for review",
  proof_used_for_approved_price: "Proof used for approved price",
  approved_price_from_proof: "Proof used for approved price",
  approved_weekly_ad_deal: "Proof used for approved price",
  approved_receipt_item: "Proof used for approved price",
  proof_source_link_bonus: "Source link bonus",
  proof_clear_photo_bonus: "Clear proof photo bonus",
  duplicate_confirmation: "Duplicate confirmation",
  admin_reset_points: "Admin points reset"
};

function notificationMessage(notification = {}) {
  const message = notification.message || "";
  return Number(notification.points_awarded) === 1
    ? message.replace(/\b1 points\b/g, "1 point")
    : message;
}

const searchForm = document.querySelector("#searchForm");
const submitForm = document.querySelector("#submitForm");
const registerForm = document.querySelector("#registerForm");
const loginForm = document.querySelector("#loginForm");
const changePasswordForm = document.querySelector("#changePasswordForm");
const avoidIngredientsForm = document.querySelector("#avoidIngredientsForm");
const logoutButton = document.querySelector("#logoutButton");
const accountMessage = document.querySelector("#accountMessage");
const changePasswordMessage = document.querySelector("#changePasswordMessage");
const avoidIngredientsMessage = document.querySelector("#avoidIngredientsMessage");
const avoidIngredientsInput = document.querySelector("#avoidIngredientsInput");
const avoidIngredientChips = document.querySelector("#avoidIngredientChips");
const signedOutAccount = document.querySelector("#signedOutAccount");
const currentUserPanel = document.querySelector("#currentUserPanel");
const currentUserBadge = document.querySelector("#currentUserBadge");
const notificationBell = document.querySelector("#notificationBell");
const notificationCountBadge = document.querySelector("#notificationCountBadge");
const currentUserDetails = document.querySelector("#currentUserDetails");
const emailVerificationPanel = document.querySelector("#emailVerificationPanel");
const accountActivityPanel = document.querySelector("#accountActivityPanel");
const accountActivityContent = document.querySelector("#accountActivityContent");
const accountUnreadCount = document.querySelector("#accountUnreadCount");
const adminAlertBadge = document.querySelector("#adminAlertBadge");
const adminReviewLink = document.querySelector("#adminReviewLink");
const adminSettingsTools = document.querySelector("#adminSettingsTools");
const cartCountBadge = document.querySelector("#cartCountBadge");
const cartPageCount = document.querySelector("#cartPageCount");
const cartSubtitle = document.querySelector("#cartSubtitle");
const cartEstimatedTotal = document.querySelector("#cartEstimatedTotal");
const cartEstimateRange = document.querySelector("#cartEstimateRange");
const cartToast = document.querySelector("#cartToast");
const submitLoginNotice = document.querySelector("#submitLoginNotice");
const proofTypeSelect = document.querySelector("#proofTypeSelect");
const proofPhotoField = document.querySelector("#proofPhotoField");
const proofPhotoInput = document.querySelector("#proofPhotoInput");
const proofPhotoRequirement = document.querySelector("#proofPhotoRequirement");
const proofPhotoStatus = document.querySelector("#proofPhotoStatus");
const submitSuccessActions = document.querySelector("#submitSuccessActions");
const suggestedSizeWrap = document.querySelector("#suggestedSizeWrap");
const suggestedSizeButtons = document.querySelector("#suggestedSizeButtons");
const genericSizeButtons = document.querySelector("#genericSizeButtons");
const placeholderVariantWrap = document.querySelector("#placeholderVariantWrap");
const placeholderVariantButtons = document.querySelector("#placeholderVariantButtons");
const quickItemGroups = document.querySelector("#quickItemGroups");
const quickItemButtons = document.querySelector("#quickItemButtons");
const showStoreRequestButton = document.querySelector("#showStoreRequestButton");
const storeRequestBox = document.querySelector("#storeRequestBox");
const storeRequestFields = document.querySelector("#storeRequestFields");
const storeRequestSubmitButton = document.querySelector("#storeRequestSubmitButton");
const storeRequestMessage = document.querySelector("#storeRequestMessage");
const suggestionForm = document.querySelector("#suggestionForm");
const suggestionMessage = document.querySelector("#suggestionMessage");
const cartAddForm = document.querySelector("#cartAddForm");
const cartAddDetails = document.querySelector("#cartAddDetails");
const cartAddToggle = document.querySelector("#cartAddToggle");
const cartCategory = document.querySelector("#cartCategory");
const cartMessage = document.querySelector("#cartMessage");
const cartAvoidReminder = document.querySelector("#cartAvoidReminder");
const cartItemsList = document.querySelector("#cartItemsList");
const cartComparison = document.querySelector("#cartComparison");
const compareCartButton = document.querySelector("#compareCartButton");
const cartCompareMode = document.querySelector("#cartCompareMode");
const cartModeSegments = document.querySelector("#cartModeSegments");
const cartCompareHint = document.querySelector("#cartCompareHint");
const clearCartButton = document.querySelector("#clearCartButton");
const searchSponsorSlot = document.querySelector("#searchSponsorSlot");
const cartSponsorSlot = document.querySelector("#cartSponsorSlot");
const productSponsorSlot = document.querySelector("#productSponsorSlot");
const resultsList = document.querySelector("#resultsList");
const resultsSummary = document.querySelector("#resultsSummary");
const browsePanel = document.querySelector("#browsePanel");
const productDetailContent = document.querySelector("#productDetailContent");
const backToSearchButton = document.querySelector("#backToSearchButton");
const submitProductId = document.querySelector("#submitProductId");
const selectedProductPanel = document.querySelector("#selectedProductPanel");
const productSearchInput = document.querySelector("#productSearchInput");
const productSearchButton = document.querySelector("#productSearchButton");
const productSearchResults = document.querySelector("#productSearchResults");
const submitMessage = document.querySelector("#submitMessage");
const submitReviewCard = document.querySelector("#submitReviewCard");
const profileCard = document.querySelector("#profileCard");
const rewardRules = document.querySelector("#rewardRules");
const leaderboardList = document.querySelector("#leaderboardList");
const verifyDialog = document.querySelector("#verifyDialog");
const verifyForm = document.querySelector("#verifyForm");
const verifyMessage = document.querySelector("#verifyMessage");
const verifyReportId = document.querySelector("#verifyReportId");

let currentUser = null;
let lastSubmitContext = null;
let selectedSubmitProduct = null;
let selectedSubmitPlaceholder = null;
let currentCartItems = [];
let currentNotifications = [];
let currentReports = [];
let currentVerifications = [];
let activeAccountSection = "notifications";
let activePublicTab = "home";
let activeSubmitStep = "store";
let activeQuickItemGroup = "Food Basics";
let quickItemLimit = 12;
let cartReminderHidden = false;

document.body.dataset.publicTab = activePublicTab;

const commonAvoidIngredients = [
  "peanuts",
  "tree nuts",
  "milk",
  "eggs",
  "soy",
  "wheat",
  "gluten",
  "sesame",
  "shellfish",
  "fish",
  "red dye",
  "artificial sweeteners"
];

const browseCategoryGroups = [
  { key: "food_basics", label: "Food", categories: ["dairy", "produce", "pantry", "bakery"] },
  { key: "meat_protein", label: "Meat", categories: ["meat"] },
  { key: "drinks", label: "Drinks", categories: ["drinks"] },
  { key: "frozen", label: "Frozen", categories: ["frozen"] },
  { key: "household", label: "Household", categories: ["household"] },
  { key: "bathroom_personal_care", label: "Bathroom", categories: ["personal care"] },
  { key: "pets", label: "Pets", categories: ["pet"] },
  { key: "baby", label: "Baby", categories: ["baby"] },
  { key: "cleaning", label: "Cleaning", categories: ["household"] }
];

const browseCategoryMeta = {
  food_basics: { icon: "🥚", helper: "eggs, milk, bread, rice" },
  meat_protein: { icon: "🥩", helper: "beef, chicken, tuna" },
  drinks: { icon: "🥤", helper: "water, juice, coffee" },
  frozen: { icon: "🧊", helper: "pizza, vegetables, ice cream" },
  household: { icon: "🧻", helper: "paper towels, trash bags, soap" },
  bathroom_personal_care: { icon: "🧴", helper: "shampoo, lotion, toothpaste" },
  pets: { icon: "🐾", helper: "dog food, cat food, litter" },
  baby: { icon: "🍼", helper: "diapers, wipes, formula" },
  cleaning: { icon: "🧼", helper: "spray, wipes, floor cleaner" }
};

function categoryIcon(category = "") {
  const normalized = String(category || "").toLowerCase();
  const icons = {
    meat: "🥩",
    dairy: "🥛",
    produce: "🥬",
    pantry: "🥫",
    frozen: "❄",
    drinks: "🥤",
    snacks: "🥨",
    bakery: "🍞",
    household: "🧻",
    "personal care": "🧴",
    baby: "🍼",
    pet: "🐾",
    other: "🛒"
  };
  return icons[normalized] || "🛒";
}

function productIcon(name = "", category = "") {
  const normalized = String(name || "").toLowerCase();
  const itemIcons = [
    [["egg"], "🥚"],
    [["milk"], "🥛"],
    [["cheese"], "🧀"],
    [["butter"], "🧈"],
    [["yogurt"], "🥣"],
    [["bread", "bun", "rolls"], "🍞"],
    [["apple"], "🍎"],
    [["banana"], "🍌"],
    [["orange", "clementine", "mandarin"], "🍊"],
    [["lemon"], "🍋"],
    [["lime"], "🟢"],
    [["grape"], "🍇"],
    [["strawberr"], "🍓"],
    [["avocado"], "🥑"],
    [["potato"], "🥔"],
    [["onion"], "🧅"],
    [["tomato"], "🍅"],
    [["carrot"], "🥕"],
    [["lettuce", "salad"], "🥬"],
    [["ground beef", "steak", "beef"], "🥩"],
    [["chicken", "turkey"], "🍗"],
    [["bacon"], "🥓"],
    [["hot dog", "brat", "sausage"], "🌭"],
    [["tuna", "salmon", "fish"], "🐟"],
    [["tofu"], "◻"],
    [["rice"], "🍚"],
    [["bean"], "🫘"],
    [["pasta", "spaghetti"], "🍝"],
    [["cereal", "oatmeal"], "🥣"],
    [["peanut butter", "jelly", "jam"], "🥜"],
    [["tortilla"], "🫓"],
    [["pizza"], "🍕"],
    [["ice cream"], "🍨"],
    [["frozen vegetable"], "🥦"],
    [["water"], "💧"],
    [["juice"], "🧃"],
    [["soda", "sports drink"], "🥤"],
    [["coffee"], "☕"],
    [["tea"], "🍵"],
    [["toilet paper"], "🧻"],
    [["paper towel"], "🧻"],
    [["trash bag"], "🗑"],
    [["laundry detergent"], "🧺"],
    [["dish soap", "hand soap", "bar soap", "body wash"], "🧼"],
    [["cleaner", "bleach", "disinfect"], "🧽"],
    [["shampoo", "conditioner", "lotion"], "🧴"],
    [["toothpaste", "toothbrush"], "🪥"],
    [["razor", "shaving"], "🪒"],
    [["diaper"], "👶"],
    [["baby wipe", "formula", "baby food"], "🍼"],
    [["dog"], "🐕"],
    [["cat litter"], "🐈"],
    [["cat food", "cat treat"], "🐈"],
    [["pet treat"], "🐾"]
  ];

  const match = itemIcons.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  return match ? match[1] : categoryIcon(category);
}

const cartModeHelp = {
  cheapest_split: "Cheapest split saves the most money, but may require more stops.",
  best_one_store: "Best one-store trip is easier, but may cost more.",
  best_balance: "Best balance tries to save money without sending you everywhere.",
  high_confidence: "High-confidence only favors prices with stronger shopper proof.",
  avoid_list_careful: "Avoid-list careful mode keeps label-check reminders close by."
};

const cartCompareModes = ["cheapest_split", "best_one_store", "best_balance", "high_confidence"];

const quickGroupLabels = {
  "Food Basics": "Food",
  Meat: "Meat",
  Drinks: "Drinks",
  Frozen: "Frozen",
  Household: "Household",
  Bathroom: "Bathroom",
  Pets: "Pets",
  Baby: "Baby",
  Cleaning: "Cleaning",
  Custom: "Custom"
};

const productPlaceholders = [
  {
    id: "apples",
    name: "Apples",
    category: "produce",
    groups: ["food_basics"],
    variants: ["Any apples", "Gala apples", "Fuji apples", "Honeycrisp apples", "Granny Smith apples", "Red Delicious apples", "Pink Lady apples", "bagged apples", "loose apples"],
    sizes: ["per lb", "3 lb bag", "5 lb bag"],
    aliases: ["apple", "apples", "fresh apples"]
  },
  { id: "bananas", name: "Bananas", category: "produce", groups: ["food_basics"], variants: ["Any bananas", "yellow bananas", "organic bananas", "baby bananas"], sizes: ["per lb", "single", "bunch"], aliases: ["banana", "bananas", "fresh bananas"] },
  { id: "oranges", name: "Oranges", category: "produce", groups: ["food_basics"], variants: ["Any oranges", "navel oranges", "mandarin oranges", "clementines", "blood oranges"], sizes: ["per lb", "3 lb bag", "5 lb bag"], aliases: ["orange", "oranges", "clementines", "mandarins"] },
  { id: "potatoes", name: "Potatoes", category: "produce", groups: ["food_basics"], variants: ["Any potatoes", "russet potatoes", "red potatoes", "gold potatoes", "sweet potatoes"], sizes: ["per lb", "5 lb bag", "10 lb bag"], aliases: ["potato", "potatoes", "sweet potato"] },
  { id: "onions", name: "Onions", category: "produce", groups: ["food_basics"], variants: ["Any onions", "yellow onions", "white onions", "red onions", "sweet onion"], sizes: ["per lb", "3 lb bag", "5 lb bag"], aliases: ["onion", "onions", "sweet onions"] },
  { id: "tomatoes", name: "Tomatoes", category: "produce", groups: ["food_basics"], variants: ["Any tomatoes", "roma tomatoes", "vine tomatoes", "cherry tomatoes", "grape tomatoes", "beefsteak tomatoes"], sizes: ["per lb", "pint", "10 oz", "1 lb"], aliases: ["tomato", "tomatoes", "fresh tomatoes"] },
  { id: "lettuce", name: "Lettuce", category: "produce", groups: ["food_basics"], variants: ["Any lettuce", "iceberg lettuce", "romaine lettuce", "spring mix"], sizes: ["1 each", "3 pack", "5 oz", "10 oz"], aliases: ["lettuce", "romaine", "spring mix"] },
  { id: "carrots", name: "Carrots", category: "produce", groups: ["food_basics"], variants: ["Any carrots", "baby carrots", "whole carrots", "shredded carrots"], sizes: ["1 lb", "2 lb bag", "5 lb bag"], aliases: ["carrot", "carrots", "baby carrots"] },
  { id: "strawberries", name: "Strawberries", category: "produce", groups: ["food_basics"], variants: ["Any strawberries", "fresh strawberries", "organic strawberries"], sizes: ["1 lb", "2 lb"], aliases: ["strawberry", "strawberries"] },
  { id: "grapes", name: "Grapes", category: "produce", groups: ["food_basics"], variants: ["Any grapes", "red grapes", "green grapes", "black grapes"], sizes: ["per lb", "2 lb bag", "3 lb bag"], aliases: ["grape", "grapes"] },
  { id: "avocados", name: "Avocados", category: "produce", groups: ["food_basics"], variants: ["Any avocados", "single avocado", "bagged avocados"], sizes: ["single", "4 pack", "bag"], aliases: ["avocado", "avocados"] },
  { id: "lemons", name: "Lemons", category: "produce", groups: ["food_basics"], variants: ["Any lemons", "single lemon", "bagged lemons"], sizes: ["single", "2 lb bag", "bag"], aliases: ["lemon", "lemons"] },
  { id: "limes", name: "Limes", category: "produce", groups: ["food_basics"], variants: ["Any limes", "single lime", "bagged limes"], sizes: ["single", "2 lb bag", "bag"], aliases: ["lime", "limes"] },

  { id: "milk", name: "Milk", category: "dairy", groups: ["food_basics"], variants: ["Any milk", "whole milk", "2% milk", "1% milk", "skim milk", "lactose-free milk", "almond milk", "oat milk"], sizes: ["1 gallon", "1/2 gallon", "52 fl oz"], aliases: ["milk", "dairy milk", "almond milk", "oat milk"] },
  { id: "eggs", name: "Eggs", category: "dairy", groups: ["food_basics"], variants: ["Any eggs", "large white eggs", "large brown eggs", "cage-free eggs", "organic eggs"], sizes: ["12 ct", "18 ct", "24 ct"], aliases: ["egg", "eggs", "large eggs"] },
  { id: "cheese", name: "Cheese", category: "dairy", groups: ["food_basics"], variants: ["Any cheese", "shredded cheddar", "sliced American", "mozzarella", "string cheese"], sizes: ["8 oz", "12 oz", "16 oz", "24 oz"], aliases: ["cheese", "shredded cheese", "string cheese"] },
  { id: "butter", name: "Butter", category: "dairy", groups: ["food_basics"], variants: ["Any butter", "salted butter", "unsalted butter", "butter sticks", "butter spread"], sizes: ["8 oz", "1 lb", "16 oz"], aliases: ["butter", "salted butter", "unsalted butter"] },
  { id: "yogurt", name: "Yogurt", category: "dairy", groups: ["food_basics"], variants: ["Any yogurt", "Greek yogurt", "regular yogurt", "yogurt cups", "yogurt tub"], sizes: ["5.3 oz", "6 oz", "32 oz"], aliases: ["yogurt", "greek yogurt"] },

  { id: "ground-beef", name: "Ground beef", category: "meat", groups: ["meat_protein"], variants: ["Any ground beef", "80/20", "85/15", "90/10", "Lean", "Organic", "Frozen", "Family pack"], sizes: ["per lb", "1 lb", "2 lb", "3 lb", "5 lb", "family pack"], aliases: ["ground beef", "hamburger", "beef"] },
  { id: "chicken-breast", name: "Chicken breast", category: "meat", groups: ["meat_protein"], variants: ["Any chicken breast", "fresh chicken breast", "frozen chicken breast", "family pack chicken breast"], sizes: ["1 lb", "3 lb", "5 lb"], aliases: ["chicken breast", "boneless chicken"] },
  { id: "chicken-thighs", name: "Chicken thighs", category: "meat", groups: ["meat_protein"], variants: ["Any chicken thighs", "bone-in chicken thighs", "boneless chicken thighs", "skinless chicken thighs"], sizes: ["1 lb", "3 lb", "5 lb"], aliases: ["chicken thighs", "thighs"] },
  { id: "bacon", name: "Bacon", category: "meat", groups: ["meat_protein"], variants: ["Any bacon", "regular bacon", "thick cut bacon", "turkey bacon"], sizes: ["12 oz", "16 oz", "24 oz"], aliases: ["bacon", "turkey bacon"] },
  { id: "sausage", name: "Sausage", category: "meat", groups: ["meat_protein"], variants: ["Any sausage", "breakfast sausage", "Italian sausage", "smoked sausage"], sizes: ["12 oz", "16 oz", "1 lb"], aliases: ["sausage", "brats", "smoked sausage"] },
  { id: "lunch-meat", name: "Lunch meat", category: "meat", groups: ["meat_protein"], variants: ["Any lunch meat", "turkey lunch meat", "ham lunch meat", "chicken lunch meat", "roast beef lunch meat"], sizes: ["8 oz", "16 oz", "1 lb"], aliases: ["lunch meat", "deli meat", "turkey slices"] },
  { id: "tuna", name: "Tuna", category: "pantry", groups: ["meat_protein"], variants: ["Any tuna", "canned tuna", "tuna pouch", "tuna in water", "tuna in oil"], sizes: ["5 oz", "12 oz", "4 pack"], aliases: ["tuna", "canned tuna"] },
  { id: "salmon", name: "Salmon", category: "meat", groups: ["meat_protein"], variants: ["Any salmon", "fresh salmon", "frozen salmon", "canned salmon"], sizes: ["1 lb", "12 oz", "14.75 oz"], aliases: ["salmon", "canned salmon"] },
  { id: "pork-chops", name: "Pork chops", category: "meat", groups: ["meat_protein"], variants: ["Any pork chops", "bone-in pork chops", "boneless pork chops", "thin cut pork chops", "family pack"], sizes: ["per lb", "1 lb", "2 lb", "3 lb", "family pack"], aliases: ["pork chops", "pork chop"] },
  { id: "steak", name: "Steak", category: "meat", groups: ["meat_protein"], variants: ["Any steak", "sirloin", "ribeye", "round steak", "chuck steak", "family pack"], sizes: ["per lb", "1 lb", "2 lb", "family pack"], aliases: ["steak", "beef steak", "sirloin", "ribeye"] },
  { id: "hot-dogs", name: "Hot dogs", category: "meat", groups: ["meat_protein"], variants: ["Any hot dogs", "beef hot dogs", "turkey hot dogs", "bun length hot dogs"], sizes: ["8 ct", "10 ct", "12 oz", "16 oz"], aliases: ["hot dogs", "hotdogs", "franks"] },
  { id: "brats", name: "Brats", category: "meat", groups: ["meat_protein"], variants: ["Any brats", "beer brats", "original brats", "cheddar brats"], sizes: ["5 ct", "12 oz", "16 oz", "1 lb"], aliases: ["brats", "bratwurst"] },
  { id: "tofu", name: "Tofu", category: "produce", groups: ["meat_protein"], variants: ["Any tofu", "firm tofu", "extra firm tofu"], sizes: ["14 oz", "16 oz"], aliases: ["tofu", "bean curd"] },

  { id: "bottled-water", name: "Bottled water", category: "drinks", groups: ["drinks"], variants: ["Any bottled water", "24 pack bottled water", "32 pack bottled water", "40 pack bottled water"], sizes: ["24 pack", "32 pack", "40 pack"], aliases: ["water", "bottled water", "water bottles"] },
  { id: "soda", name: "Soda", category: "drinks", groups: ["drinks"], variants: ["Any soda", "2 liter soda", "12 pack soda", "24 pack soda"], sizes: ["2 liter", "12 pack", "24 pack"], aliases: ["soda", "pop", "soft drinks"] },
  { id: "orange-juice", name: "Orange juice", category: "drinks", groups: ["drinks"], variants: ["Any orange juice", "pulp orange juice", "no pulp orange juice"], sizes: ["52 fl oz", "64 fl oz", "1 gallon"], aliases: ["orange juice", "oj"] },
  { id: "coffee", name: "Coffee", category: "drinks", groups: ["drinks"], variants: ["Any coffee", "ground coffee", "whole bean coffee", "K-cups"], sizes: ["12 oz", "24 oz", "32 oz", "80 ct"], aliases: ["coffee", "k cups", "kcups"] },
  { id: "tea", name: "Tea", category: "drinks", groups: ["drinks"], variants: ["Any tea", "tea bags", "bottled tea", "gallon tea"], sizes: ["20 ct", "100 ct", "16 fl oz", "1 gallon"], aliases: ["tea", "iced tea"] },
  { id: "sports-drink", name: "Sports drink", category: "drinks", groups: ["drinks"], variants: ["Any sports drink", "single sports drink", "6 pack sports drink", "12 pack sports drink"], sizes: ["single", "6 pack", "12 pack", "32 oz"], aliases: ["sports drink", "gatorade", "powerade"] },

  { id: "frozen-pizza", name: "Frozen pizza", category: "frozen", groups: ["frozen"], variants: ["Any frozen pizza", "cheese frozen pizza", "pepperoni frozen pizza", "supreme frozen pizza", "thin crust frozen pizza"], sizes: ["1 each"], aliases: ["frozen pizza", "pizza"] },
  { id: "frozen-vegetables", name: "Frozen vegetables", category: "frozen", groups: ["frozen"], variants: ["Any frozen vegetables", "frozen corn", "frozen peas", "frozen broccoli", "mixed vegetables"], sizes: ["12 oz", "16 oz", "32 oz"], aliases: ["frozen vegetables", "frozen veggies"] },
  { id: "ice-cream", name: "Ice cream", category: "frozen", groups: ["frozen"], variants: ["Any ice cream", "ice cream pint", "1.5 qt ice cream", "gallon ice cream"], sizes: ["1 pint", "1.5 qt", "1 gallon"], aliases: ["ice cream"] },
  { id: "frozen-meals", name: "Frozen meals", category: "frozen", groups: ["frozen"], variants: ["Any frozen meals", "single frozen meal", "family size frozen meal"], sizes: ["1 each", "12 oz", "family size"], aliases: ["frozen meals", "tv dinner"] },
  { id: "frozen-chicken", name: "Frozen chicken", category: "frozen", groups: ["frozen"], variants: ["Any frozen chicken", "chicken nuggets", "chicken patties", "chicken strips"], sizes: ["1 lb", "3 lb", "5 lb"], aliases: ["frozen chicken", "nuggets", "chicken strips"] },

  { id: "toilet-paper", name: "Toilet paper", category: "household", groups: ["household"], variants: ["Any toilet paper", "6 rolls toilet paper", "12 rolls toilet paper", "24 rolls toilet paper", "30 rolls toilet paper", "mega rolls"], sizes: ["6 rolls", "12 rolls", "24 rolls", "30 rolls"], aliases: ["toilet paper", "tp"] },
  { id: "paper-towels", name: "Paper towels", category: "household", groups: ["household"], variants: ["Any paper towels", "2 rolls paper towels", "6 rolls paper towels", "12 rolls paper towels"], sizes: ["2 rolls", "6 rolls", "12 rolls"], aliases: ["paper towels"] },
  { id: "trash-bags", name: "Trash bags", category: "household", groups: ["household"], variants: ["Any trash bags", "13 gallon trash bags", "30 gallon trash bags", "55 gallon trash bags"], sizes: ["20 ct", "40 ct", "80 ct"], aliases: ["trash bags", "garbage bags"] },
  { id: "dish-soap", name: "Dish soap", category: "household", groups: ["household"], variants: ["Any dish soap", "small dish soap", "large dish soap", "dish soap refill"], sizes: ["16 fl oz", "24 fl oz", "32 fl oz"], aliases: ["dish soap", "dish liquid"] },
  { id: "laundry-detergent", name: "Laundry detergent", category: "household", groups: ["household"], variants: ["Any laundry detergent", "liquid laundry detergent", "laundry pods", "powder laundry detergent"], sizes: ["46 fl oz", "92 fl oz", "150 fl oz"], aliases: ["laundry detergent", "detergent", "laundry soap"] },
  { id: "dryer-sheets", name: "Dryer sheets", category: "household", groups: ["household"], variants: ["Any dryer sheets", "80 ct dryer sheets", "120 ct dryer sheets", "240 ct dryer sheets"], sizes: ["80 ct", "120 ct", "240 ct"], aliases: ["dryer sheets"] },
  { id: "sponges", name: "Sponges", category: "household", groups: ["household"], variants: ["Any sponges", "single sponge", "multi-pack sponges"], sizes: ["single", "3 pack", "6 pack"], aliases: ["sponges", "dish sponges"] },

  { id: "shampoo", name: "Shampoo", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any shampoo", "dandruff shampoo", "moisturizing shampoo", "clarifying shampoo"], sizes: ["12 oz", "13.5 oz", "16 oz", "28 oz", "32 oz"], aliases: ["shampoo"] },
  { id: "conditioner", name: "Conditioner", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any conditioner", "moisturizing conditioner", "repair conditioner"], sizes: ["12 oz", "28 oz"], aliases: ["conditioner"] },
  { id: "body-wash", name: "Body wash", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any body wash", "men's body wash", "women's body wash", "sensitive skin body wash"], sizes: ["12 oz", "18 oz", "24 oz"], aliases: ["body wash"] },
  { id: "bar-soap", name: "Bar soap", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any bar soap", "single bar soap", "6 pack bar soap", "12 pack bar soap"], sizes: ["single", "6 pack", "12 pack"], aliases: ["bar soap", "soap"] },
  { id: "toothpaste", name: "Toothpaste", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any toothpaste", "whitening toothpaste", "sensitive toothpaste", "kids toothpaste"], sizes: ["4 oz", "6 oz"], aliases: ["toothpaste"] },
  { id: "toothbrush", name: "Toothbrush", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any toothbrush", "soft toothbrush", "medium toothbrush", "multi-pack toothbrush"], sizes: ["1 each", "2 pack", "4 pack"], aliases: ["toothbrush", "toothbrushes"] },
  { id: "deodorant", name: "Deodorant", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any deodorant", "men's deodorant", "women's deodorant", "aluminum-free deodorant"], sizes: ["2.6 oz", "3 oz"], aliases: ["deodorant"] },
  { id: "lotion", name: "Lotion", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any lotion", "body lotion", "hand lotion", "sensitive skin lotion"], sizes: ["8 oz", "16 oz", "32 oz"], aliases: ["lotion"] },
  { id: "razors", name: "Razors", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any razors", "disposable razors", "refill blades"], sizes: ["4 pack", "8 pack", "12 pack"], aliases: ["razors", "razor blades"] },
  { id: "feminine-pads", name: "Feminine pads", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any feminine pads", "regular pads", "overnight pads", "pads with wings"], sizes: ["20 ct", "40 ct", "80 ct"], aliases: ["pads", "feminine pads"] },
  { id: "tampons", name: "Tampons", category: "personal care", groups: ["bathroom_personal_care"], variants: ["Any tampons", "regular tampons", "super tampons", "variety pack tampons"], sizes: ["18 ct", "36 ct", "54 ct"], aliases: ["tampons"] },

  { id: "dog-food", name: "Dog food", category: "pet", groups: ["pets"], variants: ["Any dog food", "dry dog food", "wet dog food", "puppy dog food", "adult dog food"], sizes: ["5 lb", "15 lb", "30 lb", "40 lb"], aliases: ["dog food"] },
  { id: "cat-food", name: "Cat food", category: "pet", groups: ["pets"], variants: ["Any cat food", "dry cat food", "wet cat food", "kitten food", "adult cat food"], sizes: ["3 lb", "7 lb", "16 lb"], aliases: ["cat food"] },
  { id: "cat-litter", name: "Cat litter", category: "pet", groups: ["pets"], variants: ["Any cat litter", "clumping cat litter", "non-clumping cat litter", "scented cat litter", "unscented cat litter"], sizes: ["10 lb", "20 lb", "40 lb"], aliases: ["cat litter", "litter"] },
  { id: "pet-treats", name: "Pet treats", category: "pet", groups: ["pets"], variants: ["Any pet treats", "dog treats", "cat treats"], sizes: ["6 oz", "16 oz"], aliases: ["pet treats", "dog treats", "cat treats"] },

  { id: "diapers", name: "Diapers", category: "baby", groups: ["baby"], variants: ["Any diapers", "newborn diapers", "size 1 diapers", "size 2 diapers", "size 3 diapers", "size 4 diapers", "size 5 diapers", "size 6 diapers"], sizes: ["24 ct", "80 ct", "120 ct"], aliases: ["diapers"] },
  { id: "baby-wipes", name: "Baby wipes", category: "baby", groups: ["baby"], variants: ["Any baby wipes", "scented baby wipes", "unscented baby wipes", "sensitive baby wipes"], sizes: ["56 ct", "168 ct", "504 ct"], aliases: ["baby wipes", "wipes"] },
  { id: "baby-food", name: "Baby food", category: "baby", groups: ["baby"], variants: ["Any baby food", "baby food jars", "baby food pouches", "baby cereal"], sizes: ["4 oz", "12 pack"], aliases: ["baby food", "baby cereal"] },
  { id: "formula", name: "Formula", category: "baby", groups: ["baby"], variants: ["Any formula", "powder formula", "ready-to-feed formula", "sensitive formula"], sizes: ["12 oz", "20 oz", "32 oz"], aliases: ["formula", "baby formula"] },

  { id: "all-purpose-cleaner", name: "All-purpose cleaner", category: "household", groups: ["cleaning"], variants: ["Any all-purpose cleaner", "cleaner spray", "cleaner refill"], sizes: ["24 fl oz", "32 fl oz"], aliases: ["all-purpose cleaner", "cleaning spray"] },
  { id: "glass-cleaner", name: "Glass cleaner", category: "household", groups: ["cleaning"], variants: ["Any glass cleaner", "glass cleaner spray", "glass cleaner refill"], sizes: ["23 fl oz", "32 fl oz"], aliases: ["glass cleaner", "window cleaner"] },
  { id: "toilet-cleaner", name: "Toilet cleaner", category: "household", groups: ["cleaning"], variants: ["Any toilet cleaner", "toilet cleaner gel", "toilet cleaner tablets"], sizes: ["24 fl oz", "32 fl oz"], aliases: ["toilet cleaner"] },
  { id: "disinfecting-wipes", name: "Disinfecting wipes", category: "household", groups: ["cleaning"], variants: ["Any disinfecting wipes", "35 ct disinfecting wipes", "75 ct disinfecting wipes", "multi-pack disinfecting wipes"], sizes: ["35 ct", "75 ct"], aliases: ["disinfecting wipes", "cleaning wipes"] },
  { id: "floor-cleaner", name: "Floor cleaner", category: "household", groups: ["cleaning"], variants: ["Any floor cleaner", "floor cleaner concentrate", "ready-to-use floor cleaner"], sizes: ["32 fl oz", "64 fl oz"], aliases: ["floor cleaner"] },
  { id: "bathroom-cleaner", name: "Bathroom cleaner", category: "household", groups: ["cleaning"], variants: ["Any bathroom cleaner", "bathroom cleaner spray", "bathroom cleaner foam"], sizes: ["24 fl oz", "32 fl oz"], aliases: ["bathroom cleaner"] },
  { id: "bleach", name: "Bleach", category: "household", groups: ["cleaning"], variants: ["Any bleach", "regular bleach", "splash-less bleach", "scented bleach"], sizes: ["64 fl oz", "1 gallon"], aliases: ["bleach"] }
];

const quickItemGroupsData = {
  "Food Basics": [
    "Eggs", "Milk", "Bread", "Bananas", "Apples", "Potatoes", "Onions", "Tomatoes", "Lettuce", "Rice",
    "Beans", "Pasta", "Cereal", "Oatmeal", "Peanut butter", "Jelly", "Tortillas", "Cheese", "Butter", "Yogurt"
  ],
  Meat: [
    "Ground beef", "Chicken breast", "Chicken thighs", "Bacon", "Sausage", "Lunch meat", "Tuna", "Salmon", "Pork chops", "Steak", "Hot dogs", "Brats", "Tofu"
  ],
  Drinks: [
    "Bottled water", "Orange juice", "Apple juice", "Soda", "Coffee", "Tea", "Sports drink"
  ],
  Frozen: [
    "Frozen pizza", "Frozen vegetables", "Ice cream", "Frozen meals", "Frozen chicken"
  ],
  Household: [
    "Paper towels", "Toilet paper", "Trash bags", "Dish soap", "Laundry detergent", "Dryer sheets", "Cleaning spray", "Bleach", "Sponges"
  ],
  Bathroom: [
    "Shampoo", "Conditioner", "Body wash", "Bar soap", "Toothpaste", "Toothbrush", "Deodorant", "Lotion", "Hand soap", "Razors", "Shaving cream", "Feminine pads", "Tampons", "Diapers", "Baby wipes"
  ],
  Pets: [
    "Dog food", "Cat food", "Cat litter", "Pet treats"
  ],
  Baby: [
    "Diapers", "Baby wipes", "Baby food", "Formula"
  ],
  Cleaning: [
    "All-purpose cleaner", "Glass cleaner", "Toilet cleaner", "Disinfecting wipes", "Floor cleaner", "Bathroom cleaner"
  ],
  Custom: [
    "Custom"
  ]
};

const quickItems = {
  "Eggs": { category: "dairy", sizes: ["12 ct", "18 ct", "24 ct"] },
  "Milk": { category: "dairy", sizes: ["1 gallon", "1/2 gallon", "52 fl oz"] },
  "Bread": { category: "bakery", sizes: ["1 each", "16 oz", "20 oz"] },
  "Bananas": { category: "produce", sizes: ["1 lb"] },
  "Apples": { category: "produce", sizes: ["1 lb", "3 lb"] },
  "Potatoes": { category: "produce", sizes: ["3 lb", "5 lb"] },
  "Onions": { category: "produce", sizes: ["1 lb", "3 lb"] },
  "Tomatoes": { category: "produce", sizes: ["1 lb"] },
  "Lettuce": { category: "produce", sizes: ["1 each"] },
  "Rice": { category: "pantry", sizes: ["1 lb", "3 lb", "5 lb"] },
  "Beans": { category: "pantry", sizes: ["15 oz", "1 lb"] },
  "Pasta": { category: "pantry", sizes: ["12 oz", "16 oz"] },
  "Cereal": { category: "pantry", sizes: ["12 oz", "18 oz"] },
  "Oatmeal": { category: "pantry", sizes: ["18 oz", "32 oz"] },
  "Peanut butter": { category: "pantry", sizes: ["16 oz", "28 oz", "32 oz"] },
  "Jelly": { category: "pantry", sizes: ["18 oz", "32 oz"] },
  "Tortillas": { category: "pantry", sizes: ["12 ct", "24 ct"] },
  "Cheese": { category: "dairy", sizes: ["8 oz", "16 oz"] },
  "Butter": { category: "dairy", sizes: ["1 lb", "16 oz"] },
  "Yogurt": { category: "dairy", sizes: ["6 oz", "32 oz"] },
  "Ground beef": { category: "meat", sizes: ["per lb", "1 lb", "2 lb", "3 lb", "5 lb", "family pack"] },
  "Chicken breast": { category: "meat", sizes: ["1 lb", "3 lb", "5 lb"] },
  "Chicken thighs": { category: "meat", sizes: ["1 lb", "3 lb", "5 lb"] },
  "Bacon": { category: "meat", sizes: ["12 oz", "16 oz"] },
  "Sausage": { category: "meat", sizes: ["12 oz", "16 oz"] },
  "Lunch meat": { category: "meat", sizes: ["8 oz", "16 oz"] },
  "Tuna": { category: "pantry", sizes: ["5 oz", "12 oz"] },
  "Salmon": { category: "meat", sizes: ["1 lb", "12 oz"] },
  "Pork chops": { category: "meat", sizes: ["per lb", "1 lb", "2 lb", "3 lb", "family pack"] },
  "Steak": { category: "meat", sizes: ["per lb", "1 lb", "2 lb", "family pack"] },
  "Hot dogs": { category: "meat", sizes: ["8 ct", "10 ct", "12 oz", "16 oz"] },
  "Brats": { category: "meat", sizes: ["5 ct", "12 oz", "16 oz", "1 lb"] },
  "Tofu": { category: "produce", sizes: ["14 oz", "16 oz"] },
  "Bottled water": { category: "drinks", sizes: ["12 pack", "24 pack"] },
  "Orange juice": { category: "drinks", sizes: ["52 fl oz", "1 gallon"] },
  "Apple juice": { category: "drinks", sizes: ["64 fl oz", "1 gallon"] },
  "Soda": { category: "drinks", sizes: ["6 pack", "12 pack", "24 pack"] },
  "Coffee": { category: "drinks", sizes: ["12 oz", "32 oz"] },
  "Tea": { category: "drinks", sizes: ["20 ct", "100 ct"] },
  "Sports drink": { category: "drinks", sizes: ["6 pack", "12 pack", "32 oz"] },
  "Frozen pizza": { category: "frozen", sizes: ["1 each"] },
  "Frozen vegetables": { category: "frozen", sizes: ["12 oz", "16 oz"] },
  "Ice cream": { category: "frozen", sizes: ["48 oz", "1 gallon"] },
  "Frozen meals": { category: "frozen", sizes: ["1 each", "12 oz"] },
  "Frozen chicken": { category: "frozen", sizes: ["1 lb", "3 lb", "5 lb"] },
  "Paper towels": { category: "household", sizes: ["6 rolls", "12 rolls"] },
  "Toilet paper": { category: "household", sizes: ["6 rolls", "12 rolls", "24 rolls", "30 rolls"] },
  "Trash bags": { category: "household", sizes: ["20 ct", "40 ct", "80 ct"] },
  "Dish soap": { category: "household", sizes: ["16 fl oz", "24 fl oz", "32 fl oz"] },
  "Laundry detergent": { category: "household", sizes: ["32 fl oz", "46 fl oz", "92 fl oz", "100 fl oz", "150 fl oz"] },
  "Dryer sheets": { category: "household", sizes: ["80 ct", "160 ct"] },
  "Cleaning spray": { category: "household", sizes: ["24 fl oz", "32 fl oz"] },
  "Bleach": { category: "household", sizes: ["64 fl oz", "1 gallon"] },
  "Sponges": { category: "household", sizes: ["3 pack", "6 pack"] },
  "Shampoo": { category: "personal care", sizes: ["12 oz", "13.5 oz", "16 oz", "28 oz", "32 oz"] },
  "Conditioner": { category: "personal care", sizes: ["12 oz", "13.5 oz", "16 oz", "28 oz", "32 oz"] },
  "Body wash": { category: "personal care", sizes: ["12 oz", "18 oz", "24 oz"] },
  "Bar soap": { category: "personal care", sizes: ["6 pack", "12 pack"] },
  "Toothpaste": { category: "personal care", sizes: ["4 oz", "6 oz"] },
  "Toothbrush": { category: "personal care", sizes: ["1 each", "2 pack", "4 pack"] },
  "Deodorant": { category: "personal care", sizes: ["2.6 oz", "3 oz"] },
  "Lotion": { category: "personal care", sizes: ["8 oz", "12 oz", "16 oz", "20 oz", "32 oz"] },
  "Hand soap": { category: "personal care", sizes: ["7.5 fl oz", "12 fl oz", "32 fl oz"] },
  "Razors": { category: "personal care", sizes: ["4 pack", "8 pack", "12 pack"] },
  "Shaving cream": { category: "personal care", sizes: ["7 oz", "10 oz"] },
  "Feminine pads": { category: "personal care", sizes: ["20 ct", "40 ct", "80 ct"] },
  "Tampons": { category: "personal care", sizes: ["18 ct", "36 ct", "54 ct"] },
  "Diapers": { category: "baby", sizes: ["24 ct", "80 ct", "120 ct"] },
  "Baby wipes": { category: "baby", sizes: ["56 ct", "168 ct", "504 ct"] },
  "Baby food": { category: "baby", sizes: ["4 oz", "12 pack"] },
  "Formula": { category: "baby", sizes: ["12 oz", "20 oz", "32 oz"] },
  "Dog food": { category: "pet", sizes: ["5 lb", "15 lb", "30 lb"] },
  "Cat food": { category: "pet", sizes: ["3 lb", "7 lb", "16 lb"] },
  "Cat litter": { category: "pet", sizes: ["10 lb", "20 lb", "40 lb"] },
  "Pet treats": { category: "pet", sizes: ["6 oz", "16 oz"] },
  "All-purpose cleaner": { category: "household", sizes: ["24 fl oz", "32 fl oz"] },
  "Glass cleaner": { category: "household", sizes: ["23 fl oz", "32 fl oz"] },
  "Toilet cleaner": { category: "household", sizes: ["24 fl oz", "32 fl oz"] },
  "Disinfecting wipes": { category: "household", sizes: ["35 ct", "75 ct"] },
  "Floor cleaner": { category: "household", sizes: ["32 fl oz", "64 fl oz"] },
  "Bathroom cleaner": { category: "household", sizes: ["24 fl oz", "32 fl oz"] }
};

const sizePresets = {
  "1 each": { quantity: "1", unit: "each" },
  "12 ct": { quantity: "12", unit: "each" },
  "18 ct": { quantity: "18", unit: "each" },
  "24 ct": { quantity: "24", unit: "each" },
  "1 lb": { quantity: "1", unit: "lb" },
  "2 lb": { quantity: "2", unit: "lb" },
  "3 lb": { quantity: "3", unit: "lb" },
  "5 lb": { quantity: "5", unit: "lb" },
  "8 oz": { quantity: "8", unit: "oz" },
  "12 oz": { quantity: "12", unit: "oz" },
  "15 oz": { quantity: "15", unit: "oz" },
  "16 oz": { quantity: "16", unit: "oz" },
  "18 oz": { quantity: "18", unit: "oz" },
  "20 oz": { quantity: "20", unit: "oz" },
  "24 oz": { quantity: "24", unit: "oz" },
  "28 oz": { quantity: "28", unit: "oz" },
  "32 oz": { quantity: "32", unit: "oz" },
  "48 oz": { quantity: "48", unit: "oz" },
  "64 fl oz": { quantity: "64", unit: "fl oz" },
  "7.5 fl oz": { quantity: "7.5", unit: "fl oz" },
  "12 fl oz": { quantity: "12", unit: "fl oz" },
  "16 fl oz": { quantity: "16", unit: "fl oz" },
  "24 fl oz": { quantity: "24", unit: "fl oz" },
  "32 fl oz": { quantity: "32", unit: "fl oz" },
  "46 fl oz": { quantity: "46", unit: "fl oz" },
  "52 fl oz": { quantity: "52", unit: "fl oz" },
  "92 fl oz": { quantity: "92", unit: "fl oz" },
  "100 fl oz": { quantity: "100", unit: "fl oz" },
  "150 fl oz": { quantity: "150", unit: "fl oz" },
  "1 gallon": { quantity: "1", unit: "gallon" },
  "1/2 gallon": { quantity: "0.5", unit: "gallon" },
  "2 pack": { quantity: "2", unit: "pack" },
  "3 pack": { quantity: "3", unit: "pack" },
  "4 pack": { quantity: "4", unit: "pack" },
  "6 pack": { quantity: "6", unit: "bottle" },
  "8 pack": { quantity: "8", unit: "pack" },
  "12 pack": { quantity: "12", unit: "bottle" },
  "24 pack": { quantity: "24", unit: "bottle" },
  "32 pack": { quantity: "32", unit: "bottle" },
  "40 pack": { quantity: "40", unit: "bottle" },
  "5 ct": { quantity: "5", unit: "each" },
  "8 ct": { quantity: "8", unit: "each" },
  "10 ct": { quantity: "10", unit: "each" },
  "20 ct": { quantity: "20", unit: "each" },
  "23 fl oz": { quantity: "23", unit: "fl oz" },
  "36 ct": { quantity: "36", unit: "each" },
  "35 ct": { quantity: "35", unit: "each" },
  "40 ct": { quantity: "40", unit: "each" },
  "54 ct": { quantity: "54", unit: "each" },
  "56 ct": { quantity: "56", unit: "each" },
  "80 ct": { quantity: "80", unit: "each" },
  "100 ct": { quantity: "100", unit: "each" },
  "120 ct": { quantity: "120", unit: "each" },
  "75 ct": { quantity: "75", unit: "each" },
  "160 ct": { quantity: "160", unit: "each" },
  "168 ct": { quantity: "168", unit: "each" },
  "504 ct": { quantity: "504", unit: "each" },
  "6 rolls": { quantity: "6", unit: "roll" },
  "12 rolls": { quantity: "12", unit: "roll" },
  "24 rolls": { quantity: "24", unit: "roll" },
  "30 rolls": { quantity: "30", unit: "roll" },
  "2.6 oz": { quantity: "2.6", unit: "oz" },
  "3 oz": { quantity: "3", unit: "oz" },
  "4 oz": { quantity: "4", unit: "oz" },
  "5 oz": { quantity: "5", unit: "oz" },
  "6 oz": { quantity: "6", unit: "oz" },
  "7 oz": { quantity: "7", unit: "oz" },
  "10 oz": { quantity: "10", unit: "oz" },
  "13.5 oz": { quantity: "13.5", unit: "oz" },
  "14 oz": { quantity: "14", unit: "oz" },
  "15 lb": { quantity: "15", unit: "lb" },
  "30 lb": { quantity: "30", unit: "lb" },
  "40 lb": { quantity: "40", unit: "lb" },
  "3 lb": { quantity: "3", unit: "lb" },
  "7 lb": { quantity: "7", unit: "lb" },
  "10 lb": { quantity: "10", unit: "lb" },
  "16 lb": { quantity: "16", unit: "lb" },
  "family pack": { quantity: "1", unit: "pack" }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeLookup(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findPlaceholderById(id) {
  return productPlaceholders.find((placeholder) => placeholder.id === id) || null;
}

function findPlaceholderByName(name) {
  const normalized = normalizeLookup(name);
  return productPlaceholders.find((placeholder) =>
    normalizeLookup(placeholder.name) === normalized ||
    (placeholder.aliases || []).some((alias) => normalizeLookup(alias) === normalized)
  ) || null;
}

function placeholderSearchText(placeholder) {
  return normalizeLookup([
    placeholder.name,
    placeholder.category,
    ...(placeholder.variants || []),
    ...(placeholder.sizes || []),
    ...(placeholder.aliases || [])
  ].join(" "));
}

function placeholderMatchesQuery(placeholder, query) {
  const normalized = normalizeLookup(query);

  if (!normalized) {
    return true;
  }

  return placeholderSearchText(placeholder).includes(normalized) ||
    normalized.split(" ").every((word) => placeholderSearchText(placeholder).includes(word));
}

function variantMatchesQuery(variant, query) {
  const normalized = normalizeLookup(query);

  if (!normalized) {
    return false;
  }

  return normalizeLookup(variant).includes(normalized);
}

function placeholderSuggestionsForQuery(query, limit = 10) {
  const normalized = normalizeLookup(query);
  const suggestions = [];

  for (const placeholder of productPlaceholders) {
    if (!placeholderMatchesQuery(placeholder, normalized)) {
      continue;
    }

    suggestions.push({ placeholder, variant: "" });

    for (const variant of placeholder.variants || []) {
      if (suggestions.length >= limit) {
        break;
      }

      if (variant.toLowerCase().startsWith("any ")) {
        continue;
      }

      if (!normalized || variantMatchesQuery(variant, normalized) || normalizeLookup(placeholder.name).includes(normalized)) {
        suggestions.push({ placeholder, variant });
      }
    }

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions.slice(0, limit);
}

function placeholdersForBrowseGroup(group = "", products = [], limit = 24) {
  const productNames = new Set(
    products.map((product) => normalizeLookup(product.display_name || product.name))
  );
  const filtered = productPlaceholders.filter((placeholder) =>
    (!group || (placeholder.groups || []).includes(group)) &&
    !productNames.has(normalizeLookup(placeholder.name))
  );

  return filtered.slice(0, limit);
}

function browseGroupTitle(group = "") {
  const groupRow = browseCategoryGroups.find((item) => item.key === group);

  if (!groupRow) {
    return "Browse groceries";
  }

  if (group === "meat_protein") {
    return "Meat & Protein";
  }

  return groupRow.label;
}

function findProductForPlaceholder(placeholder, products = []) {
  const names = new Set([
    placeholder.name,
    ...(placeholder.aliases || [])
  ].map(normalizeLookup));

  return products.find((product) => {
    const productNames = [
      product.display_name,
      product.canonical_name,
      product.name
    ].map(normalizeLookup);
    return productNames.some((name) => names.has(name));
  }) || null;
}

function findPlaceholderForProduct(product = {}) {
  const productNames = [
    product.display_name,
    product.canonical_name,
    product.name
  ].map(normalizeLookup).filter(Boolean);

  return productPlaceholders.find((placeholder) => {
    const placeholderNames = [
      placeholder.name,
      ...(placeholder.aliases || [])
    ].map(normalizeLookup);
    return productNames.some((name) => placeholderNames.includes(name));
  }) || null;
}

function productChoicesForBrowseGroup(group = "", products = []) {
  const usedProductIds = new Set();
  const choices = [];
  const placeholders = productPlaceholders.filter((placeholder) =>
    !group || (placeholder.groups || []).includes(group)
  );

  for (const placeholder of placeholders) {
    const product = findProductForPlaceholder(placeholder, products);

    if (product?.id) {
      usedProductIds.add(String(product.id));
    }

    choices.push({
      type: product ? "product" : "placeholder",
      id: product?.id || placeholder.id,
      name: placeholder.name,
      category: product?.category || placeholder.category,
      approved_price_count: product?.approved_price_count || 0,
      best_price_label: product?.best_price_label || "",
      sizes: placeholder.sizes || [],
      variants: placeholder.variants || [],
      product,
      placeholder
    });
  }

  for (const product of products) {
    if (usedProductIds.has(String(product.id))) {
      continue;
    }

    choices.push({
      type: "product",
      id: product.id,
      name: product.display_name,
      category: product.category,
      approved_price_count: product.approved_price_count || 0,
      best_price_label: product.best_price_label || "",
      sizes: product.default_size_text ? [product.default_size_text] : [],
      variants: [],
      product,
      placeholder: findPlaceholderForProduct(product)
    });
  }

  return choices;
}

function isAnyVariant(value = "") {
  return normalizeLookup(value).startsWith("any ");
}

function displayPlaceholderVariant(value = "") {
  return isAnyVariant(value) ? "" : value;
}

function placeholderDisplayName(placeholder, variant = "") {
  return displayPlaceholderVariant(variant) || placeholder.name;
}

function parseSizeSuggestion(sizeText) {
  const size = String(sizeText || "").trim();
  const fallback = { size_text: size, quantity: "1", unit: "each" };

  if (!size) {
    return { size_text: "", quantity: "", unit: "" };
  }

  const lower = size.toLowerCase();

  if (["per lb", "by lb", "lb"].includes(lower)) {
    return { size_text: size, quantity: "1", unit: "lb" };
  }

  if (["single", "each", "bunch", "bag", "family size"].includes(lower)) {
    return fallback;
  }

  if (sizePresets[size]) {
    return {
      size_text: size,
      quantity: sizePresets[size].quantity,
      unit: sizePresets[size].unit
    };
  }

  const number = lower.match(/^(\d+(?:\.\d+)?)\s*(fl oz|lb|oz|gallon|ct|count|pack|roll|rolls)(?:\s+bag)?$/);

  if (number) {
    const unitMap = {
      ct: "each",
      count: "each",
      rolls: "roll"
    };
    return {
      size_text: size,
      quantity: number[1],
      unit: unitMap[number[2]] || number[2]
    };
  }

  const bagMatch = lower.match(/^(\d+(?:\.\d+)?)\s*lb\s+bag$/);

  if (bagMatch) {
    return { size_text: size, quantity: bagMatch[1], unit: "lb" };
  }

  const countMatch = lower.match(/^(\d+)\s*(?:count|ct)$/);

  if (countMatch) {
    return { size_text: size, quantity: countMatch[1], unit: "each" };
  }

  const eachSizeMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(liter|litre|l|pint|pt|qt|quart)s?$/);

  if (eachSizeMatch) {
    return fallback;
  }

  return fallback;
}

function parseSizePreset(value) {
  const parsed = parseSizeSuggestion(value);

  if (!parsed.size_text) {
    return null;
  }

  return {
    quantity: parsed.quantity,
    unit: parsed.unit
  };
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function renderReportTrustMeta(report = {}) {
  const checkedAt = report.source_checked_at || report.reviewed_at || report.submitted_at;
  const proofLabel = proofLabels[report.proof_type] || titleCase(report.proof_type || "proof");
  const validThrough = report.expires_at ? formatShortDate(report.expires_at) : "";

  return `
    <div class="source-trust-row">
      <span>${escapeHtml(proofLabel)} proof</span>
      ${checkedAt ? `<span>Checked ${escapeHtml(formatShortDate(checkedAt))}</span>` : ""}
      ${validThrough ? `<span>Valid through ${escapeHtml(validThrough)}</span>` : ""}
      ${report.source_url ? `<a href="${escapeHtml(report.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(report.source_domain ? "View source" : "Verify on store site")}</a>` : ""}
    </div>
  `;
}

function setMessage(element, text, type = "info") {
  element.textContent = text;
  element.dataset.type = type;
}

function showCartToast(text, type = "success") {
  if (!cartToast) {
    return;
  }

  cartToast.textContent = text;
  cartToast.dataset.type = type;
  cartToast.hidden = false;
  window.clearTimeout(showCartToast.timeoutId);
  showCartToast.timeoutId = window.setTimeout(() => {
    cartToast.hidden = true;
    cartToast.textContent = "";
  }, 2800);
}

function routeFallback(message) {
  setMessage(accountMessage, message, "info");
  setMessage(resultsSummary, message, "info");
}

function selectedOptionText(field) {
  if (!field || !field.options || field.selectedIndex < 0) {
    return "";
  }

  return field.options[field.selectedIndex]?.textContent || "";
}

function submitValue(name) {
  return submitField(name)?.value?.trim() || "";
}

function submitStoreSummary() {
  return submitValue("store_id") ? selectedOptionText(submitField("store_id")) : "Choose a store";
}

function submitProductSummary() {
  const item = submitValue("item_name");
  const type = submitValue("brand");
  const size = submitValue("size_text");
  const category = submitValue("category");

  if (!item) {
    return "Optional item hint";
  }

  return [item, type, size || titleCase(category)].filter(Boolean).join(" · ");
}

function submitPriceSummary() {
  const price = submitValue("price");
  const numericPrice = Number(price);
  return price && Number.isFinite(numericPrice) ? `$${numericPrice.toFixed(2)}` : "Optional price hint";
}

function submitProofSummary() {
  const proofLabel = proofLabels[submitValue("proof_type")] || "Choose proof";
  return submitValue("source_url") ? `${proofLabel} · source link` : proofLabel;
}

function updateSubmitReviewCard() {
  if (!submitReviewCard) {
    return;
  }

  const price = submitValue("price");
  const numericPrice = Number(price);
  const priceLabel = price && Number.isFinite(numericPrice) ? `$${numericPrice.toFixed(2)}` : "Not entered";
  submitReviewCard.innerHTML = `
    <dl class="details-list">
      <div><dt>Store</dt><dd>${escapeHtml(submitStoreSummary())}</dd></div>
      <div><dt>Item</dt><dd>${escapeHtml(submitValue("item_name") || "Not entered")}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(submitValue("brand") || "Any / not entered")}</dd></div>
      <div><dt>Size</dt><dd>${escapeHtml(submitValue("size_text") || "Not entered")}</dd></div>
      <div><dt>Price</dt><dd>${priceLabel}</dd></div>
      <div><dt>Proof</dt><dd>${escapeHtml(submitProofSummary())}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(submitValue("source_url") || "None")}</dd></div>
    </dl>
    <p class="field-help">Reviewed before public.</p>
  `;
}

function updateSubmitStepSummaries() {
  const sizeSummary = submitValue("size_text")
    ? [submitValue("size_text"), submitValue("quantity") && submitValue("unit") ? `${submitValue("quantity")} ${submitValue("unit")}` : ""].filter(Boolean).join(" · ")
    : "Choose size";
  const summaries = {
    store: submitStoreSummary(),
    product: submitProductSummary(),
    brand: submitValue("brand") || "Brand/type optional",
    size: sizeSummary,
    price: submitPriceSummary(),
    proof: submitProofSummary(),
    review: "Review details"
  };

  for (const [step, text] of Object.entries(summaries)) {
    const element = document.querySelector(`[data-submit-summary="${step}"]`);

    if (element) {
      element.textContent = text;
    }
  }

  updateSubmitReviewCard();
}

function openSubmitStep(stepName) {
  activeSubmitStep = stepName;

  for (const step of document.querySelectorAll("[data-submit-step]")) {
    const isOpen = step.dataset.submitStep === stepName;
    step.classList.toggle("is-open", isOpen);
    const toggle = step.querySelector("[data-submit-step-toggle]");

    if (toggle) {
      toggle.setAttribute("aria-expanded", String(isOpen));
    }
  }
}

function setupSubmitAccordion() {
  for (const toggle of document.querySelectorAll("[data-submit-step-toggle]")) {
    toggle.addEventListener("click", () => openSubmitStep(toggle.dataset.submitStepToggle));
  }

  updateSubmitStepSummaries();
}

function switchView(viewId, options = {}) {
  const publicTab = options.publicTab || (viewId === "searchView" ? activePublicTab : "");

  if (viewId === "searchView") {
    activePublicTab = publicTab || "home";
  }

  document.body.dataset.publicTab = viewId === "searchView" ? activePublicTab : viewId.replace("View", "");

  for (const tab of document.querySelectorAll("[data-view-target]")) {
    const tabPublicTarget = tab.dataset.publicTab || "";
    const matchesView = tab.dataset.viewTarget === viewId;
    const matchesPublicTab = !tabPublicTarget || tabPublicTarget === activePublicTab;
    tab.classList.toggle("is-active", matchesView && matchesPublicTab);
  }

  for (const view of document.querySelectorAll(".view")) {
    view.classList.toggle("is-active", view.id === viewId);
  }

  sendHeartbeat();
}

function highlightCartItem(itemId) {
  if (!itemId) {
    return;
  }

  window.setTimeout(() => {
    const target = cartItemsList.querySelector(`[data-cart-card="${itemId}"]`);

    if (target) {
      target.classList.add("is-highlighted");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setMessage(cartMessage, "That cart item is no longer available. Showing your cart instead.", "info");
    }
  }, 120);
}

function openTab(viewId, options = {}) {
  switchView(viewId, options);

  if (viewId === "searchView" && options.publicTab === "browse") {
    loadBrowse(options.group || "").catch((error) => {
      browsePanel.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    });
    window.setTimeout(() => {
      browsePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  if (viewId === "cartView") {
    loadCart().then(() => highlightCartItem(options.cartItemId)).catch((error) => {
      setMessage(cartMessage, error.message, "error");
    });
  }

  if (viewId === "accountView" && currentUser) {
    loadAccountSection(options.section || activeAccountSection, options.reportId || options.notificationId || null).catch((error) => {
      accountActivityContent.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    });
  }
}

function openProduct(productId) {
  if (!productId) {
    openTab("searchView");
    routeFallback("That product is no longer available. Showing search instead.");
    return;
  }

  openProductDetail(productId).catch(() => {
    openTab("searchView");
    routeFallback("That product is no longer available. Showing search instead.");
  });
}

function openMyReport(reportId) {
  if (!currentUser) {
    openTab("accountView");
    setMessage(accountMessage, "Log in to view your report details.", "info");
    return;
  }

  setAccountSection("reports", reportId);
}

function openCartItem(itemId = null) {
  openTab("cartView", { cartItemId: itemId });
}

function openNotifications() {
  if (!currentUser) {
    openTab("accountView");
    return;
  }

  setAccountSection("notifications");
}

async function openProofResult(proofId) {
  if (!currentUser) {
    openTab("accountView");
    setMessage(accountMessage, "Log in to view proof status.", "info");
    return;
  }

  if (!proofId) {
    openNotifications();
    return;
  }

  openTab("accountView");
  accountActivityPanel.hidden = false;
  accountActivityContent.innerHTML = '<div class="empty-state">Loading proof status...</div>';

  const data = await fetchJson(`/api/proof-submissions/${proofId}`);
  const proof = data.proof;

  accountActivityContent.innerHTML = `
    <article class="admin-card compact-card">
      <div class="card-topline">
        <span class="badge confidence-high">${escapeHtml(proof.status_label)}</span>
        <span>${escapeHtml(formatDate(proof.submitted_at))}</span>
      </div>
      <h3>${escapeHtml(proof.store_name || "Proof submission")}</h3>
      <p class="field-help">${escapeHtml(proof.message)}</p>
      <dl class="report-details">
        <div><dt>Proof type</dt><dd>${escapeHtml(titleCase(proof.proof_type || "proof"))}</dd></div>
        <div><dt>Approved items</dt><dd>${Number(proof.approved_count || 0)}</dd></div>
        <div><dt>Points earned</dt><dd>${Number(proof.points_earned || 0)}</dd></div>
        <div><dt>Reviewed</dt><dd>${escapeHtml(proof.reviewed_at ? formatDate(proof.reviewed_at) : "Not yet")}</dd></div>
      </dl>
      ${proof.review_reason ? `<p class="field-help"><strong>Review note:</strong> ${escapeHtml(proof.review_reason)}</p>` : ""}
      ${proof.source_url ? `<a class="secondary-button" href="${escapeHtml(proof.source_url)}" target="_blank" rel="noopener noreferrer">View source</a>` : ""}
      ${proof.needs_resubmit ? `
        <div class="empty-state">
          <strong>Send an updated proof</strong>
          <p>Upload a clearer photo or add the missing source link so admin can review it again.</p>
          <button class="secondary-button" type="button" data-proof-resubmit>Submit updated proof</button>
        </div>
      ` : ""}
      ${proof.approved_items?.length ? `
        <div class="admin-list">
          ${proof.approved_items.map((report) => `
            <article class="admin-card compact-card">
              <h3>${escapeHtml(report.product_display_name || report.item_name)}</h3>
              <p class="field-help">${escapeHtml(report.store_name)} · ${escapeHtml(report.price_label)} · ${escapeHtml(report.public_proof_label || report.proof_type)}</p>
              <button class="secondary-button" type="button" data-proof-report="${report.id}">Open approved report</button>
            </article>
          `).join("")}
        </div>
      ` : '<div class="empty-state">No public prices have been approved from this proof yet.</div>'}
      <p class="field-help">${escapeHtml(proof.privacy_note || "Proof stays private until approved prices are created.")}</p>
    </article>
  `;

  for (const button of accountActivityContent.querySelectorAll("[data-proof-report]")) {
    button.addEventListener("click", () => openMyReport(button.dataset.proofReport));
  }

  const resubmitButton = accountActivityContent.querySelector("[data-proof-resubmit]");
  if (resubmitButton) {
    resubmitButton.addEventListener("click", () => openTab("submitView"));
  }
}

async function sendHeartbeat() {
  try {
    await postJson("/api/heartbeat", {});
  } catch (error) {
    // Presence is approximate and should never interrupt the app.
  }
}

function showAuthPanel(panelId) {
  for (const button of document.querySelectorAll("[data-auth-target]")) {
    button.classList.toggle("is-active", button.dataset.authTarget === panelId);
    button.setAttribute("aria-selected", button.dataset.authTarget === panelId ? "true" : "false");
  }

  for (const panel of document.querySelectorAll("[data-auth-panel]")) {
    panel.hidden = panel.dataset.authPanel !== panelId;
  }
}

function populateCategorySelect(select, includeAll) {
  if (includeAll === true) {
    select.innerHTML = '<option value="">All categories</option>';
  } else if (includeAll === "choose") {
    select.innerHTML = '<option value="">Choose category</option>';
  } else {
    select.innerHTML = "";
  }

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = titleCase(category);
    select.appendChild(option);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function brandModeLabel(value) {
  if (value === "exact") {
    return "Only this brand";
  }

  if (value === "preferred") {
    return "I prefer this brand";
  }

  return "Any brand is okay";
}

function isProductInCart(productId) {
  return Boolean(productId) && currentCartItems.some((item) => String(item.product_id || "") === String(productId));
}

function isPlaceholderInCart(placeholder, variant = "") {
  if (!placeholder) {
    return false;
  }

  const normalizedName = normalizeLookup(placeholder.name);
  const normalizedVariant = normalizeLookup(displayPlaceholderVariant(variant));

  return currentCartItems.some((item) => {
    if (item.product_id) {
      return false;
    }

    const nameMatches = normalizeLookup(item.item_name) === normalizedName;
    const categoryMatches = String(item.category || "") === String(placeholder.category || "");

    if (!normalizedVariant) {
      return nameMatches && categoryMatches;
    }

    return nameMatches && categoryMatches && normalizeLookup(item.preferred_brand) === normalizedVariant;
  });
}

function isReportInCart(report) {
  if (!report) {
    return false;
  }

  if (report.product_id && isProductInCart(report.product_id)) {
    return true;
  }

  const reportName = String(report.product_display_name || report.item_name || "").toLowerCase();
  return currentCartItems.some((item) =>
    !item.product_id &&
    String(item.item_name || "").toLowerCase() === reportName &&
    String(item.category || "") === String(report.category || "")
  );
}

function setCartButtonState(button, state) {
  if (!button) {
    return;
  }

  if (state === "added") {
    button.textContent = "Added";
    button.classList.add("is-complete");
  } else if (state === "in-cart") {
    button.textContent = "In cart";
    button.classList.add("is-complete");
  } else {
    button.textContent = "Add to cart";
    button.classList.remove("is-complete");
  }
}

async function trackClientEvent(payload) {
  try {
    await postJson("/api/analytics/event", payload);
  } catch (error) {
    // Analytics must never interrupt the shopping workflow.
  }
}

async function trackSponsorAction(sponsorId, eventType, placement) {
  try {
    await postJson(`/api/sponsors/${sponsorId}/event`, {
      event_type: eventType,
      placement
    });
  } catch (error) {
    // Sponsor stats are best-effort aggregate counts.
  }
}

function renderSponsorCards(container, sponsors = [], placement = "general") {
  if (!container) {
    return;
  }

  if (!sponsors.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = sponsors
    .map((sponsor) => `
      <article class="sponsor-card" data-sponsor-card="${sponsor.id}">
        <div class="card-topline">
          <span class="badge confidence-low">Sponsored</span>
          <span>Local sponsor</span>
        </div>
        ${sponsor.image_url ? `<img src="${escapeHtml(sponsor.image_url)}" alt="" class="sponsor-image">` : ""}
        <h3>${escapeHtml(sponsor.title)}</h3>
        <p>${escapeHtml(sponsor.message)}</p>
        <dl class="details-list">
          <div><dt>Sponsor</dt><dd>${escapeHtml(sponsor.sponsor_name)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(titleCase(sponsor.sponsor_type))}</dd></div>
          ${sponsor.weekly_price_note ? `<div><dt>Note</dt><dd>${escapeHtml(sponsor.weekly_price_note)}</dd></div>` : ""}
        </dl>
        <div class="card-actions">
          ${sponsor.link_url ? `<button class="secondary-button" type="button" data-sponsor-click="${sponsor.id}" data-sponsor-url="${escapeHtml(sponsor.link_url)}">View</button>` : ""}
          <button class="quiet-button" type="button" data-sponsor-interest="${sponsor.id}">I'm interested</button>
          <button class="quiet-button" type="button" data-sponsor-dismiss="${sponsor.id}">Not interested</button>
        </div>
      </article>
    `)
    .join("");

  for (const button of container.querySelectorAll("[data-sponsor-click]")) {
    button.addEventListener("click", async () => {
      await trackSponsorAction(button.dataset.sponsorClick, "sponsor_clicked", placement);
      window.open(button.dataset.sponsorUrl, "_blank", "noopener");
    });
  }

  for (const button of container.querySelectorAll("[data-sponsor-interest]")) {
    button.addEventListener("click", async () => {
      await trackSponsorAction(button.dataset.sponsorInterest, "sponsor_interested", placement);
      button.textContent = "Saved interest";
    });
  }

  for (const button of container.querySelectorAll("[data-sponsor-dismiss]")) {
    button.addEventListener("click", async () => {
      await trackSponsorAction(button.dataset.sponsorDismiss, "sponsor_not_interested", placement);
      const card = button.closest("[data-sponsor-card]");
      if (card) {
        card.remove();
      }
    });
  }
}

async function loadSponsors(placement, container) {
  try {
    const data = await fetchJson(`/api/sponsors?placement=${encodeURIComponent(placement)}`);
    renderSponsorCards(container, data.sponsors || [], placement);
  } catch (error) {
    if (container) {
      container.innerHTML = "";
    }
  }
}

function renderVerificationBadge(user) {
  if (!user) {
    return '<span class="badge confidence-low">Email not verified</span>';
  }

  return user.is_email_verified
    ? '<span class="badge confidence-high">Verified email</span>'
    : '<span class="badge confidence-low">Email not verified</span>';
}

function renderEmailVerificationPanel() {
  if (!currentUser) {
    emailVerificationPanel.innerHTML = "";
    return;
  }

  if (currentUser.is_email_verified) {
    emailVerificationPanel.innerHTML = `
      <div class="email-verification-card is-verified">
        <strong>Email verified.</strong>
      </div>
    `;
    return;
  }

  emailVerificationPanel.innerHTML = `
    <div class="email-verification-card">
      <p>Email not verified. Verify your email to become eligible for future rewards.</p>
      <button id="resendVerificationButton" class="secondary-button" type="button">Resend verification email</button>
    </div>
  `;

  document
    .querySelector("#resendVerificationButton")
    .addEventListener("click", resendVerificationEmail);
}

function userInitials(user = {}) {
  const source = user.username || user.email || "GR";
  const words = String(source).replace(/@.*$/, "").split(/[^a-z0-9]+/i).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function renderAuthState() {
  if (!currentUser) {
    currentUserBadge.textContent = "Sign In";
    currentUserBadge.className = "user-status header-user-status sign-in-button";
    currentUserBadge.hidden = false;
    signedOutAccount.hidden = false;
    currentUserPanel.hidden = true;
    currentUserDetails.innerHTML = "";
    emailVerificationPanel.innerHTML = "";
    avoidIngredientsInput.value = "";
    notificationBell.hidden = true;
    notificationCountBadge.textContent = "0";
    accountActivityPanel.hidden = true;
    accountActivityContent.innerHTML = "";
    updateNotificationBadges(0);
    setCartCount(0);
    adminAlertBadge.hidden = true;
    adminAlertBadge.textContent = "";
    adminReviewLink.hidden = true;
    adminSettingsTools.hidden = true;
    logoutButton.hidden = true;
    submitLoginNotice.hidden = false;
    profileCard.innerHTML = '<div class="empty-state">Log in to see your points and reward eligibility.</div>';
    return;
  }

  currentUserBadge.textContent = `${currentUser.username} · ${currentUser.points} pts`;
  currentUserBadge.hidden = true;
  signedOutAccount.hidden = true;
  currentUserPanel.hidden = false;
  adminSettingsTools.hidden = !currentUser.is_admin;
  adminReviewLink.hidden = !currentUser.is_admin;
  notificationBell.hidden = true;
  accountActivityPanel.hidden = false;
  currentUserBadge.className = currentUser.is_email_verified
    ? "user-status header-user-status is-verified"
    : "user-status header-user-status is-unverified";
  const rewardProgress = Math.min(100, Math.max(0, Math.round((Number(currentUser.points || 0) / 500) * 100)));
  currentUserDetails.innerHTML = `
    <article class="account-profile-card">
      <div class="profile-initials" aria-hidden="true">${escapeHtml(userInitials(currentUser))}</div>
      <div class="profile-main">
        <h3>${escapeHtml(currentUser.username)}</h3>
        <p>Janesville, WI</p>
        ${renderVerificationBadge(currentUser)}
      </div>
      <dl class="profile-stats">
        <div><dt>Points</dt><dd>${currentUser.points}</dd></div>
        <div><dt>Rank</dt><dd data-profile-rank>Loading</dd></div>
        <div><dt>Accuracy</dt><dd>${currentUser.accuracy_score}%</dd></div>
        <div><dt>Rewards</dt><dd>${currentUser.reward_eligible ? "Eligible" : "Verify email"}</dd></div>
      </dl>
      <div class="reward-progress">
        <span>Future rewards progress</span>
        <div class="reward-progress-track"><i style="width: ${rewardProgress}%"></i></div>
        <small>${currentUser.points} / 500 pts</small>
      </div>
    </article>
  `;
  avoidIngredientsInput.value = currentUser.avoid_ingredients || "";
  renderEmailVerificationPanel();
  logoutButton.hidden = false;
  submitLoginNotice.hidden = true;
  profileCard.innerHTML = `
    <article class="profile-panel">
      <div>
        <span class="eyebrow">User points</span>
        <h3>${escapeHtml(currentUser.username)}</h3>
        ${renderVerificationBadge(currentUser)}
      </div>
      <div class="points-number">${currentUser.points}</div>
      <dl class="details-list">
        <div><dt>Email</dt><dd>${escapeHtml(currentUser.email)}</dd></div>
        <div><dt>Accuracy score</dt><dd>${currentUser.accuracy_score}%</dd></div>
        <div><dt>Reward eligible</dt><dd>${currentUser.reward_eligible ? "Yes" : "No"}</dd></div>
      </dl>
      ${currentUser.reward_eligible
        ? ""
        : '<p class="muted">Verify your email to keep your contributor account trusted for beta point features.</p>'}
    </article>
  `;

  loadNotifications().catch(() => updateNotificationBadges(0));
  loadProfileOverview().catch(() => {});
  loadAccountSection(activeAccountSection).catch((error) => {
    accountActivityContent.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  });
}

async function loadProfileOverview() {
  if (!currentUser) {
    return;
  }

  const data = await fetchJson(`/api/users/${encodeURIComponent(currentUser.username)}`);
  const rank = currentUserDetails.querySelector("[data-profile-rank]");

  if (rank) {
    rank.textContent = data.rank || "New shopper";
  }
}

function renderAccountLeaderboard(rows = []) {
  if (!rows.length) {
    accountActivityContent.innerHTML = '<div class="empty-state">No contributors yet.</div>';
    return;
  }

  accountActivityContent.innerHTML = rows.slice(0, 10).map((row, index) => `
    <article class="profile-leaderboard-row ${row.username === currentUser?.username ? "is-current-user" : ""}">
      <span class="rank-number">${index + 1}</span>
      <div>
        <strong>${escapeHtml(row.username)}</strong>
        <small>${Number(row.approved_proof_count || 0)} approved proof${Number(row.approved_proof_count || 0) === 1 ? "" : "s"} · ${Number(row.contribution_count || 0)} helpful price${Number(row.contribution_count || 0) === 1 ? "" : "s"}</small>
        ${row.trust_level ? `<span class="inline-status">${escapeHtml(row.trust_level)}</span>` : ""}
      </div>
      <div class="leaderboard-points">
        <strong>${row.points}</strong>
        <span>points</span>
      </div>
    </article>
  `).join("");
}

function updateNotificationBadges(count) {
  const unread = Number(count) || 0;
  notificationCountBadge.textContent = String(unread);
  notificationCountBadge.hidden = unread === 0;
  accountUnreadCount.textContent = String(unread);
  accountUnreadCount.hidden = unread === 0;
  notificationBell.classList.toggle("has-unread", unread > 0);

  for (const mirror of document.querySelectorAll("[data-notification-count-mirror]")) {
    mirror.textContent = String(unread);
    mirror.hidden = unread === 0;
  }
}

function setCartCount(count) {
  const total = Number(count) || 0;
  cartCountBadge.textContent = String(total);
  cartCountBadge.hidden = total === 0;

  if (cartPageCount) {
    cartPageCount.textContent = String(total);
  }

  if (cartSubtitle) {
    const suffix = cartSubtitle.querySelector("strong") ? cartSubtitle.lastChild : null;
    if (suffix && suffix.nodeType === Node.TEXT_NODE) {
      suffix.textContent = ` item${total === 1 ? "" : "s"}`;
    }
  }

  for (const mirror of document.querySelectorAll("[data-cart-count-mirror]")) {
    mirror.textContent = String(total);
  }
}

function setCartMode(mode) {
  if (!cartCompareMode) {
    return;
  }

  cartCompareMode.value = mode;

  for (const button of cartModeSegments?.querySelectorAll("[data-cart-mode]") || []) {
    button.classList.toggle("is-active", button.dataset.cartMode === mode);
  }
}

function syncCartControls(count = currentCartItems.length) {
  const hasItems = Boolean(currentUser && Number(count) > 0);

  if (compareCartButton) {
    compareCartButton.disabled = !hasItems;
  }

  if (clearCartButton) {
    clearCartButton.disabled = !hasItems;
  }

  if (cartCompareHint) {
    cartCompareHint.textContent = hasItems
      ? "Pick a compare style, then compare approved prices."
      : "Add items first.";
  }
}

function setupCartControls() {
  if (cartAddToggle && cartAddDetails) {
    cartAddToggle.addEventListener("click", () => {
      cartAddDetails.open = !cartAddDetails.open;
      if (cartAddDetails.open) {
        cartAddDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  document.querySelector("[data-cart-edit-all]")?.addEventListener("click", () => {
    for (const details of cartItemsList.querySelectorAll(".cart-edit-details")) {
      details.open = true;
    }

    if (currentCartItems.length) {
      cartItemsList.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  for (const button of cartModeSegments?.querySelectorAll("[data-cart-mode]") || []) {
    button.addEventListener("click", () => {
      setCartMode(button.dataset.cartMode);
      trackClientEvent({
        event_type: "cart_mode_selected",
        cart_item_name: button.dataset.cartMode,
        metadata: { mode: button.dataset.cartMode }
      });
      if (cartComparison.textContent.trim() && currentCartItems.length) {
        compareCart();
      }
    });
  }

  setCartMode(cartCompareMode?.value || "cheapest_split");
  syncCartControls(0);
}

function accountStatusHelp(status) {
  if (status === "needs_proof") {
    return "Admin needs a clearer proof photo before this can go public.";
  }

  if (status === "needs_update") {
    return "Admin needs you to update details before this can go public.";
  }

  if (status === "pending") {
    return "Submitted for review. It will appear publicly after approval.";
  }

  if (status === "approved") {
    return "Approved and public.";
  }

  if (status === "rejected") {
    return "Rejected by admin. Check the reason below.";
  }

  if (status === "disputed") {
    return "This report has a dispute and needs review.";
  }

  return titleCase(status);
}

function renderMyReports(reports = []) {
  if (!reports.length) {
    accountActivityContent.innerHTML = '<div class="empty-state">No reports submitted yet.</div>';
    return;
  }

  accountActivityContent.innerHTML = reports.map((report) => `
    <article class="admin-card compact-card" data-my-report="${report.id}">
      <div class="card-topline">
        <span class="badge confidence-${escapeHtml(report.confidence)}">${escapeHtml(titleCase(report.status))}</span>
        <span>${escapeHtml(formatDate(report.submitted_at))}</span>
      </div>
      <h3>${escapeHtml(report.item_name)}</h3>
      <dl class="details-list">
        <div><dt>Store</dt><dd>${escapeHtml(report.store_name)}</dd></div>
        <div><dt>Price</dt><dd>${escapeHtml(report.price_label)} / ${escapeHtml(report.unit_price_label)}</dd></div>
        <div><dt>Size</dt><dd>${escapeHtml(report.size_text || `${report.quantity} ${report.unit}`)}</dd></div>
        <div><dt>Proof</dt><dd>${escapeHtml(proofLabels[report.proof_type] || titleCase(report.proof_type))}${report.has_photo_upload ? " uploaded" : ""}</dd></div>
        <div><dt>Reason</dt><dd>${escapeHtml(report.admin_rejection_reason || "None")}</dd></div>
      </dl>
      <div class="inline-help">${escapeHtml(accountStatusHelp(report.status))}</div>
      <div class="card-actions">
        ${report.product_id ? `<button class="secondary-button" type="button" data-open-product="${report.product_id}">Open product</button>` : ""}
        <button class="quiet-button" type="button" data-start-update-report="${report.id}">Submit updated price</button>
      </div>
    </article>
  `).join("");

  for (const button of accountActivityContent.querySelectorAll("[data-open-product]")) {
    button.addEventListener("click", () => openProductDetail(button.dataset.openProduct));
  }

  for (const button of accountActivityContent.querySelectorAll("[data-start-update-report]")) {
    const report = reports.find((item) => String(item.id) === button.dataset.startUpdateReport);
    button.addEventListener("click", () => {
      openTab("submitView");
      if (report) {
        submitField("item_name").value = report.item_name;
        submitField("brand").value = report.brand || "";
        submitField("category").value = report.category || "";
        submitField("size_text").value = report.size_text || "";
        submitField("quantity").value = report.quantity || "";
        submitField("unit").value = report.unit || "each";
        submitField("store_id").value = report.store_id || "";
        submitProductId.value = report.product_id || "";
        setMessage(submitMessage, "Submit a fresh corrected report. Admin will review it before it appears publicly.", "info");
      }
    });
  }
}

function renderMyVerifications(verifications = []) {
  if (!verifications.length) {
    accountActivityContent.innerHTML = '<div class="empty-state">No verifications yet.</div>';
    return;
  }

  accountActivityContent.innerHTML = verifications.map((verification) => `
    <article class="admin-card compact-card">
      <div class="card-topline">
        <span class="badge confidence-low">${escapeHtml(titleCase(verification.verification_type))}</span>
        <span>${escapeHtml(formatDate(verification.created_at))}</span>
      </div>
      <h3>${escapeHtml(verification.item_name)}</h3>
      <dl class="details-list">
        <div><dt>Store</dt><dd>${escapeHtml(verification.store_name)}</dd></div>
        <div><dt>Price</dt><dd>${escapeHtml(verification.price_label)}</dd></div>
        <div><dt>Report status</dt><dd>${escapeHtml(titleCase(verification.report_status))}</dd></div>
        <div><dt>Note</dt><dd>${escapeHtml(verification.note || "None")}</dd></div>
      </dl>
      ${verification.product_id ? `<button class="quiet-button" type="button" data-open-product="${verification.product_id}">Open product</button>` : ""}
    </article>
  `).join("");

  for (const button of accountActivityContent.querySelectorAll("[data-open-product]")) {
    button.addEventListener("click", () => openProductDetail(button.dataset.openProduct));
  }
}

function renderAccountCartShortcut() {
  accountActivityContent.innerHTML = `
    <article class="admin-card compact-card">
      <h3>Cart</h3>
      <p class="field-help">${currentCartItems.length} item${currentCartItems.length === 1 ? "" : "s"} in your cart.</p>
      <button class="primary-button" type="button" data-open-cart-from-account>Open cart</button>
    </article>
  `;
  accountActivityContent.querySelector("[data-open-cart-from-account]").addEventListener("click", () => openTab("cartView"));
}

function renderAvoidShortcut() {
  accountActivityContent.innerHTML = `
    <article class="admin-card compact-card">
      <h3>Avoid List</h3>
      <p class="field-help">Ingredient alerts are a helper only. Always check the package label.</p>
      <button class="secondary-button" type="button" data-focus-avoid-list>Edit avoid list</button>
    </article>
  `;
  accountActivityContent.querySelector("[data-focus-avoid-list]").addEventListener("click", () => {
    avoidIngredientsForm.scrollIntoView({ behavior: "smooth", block: "start" });
    avoidIngredientsInput.focus();
  });
}

function routeNotification(notification) {
  if (!notification) {
    openNotifications();
    setMessage(accountMessage, "That notification is no longer available.", "info");
    return;
  }

  if (notification.target_url && notification.target_url.startsWith("/admin.html")) {
    window.location.href = notification.target_url;
    return;
  }

  const targetParams = new URLSearchParams(String(notification.target_url || "").split("?")[1] || "");
  const targetTab = notification.target_tab || targetParams.get("tab") || "";
  const targetSection = targetParams.get("section") || "";
  const targetReportId = notification.related_type === "report"
    ? notification.related_id
    : targetParams.get("report");
  const targetProofId = notification.related_import_batch_id || targetParams.get("proof");
  const targetProductId = notification.related_type === "product"
    ? notification.related_id
    : targetParams.get("product");
  const targetCartItemId = notification.related_type === "cart_item"
    ? notification.related_id
    : targetParams.get("cartItem");

  if (targetTab === "cartView" || notification.type === "cart_price_found") {
    openCartItem(targetCartItemId);
    return;
  }

  if (targetProductId) {
    openProduct(targetProductId);
    return;
  }

  if (targetProofId || targetSection === "proof") {
    openProofResult(targetProofId).catch((error) => {
      openNotifications();
      setMessage(accountMessage, error.message, "error");
    });
    return;
  }

  if (targetSection === "username") {
    openTab("accountView");
    setMessage(accountMessage, "Please choose a different username before appearing on leaderboards.", "info");
    return;
  }

  if (targetReportId || targetTab === "myReports" || targetSection === "reports") {
    openMyReport(targetReportId);
    return;
  }

  if (targetTab === "submitView" || notification.related_type === "store_request") {
    openTab("submitView");
    setMessage(submitMessage, "Your store request update is connected to this submit flow.", "info");
    return;
  }

  if (notification.related_type === "suggestion") {
    openNotifications();
    setMessage(accountMessage, "Suggestion updates are shown in Notifications for now.", "info");
    return;
  }

  openNotifications();
}

async function openNotification(notification) {
  if (!notification) {
    openNotifications();
    setMessage(accountMessage, "That notification is no longer available.", "info");
    return;
  }

  await markNotificationRead(notification.id);
  routeNotification(notification);
}

function renderNotifications(notifications = []) {
  const unread = notifications.filter((notification) => !notification.is_read).length;
  updateNotificationBadges(unread);

  if (!notifications.length) {
    accountActivityContent.innerHTML = '<div class="empty-state">No notifications yet. We will let you know when your reports are reviewed.</div>';
    return;
  }

  accountActivityContent.innerHTML = `
    <div class="card-actions">
      <button class="quiet-button" type="button" data-mark-all-notifications>Mark all read</button>
    </div>
    ${notifications.map((notification) => `
      <article class="admin-card compact-card notification-row ${notification.is_read ? "" : "is-unread"}" role="button" tabindex="0" data-notification="${notification.id}" aria-label="Open notification: ${escapeHtml(notification.title)}">
        <div class="card-topline">
          <span class="badge ${notification.is_read ? "confidence-low" : "confidence-high"}">${notification.is_read ? "Read" : "Unread"}</span>
          <span>${escapeHtml(formatDate(notification.created_at))}</span>
        </div>
        <h3>${escapeHtml(notification.title)}</h3>
        <p class="field-help">${escapeHtml(notificationMessage(notification))}</p>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-open-notification="${notification.id}">Open</button>
          <span class="notification-open-affordance" aria-hidden="true">Open →</span>
          ${notification.is_read ? "" : `<button class="quiet-button" type="button" data-read-notification="${notification.id}">Mark read</button>`}
        </div>
      </article>
    `).join("")}
  `;

  const markAllButton = accountActivityContent.querySelector("[data-mark-all-notifications]");
  markAllButton.addEventListener("click", markAllNotificationsRead);

  for (const row of accountActivityContent.querySelectorAll("[data-notification]")) {
    const notification = notifications.find((item) => String(item.id) === row.dataset.notification);
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) {
        return;
      }

      openNotification(notification).catch((error) => {
        setMessage(accountMessage, error.message, "error");
      });
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openNotification(notification).catch((error) => {
        setMessage(accountMessage, error.message, "error");
      });
    });
  }

  for (const button of accountActivityContent.querySelectorAll("[data-open-notification]")) {
    const notification = notifications.find((item) => String(item.id) === button.dataset.openNotification);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openNotification(notification).catch((error) => {
        setMessage(accountMessage, error.message, "error");
      });
    });
  }

  for (const button of accountActivityContent.querySelectorAll("[data-read-notification]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      markNotificationRead(button.dataset.readNotification).catch((error) => {
        setMessage(accountMessage, error.message, "error");
      });
    });
  }
}

async function loadNotifications() {
  if (!currentUser) {
    updateNotificationBadges(0);
    return [];
  }

  const data = await fetchJson("/api/notifications");
  currentNotifications = data.notifications || [];
  updateNotificationBadges(data.unread_count || 0);

  if (activeAccountSection === "notifications") {
    renderNotifications(currentNotifications);
  }

  return currentNotifications;
}

async function markNotificationRead(notificationId) {
  await postJson(`/api/notifications/${notificationId}/read`, {});
  await loadNotifications();
}

async function markAllNotificationsRead() {
  await postJson("/api/notifications/read-all", {});
  await loadNotifications();
}

async function loadAccountSection(section = activeAccountSection, highlightId = null) {
  if (!currentUser) {
    return;
  }

  activeAccountSection = section;

  for (const button of document.querySelectorAll("[data-account-section]")) {
    button.classList.toggle("is-active", button.dataset.accountSection === section);
  }

  if (section === "notifications") {
    await loadNotifications();
    renderNotifications(currentNotifications);
  } else if (section === "reports") {
    const data = await fetchJson("/api/account/reports");
    currentReports = data.reports || [];
    renderMyReports(currentReports);
  } else if (section === "verifications") {
    const data = await fetchJson("/api/account/verifications");
    currentVerifications = data.verifications || [];
    renderMyVerifications(currentVerifications);
  } else if (section === "cart") {
    await loadCart();
    renderAccountCartShortcut();
  } else if (section === "avoid") {
    renderAvoidShortcut();
  } else if (section === "leaderboard") {
    const data = await fetchJson("/api/leaderboard");
    renderAccountLeaderboard(data.leaderboard || []);
  }

  if (highlightId) {
    const target = accountActivityContent.querySelector(`[data-my-report="${highlightId}"], [data-notification="${highlightId}"]`);

    if (target) {
      target.classList.add("is-highlighted");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setMessage(accountMessage, "That item is no longer available. Showing the closest matching section instead.", "info");
    }
  }
}

function setAccountSection(section, highlightId = null) {
  openTab("accountView");
  loadAccountSection(section, highlightId).catch((error) => {
    accountActivityContent.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  });
}

async function loadAdminAlertBadge() {
  if (!currentUser || !currentUser.is_admin) {
    adminAlertBadge.hidden = true;
    adminAlertBadge.textContent = "";
    return;
  }

  try {
    const data = await fetchJson("/api/admin/notifications");
    const label = data.notifications?.admin_alert_label || "0 pending reviews";
    adminAlertBadge.textContent = label;
    adminAlertBadge.hidden = false;
  } catch (error) {
    adminAlertBadge.hidden = true;
    adminAlertBadge.textContent = "";
  }
}

function proofTypeNeedsPhoto(proofType) {
  return proofType === "shelf_tag" ||
    proofType === "receipt" ||
    proofType === "weekly_ad";
}

function updateProofPhotoRequirement() {
  const needsPhoto = proofTypeNeedsPhoto(proofTypeSelect.value);
  const sourceUrl = submitField("source_url")?.value.trim() || "";

  proofPhotoInput.required = needsPhoto && !sourceUrl;
  proofPhotoField.hidden = false;

  if (needsPhoto) {
    proofPhotoRequirement.hidden = false;
    proofPhotoRequirement.textContent = sourceUrl
      ? "Image optional because a source link is included."
      : "Upload an image, or add a source link.";
  } else {
    proofPhotoRequirement.hidden = false;
    proofPhotoRequirement.textContent = "Source link proof works best for store pages.";
  }

  updateProofPhotoStatus();
  syncProofChoices();
}

function updateProofPhotoStatus() {
  const file = proofPhotoInput.files && proofPhotoInput.files[0];

  if (!proofTypeNeedsPhoto(proofTypeSelect.value)) {
    proofPhotoStatus.textContent = "Photo optional.";
    return;
  }

  if (!file) {
    proofPhotoStatus.textContent = "No file selected yet.";
    return;
  }

  const sizeMb = file.size / (1024 * 1024);
  proofPhotoStatus.textContent = `Selected: ${file.name} (${sizeMb.toFixed(2)} MB)`;
}

function submitField(name) {
  return submitForm.elements[name];
}

function clearSelectedProduct() {
  selectedSubmitProduct = null;
  selectedSubmitPlaceholder = null;
  submitProductId.value = "";
  selectedProductPanel.hidden = true;
  selectedProductPanel.innerHTML = "";
  renderPlaceholderVariants([]);
  updateSubmitStepSummaries();
}

function applyProductDefaults(product) {
  submitField("item_name").value = product.display_name || product.canonical_name || "";
  submitField("category").value = product.category || "";

  if (product.default_size_text) {
    submitField("size_text").value = product.default_size_text;
  }

  if (product.default_quantity) {
    submitField("quantity").value = product.default_quantity;
  }

  if (product.default_unit) {
    submitField("unit").value = product.default_unit;
  }

  if (product.preferred_brand) {
    submitField("brand").value = product.preferred_brand;
  }
}

function applyPlaceholderDefaults(placeholder, options = {}) {
  const selectedVariant = options.variant || placeholder.variants?.[0] || "";
  const selectedSize = options.size || placeholder.sizes?.[0] || "";
  selectedSubmitProduct = null;
  selectedSubmitPlaceholder = {
    ...placeholder,
    selectedVariant,
    selectedSize
  };
  submitProductId.value = "";
  submitField("item_name").value = placeholder.name;
  submitField("category").value = placeholder.category || "";

  const variantForField = displayPlaceholderVariant(selectedVariant);
  submitField("brand").value = variantForField;

  renderPlaceholderVariants(placeholder.variants || [], selectedVariant);
  renderSuggestedSizes(placeholder.sizes || []);

  if (selectedSize) {
    applyQuickSize(selectedSize);
  }

  selectedProductPanel.hidden = false;
  selectedProductPanel.innerHTML = `
    <div>
      <strong>${escapeHtml(placeholder.name)}</strong>
      <span>Product suggestion · ${escapeHtml(titleCase(placeholder.category))}${variantForField ? ` · ${escapeHtml(variantForField)}` : ""}${selectedSize ? ` · ${escapeHtml(selectedSize)}` : ""}</span>
    </div>
    <button class="quiet-button" type="button" data-clear-product>Use custom item</button>
  `;
  selectedProductPanel.querySelector("[data-clear-product]").addEventListener("click", clearSelectedProduct);
  setFieldError("item_name", "");
  setFieldError("category", "");
  setFieldError("size_text", "");
  setFieldError("quantity", "");
  setFieldError("unit", "");
  updateSubmitStepSummaries();
}

function setSelectedPlaceholder(placeholder, options = {}) {
  if (!placeholder) {
    return;
  }

  applyPlaceholderDefaults(placeholder, options);
  openSubmitStep(options.openStep || "brand");
}

function setSelectedProduct(product, prefill = true, options = {}) {
  selectedSubmitProduct = product;
  selectedSubmitPlaceholder = null;
  submitProductId.value = product.id;
  const placeholder = findPlaceholderForProduct(product);
  const selectedVariant = options.variant || placeholder?.variants?.[0] || "";
  const selectedSize = options.size || placeholder?.sizes?.[0] || product.default_size_text || "";
  renderPlaceholderVariants(placeholder?.variants || [], selectedVariant);
  renderSuggestedSizes(placeholder?.sizes || (product.default_size_text ? [product.default_size_text] : []));
  selectedProductPanel.hidden = false;
  selectedProductPanel.innerHTML = `
    <div>
      <strong>${escapeHtml(product.display_name)}</strong>
      <span>${escapeHtml(titleCase(product.category))}${selectedSize ? ` · ${escapeHtml(selectedSize)}` : ""}</span>
    </div>
    <button class="quiet-button" type="button" data-clear-product>Use custom item</button>
  `;
  selectedProductPanel.querySelector("[data-clear-product]").addEventListener("click", clearSelectedProduct);

  if (prefill) {
    applyProductDefaults(product);
    if (selectedVariant) {
      submitField("brand").value = displayPlaceholderVariant(selectedVariant);
    }
    if (selectedSize) {
      const parsed = parseSizeSuggestion(selectedSize);
      submitField("size_text").value = parsed.size_text;
      if (parsed.quantity && parsed.unit) {
        submitField("quantity").value = parsed.quantity;
        submitField("unit").value = parsed.unit;
      }
    }
  }

  updateSubmitStepSummaries();
  openSubmitStep("price");
}

async function searchProductsForSubmit(query) {
  const q = query || productSearchInput.value || submitField("item_name").value;

  if (!q.trim()) {
    productSearchResults.innerHTML = '<div class="empty-state">Type an item to search products.</div>';
    return;
  }

  const data = await fetchJson(`/api/products?q=${encodeURIComponent(q)}`);
  const products = data.products || [];

  if (!products.length) {
    const placeholderMatches = placeholderSuggestionsForQuery(q, 8);

    if (placeholderMatches.length) {
      productSearchResults.innerHTML = `
        <div class="placeholder-suggestion-note">Product suggestions only. Be the first to add a price.</div>
        ${placeholderMatches.map(({ placeholder, variant }) => `
          <article class="mini-row placeholder-mini-row">
            <div>
              <strong>${escapeHtml(placeholderDisplayName(placeholder, variant))}</strong>
              <span>${escapeHtml(titleCase(placeholder.category))} · Be the first to add a price and earn points.</span>
            </div>
            <button class="secondary-button" type="button" data-select-placeholder="${placeholder.id}" data-select-placeholder-variant="${escapeHtml(variant)}">Select suggestion</button>
          </article>
        `).join("")}
      `;
      clearSelectedProduct();

      for (const button of productSearchResults.querySelectorAll("[data-select-placeholder]")) {
        const placeholder = findPlaceholderById(button.dataset.selectPlaceholder);
        button.addEventListener("click", () => setSelectedPlaceholder(placeholder, {
          variant: button.dataset.selectPlaceholderVariant || ""
        }));
      }
      return;
    }

    productSearchResults.innerHTML = '<div class="empty-state">No matching product yet. You can type your own and admin will review it.</div>';
    clearSelectedProduct();
    return;
  }

  productSearchResults.innerHTML = products.slice(0, 5).map((product) => `
    <article class="mini-row">
      <div>
        <strong>${escapeHtml(product.display_name)}</strong>
        <span>${escapeHtml(titleCase(product.category))}${product.default_size_text ? ` · ${escapeHtml(product.default_size_text)}` : ""}</span>
      </div>
      <button class="secondary-button" type="button" data-select-product="${product.id}">Select</button>
    </article>
  `).join("");

  for (const button of productSearchResults.querySelectorAll("[data-select-product]")) {
    const product = products.find((item) => String(item.id) === button.dataset.selectProduct);
    button.addEventListener("click", () => setSelectedProduct(product));
  }
}

async function lookupProductForQuickItem(itemName) {
  try {
    const data = await fetchJson(`/api/products?q=${encodeURIComponent(itemName)}`);
    const normalized = itemName.toLowerCase();
    const product = (data.products || []).find((item) => {
      const aliases = Array.isArray(item.aliases) ? item.aliases : [];
      return item.canonical_name === normalized ||
        item.display_name.toLowerCase() === normalized ||
        aliases.some((alias) => alias.toLowerCase() === normalized);
    }) || (data.products || [])[0];

    if (product) {
      setSelectedProduct(product, false);
    } else {
      clearSelectedProduct();
    }
  } catch (error) {
    clearSelectedProduct();
  }
}

function productPriceSummary(product) {
  if (!product.approved_price_count) {
    return "Be the first to add a price.";
  }

  return `${product.approved_price_count} approved price${product.approved_price_count === 1 ? "" : "s"}${product.best_price_label ? ` · Best reported: ${product.best_price_label}` : ""}`;
}

function renderProductCard(product) {
  const article = document.createElement("article");
  article.className = "result-card product-card app-product-card app-shop-card grocery-product-tile";
  article.dataset.productTile = String(product.id);
  article.tabIndex = 0;
  const inCart = isProductInCart(product.id);
  const priceCount = Number(product.approved_price_count || 0);
  article.classList.toggle("has-no-price", priceCount === 0);
  const bestPriceText = product.best_price_label
    ? product.best_price_label
    : "Add a price";
  article.innerHTML = `
    <div class="shop-card-body">
      <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(product.display_name, product.category))}</div>
      <div>
        <h3>${escapeHtml(product.display_name)}</h3>
        <span>${escapeHtml(product.best_store_name || titleCase(product.category))}</span>
      </div>
      <div class="shop-card-price">
        <strong>${escapeHtml(bestPriceText)}</strong>
        <span>${priceCount ? `${priceCount} report${priceCount === 1 ? "" : "s"}` : "Earn points"}</span>
      </div>
    </div>
    <div class="compact-card-actions">
      <button class="add-circle-button ${inCart ? "is-complete" : ""}" type="button" data-add-product-cart="${product.id}" aria-label="Add ${escapeHtml(product.display_name)} to cart">${inCart ? "✓" : "+"}</button>
    </div>
  `;
  article.addEventListener("click", () => openProductDetail(product.id));
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductDetail(product.id);
    }
  });
  article.querySelector("[data-add-product-cart]").addEventListener("click", (event) => {
    event.stopPropagation();
    addProductToCart(product, event.currentTarget);
  });
  return article;
}

function renderPlaceholderCard(placeholder, options = {}) {
  const variant = options.variant || "";
  const displayName = placeholderDisplayName(placeholder, variant);
  const inCart = isPlaceholderInCart(placeholder, variant);
  const article = document.createElement("article");
  article.className = "result-card product-card app-product-card placeholder-card app-shop-card grocery-product-tile has-no-price";
  article.dataset.placeholderTile = String(placeholder.id);
  article.tabIndex = 0;
  article.innerHTML = `
    <div class="shop-card-body">
      <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(displayName, placeholder.category))}</div>
      <div>
        <h3>${escapeHtml(displayName)}</h3>
        <span>${escapeHtml(titleCase(placeholder.category))}</span>
      </div>
      <div class="shop-card-price">
        <strong>Add a price</strong>
        <span>Earn points</span>
      </div>
    </div>
    <div class="compact-card-actions">
      <button class="add-circle-button ${inCart ? "is-complete" : ""}" type="button" data-add-placeholder-cart="${placeholder.id}" aria-label="Add ${escapeHtml(displayName)} to cart">${inCart ? "✓" : "+"}</button>
    </div>
  `;
  article.addEventListener("click", () => {
    openPlaceholderProduct(placeholder.id, { variant, size: placeholder.sizes?.[0] || "" });
  });
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlaceholderProduct(placeholder.id, { variant, size: placeholder.sizes?.[0] || "" });
    }
  });
  article.querySelector("[data-add-placeholder-cart]").addEventListener("click", (event) => {
    event.stopPropagation();
    addPlaceholderToCart(placeholder, { variant, size: placeholder.sizes?.[0] || "" }, event.currentTarget);
  });
  return article;
}

function renderCardCollection(container, items, renderer, options = {}) {
  const initialCount = options.initialCount || 12;
  const step = options.step || initialCount;
  let visibleCount = initialCount;

  const paint = () => {
    container.innerHTML = "";

    for (const item of items.slice(0, visibleCount)) {
      container.appendChild(renderer(item));
    }

    if (visibleCount < items.length) {
      const loadMore = document.createElement("button");
      loadMore.type = "button";
      loadMore.className = "secondary-button load-more-button";
      loadMore.textContent = `Show ${Math.min(step, items.length - visibleCount)} more`;
      loadMore.addEventListener("click", () => {
        visibleCount += step;
        paint();
      });
      container.appendChild(loadMore);
    }
  };

  paint();
}

async function openProductDetail(productId, options = {}) {
  const data = await fetchJson(`/api/products/${productId}`);
  const product = data.product;
  const reports = data.reports || [];
  const cheapestReport = [...reports].sort((a, b) => {
    const aPrice = Number(a.unit_price ?? a.price ?? Number.POSITIVE_INFINITY);
    const bPrice = Number(b.unit_price ?? b.price ?? Number.POSITIVE_INFINITY);
    return aPrice - bPrice;
  })[0] || null;
  const brandOptions = [...new Set(reports.map((report) => report.brand || "Unknown brand"))].sort((a, b) => a.localeCompare(b));
  const placeholder = findPlaceholderForProduct(product);
  const variantOptions = placeholder?.variants || [];
  const sizeOptions = placeholder?.sizes || (product.default_size_text ? [product.default_size_text] : []);
  const selectedVariant = options.variant || variantOptions[0] || "";
  const selectedSize = options.size || sizeOptions[0] || product.default_size_text || "";
  const variantForCart = displayPlaceholderVariant(selectedVariant);
  productDetailContent.innerHTML = `
    <article class="app-card product-hero-card">
      <div class="card-topline">
        <span class="badge confidence-high">Product</span>
        <span>${escapeHtml(titleCase(product.category))}</span>
      </div>
      <h3>${escapeHtml(product.display_name)}</h3>
      ${cheapestReport ? `
        <div class="cheapest-price-banner">
	          <span>Cheapest reported price</span>
	          <strong>${escapeHtml(cheapestReport.price_label)}</strong>
	          <small>${escapeHtml(cheapestReport.store_name)} · ${escapeHtml(cheapestReport.size_text || `${cheapestReport.quantity} ${cheapestReport.unit}`)}</small>
	          ${renderReportTrustMeta(cheapestReport)}
	        </div>
      ` : '<div class="inline-help">Be the first to add a price. Earn points for contributing.</div>'}
      <div class="cart-item-meta product-detail-meta">
        <span>${escapeHtml(titleCase(product.category))}</span>
        <span>${product.approved_price_count} approved price${product.approved_price_count === 1 ? "" : "s"}</span>
        <span>Updated ${escapeHtml(formatDate(product.last_reported_at || product.updated_at))}</span>
      </div>
      <details class="product-info-details">
        <summary>Label and product information</summary>
        <div class="inline-help">
          ${product.ingredient_info_url ? `<a href="${escapeHtml(product.ingredient_info_url)}" target="_blank" rel="noopener">Ingredient information source</a>` : "Ingredient info unknown."}
          ${product.allergen_note ? `<span>${escapeHtml(product.allergen_note)}</span>` : ""}
          ${product.admin_safety_note ? `<span>${escapeHtml(product.admin_safety_note)}</span>` : ""}
          <strong>Always check the package label before buying or eating.</strong>
        </div>
      </details>
      ${variantOptions.length ? `
        <div class="choice-chip-panel product-option-panel">
          <h4>Choose type</h4>
          <div class="quick-group">
            ${variantOptions.map((variant) => `
              <button class="quick-button ${variant === selectedVariant ? "is-selected" : ""}" type="button" data-product-detail-variant="${escapeHtml(variant)}">${escapeHtml(variant)}</button>
            `).join("")}
          </div>
        </div>
      ` : ""}
      ${sizeOptions.length ? `
        <div class="choice-chip-panel product-option-panel">
          <h4>Common sizes</h4>
          <div class="quick-group">
            ${sizeOptions.map((size) => `
              <button class="quick-button ${size === selectedSize ? "is-selected" : ""}" type="button" data-product-detail-size="${escapeHtml(size)}">${escapeHtml(size)}</button>
            `).join("")}
          </div>
        </div>
      ` : ""}
      <div class="cart-item-meta">
        <span>${escapeHtml(variantForCart || "Any type")}</span>
        <span>${escapeHtml(selectedSize || product.default_size_text || "Any size")}</span>
      </div>
      <div class="card-actions">
        <button class="primary-button ${isProductInCart(product.id) ? "is-complete" : ""}" type="button" data-product-add-cart>${isProductInCart(product.id) ? "In cart" : "Add to cart"}</button>
        <button class="secondary-button" type="button" data-product-add-price>Add price</button>
      </div>
      <details class="product-more-actions">
        <summary>More options</summary>
        <button class="quiet-button" type="button" data-product-suggest-edit>Suggest product edit</button>
      </details>
    </article>
    <section class="product-price-list">
      <div class="card-topline">
        <h3>Approved prices</h3>
        <label class="brand-filter-label">
          <span>Brand filter</span>
          <select id="productBrandFilter">
            <option value="">Any brand</option>
            ${brandOptions.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("")}
          </select>
        </label>
      </div>
      ${reports.length ? `
        <div class="compact-price-list">
          ${reports.map((report) => `
            <article class="price-list-row app-price-row compact-product-price-row ${String(report.id) === String(cheapestReport?.id || "") ? "is-cheapest" : ""}" data-product-price-row data-brand="${escapeHtml(report.brand || "Unknown brand")}">
              <div class="price-store-block">
                ${String(report.id) === String(cheapestReport?.id || "") ? '<span class="cheapest-row-label">Cheapest reported</span>' : ""}
                <strong>${escapeHtml(report.store_name)}</strong>
                <span>${escapeHtml(report.brand || "Unknown brand")} · ${escapeHtml(report.size_text || `${report.quantity} ${report.unit}`)}</span>
                <span>Updated ${escapeHtml(formatDate(report.submitted_at))}</span>
                ${renderReportTrustMeta(report)}
              </div>
              <div class="price-amount-block">
                <strong>${escapeHtml(report.price_label)}</strong>
                <span>${escapeHtml(report.unit_price_label)}</span>
              </div>
              <div class="compact-row-actions">
                <button class="secondary-button small-action-button ${isReportInCart(report) ? "is-complete" : ""}" type="button" data-detail-cart="${report.id}">${isReportInCart(report) ? "In cart" : "Add"}</button>
                <button class="quiet-button small-action-button" type="button" data-detail-verify="${report.id}">Verify price</button>
                <button class="quiet-button small-action-button" type="button" data-detail-report="${report.id}">Report wrong</button>
              </div>
            </article>
          `).join("")}
        </div>
      ` : '<div class="empty-state">Be the first to add a price. Earn points for contributing.</div>'}
    </section>
  `;
  for (const button of productDetailContent.querySelectorAll("[data-product-detail-variant]")) {
    button.addEventListener("click", () => {
      openProductDetail(product.id, {
        variant: button.dataset.productDetailVariant,
        size: selectedSize
      });
    });
  }

  for (const button of productDetailContent.querySelectorAll("[data-product-detail-size]")) {
    button.addEventListener("click", () => {
      openProductDetail(product.id, {
        variant: selectedVariant,
        size: button.dataset.productDetailSize
      });
    });
  }

  productDetailContent.querySelector("[data-product-add-cart]").addEventListener("click", (event) => {
    addProductToCart(product, event.currentTarget, { variant: selectedVariant, size: selectedSize });
  });
  productDetailContent.querySelector("[data-product-add-price]").addEventListener("click", () => {
    startPriceForProduct(product, { variant: selectedVariant, size: selectedSize });
  });
  productDetailContent.querySelector("[data-product-suggest-edit]").addEventListener("click", () => {
    switchView("searchView");
    document.querySelector("#suggestionForm [name='suggestion_type']").value = "feature_idea";
    document.querySelector("#suggestionForm [name='title']").value = `Product edit: ${product.display_name}`;
    document.querySelector("#suggestionForm [name='related_item']").value = product.display_name;
  });

  for (const button of productDetailContent.querySelectorAll("[data-detail-verify]")) {
    button.addEventListener("click", () => openVerifyDialog(button.dataset.detailVerify, "confirmed"));
  }

  for (const button of productDetailContent.querySelectorAll("[data-detail-report]")) {
    button.addEventListener("click", () => openVerifyDialog(button.dataset.detailReport, "price_different"));
  }

  for (const button of productDetailContent.querySelectorAll("[data-detail-cart]")) {
    const report = reports.find((item) => String(item.id) === button.dataset.detailCart);
    button.addEventListener("click", (event) => addReportToCart(report, event.currentTarget));
  }

  const brandFilter = productDetailContent.querySelector("#productBrandFilter");

  if (brandFilter) {
    brandFilter.addEventListener("change", () => {
      const selectedBrand = brandFilter.value;

      for (const row of productDetailContent.querySelectorAll("[data-product-price-row]")) {
        row.hidden = Boolean(selectedBrand) && row.dataset.brand !== selectedBrand;
      }
    });
  }

  switchView("productDetailView");
  loadSponsors("product", productSponsorSlot);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPlaceholderProduct(placeholderId, options = {}) {
  const placeholder = findPlaceholderById(placeholderId);

  if (!placeholder) {
    openTab("searchView");
    routeFallback("That product suggestion is no longer available. Showing search instead.");
    return;
  }

  const selectedVariant = options.variant || placeholder.variants?.[0] || "";
  const selectedSize = options.size || placeholder.sizes?.[0] || "";
  const variantForCart = displayPlaceholderVariant(selectedVariant);
  const inCart = isPlaceholderInCart(placeholder, selectedVariant);

  productDetailContent.innerHTML = `
    <article class="app-card product-hero-card placeholder-detail-card">
      <div class="card-topline">
        <span class="badge confidence-low">Product suggestion</span>
        <span>${escapeHtml(titleCase(placeholder.category))}</span>
      </div>
      <h3>${escapeHtml(placeholder.name)}</h3>
      <div class="inline-help">Be the first to add a price. Earn points for contributing.</div>
      <div class="choice-chip-panel product-option-panel">
        <h4>Choose type</h4>
        <div class="quick-group">
          ${(placeholder.variants || []).map((variant) => `
            <button class="quick-button ${variant === selectedVariant ? "is-selected" : ""}" type="button" data-placeholder-detail-variant="${escapeHtml(variant)}">${escapeHtml(variant)}</button>
          `).join("")}
        </div>
      </div>
      <div class="choice-chip-panel product-option-panel">
        <h4>Common sizes</h4>
        <div class="quick-group">
          ${(placeholder.sizes || []).map((size) => `
            <button class="quick-button ${size === selectedSize ? "is-selected" : ""}" type="button" data-placeholder-detail-size="${escapeHtml(size)}">${escapeHtml(size)}</button>
          `).join("")}
        </div>
      </div>
      <div class="product-detail-meta">
        <span>${escapeHtml(variantForCart || "Any type")}</span>
        <span>${escapeHtml(selectedSize || "Any size")}</span>
      </div>
      <div class="card-actions">
        <button class="primary-button ${inCart ? "is-complete" : ""}" type="button" data-placeholder-detail-cart>${inCart ? "In cart" : "Add to cart"}</button>
        <button class="secondary-button" type="button" data-placeholder-detail-submit>Submit a price</button>
      </div>
    </article>
    <section class="product-price-list">
      <div class="empty-state">Be the first to add a price. Earn points for contributing.</div>
    </section>
  `;

  for (const button of productDetailContent.querySelectorAll("[data-placeholder-detail-variant]")) {
    button.addEventListener("click", () => {
      openPlaceholderProduct(placeholder.id, {
        variant: button.dataset.placeholderDetailVariant,
        size: selectedSize
      });
    });
  }

  for (const button of productDetailContent.querySelectorAll("[data-placeholder-detail-size]")) {
    button.addEventListener("click", () => {
      openPlaceholderProduct(placeholder.id, {
        variant: selectedVariant,
        size: button.dataset.placeholderDetailSize
      });
    });
  }

  productDetailContent.querySelector("[data-placeholder-detail-cart]").addEventListener("click", (event) => {
    addPlaceholderToCart(placeholder, { variant: selectedVariant, size: selectedSize }, event.currentTarget);
  });
  productDetailContent.querySelector("[data-placeholder-detail-submit]").addEventListener("click", () => {
    startPriceForPlaceholder(placeholder, { variant: selectedVariant, size: selectedSize });
  });

  switchView("productDetailView");
  loadSponsors("product", productSponsorSlot);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setQuickSelection(selector, value) {
  for (const button of document.querySelectorAll(selector)) {
    button.classList.toggle("is-selected", button.dataset.quickPrice === value ||
      button.dataset.quickSize === value ||
      button.dataset.quickItem === value ||
      button.dataset.quickBrand === value ||
      button.dataset.proofChoice === value);
  }
}

function syncProofChoices() {
  setQuickSelection("[data-proof-choice]", proofTypeSelect.value);
}

function clearSubmitErrors() {
  for (const error of submitForm.querySelectorAll("[data-error-for]")) {
    error.textContent = "";
  }
}

function setFieldError(name, message) {
  const error = submitForm.querySelector(`[data-error-for="${name}"]`);

  if (error) {
    error.textContent = message;
  }
}

function focusSubmitField(name) {
  const stepByField = {
    store_id: "store",
    item_name: "product",
    brand: "brand",
    category: "product",
    size_text: "size",
    quantity: "size",
    unit: "size",
    price: "price",
    regular_price: "price",
    sale_price: "price",
    expires_at: "price",
    proof_type: "proof",
    proof_photo: "proof",
    source_url: "proof",
    notes: "review"
  };
  openSubmitStep(stepByField[name] || activeSubmitStep || "store");
  const field = submitField(name);

  if (field && typeof field.focus === "function") {
    field.focus();
  }
}

function validateGuidedSubmitForm() {
  clearSubmitErrors();
  const errors = [];
  const storeId = submitField("store_id").value.trim();
  const itemName = submitField("item_name").value.trim();
  const category = submitField("category").value.trim();
  const priceValue = submitField("price").value.trim();
  const regularPriceValue = submitField("regular_price").value.trim();
  const sizeText = submitField("size_text").value.trim();
  const quantityValue = submitField("quantity").value.trim();
  const unit = submitField("unit").value.trim();
  const proofType = submitField("proof_type").value.trim();
  const sourceUrl = submitField("source_url")?.value.trim() || "";
  const price = Number(priceValue);
  const regularPrice = Number(regularPriceValue);
  const quantity = Number(quantityValue);

  if (!storeId) {
    errors.push(["store_id", "Please choose a store."]);
  }

  if (priceValue && (!Number.isFinite(price) || price < 0.01)) {
    errors.push(["price", "Price is optional. Leave it blank or enter a number like 2.49."]);
  } else if (priceValue && price > 999) {
    errors.push(["price", "Please enter a price under $999."]);
  }

  if (regularPriceValue && (!Number.isFinite(regularPrice) || regularPrice < 0.01 || regularPrice > 999)) {
    errors.push(["regular_price", "Regular price is optional. Leave it blank or enter a number like 3.99."]);
  }

  if (quantityValue && (!Number.isFinite(quantity) || quantity <= 0)) {
    errors.push(["quantity", "Quantity is optional. Leave it blank or enter a positive number."]);
  }

  if (!proofType) {
    errors.push(["proof_type", "Please choose a proof type."]);
  }

  if (!(proofPhotoInput.files && proofPhotoInput.files[0]) && !sourceUrl) {
    errors.push(["proof_photo", "Upload a proof image or add a source link."]);
  }

  if (sourceUrl) {
    try {
      const parsedUrl = new URL(sourceUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        errors.push(["source_url", "Source link must start with http:// or https://."]);
      }
    } catch (error) {
      errors.push(["source_url", "Enter a valid source link or leave it blank."]);
    }
  }

  for (const [name, message] of errors) {
    setFieldError(name, message);
  }

  return errors;
}

function renderSuggestedSizes(sizes = []) {
  suggestedSizeButtons.innerHTML = "";

  if (!sizes.length) {
    suggestedSizeWrap.hidden = true;
    if (genericSizeButtons) {
      genericSizeButtons.hidden = false;
    }
    return;
  }

  if (genericSizeButtons) {
    genericSizeButtons.hidden = true;
  }

  for (const size of sizes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.dataset.quickSize = size;
    button.textContent = size;
    button.addEventListener("click", () => applyQuickSize(size));
    suggestedSizeButtons.appendChild(button);
  }

  suggestedSizeWrap.hidden = false;
}

function renderPlaceholderVariants(variants = [], selectedVariant = "") {
  placeholderVariantButtons.innerHTML = "";

  if (!variants.length) {
    placeholderVariantWrap.hidden = true;
    return;
  }

  const options = [...variants, "Other / custom"];

  for (const variant of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.dataset.placeholderVariant = variant;
    button.textContent = variant;
    button.classList.toggle("is-selected", variant === selectedVariant);
    button.addEventListener("click", () => applyPlaceholderVariant(variant));
    placeholderVariantButtons.appendChild(button);
  }

  placeholderVariantWrap.hidden = false;
}

function renderQuickItems(groupName = "Food Basics") {
  const items = quickItemGroupsData[groupName] || quickItemGroupsData["Food Basics"];
  const visibleItems = items.slice(0, quickItemLimit);
  quickItemButtons.innerHTML = "";
  activeQuickItemGroup = groupName;

  for (const item of visibleItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.dataset.quickItem = item;
    button.textContent = item;
    button.addEventListener("click", () => applyQuickItem(item));
    quickItemButtons.appendChild(button);
  }

  if (items.length > visibleItems.length) {
    const moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.className = "quick-button";
    moreButton.dataset.quickMore = groupName;
    moreButton.textContent = `Show ${items.length - visibleItems.length} more`;
    moreButton.addEventListener("click", () => {
      quickItemLimit += 12;
      renderQuickItems(groupName);
    });
    quickItemButtons.appendChild(moreButton);
  }

  for (const button of quickItemGroups.querySelectorAll("[data-quick-group]")) {
    button.classList.toggle("is-selected", button.dataset.quickGroup === groupName);
  }
}

function renderQuickItemGroups() {
  quickItemGroups.innerHTML = "";

  for (const groupName of Object.keys(quickItemGroupsData)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.dataset.quickGroup = groupName;
    button.textContent = quickGroupLabels[groupName] || groupName;
    button.addEventListener("click", () => {
      if (groupName === "Custom") {
        focusSubmitField("item_name");
      }

      quickItemLimit = 12;
      renderQuickItems(groupName);
    });
    quickItemGroups.appendChild(button);
  }

  renderQuickItems("Food Basics");
}

function renderAvoidIngredientChips() {
  avoidIngredientChips.innerHTML = "";

  for (const ingredient of commonAvoidIngredients) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.textContent = ingredient;
    button.addEventListener("click", () => {
      const current = avoidIngredientsInput.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!current.map((value) => value.toLowerCase()).includes(ingredient.toLowerCase())) {
        current.push(ingredient);
      }

      avoidIngredientsInput.value = current.join(", ");
    });
    avoidIngredientChips.appendChild(button);
  }
}

function applyQuickItem(value) {
  if (value === "Custom") {
    setQuickSelection("[data-quick-item]", value);
    openSubmitStep("product");
    updateSubmitStepSummaries();
    focusSubmitField("item_name");
    return;
  }

  const preset = quickItems[value];
  const placeholder = findPlaceholderByName(value);
  submitField("item_name").value = value;

  if (preset?.category) {
    submitField("category").value = preset.category;
  }

  if (placeholder) {
    setSelectedPlaceholder(placeholder, { openStep: "brand" });
  } else {
    renderSuggestedSizes(preset?.sizes || []);
  }

  setQuickSelection("[data-quick-item]", value);
  setFieldError("item_name", "");
  setFieldError("category", "");
  updateSubmitStepSummaries();

  if (!placeholder) {
    lookupProductForQuickItem(value);
  }
}

function applyQuickBrand(value) {
  if (value === "Custom") {
    setQuickSelection("[data-quick-brand]", value);
    openSubmitStep("brand");
    updateSubmitStepSummaries();
    focusSubmitField("brand");
    return;
  }

  submitField("brand").value = value;
  setQuickSelection("[data-quick-brand]", value);
  updateSubmitStepSummaries();
  openSubmitStep("size");
}

function applyPlaceholderVariant(value) {
  if (value === "Other / custom") {
    for (const button of placeholderVariantButtons.querySelectorAll("[data-placeholder-variant]")) {
      button.classList.toggle("is-selected", button.dataset.placeholderVariant === value);
    }
    focusSubmitField("brand");
    return;
  }

  if (selectedSubmitPlaceholder) {
    selectedSubmitPlaceholder.selectedVariant = value;
  }

  const variantForField = displayPlaceholderVariant(value);
  submitField("brand").value = variantForField;

  for (const button of placeholderVariantButtons.querySelectorAll("[data-placeholder-variant]")) {
    button.classList.toggle("is-selected", button.dataset.placeholderVariant === value);
  }

  setFieldError("brand", "");
  updateSubmitStepSummaries();
  openSubmitStep("size");
}

function applyQuickPrice(value) {
  if (value === "Custom") {
    setQuickSelection("[data-quick-price]", value);
    openSubmitStep("price");
    updateSubmitStepSummaries();
    focusSubmitField("price");
    return;
  }

  submitField("price").value = value;
  setQuickSelection("[data-quick-price]", value);
  setFieldError("price", "");
  updateSubmitStepSummaries();
  openSubmitStep("proof");
}

function applyQuickSize(value) {
  if (value === "Custom") {
    setQuickSelection("[data-quick-size]", value);
    openSubmitStep("size");
    updateSubmitStepSummaries();
    focusSubmitField("size_text");
    return;
  }

  const parsed = parseSizeSuggestion(value);
  submitField("size_text").value = parsed.size_text;

  if (parsed.quantity && parsed.unit) {
    submitField("quantity").value = parsed.quantity;
    submitField("unit").value = parsed.unit;
  }

  if (selectedSubmitPlaceholder) {
    selectedSubmitPlaceholder.selectedSize = parsed.size_text;
  }

  setQuickSelection("[data-quick-size]", parsed.size_text);
  setFieldError("size_text", "");
  setFieldError("quantity", "");
  setFieldError("unit", "");
  updateSubmitStepSummaries();
  openSubmitStep("price");
}

function applyProofChoice(value) {
  proofTypeSelect.value = value;
  updateProofPhotoRequirement();
  setFieldError("proof_type", "");
  setFieldError("proof_photo", "");
  updateSubmitStepSummaries();

  if (value === "store_page") {
    openSubmitStep("review");
  }
}

function clearQuickSelections() {
  for (const button of document.querySelectorAll(".quick-button, .proof-choice")) {
    button.classList.remove("is-selected");
  }

  renderSuggestedSizes([]);
  renderPlaceholderVariants([]);
  syncProofChoices();
}

function syncPriceButtonFromInput() {
  const value = submitField("price").value.trim();

  for (const button of document.querySelectorAll("[data-quick-price]")) {
    button.classList.toggle("is-selected", button.dataset.quickPrice === value);
  }
}

function resetSubmitFormForNext(mode) {
  const storeId = lastSubmitContext?.storeId || "";
  const proofType = lastSubmitContext?.proofType || "receipt";

  submitForm.reset();
  clearSubmitErrors();
  clearQuickSelections();

  if (mode === "same-store" || mode === "same-receipt") {
    submitField("store_id").value = storeId;
  }

  if (mode === "same-receipt") {
    submitField("proof_type").value = "receipt";
    setMessage(submitMessage, "Ready for another proof from the same receipt if needed.", "info");
  } else if (mode === "same-store") {
    submitField("proof_type").value = proofType;
    setMessage(submitMessage, "Ready for another proof from the same store.", "info");
  }

  updateProofPhotoRequirement();
  updateSubmitStepSummaries();
  submitSuccessActions.hidden = true;
  switchView("submitView");
  openSubmitStep(mode === "same-store" || mode === "same-receipt" ? "product" : "store");

  const itemStep = document.querySelector("#itemStep");

  if (itemStep) {
    itemStep.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  focusSubmitField("item_name");
}

function handleSubmitNext(event) {
  const button = event.target.closest("[data-submit-next]");

  if (!button) {
    return;
  }

  const mode = button.dataset.submitNext;

  if (mode === "done") {
    submitSuccessActions.hidden = true;
    setMessage(submitMessage, "", "info");
    switchView("searchView");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (mode === "my-reports") {
    submitSuccessActions.hidden = true;
    setAccountSection("reports");
    return;
  }

  resetSubmitFormForNext(mode);
}

function setupGuidedSubmitHelpers() {
  renderQuickItemGroups();
  renderAvoidIngredientChips();

  submitForm.addEventListener("input", (event) => {
    const field = event.target;

    if (!field.name) {
      return;
    }

    setFieldError(field.name, "");

    if (field.name === "price") {
      syncPriceButtonFromInput();
    }

    if (field.name === "item_name" && selectedSubmitProduct &&
      field.value.trim().toLowerCase() !== selectedSubmitProduct.display_name.toLowerCase()) {
      clearSelectedProduct();
    }

    if (field.name === "item_name" && selectedSubmitPlaceholder &&
      field.value.trim().toLowerCase() !== selectedSubmitPlaceholder.name.toLowerCase()) {
      clearSelectedProduct();
    }

    updateSubmitStepSummaries();
  });

  submitForm.addEventListener("change", (event) => {
    const field = event.target;

    if (!field.name) {
      return;
    }

    setFieldError(field.name, "");

    if (field.name === "store_id" && field.value) {
      openSubmitStep("proof");
    }

    if (field.name === "proof_type" || field.name === "source_url") {
      updateProofPhotoRequirement();
    }

    updateSubmitStepSummaries();
  });

  for (const button of document.querySelectorAll("[data-quick-brand]")) {
    button.addEventListener("click", () => applyQuickBrand(button.dataset.quickBrand));
  }

  for (const button of document.querySelectorAll("[data-quick-price]")) {
    button.addEventListener("click", () => applyQuickPrice(button.dataset.quickPrice));
  }

  for (const button of document.querySelectorAll("[data-quick-size]")) {
    button.addEventListener("click", () => applyQuickSize(button.dataset.quickSize));
  }

  for (const button of document.querySelectorAll("[data-proof-choice]")) {
    button.addEventListener("click", () => applyProofChoice(button.dataset.proofChoice));
  }

  submitSuccessActions.addEventListener("click", handleSubmitNext);
}

async function loadCurrentUser() {
  const data = await fetchJson("/api/auth/me");
  currentUser = data.loggedIn ? data.user : null;
  renderAuthState();
  await loadAdminAlertBadge();
}

async function loadStores() {
  const data = await fetchJson("/api/stores");
  const storeFilter = document.querySelector("#storeFilter");
  const submitStore = document.querySelector("#submitStore");

  for (const store of data.stores) {
    const filterOption = document.createElement("option");
    filterOption.value = store.id;
    filterOption.textContent = store.name;
    storeFilter.appendChild(filterOption);

    const submitOption = document.createElement("option");
    submitOption.value = store.id;
    submitOption.textContent = store.name;
    submitStore.appendChild(submitOption);
  }
}

function renderResults(products = [], reports = [], limit = 16) {
  resultsList.innerHTML = "";
  const searchData = new FormData(searchForm);
  const searchQuery = String(searchData.get("q") || "").trim();
  const hasFilter = Boolean(String(searchData.get("store") || "").trim() || String(searchData.get("category") || "").trim());
  browsePanel.hidden = activePublicTab === "home" && Boolean(searchQuery || hasFilter);

  if (!searchQuery && !hasFilter) {
    resultsSummary.textContent = "";
    return;
  }

  if (!products.length && !reports.length) {
    const placeholderSuggestions = placeholderSuggestionsForQuery(searchQuery, searchQuery ? 12 : 8);
    resultsSummary.textContent = "";

    if (placeholderSuggestions.length) {
      resultsSummary.textContent = "Suggested items";
      for (const suggestion of placeholderSuggestions) {
        resultsList.appendChild(renderPlaceholderCard(suggestion.placeholder, { variant: suggestion.variant }));
      }
    } else {
      resultsList.innerHTML = `
        <div class="empty-state">
          Be the first to add a price. Earn points for contributing.
        </div>
      `;
    }
    return;
  }

  resultsSummary.textContent = "Results";

  const visibleProducts = products.slice(0, limit);
  const remainingSlots = Math.max(0, limit - visibleProducts.length);
  const visibleReports = reports.slice(0, remainingSlots);

  for (const product of visibleProducts) {
    resultsList.appendChild(renderProductCard(product));
  }

  for (const report of visibleReports) {
    const article = document.createElement("article");
    article.className = "result-card app-price-card app-shop-card grocery-product-tile";
    article.tabIndex = 0;
    const inCart = isReportInCart(report);
    const size = report.size_text || `${report.quantity} ${report.unit}`;

    article.innerHTML = `
	      <div class="shop-card-body">
	        <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(report.product_display_name || report.item_name, report.category))}</div>
	        <div>
          <h3>${escapeHtml(report.product_display_name || report.item_name)}</h3>
          <span>${escapeHtml(report.store_name)}</span>
        </div>
        <div class="shop-card-price">
          <strong>${escapeHtml(report.price_label)}</strong>
	          <span>${escapeHtml(size)}</span>
	        </div>
	      </div>
	      ${renderReportTrustMeta(report)}
	      <div class="compact-card-actions">
        <button class="add-circle-button ${inCart ? "is-complete" : ""}" type="button" data-add-cart="${report.id}" aria-label="Add ${escapeHtml(report.item_name)} to cart">${inCart ? "✓" : "+"}</button>
      </div>
    `;

    article.addEventListener("click", () => openBrowseReport(report));
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openBrowseReport(report);
      }
    });
    article.querySelector("[data-add-cart]").addEventListener("click", (event) => {
      event.stopPropagation();
      addReportToCart(report, event.currentTarget);
    });
    resultsList.appendChild(article);
  }

  if (products.length + reports.length > limit) {
    const loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.className = "secondary-button load-more-button";
    loadMore.textContent = "Show more results";
    loadMore.addEventListener("click", () => renderResults(products, reports, limit + 16));
    resultsList.appendChild(loadMore);
  }

  for (const report of visibleReports) {
    trackClientEvent({
      event_type: "report_viewed",
      report_id: report.id,
      product_id: report.product_id,
      store_id: report.store_id,
      cart_item_name: report.product_display_name || report.item_name,
      category: report.category
    });
  }
}

function renderBrowseReportRow(report) {
  const size = report.size_text || `${report.quantity} ${report.unit}`;
  const label = report.product_display_name || report.item_name;
  return `
    <article class="mini-row compact-price-preview-row">
      <div class="compact-price-preview-main">
        <span class="compact-preview-icon" aria-hidden="true">${escapeHtml(productIcon(label, report.category))}</span>
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(report.store_name)} · ${escapeHtml(report.brand || "Unknown brand")} · ${escapeHtml(size)}</span>
        </div>
        <b>${escapeHtml(report.price_label)}</b>
        ${renderReportTrustMeta(report)}
      </div>
      <div class="compact-row-actions">
        <button class="quiet-button small-action-button" type="button" data-browse-report-view="${report.id}">View</button>
        <button class="secondary-button small-action-button" type="button" data-browse-report-cart="${report.id}">Add</button>
      </div>
    </article>
  `;
}

function renderProductChoice(choice) {
  const sizeText = choice.sizes?.length ? choice.sizes.slice(0, 3).join(" · ") : "Sizes vary";
  const variantText = choice.variants?.length
    ? choice.variants.slice(0, 3).map(displayPlaceholderVariant).filter(Boolean).join(", ") || "Any type"
    : "Choose type";
  const priceText = choice.approved_price_count
    ? choice.best_price_label || `${choice.approved_price_count} price${choice.approved_price_count === 1 ? "" : "s"}`
    : "Add a price";
  const targetAttribute = choice.type === "product"
    ? `data-browse-choice-product="${escapeHtml(choice.id)}"`
    : `data-browse-choice-placeholder="${escapeHtml(choice.id)}"`;

  return `
    <button class="product-choice-card" type="button" ${targetAttribute}>
      <span class="product-choice-icon" aria-hidden="true">${escapeHtml(productIcon(choice.name, choice.category))}</span>
      <strong>${escapeHtml(choice.name)}</strong>
      <span>${escapeHtml(variantText)}</span>
      <small>${escapeHtml(sizeText)}</small>
      <em class="${choice.approved_price_count ? "has-price" : ""}">${escapeHtml(priceText)}</em>
    </button>
  `;
}

function bindBrowseChoiceButtons(scope = browsePanel) {
  for (const button of scope.querySelectorAll("[data-browse-choice-product]")) {
    button.addEventListener("click", () => openProductDetail(button.dataset.browseChoiceProduct));
  }

  for (const button of scope.querySelectorAll("[data-browse-choice-placeholder]")) {
    button.addEventListener("click", () => openPlaceholderProduct(button.dataset.browseChoicePlaceholder));
  }
}

function storeLogoLabel(name = "") {
  const cleanName = String(name || "Store").replace(/\s+Janesville$/i, "").trim();
  const known = [
    ["woodman", "Woodman's"],
    ["walmart", "Walmart"],
    ["target", "Target"],
    ["festival", "Festival"],
    ["hy-vee", "Hy-Vee"],
    ["pick", "Pick 'n Save"],
    ["daniels", "Daniels Foods Sentry"],
    ["sentry", "Sentry"],
    ["basic", "Basic Foods"],
    ["santa maria", "Santa Maria"],
    ["kwik", "Kwik Trip"],
    ["walgreens", "Walgreens"],
    ["cvs", "CVS"],
    ["aldi", "ALDI"],
    ["sam", "Sam's Club"],
    ["dollar tree", "Dollar Tree"],
    ["dollar general", "Dollar General"]
  ];
  const lower = cleanName.toLowerCase();
  const match = known.find(([needle]) => lower.includes(needle));
  return match ? match[1] : cleanName;
}

function renderStoreMiniCard(store, type = "deal") {
  const label = storeLogoLabel(store.name);
  const action = type === "coupon" ? "Clip Coupon" : "View prices";
  const message = type === "coupon" ? "No coupon available yet." : "No approved deal yet.";
  return `
    <article class="store-mini-card">
      <div class="store-logo-wordmark">${escapeHtml(label)}</div>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(message)}</span>
      <button class="quiet-button small-action-button" type="button" disabled>${escapeHtml(action)}</button>
    </article>
  `;
}

function renderStoreLogoCard(store) {
  const label = storeLogoLabel(store.name);
  return `
    <button class="store-logo-card" type="button" data-store-filter="${store.id}">
      <span class="store-logo-wordmark">${escapeHtml(label)}</span>
      <strong>${escapeHtml(label)}</strong>
      <small>View approved prices</small>
    </button>
  `;
}

const homepageStoreBrands = [
  { label: "Walmart", key: "walmart", match: ["walmart"] },
  { label: "Festival Foods", key: "festival", match: ["festival"] },
  { label: "ALDI", key: "aldi", match: ["aldi"] },
  { label: "Hy-Vee", key: "hyvee", match: ["hy-vee", "hy vee"] },
  { label: "Pick 'n Save", key: "picknsave", match: ["pick"] },
  { label: "Woodman's", key: "woodmans", match: ["woodman"] }
];

const homepageFeaturedProducts = [
  { name: "Milk", icon: "🥛", terms: ["milk"] },
  { name: "Eggs", icon: "🥚", terms: ["egg"] },
  { name: "Bread", icon: "🍞", terms: ["bread"] },
  { name: "Bananas", icon: "🍌", terms: ["banana"] },
  { name: "Chicken", icon: "🍗", terms: ["chicken"] }
];

function renderHomepageStoreBrand(brand, stores) {
  const store = stores.find((item) => {
    const name = String(item.name || "").toLowerCase();
    return brand.match.some((term) => name.includes(term));
  });

  if (!store) {
    return `
      <article class="store-logo-card is-unavailable" data-store-brand="${brand.key}">
        <span class="store-logo-wordmark">${escapeHtml(brand.label)}</span>
        <strong>${escapeHtml(brand.label)}</strong>
        <small>No reports yet</small>
      </article>
    `;
  }

  return `
    <button class="store-logo-card" type="button" data-store-filter="${store.id}" data-store-brand="${brand.key}">
      <span class="store-logo-wordmark">${escapeHtml(brand.label)}</span>
      <strong>${escapeHtml(brand.label)}</strong>
      <small>View approved prices</small>
    </button>
  `;
}

function renderFeaturedReportCard(report) {
  if (!report) {
    return `
      <div class="featured-price-card is-empty">
        <div class="item-icon" aria-hidden="true">🛒</div>
        <div>
          <span class="featured-label">Cheapest reported price</span>
          <h3>Be the first to add a price</h3>
          <p>Earn points for contributing.</p>
        </div>
        <button class="secondary-button" type="button" data-featured-submit>Submit proof</button>
      </div>
    `;
  }

  const label = report.product_display_name || report.item_name;
  const size = report.size_text || `${report.quantity} ${report.unit}`;
  return `
    <article class="featured-price-card">
      <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(label, report.category))}</div>
      <div class="featured-price-main">
        <span class="featured-label">Cheapest reported price available now</span>
        <h3>${escapeHtml(label)}</h3>
        <p>${escapeHtml(report.store_name)} · ${escapeHtml(report.brand || "Unknown brand")} · ${escapeHtml(size)}</p>
        ${renderReportTrustMeta(report)}
      </div>
      <strong class="featured-price">${escapeHtml(report.price_label)}</strong>
      <div class="featured-actions">
        <button class="secondary-button small-action-button" type="button" data-browse-report-view="${report.id}">View</button>
        <button class="primary-button small-action-button" type="button" data-browse-report-cart="${report.id}">Add to cart</button>
      </div>
    </article>
  `;
}

function featuredProductReport(feature, reports) {
  return reports.find((report) => {
    const label = String(report.product_display_name || report.item_name || "").toLowerCase();
    return feature.terms.some((term) => label.includes(term));
  }) || null;
}

function renderHomepageFeaturedProduct(feature, reports) {
  const report = featuredProductReport(feature, reports);

  if (!report) {
    return `
      <article class="home-feature-product-card is-empty">
        <span class="home-feature-product-icon" aria-hidden="true">${feature.icon}</span>
        <h3>${escapeHtml(feature.name)}</h3>
        <p>Be the first to add a price</p>
        <button class="quiet-button small-action-button" type="button" data-featured-product-submit="${escapeHtml(feature.name)}">Add price</button>
      </article>
    `;
  }

  const label = report.product_display_name || report.item_name;
  const size = report.size_text || `${report.quantity} ${report.unit}`;
  return `
    <article class="home-feature-product-card">
      <span class="home-feature-product-icon" aria-hidden="true">${feature.icon}</span>
      <h3>${escapeHtml(feature.name)}</h3>
      <p>${escapeHtml(report.store_name)}</p>
      <div class="home-feature-price">
        <strong>${escapeHtml(report.price_label)}</strong>
        <span>${escapeHtml(size)}</span>
      </div>
      ${renderReportTrustMeta(report)}
      <button class="quiet-button small-action-button" type="button" data-browse-report-view="${report.id}">View price</button>
    </article>
  `;
}

function renderRailReportCard(report) {
  const size = report.size_text || `${report.quantity} ${report.unit}`;
  const label = report.product_display_name || report.item_name;
  return `
    <article class="rail-price-card">
      <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(label, report.category))}</div>
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(report.store_name)}</span>
      <div class="rail-price-line">
        <b>${escapeHtml(report.price_label)}</b>
        <small>${escapeHtml(size)}</small>
      </div>
      ${renderReportTrustMeta(report)}
      <button class="add-circle-button" type="button" data-browse-report-cart="${report.id}" aria-label="Add ${escapeHtml(label)} to cart">+</button>
    </article>
  `;
}

function renderRailSection(title, content, options = {}) {
  return `
    <section class="browse-section rail-section ${options.className || ""}">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${options.action ? options.action : ""}
      </div>
      ${content}
    </section>
  `;
}

function bindReportRailActions(reports = []) {
  for (const button of browsePanel.querySelectorAll("[data-browse-report-cart]")) {
    const report = reports.find((item) => String(item.id) === button.dataset.browseReportCart);
    button.addEventListener("click", (event) => addReportToCart(report, event.currentTarget));
  }

  for (const button of browsePanel.querySelectorAll("[data-browse-report-view]")) {
    const report = reports.find((item) => String(item.id) === button.dataset.browseReportView);
    button.addEventListener("click", () => openBrowseReport(report));
  }
}

function bindCategoryButtons() {
  for (const button of browsePanel.querySelectorAll("[data-browse-group]")) {
    button.addEventListener("click", () => {
      openTab("searchView", { publicTab: "browse", group: button.dataset.browseGroup });
    });
  }

  browsePanel.querySelector("[data-browse-more]")?.addEventListener("click", () => {
    document.querySelector("#searchInput")?.focus();
  });
}

function bindStoreFilterButtons() {
  for (const button of browsePanel.querySelectorAll("[data-store-filter]")) {
    button.addEventListener("click", () => {
      document.querySelector("#storeFilter").value = button.dataset.storeFilter;
      loadResults()
        .then(() => resultsList.scrollIntoView({ behavior: "smooth", block: "start" }))
        .catch((error) => {
          resultsSummary.textContent = error.message;
        });
    });
  }
}

function renderHomeRails(data = {}) {
  const reports = (data.recently_approved_reports || []).slice(0, 12);
  const stores = (data.stores || []).slice(0, 12);
  const featuredReport = [...reports].sort((a, b) => {
    const aPrice = Number(a.unit_price ?? a.price ?? Number.POSITIVE_INFINITY);
    const bPrice = Number(b.unit_price ?? b.price ?? Number.POSITIVE_INFINITY);
    return aPrice - bPrice;
  })[0] || null;
  const deals = reports.filter((report) => Boolean(report.sale_price));

  browsePanel.innerHTML = `
    <section class="home-savings-section">
      <div class="home-savings-copy">
        <span>Shop with a quick price check</span>
        <h2>You could save money today</h2>
        <p>Compare approved local reports before choosing a store.</p>
      </div>
      ${renderFeaturedReportCard(featuredReport)}
    </section>
    ${renderRailSection("Featured products", `<div class="home-feature-product-grid">${homepageFeaturedProducts.map((feature) => renderHomepageFeaturedProduct(feature, reports)).join("")}</div>`)}
    ${renderRailSection("Featured stores", `<div class="store-logo-grid featured-store-grid">${homepageStoreBrands.map((brand) => renderHomepageStoreBrand(brand, stores)).join("")}</div>`)}
    ${renderRailSection("Approved deals", deals.length
      ? `<div class="app-rail">${deals.map(renderRailReportCard).join("")}</div>`
      : '<div class="empty-state compact-empty">No approved sale deals yet.</div>')}
  `;

  bindReportRailActions(reports);
  bindStoreFilterButtons();
  browsePanel.querySelector("[data-featured-submit]")?.addEventListener("click", () => openTab("submitView"));
  for (const button of browsePanel.querySelectorAll("[data-featured-product-submit]")) {
    button.addEventListener("click", () => {
      openTab("submitView");
      const itemInput = submitForm.querySelector("[name='item_name']");
      if (itemInput) {
        itemInput.value = button.dataset.featuredProductSubmit;
        itemInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
}

function openBrowseReport(report) {
  if (!report) {
    routeFallback("That price preview is no longer available.");
    return;
  }

  if (report.product_id) {
    openProductDetail(report.product_id);
    return;
  }

  const placeholder = findPlaceholderByName(report.product_display_name || report.item_name);

  if (placeholder) {
    openPlaceholderProduct(placeholder.id, { size: report.size_text || "" });
    return;
  }

  document.querySelector("#searchInput").value = report.item_name;
  openTab("searchView");
  loadResults().catch((error) => {
    resultsSummary.textContent = error.message;
  });
}

function renderBrowse(data = {}, selectedGroup = "") {
  browsePanel.hidden = false;
  const products = data.products || [];
  const reports = data.recently_approved_reports || [];
  const stores = data.stores || [];
  const selectedLabel = browseCategoryGroups.find((group) => group.key === selectedGroup)?.label || "";
  const selectedTitle = browseGroupTitle(selectedGroup);
  const emptyBrowseText = selectedLabel
    ? "Be the first to add a price in this category."
    : "Be the first to add a price. Earn points for contributing.";
  const productChoices = productChoicesForBrowseGroup(selectedGroup, products);
  const browseLandingChoices = productChoicesForBrowseGroup("", products).slice(0, 30);

  if (!selectedGroup && activePublicTab === "home") {
    renderHomeRails(data);
    return;
  }

  if (selectedGroup) {
    browsePanel.innerHTML = `
      <section class="browse-category-page">
        <div class="browse-category-header">
          <button class="quiet-button small-action-button" type="button" data-browse-clear>All categories</button>
          <h3>${escapeHtml(selectedTitle)}</h3>
          <p>Choose a product, then compare approved local prices.</p>
        </div>
        <div class="browse-section">
          <h3>Choose a product</h3>
          <div class="product-choice-grid">
            ${productChoices.length ? productChoices.map(renderProductChoice).join("") : `<div class="empty-state">No product choices in this category yet.</div>`}
          </div>
        </div>
        <details class="browse-section approved-preview-details">
          <summary>Show approved prices</summary>
          <div class="mini-list compact-price-preview-list">
            ${reports.length ? reports.map(renderBrowseReportRow).join("") : `<div class="empty-state">${escapeHtml(emptyBrowseText)}</div>`}
          </div>
        </details>
      </section>
    `;

    browsePanel.querySelector("[data-browse-clear]")?.addEventListener("click", () => {
      openTab("searchView", { publicTab: "browse", group: "" });
    });

    bindBrowseChoiceButtons();

    for (const button of browsePanel.querySelectorAll("[data-browse-report-view]")) {
      const report = reports.find((item) => String(item.id) === button.dataset.browseReportView);
      button.addEventListener("click", () => openBrowseReport(report));
    }

    for (const button of browsePanel.querySelectorAll("[data-browse-report-cart]")) {
      const report = reports.find((item) => String(item.id) === button.dataset.browseReportCart);
      button.addEventListener("click", (event) => addReportToCart(report, event.currentTarget));
    }

    return;
  }

  browsePanel.innerHTML = `
    <section class="browse-section browse-search-strip browse-intro-card">
      <div class="section-title-row">
        <h3>Browse groceries</h3>
        <button class="quiet-button small-action-button" type="button" data-home-action="cart-add-custom">Quick add</button>
      </div>
      <p class="field-help">Tap a category, then pick the item you want to compare.</p>
    </section>

    <section class="browse-section">
      <div class="section-title-row">
        <h3>Categories</h3>
      </div>
      <div class="category-card-grid">
        ${browseCategoryGroups.map((group) => {
          const meta = browseCategoryMeta[group.key] || { icon: "🛒", helper: "" };
          return `
          <button class="category-card" type="button" data-browse-group="${group.key}">
            <span class="category-icon" aria-hidden="true">${meta.icon}</span>
            <strong>${escapeHtml(group.label)}</strong>
          </button>
        `;
        }).join("")}
        <button class="category-card category-card-more" type="button" data-browse-more>
          <span class="category-icon" aria-hidden="true">•••</span>
          <strong>More</strong>
        </button>
      </div>
    </section>

    <section class="browse-section browse-product-choice-section">
      <div class="section-title-row">
        <h3>Product choices</h3>
      </div>
      <div class="product-choice-grid browse-choice-grid">
        ${browseLandingChoices.length ? browseLandingChoices.map(renderProductChoice).join("") : `<div class="empty-state compact-empty">No product choices yet.</div>`}
      </div>
    </section>

    <section class="browse-section store-filter-section">
      <div class="section-title-row">
        <h3>Stores</h3>
      </div>
      <div class="app-rail store-filter-rail">
        ${stores.length
          ? stores.map((store) => `
            <button class="store-filter-chip" type="button" data-store-filter="${store.id}">
              <span class="store-logo-wordmark">${escapeHtml(storeLogoLabel(store.name))}</span>
              <strong>${escapeHtml(storeLogoLabel(store.name))}</strong>
            </button>
          `).join("")
          : '<div class="empty-state compact-empty">No active stores yet.</div>'}
      </div>
    </section>

    <details class="browse-section approved-preview-details browse-approved-preview">
      <summary>Recently approved prices</summary>
      <div class="mini-list compact-price-preview-list">
        ${reports.length ? reports.slice(0, 12).map(renderBrowseReportRow).join("") : `<div class="empty-state compact-empty">No approved prices yet. Submit one if you see it.</div>`}
      </div>
    </details>

    <section class="browse-section browse-verified-strip">
      <div class="section-title-row">
        <h3>Recent verified prices</h3>
      </div>
      ${reports.filter((report) => Number(report.verification_count || 0) > 0 || ["high", "medium-high"].includes(report.confidence)).length
        ? `<div class="app-rail">${reports.filter((report) => Number(report.verification_count || 0) > 0 || ["high", "medium-high"].includes(report.confidence)).map(renderRailReportCard).join("")}</div>`
        : `<div class="empty-state compact-empty">No verified prices yet.</div>`}
    </section>
  `;

  bindCategoryButtons();
  bindBrowseChoiceButtons();
  bindReportRailActions(reports);

  bindStoreFilterButtons();

  browsePanel.querySelector('[data-home-action="cart-add-custom"]')?.addEventListener("click", () => {
    openTab("cartView");
    if (cartAddDetails) {
      cartAddDetails.open = true;
    }
    cartAddForm.querySelector("[name='item_name']")?.focus();
  });

  const clearButton = browsePanel.querySelector("[data-browse-clear]");

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      openTab("searchView", { publicTab: "browse", group: "" });
    });
  }
}

async function loadBrowse(group = "") {
  const params = new URLSearchParams();

  if (group) {
    params.set("group", group);
  }

  const data = await fetchJson(`/api/browse${params.toString() ? `?${params.toString()}` : ""}`);
  renderBrowse(data, group);
}

function setupHomeActions() {
  for (const button of document.querySelectorAll("[data-home-search]")) {
    button.addEventListener("click", () => {
      document.querySelector("#searchInput").value = button.dataset.homeSearch;
      openTab("searchView", { publicTab: "home" });
      loadResults().catch((error) => {
        resultsSummary.textContent = error.message;
      });
      resultsList.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  for (const button of document.querySelectorAll("[data-home-browse-group]")) {
    button.addEventListener("click", () => {
      openTab("searchView", {
        publicTab: "browse",
        group: button.dataset.homeBrowseGroup
      });
    });
  }

  for (const button of document.querySelectorAll("[data-home-action]")) {
    button.addEventListener("click", () => {
      if (button.dataset.homeAction === "search") {
        openTab("searchView", { publicTab: "home" });
        searchForm.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelector("#searchInput").focus();
      }

      if (button.dataset.homeAction === "browse") {
        openTab("searchView", { publicTab: "browse" });
        browsePanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (button.dataset.homeAction === "cart-compare") {
        openTab("cartView");
        if (!currentUser) {
          setMessage(cartMessage, "Log in to compare your cart.", "info");
        } else if (!currentCartItems.length) {
          setMessage(cartMessage, "Add groceries to your cart, then compare stores.", "info");
        } else {
          compareCart();
        }
      }

      if (button.dataset.homeAction === "cart-add-custom") {
        openTab("cartView");
        if (cartAddDetails) {
          cartAddDetails.open = true;
        }
        cartAddForm.querySelector("[name='item_name']")?.focus();
      }

      if (button.dataset.homeAction === "my-reports") {
        if (currentUser) {
          openMyReport();
        } else {
          openTab("accountView");
          setMessage(accountMessage, "Log in to view your reports.", "info");
        }
      }

      if (button.dataset.homeAction === "how-submit") {
        const helpBox = document.querySelector(".submit-help-box");

        if (helpBox) {
          helpBox.open = !helpBox.open;
          helpBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
  }
}

async function loadResults() {
  const params = new URLSearchParams(new FormData(searchForm));
  const data = await fetchJson(`/api/search?${params.toString()}`);
  renderResults(data.products || [], data.reports || []);
  loadSponsors("search", searchSponsorSlot);
}

function openVerifyDialog(reportId, selectedType) {
  if (!currentUser) {
    resultsSummary.textContent = "You must log in before verifying grocery prices.";
    switchView("accountView");
    return;
  }

  verifyReportId.value = reportId;
  verifyMessage.textContent = "";
  const radio = verifyForm.querySelector(`input[value="${selectedType}"]`);

  if (radio) {
    radio.checked = true;
  }

  if (typeof verifyDialog.showModal === "function") {
    verifyDialog.showModal();
  } else {
    verifyDialog.classList.add("is-open");
  }
}

function closeVerifyDialog() {
  if (typeof verifyDialog.close === "function") {
    verifyDialog.close();
  } else {
    verifyDialog.classList.remove("is-open");
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  setMessage(accountMessage, "Creating account...");

  const formData = new FormData(registerForm);

  try {
    const data = await postJson("/api/auth/register", {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword")
    });
    registerForm.reset();
    currentUser = data.user;
    renderAuthState();
    await loadAdminAlertBadge();
    await loadCart();
    setMessage(
      accountMessage,
      [data.message, ...(data.warnings || [])].join(" "),
      data.warnings && data.warnings.length ? "info" : "success"
    );
    await loadLeaderboard();
  } catch (error) {
    setMessage(accountMessage, error.message, "error");
  }
}

async function submitLogin(event) {
  event.preventDefault();
  setMessage(accountMessage, "Logging in...");

  const formData = new FormData(loginForm);

  try {
    const data = await postJson("/api/auth/login", {
      email: formData.get("email"),
      password: formData.get("password")
    });
    loginForm.reset();
    currentUser = data.user;
    renderAuthState();
    await loadAdminAlertBadge();
    await loadCart();
    setMessage(accountMessage, "Logged in.", "success");
  } catch (error) {
    setMessage(accountMessage, error.message, "error");
  }
}

async function submitChangePassword(event) {
  event.preventDefault();
  setMessage(changePasswordMessage, "Updating password...");

  const formData = new FormData(changePasswordForm);

  try {
    const data = await postJson("/api/auth/change-password", {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword")
    });
    changePasswordForm.reset();
    setMessage(changePasswordMessage, data.message || "Password changed.", "success");
  } catch (error) {
    setMessage(changePasswordMessage, error.message, "error");
  }
}

async function logout() {
  try {
    await postJson("/api/auth/logout", {});
    currentUser = null;
    currentCartItems = [];
    currentNotifications = [];
    renderAuthState();
    renderCart([]);
    setCartCount(0);
    setMessage(accountMessage, "Logged out.", "success");
  } catch (error) {
    setMessage(accountMessage, error.message, "error");
  }
}

async function resendVerificationEmail() {
  setMessage(accountMessage, "Sending verification email...");

  try {
    const data = await postJson("/api/auth/resend-verification", {});
    setMessage(accountMessage, data.message || "Verification email sent.", "success");
  } catch (error) {
    setMessage(accountMessage, error.message, "error");
  }
}

async function submitPriceReport(event) {
  event.preventDefault();
  submitSuccessActions.hidden = true;

  if (!currentUser) {
    setMessage(submitMessage, "You must log in before submitting proof.", "error");
    switchView("accountView");
    return;
  }

  const validationErrors = validateGuidedSubmitForm();

  if (validationErrors.length) {
    const [firstField, firstMessage] = validationErrors[0];
    setMessage(submitMessage, firstMessage, "error");
    focusSubmitField(firstField === "proof_photo" ? "proof_type" : firstField);
    return;
  }

  lastSubmitContext = {
    storeId: submitField("store_id").value,
    proofType: submitField("proof_type").value
  };

  setMessage(submitMessage, "Saving proof...");

  try {
    const formData = new FormData();
    const sourceUrl = submitField("source_url")?.value.trim() || "";

    formData.append("store_id", submitField("store_id").value);
    formData.append("proof_type", submitField("proof_type").value);
    formData.append("item_hint", submitField("item_name").value.trim());
    formData.append("price_hint", submitField("price").value.trim());
    formData.append("notes", submitField("notes").value.trim());

    if (sourceUrl) {
      formData.append("source_url", sourceUrl);
    }

    if (proofPhotoInput.files && proofPhotoInput.files[0]) {
      formData.append("proof_photo", proofPhotoInput.files[0]);
    }

    const data = await fetchJson("/api/proof-submissions", {
      method: "POST",
      body: formData
    });
    submitForm.reset();
    clearSelectedProduct();
    clearSubmitErrors();
    clearQuickSelections();
    updateProofPhotoRequirement();
    updateSubmitStepSummaries();
    openSubmitStep("store");
    setMessage(
      submitMessage,
      data.message || "Proof saved. We'll review it manually.",
      "success"
    );
    submitSuccessActions.hidden = false;
    await loadCurrentUser();
    await loadAccountSection("notifications");
    await loadResults();
    await loadLeaderboard();
  } catch (error) {
    setMessage(submitMessage, error.message, "error");
  }
}

async function submitVerification(event) {
  event.preventDefault();
  setMessage(verifyMessage, "Saving verification...");

  const formData = new FormData(verifyForm);
  const reportId = formData.get("report_id");

  try {
    const data = await postJson(`/api/reports/${reportId}/verify`, {
      verification_type: formData.get("verification_type"),
      note: formData.get("note")
    });

    setMessage(
      verifyMessage,
      `Saved. Points awarded: ${data.points_awarded}.`,
      "success"
    );
    await loadCurrentUser();
    await loadResults();
    await loadLeaderboard();
    setTimeout(closeVerifyDialog, 600);
  } catch (error) {
    setMessage(verifyMessage, error.message, "error");
  }
}

async function saveAvoidIngredients(event) {
  event.preventDefault();

  if (!currentUser) {
    setMessage(avoidIngredientsMessage, "Log in to save ingredient alerts.", "error");
    switchView("accountView");
    return;
  }

  try {
    const data = await postJson("/api/preferences/avoid-ingredients", {
      avoid_ingredients: avoidIngredientsInput.value
    });
    currentUser = data.user;
    renderAuthState();
    renderCartAvoidReminder();
    setMessage(avoidIngredientsMessage, data.message, "success");
  } catch (error) {
    setMessage(avoidIngredientsMessage, error.message, "error");
  }
}

async function submitStoreRequest(event) {
  event.preventDefault();

  if (!currentUser) {
    setMessage(storeRequestMessage, "Log in to request a store.", "error");
    switchView("accountView");
    return;
  }

  const getRequestField = (name) => storeRequestFields.querySelector(`[name="${name}"]`)?.value || "";

  try {
    const data = await postJson("/api/store-requests", {
      store_name: getRequestField("store_name"),
      address: getRequestField("address"),
      city: getRequestField("city"),
      notes: getRequestField("notes")
    });
    for (const input of storeRequestFields.querySelectorAll("input")) {
      input.value = input.name === "city" ? "Janesville" : "";
    }
    setMessage(storeRequestMessage, data.message, "success");
  } catch (error) {
    setMessage(storeRequestMessage, error.message, "error");
  }
}

async function submitSuggestion(event) {
  event.preventDefault();

  if (!currentUser) {
    setMessage(suggestionMessage, "Log in to send a suggestion.", "error");
    switchView("accountView");
    return;
  }

  try {
    const data = await fetchJson("/api/suggestions", {
      method: "POST",
      body: new FormData(suggestionForm)
    });
    suggestionForm.reset();
    setMessage(suggestionMessage, data.message, "success");
  } catch (error) {
    setMessage(suggestionMessage, error.message, "error");
  }
}

function renderCartAvoidReminder() {
  const avoidText = currentUser?.avoid_ingredients || "";

  cartAvoidReminder.hidden = cartReminderHidden;
  cartAvoidReminder.innerHTML = `
    <details open>
      <summary>Label reminder</summary>
      <p>Ingredient info is not verified. Always check package labels.</p>
      ${avoidText ? `<p>Avoiding: ${escapeHtml(avoidText)}</p>` : ""}
      <button class="quiet-button" type="button" data-hide-cart-reminder>Hide</button>
    </details>
  `;

  cartAvoidReminder.querySelector("[data-hide-cart-reminder]")?.addEventListener("click", () => {
    cartReminderHidden = true;
    cartAvoidReminder.hidden = true;
  });
}

function renderCart(items = []) {
  renderCartAvoidReminder();
  syncCartControls(items.length);

  if (!currentUser) {
    cartItemsList.innerHTML = '<div class="empty-state">Log in to use your cart.</div>';
    cartComparison.innerHTML = "";
    updateCartEstimate();
    return;
  }

  if (!items.length) {
    cartItemsList.innerHTML = '<div class="empty-state">Your cart is empty. Add groceries to compare stores.</div>';
    cartComparison.innerHTML = "";
    updateCartEstimate();
    return;
  }

  const categoryOptions = (selected = "") => `
    <option value="">Any category</option>
    ${categories.map((category) => `<option value="${category}" ${category === selected ? "selected" : ""}>${escapeHtml(titleCase(category))}</option>`).join("")}
  `;

  cartItemsList.innerHTML = items
    .map((item) => `
      <article class="cart-item-row shopping-cart-card" data-cart-card="${item.id}">
        <div class="item-icon" aria-hidden="true">${escapeHtml(productIcon(item.product_display_name || item.item_name, item.category))}</div>
        <div class="cart-item-main">
          <h3>${escapeHtml(item.product_display_name || item.item_name)}</h3>
          <span>${escapeHtml(item.preferred_brand || "Any brand")} · ${escapeHtml(item.size_preference || item.quantity_needed || "Any size")}</span>
          <small>
            ${item.must_have ? "Must have" : item.optional_item ? "Optional" : "Cart item"}
            ${item.avoid_ingredients || currentUser.avoid_ingredients ? ` · Avoid: ${escapeHtml(item.avoid_ingredients || currentUser.avoid_ingredients)}` : ""}
          </small>
        </div>
        <div class="cart-row-actions">
          <button class="quantity-pill" type="button" data-duplicate-cart="${item.id}" aria-label="Add another ${escapeHtml(item.item_name)}">+</button>
          <button class="icon-danger-button" type="button" data-remove-cart="${item.id}" aria-label="Remove ${escapeHtml(item.item_name)}">×</button>
        </div>
        <details class="technical-details cart-edit-details">
          <summary>Edit item</summary>
          <div class="admin-control-grid" data-cart-edit="${item.id}">
            <input data-cart-field="product_id" type="hidden" value="${escapeHtml(item.product_id || "")}">
            <label><span>Item name</span><input data-cart-field="item_name" type="text" maxlength="120" value="${escapeHtml(item.item_name)}"></label>
            <label><span>Preferred type / brand</span><input data-cart-field="preferred_brand" type="text" maxlength="80" value="${escapeHtml(item.preferred_brand)}"></label>
            <label>
              <span>Brand choice</span>
              <select data-cart-field="brand_mode">
                <option value="any" ${item.brand_mode === "any" ? "selected" : ""}>Any brand is okay</option>
                <option value="preferred" ${item.brand_mode === "preferred" ? "selected" : ""}>I prefer this brand</option>
                <option value="exact" ${item.brand_mode === "exact" ? "selected" : ""}>Only this brand</option>
              </select>
            </label>
            <label><span>Category</span><select data-cart-field="category">${categoryOptions(item.category)}</select></label>
            <label><span>Quantity needed</span><input data-cart-field="quantity_needed" type="text" maxlength="80" value="${escapeHtml(item.quantity_needed)}"></label>
            <label><span>Size preference</span><input data-cart-field="size_preference" type="text" maxlength="80" value="${escapeHtml(item.size_preference)}"></label>
            <label><span>Avoid ingredients</span><input data-cart-field="avoid_ingredients" type="text" maxlength="500" value="${escapeHtml(item.avoid_ingredients)}"></label>
            <label class="checkbox-row"><input data-cart-field="must_have" type="checkbox" ${item.must_have ? "checked" : ""}><span>Must have</span></label>
            <label class="checkbox-row"><input data-cart-field="optional_item" type="checkbox" ${item.optional_item ? "checked" : ""}><span>Optional</span></label>
            <label class="span-full"><span>Notes</span><textarea data-cart-field="notes" maxlength="500" rows="3">${escapeHtml(item.notes)}</textarea></label>
            <button class="secondary-button" type="button" data-save-cart="${item.id}">Save cart changes</button>
          </div>
        </details>
      </article>
    `)
    .join("");

  for (const button of cartItemsList.querySelectorAll("[data-remove-cart]")) {
    button.addEventListener("click", () => removeCartItem(button.dataset.removeCart));
  }

  for (const button of cartItemsList.querySelectorAll("[data-save-cart]")) {
    button.addEventListener("click", () => saveCartItem(button.dataset.saveCart));
  }

  for (const button of cartItemsList.querySelectorAll("[data-duplicate-cart]")) {
    button.addEventListener("click", () => duplicateCartItem(button.dataset.duplicateCart));
  }
}

function updateCartEstimate(result = null) {
  if (!cartEstimatedTotal || !cartEstimateRange) {
    return;
  }

  const hasMatches = result && Number(result.matched_count || 0) > 0;

  cartEstimatedTotal.textContent = hasMatches
    ? `$${Number(result.estimated_total || 0).toFixed(2)}`
    : "Compare to estimate";
  cartEstimateRange.textContent = hasMatches
    ? `${result.matched_count || 0} matched · ${result.missing_items?.length || 0} missing`
    : "Approved prices only";
}

async function loadCart() {
  if (!currentUser) {
    currentCartItems = [];
    setCartCount(0);
    syncCartControls(0);
    renderCart([]);
    loadSponsors("cart", cartSponsorSlot);
    return;
  }

  try {
    const data = await fetchJson("/api/cart");
    currentCartItems = data.items || [];
    setCartCount(data.cart_count ?? currentCartItems.length);
    syncCartControls(currentCartItems.length);
    renderCart(currentCartItems);
    loadSponsors("cart", cartSponsorSlot);
  } catch (error) {
    cartItemsList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    syncCartControls(0);
  }
}

async function addCartItem(payload) {
  if (!currentUser) {
    setMessage(cartMessage, "Log in to add items to your cart.", "error");
    showCartToast("Log in to add items to your cart.", "error");
    openTab("accountView");
    return;
  }

  const data = await postJson("/api/cart", payload);
  const message = data.already_in_cart ? "Already in cart." : "Added to cart.";
  setCartCount(data.cart_count);
  setMessage(cartMessage, message, "success");
  showCartToast(message, "success");
  await loadCart();
  return data;
}

async function addReportToCart(report, button = null) {
  try {
    const data = await addCartItem({
      product_id: "",
      item_name: report.product_display_name || report.item_name,
      preferred_brand: report.brand,
      brand_mode: report.brand ? "preferred" : "any",
      category: report.category,
      quantity_needed: report.size_text || `${report.quantity} ${report.unit}`,
      size_preference: report.size_text || "",
      source: "report",
      notes: `Added from approved report at ${report.store_name}.`
    });
    if (!data) {
      return;
    }

    setCartButtonState(button, data.already_in_cart ? "in-cart" : "added");
  } catch (error) {
    setMessage(resultsSummary, error.message, "error");
    showCartToast(error.message, "error");
  }
}

async function addProductToCart(product, button = null, options = {}) {
  try {
    const variant = displayPlaceholderVariant(options.variant || "");
    const size = options.size || product.default_size_text || "";
    const data = await addCartItem({
      product_id: product.id,
      item_name: product.display_name,
      preferred_brand: variant || product.preferred_brand,
      brand_mode: variant || product.preferred_brand ? "preferred" : "any",
      category: product.category,
      quantity_needed: size,
      size_preference: size,
      source: "product",
      notes: "Added from product page."
    });
    if (!data) {
      return;
    }

    setCartButtonState(button, data.already_in_cart ? "in-cart" : "added");
  } catch (error) {
    setMessage(resultsSummary, error.message, "error");
    showCartToast(error.message, "error");
  }
}

async function addPlaceholderToCart(placeholder, options = {}, button = null) {
  try {
    const variant = displayPlaceholderVariant(options.variant || "");
    const size = options.size || placeholder.sizes?.[0] || "";
    const data = await addCartItem({
      product_id: "",
      item_name: placeholder.name,
      preferred_brand: variant,
      brand_mode: variant ? "preferred" : "any",
      category: placeholder.category,
      quantity_needed: size,
      size_preference: size,
      source: "placeholder",
      notes: "Added from product suggestion. Price contribution needed."
    });
    if (!data) {
      return;
    }

    setCartButtonState(button, data.already_in_cart ? "in-cart" : "added");
  } catch (error) {
    setMessage(resultsSummary, error.message, "error");
    showCartToast(error.message, "error");
  }
}

function startPriceForProduct(product, options = {}) {
  switchView("submitView");
  setSelectedProduct(product, true, options);
  setMessage(submitMessage, `Adding a price for ${product.display_name}. Choose the store and enter the real price you saw.`, "info");
  document.querySelector("#submitView").scrollIntoView({ behavior: "smooth", block: "start" });
}

function startPriceForPlaceholder(placeholder, options = {}) {
  switchView("submitView");
  setSelectedPlaceholder(placeholder, options);
  setMessage(submitMessage, `Adding a real price for ${placeholder.name}. Choose the store and enter the price you saw.`, "info");
  document.querySelector("#submitView").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitCartItem(event) {
  event.preventDefault();
  const formData = new FormData(cartAddForm);
  const preferredBrand = String(formData.get("preferred_brand") || "").trim();

  try {
    await addCartItem({
      product_id: formData.get("product_id"),
      item_name: formData.get("item_name"),
      preferred_brand: preferredBrand,
      brand_mode: preferredBrand ? "preferred" : formData.get("brand_mode"),
      category: formData.get("category"),
      quantity_needed: formData.get("quantity_needed"),
      size_preference: formData.get("size_preference"),
      must_have: formData.get("must_have") === "on",
      optional_item: formData.get("optional_item") === "on",
      avoid_ingredients: formData.get("avoid_ingredients"),
      notes: formData.get("notes"),
      source: "manual"
    });
    cartAddForm.reset();
    if (cartAddDetails) {
      cartAddDetails.open = false;
    }
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

async function saveCartItem(itemId) {
  const form = cartItemsList.querySelector(`[data-cart-edit="${itemId}"]`);
  const payload = {};

  for (const field of form.querySelectorAll("[data-cart-field]")) {
    payload[field.dataset.cartField] = field.type === "checkbox" ? field.checked : field.value;
  }

  try {
    const data = await fetchJson(`/api/cart/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(cartMessage, data.message, "success");
    await loadCart();
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

async function duplicateCartItem(itemId) {
  try {
    const data = await postJson(`/api/cart/${itemId}/duplicate`, {});
    setMessage(cartMessage, data.message, "success");
    await loadCart();
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

async function removeCartItem(itemId) {
  try {
    await fetchJson(`/api/cart/${itemId}`, { method: "DELETE" });
    await loadCart();
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

async function clearCart() {
  if (!window.confirm("Clear your cart?")) {
    return;
  }

  try {
    await fetchJson("/api/cart", { method: "DELETE" });
    setMessage(cartMessage, "Cart cleared.", "success");
    await loadCart();
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

function renderComparisonMatch(match) {
  const report = match.report;
  return `
    <li>
      <strong>${escapeHtml(match.cart_item.product_display_name || match.cart_item.item_name)}</strong>
      <span>Cheapest approved match: ${escapeHtml(report.store_name)} · ${escapeHtml(report.price_label)} (${escapeHtml(report.unit_price_label)})</span>
      <span class="badge confidence-${escapeHtml(report.confidence)}">${escapeHtml(titleCase(report.confidence))}</span>
      ${match.cart_item.must_have ? '<span class="badge confidence-medium">Must have</span>' : ""}
      ${match.cart_item.optional_item ? '<span class="badge confidence-low">Optional</span>' : ""}
      <span class="badge confidence-low">Check package label</span>
      ${report.ingredient_info_url ? `<a href="${escapeHtml(report.ingredient_info_url)}" target="_blank" rel="noopener">Ingredient link</a>` : ""}
    </li>
  `;
}

function renderStoreBreakdown(stores = []) {
  if (!stores.length) {
    return '<div class="empty-state">No store breakdown yet.</div>';
  }

  return stores
    .map((store) => `
      <details class="technical-details store-breakdown">
        <summary>${escapeHtml(store.store_name)} · ${store.matched_count} item${store.matched_count === 1 ? "" : "s"} · $${Number(store.estimated_total || 0).toFixed(2)}</summary>
        <ul class="comparison-list">
          ${(store.items || []).map((item) => `<li>${escapeHtml(item.item_name)} - ${escapeHtml(item.price_label)} (${escapeHtml(item.unit_price_label)})</li>`).join("")}
        </ul>
      </details>
    `)
    .join("");
}

function renderComparisonStoreCards(stores = []) {
  if (!stores.length) {
    return "";
  }

  const sortedStores = [...stores].sort((a, b) => {
    const coverageDifference = Number(b.matched_count || 0) - Number(a.matched_count || 0);
    return coverageDifference || Number(a.estimated_total || 0) - Number(b.estimated_total || 0);
  });
  const bestStore = sortedStores[0];

  return `
    <div class="best-store-callout">
      <span>Best overall store</span>
      <strong>${escapeHtml(storeLogoLabel(bestStore.store_name))}</strong>
      <p>Covers ${bestStore.matched_count} item${bestStore.matched_count === 1 ? "" : "s"} for about $${Number(bestStore.estimated_total || 0).toFixed(2)}.</p>
    </div>
    <div class="comparison-store-rail">
      ${sortedStores.slice(0, 8).map((store, index) => `
        <article class="comparison-store-card ${index === 0 ? "is-best-store" : ""}">
          ${index === 0 ? '<span class="best-store-label">Best overall</span>' : ""}
          <div class="store-logo-wordmark">${escapeHtml(storeLogoLabel(store.store_name))}</div>
          <strong>${escapeHtml(storeLogoLabel(store.store_name))}</strong>
          <span>${store.matched_count} item${store.matched_count === 1 ? "" : "s"}</span>
          <b>$${Number(store.estimated_total || 0).toFixed(2)}</b>
          <button class="quiet-button small-action-button" type="button" data-store-detail-jump>View details</button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCartModeResult(result, isSelected, mode = "") {
  const missing = result.missing_items || [];
  const mustHaveMissing = result.must_have_missing_items || [];
  const optionalMissing = result.optional_missing_items || [];
  const hasMatches = Number(result.matched_count || 0) > 0;

  if (!hasMatches) {
    return `
      <section class="comparison-card compact-comparison empty-comparison ${isSelected ? "selected-comparison" : ""}">
        <div class="card-topline">
          <h3>${escapeHtml(result.label)}</h3>
          ${isSelected ? '<span class="badge confidence-high">Selected</span>' : ""}
        </div>
        <p>No approved matches yet.</p>
        <p class="field-help">Submit a price if you see one.</p>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-cart-next-mode>Try another mode</button>
          <button class="quiet-button" type="button" data-submit-missing-price>Submit missing price</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="comparison-card compact-comparison ${isSelected ? "selected-comparison" : ""}">
      <div class="card-topline">
        <h3>${escapeHtml(result.label)}</h3>
        ${isSelected ? '<span class="badge confidence-high">Selected</span>' : ""}
      </div>
      <dl class="compact-summary-grid">
        <div><dt>Estimated total</dt><dd>$${Number(result.estimated_total || 0).toFixed(2)}</dd></div>
        <div><dt>Stores needed</dt><dd>${result.stores_needed?.length ? escapeHtml(result.stores_needed.join(", ")) : "One stop"}</dd></div>
        <div><dt>Matched</dt><dd>${result.matched_count || 0}</dd></div>
        <div><dt>Missing</dt><dd>${missing.length}</dd></div>
      </dl>
      <p class="cart-mode-help">${escapeHtml(result.explanation || cartModeHelp[mode] || "Based on approved local reports.")}</p>
      ${result.must_have_warning ? `<p class="field-help">${escapeHtml(result.must_have_warning)}</p>` : ""}
      ${renderComparisonStoreCards(result.store_breakdown || [])}
      <details class="comparison-details">
        <summary>View details</summary>
        <h4>Matched items</h4>
        <ul class="comparison-list">${(result.matches || []).map(renderComparisonMatch).join("") || "<li>Be the first to add a matching price.</li>"}</ul>
        ${(result.optional_matches || []).length ? `
          <h4>Optional matched items</h4>
          <ul class="comparison-list">${result.optional_matches.map(renderComparisonMatch).join("")}</ul>
        ` : ""}
        <h4>Missing prices</h4>
        <ul class="comparison-list">${missing.map((item) => `
          <li>
            ${escapeHtml(item.product_display_name || item.item_name)}
            ${item.must_have ? " - must-have item" : ""}
            ${item.optional_item ? " - optional item" : ""}
            - Be the first to add a price and earn points.
          </li>
        `).join("") || "<li>No missing items.</li>"}</ul>
        ${mustHaveMissing.length ? `
          <h4>Must-have missing warnings</h4>
          <ul class="comparison-list">${mustHaveMissing.map((item) => `<li>${escapeHtml(item.product_display_name || item.item_name)} needs an approved price.</li>`).join("")}</ul>
        ` : ""}
        ${optionalMissing.length ? `
          <h4>Optional missing items</h4>
          <ul class="comparison-list">${optionalMissing.map((item) => `<li>${escapeHtml(item.product_display_name || item.item_name)}</li>`).join("")}</ul>
        ` : ""}
        <h4>Store breakdown</h4>
        ${renderStoreBreakdown(result.store_breakdown || [])}
      </details>
    </section>
  `;
}

function renderCartComparison(data) {
  const modes = data.modes || {};
  const selectedMode = data.selected_mode || cartCompareMode.value || "cheapest_split";
  const mode = modes[selectedMode] ? selectedMode : cartCompareModes.find((item) => modes[item]) || Object.keys(modes)[0];
  const selectedResult = mode ? modes[mode] : null;

  updateCartEstimate(selectedResult);

  cartComparison.innerHTML = `
    ${mode ? renderCartModeResult(selectedResult, true, mode) : '<div class="empty-state">No approved matches yet. Submit a price if you see one.</div>'}
    ${data.allergy_warning ? '<p class="cart-compare-note">Ingredient info is not verified. Always check package labels.</p>' : ""}
  `;

  cartComparison.querySelector("[data-cart-next-mode]")?.addEventListener("click", () => {
    const currentIndex = cartCompareModes.indexOf(cartCompareMode.value);
    const nextMode = cartCompareModes[(currentIndex + 1 + cartCompareModes.length) % cartCompareModes.length];
    setCartMode(nextMode);
    compareCart();
  });

  cartComparison.querySelector("[data-submit-missing-price]")?.addEventListener("click", () => {
    startMissingPriceSubmission(modes[mode]);
  });

  for (const button of cartComparison.querySelectorAll("[data-store-detail-jump]")) {
    button.addEventListener("click", () => {
      const details = cartComparison.querySelector(".comparison-details");
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
}

function startMissingPriceSubmission(result = {}) {
  const missingItem = (result.missing_items || [])[0] || currentCartItems[0] || null;
  switchView("submitView");
  submitSuccessActions.hidden = true;

  if (missingItem) {
    const itemName = missingItem.product_display_name || missingItem.item_name || "";
    const size = missingItem.size_preference || missingItem.quantity_needed || "";
    submitField("item_name").value = itemName;
    submitField("brand").value = missingItem.preferred_brand || "";
    submitField("category").value = missingItem.category || "";
    submitField("size_text").value = size;

    if (size) {
      const parsed = parseSizeSuggestion(size);
      if (parsed.quantity && parsed.unit) {
        submitField("quantity").value = parsed.quantity;
        submitField("unit").value = parsed.unit;
      }
    }
  }

  clearSubmitErrors();
  updateSubmitStepSummaries();
  openSubmitStep("store");
  setMessage(submitMessage, "Choose the store, then enter the real price you saw.", "info");
  document.querySelector("#submitView").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function compareCart() {
  if (!currentUser) {
    setMessage(cartMessage, "Log in to compare your cart.", "error");
    switchView("accountView");
    return;
  }

  if (!currentCartItems.length) {
    setMessage(cartMessage, "Add items first.", "info");
    cartComparison.innerHTML = "";
    return;
  }

  try {
    const mode = cartCompareMode.value || "cheapest_split";
    const data = await fetchJson(`/api/cart/compare?mode=${encodeURIComponent(mode)}`);
    renderCartComparison(data);
  } catch (error) {
    setMessage(cartMessage, error.message, "error");
  }
}

async function loadRewards() {
  const data = await fetchJson("/api/rewards");
  const pointRows = Object.entries(data.points)
    .map(([action, points]) => `
      <article class="mini-card">
        <strong>${escapeHtml(actionLabels[action] || titleCase(action))}</strong>
        <span>${points > 0 ? "+" : ""}${points} points</span>
      </article>
    `)
    .join("");
  const rewardRows = data.reward_rules
    .map((rule) => `
      <article class="mini-card">
        <strong>${rule.points} points</strong>
        <span>${escapeHtml(rule.label)}</span>
      </article>
    `)
    .join("");

  rewardRules.innerHTML = `
    ${pointRows}
    ${rewardRows}
    <article class="mini-card notice-card">
      <strong>Verified email required</strong>
      <span>Users can earn beta points now. Points are informational and have no cash value.</span>
    </article>
    <article class="mini-card notice-card">
      <strong>Version 1 rewards</strong>
      <span>No cash, gift cards, or raffle entries are promised or processed.</span>
    </article>
  `;
}

async function loadLeaderboard() {
  const data = await fetchJson("/api/leaderboard");

  if (!data.leaderboard.length) {
    leaderboardList.innerHTML = '<div class="empty-state">No contributors yet.</div>';
    return;
  }

  leaderboardList.innerHTML = data.leaderboard
    .map((row, index) => `
      <article class="leaderboard-row">
        <div class="rank-number">${index + 1}</div>
        <div>
          <strong>${escapeHtml(row.username)}</strong>
          <span>${Number(row.approved_proof_count || 0)} approved proofs · ${Number(row.contribution_count || 0)} helpful prices</span>
          ${row.trust_level ? `<span class="inline-status success">${escapeHtml(row.trust_level)}</span>` : ""}
        </div>
        <div class="leaderboard-points">
          <strong>${row.points}</strong>
          <span>points</span>
        </div>
      </article>
    `)
    .join("");
}

function setupTabs() {
  for (const button of document.querySelectorAll("[data-view-target]")) {
    button.addEventListener("click", () => {
      openTab(button.dataset.viewTarget, {
        publicTab: button.dataset.publicTab || "",
        section: button.dataset.viewTarget === "accountView" ? activeAccountSection : undefined
      });
    });
  }
}

function setupAuthTabs() {
  for (const button of document.querySelectorAll("[data-auth-target]")) {
    button.addEventListener("click", () => {
      showAuthPanel(button.dataset.authTarget);
    });
  }
}

function applyInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const section = params.get("section");
  const reportId = params.get("report");
  const productId = params.get("product");

  if (productId) {
    openProduct(productId);
    return;
  }

  if (tab) {
    openTab(tab);
  }

  if (section && currentUser) {
    setAccountSection(section, reportId);
  }
}

async function boot() {
  setupTabs();
  setupAuthTabs();
  setupHomeActions();
  setupGuidedSubmitHelpers();
  setupSubmitAccordion();
  setupCartControls();
  showAuthPanel("loginPanel");
  updateProofPhotoRequirement();
  populateCategorySelect(document.querySelector("#categoryFilter"), true);
  populateCategorySelect(document.querySelector("#submitCategory"), "choose");
  populateCategorySelect(cartCategory, true);
  await loadCurrentUser();
  await loadStores();
  await loadCart();
  await loadBrowse();
  await loadResults();
  await loadRewards();
  await loadLeaderboard();
  applyInitialRoute();
  setInterval(sendHeartbeat, 1000 * 60 * 2);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadResults().catch((error) => {
    resultsSummary.textContent = error.message;
  });
});

registerForm.addEventListener("submit", submitRegistration);
loginForm.addEventListener("submit", submitLogin);
changePasswordForm.addEventListener("submit", submitChangePassword);
avoidIngredientsForm.addEventListener("submit", saveAvoidIngredients);
logoutButton.addEventListener("click", logout);
showStoreRequestButton.addEventListener("click", () => {
  storeRequestBox.hidden = !storeRequestBox.hidden;
});
storeRequestSubmitButton.addEventListener("click", submitStoreRequest);
suggestionForm.addEventListener("submit", submitSuggestion);
productSearchButton.addEventListener("click", () => {
  searchProductsForSubmit().catch((error) => {
    productSearchResults.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  });
});
productSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchProductsForSubmit().catch((error) => {
      productSearchResults.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    });
  }
});
backToSearchButton.addEventListener("click", () => switchView("searchView"));
cartAddForm.addEventListener("submit", submitCartItem);
compareCartButton.addEventListener("click", compareCart);
clearCartButton.addEventListener("click", clearCart);
notificationBell.addEventListener("click", () => setAccountSection("notifications"));
currentUserBadge.addEventListener("click", () => openTab("accountView"));
for (const button of document.querySelectorAll("[data-account-section]")) {
  button.addEventListener("click", () => setAccountSection(button.dataset.accountSection));
}
cartCompareMode.addEventListener("change", () => {
  setCartMode(cartCompareMode.value);
  trackClientEvent({
    event_type: "cart_mode_selected",
    cart_item_name: cartCompareMode.value,
    metadata: { mode: cartCompareMode.value }
  });
});
proofTypeSelect.addEventListener("change", updateProofPhotoRequirement);
proofPhotoInput.addEventListener("change", updateProofPhotoStatus);
submitForm.addEventListener("submit", submitPriceReport);
verifyForm.addEventListener("submit", submitVerification);
document.querySelector("#closeVerifyDialog").addEventListener("click", closeVerifyDialog);

boot().catch((error) => {
  resultsList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
