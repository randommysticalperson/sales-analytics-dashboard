import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Sales Reps ──────────────────────────────────────────────────────────────
const reps = [
  { name: "Alexandra Chen", email: "a.chen@company.com", avatarInitials: "AC", avatarColor: "#6366f1", title: "Senior Account Executive" },
  { name: "Marcus Rivera", email: "m.rivera@company.com", avatarInitials: "MR", avatarColor: "#0ea5e9", title: "Account Executive" },
  { name: "Priya Sharma", email: "p.sharma@company.com", avatarInitials: "PS", avatarColor: "#10b981", title: "Account Executive" },
  { name: "James O'Brien", email: "j.obrien@company.com", avatarInitials: "JO", avatarColor: "#f59e0b", title: "Sales Development Rep" },
  { name: "Sofia Müller", email: "s.muller@company.com", avatarInitials: "SM", avatarColor: "#ec4899", title: "Senior Account Executive" },
];

await conn.query("DELETE FROM activities");
await conn.query("DELETE FROM deals");
await conn.query("DELETE FROM contacts");
await conn.query("DELETE FROM accounts");
await conn.query("DELETE FROM sales_reps");

for (const r of reps) {
  await conn.query(
    "INSERT INTO sales_reps (name, email, avatarInitials, avatarColor, title) VALUES (?, ?, ?, ?, ?)",
    [r.name, r.email, r.avatarInitials, r.avatarColor, r.title]
  );
}

const [repRows] = await conn.query("SELECT id FROM sales_reps ORDER BY id");
const repIds = repRows.map((r) => r.id);

// ─── Accounts ────────────────────────────────────────────────────────────────
const accountData = [
  { name: "Apex Technologies", industry: "Software", website: "apextech.io", size: "201-1000", annualRevenue: 45000000, country: "USA", city: "San Francisco" },
  { name: "Meridian Capital", industry: "Finance", website: "meridiancap.com", size: "51-200", annualRevenue: 120000000, country: "USA", city: "New York" },
  { name: "Vortex Logistics", industry: "Logistics", website: "vortexlog.com", size: "1000+", annualRevenue: 250000000, country: "Germany", city: "Berlin" },
  { name: "Solaris Health", industry: "Healthcare", website: "solarishealth.com", size: "201-1000", annualRevenue: 80000000, country: "USA", city: "Boston" },
  { name: "Quantum Retail", industry: "Retail", website: "quantumretail.com", size: "1000+", annualRevenue: 500000000, country: "UK", city: "London" },
  { name: "Nimbus Cloud", industry: "Software", website: "nimbuscloud.io", size: "51-200", annualRevenue: 30000000, country: "Canada", city: "Toronto" },
  { name: "Ironclad Manufacturing", industry: "Manufacturing", website: "ironclad.com", size: "1000+", annualRevenue: 750000000, country: "USA", city: "Detroit" },
  { name: "Cascade Analytics", industry: "Data & Analytics", website: "cascadeanalytics.com", size: "11-50", annualRevenue: 12000000, country: "USA", city: "Austin" },
];

for (const a of accountData) {
  await conn.query(
    "INSERT INTO accounts (name, industry, website, size, annualRevenue, country, city) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [a.name, a.industry, a.website, a.size, a.annualRevenue, a.country, a.city]
  );
}

const [accRows] = await conn.query("SELECT id FROM accounts ORDER BY id");
const accIds = accRows.map((r) => r.id);

