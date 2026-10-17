// Node colours per graph label, tuned for the light ink-on-cream workspace canvas.
export const LABEL_COLORS = {
  Alert: "#c8382d",
  Store: "#1a1614",
  SKU: "#7d8a24",
  Equipment: "#a5672b",
  Supplier: "#2f8a87",
  Campaign: "#b84d8a",
  Ticket: "#d9902a",
  Decision: "#3e8e5a",
  Person: "#6e6a63",
  Artifact: "#b9b5aa",
  Investigation: "#7f6cc4",
  Task: "#9a8ccf",
  Finding: "#9a8ccf",
  Memory: "#7f6cc4",
};
export const NODE_SIZE = { Alert: 6, Store: 6, Decision: 5, Campaign: 5, Equipment: 4, Ticket: 4, Person: 4, SKU: 3, Supplier: 4, Artifact: 2.5 };

// labels shown in the legend, in reading order
export const LEGEND = ["Alert", "Store", "SKU", "Equipment", "Ticket", "Decision", "Campaign", "Person", "Supplier", "Artifact"];

export const TRACE = "#e8622b"; // touched edges, particles and the agent hub
