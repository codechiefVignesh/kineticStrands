from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.integrate import solve_ivp
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimRequest(BaseModel):
    m1: float = 1.0       # mass 1 (kg)
    m2: float = 1.0       # mass 2 (kg)
    L1: float = 1.0       # length 1 (m)
    L2: float = 1.0       # length 2 (m)
    g: float  = 9.81      # gravity
    theta1: float = 2.0   # initial angle 1 (radians)
    theta2: float = 1.5   # initial angle 2 (radians)
    omega1: float = 0.0   # initial angular velocity 1
    omega2: float = 0.0   # initial angular velocity 2
    t_end: float = 20.0   # simulation time (seconds)
    dt: float = 0.02      # time step

def equations(t, y, m1, m2, L1, L2, g):
    theta1, omega1, theta2, omega2 = y
    delta = theta2 - theta1
    sin_d = np.sin(delta)
    cos_d = np.cos(delta)
    
    denom1 = (m1 + m2) * L1 - m2 * L1 * cos_d**2
    denom2 = (L2 / L1) * denom1

    dtheta1 = omega1
    dtheta2 = omega2

    domega1 = (
        m2 * L1 * omega1**2 * sin_d * cos_d
        + m2 * g * np.sin(theta2) * cos_d
        + m2 * L2 * omega2**2 * sin_d
        - (m1 + m2) * g * np.sin(theta1)
    ) / denom1

    domega2 = (
        -m2 * L2 * omega2**2 * sin_d * cos_d
        + (m1 + m2) * g * np.sin(theta1) * cos_d
        - (m1 + m2) * L1 * omega1**2 * sin_d
        - (m1 + m2) * g * np.sin(theta2)
    ) / denom2

    return [dtheta1, domega1, dtheta2, domega2]

@app.post("/simulate")
def simulate(req: SimRequest):
    y0 = [req.theta1, req.omega1, req.theta2, req.omega2]
    t_span = (0, req.t_end)
    t_eval = np.arange(0, req.t_end, req.dt)

    sol = solve_ivp(
        equations,
        t_span,
        y0,
        args=(req.m1, req.m2, req.L1, req.L2, req.g),
        t_eval=t_eval,
        method="RK45",
        rtol=1e-8,
        atol=1e-10,
    )

    theta1 = sol.y[0]
    theta2 = sol.y[2]

    # Convert to Cartesian coordinates for Three.js
    x1 = req.L1 * np.sin(theta1)
    y1 = -req.L1 * np.cos(theta1)
    x2 = x1 + req.L2 * np.sin(theta2)
    y2 = y1 - req.L2 * np.cos(theta2)

    return {
        "t": sol.t.tolist(),
        "x1": x1.tolist(),
        "y1": y1.tolist(),
        "x2": x2.tolist(),
        "y2": y2.tolist(),
        "theta1": theta1.tolist(),
        "theta2": theta2.tolist(),
    }

@app.get("/")
def root():
    return {"status": "Double Pendulum API running"}