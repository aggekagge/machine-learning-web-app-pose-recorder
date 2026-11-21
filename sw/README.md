# Web Application Project

This project is a web application that interacts with a **FastAPI backend** to fetch and display predictions. It includes both frontend and backend components, with the backend implemented in Node.js for the web server.  


- **backend/** – Contains the Node.js server for the web app.  
- **frontend/** – Contains HTML, CSS, JS, and images for the user interface.  
- **Dockerfile** – Optional containerization setup for deployment.  
- **eslint.config.mjs** – ESLint configuration for linting JavaScript code.  

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)  
- npm (Node package manager)  
- FastAPI backend server running separately (the web app depends on it to fetch predictions)

### Installation and Running

1. Open a terminal and navigate to the `backend` folder:

```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server: 
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000` (or the port shown in the terminal).

---

**Note:** The web application requires the FastAPI server to be running in order to fetch predictions and display results correctly.
