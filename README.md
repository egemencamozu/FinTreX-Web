<div align="center">
  <h1>📈 FinTreX</h1>
  <p><b>Bridging individual investors with professional financial consultants through a data-driven, AI-augmented consultation ecosystem.</b></p>
</div>

---

## 📖 About The Project

**FinTreX** is a next-generation Financial Portfolio Management System designed to empower both everyday investors and professional economists. Beyond standard portfolio tracking for BIST, Cryptocurrencies, and Precious Metals, FinTreX introduces a unique consultation ecosystem. Users can track their investments in real-time and, when needed, assign analytical tasks to real human Economists. Connect, chat, and receive highly tailored financial advice backed by hard data and AI-assisted summaries.

### User Roles & Subscriptions
- **Standard User (Investor):** Tracks their portfolio and seeks financial consultation.
- **Economist (Consultant):** Has strictly read-only access to users' shared portfolio data to provide consultations (no trade execution capabilities).
- **Administrator:** Manages the platform, users, and handles disputes.

**Subscription Tiers** (Default/Free, Premium, Ultra) regulate usage limits such as maximum daily chat messages, the number of tracked portfolios, and the frequency of AI agent access.

## ✨ Core Features

- **Multi-Asset Portfolio Tracking:** Monitor assets across BIST (Istanbul Stock Exchange), Cryptocurrencies, and Precious Metals in one unified dashboard.
- **Consultation Ecosystem:** Directly match and communicate with professional Economists through a secure, built-in chat system.
- **Task Assignment:** Users can bundle their portfolio data and assign specific analysis "Tasks" to Economists.
- **Role-Based Access Control:** Strict data privacy ensuring Economists have read-only views exclusively during active consultations.
- **Tiered Memberships:** Scalable features allowing casual users to use the app for free, while power users can unlock premium analytics and unlimited interactions.

## 🤖 Planned AI Integration: The PAA Agent

To solve the significant "Cold-Start" problem for Economists, FinTreX utilizes the **Pre-Analysis Assistant (PAA)**. 

When an investor submits an analytical task to an Economist, the PAA steps in to bridge the gap. It automatically fetches the investor's read-only portfolio snapshot along with the latest relevant market data and processes this through an LLM.

**Output:** The PAA generates a structured "**Pre-Analysis Summary Card**". This card is presented to the Economist *before* they even begin drafting their advice, drastically reducing their research time and onboarding friction per client.

> **Constraint & Compliance:** The PAA AI agent **does not** give financial advice directly to the user. Its sole purpose is to summarize complex, raw financial data securely for the Economist's review.

## 💻 Technology Stack

### Current Draft Status (For this Homework)
The current codebase in this repository comprises a functional Draft UI prototype. Based on AI-generated UI designs (Stitch), it serves as a live visual proof-of-concept.
- **Frontend Prototype:** HTML, CSS, JavaScript.

### Planned Production Stack
- **Web Application:** Angular 
- **Mobile Application:** Flutter
- **Backend API:** .NET 8 API
- **Database:** Azure SQL
- **Authentication:** JWT (JSON Web Tokens)
- **Payments & Subscriptions:** Stripe API

## 📁 Repository Structure

The project is modularly organized to separate concerns clearly:
- 📂 **`front/`** — Contains all Frontend Web UI prototype codes and assets.
- 📂 **`back/`** — Reserved for the .NET 8 Backend API architecture.
- 📂 **`docs/`** — Contains project documentation, reports, and PDFs.

## 🚀 Getting Started / Run Instructions

To view the current visual prototype locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/egemencamozu/FinTreX-Web.git
   cd FinTreX-Web
   ```
2. **Navigate to the frontend directory:**
   ```bash
   cd front
   ```
3. **Run the Application:**
   Since this is a static HTML/CSS prototype scaffolding, you can serve it via:
   - **Using Live Server (VS Code Extension):** Open `front/src/index.html` in VS Code and click "Go Live" at the bottom right to launch it in your browser.
   - **Using Angular CLI (For future development, if Node & Angular are installed):**
     ```bash
     npm install
     ng serve
     ```
     Then open your browser and navigate to `http://localhost:4200/`.

## 🎓 Homework Submission Note

> **A comprehensive 17-page AI Agent Planning Document & UI Showcase (PDF) is included in this repository.** 
> The UI mockups inside the document serve as the visual proof and live demo alternative for this assignment. Please refer to the `docs/` folder to review this extensive planning.
