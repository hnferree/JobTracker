const DEFAULT_KEYWORDS = [
  "C#", "ASP.NET", ".NET", "WPF", "React", "TypeScript", "JavaScript",
  "Angular", "Docker", "Kafka", "RabbitMQ", "Zookeeper", "SQL", "Python",
  "GCP", "REST", "API", "CI/CD"
];

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["keywords"]);
  if (!Array.isArray(data.keywords) || data.keywords.length === 0) {
    await chrome.storage.sync.set({ keywords: DEFAULT_KEYWORDS });
  }
});


const DEFAULT_APPLICATION_PROFILE = {
  linkedin: "linkedin.com/in/holly-ferree-63b2a15/",
  workAuthorizedUS: "Yes",
  ethnicity: "White",
  veteran: "No",
  gender: "Female",
  hispanic: "No"
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(["applicationProfile"]);
  if (!current.applicationProfile) {
    await chrome.storage.sync.set({ applicationProfile: DEFAULT_APPLICATION_PROFILE });
  }
});


const DEFAULT_CUSTOM_AUTOFILL_RULES = [];

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["customAutofillRules"]);
  if (!Array.isArray(data.customAutofillRules)) {
    await chrome.storage.sync.set({ customAutofillRules: DEFAULT_CUSTOM_AUTOFILL_RULES });
  }
});