// ─── Contacts ────────────────────────────────────────────────────────────────
const contactData = [
  { firstName: "Ethan", lastName: "Wallace", email: "e.wallace@apextech.io", phone: "+1-415-555-0101", title: "CTO", accountIdx: 0, repIdx: 0, status: "active", source: "inbound" },
  { firstName: "Nadia", lastName: "Kowalski", email: "n.kowalski@meridiancap.com", phone: "+1-212-555-0202", title: "VP Finance", accountIdx: 1, repIdx: 1, status: "active", source: "referral" },
  { firstName: "Liam", lastName: "Thornton", email: "l.thornton@vortexlog.com", phone: "+49-30-555-0303", title: "Head of Operations", accountIdx: 2, repIdx: 2, status: "active", source: "outbound" },
  { firstName: "Amara", lastName: "Osei", email: "a.osei@solarishealth.com", phone: "+1-617-555-0404", title: "Director of IT", accountIdx: 3, repIdx: 0, status: "prospect", source: "event" },
  { firstName: "Oliver", lastName: "Hartmann", email: "o.hartmann@quantumretail.com", phone: "+44-20-555-0505", title: "Chief Procurement Officer", accountIdx: 4, repIdx: 3, status: "active", source: "inbound" },
  { firstName: "Isabella", lastName: "Fontaine", email: "i.fontaine@nimbuscloud.io", phone: "+1-416-555-0606", title: "CEO", accountIdx: 5, repIdx: 4, status: "active", source: "referral" },
  { firstName: "Raj", lastName: "Patel", email: "r.patel@ironclad.com", phone: "+1-313-555-0707", title: "SVP Sales", accountIdx: 6, repIdx: 1, status: "active", source: "outbound" },
  { firstName: "Chloe", lastName: "Nguyen", email: "c.nguyen@cascadeanalytics.com", phone: "+1-512-555-0808", title: "Head of Data", accountIdx: 7, repIdx: 2, status: "prospect", source: "inbound" },
  { firstName: "Daniel", lastName: "Kim", email: "d.kim@apextech.io", phone: "+1-415-555-0909", title: "Product Manager", accountIdx: 0, repIdx: 3, status: "active", source: "inbound" },
  { firstName: "Fatima", lastName: "Al-Hassan", email: "f.alhassan@meridiancap.com", phone: "+1-212-555-1010", title: "COO", accountIdx: 1, repIdx: 4, status: "active", source: "referral" },
  { firstName: "Lucas", lastName: "Becker", email: "l.becker@vortexlog.com", phone: "+49-30-555-1111", title: "IT Director", accountIdx: 2, repIdx: 0, status: "inactive", source: "event" },
  { firstName: "Mia", lastName: "Johansson", email: "m.johansson@solarishealth.com", phone: "+1-617-555-1212", title: "CFO", accountIdx: 3, repIdx: 1, status: "prospect", source: "outbound" },
];

for (const c of contactData) {
  await conn.query(
    "INSERT INTO contacts (firstName, lastName, email, phone, title, accountId, assignedRepId, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [c.firstName, c.lastName, c.email, c.phone, c.title, accIds[c.accountIdx], repIds[c.repIdx], c.status, c.source]
  );
}

const [contactRows] = await conn.query("SELECT id FROM contacts ORDER BY id");
const contactIds = contactRows.map((r) => r.id);

// ─── Deals ───────────────────────────────────────────────────────────────────
const now = new Date();
const daysAgo = (d) => new Date(now - d * 86400000).toISOString().split("T")[0];
const daysFromNow = (d) => new Date(now.getTime() + d * 86400000).toISOString().split("T")[0];

