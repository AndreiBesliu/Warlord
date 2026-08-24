// src/logic/combat/aiRules.ts
// Every rule the enemy AI follows, written down once, in the same file the AI cites.
//
// ── Why the rulebook lives in code rather than in a document ───────────────────────────
//
// A document describing an AI drifts from the AI the first time somebody tunes a multiplier,
// and nothing anywhere complains. Here each rule has a stable id, the planner cites that id in
// its trace when the rule fires, and the admin renders this table as the reference. A rule that
// stops firing shows up as a rule nobody cites; a behaviour with no rule shows up as a decision
// with no citation. Neither is visible when the description is prose in a wiki.
//
// `effect` is deliberately written as the arithmetic, not as a paraphrase of it: "×2" is
// checkable against the code and against the trace, "prefers finishing blows" is not.
//
// Pure data. No React, no clock, no rng.

export type AiRuleId =
  // Turn-level: how the enemy side takes a turn at all.
  | 'TURN_ONLY_WHEN_ACTIVE'
  | 'TURN_ORDER_BY_ID'
  | 'TURN_SKIP_DEAD_OR_ROUTED'
  | 'TURN_MOVES_APPLIED_WHILE_PLANNING'
  | 'TURN_BOOK_THE_KILL'
  | 'TURN_ALWAYS_ENDS'
  // Unit-level: how one cohort decides.
  | 'UNIT_NO_LIVING_FOE'
  | 'UNIT_STATS_WITH_OVERRIDE'
  | 'UNIT_POSITIONS_STAND_OR_MOVE'
  | 'UNIT_TERRAIN_RANGE_BONUS'
  | 'UNIT_NEEDS_LINE_OF_SIGHT'
  | 'UNIT_SCORE_DAMAGE_SHARE'
  | 'UNIT_THREAT_WEIGHT'
  | 'UNIT_SECURE_THE_KILL'
  | 'UNIT_RANGED_AVOIDS_MELEE'
  | 'UNIT_RANGED_PREFERS_DISTANCE'
  | 'UNIT_TIES_KEEP_THE_EARLIER'
  | 'UNIT_ADVANCE_WHEN_NO_SHOT'
  | 'UNIT_ADVANCE_TOWARD_ANY_FOE'
  | 'UNIT_ADVANCE_MUST_CLOSE'
  | 'UNIT_HOLDS_WHEN_BOXED_IN'

export interface AiRule {
  id: AiRuleId
  scope: 'turn' | 'unit'
  name: string
  /** The arithmetic or the condition, checkable against the code. Never a paraphrase. */
  effect: string
  /** Why the rule exists — the part that stops a later reader from "simplifying" it away. */
  why: string
}

