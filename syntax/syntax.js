function assert(bool, message) {
  if (!bool) {
    throw new Error(`Assertion failed! ${message || ""}`)
  }
}

import {
  Label,
  Icon,
  Input,
  Block,
  Comment,
  Glow,
  Script,
  Document,
} from "./model.js"

import {
  allLanguages,
  lookupDropdown,
  hexColorPat,
  minifyHash,
  lookupHash,
  hashSpec,
  applyOverrides,
  rtlLanguages,
  iconPat,
  blockName,
} from "./blocks.js"

function paintBlock(info, children, languages) {
  let overrides = []
  if (Array.isArray(children[children.length - 1])) {
    overrides = children.pop()
  }

  // build hash
  const words = []
  for (const child of children) {
    if (child.isLabel) {
      words.push(child.value)
    } else if (child.isIcon) {
      words.push(`@${child.name}`)
    } else {
      words.push("_")
    }
  }
  const string = words.join(" ")
  const shortHash = (info.hash = minifyHash(string))

  // paint
  const o = lookupHash(shortHash, info, children, languages)
  let lang
  let type
  if (o) {
    lang = o.lang
    type = o.type
    info.language = lang
    info.isRTL = rtlLanguages.includes(lang.code)

    if (
      type.shape === "ring" ? info.shape === "reporter" : info.shape === "stack"
    ) {
      info.shape = type.shape
    }
    info.category = type.category
    info.categoryIsDefault = true
    // store selector, used for translation among other things
    if (type.selector) {
      info.selector = type.selector
    }
    if (type.id) {
      info.id = type.id
    }
    info.hasLoopArrow = type.hasLoopArrow

    // ellipsis block
    if (type.spec === ". . .") {
      children = [new Label(". . .")]
    }
  } else {
    // The block was not recognised, so we check if it's a define block.
    //
    // We check for built-in blocks first to avoid ambiguity, e.g. the
    // `defina o tamanho como (100) %` block in pt_BR.
    for (const lang of languages) {
      if (!isDefineBlock(children, lang)) {
        continue
      }

      // Setting the shape also triggers some logic in recogniseStuff.
      info.shape = "define-hat"
      info.category = "custom"

      // Move the children of the define block into an "outline", transforming
      // () and [] shapes as we go.
      const outlineChildren = children
        .splice(
          lang.definePrefix.length,
          children.length - lang.defineSuffix.length,
        )
        .map(child => {
          // In the context of an outline, only reporter and predicate
          // parameter definitions can appear. At the point of parsing we
          // didn't know that (define blocks are recognised in this later
          // stage) -- so we need to convert the following back into
          // reporters/predicates:
          //
          // - empty boolean slots `<>`
          // - string inputs like `[foo]`
          // - number inputs like `(1)`

          // Convert empty boolean slot `<>` to an empty predicate.
          if (child.isInput && child.isBoolean) {
            child = paintBlock(
              {
                shape: "boolean",
                argument: "boolean",
                category: "custom-arg",
              },
              [new Label("")],
              languages,
            )
          } else if (
            child.isInput &&
            (child.shape === "string" || child.shape === "number")
          ) {
            // Convert string inputs like `[foo]` and number inputs like `(1)` into reporter shapes.
            const labels = child.value.split(/ +/g).map(word => new Label(word))
            child = paintBlock(
              {
                shape: "reporter",
                argument: child.shape === "string" ? "string" : "number",
                category: "custom-arg",
              },
              labels,
              languages,
            )
          }

          // Always override the category to `custom-arg` -- reporters like `(x
          // position)` can't appear inside an outline.
          if (child.isReporter || child.isBoolean) {
            // Convert variables to number arguments, predicates to boolean arguments.
            if (child.info.categoryIsDefault) {
              child.info.category = "custom-arg"
              child.info.argument = child.isBoolean ? "boolean" : "number"
            }
          }
          return child
        })

      const outlineInfo = {
        shape: "outline",
        category: "custom",
        categoryIsDefault: true,
        hasLoopArrow: false,
      }
      const outline = new Block(outlineInfo, outlineChildren)
      children.splice(lang.definePrefix.length, 0, outline)
      break
    }
  }

  // Apply overrides.
  applyOverrides(info, overrides)

  // loop arrows
  if (info.hasLoopArrow) {
    children.push(new Icon("loopArrow"))
  }

  const block = new Block(info, children)

  // image replacement
  if (type && iconPat.test(type.spec)) {
    block.translate(lang, true)
  }

  // diffs
  if (info.diff === "+") {
    return new Glow(block)
  }
  block.diff = info.diff

  return block
}

