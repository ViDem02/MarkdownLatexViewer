Below is a compact but complete worked EKF example for a **differential-drive** robot with:

- **Inputs:** wheel encoder increments (or wheel angular increments) over a sample period Δt  
- **State:** planar pose \( \mathbf{x} = [x,\ y,\ \theta]^T \)  
- **Measurements:** **range–bearing** to known landmarks \( \mathbf{m}_i = [m_{x,i}, m_{y,i}]^T \)  
- **Focus:** the **linearization** (Jacobians \(F=\partial f/\partial x\), \(G=\partial f/\partial w\), \(H=\partial h/\partial x\))

I’ll use **engineering notation** (powers of \(10^3\) in examples) where it makes sense.
🌟🌟🌟🌟
---

## 1) Model definitions

### 1.1 State
\[
\mathbf{x}_k =
\begin{bmatrix}
x_k
y_k\\
\theta_k
\end{bmatrix}
\]

### 1.2 Differential-drive kinematics (discrete-time)

Let wheel travel increments over \([k,k+1)\) be \(\Delta s_R,\ \Delta s_L\) (from encoders). Define:

\[
\Delta s = \frac{\Delta s_R + \Delta s_L}{2}
\qquad
\Delta \theta = \frac{\Delta s_R - \Delta s_L}{b}
\]
where \(b\) is the wheel baseline (m).

A standard discrete motion model (midpoint heading) is:
\[
\theta_{k+1} = \theta_k + \Delta\theta
\]
\[
x_{k+1} = x_k + \Delta s\ \cos\!\left(\theta_k + \frac{\Delta\theta}{2}\right)
\]
\[
y_{k+1} = y_k + \Delta s\ \sin\!\left(\theta_k + \frac{\Delta\theta}{2}\right)
\]

Compactly:
\[
\mathbf{x}_{k+1} = f(\mathbf{x}_k, \mathbf{u}_k) + \mathbf{w}_k
\]
with control-like input \(\mathbf{u}_k = [\Delta s_R,\ \Delta s_L]^T\) and process noise \(\mathbf{w}_k\) (we’ll linearize w.r.t. wheel increment noise).

---

## 2) Process linearization (the main thing you asked for)

Define the “mid-heading”:
\[
\phi \triangleq \theta_k + \frac{\Delta\theta}{2}
\]
so:
\[
x_{k+1} = x_k + \Delta s\cos\phi,\quad
y_{k+1} = y_k + \Delta s\sin\phi,\quad
\theta_{k+1}=\theta_k+\Delta\theta
\]

### 2.1 Jacobian wrt state: \(F_k = \frac{\partial f}{\partial \mathbf{x}}\)

Partial derivatives:

- \( \partial x_{k+1}/\partial x_k = 1\)
- \( \partial x_{k+1}/\partial y_k = 0\)
- \( \partial x_{k+1}/\partial \theta_k = \frac{\partial}{\partial\theta_k}(\Delta s\cos\phi) = -\Delta s\sin\phi \cdot \frac{\partial\phi}{\partial\theta_k}\)
but \(\phi=\theta_k+\Delta\theta/2\) and \(\Delta\theta\) is independent of \(\theta_k\), so \(\partial\phi/\partial\theta_k=1\).
Thus:
\[
\frac{\partial x_{k+1}}{\partial \theta_k} = -\Delta s\sin\phi
\]

Similarly:
\[
\frac{\partial y_{k+1}}{\partial \theta_k} = \Delta s\cos\phi
\]
and:
\[
\frac{\partial \theta_{k+1}}{\partial \theta_k}=1
\]

So:
\[
F_k =
\begin{bmatrix}
1 & 0 & -\Delta s\sin\phi\\
0 & 1 & \ \Delta s\cos\phi\\
0 & 0 & 1
\end{bmatrix}
\]

That’s the clean “EKF pose Jacobian” for the midpoint model.

---

### 2.2 Jacobian wrt wheel increment noise: \(G_k = \frac{\partial f}{\partial \mathbf{w}}\)

A very common and practical setup is to treat the wheel increments as noisy:

\[
\Delta s_R = \Delta \hat{s}_R + \eta_R,\qquad
\Delta s_L = \Delta \hat{s}_L + \eta_L
\]
where \(\eta_R,\eta_L\) are zero-mean Gaussian with covariance:
\[
Q_{\eta} =
\begin{bmatrix}
\sigma_R^2 & 0\\
0 & \sigma_L^2
\end{bmatrix}
\]

Then you want:
\[
G_k = \frac{\partial f}{\partial \boldsymbol{\eta}}
\quad\text{(a \(3\times 2\) matrix)}
\]