export const AI_RULES: AiRule[] = [
  {
    id: 'TURN_ONLY_WHEN_ACTIVE',
    scope: 'turn',
    name: 'Plans only on its own turn',
    effect: "status !== 'ONGOING' or side !== 'ENEMY' → the command list is just END_TURN.",
    why: 'The planner is called from a reducer loop; without this it would happily plan a turn it does not own.',
  },
  {
    id: 'TURN_ORDER_BY_ID',
    scope: 'turn',
    name: 'Acts in ascending id order',
    effect: 'Cohorts are sorted by the number in their id (E0, E1, … E11) and planned in that order.',
    why: 'The AI must be a pure function of the state: identical state, identical commands. Any order that depends on array position would break replay and PvP verification.',
  },
  {
    id: 'TURN_SKIP_DEAD_OR_ROUTED',
    scope: 'turn',
    name: 'The dead and the routed issue nothing',
    effect: 'hp <= 0 or routed → no command for that cohort.',
    why: 'A routed cohort is out of the battle but still on the board; commanding it would be commanding a unit the player can no longer fight.',
  },
  {
    id: 'TURN_MOVES_APPLIED_WHILE_PLANNING',
    scope: 'turn',
    name: 'Each move is applied to a private copy before the next cohort plans',
    effect: 'A planned MOVE is applied to a clone of the state, so later cohorts see the tile as taken.',
    why: 'Without it, two cohorts plan into the same tile and the second command is refused when replayed — the enemy would appear to freeze at random. MOVE consumes no rng, so applying it while planning cannot change the battle.',
  },
  {
    id: 'TURN_BOOK_THE_KILL',
    scope: 'turn',
    name: 'A planned kill is booked against the target',
    effect: "Expected kills are subtracted from the target's shadow hp for the rest of the turn.",
    why: 'Otherwise every cohort in range picks the same nearly-dead target and the whole turn is spent overkilling one cohort. The booking is a within-turn ledger only — it never means the battlefield is empty (see UNIT_ADVANCE_TOWARD_ANY_FOE).',
  },
  {
    id: 'TURN_ALWAYS_ENDS',
    scope: 'turn',
    name: 'The list always ends with END_TURN',
    effect: 'END_TURN is appended unconditionally, even when no cohort acted.',
    why: 'END_TURN is what advances the battle. A turn that produced no commands must still end, or the battle hangs.',
  },

  {
    id: 'UNIT_NO_LIVING_FOE',
    scope: 'unit',
    name: 'Nothing to do when no enemy is alive',
    effect: 'No PLAYER cohort with hp > 0 → the cohort issues no command.',
    why: 'Victory is decided by the engine, not here. This is the only condition under which standing still is correct.',
  },
  {
    id: 'UNIT_STATS_WITH_OVERRIDE',
    scope: 'unit',
    name: 'Plans from the stats the engine will enforce',
    effect: 'resolveStats is called with statsOverride, exactly as the engine does.',
    why: 'The planner used to omit the override while the engine applied it, so the AI could queue an attack from a range the engine then refused — the cohort moved and then did nothing, and the reason appeared nowhere. Latent while nothing sets an override on an enemy; real the moment a mod does.',
  },
  {
    id: 'UNIT_POSITIONS_STAND_OR_MOVE',
    scope: 'unit',
    name: 'Considers standing still and every legal move',
    effect: 'Candidate positions = the current tile plus every tile in legalMoves.',
    why: 'A cohort that can shoot from where it stands should not have to move first. Standing still is a real option, scored like any other.',
  },
  {
    id: 'UNIT_TERRAIN_RANGE_BONUS',
    scope: 'unit',
    name: 'Height and open ground extend a ranged cohort',
    effect: "range = base range + the candidate tile's rangeBonus, for ranged cohorts only (base range >= 2).",
    why: 'It is what makes a hill worth taking. Melee gets no bonus because reach is not a property of the ground.',
  },
  {
    id: 'UNIT_NEEDS_LINE_OF_SIGHT',
    scope: 'unit',
    name: 'Cannot shoot through what it cannot see through',
    effect: 'At distance >= 2 the target must pass hasLineOfSight from the candidate tile.',
    why: 'The same check the engine applies. Planning without it produces attacks the engine refuses.',
  },
  {
    id: 'UNIT_SCORE_DAMAGE_SHARE',
    scope: 'unit',
    name: 'Scores by the share of the target it removes',
    effect: 'score = expectedKills / max(1, shadow hp of the target) × threat.',
    why: 'A share, not a count: twenty kills against a cohort of six hundred is worth less than six against a cohort of six. Planning uses MEAN damage, so the AI never sees the dice.',
  },
  {
    id: 'UNIT_THREAT_WEIGHT',
    scope: 'unit',
    name: 'Prefers the dangerous target',
    effect: 'threat = 1 + attack / 20, multiplied into the score.',
    why: 'Between two equally hurt targets, removing the one that hits hardest is worth more.',
  },
  {
    id: 'UNIT_SECURE_THE_KILL',
    scope: 'unit',
    name: 'Doubles the score for a finishing blow',
    effect: 'expectedKills >= the target’s remaining shadow hp → score × 2.',
    why: 'A destroyed cohort stops retaliating and stops acting. Half-killing two is worth less than killing one.',
  },
  {
    id: 'UNIT_RANGED_AVOIDS_MELEE',
    scope: 'unit',
    name: 'Archers do not want to be in contact',
    effect: 'Ranged cohort at distance 1 → score × 0.5.',
    why: 'It halves the appeal rather than forbidding it, so a ranged cohort with no other option still shoots what is in its face.',
  },
  {
    id: 'UNIT_RANGED_PREFERS_DISTANCE',
    scope: 'unit',
    name: 'Archers shoot from as far as they can',
    effect: 'Ranged cohort at distance d >= 2 → score × (1 + 0.05 × d).',
    why: 'Distance is safety it will not get back once contact is made.',
  },
  {
    id: 'UNIT_TIES_KEEP_THE_EARLIER',
    scope: 'unit',
    name: 'A tie keeps the candidate found first',
    effect: 'A new candidate wins only on score > best + 1e-9. Positions are enumerated stand-first, targets in array order.',
    why: 'The tie-break is the determinism: standing still beats moving for the same score, and the earlier target wins. The epsilon keeps float noise from reordering identical plans.',
  },
  {
    id: 'UNIT_ADVANCE_WHEN_NO_SHOT',
    scope: 'unit',
    name: 'With no shot anywhere, it closes',
    effect: 'No scoring candidate from any position → fall through to the advance.',
    why: 'An army that only acts when it already has a shot never starts a battle.',
  },
  {
    id: 'UNIT_ADVANCE_TOWARD_ANY_FOE',
    scope: 'unit',
    name: 'Closes on whichever cohort it can actually approach',
    effect: 'The advance considers every LIVING player cohort and takes the largest distance reduction toward any of them.',
    why: 'It used to fix on the nearest cohort and give up if no tile closed on THAT one — a cohort walled off from the nearest stood still while another was open. It also used the within-turn kill ledger here, so once every foe was booked as dead the whole remaining army froze in place for the turn; if the dice then under-rolled, the player survived against an army that had not moved.',
  },
  {
    id: 'UNIT_ADVANCE_MUST_CLOSE',
    scope: 'unit',
    name: 'Only a step that closes the distance is taken',
    effect: 'A candidate tile is accepted only if it strictly reduces the Chebyshev distance to its target.',
    why: 'Deliberate. Accepting equal-distance steps lets a blocked cohort shuffle sideways between two tiles turn after turn, which reads as a broken AI rather than a cautious one. The cost is that a boxed-in cohort holds — see UNIT_HOLDS_WHEN_BOXED_IN.',
  },
  {
    id: 'UNIT_HOLDS_WHEN_BOXED_IN',
    scope: 'unit',
    name: 'Holds position when nothing closes',
    effect: 'No tile reduces the distance to any living cohort → no command.',
    why: 'Allies block each other: legalMoves treats an occupied tile as impassable, so a rear rank can be walled in by its own front rank. Holding is the honest outcome, and the trace says so rather than leaving a silent gap.',
  },
]

export const AI_RULE_BY_ID: Record<AiRuleId, AiRule> =
  Object.fromEntries(AI_RULES.map((r) => [r.id, r])) as Record<AiRuleId, AiRule>