function isDefineBlock(children, lang) {
  if (children.length < lang.definePrefix.length) {
    return false
  }
  if (children.length < lang.defineSuffix.length) {
    return false
  }

  for (let i = 0; i < lang.definePrefix.length; i++) {
    const defineWord = lang.definePrefix[i]
    const child = children[i]
    if (!child.isLabel || minifyHash(child.value) !== minifyHash(defineWord)) {
      return false
    }
  }

  for (let i = 1; i <= lang.defineSuffix.length; i++) {
    const defineWord = lang.defineSuffix[lang.defineSuffix.length - i]
    const child = children[children.length - i]
    if (!child.isLabel || minifyHash(child.value) !== minifyHash(defineWord)) {
      return false
    }
  }

  return true
}

function parseLines(code, languages) {
  let tok = code[0]
  let index = 0
  function next() {
    tok = code[++index]
  }
  function peek() {
    return code[index + 1]
  }
  function peekNonWs() {
    for (let i = index + 1; i < code.length; i++) {
      if (code[i] !== " ") {
        return code[i]
      }
    }
  }
  let sawNL

  let define = []
  languages.map(lang => {
    define = define.concat(lang.define)
  })

  function makeBlock(shape, children) {
    const hasInputs = children.filter(x => !x.isLabel).length

    const info = {
      shape: shape,
      category: shape === "reporter" && !hasInputs ? "variables" : "obsolete",
      categoryIsDefault: true,
      hasLoopArrow: false,
    }

    return paintBlock(info, children, languages)
  }

  function makeMenu(shape, value) {
    const menu = lookupDropdown(value, languages) || value
    return new Input(shape, value, menu)
  }

  function pParts(end) {
    const children = []
    let label
    while (tok && tok !== "\n") {
      // So that comparison operators `<()<()>` and `<()>()>` don't need the
      // central <> escaped, we interpret it as a label if particular
      // conditions are met.
      if (
        (tok === "<" || tok === ">") &&
        end === ">" && // We're parsing a predicate.
        children.length === 1 && // There's exactly one AST node behind us.
        !children[children.length - 1].isLabel // That node is not a label.
      ) {
        const c = peekNonWs()
        // The next token starts some kind of input.
        if (c === "[" || c === "(" || c === "<" || c === "{") {
          label = null
          children.push(new Label(tok))
          next()
          continue
        }
      }
      if (tok === end) {
        break
      }
      if (tok === "/" && peek() === "/" && !end) {
        break
      }

      switch (tok) {
        case "[":
          label = null
          children.push(pString())
          break
        case "(":
          label = null
          children.push(pReporter())
          break
        case "<":
          label = null
          children.push(pPredicate())
          break
        case "{":
          label = null
          children.push(pEmbedded())
          break
        case " ":
        case "\t":
          next() // Skip over whitespace.
          label = null
          break
        case "◂":
        case "▸":
          children.push(pIcon())
          label = null
          break
        case "@": {
          next()
          let name = ""
          while (tok && /[a-zA-Z]/.test(tok)) {
            name += tok
            next()
          }
          if (name === "cloud") {
            children.push(new Label("☁"))
          } else {
            children.push(
              Object.prototype.hasOwnProperty.call(Icon.icons, name)
                ? new Icon(name)
                : new Label(`@${name}`),
            )
          }
          label = null
          break
        }
        case "\\":
          next() // escape character
        // fallthrough
        case ":":
          if (tok === ":" && peek() === ":") {
            children.push(pOverrides(end))
            return children
          }
        // fallthrough
        default:
          if (!label) {
            children.push((label = new Label("")))
          }
          label.value += tok
          next()
      }
    }
    return children
  }

  function pString() {
    next() // '['
    let s = ""
    let escapeV = false
    while (tok && tok !== "]" && tok !== "\n") {
      if (tok === "\\") {
        next()
        if (tok === "v") {
          escapeV = true
        }
        if (!tok) {
          break
        }
      } else {
        escapeV = false
      }
      s += tok
      next()
    }
    if (tok === "]") {
      next()
    }
    if (hexColorPat.test(s)) {
      return new Input("color", s)
    }
    return !escapeV && / v$/.test(s)
      ? makeMenu("dropdown", s.slice(0, s.length - 2))
      : new Input("string", s)
  }

  function pBlock(end) {
    const children = pParts(end)
    if (tok && tok === "\n") {
      sawNL = true
      next()
    }
    if (children.length === 0) {
      return
    }

    // standalone reporters
    if (children.length === 1) {
      const child = children[0]
      if (
        child.isBlock &&
        (child.isReporter || child.isBoolean || child.isRing)
      ) {
        return child
      }
    }

    return makeBlock("stack", children)
  }

  function pReporter() {
    next() // '('

    // empty number-dropdown
    if (tok === " ") {
      next()
      if (tok === "v" && peek() === ")") {
        next()
        next()
        return new Input("number-dropdown", "")
      }
    }

    const children = pParts(")")
    if (tok && tok === ")") {
      next()
    }

    // empty numbers
    if (children.length === 0) {
      return new Input("number", "")
    }

    // number
    if (children.length === 1 && children[0].isLabel) {
      const value = children[0].value
      if (/^[0-9e.-]*$/.test(value)) {
        return new Input("number", value)
      }
      if (hexColorPat.test(value)) {
        return new Input("color", value)
      }
    }

    // number-dropdown
    if (children.length > 1 && children.every(child => child.isLabel)) {
      const last = children[children.length - 1]
      if (last.value === "v") {
        children.pop()
        const value = children.map(l => l.value).join(" ")
        return makeMenu("number-dropdown", value)
      }
    }

    const block = makeBlock("reporter", children)

    // rings
    if (block.info && block.info.shape === "ring") {
      const first = block.children[0]
      if (
        first &&
        first.isInput &&
        first.shape === "number" &&
        first.value === ""
      ) {
        block.children[0] = new Input("reporter")
      } else if (
        (first && first.isScript && first.isEmpty) ||
        (first && first.isBlock && !first.children.length)
      ) {
        block.children[0] = new Input("stack")
      }
    }

    return block
  }

  function pPredicate() {
    next() // '<'
    const children = pParts(">")
    if (tok && tok === ">") {
      next()
    }
    if (children.length === 0) {
      return new Input("boolean")
    }
    return makeBlock("boolean", children)
  }

  function pEmbedded() {
    next() // '{'

    sawNL = false
    const f = function () {
      while (tok && tok !== "}") {
        const block = pBlock("}")
        if (block) {
          return block
        }
      }
    }
    const scripts = parseScripts(f)
    let blocks = []
    scripts.forEach(script => {
      blocks = blocks.concat(script.blocks)
    })

    if (tok === "}") {
      next()
    }
    if (!sawNL) {
      assert(blocks.length <= 1)
      return blocks.length ? blocks[0] : makeBlock("stack", [])
    }
    return new Script(blocks)
  }

  function pIcon() {
    const c = tok
    next()
    switch (c) {
      case "▸":
        return new Icon("addInput")
      case "◂":
        return new Icon("delInput")
      default:
        return
    }
  }

  function pOverrides(end) {
    next()
    next()
    const overrides = []
    let override = ""
    while (tok && tok !== "\n" && tok !== end) {
      if (tok === " ") {
        if (override) {
          overrides.push(override)
          override = ""
        }
      } else if (tok === "/" && peek() === "/") {
        break
      } else {
        override += tok
      }
      next()
    }
    if (override) {
      overrides.push(override)
    }
    return overrides
  }

  function pComment(end) {
    next()
    next()
    let comment = ""
    while (tok && tok !== "\n" && tok !== end) {
      comment += tok
      next()
    }
    if (tok && tok === "\n") {
      next()
    }
    return new Comment(comment, true)
  }

  function pLine() {
    let diff
    if (tok === "+" || tok === "-") {
      diff = tok
      next()
    }
    const block = pBlock()
    if (tok === "/" && peek() === "/") {
      const comment = pComment()
      comment.hasBlock = block && block.children.length
      if (!comment.hasBlock) {
        return comment
      }
      block.comment = comment
    }
    if (block) {
      block.diff = diff
    }
    return block
  }

  return () => {
    if (!tok) {
      return undefined
    }
    const line = pLine()
    return line || "NL"
  }
}

