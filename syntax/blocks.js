import { extensions, aliasExtensions } from "./extensions.js"

// List of classes we're allowed to override.

const overrideCategories = [
  "motion",
  "looks",
  "sound",
  "variables",
  "list",
  "events",
  "control",
  "sensing",
  "operators",
  "custom",
  "custom-arg",
  "extension",
  "grey",
  "obsolete",
  ...Object.keys(extensions),
  ...Object.keys(aliasExtensions),
]

const overrideShapes = [
  "hat",
  "cap",
  "stack",
  "boolean",
  "reporter",
  "ring",
  "cat",
  "define-hat",
]

// languages that should be displayed right to left
export const rtlLanguages = ["ar", "ckb", "fa", "he"]

// List of commands taken from Scratch
import scratchCommands from "./commands.js"

const inputNumberPat = /%([0-9]+)/
export const inputPat = /(%[a-zA-Z0-9](?:\.[a-zA-Z0-9]+)?)/
const inputPatGlobal = new RegExp(inputPat.source, "g")
export const iconPat = /(@[a-zA-Z]+)/
const splitPat = new RegExp(`${inputPat.source}|${iconPat.source}| +`, "g")

export const hexColorPat = /^#(?:[0-9a-fA-F]{3}){1,2}?$/

export function parseInputNumber(part) {
  const m = inputNumberPat.exec(part)
  return m ? +m[1] : 0
}

// used for procDefs
export function parseSpec(spec) {
  const parts = spec.split(splitPat).filter(x => x)
  const inputs = parts.filter(p => inputPat.test(p))
  return {
    spec: spec,
    parts: parts,
    inputs: inputs,
    hash: hashSpec(spec),
  }
}

export function hashSpec(spec) {
  return minifyHash(spec.replace(inputPatGlobal, " _ "))
}

