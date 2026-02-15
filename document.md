Use the fact that your *odds update* is multiplicative, and \(\ell(\cdot)\) is just the log of odds.

Let
\[
\ell(p)\;\triangleq\;\log\frac{p}{1-p}.
\]

From the occupancy-grid update in odds form (derived earlier):
\[
\frac{p_t}{1-p_t}
=
\frac{p_z}{1-p_z}\;
\frac{p_{t-1}}{1-p_{t-1}}\;
\frac{1-p_0}{p_0}.
\]
Recognize each fraction as an odds:
\[
\operatorname{odds}(p_t)=\operatorname{odds}(p_z)\,\operatorname{odds}(p_{t-1})\,\frac{1}{\operatorname{odds}(p_0)},
\]
since
\[
\frac{1-p_0}{p_0}=\left(\frac{p_0}{1-p_0}\right)^{-1}.
\]

Now take \(\log\) of both sides:
\[
\log\frac{p_t}{1-p_t}
=
\log\frac{p_z}{1-p_z}
+
\log\frac{p_{t-1}}{1-p_{t-1}}
+
\log\frac{1-p_0}{p_0}.
\]

Rewrite the last term:
\[
\log\frac{1-p_0}{p_0}
=
-\log\frac{p_0}{1-p_0}
=
-\ell(p_0).
\]

So:
\[
\boxed{\ell(p_t)=\ell(p_z)+\ell(p_{t-1})-\ell(p_0).}
\]

That’s all that’s happening: **products in odds become sums in log-odds**, and the prior term appears with a minus sign because it enters as the inverse odds \((1-p_0)/p_0\).