/* * */

function parseScripts(getLine) {
  let line = getLine()
  function next() {
    line = getLine()
  }

  function pFile() {
    while (line === "NL") {
      next()
    }
    const scripts = []
    while (line) {
      let blocks = []
      while (line && line !== "NL") {
        let b = pLine()
        const isGlow = b.diff === "+"
        if (isGlow) {
          b.diff = null
        }

        if (b.isElse || b.isEnd) {
          b = new Block({ ...b.info, shape: "stack" }, b.children)
        }

        if (isGlow) {
          const last = blocks[blocks.length - 1]
          let children = []
          if (last && last.isGlow) {
            blocks.pop()
            children = last.child.isScript ? last.child.blocks : [last.child]
          }
          children.push(b)
          blocks.push(new Glow(new Script(children)))
        } else if (b.isHat) {
          if (blocks.length) {
            scripts.push(new Script(blocks))
          }
          blocks = [b]
        } else if (b.isFinal) {
          blocks.push(b)
          break
        } else if (b.isCommand) {
          blocks.push(b)
        } else {
          // reporter or predicate
          if (blocks.length) {
            scripts.push(new Script(blocks))
          }
          scripts.push(new Script([b]))
          blocks = []
          break
        }
      }
      if (blocks.length) {
        scripts.push(new Script(blocks))
      }
      while (line === "NL") {
        next()
      }
    }
    return scripts
  }

  function pLine() {
    const b = line
    next()

    if (b.hasScript) {
      while (true) {
        const blocks = pMouth()
        b.children.push(new Script(blocks))
        if (line && line.isElse) {
          for (const child of line.children) {
            b.children.push(child)
          }
          next()
          continue
        }
        if (line && line.isEnd) {
          next()
        }
        break
      }
    }
    return b
  }

  function pMouth() {
    const blocks = []
    while (line) {
      if (line === "NL") {
        next()
        continue
      }
      if (!line.isCommand) {
        return blocks
      }

      const b = pLine()
      const isGlow = b.diff === "+"
      if (isGlow) {
        b.diff = null
      }

      if (isGlow) {
        const last = blocks[blocks.length - 1]
        let children = []
        if (last && last.isGlow) {
          blocks.pop()
          children = last.child.isScript ? last.child.blocks : [last.child]
        }
        children.push(b)
        blocks.push(new Glow(new Script(children)))
      } else {
        blocks.push(b)
      }
    }
    return blocks
  }

  return pFile()
}

