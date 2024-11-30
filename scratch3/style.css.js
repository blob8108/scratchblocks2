// Processed by Rollup

const common = `
.sb3-label {
  font: 500 12pt Helvetica Neue, Helvetica, sans-serif;
  word-spacing: +1pt;
}

.sb3-literal-number,
.sb3-literal-string,
.sb3-literal-number-dropdown,
.sb3-literal-dropdown {
  word-spacing: 0;
}

.sb3-diff {
  fill: none;
  stroke: #000;
}
.sb3-diff-ins {
  stroke-width: 2px;
}
.sb3-diff-del {
  stroke-width: 3px;
}
`

// These override colors defined per style
const commonOverride = `
/* Note: comment colors are different from Scratch. */

.sb3-comment {
  fill: #ffffa5;
  stroke: #d0d1d2;
  stroke-width: 1;
}
.sb3-comment-line {
  fill: #ffff80;
}
/* specificity */
.sb3-comment-label,
.sb3-label.sb3-comment-label {
  font: 400 12pt Helvetica Neue, Helvetica, sans-serif;
  fill: #000;
  word-spacing: 0;
}`

const createRule = (category, name, style) => `
svg${name} .sb3-${category} {
  fill: ${style[category + "Primary"]};
  stroke: ${style[category + "Tertiary"]};
}
svg${name} .sb3-${category}-alt {
  fill: ${style[category + "Secondary"]};
}
svg${name} .sb3-${category}-dark {
  fill: ${style[category + "Tertiary"]};
}
`

const create = (name, style) => `
${createRule("motion", name, style)}
${createRule("looks", name, style)}
${createRule("sound", name, style)}
${createRule("control", name, style)}
${createRule("events", name, style)}
${createRule("sensing", name, style)}
${createRule("operators", name, style)}
${createRule("variables", name, style)}
${createRule("list", name, style)}
${createRule("custom", name, style)}
${createRule("extension", name, style)}
${createRule("obsolete", name, style)}
${createRule("grey", name, style)}

svg${name} .sb3-label {
  fill: ${style.label};
}

svg${name} .sb3-input-color {
  stroke: ${style.inputColorStroke};
}

svg${name} .sb3-input-number,
svg${name} .sb3-input-string {
  fill: ${style.inputFill};
}
svg${name} .sb3-literal-number,
svg${name} .sb3-literal-string {
  fill: ${style.literal};
}

svg${name} .sb3-custom-arg {
  fill: ${style.customPrimary};
  stroke: ${style.customTertiary};
}
`

const originalStyle = {
  label: "#fff",
  inputColorStroke: "#fff",
  inputFill: "#fff",
  /* Blockly color: text */
  literal: "#575e75",

  motionPrimary: "#4c97ff",
  motionSecondary: "#4280d7",
  motionTertiary: "#3373cc",

  looksPrimary: "#9966ff",
  looksSecondary: "#855cd6",
  looksTertiary: "#774dcb",

  soundPrimary: "#cf63cf",
  soundSecondary: "#c94fc9",
  soundTertiary: "#bd42bd",

  controlPrimary: "#ffab19",
  controlSecondary: "#ec9c13",
  controlTertiary: "#cf8b17",

  eventsPrimary: "#ffbf00",
  eventsSecondary: "#e6ac00",
  eventsTertiary: "#cc9900",

  sensingPrimary: "#5cb1d6",
  sensingSecondary: "#47a8d1",
  sensingTertiary: "#2e8eb8",

  operatorsPrimary: "#59c059",
  operatorsSecondary: "#46b946",
  operatorsTertiary: "#389438",

  variablesPrimary: "#ff8c1a",
  variablesSecondary: "#ff8000",
  variablesTertiary: "#db6e00",

  listPrimary: "#ff661a",
  listSecondary: "#ff5500",
  listTertiary: "#e64d00",

  customPrimary: "#ff6680",
  customSecondary: "#ff4d6a",
  customTertiary: "#ff3355",

  extensionPrimary: "#0fbd8c",
  extensionSecondary: "#0da57a",
  extensionTertiary: "#0b8e69",

  /**
   * Custom color types. Not defined by Scratch.
   */
  obsoletePrimary: "#ed4242",
  obsoleteSecondary: "#db3333",
  obsoleteTertiary: "#ca2b2b",

  /* From early prototype colors */
  greyPrimary: "#bfbfbf",
  greySecondary: "#b2b2b2",
  greyTertiary: "#909090",
}

const highContrastStyle = {
  label: "#000",
  inputColorStroke: "#fff",
  inputFill: "#fff",
  literal: "#000",

  motionPrimary: "#80b5ff",
  motionSecondary: "#b3d2ff",
  motionTertiary: "#3373cc",

  looksPrimary: "#ccb3ff",
  looksSecondary: "#ddccff",
  looksTertiary: "#774dcb",

  soundPrimary: "#e19de1",
  soundSecondary: "#ffb3ff",
  soundTertiary: "#bd42bd",

  controlPrimary: "#ffbe4c",
  controlSecondary: "#ffda99",
  controlTertiary: "#cf8b17",

  eventsPrimary: "#ffd966",
  eventsSecondary: "#ffecb3",
  eventsTertiary: "#cc9900",

  sensingPrimary: "#85c4e0",
  sensingSecondary: "#aed8ea",
  sensingTertiary: "#2e8eb8",

  operatorsPrimary: "#7ece7e",
  operatorsSecondary: "#b5e3b5",
  operatorsTertiary: "#389438",

  variablesPrimary: "#ffa54c",
  variablesSecondary: "#ffcc99",
  variablesTertiary: "#db6e00",

  listPrimary: "#ff9966",
  listSecondary: "#ffcab0",
  listTertiary: "#e64d00",

  customPrimary: "#ff99aa",
  customSecondary: "#ffccd5",
  customTertiary: "#e64d00",

  extensionPrimary: "#13ecaf",
  extensionSecondary: "#75f0cd",
  extensionTertiary: "#0b8e69",

  /* Manually picked to be readable on black text */
  obsoletePrimary: "#fc6666",
  obsoleteSecondary: "#fcb0b0",
  obsoleteTertiary: "#d32121",

  greyPrimary: "#bfbfbf",
  greySecondary: "#b2b2b2",
  /* Changed to be AAA against #000000, was AA */
  greyTertiary: "#959595",
}

export default common +
  create("", originalStyle) +
  create(".scratchblocks-style-scratch3-high-contrast", highContrastStyle) +
  commonOverride