export function minifyHash(hash) {
  return hash
    .replace(/_/g, " _ ")
    .replace(/ +/g, " ")
    .replace(/[,%?:]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(". . .", "...")
    .replace(/^…$/, "...")
    .trim()
    .toLowerCase()
}

export const blocksById = {}
const allBlocks = scratchCommands.map(def => {
  if (!def.id) {
    if (!def.selector) {
      throw new Error(`Missing ID: ${def.spec}`)
    }
    def.id = `sb2:${def.selector}`
  }
  if (!def.spec) {
    throw new Error(`Missing spec: ${def.id}`)
  }

  const info = {
    id: def.id, // Used for Scratch 3 translations
    spec: def.spec, // Used for Scratch 2 translations
    parts: def.spec.split(splitPat).filter(x => x),
    selector: def.selector || `sb3:${def.id}`, // Used for JSON marshalling
    inputs: def.inputs == null ? [] : def.inputs,
    shape: def.shape,
    category: def.category,
    hasLoopArrow: !!def.hasLoopArrow,
  }
  if (blocksById[info.id]) {
    throw new Error(`Duplicate ID: ${info.id}`)
  }
  blocksById[info.id] = info
  return info
})

export const unicodeIcons = {
  "@greenFlag": "⚑",
  "@turnRight": "↻",
  "@turnLeft": "↺",
  "@addInput": "▸",
  "@delInput": "◂",
}

export const allLanguages = {}
function loadLanguage(code, language) {
  const blocksByHash = (language.blocksByHash = {})

  Object.keys(language.commands).forEach(blockId => {
    const nativeSpec = language.commands[blockId]
    const block = blocksById[blockId]

    const nativeHash = hashSpec(nativeSpec)
    if (!blocksByHash[nativeHash]) {
      blocksByHash[nativeHash] = []
    }
    blocksByHash[nativeHash].push(block)

    // fallback image replacement, for languages without aliases
    const m = iconPat.exec(block.spec)
    if (m) {
      const image = m[0]
      const hash = nativeHash.replace(hashSpec(image), unicodeIcons[image])
      if (!blocksByHash[hash]) {
        blocksByHash[hash] = []
      }
      blocksByHash[hash].push(block)
    }
  })

  language.nativeAliases = {}
  Object.keys(language.aliases).forEach(alias => {
    const blockId = language.aliases[alias]
    const block = blocksById[blockId]
    if (block === undefined) {
      throw new Error(`Invalid alias '${blockId}'`)
    }
    const aliasHash = hashSpec(alias)
    if (!blocksByHash[aliasHash]) {
      blocksByHash[aliasHash] = []
    }
    blocksByHash[aliasHash].push(block)

    if (!language.nativeAliases[blockId]) {
      language.nativeAliases[blockId] = []
    }
    language.nativeAliases[blockId].push(alias)
  })

  // Some English blocks were renamed between Scratch 2 and Scratch 3. Wire them
  // into language.blocksByHash
  Object.keys(language.renamedBlocks || {}).forEach(alt => {
    const id = language.renamedBlocks[alt]
    if (!blocksById[id]) {
      throw new Error(`Unknown ID: ${id}`)
    }
    const block = blocksById[id]
    const hash = hashSpec(alt)
    if (!english.blocksByHash[hash]) {
      english.blocksByHash[hash] = []
    }
    english.blocksByHash[hash].push(block)
  })

  language.nativeDropdowns = {}
  Object.keys(language.dropdowns).forEach(name => {
    const nativeName = language.dropdowns[name]
    language.nativeDropdowns[nativeName] = name
  })

  language.code = code
  allLanguages[code] = language
}
export function loadLanguages(languages) {
  Object.keys(languages).forEach(code => loadLanguage(code, languages[code]))
}

export const english = {
  aliases: {
    "turn ccw %1 degrees": "MOTION_TURNLEFT",
    "turn left %1 degrees": "MOTION_TURNLEFT",
    "turn cw %1 degrees": "MOTION_TURNRIGHT",
    "turn right %1 degrees": "MOTION_TURNRIGHT",
    "when flag clicked": "EVENT_WHENFLAGCLICKED",
    "when gf clicked": "EVENT_WHENFLAGCLICKED",
    "when green flag clicked": "EVENT_WHENFLAGCLICKED",
  },

  renamedBlocks: {
    "say %1 for %2 secs": "LOOKS_SAYFORSECS",
    "think %1 for %2 secs": "LOOKS_THINKFORSECS",
    "play sound %1": "SOUND_PLAY",
    "wait %1 secs": "CONTROL_WAIT",
    clear: "pen.clear",
  },

  definePrefix: ["define"],
  defineSuffix: [],

  // For ignoring the lt sign in the "when distance < _" block
  ignorelt: ["when distance"],

  // Valid arguments to "of" dropdown, for resolving ambiguous situations
  math: [
    "abs",
    "floor",
    "ceiling",
    "sqrt",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "ln",
    "log",
    "e ^",
    "10 ^",
  ],

  // Language name is needed for the English locale as well
  name: "English",

  // Valid arguments to "sound effect" dropdown, for resolving ambiguous situations
  soundEffects: ["pitch", "pan left/right"],

  // Valid arguments to "microbit when" dropdown
  microbitWhen: ["moved", "shaken", "jumped"],

  // For detecting the "stop" cap / stack block
  osis: ["other scripts in sprite", "other scripts in stage"],

  dropdowns: {},

  commands: {},
}
allBlocks.forEach(info => {
  english.commands[info.id] = info.spec
})
loadLanguages({
  en: english,
})

/*****************************************************************************/

function registerCheck(id, func) {
  if (!blocksById[id]) {
    throw new Error(`Unknown ID: ${id}`)
  }
  blocksById[id].accepts = func
}

function specialCase(id, func) {
  if (!blocksById[id]) {
    throw new Error(`Unknown ID: ${id}`)
  }
  blocksById[id].specialCase = func
}

function disambig(id1, id2, test) {
  registerCheck(id1, (_, children, lang) => {
    return test(children, lang)
  })
  registerCheck(id2, (_, children, lang) => {
    return !test(children, lang)
  })
}

disambig("OPERATORS_MATHOP", "SENSING_OF", (children, lang) => {
  // Operators if math function, otherwise sensing "attribute of" block
  const first = children[0]
  if (!first.isInput) {
    return
  }
  const name = first.value
  return lang.math.includes(name)
})

disambig("SOUND_CHANGEEFFECTBY", "LOOKS_CHANGEEFFECTBY", (children, lang) => {
  // Sound if sound effect, otherwise default to graphic effect
  for (const child of children) {
    if (child.shape === "dropdown") {
      const name = child.value
      for (const effect of lang.soundEffects) {
        if (minifyHash(effect) === minifyHash(name)) {
          return true
        }
      }
    }
  }
  return false
})

disambig("SOUND_SETEFFECTO", "LOOKS_SETEFFECTTO", (children, lang) => {
  // Sound if sound effect, otherwise default to graphic effect
  for (const child of children) {
    if (child.shape === "dropdown") {
      const name = child.value
      for (const effect of lang.soundEffects) {
        if (minifyHash(effect) === minifyHash(name)) {
          return true
        }
      }
    }
  }
  return false
})

disambig("DATA_LENGTHOFLIST", "OPERATORS_LENGTH", (children, _lang) => {
  // List block if dropdown, otherwise operators
  const last = children[children.length - 1]
  if (!last.isInput) {
    return
  }
  return last.shape === "dropdown"
})

disambig("DATA_LISTCONTAINSITEM", "OPERATORS_CONTAINS", (children, _lang) => {
  // List block if dropdown, otherwise operators
  const first = children[0]
  if (!first.isInput) {
    return
  }
  return first.shape === "dropdown"
})

disambig("pen.setColor", "pen.setHue", (children, _lang) => {
  // Color block if color input, otherwise numeric
  const last = children[children.length - 1]
  // If variable, assume color input, since the RGBA hack is common.
  // TODO fix Scratch :P
  return (last.isInput && last.isColor) || last.isBlock
})

disambig("microbit.whenGesture", "gdxfor.whenGesture", (children, lang) => {
  for (const child of children) {
    if (child.shape === "dropdown") {
      const name = child.value
      // Yes, "when shaken" gdxfor block exists. But microbit is more common.
      for (const effect of lang.microbitWhen) {
        if (minifyHash(effect) === minifyHash(name)) {
          return true
        }
      }
    }
  }
  return false
})

// This block does not need disambiguation in English;
// however, many other languages do require that.
disambig("ev3.buttonPressed", "microbit.isButtonPressed", (children, _lang) => {
  for (const child of children) {
    if (child.shape === "dropdown") {
      // EV3 "button pressed" block uses numeric identifier
      // and does not support "any".
      switch (minifyHash(child.value)) {
        case "1":
        case "2":
        case "3":
        case "4":
          return true
        default:
      }
    }
  }
  return false
})

specialCase("CONTROL_STOP", (_, children, lang) => {
  // Cap block unless argument is "other scripts in sprite"
  const last = children[children.length - 1]
  if (!last.isInput) {
    return
  }
  const value = last.value
  if (lang.osis.includes(value)) {
    return { ...blocksById.CONTROL_STOP, shape: "stack" }
  }
})

export function lookupHash(hash, info, children, languages) {
  for (const lang of languages) {
    if (Object.prototype.hasOwnProperty.call(lang.blocksByHash, hash)) {
      const collisions = lang.blocksByHash[hash]
      for (let block of collisions) {
        if (
          info.shape === "reporter" &&
          block.shape !== "reporter" &&
          block.shape !== "ring"
        ) {
          continue
        }
        if (info.shape === "boolean" && block.shape !== "boolean") {
          continue
        }
        if (collisions.length > 1) {
          // Only check in case of collision;
          // perform "disambiguation"
          if (block.accepts && !block.accepts(info, children, lang)) {
            continue
          }
        }
        if (block.specialCase) {
          block = block.specialCase(info, children, lang) || block
        }
        return { type: block, lang: lang }
      }
    }
  }
}

export function lookupDropdown(name, languages) {
  for (const lang of languages) {
    if (Object.prototype.hasOwnProperty.call(lang.nativeDropdowns, name)) {
      return lang.nativeDropdowns[name]
    }
  }
}

export function applyOverrides(info, overrides) {
  for (const name of overrides) {
    if (hexColorPat.test(name)) {
      info.color = name
      info.category = ""
      info.categoryIsDefault = false
    } else if (overrideCategories.includes(name)) {
      info.category = name
      info.categoryIsDefault = false
    } else if (overrideShapes.includes(name)) {
      info.shape = name
    } else if (name === "loop") {
      info.hasLoopArrow = true
    } else if (name === "+" || name === "-") {
      info.diff = name
    }
  }
}

export function blockName(block) {
  const words = []
  for (const child of block.children) {
    if (!child.isLabel) {
      return
    }
    words.push(child.value)
  }
  return words.join(" ")
}