/* * */

function eachBlock(x, cb) {
  if (x.isScript) {
    x.blocks = x.blocks.map(block => {
      eachBlock(block, cb)
      return cb(block) || block
    })
  } else if (x.isBlock) {
    x.children = x.children.map(child => {
      eachBlock(child, cb)
      return cb(child) || child
    })
  } else if (x.isGlow) {
    eachBlock(x.child, cb)
  }
}

const listBlocks = {
  "append:toList:": 1,
  "deleteLine:ofList:": 1,
  "insert:at:ofList:": 2,
  "setLine:ofList:to:": 1,
  "showList:": 0,
  "hideList:": 0,
}

function recogniseStuff(scripts) {
  const customBlocksByHash = Object.create(null)
  const listNames = new Set()

  scripts.forEach(script => {
    const customArgs = new Set()

    eachBlock(script, block => {
      if (!block.isBlock) {
        return
      }

      // custom blocks
      if (block.info.shape === "define-hat") {
        // There should be exactly one `outline` child, added in paintBlock.
        const outline = block.children.find(child => child.isOutline)
        if (!outline) {
          return
        }

        const names = []
        const parts = []
        for (const child of outline.children) {
          if (child.isLabel) {
            parts.push(child.value)
          } else if (child.isBlock) {
            if (!child.info.argument) {
              return
            }
            parts.push(
              {
                number: "%n",
                string: "%s",
                boolean: "%b",
              }[child.info.argument],
            )

            const name = blockName(child)
            names.push(name)
            customArgs.add(name)
          }
        }
        const spec = parts.join(" ")
        const hash = hashSpec(spec)

        const info = {
          spec: spec,
          names: names,
        }
        if (!customBlocksByHash[hash]) {
          customBlocksByHash[hash] = info
        }
        block.info.id = "PROCEDURES_DEFINITION"
        block.info.selector = "procDef"
        block.info.call = info.spec
        block.info.names = info.names
        block.info.category = "custom"

        // custom arguments
      } else if (
        block.info.categoryIsDefault &&
        (block.isReporter || block.isBoolean)
      ) {
        const name = blockName(block)
        if (customArgs.has(name)) {
          block.info.category = "custom-arg"
          block.info.categoryIsDefault = false
          block.info.selector = "getParam"
        }

        // list names
      } else if (
        Object.prototype.hasOwnProperty.call(listBlocks, block.info.selector)
      ) {
        const argIndex = listBlocks[block.info.selector]
        const inputs = block.children.filter(child => !child.isLabel)
        const input = inputs[argIndex]
        if (input && input.isInput) {
          listNames.add(input.value)
        }
      }
    })
  })

  scripts.forEach(script => {
    eachBlock(script, block => {
      if (
        block.info &&
        block.info.categoryIsDefault &&
        block.info.category === "obsolete"
      ) {
        // custom blocks
        const info = customBlocksByHash[block.info.hash]
        if (info) {
          block.info.selector = "call"
          block.info.call = info.spec
          block.info.names = info.names
          block.info.category = "custom"
        }
        return
      }

      let name, info
      if (
        block.isReporter &&
        block.info.category === "variables" &&
        block.info.categoryIsDefault
      ) {
        // We set the selector here for some reason
        block.info.selector = "readVariable"
        name = blockName(block)
        info = block.info
      }
      if (!name) {
        return
      }

      // list reporters
      if (listNames.has(name)) {
        info.category = "list"
        info.categoryIsDefault = false
        info.selector = "contentsOfList:"
      }

      return // already done
    })
  })
}

export function parse(code, options) {
  options = {
    inline: false,
    languages: ["en"],
    ...options,
  }

  if (options.dialect) {
    throw new Error("Option 'dialect' no longer supported")
  }

  code = code.replace(/&lt;/g, "<")
  code = code.replace(/&gt;/g, ">")
  if (options.inline) {
    code = code.replace(/\n/g, " ")
  }

  const languages = options.languages.map(code => {
    const lang = allLanguages[code]
    if (!lang) {
      throw new Error(`Unknown language: '${code}'`)
    }
    return lang
  })

  /* * */

  const f = parseLines(code, languages)
  const scripts = parseScripts(f)
  recogniseStuff(scripts)
  return new Document(scripts)
}
