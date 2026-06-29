# FIFA 8-model forecast run

- Group matches (training): 72
- Knockout fixtures forecast: 16
- Forecasters: 9 (8 models + multi-calibrated)

> In-sample group-stage calibration below is an OPTIMISTIC sanity check (the
> ensemble & multi-calibrated views are fit on these same rows). The real
> comparison is the held-out knockout results, scored as each match resolves.

```
  #  model                                                logLoss    brier      rps     acc      ece     n
  1  Line-breaks & offers efficiency (gradient-boosted)    0.2169   0.0773   0.0279   1.000   0.1864    72
  2  Passing-network structure (random forest)             0.4106   0.2004   0.0709   0.958   0.2763    72
  3  Multi-calibrated 8-in-1                               0.6125   0.3377   0.1132   0.833   0.2453    72
  4  Tactical style-clash mElo                             0.6301   0.3579   0.1035   0.722   0.1361    72
  5  Physical-decay dynamic-K Elo                          0.8850   0.5178   0.1750   0.611   0.0650    72
  6  xG-corrected Elo                                      0.9232   0.5452   0.1882   0.583   0.0532    72
  7  Dixon-Coles (Bayesian-shrunk)                         0.9234   0.5411   0.1879   0.556   0.1060    72
  8  Stacked Ensemble                                      0.9849   0.5889   0.2131   0.431   0.1873    72
  9  PRODEGY split attack/defence Elo                      1.1328   0.6856   0.2391   0.444   0.1056    72
```