const dealData = [
  // Closed Won
  { title: "Apex Tech Enterprise License", contactIdx: 0, accountIdx: 0, repIdx: 0, value: 128000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(5), actualCloseDate: daysAgo(5) },
  { title: "Meridian Capital Analytics Suite", contactIdx: 1, accountIdx: 1, repIdx: 1, value: 95000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(12), actualCloseDate: daysAgo(12) },
  { title: "Vortex Logistics Platform", contactIdx: 2, accountIdx: 2, repIdx: 2, value: 210000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(20), actualCloseDate: daysAgo(20) },
  { title: "Quantum Retail Integration", contactIdx: 4, accountIdx: 4, repIdx: 3, value: 175000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(30), actualCloseDate: daysAgo(30) },
  { title: "Nimbus Cloud Expansion", contactIdx: 5, accountIdx: 5, repIdx: 4, value: 88000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(45), actualCloseDate: daysAgo(45) },
  { title: "Ironclad Manufacturing Suite", contactIdx: 6, accountIdx: 6, repIdx: 1, value: 320000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(60), actualCloseDate: daysAgo(60) },
  { title: "Cascade Analytics Pro", contactIdx: 7, accountIdx: 7, repIdx: 2, value: 45000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(75), actualCloseDate: daysAgo(75) },
  { title: "Apex Tech Mobile License", contactIdx: 8, accountIdx: 0, repIdx: 3, value: 62000, stage: "closed_won", probability: 100, expectedCloseDate: daysAgo(90), actualCloseDate: daysAgo(90) },
  // Closed Lost
  { title: "Meridian Capital CRM Upgrade", contactIdx: 9, accountIdx: 1, repIdx: 4, value: 150000, stage: "closed_lost", probability: 0, expectedCloseDate: daysAgo(15), lostReason: "Budget constraints" },
  { title: "Solaris Health Data Platform", contactIdx: 3, accountIdx: 3, repIdx: 0, value: 98000, stage: "closed_lost", probability: 0, expectedCloseDate: daysAgo(25), lostReason: "Chose competitor" },
  // Active pipeline
  { title: "Vortex Logistics AI Module", contactIdx: 10, accountIdx: 2, repIdx: 0, value: 185000, stage: "negotiation", probability: 80, expectedCloseDate: daysFromNow(10) },
  { title: "Solaris Health Analytics", contactIdx: 3, accountIdx: 3, repIdx: 1, value: 112000, stage: "proposal", probability: 60, expectedCloseDate: daysFromNow(20) },
  { title: "Quantum Retail Phase 2", contactIdx: 4, accountIdx: 4, repIdx: 2, value: 230000, stage: "negotiation", probability: 75, expectedCloseDate: daysFromNow(15) },
  { title: "Ironclad ERP Integration", contactIdx: 6, accountIdx: 6, repIdx: 3, value: 410000, stage: "proposal", probability: 55, expectedCloseDate: daysFromNow(30) },
  { title: "Cascade Data Warehouse", contactIdx: 7, accountIdx: 7, repIdx: 4, value: 78000, stage: "qualified", probability: 40, expectedCloseDate: daysFromNow(45) },
  { title: "Apex Tech Security Suite", contactIdx: 0, accountIdx: 0, repIdx: 0, value: 95000, stage: "qualified", probability: 35, expectedCloseDate: daysFromNow(60) },
  { title: "Nimbus Cloud Premium", contactIdx: 5, accountIdx: 5, repIdx: 1, value: 55000, stage: "lead", probability: 15, expectedCloseDate: daysFromNow(90) },
  { title: "Meridian Compliance Tool", contactIdx: 11, accountIdx: 1, repIdx: 2, value: 135000, stage: "lead", probability: 10, expectedCloseDate: daysFromNow(120) },
  { title: "Vortex Fleet Management", contactIdx: 2, accountIdx: 2, repIdx: 3, value: 290000, stage: "proposal", probability: 65, expectedCloseDate: daysFromNow(25) },
  { title: "Solaris Patient Portal", contactIdx: 11, accountIdx: 3, repIdx: 4, value: 67000, stage: "qualified", probability: 45, expectedCloseDate: daysFromNow(50) },
];

