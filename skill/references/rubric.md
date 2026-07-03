# The Fidelity Rubric (The Critic)

`check_fidelity` (`qwen3-vl-plus`) scores each rendered shot **back against the child's
original drawing**. The output is worthless the instant it stops looking like the actual
drawing, so this is the load-bearing gate. It returns a 0–1 score and a verdict.

The Critic is asked, for Image 1 (the original drawing) vs Image 2 (a frame from the shot):

1. **Same character?** Is this recognisably the same creature/subject the child drew?
2. **Same colours?** Are the crayon hues the ones sampled from the drawing (the palette),
   including the "over-pressed" darker patches?
3. **Same wonky proportions?** Two different-sized wings, mismatched eyes, the head too
   big — are the child's proportions preserved (not "corrected")?
4. **Did the model "improve" / smooth it?** Clean anti-aliased edges, symmetric features,
   gradient shading = **failure**. A child's marker outline and past-the-lines crayon = pass.

Score bands:

| score | meaning | action |
|---|---|---|
| ≥ 0.80 | faithful — it's still theirs | keep |
| 0.65–0.80 | drifting — starting to smooth | **re-draw this one shot** (never the episode) |
| < 0.65 | lost the child's hand | re-draw with the reference weighted harder; if it still won't hold, say so and offer *keep it looser* / *try again* |

The re-render is **targeted**: only the failing shot is re-filmed, with `prompt_extend`
off and stylization locked ("preserve crayon texture, childlike proportions, marker
outlines — do not smooth or correct"). This is also the budget win (re-filming one shot,
not the whole ~50s episode).

Never dress a drifted render up as faithful. Honesty is the moat.
