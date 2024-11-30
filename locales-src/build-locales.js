import { readFile, writeFile } from "fs/promises"
import path from "path"

import scratchCommands from "../syntax/commands.js"
import extraAliases from "./extra_aliases.js"

import scratch_l10n from "scratch-l10n"
// We can't `import {default}` since it's a reserved word.
const localeNames = scratch_l10n.default

const readJSONFile = async path => {
  const contents = await readFile(path, "utf-8")
  const result = JSON.parse(contents)
  return result
}

let english
const rawLocales = async () => {
  const result = []
  for (const code in localeNames) {
    const raw = {
      code: code,
      mappings: await readJSONFile(
        `node_modules/scratch-l10n/editor/blocks/${code}.json`,
      ),
      extensionMappings: await readJSONFile(
        `node_modules/scratch-l10n/editor/extensions/${code}.json`,
      ),
    }
    if (code === "en") {
      english = raw
    } else {
      result.push(raw)
    }
  }
  return result
}

const soundEffects = ["SOUND_EFFECTS_PITCH", "SOUND_EFFECTS_PAN"]
const microbitWhen = [
  "microbit.gesturesMenu.moved",
  "microbit.gesturesMenu.shaken",
  "microbit.gesturesMenu.jumped",
]
const osis = ["CONTROL_STOP_OTHER"]
const scratchSpecs = scratchCommands.map(block => block.spec)

const palette = [
  "CATEGORY_MOTION",
  "CATEGORY_LOOKS",
  "CATEGORY_SOUND",
  "CATEGORY_EVENTS",
  "CATEGORY_CONTROL",
  "CATEGORY_SENSING",
  "CATEGORY_OPERATORS",
  "CATEGORY_VARIABLES",
  "CATEGORY_MYBLOCKS",
]

const mathFuncs = [
  "OPERATORS_MATHOP_ABS",
  "OPERATORS_MATHOP_FLOOR",
  "OPERATORS_MATHOP_CEILING",
  "OPERATORS_MATHOP_SQRT",
  "OPERATORS_MATHOP_SIN",
  "OPERATORS_MATHOP_COS",
  "OPERATORS_MATHOP_TAN",
  "OPERATORS_MATHOP_ASIN",
  "OPERATORS_MATHOP_ACOS",
  "OPERATORS_MATHOP_ATAN",
  "OPERATORS_MATHOP_LN",
  "OPERATORS_MATHOP_LOG",
  "OPERATORS_MATHOP_EEXP",
  "OPERATORS_MATHOP_10EXP",
]

const writeJSON = async (outputPath, obj) => {
  const contents = JSON.stringify(obj, null, "  ")
  await writeFile(outputPath, contents, "utf-8")
}

const translateKey = (raw, key) => {
  const result = raw.mappings[key] || raw.extensionMappings[key]
  const englishResult = english.mappings[key] || english.extensionMappings[key]
  if (!englishResult) {
    throw new Error(`Unknown key: '${key}'`)
  }
  if (!result) {
    return null
  }
  //if (result === englishResult) return
  return fixup(key, result, englishResult)
}

const lookupEachIn = raw => items => {
  const output = []
  for (const key of items) {
    const result = translateKey(raw, key)
    if (!result) {
      continue
    }
    output.push(result)
  }
  return output
}

const translateEachIn = raw => items => {
  const output = {}
  for (const key of items) {
    const result = translateKey(raw, key)
    const englishResult = english.mappings[key]
    if (!result) {
      continue
    }
    output[englishResult] = result
  }
  return output
}