for (const d of dealData) {
  await conn.query(
    `INSERT INTO deals (title, contactId, accountId, assignedRepId, value, stage, probability, expectedCloseDate, actualCloseDate, lostReason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.title,
      contactIds[d.contactIdx],
      accIds[d.accountIdx],
      repIds[d.repIdx],
      d.value,
      d.stage,
      d.probability,
      d.expectedCloseDate || null,
      d.actualCloseDate || null,
      d.lostReason || null,
    ]
  );
}

const [dealRows] = await conn.query("SELECT id FROM deals ORDER BY id");
const dealIds = dealRows.map((r) => r.id);

// ─── Activities ──────────────────────────────────────────────────────────────
const activityData = [
  { type: "call", title: "Discovery call with Ethan Wallace", description: "Discussed current pain points with legacy ERP. Strong interest in automation features.", dealIdx: 0, contactIdx: 0, repIdx: 0, daysAgo: 30 },
  { type: "email", title: "Sent proposal to Ethan Wallace", description: "Delivered comprehensive proposal including pricing tiers and implementation timeline.", dealIdx: 0, contactIdx: 0, repIdx: 0, daysAgo: 20 },
  { type: "meeting", title: "Contract negotiation meeting", description: "Met with legal and procurement team. Agreed on 3-year term with 15% discount.", dealIdx: 0, contactIdx: 0, repIdx: 0, daysAgo: 8 },
  { type: "note", title: "Deal closed — contract signed", description: "Contract executed. Kickoff meeting scheduled for next week.", dealIdx: 0, contactIdx: 0, repIdx: 0, daysAgo: 5 },
  { type: "call", title: "Initial outreach to Nadia Kowalski", description: "Warm intro from mutual connection. Interested in analytics capabilities.", dealIdx: 1, contactIdx: 1, repIdx: 1, daysAgo: 40 },
  { type: "meeting", title: "Product demo — Meridian Capital", description: "Full platform demo. Positive reception from the analytics team.", dealIdx: 1, contactIdx: 1, repIdx: 1, daysAgo: 25 },
  { type: "note", title: "Closed — Meridian Capital", description: "Signed 2-year agreement. Onboarding starts next month.", dealIdx: 1, contactIdx: 1, repIdx: 1, daysAgo: 12 },
  { type: "email", title: "Follow-up on Vortex Logistics AI Module", description: "Sent updated pricing and feature comparison. Awaiting response from procurement.", dealIdx: 10, contactIdx: 10, repIdx: 0, daysAgo: 3 },
  { type: "meeting", title: "Negotiation session — Vortex AI", description: "Discussed custom SLA terms. Legal review in progress.", dealIdx: 10, contactIdx: 10, repIdx: 0, daysAgo: 7 },
  { type: "call", title: "Solaris Health intro call", description: "Spoke with Amara Osei. Identified data compliance as top priority.", dealIdx: 11, contactIdx: 3, repIdx: 1, daysAgo: 15 },
  { type: "email", title: "Proposal sent — Solaris Health", description: "Sent tailored proposal highlighting HIPAA compliance features.", dealIdx: 11, contactIdx: 3, repIdx: 1, daysAgo: 5 },
  { type: "task", title: "Prepare demo for Quantum Retail Phase 2", description: "Build custom demo environment with retail-specific data models.", dealIdx: 12, contactIdx: 4, repIdx: 2, daysAgo: 2 },
  { type: "note", title: "Ironclad ERP — stakeholder alignment", description: "Multiple stakeholders involved. Need executive sponsor to move forward.", dealIdx: 13, contactIdx: 6, repIdx: 3, daysAgo: 10 },
  { type: "call", title: "Cascade Data Warehouse discovery", description: "Technical deep-dive with Chloe Nguyen. Architecture review scheduled.", dealIdx: 14, contactIdx: 7, repIdx: 4, daysAgo: 8 },
];

for (const a of activityData) {
  const createdAt = new Date(now - a.daysAgo * 86400000).toISOString().slice(0, 19).replace("T", " ");
  await conn.query(
    "INSERT INTO activities (type, title, description, dealId, contactId, repId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [a.type, a.title, a.description, dealIds[a.dealIdx], contactIds[a.contactIdx], repIds[a.repIdx], createdAt]
  );
}

await conn.end();
console.log("✅ Seed complete");