First, derivatives of \(\Delta s\) and \(\Delta\theta\):
\[
\Delta s = \frac{\Delta s_R+\Delta s_L}{2}
\Rightarrow
\frac{\partial \Delta s}{\partial \Delta s_R}=\frac{1}{2},\ 
\frac{\partial \Delta s}{\partial \Delta s_L}=\frac{1}{2}
\]
\[
\Delta\theta = \frac{\Delta s_R-\Delta s_L}{b}
\Rightarrow
\frac{\partial \Delta\theta}{\partial \Delta s_R}=\frac{1}{b},\ 
\frac{\partial \Delta\theta}{\partial \Delta s_L}=-\frac{1}{b}
\]

Also \(\phi = \theta_k + \Delta\theta/2\), so:
\[
\frac{\partial \phi}{\partial \Delta s_R}=\frac{1}{2}\cdot\frac{1}{b}=\frac{1}{2b},\quad
\frac{\partial \phi}{\partial \Delta s_L}=\frac{1}{2}\cdot\left(-\frac{1}{b}\right)=-\frac{1}{2b}
\]

Now:
\[
x_{k+1} = x_k + \Delta s\cos\phi
\]
So:
\[
\frac{\partial x_{k+1}}{\partial \Delta s_R}
=
\frac{\partial \Delta s}{\partial \Delta s_R}\cos\phi
+
\Delta s\frac{\partial(\cos\phi)}{\partial \phi}\frac{\partial \phi}{\partial \Delta s_R}
\]
\[
=
\frac{1}{2}\cos\phi
+
\Delta s(-\sin\phi)\left(\frac{1}{2b}\right)
=
\frac{1}{2}\cos\phi - \frac{\Delta s}{2b}\sin\phi
\]

Similarly:
\[
\frac{\partial x_{k+1}}{\partial \Delta s_L}
=
\frac{1}{2}\cos\phi
+
\Delta s(-\sin\phi)\left(-\frac{1}{2b}\right)
=
\frac{1}{2}\cos\phi + \frac{\Delta s}{2b}\sin\phi
\]

For \(y_{k+1} = y_k + \Delta s\sin\phi\):
\[
\frac{\partial y_{k+1}}{\partial \Delta s_R}
=
\frac{1}{2}\sin\phi
+
\Delta s(\cos\phi)\left(\frac{1}{2b}\right)
=
\frac{1}{2}\sin\phi + \frac{\Delta s}{2b}\cos\phi
\]
\[
\frac{\partial y_{k+1}}{\partial \Delta s_L}
=
\frac{1}{2}\sin\phi
+
\Delta s(\cos\phi)\left(-\frac{1}{2b}\right)
=
\frac{1}{2}\sin\phi - \frac{\Delta s}{2b}\cos\phi
\]

For heading:
\[
\theta_{k+1}=\theta_k+\Delta\theta
\Rightarrow
\frac{\partial \theta_{k+1}}{\partial \Delta s_R}=\frac{1}{b},\quad
\frac{\partial \theta_{k+1}}{\partial \Delta s_L}=-\frac{1}{b}
\]

Thus:
\[
G_k =
\begin{bmatrix}
\frac{1}{2}\cos\phi - \frac{\Delta s}{2b}\sin\phi & \frac{1}{2}\cos\phi + \frac{\Delta s}{2b}\sin\phi\\[6pt]
\frac{1}{2}\sin\phi + \frac{\Delta s}{2b}\cos\phi & \frac{1}{2}\sin\phi - \frac{\Delta s}{2b}\cos\phi\\[6pt]
\frac{1}{b} & -\frac{1}{b}
\end{bmatrix}
\]

Then process covariance propagation:
\[
P_{k+1}^- = F_k P_k F_k^T + G_k Q_{\eta} G_k^T
\]

---

## 3) Measurement model: range–bearing to a landmark

For landmark \(i\) at \((m_x, m_y)\):

\[
\Delta x = m_x - x,\quad \Delta y = m_y - y
\]
\[
r = \sqrt{\Delta x^2 + \Delta y^2}
\]
\[
\beta = \mathrm{atan2}(\Delta y,\Delta x) - \theta
\]

Measurement:
\[
\mathbf{z} =
\begin{bmatrix}
r\\
\beta
\end{bmatrix}
=
h(\mathbf{x}) + \mathbf{v}
\]

---

## 4) Measurement linearization (Jacobian \(H\))

Let \(q = \Delta x^2 + \Delta y^2\), so \(r=\sqrt{q}\).

### 4.1 Partial derivatives for range
\[
\frac{\partial r}{\partial x} = \frac{\partial}{\partial x}\sqrt{(\Delta x)^2+(\Delta y)^2}
= \frac{1}{2\sqrt{q}}(2\Delta x\frac{\partial\Delta x}{\partial x})
= \frac{1}{r}( \Delta x \cdot (-1)) = -\frac{\Delta x}{r}
\]
\[
\frac{\partial r}{\partial y} = -\frac{\Delta y}{r},\quad
\frac{\partial r}{\partial \theta}=0
\]

