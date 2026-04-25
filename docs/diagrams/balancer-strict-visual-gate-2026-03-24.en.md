# Balancer strict visual gate

Date: 2026-03-24

## New target

- “Matching Balancer” is no longer considered sufficient.
- The new target is:
  - judged by an independent subagent
  - benchmarked against the current `balancer.fi` homepage
  - the candidate UI must feel better overall than the baseline before it passes

## Scoring rubric

Each item uses a `10-point scale`:

1. Background color consistency
2. Text color consistency
3. Typography restraint
4. Overflow control
5. Card alignment
6. Material consistency
7. Primary vs secondary narrative
8. Information density
9. Terminal module readability
10. Chart credibility
11. Interaction control discipline
12. Visual rhythm

## Pass criteria

- Average score `>= 8.5`
- No individual item `< 7`
- The following three items must all be `>= 8`
  - primary vs secondary narrative
  - overflow control
  - chart credibility

## Current iteration focus

The independent evaluator identified the weakest 3 items as:

- chart credibility
- primary vs secondary narrative
- information density

So this round only prioritized those problems:

- compress the top preview toolbar so it does not steal the first-screen narrative
- merge the fragmented right-side cards into a denser status surface
- explain clearly why the chart is flat instead of letting it look broken

