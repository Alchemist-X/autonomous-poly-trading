# FIFA 8-model forecast run

- Group matches (training): 72
- Knockout fixtures forecast: 15
- Forecasters: 9 (8 models + multi-calibrated)

> In-sample group-stage calibration below is an OPTIMISTIC sanity check (the
> ensemble & multi-calibrated views are fit on these same rows). The real
> comparison is the held-out knockout results, scored as each match resolves.

```
  #  model                                                logLoss    brier      rps     acc      ece     n
  1  Line-breaks & offers efficiency (gradient-boosted)    0.2297   0.0903   0.0294   0.986   0.1972    72
  2  Passing-network structure (random forest)             0.3966   0.1995   0.0626   0.958   0.2684    72
  3  Tactical style-clash mElo                             0.6525   0.3730   0.0988   0.694   0.1493    72
  4  Multi-calibrated 8-in-1                               0.6733   0.3730   0.1142   0.778   0.2256    72
  5  Physical-decay dynamic-K Elo                          0.8767   0.5192   0.1571   0.611   0.1490    72
  6  xG-corrected Elo                                      0.8961   0.5328   0.1632   0.611   0.0875    72
  7  Dixon-Coles (Bayesian-shrunk)                         0.9109   0.5445   0.1705   0.611   0.1510    72
  8  Stacked Ensemble                                      0.9764   0.5827   0.1978   0.472   0.2723    72
  9  PRODEGY split attack/defence Elo                      1.1212   0.6732   0.2345   0.389   0.0627    72
```
