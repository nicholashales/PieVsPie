# Pie vs Pie — Art Bible (draft v1)

## Identity and comedy
Original, modern **Spy vs Spy-inspired** graphic sensibility: mischievous, crisp silhouettes, bold outlines, stylised pastry heads, controlled warm texture and subtle consistent shading. Do not directly copy the original comic characters. Clever, friendly, culturally aware parody and visual puns. Where practical, give each fighter a humorous recognisable prop or artefact.

## Roster-wide scale and believable proportions (mandatory)
**Relative fighter size must roughly reflect the real-life counterparts**, preserving suspension of disbelief in the Pie vs Pie world. A very tall celebrity parody should be visibly taller than a short celebrity parody; slender, broad and muscular builds should also be recognisably different. Keep caricature proportions (larger head/smaller body) while applying one consistent mapping from real-world stature/build to illustrated stature/build. Do not resize each fighter independently just to fill its frame. Props and headgear should not misleadingly define body height. For fictional or nonhuman counterparts, agree on an internally consistent plausible scale. Metadata can record reference stature category and the intended illustrated height, but do not claim exact heights without verification.

## Six assets per fighter
Neutral, victory, defeat **facing left**; neutral, victory, defeat **facing right**. Mirror drafts only as a starting point: all lettering, logos and numbers must read correctly in both directions. Preserve each fighter's real anatomical handedness: a left-handed fighter holds the main prop in the left hand in both views, and likewise for right-handed fighters. If handedness is unknown, choose and document a consistent fictional handedness. Wardrobe, props, texture and identity remain identical between poses.

## Shared transparent canvas and animation-ready alignment
- Proposed universal **1024 × 1024 transparent RGBA PNG** canvas, pending test with tallest/widest fighter and props.
- Every fighter and pose uses the same canvas geometry and world-space ground anchor: **(512, 900)**, with feet planted at a common y=900 baseline.
- **Foot contact points remain fixed across neutral/victory/defeat** for each fighter and orientation. A fighter must never jump or slide as the pose changes.
- Relative stature must remain visibly different even with a shared foot baseline: taller fighters extend higher, not from a different base.
- Reserve at least 40 px clear transparent margin around the entire silhouette, including victory arms, props and defeat stars. No cropping.
- Distinct fighters may have different stance widths. Record per-fighter left/right foot coordinates for pose validation. A single canvas/anchor does not require identical foot spacing.
- No baked-in pie or scene background; no fake checkerboard; no opaque shadows. Arena draws grounding shadows separately.
- If a character cannot fit, address character/prop composition or revise the universal art specification, not a unique per-fighter CSS scale.

## File naming and app contract
`images/fighters/v2/<slug>/<slug>--<left|right>--<neutral|win|lose>.png`
Use stable IDs, not names parsed into filenames. App places **all** fighters at the same corner anchor/scale. Changing poses swaps image paths only. Use separate directional assets, not CSS mirror transforms, to protect handedness and readable text. Animation can be introduced later with the same registration.

## Quality checklist
1. Six canonical PNG assets, same 1024 × 1024 dimensions, genuine transparency and adequate margins.
2. Consistent character design and rendering texture across all six poses and against approved style master.
3. Feet aligned and planted across each three-pose sequence; no scale, baseline or camera changes.
4. Text reads correctly in both directions; anatomical weapon hand remains correct.
5. On a side-by-side **roster size comparison**, relative stature/build accurately evokes source counterparts.
6. Silhouettes and humorous props readable at arena size and print size.
7. Verify alpha fringe and clipping automatically; owner signs off before replacing any production artwork.

## Pilot
Produce one six-pose reference fighter and a roster scale lineup containing a short, average-height and tall fighter. Approve both the appearance and **relative size** before batch-generating the 28 existing fighters.

## Pilot roster update
Four pilot fighters: **Crustia Winkleman**, **Alan Star**, **Greggs Davies** and **Icing Charles**. Icing Charles is a deliberate **visual-gag fidelity test**: the refreshed fighter must retain the clever manually added joke in the existing artwork, not merely the celebrity/pun resemblance. **Do not replace the illustration until the existing image has been visually inspected and the gag explicitly described and approved.** Test the gag in both facing directions, including any lettering or hand-specific prop details. Relative size of all four remains consistent.
