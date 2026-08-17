/** Canada provinces, territories, and regional subsets. */

export const CA_PROVINCES = [
  { id: "AB", name: "Alberta", capital: "Edmonton" },
  { id: "BC", name: "British Columbia", capital: "Victoria" },
  { id: "MB", name: "Manitoba", capital: "Winnipeg" },
  { id: "NB", name: "New Brunswick", capital: "Fredericton" },
  { id: "NL", name: "Newfoundland and Labrador", capital: "St. John's" },
  { id: "NS", name: "Nova Scotia", capital: "Halifax" },
  { id: "NT", name: "Northwest Territories", capital: "Yellowknife" },
  { id: "NU", name: "Nunavut", capital: "Iqaluit" },
  { id: "ON", name: "Ontario", capital: "Toronto" },
  { id: "PE", name: "Prince Edward Island", capital: "Charlottetown" },
  { id: "QC", name: "Quebec", capital: "Quebec City" },
  { id: "SK", name: "Saskatchewan", capital: "Regina" },
  { id: "YT", name: "Yukon", capital: "Whitehorse" },
];

export const CA_PROVINCE_NAME_TO_ID = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  newfoundland: "NL",
  "nova scotia": "NS",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
  "yukon territory": "YT",
};

export const CA_REGIONS = {
  "canada-atlantic": {
    name: "Canada: Atlantic Provinces",
    blurb: "Newfoundland and Labrador, Prince Edward Island, Nova Scotia, and New Brunswick.",
    ids: ["NL", "PE", "NS", "NB"],
  },
  "canada-east": {
    name: "Canada: Eastern Provinces",
    blurb: "Ontario, Quebec, and the Atlantic provinces.",
    ids: ["ON", "QC", "NL", "PE", "NS", "NB"],
  },
  "canada-prairies": {
    name: "Canada: Prairie Provinces",
    blurb: "Manitoba, Saskatchewan, and Alberta.",
    ids: ["MB", "SK", "AB"],
  },
  "canada-west": {
    name: "Canada: Western Provinces",
    blurb: "British Columbia and the Prairie provinces.",
    ids: ["BC", "AB", "SK", "MB"],
  },
  "canada-territories": {
    name: "Canada: Territories",
    blurb: "Yukon, the Northwest Territories, and Nunavut.",
    ids: ["YT", "NT", "NU"],
  },
};
