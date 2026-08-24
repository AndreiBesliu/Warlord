// Warlord's Tailwind colour scale, shared by BOTH builds: the game's own config and
// the host app's (which is what actually compiles the game when it's embedded as a
// submodule). Keep it here, in the game repo — the tokens travel with the game.
//
// Every name is `wl-` prefixed so nothing collides with a host's own scale
// (OurDaysApp already owns `accent`, `border`, `background`, `primary`, ...).
// Values come from src/styles/tokens.css, which the game imports itself.

const v = (name) => `hsl(var(--wl-${name}) / <alpha-value>)`

export const warlordColors = {
  'wl-surface': v('surface'),
  'wl-panel': v('panel'),
  'wl-panel-muted': v('panel-muted'),
  'wl-panel-contrast': v('panel-contrast'),

  'wl-ink': v('ink'),
  'wl-muted': v('muted'),
  'wl-subtle': v('subtle'),
  'wl-inverse': v('inverse'),
  'wl-contrast-ink': v('contrast-ink'),
  'wl-art-ink': v('art-ink'),

  'wl-line': v('line'),
  'wl-line-strong': v('line-strong'),

  'wl-accent': v('accent'),
  'wl-accent-ink': v('accent-ink'),
  'wl-accent-surface': v('accent-surface'),
  'wl-accent-line': v('accent-line'),

  'wl-good': v('good'),
  'wl-good-surface': v('good-surface'),
  'wl-bad': v('bad'),
  'wl-bad-surface': v('bad-surface'),
  'wl-bad-ink': v('bad-ink'),
  'wl-warn': v('warn'),
  'wl-warn-surface': v('warn-surface'),
  'wl-info': v('info'),

  'wl-economy': v('economy'),
  'wl-economy-surface': v('economy-surface'),
  'wl-army': v('army'),
  'wl-army-surface': v('army-surface'),
  'wl-campaign': v('campaign'),
  'wl-campaign-surface': v('campaign-surface'),
  'wl-doctrine': v('doctrine'),
  'wl-doctrine-surface': v('doctrine-surface'),

  'wl-plains': v('plains'),
  'wl-forest': v('forest'),
  'wl-hill': v('hill'),
  'wl-river': v('river'),
}