const buildLocale = (code, rawLocale) => {
  const listFor = lookupEachIn(rawLocale)
  const dictionaryWith = translateEachIn(rawLocale)

  const aliases = extraAliases[code]

  const procDef = translateKey(rawLocale, "PROCEDURES_DEFINITION")

  const locale = {
    commands: {},
    dropdowns: {},
    ignorelt: [],
    soundEffects: listFor(soundEffects),
    microbitWhen: listFor(microbitWhen),
    osis: listFor(osis),
    definePrefix: /(.*)%1/
      .exec(procDef)[1]
      .trim()
      .split(/ /g)
      .filter(x => !!x),
    defineSuffix: /%1(.*)/
      .exec(procDef)[1]
      .trim()
      .split(/ /g)
      .filter(x => !!x),
    palette: dictionaryWith(palette), // used for forum menu
    math: listFor(mathFuncs),
    aliases: aliases || {},

    name: localeNames[code].name,
  }

  let translatableCount = 0
  for (const command of scratchCommands) {
    if (!command.id) {
      continue
    }
    if (/^sb2:/.test(command.id)) {
      continue
    }
    if (/^scratchblocks:/.test(command.id)) {
      continue
    }
    translatableCount += 1

    const result = translateKey(rawLocale, command.id)
    if (result == null) {
      // The language is missing the key.
      console.log("Language", code, "is missing key", command.id)
      continue
    }
    if (locale.commands[command.id] != null) {
      console.log("duplicate translation", command.id)
    }
    locale.commands[command.id] = result
  }

  const commandCount = Object.keys(locale.commands).length
  if (commandCount === 0) {
    console.log("No blocks:", localeNames[code].name)
    return
  }
  const frac = commandCount / translatableCount
  console.log(
    `${(code + ":").padEnd(8)} ${(frac * 100).toFixed(1).padStart(5)}%`,
  )

  // Approximate fraction of blocks translated. For some reason not all blocks
  // are included; most locales are 93.7% translated according to this script.
  // So we cheat and treat that as 100.
  //locale.percentTranslated = Math.max(100, Math.round((frac / 0.937) * 100))

  // TODO does this block still exist?
  //const whenDistance = translateKey("when distance < %1")
  //if (whenDistance.indexOf(" < %1") !== -1) {
  //locale.ignorelt.push(whenDistance.replace(/ \< \%1.*$/))
  //}

  return locale
}

const fixup = (key, value, englishValue) => {
  let number = 0
  const variables = {}
  englishValue.replace(/\[[^\]]+\]/g, key => {
    variables[key] = `%${++number}`
  })

  value = value.replace(/\[[^\]]+\]/g, key => variables[key])
  value = value.trim()

  switch (key) {
    case "EVENT_WHENFLAGCLICKED":
      return value.replace("%1", "@greenFlag")
    case "MOTION_TURNLEFT":
      return value.replace("%1", "@turnLeft").replace("%2", "%1")
    case "MOTION_TURNRIGHT":
      return value.replace("%1", "@turnRight").replace("%2", "%1")
    case "CONTROL_STOP":
      return value + " %1"
    default:
      return value
  }
}

const convertFile = async rawLocale => {
  const code = rawLocale.code
  const locale = buildLocale(code, rawLocale)
  if (!locale) {
    return
  }

  const outputPath = path.join("locales", `${code}.json`)
  await writeJSON(outputPath, locale)

  return [code, locale]
}

const writeIndex = async codes => {
  let contents = ""
  for (const code of codes) {
    contents += `import ${code.replace(/-/g, "_")} from "./${code}.json"\n`
  }
  contents += `\n`
  contents += `export default {\n`
  for (const code of codes) {
    contents += `  ${code.replace(/-/g, "_")},\n`
  }
  contents += `}\n`

  const outputPath = path.join("locales", "all.js")
  await writeFile(outputPath, contents, "utf-8")
}

const main = async () => {
  const locales = await Promise.all((await rawLocales()).map(convertFile))
  const validLocales = locales.filter(x => !!x)

  // check every extra language was used
  const seen = new Set(validLocales.map(([code, _locale]) => code))
  for (const code in extraAliases) {
    if (!seen.has(code)) {
      console.error(`extra_aliases: '${code}' not used`)
    }
  }

  const codes = Array.from(seen)
  codes.sort()
  await writeIndex(codes)
}

main()
