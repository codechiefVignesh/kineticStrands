# kineticStrands

Simulation of a system of coupled **non-linear second-order differential equations** using Lagrangian mechanics.

![Simulation Preview](image.png)

---

## Derivation

The derivation of the system of differential equations can be found here:  
[Click here](https://example.com)

---

## Environment

Make sure you have the following installed:

- **Python**: 3.14.3  
- **Node.js (LTS)**: v24.14.1  
- **npm**: 11.11.0  
- **OS**: Windows 11  

---

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/codechiefVignesh/kineticStrands.git
cd kineticStrands
```

---

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn numpy scipy
```

---

### 3. Frontend Setup
```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install three @react-three/fiber @react-three/drei axios
```

---

### 4. Run Backend
```bash
cd ../backend
uvicorn main:app --reload
```

---

### 5. Configure Frontend

Copy the contents of the following files from:

```
kineticStrands/crack/
```

into your frontend project:
- `App.jsx`
- `App.css`
- `index.html`

---

### 6. Run Frontend
```bash
cd ../frontend
npm run dev
```

---

### 7. Open in Browser

Go to:
```
http://localhost:5173
```

---

## Notes

- Ensure backend is running before starting frontend  
- Uses FastAPI for simulation and React + Three.js for visualization  
- Simulation is highly sensitive to initial conditions (chaotic system)