### 4.2 Partial derivatives for bearing
Use:
\[
\alpha = \mathrm{atan2}(\Delta y,\Delta x)
\]
Known derivatives:
\[
\frac{\partial \alpha}{\partial \Delta x} = -\frac{\Delta y}{q},\quad
\frac{\partial \alpha}{\partial \Delta y} = \frac{\Delta x}{q}
\]
And \(\Delta x = m_x-x\Rightarrow \partial \Delta x/\partial x=-1\),
\(\Delta y = m_y-y\Rightarrow \partial \Delta y/\partial y=-1\).

So:
\[
\frac{\partial \alpha}{\partial x} = \frac{\partial \alpha}{\partial \Delta x}\frac{\partial \Delta x}{\partial x}
= \left(-\frac{\Delta y}{q}\right)(-1)=\frac{\Delta y}{q}
\]
\[
\frac{\partial \alpha}{\partial y} = \frac{\partial \alpha}{\partial \Delta y}\frac{\partial \Delta y}{\partial y}
= \left(\frac{\Delta x}{q}\right)(-1)=-\frac{\Delta x}{q}
\]

Finally \(\beta=\alpha-\theta\):
\[
\frac{\partial \beta}{\partial x}=\frac{\Delta y}{q},\quad
\frac{\partial \beta}{\partial y}=-\frac{\Delta x}{q},\quad
\frac{\partial \beta}{\partial \theta}=-1
\]

Thus:
\[
H =
\begin{bmatrix}
-\frac{\Delta x}{r} & -\frac{\Delta y}{r} & 0\\[6pt]
\frac{\Delta y}{q} & -\frac{\Delta x}{q} & -1
\end{bmatrix}
\]

Innovation:
\[
\mathbf{y} = \mathbf{z} - h(\mathbf{x}^-)
\]
with angle normalization on bearing residual:
\[
y_\beta \leftarrow \mathrm{wrapToPi}(y_\beta)
\]

Kalman gain and update:
\[
S = H P^- H^T + R
\]
\[
K = P^- H^T S^{-1}
\]
\[
\mathbf{x}^+ = \mathbf{x}^- + K\mathbf{y}
\]
\[
P^+ = (I - KH)P^-
\]

---

## 5) Small numeric illustration (engineering notation)

Suppose:

- \(b = 3.00\times 10^{-1}\ \text{m}\)
- Prior \(\theta_k = 3.50\times 10^{-1}\ \text{rad}\)
- Encoder increments: \(\Delta s_R=5.10\times 10^{-2}\ \text{m}\), \(\Delta s_L=4.90\times 10^{-2}\ \text{m}\)

Compute:
\[
\Delta s = \frac{5.10e{-2}+4.90e{-2}}{2}=5.00\times 10^{-2}\ \text{m}
\]
\[
\Delta\theta = \frac{5.10e{-2}-4.90e{-2}}{3.00e{-1}}
= \frac{2.00e{-3}}{3.00e{-1}}
= 6.67\times 10^{-3}\ \text{rad}
\]
\[
\phi = \theta_k+\Delta\theta/2
= 3.50e{-1}+3.33e{-3}
= 3.53\times 10^{-1}\ \text{rad}
\]

Then the **state Jacobian** \(F_k\) uses only \(\Delta s\) and \(\phi\):
\[
F_k =
\begin{bmatrix}
1 & 0 & -5.00e{-2}\sin(3.53e{-1})\\
0 & 1 & \ \ 5.00e{-2}\cos(3.53e{-1})\\
0 & 0 & 1
\end{bmatrix}
\]
Numerically \(\sin(0.353)\approx3.45e{-1}\), \(\cos(0.353)\approx9.39e{-1}\):
\[
F_k \approx
\begin{bmatrix}
1 & 0 & -1.72e{-2}\\
0 & 1 & \ \ 4.70e{-2}\\
0 & 0 & 1
\end{bmatrix}
\]

This is the key intuition: the coupling of heading uncertainty into \(x,y\) grows with \(\Delta s\).

---

## 6) Notes on common EKF “gotchas” (re: linearization)

- **Use the predicted state** \( \mathbf{x}^- \) when computing \(H\) (i.e., linearize at the operating point).
- **Angle wrapping**: always wrap \(\theta\) after prediction/update, and wrap the bearing residual.
- If \(\Delta\theta\) is extremely small, the midpoint model above is still fine; it avoids some numerical issues of “exact arc” formulas while staying accurate to \(O(\Delta\theta^2)\).
- If you instead use the exact ICC model (radius/curvature), the Jacobians get more complex; the midpoint model is often the best engineering tradeoff.

---

If you tell me what convention you want for encoder noise (noise on **wheel angle** \(\Delta\varphi\) vs **arc length** \(\Delta s\)), and whether landmarks are known or also estimated (EKF-SLAM), I can tailor the \(G_k\) and \(Q\) model and show a full single-step numeric EKF update with \(R\) in engineering notation.